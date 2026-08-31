/**
 * Real-life schedule logs (V1.1) — simple user-created time blocks (Startup Work, a class,
 * a hackathon…). NOT PGOS curriculum, NOT a project system. They consume real time so the
 * timeline plans PGOS work around them. Pure resolution; persisted + synced like any record.
 */
export interface ScheduleLog {
  id: string;
  title: string;
  startDate: string;            // ISO
  endDate?: string;             // ISO; for recurring/date-range. Omit for a one-time entry.
  startTime: string;            // "17:00"
  endTime: string;              // "19:45"
  recurring: boolean;           // true = every day in [startDate,endDate]; false = only startDate
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleBlock { id: string; title: string; start: string; end: string; note?: string }

/** The schedule blocks active on a given date (the single source Today/Calendar/planner share). */
export function scheduleBlocksForDate(logs: ScheduleLog[], dateISO: string): ScheduleBlock[] {
  return logs
    .filter((l) => {
      if (!l.recurring) return l.startDate === dateISO;              // one-time
      const end = l.endDate ?? l.startDate;                          // date-range / recurring
      return l.startDate <= dateISO && dateISO <= end;
    })
    .map((l) => ({ id: l.id, title: l.title, start: l.startTime, end: l.endTime, note: l.note }))
    .sort((a, b) => a.start.localeCompare(b.start));
}
