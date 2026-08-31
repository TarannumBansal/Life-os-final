/**
 * useSync — offline-first background sync driver. HARD no-op unless configured: when the
 * Supabase env vars are absent it does nothing and never imports the provider/NetInfo, so an
 * unconfigured build behaves EXACTLY like local-only V1 (zero regression).
 *
 * It reads the freshest local settings straight from storage (so it captures writes from any
 * screen), merges against the cloud, writes the reconciled result back, and never blocks the UI.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { AppState } from "react-native";
import { storage } from "@/src/utils/storage";
import { getSettings, commitSettings, ensureSettingsLoaded } from "@/src/store/settings";
import type { LifeOSSettings } from "@/src/store/settings";
import { isSyncConfigured } from "./config";
import { fullSnapshotRecords, applyRecordsToSettings } from "./serialize";
import { syncOnce } from "./queue";
import { nextStatus, statusLabel } from "./status";
import type { SyncStatus } from "./types";

const SETTINGS_KEY = "lifeos:settings:v2";
const CURSOR_KEY = "lifeos:sync:cursor";

export function useSync(intervalMs = 20000) {
  const [status, setStatus] = useState<SyncStatus>(isSyncConfigured() ? "idle" : "synced");
  const busy = useRef(false);

  const runSync = useCallback(async () => {
    if (!isSyncConfigured() || busy.current) return;
    busy.current = true;
    setStatus("syncing");
    try {
      // Dynamic import → an unconfigured build never bundles-loads these.
      const { SupabaseProvider } = await import("./provider.supabase");
      const provider = new SupabaseProvider();
      const uid = await provider.userId().catch(() => null);
      if (!uid) { setStatus("pending"); busy.current = false; return; } // not signed in yet

      await ensureSettingsLoaded();
      const settings = getSettings();
      if (!settings) { busy.current = false; setStatus("synced"); return; }
      const cursor = (await storage.getItem<number>(CURSOR_KEY, 0)) ?? 0;

      const local = fullSnapshotRecords(settings);
      const outcome = await syncOnce(provider, local, cursor);

      if (outcome.offline) { setStatus("offline"); busy.current = false; return; }

      // Commit reconciled remote changes INTO THE SHARED STORE → the open UI updates immediately
      // (and the store persists it). No remount required.
      const remoteOnly = outcome.merged.filter((r) => r.updatedAt > cursor);
      if (remoteOnly.length) {
        const merged = applyRecordsToSettings(getSettings() ?? settings, remoteOnly);
        commitSettings(merged);
      }
      await storage.setItem(CURSOR_KEY, outcome.newCursor);
      setStatus(nextStatus("syncing", "success", false));
    } catch {
      setStatus("error"); // local data is safe; will retry
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isSyncConfigured()) return;
    runSync();
    const timer = setInterval(runSync, intervalMs);
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") runSync(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [runSync, intervalMs]);

  return { status, label: statusLabel(status), syncNow: runSync, enabled: isSyncConfigured() };
}
