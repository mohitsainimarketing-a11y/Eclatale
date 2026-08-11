// Google Identity Services (GIS) — lets "Continue with Google" run entirely
// from our own page (eclatale.com) instead of redirecting through Supabase's
// hosted /auth/v1/authorize endpoint, which is what put "supabase.co" in
// front of users on the Google consent screen. GIS gives us an ID token
// directly, which we hand to supabase.auth.signInWithIdToken().

let scriptPromise: Promise<void> | null = null;

export function loadGoogleIdentityScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) { resolve(); return; }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Supabase's signInWithIdToken flow wants the RAW nonce (to verify against
// the ID token's nonce claim), but Google's client library wants the
// SHA-256 hash of it — see https://supabase.com/docs/guides/auth/social-login/auth-google#authentication-flow.
export async function generateNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)));
  const nonce = btoa(String.fromCharCode(...randomBytes));
  const encoded = new TextEncoder().encode(nonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashedNonce = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { nonce, hashedNonce };
}
