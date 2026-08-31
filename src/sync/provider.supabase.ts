/**
 * Supabase adapter — the ONLY provider-specific file. Implements SyncProvider against a
 * single private table `lifeos_records` protected by Row-Level Security (each row owned by
 * auth.uid()). Uses only the public anon key + the signed-in user's session. No secrets here.
 *
 * Requires: npm i @supabase/supabase-js @react-native-async-storage/async-storage
 * Schema + RLS: see supabase/schema.sql. Env: EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SyncProvider, SyncRecord } from "./types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

const TABLE = "lifeos_records";

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: AsyncStorage as any, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

/** Single-user auth: sign in (or up) with email+password once per device. */
export async function ensureSignedIn(email: string, password: string): Promise<string | null> {
  const sb = supabase();
  let { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const up = await sb.auth.signUp({ email, password });
    if (up.error) throw up.error;
    data = up.data as any;
  }
  return data.user?.id ?? null;
}

export class SupabaseProvider implements SyncProvider {
  async userId(): Promise<string | null> {
    const { data } = await supabase().auth.getUser();
    return data.user?.id ?? null;
  }

  async pull(since: number): Promise<SyncRecord[]> {
    const uid = await this.userId();
    if (!uid) throw new Error("not-authenticated");
    const { data, error } = await supabase()
      .from(TABLE)
      .select("table_name,id,updated_at,deleted_at,payload")
      .gt("updated_at", since);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      table: row.table_name, id: row.id, updatedAt: Number(row.updated_at),
      deletedAt: row.deleted_at ? Number(row.deleted_at) : null, payload: row.payload,
    }));
  }

  async push(records: SyncRecord[]): Promise<void> {
    const uid = await this.userId();
    if (!uid) throw new Error("not-authenticated");
    const rows = records.map((r) => ({
      user_id: uid, table_name: r.table, id: r.id,
      updated_at: r.updatedAt, deleted_at: r.deletedAt ?? null, payload: r.payload,
    }));
    const { error } = await supabase().from(TABLE).upsert(rows, { onConflict: "user_id,table_name,id" });
    if (error) throw error;
  }
}
