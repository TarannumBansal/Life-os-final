/**
 * Settings store — user-editable configuration + all persistent state.
 * Includes Day-Order config, holidays, exam dates, day-mode history, flex-day ledger,
 * per-week item progress (roadmap decomposition ledger), AI feedback log, and follow-ups.
 * Every record has a stable id + updatedAt for future sync.
 */
import { useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { DayOrderConfig, today, DayOrder } from "@/src/engine/dayOrder";
import type { FeedbackEntry } from "@/src/engine/reviewable";
import type { MasteryRecord } from "@/src/engine/mastery";
import type { EvidenceRecord } from "@/src/engine/evidence";

export interface ModeHistoryEntry { date: string; from: string; to: string; ts: number; reason?: string }
export interface FlexDayEntry { date: string; reason?: string; ts: number }
export interface CompletionRecord { date: string; blockId: string; taskId: string; weekItemId?: string; completedAt: number }
export interface JournalEntry { id: string; date: string; text: string; ts: number; updatedAt: number }
export interface FollowUpTask {
  id: string;
  fromFeedbackId: string;
  title: string;
  dueWeek?: number;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LifeOSSettings {
  roadmapStartDate: string;
  dayOrderConfig: DayOrderConfig;
  todaysMode: Record<string, string>;
  modeHistory: ModeHistoryEntry[];
  flexBudgetPerMonth: number;
  flexDayLedger: FlexDayEntry[];
  cutoffHourForDowngrade: number;
  completions: CompletionRecord[];
  itemProgress: Record<string, number>;   // WeekItem.id → contributions logged
  journal: JournalEntry[];
  feedbackLog: FeedbackEntry[];
  followUps: FollowUpTask[];
  mastery: MasteryRecord[];
  evidence: EvidenceRecord[];
  updatedAt: number;
}

const KEY = "lifeos:settings:v2";
const OLD_KEY = "lifeos:settings:v1";

function defaultSettings(): LifeOSSettings {
  const t = today();
  return {
    roadmapStartDate: t,
    dayOrderConfig: { anchorDate: t, anchorDayOrder: 1 as DayOrder, holidays: [], examDates: [] },
    todaysMode: {},
    modeHistory: [],
    flexBudgetPerMonth: 4,
    flexDayLedger: [],
    cutoffHourForDowngrade: 18,
    completions: [],
    itemProgress: {},
    journal: [],
    feedbackLog: [],
    followUps: [],
    mastery: [],
    evidence: [],
    updatedAt: Date.now(),
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<LifeOSSettings | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<any>(KEY, null as any);
      if (raw && typeof raw === "object" && raw.roadmapStartDate) {
        // Backfill any missing fields introduced in newer versions.
        const merged: LifeOSSettings = {
          ...defaultSettings(),
          ...raw,
          itemProgress: raw.itemProgress ?? {},
          feedbackLog: raw.feedbackLog ?? [],
          followUps: raw.followUps ?? [],
          mastery: raw.mastery ?? [],
          evidence: raw.evidence ?? [],
        };
        setSettings(merged);
        return;
      }
      // Migrate v1 → v2 if present
      const v1 = await storage.getItem<any>(OLD_KEY, null as any);
      if (v1 && typeof v1 === "object" && v1.roadmapStartDate) {
        const migrated: LifeOSSettings = { ...defaultSettings(), ...v1, itemProgress: {}, feedbackLog: [], followUps: [], mastery: [], evidence: [] };
        await storage.setItem(KEY, migrated as any);
        setSettings(migrated);
        return;
      }
      const d = defaultSettings();
      await storage.setItem(KEY, d as any);
      setSettings(d);
    })();
  }, []);

  const update = useCallback(async (mut: (s: LifeOSSettings) => LifeOSSettings) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...mut(prev), updatedAt: Date.now() };
      storage.setItem(KEY, next as any);
      return next;
    });
  }, []);

  return { settings, update };
}

export function currentWeekNumber(startDateISO: string, todayISO: string = today()): number {
  const start = new Date(startDateISO);
  const now = new Date(todayISO);
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(32, Math.floor(diffDays / 7) + 1));
}
