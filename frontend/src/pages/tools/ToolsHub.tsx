import React from 'react';
import { ArrowRight } from 'lucide-react';
import Seo from '../../components/Seo';
import { TOOLS } from './config';

export default function ToolsHub() {
  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo
        title="Free LinkedIn Tools | Eclatale"
        description="9 free AI-powered tools to write better LinkedIn posts, headlines, and About sections. No signup required, instant results."
        path="/tools"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Free LinkedIn Tools',
          itemListElement: TOOLS.map((t, i) => ({
            '@type': 'ListItem', position: i + 1, name: t.name, url: `https://eclatale.com/tools/${t.slug}`,
          })),
        }}
      />
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
        </div>
      </nav>

      <header className="pt-28 md:pt-36 pb-8 px-5 md:px-8 text-center">
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple mb-5 mx-auto">Free Tools</div>
        <h1 className="h1 text-brand-dark mb-4">
          Free <span className="gradient-text">LinkedIn Tools</span>
        </h1>
        <p className="body-text max-w-xl mx-auto mb-5">
          9 free tools to write better, grow faster, and stand out on LinkedIn. No account required.
        </p>
        <p className="text-xs font-semibold text-brand-muted">
          Used 24,000+ times this month · No signup · Instant results
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {TOOLS.map(tool => (
            <a key={tool.slug} href={`/tools/${tool.slug}`} className="card card-hover p-5 md:p-6 flex flex-col">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-2xl mb-4">
                {tool.emoji}
              </div>
              <h2 className="text-sm md:text-base font-bold text-brand-dark mb-1.5">{tool.name}</h2>
              <p className="text-xs md:text-sm text-brand-muted leading-relaxed mb-4 flex-1">{tool.shortDesc}</p>
              <span className="inline-flex items-center gap-1 text-xs md:text-sm font-bold text-white gradient-primary rounded-full px-4 py-2 w-fit">
                Try free <ArrowRight size={14} />
              </span>
            </a>
          ))}
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
