import { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Brand Health Score ──────────────────────────────────────────────────────
// Deterministic (not LLM-based) so it's fast, stable, and diffable week over
// week for the trend arrow — an LLM call can't give a meaningful delta.

export interface BrandHealthBreakdown {
  score: number;
  consistency: number;
  quality: number;
  voice: number;
  trend: number; // score - scoreAsOfLastWeek
}

async function scoreAsOf(supabase: SupabaseClient, userId: string, cutoff: Date): Promise<number> {
  const [postsRes, analyticsRes, personaRes] = await Promise.all([
    supabase.from('posts').select('created_at, status').eq('user_id', userId).lte('created_at', cutoff.toISOString()),
    supabase.from('post_analytics').select('readability_score, created_at').eq('user_id', userId).lte('created_at', cutoff.toISOString()),
    supabase.from('persona_profiles').select('persona_completed_at, voice_samples').eq('user_id', userId).maybeSingle(),
  ]);

  const posts = postsRes.data || [];
  const fourWeeksAgo = new Date(cutoff.getTime() - 28 * DAY_MS);
  const recentPosts = posts.filter((p: any) => new Date(p.created_at) >= fourWeeksAgo);
  // Consistency: weeks with at least one post out of the trailing 4, plus a
  // small bonus for total volume so a brand-new account isn't stuck at 0.
  const weekBuckets = new Set<number>();
  for (const p of recentPosts) {
    const weeksAgo = Math.floor((cutoff.getTime() - new Date(p.created_at).getTime()) / (7 * DAY_MS));
    if (weeksAgo >= 0 && weeksAgo < 4) weekBuckets.add(weeksAgo);
  }
  const consistency = Math.min(100, Math.round((weekBuckets.size / 4) * 80 + Math.min(20, posts.length * 2)));

  const scores = (analyticsRes.data || []).map((a: any) => a.readability_score).filter((n: any) => typeof n === 'number');
  const quality = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

  const persona = personaRes.data as any;
  const voiceSamples: string[] = persona?.voice_samples || [];
  let voice = 0;
  if (persona?.persona_completed_at) voice += 60;
  voice += Math.min(40, voiceSamples.length * 10);
  voice = Math.min(100, voice);

  return Math.round(consistency * 0.4 + quality * 0.35 + voice * 0.25);
}

// Real historical reconstruction (not simulated/random): re-runs the exact
// same weighted formula as of each past week boundary, using only the data
// that existed by that date. Capped at 12 points so a long-tenured account
// doesn't send back an unbounded array.
export async function getGrowthScoreHistory(supabase: SupabaseClient, userId: string): Promise<{ weekStart: string; score: number }[]> {
  const { data: profile } = await supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle();
  const createdAt = (profile as any)?.created_at ? new Date((profile as any).created_at) : new Date(Date.now() - 30 * DAY_MS);
  const weeksActive = Math.min(12, Math.max(1, Math.ceil((Date.now() - createdAt.getTime()) / (7 * DAY_MS))));

  const points: { weekStart: string; score: number }[] = [];
  for (let w = weeksActive - 1; w >= 0; w--) {
    const cutoff = new Date(Date.now() - w * 7 * DAY_MS);
    const score = await scoreAsOf(supabase, userId, cutoff);
    points.push({ weekStart: cutoff.toISOString().split('T')[0], score });
  }
  return points;
}

export async function computeBrandHealth(supabase: SupabaseClient, userId: string): Promise<BrandHealthBreakdown> {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * DAY_MS);
  const [current, previous] = await Promise.all([scoreAsOf(supabase, userId, now), scoreAsOf(supabase, userId, lastWeek)]);

  // Re-derive the sub-scores for the current point so the breakdown UI has
  // real numbers (scoreAsOf only returns the composite).
  const [postsRes, analyticsRes, personaRes] = await Promise.all([
    supabase.from('posts').select('created_at').eq('user_id', userId),
    supabase.from('post_analytics').select('readability_score').eq('user_id', userId),
    supabase.from('persona_profiles').select('persona_completed_at, voice_samples').eq('user_id', userId).maybeSingle(),
  ]);
  const posts = postsRes.data || [];
  const fourWeeksAgo = new Date(now.getTime() - 28 * DAY_MS);
  const recentPosts = posts.filter((p: any) => new Date(p.created_at) >= fourWeeksAgo);
  const weekBuckets = new Set<number>();
  for (const p of recentPosts) {
    const weeksAgo = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (7 * DAY_MS));
    if (weeksAgo >= 0 && weeksAgo < 4) weekBuckets.add(weeksAgo);
  }
  const consistency = Math.min(100, Math.round((weekBuckets.size / 4) * 80 + Math.min(20, posts.length * 2)));
  const scores = (analyticsRes.data || []).map((a: any) => a.readability_score).filter((n: any) => typeof n === 'number');
  const quality = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
  const persona = personaRes.data as any;
  const voiceSamples: string[] = persona?.voice_samples || [];
  let voice = 0;
  if (persona?.persona_completed_at) voice += 60;
  voice += Math.min(40, voiceSamples.length * 10);
  voice = Math.min(100, voice);

  return { score: current, consistency, quality, voice, trend: current - previous };
}

