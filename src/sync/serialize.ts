/**
 * Serialize LifeOSSettings ⇄ SyncRecord[] at the RECORD level (never the whole blob).
 * Entities with intrinsic timestamps use them directly; the two timestamp-less maps
 * (itemProgress + the settings singleton) are diffed against the last snapshot and
 * stamped `now` only when they actually changed. PURE + testable.
 */
import type { LifeOSSettings } from "@/src/store/settings";
import { SyncRecord } from "./types";

const T = {
  completions: "completions",
  itemProgress: "itemProgress",
  journal: "journal",
  feedback: "feedbackLog",
  followUps: "followUps",
  mastery: "mastery",
  evidence: "evidence",
  modeHistory: "modeHistory",
  flex: "flexDayLedger",
  pantry: "pantry",
  shoppingChecks: "shoppingChecks",
  scheduleLogs: "scheduleLogs",
  tomorrow: "tomorrow",
  dayAssignments: "dayAssignments",
  settings: "settings",
} as const;

/** Records for entities that already carry their own timestamps (accurate LWW clocks). */
export function intrinsicRecords(s: LifeOSSettings): SyncRecord[] {
  const out: SyncRecord[] = [];
  for (const c of s.completions) out.push({ table: T.completions, id: `${c.date}|${c.taskId}`, updatedAt: c.completedAt, payload: c });
  for (const j of s.journal) out.push({ table: T.journal, id: j.id, updatedAt: j.updatedAt ?? j.ts, payload: j });
  for (const f of s.feedbackLog as any[]) out.push({ table: T.feedback, id: f.id, updatedAt: f.updatedAt ?? f.createdAt, payload: f });
  for (const f of s.followUps) out.push({ table: T.followUps, id: f.id, updatedAt: f.updatedAt, payload: f });
  for (const m of s.mastery) out.push({ table: T.mastery, id: m.id, updatedAt: m.updatedAt, payload: m });
  for (const e of s.evidence) out.push({ table: T.evidence, id: e.id, updatedAt: e.updatedAt, payload: e });
  for (const h of s.modeHistory) out.push({ table: T.modeHistory, id: `${h.date}|${h.ts}`, updatedAt: h.ts, payload: h });
  for (const x of s.flexDayLedger) out.push({ table: T.flex, id: `${x.date}|${x.ts}`, updatedAt: x.ts, payload: x });
  for (const p of (s as any).pantry ?? []) out.push({ table: T.pantry, id: p.key, updatedAt: p.updatedAt, payload: p });
  for (const c of (s as any).shoppingChecks ?? []) out.push({ table: T.shoppingChecks, id: `${c.run}|${c.date}|${c.key}`, updatedAt: c.updatedAt, payload: c });
  for (const l of (s as any).scheduleLogs ?? []) out.push({ table: T.scheduleLogs, id: l.id, updatedAt: l.updatedAt, payload: l });
  for (const tn of (s as any).tomorrow ?? []) out.push({ table: T.tomorrow, id: tn.id, updatedAt: tn.updatedAt, payload: tn });
  for (const [d, tasks] of Object.entries((s as any).dayAssignments ?? {})) out.push({ table: T.dayAssignments, id: d, updatedAt: s.updatedAt, payload: { date: d, tasks } });
  return out;
}

/** The single "preferences" record (dayOrderConfig, budgets, roadmapStartDate, cutoff). */
export function settingsSingleton(s: LifeOSSettings, updatedAt: number): SyncRecord {
  return {
    table: T.settings, id: "singleton", updatedAt,
    payload: {
      roadmapStartDate: s.roadmapStartDate, dayOrderConfig: s.dayOrderConfig,
      flexBudgetPerMonth: s.flexBudgetPerMonth, cutoffHourForDowngrade: s.cutoffHourForDowngrade,
    },
  };
}

/** itemProgress as one record per itemId, stamped `now` only for keys that changed vs prev. */
export function itemProgressRecords(prev: Record<string, number>, next: Record<string, number>, now: number): SyncRecord[] {
  const out: SyncRecord[] = [];
  for (const [k, v] of Object.entries(next)) {
    if (prev[k] !== v) out.push({ table: T.itemProgress, id: k, updatedAt: now, payload: { itemId: k, value: v } });
  }
  return out;
}

/**
 * Diff a previous snapshot's settings against the next, returning all records that changed.
 * Timestamp-carrying entities use their own clocks (so they're always emitted correctly);
 * itemProgress + settings singleton are emitted only on real change, stamped `now`.
 */
