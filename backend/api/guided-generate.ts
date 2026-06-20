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

const contentTypeInstructions: Record<string, string> = {
  'linkedin-post': 'Write a LinkedIn post (1300 characters max). Use short paragraphs, line breaks for readability, and include a hook in the first line. Do NOT use hashtags in the body — add 3-5 relevant hashtags at the very end separated by a blank line.',
  'linkedin-article': 'Write a LinkedIn article (800-1200 words). Include a compelling headline, introduction, 3-4 main sections with subheadings, and a strong conclusion with a call to action.',
  'twitter-thread': 'Write a Twitter/X thread (5-8 tweets, each under 280 characters). Number each tweet (1/, 2/, etc). First tweet should be a hook. Last tweet should be a call to action or summary.',
  'instagram-caption': 'Write an Instagram caption (under 2200 characters). Start with a hook, use conversational tone, break into short paragraphs, end with a call to action, and add 20-30 relevant hashtags at the end.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { rawIdea, contentType, tone, questions, answers, userId } = req.body;

    if (!rawIdea || !contentType || !tone || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, domain, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];

    const goalsText = goals.length > 0
      ? `Their growth goals are: ${goals.join(', ')}.`
      : '';

    const toneInstructions: Record<string, string> = {
      professional: 'Use a polished, authoritative tone. Sound knowledgeable and confident without being stiff.',
      casual: 'Use a conversational, relatable tone. Write like talking to a friend over coffee.',
      inspirational: 'Use an uplifting, motivational tone. Share insights that inspire action.',
      'data-driven': 'Use a fact-based, analytical tone. Lead with statistics and data points.',
    };

    const qaPairs = (questions || [])
      .map((q: any, i: number) => {
        const answer = answers?.[q.id] || '';
        return answer ? `Q: ${q.question}\nA: ${answer}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const personaFragment = await buildPersonaPrompt(supabase, userId);

    const systemPrompt = `You are a world-class personal brand content strategist and ghostwriter. You write content that sounds authentically human — never robotic or generic.

${personaFragment ? personaFragment + '\n' : ''}The person you're writing for:
- Role: ${role}
- Industry: ${industry}
${goalsText}

Writing style:
- ${toneInstructions[tone] || toneInstructions.professional}
- Write in first person as this professional
- Sound like a real person sharing genuine insights, not a corporate PR team
- Weave in the specific details they provided naturally — don't just list them
- Make every sentence earn its place — no filler

CRITICAL OUTPUT RULES:
- Return ONLY the post content itself. No preamble like "Here's a post for you". No introduction. No meta-commentary. No dividers like "---". Start directly with the hook line.
- NEVER use markdown formatting: no ** for bold, no * for italic, no # for headers, no backticks for code. LinkedIn and social platforms render these as literal characters, not formatting.
- For emphasis, use CAPITALIZATION, line breaks, and emoji instead of markdown symbols.
- Do not wrap the output in quotes or add any framing text around it.

Content format:
${contentTypeInstructions[contentType] || contentTypeInstructions['linkedin-post']}`;

    const userMessage = `Create a ${contentType.replace(/-/g, ' ')} based on this idea and the additional context I provided:

My idea: "${rawIdea}"

${qaPairs ? `Additional context from my answers:\n\n${qaPairs}` : ''}

Write the content now. Make it compelling, specific, and authentic to my voice.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ content, usage: message.usage });
  } catch (error: any) {
    console.error('Guided generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
}
