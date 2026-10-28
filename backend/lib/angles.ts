import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';
import { readCache, writeCache } from './intelligenceCache';
import { computeTrustScore, extractDomain } from './webResearch';
import { STATIC_CONTENT_BLOCK, dynamicBlock } from './promptCache';
import { MODELS } from './models';

// Fixed visual metadata per angle style, kept server-side (not model-generated)
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

// Strict JSON first. Hooks often contain unescaped double quotes (dialogue, scare
// quotes) which break JSON.parse, so fall back to pulling each angle out by its keys.
function parseAnglesReply(text: string): { angles?: any[]; sources?: any[] } {
  const anchors = [...text.matchAll(/\{\s*"angles"/g)];
  const start = anchors.length ? anchors[anchors.length - 1].index! : -1;
  const candidate = start >= 0 ? text.slice(start) : text;
  const match = candidate.match(/\{[\s\S]*\}/);
  try {
    const p = JSON.parse(match ? match[0] : '{}');
    if (Array.isArray(p.angles) && p.angles.length > 0) return p;
  } catch { /* fall through to key extraction */ }

  const angles: any[] = [];
  const re = /"style"\s*:\s*"([^"]+)"\s*,\s*"hook"\s*:\s*"([\s\S]*?)"\s*,\s*"insight"\s*:\s*"([\s\S]*?)"\s*,\s*"performanceStat"\s*:\s*"([\s\S]*?)"\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(candidate)) !== null) {
    angles.push({ style: m[1], hook: m[2].replace(/\\"/g, '"'), insight: m[3].replace(/\\"/g, '"'), performanceStat: m[4] });
  }
  return { angles };
}

async function getRoleIndustry(supabase: SupabaseClient, userId: string): Promise<{ role: string; industry: string }> {
  const { data: profile } = await supabase.from('profiles').select('role, domain').eq('id', userId).single();
  return { role: profile?.role || 'professional', industry: profile?.domain || 'business' };
}

// Generates 6 distinct post angles for the user's role/industry in one fast model
// call. Cached 2h per user (angles refresh slowly; the refresh button forces a redo).
export async function createAngles(anthropic: Anthropic, supabase: SupabaseClient, userId: string, forceRefresh: boolean) {
  if (!forceRefresh) {
    const cached = await readCache(supabase, userId, 'angles', 2 * 60 * 60 * 1000);
    if (cached) return cached;
  }

  const { role, industry } = await getRoleIndustry(supabase, userId);

  // No web search here. It added 20 to 40 seconds to the first load. Angles come from one
  // fast model call, and the trending panel on the start screen carries the live news.
  const parsed: any = { sources: [] };
  let rawAngles: any[] = [];

  {
    const fallback = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1100,
      system: [STATIC_CONTENT_BLOCK, dynamicBlock(getDateContext())],
      messages: [{
        role: 'user',
        content: `Generate 6 distinct LinkedIn post angles for a ${role} in ${industry}.

For each angle:
- Write a compelling hook (1-2 short sentences, under 30 words). This is the actual opening of the post
- Assign a style from exactly these 6 (use exact casing): Contrarian, Storyteller, Data-driven, Insider, Teacher, Motivator
- Write one short sentence (under 15 words) explaining why this works for a ${role} in ${industry}
- Add a realistic performance stat (e.g. "2.4x more comments")

Return ONLY valid JSON (no prose, no markdown fences):
{"angles":[{"style":"Contrarian","hook":"...","insight":"...","performanceStat":"..."}],"sources":[]}`,
      }],
    });
    const fbText = fallback.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text || '')
      .join('');
    const fbParsed: any = parseAnglesReply(fbText);
    if (!Array.isArray(fbParsed.angles) || fbParsed.angles.length === 0) {
      console.error('angles: fallback reply unusable', fbText.slice(0, 300));
    }
    rawAngles = Array.isArray(fbParsed.angles) ? fbParsed.angles : [];
    if (!Array.isArray(parsed.sources)) parsed.sources = fbParsed.sources || [];
  }

  const angles = rawAngles.slice(0, 6).map((a: any, i: number) => {
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

  // Don't cache empty results, so this forces fresh generation on next load
  const payload = { angles, sources, role, industry, generatedAt: new Date().toISOString(), cached: false };
  if (angles.length > 0) {
    await writeCache(supabase, userId, 'angles', { angles, sources, role, industry });
  }
  return payload;
}
