import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Clock, FileText, Search, TrendingUp, Target,
  RefreshCw, Loader2, Sparkles, ArrowRight, UserCog,
  CheckCircle2, AlertCircle, Copy, Check,
} from 'lucide-react';
import FeatureLock from '../components/FeatureLock';
import AppShell from '../components/AppShell';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

// ── Competitor Intelligence ──────────────────────────────────────────────────

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

function CompetitorPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (uid: string, refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
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

  useEffect(() => { load(userId, false); }, [userId, load]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-brand-dark">Competitor Intelligence</h2>
          <p className="text-sm text-brand-muted mt-0.5">
            {data
              ? <>AI-curated strategy for a <span className="font-semibold text-brand-dark">{data.role}</span> in <span className="font-semibold text-brand-dark">{data.industry}</span>.</>
              : 'Personalized LinkedIn strategy for your exact role and industry.'}
          </p>
        </div>
        <button
          onClick={() => load(userId, true)}
          disabled={refreshing || loading}
          className="btn-secondary text-sm flex-shrink-0 disabled:opacity-50">
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-24 w-full" />)}</div>
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button onClick={() => load(userId, true)} className="btn-primary text-sm">Try again</button>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {data.insights.map((ins, i) => {
              const meta = INSIGHT_META[ins.type] || { icon: <Sparkles size={16} />, label: ins.type, color: 'from-brand-purple to-brand-pink' };
              return (
                <div key={i} className="card p-6">
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
          <div className="space-y-6">
            <div className="card p-6">
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
  );
}

// ── Profile Optimizer ────────────────────────────────────────────────────────

interface ProfileOptimizerResult {
  headlineScore?: number;
  aboutScore?: number;
  headlineStrengths?: string[];
  headlineIssues?: string[];
  aboutStrengths?: string[];
  aboutIssues?: string[];
  optimizedHeadline?: string;
  optimizedAbout?: string;
  quickWins?: string[];
  cached?: boolean;
  generatedAt?: string;
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? 'text-emerald-600 bg-emerald-50' : score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
  return (
    <div className={`inline-flex flex-col items-center px-4 py-2 rounded-xl ${color}`}>
      <span className="text-2xl font-extrabold leading-none">{score}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] text-brand-purple font-semibold hover:opacity-70 transition-opacity">
      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function ProfileOptimizerPanel({ userId }: { userId: string }) {
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [result, setResult] = useState<ProfileOptimizerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Try to load cached result + pre-fill bio from profile
    Promise.all([
      supabase.from('profiles').select('bio').eq('id', userId).maybeSingle(),
      apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'profile-optimizer', userId }),
      }).then(r => r.json()).catch(() => null),
    ]).then(([profileRes, cached]) => {
      if (profileRes.data?.bio) setAbout(profileRes.data.bio);
      if (cached && !cached.error) setResult(cached);
      setInitializing(false);
    });
  }, [userId]);

  const analyze = async () => {
    if (!headline.trim() && !about.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'profile-optimizer', userId, headline, about, refresh: true }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    }
    setLoading(false);
  };

  if (initializing) return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="skeleton h-20 w-full" />)}</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-brand-dark">Profile Optimizer</h2>
        <p className="text-sm text-brand-muted mt-0.5">Paste your current LinkedIn headline and About section — we'll score them and rewrite both.</p>
      </div>

      {/* Input form */}
      <div className="card p-6 mb-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1.5 block">LinkedIn Headline</label>
          <input
            type="text"
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            placeholder="e.g. CEO at Acme | Helping SaaS founders scale to $10M ARR"
            className="input w-full text-sm"
            maxLength={300}
          />
          <p className="text-[11px] text-brand-muted mt-1">{headline.length}/220 chars — LinkedIn shows ~220</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1.5 block">About Section</label>
          <textarea
            value={about}
            onChange={e => setAbout(e.target.value)}
            placeholder="Paste your LinkedIn About section here…"
            rows={6}
            className="input w-full text-sm resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={analyze}
          disabled={loading || (!headline.trim() && !about.trim())}
          className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Analyzing…' : 'Analyze & Optimize'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Scores */}
          {(result.headlineScore != null || result.aboutScore != null) && (
            <div className="card p-6">
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-4">Current Scores</p>
              <div className="flex gap-4 flex-wrap">
                {result.headlineScore != null && <ScoreBadge score={result.headlineScore} label="Headline" />}
                {result.aboutScore != null && <ScoreBadge score={result.aboutScore} label="About" />}
              </div>
            </div>
          )}

          {/* Quick wins */}
          {result.quickWins?.length ? (
            <div className="card p-6">
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-3">Quick Wins</p>
              <div className="space-y-2">
                {result.quickWins.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-brand-purple flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-brand-dark leading-snug">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Headline analysis + rewrite */}
          {(result.headlineIssues?.length || result.optimizedHeadline) && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center text-white flex-shrink-0">
                  <UserCog size={14} />
                </div>
                <p className="text-sm font-bold text-brand-dark">Headline</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-3">
                  {result.headlineStrengths?.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-brand-dark">{s}</p>
                    </div>
                  ))}
                  {result.headlineIssues?.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-brand-dark">{s}</p>
                    </div>
                  ))}
                </div>
                {result.optimizedHeadline && (
                  <div className="bg-[#f5f2ff] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-brand-purple uppercase tracking-wide">Optimized</p>
                      <CopyButton text={result.optimizedHeadline} />
                    </div>
                    <p className="text-[13px] text-brand-dark font-medium leading-snug">{result.optimizedHeadline}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* About analysis + rewrite */}
          {(result.aboutIssues?.length || result.optimizedAbout) && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center text-white flex-shrink-0">
                  <FileText size={14} />
                </div>
                <p className="text-sm font-bold text-brand-dark">About Section</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.aboutStrengths?.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-brand-dark">{s}</p>
                    </div>
                  ))}
                  {result.aboutIssues?.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-brand-dark">{s}</p>
                    </div>
                  ))}
                </div>
                {result.optimizedAbout && (
                  <div className="bg-[#f0fdf8] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-brand-teal uppercase tracking-wide">Optimized</p>
                      <CopyButton text={result.optimizedAbout} />
                    </div>
                    <p className="text-[13px] text-brand-dark leading-relaxed whitespace-pre-wrap">{result.optimizedAbout}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {result.cached && (
            <p className="text-[11px] text-brand-muted px-1">
              Cached result from {result.generatedAt ? new Date(result.generatedAt).toLocaleDateString() : 'earlier'}. Click Analyze to refresh.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page shell ───────────────────────────────────────────────────────────────

type Tab = 'competitor' | 'profile';

export default function Intelligence() {
  return (
    <FeatureLock feature="competitorIntelligence" description="AI-curated competitor insights and profile optimization are part of the Individual plan.">
      <IntelligenceInner />
    </FeatureLock>
  );
}

function IntelligenceInner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('competitor');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
      apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'page-view', feature: 'analytics', userId: data.user.id }),
      }).catch(() => {});
    });
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'competitor', label: 'Competitor Intel', icon: <TrendingUp size={15} /> },
    { id: 'profile',   label: 'Profile Optimizer', icon: <UserCog size={15} /> },
  ];

  return (
    <AppShell mobileTitle="Analytics">
      <div className="min-h-screen bg-[#FAFAFE]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-8">
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Intelligence</h1>
            <p className="text-sm text-brand-muted mt-1">AI-powered insights to grow your LinkedIn presence.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white border border-[rgba(124,92,252,0.1)] rounded-xl mb-6 w-fit">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-brand-purple text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-dark'
                }`}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {userId && (
            tab === 'competitor'
              ? <CompetitorPanel userId={userId} />
              : <FeatureLock feature="profileOptimizer" description="Profile Optimizer is part of the Individual plan.">
                  <ProfileOptimizerPanel userId={userId} />
                </FeatureLock>
          )}
        </div>
      </div>
    </AppShell>
  );
}
