import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';
import { createAngles } from './angles';
import { getIndustryIntelligence } from './industryIntelligence';
import { getPersonalBest } from './hookLibrary';
import { calculateStage } from './growthJourney';
import { getWritingStyle } from './writingStyles';
import { sendIndustryBriefing } from './emailService';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(match ? match[0] : text); } catch { return {}; }
}

async function gatherPersonalStats(supabase: SupabaseClient, userId: string) {
  const now = Date.now();
  const { data: posts } = await supabase.from('posts').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
  const dates = (posts || []).map((p: any) => new Date(p.created_at).getTime());
  const postsThisWeek = dates.filter(t => now - t < 7 * DAY_MS).length;
  const postsLastWeek = dates.filter(t => now - t >= 7 * DAY_MS && now - t < 14 * DAY_MS).length;
  const { metrics } = await calculateStage(supabase, userId);
  return { postsThisWeek, postsLastWeek, currentStreak: metrics.currentStreak };
}

// One short, specific recommendation grounded in the user's own hook-type
// history (real data when available) — never a fabricated engagement number,
// since Eclatale doesn't track real LinkedIn engagement metrics.
async function generateOpportunity(
  anthropic: Anthropic, role: string, domain: string, personalBest: { hookType: string; avgHookStrength: number }[]
): Promise<{ text: string; styleSlug: string }> {
  const historyLine = personalBest.length
    ? `Their strongest hook types so far, by average hook strength (0-100): ${personalBest.map(p => `${p.hookType} (${p.avgHookStrength})`).join(', ')}.`
    : "They don't have enough post history yet to show a personal pattern.";

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `You're a LinkedIn coach writing one specific, encouraging recommendation for a ${role} in ${domain}. ${historyLine}

Suggest ONE writing style they haven't leaned on enough, from exactly these 6 (lowercase, use this exact spelling): contrarian, storyteller, analyst, teacher, insider, motivator.

Write 1-2 sentences recommending they try it this week. Be specific and grounded in what you know about their history — do not invent a fake percentage or engagement number. Never use markdown formatting (no ** for bold, no * for italic, no # for headers) — this is plain text for an email. Return ONLY valid JSON: { "text": string, "styleSlug": "one of the 6 style ids above" }`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);
  const styleSlug = getWritingStyle(parsed.styleSlug) ? parsed.styleSlug : 'storyteller';
  return {
    text: parsed.text || `Try a ${styleSlug} post this week — it's a style you haven't used much recently.`,
    styleSlug,
  };
}

export interface BriefingData {
  userId: string; email: string; firstName: string; role: string; domain: string;
  postsThisWeek: number; postsLastWeek: number; currentStreak: number;
  trendingTopics: { topic: string }[]; formatInsight: string;
  opportunityText: string; opportunityStyleSlug: string;
  angles: { style: string; hook: string }[];
}

export async function buildBriefingData(anthropic: Anthropic, supabase: SupabaseClient, userId: string): Promise<BriefingData | null> {
  const { data: profile } = await supabase.from('profiles').select('role, domain, first_name').eq('id', userId).single();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.user?.email || '';
  if (!email) return null;

  const role = profile?.role || 'professional';
  const domain = profile?.domain || 'business';
  const firstName = profile?.first_name || (email.split('@')[0] || 'there');

  const [personalStats, industry, personalBest, anglesResult] = await Promise.all([
    gatherPersonalStats(supabase, userId),
    getIndustryIntelligence(anthropic, supabase, role, domain, false),
    getPersonalBest(supabase, userId),
    createAngles(anthropic, supabase, userId, false),
  ]);

  const opportunity = await generateOpportunity(anthropic, role, domain, personalBest);

  return {
    userId, email, firstName, role, domain,
    postsThisWeek: personalStats.postsThisWeek,
    postsLastWeek: personalStats.postsLastWeek,
    currentStreak: personalStats.currentStreak,
    trendingTopics: industry.trendingTopics.slice(0, 3).map(t => ({ topic: t.topic })),
    formatInsight: industry.topStructureInsight,
    opportunityText: opportunity.text,
    opportunityStyleSlug: opportunity.styleSlug,
    angles: (anglesResult.angles || []).slice(0, 3).map((a: any) => ({ style: a.style, hook: a.hook })),
  };
}

export async function sendBriefingToUser(anthropic: Anthropic, supabase: SupabaseClient, userId: string, doSend: boolean) {
  const data = await buildBriefingData(anthropic, supabase, userId);
  if (!data) return { ok: false, error: 'Could not build briefing (missing user or email)' };
  let delivery: { sent: boolean; reason?: string } = { sent: false, reason: 'send not requested' };
  if (doSend) {
    delivery = await sendIndustryBriefing(data.userId, data.email, data.firstName, {
      domain: data.domain,
      postsThisWeek: data.postsThisWeek,
      postsLastWeek: data.postsLastWeek,
      currentStreak: data.currentStreak,
      trendingTopics: data.trendingTopics,
      formatInsight: data.formatInsight,
      opportunityText: data.opportunityText,
      opportunityStyleSlug: data.opportunityStyleSlug,
      angles: data.angles,
      postingFrequency: data.postsThisWeek,
    });
  }
  return { ok: true, to: data.email, data, delivery };
}

// Weekly cron. Hobby plan only permits daily/weekly crons (not hourly), so we
// cannot fire at each user's local 8am precisely — mirrors the same
// day-granularity timezone approach as weeklyDigestCron.
export async function weeklyIndustryBriefingCron(anthropic: Anthropic, supabase: SupabaseClient) {
  const { data: profiles } = await supabase.from('profiles').select('id, timezone, notif_industry_briefing');

  const results: { userId: string; sent: boolean; reason?: string }[] = [];
  for (const p of profiles || []) {
    if ((p as any).notif_industry_briefing === false) continue;
    const tz = (p as any).timezone || 'UTC';
    let weekday = '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).formatToParts(new Date());
      weekday = parts.find(x => x.type === 'weekday')?.value || '';
    } catch { continue; }
    if (weekday !== 'Monday') continue;
    try {
      const result = await sendBriefingToUser(anthropic, supabase, (p as any).id, true);
      results.push({ userId: (p as any).id, sent: !!result.delivery?.sent, reason: result.delivery?.reason || (result as any).error });
    } catch (e: any) {
      results.push({ userId: (p as any).id, sent: false, reason: e.message });
    }
  }
  return { ok: true, considered: (profiles || []).length, results };
}
