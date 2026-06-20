import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, CONTENT_TYPE_INSTRUCTIONS, TONE_INSTRUCTIONS, OUTPUT_RULES } from '../lib/contentPrompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { rawIdea, contentType, tone, questions, answers, userId } = req.body;
    if (!rawIdea || !contentType || !tone || !userId) return res.status(400).json({ error: 'Missing required fields' });

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];
    const goalsText = goals.length > 0 ? `Their growth goals are: ${goals.join(', ')}.` : '';

    const personaFragment = await buildPersonaPrompt(supabase, userId);

    const qaPairs = (questions || [])
      .map((q: any) => { const a = answers?.[q.id] || ''; return a ? `Q: ${q.question}\nA: ${a}` : ''; })
      .filter(Boolean)
      .join('\n\n');

    const systemPrompt = `${SYSTEM_PROMPT_BASE}

${personaFragment ? personaFragment + '\n' : ''}The person you're writing for:
- Role: ${role}
- Industry: ${industry}
${goalsText}

${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional}

Additional instruction for guided creation:
- The user provided a raw idea and answered clarifying questions. Your job is to transform their rough thoughts into a polished, high-performing piece of content.
- Weave their specific details NATURALLY. Don't just list their answers. The reader should never sense that this was generated from a questionnaire.
- The user's raw voice and specific details are the gold. Elevate them, don't replace them with generic language.

${OUTPUT_RULES}

${CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS['linkedin-post']}`;

    const userMessage = `Create a ${contentType.replace(/-/g, ' ')} based on this idea and context:

My idea: "${rawIdea}"

${qaPairs ? `Context from my answers:\n\n${qaPairs}` : ''}

Transform this into compelling content. Make it specific, authentic, and impossible to scroll past.`;

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
