import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, CONTENT_TYPE_INSTRUCTIONS, TONE_INSTRUCTIONS, OUTPUT_RULES } from '../lib/contentPrompts';
import { getDateContext } from '../lib/dateContext';
import { getTrendContext, buildTrendPromptFragment } from '../lib/trendContext';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { sourceText, contentType, tone, userId } = req.body;
    if (!sourceText || !contentType || !tone || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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

REPURPOSING RULES:
- Extract the core insight, argument, or most valuable idea from the source material.
- Reframe it completely in the author's authentic voice — this is their commentary on it, not a repost.
- Do NOT copy phrases verbatim from the source. Synthesize, filter, and elevate.
- Find the angle that resonates most for a ${role} in ${industry}.
- Add a personal perspective frame — the reader should feel this is the author's genuine take, not borrowed content.
- The source material is raw material. The output should feel original.`;

    const userMessage = `Repurpose this into a compelling ${contentType.replace(/-/g, ' ')} written in my authentic voice:

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
    res.json({ content });
  } catch (error: any) {
    console.error('Repurpose error:', error);
    res.status(500).json({ error: error.message || 'Failed to repurpose content' });
  }
}
