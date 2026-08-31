/**
 * Sync core types (V1 cross-device). Provider-agnostic: the engine and repositories
 * never import a specific backend — only these interfaces. A Supabase adapter (or any
 * other) implements SyncProvider.
 */
export interface SyncRecord {
  table: string;             // logical entity, e.g. "completions", "journal"
  id: string;                // stable id, unique within table
  updatedAt: number;         // ms epoch — the LWW clock
  deletedAt?: number | null; // tombstone (soft delete) — newer tombstone wins like any update
  payload: any;              // the record body
}

export const recKey = (r: Pick<SyncRecord, "table" | "id">) => `${r.table}:${r.id}`;

export type SyncStatus =
  | "idle"          // nothing to do
  | "syncing"       // in flight
  | "synced"        // up to date
  | "offline"       // no connectivity — changes saved locally
  | "pending"       // queued changes waiting to flush
  | "error";        // last attempt failed — will retry (data safe locally)

export interface SyncProvider {
  /** Records changed on the server since `since` (0 = everything). */
  pull(since: number): Promise<SyncRecord[]>;
  /** Upsert local records to the server (idempotent by table+id). */
  push(records: SyncRecord[]): Promise<void>;
  /** Optional: current authenticated identity (single user). */
  userId?(): Promise<string | null>;
}

/** Minimal async KV the queue persists to (satisfied by the app's storage singleton). */
export interface KV {
  getItem<T>(key: string, fallback: T): Promise<T | null>;
  setItem(key: string, value: any): Promise<boolean>;
}
