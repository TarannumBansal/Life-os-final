/** Sync is OPT-IN via env. If unconfigured, sync is a no-op and LifeOS runs exactly as
 *  before — fully local, offline, no regression. Only PUBLIC client keys are used here. */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export function isSyncConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
