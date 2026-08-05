import { SupabaseClient } from '@supabase/supabase-js';
import { checkStreakMilestone, createNotification } from './notifications';

export type Stage = 'unknown' | 'emerging' | 'rising' | 'notable' | 'authority' | 'icon';

export const STAGE_ORDER: Stage[] = ['unknown', 'emerging', 'rising', 'notable', 'authority', 'icon'];

export const STAGE_LABELS: Record<Stage, string> = {
  unknown: 'Unknown',
  emerging: 'Emerging',
  rising: 'Rising',
  notable: 'Notable',
  authority: 'Authority',
  icon: 'Icon',
};

// Heuristic, real-data-driven thresholds — each stage requires everything the
// previous stage required, plus its own new criterion. Not an external
// benchmark; just a legible progression built from what we can actually measure.
interface StageCriterion { key: string; label: string; target: number | boolean; }

const STAGE_CRITERIA: Record<Exclude<Stage, 'unknown'>, StageCriterion[]> = {
  emerging: [
    { key: 'postsPublished', label: 'Publish your first post', target: 1 },
    { key: 'linkedinConnected', label: 'Connect LinkedIn', target: true },
  ],
  rising: [
    { key: 'postsPublished', label: 'Publish 5 posts', target: 5 },
  ],
  notable: [
    { key: 'postsPublished', label: 'Publish 15 posts', target: 15 },
    { key: 'personaComplete', label: 'Complete your voice profile', target: true },
  ],
  authority: [
    { key: 'postsPublished', label: 'Publish 30 posts', target: 30 },
    { key: 'longestStreak', label: 'Reach a 14-day posting streak', target: 14 },
  ],
  icon: [
    { key: 'postsPublished', label: 'Publish 60 posts', target: 60 },
    { key: 'longestStreak', label: 'Reach a 30-day posting streak', target: 30 },
  ],
};

export interface JourneyMetrics {
  postsPublished: number;
  linkedinConnected: boolean;
  personaComplete: boolean;
  longestStreak: number;
  currentStreak: number;
  postsThisWeek: number;
  bestWeek: number;
  daysActive: number;
}

async function gatherMetrics(supabase: SupabaseClient, userId: string): Promise<JourneyMetrics> {
  const [profileRes, publishedRes, personaRes, linkedinRes] = await Promise.all([
    supabase.from('profiles').select('created_at, longest_streak').eq('id', userId).single(),
    supabase.from('posts').select('published_at').eq('user_id', userId).eq('status', 'published').order('published_at', { ascending: true }),
    supabase.from('persona_profiles').select('persona_completed_at').eq('user_id', userId).maybeSingle(),
    supabase.from('linkedin_connections').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);

  const dates = (publishedRes.data || []).map((p: any) => new Date(p.published_at));
  const daySet = new Set(dates.map(d => d.toISOString().split('T')[0]));

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now - i * day).toISOString().split('T')[0];
    if (daySet.has(d)) currentStreak++;
    else if (i > 0) break;
  }

  // Longest-ever streak, computed from the full sorted set of distinct publish days.
  const sortedDays = Array.from(daySet).sort();
  let longestRun = 0, run = 0, prev: number | null = null;
  for (const dstr of sortedDays) {
    const t = new Date(dstr).getTime();
    if (prev !== null && t - prev === day) run++; else run = 1;
    longestRun = Math.max(longestRun, run);
    prev = t;
  }
  const storedLongest = (profileRes.data as any)?.longest_streak || 0;
  const longestStreak = Math.max(longestRun, storedLongest, currentStreak);

  const weekMs = 7 * day;
  const postsThisWeek = dates.filter(d => now - d.getTime() < weekMs).length;
  let bestWeek = 0;
  if (dates.length) {
    const buckets: Record<number, number> = {};
    for (const d of dates) {
      const weekIndex = Math.floor(d.getTime() / weekMs);
      buckets[weekIndex] = (buckets[weekIndex] || 0) + 1;
    }
    bestWeek = Math.max(...Object.values(buckets));
  }

  const createdAt = (profileRes.data as any)?.created_at ? new Date((profileRes.data as any).created_at).getTime() : now;
  const daysActive = Math.max(1, Math.ceil((now - createdAt) / day));

  return {
    postsPublished: dates.length,
    linkedinConnected: !!linkedinRes.data,
    personaComplete: !!(personaRes.data as any)?.persona_completed_at,
    longestStreak,
    currentStreak,
    postsThisWeek,
    bestWeek,
    daysActive,
  };
}

