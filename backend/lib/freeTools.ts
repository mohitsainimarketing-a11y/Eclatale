import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getWritingStyle, WRITING_STYLES, NO_DASH_RULE, lengthInstruction, TALK_LENGTH_OPTIONS } from './writingStyles';
import { cachedSystem } from './promptCache';
import { getDateContext } from './dateContext';

const BANNED_WORDS = 'delve, leverage, synergy, empower, transformative, game-changer, cutting-edge, holistic, paradigm, utilize, unlock, foster, nuanced, streamline, elevate, robust, comprehensive, landscape, notably, crucial, significant, pivotal, seamlessly, groundbreaking, revolutionary, innovative';
// Anonymous ceiling for the public /tools pages. The homepage demo no longer
// hits this endpoint at all (it is signup-gated), so this only governs /tools,
// the nine tools that exist to be sampled. At 1/hr a visitor who tried the hook
// generator was locked out of the other eight, which defeats the page. Five
// leaves room to explore while still capping scripted abuse.
const RATE_LIMIT_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

function parseJsonArray(text: string): any[] {
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match ? match[0] : text); } catch { return []; }
}

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(match ? match[0] : text); } catch { return {}; }
}

function clamp(n: any, min: number, max: number): number {
  const num = Number(n);
  if (Number.isNaN(num)) return min;
  return Math.max(min, Math.min(max, Math.round(num)));
}

// ── Rate limiting (anonymous, IP-scoped) ────────────────────────────────────

export function extractClientIp(headers: Record<string, string | string[] | undefined>, fallback: string): string {
  const raw = headers['x-forwarded-for'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return (first ? first.split(',')[0].trim() : fallback) || 'unknown';
}

export async function checkToolRateLimit(supabase: SupabaseClient, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count } = await supabase
    .from('tool_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since);
  return (count || 0) < RATE_LIMIT_PER_HOUR;
}

export async function logToolUsage(supabase: SupabaseClient, ip: string, tool: string): Promise<void> {
  await supabase.from('tool_usage_log').insert({ ip, tool });
}

// ── Tool 1: Hook Generator ───────────────────────────────────────────────────

export async function generateHooks(anthropic: Anthropic, topic: string, style: string): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Generate 5 LinkedIn hook lines for this topic: "${topic}". Style requested: ${style}.

Each hook must:
- Be under 210 characters (before the "see more" fold)
- Use one of these proven 2026 formulas for at least 3 of the 5: Number Opener (lead with a stat/%), Dollar/Revenue ($X later...), Result Reveal (went from A to B in X days), Contrarian (everyone says X, the data says otherwise), Nobody Told Me (nobody told me this when I started...), Process Reveal (here's exactly how I...)
- NEVER open with a question. Question-first hooks lose 34% median likes
- NEVER use: ${BANNED_WORDS}
- Feel like it was written by a specific human, not a machine

${NO_DASH_RULE}

Return ONLY a JSON array of 5 strings, no prose, no markdown fences.`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return parseJsonArray(text).slice(0, 5).map(String);
}

// ── Tool 2: Post Generator (free demo) ──────────────────────────────────────

export async function generateDemoPost(anthropic: Anthropic, topic: string, styleId: string, lengthId: string): Promise<string> {
  const style = getWritingStyle(styleId) || WRITING_STYLES[0];
  const length = TALK_LENGTH_OPTIONS.some(o => o.id === lengthId) ? lengthId : 'standard';
  const dynamicContent = `${getDateContext()}

${style.prompt}

${lengthInstruction(length)}

This is a free demo on a public tools page. Generate a high-quality example post that showcases what this style can do. Return just the post text, no explanation, no markdown formatting, no quotes around it.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    system: cachedSystem(dynamicContent),
    messages: [{ role: 'user', content: `Write the post about: ${topic}` }],
  });
  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

// ── Tool 3: Headline Analyzer ────────────────────────────────────────────────

export interface HeadlineAnalysis {
  totalScore: number;
  clarity: number;
  keywords: number;
  specificity: number;
  valueProposition: number;
  whatsWorking: string[];
  improvements: string[];
  alternatives: string[];
}

