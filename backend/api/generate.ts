import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, CONTENT_TYPE_INSTRUCTIONS, TONE_INSTRUCTIONS, OUTPUT_RULES, CONTENT_LENGTH_INSTRUCTIONS, ContentLength } from '../lib/contentPrompts';
import { getWritingStyle, UNIVERSAL_HUMAN_WRITING_RULES, lengthInstruction, TALK_LENGTH_OPTIONS } from '../lib/writingStyles';
import { getDateContext } from '../lib/dateContext';
import { getTrendContext, buildTrendPromptFragment } from '../lib/trendContext';
import { isCreditsExhaustedError, creditsExhaustedBody } from '../lib/anthropicErrors';
import { checkWeeklyPostLimit, incrementWeeklyPostCount } from '../lib/featureGates';
import { handleSendFreeLimit } from './intelligence';
import { checkAuthToken, reconcileUserId } from '../lib/verifyAuth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Missing request body' });
    const { topic, tone, contentType, styleNudge, contentLength, angleTags, structureTag } = req.body;
    // Smart Canvas angle-driven generation (Phase 2): `angle` carries the
    // style/hook/insight picked in Phase 1, `spark` is optional grounding
    // context (a URL's extracted text, or free-typed context) already
    // resolved to plain text client-side via /api/intelligence?action=fetch-url.
    const angle: { style?: string; styleId?: string; hook?: string; insight?: string } | undefined =
      req.body.angle && typeof req.body.angle === 'object' ? req.body.angle : undefined;
    const spark = typeof req.body.spark === 'string' ? req.body.spark.trim() : '';
    let userId = req.body.userId;
    if (!topic || !tone || !contentType || !userId) return res.status(400).json({ error: 'Missing required fields' });
    const authCheck = await checkAuthToken(supabase, req);
    const reconciled = reconcileUserId(userId, authCheck);
    if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
    userId = reconciled.userId;
    const length: ContentLength = CONTENT_LENGTH_INSTRUCTIONS[contentLength as ContentLength] ? contentLength : 'standard';
    // Angle-driven posts use the word-count length tiers from writingStyles.ts
    // (matches the Smart Canvas length pills exactly); non-angle callers keep
    // the legacy character-count tiers for backward compatibility.
    const useWordLength = !!angle && TALK_LENGTH_OPTIONS.some(o => o.id === contentLength);

    const limitCheck = await checkWeeklyPostLimit(supabase, userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'weekly_limit_reached',
        postsUsed: limitCheck.postsUsed,
        postsAllowed: limitCheck.postsAllowed,
        resetsAt: limitCheck.resetsAt,
        upgradeUrl: 'https://eclatale.com/pricing',
        message: `You have used all ${limitCheck.postsAllowed} of your free posts this week`,
      });
    }

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];
    const goalsText = goals.length > 0 ? `Their growth goals are: ${goals.join(', ')}.` : '';

    const STRUCTURE_FRAMEWORKS: Record<string, string> = {
      AIDA: 'the AIDA framework (Attention: open with a scroll-stopping hook, Interest: build curiosity, Desire: make the reader want the outcome, Action: end with a clear next step)',
      PAS: 'the PAS framework (Problem: name a real problem the reader has, Agitate: make the cost of that problem vivid, Solution: give the fix)',
      BAB: 'the Before/After/Bridge framework (Before: paint the reader\'s current state, After: paint the better state, Bridge: show how to get there)',
      PPP: 'the Problem/Promise/Proof framework (Problem: name the problem, Promise: state the outcome you\'re promising, Proof: back it with evidence or a specific result)',
    };
    const angleFragment = Array.isArray(angleTags) && angleTags.length
      ? `\nWrite this from the following angle(s): ${angleTags.join(', ')}.\n`
      : '';
    const structureFragment = structureTag && STRUCTURE_FRAMEWORKS[structureTag]
      ? `\nStructure the post using ${STRUCTURE_FRAMEWORKS[structureTag]}.\n`
      : '';

    const writingStyle = angle?.styleId ? getWritingStyle(angle.styleId) : undefined;
    const hookFragment = angle?.hook
      ? `\nOpen with or closely riff on this exact hook — keep its energy and specificity, minor wording changes are fine: "${angle.hook}"\n`
      : '';
    const insightFragment = angle?.insight ? `\nWhy this angle resonates with this reader: ${angle.insight}\n` : '';
    const sparkFragment = spark
      ? `\nWhat sparked this post — ground the content in this, don't ignore it:\n${spark.slice(0, 4000)}\n`
      : '';

    const personaFragment = await buildPersonaPrompt(supabase, userId);
    const trendResult = await getTrendContext(anthropic, supabase, industry, role);
    const trendFragment = buildTrendPromptFragment(trendResult, industry);

    const systemPrompt = `${getDateContext()}

${SYSTEM_PROMPT_BASE}

${personaFragment ? personaFragment + '\n' : ''}The person you're writing for:
- Role: ${role}
- Industry: ${industry}
${goalsText}

${trendFragment ? trendFragment + '\n' : ''}
${writingStyle ? writingStyle.prompt : (TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional)}

${styleNudge ? `Additional instruction based on this person's own writing patterns: ${styleNudge}\n` : ''}
${angleFragment}${structureFragment}${hookFragment}${insightFragment}${sparkFragment}
${OUTPUT_RULES}
${angle ? `\n${UNIVERSAL_HUMAN_WRITING_RULES}\n` : ''}
${CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS['linkedin-post']}

${useWordLength ? lengthInstruction(contentLength) : (contentType === 'linkedin-post' ? CONTENT_LENGTH_INSTRUCTIONS[length] : '')}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: `Write a ${contentType.replace(/-/g, ' ')} about: ${topic}` }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    await incrementWeeklyPostCount(supabase, userId);
    // No-ops unless this was exactly the 3rd post of the week on the free tier.
    handleSendFreeLimit(userId).catch(err => console.error('free-limit notify failed:', err));
    res.json({ content, usage: message.usage });
  } catch (error: any) {
    if (isCreditsExhaustedError(error)) {
      console.error('Anthropic credits exhausted');
      return res.status(503).json(creditsExhaustedBody());
    }
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
}
