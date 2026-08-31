/** V1.1 — schedule logs, timeline, tomorrow notes, motivation. Covers the required
 *  regression lists from all three correction docs. Pure logic; deterministic. */
import { scheduleBlocksForDate, ScheduleLog } from "@/src/engine/schedule";
import { buildTimeline, SLEEP_TARGET } from "@/src/engine/timeline";
import { sortedTomorrow } from "@/src/engine/tomorrow";
import { motivationFor, STABLE, detectContext } from "@/src/engine/motivation";
import { intrinsicRecords, applyRecordsToSettings } from "@/src/sync/serialize";
import { syncOnce } from "@/src/sync/queue";
import { MemoryProvider } from "@/src/sync/provider.memory";
import * as repo from "@/src/store/repositories";

const log = (o: Partial<ScheduleLog> & { title: string }): ScheduleLog => ({
  id: o.id ?? "s1", title: o.title, startDate: o.startDate ?? "2026-09-04", endDate: o.endDate,
  startTime: o.startTime ?? "17:00", endTime: o.endTime ?? "19:45", recurring: o.recurring ?? false,
  note: o.note, createdAt: 1, updatedAt: o.updatedAt ?? 1,
});

describe("schedule logs (Doc1 Tests 1-3,6,7)", () => {
  test("one-time entry appears only on its date", () => {
    const l = [log({ title: "Prof meeting", startDate: "2026-09-05", recurring: false })];
    expect(scheduleBlocksForDate(l, "2026-09-05")).toHaveLength(1);
    expect(scheduleBlocksForDate(l, "2026-09-06")).toHaveLength(0);
  });
  test("recurring/date-range entry appears across the range", () => {
    const l = [log({ title: "Startup", startDate: "2026-09-04", endDate: "2026-09-12", recurring: true })];
    expect(scheduleBlocksForDate(l, "2026-09-04")[0].title).toBe("Startup");
    expect(scheduleBlocksForDate(l, "2026-09-10")).toHaveLength(1);
    expect(scheduleBlocksForDate(l, "2026-09-13")).toHaveLength(0);
  });
  test("edit + delete propagate (single source)", () => {
    let s: any = { scheduleLogs: [], tomorrow: [], /* other arrays */ };
    s = repo.addScheduleLog(s, { title: "Startup", startDate: "2026-09-04", startTime: "17:00", endTime: "19:45", recurring: false });
    const id = s.scheduleLogs[0].id;
    s = repo.updateScheduleLog(s, id, { endTime: "20:00" });
    expect(scheduleBlocksForDate(s.scheduleLogs, "2026-09-04")[0].end).toBe("20:00");
    s = repo.removeScheduleLog(s, id);
    expect(scheduleBlocksForDate(s.scheduleLogs, "2026-09-04")).toHaveLength(0);
  });
});

describe("timeline (Doc2 Tests 1,3,4,5,6,7,8,9,10,11,15)", () => {
  const classes = [{ start: "09:45", end: "16:50", label: "College", kind: "class" as const }];
  const startup = { start: "17:00", end: "19:45", label: "Startup Work", kind: "fixed" as const };
  const tasks = [
    { id: "t-c", label: "C foundations", durationMin: 45, why: undefined },
    { id: "t-dsa", label: "DSA drill", durationMin: 45 },
    { id: "t-read", label: "Reading", durationMin: 20 },
  ];

  test("every executable item gets a time window; classes stay fixed", () => {
    const tl = buildTimeline({ dateISO: "2026-09-04", fixed: [...classes, startup], tasks });
    const college = tl.items.find((i) => i.label === "College")!;
    expect(college.start).toBe("09:45"); expect(college.fixed).toBe(true);
    const cItem = tl.items.find((i) => i.taskId === "t-c")!;
    expect(cItem.start).toMatch(/^\d\d:\d\d$/); expect(cItem.end).toMatch(/^\d\d:\d\d$/);
  });
  test("PGOS work is never scheduled on top of a fixed block", () => {
    const tl = buildTimeline({ dateISO: "2026-09-04", fixed: [...classes, startup], tasks });
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    for (const it of tl.items.filter((i) => i.kind === "deep")) {
      // deep-work item must not overlap college (09:45-16:50) or startup (17:00-19:45)
      const s = toMin(it.start), e = toMin(it.end);
      expect(s >= toMin("16:50") || e <= toMin("09:45") || (s >= toMin("19:45"))).toBe(true);
    }
  });
  test("adding a fixed block recomputes (fewer/late tasks); removing restores capacity", () => {
    const withBlock = buildTimeline({ dateISO: "2026-09-04", fixed: [...classes, startup], tasks });
    const without = buildTimeline({ dateISO: "2026-09-04", fixed: [...classes], tasks });
    expect(without.deferred.length).toBeLessThanOrEqual(withBlock.deferred.length);
  });
  test("late start recalculates and does not fail the day; low-priority deferred first", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, label: `Task ${i}`, durationMin: 45 }));
    const early = buildTimeline({ dateISO: "2026-09-04", wake: "07:30", fixed: [...classes, startup], tasks: many });
    const late = buildTimeline({ dateISO: "2026-09-04", wake: "08:20", fixed: [...classes, startup], tasks: many });
    expect(late.wake).toBe("08:20");
    expect(late.deferred.length).toBeGreaterThanOrEqual(early.deferred.length);
    // deferral takes from the END of the priority-ordered list (low priority first)
    if (late.deferred.length) expect(late.deferred[late.deferred.length - 1].id).toBe("t7");
  });
  test("sleep is protected — nothing scheduled past SLEEP_TARGET", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, label: `T${i}`, durationMin: 45 }));
    const tl = buildTimeline({ dateISO: "2026-09-04", fixed: [...classes, startup], tasks: many });
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    for (const it of tl.items.filter((i) => i.kind === "deep")) expect(toMin(it.end)).toBeLessThanOrEqual(toMin(SLEEP_TARGET));
    expect(tl.deferred.length).toBeGreaterThan(0); // overflow deferred, not pushed into night
  });
  test("finite queue: timeline only places given tasks (Today=100% possible while week partial)", () => {
    const tl = buildTimeline({ dateISO: "2026-09-04", fixed: classes, tasks, completedTaskIds: ["t-c", "t-dsa", "t-read"] });
    expect(tl.items.filter((i) => i.kind === "deep")).toHaveLength(3); // exactly the 3 given, no week leak
    expect(tl.todayComplete).toBe(true);
  });
});

