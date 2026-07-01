import { SupabaseClient } from '@supabase/supabase-js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_WEIGHT = 3;
const OLDER_WEIGHT = 1;
const KEPT_POINTS_PER_WEIGHT = 1.5;
const REFINED_PENALTY_PER_WEIGHT = 0.5;
const MIN_SCORE = 20;
const MAX_SCORE = 95;

export interface VoiceMatchFactors {
  hasVoiceSamples: boolean;
  voiceSampleCount: number;
  baseline: number;
  postsKept: number;
  postsKeptRecent: number;
  postsKeptOlder: number;
  refinementsUsed: number;
  refinementsUsedRecent: number;
}

export interface VoiceMatchResult {
  score: number;
  factors: VoiceMatchFactors;
}

export async function calculateVoiceMatchScore(
  supabase: SupabaseClient,
  userId: string
): Promise<VoiceMatchResult> {
  const [personaRes, signalsRes] = await Promise.all([
    supabase
      .from('persona_profiles')
      .select('voice_samples')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('persona_signals')
      .select('action, created_at')
      .eq('user_id', userId)
      .in('action', ['kept', 'refined'])
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const voiceSamples: string[] = personaRes.data?.voice_samples || [];
  const hasVoiceSamples = voiceSamples.length > 0;
  const baseline = hasVoiceSamples ? 60 : 45;

  const signals = signalsRes.data || [];
  const now = Date.now();

  const isRecent = (createdAt: string) => now - new Date(createdAt).getTime() <= THIRTY_DAYS_MS;

  const keptSignals = signals.filter((s) => s.action === 'kept');
  const refinedSignals = signals.filter((s) => s.action === 'refined');

  const postsKeptRecent = keptSignals.filter((s) => isRecent(s.created_at)).length;
  const postsKeptOlder = keptSignals.length - postsKeptRecent;
  const refinementsUsedRecent = refinedSignals.filter((s) => isRecent(s.created_at)).length;

  const keptContribution =
    postsKeptRecent * RECENT_WEIGHT * KEPT_POINTS_PER_WEIGHT +
    postsKeptOlder * OLDER_WEIGHT * KEPT_POINTS_PER_WEIGHT;

  const refinedOlder = refinedSignals.length - refinementsUsedRecent;
  const refinementPenalty =
    refinementsUsedRecent * RECENT_WEIGHT * REFINED_PENALTY_PER_WEIGHT +
    refinedOlder * OLDER_WEIGHT * REFINED_PENALTY_PER_WEIGHT;

  const rawScore = baseline + keptContribution - refinementPenalty;
  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(rawScore)));

  return {
    score,
    factors: {
      hasVoiceSamples,
      voiceSampleCount: voiceSamples.length,
      baseline,
      postsKept: keptSignals.length,
      postsKeptRecent,
      postsKeptOlder,
      refinementsUsed: refinedSignals.length,
      refinementsUsedRecent,
    },
  };
}
