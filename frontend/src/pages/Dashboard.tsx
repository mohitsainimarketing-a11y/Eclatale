import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart3, FileText, Flame, Trophy, Sparkles, LogOut,
  Clock, ArrowRight, RefreshCw, Copy, Check,
  Loader2, Target, ChevronRight, Image, PenTool,
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import NotificationBell from '../components/NotificationBell';
import { maybePromptPush } from '../lib/pushNotifications';
import AppShell from '../components/AppShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

// Warms the lazy-loaded /create chunk on hover so the click feels instant —
// webpack dedupes this against the App.tsx React.lazy() import of the same module.
let createPagePrefetched = false;
function prefetchCreatePage() {
  if (createPagePrefetched) return;
  createPagePrefetched = true;
  import('./CreatePost').catch(() => { createPagePrefetched = false; });
}

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

type Stage = 'unknown' | 'emerging' | 'rising' | 'notable' | 'authority' | 'icon';
const STAGE_ORDER: Stage[] = ['unknown', 'emerging', 'rising', 'notable', 'authority', 'icon'];
const STAGE_LABELS: Record<Stage, string> = { unknown: 'Unknown', emerging: 'Emerging', rising: 'Rising', notable: 'Notable', authority: 'Authority', icon: 'Icon' };
const STAGE_EMOJI: Record<Stage, string> = { unknown: '🌱', emerging: '🌤', rising: '📈', notable: '⭐', authority: '🏆', icon: '👑' };

interface JourneyCriterion { label: string; done: boolean; current: number; target: number; }
interface JourneyMetrics {
  postsPublished: number; linkedinConnected: boolean; personaComplete: boolean;
  longestStreak: number; currentStreak: number; postsThisWeek: number; bestWeek: number; daysActive: number;
}
interface JourneyData {
  stage: Stage; nextStage: Stage | null; criteria: JourneyCriterion[]; metrics: JourneyMetrics;
  momentum: { week: boolean[]; trend: 'Building' | 'Strong' | 'Slowing' | 'Stalled' };
  badges: { key: string; unlockedAt: string }[];
  newlyUnlocked: { key: string; emoji: string; label: string }[];
}

function GrowthJourneyCard({ journey, open, onToggle }: { journey: JourneyData | null; open: boolean; onToggle: () => void }) {
  const stage = journey?.stage || 'unknown';
  const stageIdx = STAGE_ORDER.indexOf(stage);

  return (
    <div className="card p-6 animate-fadeIn">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-2xl flex-shrink-0">{STAGE_EMOJI[stage]}</div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-brand-purple uppercase tracking-wide">Your journey</p>
            <h3 className="text-lg font-extrabold text-brand-dark">{STAGE_LABELS[stage]}</h3>
            {journey?.nextStage && (
              <p className="text-[11px] text-brand-muted mt-0.5">
                {journey.criteria.filter(c => !c.done).length} step{journey.criteria.filter(c => !c.done).length === 1 ? '' : 's'} until {STAGE_LABELS[journey.nextStage]}
              </p>
            )}
          </div>
        </div>
        <ChevronRight size={18} className={`text-brand-muted flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {/* Stage timeline */}
      <div className="flex items-center mt-5 mb-1">
        {STAGE_ORDER.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
              i <= stageIdx ? 'gradient-primary text-white' : 'bg-[rgba(124,92,252,0.08)] text-brand-muted'
            }`} title={STAGE_LABELS[s]}>
              {i <= stageIdx ? STAGE_EMOJI[s] : i}
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div className={`flex-1 h-1 mx-1 rounded-full ${i < stageIdx ? 'gradient-primary' : 'bg-[rgba(124,92,252,0.08)]'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-brand-muted font-semibold mb-2 px-0.5">
        {STAGE_ORDER.map(s => <span key={s} className="w-7 text-center">{STAGE_LABELS[s].slice(0, 4)}</span>)}
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-[rgba(124,92,252,0.08)] animate-fadeIn">
          <p className="text-xs font-bold text-brand-dark mb-2">What you've accomplished</p>
          <div className="space-y-1.5 mb-4">
            {STAGE_ORDER.slice(1, stageIdx + 1).map(s => (
              <div key={s} className="flex items-center gap-2 text-[13px] text-brand-dark">
                <Check size={13} className="text-brand-teal flex-shrink-0" /> Reached {STAGE_LABELS[s]}
              </div>
            ))}
            {stageIdx === 0 && <p className="text-[12px] text-brand-muted">Publish your first post to start your journey.</p>}
          </div>
          {journey?.nextStage && (
            <>
              <p className="text-xs font-bold text-brand-dark mb-2">What's next — {STAGE_LABELS[journey.nextStage]}</p>
              <div className="space-y-3">
                {journey.criteria.map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[12px] font-medium ${c.done ? 'text-brand-teal' : 'text-brand-dark'}`}>{c.done && '✓ '}{c.label}</span>
                      <span className="text-[11px] text-brand-muted">{Math.min(c.current, c.target)}/{c.target}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${c.done ? 'bg-brand-teal' : 'gradient-primary'}`}
                        style={{ width: `${Math.min(100, (c.current / c.target) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!journey?.nextStage && journey && <p className="text-[12px] text-brand-muted">You've reached the top of the journey. 👑</p>}
        </div>
      )}
    </div>
  );
}

