import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, CONTENT_TYPE_INSTRUCTIONS, OUTPUT_RULES } from '../lib/contentPrompts';
import { getDateContext } from '../lib/dateContext';
import { isCreditsExhaustedError, creditsExhaustedBody } from '../lib/anthropicErrors';
import { checkAuthToken, reconcileUserId } from '../lib/verifyAuth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const FORMAT_LABELS: Record<string, string> = {
  'linkedin-post': 'LinkedIn post',
  'linkedin-article': 'LinkedIn article',
  'twitter-thread': 'X/Twitter thread',
  'instagram-caption': 'Instagram caption',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Missing request body' });
    const { currentContent, targetFormat } = req.body;
    let userId = req.body.userId;
    if (!currentContent || !targetFormat || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const authCheck = await checkAuthToken(supabase, req);
    const reconciled = reconcileUserId(userId, authCheck);
    if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
    userId = reconciled.userId;

    const personaFragment = await buildPersonaPrompt(supabase, userId);
    const targetLabel = FORMAT_LABELS[targetFormat] || targetFormat;
    const formatInstructions = CONTENT_TYPE_INSTRUCTIONS[targetFormat] || CONTENT_TYPE_INSTRUCTIONS['linkedin-post'];

    const systemPrompt = `${getDateContext()}

${SYSTEM_PROMPT_BASE}

${personaFragment ? personaFragment + '\n' : ''}You are adapting existing content to a new format. Your job is to preserve the core insight, specific facts, and the author's authentic voice — while restructuring completely for the target platform's conventions.

${OUTPUT_RULES}

${formatInstructions}

ADAPTATION RULES:
- Preserve the main argument, specific numbers, examples, and story beats from the original.
- Keep the author's voice and distinctive phrasing where it fits the new format.
- Restructure aggressively to match the new format (length, hook style, pacing, structure).
- Do NOT water down or genericize — the specificity is the value.
- Return only the adapted content. No preamble, no explanation, no "Here's the adapted version:".`;

    const userMessage = `Adapt this content into a ${targetLabel}:

ORIGINAL:
${currentContent.substring(0, 4000)}

Return the full adapted ${targetLabel}.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ content });
  } catch (error: any) {
    if (isCreditsExhaustedError(error)) {
      console.error('Anthropic credits exhausted');
      return res.status(503).json(creditsExhaustedBody());
    }
    console.error('Adapt content error:', error);
    res.status(500).json({ error: error.message || 'Failed to adapt content' });
  }
}
