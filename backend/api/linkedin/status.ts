import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

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
