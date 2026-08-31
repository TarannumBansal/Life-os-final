/** In-memory SyncProvider — simulates the cloud for tests. Not used in production. */
import { SyncProvider, SyncRecord, recKey } from "./types";
export class MemoryProvider implements SyncProvider {
  private store = new Map<string, SyncRecord>();
  private online = true;
  constructor(seed: SyncRecord[] = []) { for (const r of seed) this.store.set(recKey(r), r); }
  setOnline(v: boolean) { this.online = v; }
  async pull(since: number): Promise<SyncRecord[]> {
    if (!this.online) throw new Error("offline");
    return [...this.store.values()].filter((r) => r.updatedAt > since);
  }
  async push(records: SyncRecord[]): Promise<void> {
    if (!this.online) throw new Error("offline");
    for (const r of records) {
      const k = recKey(r); const cur = this.store.get(k);
      if (!cur || r.updatedAt >= cur.updatedAt) this.store.set(k, r); // upsert newest
    }
  }
  all(): SyncRecord[] { return [...this.store.values()]; }
}
