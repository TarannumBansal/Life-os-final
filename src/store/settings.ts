/**
 * Settings store — user-editable configuration + all persistent state.
 * Includes Day-Order config, holidays, exam dates, day-mode history, flex-day ledger,
 * per-week item progress (roadmap decomposition ledger), AI feedback log, and follow-ups.
 * Every record has a stable id + updatedAt for future sync.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "@/src/store/store-core";
import { storage } from "@/src/utils/storage";
import { DayOrderConfig, today, DayOrder } from "@/src/engine/dayOrder";
import type { FeedbackEntry } from "@/src/engine/reviewable";
import type { MasteryRecord } from "@/src/engine/mastery";
import type { EvidenceRecord } from "@/src/engine/evidence";
import type { PantryItem } from "@/src/engine/pantry";
import type { ShoppingCheck } from "@/src/engine/shopping";
import type { ScheduleLog } from "@/src/engine/schedule";
import type { TomorrowNote } from "@/src/engine/tomorrow";
import type { FrozenTask } from "@/src/engine/freeze";

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
  pantry: PantryItem[];
  shoppingChecks: ShoppingCheck[];
  scheduleLogs: ScheduleLog[];
  tomorrow: TomorrowNote[];
  dayAssignments: Record<string, FrozenTask[]>;
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
    pantry: [],
    shoppingChecks: [],
    scheduleLogs: [],
    tomorrow: [],
    dayAssignments: {},
    updatedAt: Date.now(),
  };
}

/** Async loader: read persisted settings, backfill new fields, migrate v1→v2. Runs once. */
async function loadSettings(): Promise<LifeOSSettings> {
  const raw = await storage.getItem<any>(KEY, null as any);
  if (raw && typeof raw === "object" && raw.roadmapStartDate) {
    return {
      ...defaultSettings(),
      ...raw,
      itemProgress: raw.itemProgress ?? {},
      feedbackLog: raw.feedbackLog ?? [],
      followUps: raw.followUps ?? [],
      mastery: raw.mastery ?? [],
      evidence: raw.evidence ?? [],
      pantry: raw.pantry ?? [],
      shoppingChecks: raw.shoppingChecks ?? [],
      scheduleLogs: raw.scheduleLogs ?? [],
      tomorrow: raw.tomorrow ?? [],
      dayAssignments: raw.dayAssignments ?? {},
    };
  }
  const v1 = await storage.getItem<any>(OLD_KEY, null as any);
  if (v1 && typeof v1 === "object" && v1.roadmapStartDate) {
    const migrated: LifeOSSettings = { ...defaultSettings(), ...v1, itemProgress: {}, feedbackLog: [], followUps: [], mastery: [], evidence: [], pantry: [], shoppingChecks: [], scheduleLogs: [], tomorrow: [], dayAssignments: {} };
    await storage.setItem(KEY, migrated as any);
    return migrated;
  }
  const d = defaultSettings();
  await storage.setItem(KEY, d as any);
  return d;
}

/**
 * THE single shared LifeOS store (V1.3). One authoritative in-memory copy for the whole app.
 * Every useSettings() consumer subscribes to it; updates compose against the latest value
 * (no stale overwrite); sync commits update it live so the open UI reflects remote changes.
 */
const store = createStore<LifeOSSettings>({
  load: loadSettings,
  persist: (v) => { void storage.setItem(KEY, v as any); },
  stamp: (v) => ({ ...v, updatedAt: Date.now() }),
});

/** Same API as before ({ settings, update }) — but now backed by the shared store. */
export function useSettings() {
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { settings, update: store.update };
}

/** For the sync layer: read the latest committed settings (outside React). */
export function getSettings(): LifeOSSettings | null { return store.getSnapshot(); }
/** For the sync layer: push a merged remote state into the live store (updates UI immediately). */
export function commitSettings(next: LifeOSSettings): void { store.commit(next); }
/** Kick off the one-time load (used when mounting sync at root before any screen reads). */
export function ensureSettingsLoaded(): Promise<void> { return store.ensureLoaded(); }

export function currentWeekNumber(startDateISO: string, todayISO: string = today()): number {
  const start = new Date(startDateISO);
  const now = new Date(todayISO);
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(32, Math.floor(diffDays / 7) + 1));
}
