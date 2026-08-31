/**
 * Evidence / Proof-of-Work model (V1). First-class, linkable records of work produced
 * (repos, URLs, commits, notes, ADRs, artefacts), tied to a week/domain/item.
 */
export type EvidenceType =
  | "repo" | "project-url" | "commit" | "leetcode" | "note" | "adr" | "blog" | "pr" | "artifact";

export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  title: string;
  url?: string;
  weekNumber: number;
  domain: string;
  weekItemId?: string;
  createdAt: number;
  updatedAt: number;
}

export function evidenceForWeek(records: EvidenceRecord[], weekNumber: number): EvidenceRecord[] {
  return records.filter((e) => e.weekNumber === weekNumber);
}
export function evidenceForDomain(records: EvidenceRecord[], domain: string): EvidenceRecord[] {
  return records.filter((e) => e.domain === domain);
}
export function evidenceCountByType(records: EvidenceRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of records) out[e.type] = (out[e.type] ?? 0) + 1;
  return out;
}
