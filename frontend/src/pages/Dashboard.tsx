import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Bar, Line, LineChart,
} from 'recharts';
import {
  Sparkles, LogOut, RefreshCw, Download, ChevronRight, Check, ChevronDown,
  Copy, Trash2, Edit3, ArrowUpRight, ArrowDownRight, Flame,
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import NotificationBell from '../components/NotificationBell';
import { maybePromptPush } from '../lib/pushNotifications';
import AppShell from '../components/AppShell';
import WeeklyBriefingCard from '../components/WeeklyBriefingCard';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

let createPagePrefetched = false;
function prefetchCreatePage() {
  if (createPagePrefetched) return;
  createPagePrefetched = true;
  import('./CreatePost').catch(() => { createPagePrefetched = false; });
}

type Stage = 'unknown' | 'emerging' | 'rising' | 'notable' | 'authority' | 'icon';
const STAGE_ORDER: Stage[] = ['unknown', 'emerging', 'rising', 'notable', 'authority', 'icon'];
const STAGE_LABELS: Record<Stage, string> = { unknown: 'Unknown', emerging: 'Emerging', rising: 'Rising', notable: 'Notable', authority: 'Authority', icon: 'Icon' };
const STAGE_EMOJI: Record<Stage, string> = { unknown: '🌱', emerging: '🔥', rising: '⚡', notable: '🎯', authority: '👑', icon: '🏆' };

const DATE_RANGES = [
  { key: '1', label: 'Today' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '3650', label: 'All time' },
];

interface Overview {
  brandHealth: { score: number; consistency: number; quality: number; voice: number; trend: number };
  postingActivity: { points: { date: string; posts: number; published: number }[]; bestDay: string | null; avgPerWeek: number };
  contentPerformance: { weekStart: string; posts: number; avgScore: number }[];
  styleDistribution: { distribution: { tone: string; count: number; pct: number; avgScore: number }[]; strongest: any; totalAnalyzed: number };
  activityFeed: { type: string; description: string; timestamp: string; url?: string }[];
  growthScoreHistory: { weekStart: string; score: number }[];
  subscriptionTier: string;
  postsThisWeek: number;
  longestStreak: number;
  totalPostsPublished: number;
  currentStreak: number;
  bestWeek: number;
  stage: Stage;
  linkedinConnected: boolean;
  voiceMatch: number | null;
  updatedAt: string;
}

interface JourneyData {
  stage: Stage; nextStage: Stage | null;
  criteria: { label: string; done: boolean; current: number; target: number }[];
  metrics: { linkedinConnected: boolean; personaComplete: boolean; postsPublished: number };
}

interface ContentRow {
  id: string; date: string; preview: string; tone: string | null; hookType: string | null;
  wordCount: number; authScore: number | null; status: string;
}

interface Recommendation { priority: 'HIGH' | 'MEDIUM'; recommendation: string; dataPoint: string; actionUrl: string; actionLabel: string; }

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function scoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function CircularProgress({ score, size = 64, stroke = 6 }: { score: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(124,92,252,0.1)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} stroke={scoreColor(score)} strokeWidth={stroke} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size * 0.28} fontWeight={800} fill="#1A1A2E">{score}</text>
    </svg>
  );
}

function KpiSkeleton() {
  return <div className="card p-5"><div className="skeleton h-4 w-20 mb-3" /><div className="skeleton h-8 w-16 mb-2" /><div className="skeleton h-3 w-24" /></div>;
}

