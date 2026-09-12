import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';

const TRENDING_CACHE_MS = 6 * 60 * 60 * 1000;
const MIN_POSTS_FOR_PERSONAL_BEST = 3;

export interface PersonalBestHook { hookType: string; avgHookStrength: number; exampleHook: string; postCount: number; }
export interface HookTemplate { formulaId: string; formulaName: string; text: string; performanceBadge: string; liftLabel: string; }
export interface TrendingHook { hook: string; why: string; }
export interface HookLibraryResult {
  personalBest: PersonalBestHook[];
  formulaTemplates: HookTemplate[];
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

// ── 20 hook formulas (sergebulaev/linkedin-skills + 2026 algorithm data) ─────

interface FormulaSpec {
  id: string;
  name: string;
  badge: string;
  liftLabel: string;
  template: (role: string, domain: string) => string;
}

const FORMULAS: FormulaSpec[] = [
  {
    id: 'F01', name: 'Number Opener',
    badge: 'High reach', liftLabel: '+34% median likes',
    template: (r, d) => `[X]% of ${r}s in ${d} never [do this one thing]. Here's why that gap exists.`,
  },
  {
    id: 'F02', name: 'Dollar / Revenue',
    badge: 'High reach', liftLabel: '+31% median likes',
    template: (_, d) => `$[amount] later, here's the one thing I know about ${d} that I didn't when I started.`,
  },
  {
    id: 'F03', name: 'Result Reveal',
    badge: 'High reach', liftLabel: '+28% median likes',
    template: (r, _) => `In [X] days, I went from [state A] to [state B] as a ${r}. Here's exactly what changed.`,
  },
  {
    id: 'F04', name: 'Contrarian',
    badge: 'High comments', liftLabel: '+26% median comments',
    template: (_, d) => `Everyone in ${d} tells you to [common advice]. The data says that's wrong.`,
  },
  {
    id: 'F05', name: 'Uncomfortable Fact',
    badge: 'High comments', liftLabel: '+24% median comments',
    template: (r, d) => `Nobody in ${d} will say this out loud, but [specific uncomfortable truth about ${r}s].`,
  },
  {
    id: 'F06', name: 'Bold Comparison',
    badge: 'High comments', liftLabel: '+22% median comments',
    template: (r, d) => `Most ${r}s in ${d} do [A]. The top 1% do [B]. The difference is [single variable].`,
  },
  {
    id: 'F07', name: 'Future Warning',
    badge: 'High comments', liftLabel: '+19% median comments',
    template: (r, d) => `If you're still doing [X] in ${d} in 2026, you'll [specific consequence]. Here's what to do instead.`,
  },
  {
    id: 'F08', name: 'Single Truth',
    badge: 'High saves', liftLabel: '+21% median saves',
    template: (_, d) => `The only thing that actually matters in ${d} is [one thing]. Everything else is noise.`,
  },
  {
    id: 'F09', name: 'Mistake Reveal',
    badge: 'High saves', liftLabel: '+19% median saves',
    template: (r, _) => `I spent [time] doing [X] wrong as a ${r}. Here's the mistake and what I'd do differently.`,
  },
  {
    id: 'F10', name: 'Process Reveal',
    badge: 'High saves', liftLabel: '+23% median saves',
    template: (r, _) => `Here's exactly how I [achieved specific result] as a ${r}. Step by step, nothing left out.`,
  },
  {
    id: 'F11', name: 'Nobody Told Me',
    badge: 'High saves', liftLabel: '+20% median saves',
    template: (r, d) => `Nobody told me this when I started in ${d} as a ${r}:`,
  },
  {
    id: 'F12', name: 'Pattern Recognition',
    badge: 'High saves', liftLabel: '+18% median saves',
    template: (r, d) => `After working with [X]+ ${r}s in ${d}, I keep seeing the same pattern. It's not what you'd expect.`,
  },
  {
    id: 'F13', name: 'List Teaser',
    badge: 'High saves', liftLabel: '+17% median saves',
    template: (r, _) => `[N] things I wish someone had told me in year one as a ${r}. I learned most of these the hard way.`,
  },
  {
    id: 'F14', name: 'Time Revelation',
    badge: 'Balanced', liftLabel: '+15% median likes',
    template: (_, d) => `It took me [time] to learn this about ${d}. Most people never figure it out at all.`,
  },
  {
    id: 'F15', name: 'Story Cold Open',
    badge: 'Balanced', liftLabel: '+14% median likes',
    template: (r, _) => `[Specific moment in one sentence]. That's when I understood what being a ${r} actually means.`,
  },
  {
    id: 'F16', name: 'The "I Almost"',
    badge: 'Balanced', liftLabel: '+13% median likes',
    template: (r, _) => `I almost [quit / walked away / gave up on] [thing]. Then [one specific turning point happened].`,
  },
  {
    id: 'F17', name: 'Observation',
    badge: 'Balanced', liftLabel: '+12% median likes',
    template: (r, d) => `Notice how every [successful ${r}] in ${d} [does specific thing]? That's not an accident.`,
  },
  {
    id: 'F18', name: 'Before / After',
    badge: 'High reach', liftLabel: '+16% median likes',
    template: (r, _) => `Before I [made specific change] as a ${r}: [state A]. After: [state B]. The shift took [timeframe].`,
  },
  {
    id: 'F19', name: 'Direct Lesson',
    badge: 'Balanced', liftLabel: '+11% median likes',
    template: (_, d) => `[Specific experience in ${d}] taught me something I didn't expect. I think about it constantly.`,
  },
  {
    id: 'F20', name: 'Bold Claim',
    badge: 'High comments', liftLabel: '+15% median comments',
    template: (r, d) => `The best ${r} I've ever seen in ${d} does [one specific thing] that almost nobody else does.`,
  },
];

export function getFormulaTemplates(role: string, domain: string): HookTemplate[] {
  return FORMULAS.map(f => ({
    formulaId: f.id,
    formulaName: f.name,
    text: f.template(role || 'professional', domain || 'your industry'),
    performanceBadge: f.badge,
    liftLabel: f.liftLabel,
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
    formulaTemplates: getFormulaTemplates(role, domain),
    trending,
  };
}
