/** Calm sync-status state machine (pure). Never alarming; offline is a normal state. */
import { SyncStatus } from "./types";
export type SyncEvent = "start" | "success" | "offline" | "queued" | "fail";
export function nextStatus(prev: SyncStatus, ev: SyncEvent, hasPending: boolean): SyncStatus {
  switch (ev) {
    case "start": return "syncing";
    case "success": return hasPending ? "pending" : "synced";
    case "offline": return "offline";
    case "queued": return prev === "syncing" ? "syncing" : "pending";
    case "fail": return "error";
    default: return prev;
  }
}
export function statusLabel(s: SyncStatus): string {
  switch (s) {
    case "syncing": return "Syncing…";
    case "synced": return "Synced";
    case "offline": return "Offline · saved locally";
    case "pending": return "Sync pending";
    case "error": return "Sync paused · will retry";
    default: return "Synced";
  }
}
