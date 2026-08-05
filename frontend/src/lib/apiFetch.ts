import { supabase } from './supabaseClient';

/**
 * Drop-in replacement for fetch() against our own backend — attaches the
 * current Supabase session's access token as an Authorization header so
 * the backend can verify the caller actually is the userId being sent in
 * the request body (see backend/lib/verifyAuth.ts). Falls back to a plain
 * unauthenticated request if there's no active session (e.g. logged-out
 * flows), same as before this existed.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
