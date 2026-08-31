/**
 * Sync orchestration (offline-first). `syncOnce` pulls remote changes, merges at the
 * record level (LWW + tombstones), and pushes local-authoritative records. It NEVER
 * uploads the whole database and NEVER blocks the UI — callers run it in the background
 * and apply `merged` locally. Injectable provider makes offline + concurrency testable.
 */
import { SyncProvider, SyncRecord } from "./types";
import { mergeRecords } from "./merge";

export interface SyncOutcome {
  merged: SyncRecord[];   // apply these to local settings
  pushed: SyncRecord[];   // records sent to the server this round
  newCursor: number;      // max updatedAt observed — persist for next pull
  offline: boolean;       // true if the network was unavailable (local data untouched)
}

/**
 * One sync round. `localSnapshot` is the full set of current local records.
 * On network failure returns { offline: true } WITHOUT losing any local data.
 */
export async function syncOnce(
  provider: SyncProvider,
  localSnapshot: SyncRecord[],
  cursor = 0,
): Promise<SyncOutcome> {
  let remote: SyncRecord[];
  try {
    remote = await provider.pull(cursor);
  } catch {
    return { merged: localSnapshot, pushed: [], newCursor: cursor, offline: true };
  }
  const { merged, toPush } = mergeRecords(localSnapshot, remote);
  if (toPush.length) {
    try {
      await provider.push(toPush);
    } catch {
      // Push failed after a successful pull — keep local merge, retry push next round.
      return { merged, pushed: [], newCursor: cursor, offline: true };
    }
  }
  const stamps = [cursor, ...remote.map((r) => r.updatedAt), ...toPush.map((r) => r.updatedAt)];
  return { merged, pushed: toPush, newCursor: Math.max(...stamps, 0), offline: false };
}
