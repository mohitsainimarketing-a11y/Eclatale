import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

type Status = 'checking' | 'connecting' | 'connected' | 'not-logged-in' | 'error' | 'no-extension-id';

export default function ExtensionAuth() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extId = params.get('extId');

    if (!extId) { setStatus('no-extension-id'); return; }

    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) { setStatus('not-logged-in'); return; }

      setStatus('connecting');
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, profile_photo_url')
        .eq('id', session.user.id)
        .maybeSingle();

      const user = {
        id: session.user.id,
        email: session.user.email,
        firstName: profile?.first_name || session.user.email?.split('@')[0] || 'there',
        avatarUrl: profile?.profile_photo_url || '',
      };

      const chromeApi = (window as any).chrome;
      if (!chromeApi?.runtime?.sendMessage) { setStatus('error'); return; }

      chromeApi.runtime.sendMessage(
        extId,
        { type: 'ECLATALE_AUTH', token: session.access_token, user },
        (response: any) => {
          if (chromeApi.runtime.lastError || !response?.ok) { setStatus('error'); return; }
          setStatus('connected');
        }
      );
    }).catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen gradient-bg-page flex items-center justify-center p-6">
      <div className="card p-8 max-w-sm w-full text-center">
        <h1 className="text-lg font-extrabold text-brand-dark mb-1">Eclatale · Extension</h1>

        {status === 'checking' && (
          <div className="py-6"><Loader2 size={24} className="animate-spin text-brand-purple mx-auto" /></div>
        )}

        {status === 'connecting' && (
          <div className="py-6">
            <Loader2 size={24} className="animate-spin text-brand-purple mx-auto mb-3" />
            <p className="text-sm text-brand-muted">Connecting your extension…</p>
          </div>
        )}

        {status === 'connected' && (
          <div className="py-6">
            <CheckCircle size={36} className="text-brand-teal mx-auto mb-3" />
            <p className="text-sm font-semibold text-brand-dark">Extension connected!</p>
            <p className="text-xs text-brand-muted mt-1">You can close this tab.</p>
          </div>
        )}

        {status === 'not-logged-in' && (
          <div className="py-6">
            <p className="text-sm text-brand-muted mb-4">Log in to Eclatale first, then reopen the extension.</p>
            <a href={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="btn-primary w-full inline-flex items-center justify-center text-sm">
              Log in →
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm text-brand-muted">Couldn't connect to the extension. Make sure it's installed and try again from the extension popup.</p>
          </div>
        )}

        {status === 'no-extension-id' && (
          <div className="py-6">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm text-brand-muted">This page should be opened from the Eclatale extension's "Sign in" button, not visited directly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