function meetsCriterion(metrics: JourneyMetrics, c: StageCriterion): boolean {
  const value = (metrics as any)[c.key];
  return typeof c.target === 'boolean' ? !!value === c.target : value >= c.target;
}

function stageFromMetrics(metrics: JourneyMetrics): Stage {
  let current: Stage = 'unknown';
  for (const stage of STAGE_ORDER.slice(1) as Exclude<Stage, 'unknown'>[]) {
    const criteria = STAGE_CRITERIA[stage];
    if (criteria.every(c => meetsCriterion(metrics, c))) current = stage;
    else break;
  }
  return current;
}

export async function calculateStage(supabase: SupabaseClient, userId: string): Promise<{ stage: Stage; metrics: JourneyMetrics }> {
  const metrics = await gatherMetrics(supabase, userId);
  const stage = stageFromMetrics(metrics);

  const { data: profile } = await supabase.from('profiles').select('growth_stage, growth_stage_unlocked_at, longest_streak, total_posts_published').eq('id', userId).single();
  const updates: Record<string, any> = {};
  if (profile && profile.growth_stage !== stage) {
    updates.growth_stage = stage;
    updates.growth_stage_unlocked_at = new Date().toISOString();
  }
  if ((profile?.longest_streak || 0) < metrics.longestStreak) updates.longest_streak = metrics.longestStreak;
  if ((profile?.total_posts_published || 0) !== metrics.postsPublished) updates.total_posts_published = metrics.postsPublished;
  if (Object.keys(updates).length) await supabase.from('profiles').update(updates).eq('id', userId);

  if (profile && updates.growth_stage && stage !== 'unknown') {
    await createNotification(
      supabase, userId, `growth_stage_${stage}`,
      `You've reached ${stage.charAt(0).toUpperCase() + stage.slice(1)}!`,
      `Your consistency is paying off — you've unlocked the ${stage} stage of your brand journey.`,
      { text: 'View my journey', url: 'https://eclatale.com/dashboard' }
    );
  }
  await checkStreakMilestone(supabase, userId, metrics.currentStreak);

  return { stage, metrics };
}

export interface ProgressCriterion { label: string; done: boolean; current: number; target: number; }

export async function getProgress(supabase: SupabaseClient, userId: string): Promise<{
  stage: Stage; nextStage: Stage | null; criteria: ProgressCriterion[]; metrics: JourneyMetrics;
}> {
  const { stage, metrics } = await calculateStage(supabase, userId);
  const nextIndex = STAGE_ORDER.indexOf(stage) + 1;
  const nextStage = nextIndex < STAGE_ORDER.length ? STAGE_ORDER[nextIndex] : null;
  if (!nextStage) return { stage, nextStage: null, criteria: [], metrics };

  const criteria = STAGE_CRITERIA[nextStage as Exclude<Stage, 'unknown'>].map(c => {
    const current = (metrics as any)[c.key];
    const target = typeof c.target === 'boolean' ? 1 : c.target;
    const currentNum = typeof c.target === 'boolean' ? (current ? 1 : 0) : current;
    return { label: c.label, done: meetsCriterion(metrics, c), current: currentNum, target };
  });

  return { stage, nextStage, criteria, metrics };
}

// ── Micro-milestones ────────────────────────────────────────────────────────

export interface Milestone { key: string; emoji: string; label: string; }

export const MICRO_MILESTONES: Milestone[] = [
  { key: 'first_post_published', emoji: '🔥', label: 'First post published' },
  { key: 'streak_7', emoji: '📅', label: '7-day posting streak' },
  { key: 'authenticity_75', emoji: '🎯', label: 'First post with 75+ authenticity score' },
  { key: 'linkedin_connected', emoji: '🔗', label: 'LinkedIn connected' },
  { key: 'voice_complete', emoji: '🎤', label: 'Voice profile complete' },
  { key: 'checked_analytics', emoji: '📊', label: 'First time checking analytics' },
  { key: 'first_repurpose', emoji: '🔄', label: 'First repurposed post' },
  { key: 'first_visual', emoji: '🖼', label: 'First visual created' },
  { key: 'profile_optimizer_complete', emoji: '💼', label: 'Profile optimizer complete' },
  { key: 'first_real_engagement', emoji: '📈', label: 'First post with real LinkedIn engagement data' },
];

