import React, { useState } from 'react';
import { Download, BookOpen, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import DownloadGateModal from '../components/DownloadGateModal';
import { RESOURCES, type Resource } from '../data/resources';
import { useResourceGate } from '../lib/useResourceGate';

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

export default function Resources() {
  const categories = ['All', ...Array.from(new Set(RESOURCES.map(r => r.badge)))];
  const [filter, setFilter] = useState('All');
  const visible = filter === 'All' ? RESOURCES : RESOURCES.filter(r => r.badge === filter);
  const { gateResource, handleDownload, handleGateSuccess, closeGate } = useResourceGate();

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
          onClose={closeGate}
          onSuccess={handleGateSuccess}
        />
      )}
    </div>
  );
}
