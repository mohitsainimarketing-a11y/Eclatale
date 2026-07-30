import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, CONTENT_TYPE_INSTRUCTIONS, TONE_INSTRUCTIONS, OUTPUT_RULES, CONTENT_LENGTH_INSTRUCTIONS, ContentLength } from '../lib/contentPrompts';
import { getDateContext } from '../lib/dateContext';
import { getTrendContext, buildTrendPromptFragment } from '../lib/trendContext';
import { isCreditsExhaustedError, creditsExhaustedBody } from '../lib/anthropicErrors';
import { checkWeeklyPostLimit, incrementWeeklyPostCount } from '../lib/featureGates';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { topic, tone, contentType, userId, styleNudge, contentLength } = req.body;
    if (!topic || !tone || !contentType || !userId) return res.status(400).json({ error: 'Missing required fields' });
    const length: ContentLength = CONTENT_LENGTH_INSTRUCTIONS[contentLength as ContentLength] ? contentLength : 'standard';

    const limitCheck = await checkWeeklyPostLimit(supabase, userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'weekly_limit_reached',
        postsUsed: limitCheck.postsUsed,
        postsAllowed: limitCheck.postsAllowed,
        resetsAt: limitCheck.resetsAt,
        upgradeUrl: 'https://eclatale.com/pricing',
        message: `You have used all ${limitCheck.postsAllowed} of your free posts this week`,
      });
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

${styleNudge ? `Additional instruction based on this person's own writing patterns: ${styleNudge}\n` : ''}
${OUTPUT_RULES}

${CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS['linkedin-post']}

${contentType === 'linkedin-post' ? CONTENT_LENGTH_INSTRUCTIONS[length] : ''}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: `Write a ${contentType.replace(/-/g, ' ')} about: ${topic}` }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    await incrementWeeklyPostCount(supabase, userId);
    res.json({ content, usage: message.usage });
  } catch (error: any) {
    if (isCreditsExhaustedError(error)) {
      console.error('Anthropic credits exhausted');
      return res.status(503).json(creditsExhaustedBody());
    }
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
}
