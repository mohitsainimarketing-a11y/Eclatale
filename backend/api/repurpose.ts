import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, CONTENT_TYPE_INSTRUCTIONS, TONE_INSTRUCTIONS, OUTPUT_RULES, CONTENT_LENGTH_INSTRUCTIONS, ContentLength } from '../lib/contentPrompts';
import { getDateContext } from '../lib/dateContext';
import { getTrendContext, buildTrendPromptFragment } from '../lib/trendContext';
import { isCreditsExhaustedError, creditsExhaustedBody } from '../lib/anthropicErrors';
import { requireFeature } from '../lib/featureGates';
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
    const { sourceText, contentType, tone, contentLength, mode, userReaction } = req.body;
    let userId = req.body.userId;
    if (!sourceText || !contentType || !tone || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const authCheck = await checkAuthToken(supabase, req);
    const reconciled = reconcileUserId(userId, authCheck);
    if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
    userId = reconciled.userId;
    const repurposeMode: 'voice' | 'pattern' | 'reaction' = ['voice', 'pattern', 'reaction'].includes(mode) ? mode : 'voice';
    if (repurposeMode === 'reaction' && !String(userReaction || '').trim()) {
      return res.status(400).json({ error: 'Missing userReaction for "My reaction" mode' });
    }
    const length: ContentLength = CONTENT_LENGTH_INSTRUCTIONS[contentLength as ContentLength] ? contentLength : 'standard';

    const locked = await requireFeature(supabase, userId, 'repurposeContent');
    if (locked) return res.status(403).json(locked);

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];
    const goalsText = goals.length > 0 ? `Their growth goals are: ${goals.join(', ')}.` : '';

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
${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional}

${OUTPUT_RULES}

${CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS['linkedin-post']}

${contentType === 'linkedin-post' ? CONTENT_LENGTH_INSTRUCTIONS[length] : ''}

REPURPOSING RULES:
- Do NOT copy phrases verbatim from the source. Synthesize, filter, and elevate.
- Find the angle that resonates most for a ${role} in ${industry}.
- The source material is raw material. The output should feel original.
${repurposeMode === 'voice' ? `- Extract the core insight, argument, or most valuable idea from the source material.
- Reframe it completely in the author's authentic voice — this is their commentary on it, not a repost.
- Add a personal perspective frame — the reader should feel this is the author's genuine take, not borrowed content.` : ''}
${repurposeMode === 'pattern' ? `- Identify the STRUCTURAL pattern the source uses (its hook type, how it builds, how it closes) and reuse that exact structure/shape for a completely different, original point — the pattern is what's borrowed, never the content or opinion.` : ''}
${repurposeMode === 'reaction' ? `- The author has a specific personal reaction to this source, provided below. Build the post around THEIR reaction/opinion, using the source only as the trigger or backdrop — the source's ideas are not the point, the author's take on them is.` : ''}`;

    let extractedPattern = '';
    if (repurposeMode === 'pattern') {
      const patternMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Describe the structural pattern of this piece of content in one short line, arrow-separated, e.g. "Hook: bold statement → 3 numbered insights → Question CTA". Be specific about the actual structure used, not generic.\n\nCONTENT:\n${sourceText.substring(0, 3000)}`,
        }],
      });
      extractedPattern = patternMsg.content[0]?.type === 'text' ? patternMsg.content[0].text.trim() : '';
    }

    const userMessage = repurposeMode === 'reaction'
      ? `Here is source material my reader may recognize, and my own reaction to it. Write a ${contentType.replace(/-/g, ' ')} built around MY reaction below, using the source only as context:

SOURCE MATERIAL:
${sourceText.substring(0, 4000)}

MY REACTION / TAKE:
${String(userReaction).substring(0, 1000)}

Write the post primarily from my reaction — the source is backdrop, not the subject.`
      : repurposeMode === 'pattern'
      ? `Repurpose this into a compelling ${contentType.replace(/-/g, ' ')}, reusing this exact structural pattern: ${extractedPattern}

SOURCE MATERIAL (for context only — do not reuse its ideas or opinions, only its shape):
${sourceText.substring(0, 4000)}

Fill that structure with a completely original point relevant to a ${role} in ${industry}.`
      : `Repurpose this into a compelling ${contentType.replace(/-/g, ' ')} written in my authentic voice:

SOURCE MATERIAL:
${sourceText.substring(0, 4000)}

Extract the key insight, filter it through my perspective as a ${role} in ${industry}, and create original content from it.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ content, ...(extractedPattern ? { extractedPattern } : {}) });
  } catch (error: any) {
    if (isCreditsExhaustedError(error)) {
      console.error('Anthropic credits exhausted');
      return res.status(503).json(creditsExhaustedBody());
    }
    console.error('Repurpose error:', error);
    res.status(500).json({ error: error.message || 'Failed to repurpose content' });
  }
}
