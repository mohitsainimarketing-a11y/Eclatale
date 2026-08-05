import { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

export interface AuthCheckResult {
  /** The verified user id from a valid Authorization token, or null if no token was sent. */
  verifiedUserId: string | null;
  /** True if a token WAS sent but failed verification (expired, malformed, revoked). */
  tokenInvalid: boolean;
}

/**
 * Verifies the Authorization: Bearer <token> header against Supabase Auth,
 * if one was sent. Does NOT require a token to be present — callers decide
 * what to do with the result, so existing clients that haven't been
 * updated to send one yet keep working during rollout. Once a token IS
 * sent, callers should treat verifiedUserId as the source of truth over
 * any client-supplied userId in the request body.
 */
export async function checkAuthToken(supabase: SupabaseClient, req: VercelRequest): Promise<AuthCheckResult> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { verifiedUserId: null, tokenInvalid: false };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { verifiedUserId: null, tokenInvalid: true };
  return { verifiedUserId: data.user.id, tokenInvalid: false };
}

/**
 * Reconciles a client-supplied userId against a verified token, per the
 * staged rollout: a mismatch or invalid token is rejected outright; a
 * missing token falls back to trusting the body (pre-rollout behavior)
 * so unconverted callers don't break.
 */
export function reconcileUserId(bodyUserId: string, auth: AuthCheckResult): { userId: string; error?: { status: number; message: string } } {
  if (auth.tokenInvalid) return { userId: bodyUserId, error: { status: 401, message: 'Invalid or expired session token' } };
  if (auth.verifiedUserId && auth.verifiedUserId !== bodyUserId) {
    return { userId: bodyUserId, error: { status: 403, message: 'Token does not match requested userId' } };
  }
  return { userId: auth.verifiedUserId || bodyUserId };
}
