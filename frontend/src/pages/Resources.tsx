import React from 'react';
import { Download, BookOpen, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';

const RESOURCES = [
  {
    slug: 'top-50-corporate-jargons',
    badge: 'Career & Communication',
    emoji: '💼',
    title: 'Top 50 Corporate Jargons with Use Cases',
    description: 'Master the language of business. Every term explained with real-world LinkedIn post examples so you sound credible, not clueless.',
    highlights: [
      '50 must-know corporate terms defined in plain English',
      'Real LinkedIn post example for each jargon',
      'When to use it — and when it sounds hollow',
      'Bonus: 10 overused buzzwords to avoid in 2026',
    ],
    pages: '28 pages',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/top-50-corporate-jargons-guide.pdf',
    preview: [
      { term: 'Leverage', meaning: 'Use existing strengths or assets to gain a larger advantage.', example: 'Example: "We are leveraging our content archive to build a 90-day thought leadership engine."' },
      { term: 'Synergy', meaning: 'Combined output that exceeds what each part would achieve alone.', example: 'Example: "The partnership created real synergy — their distribution + our IP = 3x reach."' },
      { term: 'Circle back', meaning: 'Return to a topic at a later point.', example: 'Example: "Great question — let me circle back once I have validated the numbers."' },
      { term: 'Bandwidth', meaning: 'Available capacity to take on additional work or responsibilities.', example: 'Example: "Before adding scope, let us be honest about team bandwidth this sprint."' },
      { term: 'Deep dive', meaning: 'Thorough, detailed examination of a topic.', example: 'Example: "I did a deep dive on why most LinkedIn profiles fail in the first 3 seconds."' },
      { term: 'Move the needle', meaning: 'Make a measurable, meaningful improvement.', example: 'Example: "Only 2 of the 11 tactics we tested actually moved the needle on engagement."' },
    ],
  },
];

function JargonPreviewCard({ term, meaning, example }: { term: string; meaning: string; example: string }) {
  return (
    <div className="p-4 rounded-xl border border-[rgba(124,92,252,0.1)] bg-white/60">
      <p className="text-sm font-bold text-brand-dark mb-1">{term}</p>
      <p className="text-xs text-brand-muted mb-2 leading-relaxed">{meaning}</p>
      <p className="text-xs text-[#7C5CFC] italic leading-relaxed">{example}</p>
    </div>
  );
}

export default function Resources() {
  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo
        title="Free LinkedIn Resources | Eclatale"
        description="Free downloadable guides for LinkedIn personal branding — corporate jargon glossaries, post frameworks, and growth playbooks."
        path="/resources"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Free LinkedIn Resources by Eclatale',
            description: 'Downloadable guides and playbooks for LinkedIn personal branding',
            url: 'https://eclatale.com/resources',
          },
        ]}
      />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
        </div>
      </nav>

      <header className="pt-28 md:pt-36 pb-12 px-5 md:px-8 text-center">
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple mb-5 mx-auto">Free Resources</div>
        <h1 className="h1 text-brand-dark mb-4">
          Guides to help you<br className="hidden md:block" /> <span className="gradient-text">grow on LinkedIn</span>
        </h1>
        <p className="body-text max-w-xl mx-auto mb-2">
          Practical, downloadable playbooks built for professionals who want to build authority without the noise.
        </p>
        <p className="text-xs font-semibold text-brand-muted">Free · No email required · Instant PDF download</p>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 pb-24 space-y-12">
        {RESOURCES.map(resource => (
          <article
            key={resource.slug}
            className="card p-6 md:p-10 grid md:grid-cols-2 gap-8 md:gap-12 items-start"
          >
            {/* Left — info */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-2xl shrink-0">
                  {resource.emoji}
                </div>
                <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-xs">{resource.badge}</span>
              </div>

              <h2 className="text-xl md:text-2xl font-extrabold text-brand-dark mb-3 leading-snug">
                {resource.title}
              </h2>
              <p className="text-sm text-brand-muted leading-relaxed mb-6">{resource.description}</p>

              <ul className="space-y-2 mb-8">
                {resource.highlights.map(h => (
                  <li key={h} className="flex items-start gap-2.5 text-sm text-brand-dark">
                    <span className="mt-0.5 w-4 h-4 rounded-full gradient-primary flex items-center justify-center shrink-0">
                      <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                        <path d="M1 3.5L3 5.5L7 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {h}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-4 mb-8">
                <span className="flex items-center gap-1.5 text-xs text-brand-muted font-medium">
                  <BookOpen size={13} /> {resource.pages}
                </span>
                <span className="text-xs text-brand-muted font-medium px-2 py-0.5 rounded-full border border-[rgba(124,92,252,0.15)]">
                  {resource.format}
                </span>
              </div>

              <a
                href={resource.downloadUrl}
                download
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Download size={15} /> Download Free Guide
              </a>
            </div>

            {/* Right — preview */}
            <div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-widest mb-4">
                Preview — 6 of 50
              </p>
              <div className="space-y-3">
                {resource.preview.map(item => (
                  <JargonPreviewCard key={item.term} {...item} />
                ))}
              </div>
              <p className="text-xs text-brand-muted mt-4 text-center">
                + 44 more terms in the full guide
              </p>
            </div>
          </article>
        ))}

        {/* Coming soon */}
        <div className="card p-8 text-center border-dashed border-2 border-[rgba(124,92,252,0.15)] bg-transparent">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(124,92,252,0.08)] flex items-center justify-center text-2xl mx-auto mb-4">
            📬
          </div>
          <h3 className="text-base font-bold text-brand-dark mb-2">More guides coming soon</h3>
          <p className="text-sm text-brand-muted max-w-sm mx-auto mb-6">
            LinkedIn post frameworks, headline formulas, content repurposing playbooks — drop your email to get them first.
          </p>
          <a href="/signup" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-purple hover:underline">
            Get early access <ArrowRight size={14} />
          </a>
        </div>
      </main>

      <footer className="py-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
          <p className="text-sm text-brand-muted">&copy; {new Date().getFullYear()} Eclatale. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
