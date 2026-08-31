/**
 * Repositories (V1) — pure, typed CRUD over the LifeOSSettings record arrays.
 * Screens/hooks call these instead of hand-writing array spreads, which removes
 * duplicated logic and isolates persistence shape. Each returns a NEW settings object
 * (immutable), so a future SQLite-backed store can swap in without touching callers.
 */
import type { LifeOSSettings, JournalEntry, FollowUpTask, CompletionRecord } from "./settings";
import type { MasteryRecord, MasteryState } from "@/src/engine/mastery";
import type { EvidenceRecord } from "@/src/engine/evidence";

const now = () => Date.now();

/* ---- item progress (week decomposition ledger) ---- */
export function logContribution(s: LifeOSSettings, itemId: string, delta = 1): LifeOSSettings {
  const cur = s.itemProgress[itemId] ?? 0;
  return { ...s, itemProgress: { ...s.itemProgress, [itemId]: Math.max(0, cur + delta) } };
}

/* ---- completions ---- */
export function addCompletion(s: LifeOSSettings, rec: Omit<CompletionRecord, "completedAt">): LifeOSSettings {
  return { ...s, completions: [...s.completions, { ...rec, completedAt: now() }] };
}
export function removeCompletion(s: LifeOSSettings, date: string, taskId: string): LifeOSSettings {
  return { ...s, completions: s.completions.filter((c) => !(c.date === date && c.taskId === taskId)) };
}

/* ---- journal ---- */
export function addJournal(s: LifeOSSettings, entry: Omit<JournalEntry, "id" | "ts" | "updatedAt">): LifeOSSettings {
  const e: JournalEntry = { ...entry, id: `j-${now()}-${Math.random().toString(36).slice(2, 7)}`, ts: now(), updatedAt: now() };
  return { ...s, journal: [e, ...s.journal] };
}

/* ---- follow-ups (AI-review loop) ---- */
export function upsertFollowUps(s: LifeOSSettings, tasks: FollowUpTask[]): LifeOSSettings {
  const map = new Map(s.followUps.map((f) => [f.id, f]));
  for (const t of tasks) map.set(t.id, { ...map.get(t.id), ...t, updatedAt: now() } as FollowUpTask);
  return { ...s, followUps: [...map.values()] };
}
export function setFollowUpDone(s: LifeOSSettings, id: string, done: boolean): LifeOSSettings {
  return { ...s, followUps: s.followUps.map((f) => (f.id === id ? { ...f, done, updatedAt: now() } : f)) };
}
export function openFollowUps(s: LifeOSSettings, uptoWeek?: number): FollowUpTask[] {
  return s.followUps.filter((f) => !f.done && (uptoWeek == null || (f.dueWeek ?? 0) <= uptoWeek));
}

/* ---- mastery ---- */
export function setMastery(s: LifeOSSettings, id: string, domain: string, competency: string, state: MasteryState): LifeOSSettings {
  const rec: MasteryRecord = { id, domain, competency, state, updatedAt: now() };
  const exists = s.mastery.some((m) => m.id === id);
  return { ...s, mastery: exists ? s.mastery.map((m) => (m.id === id ? rec : m)) : [...s.mastery, rec] };
}

