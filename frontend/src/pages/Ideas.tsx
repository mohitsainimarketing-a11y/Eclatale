import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Search, RefreshCw, Loader2, Lightbulb, Repeat2, ExternalLink, Calendar, ArrowUpDown,
  TrendingUp, Clock, FileText, Target, Sparkles, ArrowRight, UserCog,
  CheckCircle2, AlertCircle, Copy, Check, Plus, Trash2, X,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import FeatureLock from '../components/FeatureLock';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function getPlatform(domain: string): { name: string; textColor: string; bg: string } {
  const d = domain.toLowerCase();
  if (d.includes('medium.com'))    return { name: 'Medium',     textColor: '#000000', bg: '#e0e0e0' };
  if (d.includes('substack.com'))  return { name: 'Substack',   textColor: '#ffffff', bg: '#FF6719' };
  if (d.includes('forbes.com'))    return { name: 'Forbes',     textColor: '#ffffff', bg: '#1a1a1a' };
  if (d.includes('hbr.org'))       return { name: 'HBR',        textColor: '#ffffff', bg: '#A51C30' };
  if (d.includes('techcrunch'))    return { name: 'TechCrunch', textColor: '#ffffff', bg: '#0A9E3A' };
  if (d.includes('wired.com'))     return { name: 'Wired',      textColor: '#ffffff', bg: '#1a1a1a' };
  if (d.includes('bloomberg'))     return { name: 'Bloomberg',  textColor: '#ffffff', bg: '#1f1f1f' };
  if (d.includes('linkedin.com'))  return { name: 'LinkedIn',   textColor: '#ffffff', bg: '#0A66C2' };
  if (d.includes('nytimes.com'))   return { name: 'NYT',        textColor: '#ffffff', bg: '#1a1a1a' };
  if (d.includes('wsj.com'))       return { name: 'WSJ',        textColor: '#ffffff', bg: '#004276' };
  if (d.includes('economist.com')) return { name: 'Economist',  textColor: '#ffffff', bg: '#E3120B' };
  if (d.includes('ft.com'))        return { name: 'FT',         textColor: '#1a1a1a', bg: '#FCC700' };
  if (d.includes('axios.com'))     return { name: 'Axios',      textColor: '#ffffff', bg: '#EE2535' };
  if (d.includes('mckinsey.com'))  return { name: 'McKinsey',   textColor: '#ffffff', bg: '#002856' };
  if (d.includes('reuters.com'))   return { name: 'Reuters',    textColor: '#ffffff', bg: '#FF6300' };
  if (d.includes('harvard'))       return { name: 'Harvard',    textColor: '#ffffff', bg: '#A51C30' };
  const base = d.split('.')[0];
  return { name: base.charAt(0).toUpperCase() + base.slice(1), textColor: '#7C5CFC', bg: 'rgba(124,92,252,0.1)' };
}