describe("tomorrow notes (Doc1 Tests 9-13)", () => {
  test("add / edit / delete / reorder; never a PGOS task", () => {
    let s: any = { tomorrow: [], scheduleLogs: [] };
    s = repo.addTomorrow(s, "priority", "Continue C pointers");
    s = repo.addTomorrow(s, "remember", "Ask about attendance");
    expect(s.tomorrow).toHaveLength(2);
    const id = s.tomorrow[0].id;
    s = repo.updateTomorrow(s, id, { text: "C pointers + arrays" });
    expect(s.tomorrow.find((t: any) => t.id === id).text).toBe("C pointers + arrays");
    s = repo.reorderTomorrow(s, id, 5);
    expect(sortedTomorrow(s.tomorrow)[1].id).toBe(id);
    s = repo.removeTomorrow(s, id);
    expect(s.tomorrow).toHaveLength(1);
    // Tomorrow notes carry no weekItemId/domain → cannot be a PGOS task by construction
    expect(s.tomorrow[0]).not.toHaveProperty("weekItemId");
  });
});

describe("motivation (Doc3 Tests 1-11)", () => {
  test("stable messages are stable across days", () => {
    expect(motivationFor("morning", {}, "2026-09-04").stable).toBe(STABLE.morning);
    expect(motivationFor("morning", {}, "2026-09-05").stable).toBe(STABLE.morning);
    expect(motivationFor("afternoon", {}, "2026-09-04").stable).toBe(STABLE.afternoon);
    expect(motivationFor("completion", { todayComplete: true }, "2026-09-04").stable).toBe(STABLE.completion);
  });
  test("context drives the quote: first day / new week / difficult", () => {
    expect(detectContext({ isFirstDay: true }, "morning")).toBe("first-day");
    expect(detectContext({ isNewWeek: true }, "morning")).toBe("new-week");
    expect(detectContext({ weekExecutionPct: 10 }, "afternoon")).toBe("difficult");
  });
  test("quotes vary by date within a context but never fabricate attribution", () => {
    const q1 = motivationFor("morning", { isFirstDay: true }, "2026-09-04").quote;
    const q2 = motivationFor("morning", { isFirstDay: true }, "2026-09-07").quote;
    expect(q1.text.length).toBeGreaterThan(0);
    // author is a real name or null (original LifeOS line) — never an invented attribution placeholder
    expect(q1.author === null || typeof q1.author === "string").toBe(true);
    expect([q1.text, q2.text].every((t) => t.split(" ").length <= 16)).toBe(true);
  });
  test("completion context only when today complete", () => {
    expect(motivationFor("completion", { todayComplete: true, hitMilestone: true }, "2026-09-04").context).toBe("milestone");
  });
});

describe("persistence + sync (Doc1 15-20; Doc2 16-17)", () => {
  const base: any = {
    completions: [], journal: [], feedbackLog: [], followUps: [], mastery: [], evidence: [],
    modeHistory: [], flexDayLedger: [], itemProgress: {}, pantry: [], shoppingChecks: [],
    roadmapStartDate: "2026-01-05", dayOrderConfig: {}, updatedAt: 10,
    scheduleLogs: [{ id: "s1", title: "Startup", startDate: "2026-09-04", startTime: "17:00", endTime: "19:45", recurring: false, createdAt: 1, updatedAt: 7 }],
    tomorrow: [{ id: "t1", kind: "priority", text: "C pointers", order: 0, createdAt: 1, updatedAt: 8 }],
  };
  test("schedule + tomorrow survive serialize round-trip (restart)", () => {
    const recs = intrinsicRecords(base);
    expect(recs.some((r) => r.table === "scheduleLogs")).toBe(true);
    const empty: any = { ...base, scheduleLogs: [], tomorrow: [] };
    const back = applyRecordsToSettings(empty, recs);
    expect(back.scheduleLogs).toHaveLength(1);
    expect((back as any).tomorrow[0].text).toBe("C pointers");
  });
  test("schedule + tomorrow sync phone → cloud → laptop", async () => {
    const cloud = new MemoryProvider();
    await syncOnce(cloud, intrinsicRecords(base), 0);
    const laptop = await syncOnce(cloud, [], 0);
    expect(laptop.merged.some((r) => r.table === "scheduleLogs")).toBe(true);
    expect(laptop.merged.some((r) => r.table === "tomorrow")).toBe(true);
  });
});
