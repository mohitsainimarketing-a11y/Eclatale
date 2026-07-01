import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      await supabase.from('linkedin_connections').delete().eq('user_id', userId);
      return res.json({ success: true });
    } catch (error: any) {
      console.error('LinkedIn disconnect error:', error);
      return res.status(500).json({ error: error.message || 'Failed to disconnect' });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const { data: conn } = await supabase
    .from('linkedin_connections')
    .select('linkedin_name, linkedin_picture_url, linkedin_member_id, token_expires_at, connected_at')
    .eq('user_id', userId)
    .single();

  if (!conn) return res.json({ connected: false });

  const expired = new Date(conn.token_expires_at) < new Date();

  res.json({
    connected: true,
    expired,
    name: conn.linkedin_name,
    picture: conn.linkedin_picture_url,
    memberId: conn.linkedin_member_id,
    connectedAt: conn.connected_at,
  });
}
