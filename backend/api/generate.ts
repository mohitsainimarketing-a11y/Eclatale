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

const contentTypeInstructions: Record<string, string> = {
  'linkedin-post': 'Write a LinkedIn post (1300 characters max). Use short paragraphs, line breaks for readability, and include a hook in the first line. Do NOT use hashtags in the body — add 3-5 relevant hashtags at the very end separated by a blank line.',
  'linkedin-article': 'Write a LinkedIn article (800-1200 words). Include a compelling headline, introduction, 3-4 main sections with subheadings, and a strong conclusion with a call to action.',
  'twitter-thread': 'Write a Twitter/X thread (5-8 tweets, each under 280 characters). Number each tweet (1/, 2/, etc). First tweet should be a hook. Last tweet should be a call to action or summary.',
  'instagram-caption': 'Write an Instagram caption (under 2200 characters). Start with a hook, use conversational tone, break into short paragraphs, end with a call to action, and add 20-30 relevant hashtags at the end.',
};

const toneInstructions: Record<string, string> = {
  professional: 'Use a polished, authoritative tone. Sound knowledgeable and confident without being stiff. Use industry terminology where appropriate.',
  casual: 'Use a conversational, relatable tone. Write like you\'re talking to a friend over coffee. Use contractions, simple language, and occasional humor.',
  inspirational: 'Use an uplifting, motivational tone. Share insights that inspire action. Use powerful language, storytelling elements, and emotional resonance.',
  'data-driven': 'Use a fact-based, analytical tone. Lead with statistics, research, or data points. Back up claims with evidence. Use precise language.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { topic, tone, contentType, userId } = req.body;

    if (!topic || !tone || !contentType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, industry, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.industry || 'business';
    const goals = profile?.goals || [];

    const goalsText = goals.length > 0
      ? `Their growth goals are: ${goals.join(', ')}.`
      : '';

    const systemPrompt = `You are a world-class personal brand content strategist and ghostwriter. You write content that sounds authentically human — never robotic or generic.

The person you're writing for:
- Role: ${role}
- Industry: ${industry}
${goalsText}

Your writing style guidelines:
- ${toneInstructions[tone] || toneInstructions.professional}
- Write in first person as this professional
- Sound like a real person sharing genuine insights, not a corporate PR team
- Include specific, concrete examples or anecdotes when possible
- Make every sentence earn its place — no filler

Content format:
${contentTypeInstructions[contentType] || contentTypeInstructions['linkedin-post']}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Write a ${contentType.replace('-', ' ')} about: ${topic}`,
        },
      ],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ content, usage: message.usage });
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
}
