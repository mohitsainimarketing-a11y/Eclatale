import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { readCache } from './intelligenceCache';

export interface AriaMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AriaAction {
  action: 'navigate' | 'prefill';
  url?: string;
  page?: string;
  data?: Record<string, unknown>;
}

interface AriaUserContext {
  firstName: string;
  tier: string;
  totalPosts: number;
  streak: number;
  growthScore: number | null;
  linkedinConnected: boolean;
  personaComplete: boolean;
  currentPage: string;
}

const ARIA_KNOWLEDGE_BASE = `
FEATURES:
- Content generation (/create): AI writes LinkedIn posts, articles, X threads, and Instagram captions in the user's own voice. Users pick a topic, tone (Professional/Casual/Inspirational/Data-Driven), and post length (Micro 100-300 chars, Short 300-800, Standard 800-1500, Long-form 1500-3000).
- Repurposing (/create, "Repurpose" tab): paste an article, newsletter, or transcript and Eclatale rewrites it as an original LinkedIn post in the user's voice — not a copy-paste, a genuine reframe.
- Find Ideas: the "Ideas" tab on /create surfaces personalized topic ideas based on the user's role, industry, and goals.
- Voice profile / Persona (/persona-setup): a short setup flow where the user answers questions about their communication style, expertise, and a few voice samples. Eclatale's persona engine uses this to make every generated draft sound like the user, not a generic AI.
- Authenticity score: shown after generating a post, scored 0-100 as a weighted blend of factual accuracy (40%), topic freshness (30%), and voice match (30%). 70+ means "ready to post." It flags any claim that needs a real source, tells the user if the angle is oversaturated on LinkedIn right now, and flags lines that don't sound like their established voice.
- LinkedIn publishing: once a user connects their LinkedIn account (Settings > Connections), Eclatale can publish directly through LinkedIn's official API — no browser automation, so zero risk of account bans.
- Growth Score (/dashboard): a single 0-100 number combining content consistency and profile completeness, meant to track personal-brand trajectory over time, not vanity metrics.
- Analytics / Competitor Intelligence / Profile Optimizer / Best-time-to-post: all consolidated under the /intelligence page (individual plan only) — analytics tracks real outcomes, competitor intelligence benchmarks against similar accounts, profile optimizer suggests headline/about improvements, best-time-to-post recommends a personalized posting schedule.
- Content History (/history): every generated and published post, searchable.
- Notifications: the bell icon shows milestones (streaks, growth score jumps), payment issues, and feature updates.

PRICING:
- Free tier: 3 posts/week, content generation, LinkedIn publishing, 10-post history. Everything else (guided creation, repurposing, persona learning, authenticity score, visual creator, competitor intelligence, profile optimizer, voice match score, best-time-to-post, weekly digest, scheduling, analytics, unlimited history) is Individual-only.
- Individual plan: $19/mo or $15.20/mo billed annually ($182.40/yr), unlocks everything above, unlimited posts. LAUNCH50 promo code gives 50% off the first 3 months. Includes a 7-day free trial. Cancel anytime — cancellation takes effect at the end of the current billing period, access continues until then.
- Refunds: automatic within 7 days of first charge; between 8-30 days go to manual review (48-hour turnaround); after 30 days refunds aren't available.

TROUBLESHOOTING:
- If LinkedIn publishing fails, the most common cause is the LinkedIn connection token expiring — reconnect from Settings.
- If a draft feels generic, the most common cause is an incomplete voice profile — more voice samples in /persona-setup materially improves it.
- If someone hits the free weekly post limit, direct them to /pricing — Individual removes the cap entirely.
`.trim();