export async function analyzeHeadline(anthropic: Anthropic, headline: string): Promise<HeadlineAnalysis> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Analyze this LinkedIn headline: "${headline}". Score it 0-100 on: Clarity (0-25), Keywords (0-25), Specificity (0-25), Value proposition (0-25). List what's working and what to improve. Generate 3 improved alternatives. Return ONLY valid JSON, no prose: { "totalScore": number, "clarity": number, "keywords": number, "specificity": number, "valueProposition": number, "whatsWorking": string[], "improvements": string[], "alternatives": [string, string, string] }\n\n${NO_DASH_RULE}`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);
  const clarity = clamp(parsed.clarity, 0, 25);
  const keywords = clamp(parsed.keywords, 0, 25);
  const specificity = clamp(parsed.specificity, 0, 25);
  const valueProposition = clamp(parsed.valueProposition, 0, 25);
  return {
    totalScore: clamp(parsed.totalScore ?? clarity + keywords + specificity + valueProposition, 0, 100),
    clarity, keywords, specificity, valueProposition,
    whatsWorking: Array.isArray(parsed.whatsWorking) ? parsed.whatsWorking.slice(0, 5).map(String) : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5).map(String) : [],
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3).map(String) : [],
  };
}

// ── Tool 4: Viral Score Checker ─────────────────────────────────────────────

export interface ViralScoreResult {
  viralScore: number;
  hookStrength: number;
  readability: number;
  engagementTriggers: number;
  lengthOptimization: number;
  label: 'ready' | 'needs_work' | 'low_reach';
  improvements: string[];
}

export async function scoreViralPotential(anthropic: Anthropic, post: string): Promise<ViralScoreResult> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Analyze this LinkedIn post for viral potential:\n\n${post}\n\nScore 0-100 on: hook strength (does the first line stop scrolling?), readability (short sentences, white space, scannable?), engagement triggers (question, controversy, or relatable moment that drives comments?), length optimization (is it in the 900-1300 char sweet spot?). Return ONLY valid JSON: { "viralScore": number, "hookStrength": number, "readability": number, "engagementTriggers": number, "lengthOptimization": number, "label": "ready"|"needs_work"|"low_reach", "improvements": [string, string, string] }\n\n${NO_DASH_RULE}`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);
  const viralScore = clamp(parsed.viralScore, 0, 100);
  const label = ['ready', 'needs_work', 'low_reach'].includes(parsed.label)
    ? parsed.label
    : (viralScore >= 75 ? 'ready' : viralScore >= 50 ? 'needs_work' : 'low_reach');
  return {
    viralScore,
    hookStrength: clamp(parsed.hookStrength, 0, 100),
    readability: clamp(parsed.readability, 0, 100),
    engagementTriggers: clamp(parsed.engagementTriggers, 0, 100),
    lengthOptimization: clamp(parsed.lengthOptimization, 0, 100),
    label,
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 3).map(String) : [],
  };
}

// ── Tool 7: LinkedIn About Generator ─────────────────────────────────────────

export async function generateAboutSection(
  anthropic: Anthropic, role: string, industry: string, specialty: string, achievement: string, tone: string
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Write a compelling LinkedIn About section for: Role: ${role}, Industry: ${industry}, Specialty: ${specialty}, Key achievement: ${achievement}, Tone: ${tone}. Make it first-person, specific, and compelling. Open with a strong hook, not "I am a...". Under 1500 characters. Include what they do, who they help, and a call to connect. Never use: ${BANNED_WORDS}. ${NO_DASH_RULE} Return just the About text, no preamble, no markdown.`,
    }],
  });
  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

// ── Tool 8: CTA Generator ────────────────────────────────────────────────────

export async function generateCTAs(anthropic: Anthropic, topic: string, goal: string): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Generate 5 different LinkedIn post CTAs for a post about ${topic}. Goal: ${goal}. Each CTA must be 1-2 sentences, feel natural not pushy, and directly relate to the post topic. Vary the approach: question, soft ask, engagement bait, community invite, direct ask. ${NO_DASH_RULE} Return ONLY a JSON array of 5 strings, no prose.`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return parseJsonArray(text).slice(0, 5).map(String);
}

// ── Tool 14: Content Series Generator ────────────────────────────────────────

export interface SeriesPost {
  day: number;
  title: string;
  hook: string;
  angle: string;
  format: string;
}

export async function generateContentSeries(
  anthropic: Anthropic,
  topic: string,
  audience: string,
  seriesLength: number,
): Promise<SeriesPost[]> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `You are a LinkedIn content strategist. Create a ${seriesLength}-post content series plan.

