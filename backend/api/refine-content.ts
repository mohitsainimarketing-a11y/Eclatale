import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, OUTPUT_RULES } from '../lib/contentPrompts';
import { getDateContext } from '../lib/dateContext';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { currentContent, instruction, userId } = req.body;
    if (!currentContent || !instruction || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const personaFragment = await buildPersonaPrompt(supabase, userId);

    const systemPrompt = `${getDateContext()}

${SYSTEM_PROMPT_BASE}

${personaFragment ? personaFragment + '\n' : ''}You are helping the user refine their existing post. Your job is to apply ONE specific change while preserving everything that makes the post effective.

${OUTPUT_RULES}

REFINEMENT RULES:
- Apply ONLY the change the user asked for. Do not rewrite the whole post unless explicitly asked.
- Preserve the author's voice, structure, and any specific details they included.
- If they say "make it shorter" — cut ruthlessly, do not add. If they say "punchier hook" — only rewrite the opening lines.
- If they say "more casual" — adjust tone only. If they say "add a data point" — weave one in naturally.
- Return the FULL revised post, not just the changed section.
- Do not explain what you changed. Return only the post content.`;

    const userMessage = `Here is my current draft:

${currentContent}

Apply this change: ${instruction}

Return the full revised post.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ content });
  } catch (error: any) {
    console.error('Refine error:', error);
    res.status(500).json({ error: error.message || 'Failed to refine content' });
  }
}
