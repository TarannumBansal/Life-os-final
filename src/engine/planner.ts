/**
 * Roadmap-derived day-plan generator (iteration 2).
 *
 * Rules:
 *  - Every task is derived from a real WeekItem (built from the current PGOS week).
 *  - No generic/hard-coded tasks. Never invent curriculum.
 *  - A day-task carries the WeekItem's id so completing it decrements the week's
 *    remaining counter through the item-progress ledger.
 *  - Day-mode + Day-Order + college classes shape which items and how many appear.
 */
import nourish from "@/src/data/nourish.json";
import { DerivedDay, totalFreeMinutes } from "./dayOrder";
import { WeekItem, buildWeekItems, getWeekTheme, getWeekObjectives, weekTotal, weekDone } from "./weekLedger";
import { Rationale, rationaleFor } from "./rationale";
import { rankItems, PriorityCtx } from "./priority";
import { isReviewable } from "./reviewable";

export type DayMode = "full" | "college" | "exam" | "flex";
export type BlockType = "routine" | "deep_work" | "class" | "meal" | "workout" | "recovery" | "reflection" | "review";

export interface Task {
  id: string;                    // day-task id, unique within the plan
  weekItemId: string;            // reference to WeekItem.id  (empty for non-roadmap tasks like meals)
  domain: string;
  title: string;
  detail?: string;
  durationMin: number;
  expectedOutput?: string;
  rationale: Rationale | { line: string };
  sourceField?: string;
  reviewable?: boolean;
  reviewKind?: string;
}

export interface Block {
  id: string;
  type: BlockType;
  label: string;
  timeHint?: string;
  durationMin: number;
  tasks: Task[];
  rationale: string;
}

export interface DayPlan {
  date: string;
  weekNumber: number;
  weekTheme: string;
  phase: number;
  mode: DayMode;
  nourishDay: number;
  totalFreeMinutes: number;
  blocks: Block[];
  weekItems: WeekItem[];
  weekTotal: number;
  weekDone: number;
  nextBestAction: { itemId: string; title: string; reason: string } | null;
  flags: {
    isSunday: boolean;
    isHoliday: boolean;
    isExam: boolean;
    isSatStep: boolean;
    isFlex: boolean;
  };
}

const NOURISH_DAYS = (nourish as any).days as any[];

/** Deterministic hash: which slice of week-days this ISO date is. */
function dayOfWeekIndex(dateISO: string): number {
  const d = new Date(dateISO);
  // 0 = Sunday, 6 = Saturday → we map Sunday=6 so Mon(1)=0, Tue(2)=1 ... Sat(6)=5, Sun(0)=6
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1;
}

/** Choose which of `pool` items are scheduled today. Deterministic. */
function selectItemsForToday(
  pool: WeekItem[],
  dayIdx: number,
  progress: Record<string, number>,
  budget: number,
  mode: DayMode,
  isSunday: boolean,
  isExam: boolean,
  isCollegeHeavy: boolean,
): WeekItem[] {
  // Filter by mode
  let candidates = pool.filter((it) => {
    const done = progress[it.id] ?? 0;
    if (done >= it.targetContributions) return false;
    if (isExam) return it.field === "dsa" || it.field === "revision" || it.field === "reflection" || it.field === "know";
    if (isCollegeHeavy) return ["dsa", "tech.topics", "tech.project", "revision", "know"].some((f) => it.field.startsWith(f));
    if (isSunday) return it.weeklySlot === "sunday" || it.field === "reflection" || it.field === "revision" || it.field === "know";
    return true;
  });

  const daily = candidates.filter((c) => c.cadence === "daily");
  const twice = candidates.filter((c) => c.cadence === "twice_week");
  const weekly = candidates.filter((c) => c.cadence === "weekly");

  const twiceToday: WeekItem[] = twice.filter((it, i) => {
    const done = progress[it.id] ?? 0;
    const behind = it.targetContributions - done >= (7 - dayIdx) / 2;
    return dayIdx % 3 === i % 3 || behind;
  });

  // Weekly items: schedule Sunday-slot items on Sunday; "anyday" items get rotated
  // across days 0,2,4,6 so each surfaces at least twice per week.
  const weeklyToday: WeekItem[] = weekly.filter((it, i) => {
    const done = progress[it.id] ?? 0;
    if (done >= it.targetContributions) return false;
    if (it.weeklySlot === "sunday") return isSunday;
    return dayIdx % 2 === i % 2;
  });

  // Cap tech.topics to 2/day so 6 subtopics spread across 3 days instead of hogging one.
  const topicItems = daily.filter((d) => d.field === "tech.topics");
  const cappedTopics = topicItems.filter((_, i) => i < 2 || (topicItems.length > 2 && (dayIdx + i) % topicItems.length < 2));
  const dailyKeep = daily.filter((d) => d.field !== "tech.topics").concat(cappedTopics.slice(0, 2));

  // Sort daily+twice+weekly by order for stable placement.
  // Daily items are protected — sort them before twice_week so budget cuts hit twice_week first.
  const dailyAndTwice = [
    ...dailyKeep.sort((a, b) => a.order - b.order),
    ...twiceToday.sort((a, b) => a.order - b.order),
  ];
  const weeklySorted = [...weeklyToday].sort((a, b) => a.order - b.order);

  // Budget pass — daily and twice-week first (they protect habit + week decomposition),
  // then RESERVE at least one weekly reviewable slot (so the AI-review workflow surfaces),
  // then any remaining weekly items until budget consumed.
  const picked: WeekItem[] = [];
  let acc = 0;
  const softLimit = Math.max(budget, 90);

  for (const it of dailyAndTwice) {
    if (acc >= softLimit && picked.length >= 3) break;
    picked.push(it);
    acc += it.perDayMin;
  }
  // Guaranteed weekly slot — pick the first reviewable weekly item first, then others.
  const reviewableWeekly = weeklySorted.filter((w) => w.reviewable);
  const otherWeekly = weeklySorted.filter((w) => !w.reviewable);
  const weeklyOrder = [...reviewableWeekly, ...otherWeekly];
  if (weeklyOrder.length && !picked.some((p) => p.id === weeklyOrder[0].id)) {
    picked.push(weeklyOrder[0]);
    acc += weeklyOrder[0].perDayMin;
  }
  for (const it of weeklyOrder.slice(1)) {
    if (acc >= softLimit + 45) break;
    picked.push(it);
    acc += it.perDayMin;
  }
  return picked;
}

