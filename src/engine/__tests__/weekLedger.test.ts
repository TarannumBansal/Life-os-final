/**
 * Characterization tests — weekLedger (Week→Day decomposition + sequencing).
 *
 * These lock the CURRENT observable behaviour of the decomposition engine so that
 * future refactors (SQLite, priority wiring, etc.) cannot silently change what the
 * roadmap decomposes into. They assert stable contracts (counts, ids, fields,
 * cadences, gating), not incidental prose.
 */
import {
  buildWeekItems,
  weekTotal,
  weekDone,
  isFoundationalOnly,
  getWeekTheme,
  getWeekObjectives,
} from "@/src/engine/weekLedger";

describe("weekLedger · week decomposition", () => {
  test("Week 1 decomposes into the current item set (count + ids + fields)", () => {
    const items = buildWeekItems(1);
    expect(items.length).toBe(30);

    // Every item id is namespaced to its week and unique.
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("w1:"))).toBe(true);

    // Six tech.topics items are generated (one per sub-topic).
    expect(items.filter((i) => i.field === "tech.topics").length).toBe(6);

    // Core roadmap fields are present as items in Week 1.
    const fields = new Set(items.map((i) => i.field));
    for (const f of [
      "tech.topics", "tech.project", "microProject", "flagshipProgress",
      "dsa", "techWriting", "engineeringJudgement", "projectLifecycle",
      "interviewPrep", "openSource", "revision", "skills",
    ]) {
      expect(fields.has(f)).toBe(true);
    }
  });

  test("week totals and completion math", () => {
    const items = buildWeekItems(1);
    // Sum of targetContributions across all Week-1 items.
    expect(weekTotal(items)).toBe(56);

    // weekDone counts logged contributions, capped at each item's target.
    const dsa = items.find((i) => i.field === "dsa")!;
    expect(weekDone(items, {})).toBe(0);
    expect(weekDone(items, { [dsa.id]: 3 })).toBe(3);
    // Over-logging is capped at the item target (dsa target = 6).
    expect(weekDone(items, { [dsa.id]: 99 })).toBe(dsa.targetContributions);
  });

  test("item shape is stable for the DSA item", () => {
    const dsa = buildWeekItems(1).find((i) => i.field === "dsa")!;
    expect(dsa.cadence).toBe("daily");
    expect(dsa.targetContributions).toBe(6);
    expect(dsa.domain).toBe("tech");
    expect(dsa.order).toBe(15);
  });

  test("a later week (16) decomposes differently and includes competitive", () => {
    const items = buildWeekItems(16);
    expect(items.length).toBe(24);
    expect(items.some((i) => i.field === "competitive")).toBe(true);
  });

  test("out-of-range weeks are clamped, not crashed", () => {
    expect(buildWeekItems(0).length).toBeGreaterThan(0); // clamped to week 1
    expect(buildWeekItems(99).length).toBeGreaterThan(0); // clamped to week 32
  });
});

describe("weekLedger · sequencing (never invent curriculum)", () => {
  test("Week 1 DSA is a foundation drill, not a problem-solving habit", () => {
    const dsa = buildWeekItems(1).find((i) => i.field === "dsa")!;
    expect(dsa.title).toBe("DSA · foundation drill");
    expect(dsa.perDayMin).toBe(20); // foundational duration, not the 30-min problem duration
  });

  test("Week 1 competitive practice is gated out entirely", () => {
    // PGOS Week 1 competitive text says "Warm-up, zero pressure" → not yet active.
    expect(buildWeekItems(1).some((i) => i.field === "competitive")).toBe(false);
  });

  test("isFoundationalOnly recognises PGOS 'not yet' language", () => {
    expect(isFoundationalOnly("No DSA problems yet — building the language first")).toBe(true);
    expect(isFoundationalOnly("Warm-up, zero pressure: HackerRank basics")).toBe(true);
    expect(isFoundationalOnly("something zero pressure here")).toBe(true);
    expect(isFoundationalOnly("Solve 2 medium sliding-window problems")).toBe(false);
  });
});

describe("weekLedger · week metadata accessors", () => {
  test("theme and objectives read from the current PGOS week", () => {
    expect(getWeekTheme(1)).toBe("System Bootup — C Foundations & the Machine");
    expect(getWeekObjectives(1)[0]).toMatch(/^Establish your entire PGOS infrastructure/);
    expect(Array.isArray(getWeekObjectives(1))).toBe(true);
  });
});
