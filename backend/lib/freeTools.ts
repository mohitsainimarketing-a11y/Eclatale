import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getWritingStyle, WRITING_STYLES, UNIVERSAL_HUMAN_WRITING_RULES, lengthInstruction, TALK_LENGTH_OPTIONS } from './writingStyles';
import { getDateContext } from './dateContext';

const BANNED_WORDS = 'delve, leverage, synergy, transformative, game-changer';
// Anonymous ceiling for the public /tools pages. The homepage demo no longer
// hits this endpoint at all (it is signup-gated), so this only governs /tools.
const RATE_LIMIT_PER_HOUR = 1;
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
    max_tokens: 500,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Generate 5 LinkedIn hook lines for this topic: ${topic}. Style: ${style}. Each hook must be under 15 words, stop scrolling worthy, and follow this style perfectly. Never use: ${BANNED_WORDS}. Return ONLY a JSON array of 5 strings, no prose, no markdown fences.`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return parseJsonArray(text).slice(0, 5).map(String);
}

// ── Tool 2: Post Generator (free demo) ──────────────────────────────────────

export async function generateDemoPost(anthropic: Anthropic, topic: string, styleId: string, lengthId: string): Promise<string> {
  const style = getWritingStyle(styleId) || WRITING_STYLES[0];
  const length = TALK_LENGTH_OPTIONS.some(o => o.id === lengthId) ? lengthId : 'standard';
  const system = `${getDateContext()}

${style.prompt}

${lengthInstruction(length)}

${UNIVERSAL_HUMAN_WRITING_RULES}

This is a free demo on a public tools page — generate a high-quality example post that showcases what this style can do. Return just the post text, no explanation, no markdown formatting, no quotes around it.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    system,
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
      content: `Analyze this LinkedIn headline: "${headline}". Score it 0-100 on: Clarity (0-25), Keywords (0-25), Specificity (0-25), Value proposition (0-25). List what's working and what to improve. Generate 3 improved alternatives. Return ONLY valid JSON, no prose: { "totalScore": number, "clarity": number, "keywords": number, "specificity": number, "valueProposition": number, "whatsWorking": string[], "improvements": string[], "alternatives": [string, string, string] }`,
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
      content: `Analyze this LinkedIn post for viral potential:\n\n${post}\n\nScore 0-100 on: hook strength (does the first line stop scrolling?), readability (short sentences, white space, scannable?), engagement triggers (question, controversy, or relatable moment that drives comments?), length optimization (is it in the 900-1300 char sweet spot?). Return ONLY valid JSON: { "viralScore": number, "hookStrength": number, "readability": number, "engagementTriggers": number, "lengthOptimization": number, "label": "ready"|"needs_work"|"low_reach", "improvements": [string, string, string] }`,
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
      content: `Write a compelling LinkedIn About section for: Role: ${role}, Industry: ${industry}, Specialty: ${specialty}, Key achievement: ${achievement}, Tone: ${tone}. Make it first-person, specific, and compelling. Open with a strong hook, not "I am a...". Under 1500 characters. Include what they do, who they help, and a call to connect. Never use: ${BANNED_WORDS}. Return just the About text, no preamble, no markdown.`,
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
      content: `Generate 5 different LinkedIn post CTAs for a post about ${topic}. Goal: ${goal}. Each CTA must be 1-2 sentences, feel natural not pushy, and directly relate to the post topic. Vary the approach: question, soft ask, engagement bait, community invite, direct ask. Return ONLY a JSON array of 5 strings, no prose.`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return parseJsonArray(text).slice(0, 5).map(String);
}