/** Split picked items into deep-work blocks respecting class times. */
function itemsToBlocks(
  items: WeekItem[],
  ctxItems: WeekItem[],
  progress: Record<string, number>,
  mode: DayMode,
  isSunday: boolean,
  isExam: boolean,
  isSatStep: boolean,
  isCollegeHeavy: boolean,
  freeMinutes: number,
  weekNumber: number,
): Block[] {
  if (!items.length) return [];
  const deepBlocks = isExam || isCollegeHeavy || isSatStep ? 1 : isSunday ? 2 : 2;
  const per = Math.ceil(items.length / deepBlocks);
  const blocks: Block[] = [];
  for (let bi = 0; bi < deepBlocks; bi++) {
    const slice = items.slice(bi * per, (bi + 1) * per);
    if (!slice.length) continue;
    const totalMin = slice.reduce((a, it) => a + it.perDayMin, 0);
    const tasks: Task[] = slice.map((it, i) => {
      const rat = rationaleFor(it, {
        mode, isSunday, isExam, isSatStep, isCollegeHeavy, isFlex: false,
        itemsToday: items, currentIdx: bi * per + i, freeMinutes, progress, weekNumber,
      });
      return {
        id: `t-${it.id}`,
        weekItemId: it.id,
        domain: it.domain,
        title: it.title,
        detail: it.detail,
        durationMin: it.perDayMin,
        expectedOutput: expectedOutputFor(it),
        rationale: rat,
        sourceField: it.field,
        reviewable: isReviewable(it),
        reviewKind: it.reviewKind,
      };
    });
    blocks.push({
      id: `b-deep-${bi}`,
      type: "deep_work",
      label: bi === 0 ? "Deep Work · morning" : "Deep Work · afternoon",
      durationMin: totalMin,
      tasks,
      rationale: bi === 0 ? "Cognitive peak → hardest work first." : "Second focus block sized to remaining free time.",
    });
  }
  return blocks;
}

function expectedOutputFor(it: WeekItem): string {
  switch (it.field) {
    case "dsa": return "Solved + one-line post-mortem (what/why).";
    case "tech.topics": return "Notes + one worked example in the learning log.";
    case "tech.project": return "≥1 real commit pushed.";
    case "microProject": return "Buildable increment committed.";
    case "flagshipProgress": return "Progress log updated with today's move.";
    case "techWriting": return "One note/blog draft or publish.";
    case "engineeringJudgement": return "One line captured — cause / lesson.";
    case "projectLifecycle": return "Lifecycle stage advanced.";
    case "interviewPrep": return "One STAR story or brag-doc entry.";
    case "openSource": return "One PR/issue interaction logged.";
    case "revision": return "3 questions self-answered from memory.";
    case "portfolioArtifact": return "Artefact added to your public portfolio.";
    case "proofOfWork": return "Evidence link captured.";
    case "skills": return "10–20 min craft session logged.";
    case "comm": return "One post drafted or published.";
    case "know": return "One paragraph summary in journal.";
    case "fin": return "Notes / calculation captured.";
    case "prof": return "One professional touch (LinkedIn, resume, outreach).";
    case "reflection": return "Written reflection saved.";
    case "mind": return "Journal entry saved.";
    default: return "Progress captured in journal.";
  }
}

