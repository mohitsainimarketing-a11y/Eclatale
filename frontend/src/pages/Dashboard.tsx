import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Bar, Line, LineChart,
} from 'recharts';
import {
  Sparkles, LogOut, RefreshCw, ChevronDown,
  ArrowUpRight, ArrowDownRight, Flame,
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import { maybePromptPush } from '../lib/pushNotifications';
import AppShell from '../components/AppShell';
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
  const [refreshing, setRefreshing] = useState(false);
  const [healthExpanded, setHealthExpanded] = useState(false);

  useEffect(() => {
    // getSession() reads from localStorage — no network round-trip
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user;
      if (!u) { window.location.href = '/login'; return; }
      setUser(u);
      // Show cached overview immediately so page renders in <100ms
      try {
        const cached = localStorage.getItem(`dash_overview_${u.id}`);
        if (cached) setOverview(JSON.parse(cached));
      } catch {}
      // Show cached name immediately
      try {
        const cachedName = localStorage.getItem(`dash_name_${u.id}`);
        if (cachedName) setUserName(cachedName);
      } catch {}
      supabase.from('profiles').select('first_name, last_name').eq('id', u.id).single().then(({ data: p }) => {
        const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'there';
        setUserName(name);
        try { localStorage.setItem(`dash_name_${u.id}`, name); } catch {}
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
      if (!data.error) {
        setOverview(data);
        try { localStorage.setItem(`dash_overview_${userId}`, JSON.stringify(data)); } catch {}
      }
    } catch { showToast('error', 'Could not load dashboard data.'); }
  }, [showToast]);

  useEffect(() => {
    if (!user) return;
    loadOverview(user.id, dateRange);
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

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadOverview(user.id, dateRange);
    setRefreshing(false);
    showToast('success', 'Dashboard refreshed.');
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
    if (postedToday) return "Great work posting today. Here's how you're growing.";
    if (overview.currentStreak >= 2) return "You've been consistent this week. Your brand is building momentum.";
    return "Here's your brand growth, in real numbers.";
  })();

  const weeklyGoal = overview?.subscriptionTier === 'individual' ? 5 : 3;

  // Only block render if user session hasn't resolved yet (getSession is local — this is near-instant)
  if (!user) return null;

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
          {overview && (
            <p className="text-[10px] text-brand-muted -mt-4 mb-6 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" /> Updated {timeAgo(overview.updatedAt)}
            </p>
          )}

          {/* KPI row */}
          {!overview ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {[1,2,3,4,5,6].map(i => <KpiSkeleton key={i} />)}
            </div>
          ) : (
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
                <div className="mt-3 pt-3 border-t border-[rgba(124,92,252,0.08)] space-y-3">
                  {([
                    {
                      label: 'Consistency', val: overview.brandHealth.consistency,
                      tip: overview.brandHealth.consistency >= 80 ? 'Excellent. Keep the streak going'
                        : overview.brandHealth.consistency >= 60 ? 'Good. Try posting every week without a gap'
                        : 'Post at least once a week for 4 consecutive weeks',
                    },
                    {
                      label: 'Quality', val: overview.brandHealth.quality,
                      tip: overview.brandHealth.quality >= 80 ? 'High authenticity scores. Strong voice'
                        : overview.brandHealth.quality >= 60 ? 'Good. Add specific numbers and named details to posts'
                        : 'Publish more to build quality history, or review authenticity scores',
                    },
                    {
                      label: 'Voice', val: overview.brandHealth.voice,
                      tip: overview.brandHealth.voice >= 80 ? 'Strong voice profile. Claude knows your style'
                        : overview.brandHealth.voice >= 60 ? 'Good. Add 2 to 3 more voice samples in Settings'
                        : 'Complete your voice profile in Settings to train your AI clone',
                    },
                  ] as { label: string; val: number; tip: string }[]).map(({ label, val, tip }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold" style={{ color: '#374151' }}>{label}</span>
                        <span className="text-[10px] font-bold" style={{ color: scoreColor(val) }}>{val}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#F0EEF8' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: val >= 80 ? '#10B981' : val >= 60 ? '#7C5CFC' : '#F59E0B' }} />
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: '#9CA3AF' }}>{tip}</p>
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
            <div className="card p-4 col-span-2 md:col-span-1">
              <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-2">Content Quality</p>
              <p className="text-2xl font-extrabold" style={{ color: scoreColor(overview.brandHealth.quality) }}>{overview.brandHealth.quality}</p>
              <p className="text-[9px] text-brand-muted mt-1">
                {overview.linkedinConnected ? 'Avg. authenticity. LinkedIn reach data requires Marketing API access' : 'Avg. authenticity score'}
              </p>
              {!overview.linkedinConnected && <a href="/settings" className="text-[10px] text-brand-purple font-semibold hover:underline">Connect LinkedIn →</a>}
            </div>
          </div>
          )}

          {/* Charts + Activity feed */}
          {overview && <div className="grid grid-cols-1 lg:grid-cols-[65%_1fr] gap-6 mb-6">
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
            <div className="card p-3 h-fit lg:sticky lg:top-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-brand-dark">Activity</h3>
                  <span className="w-1 h-1 rounded-full bg-brand-teal animate-pulse" />
                </div>
                {overview.activityFeed.length > 5 && (
                  <a href="/history" className="text-[10px] font-semibold text-brand-purple">View all →</a>
                )}
              </div>
              {overview.activityFeed.length === 0 ? (
                <p className="text-[11px] text-brand-muted text-center py-3">No activity yet.</p>
              ) : (
                <div className="space-y-0">
                  {overview.activityFeed.slice(0, 6).map((item, i) => {
                    const isPublished = item.type === 'published';
                    return (
                      <a
                        key={i}
                        href={item.url || '#'}
                        className={`flex items-center gap-1.5 py-1 border-b border-[rgba(124,92,252,0.05)] last:border-0 ${item.url ? 'hover:bg-[rgba(124,92,252,0.03)] -mx-1 px-1 rounded' : ''}`}
                      >
                        <span className="text-[9px] flex-shrink-0 text-brand-muted">{isPublished ? '✓' : '✏'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-brand-dark leading-tight line-clamp-1">{item.description}</p>
                        </div>
                        <span className="text-[9px] text-brand-muted flex-shrink-0">{timeAgo(item.timestamp)}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>}

          {/* Upgrade banner */}
          {overview?.subscriptionTier === 'free' && (
            <a href="/pricing" className="block rounded-2xl p-5 md:p-6 text-white relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold mb-1 opacity-90">You've used {overview.postsThisWeek}/{weeklyGoal} free posts this week</p>
                  <h3 className="text-base md:text-lg font-extrabold leading-snug">Get unlimited posts, AI persona learning, competitor intelligence, and more</h3>
                </div>
                <span className="inline-block bg-white text-brand-purple font-bold text-sm px-5 py-2.5 rounded-full group-hover:scale-105 transition-transform whitespace-nowrap self-start md:self-auto flex-shrink-0">
                  Upgrade $19/mo · LAUNCH50 50% off
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
