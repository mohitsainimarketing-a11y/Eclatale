import React, { useState } from 'react';
import { Download, BookOpen, X, Mail, Loader2, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { apiFetch } from '../lib/apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();
const EMAIL_STORAGE_KEY = 'eclatale_resource_email';

interface PreviewItem { term: string; meaning: string; example?: string; }
interface Resource {
  slug: string;
  badge: string;
  emoji: string;
  title: string;
  description: string;
  pages: string;
  itemCount: number;
  itemNoun: string;
  format: string;
  downloadUrl: string;
  preview: PreviewItem[];
}

const RESOURCES: Resource[] = [
  {
    slug: 'top-50-corporate-jargons',
    badge: 'Career & Communication',
    emoji: '💼',
    title: 'Top 50 Corporate Jargons with Use Cases',
    description: 'Every term explained in plain English with a real LinkedIn post example, so you sound credible, not clueless.',
    pages: '27 pages',
    itemCount: 50,
    itemNoun: 'terms',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/top-50-corporate-jargons-guide.pdf',
    preview: [
      { term: 'Leverage', meaning: 'Use existing strengths or assets to gain a larger advantage.' },
      { term: 'Circle back', meaning: 'Return to a topic at a later point.' },
      { term: 'Move the needle', meaning: 'Make a measurable, meaningful improvement.' },
    ],
  },
  {
    slug: 'linkedin-headline-formulas',
    badge: 'Profile & Positioning',
    emoji: '✍️',
    title: '20 LinkedIn Headline Formulas That Work',
    description: 'Fill-in-the-blank headline templates, each with real examples and the reason it converts.',
    pages: '11 pages',
    itemCount: 20,
    itemNoun: 'formulas',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/linkedin-headline-formulas-guide.pdf',
    preview: [
      { term: 'The Role + Result', meaning: '[Job title] helping [target audience] [achieve specific outcome].' },
      { term: 'The Numbers Stack', meaning: 'Three hard numbers that prove the claim before anyone asks.' },
      { term: 'The Niche Authority', meaning: 'Claim a category narrow enough that you can credibly own it.' },
    ],
  },
  {
    slug: 'data-storytelling-charts',
    badge: 'Data & Analytics',
    emoji: '📊',
    title: '15 Data Storytelling Charts and When to Use Each',
    description: 'Stop defaulting to bar and pie charts. The right chart for the data you are actually showing, with real use cases.',
    pages: '10 pages',
    itemCount: 15,
    itemNoun: 'chart types',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/data-driven-charts-guide.pdf',
    preview: [
      { term: 'Bar Chart', meaning: 'Horizontal or vertical bars comparing a single metric across categories. The easiest chart for a reader to decode correctly.' },
      { term: 'Line Chart', meaning: 'Points connected across a continuous axis, usually time, tracking how one or more metrics move.' },
      { term: 'Scatter Plot', meaning: 'Individual points placed by two numeric values, revealing correlation, clusters, or outliers between them.' },
    ],
  },
  {
    slug: 'stakeholder-boardroom-idioms',
    badge: 'Meetings & Stakeholders',
    emoji: '🏛️',
    title: '40 Stakeholder and Boardroom Idioms Decoded',
    description: 'What executives actually mean when they say it diplomatically. Decode the gap between the words and the message.',
    pages: '16 pages',
    itemCount: 40,
    itemNoun: 'idioms',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/stakeholder-boardroom-idioms-guide.pdf',
    preview: [
      { term: "I hear what you're saying", meaning: 'Sounds like agreement but is almost always the opening line of a rebuttal.' },
      { term: "Let's derisk this before we commit", meaning: 'A request to reduce uncertainty before greenlighting, often signaling real doubt about the odds.' },
      { term: "Let's revisit this next quarter", meaning: "A polite, calendar-based way of shelving a topic that isn't a current priority." },
    ],
  },
  {
    slug: 'meeting-phrases',
    badge: 'Meetings & Stakeholders',
    emoji: '🗣️',
    title: '30 Meeting Phrases That Move Decisions Forward',
    description: 'Exact lines to redirect, push back, and close meetings with a real decision instead of another meeting.',
    pages: '16 pages',
    itemCount: 30,
    itemNoun: 'phrases',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/meeting-phrases-guide.pdf',
    preview: [
      { term: 'The Parking Lot', meaning: '"Let\'s park that and come back to it if we have time." Defers a tangent without dismissing who raised it.' },
      { term: 'The Curious Challenge', meaning: '"Help me understand the thinking behind that." Challenges a decision by asking for its reasoning.' },
      { term: 'The Decision Statement', meaning: '"So the decision is X, and we\'re not revisiting it this quarter." Locks in an outcome out loud.' },
    ],
  },
  {
    slug: 'performance-review-phrases',
    badge: 'Career Growth',
    emoji: '📈',
    title: '20 Performance Review Phrases That Get You Promoted',
    description: 'Turn your work into undeniable impact on paper: framing, direct asks, and how to handle pushback.',
    pages: '10 pages',
    itemCount: 20,
    itemNoun: 'phrases',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/performance-review-phrases-guide.pdf',
    preview: [
      { term: 'The Before/After Frame', meaning: 'State the situation before your work and the situation after it, so the change is undeniable.' },
      { term: 'The Direct Ask', meaning: 'State plainly that you are ready for the next level and want to discuss it, without hedging.' },
      { term: 'The Specific Follow-Up', meaning: 'When told "not this cycle," ask exactly what changed the decision and what would change it next time.' },
    ],
  },
  {
    slug: 'salary-negotiation-scripts',
    badge: 'Career Growth',
    emoji: '💰',
    title: '15 Salary and Offer Negotiation Scripts',
    description: 'Exact scripts for the moments that come up: the first offer, the competing offer, the number you name first.',
    pages: '11 pages',
    itemCount: 15,
    itemNoun: 'scripts',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/salary-negotiation-scripts-guide.pdf',
    preview: [
      { term: 'The Delayed Number', meaning: 'A recruiter asks for your salary expectations before any offer has been made.' },
      { term: 'The Competing Offer Reveal', meaning: 'You have another offer and want to use it without sounding like an ultimatum.' },
      { term: 'The Signing Bonus Ask', meaning: "There's a gap between the base offered and your target, and the base can't move further." },
    ],
  },
];

function getRememberedEmail(): string {
  try { return localStorage.getItem(EMAIL_STORAGE_KEY) || ''; } catch { return ''; }
}
function rememberEmail(email: string) {
  try { localStorage.setItem(EMAIL_STORAGE_KEY, email); } catch { /* private browsing, ignore */ }
}

function startDownload(resource: Resource) {
  window.open(resource.downloadUrl, '_blank');
}

function ResourceCard({ resource, onDownload }: { resource: Resource; onDownload: (r: Resource) => void }) {
  const [pinnedOpen, setPinnedOpen] = useState(false);

  return (
    <article
      className="group relative card p-5 flex flex-col overflow-hidden"
      onClick={() => setPinnedOpen(v => !v)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-lg shrink-0">
          {resource.emoji}
        </div>
        <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[10px] !py-1 !px-2 text-right">
          {resource.badge}
        </span>
      </div>

      <h2 className="text-[15px] font-extrabold text-brand-dark leading-snug mb-1.5">
        {resource.title}
      </h2>
      <p className="text-xs text-brand-muted leading-relaxed mb-3 flex-1">
        {resource.description}
      </p>

      <div className="flex items-center gap-3 mb-1 text-[11px] text-brand-muted font-medium">
        <span className="flex items-center gap-1"><BookOpen size={11} /> {resource.pages}</span>
        <span>{resource.itemCount} {resource.itemNoun}</span>
        <span className="px-1.5 py-0.5 rounded-full border border-[rgba(124,92,252,0.15)]">{resource.format}</span>
      </div>
      <p className="text-[10.5px] text-brand-muted/70 mb-3">Hover to preview {resource.preview.length} {resource.itemNoun}</p>

      <button
        onClick={(e) => { e.stopPropagation(); onDownload(resource); }}
        className="btn-primary w-full inline-flex items-center justify-center gap-2 text-xs !py-2.5 mt-auto"
      >
        <Download size={13} /> Download Free
      </button>

      {/* Hover/tap preview overlay: absolutely positioned so it never changes
          this card's height, which is what kept pushing neighboring cards'
          content around in the previous click-to-expand accordion layout. */}
      <div
        className={`absolute inset-0 rounded-[inherit] bg-white p-5 flex flex-col transition-opacity duration-150 ${
          pinnedOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } group-hover:opacity-100 group-hover:pointer-events-auto`}
      >
        <p className="text-[11px] font-bold text-brand-purple mb-2.5">{resource.title}</p>
        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {resource.preview.map(item => (
            <div key={item.term}>
              <p className="text-[11.5px] font-bold text-brand-dark">{item.term}</p>
              <p className="text-[11px] text-brand-muted leading-snug">{item.meaning}</p>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] text-brand-muted pt-2 mt-2 border-t border-[rgba(124,92,252,0.08)]">
          + {resource.itemCount - resource.preview.length} more {resource.itemNoun} in the full guide
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(resource); }}
          className="btn-primary w-full inline-flex items-center justify-center gap-2 text-xs !py-2.5 mt-3"
        >
          <Download size={13} /> Download Free
        </button>
      </div>
    </article>
  );
}

function DownloadGateModal({ resource, onClose, onSuccess }: { resource: Resource; onClose: () => void; onSuccess: (email: string) => void }) {
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

export default function Resources() {
  const categories = ['All', ...Array.from(new Set(RESOURCES.map(r => r.badge)))];
  const [filter, setFilter] = useState('All');
  const visible = filter === 'All' ? RESOURCES : RESOURCES.filter(r => r.badge === filter);
  const [gateResource, setGateResource] = useState<Resource | null>(null);

  const handleDownload = (resource: Resource) => {
    const remembered = getRememberedEmail();
    if (remembered) { startDownload(resource); return; }
    setGateResource(resource);
  };

  const handleGateSuccess = (email: string) => {
    rememberEmail(email);
    if (gateResource) startDownload(gateResource);
    setGateResource(null);
  };

  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo
        title="Free Career Guides | Eclatale"
        description="Free downloadable guides on the language of work: corporate jargon, meeting phrases, negotiation scripts, data storytelling, and LinkedIn positioning."
        path="/resources"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Free Career Guides by Eclatale',
            description: 'Downloadable guides on professional communication and LinkedIn growth',
            url: 'https://eclatale.com/resources',
          },
        ]}
      />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
        </div>
      </nav>

      <header className="pt-28 md:pt-36 pb-10 px-5 md:px-8 text-center">
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple mb-5 mx-auto">Free Resources</div>
        <h1 className="h1 text-brand-dark mb-4">
          Guides for how work<br className="hidden md:block" /> <span className="gradient-text">actually talks</span>
        </h1>
        <p className="body-text max-w-xl mx-auto mb-2">
          Free, practical playbooks for the language of your job: meetings, negotiations, boardroom idioms, and your LinkedIn presence.
        </p>
        <p className="text-xs font-semibold text-brand-muted">Free · Quick email signup · Instant PDF download</p>
      </header>

      {categories.length > 2 && (
        <div className="max-w-6xl mx-auto px-5 md:px-8 mb-6 flex flex-wrap justify-center gap-2">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
                filter === c
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'text-brand-muted border-[rgba(124,92,252,0.15)] hover:border-brand-purple/40'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-5 md:px-8 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {visible.map(resource => (
            <ResourceCard key={resource.slug} resource={resource} onDownload={handleDownload} />
          ))}

          {/* Coming soon */}
          <div className="card p-5 text-center border-dashed border-2 border-[rgba(124,92,252,0.15)] bg-transparent flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-[rgba(124,92,252,0.08)] flex items-center justify-center text-lg mb-3">
              📬
            </div>
            <h3 className="text-sm font-bold text-brand-dark mb-1.5">More guides coming soon</h3>
            <p className="text-xs text-brand-muted mb-4">New playbooks added regularly. Drop your email to get them first.</p>
            <a href="/signup" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-purple hover:underline">
              Get early access <ArrowRight size={12} />
            </a>
          </div>
        </div>
      </main>

      <footer className="py-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
          <p className="text-sm text-brand-muted">&copy; {new Date().getFullYear()} Eclatale. All rights reserved.</p>
        </div>
      </footer>

      {gateResource && (
        <DownloadGateModal
          resource={gateResource}
          onClose={() => setGateResource(null)}
          onSuccess={handleGateSuccess}
        />
      )}
    </div>
  );
}
