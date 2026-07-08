import Anthropic from '@anthropic-ai/sdk';
import { getDateContext } from './dateContext';

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map(b => b.text).join('\n');
}

export interface AccuracyClaim {
  claim: string;
  status: string;
  note: string;
}

export interface AccuracyResult {
  score: number;
  claims: AccuracyClaim[];
  summary: string;
}

export async function runFactualAccuracyCheck(anthropic: Anthropic, postContent: string): Promise<AccuracyResult> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: `${getDateContext()}\n\nYou are a fact-checker for social media content. Use web search to verify specific, checkable claims.`,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Read this LinkedIn post:\n\n${postContent}\n\nIdentify the 2-3 most specific factual claims made (statistics, named events, attributed quotes, specific numbers). For each claim, assess: is this accurate based on your knowledge and current web sources? Rate each claim as: Verified / Plausible but unverified / Questionable / False.\n\nIf the post makes no specific checkable claims (pure opinion, no stats or facts), return an empty claims array and a high accuracy score.\n\nReturn ONLY a JSON object (after any research): { "overallAccuracyScore": 0-100, "claims": [{ "claim": "text", "status": "Verified|Plausible but unverified|Questionable|False", "note": "one sentence" }], "summary": "one sentence plain English summary" }`,
    }],
  });

  const raw = parseJsonObject(extractText(message.content));
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(raw.overallAccuracyScore) || 0))),
    claims: Array.isArray(raw.claims) ? raw.claims.map((c: any) => ({
      claim: String(c.claim || ''), status: String(c.status || ''), note: String(c.note || ''),
    })) : [],
    summary: String(raw.summary || ''),
  };
}

export interface FreshnessResult {
  score: number;
  assessment: string;
  topicSaturation: string;
  suggestion: string;
  reasoning: string;
}

export async function runTopicFreshnessCheck(
  anthropic: Anthropic, postContent: string, userRole: string, userDomain: string
): Promise<FreshnessResult> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Assess this LinkedIn post topic for freshness and originality in ${userDomain} for a ${userRole}:\n\n${postContent}\n\nConsider: Is this angle overdone on LinkedIn right now? Is the perspective fresh or recycled? Are there more timely angles on this topic given current context?\n\nReturn ONLY a JSON object: { "freshnessScore": 0-100, "assessment": "Fresh" | "Moderately fresh" | "Oversaturated", "topicSaturation": "Low" | "Medium" | "High", "suggestion": "one specific more timely angle if score below 70, empty string otherwise", "reasoning": "one sentence" }`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const raw = parseJsonObject(text);
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(raw.freshnessScore) || 0))),
    assessment: String(raw.assessment || ''),
    topicSaturation: String(raw.topicSaturation || ''),
    suggestion: String(raw.suggestion || ''),
    reasoning: String(raw.reasoning || ''),
  };
}

export interface VoiceResult {
  score: number;
  matchLevel: string;
  specificMatches: string[];
  specificMismatches: string[];
  suggestion: string;
}

export async function runVoiceAuthenticityCheck(
  anthropic: Anthropic, personaContext: string, postContent: string
): Promise<VoiceResult> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Here is writing pattern data for this user:\n\n${personaContext || 'No established voice profile yet — assess generically for authentic, natural human writing.'}\n\nHere is their generated post:\n\n${postContent}\n\nAssess how authentically this post matches their established voice. Consider: sentence length patterns, vocabulary level, use of personal pronouns, hook style, emotional register, topic relevance to their expertise.\n\nReturn ONLY a JSON object: { "voiceScore": 0-100, "matchLevel": "Excellent" | "Good" | "Moderate" | "Low", "specificMatches": ["2 things that sound like them"], "specificMismatches": ["1-2 things that feel off, empty array if none"], "suggestion": "one specific adjustment to make it sound more like them if score below 75, empty string otherwise" }`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const raw = parseJsonObject(text);
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(raw.voiceScore) || 0))),
    matchLevel: String(raw.matchLevel || ''),
    specificMatches: Array.isArray(raw.specificMatches) ? raw.specificMatches.map(String) : [],
    specificMismatches: Array.isArray(raw.specificMismatches) ? raw.specificMismatches.map(String) : [],
    suggestion: String(raw.suggestion || ''),
  };
}

export interface AuthenticityScoreResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  readyToPost: boolean;
  accuracy: AccuracyResult;
  freshness: FreshnessResult;
  voice: VoiceResult;
  topSuggestion: string;
}

function gradeFor(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function pickTopSuggestion(accuracy: AccuracyResult, freshness: FreshnessResult, voice: VoiceResult): string {
  const candidates: { score: number; suggestion: string }[] = [];
  if (accuracy.score < 70) {
    const flagged = accuracy.claims.find(c => c.status === 'Questionable' || c.status === 'False');
    candidates.push({ score: accuracy.score, suggestion: flagged ? `The claim "${flagged.claim}" ${flagged.note ? `— ${flagged.note}` : 'could not be verified'}. Consider adding a source or rewording as your opinion.` : accuracy.summary });
  }
  if (freshness.score < 70 && freshness.suggestion) candidates.push({ score: freshness.score, suggestion: freshness.suggestion });
  if (voice.score < 75 && voice.suggestion) candidates.push({ score: voice.score, suggestion: voice.suggestion });
  if (!candidates.length) return '';
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0].suggestion;
}

export async function calculateAuthenticityScore(
  anthropic: Anthropic,
  postContent: string,
  userRole: string,
  userDomain: string,
  personaContext: string
): Promise<AuthenticityScoreResult> {
  const [accuracy, freshness, voice] = await Promise.all([
    runFactualAccuracyCheck(anthropic, postContent),
    runTopicFreshnessCheck(anthropic, postContent, userRole, userDomain),
    runVoiceAuthenticityCheck(anthropic, personaContext, postContent),
  ]);

  const overallScore = Math.round(accuracy.score * 0.4 + freshness.score * 0.3 + voice.score * 0.3);

  return {
    overallScore,
    grade: gradeFor(overallScore),
    readyToPost: overallScore >= 70,
    accuracy,
    freshness,
    voice,
    topSuggestion: pickTopSuggestion(accuracy, freshness, voice),
  };
}
