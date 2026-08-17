import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';
import { readCache, writeCache } from './intelligenceCache';
import { computeTrustScore, extractDomain } from './webResearch';
import { UNIVERSAL_HUMAN_WRITING_RULES } from './writingStyles';

// Fixed visual metadata per angle style — kept server-side (not model-generated)
// so every card renders with exact design-system colors instead of hoping
// Claude picks matching hex values. `writingStyleId` maps to WRITING_STYLES
// (writingStyles.ts) so /api/generate can reuse the same style prompt later.
export const ANGLE_STYLE_META: Record<string, {
  emoji: string; writingStyleId: string; badgeColor: string; badgeTextColor: string;
  performanceIcon: string; performanceColor: string;
}> = {
  Contrarian: { emoji: '🔥', writingStyleId: 'contrarian', badgeColor: 'rgba(247,37,133,0.1)', badgeTextColor: '#F72585', performanceIcon: 'trending-up', performanceColor: '#F72585' },
  Storyteller: { emoji: '📖', writingStyleId: 'storyteller', badgeColor: 'rgba(124,92,252,0.1)', badgeTextColor: '#7C5CFC', performanceIcon: 'message-circle', performanceColor: '#7C5CFC' },
  'Data-driven': { emoji: '📊', writingStyleId: 'analyst', badgeColor: 'rgba(17,138,178,0.1)', badgeTextColor: '#118AB2', performanceIcon: 'trending-up', performanceColor: '#118AB2' },
  Insider: { emoji: '🕵️', writingStyleId: 'insider', badgeColor: 'rgba(26,26,46,0.08)', badgeTextColor: '#1A1A2E', performanceIcon: 'shield-check', performanceColor: '#10B981' },
  Teacher: { emoji: '🎓', writingStyleId: 'teacher', badgeColor: 'rgba(6,214,160,0.12)', badgeTextColor: '#06D6A0', performanceIcon: 'user', performanceColor: '#06D6A0' },
  Motivator: { emoji: '💪', writingStyleId: 'motivator', badgeColor: 'rgba(255,107,53,0.12)', badgeTextColor: '#FF6B35', performanceIcon: 'trending-up', performanceColor: '#FF6B35' },
};

async function getRoleIndustry(supabase: SupabaseClient, userId: string): Promise<{ role: string; industry: string }> {
  const { data: profile } = await supabase.from('profiles').select('role, domain').eq('id', userId).single();
  return { role: profile?.role || 'professional', industry: profile?.domain || 'business' };
}

// Generates 4 distinct post angles grounded in current (last-7-days) trends
// for the user's role/industry, using Claude's web_search tool so the hooks
// reference genuinely current events rather than stale training data.
// Cached 2h per user (angles refresh slowly; the ↻ button forces a redo).
export async function createAngles(anthropic: Anthropic, supabase: SupabaseClient, userId: string, forceRefresh: boolean) {
  if (!forceRefresh) {
    const cached = await readCache(supabase, userId, 'angles', 2 * 60 * 60 * 1000);
    if (cached) return cached;
  }

  const { role, industry } = await getRoleIndustry(supabase, userId);

  const message = await (anthropic.messages.create as any)({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2500,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Generate 4 distinct LinkedIn post angles for a ${role} in ${industry}.

Use web search to find 2-3 trending topics in ${industry} right now (last 7 days).

For each angle:
- Write a compelling hook (2-3 sentences) — the actual opening of the post
- The hook must reference something genuinely current — never reference anything from 2022-2024 as if it were recent
- Assign a style from exactly these 6 (use this exact casing): Contrarian, Storyteller, Data-driven, Insider, Teacher, Motivator
- Write one sentence explaining why this works for a ${role} in ${industry} (mention their specific role)
- Add a realistic performance stat specific to the style type (e.g. "2.4x more comments")

${UNIVERSAL_HUMAN_WRITING_RULES}

After searching, respond with ONLY valid JSON (no prose, no markdown fences) matching this shape:
{
  "angles": [
    { "style": "Contrarian", "hook": "...", "insight": "...", "performanceStat": "..." }
  ],
  "sources": [
    { "title": "...", "url": "...", "excerpt": "one sentence summary", "publishedDate": "YYYY-MM-DD or null" }
  ]
}
"sources" should be the 2-5 articles you actually used to ground the trending topics.`,
    }],
  });

  const textBlock = (message.content || []).find((b: any) => b.type === 'text');
  const raw: string = textBlock?.text || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw); } catch { parsed = {}; }

  const rawAngles: any[] = Array.isArray(parsed.angles) ? parsed.angles : [];
  const angles = rawAngles.slice(0, 4).map((a: any, i: number) => {
    const meta = ANGLE_STYLE_META[a.style] || ANGLE_STYLE_META.Storyteller;
    return {
      id: `angle-${Date.now()}-${i}`,
      style: ANGLE_STYLE_META[a.style] ? a.style : 'Storyteller',
      styleId: meta.writingStyleId,
      styleEmoji: meta.emoji,
      hook: String(a.hook || ''),
      insight: String(a.insight || ''),
      performanceStat: String(a.performanceStat || ''),
      performanceIcon: meta.performanceIcon,
      performanceColor: meta.performanceColor,
      badgeColor: meta.badgeColor,
      badgeTextColor: meta.badgeTextColor,
    };
  });

  const rawSources: any[] = Array.isArray(parsed.sources) ? parsed.sources : [];
  const sources = rawSources.slice(0, 5).map((s: any) => {
    const domain = extractDomain(s.url || '');
    return {
      title: String(s.title || 'Untitled'),
      url: String(s.url || ''),
      domain,
      excerpt: String(s.excerpt || ''),
      publishedDate: s.publishedDate || null,
      trustScore: computeTrustScore(domain, s.publishedDate || null),
    };
  }).sort((a, b) => b.trustScore - a.trustScore);

  const payload = { angles, sources, role, industry, generatedAt: new Date().toISOString(), cached: false };
  await writeCache(supabase, userId, 'angles', { angles, sources, role, industry });
  return payload;
}
