/**
 * Characterization tests — dayOrder (rotating college Day-Order engine).
 *
 * Locks the current rotation, holiday/exam shift, weekend handling, class times,
 * and free-window computation. Uses fixed calendar dates with a fixed anchor so
 * results are deterministic. Day derivation is built from local Y/M/D, so these
 * assertions are timezone-stable.
 */
import { deriveDay, deriveDayOrder, totalFreeMinutes } from "@/src/engine/dayOrder";

// Anchor: Monday 2026-01-05 is Day Order 1.
const cfg = { anchorDate: "2026-01-05", anchorDayOrder: 1 as const, holidays: [], examDates: [] };

describe("dayOrder · rotation", () => {
  test("advances 1→5 across the college week", () => {
    expect(deriveDayOrder("2026-01-05", cfg)).toBe(1); // Mon
    expect(deriveDayOrder("2026-01-06", cfg)).toBe(2); // Tue
    expect(deriveDayOrder("2026-01-07", cfg)).toBe(3); // Wed
    expect(deriveDayOrder("2026-01-08", cfg)).toBe(4); // Thu
    expect(deriveDayOrder("2026-01-09", cfg)).toBe(5); // Fri
  });

  test("weekends do not advance the sequence and return null", () => {
    expect(deriveDayOrder("2026-01-10", cfg)).toBeNull(); // Sat
    expect(deriveDayOrder("2026-01-11", cfg)).toBeNull(); // Sun
    // The following Monday continues the rotation (weekend didn't consume an order).
    expect(deriveDayOrder("2026-01-12", cfg)).toBe(1);
  });
});

describe("dayOrder · holidays and exams shift, never skip", () => {
  test("a holiday on Tuesday shifts Wednesday back to Day Order 2", () => {
    const cfgH = { ...cfg, holidays: ["2026-01-06"] };
    // Tue is a holiday (no order); Wed picks up the order Tue would have had.
    expect(deriveDayOrder("2026-01-06", cfgH)).toBeNull();
    expect(deriveDayOrder("2026-01-07", cfgH)).toBe(2);
  });

  test("an exam day also does not advance the sequence", () => {
    const cfgE = { ...cfg, examDates: ["2026-01-06"] };
    expect(deriveDayOrder("2026-01-07", cfgE)).toBe(2);
  });
});

describe("dayOrder · day derivation, class times, free windows", () => {
  test("a college Monday exposes the correct class time and free minutes", () => {
    const d = deriveDay("2026-01-05", cfg);
    expect(d.kind).toBe("college");
    expect(d.dayOrder).toBe(1);
    expect(d.classes).toEqual([{ start: "08:00", end: "14:15" }]);
    // 07:00→22:30 minus one 08:00–14:15 class block = 555 free minutes.
    expect(totalFreeMinutes(d)).toBe(555);
  });

  test("Saturday is a STEP day with fixed hours", () => {
    const d = deriveDay("2026-01-10", cfg);
    expect(d.kind).toBe("sat_step");
    expect(d.classes).toEqual([{ start: "08:00", end: "12:00" }]);
  });

  test("Sunday is off (no Day Order, no classes)", () => {
    const d = deriveDay("2026-01-11", cfg);
    expect(d.kind).toBe("sunday");
    expect(d.dayOrder).toBeNull();
    expect(d.classes).toEqual([]);
  });

  test("a marked holiday and exam classify correctly", () => {
    const cfg2 = { ...cfg, holidays: ["2026-01-08"], examDates: ["2026-01-09"] };
    expect(deriveDay("2026-01-08", cfg2).kind).toBe("holiday");
    expect(deriveDay("2026-01-09", cfg2).kind).toBe("exam");
  });

  test("Day Order 5 has two class blocks", () => {
    const d = deriveDay("2026-01-09", cfg); // Fri = DO5
    expect(d.dayOrder).toBe(5);
    expect(d.classes.length).toBe(2);
  });
});
