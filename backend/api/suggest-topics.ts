import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { query, userId } = req.body;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, domain, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';

    const personaFragment = await buildPersonaPrompt(supabase, userId);
    const expertiseContext = personaFragment ? `\n\nContext about this person:\n${personaFragment}` : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Suggest 5 trending content topics for a ${role} in the ${industry} industry${query ? ` related to "${query}"` : ''}.${expertiseContext}\n\nReturn ONLY a JSON array of strings, no explanation. Each topic should be specific and actionable (not generic). Tailor to their expertise and perspective if available.`,
        },
      ],
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
