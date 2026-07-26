import React, { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Clock } from 'lucide-react';
import { getBlogPost, getRelatedPosts } from '../data/blogPosts';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  useEffect(() => {
    if (!post) return;
    const prevTitle = document.title;
    document.title = `${post.title} | Eclatale Blog`;

    const meta = document.querySelector('meta[name="description"]');
    const prevDescription = meta?.getAttribute('content') ?? '';
    meta?.setAttribute('content', post.description);

    return () => {
      document.title = prevTitle;
      meta?.setAttribute('content', prevDescription);
    };
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const related = getRelatedPosts(post.slug);

  return (
    <div className="min-h-screen gradient-bg-page">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-3xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-5 md:px-8 pt-28 md:pt-36 pb-16">
        <a href="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors mb-6">
          <ArrowLeft size={14} /> Back to blog
        </a>

        <div className="flex items-center gap-3 mb-5">
          <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple !text-[11px]">{post.category}</span>
          <span className="flex items-center gap-1 text-xs text-brand-muted">
            <Clock size={12} /> {post.readTime}
          </span>
        </div>

        <h1 className="h1 text-brand-dark mb-4 !text-3xl md:!text-[2.5rem]">{post.title}</h1>
        <p className="body-text mb-8">{post.description}</p>

        <div className="flex items-center gap-3 mb-10 pb-8 border-b border-[rgba(124,92,252,0.08)]">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
            ET
          </div>
          <div>
            <div className="text-sm font-semibold text-brand-dark">Eclatale Team</div>
            <div className="text-xs text-brand-muted">
              {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="prose-content space-y-5">
          {post.content.map((block, i) => {
            if (block.type === 'h2') {
              return <h2 key={i} className="text-xl md:text-2xl font-bold text-brand-dark mt-10 mb-3">{block.text}</h2>;
            }
            if (block.type === 'h3') {
              return <h3 key={i} className="text-lg font-bold text-brand-dark mt-8 mb-2">{block.text}</h3>;
            }
            if (block.type === 'ul') {
              return (
                <ul key={i} className="space-y-2 pl-1">
                  {block.items?.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-[15px] text-brand-dark leading-relaxed">
                      <span className="text-brand-purple mt-1.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            return <p key={i} className="text-[15px] text-brand-dark leading-relaxed">{block.text}</p>;
          })}
        </div>

        <div className="mt-12 card gradient-primary p-8 md:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-10" />
          <div className="relative z-10">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
              Ready to grow your LinkedIn?
            </h3>
            <p className="text-white/80 mb-6 text-sm md:text-base">
              Start free on Eclatale — no credit card required.
            </p>
            <a href="/signup" className="inline-flex items-center gap-2 bg-white text-brand-purple font-semibold px-7 py-3.5 rounded-full hover:bg-brand-bg transition-all shadow-lg text-sm">
              Start Free <ArrowRight size={16} />
            </a>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-14">
            <h3 className="text-lg font-bold text-brand-dark mb-5">Related posts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.map(r => (
                <a key={r.slug} href={`/blog/${r.slug}`} className="card card-hover p-5">
                  <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple !text-[10px] mb-3">{r.category}</span>
                  <h4 className="text-sm font-bold text-brand-dark leading-snug mb-1">{r.title}</h4>
                  <p className="text-xs text-brand-muted">{r.readTime}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </article>

      <footer className="py-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
          <p className="text-sm text-brand-muted">&copy; {new Date().getFullYear()} Eclatale. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