function Sparkline({ points }: { points: { date: string; posts: number }[] }) {
  const last8 = points.slice(-56); // ~8 weeks of daily points, bucketed below
  const weeks: number[] = [];
  for (let i = 0; i < 8; i++) {
    const chunk = last8.slice(i * 7, i * 7 + 7);
    weeks.push(chunk.reduce((s, p) => s + (p?.posts || 0), 0));
  }
  const max = Math.max(1, ...weeks);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {weeks.map((w, i) => (
        <div key={i} className="flex-1 bg-brand-purple/25 rounded-sm" style={{ height: `${Math.max(8, (w / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [dateRange, setDateRange] = useState('30');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [bestTime, setBestTime] = useState<{ recommendedDays: string[]; recommendedTimes: string[] } | null>(null);
  const [tableRows, setTableRows] = useState<ContentRow[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tablePage, setTablePage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof ContentRow>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [healthExpanded, setHealthExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUser(data.user);
      supabase.from('profiles').select('first_name, last_name').eq('id', data.user.id).single().then(({ data: p }) => {
        setUserName([p?.first_name, p?.last_name].filter(Boolean).join(' ') || data.user!.email?.split('@')[0] || 'there');
      });
    });
  }, []);

  const loadOverview = useCallback(async (userId: string, days: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dashboard-overview', userId, days: Number(days) }),
      });
      const data = await res.json();
      if (!data.error) setOverview(data);
    } catch { showToast('error', 'Could not load dashboard data.'); }
  }, [showToast]);

  const loadJourney = useCallback(async (userId: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'growth-journey', userId }),
      });
      const data = await res.json();
      if (!data.error) setJourney(data);
    } catch {}
  }, []);

  const loadRecommendations = useCallback(async (userId: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dashboard-recommendations', userId }),
      });
      const data = await res.json();
      if (!data.error) setRecommendations(data.recommendations || []);
    } catch {}
  }, []);

  const loadBestTime = useCallback(async (userId: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'best-time', userId }),
      });
      const data = await res.json();
      if (!data.error) setBestTime(data);
    } catch {}
  }, []);

  const loadTable = useCallback(async (userId: string, page: number) => {
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dashboard-table', userId, page, pageSize: 10 }),
      });
      const data = await res.json();
      if (!data.error) { setTableRows(data.rows || []); setTableTotal(data.total || 0); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    loadOverview(user.id, dateRange);
    loadJourney(user.id);
    loadRecommendations(user.id);
    loadBestTime(user.id);
    loadTable(user.id, 0);
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
      if ((count || 0) > 0) maybePromptPush(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadOverview(user.id, dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useEffect(() => {
    if (!user) return;
    loadTable(user.id, tablePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablePage]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await Promise.all([loadOverview(user.id, dateRange), loadJourney(user.id), loadTable(user.id, tablePage)]);
    setRefreshing(false);
    showToast('success', 'Dashboard refreshed.');
  };

  const handleExport = () => {
    if (!tableRows.length) { showToast('warning', 'No posts to export yet.'); return; }
    const header = 'Date,Preview,Tone,Hook,Words,Auth Score,Status\n';
    const csv = tableRows.map(r =>
      [new Date(r.date).toLocaleDateString(), `"${r.preview.replace(/"/g, '""')}"`, r.tone || '', r.hookType || '', r.wordCount, r.authScore ?? '', r.status].join(',')
    ).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `eclatale-posts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Report exported.');
  };

  const handleCopyRow = (row: ContentRow, fullContent?: string) => {
    copyToClipboard(fullContent || row.preview);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteRow = async (id: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) { showToast('error', "Couldn't delete that post."); return; }
    setTableRows(prev => prev.filter(r => r.id !== id));
    showToast('success', 'Post deleted.');
  };

  const sortedRows = useMemo(() => {
    const rows = [...tableRows];
    rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [tableRows, sortKey, sortDir]);

  const toggleSort = (key: keyof ContentRow) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  })();

  const greetingSubtext = (() => {
    if (!overview) return '';
    if (overview.totalPostsPublished === 0) return "Let's create your first post today.";
    if (overview.currentStreak > 0 && overview.currentStreak < 30 && new Date().getHours() >= 17) {
      return `Your ${overview.currentStreak}-day streak ends tonight. One post keeps it alive.`;
    }
    const postedToday = overview.postingActivity.points[overview.postingActivity.points.length - 1]?.posts > 0;
    if (postedToday) return "Great work posting today — here's how you're growing.";
    if (overview.currentStreak >= 2) return "You've been consistent this week — your brand is building momentum.";
    return "Here's your brand growth, in real numbers.";
  })();

  const weeklyGoal = overview?.subscriptionTier === 'individual' ? 5 : 3;

  if (!user || !overview) {
    return (
      <AppShell mobileTitle="Eclatale">
        <div className="min-w-0 pb-8">
          <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-6 md:py-8 space-y-6">
            <div className="skeleton h-14 w-full rounded-2xl" />
            <div className="skeleton h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <KpiSkeleton key={i} />)}
            </div>
            <div className="skeleton h-80 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  const stageIdx = STAGE_ORDER.indexOf(overview.stage);

  return (
    <AppShell mobileTitle="Eclatale">
      <div className="min-w-0 pb-8">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-6 md:py-8">

          {/* Header bar */}
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-bold text-brand-dark">{greeting}, {userName}</h1>
                <NotificationBell userId={user.id} />
              </div>
              <p className="text-sm text-brand-muted">{greetingSubtext}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className="text-xs font-semibold text-brand-dark bg-white border border-[rgba(124,92,252,0.15)] rounded-full pl-3 pr-7 py-2 appearance-none cursor-pointer hover:border-brand-purple/30"
                >
                  {DATE_RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
              </div>
              <button onClick={handleExport} className="btn-ghost !py-2 !px-3.5 text-xs">
                <Download size={13} /> Export
              </button>
              <button onClick={handleRefresh} disabled={refreshing} className="btn-ghost !py-2 !px-3.5 text-xs" aria-label="Refresh">
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <a href="/create" onMouseEnter={prefetchCreatePage} className="btn-primary !py-2.5 !px-5 text-sm">
                <Sparkles size={14} /> Create post
              </a>
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} aria-label="Log out" className="text-brand-muted p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-brand-muted -mt-4 mb-6 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" /> Updated {timeAgo(overview.updatedAt)}
          </p>

          <WeeklyBriefingCard userId={user.id} />

          {/* Growth Journey timeline */}
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-bold text-brand-purple uppercase tracking-wide">Growth Journey</p>
              {journey?.nextStage && (
                <p className="text-xs text-brand-muted">
                  {journey.criteria.filter(c => !c.done).length === 0
                    ? `Ready to unlock ${STAGE_LABELS[journey.nextStage]}`
                    : `${journey.criteria.find(c => !c.done)?.current ?? 0} of ${journey.criteria.find(c => !c.done)?.target ?? 0} to ${STAGE_LABELS[journey.nextStage]}`}
                </p>
              )}
            </div>
            <div className="flex items-center mb-1">
              {STAGE_ORDER.map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 64 }}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${i <= stageIdx ? 'gradient-primary text-white' : 'bg-[rgba(124,92,252,0.08)] text-brand-muted'}`}>
                      {STAGE_EMOJI[s]}
                    </div>
                    <span className="text-[9px] font-semibold text-brand-muted mt-1">{STAGE_LABELS[s]}</span>
                    {i === stageIdx && <span className="text-[8px] font-bold text-brand-purple mt-0.5">YOU ARE HERE</span>}
                  </div>
                  {i < STAGE_ORDER.length - 1 && <div className={`flex-1 h-1 mx-1 rounded-full ${i < stageIdx ? 'gradient-primary' : 'bg-[rgba(124,92,252,0.08)]'}`} />}
                </React.Fragment>
              ))}
            </div>
            {journey && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
                {(journey.nextStage ? journey.criteria : []).map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (c.done) return;
                      const hrefs: Record<string, string> = { 'LinkedIn connected': '/settings', 'Voice profile complete': '/persona-setup' };
                      window.location.href = hrefs[c.label] || '/create';
                    }}
                    className={`flex items-center gap-2 text-left p-3 rounded-xl border text-xs font-medium transition-colors ${c.done ? 'border-brand-teal/20 bg-[rgba(6,214,160,0.05)] text-brand-dark' : 'border-[rgba(124,92,252,0.1)] hover:border-brand-purple/25 text-brand-muted cursor-pointer'}`}
                  >
                    {c.done ? <Check size={14} className="text-brand-teal flex-shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border-[1.5px] border-brand-muted/40 flex-shrink-0" />}
                    {c.label}{!c.done && ` (${Math.min(c.current, c.target)}/${c.target})`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {/* Brand Health */}
            <button onClick={() => setHealthExpanded(o => !o)} className="card p-4 text-left col-span-2 md:col-span-1 lg:col-span-1">
              <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-2">Brand Health</p>
              <div className="flex items-center gap-3">
                <CircularProgress score={overview.brandHealth.score} size={56} stroke={5} />
                <div>
                  <div className={`flex items-center gap-0.5 text-xs font-bold ${overview.brandHealth.trend >= 0 ? 'text-brand-teal' : 'text-red-400'}`}>
                    {overview.brandHealth.trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(overview.brandHealth.trend)} pts
                  </div>
                  <p className="text-[9px] text-brand-muted">vs last week</p>
                </div>
              </div>
              {healthExpanded && (
                <div className="mt-3 pt-3 border-t border-[rgba(124,92,252,0.08)] space-y-1.5">
                  {[['Consistency', overview.brandHealth.consistency], ['Quality', overview.brandHealth.quality], ['Voice', overview.brandHealth.voice]].map(([label, val]) => (
                    <div key={label as string} className="flex items-center justify-between text-[10px]">
                      <span className="text-brand-muted">{label}</span>
                      <span className="font-bold text-brand-dark">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>

            {/* Total posts */}
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-2">Total Posts</p>
              <p className="text-2xl font-extrabold text-brand-dark mb-1">{overview.totalPostsPublished}</p>
              <Sparkline points={overview.postingActivity.points} />
              <p className="text-[9px] text-brand-muted mt-1">{overview.postsThisWeek} this week</p>
            </div>

            {/* Streak */}
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-2">Streak</p>
              <div className="flex items-center gap-1.5">
                <Flame size={18} className="text-brand-orange" style={{ transform: `scale(${1 + Math.min(1, overview.currentStreak / 30) * 0.6})` }} />
                <p className="text-2xl font-extrabold text-brand-dark">{overview.currentStreak}d</p>
              </div>
              <p className="text-[9px] text-brand-muted mt-1">Best: {overview.longestStreak}d</p>
            </div>

            {/* This week */}
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-2">This Week</p>
              <p className="text-2xl font-extrabold text-brand-dark mb-1.5">{overview.postsThisWeek}<span className="text-sm text-brand-muted">/{weeklyGoal}</span></p>
              <div className="h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] overflow-hidden">
                <div className="h-full rounded-full gradient-primary transition-all duration-700" style={{ width: `${Math.min(100, (overview.postsThisWeek / weeklyGoal) * 100)}%` }} />
              </div>
              <p className="text-[9px] text-brand-muted mt-1">Resets Monday</p>
            </div>

            {/* Voice match */}
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-2">Voice Match</p>
              {overview.voiceMatch != null ? (
                <div className="flex items-center gap-3">
                  <CircularProgress score={overview.voiceMatch} size={44} stroke={4} />
                  <p className="text-[10px] font-semibold text-brand-dark">
                    {overview.voiceMatch >= 85 ? 'Excellent' : overview.voiceMatch >= 70 ? 'Strong' : overview.voiceMatch >= 50 ? 'Building' : 'Getting started'}
                  </p>
                </div>
              ) : (
                <a href="/persona-setup" className="text-xs text-brand-purple font-semibold hover:underline">Set up voice →</a>
              )}
            </div>

            {/* Content quality / LinkedIn */}
            <div className="card p-4">
              <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-2">Content Quality</p>
              <p className="text-2xl font-extrabold" style={{ color: scoreColor(overview.brandHealth.quality) }}>{overview.brandHealth.quality}</p>
              <p className="text-[9px] text-brand-muted mt-1">
                {overview.linkedinConnected ? 'Avg. authenticity — LinkedIn reach data requires Marketing API access' : 'Avg. authenticity score'}
              </p>
              {!overview.linkedinConnected && <a href="/settings" className="text-[10px] text-brand-purple font-semibold hover:underline">Connect LinkedIn →</a>}
            </div>
          </div>

          {/* Charts + Activity feed */}
          <div className="grid grid-cols-1 lg:grid-cols-[65%_1fr] gap-6 mb-6">
            <div className="space-y-6 min-w-0">
              {/* Posting activity */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-brand-dark mb-1">Posting activity</h3>
                <p className="text-[11px] text-brand-muted mb-4">Posts created per day</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={overview.postingActivity.points}>
                    <defs>
                      <linearGradient id="postGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} minTickGap={30} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} axisLine={false} tickLine={false} width={24} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(124,92,252,0.15)', fontSize: 12 }}
                      labelFormatter={((d: any) => new Date(d).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })) as any}
                      formatter={((value: any, name: any) => [value, name === 'posts' ? 'Posts created' : 'Published']) as any}
                    />
                    <Area type="monotone" dataKey="posts" stroke="#7C5CFC" strokeWidth={2} fill="url(#postGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-brand-muted">
                  {overview.postingActivity.bestDay && <span>Best posting day: <strong className="text-brand-dark">{overview.postingActivity.bestDay}</strong></span>}
                  <span>Average: <strong className="text-brand-dark">{overview.postingActivity.avgPerWeek}</strong>/week</span>
                </div>
              </div>

              {/* Content performance */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-brand-dark mb-1">Content performance</h3>
                <p className="text-[11px] text-brand-muted mb-4">Posts vs. average quality score, by week</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={overview.contentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.06)" vertical={false} />
                    <XAxis dataKey="weekStart" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} axisLine={false} tickLine={false} width={24} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(124,92,252,0.15)', fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="posts" fill="rgba(124,92,252,0.5)" radius={[6, 6, 0, 0]} name="Posts" />
                    <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#F72585" strokeWidth={2} dot={{ r: 3 }} name="Avg quality score" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Style distribution */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-brand-dark mb-1">Writing style distribution</h3>
                <p className="text-[11px] text-brand-muted mb-4">{overview.styleDistribution.totalAnalyzed} posts analyzed</p>
                {overview.styleDistribution.distribution.length === 0 ? (
                  <p className="text-sm text-brand-muted py-4 text-center">No analyzed posts yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {overview.styleDistribution.distribution.map(d => (
                      <div key={d.tone}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-brand-dark capitalize">{d.tone.replace(/_/g, ' ')}</span>
                          <span className="text-brand-muted">{d.count} posts ({d.pct}%)</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[rgba(124,92,252,0.06)] overflow-hidden">
                          <div className="h-full rounded-full gradient-primary" style={{ width: `${d.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {overview.styleDistribution.strongest && (
                  <p className="text-[11px] text-brand-muted mt-4">
                    Your strongest style: <strong className="text-brand-dark capitalize">{overview.styleDistribution.strongest.tone.replace(/_/g, ' ')}</strong> (highest avg quality score, {overview.styleDistribution.strongest.avgScore}/100)
                  </p>
                )}
              </div>

              {/* Growth score history */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-brand-dark mb-1">Brand health over time</h3>
                <p className="text-[11px] text-brand-muted mb-4">Reconstructed weekly from your actual posting and analytics history</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={overview.growthScoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.06)" vertical={false} />
                    <XAxis dataKey="weekStart" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(124,92,252,0.15)', fontSize: 12 }} />
                    <Line type="monotone" dataKey="score" stroke="#7C5CFC" strokeWidth={2.5} dot={{ r: 3, fill: '#7C5CFC' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity feed */}
            <div className="card p-5 h-fit lg:sticky lg:top-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-bold text-brand-dark">Activity</h3>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
              </div>
              {overview.activityFeed.length === 0 ? (
                <p className="text-xs text-brand-muted text-center py-6">No activity yet.</p>
              ) : (
                <div className="space-y-0">
                  {overview.activityFeed.map((item, i) => (
                    <a
                      key={i}
                      href={item.url || '#'}
                      className={`block py-2.5 border-b border-[rgba(124,92,252,0.05)] last:border-0 ${item.url ? 'hover:bg-[rgba(124,92,252,0.03)] -mx-2 px-2 rounded-lg' : ''}`}
                    >
                      <p className="text-xs text-brand-dark leading-snug line-clamp-1">{item.description}</p>
                      <p className="text-[10px] text-brand-muted mt-0.5">{timeAgo(item.timestamp)}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content performance table */}
          <div className="card p-6 mb-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-brand-dark">Your posts</h3>
              <a href="/history" className="text-xs text-brand-purple font-semibold hover:underline">View all →</a>
            </div>
            {sortedRows.length === 0 ? (
              <p className="text-sm text-brand-muted text-center py-8">No posts yet — generate your first post to see it here.</p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="text-left text-brand-muted border-b border-[rgba(124,92,252,0.08)]">
                      {([['date', 'Date'], ['preview', 'Preview'], ['tone', 'Tone'], ['wordCount', 'Length'], ['authScore', 'Auth Score'], ['status', 'Status']] as [keyof ContentRow, string][]).map(([key, label]) => (
                        <th key={key} onClick={() => toggleSort(key)} className="py-2.5 pr-4 font-semibold cursor-pointer select-none hover:text-brand-purple">
                          {label} {sortKey === key && (sortDir === 'asc' ? '↑' : '↓')}
                        </th>
                      ))}
                      <th className="py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map(row => (
                      <tr key={row.id} className="group border-b border-[rgba(124,92,252,0.04)] last:border-0 hover:bg-[rgba(124,92,252,0.02)]">
                        <td className="py-2.5 pr-4 text-brand-muted whitespace-nowrap" title={new Date(row.date).toLocaleString()}>{timeAgo(row.date)}</td>
                        <td className="py-2.5 pr-4 text-brand-dark max-w-[220px] truncate">{row.preview}{row.preview.length >= 60 ? '…' : ''}</td>
                        <td className="py-2.5 pr-4">{row.tone ? <span className="badge bg-[rgba(124,92,252,0.06)] text-brand-purple text-[10px] capitalize">{row.tone.replace(/_/g, ' ')}</span> : <span className="text-brand-muted">—</span>}</td>
                        <td className="py-2.5 pr-4 text-brand-muted">{row.wordCount}w</td>
                        <td className="py-2.5 pr-4 font-bold" style={{ color: row.authScore != null ? scoreColor(row.authScore) : '#9CA3AF' }}>{row.authScore ?? '—'}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`badge text-[10px] ${row.status === 'published' ? 'bg-[rgba(6,214,160,0.1)] text-brand-teal' : row.status === 'scheduled' ? 'bg-[rgba(59,130,246,0.1)] text-blue-500' : 'bg-[rgba(107,114,128,0.08)] text-brand-muted'}`}>
                            {row.status === 'published' ? 'Published ✓' : row.status === 'scheduled' ? 'Scheduled 📅' : 'Draft 📝'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleCopyRow(row)} className="p-1.5 text-brand-muted hover:text-brand-purple" aria-label="Copy">
                              {copiedId === row.id ? <Check size={13} className="text-brand-teal" /> : <Copy size={13} />}
                            </button>
                            <a href={`/create?postId=${row.id}`} className="p-1.5 text-brand-muted hover:text-brand-purple" aria-label="Edit"><Edit3 size={13} /></a>
                            <button onClick={() => handleDeleteRow(row.id)} className="p-1.5 text-brand-muted hover:text-red-500" aria-label="Delete"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tableTotal > 10 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button disabled={tablePage === 0} onClick={() => setTablePage(p => p - 1)} className="btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-30">Previous</button>
                <span className="text-xs text-brand-muted">Page {tablePage + 1} of {Math.ceil(tableTotal / 10)}</span>
                <button disabled={(tablePage + 1) * 10 >= tableTotal} onClick={() => setTablePage(p => p + 1)} className="btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-30">Next</button>
              </div>
            )}
          </div>

          {/* AI recommendations */}
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-brand-purple" />
              <h3 className="text-sm font-bold text-brand-dark">What to do next</h3>
            </div>
            {!recommendations ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>
            ) : recommendations.length === 0 ? (
              <p className="text-sm text-brand-muted text-center py-4">Not enough data yet for personalized recommendations.</p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((r, i) => (
                  <div key={i} className="p-4 rounded-xl border border-[rgba(124,92,252,0.08)]">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <span className={`badge text-[10px] font-bold ${r.priority === 'HIGH' ? 'bg-[rgba(239,68,68,0.1)] text-red-500' : 'bg-[rgba(245,158,11,0.1)] text-amber-500'}`}>{r.priority}</span>
                    </div>
                    <p className="text-sm text-brand-dark leading-relaxed mb-1.5">{r.recommendation}</p>
                    <p className="text-[11px] text-brand-muted mb-2">{r.dataPoint}</p>
                    <a href={r.actionUrl} className="text-xs text-brand-purple font-semibold hover:underline inline-flex items-center gap-1">
                      {r.actionLabel} <ChevronRight size={12} />
                    </a>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[rgba(124,92,252,0.06)] text-xs text-brand-muted">
              {bestTime && bestTime.recommendedDays.length > 0 && (
                <span>Best time to post: <strong className="text-brand-dark">{bestTime.recommendedDays[0]} at {bestTime.recommendedTimes[0]}</strong></span>
              )}
              {journey?.nextStage && (
                <span>Next milestone: <strong className="text-brand-dark">{journey.criteria.find(c => !c.done)?.target ?? 0} posts</strong> until {STAGE_LABELS[journey.nextStage]}</span>
              )}
            </div>
          </div>

          {/* Upgrade banner */}
          {overview.subscriptionTier === 'free' && (
            <a href="/pricing" className="block rounded-2xl p-6 text-white relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
              <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold mb-1">You've used {overview.postsThisWeek}/{weeklyGoal} free posts this week</p>
                  <h3 className="text-lg font-extrabold">Unlock unlimited posts, AI persona learning, competitor intelligence, and more</h3>
                </div>
                <span className="inline-block bg-white text-brand-purple font-bold text-sm px-5 py-2.5 rounded-full group-hover:scale-105 transition-transform whitespace-nowrap">
                  Upgrade — $19/mo · LAUNCH50 for 50% off
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/20 mt-4 overflow-hidden relative z-10">
                <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${Math.min(100, (overview.postsThisWeek / weeklyGoal) * 100)}%` }} />
              </div>
            </a>
          )}
        </div>
      </div>
    </AppShell>
  );
}
