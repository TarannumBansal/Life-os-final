/**
 * Rough daily timeline (V1.1) — turns the ALREADY-FINITE Today plan into an approximate
 * chronological flow around fixed blocks (classes, user schedule logs, meal anchors), with
 * transitions and a protected sleep window. It NEVER scans the weekly curriculum: it only
 * places the finite `tasks` it is given (the planner's ordered Today set), so the finite-queue
 * guarantee is preserved. Times are approximate planning anchors, not deadlines.
 */
export const WAKE_DEFAULT = "07:30";
export const SLEEP_TARGET = "22:30";     // never schedule past this — sleep is protected
const BUFFER_MIN = 15;                    // transition/eat/travel breathing room

export interface FixedBlock { start: string; end: string; label: string; kind: "class" | "fixed" | "meal" | "workout" }
export interface FlexTask { id: string; label: string; durationMin: number; blockId?: string; why?: string }

export interface TimelineItem {
  start: string; end: string; label: string;
  kind: "routine" | "class" | "fixed" | "meal" | "workout" | "deep" | "buffer" | "sleep";
  fixed: boolean; taskId?: string; why?: string;
}
export interface Timeline {
  items: TimelineItem[];
  deferred: FlexTask[];      // tasks that didn't fit before sleep (lowest priority first)
  todayComplete: boolean;
  wake: string;
}

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Free gaps between dayStart..dayEnd after removing fixed blocks. */
function freeGaps(dayStart: number, dayEnd: number, fixed: FixedBlock[]): { start: number; end: number }[] {
  const sorted = [...fixed].map((f) => ({ s: toMin(f.start), e: toMin(f.end) }))
    .filter((b) => b.e > dayStart && b.s < dayEnd).sort((a, b) => a.s - b.s);
  const gaps: { start: number; end: number }[] = [];
  let cur = dayStart;
  for (const b of sorted) {
    if (b.s > cur) gaps.push({ start: cur, end: Math.min(b.s, dayEnd) });
    cur = Math.max(cur, b.e);
    if (cur >= dayEnd) break;
  }
  if (cur < dayEnd) gaps.push({ start: cur, end: dayEnd });
  return gaps.filter((g) => g.end - g.start >= 10);
}

export interface BuildTimelineOpts {
  dateISO: string;
  wake?: string;                 // actual/estimated wake — late start shifts the whole day
  fixed: FixedBlock[];           // classes + user schedule logs + meal anchors + workout
  tasks: FlexTask[];             // the planner's FINITE, priority-ordered Today tasks
  completedTaskIds?: string[];   // to compute todayComplete
}

/**
 * SHIFT + COMPRESS SELECTIVELY + DEFER LOW PRIORITY:
 * fixed blocks stay put; flexible tasks fill the gaps in priority order with buffers;
 * anything that won't fit before SLEEP_TARGET is deferred (never pushed into the night).
 */
export function buildTimeline(opts: BuildTimelineOpts): Timeline {
  const wake = opts.wake && toMin(opts.wake) > toMin(WAKE_DEFAULT) ? opts.wake : WAKE_DEFAULT;
  const dayStart = toMin(wake);
  const dayEnd = toMin(SLEEP_TARGET);

  const items: TimelineItem[] = [];
  // Morning routine anchor (short, right after wake).
  items.push({ start: wake, end: toHHMM(dayStart + 20), label: "Wake + morning routine", kind: "routine", fixed: false, why: "Gentle start to anchor the day." });

  // Fixed blocks become fixed timeline items.
  for (const f of opts.fixed) {
    items.push({
      start: f.start, end: f.end, label: f.label,
      kind: f.kind === "class" ? "class" : f.kind === "meal" ? "meal" : f.kind === "workout" ? "workout" : "fixed",
      fixed: f.kind !== "meal", // meals are anchors but soft
      why: f.kind === "class" ? "Fixed class from your Day Order." : f.kind === "fixed" ? "Your scheduled block — protected time." : undefined,
    });
  }

  // Fill free gaps (after the routine) with the finite task list, in order, with buffers.
  const gaps = freeGaps(dayStart + 25, dayEnd, opts.fixed);
  const deferred: FlexTask[] = [];
  let gi = 0; let cursor = gaps.length ? gaps[0].start : dayEnd;

  for (const task of opts.tasks) {
    let placed = false;
    while (gi < gaps.length) {
      if (cursor < gaps[gi].start) cursor = gaps[gi].start;
      const remaining = gaps[gi].end - cursor;
      if (remaining >= Math.min(task.durationMin, 20)) {
        const dur = Math.min(task.durationMin, remaining);
        const compressed = dur < task.durationMin;
        items.push({
          start: toHHMM(cursor), end: toHHMM(cursor + dur), label: task.label, kind: "deep", fixed: false, taskId: task.id,
          why: task.why ?? (compressed
            ? `Shortened to ${dur} min because your fixed blocks reduce today's capacity.`
            : `Placed in your first open ${dur}-min window.`),
        });
        cursor += dur;
        if (gaps[gi].end - cursor >= BUFFER_MIN) { items.push({ start: toHHMM(cursor), end: toHHMM(cursor + BUFFER_MIN), label: "Transition / breather", kind: "buffer", fixed: false }); cursor += BUFFER_MIN; }
        placed = true; break;
      } else { gi++; if (gi < gaps.length) cursor = gaps[gi].start; }
    }
    if (!placed) deferred.push(task); // no room before sleep → defer (protects sleep)
  }

  items.push({ start: SLEEP_TARGET, end: SLEEP_TARGET, label: "Wind-down / sleep", kind: "sleep", fixed: false, why: "Sleep is protected — a good tomorrow starts tonight." });
  items.sort((a, b) => toMin(a.start) - toMin(b.start));

  const done = new Set(opts.completedTaskIds ?? []);
  const todayComplete = opts.tasks.length > 0 && opts.tasks.every((t) => done.has(t.id)) && deferred.length === 0;

  return { items, deferred, todayComplete, wake };
}
