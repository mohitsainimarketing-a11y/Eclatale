import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart3, FileText, Flame, Trophy, Sparkles, LogOut,
  Home, Zap, User, Clock, ArrowRight, RefreshCw, Copy, Check,
  Loader2, Target, Settings, ChevronRight, Image, TrendingUp, PenTool,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface RecentPost {
  id: string;
  content: string;
  topic: string;
  tone: string;
  content_type: string;
  source: string;
  created_at: string;
}

function GrowthRing({ score }: { score: number }) {
  const c = 2 * Math.PI * 45;
  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(124,92,252,0.08)" strokeWidth="8" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gr)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} style={{ animation: 'ringProgress 1.2s ease forwards' }} />
        <defs><linearGradient id="gr" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C5CFC" /><stop offset="50%" stopColor="#F72585" /><stop offset="100%" stopColor="#FF6B35" />
        </linearGradient></defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold text-brand-dark">{score}</span>
      </div>
    </div>
  );
}

function CheckIcon() {
  return <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

const SIDEBAR_ITEMS = [
  { icon: <Home size={18} />, label: 'Dashboard', href: '/dashboard', active: true },
  { icon: <Zap size={18} />, label: 'Write a Post', href: '/create', active: false, cta: true },
  { icon: <Image size={18} />, label: 'Visual Creator', href: '/create-visual', active: false },
  { icon: <TrendingUp size={18} />, label: 'Competitor Intel', href: '/intelligence', active: false },
  { icon: <Clock size={18} />, label: 'Content History', href: '/history', active: false },
  { icon: <Target size={18} />, label: 'Voice Profile', href: '/persona-setup', active: false },
  { icon: <Settings size={18} />, label: 'Settings', href: '/settings', active: false },
];

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const [postsThisWeek, setPostsThisWeek] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);
  const [hasPersona, setHasPersona] = useState(false);
  const [learningInsight, setLearningInsight] = useState<string | null>(null);
  const [postIdeas, setPostIdeas] = useState<{ topic: string; whyNow: string; trending: boolean }[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [weeklyGoal] = useState(5);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinName, setLinkedinName] = useState('');
  const [bestTime, setBestTime] = useState<{ recommendedDays: string[]; recommendedTimes: string[]; reasoning: string; basedOn: string } | null>(null);
  const [aiGrowth, setAiGrowth] = useState<any>(null);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [growthRefreshing, setGrowthRefreshing] = useState(false);
  const [patterns, setPatterns] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUser(data.user);
      loadDashboardData(data.user.id, data.user.email || '');
    });
  }, []);

  const loadDashboardData = async (userId: string, userEmail = '') => {
    const [profileRes, postsRes, personaRes, signalsRes, recentRes] = await Promise.all([
      supabase.from('profiles').select('role, domain, goals, first_name, last_name, profile_photo_url').eq('id', userId).single(),
      supabase.from('posts').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('persona_profiles').select('persona_completed_at').eq('user_id', userId).single(),
      supabase.from('persona_signals').select('tone, content_type').eq('user_id', userId).eq('action', 'kept').order('created_at', { ascending: false }).limit(5),
      supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
    ]);

    const profile = profileRes.data;
    setHasProfile(!!(profile?.role && profile?.domain && profile?.goals?.length));
    if (profile?.first_name || profile?.last_name) {
      setUserName([profile.first_name, profile.last_name].filter(Boolean).join(' '));
    } else {
      setUserName(userEmail.split('@')[0] || 'there');
    }
    if (profile?.profile_photo_url) setUserAvatar(profile.profile_photo_url);
    setHasPersona(!!personaRes.data?.persona_completed_at);

    const signals = signalsRes.data || [];
    if (signals.length >= 3) {
      const tones = signals.map((s: any) => s.tone).filter(Boolean);
      const topTone = tones.length > 0 ? tones.sort((a: string, b: string) => tones.filter((t: string) => t === b).length - tones.filter((t: string) => t === a).length)[0] : null;
      if (topTone) setLearningInsight(`You tend to write in a ${topTone} voice. We've tuned suggestions to match.`);
    }

    const posts = postsRes.data || [];
    setTotalPosts(posts.length);
    setRecentPosts(recentRes.data || []);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    setPostsThisWeek(posts.filter(p => new Date(p.created_at) >= weekAgo).length);

    let currentStreak = 0;
    if (posts.length > 0) {
      const days = new Set(posts.map(p => new Date(p.created_at).toISOString().split('T')[0]));
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (days.has(d.toISOString().split('T')[0])) currentStreak++;
        else if (i > 0) break;
      }
    }
    setStreak(currentStreak);
    setLoading(false);

    try {
      const liRes = await fetch(`${API_URL}/api/linkedin/status?userId=${userId}`);
      const liData = await liRes.json();
      setLinkedinConnected(liData.connected);
      if (liData.name) setLinkedinName(liData.name);
      if (liData.picture) setUserAvatar(prev => prev || liData.picture);
    } catch {}

    fetchPostIdeas(userId);

    fetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'best-time', userId }),
    })
      .then(r => r.json())
      .then(d => { if (d && !d.error) setBestTime(d); })
      .catch(() => {});

    loadGrowthScore(userId, false);

    fetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'user-patterns', userId }),
    })
      .then(r => r.json())
      .then(d => { if (d && !d.error) setPatterns(d); })
      .catch(() => {});
  };

  const loadGrowthScore = async (uid: string, refresh: boolean) => {
    if (refresh) setGrowthRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'growth-score', userId: uid, refresh }),
      });
      const d = await res.json();
      if (d && !d.error) setAiGrowth(d);
    } catch {}
    setGrowthRefreshing(false);
  };

  const fetchPostIdeas = useCallback(async (userId: string) => {
    setLoadingIdeas(true);
    try {
      const res = await fetch(`${API_URL}/api/suggest-topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ query: '', userId }),
      });
      const data = await res.json();
      if (Array.isArray(data.topics)) setPostIdeas(data.topics);
    } catch {}
    setLoadingIdeas(false);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleCopyPost = (post: RecentPost) => {
    navigator.clipboard.writeText(post.content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const growthScore = Math.min(100, Math.round(
    (hasProfile ? 15 : 0) + (hasPersona ? 15 : 0) + Math.min(20, totalPosts * 4) + Math.min(25, streak * 5) + Math.min(25, postsThisWeek * 8)
  ));
  // Prefer the genuine AI-assessed score; fall back to the arithmetic baseline until it loads.
  const displayGrowthScore = typeof aiGrowth?.overallScore === 'number' ? aiGrowth.overallScore : growthScore;

  const roadmap = [
    { text: 'Complete your persona setup', done: hasProfile },
    { text: 'Set up your voice profile', done: hasPersona, href: '/persona-setup' },
    { text: 'Generate your first AI post', done: totalPosts > 0, href: '/create' },
    { text: 'Track your growth score', done: growthScore > 0 },
  ];
  const roadmapDone = roadmap.filter(r => r.done).length;

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg-page p-5 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-40 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFE] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] bg-white border-r border-[rgba(124,92,252,0.06)] h-screen sticky top-0 z-40">
        <div className="px-5 h-16 flex items-center border-b border-[rgba(124,92,252,0.06)]">
          <a href="/dashboard" className="text-xl font-extrabold gradient-text">Eclatale</a>
        </div>

        <div className="px-3 pt-4 pb-2">
          <a href="/create" className="btn-primary w-full text-sm !py-2.5 !rounded-xl">
            <Sparkles size={16} /> Write a Post
          </a>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {SIDEBAR_ITEMS.filter(i => !i.cta).map((item, i) => (
            <a key={i} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active ? 'bg-[rgba(124,92,252,0.06)] text-brand-purple' : 'text-brand-muted hover:bg-[rgba(124,92,252,0.03)] hover:text-brand-dark'
              }`}>
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-[rgba(124,92,252,0.06)]">
          <div className="flex items-center gap-3 px-3 py-2">
            {userAvatar
              ? <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(() => { const p = userName.split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : userName.substring(0,2).toUpperCase(); })()}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-dark truncate">{userName}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 w-full transition-all mt-1">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-5 h-14 bg-white/90 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] sticky top-0 z-40">
          <a href="/dashboard" className="text-lg font-extrabold gradient-text">Eclatale</a>
          <button onClick={handleLogout} className="text-sm text-red-400 p-2"><LogOut size={18} /></button>
        </div>

        <div className="max-w-[960px] mx-auto px-5 md:px-8 py-6 md:py-8">
          {/* Welcome Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Welcome back, {userName}</h1>
              <p className="text-sm text-brand-muted mt-0.5">Here's your brand growth overview.</p>
            </div>
            <button onClick={() => setGrowthOpen(o => !o)} className="flex flex-col items-center group" title="View Growth Score breakdown">
              <GrowthRing score={displayGrowthScore} />
              <span className="text-[10px] font-semibold text-brand-purple mt-0.5 flex items-center gap-0.5 opacity-70 group-hover:opacity-100">
                {aiGrowth ? 'AI-assessed' : 'Growth'} <ChevronRight size={10} className={`transition-transform ${growthOpen ? 'rotate-90' : ''}`} />
              </span>
            </button>
          </div>

          {/* Growth Score breakdown panel */}
          {growthOpen && (
            <div className="card p-5 mb-6 animate-fadeIn">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">Growth Score: {displayGrowthScore}/100</h3>
                  <p className="text-[11px] text-brand-muted">{aiGrowth ? 'AI-assessed from your real activity' : 'Complete your profile and post to unlock AI assessment'}</p>
                </div>
                <button onClick={() => user && loadGrowthScore(user.id, true)} disabled={growthRefreshing}
                  className="btn-ghost text-[11px] !py-1.5 !px-2.5 disabled:opacity-50">
                  {growthRefreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Recalculate
                </button>
              </div>
              {aiGrowth?.overallReasoning && (
                <p className="text-[13px] text-brand-dark/80 leading-relaxed mb-4 bg-[rgba(124,92,252,0.04)] rounded-xl p-3">{aiGrowth.overallReasoning}</p>
              )}
              {aiGrowth?.subComponents && (
                <div className="space-y-3">
                  {/* Content Consistency */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-brand-dark">Content Consistency <span className="text-brand-muted font-normal">· 40%</span></span>
                      <span className="text-xs font-bold text-brand-purple">{aiGrowth.subComponents.contentConsistency.score}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] mb-1 overflow-hidden">
                      <div className="h-full rounded-full gradient-primary" style={{ width: `${aiGrowth.subComponents.contentConsistency.score}%` }} />
                    </div>
                    <p className="text-[11px] text-brand-muted leading-snug">{aiGrowth.subComponents.contentConsistency.reasoning}</p>
                  </div>
                  {/* Engagement Rate */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-brand-dark">Engagement Rate <span className="text-brand-muted font-normal">· 30%</span></span>
                      <span className="text-[10px] font-semibold text-brand-muted bg-[rgba(124,92,252,0.06)] px-2 py-0.5 rounded-full">Locked</span>
                    </div>
                    <p className="text-[11px] text-brand-muted leading-snug">{aiGrowth.subComponents.engagementRate.reasoning}.
                      {!linkedinConnected && <a href="/settings" className="text-brand-purple font-semibold hover:underline"> Connect →</a>}
                    </p>
                  </div>
                  {/* Profile Completeness */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-brand-dark">Profile Completeness <span className="text-brand-muted font-normal">· 30%</span></span>
                      <span className="text-xs font-bold text-brand-teal">{aiGrowth.subComponents.profileCompleteness.score}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] mb-1 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-blue" style={{ width: `${aiGrowth.subComponents.profileCompleteness.score}%` }} />
                    </div>
                    <p className="text-[11px] text-brand-muted leading-snug">{aiGrowth.subComponents.profileCompleteness.reasoning}</p>
                  </div>
                </div>
              )}
              {!aiGrowth && <p className="text-[12px] text-brand-muted">Assessment loads once you have profile data and activity.</p>}
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Posts', value: totalPosts, icon: <FileText size={16} />, color: 'from-brand-purple to-[#9B7DFC]' },
              { label: 'This Week', value: postsThisWeek, icon: <BarChart3 size={16} />, color: 'from-brand-pink to-[#FF5CAD]' },
              { label: 'Streak', value: `${streak}d`, icon: <Flame size={16} />, color: 'from-brand-orange to-[#FF8F5E]' },
              { label: 'Growth Score', value: `${displayGrowthScore}/100`, icon: <Trophy size={16} />, color: 'from-brand-teal to-brand-blue' },
            ].map((s, i) => (
              <div key={i} className="card stat-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-white`}>{s.icon}</div>
                  <span className="text-[11px] text-brand-muted font-medium">{s.label}</span>
                </div>
                <span className="text-xl font-bold text-brand-dark">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Writing Insights (Piece 12 — semantic engine, Surface 3) */}
          <div className="card p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center text-white">
                <PenTool size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-dark">Writing insights</h3>
                <p className="text-[11px] text-brand-muted">Patterns from your own posts</p>
              </div>
            </div>
            {patterns?.ready ? (
              <div className="space-y-3">
                {patterns.writingStrengths?.[0] && (
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[rgba(6,214,160,0.05)] border border-brand-teal/10">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-brand-teal uppercase tracking-wide mb-0.5">Strength</p>
                      <p className="text-[13px] text-brand-dark leading-relaxed">{patterns.writingStrengths[0]}</p>
                    </div>
                    <a href={`/create?topic=${encodeURIComponent(patterns.writingStrengths[0])}`}
                      className="text-[11px] text-brand-teal font-semibold hover:underline flex-shrink-0 whitespace-nowrap">Write about this →</a>
                  </div>
                )}
                {patterns.writingOpportunities?.[0] && (
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[rgba(255,107,53,0.05)] border border-brand-orange/10">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-brand-orange uppercase tracking-wide mb-0.5">Opportunity</p>
                      <p className="text-[13px] text-brand-dark leading-relaxed">{patterns.writingOpportunities[0]}</p>
                    </div>
                    <a href={`/create?topic=${encodeURIComponent(patterns.writingOpportunities[0])}`}
                      className="text-[11px] text-brand-orange font-semibold hover:underline flex-shrink-0 whitespace-nowrap">Write about this →</a>
                  </div>
                )}
                {(patterns.unusedAngles?.[0] || patterns.recommendedNextPost) && (
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[rgba(124,92,252,0.05)] border border-brand-purple/10">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-brand-purple uppercase tracking-wide mb-0.5">Next post angle</p>
                      <p className="text-[13px] text-brand-dark leading-relaxed">{patterns.recommendedNextPost || patterns.unusedAngles[0]}</p>
                    </div>
                    <a href={`/create?topic=${encodeURIComponent(patterns.recommendedNextPost || patterns.unusedAngles[0])}`}
                      className="text-[11px] text-brand-purple font-semibold hover:underline flex-shrink-0 whitespace-nowrap">Write about this →</a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-brand-muted text-center py-4">
                Not enough data yet — generate {Math.max(0, 3 - (patterns?.postsAnalyzed || 0))} more posts to unlock your writing insights.
              </p>
            )}
          </div>

          {/* Persona CTA */}
          {!hasPersona && (
            <a href="/persona-setup" className="card card-hover p-4 mb-6 block !border-brand-purple/15 gradient-mesh">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white flex-shrink-0">
                  <Target size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-brand-dark">Set up your voice profile. Takes 90 seconds.</h3>
                  <p className="text-xs text-brand-muted">Content generated without it sounds generic.</p>
                </div>
                <ChevronRight size={16} className="text-brand-muted flex-shrink-0" />
              </div>
            </a>
          )}

          {/* Learning Insight */}
          {learningInsight && (
            <div className="card p-4 mb-6 !border-brand-teal/15">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center text-white flex-shrink-0">
                  <Sparkles size={14} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-brand-teal uppercase tracking-wide">Eclatale knows you</p>
                  <p className="text-sm text-brand-dark">{learningInsight}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Post Ideas */}
              <div className="card p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-brand-dark">Post ideas for you</h2>
                    <p className="text-[10px] text-brand-muted font-medium">AI-curated based on your industry and persona</p>
                  </div>
                  <button onClick={() => user && fetchPostIdeas(user.id)} disabled={loadingIdeas}
                    className="flex items-center gap-1.5 text-xs text-brand-purple font-semibold hover:underline">
                    {loadingIdeas ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    New ideas
                  </button>
                </div>
                {loadingIdeas && postIdeas.length === 0 ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 w-full" />)}</div>
                ) : (
                  <div className="space-y-3">
                    {postIdeas.slice(0, 3).map((idea, i) => (
                      <div key={i} className="p-4 rounded-2xl border border-[rgba(124,92,252,0.06)] hover:border-brand-purple/20 hover:shadow-brand transition-all group bg-white">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-[13px] text-brand-dark leading-relaxed font-medium flex-1">{idea.topic}</p>
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${
                            idea.trending ? 'bg-[rgba(255,107,53,0.1)] text-brand-orange' : 'bg-[rgba(107,114,128,0.1)] text-brand-muted'
                          }`}>
                            {idea.trending ? '🔥 Trending' : '💡 Evergreen'}
                          </span>
                        </div>
                        {idea.whyNow && (
                          <p className="text-[11px] leading-snug mb-3" style={{ color: '#6B7280' }}>
                            <span className="font-semibold">Why now:</span> {idea.whyNow}
                          </p>
                        )}
                        <a href={`/create?topic=${encodeURIComponent(idea.topic)}`}
                          className="inline-flex items-center gap-1.5 text-xs text-brand-purple font-semibold hover:underline opacity-70 group-hover:opacity-100 transition-opacity">
                          Generate post <ArrowRight size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                {postIdeas.length === 0 && !loadingIdeas && (
                  <p className="text-sm text-brand-muted text-center py-6">Create your first post to get personalized ideas.</p>
                )}
              </div>

              {/* Recent Posts */}
              <div className="card p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-brand-dark">Recent posts</h2>
                  {recentPosts.length > 0 && (
                    <a href="/history" className="text-xs text-brand-purple font-semibold hover:underline">View all</a>
                  )}
                </div>
                {recentPosts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white mx-auto mb-3 opacity-50">
                      <FileText size={20} />
                    </div>
                    <p className="text-sm text-brand-muted mb-4">No posts yet. Create your first one!</p>
                    <a href="/create" className="btn-primary text-xs !py-2 !px-5">Write a Post</a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentPosts.map(post => (
                      <div key={post.id} className="p-4 rounded-xl border border-[rgba(124,92,252,0.06)] hover:border-[rgba(124,92,252,0.12)] transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(124,92,252,0.06)] text-brand-purple">
                              {post.content_type === 'linkedin-post' ? 'LinkedIn' : post.content_type === 'twitter-thread' ? 'X Thread' : post.content_type === 'instagram-caption' ? 'Instagram' : 'Article'}
                            </span>
                            <span className="text-[10px] text-brand-muted">{formatDate(post.created_at)}</span>
                          </div>
                          <button onClick={() => handleCopyPost(post)} className="text-brand-muted hover:text-brand-purple transition-colors p-1">
                            {copiedId === post.id ? <Check size={14} className="text-brand-teal" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <p className="text-[13px] text-brand-dark leading-relaxed line-clamp-3">{post.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (1/3) */}
            <div className="space-y-6">
              {/* Weekly Progress */}
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(124,92,252,0.06)] flex items-center justify-center">
                    <BarChart3 size={16} className="text-brand-purple" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-brand-dark">Weekly progress</h3>
                    <p className="text-[11px] text-brand-muted">{postsThisWeek}/{weeklyGoal} posts</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[rgba(124,92,252,0.08)] mb-3 overflow-hidden">
                  <div className="h-full rounded-full gradient-primary transition-all duration-700"
                    style={{ width: `${Math.min(100, (postsThisWeek / weeklyGoal) * 100)}%` }} />
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = new Date(); d.setDate(d.getDate() - (6 - i));
                    const dayLabel = d.toLocaleDateString('en', { weekday: 'short' }).charAt(0);
                    const filled = i < postsThisWeek;
                    return (
                      <div key={i} className="flex-1 text-center">
                        <div className={`w-full h-6 rounded-md mb-1 ${filled ? 'gradient-primary' : 'bg-[rgba(124,92,252,0.06)]'}`} />
                        <span className="text-[9px] text-brand-muted font-medium">{dayLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Post Timing (AI-recommended) */}
              {bestTime && bestTime.recommendedDays.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center text-white">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-brand-dark">Post timing</h3>
                      <p className="text-[10px] text-brand-muted">AI-recommended · {bestTime.basedOn}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {bestTime.recommendedDays.map(d => (
                      <span key={d} className="badge bg-[rgba(124,92,252,0.07)] text-brand-purple text-[11px]">{d}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {bestTime.recommendedTimes.map(t => (
                      <span key={t} className="badge bg-[rgba(6,214,160,0.08)] text-brand-teal text-[11px]">{t}</span>
                    ))}
                  </div>
                  {bestTime.reasoning && <p className="text-[11px] text-brand-muted leading-relaxed">{bestTime.reasoning}</p>}
                </div>
              )}

              {/* Quick Create */}
              <div className="card p-5">
                <h3 className="text-sm font-bold text-brand-dark mb-3">Quick create</h3>
                <div className="space-y-2">
                  <a href="/create" className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(124,92,252,0.08)] hover:border-brand-purple/20 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                      <Sparkles size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-brand-dark">AI Workspace</p>
                      <p className="text-[10px] text-brand-muted">Write, repurpose, refine with AI</p>
                    </div>
                    <ChevronRight size={14} className="text-brand-muted" />
                  </a>
                  <a href="/create-visual" className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(124,92,252,0.08)] hover:border-brand-teal/20 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                      <Image size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-brand-dark">Visual Creator</p>
                      <p className="text-[10px] text-brand-muted">AI-generated graphics</p>
                    </div>
                    <ChevronRight size={14} className="text-brand-muted" />
                  </a>
                </div>
              </div>

              {/* LinkedIn Connection */}
              <div className="card p-5">
                <h3 className="text-sm font-bold text-brand-dark mb-3">LinkedIn</h3>
                {linkedinConnected ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0A66C2] flex items-center justify-center text-white text-xs font-bold">in</div>
                    <div>
                      <p className="text-sm font-semibold text-brand-dark">{linkedinName || 'Connected'}</p>
                      <p className="text-[10px] text-brand-teal font-medium">Ready to publish</p>
                    </div>
                  </div>
                ) : (
                  <a href={`${API_URL}/api/auth/linkedin/callback?userId=${user?.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#0A66C2]/20 hover:bg-[#0A66C2]/5 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center text-white text-xs font-bold">in</div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-brand-dark">Connect LinkedIn</p>
                      <p className="text-[10px] text-brand-muted">Publish posts directly</p>
                    </div>
                    <ChevronRight size={14} className="text-brand-muted" />
                  </a>
                )}
              </div>

              {/* Roadmap */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-brand-dark">Your roadmap</h3>
                  <span className="text-[10px] font-semibold text-brand-purple bg-[rgba(124,92,252,0.06)] px-2 py-0.5 rounded-full">{roadmapDone}/{roadmap.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] mb-4 overflow-hidden">
                  <div className="h-full rounded-full gradient-primary transition-all duration-700"
                    style={{ width: `${(roadmapDone / roadmap.length) * 100}%` }} />
                </div>
                <div className="space-y-2.5">
                  {roadmap.map((item, i) => (
                    <a key={i} href={item.done ? undefined : (item as any).href || '#'}
                      className={`flex items-center gap-2.5 text-[13px] ${!item.done && (item as any).href ? 'cursor-pointer hover:text-brand-purple' : ''}`}>
                      <div className={`w-4.5 h-4.5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 ${
                        item.done ? 'bg-brand-teal border-brand-teal' : 'border-[rgba(124,92,252,0.2)]'
                      }`} style={{ width: 18, height: 18 }}>
                        {item.done && <CheckIcon />}
                      </div>
                      <span className={`font-medium ${item.done ? 'text-brand-muted line-through' : 'text-brand-dark'}`}>{item.text}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-[rgba(124,92,252,0.06)] z-50">
        <div className="flex items-center justify-around h-16">
          {[
            { icon: <Home size={20} />, label: 'Home', href: '/dashboard', active: true },
            { icon: <Zap size={20} />, label: 'Create', href: '/create', active: false },
            { icon: <Clock size={20} />, label: 'History', href: '/history', active: false },
            { icon: <User size={20} />, label: 'Profile', href: '/persona-setup', active: false },
          ].map((tab, i) => (
            <a key={i} href={tab.href} className={`flex flex-col items-center gap-1 min-w-[60px] py-2 ${tab.active ? 'text-brand-purple' : 'text-brand-muted'}`}>
              {tab.icon}
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
