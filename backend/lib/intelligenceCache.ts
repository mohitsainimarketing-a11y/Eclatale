import { SupabaseClient } from '@supabase/supabase-js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Best-effort read of a cached intelligence payload. Returns null on miss,
 * stale entry, or if the cache table does not exist yet (graceful degradation).
 */
export async function readCache(
  supabase: SupabaseClient,
  userId: string,
  kind: string,
  maxAgeMs: number = DAY_MS
): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('intelligence_cache')
      .select('data, generated_at')
      .eq('user_id', userId)
      .eq('kind', kind)
      .maybeSingle();
    if (error || !data) return null;
    const age = Date.now() - new Date(data.generated_at).getTime();
    if (age > maxAgeMs) return null;
    return { ...data.data, generatedAt: data.generated_at, cached: true };
  } catch {
    return null;
  }
}

/** Best-effort write. Silently no-ops if the cache table is missing. */
export async function writeCache(
  supabase: SupabaseClient,
  userId: string,
  kind: string,
  payload: any
): Promise<void> {
  try {
    await supabase
      .from('intelligence_cache')
      .upsert({ user_id: userId, kind, data: payload, generated_at: new Date().toISOString() });
  } catch {
    /* table may not exist yet; ignore */
  }
}
