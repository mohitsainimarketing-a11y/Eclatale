import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ToolConfig, relatedTools } from './config';

export function LoadingMessages({ messages }: { messages: string[] }) {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % messages.length), 1600);
    return () => clearInterval(t);
  }, [messages.length]);
  return (
    <div className="flex items-center gap-2.5 py-6 justify-center">
      <div className="w-4 h-4 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
      <span className="text-sm font-medium text-brand-muted">{messages[idx]}</span>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button onClick={handleCopy} className="btn-secondary !py-2 !px-4 text-xs">
      {copied ? 'Copied ✓' : 'Copy result'}
    </button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-500 font-medium mt-3">{message}</p>;
}

export default function ToolShell({ tool, children }: { tool: ToolConfig; children: React.ReactNode }) {
  const related = relatedTools(tool.slug);

  return (
    <div className="min-h-screen gradient-bg-page">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-4xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-5 md:px-8 pt-24 md:pt-32 pb-16">
        <p className="text-xs font-semibold text-brand-muted mb-4">
          <a href="/tools" className="hover:text-brand-purple">Tools</a> / {tool.name}
        </p>

        <h1 className="h2 text-brand-dark mb-3">
          <span className="mr-2">{tool.emoji}</span>
          <span className="gradient-text">{tool.name}</span>
        </h1>
        <p className="body-text max-w-2xl mb-4">{tool.description}</p>
        <p className="text-xs font-semibold text-brand-muted mb-8">Free · No signup required · Powered by Claude AI</p>

        <div className="card p-6 md:p-8 mb-10">
          {children}
        </div>

        <div className="card p-6 md:p-8 text-center mb-14" style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.06) 0%, rgba(247,37,133,0.06) 100%)' }}>
          <p className="text-base font-bold text-brand-dark mb-1">Want unlimited posts, voice matching, and LinkedIn publishing?</p>
          <p className="text-sm text-brand-muted mb-5">Eclatale learns your voice and writes content that actually sounds like you.</p>
          <a href="/signup" className="btn-primary !py-3 !px-8 inline-flex mb-3">Start free on Eclatale <ArrowRight size={16} /></a>
          <p className="text-xs text-brand-muted">Already have an account? <a href="/login" className="text-brand-purple font-semibold hover:underline">Sign in →</a></p>
        </div>

        <div>
          <p className="text-sm font-bold text-brand-dark mb-4">Explore more free tools</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map(t => (
              <a key={t.slug} href={`/tools/${t.slug}`} className="card card-hover p-5">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-lg mb-3">{t.emoji}</div>
                <p className="text-sm font-bold text-brand-dark mb-1">{t.name}</p>
                <p className="text-xs text-brand-muted leading-relaxed">{t.shortDesc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      <footer className="py-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
          <p className="text-sm text-brand-muted">&copy; {new Date().getFullYear()} Eclatale. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
