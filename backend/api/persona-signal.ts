import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { calculateVoiceMatchScore } from '../lib/voiceMatchScore';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Handles two signal-domain routes (mapped here via vercel.json rewrites to stay
// under the Hobby serverless-function cap):
//   POST /api/persona-signal      -> log a persona signal (kept/refined/etc.)
//   GET  /api/voice-match-score   -> compute the dynamic voice match score
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET => voice match score
  if (req.method === 'GET') {
    try {
      const userId = (req.query.userId as string) || '';
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const result = await calculateVoiceMatchScore(supabase, userId);
      return res.json(result);
    } catch (error: any) {
      console.error('Voice match score error:', error);
      return res.status(500).json({ error: error.message || 'Failed to calculate voice match score' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // POST => log persona signal
  try {
    const { userId, postId, action, tone, contentType, topicSnippet, postLength } = req.body;
    if (!userId || !action) return res.status(400).json({ error: 'Missing required fields' });

    await supabase.from('persona_signals').insert({
      user_id: userId,
      post_id: postId || null,
      action,
      tone: tone || null,
      content_type: contentType || null,
      topic_snippet: topicSnippet || null,
      post_length: postLength || null,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Signal logging error:', error);
    res.status(500).json({ error: error.message || 'Failed to log signal' });
  }
}
