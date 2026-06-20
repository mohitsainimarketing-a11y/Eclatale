import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

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
    const { rawIdea, contentType, userId } = req.body;

    if (!rawIdea || !contentType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, domain, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `A ${role} in the ${industry} industry wants to create a ${contentType.replace(/-/g, ' ')} based on this rough idea:

"${rawIdea}"

Generate exactly 4 smart, specific follow-up questions that will help you write a compelling, authentic piece of content. Each question should draw out concrete details, personal experiences, specific numbers, or unique perspectives that will make the content stand out.

Return ONLY a JSON array of objects with "id" (q1-q4), "question" (the question text), and "placeholder" (a short example answer hint). No explanation.`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json({ questions });
  } catch (error: any) {
    console.error('Guided questions error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
}
