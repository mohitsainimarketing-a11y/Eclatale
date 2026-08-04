import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Seo from '../components/Seo';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-brand-dark mb-3">{title}</h2>
      <div className="text-sm text-brand-muted leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo title="Terms of Service" description="The terms governing your use of Eclatale." path="/terms" />
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center gap-3">
        <a href="/" className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back"><ArrowLeft size={18} /></a>
        <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
      </nav>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <h1 className="h2 text-brand-dark mb-2">Terms of <span className="gradient-text">Service</span></h1>
        <p className="text-sm text-brand-muted mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <Section title="Service description">
          <p>Eclatale is an AI-powered personal brand growth tool. It generates LinkedIn content in your voice, analyzes your writing patterns, and publishes on your behalf via LinkedIn's official API. By using Eclatale you agree to these terms.</p>
        </Section>

        <Section title="Subscription terms">
          <p>The Individual plan is billed monthly or annually via Stripe, starting after a 7-day free trial. Your card is charged automatically at the end of the trial unless you cancel first. Subscriptions renew automatically at the then-current price until cancelled.</p>
        </Section>

        <Section title="Refund policy">
          <p>Full refund, no questions asked, within 7 days of your first charge. Requests between 8–30 days are reviewed manually. See our <a href="/refund-policy" className="text-brand-purple font-semibold hover:underline">full refund policy</a> for details.</p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to use Eclatale to generate content that is illegal, harassing, deceptive, or that violates LinkedIn's own terms of service. We reserve the right to suspend accounts that abuse the platform, attempt to circumvent usage limits, or use the service for automated spam.</p>
        </Section>

        <Section title="LinkedIn compliance">
          <p>Eclatale publishes exclusively through LinkedIn's official Marketing/Share API — never through browser automation, scraping, or credential-based login. This means there is no risk of LinkedIn account restriction from using our publishing feature as intended.</p>
        </Section>

        <Section title="Limitation of liability">
          <p>Eclatale is provided "as is." We do not guarantee specific growth outcomes, engagement results, or that AI-generated content will always be error-free. To the maximum extent permitted by law, Eclatale is not liable for indirect, incidental, or consequential damages arising from use of the service.</p>
        </Section>

        <Section title="Governing law">
          <p>These terms are governed by the laws of Ontario, Canada, without regard to conflict-of-law principles.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about these terms? Reach us at <a href="mailto:info@eclatale.com" className="text-brand-purple font-semibold hover:underline">info@eclatale.com</a>.</p>
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
