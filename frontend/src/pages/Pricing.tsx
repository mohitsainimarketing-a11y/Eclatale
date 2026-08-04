import React, { useEffect, useState } from 'react';
import { Check, Zap, ChevronDown, ArrowLeft, Loader2, ShieldCheck, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { trackEvent } from '../lib/analytics';
import Seo from '../components/Seo';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const LAUNCH_OFFER_DAYS = 30;

const FREE_FEATURES = [
  'Basic AI content generation',
  '3 posts per week',
  'LinkedIn publishing',
  'Content history (last 10 posts)',
  'Basic dashboard',
];

const INDIVIDUAL_FEATURES = [
  'Everything in Free',
  'Unlimited posts',
  'Full AI persona voice learning',
  'Content authenticity scoring',
  'Competitor intelligence',
  'Profile optimizer',
  'Best time to post',
  'Visual creator',
  'Weekly growth digest',
  'Post scheduling',
  'Full content history & writing insights',
];

const COMPARISON_ROWS: { label: string; free: string | boolean; individual: string | boolean }[] = [
  { label: 'Posts per week', free: '3', individual: 'Unlimited' },
  { label: 'AI content generation', free: true, individual: true },
  { label: 'LinkedIn publishing', free: true, individual: true },
  { label: 'Guided creation mode', free: false, individual: true },
  { label: 'Repurpose content', free: false, individual: true },
  { label: 'Persona voice learning', free: false, individual: true },
  { label: 'Authenticity score', free: false, individual: true },
  { label: 'Visual creator', free: false, individual: true },
  { label: 'Competitor intelligence', free: false, individual: true },
  { label: 'Profile optimizer', free: false, individual: true },
  { label: 'Best time to post', free: false, individual: true },
  { label: 'Weekly digest', free: false, individual: true },
  { label: 'Post scheduling', free: false, individual: true },
  { label: 'Content history', free: 'Last 10', individual: 'Unlimited' },
  { label: 'Writing insights', free: false, individual: true },
  { label: 'Analytics page', free: false, individual: true },
];

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — 7 days free on the Individual plan, cancel anytime before it ends and you will not be charged.' },
  { q: 'What happens after the trial?', a: 'Your card is automatically charged $19/mo unless you cancel before the trial ends.' },
  { q: 'Can I cancel anytime?', a: 'Yes, immediately from your account settings. You keep access until the end of your current billing period.' },
  { q: 'Do you offer refunds?', a: 'Yes — a full refund, no questions asked, within 7 days of your first charge.' },
  { q: 'How does LAUNCH50 work?', a: '50% off your first 3 months — that\'s $9.50/mo for 3 months, then the regular $19/mo (or $15.20/mo on annual) applies.' },
  { q: 'Is my LinkedIn account safe?', a: 'Yes — we publish only through LinkedIn\'s official API. There is zero ban risk since we never automate browser actions or scrape your account.' },
  { q: 'What makes Eclatale different?', a: 'Real voice learning from your own writing, an authenticity score that checks every post before it goes live, and publishing through LinkedIn\'s official API — all for $19/mo.' },
  { q: 'Can I upgrade or downgrade anytime?', a: 'Yes — changes take effect immediately, and billing is prorated automatically by Stripe.' },
];