function formatDate(d: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CATEGORY_COLORS: Record<string, string> = {
  'Industry News': 'bg-blue-50 text-blue-700',
  'Trends':        'bg-violet-50 text-violet-700',
  'Leadership':    'bg-amber-50 text-amber-700',
  'Technology':    'bg-teal-50 text-teal-700',
  'Research':      'bg-green-50 text-green-700',
  'Opinion':       'bg-rose-50 text-rose-700',
  'Marketing':     'bg-pink-50 text-pink-700',
  'Career':        'bg-orange-50 text-orange-700',
  'Innovation':    'bg-purple-50 text-purple-700',
};
const categoryColor = (cat: string) => CATEGORY_COLORS[cat] || 'bg-gray-50 text-gray-600';

// ─────────────────────────────────────────────────────────────────────────────
// TRENDS TAB (formerly /discover)
// ─────────────────────────────────────────────────────────────────────────────

interface DiscoveredItem {
  title: string; url: string; domain: string; excerpt: string;
  publishedDate: string | null; trustScore: number; category: string;
}
interface DiscoveryResult {
  items: DiscoveredItem[]; role: string; industry: string;
  query: string | null; generatedAt: string; cached?: boolean;
}

function RepurposeDrawer({ item, onClose }: { item: DiscoveredItem; onClose: () => void }) {
  const go = (style?: string) => {
    try {
      sessionStorage.setItem('eclatale_repurpose', JSON.stringify({
        topic: item.title,
        url: item.url,
        style: style || 'storyteller',
      }));
    } catch {}
    window.location.href = '/create';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #F72585, #ff8f5e)' }}>
            <Repeat2 size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: '#F72585' }}>Repurpose</p>
            <p className="text-sm font-bold text-brand-dark leading-snug line-clamp-2">{item.title}</p>
            <p className="text-[11px] text-brand-muted mt-0.5">{item.domain}</p>
          </div>
        </div>
        <p className="text-[13px] text-brand-muted mb-4 leading-relaxed">
          Choose a style. We will fetch the article, pull the key ideas, and write a LinkedIn post in your voice.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { id: 'storyteller', emoji: '📖', label: 'Storyteller' },
            { id: 'contrarian',  emoji: '🔥', label: 'Contrarian' },
            { id: 'teacher',     emoji: '🎓', label: 'Teacher' },
            { id: 'analyst',     emoji: '📊', label: 'Analyst' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className="flex items-center gap-2 p-3 rounded-xl border border-[rgba(124,92,252,0.1)] hover:border-brand-purple/30 hover:bg-[rgba(124,92,252,0.03)] transition-all text-left"
            >
              <span className="text-base">{s.emoji}</span>
              <span className="text-[13px] font-semibold text-brand-dark">{s.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full text-[12px] text-brand-muted hover:text-brand-dark py-1 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ArticleCard({ item, onRepurpose }: { item: DiscoveredItem; onRepurpose: (item: DiscoveredItem) => void }) {
  const platform = getPlatform(item.domain);
  const dateStr = formatDate(item.publishedDate);

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-brand transition-shadow h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ color: platform.textColor, backgroundColor: platform.bg }}>
          {platform.name}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColor(item.category)}`}>
          {item.category}
        </span>
      </div>
      <h3 className="text-[14px] font-bold text-brand-dark leading-snug line-clamp-3 flex-1">{item.title}</h3>
      {item.excerpt && <p className="text-[12px] text-brand-muted leading-relaxed line-clamp-2">{item.excerpt}</p>}
      <div className="flex items-center gap-2 text-[11px] text-brand-muted">
        {dateStr && <span className="flex items-center gap-1"><Calendar size={10} />{dateStr}</span>}
        <span className="flex-1" />
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-brand-purple transition-colors" onClick={e => e.stopPropagation()}>
          {item.domain} <ExternalLink size={10} />
        </a>
      </div>
      <div className="flex gap-2 pt-1 border-t border-[rgba(124,92,252,0.06)]">
        <a
          href="/create"
          className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-brand-purple bg-[rgba(124,92,252,0.06)] hover:bg-[rgba(124,92,252,0.12)] rounded-lg py-2 transition-colors"
        >
          <Lightbulb size={13} />
          Content Idea
        </a>
        <button
          onClick={() => onRepurpose(item)}
          className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold bg-[rgba(247,37,133,0.06)] hover:bg-[rgba(247,37,133,0.12)] rounded-lg py-2 transition-colors"
          style={{ color: '#F72585' }}
        >
          <Repeat2 size={13} />
          Repurpose
        </button>
      </div>
    </div>
  );
}

function TrendsTab({ userId }: { userId: string }) {
  const [data, setData] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [repurposeItem, setRepurposeItem] = useState<DiscoveredItem | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [loadingSlow, setLoadingSlow] = useState(false);

  const load = useCallback(async (uid: string, query: string, refresh: boolean) => {
    setLoading(true);
    setLoadingSlow(false);
    setError('');
    const slowTimer = setTimeout(() => setLoadingSlow(true), 8000);
    const controller = new AbortController();
    const hardTimeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'content-discovery', userId: uid, query: query || undefined, refresh }),
        signal: controller.signal,
      } as any);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setActiveCategory('All');
    } catch (e: any) {
      if (e.name === 'AbortError') setError('Search timed out. Please try again.');
      else setError(e.message || 'Failed to load content');
    }
    clearTimeout(slowTimer);
    clearTimeout(hardTimeout);
    setLoadingSlow(false);
    setLoading(false);
  }, []);

  useEffect(() => { load(userId, '', false); }, [userId, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setActiveQuery(searchInput.trim());
    load(userId, searchInput.trim(), true);
  };

  const allCategories = data ? ['All', ...Array.from(new Set(data.items.map(i => i.category)))] : ['All'];
  const toTs = (d: string | null) => d ? new Date(d).getTime() : 0;
  const visibleItems = data
    ? (activeCategory === 'All' ? [...data.items] : data.items.filter(i => i.category === activeCategory))
        .sort((a, b) => sortOrder === 'newest' ? toTs(b.publishedDate) - toTs(a.publishedDate) : toTs(a.publishedDate) - toTs(b.publishedDate))
    : [];

  return (
    <>
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-5 max-w-2xl">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search any topic: AI, leadership, SaaS..."
            className="input w-full pl-9 text-sm"
          />
        </div>
        <button type="submit" disabled={loading || !searchInput.trim()} className="btn-primary text-sm disabled:opacity-50 px-4">
          Search
        </button>
        <button type="button" onClick={() => load(userId, activeQuery, true)} disabled={loading} className="btn-secondary text-sm disabled:opacity-50 px-3" title="Refresh">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </form>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {/* Category filters + sort */}
          {!loading && data && (
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <div className="flex gap-2 flex-wrap flex-1">
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all border ${
                      activeCategory === cat
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-white text-brand-muted border-[rgba(124,92,252,0.15)] hover:border-brand-purple/30 hover:text-brand-dark'
                    }`}
                  >
                    {cat}
                    {cat !== 'All' && <span className="ml-1.5 opacity-60">{data.items.filter(i => i.category === cat).length}</span>}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border border-[rgba(124,92,252,0.15)] bg-white text-brand-muted hover:border-brand-purple/30 hover:text-brand-dark transition-all flex-shrink-0"
              >
                <ArrowUpDown size={12} />
                {sortOrder === 'newest' ? 'Latest first' : 'Oldest first'}
              </button>
            </div>
          )}

          {loading ? (
            <div>
              {loadingSlow && (
                <p className="text-center text-[13px] text-brand-muted mb-4 animate-pulse">
                  Searching the web for the latest articles. Usually takes 20 to 30 seconds...
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton h-56 w-full rounded-2xl" />)}
              </div>
            </div>
          ) : error ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <button onClick={() => load(userId, activeQuery, true)} className="btn-primary text-sm">Try again</button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-brand-muted text-sm">No results found. Try a different search or refresh.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleItems.map((item, i) => <ArticleCard key={i} item={item} onRepurpose={setRepurposeItem} />)}
            </div>
          )}

          {!loading && data && (
            <p className="text-[11px] text-brand-muted mt-6 text-center">
              {data.cached ? 'Cached results' : 'Live results'} · {data.items.length} articles
              {data.generatedAt ? ` · ${formatDate(data.generatedAt) || new Date(data.generatedAt).toLocaleTimeString()}` : ''}
              <span className="mx-2">·</span>
              <button onClick={() => load(userId, activeQuery, true)} className="underline hover:no-underline">Refresh</button>
            </p>
          )}
        </div>

        {/* Right context panel (desktop only) */}
        <div className="hidden lg:flex flex-col gap-4 flex-shrink-0" style={{ width: 240 }}>
          {data && (
            <div className="card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: '#9CA3AF' }}>Your focus</p>
              <p className="text-[13px] font-bold text-brand-dark">{data.role}</p>
              <p className="text-[11px] text-brand-muted mb-3">{data.industry}</p>
              <a href="/brand-brain" className="text-[11px] font-semibold text-brand-purple hover:underline">
                Edit voice profile
              </a>
            </div>
          )}
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: '#9CA3AF' }}>Write about this</p>
            <p className="text-[12px] text-brand-muted mb-3 leading-relaxed">
              Found something interesting? Click Content Idea on any article to start a post in your voice.
            </p>
            <a href="/create" className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
              Start from scratch
            </a>
          </div>
          {data && (
            <div className="card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Content found</p>
              <p className="text-[22px] font-extrabold text-brand-dark mb-0.5">{data.items.length}</p>
              <p className="text-[11px] text-brand-muted">{data.cached ? 'Cached' : 'Live'} · {allCategories.length - 1} categories</p>
            </div>
          )}
        </div>
      </div>

      {repurposeItem && <RepurposeDrawer item={repurposeItem} onClose={() => setRepurposeItem(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY INTEL TAB (formerly /intelligence)
// ─────────────────────────────────────────────────────────────────────────────

interface Insight { type: string; title: string; detail: string; }
interface IntelData {
  insights: Insight[]; trendingTopics: string[];
  role: string; industry: string; basedOn: string; generatedAt?: string;
}

const INSIGHT_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  timing:            { icon: <Clock size={16} />,      label: 'Best Timing',      color: 'from-brand-purple to-[#9B7DFC]' },
  content_type:      { icon: <FileText size={16} />,   label: 'Content Format',    color: 'from-brand-pink to-[#FF5CAD]' },
  topic_gap:         { icon: <Search size={16} />,     label: 'Topic Gap',         color: 'from-brand-orange to-[#FF8F5E]' },
  trending_topic:    { icon: <TrendingUp size={16} />, label: 'Trending Now',      color: 'from-brand-teal to-brand-blue' },
  competitive_angle: { icon: <Target size={16} />,     label: 'Competitive Angle', color: 'from-brand-purple to-brand-pink' },
};

interface ProfileOptimizerResult {
  headlineScore?: number; aboutScore?: number;
  headlineStrengths?: string[]; headlineIssues?: string[];
  aboutStrengths?: string[]; aboutIssues?: string[];
  optimizedHeadline?: string; optimizedAbout?: string;
  quickWins?: string[]; cached?: boolean; generatedAt?: string;
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
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      className="inline-flex items-center gap-1 text-[11px] text-brand-purple font-semibold hover:opacity-70 transition-opacity"
    >
      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

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
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
        <button onClick={() => load(userId, true)} disabled={refreshing || loading} className="btn-secondary text-sm flex-shrink-0 disabled:opacity-50">
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
                      <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-widest">{meta.label}</span>
                      <h3 className="text-sm font-bold text-brand-dark mb-1 mt-1">{ins.title}</h3>
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
              <p className="text-[10px] text-brand-muted font-medium mb-4">AI-curated for your industry</p>
              <div className="space-y-2">
                {data.trendingTopics.map((topic, i) => (
                  <a key={i} href={`/create`}
                    className="block p-3 rounded-xl border border-[rgba(124,92,252,0.06)] hover:border-brand-purple/20 hover:shadow-brand transition-all group bg-white">
                    <p className="text-[13px] text-brand-dark leading-snug mb-2 font-medium">{topic}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand-purple font-semibold opacity-70 group-hover:opacity-100 transition-opacity">
                      Write about this <ArrowRight size={11} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-brand-muted px-1 leading-relaxed">{data.basedOn}. AI-generated strategic analysis, not live scraped competitor data.</p>
          </div>
        </div>
      ) : null}
    </div>
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
    Promise.all([
      supabase.from('profiles').select('bio').eq('id', userId).maybeSingle(),
      apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'profile-optimizer', userId }),
      }).then(r => r.json()).catch(() => null),
    ]).then(([profileRes, cached]) => {
      if (profileRes.data?.bio) setAbout(profileRes.data.bio);
      if (cached && !cached.error) setResult(cached);
      setInitializing(false);
    }).catch(() => setInitializing(false));
  }, [userId]);

  const analyze = async () => {
    if (!headline.trim() && !about.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'profile-optimizer', userId, headline: headline.trim(), about: about.trim(), refresh: true }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.message || json.error);
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-brand-dark mb-1">Profile Optimizer</h2>
      <p className="text-sm text-brand-muted mb-6">Get an AI score and optimized copy for your LinkedIn headline and About section.</p>

      {initializing ? (
        <div className="skeleton h-32 w-full rounded-2xl" />
      ) : (
        <div className="card p-6 mb-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">LinkedIn Headline</label>
            <input
              type="text"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="e.g. Head of Growth at Acme · Helping B2B SaaS teams scale"
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">About section</label>
            <textarea
              value={about}
              onChange={e => setAbout(e.target.value)}
              placeholder="Paste your LinkedIn About section here..."
              rows={5}
              className="input w-full text-sm resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={analyze} disabled={loading || (!headline.trim() && !about.trim())} className="btn-primary text-sm disabled:opacity-50">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : 'Analyze profile'}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {(result.headlineScore != null || result.aboutScore != null) && (
            <div className="card p-6">
              <h3 className="text-sm font-bold text-brand-dark mb-4">Your scores</h3>
              <div className="flex gap-4 flex-wrap">
                {result.headlineScore != null && <ScoreBadge score={result.headlineScore} label="Headline" />}
                {result.aboutScore != null && <ScoreBadge score={result.aboutScore} label="About" />}
              </div>
            </div>
          )}

          {result.quickWins && result.quickWins.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-bold text-brand-dark mb-3">Quick wins</h3>
              <div className="space-y-2">
                {result.quickWins.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-brand-teal flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-brand-dark">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.optimizedHeadline && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-brand-dark">Optimized headline</h3>
                <CopyButton text={result.optimizedHeadline} />
              </div>
              {result.headlineStrengths && result.headlineStrengths.length > 0 && (
                <div className="mb-2 space-y-1">
                  {result.headlineStrengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-brand-dark">{s}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.headlineIssues && result.headlineIssues.length > 0 && (
                <div className="mb-3 space-y-1">
                  {result.headlineIssues.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-brand-dark">{s}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-[#f0fdf8] rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-2">Optimized</p>
                <p className="text-[13px] text-brand-dark font-medium">{result.optimizedHeadline}</p>
              </div>
            </div>
          )}

          {result.optimizedAbout && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-brand-dark">Optimized About</h3>
                <CopyButton text={result.optimizedAbout} />
              </div>
              {result.aboutIssues && result.aboutIssues.length > 0 && (
                <div className="mb-3 space-y-1">
                  {result.aboutIssues.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-brand-dark">{s}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-[#f0fdf8] rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-2">Optimized</p>
                <p className="text-[13px] text-brand-dark leading-relaxed whitespace-pre-wrap">{result.optimizedAbout}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type IntelSubTab = 'competitor' | 'profile';

function IntelTab({ userId }: { userId: string }) {
  const [subTab, setSubTab] = useState<IntelSubTab>('competitor');

  return (
    <FeatureLock feature="competitorIntelligence" description="AI-curated competitor data and profile optimization are part of the Individual plan.">
      <div>
        <div className="flex gap-1 p-1 bg-white border border-[rgba(124,92,252,0.1)] rounded-xl mb-6 w-fit">
          {([
            { id: 'competitor', label: 'Competitor Intel', icon: <TrendingUp size={14} /> },
            { id: 'profile',   label: 'Profile Optimizer', icon: <UserCog size={14} /> },
          ] as { id: IntelSubTab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
                subTab === t.id ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-muted hover:text-brand-dark'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        {subTab === 'competitor' ? <CompetitorPanel userId={userId} /> : <ProfileOptimizerPanel userId={userId} />}
      </div>
    </FeatureLock>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MY IDEAS TAB (new)
// ─────────────────────────────────────────────────────────────────────────────

interface SavedIdea {
  id: string;
  text: string;
  url?: string;
  createdAt: string;
}

const IDEAS_STORAGE_KEY = 'eclatale_saved_ideas';

function loadSavedIdeas(): SavedIdea[] {
  try {
    const raw = localStorage.getItem(IDEAS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSavedIdeas(ideas: SavedIdea[]) {
  try { localStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas)); } catch {}
}

function MyIdeasTab({ userId: _userId }: { userId: string }) {
  const [ideas, setIdeas] = useState<SavedIdea[]>(() => loadSavedIdeas());
  const [input, setInput] = useState('');

  const addIdea = () => {
    const text = input.trim();
    if (!text) return;
    const isUrl = /^https?:\/\/\S+/.test(text);
    const newIdea: SavedIdea = {
      id: Date.now().toString(),
      text: isUrl ? '' : text,
      url: isUrl ? text : undefined,
      createdAt: new Date().toISOString(),
    };
    const updated = [newIdea, ...ideas];
    setIdeas(updated);
    saveSavedIdeas(updated);
    setInput('');
  };

  const deleteIdea = (id: string) => {
    const updated = ideas.filter(i => i.id !== id);
    setIdeas(updated);
    saveSavedIdeas(updated);
  };

  const createFromIdea = (idea: SavedIdea) => {
    try {
      sessionStorage.setItem('eclatale_repurpose', JSON.stringify({
        topic: idea.text || idea.url || '',
        url: idea.url || '',
        style: 'storyteller',
      }));
    } catch {}
    window.location.href = '/create';
  };

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-brand-muted mb-5">
        Capture article URLs, topic sparks, or anything worth posting about. Saved ideas are stored locally on this device.
      </p>

      {/* Input */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addIdea(); }}
          placeholder="Paste a URL or type a topic idea..."
          className="input flex-1 text-sm"
        />
        <button onClick={addIdea} disabled={!input.trim()} className="btn-primary text-sm disabled:opacity-50 px-4 flex items-center gap-1.5">
          <Plus size={14} /> Save
        </button>
      </div>

      {/* Ideas list */}
      {ideas.length === 0 ? (
        <div className="card p-12 text-center">
          <Lightbulb size={32} className="mx-auto mb-3 opacity-30" style={{ color: '#7C5CFC' }} />
          <p className="text-brand-muted text-sm">No saved ideas yet.</p>
          <p className="text-[12px] text-brand-muted mt-1">Paste a URL or type a topic above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map(idea => (
            <div key={idea.id} className="card p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(124,92,252,0.10)' }}>
                {idea.url ? <ExternalLink size={14} style={{ color: '#7C5CFC' }} /> : <Lightbulb size={14} style={{ color: '#7C5CFC' }} />}
              </div>
              <div className="flex-1 min-w-0">
                {idea.text && <p className="text-[13px] font-semibold text-brand-dark mb-0.5">{idea.text}</p>}
                {idea.url && (
                  <a href={idea.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-brand-purple hover:underline truncate block">
                    {idea.url}
                  </a>
                )}
                <p className="text-[10px] text-brand-muted mt-1">{formatDate(idea.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => createFromIdea(idea)}
                  className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(124,92,252,0.10)', color: '#7C5CFC' }}
                >
                  <Sparkles size={11} /> Create
                </button>
                <button onClick={() => deleteIdea(idea.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-brand-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SHELL
// ─────────────────────────────────────────────────────────────────────────────

type IdeasTab = 'trends' | 'intel' | 'ideas';

export default function Ideas() {
  const [tab, setTab] = useState<IdeasTab>(() => {
    if (typeof window === 'undefined') return 'trends';
    const p = new URLSearchParams(window.location.search).get('tab');
    return (p === 'intel' || p === 'ideas') ? p : 'trends';
  });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
    });
  }, []);

  const TABS: { id: IdeasTab; label: string }[] = [
    { id: 'trends', label: 'Trends' },
    { id: 'intel',  label: 'Industry Intel' },
    { id: 'ideas',  label: 'My Ideas' },
  ];

  return (
    <AppShell mobileTitle="Ideas">
      <div className="min-h-screen bg-[#FAFAFE]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8">
          <div className="mb-5">
            <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Ideas</h1>
            <p className="text-sm text-brand-muted mt-0.5">Discover, save, and create posts from ideas in your world.</p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-white border border-[rgba(124,92,252,0.1)] rounded-xl mb-6 w-fit">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
                  tab === t.id ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-muted hover:text-brand-dark'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!userId ? (
            <div className="skeleton h-64 w-full rounded-2xl" />
          ) : (
            <>
              {tab === 'trends' && <TrendsTab userId={userId} />}
              {tab === 'intel'  && <IntelTab  userId={userId} />}
              {tab === 'ideas'  && <MyIdeasTab userId={userId} />}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
