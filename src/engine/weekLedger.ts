/**
 * Week ledger — the Week → Day decomposition engine.
 *
 * A week has ~27 typed "week items" derived from the PGOS week's fields.
 * Each item has a cadence (daily · biweekly · weekly-once) and a per-day contribution.
 * Days assign a subset of the week's items into today's plan. Completing a day-task
 * marks the underlying week item's progress. The week completes only when every
 * scheduled item has met its target.
 *
 * This module is pure — no I/O — so both the planner and the analytics can consume it.
 */
import pgos from "@/src/data/pgos.json";

const WEEKS = (pgos as any).WEEKS as any[];

export type Cadence = "daily" | "twice_week" | "weekly";
export type ItemDomain = "tech" | "comm" | "prod" | "know" | "fin" | "health" | "mind" | "prof" | "skills";

export interface WeekItem {
  id: string;                    // stable across days: e.g. "w7:dsa" or "w7:tech.topics#2"
  weekNumber: number;
  domain: ItemDomain;
  field: string;                 // canonical week-field name
  title: string;                 // one-line human title
  detail: string;                // verbatim / lightly cleaned content from the PGOS week
  cadence: Cadence;
  targetContributions: number;   // how many day-slices are needed to complete the item
  perDayMin: number;             // default minutes when scheduled today
  order: number;                 // preferred order within a day (lower = earlier)
  weeklySlot?: "sunday" | "midweek" | "anyday";
  objectiveIdx?: number;         // link back to week.objectives[]
  reviewable?: boolean;          // artefact worth a review pass
  reviewKind?: string;           // e.g. "repo-review", "blog-review"
}

function s(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" · ");
  if (typeof v === "object") {
    if (typeof v.topics !== "undefined" || v.project) {
      const parts: string[] = [];
      if (v.topics) parts.push(`Topics: ${(v.topics as any[]).slice(0, 5).join("; ")}`);
      if (v.project) parts.push(`Project: ${v.project}`);
      if (v.github) parts.push(`Repo: ${v.github}`);
      return parts.join(" · ");
    }
    return JSON.stringify(v);
  }
  return String(v);
}

function hasContent(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some(hasContent);
  return true;
}

/**
 * Content-aware sequencing gate.
 * PGOS uses phrases like "No DSA problems yet — you are building the language first"
 * or "Warm-up, zero pressure" to signal that a topic is not truly active yet.
 * When the week's own text says "not yet" / "no ... yet" / "foundation only",
 * the topic is not a solve-problems habit — the field content becomes a foundational
 * drill task instead. We NEVER invent tasks the field doesn't already describe.
 */
export function isFoundationalOnly(text: string): boolean {
  const t = text.toLowerCase();
  return /no\s+(dsa|leetcode|problems?)\s+.*yet/.test(t)
    || /^warm-?up/.test(t)
    || /zero\s+pressure/.test(t);
}

