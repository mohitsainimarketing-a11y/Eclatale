import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  COMPETITOR_INTELLIGENCE_SYSTEM, buildCompetitorIntelligenceUserPrompt,
  BEST_TIME_SYSTEM, buildBestTimeUserPrompt,
} from '../lib/intelligencePrompts';
import { readCache, writeCache } from '../lib/intelligenceCache';
import { buildDigestData, renderDigestHTML, sendDigestEmail } from '../lib/digest';
import { gatherGrowthData, buildGrowthScorePrompt } from '../lib/growthScore';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

async function getProfile(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
  const role = profile?.role || 'professional';
  const industry = profile?.domain || 'business';
  const goals = profile?.goals || [];
  const goalsText = goals.length > 0 ? `Their growth goals are: ${goals.join(', ')}.` : '';
  return { role, industry, goals, goalsText };
}

async function competitorIntelligence(userId: string, forceRefresh: boolean) {
  if (!forceRefresh) {
    const cached = await readCache(supabase, userId, 'competitor');
    if (cached) return cached;
  }

  const { role, industry, goalsText } = await getProfile(userId);
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: COMPETITOR_INTELLIGENCE_SYSTEM,
    messages: [{ role: 'user', content: buildCompetitorIntelligenceUserPrompt(role, industry, goalsText) }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);

  const payload = {
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    trendingTopics: Array.isArray(parsed.trendingTopics) ? parsed.trendingTopics : [],
    role,
    industry,
    basedOn: 'AI-curated for your role and industry',
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  await writeCache(supabase, userId, 'competitor', {
    insights: payload.insights,
    trendingTopics: payload.trendingTopics,
    role,
    industry,
    basedOn: payload.basedOn,
  });

  return payload;
}

async function growthScore(userId: string, forceRefresh: boolean) {
  if (!forceRefresh) {
    const cached = await readCache(supabase, userId, 'growth-score', 6 * 60 * 60 * 1000);
    if (cached) return cached;
  }

  const d = await gatherGrowthData(supabase, userId);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: buildGrowthScorePrompt(d) }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);

  const contentConsistency = Math.max(0, Math.min(100, Math.round(parsed.contentConsistency?.score ?? 0)));
  const profileCompleteness = d.profileCompleteness.score;
  // Engagement is unmeasurable without a LinkedIn analytics connection.
  const engagementMeasured = false;

  // Weights: content 40, engagement 30, profile 30. When engagement is
  // unmeasurable, renormalize across the two measurable components (40 + 30).
  const overallScore = Math.round(
    (contentConsistency * 0.4 + profileCompleteness * 0.3) / 0.7
  );

  const payload = {
    overallScore,
    overallReasoning: parsed.overallReasoning || '',
    subComponents: {
      contentConsistency: {
        score: contentConsistency,
        weight: 40,
        reasoning: parsed.contentConsistency?.reasoning || '',
      },
      engagementRate: {
        score: null,
        weight: 30,
        measured: engagementMeasured,
        reasoning: 'Connect LinkedIn to track real engagement',
      },
      profileCompleteness: {
        score: profileCompleteness,
        weight: 30,
        present: d.profileCompleteness.present,
        missing: d.profileCompleteness.missing,
        reasoning: d.profileCompleteness.missing.length
          ? `Missing: ${d.profileCompleteness.missing.join(', ')}`
          : 'All profile elements complete',
      },
    },
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  await writeCache(supabase, userId, 'growth-score', {
    overallScore: payload.overallScore,
    overallReasoning: payload.overallReasoning,
    subComponents: payload.subComponents,
  });

  return payload;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function bestTimeToPost(userId: string, forceRefresh: boolean) {
  if (!forceRefresh) {
    const cached = await readCache(supabase, userId, 'best-time');
    if (cached) return cached;
  }

  const { role, industry } = await getProfile(userId);

  // Pull published posts (fall back to any posts) to detect real patterns.
  const { data: posts } = await supabase
    .from('posts')
    .select('created_at, published_at, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  const published = (posts || []).filter((p: any) => p.status === 'published' || p.published_at);
  const hasHistory = published.length >= 5;

  let historySummary = '';
  if (hasHistory) {
    const counts: Record<string, number> = {};
    for (const p of published) {
      const d = new Date(p.published_at || p.created_at);
      const key = `${DAY_NAMES[d.getDay()]} ${d.getHours()}:00`;
      counts[key] = (counts[key] || 0) + 1;
    }
    historySummary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([slot, n]) => `${slot} (${n} posts)`)
      .join(', ');
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    system: BEST_TIME_SYSTEM,
    messages: [{ role: 'user', content: buildBestTimeUserPrompt(role, industry, hasHistory, historySummary) }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);

  const payload = {
    recommendedDays: Array.isArray(parsed.recommendedDays) ? parsed.recommendedDays : [],
    recommendedTimes: Array.isArray(parsed.recommendedTimes) ? parsed.recommendedTimes : [],
    confidence: parsed.confidence || (hasHistory ? 'medium' : 'low'),
    reasoning: parsed.reasoning || '',
    basedOn: parsed.basedOn || (hasHistory ? 'your posting history' : 'industry benchmarks'),
    role,
    industry,
    postsAnalyzed: published.length,
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  await writeCache(supabase, userId, 'best-time', {
    recommendedDays: payload.recommendedDays,
    recommendedTimes: payload.recommendedTimes,
    confidence: payload.confidence,
    reasoning: payload.reasoning,
    basedOn: payload.basedOn,
    role,
    industry,
    postsAnalyzed: payload.postsAnalyzed,
  });

  return payload;
}

// Admin-triggered digest for a single user (testing). Optionally sends the email.
async function triggerDigest(targetUserId: string, doSend: boolean) {
  const data = await buildDigestData(anthropic, supabase, targetUserId);
  if (!data) return { ok: false, error: 'Could not build digest (missing user or email)' };
  const html = renderDigestHTML(data);
  let delivery: { sent: boolean; reason?: string } = { sent: false, reason: 'send not requested' };
  if (doSend) delivery = await sendDigestEmail(data);
  return {
    ok: true,
    subject: data.subject,
    to: data.email,
    data: {
      firstName: data.firstName, role: data.role, industry: data.industry,
      postsLastWeek: data.postsLastWeek, streak: data.streak, growthScore: data.growthScore,
      topicSuggestions: data.topicSuggestions, tipOfWeek: data.tipOfWeek, intro: data.intro,
    },
    html,
    delivery,
  };
}

// Weekly cron. Hobby plan only permits daily/weekly crons (not hourly), so we
// cannot fire at each user's local 8am precisely. We run once weekly (Mondays
// 13:00 UTC) and send to opted-in users for whom it is Monday in THEIR timezone
// (day-granularity timezone respect, the best achievable without Pro cron).
async function weeklyDigestCron() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, timezone, notif_weekly_digest');

  const results: { userId: string; sent: boolean; reason?: string }[] = [];
  for (const p of profiles || []) {
    // Respect the opt-out (default is opted-in when the column is absent/null).
    if ((p as any).notif_weekly_digest === false) continue;
    const tz = (p as any).timezone || 'UTC';
    let weekday = '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).formatToParts(new Date());
      weekday = parts.find(x => x.type === 'weekday')?.value || '';
    } catch { continue; }
    if (weekday !== 'Monday') continue;
    try {
      const data = await buildDigestData(anthropic, supabase, (p as any).id);
      if (!data) { results.push({ userId: (p as any).id, sent: false, reason: 'no data' }); continue; }
      const delivery = await sendDigestEmail(data);
      results.push({ userId: (p as any).id, sent: delivery.sent, reason: delivery.reason });
    } catch (e: any) {
      results.push({ userId: (p as any).id, sent: false, reason: e.message });
    }
  }
  return { ok: true, considered: (profiles || []).length, results };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.method === 'POST' ? (req.body || {}) : {};
    const action = String(body.action || req.query.action || '');
    const userId = String(body.userId || req.query.userId || '');
    const forceRefresh = !!body.refresh || req.query.refresh === 'true';

    // Digest actions (no per-request userId required for the cron).
    if (action === 'weekly-digest-cron') {
      const secret = String(body.secret || req.query.secret || '');
      if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        // Vercel Cron sends an Authorization: Bearer <CRON_SECRET> header.
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = await weeklyDigestCron();
      return res.json(result);
    }

    if (action === 'trigger-digest') {
      const adminSecret = String(body.adminSecret || req.query.adminSecret || '');
      if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const targetUserId = String(body.targetUserId || body.userId || req.query.userId || '');
      if (!targetUserId) return res.status(400).json({ error: 'Missing targetUserId' });
      const doSend = body.send === true || req.query.send === 'true';
      const result = await triggerDigest(targetUserId, doSend);
      return res.json(result);
    }

    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    switch (action) {
      case 'competitor':
      case 'competitor-intelligence': {
        const result = await competitorIntelligence(userId, forceRefresh);
        return res.json(result);
      }
      case 'best-time':
      case 'best-time-to-post': {
        const result = await bestTimeToPost(userId, forceRefresh);
        return res.json(result);
      }
      case 'growth-score': {
        const result = await growthScore(userId, forceRefresh);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('Intelligence error:', error);
    res.status(500).json({ error: error.message || 'Intelligence request failed' });
  }
}
