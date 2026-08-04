import React from 'react';
import { ArrowLeft, ShieldCheck, Clock, XCircle } from 'lucide-react';
import Seo from '../components/Seo';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo title="Refund Policy" description="Eclatale's 30-day money-back guarantee and refund process." path="/refund-policy" />
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center gap-3">
        <a href="/" className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back"><ArrowLeft size={18} /></a>
        <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
      </nav>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <h1 className="h2 text-brand-dark mb-2">Refund <span className="gradient-text">Policy</span></h1>
        <p className="text-sm text-brand-muted mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="space-y-4 mb-10">
          <div className="card p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[rgba(6,214,160,0.1)] flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={18} className="text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-dark">0–7 days since your first charge</h3>
              <p className="text-xs text-brand-muted mt-1">Full refund, automatically approved, no questions asked. Submitted from Settings → Billing → Request Refund.</p>
            </div>
          </div>
          <div className="card p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[rgba(255,107,53,0.1)] flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-brand-orange" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-dark">8–30 days since your first charge</h3>
              <p className="text-xs text-brand-muted mt-1">Reviewed manually by our team. We respond within 48 hours of your request.</p>
            </div>
          </div>
          <div className="card p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[rgba(255,69,58,0.08)] flex items-center justify-center flex-shrink-0">
              <XCircle size={18} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-dark">30+ days since your first charge</h3>
              <p className="text-xs text-brand-muted mt-1">Refunds are not available past this window. You can still cancel anytime to stop future billing — you'll keep access until the end of your current period.</p>
            </div>
          </div>
        </div>

        <div className="text-sm text-brand-muted leading-relaxed space-y-4">
          <div>
            <h2 className="text-lg font-bold text-brand-dark mb-2">How to request a refund</h2>
            <p>Go to <strong>Settings → Billing → Request Refund</strong>, choose a reason, and submit. Refunds within 7 days are processed automatically through Stripe; later requests are reviewed by our team.</p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-dark mb-2">Processing time</h2>
            <p>Approved refunds are issued immediately via Stripe and typically appear on your statement within 5–10 business days, depending on your bank.</p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-dark mb-2">Partial refunds</h2>
            <p>We issue full refunds only — there are no partial or prorated refunds for unused time within a billing period, except at our discretion during the manual review window.</p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-dark mb-2">Contact</h2>
            <p>Questions about a refund? Reach us at <a href="mailto:support@eclatale.com" className="text-brand-purple font-semibold hover:underline">support@eclatale.com</a>.</p>
          </div>
        </div>
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
