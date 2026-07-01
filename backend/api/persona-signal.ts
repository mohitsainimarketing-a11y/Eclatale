import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
