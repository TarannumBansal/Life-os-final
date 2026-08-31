/**
 * Shopping system (V1) — computed from existing Nourish requirements minus current pantry
 * stock plus a buffer. Invents no ingredients (everything traces to grocery_weekly /
 * pantry_always_on / recipes). Provides the schedule the Calendar/Today/Health agree on,
 * WITHOUT ever entering the academic task queue.
 *
 *   needed = required_by_upcoming_meal_plan − current_pantry_stock + buffer
 */
import nourish from "@/src/data/nourish.json";
import { parseIngredient, nameKey, classify, PantryItem, FoodCategory, ShoppingRun } from "./pantry";

const N: any = nourish;

export interface ShoppingLine {
  key: string; name: string; neededQty: number; unit: string;
  category: FoodCategory; run: ShoppingRun; shop: string; estCost: number | null;
}
export interface ShoppingList {
  next: ShoppingLine[];        // perishables needed in the next 2–3 days
  weekly: ShoppingLine[];      // this week's grocery run
  monthly: ShoppingLine[];     // monthly staples run
  byShop: Record<string, ShoppingLine[]>;
  estTotalCost: number | null; // sum of known unit prices (null if none provided)
  estMinutes: number;          // derived from item count
  totalItems: number;
}

/** Required quantities from the existing Nourish weekly list. */
export function requiredWeekly(): { key: string; name: string; qty: number; unit: string; category: FoodCategory }[] {
  return (N.grocery_weekly ?? []).map((g: string) => {
    const p = parseIngredient(g);
    return { key: nameKey(p.name), name: p.name, qty: p.qty, unit: p.unit, category: classify(p.name) };
  });
}
/** Monthly staples from the existing always-on pantry list. */
export function requiredMonthly(): { key: string; name: string; qty: number; unit: string; category: FoodCategory }[] {
  return (N.pantry_always_on ?? []).map((s: string) => {
    const p = parseIngredient(s);
    return { key: nameKey(p.name), name: p.name, qty: p.qty, unit: p.unit, category: "staple" as FoodCategory };
  });
}

function stockFor(inv: PantryItem[], key: string): PantryItem | undefined { return inv.find((i) => i.key === key); }

export interface ShoppingOpts { bufferRatio?: number; shopFallback?: string }

/** needed = required − stock + buffer, split into next/weekly/monthly runs and grouped by shop. */
export function computeShopping(inventory: PantryItem[], opts: ShoppingOpts = {}): ShoppingList {
  const buffer = opts.bufferRatio ?? 0.2;
  const shopFallback = opts.shopFallback ?? "Grocery";
  const lines: ShoppingLine[] = [];

  const build = (req: { key: string; name: string; qty: number; unit: string; category: FoodCategory }, run: ShoppingRun) => {
    const stk = stockFor(inventory, req.key);
    const have = stk?.currentQty ?? 0;
    const needed = req.qty - have + req.qty * buffer;
    if (needed <= 0) return; // already have enough (stock reduces requirement — Test 1)
    const qty = Math.ceil(needed * 100) / 100;
    const shop = stk?.usualShop ?? shopFallback;
    const estCost = stk?.unitPrice != null ? Math.round(stk.unitPrice * Math.ceil(qty / (req.qty || 1)) * 100) / 100 : null;
    lines.push({ key: req.key, name: req.name, neededQty: qty, unit: req.unit, category: req.category, run, shop, estCost });
  };

  for (const req of requiredWeekly()) build(req, req.category === "perishable" ? "next" : "weekly");
  for (const req of requiredMonthly()) build(req, "monthly");

  const next = lines.filter((l) => l.run === "next");
  const weekly = lines.filter((l) => l.run === "weekly");
  const monthly = lines.filter((l) => l.run === "monthly");

  const byShop: Record<string, ShoppingLine[]> = {};
  for (const l of lines) (byShop[l.shop] ??= []).push(l);

  const known = lines.filter((l) => l.estCost != null);
  const estTotalCost = known.length ? Math.round(known.reduce((a, l) => a + (l.estCost ?? 0), 0) * 100) / 100 : null;
  const estMinutes = Math.round(6 + lines.length * 1.5);

  return { next, weekly, monthly, byShop, estTotalCost, estMinutes, totalItems: lines.length };
}

export interface ShoppingSchedule { weeklyRunDay: string; weeklyDue: boolean; monthlyDue: boolean }

/** Single source of truth Today / Calendar / Health all read, so they agree on the block. */
export function shoppingSchedule(dateISO: string): ShoppingSchedule {
  const d = new Date(dateISO);
  const dow = d.getDay();                 // 0 = Sunday (Nourish prep day)
  const isSunday = dow === 0;
  const isFirstSunday = isSunday && d.getDate() <= 7;
  return { weeklyRunDay: "Sunday", weeklyDue: isSunday, monthlyDue: isFirstSunday };
}

/** A tickable shopping-list checkmark (user state; synced). */
export interface ShoppingCheck { key: string; run: ShoppingRun; date: string; done: boolean; updatedAt: number }
export const shoppingCheckId = (c: Pick<ShoppingCheck, "run" | "date" | "key">) => `${c.run}|${c.date}|${c.key}`;