export function buildDayPlan(
  dateISO: string,
  weekNumber: number,
  day: DerivedDay,
  mode: DayMode,
  itemProgress: Record<string, number>,
  opts?: { followUps?: { id: string; title: string; dueWeek?: number; done: boolean }[]; masteryGap?: (item: WeekItem) => number },
): DayPlan {
  const phase = Math.ceil(weekNumber / 8);
  const week_ = { theme: getWeekTheme(weekNumber), objectives: getWeekObjectives(weekNumber) };
  const nDayIdx = ((weekNumber - 1) * 7 + dayOfWeekIndex(dateISO)) % Math.max(1, NOURISH_DAYS.length);
  const nDay = NOURISH_DAYS[nDayIdx];
  const isSunday = day.kind === "sunday";
  const isHoliday = day.kind === "holiday";
  const isExam = day.kind === "exam" || mode === "exam";
  const isSatStep = day.kind === "sat_step";
  const isFlex = mode === "flex";
  const isCollegeHeavy = mode === "college";
  const pctx: PriorityCtx = { weekNumber, mode, isSunday, isExam, isSatStep, isCollegeHeavy, progress: itemProgress, masteryGap: opts?.masteryGap };

  const weekItems = buildWeekItems(weekNumber);
  const freeMinutes = totalFreeMinutes(day);
  const budget = isFlex ? 0 : isExam ? 45 : isCollegeHeavy || isSatStep ? 90 : isSunday ? 90 : 180;
  const picked = isFlex ? [] : selectItemsForToday(
    weekItems, dayOfWeekIndex(dateISO), itemProgress, budget,
    mode, isSunday, isExam, isCollegeHeavy,
  );

  const blocks: Block[] = [];

  // Morning routine (Nourish wake-up)
  blocks.push({
    id: "b-morning", type: "routine", label: "Morning · Wake + hydrate", durationMin: 15, timeHint: "07:00",
    tasks: [
      { id: "t-wake", weekItemId: "", domain: "health", title: nDay.meals[0].text, durationMin: 10,
        expectedOutput: "Log hydration",
        rationale: { line: `Nourish Day ${nDay.day} wake-up drink.` },
        sourceField: "nourish.wake" },
    ],
    rationale: "Anchor the body before the day starts.",
  });

  // Breakfast
  blocks.push({
    id: "b-breakfast", type: "meal", label: `Breakfast · ${nDay.meals[1].time}`, durationMin: 30,
    tasks: [
      { id: "t-breakfast", weekItemId: "", domain: "health", title: nDay.meals[1].text, durationMin: 30,
        expectedOutput: "Ate + protein logged",
        rationale: { line: `Nourish Day ${nDay.day}. Protein-first.` },
        sourceField: "nourish.breakfast" },
    ],
    rationale: `Nourish Day ${nDay.day} breakfast.`,
  });

  // Classes (fixed)
  day.classes.forEach((c, idx) => {
    const durMin = (parseInt(c.end.slice(0, 2)) * 60 + parseInt(c.end.slice(3))) - (parseInt(c.start.slice(0, 2)) * 60 + parseInt(c.start.slice(3)));
    blocks.push({
      id: `b-class-${idx}`, type: "class",
      label: `${isSatStep ? "STEP Class" : "Classes"} · ${c.start}–${c.end}`,
      timeHint: c.start, durationMin: durMin,
      tasks: [{
        id: `t-class-${idx}`, weekItemId: "", domain: "prof",
        title: "Attend class · take one active note",
        durationMin: 60, expectedOutput: "One key idea captured",
        rationale: { line: `Day Order ${day.dayOrder ?? "STEP"} · fixed college schedule.` },
        sourceField: "college.class",
      }],
      rationale: "Real class time — cannot be moved.",
    });
  });

  // Deep work blocks (real week items)
  const deep = itemsToBlocks(picked, weekItems, itemProgress, mode, isSunday, isExam, isSatStep, isCollegeHeavy, freeMinutes, weekNumber);
  blocks.push(...deep);

  // Lunch (packed + cooked)
  blocks.push({
    id: "b-lunch", type: "meal", label: `Lunch · ${nDay.meals[2].time} (packed) / ${nDay.meals[3].time} (cooked)`, durationMin: 40,
    tasks: [
      { id: "t-packed", weekItemId: "", domain: "health", title: nDay.meals[2].text, durationMin: 20, expectedOutput: "Ate at college",
        rationale: { line: "Nourish packed box." }, sourceField: "nourish.packed" },
      { id: "t-lunch",  weekItemId: "", domain: "health", title: nDay.meals[3].text, durationMin: 40, expectedOutput: "Cooked + ate",
        rationale: { line: "6pm kitchen — the real cooked meal." }, sourceField: "nourish.lunch" },
    ],
    rationale: "Two-part lunch matches college realities.",
  });

  // Workout (skip on exam)
  if (!isExam) blocks.push({
    id: "b-workout", type: "workout", label: "Workout · 45 min", durationMin: 45,
    tasks: [{ id: "t-workout", weekItemId: "", domain: "health", title: nDay.workout, durationMin: 45,
      expectedOutput: "Session done · effort 1–5 logged",
      rationale: { line: `Nourish Day ${nDay.day} strength/recovery.` },
      sourceField: "nourish.workout" }],
    rationale: "Placed after classes, before dinner.",
  });

  // Dinner
  blocks.push({
    id: "b-dinner", type: "meal", label: `Dinner · ${nDay.meals[5].time}`, durationMin: 30,
    tasks: [{ id: "t-dinner", weekItemId: "", domain: "health", title: nDay.meals[5].text, durationMin: 30,
      expectedOutput: "Ate",
      rationale: { line: "Light dinner supports sleep." },
      sourceField: "nourish.dinner" }],
    rationale: "Nourish light-dinner rule.",
  });

  // Open AI-review follow-ups due this week become real scheduled tasks (loop closure).
  const openFU = (opts?.followUps ?? []).filter((f) => !f.done && (f.dueWeek == null || f.dueWeek <= weekNumber));
  if (!isFlex && openFU.length) {
    blocks.push({
      id: "b-followups", type: "review", label: "Improvement follow-ups", durationMin: 20,
      tasks: openFU.slice(0, 3).map((f) => ({
        id: `t-fu-${f.id}`, weekItemId: "", domain: "tech",
        title: f.title, durationMin: 15, expectedOutput: "Applied",
        rationale: { line: "From AI-review feedback — applying what you learned." },
        sourceField: "review.followup",
      })),
      rationale: "Feedback becomes action — Learn \u2192 Build \u2192 Review \u2192 Improve \u2192 Apply.",
    });
  }

  // Reflection & sleep
  blocks.push({
    id: "b-reflect", type: "reflection", label: "Reflect + wind down", durationMin: 15,
    tasks: [
      { id: "t-journal", weekItemId: "", domain: "mind", title: "Journal · 3 lines (what went right · what didn't · one lesson)",
        durationMin: 10, expectedOutput: "Journal entry saved",
        rationale: { line: "Reflection is where learning consolidates." },
        sourceField: "reflection" },
      { id: "t-sleep", weekItemId: "", domain: "health", title: `Sleep target — ${nDay.sleep_target_h}h`, durationMin: 5,
        expectedOutput: "Sleep by 23:00",
        rationale: { line: "Sleep is a macro (Nourish)." },
        sourceField: "nourish.sleep" },
    ],
    rationale: "Wind-down is engineered, not accidental.",
  });

  // Sunday weekly review
  if (isSunday) blocks.push({
    id: "b-weekly", type: "review", label: "Weekly review + next-week plan", durationMin: 40,
    tasks: [
      { id: "t-review", weekItemId: "", domain: "mind", title: "Review last 7 days — patterns, gaps, wins",
        durationMin: 25, expectedOutput: "One-paragraph review + 3 adjustments",
        rationale: { line: "Sunday is designed for review + recovery, not idleness." },
        sourceField: "reflection" },
      { id: "t-pantry", weekItemId: "", domain: "health", title: "Pantry + grocery prep for next cycle",
        durationMin: 15, expectedOutput: "Grocery list ready",
        rationale: { line: "Prep now = execute all week." },
        sourceField: "nourish.grocery" },
    ],
    rationale: "Sunday is a lighter execution day — recovery + planning.",
  });

  // Next best action — Priority Engine ranks the items actually scheduled today.
  const nba = rankItems(picked, pctx)[0] ?? null;
  const nextBestAction = nba ? {
    itemId: nba.id,
    title: nba.title,
    reason: nba.field === "dsa"
      ? "DSA is protected — habit continuity beats intensity."
      : nba.cadence === "daily"
      ? `Daily contribution to a week goal — ${nba.targetContributions - (itemProgress[nba.id] ?? 0)} passes remain.`
      : nba.cadence === "twice_week"
      ? "This item still owes contributions this week."
      : "Weekly deliverable — placed today because you have time.",
  } : null;

  return {
    date: dateISO,
    weekNumber,
    weekTheme: week_.theme,
    phase,
    mode,
    nourishDay: nDay.day,
    totalFreeMinutes: freeMinutes,
    blocks,
    weekItems,
    weekTotal: weekTotal(weekItems),
    weekDone: weekDone(weekItems, itemProgress),
    nextBestAction,
    flags: { isSunday, isHoliday, isExam, isSatStep, isFlex },
  };
}
