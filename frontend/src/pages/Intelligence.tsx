import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Clock, FileText, Search, TrendingUp, Target,
  RefreshCw, Loader2, Sparkles, ArrowRight,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface Insight { type: string; title: string; detail: string; }
interface IntelData {
  insights: Insight[];
  trendingTopics: string[];
  role: string;
  industry: string;
  basedOn: string;
  generatedAt?: string;
}

const INSIGHT_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  timing:            { icon: <Clock size={16} />,      label: 'Best Timing',       color: 'from-brand-purple to-[#9B7DFC]' },
  content_type:      { icon: <FileText size={16} />,   label: 'Content Format',     color: 'from-brand-pink to-[#FF5CAD]' },
  topic_gap:         { icon: <Search size={16} />,     label: 'Topic Gap',          color: 'from-brand-orange to-[#FF8F5E]' },
  trending_topic:    { icon: <TrendingUp size={16} />, label: 'Trending Now',       color: 'from-brand-teal to-brand-blue' },
  competitive_angle: { icon: <Target size={16} />,     label: 'Competitive Angle',  color: 'from-brand-purple to-brand-pink' },
};

export default function Intelligence() {
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (uid: string, refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'competitor', userId: uid, refresh }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load intelligence');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
      load(data.user.id, false);
    });
  }, [load]);

  return (
    <div className="min-h-screen bg-[#FAFAFE]">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center gap-3">
        <a href="/dashboard" className="p-2 -ml-2 text-brand-muted hover:text-brand-purple transition-colors"><ArrowLeft size={18} /></a>
        <a href="/dashboard" className="text-lg font-extrabold gradient-text">Eclatale</a>
        <span className="text-brand-muted text-sm font-medium ml-2">/ Competitor Intelligence</span>
      </nav>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-8">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Competitor Intelligence</h1>
            <p className="text-sm text-brand-muted mt-1">
              {data
                ? <>AI-curated strategy for a <span className="font-semibold text-brand-dark">{data.role}</span> in <span className="font-semibold text-brand-dark">{data.industry}</span>.</>
                : 'Personalized LinkedIn strategy for your exact role and industry.'}
            </p>
          </div>
          <button
            onClick={() => userId && load(userId, true)}
            disabled={refreshing || loading}
            className="btn-secondary text-sm flex-shrink-0 disabled:opacity-50">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 w-full" />)}
          </div>
        ) : error ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button onClick={() => userId && load(userId, true)} className="btn-primary text-sm">Try again</button>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Insights */}
            <div className="lg:col-span-2 space-y-4">
              {data.insights.map((ins, i) => {
                const meta = INSIGHT_META[ins.type] || { icon: <Sparkles size={16} />, label: ins.type, color: 'from-brand-purple to-brand-pink' };
                return (
                  <div key={i} className="card p-5">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-white flex-shrink-0`}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-widest">{meta.label}</span>
                        </div>
                        <h3 className="text-sm font-bold text-brand-dark mb-1">{ins.title}</h3>
                        <p className="text-[13px] text-brand-dark/80 leading-relaxed">{ins.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trending Topics */}
            <div className="space-y-6">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-brand-teal" />
                  <h3 className="text-sm font-bold text-brand-dark">Trending Topics</h3>
                </div>
                <p className="text-[10px] text-brand-muted font-medium mb-4">AI-Curated for your industry</p>
                <div className="space-y-2">
                  {data.trendingTopics.map((topic, i) => (
                    <a key={i} href={`/create?topic=${encodeURIComponent(topic)}`}
                      className="block p-3 rounded-xl border border-[rgba(124,92,252,0.06)] hover:border-brand-purple/20 hover:shadow-brand transition-all group bg-white">
                      <p className="text-[13px] text-brand-dark leading-snug mb-2 font-medium">{topic}</p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-brand-purple font-semibold opacity-70 group-hover:opacity-100 transition-opacity">
                        Write about this <ArrowRight size={11} />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-brand-muted px-1 leading-relaxed">
                {data.basedOn}. This is AI-generated strategic analysis, not live scraped competitor data.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
