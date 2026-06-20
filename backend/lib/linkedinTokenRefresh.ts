import { SupabaseClient } from '@supabase/supabase-js';

interface LinkedInConnection {
  id: string;
  user_id: string;
  linkedin_member_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
}

export async function getValidToken(
  supabase: SupabaseClient,
  userId: string
): Promise<{ token: string; memberId: string } | { error: string }> {
  const { data: conn } = await supabase
    .from('linkedin_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!conn) return { error: 'LinkedIn not connected. Please connect your account first.' };

  const expiresAt = new Date(conn.token_expires_at);
  const now = new Date();
  const fiveMinBuffer = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > fiveMinBuffer) {
    return { token: conn.access_token, memberId: conn.linkedin_member_id };
  }

  if (!conn.refresh_token) {
    return { error: 'LinkedIn token expired and no refresh token available. Please reconnect.' };
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      return { error: 'LinkedIn token refresh failed. Please reconnect your account.' };
    }

    const data: any = await res.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase.from('linkedin_connections').update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || conn.refresh_token,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    return { token: data.access_token, memberId: conn.linkedin_member_id };
  } catch {
    return { error: 'Failed to refresh LinkedIn token. Please reconnect.' };
  }
}
