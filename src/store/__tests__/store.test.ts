/** V1.3 — shared-store failure-mode tests (the exact bugs from the diagnostic). */
import { createStore } from "@/src/store/store-core";

type S = { items: string[]; note?: string; updatedAt: number };
function makeStore(initial: S) {
  const persisted: { value: S | null } = { value: null };
  const store = createStore<S>({
    load: async () => initial,
    persist: (v) => { persisted.value = JSON.parse(JSON.stringify(v)); },
    stamp: (v) => ({ ...v, updatedAt: (v.updatedAt ?? 0) + 1 }),
  });
  return { store, persisted };
}

describe("shared store — one source of truth", () => {
  test("multiple consumers subscribed to the SAME store all see one update", async () => {
    const { store } = makeStore({ items: [], updatedAt: 0 });
    await store.ensureLoaded();
    let aSeen = 0, bSeen = 0;
    store.subscribe(() => { aSeen++; });
    store.subscribe(() => { bSeen++; });
    await store.update((s) => ({ ...s, items: [...s.items, "x"] }));
    // both consumers were notified of the same change, and read the same snapshot
    expect(aSeen).toBe(1); expect(bSeen).toBe(1);
    expect(store.getSnapshot()!.items).toEqual(["x"]);
  });

  test("two updates from different consumers do NOT overwrite each other (atomic compose)", async () => {
    const { store } = makeStore({ items: [], updatedAt: 0 });
    await store.ensureLoaded();
    // Consumer A captured a stale snapshot BEFORE B's change...
    const staleA = store.getSnapshot()!;
    await store.update((s) => ({ ...s, items: [...s.items, "B"] })); // B commits first
    // A now updates using the mutator form — it must receive the LATEST state, not its stale copy
    await store.update((s) => ({ ...s, items: [...s.items, "A"] }));
    expect(store.getSnapshot()!.items.sort()).toEqual(["A", "B"]); // both survive
    expect(staleA.items).toEqual([]); // proving A's captured copy was stale
  });

  test("remote sync commit updates the live store + notifies open consumers", async () => {
    const { store, persisted } = makeStore({ items: ["local"], updatedAt: 1 });
    await store.ensureLoaded();
    let seen = 0;
    store.subscribe(() => { seen++; });
    // Simulate a remote merge arriving from the other device:
    store.commit({ items: ["local", "fromPhone"], updatedAt: 5 });
    expect(seen).toBe(1);                                   // open UI is notified immediately
    expect(store.getSnapshot()!.items).toContain("fromPhone");
    expect(persisted.value!.items).toContain("fromPhone");  // and persisted
  });

  test("persistence survives a reload (new store instance loads persisted value)", async () => {
    const persisted: { value: S | null } = { value: { items: ["kept"], updatedAt: 3 } };
    const store = createStore<S>({ load: async () => persisted.value!, persist: (v) => { persisted.value = v; } });
    await store.ensureLoaded();
    expect(store.getSnapshot()!.items).toEqual(["kept"]);   // reload restores prior state
  });

  test("update is a no-op-safe before load and composes after", async () => {
    const { store } = makeStore({ items: [], updatedAt: 0 });
    await store.update((s) => ({ ...s, items: [...s.items, "y"] })); // triggers load then applies
    expect(store.getSnapshot()!.items).toEqual(["y"]);
  });
});
