import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Users, Eye, Search, TrendingUp, ArrowUpRight, ArrowDownRight, ThumbsUp, MessageCircle, Repeat2, BarChart2 } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

interface InsightKpi {
  followerCount: number | null;
  connectionCount: number | null;
  profileViews: number | null;
  searchAppearances: number | null;
  postImpressions: number | null;
  engagementRate: number | null;
  linkedinHeadline: string | null;
  updatedAt: string | null;
}

interface HistoryRow {
  scraped_at: string;
  follower_count: number | null;
  profile_views: number | null;
  post_impressions: number | null;
}

interface PostMetric {
  post_urn: string | null;
  post_text: string | null;
  post_type: string;
  posted_at: string | null;
  likes: number | null;
  comments: number | null;
  reposts: number | null;
  impressions: number | null;
  scraped_at: string;
}

function fmt(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-[rgba(124,92,252,0.08)] flex items-center justify-center flex-shrink-0 text-brand-purple">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xl font-extrabold text-brand-dark">{value}</p>
        {sub && <p className="text-[10px] text-brand-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function LinkedInInsights({ userId }: { userId: string }) {
  const [kpi, setKpi] = useState<InsightKpi | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [posts, setPosts] = useState<PostMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      setLoading(true);

      // Current snapshot from linkedin_connections
      const { data: conn } = await supabase
        .from('linkedin_connections')
        .select('follower_count, connection_count, profile_views, search_appearances, post_impressions, engagement_rate, linkedin_headline, updated_at')
        .eq('user_id', userId)
        .single();

      if (conn) {
        setKpi({
          followerCount: conn.follower_count,
          connectionCount: conn.connection_count,
          profileViews: conn.profile_views,
          searchAppearances: conn.search_appearances,
          postImpressions: conn.post_impressions,
          engagementRate: conn.engagement_rate,
          linkedinHeadline: conn.linkedin_headline,
          updatedAt: conn.updated_at,
        });
      }

      // History for trend charts (last 60 days)
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data: hist } = await supabase
        .from('linkedin_insights_history')
        .select('scraped_at, follower_count, profile_views, post_impressions')
        .eq('user_id', userId)
        .gte('scraped_at', since)
        .order('scraped_at', { ascending: true });

      setHistory(hist || []);

      // Post metrics (last 20)
      const { data: pm } = await supabase
        .from('linkedin_post_metrics')
        .select('post_urn, post_text, post_type, posted_at, likes, comments, reposts, impressions, scraped_at')
        .eq('user_id', userId)
        .order('scraped_at', { ascending: false })
        .limit(20);

      setPosts(pm || []);
      setLoading(false);
    }

    load();
  }, [userId]);

  // No data at all → show install prompt
  const hasAnyData = kpi && Object.values({
    f: kpi.followerCount, c: kpi.connectionCount, p: kpi.profileViews,
    s: kpi.searchAppearances, i: kpi.postImpressions,
  }).some(v => v != null);

  if (loading) {
    return (
      <div className="card p-6 mb-6">
        <div className="skeleton h-4 w-40 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="card p-6 mb-6 border-dashed border-[rgba(124,92,252,0.2)]">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[rgba(124,92,252,0.08)] flex items-center justify-center flex-shrink-0">
            <BarChart2 size={18} className="text-brand-purple" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-dark mb-1">LinkedIn Insights</h3>
            <p className="text-xs text-brand-muted mb-3 max-w-lg">
              Get real follower count, profile views, search appearances, and per-post impressions — automatically synced in the background while you browse LinkedIn.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://chromewebstore.google.com/detail/eclatale"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary !py-2 !px-4 text-xs"
              >
                Install Chrome Extension →
              </a>
              <p className="text-[11px] text-brand-muted self-center">
                Already installed? Visit your LinkedIn profile to sync.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Format chart data — deduplicate by day, take latest reading per day
  const chartData = (() => {
    const byDay: Record<string, HistoryRow> = {};
    history.forEach(h => {
      const day = h.scraped_at.split('T')[0];
      byDay[day] = h; // last reading wins
    });
    return Object.values(byDay).map(h => ({
      date: h.scraped_at.split('T')[0],
      followers: h.follower_count,
      profileViews: h.profile_views,
      impressions: h.post_impressions,
    }));
  })();

  // Compute deltas (compare first vs last data point)
  const followerDelta = chartData.length >= 2
    ? (chartData[chartData.length - 1].followers ?? 0) - (chartData[0].followers ?? 0)
    : null;

  return (
    <div className="mb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-brand-dark">LinkedIn Insights</h3>
          <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[10px]">via extension</span>
        </div>
        {kpi?.updatedAt && (
          <p className="text-[10px] text-brand-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
            Synced {timeAgo(kpi.updatedAt)}
          </p>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={<Users size={16} />}
          label="Followers"
          value={fmt(kpi!.followerCount)}
          sub={followerDelta != null
            ? `${followerDelta >= 0 ? '+' : ''}${fmt(followerDelta)} in 60 days`
            : 'Visit profile to sync'}
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Connections"
          value={fmt(kpi!.connectionCount)}
          sub="1st-degree"
        />
        <KpiCard
          icon={<Eye size={16} />}
          label="Profile Views"
          value={fmt(kpi!.profileViews)}
          sub="Last 90 days"
        />
        <KpiCard
          icon={<Search size={16} />}
          label="Search Appearances"
          value={fmt(kpi!.searchAppearances)}
          sub="Last 7 days"
        />
        <KpiCard
          icon={<BarChart2 size={16} />}
          label="Post Impressions"
          value={fmt(kpi!.postImpressions)}
          sub={kpi!.engagementRate != null ? `${kpi!.engagementRate}% engagement` : 'Via analytics page'}
        />
      </div>

      {/* Charts */}
      {chartData.length >= 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Follower growth */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-brand-dark">Follower Growth</h4>
                <p className="text-[10px] text-brand-muted">Last 60 days</p>
              </div>
              {followerDelta != null && (
                <div className={`flex items-center gap-0.5 text-xs font-bold ${followerDelta >= 0 ? 'text-brand-teal' : 'text-red-400'}`}>
                  {followerDelta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {followerDelta >= 0 ? '+' : ''}{fmt(followerDelta)}
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  tickFormatter={d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  minTickGap={30} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => fmt(v)} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid rgba(124,92,252,0.15)', fontSize: 11 }}
                  labelFormatter={d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  formatter={(v: any) => [fmt(v), 'Followers']} />
                <Area type="monotone" dataKey="followers" stroke="#7C5CFC" strokeWidth={2} fill="url(#followerGrad)" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Post impressions trend */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-brand-dark">Post Impressions Trend</h4>
                <p className="text-[10px] text-brand-muted">Cumulative, last 60 days</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06D6A0" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#06D6A0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  tickFormatter={d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  minTickGap={30} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => fmt(v)} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid rgba(124,92,252,0.15)', fontSize: 11 }}
                  labelFormatter={d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  formatter={(v: any) => [fmt(v), 'Impressions']} />
                <Area type="monotone" dataKey="impressions" stroke="#06D6A0" strokeWidth={2} fill="url(#impGrad)" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-post table */}
      {posts.length > 0 && (
        <div className="card p-5 overflow-hidden">
          <h4 className="text-xs font-bold text-brand-dark mb-3">Post Performance</h4>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs min-w-[540px]">
              <thead>
                <tr className="text-left text-brand-muted border-b border-[rgba(124,92,252,0.08)]">
                  <th className="py-2 pr-3 font-semibold">Preview</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold"><span className="flex items-center gap-1"><ThumbsUp size={11} /> Likes</span></th>
                  <th className="py-2 pr-3 font-semibold"><span className="flex items-center gap-1"><MessageCircle size={11} /> Comments</span></th>
                  <th className="py-2 pr-3 font-semibold"><span className="flex items-center gap-1"><Repeat2 size={11} /> Reposts</span></th>
                  <th className="py-2 font-semibold"><span className="flex items-center gap-1"><Eye size={11} /> Impressions</span></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p, i) => {
                  const totalEng = (p.likes ?? 0) + (p.comments ?? 0) + (p.reposts ?? 0);
                  const engRate = p.impressions && p.impressions > 0
                    ? ((totalEng / p.impressions) * 100).toFixed(1)
                    : null;
                  return (
                    <tr key={p.post_urn || i} className="border-b border-[rgba(124,92,252,0.04)] last:border-0 hover:bg-[rgba(124,92,252,0.02)]">
                      <td className="py-2.5 pr-3 max-w-[200px]">
                        <p className="truncate text-brand-dark">{p.post_text || '(no text captured)'}</p>
                        {p.posted_at && <p className="text-[10px] text-brand-muted">{p.posted_at}</p>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="badge bg-[rgba(124,92,252,0.06)] text-brand-purple text-[10px] capitalize">{p.post_type}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-brand-dark">{fmt(p.likes)}</td>
                      <td className="py-2.5 pr-3 font-semibold text-brand-dark">{fmt(p.comments)}</td>
                      <td className="py-2.5 pr-3 font-semibold text-brand-dark">{fmt(p.reposts)}</td>
                      <td className="py-2.5">
                        <div>
                          <span className="font-semibold text-brand-dark">{fmt(p.impressions)}</span>
                          {engRate && <span className="text-[10px] text-brand-teal ml-1.5">{engRate}% eng</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-brand-muted mt-3 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-brand-purple/40" />
            Synced automatically when you browse your LinkedIn activity page
          </p>
        </div>
      )}
    </div>
  );
}
