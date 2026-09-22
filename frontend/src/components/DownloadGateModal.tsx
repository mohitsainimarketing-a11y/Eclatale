import React, { useState } from 'react';
import { Download, X, Mail, Loader2 } from 'lucide-react';
import type { Resource } from '../data/resources';
import { apiFetch } from '../lib/apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

export default function DownloadGateModal({ resource, onClose, onSuccess }: { resource: Resource; onClose: () => void; onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await apiFetch(`${API_URL}/api/email/newsletter-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: `resource:${resource.slug}` }),
      });
      if (!res.ok) throw new Error('Signup failed');
      onSuccess(email.trim());
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-[rgba(15,10,30,0.5)] backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 relative animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-brand-muted hover:text-brand-dark">
          <X size={18} />
        </button>
        <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center text-xl mb-4">
          {resource.emoji}
        </div>
        <h3 className="text-base font-extrabold text-brand-dark mb-1.5 leading-snug">Get "{resource.title}"</h3>
        <p className="text-xs text-brand-muted mb-4 leading-relaxed">
          One quick step. Enter your email and the download starts immediately.
        </p>
        <form onSubmit={submit}>
          <div className="relative mb-3">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="input !pl-9 !py-2.5 w-full text-sm"
            />
          </div>
          <button type="submit" disabled={status === 'loading'} className="btn-primary w-full inline-flex items-center justify-center gap-2 text-sm !py-2.5 disabled:opacity-60">
            {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {status === 'loading' ? 'Sending...' : 'Get My Free Guide'}
          </button>
          {status === 'error' && <p className="text-xs text-red-500 mt-2">Something went wrong. Please try again.</p>}
        </form>
        <p className="text-[10.5px] text-brand-muted mt-4 text-center">No spam. Unsubscribe anytime.</p>
      </div>
    </div>
  );
}