TOPIC: ${topic}
AUDIENCE: ${audience || 'LinkedIn professionals'}

Each post in the series must:
- Build on the previous one (logical progression)
- Stand alone as its own post (no "in my last post..." references)
- Cover a different angle or sub-topic

Return ONLY a JSON array of ${seriesLength} objects, no prose, no markdown fences:
[
  {
    "day": 1,
    "title": "short working title for the post",
    "hook": "the exact first line (under 200 chars, stops scrolling)",
    "angle": "one sentence: what specific value or insight this post delivers",
    "format": "one of: Story, List, Lesson, Contrarian, Data, How-to, Case Study"
  }
]

Rules for hooks:
- Never open with a question
- Never use: ${BANNED_WORDS}
${NO_DASH_RULE}
- Vary the format across the series`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return parseJsonArray(text).slice(0, seriesLength).map((p: any, i: number) => ({
    day: Number(p.day) || i + 1,
    title: String(p.title || ''),
    hook: String(p.hook || ''),
    angle: String(p.angle || ''),
    format: String(p.format || 'Story'),
  }));
}

// ── Tool 13: Hashtag Generator ───────────────────────────────────────────────

export async function generateHashtags(anthropic: Anthropic, topic: string): Promise<{ high: string[]; mid: string[]; niche: string[] }> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Generate LinkedIn hashtags for this topic: "${topic}".

Return exactly this JSON shape — no prose, no markdown:
{
  "high": [5 hashtags with 1M+ followers each, broad topics],
  "mid": [7 hashtags with 100K-1M followers, industry or function specific],
  "niche": [8 hashtags with under 100K followers, highly specific or community tags]
}

Rules:
- All lowercase, no spaces, no punctuation except the # prefix
- Real LinkedIn hashtags that actually exist
- Relevant to the topic, not generic filler
- Do not repeat across tiers`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);
  return {
    high: Array.isArray(parsed.high) ? parsed.high.slice(0, 7).map(String) : [],
    mid: Array.isArray(parsed.mid) ? parsed.mid.slice(0, 9).map(String) : [],
    niche: Array.isArray(parsed.niche) ? parsed.niche.slice(0, 10).map(String) : [],
  };
}

// ── Tool 12: LinkedIn DM Writer ──────────────────────────────────────────────

export async function generateLinkedInDMs(
  anthropic: Anthropic,
  recipientRole: string,
  yourRole: string,
  goal: string,
  context: string,
): Promise<string[]> {
  const goalGuides: Record<string, string> = {
    Connect: 'A warm connection request. 1-2 sentences. No pitch. Reference something real about them or their work.',
    Collaborate: 'Propose working together on something specific. Be concrete about what you bring and what you want.',
    Pitch: 'A soft sell that leads with their problem, not your solution. Under 5 sentences.',
    'Get advice': 'Ask for one specific, answerable question. Show you have done your homework. Make it easy to say yes.',
    'Follow up': 'Reference a prior interaction (post, comment, event). Be brief, friendly, and have a clear ask.',
  };
  const guide = goalGuides[goal] || goalGuides['Connect'];

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `You are a LinkedIn outreach expert. Write 3 different DM variations for the scenario below.

SENDER: ${yourRole || 'a professional'}
RECIPIENT: ${recipientRole || 'a LinkedIn connection'}
GOAL: ${goal}
GOAL GUIDE: ${guide}
CONTEXT: ${context || 'no additional context'}

Rules for every DM:
- Start with their name placeholder like "Hi [Name],"
- Sound like a real person wrote it, not a template
- Never open with "I hope this message finds you well"
- Never use: ${BANNED_WORDS}
- ${NO_DASH_RULE}
- Under 120 words each
- Each variation should feel meaningfully different in approach

Return ONLY a JSON array of 3 DM strings. No prose, no markdown fences.`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return parseJsonArray(text).slice(0, 3).map(String);
}

// ── Tool 11: Comment Generator ───────────────────────────────────────────────

