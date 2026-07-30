import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { canAccess, Tier } from '../lib/featureGates';

let cachedTier: Tier | null = null;
let cachedUserId: string | null = null;

async function fetchTier(): Promise<Tier> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return 'free';
  if (cachedTier && cachedUserId === userId) return cachedTier;

  const { data: profile } = await supabase.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle();
  const tier = ((profile as any)?.subscription_tier || 'free') as Tier;
  cachedTier = tier;
  cachedUserId = userId;
  return tier;
}

export function useFeatureGate(feature: string) {
  const [tier, setTier] = useState<Tier>(cachedTier || 'free');
  const [loading, setLoading] = useState(!cachedTier);

  useEffect(() => {
    let mounted = true;
    fetchTier().then(t => { if (mounted) { setTier(t); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const hasAccess = canAccess(tier, feature as any);

  return {
    hasAccess,
    tier,
    loading,
    showUpgrade: !loading && !hasAccess,
  };
}
