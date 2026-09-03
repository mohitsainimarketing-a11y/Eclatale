import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';

const MIN_POSTS_FOR_REAL_DATA = 50;
const CACHE_MS = 24 * 60 * 60 * 1000;

export interface HookTypeStat { type: string; percentage: number; relativePerformance?: string; }
export interface IndustryIntelligenceResult {
  topHookTypes: HookTypeStat[];
  bestLength: { min: number; max: number; insight: string };
  bestTimes: { day: string; time: string }[];
  trendingTopics: { topic: string; trendScore?: number }[];
  topStructureInsight: string;
  dataSource: 'real' | 'estimated';
  postsAnalyzed: number;
  generatedAt: string;
}

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(match ? match[0] : text); } catch { return {}; }
}

async function readRoleDomainCache(supabase: SupabaseClient, role: string, domain: string, kind: string): Promise<any | null> {
  const { data } = await supabase.from('role_domain_cache').select('data, generated_at').eq('role', role).eq('domain', domain).eq('kind', kind).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.generated_at).getTime() > CACHE_MS) return null;
  return data.data;
}

async function writeRoleDomainCache(supabase: SupabaseClient, role: string, domain: string, kind: string, payload: any): Promise<void> {
  await supabase.from('role_domain_cache').upsert({ role, domain, kind, data: payload, generated_at: new Date().toISOString() }, { onConflict: 'role,domain,kind' });
}

