import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, TrendingUp, ArrowRight, Zap, FileText, FlaskConical, Copy, Check } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { Angle, Source, PostLength, LENGTH_OPTIONS } from './types';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface ResearchBrief {
  stats: string[];
  angles: { style: string; hook: string }[];
  recommendedHook: string;
  briefText: string;
}

interface Phase0Props {
  userId: string;
  firstName: string;
  voiceLabel: string;
  onGoIdeas: () => void;
  onGoTrending: (topic: string) => void;
  onGoRepurpose: (spark: string) => void;
  onGoIdea: (angles: Angle[], sources: Source[]) => void;
  onGoDirectIdea?: (topic: string, length: PostLength) => void;
  onGoWithResearch?: (topic: string, briefText: string, length: PostLength) => void;
}

interface TrendItem { topic: string; source: string; }
interface TrendCategory { label: string; items: TrendItem[]; }

export default function Phase0Picker({
  userId, firstName, voiceLabel,
  onGoIdeas, onGoTrending, onGoRepurpose, onGoIdea, onGoDirectIdea, onGoWithResearch,
}: Phase0Props) {
  const [trendCategories, setTrendCategories] = useState<TrendCategory[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [idea, setIdea] = useState('');
  const [selectedLength, setSelectedLength] = useState<PostLength>('short');
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const [repurposeText, setRepurposeText] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchBrief, setResearchBrief] = useState<ResearchBrief | null>(null);
  const [researchError, setResearchError] = useState('');
  const [hookCopied, setHookCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/create/trending-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userId }),
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.categories) && d.categories.length > 0) {
          setTrendCategories(d.categories);
        } else if (Array.isArray(d.topics)) {
          // backward compat: flat list
          setTrendCategories([{ label: 'Trending', items: d.topics.map((t: string) => ({ topic: t, source: '' })) }]);
        }
      })
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, [userId]);

  const displayName = firstName.split(' ')[0] || 'there';
  const canGenerate = idea.trim().length > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    if (onGoDirectIdea) {
      onGoDirectIdea(idea.trim(), selectedLength);
    } else {
      onGoIdeas();
    }
  };

  const handleResearchFirst = async () => {
    if (!canGenerate) return;
    setResearchBrief(null);
    setResearchError('');
    setResearchLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'research-brief', topic: idea.trim(), userId }),
      });
      const data = await res.json();
      if (data.error) { setResearchError(data.error); return; }
      setResearchBrief(data);
    } catch {
      setResearchError('Could not load research. Try again.');
    } finally {
      setResearchLoading(false);
    }
  };

  const handleWriteFromResearch = () => {
    if (!researchBrief || !onGoWithResearch) return;
    onGoWithResearch(idea.trim(), researchBrief.briefText, selectedLength);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canGenerate) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #F4F0FF 0%, #FDF9FF 60%, #FFF0F8 100%)' }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 py-6 sm:py-12 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[rgba(124,92,252,0.15)] text-[12px] font-semibold text-brand-muted shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#7C5CFC] flex-shrink-0" />
            In your voice · {voiceLabel}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-dark leading-tight">
            Hey {displayName}, what are we creating today?
          </h1>
        </div>

        {/* Hero input card */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(124,92,252,0.12)', border: '2px solid #EDE8FF' }}>

          {/* Textarea */}
          <div className="p-4 sm:p-5">
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={e => setIdea(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              placeholder="What's on your mind? Type an idea, story, or topic..."
              className="w-full resize-none outline-none text-[15px] sm:text-[16px] leading-relaxed text-brand-dark placeholder:text-[#C0B8D8] bg-transparent"
              style={{ minHeight: 120 }}
              autoFocus
            />
          </div>

          {/* Options row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 pb-4 sm:pb-5 border-t" style={{ borderColor: '#F4F0FF' }}>

            {/* Length pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {LENGTH_OPTIONS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLength(l.id)}
                  className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-full transition-all"
                  style={selectedLength === l.id
                    ? { background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', color: 'white', boxShadow: '0 2px 12px rgba(124,92,252,0.28)' }
                    : { color: '#6B7280', border: '1.5px solid #EDE8FF', background: 'transparent' }}
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>

            {/* Buttons */}
            <div className="sm:ml-auto flex items-center gap-2">
              {onGoWithResearch && (
                <button
                  onClick={handleResearchFirst}
                  disabled={!canGenerate || researchLoading}
                  className="flex items-center justify-center gap-1.5 text-[13px] font-bold px-4 py-2.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: '#7C5CFC', border: '1.5px solid #EDE8FF', background: 'white' }}
                  title="Research your topic first, then write"
                >
                  <FlaskConical size={13} />
                  {researchLoading ? 'Researching…' : 'Research first'}
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex items-center justify-center gap-2 text-[14px] font-bold text-white px-5 py-2.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: canGenerate ? '0 4px 18px rgba(124,92,252,0.32)' : 'none' }}
                title="Cmd+Enter to generate"
              >
                <Zap size={15} fill="white" strokeWidth={0} />
                Generate post
              </button>
            </div>
          </div>

          {/* Keyboard hint */}
          <div className="px-5 pb-3 -mt-1 hidden sm:block">
            <span className="text-[10px] text-[#C0B8D8] font-medium">
              Tip: press Cmd+Enter to generate
            </span>
          </div>
        </div>

        {/* Research Brief Panel */}
        {(researchLoading || researchBrief || researchError) && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(124,92,252,0.2)', background: 'white', boxShadow: '0 4px 24px rgba(124,92,252,0.09)' }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: '#F4F0FF', background: 'linear-gradient(90deg, rgba(124,92,252,0.04) 0%, rgba(247,37,133,0.02) 100%)' }}>
              <FlaskConical size={14} className="text-brand-purple" />
              <span className="text-[13px] font-bold text-brand-dark">Research Brief</span>
              {researchBrief && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#10B981' }}>Ready</span>}
              {researchLoading && <span className="ml-auto text-[10px] font-semibold text-brand-muted animate-pulse">Searching the web…</span>}
            </div>

            {researchLoading && (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-3 rounded-full bg-[rgba(124,92,252,0.07)] animate-pulse" style={{ width: `${60 + i * 12}%` }} />
                ))}
              </div>
            )}

            {researchError && (
              <div className="px-5 py-4 text-[13px] text-red-500">{researchError}</div>
            )}

            {researchBrief && !researchLoading && (
              <div className="p-5 space-y-4">

                {/* Stats */}
                {researchBrief.stats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Key findings</p>
                    <ul className="space-y-1.5">
                      {researchBrief.stats.map((stat, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-brand-dark leading-snug">
                          <span className="font-bold text-brand-purple flex-shrink-0 mt-0.5">{i + 1}.</span>
                          {stat}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Angles */}
                {researchBrief.angles.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Content angles</p>
                    <div className="space-y-2">
                      {researchBrief.angles.map((a, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: 'rgba(124,92,252,0.03)', border: '1px solid rgba(124,92,252,0.09)' }}>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 text-white" style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}>{a.style}</span>
                          <p className="text-[12px] text-brand-dark leading-snug">{a.hook}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended hook */}
                {researchBrief.recommendedHook && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Recommended hook</p>
                    <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(124,92,252,0.05)', border: '1.5px solid rgba(124,92,252,0.15)' }}>
                      <p className="flex-1 text-[13px] font-semibold text-brand-dark leading-snug">{researchBrief.recommendedHook}</p>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(researchBrief.recommendedHook);
                          setHookCopied(true);
                          setTimeout(() => setHookCopied(false), 1800);
                        }}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-[rgba(124,92,252,0.1)] transition-colors text-brand-muted"
                      >
                        {hookCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* CTAs */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleWriteFromResearch}
                    className="flex items-center gap-2 text-[13px] font-bold text-white px-5 py-2.5 rounded-full transition-all"
                    style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.28)' }}
                  >
                    <Zap size={13} fill="white" strokeWidth={0} />
                    Write post from this research
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="text-[12px] font-semibold text-brand-muted hover:text-brand-dark transition-colors"
                  >
                    Skip, generate directly
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(124,92,252,0.1)' }} />
          <span className="text-[12px] font-semibold text-brand-muted">or start from</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(124,92,252,0.1)' }} />
        </div>

        {/* Single combined inspiration card */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(124,92,252,0.15)', boxShadow: '0 2px 16px rgba(124,92,252,0.07)' }}>

          {/* Row 1: Give me ideas */}
          <button
            onClick={onGoIdeas}
            className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[rgba(124,92,252,0.03)] active:bg-[rgba(124,92,252,0.06)]"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
              style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}>
              <Sparkles size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-brand-dark">Give me ideas</p>
              <p className="text-[12px] text-brand-muted">AI angles for your role and industry</p>
            </div>
            <ArrowRight size={15} className="flex-shrink-0 text-[#C0B8D8]" />
          </button>

          {/* Divider */}
          <div className="mx-4 h-px" style={{ background: '#F0EEF8' }} />

          {/* Row 2: Repurpose content */}
          <div>
            <button
              onClick={() => setRepurposeOpen(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[rgba(124,92,252,0.03)] active:bg-[rgba(124,92,252,0.06)]"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #6366F1)' }}>
                <FileText size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-brand-dark">Repurpose content</p>
                <p className="text-[12px] text-brand-muted">Paste a PDF, article, or notes to post</p>
              </div>
              <ArrowRight size={15} className={`flex-shrink-0 text-[#C0B8D8] transition-transform ${repurposeOpen ? 'rotate-90' : ''}`} />
            </button>
            {repurposeOpen && (
              <div className="px-4 pb-4">
                <textarea
                  value={repurposeText}
                  onChange={e => setRepurposeText(e.target.value)}
                  placeholder="Paste your content here, an article, PDF text, notes, or a blog post..."
                  rows={4}
                  className="w-full resize-none outline-none text-[13px] leading-relaxed text-brand-dark placeholder:text-[#C0B8D8] bg-[#FAFAFE] rounded-xl border border-[#EDE8FF] px-3 py-2.5 mb-2"
                />
                <button
                  onClick={() => {
                    if (!repurposeText.trim()) return;
                    onGoRepurpose(repurposeText.trim());
                  }}
                  disabled={!repurposeText.trim()}
                  className="flex items-center gap-1.5 text-[13px] font-bold text-white px-4 py-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'linear-gradient(135deg, #0EA5E9, #6366F1)' }}
                >
                  <Zap size={13} fill="white" strokeWidth={0} /> Turn into a post
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 h-px" style={{ background: '#F0EEF8' }} />

          {/* Row 3: What's trending */}
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)' }}>
                <TrendingUp size={13} />
              </div>
              <p className="text-[14px] font-bold text-brand-dark">What's trending</p>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ml-auto flex-shrink-0" style={{ background: '#0F172A' }}>
                <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            </div>

            {trendingLoading ? (
              <div className="flex flex-col gap-3">
                {['Tools', 'Trends', 'News'].map(label => (
                  <div key={label}>
                    <div className="h-3 w-12 rounded bg-[rgba(124,92,252,0.08)] animate-pulse mb-2" />
                    <div className="flex gap-1.5 flex-wrap">
                      {[90, 110, 80].map((w, i) => (
                        <div key={i} className="h-7 rounded-full bg-[rgba(124,92,252,0.06)] animate-pulse" style={{ width: w }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : trendCategories.length > 0 ? (
              <div className="flex flex-col gap-3">
                {trendCategories.map((cat, ci) => (
                  <div key={ci}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9CA3AF' }}>{cat.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.items.map((item, ii) => (
                        <button
                          key={ii}
                          onClick={() => onGoDirectIdea ? onGoDirectIdea(item.topic, selectedLength) : onGoTrending(item.topic)}
                          className="flex flex-col items-start px-2.5 py-1.5 rounded-xl text-left transition-all hover:shadow-sm active:scale-95"
                          style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.08)' }}
                        >
                          <span className="text-[12px] font-semibold leading-snug" style={{ color: '#1A1A2E' }}>{item.topic}</span>
                          {item.source && (
                            <span className="text-[9px] font-medium mt-0.5" style={{ color: '#9CA3AF' }}>{item.source}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => onGoTrending('')}
                className="text-[12px] font-semibold text-[#1E3A5F] flex items-center gap-1"
              >
                Browse trending topics <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
