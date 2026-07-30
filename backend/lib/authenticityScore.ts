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
  sourceUrl?: string;
}

export interface AccuracyResult {
  score: number;
  claims: AccuracyClaim[];
  summary: string;
  isOpinionBased: boolean;
}

export async function runFactualAccuracyCheck(anthropic: Anthropic, postContent: string): Promise<AccuracyResult> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: `${getDateContext()}\n\nYou are a fact-checker for social media content. Use web search to verify specific, checkable claims.`,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Read this LinkedIn post. Identify ONLY hard factual claims — specific statistics, named studies, attributed quotes, regulatory facts, or specific dated events. DO NOT flag professional opinions, personal observations, industry perspectives, or general statements as factual claims requiring verification.\n\nPost:\n\n${postContent}\n\nFor each hard factual claim found, verify using web search and mark as:\n- Verified (include the source URL)\n- Unverifiable (opinion presented as fact — suggest rewording as personal perspective)\n- False (contradicted by credible sources)\n\nIf no hard factual claims exist (post is opinion/perspective-based), return { "overallAccuracyScore": 95, "claims": [], "summary": "Opinion-based post — no specific facts to verify", "isOpinionBased": true }.\n\nReturn ONLY a JSON object (after any research): { "overallAccuracyScore": 0-100, "claims": [{ "claim": "text", "status": "Verified|Unverifiable|False", "note": "one sentence", "sourceUrl": "URL if Verified, omit otherwise" }], "summary": "one sentence plain English summary", "isOpinionBased": boolean }`,
    }],
  });

  const raw = parseJsonObject(extractText(message.content));
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(raw.overallAccuracyScore) || 0))),
    claims: Array.isArray(raw.claims) ? raw.claims.map((c: any) => ({
      claim: String(c.claim || ''), status: String(c.status || ''), note: String(c.note || ''),
      ...(c.sourceUrl ? { sourceUrl: String(c.sourceUrl) } : {}),
    })) : [],
    summary: String(raw.summary || ''),
    isOpinionBased: !!raw.isOpinionBased,
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

const CONTENT_LENGTH_VOICE_NOTE: Record<string, string> = {
  micro: 'This post was deliberately written at "Micro" length (100-300 characters) — a single, tight idea by design. Do not mark it down for brevity, for lacking multiple beats, or for not fully elaborating — judge only whether the words actually used sound like this person.',
  short: 'This post was deliberately written at "Short" length (300-800 characters) — punchy and scannable by design. Do not mark it down for brevity or for covering fewer points than a longer post would.',
  longform: 'This post was deliberately written at "Long-form" length (1500-3000 characters) — full thought leadership by design. Do not mark it down purely for length or depth; judge voice match the same way you would a shorter post.',
};

export async function runVoiceAuthenticityCheck(
  anthropic: Anthropic, personaContext: string, postContent: string, contentLength?: string
): Promise<VoiceResult> {
  const lengthNote = contentLength ? CONTENT_LENGTH_VOICE_NOTE[contentLength] || '' : '';
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Here is writing pattern data for this user:\n\n${personaContext || 'No established voice profile yet — assess generically for authentic, natural human writing.'}\n\nHere is their generated post:\n\n${postContent}\n\n${lengthNote ? lengthNote + '\n\n' : ''}Assess how authentically this post matches their established voice. Consider: sentence length patterns, vocabulary level, use of personal pronouns, hook style, emotional register, topic relevance to their expertise.\n\nReturn ONLY a JSON object: { "voiceScore": 0-100, "matchLevel": "Excellent" | "Good" | "Moderate" | "Low", "specificMatches": ["2 things that sound like them"], "specificMismatches": ["1-2 things that feel off, empty array if none"], "suggestion": "one specific adjustment to make it sound more like them if score below 75, empty string otherwise" }`,
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

