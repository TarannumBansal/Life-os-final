/** Problem 21 — Pantry & Shopping regression tests (the 10 required proofs).
 *  Everything derives from existing Nourish data; no ingredients are invented. */
import { buildCatalogue, parseIngredient, nameKey, classify, lowStock, expiringSoon, depleteForRecipe, PantryItem } from "@/src/engine/pantry";
import { computeShopping, requiredWeekly, requiredMonthly, shoppingSchedule } from "@/src/engine/shopping";
import { mergeRecords } from "@/src/sync/merge";
import { intrinsicRecords, applyRecordsToSettings } from "@/src/sync/serialize";
import { MemoryProvider } from "@/src/sync/provider.memory";
import { syncOnce } from "@/src/sync/queue";
import nourish from "@/src/data/nourish.json";

const N: any = nourish;
const inv = (over: Partial<PantryItem> & { key: string }): PantryItem => ({ currentQty: 0, updatedAt: 1, ...over });

describe("parsing derives only from Nourish strings", () => {
  test("leading, trailing, fraction, and no-quantity forms", () => {
    expect(parseIngredient("200g paneer, crumbled")).toEqual({ name: "paneer", qty: 200, unit: "g" });
    expect(parseIngredient("Paneer 500g")).toEqual({ name: "Paneer", qty: 500, unit: "g" });
    expect(parseIngredient("Lemons 10")).toEqual({ name: "Lemons", qty: 10, unit: "each" });
    expect(parseIngredient("1/2 cup rice")).toEqual({ name: "rice", qty: 0.5, unit: "cup" });
    expect(nameKey("Onions")).toBe("onion");
    expect(nameKey("Tomatoes")).toBe("tomato");
  });
});

describe("Test 6/7 — shopping quantities come from the meal plan; nothing invented", () => {
  test("every shopping line traces to a Nourish catalogue key", () => {
    const cat = new Set(buildCatalogue().map((c) => c.key));
    const list = computeShopping([]);
    for (const line of [...list.next, ...list.weekly, ...list.monthly]) {
      expect(cat.has(line.key)).toBe(true); // Test 7: no ingredient outside Nourish
    }
    // Test 6: weekly requirement keys mirror grocery_weekly
    const weeklyKeys = requiredWeekly().map((r) => r.key);
    expect(weeklyKeys).toContain("paneer");
    expect(weeklyKeys).toContain("onion");
  });
});

describe("Test 1 — existing pantry stock reduces shopping requirements", () => {
  test("stocking paneer to its pack size drops it from the list", () => {
    const withNone = computeShopping([]);
    const paneerNone = [...withNone.next, ...withNone.weekly].find((l) => l.key === "paneer");
    expect(paneerNone).toBeTruthy();
    // 500g required; stock 600g (> required + buffer) → not needed
    const stocked = computeShopping([inv({ key: "paneer", currentQty: 600 })], { bufferRatio: 0 });
    expect([...stocked.next, ...stocked.weekly].find((l) => l.key === "paneer")).toBeUndefined();
    // partial stock reduces the needed quantity
    const partial = computeShopping([inv({ key: "paneer", currentQty: 200 })], { bufferRatio: 0 });
    const line = [...partial.next, ...partial.weekly].find((l) => l.key === "paneer")!;
    expect(line.neededQty).toBe(300); // 500 - 200
  });
});

describe("Test 2 — weekly perishables and monthly staples are separated", () => {
  test("perishables route to next/weekly; always-on staples route to monthly", () => {
    const list = computeShopping([]);
    expect(list.next.every((l) => l.category === "perishable")).toBe(true);
    expect(list.monthly.every((l) => l.category === "staple")).toBe(true);
    // paneer (perishable) is in next; a pantry_always_on staple is in monthly
    expect(list.next.some((l) => l.key === "paneer")).toBe(true);
    expect(requiredMonthly().length).toBe((N.pantry_always_on ?? []).length);
  });
});

