/**
 * Mastery / Competency model (V1). Execution ≠ mastery: a fully-executed week can
 * still leave a competency Not-Yet-Demonstrated. Pure helpers + a stored record type.
 */
import pgos from "@/src/data/pgos.json";

export type MasteryState = "not_demonstrated" | "demonstrated" | "strong";

export interface MasteryRecord {
  id: string;            // `${domain}:${competency}` slug
  domain: string;
  competency: string;
  state: MasteryState;
  updatedAt: number;
}

export interface Competency {
  id: string;
  domain: string;
  label: string;
}

const SYLLABI: any[] = (pgos as any).DOMAIN_SYLLABI ?? [];

/** All competencies declared across DOMAIN_SYLLABI (coreCompetencies + competencyChecks). */
export function allCompetencies(): Competency[] {
  const out: Competency[] = [];
  for (const d of SYLLABI) {
    const list: string[] = [
      ...(d.coreCompetencies ?? []),
      ...(d.competencyChecks ?? []),
    ];
    list.forEach((label) => {
      const id = `${d.id}:${slug(label)}`;
      if (!out.some((c) => c.id === id)) out.push({ id, domain: d.id, label });
    });
  }
  return out;
}

export function competenciesForDomain(domain: string): Competency[] {
  return allCompetencies().filter((c) => c.domain === domain);
}

export function getMasteryState(records: MasteryRecord[], id: string): MasteryState {
  return records.find((r) => r.id === id)?.state ?? "not_demonstrated";
}

/** 0..1 gap: 1 = not demonstrated, 0.5 = demonstrated, 0 = strong. */
export function masteryGapForDomain(records: MasteryRecord[], domain: string): number {
  const comps = competenciesForDomain(domain);
  if (!comps.length) return 0;
  const gap = comps.reduce((acc, c) => {
    const s = getMasteryState(records, c.id);
    return acc + (s === "not_demonstrated" ? 1 : s === "demonstrated" ? 0.5 : 0);
  }, 0);
  return gap / comps.length;
}

export interface MasterySummary { total: number; strong: number; demonstrated: number; notDemonstrated: number; pct: number }

export function masterySummary(records: MasteryRecord[], domain?: string): MasterySummary {
  const comps = domain ? competenciesForDomain(domain) : allCompetencies();
  const total = comps.length;
  let strong = 0, demonstrated = 0, notDemonstrated = 0;
  for (const c of comps) {
    const s = getMasteryState(records, c.id);
    if (s === "strong") strong++;
    else if (s === "demonstrated") demonstrated++;
    else notDemonstrated++;
  }
  // pct credits strong fully, demonstrated half.
  const pct = total ? Math.round(((strong + demonstrated * 0.5) / total) * 100) : 0;
  return { total, strong, demonstrated, notDemonstrated, pct };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}