function CountdownBadge() {
  const [daysLeft, setDaysLeft] = useState(LAUNCH_OFFER_DAYS);
  useEffect(() => {
    const key = 'eclatale_launch_offer_start';
    let start = localStorage.getItem(key);
    if (!start) {
      start = String(Date.now());
      localStorage.setItem(key, start);
    }
    const elapsedDays = Math.floor((Date.now() - Number(start)) / (24 * 60 * 60 * 1000));
    setDaysLeft(Math.max(0, LAUNCH_OFFER_DAYS - elapsedDays));
  }, []);
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <Clock size={12} /> {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Ending soon'}
    </span>
  );
}

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [checkingOut, setCheckingOut] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    trackEvent('view_pricing_page');
  }, []);

  const monthlyPrice = 19;
  const annualMonthlyEquivalent = 15.2;
  const launchMonthly = (monthlyPrice / 2).toFixed(2);
  const launchAnnual = (annualMonthlyEquivalent / 2).toFixed(2);

  const handleStartTrial = async () => {
    setError('');
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      trackEvent('pricing_trial_click_logged_out');
      window.location.href = `/signup?plan=individual&billing=${billingCycle}`;
      return;
    }

    setCheckingOut(true);
    trackEvent('pricing_trial_click', { billingCycle });
    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          email: data.user.email,
          billingCycle,
          applyLaunchPromo: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.checkoutUrl) throw new Error(json.error || 'Could not start checkout');
      window.location.href = json.checkoutUrl;
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      setCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo
        title="Pricing — Simple, transparent plans"
        description="Start free with 10 AI-generated LinkedIn posts a month. Upgrade to Individual for unlimited posts, competitor intelligence, and voice-matched content generation."
        path="/pricing"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f: any) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
        </div>
        <a href="/login" className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">Log in</a>
      </nav>

      {/* Promo banner */}
      <div className="gradient-primary text-white text-center py-3 px-5 text-sm font-semibold">
        🎉 Launch Special: 50% off your first 3 months with code <span className="font-extrabold">LAUNCH50</span> — <CountdownBadge />
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="text-center mb-10 md:mb-14">
          <h1 className="h1 text-brand-dark mb-4">
            Simple, <span className="gradient-text">honest</span> pricing
          </h1>
          <p className="body-text max-w-lg mx-auto mb-8">
            Start free. Upgrade when you're ready for unlimited posts and the full growth toolkit.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white border border-[rgba(124,92,252,0.12)] shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${billingCycle === 'monthly' ? 'gradient-primary text-white shadow' : 'text-brand-muted'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all relative ${billingCycle === 'annual' ? 'gradient-primary text-white shadow' : 'text-brand-muted'}`}
            >
              Annual
              <span className="absolute -top-2.5 -right-2.5 bg-brand-teal text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">-20%</span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-6 items-start mb-16">
          {/* Free */}
          <div className="card p-7 md:p-8">
            <div className="text-sm font-semibold text-brand-muted uppercase tracking-wide mb-3">Free</div>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-4xl font-extrabold text-brand-dark">$0</span>
              <span className="text-brand-muted mb-1">/mo</span>
            </div>
            <p className="text-xs text-brand-muted mb-6">No credit card required.</p>
            <ul className="space-y-3 mb-8">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-brand-dark">
                  <Check size={16} className="text-brand-teal flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <a href="/signup" className="btn-ghost w-full text-center justify-center text-[15px]">Get Started Free</a>
          </div>

          {/* Individual */}
          <div className="relative card p-7 md:p-8 border-2 border-brand-purple shadow-brand-lg scale-[1.02] bg-[rgba(124,92,252,0.04)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge bg-brand-purple text-white text-[11px] font-bold px-3 py-1">MOST POPULAR</div>
            <div className="text-sm font-semibold text-brand-purple uppercase tracking-wide mb-3">Individual</div>
            <div className="flex items-end gap-2 mb-1 flex-wrap">
              <span className="text-xl text-brand-muted line-through">
                ${billingCycle === 'monthly' ? monthlyPrice : annualMonthlyEquivalent.toFixed(2)}
              </span>
              <span className="text-4xl font-extrabold text-brand-dark">
                ${billingCycle === 'monthly' ? launchMonthly : launchAnnual}
              </span>
              <span className="text-brand-muted mb-1">/mo</span>
            </div>
            <p className="text-xs text-brand-muted mb-2">
              {billingCycle === 'annual' ? 'Billed annually. ' : 'Billed monthly. '}Then ${billingCycle === 'monthly' ? monthlyPrice : annualMonthlyEquivalent.toFixed(2)}/mo after 3 months.
            </p>
            <div className="badge bg-[rgba(124,92,252,0.1)] text-brand-purple text-[11px] mb-5">
              <Zap size={12} /> 7-day free trial
            </div>
            <ul className="space-y-3 mb-8">
              {INDIVIDUAL_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-brand-dark">
                  <Check size={16} className="text-brand-teal flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button onClick={handleStartTrial} disabled={checkingOut} className="btn-primary w-full text-center justify-center text-[15px]">
              {checkingOut ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Start Free Trial'}
            </button>
            {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
            <p className="text-[11px] text-brand-muted mt-3 text-center">No credit card required for trial · Cancel anytime</p>
          </div>

          {/* SMB */}
          <div className="relative card p-7 md:p-8 overflow-hidden">
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center">
              <span className="badge bg-brand-orange text-white text-xs font-bold px-3 py-1.5">COMING SOON</span>
            </div>
            <div className="text-sm font-semibold text-brand-orange uppercase tracking-wide mb-3">SMB / Team</div>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-4xl font-extrabold text-brand-dark">$79</span>
              <span className="text-brand-muted mb-1">/mo</span>
            </div>
            <p className="text-xs text-brand-muted mb-6">For teams publishing together.</p>
            <ul className="space-y-3 mb-8">
              {['Everything in Individual', 'Multiple team seats', 'Shared brand voice', 'Team analytics'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-brand-dark">
                  <Check size={16} className="text-brand-teal flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button disabled className="btn-ghost w-full text-center justify-center text-[15px] opacity-60">Join Waitlist</button>
          </div>
        </div>

        {/* Comparison table */}
        <div className="mb-16">
          <h2 className="h2 text-brand-dark text-center mb-8">Compare <span className="gradient-text">plans</span></h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[rgba(124,92,252,0.08)]">
                  <th className="text-left p-4 font-semibold text-brand-dark">Feature</th>
                  <th className="text-center p-4 font-semibold text-brand-muted">Free</th>
                  <th className="text-center p-4 font-semibold text-brand-purple">Individual</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-[rgba(124,92,252,0.05)] last:border-0">
                    <td className="p-4 text-brand-dark">{row.label}</td>
                    <td className="p-4 text-center">
                      {typeof row.free === 'boolean' ? (row.free ? <Check size={16} className="text-brand-teal mx-auto" /> : <span className="text-brand-muted">—</span>) : <span className="text-brand-muted">{row.free}</span>}
                    </td>
                    <td className="p-4 text-center">
                      {typeof row.individual === 'boolean' ? (row.individual ? <Check size={16} className="text-brand-purple mx-auto" /> : <span className="text-brand-muted">—</span>) : <span className="font-semibold text-brand-purple">{row.individual}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refund policy */}
        <div className="card p-7 md:p-8 mb-16 max-w-2xl mx-auto text-center">
          <ShieldCheck size={28} className="text-brand-teal mx-auto mb-3" />
          <h3 className="text-lg font-extrabold text-brand-dark mb-3">Our promise</h3>
          <ul className="space-y-2 text-sm text-brand-muted">
            <li>7-day money back guarantee — no questions asked</li>
            <li>Cancel anytime — access continues until the end of your billing period</li>
            <li>Disputes resolved within 48 hours</li>
          </ul>
          <a href="/refund-policy" className="text-sm text-brand-purple font-semibold hover:underline mt-4 inline-block">Read the full refund policy →</a>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="h2 text-brand-dark text-center mb-10">
            Frequently asked <span className="gradient-text">questions</span>
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="font-semibold text-brand-dark text-[15px] pr-4 flex items-center gap-2">
                    <MessageCircle size={14} className="text-brand-purple flex-shrink-0" /> {faq.q}
                  </span>
                  <ChevronDown size={18} className={`text-brand-muted flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 animate-fadeIn">
                    <p className="text-sm text-brand-muted leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)] mt-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            <a href="/privacy" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Privacy</a>
            <a href="/terms" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Terms</a>
            <a href="/refund-policy" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Refund Policy</a>
          </div>
          <p className="text-sm text-brand-muted">&copy; {new Date().getFullYear()} Eclatale. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
