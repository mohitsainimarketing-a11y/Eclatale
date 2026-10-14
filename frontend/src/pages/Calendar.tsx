import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Copy, Check, Trash2, Globe, FileText, MessageCircle, Image, Clock, Loader2,
  Sparkles, CalendarDays, X, Search, Edit3, ChevronLeft, ChevronRight, Settings2,
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { useFeatureGate } from '../hooks/useFeatureGate';
import AppShell from '../components/AppShell';
import EmptyState from '../components/EmptyState';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  content: string;
  topic: string;
  tone: string;
  content_type: string;
  source: string;
  status: string;
  published_at: string | null;
  linkedin_post_urn: string | null;
  created_at: string;
  scheduled_for?: string | null;
  schedule_status?: 'scheduled' | 'published' | 'failed' | 'cancelled' | null;
}

interface Analysis {
  post_id: string;
  hook_type: string;
  tone_detected: string;
  readability_score: number;
  topic_tags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL POSTS TAB (formerly /history)
// ─────────────────────────────────────────────────────────────────────────────

const HOOK_LABELS: Record<string, string> = {
  question: 'Question hook', bold_statement: 'Bold statement', story: 'Story',
  statistic: 'Statistic', contrarian: 'Contrarian', list_preview: 'List preview',
};
const TONE_DETECTED_LABELS: Record<string, string> = {
  professional: 'Professional', casual: 'Casual',
  inspirational: 'Inspirational', data_driven: 'Data-driven',
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  'linkedin-post': <Globe size={14} />, 'linkedin-article': <FileText size={14} />,
  'twitter-thread': <MessageCircle size={14} />, 'instagram-caption': <Image size={14} />,
};
const TYPE_LABELS: Record<string, string> = {
  'linkedin-post': 'LinkedIn Post', 'linkedin-article': 'Article',
  'twitter-thread': 'X Thread', 'instagram-caption': 'Instagram',
};
const TONE_LABELS: Record<string, string> = {
  professional: 'Professional', casual: 'Casual',
  inspirational: 'Inspirational', 'data-driven': 'Data-Driven',
};

function readabilityColor(score: number): string {
  if (score >= 70) return 'bg-[rgba(6,214,160,0.1)] text-brand-teal';
  if (score >= 40) return 'bg-[rgba(255,159,10,0.12)] text-amber-600';
  return 'bg-[rgba(255,69,58,0.1)] text-red-500';
}

function formatCountdown(target: string): string {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return 'due now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}, ${mins % 60} min`;
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}, ${hours % 24} hour${hours % 24 === 1 ? '' : 's'}`;
}

function formatRelDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PAGE_SIZE = 20;
const HISTORY_LIMIT = 10;

function AllPostsTab({ userId }: { userId: string }) {
  const { showToast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, Analysis>>({});
  const [filterHook, setFilterHook] = useState('');
  const [filterTone, setFilterTone] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'readability'>('date');
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => forceTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('posts').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
      setPosts(data || []);
      setLoading(false);
      try {
        const { data: rows } = await supabase
          .from('post_analytics')
          .select('post_id, hook_type, tone_detected, readability_score, topic_tags')
          .eq('user_id', userId);
        if (rows) {
          const map: Record<string, Analysis> = {};
          for (const r of rows as any[]) map[r.post_id] = r;
          setAnalytics(map);
        }
      } catch { /* analytics table may not exist yet */ }
    })();
  }, [userId]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filterHook, filterTone, selectedTags, searchQuery, sortBy]);

  const handleCancelScheduled = async (postId: string) => {
    setCancelingId(postId);
    try {
      const res = await apiFetch(`${API_URL}/api/schedule/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, postId }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, schedule_status: 'cancelled', scheduled_for: null } : p));
    } catch (err: any) {
      showToast('error', err.message || 'Could not cancel scheduled post.');
    }
    setCancelingId(null);
  };

  const handleCopy = (post: Post) => {
    copyToClipboard(post.content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (postId: string) => {
    setDeleting(postId);
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      showToast('error', "Couldn't delete that post. Please try again.");
    } else {
      setPosts(prev => prev.filter(p => p.id !== postId));
      showToast('success', 'Post deleted.');
    }
    setDeleting(null);
  };

  const { hookOptions, toneOptions, tagCounts } = useMemo(() => {
    const hooks = new Set<string>(), tones = new Set<string>();
    const tags: Record<string, number> = {};
    Object.values(analytics).forEach(a => {
      if (a.hook_type) hooks.add(a.hook_type);
      if (a.tone_detected) tones.add(a.tone_detected);
      (a.topic_tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; });
    });
    return {
      hookOptions: Array.from(hooks),
      toneOptions: Array.from(tones),
      tagCounts: Object.entries(tags).sort((a, b) => b[1] - a[1]),
    };
  }, [analytics]);

  const toggleTag = (tag: string) => setSelectedTags(prev =>
    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  );

  const visiblePosts = useMemo(() => {
    let list = [...posts];
    if (filterHook) list = list.filter(p => analytics[p.id]?.hook_type === filterHook);
    if (filterTone) list = list.filter(p => analytics[p.id]?.tone_detected === filterTone);
    if (selectedTags.length) list = list.filter(p => selectedTags.every(t => (analytics[p.id]?.topic_tags || []).includes(t)));
    const q = searchQuery.trim();
    if (q.startsWith('#')) {
      const tq = q.slice(1).toLowerCase();
      if (tq) list = list.filter(p => (analytics[p.id]?.topic_tags || []).some(t => t.toLowerCase().includes(tq)));
    } else if (q) {
      list = list.filter(p => p.content.toLowerCase().includes(q.toLowerCase()) || p.topic?.toLowerCase().includes(q.toLowerCase()));
    }
    if (sortBy === 'readability') {
      list.sort((a, b) => (analytics[b.id]?.readability_score || 0) - (analytics[a.id]?.readability_score || 0));
    }
    return list;
  }, [posts, analytics, filterHook, filterTone, selectedTags, searchQuery, sortBy]);

  const { tier } = useFeatureGate('contentHistoryLimit');
  const isLimited = tier === 'free' && visiblePosts.length > HISTORY_LIMIT;
  const shownPosts = isLimited ? visiblePosts.slice(0, HISTORY_LIMIT) : visiblePosts.slice(0, visibleCount);
  const hasMore = !isLimited && visiblePosts.length > shownPosts.length;
  const hasAnalytics = Object.keys(analytics).length > 0;

  if (loading) return (
    <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-32 w-full" />)}</div>
  );

  if (posts.length === 0) return (
    <EmptyState
      icon={<FileText size={26} />}
      heading="No content yet"
      subtext="Generate your first post and it will appear here."
      cta={{ label: 'Create your first post', href: '/create' }}
    />
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search posts, or type # to search tags..."
          className="input !pl-11 !text-sm w-full" />
      </div>

      {/* Tag browser */}
      {tagCounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagCounts.slice(0, 20).map(([tag, count]) => (
            <button key={tag} onClick={() => toggleTag(tag)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors flex items-center gap-1 ${
                selectedTags.includes(tag)
                  ? 'border-brand-purple bg-[rgba(124,92,252,0.08)] text-brand-purple'
                  : 'border-[rgba(0,0,0,0.08)] text-brand-muted hover:border-brand-purple/40'
              }`}>
              {tag} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter / sort bar */}
      {hasAnalytics && (
        <div className="card p-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide flex items-center gap-1">
            <Sparkles size={11} /> Filter
          </span>
          {hookOptions.length > 0 && (
            <select value={filterHook} onChange={e => setFilterHook(e.target.value)}
              className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark">
              <option value="">All hooks</option>
              {hookOptions.map(h => <option key={h} value={h}>{HOOK_LABELS[h] || h}</option>)}
            </select>
          )}
          {toneOptions.length > 0 && (
            <select value={filterTone} onChange={e => setFilterTone(e.target.value)}
              className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark">
              <option value="">All tones</option>
              {toneOptions.map(t => <option key={t} value={t}>{TONE_DETECTED_LABELS[t] || t}</option>)}
            </select>
          )}
          <div className="flex-1" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark">
            <option value="date">Newest first</option>
            <option value="readability">Highest readability</option>
          </select>
          {(filterHook || filterTone || selectedTags.length > 0 || searchQuery) && (
            <button onClick={() => { setFilterHook(''); setFilterTone(''); setSelectedTags([]); setSearchQuery(''); }}
              className="text-xs text-brand-purple font-semibold hover:underline">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Post cards */}
      {shownPosts.map(post => {
        const isExpanded = expandedId === post.id;
        const analysis = analytics[post.id];
        const preview = post.content.length > 200 && !isExpanded
          ? post.content.substring(0, 200) + '...'
          : post.content;

        return (
          <div key={post.id} className="card card-hover p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[11px]">
                  {TYPE_ICONS[post.content_type]} {TYPE_LABELS[post.content_type] || post.content_type}
                </span>
                {post.tone && (
                  <span className="badge bg-[rgba(247,37,133,0.08)] text-brand-pink text-[11px]">
                    {TONE_LABELS[post.tone] || post.tone}
                  </span>
                )}
                {post.source === 'guided' && (
                  <span className="badge bg-[rgba(255,107,53,0.08)] text-brand-orange text-[11px]">Guided</span>
                )}
                {post.status === 'published' && (
                  <span className="badge bg-[rgba(6,214,160,0.08)] text-brand-teal text-[11px]">Published</span>
                )}
                {post.schedule_status === 'scheduled' && post.scheduled_for && (
                  <span className="badge bg-[rgba(17,138,178,0.08)] text-brand-blue text-[11px]">
                    <CalendarDays size={11} /> Scheduled {formatCountdown(post.scheduled_for)}
                  </span>
                )}
                {post.schedule_status === 'failed' && (
                  <span className="badge bg-[rgba(255,69,58,0.08)] text-red-500 text-[11px]">Scheduling failed</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-brand-muted text-xs font-medium">
                <Clock size={12} /> {formatRelDate(post.created_at)}
              </div>
            </div>

            {post.topic && (
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">{post.topic}</p>
            )}

            <div className="whitespace-pre-wrap text-brand-dark text-[14px] leading-relaxed mb-4 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : post.id)}>
              {preview}
            </div>
            {post.content.length > 200 && (
              <button onClick={() => setExpandedId(isExpanded ? null : post.id)}
                className="text-xs text-brand-purple font-semibold mb-3 hover:underline">
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}

            {/* Semantic badges */}
            {analysis ? (
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {analysis.hook_type && (
                  <span className="badge bg-[rgba(124,92,252,0.06)] text-brand-purple text-[10px]">
                    🪝 {HOOK_LABELS[analysis.hook_type] || analysis.hook_type}
                  </span>
                )}
                {analysis.tone_detected && (
                  <span className="badge bg-[rgba(124,92,252,0.06)] text-brand-dark text-[10px]">
                    🎙 {TONE_DETECTED_LABELS[analysis.tone_detected] || analysis.tone_detected}
                  </span>
                )}
                {typeof analysis.readability_score === 'number' && (
                  <span className={`badge text-[10px] ${readabilityColor(analysis.readability_score)}`}>
                    📖 {analysis.readability_score}
                  </span>
                )}
                {(analysis.topic_tags || []).map(t => (
                  <span key={t} className="badge bg-[rgba(247,37,133,0.06)] text-brand-pink text-[10px]">{t}</span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mb-3">
                <span className="badge bg-[rgba(124,92,252,0.05)] text-brand-muted text-[10px] inline-flex items-center gap-1">
                  <Loader2 size={9} className="animate-spin" /> Analyzing...
                </span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[rgba(124,92,252,0.06)]">
              <span className="text-xs text-brand-muted">
                {post.content.length} chars
                {post.status === 'published' && post.linkedin_post_urn && (
                  <a href={`https://www.linkedin.com/feed/update/${post.linkedin_post_urn}`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-2 text-brand-teal hover:underline">
                    View on LinkedIn
                  </a>
                )}
              </span>
              <div className="flex items-center gap-2">
                {post.schedule_status === 'scheduled' && (
                  <button onClick={() => handleCancelScheduled(post.id)} disabled={cancelingId === post.id}
                    className="btn-ghost !py-1.5 !px-3 text-xs !text-red-400 !border-red-100 hover:!bg-red-50">
                    {cancelingId === post.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    Cancel
                  </button>
                )}
                <a href={`/create?postId=${post.id}`} className="btn-ghost !py-1.5 !px-3 text-xs">
                  <Edit3 size={13} /> Edit
                </a>
                <button onClick={() => handleCopy(post)} className="btn-ghost !py-1.5 !px-3 text-xs">
                  {copiedId === post.id ? <Check size={13} className="text-brand-teal" /> : <Copy size={13} />}
                  {copiedId === post.id ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id}
                  className="btn-ghost !py-1.5 !px-3 text-xs !text-red-400 !border-red-100 hover:!bg-red-50">
                  {deleting === post.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {isLimited && (
        <div className="card p-6 text-center border-2 border-dashed border-[rgba(124,92,252,0.2)]">
          <p className="text-sm font-bold text-brand-dark mb-1">
            {visiblePosts.length - HISTORY_LIMIT} more post{visiblePosts.length - HISTORY_LIMIT === 1 ? '' : 's'} in your history
          </p>
          <p className="text-xs text-brand-muted mb-4">
            Free plans show your 10 most recent posts. Upgrade to see everything.
          </p>
          <a href="/pricing" className="btn-primary text-sm !py-2 !px-5 inline-flex">Upgrade Now</a>
        </div>
      )}
      {hasMore && (
        <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="btn-secondary w-full text-sm !py-3">
          Load more ({visiblePosts.length - shownPosts.length} remaining)
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR TAB (formerly /schedule)
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduledPost {
  id: string;
  content: string;
  scheduled_for: string;
  schedule_status: 'scheduled' | 'published' | 'failed' | 'cancelled' | null;
}
interface Slot { time: string; days: number[]; }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CalendarTab({ userId }: { userId: string }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [savingSlots, setSavingSlots] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const today = dateKey(new Date());

  const loadPosts = useCallback(async (uid: string, y: number, m: number) => {
    setLoading(true);
    const rangeStart = new Date(y, m - 1, 21).toISOString();
    const rangeEnd = new Date(y, m + 2, 10).toISOString();
    const { data } = await supabase.from('posts')
      .select('id, content, scheduled_for, schedule_status')
      .eq('user_id', uid).eq('schedule_status', 'scheduled')
      .gte('scheduled_for', rangeStart).lte('scheduled_for', rangeEnd)
      .order('scheduled_for', { ascending: true });
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      loadPosts(data.user.id, year, month);
      supabase.from('user_schedule_slots').select('slots').eq('user_id', data.user.id).single()
        .then(({ data: row }) => { if (row?.slots?.length) setSlots(row.slots); });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (userId) loadPosts(userId, year, month); }, [userId, year, month, loadPosts]);

  const postsByDay = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    for (const p of posts) {
      if (!p.scheduled_for) continue;
      const k = dateKey(new Date(p.scheduled_for));
      (map[k] ||= []).push(p);
    }
    return map;
  }, [posts]);

  const handleCancelScheduled = async (postId: string) => {
    setCancelingId(postId);
    try {
      const res = await apiFetch(`${API_URL}/api/schedule/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, postId }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setPosts(prev => prev.filter(p => p.id !== postId));
      setSelectedPost(null);
    } catch (err: any) {
      alert(err.message || 'Could not cancel scheduled post.');
    }
    setCancelingId(null);
  };

  const handleDrop = async (day: Date) => {
    setDragOverDay(null);
    if (!draggingId) return;
    const post = posts.find(p => p.id === draggingId);
    setDraggingId(null);
    if (!post) return;
    const original = new Date(post.scheduled_for);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), original.getHours(), original.getMinutes());
    if (dateKey(next) === dateKey(original)) return;
    if (next.getTime() < Date.now()) { alert("Can't reschedule a post into the past."); return; }
    const nextIso = next.toISOString();
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, scheduled_for: nextIso } : p));
    await supabase.from('posts').update({ scheduled_for: nextIso }).eq('id', post.id);
  };

  const saveSlots = async () => {
    setSavingSlots(true);
    await supabase.from('user_schedule_slots').upsert({ user_id: userId, slots, updated_at: new Date().toISOString() });
    setSavingSlots(false);
  };

  const addSlot = () => setSlots(s => [...s, { time: '12:00', days: [0, 1, 2, 3, 4, 5, 6] }]);
  const removeSlot = (i: number) => setSlots(s => s.filter((_, si) => si !== i));
  const toggleSlotDay = (i: number, day: number) => setSlots(s => s.map((slot, si) =>
    si === i ? { ...slot, days: slot.days.includes(day) ? slot.days.filter(d => d !== day) : [...slot.days, day] } : slot
  ));

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-extrabold text-brand-dark">
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-brand-muted hover:text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="text-xs font-semibold text-brand-purple px-2.5 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)] transition-colors">
            Today
          </button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-brand-muted hover:text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors">
            <ChevronRight size={16} />
          </button>
          <div className="ml-2">
            <button onClick={() => setSlotsOpen(true)} className="btn-secondary text-sm !py-2 !px-4 flex items-center gap-1.5">
              <Settings2 size={14} /> Posting times
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.06)]">
        {WEEKDAYS.map(d => (
          <div key={d} className="bg-[rgba(124,92,252,0.03)] text-center py-2 text-[11px] font-bold text-brand-muted uppercase tracking-wide">{d}</div>
        ))}
        {grid.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const k = dateKey(day);
          const dayPosts = postsByDay[k] || [];
          const isToday = k === today;
          return (
            <div key={i}
              onDragOver={e => { e.preventDefault(); setDragOverDay(k); }}
              onDragLeave={() => setDragOverDay(prev => prev === k ? null : prev)}
              onDrop={e => { e.preventDefault(); handleDrop(day); }}
              className={`min-h-[110px] p-1.5 flex flex-col gap-1 transition-colors ${
                inMonth ? 'bg-white' : 'bg-[rgba(0,0,0,0.015)]'
              } ${dragOverDay === k ? 'bg-[rgba(124,92,252,0.08)]' : ''}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday ? 'gradient-primary text-white' : inMonth ? 'text-brand-dark' : 'text-[#C4C4C4]'
                }`}>
                  {day.getDate()}
                </span>
                <a href={`/create?scheduleDate=${k}`} aria-label={`Schedule a post for ${k}`}
                  className="text-[13px] leading-none text-brand-muted hover:text-brand-purple opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity">
                  +
                </a>
              </div>
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                {dayPosts.slice(0, 3).map(p => (
                  <button key={p.id} draggable
                    onDragStart={() => setDraggingId(p.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setSelectedPost(p)}
                    className={`text-left text-[10px] leading-snug px-1.5 py-1 rounded-md bg-[rgba(124,92,252,0.08)] text-brand-purple font-medium truncate cursor-grab active:cursor-grabbing transition-opacity ${
                      draggingId === p.id ? 'opacity-30' : 'hover:bg-[rgba(124,92,252,0.14)]'
                    }`}>
                    {new Date(p.scheduled_for).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {(p.content || '').split('\n')[0].slice(0, 40) || 'Untitled'}
                  </button>
                ))}
                {dayPosts.length > 3 && <span className="text-[10px] text-brand-muted px-1.5">+{dayPosts.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <p className="text-[12px] text-brand-muted mt-3 flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" /> Loading scheduled posts...
        </p>
      )}
      <p className="text-[11px] text-brand-muted mt-4">
        Drag a post onto another day to reschedule it (same time of day is kept). Times shown in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
      </p>

      {/* Post detail popover */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedPost(null)}>
          <div className="card !p-5 w-full max-w-sm animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-brand-purple flex items-center gap-1.5">
                <Clock size={12} /> {new Date(selectedPost.scheduled_for).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
              <button onClick={() => setSelectedPost(null)} aria-label="Close" className="text-brand-muted hover:text-brand-purple">
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-brand-dark leading-relaxed whitespace-pre-wrap line-clamp-[8] mb-4">{selectedPost.content}</p>
            <div className="flex items-center gap-2">
              <a href={`/create?postId=${selectedPost.id}`} className="btn-secondary flex-1 text-xs !py-2 text-center">Edit</a>
              <button onClick={() => handleCancelScheduled(selectedPost.id)} disabled={cancelingId === selectedPost.id}
                className="flex-1 text-xs font-semibold text-red-500 border border-red-200 rounded-xl py-2 hover:bg-red-50 transition-colors disabled:opacity-50">
                {cancelingId === selectedPost.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posting times editor */}
      {slotsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSlotsOpen(false)}>
          <div className="card !p-5 w-full max-w-lg animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[14px] font-bold text-brand-dark">Your posting times</span>
              <button onClick={() => setSlotsOpen(false)} aria-label="Close" className="text-brand-muted hover:text-brand-purple">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-brand-muted mb-3">
              These are the default times Eclatale suggests when you schedule a post. Times are in your local time zone.
            </p>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-center border-collapse min-w-[420px]">
                <thead>
                  <tr>
                    <th className="text-[10px] font-bold text-brand-muted text-left pb-2">Time</th>
                    {WEEKDAYS.map(d => <th key={d} className="text-[10px] font-bold text-brand-muted pb-2">{d}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot, i) => (
                    <tr key={i}>
                      <td className="py-1">
                        <input type="time" value={slot.time}
                          onChange={e => setSlots(s => s.map((sl, si) => si === i ? { ...sl, time: e.target.value } : sl))}
                          className="text-[12px] border-0 bg-[rgba(0,0,0,0.03)] rounded-lg px-2 py-1 w-[90px]" />
                      </td>
                      {WEEKDAY_INDEX.map(jsDay => (
                        <td key={jsDay} className="py-1">
                          <input type="checkbox" checked={slot.days.includes(jsDay)} onChange={() => toggleSlotDay(i, jsDay)}
                            className="w-4 h-4 accent-[#7C5CFC] cursor-pointer" />
                        </td>
                      ))}
                      <td>
                        <button onClick={() => removeSlot(i)} aria-label="Remove time slot" className="text-brand-muted hover:text-red-500 p-1">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {slots.length === 0 && <p className="text-[11px] text-brand-muted py-3 text-center">No posting times set yet.</p>}
            <div className="flex items-center justify-between mt-3">
              <button onClick={addSlot} className="text-[12px] font-semibold text-brand-purple hover:underline">+ Add a time slot</button>
              <button onClick={saveSlots} disabled={savingSlots} className="btn-primary text-xs !py-2 !px-4">
                {savingSlots ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SHELL
// ─────────────────────────────────────────────────────────────────────────────

type CalTab = 'posts' | 'calendar';

export default function CalendarPage() {
  const [tab, setTab] = useState<CalTab>(() => {
    if (typeof window === 'undefined') return 'posts';
    const p = new URLSearchParams(window.location.search).get('tab');
    return p === 'calendar' ? 'calendar' : 'posts';
  });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
    });
  }, []);

  return (
    <AppShell mobileTitle="Calendar">
      <div className="min-h-screen gradient-bg-page pb-20 md:pb-0">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-between gap-3">
          <div className="flex gap-1 p-1 bg-[rgba(124,92,252,0.04)] rounded-xl">
            {([
              { id: 'posts',    label: 'All Posts' },
              { id: 'calendar', label: 'Calendar' },
            ] as { id: CalTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
                  tab === t.id ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-muted hover:text-brand-dark'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <a href="/create" className="btn-primary text-sm !py-2 !px-5">New Post</a>
        </div>

        <div className={`mx-auto px-5 md:px-8 py-6 md:py-10 ${tab === 'posts' ? 'max-w-3xl' : 'max-w-5xl'}`}>
          {/* Section title */}
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-extrabold text-brand-dark">
              {tab === 'posts' ? <>Content <span className="gradient-text">History</span></> : 'Scheduled Posts'}
            </h1>
            <p className="text-sm text-brand-muted mt-0.5">
              {tab === 'posts'
                ? 'All your AI-generated content in one place.'
                : 'Drag posts to reschedule. Click to view or cancel.'}
            </p>
          </div>

          {!userId ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-32 w-full" />)}</div>
          ) : (
            <>
              {tab === 'posts'    && <AllPostsTab userId={userId} />}
              {tab === 'calendar' && <CalendarTab userId={userId} />}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