export interface ReferenceItem {
  title: string;
  url: string;
  publication: string;
  publishedDate: string;
  relevance: string;
  type: 'news' | 'research' | 'data' | 'opinion';
}

export interface ReferencesResult {
  references: ReferenceItem[];
  searchedFor: string;
  note: string;
}

export async function runSupportingReferences(anthropic: Anthropic, postContent: string): Promise<ReferencesResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Bounded so a slow/cold web search can never block the score response indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: `${getDateContext()}\n\nYou are a research assistant finding credible sources to support a LinkedIn post. Use web search.`,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Today is ${now.toISOString().split('T')[0]}. Find 3-5 credible recent articles or sources that support, contextualize, or add authority to this LinkedIn post:\n\n${postContent}\n\nFocus on:\n- Recent news articles (published in ${currentYear} where possible)\n- Industry reports or research studies\n- Credible expert opinions from recognized publications\n- Data or statistics that back up claims in the post\n\nFor each source return: { "title": "article title", "url": "direct URL", "publication": "publisher name", "publishedDate": "date if available", "relevance": "one sentence explaining how this supports the post", "type": "news" | "research" | "data" | "opinion" }\n\nOnly return sources that are: from credible recognized publications, genuinely relevant to the post's specific topic, and recent (prefer ${currentYear} and ${currentYear - 1}). Maximum 4 sources. Quality over quantity. If no credible relevant sources exist, return an empty references array with a note explaining why.\n\nReturn ONLY valid JSON (after any research): { "references": [...], "searchedFor": "brief description of what was searched", "note": "empty string if references were found, otherwise a one-sentence explanation" }`,
      }],
    }, { signal: controller.signal });

    const raw = parseJsonObject(extractText(message.content));
    const references = Array.isArray(raw.references) ? raw.references.slice(0, 4).map((r: any) => ({
      title: String(r.title || ''),
      url: String(r.url || ''),
      publication: String(r.publication || ''),
      publishedDate: String(r.publishedDate || ''),
      relevance: String(r.relevance || ''),
      type: (['news', 'research', 'data', 'opinion'].includes(r.type) ? r.type : 'news') as ReferenceItem['type'],
    })).filter((r: ReferenceItem) => r.title && r.url) : [];
    return {
      references,
      searchedFor: String(raw.searchedFor || ''),
      note: references.length ? '' : String(raw.note || 'No supporting references found for this specific angle.'),
    };
  } catch {
    return { references: [], searchedFor: '', note: 'No supporting references found for this specific angle.' };
  } finally {
    clearTimeout(timeout);
  }
}

export interface AuthenticityScoreResult {
  overallScore: number;
  readyToPost: boolean;
  accuracy: AccuracyResult;
  freshness: FreshnessResult;
  voice: VoiceResult;
  references: ReferencesResult;
  topSuggestion: string;
}

function pickTopSuggestion(accuracy: AccuracyResult, freshness: FreshnessResult, voice: VoiceResult): string {
  const candidates: { score: number; suggestion: string }[] = [];
  if (!accuracy.isOpinionBased && accuracy.score < 70) {
    const flagged = accuracy.claims.find(c => c.status === 'Unverifiable' || c.status === 'False');
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
  personaContext: string,
  contentLength?: string
): Promise<AuthenticityScoreResult> {
  const [accuracy, freshness, voice, references] = await Promise.all([
    runFactualAccuracyCheck(anthropic, postContent),
    runTopicFreshnessCheck(anthropic, postContent, userRole, userDomain),
    runVoiceAuthenticityCheck(anthropic, personaContext, postContent, contentLength),
    runSupportingReferences(anthropic, postContent),
  ]);

  const overallScore = Math.round(accuracy.score * 0.4 + freshness.score * 0.3 + voice.score * 0.3);

  return {
    overallScore,
    readyToPost: overallScore >= 70,
    accuracy,
    freshness,
    voice,
    references,
    topSuggestion: pickTopSuggestion(accuracy, freshness, voice),
  };
}