export function buildWeekItems(weekNumber: number): WeekItem[] {
  const w = WEEKS[Math.max(0, Math.min(31, weekNumber - 1))];
  if (!w) return [];
  const items: WeekItem[] = [];

  // ---- Tech: topics broken into daily study slots ----
  if (w.tech?.topics && Array.isArray(w.tech.topics) && w.tech.topics.length) {
    const topics: string[] = w.tech.topics;
    topics.forEach((topic, i) => {
      items.push({
        id: `w${weekNumber}:tech.topics#${i}`,
        weekNumber, domain: "tech", field: "tech.topics",
        title: `Study: ${topic}`,
        detail: `Week ${weekNumber} theme: ${w.theme}. Today's sub-topic from tech.topics.`,
        cadence: "daily",
        targetContributions: 1,
        perDayMin: 30,
        order: 20,
        objectiveIdx: 0,
      });
    });
  }

  // Tech: project (multi-day build)
  if (w.tech?.project) {
    items.push({
      id: `w${weekNumber}:tech.project`,
      weekNumber, domain: "tech", field: "tech.project",
      title: "Build: this week's project",
      detail: s(w.tech.project) + (w.tech.github ? ` · Repo: ${w.tech.github}` : ""),
      cadence: "daily",
      targetContributions: 5,
      perDayMin: 45,
      order: 30,
      reviewable: true,
      reviewKind: "repo-review",
    });
  }

  // Micro project
  if (hasContent(w.microProject)) {
    items.push({
      id: `w${weekNumber}:microProject`,
      weekNumber, domain: "tech", field: "microProject",
      title: "Micro-project",
      detail: s(w.microProject),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 30,
      order: 32,
      reviewable: true,
      reviewKind: "repo-review",
    });
  }

  // Flagship progress
  if (hasContent(w.flagshipProgress)) {
    items.push({
      id: `w${weekNumber}:flagshipProgress`,
      weekNumber, domain: "tech", field: "flagshipProgress",
      title: "Flagship progress",
      detail: s(w.flagshipProgress),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 30,
      order: 25,
    });
  }

  // DSA — either problem practice or foundational drill, driven by the week's own text
  if (hasContent(w.dsa)) {
    const dsaText = s(w.dsa);
    const foundational = isFoundationalOnly(dsaText);
    items.push({
      id: `w${weekNumber}:dsa`,
      weekNumber, domain: "tech", field: "dsa",
      title: foundational ? "DSA · foundation drill" : "DSA · today's problem",
      detail: dsaText,
      cadence: "daily",
      targetContributions: 6,
      perDayMin: foundational ? 20 : 30,
      order: 15,
    });
  }

  // Competitive — same content-aware treatment
  if (hasContent(w.competitive) && !isFoundationalOnly(s(w.competitive))) {
    items.push({
      id: `w${weekNumber}:competitive`,
      weekNumber, domain: "tech", field: "competitive",
      title: "Competitive practice",
      detail: s(w.competitive),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 25,
      order: 40,
    });
  }

  // Tech writing — weekly deliverable
  if (hasContent(w.techWriting)) {
    items.push({
      id: `w${weekNumber}:techWriting`,
      weekNumber, domain: "comm", field: "techWriting",
      title: "Technical writing",
      detail: s(w.techWriting),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 40,
      order: 50,
      weeklySlot: "sunday",
      reviewable: true,
      reviewKind: "writing-review",
    });
  }

  if (hasContent(w.engineeringJudgement)) {
    items.push({
      id: `w${weekNumber}:engineeringJudgement`,
      weekNumber, domain: "prof", field: "engineeringJudgement",
      title: "Engineering judgement",
      detail: s(w.engineeringJudgement),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 15,
      order: 60,
    });
  }

  if (hasContent(w.projectLifecycle)) {
    items.push({
      id: `w${weekNumber}:projectLifecycle`,
      weekNumber, domain: "tech", field: "projectLifecycle",
      title: "Project lifecycle step",
      detail: s(w.projectLifecycle),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 25,
      order: 35,
    });
  }

  if (hasContent(w.interviewPrep)) {
    items.push({
      id: `w${weekNumber}:interviewPrep`,
      weekNumber, domain: "prof", field: "interviewPrep",
      title: "Interview prep",
      detail: s(w.interviewPrep),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 25,
      order: 55,
      reviewable: true,
      reviewKind: "interview-answer",
    });
  }

  if (hasContent(w.openSource)) {
    items.push({
      id: `w${weekNumber}:openSource`,
      weekNumber, domain: "tech", field: "openSource",
      title: "Open source",
      detail: s(w.openSource),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 30,
      order: 62,
      weeklySlot: "anyday",
      reviewable: true,
      reviewKind: "pr-review",
    });
  }

  if (hasContent(w.revision)) {
    items.push({
      id: `w${weekNumber}:revision`,
      weekNumber, domain: "know", field: "revision",
      title: "Spaced revision",
      detail: s(w.revision),
      cadence: "daily",
      targetContributions: 5,
      perDayMin: 20,
      order: 70,
    });
  }

  if (hasContent(w.portfolioArtifact)) {
    items.push({
      id: `w${weekNumber}:portfolioArtifact`,
      weekNumber, domain: "prof", field: "portfolioArtifact",
      title: "Portfolio artefact",
      detail: s(w.portfolioArtifact),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 30,
      order: 90,
      weeklySlot: "sunday",
      reviewable: true,
      reviewKind: "portfolio-review",
    });
  }

  if (hasContent(w.proofOfWork)) {
    items.push({
      id: `w${weekNumber}:proofOfWork`,
      weekNumber, domain: "prof", field: "proofOfWork",
      title: "Proof of work check",
      detail: s(w.proofOfWork),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 20,
      order: 92,
      weeklySlot: "sunday",
    });
  }

  if (hasContent(w.skills)) {
    items.push({
      id: `w${weekNumber}:skills`,
      weekNumber, domain: "skills", field: "skills",
      title: "Skills & craft",
      detail: s(w.skills),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 20,
      order: 100,
    });
  }

  if (hasContent(w.comm)) {
    items.push({
      id: `w${weekNumber}:comm`,
      weekNumber, domain: "comm", field: "comm",
      title: "Personal brand · communication",
      detail: s(w.comm),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 30,
      order: 65,
      weeklySlot: "anyday",
      reviewable: true,
      reviewKind: "writing-review",
    });
  }

  if (hasContent(w.creatorTrack)) {
    items.push({
      id: `w${weekNumber}:creatorTrack`,
      weekNumber, domain: "comm", field: "creatorTrack",
      title: "Creator track rep",
      detail: s(w.creatorTrack),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 15,
      order: 66,
    });
  }

  if (hasContent(w.prod)) {
    items.push({
      id: `w${weekNumber}:prod`,
      weekNumber, domain: "prod", field: "prod",
      title: "AI productivity",
      detail: s(w.prod),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 20,
      order: 68,
    });
  }

  if (hasContent(w.aiLeverageTrack)) {
    items.push({
      id: `w${weekNumber}:aiLeverageTrack`,
      weekNumber, domain: "prod", field: "aiLeverageTrack",
      title: "AI leverage rep",
      detail: s(w.aiLeverageTrack),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 15,
      order: 69,
    });
  }

  if (hasContent(w.aiTool)) {
    items.push({
      id: `w${weekNumber}:aiTool`,
      weekNumber, domain: "prod", field: "aiTool",
      title: "AI tool of the week",
      detail: s(w.aiTool),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 20,
      order: 72,
    });
  }

  if (hasContent(w.know)) {
    items.push({
      id: `w${weekNumber}:know`,
      weekNumber, domain: "know", field: "know",
      title: "Reading & knowledge",
      detail: s(w.know),
      cadence: "daily",
      targetContributions: 5,
      perDayMin: 25,
      order: 80,
    });
  }

  if (hasContent(w.fin)) {
    items.push({
      id: `w${weekNumber}:fin`,
      weekNumber, domain: "fin", field: "fin",
      title: "Finance",
      detail: s(w.fin),
      cadence: "twice_week",
      targetContributions: 1,
      perDayMin: 20,
      order: 85,
    });
  }

  if (hasContent(w.health)) {
    items.push({
      id: `w${weekNumber}:health`,
      weekNumber, domain: "health", field: "health",
      title: "Week's health focus",
      detail: s(w.health),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 15,
      order: 92,
    });
  }

  if (hasContent(w.mind)) {
    items.push({
      id: `w${weekNumber}:mind`,
      weekNumber, domain: "mind", field: "mind",
      title: "Mindset practice",
      detail: s(w.mind),
      cadence: "twice_week",
      targetContributions: 2,
      perDayMin: 15,
      order: 95,
    });
  }

  if (hasContent(w.prof)) {
    items.push({
      id: `w${weekNumber}:prof`,
      weekNumber, domain: "prof", field: "prof",
      title: "Professional presence",
      detail: s(w.prof),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 25,
      order: 88,
      weeklySlot: "anyday",
      reviewable: true,
      reviewKind: "resume-review",
    });
  }

  if (hasContent(w.reflection)) {
    items.push({
      id: `w${weekNumber}:reflection`,
      weekNumber, domain: "mind", field: "reflection",
      title: "Weekly reflection",
      detail: s(w.reflection),
      cadence: "weekly",
      targetContributions: 1,
      perDayMin: 20,
      order: 200,
      weeklySlot: "sunday",
    });
  }

  return items;
}

/** Total items scheduled × contribution units for the week. */
export function weekTotal(items: WeekItem[]): number {
  return items.reduce((a, x) => a + x.targetContributions, 0);
}

/** How many contribution units are already logged, from an itemProgress map. */
export function weekDone(items: WeekItem[], itemProgress: Record<string, number>): number {
  return items.reduce((a, x) => a + Math.min(x.targetContributions, itemProgress[x.id] ?? 0), 0);
}

export function getWeekObjectives(weekNumber: number): string[] {
  const w = WEEKS[Math.max(0, Math.min(31, weekNumber - 1))];
  if (!w?.objectives) return [];
  return Array.isArray(w.objectives) ? w.objectives : [String(w.objectives)];
}

export function getWeekTheme(weekNumber: number): string {
  const w = WEEKS[Math.max(0, Math.min(31, weekNumber - 1))];
  return w?.theme || `Week ${weekNumber}`;
}

export function getWeekPhase(weekNumber: number): number {
  const w = WEEKS[Math.max(0, Math.min(31, weekNumber - 1))];
  return w?.phase || 1;
}