export function diffToRecords(prev: LifeOSSettings | null, next: LifeOSSettings, now: number): SyncRecord[] {
  const records = intrinsicRecords(next);
  records.push(...itemProgressRecords(prev?.itemProgress ?? {}, next.itemProgress, now));
  // settings singleton — emit only if a tracked field changed
  const changed = !prev ||
    prev.roadmapStartDate !== next.roadmapStartDate ||
    JSON.stringify(prev.dayOrderConfig) !== JSON.stringify(next.dayOrderConfig) ||
    prev.flexBudgetPerMonth !== next.flexBudgetPerMonth ||
    prev.cutoffHourForDowngrade !== next.cutoffHourForDowngrade;
  if (changed) records.push(settingsSingleton(next, now));
  return records;
}

/** Fold merged remote records back into a LifeOSSettings shape (immutable). */
export function applyRecordsToSettings(base: LifeOSSettings, records: SyncRecord[]): LifeOSSettings {
  const s: LifeOSSettings = {
    ...base,
    completions: [...base.completions],
    journal: [...base.journal],
    feedbackLog: [...base.feedbackLog],
    followUps: [...base.followUps],
    mastery: [...base.mastery],
    evidence: [...base.evidence],
    modeHistory: [...base.modeHistory],
    flexDayLedger: [...base.flexDayLedger],
    itemProgress: { ...base.itemProgress },
    pantry: [...((base as any).pantry ?? [])],
    shoppingChecks: [...((base as any).shoppingChecks ?? [])],
    scheduleLogs: [...((base as any).scheduleLogs ?? [])],
    tomorrow: [...((base as any).tomorrow ?? [])],
    dayAssignments: { ...((base as any).dayAssignments ?? {}) },
  } as LifeOSSettings;
  const upsertById = (arr: any[], rec: SyncRecord, keyFn: (x: any) => string) => {
    const idx = arr.findIndex((x) => keyFn(x) === rec.id);
    if (rec.deletedAt) { if (idx >= 0) arr.splice(idx, 1); return; }
    if (idx >= 0) arr[idx] = rec.payload; else arr.push(rec.payload);
  };
  for (const rec of records) {
    switch (rec.table) {
      case T.completions: upsertById(s.completions, rec, (c) => `${c.date}|${c.taskId}`); break;
      case T.journal:     upsertById(s.journal, rec, (j) => j.id); break;
      case T.feedback:    upsertById(s.feedbackLog as any[], rec, (f) => f.id); break;
      case T.followUps:   upsertById(s.followUps, rec, (f) => f.id); break;
      case T.mastery:     upsertById(s.mastery, rec, (m) => m.id); break;
      case T.evidence:    upsertById(s.evidence, rec, (e) => e.id); break;
      case T.modeHistory: upsertById(s.modeHistory, rec, (h) => `${h.date}|${h.ts}`); break;
      case T.flex:        upsertById(s.flexDayLedger, rec, (x) => `${x.date}|${x.ts}`); break;
      case T.pantry:      upsertById((s as any).pantry, rec, (p: any) => p.key); break;
      case T.shoppingChecks: upsertById((s as any).shoppingChecks, rec, (c: any) => `${c.run}|${c.date}|${c.key}`); break;
      case T.scheduleLogs: upsertById((s as any).scheduleLogs, rec, (l: any) => l.id); break;
      case T.tomorrow:     upsertById((s as any).tomorrow, rec, (tn: any) => tn.id); break;
      case T.dayAssignments: if (rec.deletedAt) delete (s as any).dayAssignments[rec.id]; else (s as any).dayAssignments[rec.id] = rec.payload.tasks; break;
      case T.itemProgress:
        if (rec.deletedAt) delete s.itemProgress[rec.id];
        else s.itemProgress[rec.id] = rec.payload.value;
        break;
      case T.settings:
        if (!rec.deletedAt) {
          s.roadmapStartDate = rec.payload.roadmapStartDate ?? s.roadmapStartDate;
          s.dayOrderConfig = rec.payload.dayOrderConfig ?? s.dayOrderConfig;
          s.flexBudgetPerMonth = rec.payload.flexBudgetPerMonth ?? s.flexBudgetPerMonth;
          s.cutoffHourForDowngrade = rec.payload.cutoffHourForDowngrade ?? s.cutoffHourForDowngrade;
        }
        break;
    }
  }
  s.updatedAt = Date.now();
  return s;
}

/** Full local snapshot (not a diff) — used at sync time to merge against remote.
 *  Timestamp-less entities use the settings-level updatedAt as their LWW clock. */
export function fullSnapshotRecords(s: LifeOSSettings): SyncRecord[] {
  const out = intrinsicRecords(s);
  out.push(...Object.entries(s.itemProgress).map(([k, v]) => ({
    table: "itemProgress", id: k, updatedAt: s.updatedAt, payload: { itemId: k, value: v },
  })));
  out.push(settingsSingleton(s, s.updatedAt));
  return out;
}