async function evaluateMilestone(supabase: SupabaseClient, userId: string, key: string): Promise<boolean> {
  switch (key) {
    case 'first_post_published': {
      const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'published');
      return (count || 0) >= 1;
    }
    case 'streak_7': {
      const { metrics } = await calculateStage(supabase, userId);
      return metrics.longestStreak >= 7;
    }
    case 'authenticity_75': {
      const { count } = await supabase.from('post_analytics').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('readability_score', 75);
      return (count || 0) >= 1;
    }
    case 'linkedin_connected': {
      const { data } = await supabase.from('linkedin_connections').select('user_id').eq('user_id', userId).maybeSingle();
      return !!data;
    }
    case 'voice_complete': {
      const { data } = await supabase.from('persona_profiles').select('persona_completed_at').eq('user_id', userId).maybeSingle();
      return !!data?.persona_completed_at;
    }
    case 'checked_analytics': {
      const { count } = await supabase.from('page_views').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('feature', 'analytics');
      return (count || 0) >= 1;
    }
    case 'first_repurpose': {
      const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('source', 'repurpose');
      return (count || 0) >= 1;
    }
    case 'first_visual': {
      const { count } = await supabase.from('generated_assets').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      return (count || 0) >= 1;
    }
    case 'profile_optimizer_complete': {
      const { data } = await supabase.from('profiles').select('bio, profile_photo_url').eq('id', userId).single();
      return !!(data?.bio && data?.profile_photo_url);
    }
    case 'first_real_engagement': {
      const { count } = await supabase.from('post_analytics').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('estimated_read_time', 'is', null);
      return (count || 0) >= 1;
    }
    default:
      return false;
  }
}

// Checks all micro-milestones against real data, persists any newly-earned
// ones to profiles.milestone_badges, and returns just the ones unlocked by
// THIS call (so the caller can show a one-time celebration for them).
export async function checkMilestones(supabase: SupabaseClient, userId: string): Promise<Milestone[]> {
  const { data: profile } = await supabase.from('profiles').select('milestone_badges').eq('id', userId).single();
  const earned: string[] = (profile?.milestone_badges || []).map((b: any) => b.key);
  const newlyUnlocked: Milestone[] = [];

  for (const m of MICRO_MILESTONES) {
    if (earned.includes(m.key)) continue;
    if (await evaluateMilestone(supabase, userId, m.key)) newlyUnlocked.push(m);
  }

  if (newlyUnlocked.length) {
    const updatedBadges = [
      ...(profile?.milestone_badges || []),
      ...newlyUnlocked.map(m => ({ key: m.key, unlockedAt: new Date().toISOString() })),
    ];
    await supabase.from('profiles').update({ milestone_badges: updatedBadges }).eq('id', userId);

    for (const m of newlyUnlocked) {
      if (m.key === 'linkedin_connected') {
        await createNotification(supabase, userId, 'linkedin_connected', 'LinkedIn Connected',
          '🔗 LinkedIn connected! You can now publish directly from Eclatale.');
      } else if (m.key === 'voice_complete') {
        await createNotification(supabase, userId, 'voice_complete', 'Voice Profile Complete',
          '🎯 Voice profile complete! Your content will now sound authentically like you.');
      }
    }
  }

  return newlyUnlocked;
}

// ── Momentum ─────────────────────────────────────────────────────────────────

export type MomentumTrend = 'Building' | 'Strong' | 'Slowing' | 'Stalled';

export async function getMomentum(supabase: SupabaseClient, userId: string): Promise<{ week: boolean[]; trend: MomentumTrend }> {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const { data } = await supabase.from('posts').select('published_at').eq('user_id', userId).eq('status', 'published')
    .gte('published_at', new Date(now - 14 * day).toISOString());

  const dates = (data || []).map((p: any) => new Date(p.published_at).toISOString().split('T')[0]);
  const daySet = new Set(dates);

  const week: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * day).toISOString().split('T')[0];
    week.push(daySet.has(d));
  }

  const thisWeekCount = dates.filter(d => now - new Date(d).getTime() < 7 * day).length;
  const prevWeekCount = dates.filter(d => {
    const t = now - new Date(d).getTime();
    return t >= 7 * day && t < 14 * day;
  }).length;

  let trend: MomentumTrend;
  if (thisWeekCount === 0) trend = 'Stalled';
  else if (thisWeekCount > prevWeekCount) trend = prevWeekCount === 0 ? 'Building' : 'Strong';
  else if (thisWeekCount === prevWeekCount) trend = 'Building';
  else trend = 'Slowing';

  return { week, trend };
}
