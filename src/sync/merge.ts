/**
 * Record-level Last-Write-Wins merge with tombstones. PURE + deterministic.
 * This is the heart of cross-device sync and is fully unit-tested. It never uploads
 * the whole database — callers merge individual records.
 */
import { SyncRecord, recKey } from "./types";

/** Winner between two versions of the same record: newer updatedAt wins (tombstone included). */
function newer(a: SyncRecord, b: SyncRecord): SyncRecord {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  // Tie-break deterministically: a tombstone wins a tie (delete is safer to keep), else keep `a`.
  if (a.deletedAt && !b.deletedAt) return a;
  if (b.deletedAt && !a.deletedAt) return b;
  return a;
}

export interface MergeResult {
  merged: SyncRecord[];   // the reconciled set (apply locally)
  toPush: SyncRecord[];   // records the server must receive (local newer / server missing)
}

/**
 * Merge local + remote record sets.
 * - merged: final reconciled records (both devices' distinct records survive; same-record
 *   conflicts resolved by newest updatedAt).
 * - toPush: records where the local copy is authoritative (server missing it, or local newer).
 */
export function mergeRecords(local: SyncRecord[], remote: SyncRecord[]): MergeResult {
  const localMap = new Map(local.map((r) => [recKey(r), r]));
  const remoteMap = new Map(remote.map((r) => [recKey(r), r]));
  const keys = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);

  const merged: SyncRecord[] = [];
  const toPush: SyncRecord[] = [];

  for (const k of keys) {
    const l = localMap.get(k);
    const r = remoteMap.get(k);
    if (l && r) {
      const win = newer(l, r);
      merged.push(win);
      // If local won (and differs from remote), server needs the update.
      if (win === l && (l.updatedAt !== r.updatedAt || !!l.deletedAt !== !!r.deletedAt)) toPush.push(l);
    } else if (l && !r) {
      merged.push(l);
      toPush.push(l);            // server has never seen this local record
    } else if (r && !l) {
      merged.push(r);            // remote-only record — adopt locally, nothing to push
    }
  }
  return { merged, toPush };
}

/** Records that are not tombstoned (for applying live state). */
export function liveRecords(records: SyncRecord[]): SyncRecord[] {
  return records.filter((r) => !r.deletedAt);
}