export async function generateComments(
  anthropic: Anthropic,
  post: string,
  style: string,
  count: number,
): Promise<string[]> {
  const styleGuides: Record<string, string> = {
    Insightful: 'Add a specific insight, data point, or nuance that extends the conversation. Make the author look smarter for having posted.',
    Question: 'Ask one sharp, curious question that shows you read carefully. Never a generic "great post!" question.',
    'Agreement + Add': 'Agree with the core point, then add one concrete example, experience, or idea that builds on it.',
    Contrarian: 'Respectfully push back on one assumption or claim. Be specific and back it up. Avoid being inflammatory.',
    Story: 'Share a 2-3 sentence personal story or experience that directly relates to the post. Be specific.',
  };
  const guide = styleGuides[style] || styleGuides['Insightful'];

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `You are a LinkedIn engagement expert. Generate ${count} different comments for the post below.

STYLE: ${style}
STYLE GUIDE: ${guide}

POST:
"""
${post}
"""

Rules for every comment:
- 1-4 sentences, under 300 characters each
- Sound like a real professional wrote it, not AI
- Reference something specific from the actual post content
- Never start with "Great post!" or "Love this!" or any empty praise
- Never use: ${BANNED_WORDS}
${NO_DASH_RULE}
- No hashtags

Return ONLY a JSON array of ${count} comment strings, no prose, no markdown fences.`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return parseJsonArray(text).slice(0, count).map(String);
}

// ── Tool 10: LinkedIn Post Analyzer ──────────────────────────────────────────

export interface PostAnalysisResult {
  overallScore: number;
  verdict: 'strong' | 'decent' | 'needs_work' | 'weak';
  hookScore: number;
  hookType: string;
  hookFeedback: string;
  structureScore: number;
  structureFeedback: string;
  engagementScore: number;
  engagementFeedback: string;
  algorithmScore: number;
  algorithmFeedback: string;
  ctaScore: number;
  ctaFeedback: string;
  estimatedReachTier: 'viral' | 'high' | 'medium' | 'low';
  strengths: string[];
  improvements: string[];
  charCount: number;
  wordCount: number;
}

export async function analyzeLinkedInPost(anthropic: Anthropic, post: string): Promise<PostAnalysisResult> {
  const charCount = post.length;
  const wordCount = post.trim().split(/\s+/).length;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `You are a LinkedIn content strategist. Analyze this LinkedIn post across 5 dimensions and return a detailed JSON report.

POST TO ANALYZE:
"""
${post}
"""

CHAR COUNT: ${charCount} | WORD COUNT: ${wordCount}

Score each dimension 0-100. Be honest, not generous.

SCORING CRITERIA:
1. hookScore: Does the first line stop scrolling? Does it create curiosity or promise value without clickbait? Is it under 210 chars? Does it avoid weak question openers?
2. structureScore: Short paragraphs (1-3 lines each), white space for mobile, no walls of text, scannable flow?
3. engagementScore: Does it have a relatable moment, opinion, controversy, or personal story that invites comments? Is there tension or a payoff?
4. algorithmScore: 2026 LinkedIn algorithm fit: 900-1300 chars is the sweet spot, native content (no links in body), dwell time signals, saves potential?
5. ctaScore: Does the post end with a clear, natural call to action? Does it invite specific replies, not just "thoughts?"

HOOK TYPE: classify the opening line as one of: bold_statement, story, statistic, contrarian, list_preview, result_reveal, question, none

REACH TIER: estimate reach potential as: viral, high, medium, low

VERDICT: strong (80+), decent (60-79), needs_work (40-59), weak (0-39) based on overallScore

STRENGTHS: 2-3 specific things this post does well (reference the actual content)
IMPROVEMENTS: 3-5 specific, actionable fixes (reference the actual content, not generic advice)

RULES FOR YOUR FEEDBACK TEXT:
- Be specific, reference the actual post content
- No em dashes, no en dashes
- No banned words: ${BANNED_WORDS}
- Keep each feedback string under 120 characters
- Keep each strength/improvement under 100 characters

Return ONLY valid JSON in this exact shape:
{
  "overallScore": number,
  "verdict": "strong"|"decent"|"needs_work"|"weak",
  "hookScore": number,
  "hookType": string,
  "hookFeedback": string,
  "structureScore": number,
  "structureFeedback": string,
  "engagementScore": number,
  "engagementFeedback": string,
  "algorithmScore": number,
  "algorithmFeedback": string,
  "ctaScore": number,
  "ctaFeedback": string,
  "estimatedReachTier": "viral"|"high"|"medium"|"low",
  "strengths": [string, string],
  "improvements": [string, string, string]
}`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const p = parseJsonObject(text);

  const overallScore = clamp(p.overallScore, 0, 100);
  const verdictOptions = ['strong', 'decent', 'needs_work', 'weak'] as const;
  const verdict = verdictOptions.includes(p.verdict)
    ? p.verdict as PostAnalysisResult['verdict']
    : (overallScore >= 80 ? 'strong' : overallScore >= 60 ? 'decent' : overallScore >= 40 ? 'needs_work' : 'weak');
  const reachOptions = ['viral', 'high', 'medium', 'low'] as const;
  const estimatedReachTier = reachOptions.includes(p.estimatedReachTier)
    ? p.estimatedReachTier as PostAnalysisResult['estimatedReachTier']
    : 'medium';

  return {
    overallScore,
    verdict,
    hookScore: clamp(p.hookScore, 0, 100),
    hookType: String(p.hookType || 'unknown'),
    hookFeedback: String(p.hookFeedback || ''),
    structureScore: clamp(p.structureScore, 0, 100),
    structureFeedback: String(p.structureFeedback || ''),
    engagementScore: clamp(p.engagementScore, 0, 100),
    engagementFeedback: String(p.engagementFeedback || ''),
    algorithmScore: clamp(p.algorithmScore, 0, 100),
    algorithmFeedback: String(p.algorithmFeedback || ''),
    ctaScore: clamp(p.ctaScore, 0, 100),
    ctaFeedback: String(p.ctaFeedback || ''),
    estimatedReachTier,
    strengths: Array.isArray(p.strengths) ? p.strengths.slice(0, 3).map(String) : [],
    improvements: Array.isArray(p.improvements) ? p.improvements.slice(0, 5).map(String) : [],
    charCount,
    wordCount,
  };
}

