/** Doc 28 acceptance — daily plan freeze + real-life schedule logs form ONE timeline that
 *  recomputes AROUND the frozen set (never expands it) and shows every block's time. */
import { freezeDayTasks, FrozenTask } from "@/src/engine/freeze";
import { scheduleBlocksForDate, ScheduleLog } from "@/src/engine/schedule";
import { buildTimeline, FixedBlock, FlexTask } from "@/src/engine/timeline";

const task = (id: string) => ({ id, weekItemId: "w1:" + id, domain: "tech", title: id, durationMin: 45 });
const plan = (ids: string[]): any => ({ blocks: [{ id: "b-deep-0", type: "deep_work", label: "Deep Work", durationMin: 90, tasks: ids.map(task) }] });
const frozenToFlex = (f: FrozenTask[]): FlexTask[] => f.map((t) => ({ id: t.id, label: t.title, durationMin: t.durationMin }));

const log = (o: Partial<ScheduleLog> & { title: string }): ScheduleLog => ({
  id: o.id ?? "L1", title: o.title, startDate: o.startDate ?? "2026-09-04", endDate: o.endDate,
  startTime: o.startTime ?? "17:00", endTime: o.endTime ?? "19:45", recurring: o.recurring ?? false, createdAt: 1, updatedAt: 1,
});

describe("doc28 — one timeline, frozen tasks, logs modify time not inventory", () => {
  const frozen = freezeDayTasks(plan(["1", "2", "3", "4", "5", "6", "7", "8"]));
  const flex = frozenToFlex(frozen);

  test("frozen set is the day's inventory (8 tasks)", () => {
    expect(frozen).toHaveLength(8);
  });

  test("adding a college log inserts a fixed block WITH a time; task inventory never grows", () => {
    const before = buildTimeline({ dateISO: "2026-09-04", fixed: [], tasks: flex });
    const logs = [log({ title: "College classes", startTime: "17:00", endTime: "19:45" })];
    const fixed: FixedBlock[] = scheduleBlocksForDate(logs, "2026-09-04").map((b) => ({ start: b.start, end: b.end, label: b.title, kind: "fixed" }));
    const after = buildTimeline({ dateISO: "2026-09-04", fixed, tasks: flex });

    // the log appears chronologically with a readable time
    const logItem = after.items.find((i) => i.label === "College classes")!;
    expect(logItem.start).toBe("17:00"); expect(logItem.end).toBe("19:45"); expect(logItem.fixed).toBe(true);

    // task items placed + deferred never exceed the frozen count → no new tasks invented
    const placedIds = after.items.filter((i) => i.kind === "deep").map((i) => i.taskId);
    const allTaskIds = new Set([...placedIds, ...after.deferred.map((d) => d.id)]);
    expect([...allTaskIds].every((id) => flex.some((f) => f.id === id))).toBe(true);
    expect(after.items.filter((i) => i.kind === "deep").length).toBeLessThanOrEqual(8);

    // adding the block should push some work out (defer), not create filler
    expect(after.deferred.length).toBeGreaterThanOrEqual(before.deferred.length);
  });

  test("every timeline item shows a start–end time", () => {
    const after = buildTimeline({ dateISO: "2026-09-04", fixed: [{ start: "17:00", end: "19:45", label: "College", kind: "fixed" }], tasks: flex });
    for (const it of after.items) { expect(it.start).toMatch(/^\d\d:\d\d$/); expect(it.end).toMatch(/^\d\d:\d\d$/); }
  });

  test("completing tasks doesn't change the timeline's task inventory (frozen)", () => {
    // Whether 0 or all completed, the SAME frozen list drives the timeline.
    const none = buildTimeline({ dateISO: "2026-09-04", fixed: [], tasks: flex, completedTaskIds: [] });
    const all = buildTimeline({ dateISO: "2026-09-04", fixed: [], tasks: flex, completedTaskIds: flex.map((f) => f.id) });
    const deepCount = (t: any) => t.items.filter((i: any) => i.kind === "deep").length + t.deferred.length;
    expect(deepCount(none)).toBe(deepCount(all)); // inventory identical regardless of completion
    expect(all.todayComplete).toBe(true);
  });

  test("recurring/date-range log appears on all applicable dates only", () => {
    const logs = [log({ title: "Startup research", startDate: "2026-09-03", endDate: "2026-09-12", recurring: true, startTime: "15:00", endTime: "17:00" })];
    expect(scheduleBlocksForDate(logs, "2026-09-05")).toHaveLength(1);
    expect(scheduleBlocksForDate(logs, "2026-09-13")).toHaveLength(0);
  });
});
