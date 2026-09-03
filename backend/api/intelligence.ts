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
import { getProgress, getMomentum, checkMilestones, calculateStage } from '../lib/growthJourney';
import {
  computeBrandHealth, getPostingActivity, getContentPerformance, getStyleDistribution,
  getActivityFeed, getContentTable, generateRecommendations, getGrowthScoreHistory,
} from '../lib/dashboardData';
import { analyzePost, analyzeUserPatterns, compareIntendedVsActualTone } from '../lib/semanticAnalysis';
import { getDateContext } from '../lib/dateContext';
import { getTrendContext, buildTrendPromptFragment } from '../lib/trendContext';
import { calculateAuthenticityScore } from '../lib/authenticityScore';
import { isCreditsExhaustedError, creditsExhaustedBody } from '../lib/anthropicErrors';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { sendWelcomeEmail, sendFreeLimit, sendReengagement, sendDemoLeadEmail } from '../lib/emailService';
import { checkGrowthMilestone, createNotification } from '../lib/notifications';
import { requireFeature } from '../lib/featureGates';
import { checkAuthToken, reconcileUserId } from '../lib/verifyAuth';
import { calculateVoiceMatchScore } from '../lib/voiceMatchScore';
import { ariaChat, getAriaConversation, AriaMessage } from '../lib/aria';
import { searchSourcesForTopic, computeTrustScore, extractDomain } from '../lib/webResearch';
import { getWritingStyle, UNIVERSAL_HUMAN_WRITING_RULES, lengthInstruction } from '../lib/writingStyles';
import { extractPdfText, extractDocxText, extractCsvSummary, truncateForPrompt } from '../lib/resourceParsing';
import {
  extractClientIp, checkToolRateLimit, logToolUsage,
  generateHooks, generateDemoPost, analyzeHeadline, scoreViralPotential, generateAboutSection, generateCTAs,
} from '../lib/freeTools';
import { getIndustryIntelligence } from '../lib/industryIntelligence';
import { getHookLibrary } from '../lib/hookLibrary';
import { createAngles, ANGLE_STYLE_META } from '../lib/angles';
import { sendBriefingToUser, weeklyIndustryBriefingCron, buildBriefingData } from '../lib/weeklyBriefing';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Base64-encoded PDF/DOCX uploads (resource-upload action) can exceed the
// default 4.5mb body limit — raise it for this multiplexed function.
export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

// Lightweight readability extraction — no external deps: strips script/style/nav
// chrome, tags, and collapses whitespace. Good enough for article/blog-post
// bodies; not a full Readability-algorithm port.
function extractReadableText(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  // Prefer <article>/<main> (or Wikipedia's content div) over the whole
  // <body> when present — cuts most nav/sidebar chrome without a full
  // Readability-style content-scoring algorithm.
  const mainMatch =
    cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ||
    cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) ||
    cleaned.match(/id=["']mw-content-text["'][\s\S]*?>([\s\S]*?)<div[^>]*id=["']catlinks["']/i) ||
    cleaned.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i);
  if (mainMatch) cleaned = mainMatch[1];
  cleaned = cleaned.replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  cleaned = cleaned.replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
  return cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
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
  const trendResult = await getTrendContext(anthropic, supabase, industry, role);
  const trendFragment = buildTrendPromptFragment(trendResult, industry);
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: `${getDateContext()}\n\n${trendFragment ? trendFragment + '\n\n' : ''}${COMPETITOR_INTELLIGENCE_SYSTEM}`,
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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: getDateContext(),
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

  await checkGrowthMilestone(supabase, userId, overallScore);

  return payload;
}

