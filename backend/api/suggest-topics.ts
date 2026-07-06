import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { TOPIC_SUGGESTION_PROMPT } from '../lib/contentPrompts';
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
    const { query, userId } = req.body;

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';

    const personaFragment = await buildPersonaPrompt(supabase, userId);

    const topicPrompt = `${getDateContext()}

${TOPIC_SUGGESTION_PROMPT
      .replace("${'{role}'}", role)
      .replace("${'{industry}'}", industry)}`;

    const userMessage = `Suggest 5 timely, high-signal content topics for a ${role} in the ${industry} industry${query ? ` related to "${query}"` : ''}.

${personaFragment ? `About this person:\n${personaFragment}\n` : ''}

Think about what's happening RIGHT NOW in ${industry}: new tools, shifting strategies, recent failures/successes in the news, emerging debates, regulatory changes, cultural shifts.

Also, NEVER use em dashes, en dashes, or arrows in the topic text. Write naturally with periods and commas.

Return ONLY a JSON array of 5 strings. Each topic should be specific enough to immediately write about, not a vague category.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: topicPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const topics = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json({ topics });
  } catch (error: any) {
    console.error('Topic suggestion error:', error);
    res.status(500).json({ error: error.message || 'Failed to suggest topics' });
  }
}
