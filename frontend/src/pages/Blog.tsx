import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock, Search } from 'lucide-react';
import { blogPosts, BLOG_CATEGORIES } from '../data/blogPosts';
import Seo from '../components/Seo';

export default function Blog() {
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blogPosts
      .filter(post => category === 'All' || post.category === category)
      .filter(post => !q || post.title.toLowerCase().includes(q) || post.description.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [category, query]);

  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo
        title="Blog — LinkedIn growth, without the fluff"
        description="Practical guides on personal branding, AI content, and building a LinkedIn presence that actually drives outcomes."
        path="/blog"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Eclatale Blog',
          url: 'https://eclatale.com/blog',
        }}
      />
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
        </div>
      </nav>

      <header className="pt-28 md:pt-36 pb-10 md:pb-12 px-5 md:px-8 text-center">
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple mb-5 mx-auto">
          Eclatale Blog
        </div>
        <h1 className="h1 text-brand-dark mb-4">
          LinkedIn growth, <span className="gradient-text">without the fluff</span>
        </h1>
        <p className="body-text max-w-lg mx-auto">
          Practical guides on personal branding, AI content, and building a LinkedIn presence
          that actually drives outcomes.
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 mb-10 md:mb-12">
        <div className="relative max-w-md mx-auto mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles..."
            aria-label="Search blog articles"
            className="input !pl-11"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {BLOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                category === cat
                  ? 'gradient-primary text-white shadow-[0_4px_16px_rgba(124,92,252,0.3)]'
                  : 'bg-white text-brand-muted border border-[rgba(124,92,252,0.12)] hover:border-brand-purple hover:text-brand-purple'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-5 md:px-8 pb-24">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-brand-muted py-16">No articles match your search yet — try a different term or category.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {filtered.map(post => (
              <a
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="card card-hover p-6 md:p-7 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple !text-[11px]">{post.category}</span>
                  <span className="flex items-center gap-1 text-xs text-brand-muted">
                    <Clock size={12} /> {post.readTime}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-brand-dark mb-2 leading-snug">{post.title}</h2>
                <p className="text-sm text-brand-muted leading-relaxed mb-5 flex-1">{post.description}</p>
                <div className="flex items-center justify-between text-xs text-brand-muted">
                  <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  <span className="flex items-center gap-1 font-semibold text-brand-purple">
                    Read <ArrowRight size={13} />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
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
