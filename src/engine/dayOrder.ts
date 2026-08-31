/**
 * Day-Order engine.
 * College runs on rotating Day Orders 1..5 (Mon–Fri equivalent) + Saturday STEP + Sunday off.
 * A holiday on a college day SHIFTS the next college day picks up the next Day Order (never skipped).
 * Sundays and marked holidays do not consume a Day Order.
 * The engine derives the Day Order for any date given (a) a start-date anchor + start Day Order,
 * (b) the set of holidays.
 */

export type DayKind = "college" | "sat_step" | "sunday" | "holiday" | "exam";
export type DayOrder = 1 | 2 | 3 | 4 | 5;

export interface DayOrderConfig {
  anchorDate: string;       // ISO yyyy-mm-dd
  anchorDayOrder: DayOrder;
  holidays: string[];       // ISO dates that should be skipped for the sequence
  examDates: string[];      // ISO dates marked as exam (do not advance sequence either)
}

export interface DerivedDay {
  date: string;
  kind: DayKind;
  dayOrder: DayOrder | null;
  classes: { start: string; end: string }[];
  freeWindows: { start: string; end: string }[]; // wake→sleep minus classes/routines
}

const CLASS_TIMES: Record<DayOrder, { start: string; end: string }[]> = {
  1: [{ start: "08:00", end: "14:15" }],
  2: [{ start: "09:45", end: "16:50" }],
  3: [{ start: "08:00", end: "12:25" }],
  4: [{ start: "12:30", end: "17:00" }],
  5: [{ start: "09:45", end: "12:25" }, { start: "15:00", end: "18:10" }],
};

const SAT_STEP: { start: string; end: string }[] = [{ start: "08:00", end: "12:00" }];

const DAY_START = "07:00";
const DAY_END = "22:30";

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function subtractWindows(dayStart: string, dayEnd: string, blocks: { start: string; end: string }[]): { start: string; end: string }[] {
  const start = toMin(dayStart), end = toMin(dayEnd);
  const sorted = [...blocks].sort((a, b) => toMin(a.start) - toMin(b.start));
  const out: { start: string; end: string }[] = [];
  let cursor = start;
  for (const b of sorted) {
    const bs = Math.max(toMin(b.start), start);
    const be = Math.min(toMin(b.end), end);
    if (bs > cursor) out.push({ start: fromMin(cursor), end: fromMin(bs) });
    cursor = Math.max(cursor, be);
  }
  if (cursor < end) out.push({ start: fromMin(cursor), end: fromMin(end) });
  return out.filter((w) => toMin(w.end) - toMin(w.start) >= 20);
}

function isoDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function today(): string { return isoDate(new Date()); }
export function parseISO(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function addDays(iso: string, n: number): string { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); }

/**
 * Derive the Day Order for `dateISO` given the config.
 * Walks forward from anchor, advancing the Day Order sequence only on college weekdays that
 * are not holidays and not exam days.
 */
export function deriveDayOrder(dateISO: string, cfg: DayOrderConfig): DayOrder | null {
  const target = parseISO(dateISO);
  const anchor = parseISO(cfg.anchorDate);
  if (target < anchor) return null;
  let cur = new Date(anchor);
  let dayOrder = cfg.anchorDayOrder;
  const holidays = new Set(cfg.holidays);
  const exams = new Set(cfg.examDates);

  while (isoDate(cur) < dateISO) {
    // advance one day
    cur.setDate(cur.getDate() + 1);
    const iso = isoDate(cur);
    const dow = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow === 0 || dow === 6) continue;                    // weekend doesn't advance Day Order
    if (holidays.has(iso) || exams.has(iso)) continue;       // holiday/exam doesn't advance
    dayOrder = ((dayOrder % 5) + 1) as DayOrder;             // 1→2→3→4→5→1
  }
  const dow = target.getDay();
  const iso = isoDate(target);
  if (dow === 0) return null;
  if (dow === 6) return null;
  if (holidays.has(iso) || exams.has(iso)) return null;
  return dayOrder;
}

export function deriveDay(dateISO: string, cfg: DayOrderConfig): DerivedDay {
  const target = parseISO(dateISO);
  const dow = target.getDay();
  const holidays = new Set(cfg.holidays);
  const exams = new Set(cfg.examDates);

  let kind: DayKind = "college";
  let dayOrder: DayOrder | null = null;
  let classes: { start: string; end: string }[] = [];

  if (exams.has(dateISO)) { kind = "exam"; }
  else if (holidays.has(dateISO)) { kind = "holiday"; }
  else if (dow === 0) { kind = "sunday"; }
  else if (dow === 6) { kind = "sat_step"; classes = SAT_STEP; }
  else {
    dayOrder = deriveDayOrder(dateISO, cfg);
    if (dayOrder) classes = CLASS_TIMES[dayOrder];
  }

  const freeWindows = subtractWindows(DAY_START, DAY_END, classes);
  return { date: dateISO, kind, dayOrder, classes, freeWindows };
}

export function windowMinutes(w: { start: string; end: string }): number {
  return toMin(w.end) - toMin(w.start);
}

export function totalFreeMinutes(day: DerivedDay): number {
  return day.freeWindows.reduce((acc, w) => acc + windowMinutes(w), 0);
}
