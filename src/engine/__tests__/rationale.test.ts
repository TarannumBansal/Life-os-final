/**
 * Characterization tests — rationale (the five-part "Why this plan?").
 *
 * Locks that every task rationale answers the five required prompts and that the
 * key habit-protection invariants (DSA ordering + never-miss-twice) are preserved.
 */
import { buildWeekItems } from "@/src/engine/weekLedger";
import { rationaleFor } from "@/src/engine/rationale";

const baseCtx = {
  mode: "full" as const,
  isSunday: false, isExam: false, isSatStep: false, isCollegeHeavy: false, isFlex: false,
  freeMinutes: 300, progress: {}, weekNumber: 1,
};

describe("rationale · structure", () => {
  test("returns all five decision fields for any item", () => {
    const items = buildWeekItems(1);
    const item = items[0];
    const r = rationaleFor(item, { ...baseCtx, itemsToday: items, currentIdx: 0 });
    expect(Object.keys(r).sort()).toEqual(
      ["ifSkipped", "whichObjective", "whyThisDuration", "whyThisOrder", "whyToday"].sort(),
    );
    for (const v of Object.values(r)) {
      expect(typeof v).toBe("string");
      expect((v as string).length).toBeGreaterThan(0);
    }
  });
});

describe("rationale · DSA habit-protection invariants", () => {
  const items = buildWeekItems(1);
  const dsa = items.find((i) => i.field === "dsa")!;
  const r = rationaleFor(dsa, { ...baseCtx, itemsToday: items, currentIdx: 0 });

  test("DSA is explicitly placed early for habit protection", () => {
    expect(r.whyThisOrder).toBe("DSA is placed early — habit protection: NEVER MISS TWICE.");
  });

  test("skipping DSA once is framed as recoverable, never twice", () => {
    expect(r.ifSkipped).toBe("Missing today is OK — missing twice breaks the habit. Never miss twice.");
  });

  test("why-today explains the daily contribution against the week target", () => {
    expect(r.whyToday).toMatch(/daily contribution/);
    expect(r.whyToday).toMatch(/6 passes/); // dsa target = 6, none logged yet
  });

  test("which-objective links back to the week's objective/theme", () => {
    expect(r.whichObjective).toMatch(/^Establish your entire PGOS infrastructure/);
  });
});

describe("rationale · mode-sensitive duration", () => {
  const items = buildWeekItems(1);
  const dsa = items.find((i) => i.field === "dsa")!;

  test("exam mode changes the duration explanation", () => {
    const r = rationaleFor(dsa, { ...baseCtx, isExam: true, itemsToday: items, currentIdx: 0 });
    expect(r.whyThisDuration).toMatch(/Exam Mode/);
  });

  test("full mode uses the plain duration explanation", () => {
    const r = rationaleFor(dsa, { ...baseCtx, itemsToday: items, currentIdx: 0 });
    expect(r.whyThisDuration).toMatch(/Full day/);
  });
});
