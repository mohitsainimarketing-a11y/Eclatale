import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

const ANALYZE_POST_PROMPT = `Analyze this LinkedIn post and return a JSON object with these exact fields:
{
  hookType: one of: 'question' | 'bold_statement' | 'story' | 'statistic' | 'contrarian' | 'list_preview',
  hookStrength: score 1-10 with brief reasoning,
  toneDetected: one of: 'professional' | 'casual' | 'inspirational' | 'data_driven',
  toneConfidence: score 1-10,
  sentimentProfile: { positive: 0-100, neutral: 0-100, negative: 0-100 },
  readabilityScore: score 1-100 (higher = more LinkedIn-optimized: short sentences, white space, scannable),
  avgSentenceLength: number of words,
  paragraphCount: number,
  usesPersonalPronouns: boolean,
  usesSpecificData: boolean,
  hasStrongCTA: boolean,
  ctaType: one of: 'question' | 'follow_request' | 'comment_request' | 'dm_request' | 'none',
  jargonDensity: score 1-10,
  emotionalLanguage: score 1-10,
  topicTags: array of 2-4 semantic topic tags,
  estimatedReadTime: seconds,
  uniqueAngle: one sentence describing what makes this post's perspective distinctive
}
Return ONLY valid JSON, no other text.`;

export interface PostAnalysis {
  hookType: string;
  hookStrength: number;
  hookStrengthReasoning?: string;
  toneDetected: string;
  toneConfidence: number;
  sentimentProfile: { positive: number; neutral: number; negative: number };
  readabilityScore: number;
  avgSentenceLength: number;
  paragraphCount: number;
  usesPersonalPronouns: boolean;
  usesSpecificData: boolean;
  hasStrongCTA: boolean;
  ctaType: string;
  jargonDensity: number;
  emotionalLanguage: number;
  topicTags: string[];
  estimatedReadTime: number;
  uniqueAngle: string;
}

function coerceHookStrength(v: any): { score: number; reasoning?: string } {
  if (typeof v === 'number') return { score: v };
  if (typeof v === 'string') {
    const m = v.match(/\d+/);
    return { score: m ? parseInt(m[0], 10) : 0, reasoning: v };
  }
  if (v && typeof v === 'object') {
    return { score: Number(v.score ?? v.value ?? 0), reasoning: v.reasoning };
  }
  return { score: 0 };
}

/**
 * Analyze a single post with Claude and persist to post_analytics.
 * Designed to run in the background AFTER a post is saved (never blocks the user).
 */
export async function analyzePost(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  postContent: string,
  userId: string,
  postId: string
): Promise<PostAnalysis> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: ANALYZE_POST_PROMPT,
    messages: [{ role: 'user', content: `Post to analyze:\n\n${postContent}` }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const raw = parseJsonObject(text);
  const hs = coerceHookStrength(raw.hookStrength);

  const analysis: PostAnalysis = {
    hookType: raw.hookType || 'bold_statement',
    hookStrength: Math.max(1, Math.min(10, Math.round(hs.score || 0))),
    hookStrengthReasoning: hs.reasoning,
    toneDetected: raw.toneDetected || 'professional',
    toneConfidence: Math.max(1, Math.min(10, Math.round(Number(raw.toneConfidence) || 0))),
    sentimentProfile: {
      positive: Number(raw.sentimentProfile?.positive) || 0,
      neutral: Number(raw.sentimentProfile?.neutral) || 0,
      negative: Number(raw.sentimentProfile?.negative) || 0,
    },
    readabilityScore: Math.max(1, Math.min(100, Math.round(Number(raw.readabilityScore) || 0))),
    avgSentenceLength: Math.round(Number(raw.avgSentenceLength) || 0),
    paragraphCount: Math.round(Number(raw.paragraphCount) || 0),
    usesPersonalPronouns: !!raw.usesPersonalPronouns,
    usesSpecificData: !!raw.usesSpecificData,
    hasStrongCTA: !!raw.hasStrongCTA,
    ctaType: raw.ctaType || 'none',
    jargonDensity: Math.max(1, Math.min(10, Math.round(Number(raw.jargonDensity) || 0))),
    emotionalLanguage: Math.max(1, Math.min(10, Math.round(Number(raw.emotionalLanguage) || 0))),
    topicTags: Array.isArray(raw.topicTags) ? raw.topicTags.slice(0, 4) : [],
    estimatedReadTime: Math.round(Number(raw.estimatedReadTime) || 0),
    uniqueAngle: raw.uniqueAngle || '',
  };

  // Persist (upsert on post_id so re-analysis overwrites).
  const { error } = await supabase.from('post_analytics').upsert({
    post_id: postId,
    user_id: userId,
    hook_type: analysis.hookType,
    hook_strength: analysis.hookStrength,
    tone_detected: analysis.toneDetected,
    tone_confidence: analysis.toneConfidence,
    sentiment_positive: analysis.sentimentProfile.positive,
    sentiment_neutral: analysis.sentimentProfile.neutral,
    sentiment_negative: analysis.sentimentProfile.negative,
    readability_score: analysis.readabilityScore,
    avg_sentence_length: analysis.avgSentenceLength,
    paragraph_count: analysis.paragraphCount,
    uses_personal_pronouns: analysis.usesPersonalPronouns,
    uses_specific_data: analysis.usesSpecificData,
    has_strong_cta: analysis.hasStrongCTA,
    cta_type: analysis.ctaType,
    jargon_density: analysis.jargonDensity,
    emotional_language: analysis.emotionalLanguage,
    topic_tags: analysis.topicTags,
    estimated_read_time: analysis.estimatedReadTime,
    unique_angle: analysis.uniqueAngle,
  }, { onConflict: 'post_id' });
  if (error) throw new Error(`post_analytics upsert failed: ${error.message}`);

  return analysis;
}

