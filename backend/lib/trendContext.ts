import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export interface TrendResult {
  trends: string[];
  generatedAt: string;
  cached: boolean;
}

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

async function readTrendCache(supabase: SupabaseClient, domain: string): Promise<TrendResult | null> {
  try {
    const { data, error } = await supabase
      .from('trend_cache')
      .select('data, generated_at')
      .eq('domain', domain)
      .maybeSingle();
    if (error || !data) return null;
    const age = Date.now() - new Date(data.generated_at).getTime();
    if (age > SIX_HOURS_MS) return null;
    const trends = Array.isArray((data.data as any)?.trends) ? (data.data as any).trends : [];
    return { trends, generatedAt: data.generated_at, cached: true };
  } catch {
    return null;
  }
}

async function writeTrendCache(supabase: SupabaseClient, domain: string, role: string, trends: string[]): Promise<void> {
  try {
    await supabase.from('trend_cache').upsert({ domain, role, data: { trends }, generated_at: new Date().toISOString() });
  } catch {
    /* table may be unreachable; graceful no-op, matches intelligenceCache.ts pattern */
  }
}

/**
 * Fetches (or reuses a ≤6h cached) list of 3-5 currently trending angles for a
 * domain, via Claude web search. Cached per-domain (not per-user) since trends
 * are shared across everyone in the same industry — this is a distinct cache
 * table from intelligence_cache because that one is keyed per-user.
 * Never throws: search/parse failures degrade to an empty trend list so a
 * content-generation call never fails because trend lookup failed.
 */
export async function getTrendContext(anthropic: Anthropic, supabase: SupabaseClient, domain: string, role: string): Promise<TrendResult> {
  const cached = await readTrendCache(supabase, domain);
  if (cached) return cached;

  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: `${getDateContext()}\n\nYou are a trend researcher. Use web search to find what is genuinely trending right now, not historical or evergreen topics.`,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search for: "${domain} trends ${monthName} ${year}" and separately "${role} LinkedIn trending topics ${year}". Based on the search results, extract 3 to 5 specific, currently trending angles or topics in ${domain} that a ${role} could write about right now. Each must be a concrete, specific angle (not a vague category), grounded in something actually happening this month.\n\nReturn ONLY a JSON object (after any research): { "trends": ["trend 1", "trend 2", "trend 3"] }`,
      }],
    });

    const text = message.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map(b => b.text).join('\n');
    const raw = parseJsonObject(text);
    const trends = Array.isArray(raw.trends) ? raw.trends.map(String).slice(0, 5) : [];
    await writeTrendCache(supabase, domain, role, trends);
    return { trends, generatedAt: new Date().toISOString(), cached: false };
  } catch {
    return { trends: [], generatedAt: new Date().toISOString(), cached: false };
  }
}

/** Builds the prompt fragment injecting live trends into a generation system prompt. */
export function buildTrendPromptFragment(trendResult: TrendResult, domain: string): string {
  if (!trendResult.trends.length) return '';
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  return `Currently trending in ${domain} as of ${dateStr}: ${trendResult.trends.join('; ')}. Where relevant, reference these current trends to make the post timely and fresh. Do not reference trends or events from before ${now.getFullYear()} as "recent".`;
}
