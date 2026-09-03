import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';

const TRENDING_CACHE_MS = 6 * 60 * 60 * 1000;
const MIN_POSTS_FOR_PERSONAL_BEST = 3;

export interface PersonalBestHook { hookType: string; avgHookStrength: number; exampleHook: string; postCount: number; }
export interface HookTemplate { text: string; performanceBadge: string; }
export interface IndustryHookCategory { type: string; templates: HookTemplate[]; }
export interface TrendingHook { hook: string; why: string; }
export interface HookLibraryResult {
  personalBest: PersonalBestHook[];
  industryTemplates: IndustryHookCategory[];
  trending: TrendingHook[];
}

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(match ? match[0] : text); } catch { return {}; }
}

function firstLine(content: string): string {
  return (content.split('\n').find(l => l.trim()) || content).slice(0, 140);
}

// ── Personal best (this user's own post_analytics) ──────────────────────────

export async function getPersonalBest(supabase: SupabaseClient, userId: string): Promise<PersonalBestHook[]> {
  const { data: rows } = await supabase
    .from('post_analytics')
    .select('hook_type, hook_strength, post_id, posts(content)')
    .eq('user_id', userId)
    .not('hook_type', 'is', null);

  const all = (rows || []) as any[];
  if (all.length < MIN_POSTS_FOR_PERSONAL_BEST) return [];

  const byType = new Map<string, { count: number; strengthSum: number; best: { strength: number; content: string } | null }>();
  for (const r of all) {
    const t = String(r.hook_type);
    const entry = byType.get(t) || { count: 0, strengthSum: 0, best: null };
    entry.count++;
    const strength = Number(r.hook_strength) || 0;
    entry.strengthSum += strength;
    const content = r.posts?.content || '';
    if (content && (!entry.best || strength > entry.best.strength)) entry.best = { strength, content };
    byType.set(t, entry);
  }

  return Array.from(byType.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([hookType, v]) => ({
      hookType,
      avgHookStrength: Math.round(v.strengthSum / v.count),
      exampleHook: v.best ? firstLine(v.best.content) : '',
      postCount: v.count,
    }))
    .sort((a, b) => b.avgHookStrength - a.avgHookStrength)
    .slice(0, 3);
}

// ── Industry templates (curated, interpolated with role/domain) ────────────

function fill(text: string, role: string, domain: string): string {
  return text.replace(/\[industry\]/g, domain).replace(/\[role\]/g, role);
}

const BADGES = ['High reach', 'High comments', 'High saves'];

export function getIndustryTemplates(role: string, domain: string): IndustryHookCategory[] {
  const raw: { type: string; templates: string[] }[] = [
    {
      type: 'Contrarian',
      templates: [
        'Everyone says [X]. They\'re wrong.',
        `The ${domain} advice everyone gives is making you worse.`,
        `[Common belief] is the biggest lie in ${domain}.`,
      ],
    },
    {
      type: 'Story opener',
      templates: [
        'I [did something] and learned [surprising thing].',
        `The call that changed how I think about [topic] as a ${role}.`,
        '[Specific moment]: that\'s when I realized [insight].',
      ],
    },
    {
      type: 'Bold stat',
      templates: [
        '[X]% of [group] never [do thing]. Here\'s why that matters.',
        'In [timeframe], I went from [A] to [B]. Here\'s exactly how.',
        'The number that shocked me: [specific stat].',
      ],
    },
    {
      type: 'Question',
      templates: [
        'What if everything you know about [topic] is wrong?',
        `Why do [X]% of ${role}s fail at [thing]?`,
        `Here's the question nobody in ${domain} is asking:`,
      ],
    },
  ];

  return raw.map((cat, ci) => ({
    type: cat.type,
    templates: cat.templates.map((t, ti) => ({
      text: fill(t, role, domain),
      performanceBadge: BADGES[(ci + ti) % BADGES.length],
    })),
  }));
}

// ── Trending hooks (Claude + web search, cached 6h per domain) ─────────────

async function readCache(supabase: SupabaseClient, role: string, domain: string, kind: string): Promise<any | null> {
  const { data } = await supabase.from('role_domain_cache').select('data, generated_at').eq('role', role).eq('domain', domain).eq('kind', kind).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.generated_at).getTime() > TRENDING_CACHE_MS) return null;
  return data.data;
}

async function writeCache(supabase: SupabaseClient, role: string, domain: string, kind: string, payload: any): Promise<void> {
  await supabase.from('role_domain_cache').upsert({ role, domain, kind, data: payload, generated_at: new Date().toISOString() }, { onConflict: 'role,domain,kind' });
}

async function getTrendingHooks(anthropic: Anthropic, supabase: SupabaseClient, role: string, domain: string): Promise<TrendingHook[]> {
  const cached = await readCache(supabase, role, domain, 'trending-hooks');
  if (cached) return cached;

  const message = await (anthropic.messages.create as any)({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Search for what's trending in ${domain} this week. Based on that, write 3 LinkedIn hook lines (under 20 words each) that a ${role} could use right now to get traction. For each, explain in one short sentence why it would land given what's trending. Return ONLY valid JSON: [{"hook":string,"why":string}]`,
    }],
  });
  const textBlock = (message.content || []).find((b: any) => b.type === 'text');
  const match = (textBlock?.text || '[]').match(/\[[\s\S]*\]/);
  let trending: TrendingHook[] = [];
  try { trending = JSON.parse(match ? match[0] : '[]'); } catch { trending = []; }
  trending = trending.slice(0, 3);

  await writeCache(supabase, role, domain, 'trending-hooks', trending);
  return trending;
}

export async function getHookLibrary(anthropic: Anthropic, supabase: SupabaseClient, userId: string, role: string, domain: string): Promise<HookLibraryResult> {
  const [personalBest, trending] = await Promise.all([
    getPersonalBest(supabase, userId),
    getTrendingHooks(anthropic, supabase, role, domain),
  ]);
  return {
    personalBest,
    industryTemplates: getIndustryTemplates(role, domain),
    trending,
  };
}
