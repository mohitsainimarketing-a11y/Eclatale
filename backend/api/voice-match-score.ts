import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { calculateVoiceMatchScore } from '../lib/voiceMatchScore';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = (req.query.userId as string) || '';
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const result = await calculateVoiceMatchScore(supabase, userId);
    res.json(result);
  } catch (error: any) {
    console.error('Voice match score error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate voice match score' });
  }
}
