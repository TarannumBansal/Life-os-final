/**
 * Internal Priority Engine (V1) — deterministic, rule-based, NEVER shown to the user.
 * Scores real WeekItems (not day-tasks) so the planner can order tasks, choose the
 * Next-Best-Action, and decide what to defer when time is scarce.
 *
 * Higher score = more important today. Pure + side-effect free.
 */
import type { WeekItem } from "./weekLedger";
import type { DayMode } from "./planner";

export interface PriorityCtx {
  weekNumber: number;
  mode: DayMode;
  isSunday: boolean;
  isExam: boolean;
  isSatStep: boolean;
  isCollegeHeavy: boolean;
  progress: Record<string, number>;      // itemId → contributions logged
  /** Optional: 0..1 mastery gap for the item's competency (1 = not demonstrated). */
  masteryGap?: (item: WeekItem) => number;
}

/** Base importance by roadmap field. */
function baseFor(field: string): number {
  if (field === "dsa") return 100;               // "never miss twice" habit
  if (field === "tech.project" || field === "flagshipProgress") return 95; // GitHub-green + capstone
  if (field.startsWith("tech.topics")) return 85; // this week's core learning
  if (field === "microProject") return 78;
  if (field === "revision") return 70;            // spaced retrieval > re-reading
  if (field === "interviewPrep") return 55;       // compounds every week
  if (field === "techWriting") return 50;
  if (field === "engineeringJudgement") return 46;
  if (field === "projectLifecycle") return 44;
  if (field === "openSource") return 42;
  if (field === "know") return 40;
  return 30;
}

/** Deterministic priority score for a week item on a given day. */
export function scoreWeekItem(item: WeekItem, ctx: PriorityCtx): number {
  let score = baseFor(item.field);

  // Cadence: daily habits are protected; twice-week next; weekly lowest floor.
  if (item.cadence === "daily") score += 15;
  else if (item.cadence === "twice_week") score += 5;

  // Urgency: the further behind target, the more it matters today.
  const done = ctx.progress[item.id] ?? 0;
  const remaining = Math.max(0, item.targetContributions - done);
  if (item.targetContributions > 0) {
    score += Math.round((remaining / item.targetContributions) * 12);
  }

  // Mastery gap: a not-yet-demonstrated competency lifts its related work.
  if (ctx.masteryGap) score += Math.round(ctx.masteryGap(item) * 10);

  // Weekly ramp — engineering weight rises later in the roadmap.
  if (item.domain === "tech" && ctx.weekNumber > 8) score += 5;
  if (item.domain === "prof" && ctx.weekNumber > 16) score += 8;

  // Day-mode shaping (mirrors selection intent, applied to scoring).
  if (ctx.isExam && !["dsa", "revision"].includes(item.field)) score -= 60;
  if ((ctx.isCollegeHeavy || ctx.isSatStep) &&
      !["dsa", "revision", "know"].includes(item.field) &&
      !item.field.startsWith("tech.")) score -= 30;
  if (ctx.isSunday) {
    if (item.field === "revision" || item.field === "know" || item.field === "reflection") score += 15;
    if (item.field === "dsa" || item.field === "tech.project") score -= 15;
  }

  return score;
}

/** Rank items by priority (desc), stable by original order for ties. */
export function rankItems(items: WeekItem[], ctx: PriorityCtx): WeekItem[] {
  return items
    .map((it, i) => ({ it, i, s: scoreWeekItem(it, ctx) }))
    .sort((a, b) => (b.s - a.s) || (a.it.order - b.it.order) || (a.i - b.i))
    .map((x) => x.it);
}
