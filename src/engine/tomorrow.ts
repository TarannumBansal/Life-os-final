/**
 * Tomorrow notes (V1.1) — a lightweight "what do I want ready at the start of tomorrow?"
 * surface. NOT Journal, NOT tasks, NOT PGOS. May be read by the next-day planner as context
 * only; a note never becomes a PGOS task. Pure list + ordering.
 */
export type TomorrowKind = "priority" | "remember" | "note";
export interface TomorrowNote {
  id: string; kind: TomorrowKind; text: string; order: number;
  createdAt: number; updatedAt: number;
}
export function sortedTomorrow(notes: TomorrowNote[]): TomorrowNote[] {
  return [...notes].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}