describe("Test 3 — recipe execution depletes the relevant pantry quantity", () => {
  test("cooking paneer-bhurji subtracts 200g paneer", () => {
    const start = [inv({ key: "paneer", currentQty: 500, unit: "g" }), inv({ key: "onion", currentQty: 3, unit: "each" })];
    const { inventory, applied } = depleteForRecipe(start, "paneer-bhurji");
    expect(inventory.find((i) => i.key === "paneer")!.currentQty).toBe(300);
    expect(inventory.find((i) => i.key === "onion")!.currentQty).toBe(2);
    expect(applied.find((a) => a.key === "paneer")!.delta).toBe(200); // manual-correction data present
  });
  test("never goes negative", () => {
    const { inventory } = depleteForRecipe([inv({ key: "paneer", currentQty: 50 })], "paneer-bhurji");
    expect(inventory.find((i) => i.key === "paneer")!.currentQty).toBe(0);
  });
});

describe("Test 4 — low-stock ingredients are surfaced", () => {
  test("items at/below their threshold appear", () => {
    const items = [inv({ key: "oats", currentQty: 100, lowStockThreshold: 150 }), inv({ key: "rice", currentQty: 900, lowStockThreshold: 200 })];
    const low = lowStock(items).map((i) => i.key);
    expect(low).toContain("oats");
    expect(low).not.toContain("rice");
  });
});

describe("Test 5 — expiring ingredients are surfaced", () => {
  test("items expiring within the window appear", () => {
    const today = "2026-02-01";
    const items = [inv({ key: "curd", currentQty: 1, expiryDate: "2026-02-02" }), inv({ key: "paneer", currentQty: 1, expiryDate: "2026-02-20" })];
    const soon = expiringSoon(items, today, 3).map((i) => i.key);
    expect(soon).toContain("curd");
    expect(soon).not.toContain("paneer");
  });
});

describe("Test 8 — shopping data persists (serialize round-trip)", () => {
  test("pantry + shopping checks survive settings ⇄ records", () => {
    const base: any = {
      completions: [], journal: [], feedbackLog: [], followUps: [], mastery: [], evidence: [],
      modeHistory: [], flexDayLedger: [], itemProgress: {}, roadmapStartDate: "2026-01-05",
      dayOrderConfig: {}, updatedAt: 10,
      pantry: [{ key: "paneer", currentQty: 500, updatedAt: 5 }],
      shoppingChecks: [{ key: "onion", run: "weekly", date: "2026-02-01", done: true, updatedAt: 6 }],
    };
    const recs = intrinsicRecords(base);
    expect(recs.some((r) => r.table === "pantry" && r.id === "paneer")).toBe(true);
    const empty: any = { ...base, pantry: [], shoppingChecks: [] };
    const rebuilt = applyRecordsToSettings(empty, recs);
    expect(rebuilt.pantry).toHaveLength(1);
    expect((rebuilt as any).shoppingChecks[0].done).toBe(true);
  });
});

describe("Test 9/10 — shopping state syncs across devices and works offline", () => {
  test("a shopping check made on one device reaches the cloud, then another device", async () => {
    const cloud = new MemoryProvider();
    const phone = intrinsicRecords({ pantry: [], shoppingChecks: [{ key: "paneer", run: "next", date: "2026-02-01", done: true, updatedAt: 100 }], completions: [], journal: [], feedbackLog: [], followUps: [], mastery: [], evidence: [], modeHistory: [], flexDayLedger: [] } as any);
    await syncOnce(cloud, phone, 0);
    const laptop = await syncOnce(cloud, [], 0);
    expect(laptop.merged.some((r) => r.table === "shoppingChecks")).toBe(true);
  });
  test("offline keeps the shopping list available (compute is local + pure)", () => {
    // No provider/network involved — computeShopping runs entirely on local data.
    const list = computeShopping([inv({ key: "paneer", currentQty: 100 })]);
    expect(list.totalItems).toBeGreaterThan(0);
    expect(list.estMinutes).toBeGreaterThan(0);
  });
});

describe("schedule agreement (Today/Calendar/Health single source)", () => {
  test("weekly run is Sunday; monthly run is the first Sunday", () => {
    expect(shoppingSchedule("2026-02-01").weeklyDue).toBe(true);  // Sun
    expect(shoppingSchedule("2026-02-01").monthlyDue).toBe(true); // 1st Sunday
    expect(shoppingSchedule("2026-02-08").monthlyDue).toBe(false);
    expect(shoppingSchedule("2026-02-03").weeklyDue).toBe(false); // Tue
  });
});
