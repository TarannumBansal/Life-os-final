import { useMemo, useCallback } from "react";
import { deriveDay, today as todayISO } from "@/src/engine/dayOrder";
import { buildDayPlan, DayMode } from "@/src/engine/planner";
import { useSettings, currentWeekNumber } from "@/src/store/settings";

export function useTodayPlan(overrideDate?: string) {
  const { settings, update } = useSettings();

  const date = overrideDate || todayISO();

  const plan = useMemo(() => {
    if (!settings) return null;
    const derived = deriveDay(date, settings.dayOrderConfig);
    const wk = currentWeekNumber(settings.roadmapStartDate, date);
    const mode: DayMode = (settings.todaysMode[date] as DayMode) || "full";
    return buildDayPlan(date, wk, derived, mode, settings.itemProgress);
  }, [settings, date]);

  const setMode = useCallback(async (newMode: DayMode, reason?: string) => {
    if (!settings) return;
    const cur = settings.todaysMode[date] || "full";
    await update((s) => ({
      ...s,
      todaysMode: { ...s.todaysMode, [date]: newMode },
      modeHistory: [...s.modeHistory, { date, from: cur, to: newMode, ts: Date.now(), reason }],
      flexDayLedger:
        newMode === "flex" && cur !== "flex"
          ? [...s.flexDayLedger, { date, ts: Date.now(), reason }]
          : s.flexDayLedger,
    }));
  }, [settings, update, date]);

  const isDone = useCallback((blockId: string, taskId: string): boolean => {
    if (!settings) return false;
    return !!settings.completions.find((c) => c.date === date && c.blockId === blockId && c.taskId === taskId);
  }, [settings, date]);

  const toggleTask = useCallback(async (blockId: string, taskId: string, weekItemId?: string) => {
    if (!settings) return;
    const existing = settings.completions.find((c) => c.date === date && c.blockId === blockId && c.taskId === taskId);
    await update((s) => {
      const wasDone = !!existing;
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

  return { plan, settings, setMode, toggleTask, isDone, date };
}
