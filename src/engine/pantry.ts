/**
 * Pantry & inventory (V1) — DERIVED ENTIRELY from existing Nourish data (grocery_weekly,
 * pantry_always_on, recipe ingredients). Invents no ingredients and never mutates the
 * Nourish curriculum. The catalogue (names/units/pack sizes/category) comes from Nourish;
 * per-item inventory state (stock, expiry, thresholds, shop…) is user-owned and synced.
 */
import nourish from "@/src/data/nourish.json";

export type FoodCategory = "perishable" | "staple";
export type ShoppingRun = "next" | "weekly" | "monthly";

export interface CatalogueItem {
  key: string;            // normalized match key (e.g. "onion")
  name: string;           // display name from Nourish
  unit: string;           // g | kg | ml | l | cup | tsp | tbsp | each
  typicalPackQty: number; // pack size parsed from the Nourish grocery string
  category: FoodCategory;
  sources: string[];      // "weekly" | "monthly" | "recipe:<id>"
}

/** User-owned inventory state for a catalogue item (all fields optional except key). */
export interface PantryItem {
  key: string;
  currentQty: number;
  unit?: string;
  purchaseDate?: string;      // ISO
  expiryDate?: string;        // ISO (perishables)
  storageLocation?: string;
  lowStockThreshold?: number;
  usualShop?: string;
  unitPrice?: number;         // user-provided; used for estimated cost only
  updatedAt: number;
}

const N: any = nourish;

const STAPLE_HINTS = [
  "dal", "rice", "flour", "oats", "poha", "peanut", "almond", "date", "besan",
  "oil", "ghee", "salt", "turmeric", "cumin", "coriander", "chilli", "chili",
  "garam", "methi", "cinnamon", "jeera", "masala", "spice", "sugar", "tea",
];

/** Parse a Nourish quantity string → { name, qty, unit }. Handles leading and trailing
 *  quantities and fraction cups. Operates only on the given string (invents nothing). */
export function parseIngredient(raw: string): { name: string; qty: number; unit: string } {
  const s = raw.trim();
  const num = (t: string): number => (t.includes("/") ? (() => { const [a, b] = t.split("/").map(Number); return b ? a / b : a; })() : parseFloat(t));
  // leading: "200g paneer, crumbled" | "1 onion" | "1/2 cup rice"
  let m = s.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(kg|g|ml|l|cup|tsp|tbsp)?\s+(.+)$/i);
  if (m) {
    const name = m[3].split(",")[0].trim();
    return { name, qty: num(m[1]), unit: (m[2] || "each").toLowerCase() };
  }
  // trailing: "Paneer 500g" | "Lemons 10"
  m = s.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|ml|l)?$/i);
  if (m) return { name: m[1].trim(), qty: num(m[2]), unit: (m[3] || "each").toLowerCase() };
  // no quantity: "Ginger + garlic" | "Cinnamon, turmeric, cumin, jeera"
  return { name: s, qty: 1, unit: "each" };
}

/** Canonical match key: lowercase, first noun, naive singularize. */
export function nameKey(name: string): string {
  let k = name.toLowerCase().split(",")[0].trim().replace(/\s+/g, " ");
  k = k.replace(/\b(chopped|crumbled|soaked|roasted|powder)\b/g, "").trim();
  if (k.endsWith("es")) k = k.slice(0, -2);
  else if (k.endsWith("s") && !k.endsWith("ss")) k = k.slice(0, -1);
  return k;
}

export function classify(name: string): FoodCategory {
  const n = name.toLowerCase();
  const inStaples: string[] = (N.pantry_always_on ?? []).map((x: string) => x.toLowerCase());
  if (inStaples.some((x: string) => x.includes(n) || n.includes(x.split(" ")[0]))) return "staple";
  return STAPLE_HINTS.some((h) => n.includes(h)) ? "staple" : "perishable";
}

/** Build the ingredient catalogue from Nourish content only. */
export function buildCatalogue(): CatalogueItem[] {
  const map = new Map<string, CatalogueItem>();
  const add = (raw: string, source: string, forceCategory?: FoodCategory) => {
    const p = parseIngredient(raw);
    const key = nameKey(p.name);
    if (!key) return;
    const existing = map.get(key);
    if (existing) { if (!existing.sources.includes(source)) existing.sources.push(source); return; }
    map.set(key, { key, name: p.name, unit: p.unit, typicalPackQty: p.qty, category: forceCategory ?? classify(p.name), sources: [source] });
  };
  for (const g of N.grocery_weekly ?? []) add(g, "weekly");
  for (const s of N.pantry_always_on ?? []) add(s, "monthly", "staple");
  for (const r of N.recipes ?? []) for (const ing of r.ingredients ?? []) add(ing, `recipe:${r.id}`);
  return [...map.values()];
}

export function lowStock(inventory: PantryItem[]): PantryItem[] {
  return inventory.filter((i) => i.lowStockThreshold != null && i.currentQty <= i.lowStockThreshold);
}

export function expiringSoon(inventory: PantryItem[], todayISO: string, withinDays = 3): PantryItem[] {
  const t = new Date(todayISO).getTime();
  const lim = t + withinDays * 86400000;
  return inventory.filter((i) => i.expiryDate && new Date(i.expiryDate).getTime() <= lim && new Date(i.expiryDate).getTime() >= t - 86400000);
}

export interface Depletion { key: string; before: number; after: number; delta: number; unit: string }

/** Deplete pantry quantities for a recipe using existing Nourish recipe ingredient data.
 *  Unit-naive by design (real quantities are approximate) — returns the applied deltas so
 *  the UI can offer a manual correction path. */
export function depleteForRecipe(inventory: PantryItem[], recipeId: string): { inventory: PantryItem[]; applied: Depletion[] } {
  const recipe = (N.recipes ?? []).find((r: any) => r.id === recipeId);
  const applied: Depletion[] = [];
  if (!recipe) return { inventory, applied };
  const next = inventory.map((i) => ({ ...i }));
  for (const ing of recipe.ingredients ?? []) {
    const p = parseIngredient(ing);
    const key = nameKey(p.name);
    const item = next.find((i) => i.key === key);
    if (!item) continue;
    const before = item.currentQty;
    item.currentQty = Math.max(0, before - p.qty);
    item.updatedAt = Date.now();
    applied.push({ key, before, after: item.currentQty, delta: before - item.currentQty, unit: item.unit ?? p.unit });
  }
  return { inventory: next, applied };
}
