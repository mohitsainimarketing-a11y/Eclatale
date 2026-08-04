import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Clock, Link2, Check } from 'lucide-react';
import { getBlogPost, getRelatedPosts } from '../data/blogPosts';
import NewsletterSignup from '../components/NewsletterSignup';
import Seo from '../components/Seo';

const LinkedInIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
  </svg>
);
const TwitterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.9 2.25h3.07l-6.71 7.67 7.9 10.83h-6.19l-4.85-6.34-5.55 6.34H3.5l7.18-8.2L3.1 2.25h6.35l4.38 5.8 5.07-5.8Zm-1.08 16.66h1.7L7.28 4.03H5.45l12.37 14.88Z" />
  </svg>
);

function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — ignore */ }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-brand-muted mr-1">Share:</span>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"
        className="w-8 h-8 rounded-full flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-purple transition-colors border border-[rgba(124,92,252,0.15)]"
      >
        <LinkedInIcon />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank" rel="noopener noreferrer" aria-label="Share on X (Twitter)"
        className="w-8 h-8 rounded-full flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-purple transition-colors border border-[rgba(124,92,252,0.15)]"
      >
        <TwitterIcon />
      </a>
      <button
        type="button" onClick={copyLink} aria-label="Copy link"
        className="w-8 h-8 rounded-full flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-purple transition-colors border border-[rgba(124,92,252,0.15)]"
      >
        {copied ? <Check size={14} /> : <Link2 size={14} />}
      </button>
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  if (!post) return <Navigate to="/blog" replace />;

  const related = getRelatedPosts(post.slug);

  return (
    <div className="min-h-screen gradient-bg-page">
      <Seo
        title={post.title}
        description={post.description}
        path={`/blog/${post.slug}`}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: { '@type': 'Organization', name: 'Eclatale' },
          publisher: { '@type': 'Organization', name: 'Eclatale', logo: { '@type': 'ImageObject', url: 'https://eclatale.com/logo512.png' } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `https://eclatale.com/blog/${post.slug}` },
        }}
      />
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

        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-8 border-b border-[rgba(124,92,252,0.08)]">
          <div className="flex items-center gap-3">
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
          <ShareButtons title={post.title} url={typeof window !== 'undefined' ? window.location.href : `https://eclatale.com/blog/${post.slug}`} />
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
            if (block.type === 'table') {
              return (
                <div key={i} className="card overflow-x-auto !p-0">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[rgba(124,92,252,0.08)]">
                        {block.headers?.map((h, j) => (
                          <th key={j} className="text-left font-semibold text-brand-dark p-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows?.map((row, j) => (
                        <tr key={j} className="border-b border-[rgba(124,92,252,0.06)] last:border-0">
                          {row.map((cell, k) => (
                            <td key={k} className="p-4 text-brand-muted">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            return <p key={i} className="text-[15px] text-brand-dark leading-relaxed">{block.text}</p>;
          })}
        </div>

        <div className="mt-10">
          <ShareButtons title={post.title} url={typeof window !== 'undefined' ? window.location.href : `https://eclatale.com/blog/${post.slug}`} />
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
            <a href="/signup" className="inline-flex items-center gap-2 bg-white text-brand-purple font-semibold px-7 py-3.5 rounded-full hover:bg-brand-bg transition-all shadow-brand-lg text-sm">
              Start Free <ArrowRight size={16} />
            </a>
          </div>
        </div>

        <div className="mt-14 card p-8 md:p-10 text-center bg-brand-bg">
          <h3 className="text-lg md:text-xl font-bold text-brand-dark mb-2">Enjoyed this? Get weekly LinkedIn growth insights</h3>
          <p className="text-sm text-brand-muted mb-6 max-w-sm mx-auto">Practical tips like this, straight to your inbox — no fluff, unsubscribe anytime.</p>
          <div className="flex justify-center">
            <NewsletterSignup label="" />
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-14">
            <h3 className="text-lg font-bold text-brand-dark mb-5">Related posts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.map(r => (
                <a key={r.slug} href={`/blog/${r.slug}`} className="card card-hover p-6">
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
