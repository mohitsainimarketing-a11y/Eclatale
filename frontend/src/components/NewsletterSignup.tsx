import React, { useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface NewsletterSignupProps {
  className?: string;
  label?: string;
}

export default function NewsletterSignup({ className = '', label = 'Get weekly LinkedIn growth tips' }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/email/newsletter-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error('Subscribe failed');
      setStatus('success');
      trackEvent('newsletter_subscribe');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className={`flex items-center gap-2 text-sm font-semibold text-brand-teal ${className}`}>
        <Check size={16} /> You're subscribed — check your inbox!
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`w-full md:w-auto ${className}`}>
      {label && <p className="text-sm font-semibold text-brand-dark mb-2 flex items-center gap-1.5"><Mail size={14} /> {label}</p>}
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="input !py-2.5 !min-h-0 w-full md:w-56"
        />
        <button type="submit" disabled={status === 'loading'} className="btn-primary !py-2.5 !px-5 text-sm flex-shrink-0">
          {status === 'loading' ? '...' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && <p className="text-xs text-red-500 mt-1.5">Something went wrong — please try again.</p>}
    </form>
  );
}
