import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, FileText, Lightbulb, ArrowRight, Link } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { Angle, Source } from './types';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface Phase0Props {
  userId: string;
  firstName: string;
  voiceLabel: string;
  onGoIdeas: () => void;
  onGoTrending: (topic: string) => void;
  onGoRepurpose: (spark: string) => void;
  onGoIdea: (angles: Angle[], sources: Source[]) => void;
}

const IDEA_STARTERS = [
  'What I learned from failing at...',
  'The uncomfortable truth about...',
  'Why most people get X wrong...',
  'After years in this industry...',
];

export default function Phase0Picker({
  userId, firstName, voiceLabel,
  onGoIdeas, onGoTrending, onGoRepurpose, onGoIdea,
}: Phase0Props) {
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const [expandedCard, setExpandedCard] = useState<'repurpose' | 'idea' | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [ideaInput, setIdeaInput] = useState('');
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaError, setIdeaError] = useState('');

  useEffect(() => {
    apiFetch(`${API_URL}/api/create/trending-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userId }),
    })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.topics)) setTrendingTopics(d.topics); })
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, [userId]);

  const handleRepurpose = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlLoading(true);
    setUrlError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'fetch-url', url }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      onGoRepurpose(d.text || url);
    } catch (e: any) {
      setUrlError(e.message || "Couldn't fetch that URL — try another link.");
    }
    setUrlLoading(false);
  };

  const handleFromIdea = async (idea: string) => {
    const text = idea.trim();
    if (!text) return;
    setIdeaLoading(true);
    setIdeaError('');
    try {
      const res = await apiFetch(`${API_URL}/api/create/from-idea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, idea: text }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      onGoIdea(d.angles || [], d.sources || []);
    } catch (e: any) {
      setIdeaError(e.message || "Couldn't process that idea — try again.");
    }
    setIdeaLoading(false);
  };

  const displayName = firstName.split(' ')[0] || 'there';

  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #F4F0FF 0%, #FDF9FF 60%, #FFF0F8 100%)' }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 py-8 sm:py-12 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[rgba(124,92,252,0.15)] text-[12px] font-semibold text-brand-muted shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#7C5CFC] flex-shrink-0" />
            In your voice · {voiceLabel}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-dark leading-tight">
            Hey {displayName}, what are we creating today? ✨
          </h1>
          <p className="text-sm text-brand-muted">
            Pick your starting point — takes 5 seconds.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Card 1 — Give me ideas */}
          <button
            onClick={onGoIdeas}
            className="relative rounded-2xl bg-white overflow-hidden text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer"
            style={{ border: '2px solid #7C5CFC' }}
          >
            <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}>
              POPULAR
            </div>
            <div className="h-2" style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }} />
            <div className="p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-white"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}>
                <Sparkles size={18} />
              </div>
              <p className="text-[15px] font-bold text-brand-dark mb-1">Give me ideas</p>
              <p className="text-[13px] text-brand-muted leading-snug">
                AI finds trending angles for your role and industry
              </p>
              <div className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-[#7C5CFC]">
                See my angles <ArrowRight size={13} />
              </div>
            </div>
          </button>

          {/* Card 2 — What's trending */}
          <div className="rounded-2xl bg-white overflow-hidden border border-[rgba(124,92,252,0.1)] transition-all hover:shadow-lg hover:-translate-y-0.5">
            <div className="h-2" style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)' }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                  style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)' }}>
                  <TrendingUp size={18} />
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#0F172A' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </div>
              </div>
              <p className="text-[15px] font-bold text-brand-dark mb-1">What's trending</p>
              <p className="text-[13px] text-brand-muted leading-snug mb-3">
                Live industry topics to jump on right now
              </p>
              {trendingLoading ? (
                <div className="flex gap-2">
                  {[72, 56, 64].map((w, i) => (
                    <div key={i} className="h-6 rounded-full bg-[rgba(124,92,252,0.08)] animate-pulse" style={{ width: w }} />
                  ))}
                </div>
              ) : trendingTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {trendingTopics.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => onGoTrending(t)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[rgba(15,23,42,0.06)] text-[#1E3A5F] hover:bg-[rgba(15,23,42,0.12)] transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => onGoTrending('')}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[#1E3A5F]"
                >
                  Browse trending topics <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Card 3 — I have something */}
          <div className="rounded-2xl bg-white overflow-hidden border border-[rgba(124,92,252,0.1)] transition-all hover:shadow-lg hover:-translate-y-0.5">
            <div className="h-2" style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }} />
            <div className="p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-white"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}>
                <FileText size={18} />
              </div>
              <p className="text-[15px] font-bold text-brand-dark mb-1">I have something</p>
              <p className="text-[13px] text-brand-muted leading-snug mb-3">
                Turn an article, link, or note into a post
              </p>
              {expandedCard === 'repurpose' ? (
                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-[rgba(124,92,252,0.15)] bg-[rgba(124,92,252,0.03)] px-3 py-2">
                      <Link size={13} className="text-brand-muted flex-shrink-0" />
                      <input
                        autoFocus
                        type="url"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRepurpose(); }}
                        placeholder="Paste a URL..."
                        className="flex-1 bg-transparent text-[13px] text-brand-dark placeholder-brand-muted outline-none"
                      />
                    </div>
                    <button
                      onClick={handleRepurpose}
                      disabled={!urlInput.trim() || urlLoading}
                      className="px-3 py-2 rounded-xl text-white text-[13px] font-bold disabled:opacity-40 transition-opacity"
                      style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                    >
                      {urlLoading ? '…' : '→'}
                    </button>
                  </div>
                  {urlError && <p className="text-[11px] text-red-500">{urlError}</p>}
                </div>
              ) : (
                <button
                  onClick={() => setExpandedCard('repurpose')}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[#F59E0B]"
                >
                  Paste a link <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Card 4 — I have an idea */}
          <div className="rounded-2xl bg-white overflow-hidden border border-[rgba(124,92,252,0.1)] transition-all hover:shadow-lg hover:-translate-y-0.5">
            <div className="h-2" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }} />
            <div className="p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-white"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                <Lightbulb size={18} />
              </div>
              <p className="text-[15px] font-bold text-brand-dark mb-1">I have an idea</p>
              <p className="text-[13px] text-brand-muted leading-snug mb-3">
                Type your spark — AI turns it into angles
              </p>
              {expandedCard === 'idea' ? (
                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                  <textarea
                    autoFocus
                    value={ideaInput}
                    onChange={e => setIdeaInput(e.target.value)}
                    placeholder="What's on your mind? A lesson, a take, an experience..."
                    rows={3}
                    className="w-full rounded-xl border border-[rgba(124,92,252,0.15)] bg-[rgba(124,92,252,0.03)] px-3 py-2 text-[13px] text-brand-dark placeholder-brand-muted outline-none resize-none"
                  />
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {IDEA_STARTERS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setIdeaInput(s)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(59,130,246,0.08)] text-[#3B82F6] hover:bg-[rgba(59,130,246,0.15)] transition-colors text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {ideaError && <p className="text-[11px] text-red-500">{ideaError}</p>}
                  <button
                    onClick={() => handleFromIdea(ideaInput)}
                    disabled={!ideaInput.trim() || ideaLoading}
                    className="w-full py-2 rounded-xl text-white text-[13px] font-bold disabled:opacity-40 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                  >
                    {ideaLoading ? 'Building angles...' : 'Build my angles →'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setExpandedCard('idea')}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[#3B82F6]"
                >
                  Tell me more <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom hint */}
        <p className="text-center text-[12px] text-brand-muted pb-2">
          Every path leads to a post that sounds authentically like you 🎯
        </p>
      </div>
    </div>
  );
}
