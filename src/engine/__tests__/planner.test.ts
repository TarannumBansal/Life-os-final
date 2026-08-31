/**
 * Characterization tests — planner (buildDayPlan).
 *
 * Locks the current day-plan shape, block composition, mode behaviour (full / flex /
 * exam), Nourish integration, and next-best-action selection. Assertions avoid the
 * timezone-sensitive internals (Nourish-day index / topic rotation depend on a
 * UTC-parsed date inside the planner); they instead lock structural contracts that
 * hold regardless of the runner's timezone.
 */
import { deriveDay } from "@/src/engine/dayOrder";
import { buildDayPlan } from "@/src/engine/planner";

const cfg = { anchorDate: "2026-01-05", anchorDayOrder: 1 as const, holidays: [], examDates: [] };
const monday = deriveDay("2026-01-05", cfg); // college, Day Order 1, one class block

describe("planner · day-plan shape", () => {
  const plan = buildDayPlan("2026-01-05", 1, monday, "full", {});

  test("returns the full DayPlan contract", () => {
    expect(Object.keys(plan)).toEqual([
      "date", "weekNumber", "weekTheme", "phase", "mode", "nourishDay",
      "totalFreeMinutes", "blocks", "weekItems", "weekTotal", "weekDone",
      "nextBestAction", "flags",
    ]);
    expect(plan.weekNumber).toBe(1);
    expect(plan.phase).toBe(1); // ceil(1/8)
    expect(plan.weekTheme).toBe("System Bootup — C Foundations & the Machine");
    expect(plan.weekTotal).toBe(56);
    // Nourish day is an integer within the 14-day cycle.
    expect(Number.isInteger(plan.nourishDay)).toBe(true);
    expect(plan.nourishDay).toBeGreaterThanOrEqual(1);
    expect(plan.nourishDay).toBeLessThanOrEqual(14);
  });

  test("a full college day contains the expected block skeleton", () => {
    const ids = plan.blocks.map((b) => b.id);
    expect(ids).toContain("b-morning");
    expect(ids).toContain("b-breakfast");
    expect(ids.some((id) => id.startsWith("b-class-"))).toBe(true);
    expect(ids.some((id) => id.startsWith("b-deep-"))).toBe(true);
    expect(ids).toContain("b-lunch");
    expect(ids).toContain("b-workout");
    expect(ids).toContain("b-dinner");
    expect(ids).toContain("b-reflect");
    // Not Sunday → no weekly-review block.
    expect(ids).not.toContain("b-weekly");
  });

  test("roadmap tasks carry their weekItemId; fixed tasks (meals/class) do not", () => {
    const deep = plan.blocks.find((b) => b.type === "deep_work")!;
    expect(deep.tasks.length).toBeGreaterThan(0);
    expect(deep.tasks.every((t) => t.weekItemId.startsWith("w1:"))).toBe(true);

    const breakfast = plan.blocks.find((b) => b.id === "b-breakfast")!;
    expect(breakfast.tasks[0].weekItemId).toBe("");
    expect(breakfast.tasks[0].domain).toBe("health");
  });

  test("next best action is the protected DSA habit on a full day", () => {
    expect(plan.nextBestAction).toEqual({
      itemId: "w1:dsa",
      title: "DSA · foundation drill",
      reason: "DSA is protected — habit continuity beats intensity.",
    });
  });

  test("flags reflect a plain college day", () => {
    expect(plan.flags).toEqual({
      isSunday: false, isHoliday: false, isExam: false, isSatStep: false, isFlex: false,
    });
  });
});

describe("planner · mode behaviour", () => {
  test("flex mode schedules no deep work and no next-best-action", () => {
    const flex = buildDayPlan("2026-01-05", 1, monday, "flex", {});
    expect(flex.flags.isFlex).toBe(true);
    expect(flex.blocks.some((b) => b.type === "deep_work")).toBe(false);
    expect(flex.nextBestAction).toBeNull();
  });

  test("exam mode drops the workout block", () => {
    const exam = buildDayPlan("2026-01-05", 1, monday, "exam", {});
    expect(exam.flags.isExam).toBe(true);
    expect(exam.blocks.some((b) => b.id === "b-workout")).toBe(false);
  });

  test("completing an item is reflected by weekDone via itemProgress", () => {
    const withProgress = buildDayPlan("2026-01-05", 1, monday, "full", { "w1:dsa": 2 });
    expect(withProgress.weekDone).toBe(2);
    expect(withProgress.weekTotal).toBe(56);
  });
});
