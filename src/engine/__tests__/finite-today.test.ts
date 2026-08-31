/** V1.2 — the finite-Today fix + reset. These are the real usability proofs. */
import { freezeDayTasks, todayProgress, resolveTodayTasks, FrozenTask } from "@/src/engine/freeze";
import { resetExecution } from "@/src/store/repositories";

const task = (id: string, wk: string) => ({ id, weekItemId: wk, domain: "tech", title: id, durationMin: 30 });
const plan = (taskIds: string[]): any => ({
  blocks: [{ id: "b-deep-0", type: "deep_work", label: "Deep Work", durationMin: 90, tasks: taskIds.map((t) => task(t, "w1:" + t)) },
           { id: "b-breakfast", type: "meal", label: "Breakfast", durationMin: 20, tasks: [{ id: "m1", weekItemId: "", domain: "health", title: "Breakfast", durationMin: 20 }] }],
  weekNumber: 1, weekTotal: 56, weekDone: 0,
});

describe("finite Today (Doc16 §2,4; acceptance)", () => {
  test("meals/classes (empty weekItemId) are NOT counted as tasks", () => {
    const frozen = freezeDayTasks(plan(["a", "b", "c"]));
    expect(frozen).toHaveLength(3); // breakfast excluded
    expect(frozen.every((t) => t.weekItemId !== "")).toBe(true);
  });

  test("completing today's tasks NEVER grows the total (8/8 stays 8/8, not 9/9)", () => {
    const assignments: Record<string, FrozenTask[]> = {};
    const date = "2026-09-04";
    // First open freezes 8 tasks.
    const first = resolveTodayTasks(assignments, date, () => plan(["1","2","3","4","5","6","7","8"]));
    assignments[date] = first.toPersist!;
    expect(first.tasks).toHaveLength(8);
    // Later, itemProgress would make buildDayPlan return DIFFERENT tasks — but we read the frozen set.
    const second = resolveTodayTasks(assignments, date, () => plan(["9","10","11"]));
    expect(second.toPersist).toBeNull();       // already frozen
    expect(second.tasks).toHaveLength(8);       // still the original 8 — never 9/9
    expect(second.tasks.map((t) => t.id)).toEqual(["1","2","3","4","5","6","7","8"]);
  });

  test("today counter reflects today's tasks and undo restores it", () => {
    const frozen = freezeDayTasks(plan(["1","2","3","4","5","6","7","8"]));
    const date = "2026-09-04";
    const done7 = frozen.slice(0, 7).map((t) => ({ date, blockId: t.blockId, taskId: t.id }));
    expect(todayProgress(frozen, done7, date)).toMatchObject({ done: 7, total: 8, complete: false });
    const done8 = [...done7, { date, blockId: frozen[7].blockId, taskId: frozen[7].id }];
    expect(todayProgress(frozen, done8, date)).toMatchObject({ done: 8, total: 8, complete: true });
    // undo task 4 → back to 7/8
    const undone = done8.filter((c) => c.taskId !== frozen[3].id);
    expect(todayProgress(frozen, undone, date)).toMatchObject({ done: 7, total: 8, complete: false });
  });
});

describe("reset execution (Doc16 §1)", () => {
  const dirty: any = {
    completions: [{ date: "x", blockId: "b", taskId: "t", completedAt: 1 }],
    itemProgress: { "w1:dsa": 5 }, dayAssignments: { "2026-09-04": [task("1","w1:1")] },
    todaysMode: { x: "flex" }, modeHistory: [{}], flexDayLedger: [{}],
    mastery: [{ id: "m" }], evidence: [{ id: "e" }], feedbackLog: [{ id: "f" }], followUps: [{ id: "fu" }],
    scheduleLogs: [{ id: "s1" }], tomorrow: [{ id: "t1" }], pantry: [{ key: "paneer" }], shoppingChecks: [{ key: "x" }],
    roadmapStartDate: "2026-01-05", dayOrderConfig: { anchorDate: "2026-01-05" },
  };
  test("clears execution + recalculates; preserves schedule/tomorrow/pantry/curriculum by default", () => {
    const r = resetExecution(dirty);
    expect(r.completions).toHaveLength(0);
    expect(r.itemProgress).toEqual({});
    expect(r.dayAssignments).toEqual({});
    expect(r.mastery).toHaveLength(0);
    expect(r.evidence).toHaveLength(0);
    // preserved unless explicitly cleared
    expect(r.scheduleLogs).toHaveLength(1);
    expect(r.tomorrow).toHaveLength(1);
    expect(r.pantry).toHaveLength(1);
    expect(r.roadmapStartDate).toBe("2026-01-05");     // curriculum anchor intact
    expect(r.dayOrderConfig.anchorDate).toBe("2026-01-05");
  });
  test("explicit options clear schedule/tomorrow/pantry too", () => {
    const r = resetExecution(dirty, { clearSchedule: true, clearTomorrow: true, clearPantry: true });
    expect(r.scheduleLogs).toHaveLength(0);
    expect(r.tomorrow).toHaveLength(0);
    expect(r.pantry).toHaveLength(0);
  });
});
