/**
 * Rich Rationale generator — the "Why?" behind every task.
 * Answers the five prompts required by iteration 2 §Priority 1:
 *   • Why today?
 *   • Why this order?
 *   • Why this duration?
 *   • Which objective does this support?
 *   • What happens if I skip it?
 *
 * Rule-based, deterministic, offline. Never LLM.
 */
import { WeekItem, getWeekObjectives, getWeekTheme, isFoundationalOnly } from "./weekLedger";
import { DayMode } from "./planner";

export interface Rationale {
  whyToday: string;
  whyThisOrder: string;
  whyThisDuration: string;
  whichObjective: string;
  ifSkipped: string;
}

export interface RationaleCtx {
  mode: DayMode;
  isSunday: boolean;
  isExam: boolean;
  isSatStep: boolean;
  isCollegeHeavy: boolean;
  isFlex: boolean;
  itemsToday: WeekItem[];
  currentIdx: number;
  freeMinutes: number;
  progress: Record<string, number>;   // item id → contributions logged
  weekNumber: number;
}

export function rationaleFor(item: WeekItem, ctx: RationaleCtx): Rationale {
  const objectives = getWeekObjectives(item.weekNumber);
  const objective = objectives[item.objectiveIdx ?? 0] || getWeekTheme(item.weekNumber);
  const done = ctx.progress[item.id] ?? 0;
  const remaining = Math.max(0, item.targetContributions - done);

  // Why today ---------------------------------------------------
  let whyToday = "";
  if (item.cadence === "daily") {
    whyToday = `This is a daily contribution — the week needs ${item.targetContributions} passes and ${remaining} remain.`;
  } else if (item.cadence === "twice_week") {
    whyToday = `Scheduled twice this week; ${done}/${item.targetContributions} logged so far.`;
  } else {
    whyToday = ctx.isSunday
      ? `Sunday is this week's deliverable slot — this is one of them.`
      : `Weekly deliverable — placed today because you still have time available (${Math.round(ctx.freeMinutes / 60)}h free).`;
  }
  if (item.field === "dsa" && isFoundationalOnly(item.detail)) {
    whyToday += " PGOS Week " + item.weekNumber + " says no problem-solving yet — this is a raw-material drill.";
  }

  // Why this order ---------------------------------------------
  const idx = ctx.currentIdx;
  let whyThisOrder = "Ordered by internal priority: habits first, deep work at cognitive peak, deliverables after energy dips.";
  if (idx === 0) whyThisOrder = "Placed first because habits protect the whole week from drift.";
  else if (item.order <= 20) whyThisOrder = "Placed in the morning block — this is your cognitive peak.";
  else if (item.order >= 90) whyThisOrder = "Placed later — lower-cognitive, higher-reflection work.";
  if (item.field === "dsa") whyThisOrder = "DSA is placed early — habit protection: NEVER MISS TWICE.";

  // Why this duration ------------------------------------------
  let whyThisDuration = `${item.perDayMin} min matches this task type on a Full day.`;
  if (ctx.isExam) whyThisDuration = `${item.perDayMin} min — Exam Mode compresses everything except DSA and revision.`;
  else if (ctx.isCollegeHeavy || ctx.isSatStep) whyThisDuration = `${item.perDayMin} min — College-Heavy: only the core survives.`;
  else if (ctx.isSunday) whyThisDuration = `${item.perDayMin} min — Sunday load is lighter by design.`;

  // Which objective --------------------------------------------
  const whichObjective = objective;

  // If skipped -------------------------------------------------
  let ifSkipped = "The week's completion counter won't advance for this item.";
  if (item.cadence === "daily") {
    if (item.field === "dsa") {
      ifSkipped = "Missing today is OK — missing twice breaks the habit. Never miss twice.";
    } else if (item.field === "know" || item.field === "revision") {
      ifSkipped = "Compounding habit — a single miss is fine; a pattern of misses shows up in the monthly review.";
    } else {
      ifSkipped = `You have ${remaining} more passes this week to complete this item; missing today means less buffer.`;
    }
  } else if (item.cadence === "weekly") {
    ifSkipped = "This is a weekly deliverable — it will be re-scheduled into your Sunday slot.";
  } else {
    ifSkipped = `Twice-a-week cadence — you've logged ${done}/${item.targetContributions}. LifeOS will re-schedule the miss.`;
  }

  return { whyToday, whyThisOrder, whyThisDuration, whichObjective, ifSkipped };
}