export function buildAriaSystemPrompt(ctx: AriaUserContext): string {
  return `You are Aria, Eclatale's AI assistant. Eclatale is an AI personal-brand growth OS for LinkedIn — it learns a user's authentic writing voice and helps them consistently create and publish content that sounds like them.

Your personality: warm, knowledgeable, efficient — like a personal brand coach and product expert in one. Professional but approachable. Use the user's first name naturally, not in every message. Be specific and actionable, never vague. If asked how to do something, explain it clearly AND offer to take them there.

User context:
- Name: ${ctx.firstName}
- Plan: ${ctx.tier}
- Posts created: ${ctx.totalPosts}
- Current streak: ${ctx.streak} days
- Growth score: ${ctx.growthScore !== null ? `${ctx.growthScore}/100` : 'not yet calculated'}
- Current page: ${ctx.currentPage}
- LinkedIn connected: ${ctx.linkedinConnected}
- Voice profile complete: ${ctx.personaComplete}

Eclatale knowledge base:
${ARIA_KNOWLEDGE_BASE}

When you want to navigate the user somewhere, end your reply with a line containing ONLY a JSON object (nothing else on that line): {"action":"navigate","url":"/create"}
Useful navigate URLs: /create (write/repurpose a post), /create?action=ideas (opens the Find Ideas panel directly), /intelligence (analytics, competitor intelligence, profile optimizer, best-time-to-post — all live on this one page), /persona-setup (voice profile setup), /pricing (upgrade), /settings (connect LinkedIn, manage billing), /dashboard (growth score, activity), /history (past posts). Never suggest /analytics or /competitors or /profile-optimizer as URLs — those pages don't exist, everything analytics-related is under /intelligence.
When the user names a topic to write about, use prefill instead of a bare navigate: end your reply with ONLY {"action":"prefill","page":"/create","data":{"topic":"AI in marketing"}}
Only include an action line when it's genuinely useful — most replies need no action at all. Never put an action line anywhere but the very last line, and never explain the JSON to the user.

Keep responses concise — maximum 3-4 sentences unless the user explicitly asks for detail.`;
}

/** Splits a trailing `{"action":...}` line off Aria's reply, if present. */
export function parseAriaReply(raw: string): { text: string; action: AriaAction | null } {
  const lines = raw.trim().split('\n');
  const lastLine = lines[lines.length - 1]?.trim() || '';
  if (lastLine.startsWith('{') && lastLine.endsWith('}')) {
    try {
      const parsed = JSON.parse(lastLine);
      if (parsed && (parsed.action === 'navigate' || parsed.action === 'prefill')) {
        return { text: lines.slice(0, -1).join('\n').trim(), action: parsed as AriaAction };
      }
    } catch { /* not valid JSON — treat as plain text */ }
  }
  return { text: raw.trim(), action: null };
}

async function getAriaUserContext(supabase: SupabaseClient, userId: string, currentPage: string): Promise<AriaUserContext> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  const { count: totalPosts } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: linkedinConn } = await supabase
    .from('linkedin_connections')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: persona } = await supabase
    .from('persona_profiles')
    .select('persona_completed_at')
    .eq('user_id', userId)
    .maybeSingle();

  const cachedGrowth = await readCache(supabase, userId, 'growth-score', 7 * 24 * 60 * 60 * 1000);

  // Streak: consecutive days (from today backwards) with at least one post.
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  let streak = 0;
  if (recentPosts && recentPosts.length > 0) {
    const days = new Set(recentPosts.map(p => new Date(p.created_at as string).toDateString()));
    const cursor = new Date();
    while (days.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return {
    firstName: profile?.first_name || 'there',
    tier: profile?.subscription_tier || 'free',
    totalPosts: totalPosts || 0,
    streak,
    growthScore: cachedGrowth?.overallScore ?? null,
    linkedinConnected: !!linkedinConn,
    personaComplete: !!persona?.persona_completed_at,
    currentPage,
  };
}

export async function ariaChat(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  userId: string,
  message: string,
  conversationHistory: AriaMessage[],
  currentPage: string
): Promise<{ reply: string; action: AriaAction | null }> {
  const ctx = await getAriaUserContext(supabase, userId, currentPage);
  const systemPrompt = buildAriaSystemPrompt(ctx);

  const trimmedHistory = conversationHistory.slice(-16); // keep the request small; full history is persisted separately

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages: [...trimmedHistory, { role: 'user', content: message }],
  });

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const { text, action } = parseAriaReply(rawText);

  const updatedHistory: AriaMessage[] = [
    ...conversationHistory,
    { role: 'user' as const, content: message },
    { role: 'assistant' as const, content: text },
  ].slice(-40);

  await supabase.from('aria_conversations').upsert(
    { user_id: userId, messages: updatedHistory, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  return { reply: text, action };
}

export async function getAriaConversation(supabase: SupabaseClient, userId: string): Promise<AriaMessage[]> {
  const { data } = await supabase.from('aria_conversations').select('messages').eq('user_id', userId).maybeSingle();
  return (data?.messages as AriaMessage[]) || [];
}