// User writing-pattern analysis with best-effort user_pattern_cache.
// Refreshes when the user has 3+ newly analyzed posts since last analysis.
async function userPatterns(userId: string, forceRefresh: boolean) {
  const { count } = await supabase
    .from('post_analytics')
    .select('post_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const analyzedCount = count || 0;

  if (analyzedCount < 3) {
    return { ready: false, postsAnalyzed: analyzedCount, needed: 3 };
  }

  if (!forceRefresh) {
    try {
      const { data: cache } = await supabase
        .from('user_pattern_cache')
        .select('pattern_analysis, posts_analyzed_count')
        .eq('user_id', userId)
        .maybeSingle();
      if (cache && analyzedCount - (cache.posts_analyzed_count || 0) < 3) {
        return { ready: true, ...(cache.pattern_analysis as any), cached: true, postsAnalyzed: analyzedCount };
      }
    } catch { /* table may not exist yet */ }
  }

  const analysis = await analyzeUserPatterns(anthropic, supabase, userId);
  if (!analysis) return { ready: false, postsAnalyzed: analyzedCount, needed: 3 };

  try {
    await supabase.from('user_pattern_cache').upsert({
      user_id: userId,
      pattern_analysis: analysis,
      posts_analyzed_count: analyzedCount,
      last_analyzed_at: new Date().toISOString(),
      next_refresh_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch { /* table may not exist yet; still return fresh analysis */ }

  return { ready: true, ...analysis, cached: false };
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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `${getDateContext()}\n\n${BEST_TIME_SYSTEM}`,
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

// Content Authenticity Score: factual accuracy + topic freshness + voice match,
// run as three parallel Claude calls. Cached per-post for 10 minutes so a quick
// "regenerate" click doesn't re-run all three checks.
async function authenticityScore(
  userId: string, postId: string, postContent: string, topic: string, forceRefresh: boolean, contentLength?: string
) {
  const cacheKind = `authenticity-${postId}`;
  if (!forceRefresh) {
    const cached = await readCache(supabase, userId, cacheKind, 10 * 60 * 1000);
    if (cached) return cached;
  }

  const { role, industry } = await getProfile(userId);
  const personaContext = await buildPersonaPrompt(supabase, userId);

  const result = await calculateAuthenticityScore(anthropic, postContent, role, industry, personaContext, contentLength);
  const payload = { ...result, generatedAt: new Date().toISOString(), cached: false };

  await writeCache(supabase, userId, cacheKind, result);

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

// ---- Email actions (folded in here, rather than a separate api/email.ts,
// to stay under the Hobby-plan 12-serverless-function cap). ----

async function getProfileEmail(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', userId).maybeSingle();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.user?.email || '';
  const firstName = profile?.first_name || (email.split('@')[0] || 'there');
  return { email, firstName };
}

async function handleSendWelcome(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('welcome_email_sent').eq('id', userId).maybeSingle();
  if (profile?.welcome_email_sent) return { ok: true, sent: false, reason: 'already_sent' };

  const { email, firstName } = await getProfileEmail(userId);
  if (!email) return { ok: false, error: 'No email found for user' };

  const result = await sendWelcomeEmail(userId, email, firstName);
  if (result.sent) {
    await supabase.from('profiles').update({ welcome_email_sent: true }).eq('id', userId);
  }
  return { ok: true, ...result };
}

async function countPostsThisWeek(userId: string): Promise<number> {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const { data } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: false })
    .eq('user_id', userId)
    .gte('created_at', weekStart.toISOString());
  return data?.length || 0;
}

async function alreadySentThisWeek(userId: string, emailType: string): Promise<boolean> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('email_log')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', emailType)
    .eq('status', 'sent')
    .gte('sent_at', weekAgo)
    .limit(1);
  return !!(data && data.length);
}

export async function handleSendFreeLimit(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle();
  if ((profile?.subscription_tier || 'free') !== 'free') return { ok: true, sent: false, reason: 'not on free tier' };

  const count = await countPostsThisWeek(userId);
  if (count !== 3) return { ok: true, sent: false, reason: `post count is ${count}, not 3` };
  if (await alreadySentThisWeek(userId, 'free_limit')) return { ok: true, sent: false, reason: 'already_sent_this_week' };

  const { email, firstName } = await getProfileEmail(userId);
  if (!email) return { ok: false, error: 'No email found for user' };
  const result = await sendFreeLimit(userId, email, firstName);
  await createNotification(
    supabase, userId, 'free_limit_reached', 'Weekly limit reached',
    '🔒 Weekly limit reached. Upgrade to keep posting or wait until Monday.',
    { text: 'Upgrade now', url: 'https://eclatale.com/pricing' }
  );
  return { ok: true, ...result };
}

async function handleSendReengagement(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('last_active_at').eq('id', userId).maybeSingle();
  const { data: posts } = await supabase
    .from('posts')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const lastPostDate = posts?.[0]?.created_at || null;
  const lastActive = profile?.last_active_at || lastPostDate;
  if (!lastActive) return { ok: true, sent: false, reason: 'no activity on record' };

  const daysInactive = (Date.now() - new Date(lastActive).getTime()) / (24 * 60 * 60 * 1000);
  if (daysInactive < 7) return { ok: true, sent: false, reason: `only ${daysInactive.toFixed(1)} days inactive` };
  if (await alreadySentThisWeek(userId, 'reengagement')) return { ok: true, sent: false, reason: 'already_sent_this_week' };

  const { email, firstName } = await getProfileEmail(userId);
  if (!email) return { ok: false, error: 'No email found for user' };

  const { data: allPosts } = await supabase.from('posts').select('created_at').eq('user_id', userId).order('created_at', { ascending: false });
  const growthScore = Math.min(100, Math.round((allPosts?.length || 0) * 4));
  const result = await sendReengagement(userId, email, firstName, {
    lastPostDate: lastPostDate ? new Date(lastPostDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'never',
    streak: 0,
    growthScore,
  });
  return { ok: true, ...result };
}

/** Daily cron: scans all users for the 7-day-inactive re-engagement send. */
async function reengagementCron() {
  const { data: profiles } = await supabase.from('profiles').select('id, notif_post_reminders');
  const results: { userId: string; sent: boolean; reason?: string }[] = [];
  for (const p of profiles || []) {
    if ((p as any).notif_post_reminders === false) continue;
    try {
      const r = await handleSendReengagement((p as any).id);
      results.push({ userId: (p as any).id, sent: !!(r as any).sent, reason: (r as any).reason });
    } catch (e: any) {
      results.push({ userId: (p as any).id, sent: false, reason: e.message });
    }
  }
  return { ok: true, considered: (profiles || []).length, results };
}

/**
 * Meant to be hit hourly by an external cron (Vercel Hobby only allows daily
 * crons — see the CRON_SECRET convention on the other *-cron actions above).
 * Each invocation only actually notifies the slice of users for whom it is
 * currently ~6pm local time, so hourly external calls are what make this
 * work across timezones at all.
 */
async function streakRiskCron() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, timezone, first_name, notif_post_reminders');

  const results: { userId: string; sent: boolean; reason?: string }[] = [];
  for (const p of profiles || []) {
    const userId = (p as any).id;
    if ((p as any).notif_post_reminders === false) { results.push({ userId, sent: false, reason: 'opted_out' }); continue; }

    const tz = (p as any).timezone || 'UTC';
    let localHour = -1;
    let localDateStr = '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      localHour = Number(parts.find(x => x.type === 'hour')?.value || -1);
      const y = parts.find(x => x.type === 'year')?.value, m = parts.find(x => x.type === 'month')?.value, d = parts.find(x => x.type === 'day')?.value;
      localDateStr = `${y}-${m}-${d}`;
    } catch { results.push({ userId, sent: false, reason: 'bad_timezone' }); continue; }

    if (localHour !== 18) continue; // only act on this user's ~6pm hourly pass

    try {
      const { metrics } = await calculateStage(supabase, userId);
      if (metrics.currentStreak < 1) { results.push({ userId, sent: false, reason: 'no_active_streak' }); continue; }

      const { data: todaysPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'published')
        .gte('published_at', `${localDateStr}T00:00:00.000Z`)
        .limit(1);
      if (todaysPosts && todaysPosts.length > 0) { results.push({ userId, sent: false, reason: 'already_posted_today' }); continue; }

      const type = `streak_risk_${localDateStr}`;
      const { data: existing } = await supabase.from('notifications').select('id').eq('user_id', userId).eq('type', type).limit(1);
      if (existing && existing.length > 0) { results.push({ userId, sent: false, reason: 'already_sent_today' }); continue; }

      await createNotification(
        supabase, userId, type, `Your ${metrics.currentStreak}-day streak ends tonight`,
        `⚠️ Post today to keep your ${metrics.currentStreak}-day streak alive!`,
        { text: 'Generate a post', url: 'https://eclatale.com/create' }
      );
      results.push({ userId, sent: true });
    } catch (e: any) {
      results.push({ userId, sent: false, reason: e.message });
    }
  }
  return { ok: true, considered: (profiles || []).length, results };
}

const API_BASE = 'https://api.eclatale.com';

/**
 * Publishes every post whose scheduled_for time has passed. Designed to be
 * safe to call at any interval (Vercel Hobby cron only fires ~daily, so this
 * is also exposed for an external cron service to hit every few minutes for
 * real "publish near the scheduled time" behavior — see CRON_SECRET auth
 * below). Reuses /api/linkedin/publish rather than duplicating its OAuth
 * token handling, rate limiting, and error-message logic.
 */
async function publishScheduledPosts() {
  const { data: due } = await supabase
    .from('posts')
    .select('id, user_id, scheduled_for')
    .eq('schedule_status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .limit(50);

  const results: { postId: string; success: boolean; error?: string }[] = [];
  for (const post of due || []) {
    try {
      const publishRes = await fetch(`${API_BASE}/api/linkedin/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, userId: post.user_id }),
      });
      const publishData: any = await publishRes.json();
      if (publishRes.ok && publishData.success) {
        await supabase.from('posts').update({ schedule_status: 'published' }).eq('id', post.id);
        await createNotification(
          supabase, post.user_id, 'scheduled_post_published', 'Your scheduled post went live',
          'The post you scheduled just published to LinkedIn.',
          { text: 'View on LinkedIn', url: 'https://www.linkedin.com/feed/' }
        );
        results.push({ postId: post.id, success: true });
      } else {
        const errorMsg = publishData.error || 'Unknown publish error';
        await supabase.from('posts').update({ schedule_status: 'failed' }).eq('id', post.id);
        await createNotification(
          supabase, post.user_id, 'scheduled_post_failed', 'A scheduled post failed to publish',
          `We couldn't publish your scheduled post: ${errorMsg}`,
          { text: 'Retry now', url: 'https://eclatale.com/history' }
        );
        results.push({ postId: post.id, success: false, error: errorMsg });
      }
    } catch (e: any) {
      await supabase.from('posts').update({ schedule_status: 'failed' }).eq('id', post.id);
      results.push({ postId: post.id, success: false, error: e.message });
    }
  }
  return { ok: true, checked: (due || []).length, results };
}

async function handleUnsubscribe(token: string, type: string) {
  const { data: profile } = await supabase.from('profiles').select('id').eq('unsubscribe_token', token).maybeSingle();
  if (!profile) return { ok: false, error: 'Invalid or expired unsubscribe link' };

  const columnMap: Record<string, string> = {
    notif_weekly_digest: 'notif_weekly_digest',
    notif_post_reminders: 'notif_post_reminders',
    notif_industry_briefing: 'notif_industry_briefing',
    digest: 'notif_weekly_digest',
    reengagement: 'notif_post_reminders',
    industry_briefing: 'notif_industry_briefing',
  };
  const column = columnMap[type];
  if (!column) return { ok: false, error: 'Unknown email type' };

  await supabase.from('profiles').update({ [column]: false }).eq('id', profile.id);
  return { ok: true, unsubscribedFrom: column };
}

// ---- Persona signal actions (folded in here for the same reason). ----

async function logPersonaSignal(userId: string, postId: string | null, action: string, tone: string | null, contentType: string | null, topicSnippet: string | null, postLength: number | null) {
  const { error } = await supabase.from('persona_signals').insert({
    user_id: userId, post_id: postId, action, tone, content_type: contentType, topic_snippet: topicSnippet, post_length: postLength,
  });
  if (error) throw new Error(error.message || 'Insert failed');
  return { success: true };
}

// ---- Notification + push actions (folded in here for the same reason as
// email actions above: staying under the Hobby-plan 12-serverless-function cap). ----

async function listNotifications(userId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(20);
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return { notifications: data || [], unreadCount: unreadCount || 0 };
}

async function markNotificationRead(userId: string, id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', userId);
  return { ok: true };
}

async function markAllNotificationsRead(userId: string) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  return { ok: true };
}

async function deleteNotification(userId: string, id: string) {
  await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
  return { ok: true };
}

async function pushSubscribe(userId: string, subscription: any) {
  await supabase.from('push_subscriptions').insert({ user_id: userId, subscription });
  return { ok: true };
}

async function getEmailPreferences(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('notif_weekly_digest, notif_post_reminders, notif_publish_confirm')
    .eq('id', userId)
    .maybeSingle();
  return {
    digest: data?.notif_weekly_digest !== false,
    reengagement: data?.notif_post_reminders !== false,
    publishConfirm: data?.notif_publish_confirm !== false,
  };
}

async function updateEmailPreferences(userId: string, updates: Record<string, boolean>) {
  const patch: Record<string, boolean> = {};
  if ('digest' in updates) patch.notif_weekly_digest = updates.digest;
  if ('reengagement' in updates) patch.notif_post_reminders = updates.reengagement;
  if ('publishConfirm' in updates) patch.notif_publish_confirm = updates.publishConfirm;
  await supabase.from('profiles').update(patch).eq('id', userId);
  return getEmailPreferences(userId);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.method === 'POST' ? (req.body || {}) : {};
    // Query-string action (set by vercel.json rewrites for /api/persona-signal,
    // /api/notifications, etc.) takes priority over a same-named field in the
    // POST body, since callers like persona-signal legitimately send their own
    // `action` field (e.g. "kept") in the body.
    const action = String(req.query.action || body.action || '');
    const rawUserId = String(body.userId || req.query.userId || '');
    let userId = rawUserId;
    if (rawUserId) {
      const authCheck = await checkAuthToken(supabase, req);
      const reconciled = reconcileUserId(rawUserId, authCheck);
      if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
      userId = reconciled.userId;
    }
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

    if (action === 'weekly-industry-briefing-cron') {
      const secret = String(body.secret || req.query.secret || '');
      if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = await weeklyIndustryBriefingCron(anthropic, supabase);
      return res.json(result);
    }

    if (action === 'weekly-industry-briefing') {
      const adminSecret = String(body.adminSecret || req.query.adminSecret || '');
      if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const targetUserId = String(body.targetUserId || body.userId || req.query.userId || '');
      if (!targetUserId) return res.status(400).json({ error: 'Missing targetUserId' });
      const doSend = body.send === true || req.query.send === 'true';
      const result = await sendBriefingToUser(anthropic, supabase, targetUserId, doSend);
      return res.json(result);
    }

    if (action === 'reengagement-cron') {
      const secret = String(body.secret || req.query.secret || '');
      if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.json(await reengagementCron());
    }

    if (action === 'publish-scheduled-posts') {
      const secret = String(body.secret || req.query.secret || '');
      if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.json(await publishScheduledPosts());
    }

    if (action === 'streak-risk-cron') {
      const secret = String(body.secret || req.query.secret || '');
      if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.json(await streakRiskCron());
    }

    if (action === 'schedule-post') {
      const postId = String(body.postId || '');
      const scheduledFor = String(body.scheduledFor || '');
      if (!userId || !postId || !scheduledFor) return res.status(400).json({ error: 'Missing userId, postId, or scheduledFor' });
      const when = new Date(scheduledFor);
      if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60000) {
        return res.status(400).json({ error: 'scheduledFor must be a valid future time' });
      }
      const maxDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      if (when > maxDate) return res.status(400).json({ error: 'Cannot schedule more than 60 days ahead' });
      const { error } = await supabase.from('posts')
        .update({ scheduled_for: when.toISOString(), schedule_status: 'scheduled' })
        .eq('id', postId).eq('user_id', userId);
      if (error) return res.status(500).json({ error: 'Failed to schedule post' });
      return res.json({ ok: true, scheduledFor: when.toISOString() });
    }

    if (action === 'cancel-scheduled-post') {
      const postId = String(body.postId || '');
      if (!userId || !postId) return res.status(400).json({ error: 'Missing userId or postId' });
      const { data: post } = await supabase.from('posts').select('scheduled_for, schedule_status').eq('id', postId).eq('user_id', userId).maybeSingle();
      if (!post) return res.status(404).json({ error: 'Post not found' });
      if (post.schedule_status === 'scheduled' && post.scheduled_for && new Date(post.scheduled_for).getTime() - Date.now() < 5 * 60 * 1000) {
        return res.status(400).json({ error: 'Too close to the scheduled time to cancel — it will publish shortly.' });
      }
      await supabase.from('posts').update({ schedule_status: 'cancelled', scheduled_for: null }).eq('id', postId);
      return res.json({ ok: true });
    }

    if (action === 'unsubscribe') {
      const token = String(body.token || req.query.token || '');
      const type = String(body.type || req.query.type || '');
      if (!token || !type) return res.status(400).json({ error: 'Missing token or type' });
      return res.json(await handleUnsubscribe(token, type));
    }

    if (action === 'newsletter-subscribe') {
      const email = String(body.email || req.query.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
      const { error } = await supabase.from('newsletter_subscribers').upsert({ email }, { onConflict: 'email' });
      if (error) return res.status(500).json({ error: 'Subscribe failed' });
      return res.json({ ok: true });
    }

    if (action === 'demo-lead') {
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const topic = String(body.topic || '').trim();
      const postContent = String(body.postContent || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
      // Save to newsletter_subscribers (upsert = no duplicates)
      await supabase.from('newsletter_subscribers').upsert({ email }, { onConflict: 'email' });
      // Also log the demo lead with context (silent if table doesn't exist)
      try {
        await supabase.from('demo_leads').upsert(
          { email, name: name || null, topic: topic || null, post_content: postContent || null, created_at: new Date().toISOString() },
          { onConflict: 'email' }
        );
      } catch (_) {}
      // Fire-and-forget follow-up email
      const firstName = name ? name.split(' ')[0] : '';
      sendDemoLeadEmail(email, firstName, topic, postContent).catch(() => {});
      return res.json({ ok: true });
    }

    // Anonymous, public /tools pages — no auth, IP rate-limited (10/hr).
    if (action === 'tools-generate') {
      const tool = String(body.tool || '');
      const ip = extractClientIp(req.headers as any, req.socket?.remoteAddress || 'unknown');
      const allowed = await checkToolRateLimit(supabase, ip);
      if (!allowed) {
        return res.status(429).json({ error: 'rate_limited', message: "You've hit the free tool limit for this hour — try again soon, or sign up for unlimited access." });
      }
      await logToolUsage(supabase, ip, tool);
      try {
        switch (tool) {
          case 'hook-generator': {
            const hooks = await generateHooks(anthropic, String(body.topic || ''), String(body.style || 'Contrarian'));
            return res.json({ hooks });
          }
          case 'post-generator': {
            const content = await generateDemoPost(anthropic, String(body.topic || ''), String(body.style || 'storyteller'), String(body.length || 'standard'));
            return res.json({ content, wordCount: content ? content.trim().split(/\s+/).length : 0 });
          }
          case 'headline-analyzer': {
            const result = await analyzeHeadline(anthropic, String(body.headline || ''));
            return res.json(result);
          }
          case 'viral-score': {
            const result = await scoreViralPotential(anthropic, String(body.post || ''));
            return res.json(result);
          }
          case 'about-generator': {
            const content = await generateAboutSection(
              anthropic, String(body.role || ''), String(body.industry || ''), String(body.specialty || ''), String(body.achievement || ''), String(body.tone || 'Professional')
            );
            return res.json({ content });
          }
          case 'cta-generator': {
            const ctas = await generateCTAs(anthropic, String(body.topic || ''), String(body.goal || 'Comment'));
            return res.json({ ctas });
          }
          default:
            return res.status(400).json({ error: 'Unknown tool' });
        }
      } catch (error: any) {
        if (isCreditsExhaustedError(error)) return res.status(503).json(creditsExhaustedBody());
        console.error('tools-generate error:', error);
        return res.status(500).json({ error: error.message || 'Tool generation failed' });
      }
    }

    if (action === 'fetch-url') {
      const url = String(body.url || '').trim();
      if (!url) return res.status(400).json({ error: 'Missing url' });
      let parsed: URL;
      try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

      const host = parsed.hostname.replace(/^www\./, '');
      if (/(^|\.)linkedin\.com$/.test(host)) {
        return res.status(422).json({ error: 'linkedin_private', message: 'LinkedIn content is private — paste the post text here instead.' });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const pageRes = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EclataleBot/1.0; +https://eclatale.com)' },
        });
        clearTimeout(timeout);
        if (!pageRes.ok) {
          return res.status(422).json({ error: 'fetch_failed', message: "Couldn't fetch this URL — paste the text directly instead." });
        }
        const html = await pageRes.text();
        const text = extractReadableText(html);
        if (text.length < 200) {
          return res.status(422).json({ error: 'fetch_failed', message: "Couldn't extract readable content from this URL — paste the text directly instead." });
        }
        return res.json({ text: text.slice(0, 6000), domain: host });
      } catch {
        return res.status(422).json({ error: 'fetch_failed', message: "Couldn't fetch this URL — paste the text directly instead." });
      }
    }

    if (action === 'aria-chat') {
      const message = String(body.message || '').trim();
      const currentPage = String(body.currentPage || '/dashboard');
      const conversationHistory: AriaMessage[] = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
      if (!userId || !message) return res.status(400).json({ error: 'Missing userId or message' });
      const result = await ariaChat(anthropic, supabase, userId, message, conversationHistory, currentPage);
      return res.json(result);
    }

    if (action === 'aria-history') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const messages = await getAriaConversation(supabase, userId);
      return res.json({ messages });
    }

    if (action === 'voice-match-score') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const result = await calculateVoiceMatchScore(supabase, userId);
      return res.json(result);
    }

    if (action === 'persona-signal') {
      if (!userId || !body.action) return res.status(400).json({ error: 'Missing userId or action' });
      const result = await logPersonaSignal(
        userId, body.postId || null, body.action, body.tone || null, body.contentType || null, body.topicSnippet || null, body.postLength || null
      );
      return res.json(result);
    }

    if (action === 'notifications-list') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      return res.json(await listNotifications(userId));
    }

    if (action === 'notifications-mark-read') {
      const id = String(body.id || req.query.id || '');
      if (!userId || !id) return res.status(400).json({ error: 'Missing userId or id' });
      return res.json(await markNotificationRead(userId, id));
    }

    if (action === 'notifications-mark-all-read') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      return res.json(await markAllNotificationsRead(userId));
    }

    if (action === 'notifications-item') {
      const id = String(body.id || req.query.id || '');
      if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
      if (!userId || !id) return res.status(400).json({ error: 'Missing userId or id' });
      return res.json(await deleteNotification(userId, id));
    }

    if (action === 'push-subscribe') {
      if (!userId || !body.subscription) return res.status(400).json({ error: 'Missing userId or subscription' });
      return res.json(await pushSubscribe(userId, body.subscription));
    }

    if (action === 'email-preferences') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      if (req.method === 'GET') return res.json({ ok: true, preferences: await getEmailPreferences(userId) });
      if (req.method === 'PUT' || req.method === 'POST') return res.json({ ok: true, preferences: await updateEmailPreferences(userId, body.updates || {}) });
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    switch (action) {
      case 'send-welcome':
        return res.json(await handleSendWelcome(userId));
      case 'send-free-limit':
        return res.json(await handleSendFreeLimit(userId));
      case 'send-reengagement':
        return res.json(await handleSendReengagement(userId));
      case 'competitor':
      case 'competitor-intelligence': {
        const locked = await requireFeature(supabase, userId, 'competitorIntelligence');
        if (locked) return res.status(403).json(locked);
        const result = await competitorIntelligence(userId, forceRefresh);
        return res.json(result);
      }
      case 'best-time':
      case 'best-time-to-post': {
        const locked = await requireFeature(supabase, userId, 'bestTimeToPost');
        if (locked) return res.status(403).json(locked);
        const result = await bestTimeToPost(userId, forceRefresh);
        return res.json(result);
      }
      case 'growth-score': {
        const result = await growthScore(userId, forceRefresh);
        return res.json(result);
      }
      case 'growth-journey': {
        const [progress, momentum, newlyUnlocked] = await Promise.all([
          getProgress(supabase, userId),
          getMomentum(supabase, userId),
          checkMilestones(supabase, userId),
        ]);
        const { data: profile } = await supabase.from('profiles').select('milestone_badges').eq('id', userId).single();
        return res.json({
          stage: progress.stage,
          nextStage: progress.nextStage,
          criteria: progress.criteria,
          metrics: progress.metrics,
          momentum,
          badges: profile?.milestone_badges || [],
          newlyUnlocked,
        });
      }
      case 'dashboard-overview': {
        const days = Math.max(1, Math.min(365, Number(body.days || req.query.days || 30)));
        const [brandHealth, postingActivity, contentPerformance, styleDistribution, activityFeed, profile, growthScoreHistory, stageResult, voiceMatch] = await Promise.all([
          computeBrandHealth(supabase, userId),
          getPostingActivity(supabase, userId, days),
          getContentPerformance(supabase, userId, days),
          getStyleDistribution(supabase, userId),
          getActivityFeed(supabase, userId, 20),
          supabase.from('profiles').select('subscription_tier, posts_this_week, longest_streak').eq('id', userId).maybeSingle(),
          getGrowthScoreHistory(supabase, userId),
          calculateStage(supabase, userId),
          calculateVoiceMatchScore(supabase, userId).catch(() => null),
        ]);
        return res.json({
          brandHealth, postingActivity, contentPerformance, styleDistribution, activityFeed, growthScoreHistory,
          subscriptionTier: (profile.data as any)?.subscription_tier || 'free',
          postsThisWeek: (profile.data as any)?.posts_this_week || 0,
          longestStreak: (profile.data as any)?.longest_streak || 0,
          totalPostsPublished: stageResult.metrics.postsPublished,
          currentStreak: stageResult.metrics.currentStreak,
          bestWeek: stageResult.metrics.bestWeek,
          stage: stageResult.stage,
          linkedinConnected: stageResult.metrics.linkedinConnected,
          voiceMatch: voiceMatch ? (voiceMatch as any).score : null,
          updatedAt: new Date().toISOString(),
        });
      }
      case 'dashboard-recommendations': {
        const cacheKind = 'dashboard-recommendations';
        if (!forceRefresh) {
          const cached = await readCache(supabase, userId, cacheKind, 24 * 60 * 60 * 1000);
          if (cached) return res.json(cached);
        }
        const recommendations = await generateRecommendations(anthropic, supabase, userId);
        const payload = { recommendations, generatedAt: new Date().toISOString() };
        await writeCache(supabase, userId, cacheKind, payload);
        return res.json(payload);
      }
      case 'dashboard-table': {
        const page = Math.max(0, Number(body.page || req.query.page || 0));
        const pageSize = Math.max(1, Math.min(50, Number(body.pageSize || req.query.pageSize || 10)));
        const result = await getContentTable(supabase, userId, page, pageSize);
        return res.json(result);
      }
      case 'analyze-post': {
        const postId = String(body.postId || '');
        const postContent = String(body.postContent || '');
        const contentLength = body.contentLength ? String(body.contentLength) : undefined;
        if (!postId || !postContent) return res.status(400).json({ error: 'Missing postId or postContent' });
        const analysis = await analyzePost(anthropic, supabase, postContent, userId, postId, contentLength);
        return res.json({ ok: true, analysis });
      }
      case 'user-patterns': {
        const result = await userPatterns(userId, forceRefresh);
        return res.json(result);
      }
      case 'tone-match': {
        const intendedTone = String(body.intendedTone || '');
        const postContent = String(body.postContent || '');
        if (!intendedTone || !postContent) return res.status(400).json({ error: 'Missing intendedTone or postContent' });
        const result = await compareIntendedVsActualTone(anthropic, intendedTone, postContent);
        return res.json(result);
      }
      case 'authenticity-score': {
        const locked = await requireFeature(supabase, userId, 'authenticityScore');
        if (locked) return res.status(403).json(locked);
        const postId = String(body.postId || '');
        const postContent = String(body.postContent || '');
        const topic = String(body.topic || '');
        const contentLength = body.contentLength ? String(body.contentLength) : undefined;
        if (!postId || !postContent) return res.status(400).json({ error: 'Missing postId or postContent' });
        const result = await authenticityScore(userId, postId, postContent, topic, forceRefresh, contentLength);
        return res.json(result);
      }
      case 'page-view': {
        const feature = String(body.feature || req.query.feature || '');
        const path = String(body.path || req.query.path || '');
        if (!feature) return res.status(400).json({ error: 'Missing feature' });
        await supabase.from('page_views').insert({ user_id: userId, feature, path: path || null });
        return res.json({ ok: true });
      }
      case 'create-talk-start': {
        const topic = String(body.topic || '').trim();
        if (!topic) return res.status(400).json({ error: 'Missing topic' });
        const sources = await searchSourcesForTopic(anthropic, topic).catch(() => []);
        const qMessage = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: `Someone wants to write a LinkedIn post about: "${topic}". Ask them ONE short, genuinely useful clarifying question to sharpen the post (e.g. personal experience vs industry insight, who the reader is, what the goal is). Return ONLY the question, no preamble, no quotes.` }],
        });
        const clarifyingQuestion = qMessage.content[0].type === 'text' ? qMessage.content[0].text.trim() : '';
        return res.json({ sources, clarifyingQuestion });
      }
      case 'create-talk-generate': {
        const topic = String(body.topic || '').trim();
        const styleId = String(body.style || 'storyteller');
        const lengthId = String(body.length || 'standard');
        const clarifyingAnswer = String(body.clarifyingAnswer || '');
        const sources: any[] = Array.isArray(body.sources) ? body.sources : [];
        const resourceContext = String(body.resourceContext || '').trim();
        if (!topic || !userId) return res.status(400).json({ error: 'Missing topic or userId' });

        const style = getWritingStyle(styleId);
        const personaFragment = await buildPersonaPrompt(supabase, userId);
        const sourcesFragment = sources.length
          ? `\nRelevant current sources you may draw on (cite naturally, don't just list them):\n${sources.map(s => `- ${s.title} (${s.domain}): ${s.excerpt}`).join('\n')}\n`
          : '';
        const resourceFragment = resourceContext
          ? `\nSource material the writer dropped in — ground the post in this, don't ignore it:\n${truncateForPrompt(resourceContext, 6000)}\n`
          : '';

        const systemPrompt = `${getDateContext()}

${personaFragment ? personaFragment + '\n' : ''}${style?.prompt || ''}

${clarifyingAnswer ? `Context from the writer: ${clarifyingAnswer}\n` : ''}${sourcesFragment}${resourceFragment}
${lengthInstruction(lengthId)}

${UNIVERSAL_HUMAN_WRITING_RULES}

Output ONLY the LinkedIn post text. No preamble, no explanation, no markdown formatting, no quotes around it.`;

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1400,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Write the post about: ${topic}` }],
        });
        const content = message.content[0].type === 'text' ? message.content[0].text : '';
        const avgTrust = sources.length ? Math.round(sources.reduce((s, x) => s + (x.trustScore || 0), 0) / sources.length) : null;
        return res.json({ content, styleLabel: style?.label || styleId, sourcesUsed: sources, sourceTrust: avgTrust });
      }
      case 'content-discovery': {
        const query = String(body.query || '').trim();
        const cacheSlug = query
          ? `q-${query.toLowerCase().replace(/\W+/g, '-').slice(0, 30)}`
          : 'auto';
        const cacheKind = `discovery-${cacheSlug}`;

        if (!forceRefresh) {
          const cached = await readCache(supabase, userId, cacheKind, 2 * 60 * 60 * 1000);
          if (cached) return res.json(cached);
        }

        const { role, industry } = await getProfile(userId);

        const today = new Date().toISOString().slice(0, 10);
        const searchInstruction = query
          ? `Today is ${today}. Search for the most recent high-quality articles published in the last 14 days about: "${query}". Prioritise articles from the last 7 days. Include diverse perspectives and source types. Aim for 8 articles.`
          : `Today is ${today}. You are discovering content for a ${role} in ${industry}. Do 2 targeted searches to find the most recent articles from the last 14 days:
1. Search: "${industry} news ${today.slice(0, 7)}" — find 5 fresh industry headlines
2. Search: "${role} leadership AI ${today.slice(0, 7)}" — find 5 leadership and tech insights

Only include articles published in the last 30 days. Prefer the last 7 days. Use reputable publications.`;

        const message = await (anthropic.messages.create as any)({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
          messages: [{
            role: 'user',
            content: `${searchInstruction}

After searching, return ONLY a valid JSON array with no prose or markdown fences:
[{"title":"...","url":"...","domain":"example.com","excerpt":"one clear sentence summary of the key insight","publishedDate":"YYYY-MM-DD or null","category":"Industry News|Trends|Leadership|Technology|Research|Opinion|Marketing|Career|Innovation"}]`,
          }],
        });

        const textBlock = (message.content || []).find((b: any) => b.type === 'text');
        const raw = textBlock?.text || '[]';
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        let rawItems: any[] = [];
        try { rawItems = JSON.parse(jsonMatch ? jsonMatch[0] : raw); } catch { rawItems = []; }

        const toTimestamp = (d: string | null) => d ? new Date(d).getTime() : 0;
        const items = rawItems.slice(0, 16).map((item: any) => {
          const domain = String(item.domain || extractDomain(String(item.url || '')));
          return {
            title: String(item.title || '').slice(0, 200),
            url: String(item.url || ''),
            domain,
            excerpt: String(item.excerpt || '').slice(0, 300),
            publishedDate: item.publishedDate || null,
            trustScore: computeTrustScore(domain, item.publishedDate || null),
            category: String(item.category || 'General'),
          };
        }).filter((item: any) => item.url && item.title)
          .sort((a: any, b: any) => toTimestamp(b.publishedDate) - toTimestamp(a.publishedDate));

        // Fallback: if web_search yielded nothing (credits exhausted), generate
        // topic-level recommendations without live search so users see something.
        let finalItems = items;
        if (items.length === 0) {
          const fbMsg = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            messages: [{
              role: 'user',
              content: `You are a content curator for a ${role} in ${industry}. Generate 8 highly relevant article recommendations they should read this week. Use your knowledge of the industry to suggest specific, realistic articles with plausible publication details.\n\nReturn ONLY a valid JSON array (no prose):\n[{"title":"...","url":"https://example.com/article","domain":"example.com","excerpt":"one sentence key insight","publishedDate":"${today}","category":"Industry News|Trends|Leadership|Technology|Research|Opinion"}]`,
            }],
          });
          const fbText = fbMsg.content[0].type === 'text' ? fbMsg.content[0].text : '[]';
          const fbMatch = fbText.match(/\[[\s\S]*\]/);
          let fbRaw: any[] = [];
          try { fbRaw = JSON.parse(fbMatch ? fbMatch[0] : fbText); } catch { fbRaw = []; }
          finalItems = fbRaw.slice(0, 8).map((item: any) => {
            const domain = String(item.domain || extractDomain(String(item.url || '')));
            return {
              title: String(item.title || '').slice(0, 200),
              url: String(item.url || ''),
              domain,
              excerpt: String(item.excerpt || '').slice(0, 300),
              publishedDate: item.publishedDate || null,
              trustScore: computeTrustScore(domain, item.publishedDate || null),
              category: String(item.category || 'General'),
            };
          }).filter((item: any) => item.url && item.title);
        }

        const payload = { items: finalItems, role, industry, query: query || null };
        // Don't cache empty results — forces fresh generation on next load
        if (finalItems.length > 0) {
          await writeCache(supabase, userId, cacheKind, payload);
        }
        return res.json({ ...payload, generatedAt: new Date().toISOString(), cached: false });
      }
      case 'profile-optimizer': {
        const locked = await requireFeature(supabase, userId, 'profileOptimizer');
        if (locked) return res.status(403).json(locked);

        const cacheKind = 'profile-optimizer';
        if (!forceRefresh) {
          const cached = await readCache(supabase, userId, cacheKind, 24 * 60 * 60 * 1000);
          if (cached) return res.json({ ...cached, cached: true });
        }

        const { role, industry } = await getProfile(userId);
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('bio, seniority_level, company_name, goals, first_name')
          .eq('id', userId)
          .maybeSingle();

        const headline = String(body.headline || '').trim();
        const about = String(body.about || profileRow?.bio || '').trim();
        if (!headline && !about) return res.status(400).json({ error: 'Provide a headline or About section to analyze' });

        const seniority = profileRow?.seniority_level || '';
        const company = profileRow?.company_name || '';
        const goals: string[] = profileRow?.goals || [];

        const prompt = `You are a LinkedIn profile expert. Analyze this LinkedIn profile for a ${seniority ? seniority + ' ' : ''}${role} in ${industry}${company ? ` at ${company}` : ''}.

${headline ? `HEADLINE:\n${headline}\n` : ''}${about ? `\nABOUT SECTION:\n${about}\n` : ''}${goals.length ? `\nUser goals: ${goals.join(', ')}` : ''}

Return ONLY valid JSON with this exact shape:
{
  "headlineScore": <0-100, omit if no headline provided>,
  "aboutScore": <0-100, omit if no about provided>,
  "headlineStrengths": [<1-2 short strings, omit if no headline>],
  "headlineIssues": [<1-3 specific improvement areas, omit if no headline>],
  "aboutStrengths": [<1-2 short strings, omit if no about>],
  "aboutIssues": [<1-3 specific improvement areas, omit if no about>],
  "optimizedHeadline": "<rewritten headline under 220 chars, omit if none provided>",
  "optimizedAbout": "<rewritten About section, preserve voice, max 2600 chars, omit if none provided>",
  "quickWins": ["<3 concrete one-sentence actions ranked by impact>"]
}`;

        const message = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1800,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
        const parsed = parseJsonObject(text);
        const payload = { ...parsed, generatedAt: new Date().toISOString(), cached: false };
        await writeCache(supabase, userId, cacheKind, parsed);
        return res.json(payload);
      }
      case 'create-angles': {
        const result = await createAngles(anthropic, supabase, userId, forceRefresh);
        return res.json(result);
      }
      case 'trending-preview': {
        const { industry } = await getProfile(userId);
        const cacheKind = `trending-preview-${industry.slice(0, 40)}`;
        const cached = !forceRefresh ? await readCache(supabase, userId, cacheKind, 30 * 60 * 1000) : null;
        if (cached) return res.json(cached);
        const today = new Date().toISOString().slice(0, 10);
        const trendMsg = await (anthropic.messages.create as any)({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
          system: getDateContext(),
          messages: [{ role: 'user', content: `Today is ${today}. Search for the top 3 trending topics in ${industry} right now. Return ONLY valid JSON (no prose, no markdown): {"topics":["2-5 word topic 1","2-5 word topic 2","2-5 word topic 3"]}` }],
        });
        const trendText = ((trendMsg.content || []).find((b: any) => b.type === 'text') || {}).text || '{}';
        let trendParsed: any = {};
        try { trendParsed = JSON.parse((trendText.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch { trendParsed = {}; }
        const topics: string[] = Array.isArray(trendParsed.topics) ? trendParsed.topics.slice(0, 3) : [];
        const trendResult = { topics, industry, generatedAt: new Date().toISOString() };
        await writeCache(supabase, userId, cacheKind, { topics, industry });
        return res.json(trendResult);
      }
      case 'from-idea': {
        const idea = String(body.idea || '').trim();
        if (!idea) return res.status(400).json({ error: 'Missing idea' });
        const { role, industry } = await getProfile(userId);
        const styleNames = Object.keys(ANGLE_STYLE_META).join(', ');
        const ideaMsg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: getDateContext(),
          messages: [{ role: 'user', content: `Generate 5 distinct LinkedIn post angles based on this idea from a ${role} in ${industry}:\n\nIDEA: "${idea.slice(0, 500)}"\n\nFor each angle:\n- Write a compelling hook (2-3 sentences) that directly builds on their idea\n- Assign a style from exactly these options (use exact casing): ${styleNames}\n- Write one sentence explaining why this framing works\n- Add a realistic performance stat\n\nReturn ONLY valid JSON (no prose, no markdown):\n{"angles":[{"style":"Contrarian","hook":"...","insight":"...","performanceStat":"..."}]}` }],
        });
        const ideaText = ideaMsg.content[0].type === 'text' ? ideaMsg.content[0].text : '{}';
        let ideaParsed: any = {};
        try { ideaParsed = JSON.parse((ideaText.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch { ideaParsed = {}; }
        const rawAngles: any[] = Array.isArray(ideaParsed.angles) ? ideaParsed.angles : [];
        const angles = rawAngles.slice(0, 5).map((a: any, i: number) => {
          const meta = ANGLE_STYLE_META[a.style] || ANGLE_STYLE_META.Storyteller;
          return {
            id: `idea-angle-${Date.now()}-${i}`,
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
        return res.json({ angles, sources: [], generatedAt: new Date().toISOString() });
      }
      case 'industry-briefing-preview': {
        // Read-only, user-scoped preview of their own weekly briefing data —
        // for the in-app Dashboard card. Distinct from the admin-gated
        // 'weekly-industry-briefing' action, which actually sends the email.
        const cached = !forceRefresh ? await readCache(supabase, userId, 'weekly-briefing-preview', 12 * 60 * 60 * 1000) : null;
        if (cached) return res.json(cached);
        const data = await buildBriefingData(anthropic, supabase, userId);
        if (!data) return res.status(404).json({ error: 'Could not build briefing preview' });
        await writeCache(supabase, userId, 'weekly-briefing-preview', data);
        return res.json(data);
      }
      case 'industry-intelligence': {
        let role = String(body.role || '').trim();
        let domain = String(body.domain || '').trim();
        if (!role || !domain) {
          const profile = await getProfile(userId);
          role = role || profile.role;
          domain = domain || profile.industry;
        }
        const result = await getIndustryIntelligence(anthropic, supabase, role, domain, forceRefresh);
        return res.json(result);
      }
      case 'create-hooks': {
        const profile = await getProfile(userId);
        const result = await getHookLibrary(anthropic, supabase, userId, profile.role, profile.industry);
        return res.json(result);
      }
      case 'library-tags-suggest': {
        const postContent = String(body.postContent || '').trim();
        if (!postContent) return res.status(400).json({ error: 'Missing postContent' });
        const message = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{ role: 'user', content: `Extract 3-7 short content tags for this LinkedIn post, in the style #LeadershipLessons, #AIMarketing, #StartupGrowth (PascalCase, no spaces, one hashtag each). Return ONLY a JSON array of strings, e.g. ["#Leadership","#AI"].\n\nPost:\n${postContent.slice(0, 2000)}` }],
        });
        const raw = message.content[0].type === 'text' ? message.content[0].text : '[]';
        const match = raw.match(/\[[\s\S]*\]/);
        let tags: string[] = [];
        try { tags = JSON.parse(match ? match[0] : raw); } catch { tags = []; }
        return res.json({ tags: tags.slice(0, 7) });
      }
      case 'library-search': {
        const query = String(body.query || '').trim();
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        let postsQuery = supabase.from('posts').select('id, content, topic, created_at, status').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
        if (query && !query.startsWith('#')) postsQuery = postsQuery.ilike('content', `%${query}%`);
        const { data: posts } = await postsQuery;
        if (!posts?.length) return res.json({ posts: [] });

        const { data: analytics } = await supabase.from('post_analytics').select('post_id, topic_tags').in('post_id', posts.map(p => p.id));
        const tagsByPost: Record<string, string[]> = {};
        for (const a of analytics || []) tagsByPost[a.post_id] = a.topic_tags || [];

        let results = posts.map(p => ({ ...p, tags: tagsByPost[p.id] || [] }));
        if (query.startsWith('#')) {
          const tagQuery = query.slice(1).toLowerCase();
          results = results.filter(p => p.tags.some(t => t.toLowerCase().includes(tagQuery)));
        }
        return res.json({ posts: results });
      }
      case 'resource-analyze': {
        const resourceText = String(body.resourceText || '').trim();
        const resourceLabel = String(body.resourceLabel || 'this resource');
        if (!resourceText) return res.status(400).json({ error: 'Missing resourceText' });
        const message = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{ role: 'user', content: `Analyze ${resourceLabel} below. Return ONLY JSON: {"keyThemes": ["3-5 short bullet themes"], "angles": ["2-4 specific LinkedIn post angle ideas grounded in this content"], "openingLine": "one sentence a brand assistant would say to open a conversation about this, referencing the single most interesting insight"}\n\nContent:\n${truncateForPrompt(resourceText)}` }],
        });
        const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
        const match = raw.match(/\{[\s\S]*\}/);
        let parsed: any = {};
        try { parsed = JSON.parse(match ? match[0] : raw); } catch { parsed = {}; }
        return res.json(parsed);
      }
      case 'resource-converse': {
        const resourceTexts: string[] = Array.isArray(body.resourceTexts) ? body.resourceTexts : [];
        const history: { role: string; content: string }[] = Array.isArray(body.history) ? body.history : [];
        const message = String(body.message || '').trim();
        if (!message) return res.status(400).json({ error: 'Missing message' });
        const contextBlock = resourceTexts.map((t, i) => `--- Resource ${i + 1} ---\n${truncateForPrompt(t, 6000)}`).join('\n\n');
        // The UI's opening line is an assistant message shown before any user
        // reply — Anthropic's Messages API requires the array to start with
        // "user", so drop any leading assistant turns before sending.
        const trimmedHistory = [...history];
        while (trimmedHistory.length && trimmedHistory[0].role !== 'user') trimmedHistory.shift();
        const reply = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          system: `You are a sharp, conversational content strategist helping someone turn source material into a LinkedIn post. You have access to the following resource(s):\n\n${contextBlock}\n\nSuggest specific angles, ask clarifying questions, and be genuinely useful — never generic. Keep replies to 2-4 sentences, conversational tone.`,
          messages: [...trimmedHistory.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })), { role: 'user', content: message }],
        });
        const text = reply.content[0].type === 'text' ? reply.content[0].text : '';
        return res.json({ reply: text });
      }
      case 'resource-upload': {
        const fileBase64 = String(body.fileBase64 || '');
        const mimeType = String(body.mimeType || '');
        const filename = String(body.filename || 'file');
        if (!fileBase64) return res.status(400).json({ error: 'Missing fileBase64' });
        const buffer = Buffer.from(fileBase64, 'base64');
        try {
          let text = '';
          let pageCount: number | undefined;
          if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
            const result = await extractPdfText(buffer);
            text = result.text; pageCount = result.pageCount;
          } else if (mimeType.includes('wordprocessingml') || filename.endsWith('.docx')) {
            text = await extractDocxText(buffer);
          } else if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
            text = extractCsvSummary(buffer.toString('utf-8'));
          } else {
            text = buffer.toString('utf-8');
          }
          if (!text.trim()) return res.status(422).json({ error: 'Could not extract any text from this file.' });
          return res.json({ text: truncateForPrompt(text), pageCount });
        } catch (e: any) {
          return res.status(422).json({ error: e.message || 'Failed to parse file' });
        }
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    if (isCreditsExhaustedError(error)) {
      console.error('Anthropic credits exhausted');
      return res.status(503).json(creditsExhaustedBody());
    }
    console.error('Intelligence error:', error);
    res.status(500).json({ error: error.message || 'Intelligence request failed' });
  }
}
