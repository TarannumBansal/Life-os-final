/**
 * Shared store core (V1.3) — ONE authoritative in-memory copy of a value, with subscribers.
 * Pure and framework-agnostic (no React, no React Native imports) so it is fully unit-testable.
 * settings.ts binds this to React via useSyncExternalStore; sync commits remote merges here.
 *
 * Fixes the "14 independent useState copies" root cause: every consumer subscribes to the SAME
 * store, updates compose against the LATEST value (no stale overwrite), and sync commits update
 * the live store (so the open UI reflects remote changes immediately).
 */
export interface Store<T> {
  getSnapshot(): T | null;
  subscribe(cb: () => void): () => void;
  /** Atomic: the mutator always receives the CURRENT store value, never a stale caller copy. */
  update(mut: (s: T) => T): Promise<void>;
  /** Replace the whole value (used by sync when remote changes arrive). Persists + notifies. */
  commit(next: T, opts?: { persist?: boolean }): void;
  /** Async initial load (persistence + backfill). Runs once. */
  ensureLoaded(): Promise<void>;
  /** test helper */
  _reset(v?: T | null): void;
}

export interface StoreOptions<T> {
  load: () => Promise<T>;         // read persistence, backfill/migrate
  persist: (v: T) => void;        // write persistence (fire-and-forget ok)
  stamp?: (v: T) => T;            // e.g. bump updatedAt on each update
}

export function createStore<T>(opts: StoreOptions<T>): Store<T> {
  let state: T | null = null;
  let loaded = false;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const stamp = opts.stamp ?? ((v) => v);

  async function ensureLoaded(): Promise<void> {
    if (loaded) return;
    if (!loading) {
      loading = (async () => {
        state = await opts.load();
        loaded = true;
        notify();
      })();
    }
    return loading;
  }

  return {
    getSnapshot: () => state,
    subscribe(cb) {
      listeners.add(cb);
      void ensureLoaded(); // first subscriber triggers the one-time load
      return () => { listeners.delete(cb); };
    },
    async update(mut) {
      if (state == null) await ensureLoaded();
      if (state == null) return;
      state = stamp(mut(state));   // composes on the LATEST state → atomic vs stale copies
      opts.persist(state);
      notify();
    },
    commit(next, o) {
      state = next;
      loaded = true;
      if (o?.persist !== false) opts.persist(state);
      notify();
    },
    ensureLoaded,
    _reset(v = null) { state = v; loaded = v != null; loading = null; },
  };
}
