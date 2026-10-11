import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { Angle, Source, PostLength, LENGTH_OPTIONS } from './types';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface Phase0Props {
  userId: string;
  firstName: string;
  voiceLabel: string;
  onGoIdeas: () => void;
  onGoTrending: (topic: string) => void;
  onGoRepurpose: (spark: string) => void;
  onGoIdea: (angles: Angle[], sources: Source[]) => void;
  // New: direct path from idea input to Phase 2
  onGoDirectIdea?: (topic: string, length: PostLength) => void;
}

export default function Phase0Picker({
  userId, firstName, voiceLabel,
  onGoIdeas, onGoTrending, onGoRepurpose, onGoIdea, onGoDirectIdea,
}: Phase0Props) {
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [idea, setIdea] = useState('');
  const [selectedLength, setSelectedLength] = useState<PostLength>('short');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="sm:ml-auto flex items-center justify-center gap-2 text-[14px] font-bold text-white px-5 py-2.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: canGenerate ? '0 4px 18px rgba(124,92,252,0.32)' : 'none' }}
              title="Cmd+Enter to generate"
            >
              <Zap size={15} fill="white" strokeWidth={0} />
              Generate post
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="px-5 pb-3 -mt-1 hidden sm:block">
            <span className="text-[10px] text-[#C0B8D8] font-medium">
              Tip: press Cmd+Enter to generate
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(124,92,252,0.1)' }} />
          <span className="text-[12px] font-semibold text-brand-muted">or start from</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(124,92,252,0.1)' }} />
        </div>

        {/* Two secondary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Card 1: Give me ideas */}
          <button
            onClick={onGoIdeas}
            className="relative rounded-2xl bg-white overflow-hidden text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer"
            style={{ border: '1.5px solid rgba(124,92,252,0.15)' }}
          >
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }} />
            <div className="p-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 text-white"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}>
                <Sparkles size={16} />
              </div>
              <p className="text-[14px] font-bold text-brand-dark mb-1">Give me ideas</p>
              <p className="text-[12px] text-brand-muted leading-snug mb-3">
                AI finds trending angles for your role and industry
              </p>
              <div className="flex items-center gap-1 text-[12px] font-semibold text-[#7C5CFC]">
                See my angles <ArrowRight size={12} />
              </div>
            </div>
          </button>

          {/* Card 2: What's trending */}
          <button
            onClick={() => onGoTrending(trendingTopics[0] || '')}
            className="rounded-2xl bg-white overflow-hidden text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer"
            style={{ border: '1.5px solid rgba(124,92,252,0.15)' }}
          >
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)' }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                  style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)' }}>
                  <TrendingUp size={16} />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#0F172A' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </div>
              </div>
              <p className="text-[14px] font-bold text-brand-dark mb-1">What's trending</p>
              <p className="text-[12px] text-brand-muted leading-snug mb-2.5">
                Live industry topics to jump on right now
              </p>
              {trendingLoading ? (
                <div className="flex gap-1.5">
                  {[72, 56, 64].map((w, i) => (
                    <div key={i} className="h-5 rounded-full bg-[rgba(124,92,252,0.08)] animate-pulse" style={{ width: w }} />
                  ))}
                </div>
              ) : trendingTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {trendingTopics.slice(0, 3).map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(15,23,42,0.06)] text-[#1E3A5F]">
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-[#1E3A5F]">
                  Browse topics <ArrowRight size={12} />
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
