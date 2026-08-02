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
import { analyzePost, analyzeUserPatterns, compareIntendedVsActualTone } from '../lib/semanticAnalysis';
import { getDateContext } from '../lib/dateContext';
import { getTrendContext, buildTrendPromptFragment } from '../lib/trendContext';
import { calculateAuthenticityScore } from '../lib/authenticityScore';
import { isCreditsExhaustedError, creditsExhaustedBody } from '../lib/anthropicErrors';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { sendWelcomeEmail, sendFreeLimit, sendReengagement } from '../lib/emailService';
import { checkGrowthMilestone, createNotification } from '../lib/notifications';
import { requireFeature } from '../lib/featureGates';
import { calculateVoiceMatchScore } from '../lib/voiceMatchScore';
import { ariaChat, getAriaConversation, AriaMessage } from '../lib/aria';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-haiku-4-5',
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

async function handleSendFreeLimit(userId: string) {
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
    digest: 'notif_weekly_digest',
    reengagement: 'notif_post_reminders',
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.method === 'POST' ? (req.body || {}) : {};
    // Query-string action (set by vercel.json rewrites for /api/persona-signal,
    // /api/notifications, etc.) takes priority over a same-named field in the
    // POST body, since callers like persona-signal legitimately send their own
    // `action` field (e.g. "kept") in the body.
    const action = String(req.query.action || body.action || '');
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