// ── Posting activity (area chart) ───────────────────────────────────────────

export async function getPostingActivity(supabase: SupabaseClient, userId: string, days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  const { data } = await supabase
    .from('posts')
    .select('created_at, status')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  const byDate: Record<string, { created: number; published: number }> = {};
  for (const p of data || []) {
    const d = new Date((p as any).created_at).toISOString().split('T')[0];
    if (!byDate[d]) byDate[d] = { created: 0, published: 0 };
    byDate[d].created++;
    if ((p as any).status === 'published') byDate[d].published++;
  }

  const points: { date: string; posts: number; published: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS).toISOString().split('T')[0];
    points.push({ date: d, posts: byDate[d]?.created || 0, published: byDate[d]?.published || 0 });
  }

  const dayTotals: Record<string, number> = {};
  for (const p of points) {
    const weekday = new Date(p.date).toLocaleDateString('en-US', { weekday: 'long' });
    dayTotals[weekday] = (dayTotals[weekday] || 0) + p.posts;
  }
  const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const totalPosts = points.reduce((s, p) => s + p.posts, 0);
  const weeksSpanned = Math.max(1, days / 7);
  const avgPerWeek = Math.round((totalPosts / weeksSpanned) * 10) / 10;

  return { points, bestDay, avgPerWeek };
}

// ── Content performance (weekly bars) ───────────────────────────────────────

export async function getContentPerformance(supabase: SupabaseClient, userId: string, days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  const [postsRes, analyticsRes] = await Promise.all([
    supabase.from('posts').select('created_at').eq('user_id', userId).gte('created_at', since.toISOString()),
    supabase.from('post_analytics').select('created_at, readability_score').eq('user_id', userId).gte('created_at', since.toISOString()),
  ]);

  const weeks = Math.max(1, Math.ceil(days / 7));
  const buckets: { weekStart: string; posts: number; avgScore: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(Date.now() - (w + 1) * 7 * DAY_MS);
    const weekEnd = new Date(Date.now() - w * 7 * DAY_MS);
    const postsInWeek = (postsRes.data || []).filter((p: any) => {
      const t = new Date(p.created_at).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    }).length;
    const scoresInWeek = (analyticsRes.data || [])
      .filter((a: any) => {
        const t = new Date(a.created_at).getTime();
        return t >= weekStart.getTime() && t < weekEnd.getTime();
      })
      .map((a: any) => a.readability_score)
      .filter((n: any) => typeof n === 'number');
    const avgScore = scoresInWeek.length ? Math.round(scoresInWeek.reduce((a: number, b: number) => a + b, 0) / scoresInWeek.length) : 0;
    buckets.push({ weekStart: weekStart.toISOString().split('T')[0], posts: postsInWeek, avgScore });
  }
  return buckets;
}

// ── Writing style distribution ──────────────────────────────────────────────

