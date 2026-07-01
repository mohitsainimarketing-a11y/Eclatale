import { SupabaseClient } from '@supabase/supabase-js';

export interface ProfileCompleteness {
  score: number;
  present: string[];
  missing: string[];
}

// Genuinely calculated: each element contributes equally to a 0-100 score.
export function computeProfileCompleteness(inputs: {
  hasPhoto: boolean;
  hasBio: boolean;
  hasRole: boolean;
  hasIndustry: boolean;
  hasGoals: boolean;
  hasVoiceSamples: boolean;
  linkedinConnected: boolean;
}): ProfileCompleteness {
  const checks: { key: string; ok: boolean }[] = [
    { key: 'Profile photo', ok: inputs.hasPhoto },
    { key: 'Bio', ok: inputs.hasBio },
    { key: 'Role', ok: inputs.hasRole },
    { key: 'Industry', ok: inputs.hasIndustry },
    { key: 'Growth goals', ok: inputs.hasGoals },
    { key: 'Voice samples', ok: inputs.hasVoiceSamples },
    { key: 'LinkedIn connected', ok: inputs.linkedinConnected },
  ];
  const present = checks.filter(c => c.ok).map(c => c.key);
  const missing = checks.filter(c => !c.ok).map(c => c.key);
  const score = Math.round((present.length / checks.length) * 100);
  return { score, present, missing };
}

export interface GrowthData {
  role: string;
  industry: string;
  goals: string[];
  totalPosts: number;
  postsThisWeek: number;
  postsPrev3Weeks: number;
  streak: number;
  toneDistribution: Record<string, number>;
  dominantTonePct: number;
  linkedinConnected: boolean;
  profileCompleteness: ProfileCompleteness;
}

export async function gatherGrowthData(supabase: SupabaseClient, userId: string): Promise<GrowthData> {
  const [profileRes, postsRes, personaRes, signalsRes, linkedinRes] = await Promise.all([
    supabase.from('profiles').select('role, domain, goals, bio, profile_photo_url').eq('id', userId).single(),
    supabase.from('posts').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('persona_profiles').select('voice_samples').eq('user_id', userId).maybeSingle(),
    supabase.from('persona_signals').select('tone').eq('user_id', userId).eq('action', 'kept').limit(200),
    supabase.from('linkedin_connections').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);

  const profile = profileRes.data || {};
  const role = (profile as any).role || 'professional';
  const industry = (profile as any).domain || 'business';
  const goals: string[] = (profile as any).goals || [];

  const dates = (postsRes.data || []).map((p: any) => new Date(p.created_at).getTime());
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const postsThisWeek = dates.filter(t => t >= now - week).length;
  const postsPrev3Weeks = dates.filter(t => t < now - week && t >= now - 4 * week).length;

  const daySet = new Set((postsRes.data || []).map((p: any) => new Date(p.created_at).toISOString().split('T')[0]));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    if (daySet.has(d.toISOString().split('T')[0])) streak++;
    else if (i > 0) break;
  }

  const tones = (signalsRes.data || []).map((s: any) => s.tone).filter(Boolean);
  const toneDistribution: Record<string, number> = {};
  for (const t of tones) toneDistribution[t] = (toneDistribution[t] || 0) + 1;
  const dominantCount = Object.values(toneDistribution).sort((a, b) => b - a)[0] || 0;
  const dominantTonePct = tones.length ? Math.round((dominantCount / tones.length) * 100) : 0;

  const voiceSamples: string[] = (personaRes.data as any)?.voice_samples || [];
  const linkedinConnected = !!linkedinRes.data;

  const profileCompleteness = computeProfileCompleteness({
    hasPhoto: !!(profile as any).profile_photo_url,
    hasBio: !!(profile as any).bio,
    hasRole: !!(profile as any).role,
    hasIndustry: !!(profile as any).domain,
    hasGoals: goals.length > 0,
    hasVoiceSamples: voiceSamples.length > 0,
    linkedinConnected,
  });

  return {
    role, industry, goals,
    totalPosts: dates.length,
    postsThisWeek, postsPrev3Weeks, streak,
    toneDistribution, dominantTonePct,
    linkedinConnected,
    profileCompleteness,
  };
}

export function buildGrowthScorePrompt(d: GrowthData): string {
  const goalsText = d.goals.length ? d.goals.join(', ') : 'not specified';
  const toneText = Object.entries(d.toneDistribution).map(([t, n]) => `${t}: ${n}`).join(', ') || 'no kept-post tone data yet';
  return `You are assessing the LinkedIn brand-building health of a specific person, as an expert brand strategist. Base everything ONLY on their real data below. Be honest and specific, not flattering.

Person: ${d.role} in ${d.industry}. Growth goals: ${goalsText}.

Real activity data:
- Total posts created: ${d.totalPosts}
- Posts this week: ${d.postsThisWeek}
- Posts in the prior 3 weeks: ${d.postsPrev3Weeks}
- Current posting streak: ${d.streak} days
- Tone distribution across kept posts: ${toneText}
- Dominant tone share: ${d.dominantTonePct}%
- Profile completeness (calculated): ${d.profileCompleteness.score}/100 (present: ${d.profileCompleteness.present.join(', ') || 'none'}; missing: ${d.profileCompleteness.missing.join(', ') || 'none'})
- LinkedIn connected: ${d.linkedinConnected ? 'yes' : 'no'}

Assess two things and return JSON:
{
  "contentConsistency": { "score": 0-100 based on posting frequency AND tone consistency, "reasoning": "one specific sentence" },
  "overallReasoning": "2 to 3 sentences: state the overall health, cite their real numbers, and name their single biggest opportunity tied to their actual goal of ${goalsText}"
}

No em dashes, en dashes, or arrows. Return ONLY valid JSON.`;
}
