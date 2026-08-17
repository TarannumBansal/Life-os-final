/**
 * Growth Story + Mission-Control helpers (V1 final pass). Pure + testable.
 * Turns raw tracking into a narrative ("firsts"), the next milestone, and the
 * count of work still awaiting an AI review — so Home can answer "where am I".
 */
import pgos from "@/src/data/pgos.json";
import type { WeekItem } from "./weekLedger";
import type { EvidenceRecord } from "./evidence";
import type { MasteryRecord } from "./mastery";
import { masterySummary } from "./mastery";

const SYLLABI: any[] = (pgos as any).DOMAIN_SYLLABI ?? [];

export interface UpcomingMilestone { week: number; milestone: string; domain: string; label: string }

/** The nearest milestone at or after the current week (across all domains). */
export function upcomingMilestone(weekNumber: number): UpcomingMilestone | null {
  const all: UpcomingMilestone[] = [];
  for (const d of SYLLABI) {
    for (const m of d.milestones ?? []) all.push({ week: m.week, milestone: m.milestone, domain: d.id, label: d.label });
  }
  if (!all.length) return null;
  const ahead = all.filter((m) => m.week >= weekNumber).sort((a, b) => a.week - b.week);
  return ahead[0] ?? all.sort((a, b) => b.week - a.week)[0];
}

export interface GrowthMoment { key: string; label: string; achieved: boolean; hint: string }

/** An ordered narrative of milestone "firsts" — the story of becoming an engineer. */
export function growthStory(evidence: EvidenceRecord[], mastery: MasteryRecord[]): GrowthMoment[] {
  const has = (fn: (e: EvidenceRecord) => boolean) => evidence.some(fn);
  const masteryPct = masterySummary(mastery).pct;
  const internshipReady = evidence.length >= 12 && masteryPct >= 50 && has((e) => e.type === "pr");

  return [
    { key: "first-proof", label: "First proof of work", achieved: evidence.length > 0, hint: "Log anything you build." },
    { key: "first-repo", label: "First repository", achieved: has((e) => e.type === "repo"), hint: "Push your first repo." },
    { key: "first-project", label: "First live project", achieved: has((e) => e.type === "project-url"), hint: "Deploy something with a URL." },
    { key: "first-writing", label: "First technical writing", achieved: has((e) => e.type === "blog" || e.type === "note" || e.type === "adr"), hint: "Publish a note, ADR, or blog." },
    { key: "first-ai", label: "First AI project", achieved: has((e) => (e.type === "repo" || e.type === "project-url") && e.weekNumber >= 17), hint: "Ship an AI project (Phase 3+)." },
    { key: "first-oss", label: "First open-source PR", achieved: has((e) => e.type === "pr"), hint: "Open your first pull request." },
    { key: "internship-ready", label: "Internship ready", achieved: internshipReady, hint: "Evidence + mastery + an OSS contribution." },
  ];
}

/** Work that is complete + reviewable but has no AI-review feedback yet. */
export function pendingReviews(
  weekItems: WeekItem[],
  itemProgress: Record<string, number>,
  feedbackCount: number,
): number {
  const completedReviewable = weekItems.filter(
    (it) => it.reviewable && (itemProgress[it.id] ?? 0) >= it.targetContributions,
  ).length;
  return Math.max(0, completedReviewable - feedbackCount);
}
