import React, { useEffect, useState } from 'react';
import { X, ChevronDown, Sparkles, ArrowRight } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNo}`;
}

interface BriefingData {
  domain: string; postsThisWeek: number; postsLastWeek: number; currentStreak: number;
  trendingTopics: { topic: string }[]; formatInsight: string;
  opportunityText: string; opportunityStyleSlug: string;
  angles: { style: string; hook: string }[];
}

export default function WeeklyBriefingCard({ userId }: { userId: string }) {
  const weekKey = isoWeekKey(new Date());
  const dismissKey = `eclatale_briefing_dismissed_${weekKey}`;
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<BriefingData | null>(null);

  useEffect(() => {
    if (!userId) return;
    const isMonday = new Date().getDay() === 1;
    let dismissed = false;
    try { dismissed = localStorage.getItem(dismissKey) === '1'; } catch {}
    if (!isMonday || dismissed) return;

    apiFetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'industry-briefing-preview', userId }),
    }).then(async res => {
      const json = await res.json();
      if (!json.error) { setData(json); setVisible(true); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleDismiss = () => {
    try { localStorage.setItem(dismissKey, '1'); } catch {}
    setVisible(false);
  };

  if (!visible || !data) return null;

  return (
    <div className="card p-5 md:p-6 mb-6" style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.04) 0%, rgba(247,37,133,0.04) 100%)' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-purple" />
          <h3 className="text-sm md:text-base font-bold text-brand-dark">What's working in {data.domain} this week</h3>
        </div>
        <button onClick={handleDismiss} aria-label="Dismiss" className="text-brand-muted hover:text-brand-dark p-1 -m-1 flex-shrink-0">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs md:text-sm text-brand-muted mb-3">
        {data.postsThisWeek} posts this week (vs {data.postsLastWeek} last week) &middot; {data.currentStreak > 0 ? `${data.currentStreak}-day streak 🔥` : 'no active streak'}
      </p>

      {!expanded ? (
        <button onClick={() => setExpanded(true)} className="flex items-center gap-1 text-xs md:text-sm font-semibold text-brand-purple">
          View full briefing <ChevronDown size={14} />
        </button>
      ) : (
        <div className="mt-3 space-y-4 animate-fadeIn">
          {data.trendingTopics.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-2">Trending this week</p>
              <div className="flex flex-wrap gap-2">
                {data.trendingTopics.map((t, i) => (
                  <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-[rgba(124,92,252,0.12)] text-brand-dark">{t.topic}</span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl p-4 bg-white border border-[rgba(124,92,252,0.1)]">
            <p className="text-[11px] font-bold text-brand-purple uppercase tracking-wide mb-1.5">Your best opportunity</p>
            <p className="text-sm text-brand-dark mb-2">{data.opportunityText}</p>
            <a href={`/create/talk?style=${data.opportunityStyleSlug}`} className="text-xs font-bold text-brand-purple inline-flex items-center gap-1">
              Generate that post <ArrowRight size={12} />
            </a>
          </div>

          {data.angles.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-2">3 angles for this week</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {data.angles.map((a, i) => (
                  <a key={i} href="/create" className="block p-3 rounded-xl bg-white border border-[rgba(124,92,252,0.1)] hover:border-brand-purple/40 transition-colors">
                    <p className="text-[10px] font-bold text-brand-purple uppercase tracking-wide mb-1">{a.style}</p>
                    <p className="text-xs text-brand-dark leading-snug">{a.hook}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setExpanded(false)} className="text-xs font-semibold text-brand-muted">Show less</button>
        </div>
      )}
    </div>
  );
}
