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
  const e: JournalEntry = { ...entry, id: `j-${now()}`, ts: now(), updatedAt: now() };
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
  const e: EvidenceRecord = { ...rec, id: `ev-${now()}`, createdAt: now(), updatedAt: now() };
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
