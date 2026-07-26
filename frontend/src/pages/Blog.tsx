import React from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { blogPosts } from '../data/blogPosts';

export default function Blog() {
  return (
    <div className="min-h-screen gradient-bg-page">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
        </div>
      </nav>

      <header className="pt-28 md:pt-36 pb-12 md:pb-16 px-5 md:px-8 text-center">
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

      <main className="max-w-5xl mx-auto px-5 md:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {blogPosts.map(post => (
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