// Real aggregated hook-type distribution for this role+domain, computed from
// Eclatale's own post_analytics data (joined through profiles for role/domain,
// since post_analytics itself doesn't carry those columns).
async function computeRealHookStats(supabase: SupabaseClient, role: string, domain: string) {
  const { data: matchingUsers } = await supabase.from('profiles').select('id').eq('role', role).eq('domain', domain);
  const userIds = (matchingUsers || []).map((u: any) => u.id);
  if (!userIds.length) return { totalPosts: 0, byType: [] as { type: string; count: number; avgStrength: number }[] };

  const { data: rows } = await supabase.from('post_analytics').select('hook_type, hook_strength').in('user_id', userIds).not('hook_type', 'is', null);
  const all = rows || [];
  const byType = new Map<string, { count: number; strengthSum: number }>();
  for (const r of all) {
    const t = String(r.hook_type);
    const entry = byType.get(t) || { count: 0, strengthSum: 0 };
    entry.count++;
    entry.strengthSum += Number(r.hook_strength) || 0;
    byType.set(t, entry);
  }
  return {
    totalPosts: all.length,
    byType: Array.from(byType.entries())
      .map(([type, v]) => ({ type, count: v.count, avgStrength: Math.round(v.strengthSum / v.count) }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getIndustryIntelligence(
  anthropic: Anthropic, supabase: SupabaseClient, role: string, domain: string, forceRefresh = false
): Promise<IndustryIntelligenceResult> {
  if (!forceRefresh) {
    const cached = await readRoleDomainCache(supabase, role, domain, 'industry-intelligence');
    if (cached) return { ...cached, generatedAt: cached.generatedAt };
  }

  const real = await computeRealHookStats(supabase, role, domain);

  let result: IndustryIntelligenceResult;

  if (real.totalPosts >= MIN_POSTS_FOR_REAL_DATA) {
    // Real Eclatale usage data is dense enough to report directly — no
    // fabricated numbers, this is a genuine distribution + performance proxy
    // (avg hook_strength, the only performance signal we actually store).
    const total = real.byType.reduce((s, t) => s + t.count, 0);
    const topHookTypes = real.byType.slice(0, 5).map(t => ({
      type: t.type,
      percentage: Math.round((t.count / total) * 100),
      relativePerformance: `avg hook strength ${t.avgStrength}/100`,
    }));

    // Length/times/trending still need Claude+web search — real usage data
    // doesn't cover those dimensions with any volume yet.
    const supplement = await generateSupplement(anthropic, role, domain);
    result = {
      topHookTypes,
      bestLength: supplement.bestLength,
      bestTimes: supplement.bestTimes,
      trendingTopics: supplement.trendingTopics,
      topStructureInsight: supplement.topStructureInsight,
      dataSource: 'real',
      postsAnalyzed: real.totalPosts,
      generatedAt: new Date().toISOString(),
    };
  } else {
    const estimated = await generateFullEstimate(anthropic, role, domain);
    result = { ...estimated, dataSource: 'estimated', postsAnalyzed: real.totalPosts, generatedAt: new Date().toISOString() };
  }

  await writeRoleDomainCache(supabase, role, domain, 'industry-intelligence', result);
  return result;
}

async function generateSupplement(anthropic: Anthropic, role: string, domain: string) {
  const message = await (anthropic.messages.create as any)({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `For a ${role} in ${domain} posting on LinkedIn: 1) what content length range (in characters) tends to perform best and why, 2) two good posting day/time slots, 3) search for the 3 most discussed topics in ${domain} in the last 7 days, 4) one sentence on what post structure tends to drive the most comments. Return ONLY valid JSON: { "bestLength": {"min":number,"max":number,"insight":string}, "bestTimes":[{"day":string,"time":string}], "trendingTopics":[{"topic":string,"trendScore":number}], "topStructureInsight":string }`,
    }],
  });
  const textBlock = (message.content || []).find((b: any) => b.type === 'text');
  const parsed = parseJsonObject(textBlock?.text || '{}');
  return {
    bestLength: parsed.bestLength || { min: 900, max: 1300, insight: `Posts 900-1,300 characters tend to perform best for a ${role} in ${domain}.` },
    bestTimes: Array.isArray(parsed.bestTimes) ? parsed.bestTimes.slice(0, 2) : [{ day: 'Tuesday', time: '7-9 AM' }],
    trendingTopics: Array.isArray(parsed.trendingTopics) ? parsed.trendingTopics.slice(0, 3) : [],
    topStructureInsight: parsed.topStructureInsight || '',
  };
}

async function generateFullEstimate(anthropic: Anthropic, role: string, domain: string): Promise<Omit<IndustryIntelligenceResult, 'dataSource' | 'postsAnalyzed' | 'generatedAt'>> {
  const message = await (anthropic.messages.create as any)({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `You're a LinkedIn content strategist. For a ${role} in ${domain}, estimate based on general LinkedIn content research (not any single company's private data):
1. The approximate distribution of hook styles among top-performing posts, across exactly these 5 types: Contrarian, Story opener, Bold stat, Question, Insider reveal (percentages should sum to roughly 100)
2. What content length range performs best and why
3. Two good posting day/time slots for this audience
4. Search the web for the 3 most discussed topics in ${domain} in the last 7 days
5. One sentence on what post structure tends to drive the most comments for a ${role}

Return ONLY valid JSON, no prose: { "topHookTypes": [{"type":string,"percentage":number}], "bestLength": {"min":number,"max":number,"insight":string}, "bestTimes":[{"day":string,"time":string}], "trendingTopics":[{"topic":string,"trendScore":number}], "topStructureInsight":string }`,
    }],
  });
  const textBlock = (message.content || []).find((b: any) => b.type === 'text');
  const parsed = parseJsonObject(textBlock?.text || '{}');
  const topHookTypes = Array.isArray(parsed.topHookTypes) && parsed.topHookTypes.length
    ? parsed.topHookTypes.slice(0, 5)
    : [
        { type: 'Contrarian', percentage: 31 }, { type: 'Story opener', percentage: 24 },
        { type: 'Bold stat', percentage: 19 }, { type: 'Question', percentage: 15 }, { type: 'Insider reveal', percentage: 11 },
      ];
  return {
    topHookTypes,
    bestLength: parsed.bestLength || { min: 900, max: 1300, insight: `Posts 900-1,300 characters tend to get more reach for a ${role} in ${domain}.` },
    bestTimes: Array.isArray(parsed.bestTimes) ? parsed.bestTimes.slice(0, 2) : [{ day: 'Tuesday', time: '7-9 AM' }, { day: 'Thursday', time: '12-2 PM' }],
    trendingTopics: Array.isArray(parsed.trendingTopics) ? parsed.trendingTopics.slice(0, 3) : [],
    topStructureInsight: parsed.topStructureInsight || `${role}s in ${domain}: posts with data and personal experience in the first two paragraphs tend to drive more comments.`,
  };
}
