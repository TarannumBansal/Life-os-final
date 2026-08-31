/**
 * Finite-Today freezing (V1.2). THE fix for the "completing a task reveals the next weekly
 * task" bug. Today's task set is computed ONCE for a date and frozen; rendering + the daily
 * counter read the frozen set, never a re-derivation from live itemProgress. The weekly ledger
 * still advances (future days plan around cumulative progress), but Today stays finite.
 */
import type { DayPlan } from "./planner";

export interface FrozenTask {
  id: string; weekItemId: string; domain: string; title: string;
  durationMin: number; blockId: string; blockType: string; blockLabel: string; rationaleLine?: string;
  detail?: string; expectedOutput?: string; reviewable?: boolean; reviewKind?: string;
}

/** The finite set of actionable PGOS work for the day = tasks tied to a week item.
 *  Meals/classes/routine/sleep have empty weekItemId and are timeline anchors, not counted. */
export function freezeDayTasks(plan: DayPlan): FrozenTask[] {
  const out: FrozenTask[] = [];
  for (const b of plan.blocks) {
    for (const t of b.tasks as any[]) {
      if (!t.weekItemId) continue; // anchors (meals/classes) are not counted tasks
      out.push({
        id: t.id, weekItemId: t.weekItemId, domain: t.domain, title: t.title,
        durationMin: t.durationMin ?? 30, blockId: b.id, blockType: b.type, blockLabel: b.label,
        rationaleLine: (t.rationale && (t.rationale.line || t.rationale.whyToday)) || undefined,
        detail: t.detail, expectedOutput: t.expectedOutput, reviewable: t.reviewable, reviewKind: t.reviewKind,
      });
    }
  }
  return out;
}

export interface TodayProgress { done: number; total: number; pct: number; complete: boolean }

/** Today's counter — based on TODAY'S frozen tasks only (not the weekly total). */
export function todayProgress(
  frozen: FrozenTask[],
  completions: { date: string; blockId: string; taskId: string }[],
  date: string,
): TodayProgress {
  const done = frozen.filter((t) => completions.some((c) => c.date === date && c.blockId === t.blockId && c.taskId === t.id)).length;
  const total = frozen.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
}

/**
 * Resolve today's finite tasks: return the frozen set if already assigned for `date`,
 * otherwise compute once via `computePlan` and hand back the set to persist.
 * Completing tasks NEVER changes the total, because we read the frozen set.
 */
export function resolveTodayTasks(
  dayAssignments: Record<string, FrozenTask[]>,
  date: string,
  computePlan: () => DayPlan,
): { tasks: FrozenTask[]; toPersist: FrozenTask[] | null } {
  const existing = dayAssignments[date];
  if (existing && existing.length >= 0 && date in dayAssignments) return { tasks: existing, toPersist: null };
  const frozen = freezeDayTasks(computePlan());
  return { tasks: frozen, toPersist: frozen };
}
