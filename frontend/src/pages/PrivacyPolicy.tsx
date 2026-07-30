import React from 'react';
import { ArrowLeft } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-brand-dark mb-3">{title}</h2>
      <div className="text-sm text-brand-muted leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen gradient-bg-page">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center gap-3">
        <a href="/" className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back"><ArrowLeft size={18} /></a>
        <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
      </nav>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <h1 className="h2 text-brand-dark mb-2">Privacy <span className="gradient-text">Policy</span></h1>
        <p className="text-sm text-brand-muted mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <Section title="What we collect">
          <p>Account information (email, name), profile details you provide (role, industry, goals, bio), content you generate or save, and your LinkedIn profile data if you connect your account.</p>
          <p>We also collect basic usage data — page views and feature interactions — to improve the product, and billing information (handled entirely by Stripe; we never see or store your card details).</p>
        </Section>

        <Section title="How we use it">
          <p>To generate AI content tailored to your voice and role, to personalize recommendations (best time to post, competitor insights, growth score), to send transactional and opted-in marketing emails, and to process subscription billing.</p>
          <p>We do not sell your personal data to third parties.</p>
        </Section>

        <Section title="LinkedIn data handling">
          <p>When you connect LinkedIn, we access only what's required to publish posts on your behalf via LinkedIn's official API — your basic profile info and the ability to post as you. We never scrape your account, automate browser sessions, or access data outside LinkedIn's authorized API scopes.</p>
        </Section>

        <Section title="Data retention">
          <p>We retain your account and content data for as long as your account is active. If you delete your account, your posts, persona data, and connected account tokens are permanently removed within 30 days, except where retention is required for legal or billing compliance (e.g. tax records).</p>
        </Section>

        <Section title="Your rights">
          <p>You can access, correct, or export your data at any time from Settings. To request account deletion, contact us and we'll process it within 30 days. If you're in a jurisdiction with statutory data rights (e.g. GDPR, CCPA), those rights apply in full.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy? Reach us at <a href="mailto:info@eclatale.com" className="text-brand-purple font-semibold hover:underline">info@eclatale.com</a>.</p>
        </Section>
      </div>

      <footer className="py-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)]">
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