function WeeklyMomentum({ momentum }: { momentum: JourneyData['momentum'] }) {
  const trendColor: Record<string, string> = {
    Building: 'text-brand-purple', Strong: 'text-brand-teal', Slowing: 'text-amber-500', Stalled: 'text-red-400',
  };
  return (
    <div className="card p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-[11px] font-semibold text-brand-muted mb-1.5">This week</p>
        <div className="flex gap-1.5 text-lg">
          {momentum.week.map((posted, i) => (
            <span key={i} className={posted ? '' : 'opacity-20 grayscale'}>{posted ? '🔥' : '⬜'}</span>
          ))}
        </div>
      </div>
      <p className={`text-sm font-bold ${trendColor[momentum.trend]}`}>Momentum: {momentum.trend}</p>
    </div>
  );
}

function MilestoneCelebration({ stage, milestone, onClose }: {
  stage: Stage | null; milestone: { emoji: string; label: string } | null; onClose: () => void;
}) {
  if (!stage && !milestone) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-5 animate-fadeIn" onClick={onClose}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className="absolute text-xl" style={{
            left: `${Math.random() * 100}%`, top: '-5%',
            animation: `confettiFall ${1.6 + Math.random() * 1.4}s ease-in ${Math.random() * 0.6}s forwards`,
          }}>{['🎉', '✨', '🎊', '⭐'][i % 4]}</span>
        ))}
      </div>
      <div className="card p-8 max-w-sm w-full text-center relative animate-fadeIn" onClick={e => e.stopPropagation()}>
        <div className="text-5xl mb-4">{stage ? STAGE_EMOJI[stage] : milestone?.emoji}</div>
        <h2 className="text-xl font-extrabold text-brand-dark mb-1.5">
          {stage ? `You've reached ${STAGE_LABELS[stage]}!` : milestone?.label}
        </h2>
        <p className="text-sm text-brand-muted mb-6">
          {stage ? "Your consistency is paying off — keep the momentum going." : 'New milestone unlocked.'}
        </p>
        <div className="flex flex-col gap-2">
          {stage && (
            <a href={`/create?topic=${encodeURIComponent(`I just reached ${STAGE_LABELS[stage]} status on my LinkedIn growth journey — share this as a short, genuine milestone post`)}`}
              className="btn-primary w-full text-sm">Share this milestone</a>
          )}
          <button onClick={onClose} className="btn-ghost w-full text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

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
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [celebrateStage, setCelebrateStage] = useState<Stage | null>(null);
  const [celebrateMilestone, setCelebrateMilestone] = useState<{ emoji: string; label: string } | null>(null);
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
    if (posts.length > 0) maybePromptPush(userId);

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

    loadJourney(userId);

    fetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'user-patterns', userId }),
    })
      .then(r => r.json())
      .then(d => { if (d && !d.error) setPatterns(d); })
      .catch(() => {});
  };

  const loadJourney = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'growth-journey', userId: uid }),
      });
      const d: JourneyData = await res.json();
      if (!d || (d as any).error) return;
      setJourney(d);

      // Stage-change celebration: compare against the last stage we saw for
      // this user (localStorage), since the server doesn't track "seen" state.
      const key = `eclatale_last_stage_${uid}`;
      const lastSeen = localStorage.getItem(key);
      if (lastSeen && lastSeen !== d.stage && STAGE_ORDER.indexOf(d.stage) > STAGE_ORDER.indexOf(lastSeen as Stage)) {
        setCelebrateStage(d.stage);
      }
      localStorage.setItem(key, d.stage);

      if (d.newlyUnlocked?.length) {
        setCelebrateMilestone(d.newlyUnlocked[0]);
      }
    } catch {}
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
    copyToClipboard(post.content);
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

  const roadmap = [
    { text: 'Complete your persona setup', done: hasProfile },
    { text: 'Set up your voice profile', done: hasPersona, href: '/persona-setup' },
    { text: 'Generate your first AI post', done: totalPosts > 0, href: '/create' },
    { text: 'Reach Emerging status', done: !!journey && journey.stage !== 'unknown' },
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
    <AppShell mobileTitle="Eclatale">
      <div className="min-w-0 pb-8">
        <div className="max-w-[960px] mx-auto px-5 md:px-8 py-6 md:py-8">
          <div className="flex items-center justify-end gap-1 mb-2">
            {user && <NotificationBell userId={user.id} />}
            <button onClick={handleLogout} aria-label="Log out" className="text-sm text-red-400 p-2 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={18} /></button>
          </div>
          {/* Welcome Header */}
          <div className="mb-2">
            <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Welcome back, {userName}</h1>
            <p className="text-sm text-brand-muted mt-0.5">Here's your brand growth overview.</p>
          </div>

          <GrowthJourneyCard journey={journey} open={journeyOpen} onToggle={() => setJourneyOpen(o => !o)} />

          {/* Journey Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mt-6">
            {[
              { label: 'Total Posts', value: totalPosts, icon: <FileText size={16} />, color: 'from-brand-purple to-[#9B7DFC]' },
              { label: 'This Week', value: `${postsThisWeek}${journey ? ` / best ${journey.metrics.bestWeek}` : ''}`, icon: <BarChart3 size={16} />, color: 'from-brand-pink to-[#FF5CAD]' },
              { label: 'Streak', value: journey ? `${journey.metrics.currentStreak}d / best ${journey.metrics.longestStreak}d` : `${streak}d`, icon: <Flame size={16} />, color: 'from-brand-orange to-[#FF8F5E]' },
              { label: 'Days Active', value: journey?.metrics.daysActive ?? '—', icon: <Trophy size={16} />, color: 'from-brand-teal to-brand-blue' },
            ].map((s, i) => (
              <div key={i} className="card stat-card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-white`}>{s.icon}</div>
                  <span className="text-[11px] text-brand-muted font-medium">{s.label}</span>
                </div>
                <span className="text-xl font-bold text-brand-dark">{s.value}</span>
              </div>
            ))}
          </div>

          {journey && <WeeklyMomentum momentum={journey.momentum} />}

          {/* Writing Insights (Piece 12 — semantic engine, Surface 3) */}
          <div className="card p-6 mb-6">
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
            <a href="/persona-setup" className="card card-hover p-6 mb-6 block !border-brand-purple/15 gradient-mesh">
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
            <div className="card p-6 mb-6 !border-brand-teal/15">
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
              <div className="card p-6 md:p-6">
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
              <div className="card p-6 md:p-6">
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
                    <a href="/create" onMouseEnter={prefetchCreatePage} className="btn-primary text-xs !py-2 !px-5">Write a Post</a>
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
              <div className="card p-6">
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
                <div className="card p-6">
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
              <div className="card p-6">
                <h3 className="text-sm font-bold text-brand-dark mb-3">Quick create</h3>
                <div className="space-y-2">
                  <a href="/create" onMouseEnter={prefetchCreatePage} className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(124,92,252,0.08)] hover:border-brand-purple/20 transition-all group">
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
              <div className="card p-6">
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
              <div className="card p-6">
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
      <MilestoneCelebration
        stage={celebrateStage}
        milestone={celebrateMilestone}
        onClose={() => { setCelebrateStage(null); setCelebrateMilestone(null); }}
      />
    </AppShell>
  );
}