/* ---- evidence ---- */
export function addEvidence(s: LifeOSSettings, rec: Omit<EvidenceRecord, "id" | "createdAt" | "updatedAt">): LifeOSSettings {
  const e: EvidenceRecord = { ...rec, id: `ev-${now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now(), updatedAt: now() };
  return { ...s, evidence: [e, ...s.evidence] };
}
export function removeEvidence(s: LifeOSSettings, id: string): LifeOSSettings {
  return { ...s, evidence: s.evidence.filter((e) => e.id !== id) };
}

/* ---- export / import (ownership) ---- */
export function exportData(s: LifeOSSettings): string {
  return JSON.stringify({ __lifeos_export__: 1, exportedAt: now(), settings: s }, null, 2);
}
export function importData(json: string): LifeOSSettings | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && parsed.__lifeos_export__ && parsed.settings?.roadmapStartDate) return parsed.settings as LifeOSSettings;
  } catch { /* ignore */ }
  return null;
}

/* ---- pantry & shopping (Nourish-derived inventory; user-owned state) ---- */
import type { PantryItem } from "@/src/engine/pantry";
import type { ShoppingCheck, ShoppingRun } from "@/src/engine/shopping";
import { shoppingCheckId } from "@/src/engine/shopping";

export function setPantryItem(s: LifeOSSettings, item: Omit<PantryItem, "updatedAt">): LifeOSSettings {
  const rec: PantryItem = { ...item, updatedAt: now() };
  const exists = s.pantry.some((p) => p.key === item.key);
  return { ...s, pantry: exists ? s.pantry.map((p) => (p.key === item.key ? { ...p, ...rec } : p)) : [...s.pantry, rec] };
}
export function replacePantry(s: LifeOSSettings, inventory: PantryItem[]): LifeOSSettings {
  return { ...s, pantry: inventory.map((p) => ({ ...p, updatedAt: p.updatedAt || now() })) };
}
export function toggleShoppingCheck(s: LifeOSSettings, key: string, run: ShoppingRun, date: string, done: boolean): LifeOSSettings {
  const id = shoppingCheckId({ key, run, date });
  const exists = s.shoppingChecks.some((c) => shoppingCheckId(c) === id);
  const rec: ShoppingCheck = { key, run, date, done, updatedAt: now() };
  return { ...s, shoppingChecks: exists ? s.shoppingChecks.map((c) => (shoppingCheckId(c) === id ? rec : c)) : [...s.shoppingChecks, rec] };
}

/* ---- real-life schedule logs + Tomorrow notes (user-owned; synced) ---- */
import type { ScheduleLog } from "@/src/engine/schedule";
import type { TomorrowNote, TomorrowKind } from "@/src/engine/tomorrow";

export function addScheduleLog(s: LifeOSSettings, log: Omit<ScheduleLog, "id" | "createdAt" | "updatedAt">): LifeOSSettings {
  const rec: ScheduleLog = { ...log, id: `sch-${now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now(), updatedAt: now() };
  return { ...s, scheduleLogs: [...s.scheduleLogs, rec] };
}
export function updateScheduleLog(s: LifeOSSettings, id: string, patch: Partial<ScheduleLog>): LifeOSSettings {
  return { ...s, scheduleLogs: s.scheduleLogs.map((l) => (l.id === id ? { ...l, ...patch, id, updatedAt: now() } : l)) };
}
export function removeScheduleLog(s: LifeOSSettings, id: string): LifeOSSettings {
  return { ...s, scheduleLogs: s.scheduleLogs.filter((l) => l.id !== id) };
}
export function addTomorrow(s: LifeOSSettings, kind: TomorrowKind, text: string): LifeOSSettings {
  const order = s.tomorrow.length ? Math.max(...s.tomorrow.map((t) => t.order)) + 1 : 0;
  const rec: TomorrowNote = { id: `tmr-${now()}-${Math.random().toString(36).slice(2, 7)}`, kind, text, order, createdAt: now(), updatedAt: now() };
  return { ...s, tomorrow: [...s.tomorrow, rec] };
}
export function updateTomorrow(s: LifeOSSettings, id: string, patch: Partial<TomorrowNote>): LifeOSSettings {
  return { ...s, tomorrow: s.tomorrow.map((t) => (t.id === id ? { ...t, ...patch, id, updatedAt: now() } : t)) };
}
export function removeTomorrow(s: LifeOSSettings, id: string): LifeOSSettings {
  return { ...s, tomorrow: s.tomorrow.filter((t) => t.id !== id) };
}
export function reorderTomorrow(s: LifeOSSettings, id: string, newOrder: number): LifeOSSettings {
  return { ...s, tomorrow: s.tomorrow.map((t) => (t.id === id ? { ...t, order: newOrder, updatedAt: now() } : t)) };
}

/* ---- reset semantics (execution vs everything) ---- */
export function resetExecution(s: LifeOSSettings, opts?: { clearSchedule?: boolean; clearTomorrow?: boolean; clearPantry?: boolean }): LifeOSSettings {
  return {
    ...s,
    // execution state cleared → Today starts clean, counters recalc
    completions: [], itemProgress: {}, dayAssignments: {}, todaysMode: {},
    modeHistory: [], flexDayLedger: [],
    mastery: [], evidence: [], feedbackLog: [], followUps: [],
    // optional (only if explicitly chosen)
    scheduleLogs: opts?.clearSchedule ? [] : s.scheduleLogs,
    tomorrow: opts?.clearTomorrow ? [] : s.tomorrow,
    pantry: opts?.clearPantry ? [] : s.pantry,
    shoppingChecks: opts?.clearPantry ? [] : s.shoppingChecks,
    // preserved: roadmapStartDate, dayOrderConfig, flex budget, cutoff (curriculum is in pgos.json, untouched)
    updatedAt: Date.now(),
  };
}
