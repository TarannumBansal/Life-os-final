import { useMemo, useCallback, useEffect } from "react";
import { deriveDay, today as todayISO } from "@/src/engine/dayOrder";
import { buildDayPlan, DayMode } from "@/src/engine/planner";
import { useSettings, currentWeekNumber } from "@/src/store/settings";
import { resolveTodayTasks, todayProgress, FrozenTask } from "@/src/engine/freeze";

/**
 * Today is FINITE and FROZEN. The day plan is computed once per date and stored in
 * dayAssignments; completing/undoing a task only toggles completion — it never re-derives
 * the task list, so Today can never grow from the weekly backlog. Weekly context still comes
 * from buildDayPlan (theme/phase/NBA/week totals) but is kept separate from the Today counter.
 */
export function useTodayPlan(overrideDate?: string) {
  const { settings, update } = useSettings();
  const date = overrideDate || todayISO();

  // Weekly context (theme, phase, flags, NBA, weekly totals) — NOT the Today task source.
  const plan = useMemo(() => {
    if (!settings) return null;
    const derived = deriveDay(date, settings.dayOrderConfig);
    const wk = currentWeekNumber(settings.roadmapStartDate, date);
    const mode: DayMode = (settings.todaysMode[date] as DayMode) || "full";
    return buildDayPlan(date, wk, derived, mode, settings.itemProgress);
  }, [settings, date]);

  // Freeze today's finite task set once, using the plan at first-open. Persist so it never
  // recomputes as itemProgress advances.
  const todayTasks: FrozenTask[] = useMemo(() => {
    if (!settings || !plan) return [];
    return resolveTodayTasks(settings.dayAssignments, date, () => plan).tasks;
  }, [settings, plan, date]);

  useEffect(() => {
    if (!settings || !plan) return;
    if (date in settings.dayAssignments) return; // already frozen — do nothing
    const { toPersist } = resolveTodayTasks(settings.dayAssignments, date, () => plan);
    if (toPersist) update((s) => ({ ...s, dayAssignments: { ...s.dayAssignments, [date]: toPersist } }));
  }, [settings, plan, date, update]);

  const progress = useMemo(
    () => todayProgress(todayTasks, settings?.completions ?? [], date),
    [todayTasks, settings, date],
  );

  const setMode = useCallback(async (newMode: DayMode, reason?: string) => {
    if (!settings) return;
    const cur = settings.todaysMode[date] || "full";
    await update((s) => ({
      ...s,
      todaysMode: { ...s.todaysMode, [date]: newMode },
      modeHistory: [...s.modeHistory, { date, from: cur, to: newMode, ts: Date.now(), reason }],
      flexDayLedger: newMode === "flex" && cur !== "flex" ? [...s.flexDayLedger, { date, ts: Date.now(), reason }] : s.flexDayLedger,
      // A mode change legitimately re-plans the day → clear the freeze so it re-freezes once.
      dayAssignments: (() => { const d = { ...s.dayAssignments }; delete d[date]; return d; })(),
    }));
  }, [settings, update, date]);

  const isDone = useCallback((blockId: string, taskId: string): boolean => {
    if (!settings) return false;
    return !!settings.completions.find((c) => c.date === date && c.blockId === blockId && c.taskId === taskId);
  }, [settings, date]);

  // Complete ↔ undo. Toggles ONLY this task's completion + its week-ledger contribution.
  const toggleTask = useCallback(async (blockId: string, taskId: string, weekItemId?: string) => {
    if (!settings) return;
    const wasDone = !!settings.completions.find((c) => c.date === date && c.blockId === blockId && c.taskId === taskId);
    await update((s) => {
      const nextItemProgress = { ...s.itemProgress };
      if (weekItemId) {
        const cur = nextItemProgress[weekItemId] ?? 0;
        nextItemProgress[weekItemId] = Math.max(0, wasDone ? cur - 1 : cur + 1);
      }
      return {
        ...s,
        completions: wasDone
          ? s.completions.filter((c) => !(c.date === date && c.blockId === blockId && c.taskId === taskId))
          : [...s.completions, { date, blockId, taskId, weekItemId, completedAt: Date.now() }],
        itemProgress: nextItemProgress,
      };
    });
  }, [settings, update, date]);

  return { plan, settings, todayTasks, todayDone: progress.done, todayTotal: progress.total, todayPct: progress.pct, todayComplete: progress.complete, setMode, toggleTask, isDone, date };
}