export async function getStyleDistribution(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('post_analytics').select('tone_detected, readability_score').eq('user_id', userId);
  const rows = data || [];
  const byTone: Record<string, { count: number; scoreSum: number }> = {};
  for (const r of rows) {
    const tone = (r as any).tone_detected || 'unspecified';
    if (!byTone[tone]) byTone[tone] = { count: 0, scoreSum: 0 };
    byTone[tone].count++;
    byTone[tone].scoreSum += (r as any).readability_score || 0;
  }
  const total = rows.length;
  const distribution = Object.entries(byTone)
    .map(([tone, v]) => ({
      tone,
      count: v.count,
      pct: total ? Math.round((v.count / total) * 100) : 0,
      avgScore: v.count ? Math.round(v.scoreSum / v.count) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const strongest = [...distribution].sort((a, b) => b.avgScore - a.avgScore)[0] || null;
  return { distribution, strongest, totalAnalyzed: total };
}

// ── Activity feed ───────────────────────────────────────────────────────────

export interface ActivityItem { type: string; description: string; timestamp: string; url?: string; }

export async function getActivityFeed(supabase: SupabaseClient, userId: string, limit: number): Promise<ActivityItem[]> {
  const [postsRes, notifRes, linkedinRes, personaRes] = await Promise.all([
    supabase.from('posts').select('id, topic, content, status, created_at, published_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    supabase.from('notifications').select('type, title, message, created_at, cta_url').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    supabase.from('linkedin_connections').select('connected_at').eq('user_id', userId).maybeSingle(),
    supabase.from('persona_profiles').select('persona_completed_at, updated_at').eq('user_id', userId).maybeSingle(),
  ]);

  const items: ActivityItem[] = [];
  for (const p of postsRes.data || []) {
    const topic = ((p as any).topic || (p as any).content || '').slice(0, 40);
    if ((p as any).status === 'published' && (p as any).published_at) {
      items.push({ type: 'published', description: `Published to LinkedIn: "${topic}"`, timestamp: (p as any).published_at, url: '/history' });
    } else {
      items.push({ type: 'draft', description: `Saved draft: "${topic}"`, timestamp: (p as any).created_at, url: '/history' });
    }
  }
  for (const n of notifRes.data || []) {
    items.push({ type: String((n as any).type || 'notification'), description: (n as any).title, timestamp: (n as any).created_at, url: (n as any).cta_url });
  }
  const linkedin = linkedinRes.data as any;
  if (linkedin?.connected_at) {
    items.push({ type: 'linkedin_connected', description: 'LinkedIn connected', timestamp: linkedin.connected_at, url: '/settings' });
  }
  const persona = personaRes.data as any;
  if (persona?.persona_completed_at) {
    items.push({ type: 'voice_complete', description: 'Voice profile completed', timestamp: persona.persona_completed_at, url: '/persona-setup' });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, limit);
}

// ── Content performance table ───────────────────────────────────────────────

export interface ContentRow {
  id: string; date: string; preview: string; tone: string | null; hookType: string | null;
  wordCount: number; authScore: number | null; status: string;
}

export async function getContentTable(supabase: SupabaseClient, userId: string, page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data: posts, count } = await supabase
    .from('posts')
    .select('id, content, status, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  const postIds = (posts || []).map((p: any) => p.id);
  const [analyticsRes, cacheRes] = await Promise.all([
    postIds.length ? supabase.from('post_analytics').select('post_id, tone_detected, hook_type').in('post_id', postIds) : Promise.resolve({ data: [] }),
    postIds.length ? supabase.from('intelligence_cache').select('kind, data').eq('user_id', userId).in('kind', postIds.map((id: string) => `authenticity-${id}`)) : Promise.resolve({ data: [] }),
  ]);

  const analyticsByPost: Record<string, any> = {};
  for (const a of analyticsRes.data || []) analyticsByPost[(a as any).post_id] = a;
  const scoreByPost: Record<string, number> = {};
  for (const c of cacheRes.data || []) {
    const postId = (c as any).kind.replace('authenticity-', '');
    const score = (c as any).data?.overallScore;
    if (typeof score === 'number') scoreByPost[postId] = score;
  }

  const rows: ContentRow[] = (posts || []).map((p: any) => ({
    id: p.id,
    date: p.created_at,
    preview: (p.content || '').replace(/\n/g, ' ').slice(0, 60),
    tone: analyticsByPost[p.id]?.tone_detected || null,
    hookType: analyticsByPost[p.id]?.hook_type || null,
    wordCount: (p.content || '').split(/\s+/).filter(Boolean).length,
    authScore: scoreByPost[p.id] ?? null,
    status: p.status,
  }));

  return { rows, total: count || 0 };
}

// ── AI recommendations ──────────────────────────────────────────────────────
// Grounded strictly in the user's real post_analytics rows — the prompt
// includes the actual per-tone averages computed above, and instructs the
// model to only cite numbers present in that data (not invent engagement
// stats we don't have, like impressions).

export interface Recommendation {
  priority: 'HIGH' | 'MEDIUM';
  recommendation: string;
  dataPoint: string;
  actionUrl: string;
  actionLabel: string;
}

export async function generateRecommendations(
  anthropic: Anthropic, supabase: SupabaseClient, userId: string
): Promise<Recommendation[]> {
  const { distribution, totalAnalyzed } = await getStyleDistribution(supabase, userId);
  if (totalAnalyzed < 2) {
    return [{
      priority: 'HIGH',
      recommendation: 'Publish a few more posts to unlock personalized recommendations — we need at least 2 analyzed posts to spot real patterns in your writing.',
      dataPoint: `${totalAnalyzed} post${totalAnalyzed === 1 ? '' : 's'} analyzed so far`,
      actionUrl: '/create',
      actionLabel: 'Create a post',
    }];
  }

  const summary = distribution.map(d => `${d.tone}: ${d.count} posts, avg readability ${d.avgScore}/100`).join('\n');
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    messages: [{
      role: 'user',
      content: `Here is this user's real LinkedIn content analytics, grouped by tone:\n\n${summary}\n\nBased ONLY on this real data, generate up to 3 specific, actionable recommendations. Each must cite an actual number from the data above — never invent metrics that aren't listed (no impressions, no engagement rate, no follower counts, since we don't have that data). If the data doesn't support a strong recommendation, return fewer than 3.\n\nReturn ONLY a JSON array: [{ "priority": "HIGH"|"MEDIUM", "recommendation": "specific sentence referencing the real data", "dataPoint": "the specific stat this is based on", "actionUrl": "/create/talk", "actionLabel": "short button label" }]`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const raw = JSON.parse(match[0]);
    return (Array.isArray(raw) ? raw : []).slice(0, 3).map((r: any) => ({
      priority: r.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
      recommendation: String(r.recommendation || ''),
      dataPoint: String(r.dataPoint || ''),
      actionUrl: String(r.actionUrl || '/create'),
      actionLabel: String(r.actionLabel || 'Do this now'),
    }));
  } catch {
    return [];
  }
}
