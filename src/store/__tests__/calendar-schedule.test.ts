/** V1.3 pass 2 — Calendar schedule editing + one-source-of-truth + cross-view coherence.
 *  Uses the real shared-store core + real repositories + real schedule engine (all pure). */
import { createStore } from "@/src/store/store-core";
import { addScheduleLog, updateScheduleLog, removeScheduleLog } from "@/src/store/repositories";
import { scheduleBlocksForDate } from "@/src/engine/schedule";

const initial: any = {
  scheduleLogs: [], dayAssignments: { "2026-09-04": [{ id: "t1", weekItemId: "w1:1", domain: "tech", title: "DSA", durationMin: 30, blockId: "b-deep-0", blockType: "deep_work", blockLabel: "Deep Work" }] },
  completions: [], itemProgress: {}, updatedAt: 0,
};
function makeStore() {
  let persisted: any = null;
  const store = createStore<any>({ load: async () => JSON.parse(JSON.stringify(initial)), persist: (v) => { persisted = JSON.parse(JSON.stringify(v)); }, stamp: (v) => ({ ...v, updatedAt: (v.updatedAt ?? 0) + 1 }) });
  return { store, getPersisted: () => persisted };
}

describe("Calendar schedule editing (create / edit / delete)", () => {
  test("create → appears on its date via the shared schedule source", async () => {
    const { store } = makeStore(); await store.ensureLoaded();
    await store.update((s) => addScheduleLog(s, { title: "Startup work", startDate: "2026-09-04", startTime: "17:00", endTime: "19:00", recurring: false }));
    const blocks = scheduleBlocksForDate(store.getSnapshot()!.scheduleLogs, "2026-09-04");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe("Startup work");
    expect(blocks[0].start).toBe("17:00");
  });

  test("edit → time updates on that date", async () => {
    const { store } = makeStore(); await store.ensureLoaded();
    await store.update((s) => addScheduleLog(s, { title: "Startup", startDate: "2026-09-04", startTime: "17:00", endTime: "19:00", recurring: false }));
    const id = store.getSnapshot()!.scheduleLogs[0].id;
    await store.update((s) => updateScheduleLog(s, id, { endTime: "19:45" }));
    expect(scheduleBlocksForDate(store.getSnapshot()!.scheduleLogs, "2026-09-04")[0].end).toBe("19:45");
  });

  test("delete → removed everywhere", async () => {
    const { store } = makeStore(); await store.ensureLoaded();
    await store.update((s) => addScheduleLog(s, { title: "X", startDate: "2026-09-04", startTime: "10:00", endTime: "11:00", recurring: false }));
    const id = store.getSnapshot()!.scheduleLogs[0].id;
    await store.update((s) => removeScheduleLog(s, id));
    expect(scheduleBlocksForDate(store.getSnapshot()!.scheduleLogs, "2026-09-04")).toHaveLength(0);
  });
});

describe("one source of truth + cross-view without remount", () => {
  test("a Calendar edit is seen by a Today subscriber immediately (same store, both notified)", async () => {
    const { store } = makeStore(); await store.ensureLoaded();
    // Two subscribers simulate the Calendar screen and the Today screen mounted at once.
    let calendarSaw = 0, todaySaw = 0;
    store.subscribe(() => { calendarSaw++; });
    store.subscribe(() => { todaySaw++; });
    // "Calendar" adds a commitment:
    await store.update((s) => addScheduleLog(s, { title: "IDEA", startDate: "2026-09-04", startTime: "17:00", endTime: "19:45", recurring: false }));
    // Both screens were notified of the SAME change and read the SAME data:
    expect(calendarSaw).toBe(1); expect(todaySaw).toBe(1);
    const fromToday = scheduleBlocksForDate(store.getSnapshot()!.scheduleLogs, "2026-09-04");
    const fromCalendar = scheduleBlocksForDate(store.getSnapshot()!.scheduleLogs, "2026-09-04");
    expect(fromToday).toEqual(fromCalendar);
    expect(fromToday[0].title).toBe("IDEA");
  });

  test("adding a schedule log does NOT change today's frozen task inventory", async () => {
    const { store } = makeStore(); await store.ensureLoaded();
    const before = store.getSnapshot()!.dayAssignments["2026-09-04"].length;
    await store.update((s) => addScheduleLog(s, { title: "Gym", startDate: "2026-09-04", startTime: "19:00", endTime: "20:00", recurring: false }));
    const after = store.getSnapshot()!.dayAssignments["2026-09-04"].length;
    expect(after).toBe(before); // freeze intact — a commitment is not a task
  });

  test("schedule change persists (store wrote it through)", async () => {
    const { store, getPersisted } = makeStore(); await store.ensureLoaded();
    await store.update((s) => addScheduleLog(s, { title: "Persisted", startDate: "2026-09-04", startTime: "9:00", endTime: "10:00", recurring: false }));
    expect(getPersisted().scheduleLogs).toHaveLength(1);
  });
});