const USER_PATTERNS_INSTRUCTIONS = `You are analyzing the aggregated writing-pattern data of a LinkedIn content creator across their recent posts. Return a JSON object with EXACTLY these fields:
{
  dominantHookType: their most used hook type and its approximate percentage,
  hookEffectiveness: which hook type correlates with their strongest posts,
  toneConsistency: are they consistent or switching frequently,
  readabilityTrend: 'improving' | 'stable' | 'declining',
  writingStrengths: array of 2-3 specific genuine strengths (positive, specific statements),
  writingOpportunities: array of 2-3 specific actionable improvements (specific and encouraging),
  contentPillars: array of 3-5 main topic clusters,
  unusedAngles: array of 2-3 topic angles their persona suggests but they haven't covered,
  voiceDriftScore: 1-100 measuring consistency between earliest and most recent posts,
  bestPerformingPattern: one sentence describing elements in their strongest posts,
  recommendedNextPost: one specific post-angle recommendation based on gaps and patterns
}
Return ONLY valid JSON, no other text. No em dashes, en dashes, or arrows.`;

export interface UserPatternAnalysis {
  dominantHookType: string;
  hookEffectiveness: string;
  toneConsistency: string;
  readabilityTrend: string;
  writingStrengths: string[];
  writingOpportunities: string[];
  contentPillars: string[];
  unusedAngles: string[];
  voiceDriftScore: number;
  bestPerformingPattern: string;
  recommendedNextPost: string;
  postsAnalyzed: number;
}

/**
 * Aggregate a user's post_analytics rows (min 3) and have Claude surface patterns.
 * Returns null if fewer than 3 analyzed posts exist.
 */
export async function analyzeUserPatterns(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  userId: string
): Promise<UserPatternAnalysis | null> {
  const { data: rows } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!rows || rows.length < 3) return null;

  // Compact the analytics for the prompt (oldest -> newest so drift is legible).
  const compact = rows.map((r: any, i: number) => ({
    n: i + 1,
    hook: r.hook_type,
    hookStrength: r.hook_strength,
    tone: r.tone_detected,
    readability: r.readability_score,
    specificData: r.uses_specific_data,
    cta: r.cta_type,
    topics: r.topic_tags,
  }));

  // Pull persona for unused-angle suggestions.
  const { data: profile } = await supabase.from('profiles').select('role, domain').eq('id', userId).single();
  const { data: persona } = await supabase.from('persona_profiles').select('expertise_topic, communication_styles').eq('user_id', userId).maybeSingle();

  const context = `Creator: ${(profile as any)?.role || 'professional'} in ${(profile as any)?.domain || 'business'}. ` +
    `Expertise: ${(persona as any)?.expertise_topic || 'not specified'}. ` +
    `Styles: ${((persona as any)?.communication_styles || []).join(', ') || 'not specified'}.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: USER_PATTERNS_INSTRUCTIONS,
    messages: [{ role: 'user', content: `${context}\n\nWriting pattern data across their last ${rows.length} posts (oldest to newest):\n${JSON.stringify(compact)}` }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const raw = parseJsonObject(text);

  return {
    dominantHookType: String(raw.dominantHookType || ''),
    hookEffectiveness: String(raw.hookEffectiveness || ''),
    toneConsistency: String(raw.toneConsistency || ''),
    readabilityTrend: raw.readabilityTrend || 'stable',
    writingStrengths: Array.isArray(raw.writingStrengths) ? raw.writingStrengths : [],
    writingOpportunities: Array.isArray(raw.writingOpportunities) ? raw.writingOpportunities : [],
    contentPillars: Array.isArray(raw.contentPillars) ? raw.contentPillars : [],
    unusedAngles: Array.isArray(raw.unusedAngles) ? raw.unusedAngles : [],
    voiceDriftScore: Math.max(1, Math.min(100, Math.round(Number(raw.voiceDriftScore) || 50))),
    bestPerformingPattern: String(raw.bestPerformingPattern || ''),
    recommendedNextPost: String(raw.recommendedNextPost || ''),
    postsAnalyzed: rows.length,
  };
}

export interface ToneComparison {
  match: boolean;
  matchScore: number;
  drift: string;
  suggestion: string;
}

/** Compare intended tone vs what the user actually wrote. Called after generation. */
export async function compareIntendedVsActualTone(
  anthropic: Anthropic,
  intendedTone: string,
  postContent: string
): Promise<ToneComparison> {
  const prompt = `The user intended to write in a ${intendedTone} tone. Here is what they actually wrote:

${postContent}

Assess: does the writing actually match the intended tone? Return a JSON object:
{ "match": boolean, "matchScore": 1-100, "drift": "description of where tone differs if applicable, empty string if none", "suggestion": "one specific adjustment to bring it closer to the intended tone" }
Return ONLY valid JSON, no other text.`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const raw = parseJsonObject(text);

  const matchScore = Math.max(1, Math.min(100, Math.round(Number(raw.matchScore) || 0)));
  return {
    match: typeof raw.match === 'boolean' ? raw.match : matchScore >= 70,
    matchScore,
    drift: String(raw.drift || ''),
    suggestion: String(raw.suggestion || ''),
  };
}
