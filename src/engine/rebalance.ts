/**
 * Interruption-recovery / rebalancing (V1). When work is missed, redistribute the
 * remaining week contributions across the remaining days — navigation-app style —
 * deferring the lowest-priority items first. Pure + calm (no "behind" semantics).
 */
import type { WeekItem } from "./weekLedger";
import { rankItems, PriorityCtx } from "./priority";

export interface RebalancePlan {
  remainingDays: number;
  perDayTargets: { itemId: string; title: string; remaining: number; perDay: number }[];
  deferred: string[];      // itemIds pushed to later days (lowest priority first)
  note: string;            // calm, non-judgemental summary
}

/**
 * @param dayIdx 0..6 (Mon..Sun) — today's index within the week.
 */
export function rebalanceWeek(
  items: WeekItem[],
  progress: Record<string, number>,
  dayIdx: number,
  ctx: PriorityCtx,
): RebalancePlan {
  const remainingDays = Math.max(1, 7 - dayIdx);
  const outstanding = items.filter((it) => (progress[it.id] ?? 0) < it.targetContributions);
  const ranked = rankItems(outstanding, ctx);

  const perDayTargets = ranked.map((it) => {
    const remaining = it.targetContributions - (progress[it.id] ?? 0);
    return { itemId: it.id, title: it.title, remaining, perDay: Math.ceil(remaining / remainingDays) };
  });

  // If total per-day load is heavy, defer the lowest-priority weekly items.
  const totalPerDay = perDayTargets.reduce((a, t) => a + t.perDay, 0);
  const deferred: string[] = [];
  const HEAVY = 8; // more than ~8 contributions/day is unrealistic → shed lowest priority
  if (totalPerDay > HEAVY) {
    for (let i = ranked.length - 1; i >= 0 && perDayTargets.reduce((a, t) => a + (deferred.includes(t.itemId) ? 0 : t.perDay), 0) > HEAVY; i--) {
      deferred.push(ranked[i].id);
    }
  }

  const note = deferred.length
    ? `Rebalanced across ${remainingDays} day${remainingDays > 1 ? "s" : ""}. A few lower-priority items were shifted later so this week stays achievable.`
    : `Rebalanced across ${remainingDays} day${remainingDays > 1 ? "s" : ""}. Everything still fits — no pressure.`;

  return { remainingDays, perDayTargets, deferred, note };
}
