import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const TYPE_LABELS: Record<string, string> = {
  notif_weekly_digest: 'weekly digest',
  notif_post_reminders: 're-engagement',
  digest: 'weekly digest',
  reengagement: 're-engagement',
};

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [label, setLabel] = useState('email');

  const token = params.get('token') || '';
  const type = params.get('type') || '';

  useEffect(() => {
    const run = async () => {
      if (!token || !type) { setStatus('error'); return; }
      setLabel(TYPE_LABELS[type] || type);
      try {
        const res = await apiFetch(`${API_URL}/api/email/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, type }),
        });
        const data = await res.json();
        setStatus(data.ok ? 'done' : 'error');
      } catch {
        setStatus('error');
      }
    };
    run();
  }, [token, type]);

  return (
    <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5">
      <div className="card p-7 md:p-8 max-w-[420px] w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={32} className="animate-spin text-brand-purple mx-auto mb-4" />
            <p className="text-sm text-brand-muted">Updating your preferences...</p>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 size={32} className="text-brand-teal mx-auto mb-4" />
            <h2 className="h2 text-brand-dark mb-2">You're unsubscribed</h2>
            <p className="body-text text-sm mb-6">
              You won't receive {label} emails from Eclatale anymore. You can turn this back on anytime in Settings.
            </p>
            <a href="/settings" className="btn-secondary w-full text-[15px] inline-flex justify-center mb-3">
              Manage email preferences
            </a>
            <a href="/dashboard" className="text-sm text-brand-purple font-semibold hover:underline">
              Back to dashboard
            </a>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={32} className="text-red-500 mx-auto mb-4" />
            <h2 className="h2 text-brand-dark mb-2">Link expired or invalid</h2>
            <p className="body-text text-sm mb-6">
              This unsubscribe link couldn't be processed. You can manage your email preferences directly from Settings instead.
            </p>
            <a href="/settings" className="btn-primary w-full text-[15px] inline-flex justify-center">
              Go to Settings
            </a>
          </>
        )}
      </div>
    </div>
  );
}
