import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { TOPIC_SUGGESTION_PROMPT } from '../lib/contentPrompts';
import { getDateContext } from '../lib/dateContext';
import { getTrendContext, buildTrendPromptFragment } from '../lib/trendContext';
import { readCache, writeCache } from '../lib/intelligenceCache';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { query, userId, refresh } = req.body;
    const cacheable = !query; // only cache the no-query "Find ideas" case, not free-text searches

    if (cacheable && !refresh) {
      const cached = await readCache(supabase, userId, 'topic-suggestions', SIX_HOURS_MS);
      if (cached) return res.json(cached);
    }

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';

    const personaFragment = await buildPersonaPrompt(supabase, userId);
    const trendResult = await getTrendContext(anthropic, supabase, industry, role);
    const trendFragment = buildTrendPromptFragment(trendResult, industry);

    const topicPrompt = `${getDateContext()}

${trendFragment ? trendFragment + '\n\n' : ''}${TOPIC_SUGGESTION_PROMPT
      .replace("${'{role}'}", role)
      .replace("${'{industry}'}", industry)}`;

    const userMessage = `Suggest 5 timely, high-signal content topics for a ${role} in the ${industry} industry${query ? ` related to "${query}"` : ''}.

${personaFragment ? `About this person:\n${personaFragment}\n` : ''}

Think about what's happening RIGHT NOW in ${industry}: new tools, shifting strategies, recent failures/successes in the news, emerging debates, regulatory changes, cultural shifts.

Also, NEVER use em dashes, en dashes, or arrows in the topic text. Write naturally with periods and commas.

For EACH topic, decide whether it's "trending" (tied to something happening this specific month, e.g. ${trendResult.trends.length ? trendResult.trends.join(', ') : 'a current event, launch, or news item'}) or "evergreen" (a timeless angle that would work any month). Give a one-sentence "whyNow" explaining specifically why THIS topic matters in the current month, tied to something concrete, not generic ("Google's third-party cookie deprecation is hitting mid-market teams hardest this quarter" is good; "AI is changing everything" is not).

Return ONLY a JSON array of 5 objects, each shaped exactly like: { "topic": "the topic text", "whyNow": "one sentence on why this is timely right now", "trending": true or false }. No other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 900,
      system: topicPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const raw = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    const topics = Array.isArray(raw) ? raw.map((t: any) => ({
      topic: String(t.topic || t || ''),
      whyNow: String(t.whyNow || ''),
      trending: !!t.trending,
    })).filter(t => t.topic) : [];

    const payload = { topics, generatedAt: new Date().toISOString(), cached: false };
    if (cacheable) await writeCache(supabase, userId, 'topic-suggestions', payload);

    res.json(payload);
  } catch (error: any) {
    console.error('Topic suggestion error:', error);
    res.status(500).json({ error: error.message || 'Failed to suggest topics' });
  }
}
