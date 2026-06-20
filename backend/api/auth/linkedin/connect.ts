import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const state = crypto.randomBytes(16).toString('hex') + ':' + userId;
  const scopes = ['openid', 'profile', 'email', 'w_member_social'];

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    state,
    scope: scopes.join(' '),
  });

  res.redirect(302, `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
}