// ── Job Fit Analyzer ─────────────────────────────────────────────────────────

export interface JobFitResult {
  matchScore: number;
  keywordMatchPct: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  profileSuggestions: { section: string; current: string; rewrite: string }[];
  coverLetterOpener: string;
}

export async function analyzeJobFit(
  anthropic: Anthropic,
  profileText: string,
  jobDescription: string,
): Promise<JobFitResult> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are a career coach and LinkedIn optimization expert. Analyze how well this LinkedIn profile matches the job description.

LINKEDIN PROFILE:
${profileText.slice(0, 3000)}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

Analyze the match and return ONLY valid JSON in this exact shape:
{
  "matchScore": number (0-100, overall fit),
  "keywordMatchPct": number (0-100, % of JD keywords present in profile),
  "matchedKeywords": string[] (keywords from JD found in profile, max 15),
  "missingKeywords": string[] (important JD keywords missing from profile, max 10),
  "profileSuggestions": [
    { "section": "Headline", "current": "brief quote or description of current headline", "rewrite": "improved version targeting this role" },
    { "section": "About", "current": "brief quote or description of current about", "rewrite": "improved opening sentence or hook for this role" },
    { "section": "Skills", "current": "missing skills not listed", "rewrite": "specific skills to add from JD" }
  ],
  "coverLetterOpener": "one compelling opening paragraph (2-3 sentences) for a cover letter for this role, written in first person, no em dashes, no banned words"
}

Rules for your output text:
- No em dashes, no en dashes
- No banned words: delve, leverage, synergy, empower, transformative, game-changer, cutting-edge, holistic, paradigm, utilize, unlock, foster, nuanced, streamline, elevate, robust, comprehensive, landscape, notably, crucial, significant, pivotal, seamlessly, groundbreaking, revolutionary, innovative
- Be specific, reference actual content from the profile and JD
- coverLetterOpener must sound human, not like AI
- Keep each suggestion rewrite under 200 characters`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const p = parseJsonObject(text);

  return {
    matchScore: clamp(p.matchScore, 0, 100),
    keywordMatchPct: clamp(p.keywordMatchPct, 0, 100),
    matchedKeywords: Array.isArray(p.matchedKeywords) ? p.matchedKeywords.slice(0, 15).map(String) : [],
    missingKeywords: Array.isArray(p.missingKeywords) ? p.missingKeywords.slice(0, 10).map(String) : [],
    profileSuggestions: Array.isArray(p.profileSuggestions)
      ? p.profileSuggestions.slice(0, 3).map((s: any) => ({
          section: String(s.section || ''),
          current: String(s.current || ''),
          rewrite: String(s.rewrite || ''),
        }))
      : [],
    coverLetterOpener: String(p.coverLetterOpener || ''),
  };
}
