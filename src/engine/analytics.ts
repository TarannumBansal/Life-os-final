/**
 * Growth Analytics engine (V1) — pure aggregation over stored history. No charts here;
 * screens render these numbers. Execution / mastery / evidence / consistency are all
 * treated as distinct dimensions.
 */
import pgos from "@/src/data/pgos.json";
import { buildWeekItems, weekTotal, weekDone } from "./weekLedger";
import type { MasteryRecord } from "./mastery";
import { masterySummary } from "./mastery";
import type { EvidenceRecord } from "./evidence";

export interface AnalyticsInput {
  roadmapStartDate: string;
  todayISO: string;
  currentWeek: number;
  itemProgress: Record<string, number>;
  completions: { date: string; completedAt: number }[];
  mastery: MasteryRecord[];
  evidence: EvidenceRecord[];
  feedbackLog: { createdAt: number }[];
}

const DOMAINS: any[] = (pgos as any).DOMAINS ?? [];

/** Execution % for a single week (contributions done / total). */
export function weekExecution(weekNumber: number, itemProgress: Record<string, number>): number {
  const items = buildWeekItems(weekNumber);
  const total = weekTotal(items);
  const done = weekDone(items, itemProgress);
  return total ? Math.round((done / total) * 100) : 0;
}

/** Execution % per week up to the current week. */
export function weeklyExecution(input: AnalyticsInput): { week: number; pct: number }[] {
  const out: { week: number; pct: number }[] = [];
  for (let w = 1; w <= Math.min(32, input.currentWeek); w++) {
    out.push({ week: w, pct: weekExecution(w, input.itemProgress) });
  }
  return out;
}

/** Phase progress (4 phases × 8 weeks): mean execution across each phase's weeks so far. */
export function phaseProgress(input: AnalyticsInput): { phase: number; pct: number }[] {
  const weekly = weeklyExecution(input);
  const out: { phase: number; pct: number }[] = [];
  for (let p = 1; p <= 4; p++) {
    const weeks = weekly.filter((x) => Math.ceil(x.week / 8) === p);
    const pct = weeks.length ? Math.round(weeks.reduce((a, x) => a + x.pct, 0) / weeks.length) : 0;
    out.push({ phase: p, pct });
  }
  return out;
}

/** Domain execution: share of completed contributions attributable to each domain, current week. */
export function domainProgress(input: AnalyticsInput): { domain: string; label: string; pct: number }[] {
  const items = buildWeekItems(input.currentWeek);
  return DOMAINS.map((d: any) => {
    const dItems = items.filter((i) => i.domain === d.id);
    const total = dItems.reduce((a, i) => a + i.targetContributions, 0);
    const done = dItems.reduce((a, i) => a + Math.min(i.targetContributions, input.itemProgress[i.id] ?? 0), 0);
    return { domain: d.id, label: d.label, pct: total ? Math.round((done / total) * 100) : 0 };
  });
}

/** Mastery progress per domain + overall (distinct from execution). */
export function masteryProgress(input: AnalyticsInput): { overall: number; byDomain: { domain: string; label: string; pct: number }[] } {
  const overall = masterySummary(input.mastery).pct;
  const byDomain = DOMAINS.map((d: any) => ({ domain: d.id, label: d.label, pct: masterySummary(input.mastery, d.id).pct }));
  return { overall, byDomain };
}

/** Evidence produced: totals + per-week counts. */
export function evidenceProduced(input: AnalyticsInput): { total: number; byWeek: { week: number; count: number }[] } {
  const byWeek: { week: number; count: number }[] = [];
  for (let w = 1; w <= Math.min(32, input.currentWeek); w++) {
    byWeek.push({ week: w, count: input.evidence.filter((e) => e.weekNumber === w).length });
  }
  return { total: input.evidence.length, byWeek };
}

/** Consistency: distinct active days over the last N days (default 28). */
export function consistency(input: AnalyticsInput, windowDays = 28): { activeDays: number; windowDays: number; pct: number } {
  const now = new Date(input.todayISO).getTime();
  const cutoff = now - windowDays * 86400000;
  const days = new Set(input.completions.filter((c) => c.completedAt >= cutoff).map((c) => c.date));
  return { activeDays: days.size, windowDays, pct: Math.round((days.size / windowDays) * 100) };
}

/** Learning velocity: contributions completed per active week (rough momentum signal). */
export function learningVelocity(input: AnalyticsInput): number {
  const totalDone = Object.entries(input.itemProgress).reduce((a, [, v]) => a + v, 0);
  const weeks = Math.max(1, input.currentWeek);
  return Math.round((totalDone / weeks) * 10) / 10;
}

/** One combined summary object for a dashboard header. */
export function analyticsSummary(input: AnalyticsInput) {
  return {
    currentWeek: input.currentWeek,
    phase: Math.ceil(input.currentWeek / 8),
    thisWeekExecution: weekExecution(input.currentWeek, input.itemProgress),
    mastery: masteryProgress(input),
    evidence: evidenceProduced(input),
    consistency: consistency(input),
    velocity: learningVelocity(input),
    feedbackCount: input.feedbackLog.length,
  };
}
