import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { COMPETITOR_INTELLIGENCE_SYSTEM, buildCompetitorIntelligenceUserPrompt } from '../lib/intelligencePrompts';
import { readCache, writeCache } from '../lib/intelligenceCache';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

async function getProfile(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
  const role = profile?.role || 'professional';
  const industry = profile?.domain || 'business';
  const goals = profile?.goals || [];
  const goalsText = goals.length > 0 ? `Their growth goals are: ${goals.join(', ')}.` : '';
  return { role, industry, goals, goalsText };
}

async function competitorIntelligence(userId: string, forceRefresh: boolean) {
  if (!forceRefresh) {
    const cached = await readCache(supabase, userId, 'competitor');
    if (cached) return cached;
  }

  const { role, industry, goalsText } = await getProfile(userId);
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: COMPETITOR_INTELLIGENCE_SYSTEM,
    messages: [{ role: 'user', content: buildCompetitorIntelligenceUserPrompt(role, industry, goalsText) }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);

  const payload = {
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    trendingTopics: Array.isArray(parsed.trendingTopics) ? parsed.trendingTopics : [],
    role,
    industry,
    basedOn: 'AI-curated for your role and industry',
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  await writeCache(supabase, userId, 'competitor', {
    insights: payload.insights,
    trendingTopics: payload.trendingTopics,
    role,
    industry,
    basedOn: payload.basedOn,
  });

  return payload;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.method === 'POST' ? (req.body || {}) : {};
    const action = String(body.action || req.query.action || '');
    const userId = String(body.userId || req.query.userId || '');
    const forceRefresh = !!body.refresh || req.query.refresh === 'true';

    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    switch (action) {
      case 'competitor':
      case 'competitor-intelligence': {
        const result = await competitorIntelligence(userId, forceRefresh);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('Intelligence error:', error);
    res.status(500).json({ error: error.message || 'Intelligence request failed' });
  }
}
