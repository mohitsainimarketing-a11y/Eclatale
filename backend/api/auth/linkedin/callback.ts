import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, `https://eclatale.com/dashboard?linkedin=error&message=${encodeURIComponent(String(oauthError))}`);
  }

  if (!code || !state) {
    return res.redirect(302, 'https://eclatale.com/dashboard?linkedin=error&message=missing_params');
  }

  const stateStr = String(state);
  const userId = stateStr.split(':')[1];
  if (!userId) {
    return res.redirect(302, 'https://eclatale.com/dashboard?linkedin=error&message=invalid_state');
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    });

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.redirect(302, 'https://eclatale.com/dashboard?linkedin=error&message=token_exchange_failed');
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in || 5184000;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let linkedinName = '';
    let linkedinPicture = '';
    let linkedinMemberId = '';

    if (profileRes.ok) {
      const profile: any = await profileRes.json();
      linkedinMemberId = profile.sub || '';
      linkedinName = profile.name || '';
      linkedinPicture = profile.picture || '';
    }

    if (!linkedinMemberId) {
      return res.redirect(302, 'https://eclatale.com/dashboard?linkedin=error&message=no_member_id');
    }

    await supabase.from('linkedin_connections').upsert({
      user_id: userId,
      linkedin_member_id: linkedinMemberId,
      linkedin_name: linkedinName,
      linkedin_picture_url: linkedinPicture,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    });

    res.redirect(302, 'https://eclatale.com/dashboard?linkedin=connected');
  } catch (error: any) {
    console.error('LinkedIn callback error:', error);
    res.redirect(302, `https://eclatale.com/dashboard?linkedin=error&message=${encodeURIComponent(error.message)}`);
  }
}
