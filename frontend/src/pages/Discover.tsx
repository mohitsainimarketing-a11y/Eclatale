import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Search, RefreshCw, Loader2, Lightbulb, Repeat2,
  ExternalLink, Calendar, ArrowUpDown,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface DiscoveredItem {
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  publishedDate: string | null;
  trustScore: number;
  category: string;
}

interface DiscoveryResult {
  items: DiscoveredItem[];
  role: string;
  industry: string;
  query: string | null;
  generatedAt: string;
  cached?: boolean;
}

// ── Platform badge ───────────────────────────────────────────────────────────

function getPlatform(domain: string): { name: string; textColor: string; bg: string } {
  const d = domain.toLowerCase();
  if (d.includes('medium.com'))     return { name: 'Medium',        textColor: '#000000', bg: '#e0e0e0' };
  if (d.includes('substack.com'))   return { name: 'Substack',      textColor: '#ffffff', bg: '#FF6719' };
  if (d.includes('forbes.com'))     return { name: 'Forbes',        textColor: '#ffffff', bg: '#1a1a1a' };
  if (d.includes('hbr.org'))        return { name: 'HBR',           textColor: '#ffffff', bg: '#A51C30' };
  if (d.includes('techcrunch'))     return { name: 'TechCrunch',    textColor: '#ffffff', bg: '#0A9E3A' };
  if (d.includes('wired.com'))      return { name: 'Wired',         textColor: '#ffffff', bg: '#1a1a1a' };
  if (d.includes('bloomberg'))      return { name: 'Bloomberg',     textColor: '#ffffff', bg: '#1f1f1f' };
  if (d.includes('linkedin.com'))   return { name: 'LinkedIn',      textColor: '#ffffff', bg: '#0A66C2' };
  if (d.includes('nytimes.com'))    return { name: 'NYT',           textColor: '#ffffff', bg: '#1a1a1a' };
  if (d.includes('wsj.com'))        return { name: 'WSJ',           textColor: '#ffffff', bg: '#004276' };
  if (d.includes('economist.com'))  return { name: 'Economist',     textColor: '#ffffff', bg: '#E3120B' };
  if (d.includes('ft.com'))         return { name: 'FT',            textColor: '#1a1a1a', bg: '#FCC700' };
  if (d.includes('axios.com'))      return { name: 'Axios',         textColor: '#ffffff', bg: '#EE2535' };
  if (d.includes('theverge.com'))   return { name: 'The Verge',     textColor: '#ffffff', bg: '#FA4D3A' };
  if (d.includes('mckinsey.com'))   return { name: 'McKinsey',      textColor: '#ffffff', bg: '#002856' };
  if (d.includes('bcg.com'))        return { name: 'BCG',           textColor: '#ffffff', bg: '#00AA00' };
  if (d.includes('reuters.com'))    return { name: 'Reuters',       textColor: '#ffffff', bg: '#FF6300' };
  if (d.includes('inc.com'))        return { name: 'Inc.',          textColor: '#ffffff', bg: '#E8002D' };
  if (d.includes('harvard'))        return { name: 'Harvard',       textColor: '#ffffff', bg: '#A51C30' };
  if (d.includes('.edu'))           return { name: 'Academic',      textColor: '#ffffff', bg: '#2563EB' };
  if (d.includes('dev.to'))         return { name: 'DEV',           textColor: '#ffffff', bg: '#3D3D3D' };
  if (d.includes('hashnode'))       return { name: 'Hashnode',      textColor: '#ffffff', bg: '#2563EB' };
  const base = d.split('.')[0];
  return {
    name: base.charAt(0).toUpperCase() + base.slice(1),
    textColor: '#7C5CFC',
    bg: 'rgba(124,92,252,0.1)',
  };
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
function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'bg-gray-50 text-gray-600';
}

// ── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ item, onRepurpose }: { item: DiscoveredItem; onRepurpose: (item: DiscoveredItem) => void }) {
  const platform = getPlatform(item.domain);
  const dateStr = formatDate(item.publishedDate);
  const ideaUrl = `/create/talk?topic=${encodeURIComponent(item.title)}`;

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-brand transition-shadow h-full">
      {/* Top row: platform + category */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-md"
          style={{ color: platform.textColor, backgroundColor: platform.bg }}>
          {platform.name}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColor(item.category)}`}>
          {item.category}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-bold text-brand-dark leading-snug line-clamp-3 flex-1">
        {item.title}
      </h3>

      {/* Excerpt */}
      {item.excerpt && (
        <p className="text-[12px] text-brand-muted leading-relaxed line-clamp-2">{item.excerpt}</p>
      )}

      {/* Meta: date + source link */}
      <div className="flex items-center gap-2 text-[11px] text-brand-muted">
        {dateStr && (
          <span className="flex items-center gap-1">
            <Calendar size={10} />{dateStr}
          </span>
        )}
        <span className="flex-1" />
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 hover:text-brand-purple transition-colors"
          onClick={e => e.stopPropagation()}>
          {item.domain} <ExternalLink size={10} />
        </a>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1 border-t border-[rgba(124,92,252,0.06)]">
        <a
          href={ideaUrl}
          className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-brand-purple bg-[rgba(124,92,252,0.06)] hover:bg-[rgba(124,92,252,0.12)] rounded-lg py-2 transition-colors">
          <Lightbulb size={13} />
          Content Idea
        </a>
        <button
          onClick={() => onRepurpose(item)}
          className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-brand-pink bg-[rgba(247,37,133,0.06)] hover:bg-[rgba(247,37,133,0.12)] rounded-lg py-2 transition-colors">
          <Repeat2 size={13} />
          Repurpose
        </button>
      </div>
    </div>
  );
}

// ── Repurpose drawer ─────────────────────────────────────────────────────────

function RepurposeDrawer({ item, onClose }: { item: DiscoveredItem; onClose: () => void }) {
  const [fetchingContent, setFetchingContent] = useState(false);
  const [contentFetched, setContentFetched] = useState(false);

  const go = (style?: string) => {
    const params = new URLSearchParams({
      topic: item.title,
      repurposeUrl: item.url,
    });
    if (style) params.set('style', style);
    window.location.href = `/create/talk?${params.toString()}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center text-white flex-shrink-0">
            <Repeat2 size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-brand-pink uppercase tracking-wide mb-0.5">Repurpose</p>
            <p className="text-sm font-bold text-brand-dark leading-snug line-clamp-2">{item.title}</p>
            <p className="text-[11px] text-brand-muted mt-0.5">{item.domain}</p>
          </div>
        </div>

        <p className="text-[13px] text-brand-muted mb-4 leading-relaxed">
          Choose a style and we'll fetch the article, extract its key insights, and write a LinkedIn post in your voice.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { id: 'storyteller', emoji: '📖', label: 'Storyteller' },
            { id: 'contrarian', emoji: '🔥', label: 'Contrarian' },
            { id: 'teacher', emoji: '🎓', label: 'Teacher' },
            { id: 'analyst', emoji: '📊', label: 'Analyst' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className="flex items-center gap-2 p-3 rounded-xl border border-[rgba(124,92,252,0.1)] hover:border-brand-purple/30 hover:bg-[rgba(124,92,252,0.03)] transition-all text-left">
              <span className="text-base">{s.emoji}</span>
              <span className="text-[13px] font-semibold text-brand-dark">{s.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full text-[12px] text-brand-muted hover:text-brand-dark py-1 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Discover() {
  const [userId, setUserId] = useState<string | null>(null);
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
      if (e.name === 'AbortError') {
        setError('Search timed out — please try again.');
      } else {
        setError(e.message || 'Failed to load content');
      }
    }
    clearTimeout(slowTimer);
    clearTimeout(hardTimeout);
    setLoadingSlow(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (!authData.user) { window.location.href = '/login'; return; }
      setUserId(authData.user.id);
      load(authData.user.id, '', false);
    });
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !searchInput.trim()) return;
    setActiveQuery(searchInput.trim());
    load(userId, searchInput.trim(), true);
  };

  const handleRefresh = () => {
    if (!userId) return;
    load(userId, activeQuery, true);
  };

  // Categories
  const allCategories = data
    ? ['All', ...Array.from(new Set(data.items.map(i => i.category)))]
    : ['All'];

  const toTs = (d: string | null) => d ? new Date(d).getTime() : 0;
  const visibleItems = data
    ? (activeCategory === 'All' ? [...data.items] : data.items.filter(i => i.category === activeCategory))
        .sort((a, b) => sortOrder === 'newest' ? toTs(b.publishedDate) - toTs(a.publishedDate) : toTs(a.publishedDate) - toTs(b.publishedDate))
    : [];

  return (
    <AppShell mobileTitle="Discover">
      <div className="min-h-screen bg-[#FAFAFE]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Content Discovery</h1>
            <p className="text-sm text-brand-muted mt-1">
              {data && !activeQuery
                ? <>Live content for <span className="font-semibold text-brand-dark">{data.role}s in {data.industry}</span> — click any article to write about it or repurpose it.</>
                : activeQuery
                ? <>Showing results for "<span className="font-semibold text-brand-dark">{activeQuery}</span>"</>
                : 'Discovering content from across the web…'}
            </p>
          </div>

          {/* Search + refresh */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search any topic — AI, leadership, marketing, SaaS…"
                className="input w-full pl-9 text-sm"
              />
            </div>
            <button type="submit" disabled={loading || !searchInput.trim()} className="btn-primary text-sm disabled:opacity-50 px-4">
              Search
            </button>
            <button type="button" onClick={handleRefresh} disabled={loading} className="btn-secondary text-sm disabled:opacity-50 px-3" title="Refresh">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          </form>

          {/* Category filters + sort */}
          {!loading && data && (
            <div className="flex items-center gap-2 flex-wrap mb-6">
              <div className="flex gap-2 flex-wrap flex-1">
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all border ${
                      activeCategory === cat
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-white text-brand-muted border-[rgba(124,92,252,0.15)] hover:border-brand-purple/30 hover:text-brand-dark'
                    }`}>
                    {cat}
                    {cat !== 'All' && (
                      <span className="ml-1.5 opacity-60">
                        {data.items.filter(i => i.category === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border border-[rgba(124,92,252,0.15)] bg-white text-brand-muted hover:border-brand-purple/30 hover:text-brand-dark transition-all flex-shrink-0">
                <ArrowUpDown size={12} />
                {sortOrder === 'newest' ? 'Latest first' : 'Oldest first'}
              </button>
            </div>
          )}

          {/* States */}
          {loading ? (
            <div>
              {loadingSlow && (
                <p className="text-center text-[13px] text-brand-muted mb-4 animate-pulse">
                  Searching the web for the latest articles — usually takes 20–30 seconds…
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="skeleton h-56 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <button onClick={handleRefresh} className="btn-primary text-sm">Try again</button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-brand-muted text-sm">No results found. Try a different search or refresh.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleItems.map((item, i) => (
                <ArticleCard key={i} item={item} onRepurpose={setRepurposeItem} />
              ))}
            </div>
          )}

          {/* Footer note */}
          {!loading && data && (
            <p className="text-[11px] text-brand-muted mt-6 text-center">
              {data.cached ? 'Cached results' : 'Live results'} · {data.items.length} articles found
              {data.generatedAt ? ` · ${formatDate(data.generatedAt) || new Date(data.generatedAt).toLocaleTimeString()}` : ''}
              <span className="mx-2">·</span>
              <button onClick={handleRefresh} className="underline hover:no-underline">Refresh</button>
            </p>
          )}
        </div>
      </div>

      {repurposeItem && (
        <RepurposeDrawer item={repurposeItem} onClose={() => setRepurposeItem(null)} />
      )}
    </AppShell>
  );
}
