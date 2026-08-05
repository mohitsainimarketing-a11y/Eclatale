import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Copy, Check, Trash2, Globe, FileText, MessageCircle, Image, Clock, Loader2, Sparkles, Calendar, X, Search, Wand2 } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { useFeatureGate } from '../hooks/useFeatureGate';
import AppShell from '../components/AppShell';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

interface Analysis {
  post_id: string;
  hook_type: string;
  tone_detected: string;
  readability_score: number;
  topic_tags: string[];
}

const HOOK_LABELS: Record<string, string> = {
  question: 'Question hook',
  bold_statement: 'Bold statement',
  story: 'Story',
  statistic: 'Statistic',
  contrarian: 'Contrarian',
  list_preview: 'List preview',
};

const TONE_DETECTED_LABELS: Record<string, string> = {
  professional: 'Professional',
  casual: 'Casual',
  inspirational: 'Inspirational',
  data_driven: 'Data-driven',
};

function readabilityColor(score: number): string {
  if (score >= 70) return 'bg-[rgba(6,214,160,0.1)] text-brand-teal';
  if (score >= 40) return 'bg-[rgba(255,159,10,0.12)] text-amber-600';
  return 'bg-[rgba(255,69,58,0.1)] text-red-500';
}

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

function formatCountdown(target: string): string {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return 'due now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}, ${mins % 60} min${mins % 60 === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}, ${hours % 24} hour${hours % 24 === 1 ? '' : 's'}`;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'linkedin-post': <Globe size={14} />,
  'linkedin-article': <FileText size={14} />,
  'twitter-thread': <MessageCircle size={14} />,
  'instagram-caption': <Image size={14} />,
};

const TYPE_LABELS: Record<string, string> = {
  'linkedin-post': 'LinkedIn Post',
  'linkedin-article': 'Article',
  'twitter-thread': 'X Thread',
  'instagram-caption': 'Instagram',
};

const TONE_LABELS: Record<string, string> = {
  professional: 'Professional',
  casual: 'Casual',
  inspirational: 'Inspirational',
  'data-driven': 'Data-Driven',
};

export default function History() {
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
  const [userId, setUserId] = useState('');
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login';
        return;
      }
      setUserId(data.user.id);
      loadPosts(data.user.id);
    });
  }, []);

  // Re-render every 30s so scheduled-post countdowns stay live without a full reload.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const handleCancelScheduled = async (postId: string) => {
    setCancelingId(postId);
    try {
      const res = await apiFetch(`${API_URL}/api/schedule/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, postId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, schedule_status: 'cancelled', scheduled_for: null } : p));
    } catch (err: any) {
      alert(err.message || 'Could not cancel scheduled post.');
    }
    setCancelingId(null);
  };

  const loadPosts = async (userId: string) => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);

    // Load semantic analysis (guarded: table may not exist yet).
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
    } catch { /* analytics not available yet */ }
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

  // Available filter options derived from loaded analytics.
  const { hookOptions, toneOptions, tagCounts } = useMemo(() => {
    const hooks = new Set<string>(), tones = new Set<string>();
    const tags: Record<string, number> = {};
    Object.values(analytics).forEach(a => {
      if (a.hook_type) hooks.add(a.hook_type);
      if (a.tone_detected) tones.add(a.tone_detected);
      (a.topic_tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; });
    });
    const tagCounts = Object.entries(tags).sort((a, b) => b[1] - a[1]);
    return { hookOptions: Array.from(hooks), toneOptions: Array.from(tones), tagCounts };
  }, [analytics]);
  const toggleTag = (tag: string) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const visiblePosts = useMemo(() => {
    let list = [...posts];
    if (filterHook) list = list.filter(p => analytics[p.id]?.hook_type === filterHook);
    if (filterTone) list = list.filter(p => analytics[p.id]?.tone_detected === filterTone);
    if (selectedTags.length) list = list.filter(p => selectedTags.every(t => (analytics[p.id]?.topic_tags || []).includes(t)));
    const q = searchQuery.trim();
    if (q.startsWith('#')) {
      const tagQuery = q.slice(1).toLowerCase();
      if (tagQuery) list = list.filter(p => (analytics[p.id]?.topic_tags || []).some(t => t.toLowerCase().includes(tagQuery)));
    } else if (q) {
      list = list.filter(p => p.content.toLowerCase().includes(q.toLowerCase()) || p.topic?.toLowerCase().includes(q.toLowerCase()));
    }
    if (sortBy === 'readability') {
      list.sort((a, b) => (analytics[b.id]?.readability_score || 0) - (analytics[a.id]?.readability_score || 0));
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [posts, analytics, filterHook, filterTone, selectedTags, searchQuery, sortBy]);

  const { tier } = useFeatureGate('contentHistoryLimit');
  const HISTORY_LIMIT = 10;
  const isLimited = tier === 'free' && visiblePosts.length > HISTORY_LIMIT;

  // Individual-tier history is unbounded, so render in batches rather than
  // mounting every post card at once — avoids hundreds of DOM nodes (with
  // their own analysis fetches/badges) for long-time users.
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filterHook, filterTone, selectedTags, searchQuery, sortBy]);

  const shownPosts = isLimited ? visiblePosts.slice(0, HISTORY_LIMIT) : visiblePosts.slice(0, visibleCount);
  const hasMore = !isLimited && visiblePosts.length > shownPosts.length;

  const hasAnalytics = Object.keys(analytics).length > 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <AppShell mobileTitle="Content Library">
    <div className="min-h-screen gradient-bg-page pb-20 md:pb-0">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-end gap-3">
        <span className="text-sm text-brand-muted font-medium">{posts.length} posts</span>
        <a href="/create" className="btn-primary text-sm !py-2 !px-5">New Post</a>
      </div>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
        <div className="mb-8">
          <h1 className="h2 text-brand-dark mb-2">Content <span className="gradient-text">History</span></h1>
          <p className="body-text text-sm">All your AI-generated content in one place.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 w-full" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white mx-auto mb-5 opacity-60">
              <FileText size={28} />
            </div>
            <h3 className="text-lg font-bold text-brand-dark mb-2">No content yet</h3>
            <p className="text-sm text-brand-muted mb-6">Generate your first post and it will appear here.</p>
            <a href="/create" className="btn-primary text-sm">Create Your First Post</a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search your posts, or type # to search tags…"
                className="input !pl-11 !text-sm w-full" />
            </div>

            {/* Tag browser */}
            {tagCounts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tagCounts.slice(0, 20).map(([tag, count]) => (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors flex items-center gap-1 ${
                      selectedTags.includes(tag) ? 'border-brand-purple bg-[rgba(124,92,252,0.08)] text-brand-purple' : 'border-[rgba(0,0,0,0.08)] text-brand-muted hover:border-brand-purple/40'
                    }`}>
                    {tag} <span className="opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Filter / sort bar (shown once semantic analysis exists) */}
            {hasAnalytics && (
              <div className="card p-6 flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide flex items-center gap-1"><Sparkles size={11} /> Filter</span>
                {hookOptions.length > 0 && (
                  <select value={filterHook} onChange={e => setFilterHook(e.target.value)} className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark">
                    <option value="">All hooks</option>
                    {hookOptions.map(h => <option key={h} value={h}>{HOOK_LABELS[h] || h}</option>)}
                  </select>
                )}
                {toneOptions.length > 0 && (
                  <select value={filterTone} onChange={e => setFilterTone(e.target.value)} className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark">
                    <option value="">All tones</option>
                    {toneOptions.map(t => <option key={t} value={t}>{TONE_DETECTED_LABELS[t] || t}</option>)}
                  </select>
                )}
                <div className="flex-1" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark">
                  <option value="date">Newest first</option>
                  <option value="readability">Highest readability</option>
                </select>
                {(filterHook || filterTone || selectedTags.length > 0 || searchQuery) && (
                  <button onClick={() => { setFilterHook(''); setFilterTone(''); setSelectedTags([]); setSearchQuery(''); }} className="text-xs text-brand-purple font-semibold hover:underline">Clear</button>
                )}
              </div>
            )}
            {shownPosts.map(post => {
              const isExpanded = expandedId === post.id;
              const analysis = analytics[post.id];
              const preview = post.content.length > 200 && !isExpanded
                ? post.content.substring(0, 200) + '...'
                : post.content;

              return (
                <div key={post.id} className="card card-hover p-6 md:p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[11px]">
                        {TYPE_ICONS[post.content_type]} {TYPE_LABELS[post.content_type] || post.content_type}
                      </span>
                      <span className="badge bg-[rgba(247,37,133,0.08)] text-brand-pink text-[11px]">
                        {TONE_LABELS[post.tone] || post.tone}
                      </span>
                      {post.source === 'guided' && (
                        <span className="badge bg-[rgba(255,107,53,0.08)] text-brand-orange text-[11px]">Guided</span>
                      )}
                      {post.status === 'published' && (
                        <span className="badge bg-[rgba(6,214,160,0.08)] text-brand-teal text-[11px]">Published</span>
                      )}
                      {post.schedule_status === 'scheduled' && post.scheduled_for && (
                        <span className="badge bg-[rgba(17,138,178,0.08)] text-brand-blue text-[11px]">
                          <Calendar size={11} /> Scheduled — posts {formatCountdown(post.scheduled_for)}
                        </span>
                      )}
                      {post.schedule_status === 'failed' && (
                        <span className="badge bg-[rgba(255,69,58,0.08)] text-red-500 text-[11px]">Scheduling failed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-brand-muted text-xs font-medium">
                      <Clock size={12} />
                      {formatDate(post.created_at)}
                    </div>
                  </div>

                  {/* Topic */}
                  {post.topic && (
                    <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">{post.topic}</p>
                  )}

                  {/* Content */}
                  <div
                    className="whitespace-pre-wrap text-brand-dark text-[14px] leading-relaxed mb-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : post.id)}
                  >
                    {preview}
                  </div>
                  {post.content.length > 200 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : post.id)}
                      className="text-xs text-brand-purple font-semibold mb-3 hover:underline"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}

                  {/* Semantic tag row */}
                  {analysis ? (
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      {analysis.hook_type && (
                        <span className="badge bg-[rgba(124,92,252,0.06)] text-brand-purple text-[10px]">🪝 {HOOK_LABELS[analysis.hook_type] || analysis.hook_type}</span>
                      )}
                      {analysis.tone_detected && (
                        <span className="badge bg-[rgba(124,92,252,0.06)] text-brand-dark text-[10px]">🎙 {TONE_DETECTED_LABELS[analysis.tone_detected] || analysis.tone_detected}</span>
                      )}
                      {typeof analysis.readability_score === 'number' && (
                        <span className={`badge text-[10px] ${readabilityColor(analysis.readability_score)}`}>📖 {analysis.readability_score}</span>
                      )}
                      {(analysis.topic_tags || []).map(t => (
                        <span key={t} className="badge bg-[rgba(247,37,133,0.06)] text-brand-pink text-[10px]">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="badge bg-[rgba(124,92,252,0.05)] text-brand-muted text-[10px] inline-flex items-center gap-1">
                        <Loader2 size={9} className="animate-spin" /> Analyzing…
                      </span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-[rgba(124,92,252,0.06)]">
                    <span className="text-xs text-brand-muted">
                      {post.content.length} chars
                      {post.status === 'published' && post.linkedin_post_urn && (
                        <a href={`https://www.linkedin.com/feed/update/${post.linkedin_post_urn}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-brand-teal hover:underline">View on LinkedIn</a>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {post.schedule_status === 'scheduled' && (
                        <button
                          onClick={() => handleCancelScheduled(post.id)}
                          disabled={cancelingId === post.id}
                          className="btn-ghost !py-1.5 !px-3 text-xs !text-red-400 !border-red-100 hover:!bg-red-50"
                        >
                          {cancelingId === post.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                          Cancel
                        </button>
                      )}
                      <a
                        href={`/create/talk?template=${post.id}`}
                        className="btn-ghost !py-1.5 !px-3 text-xs"
                      >
                        <Wand2 size={13} /> Use as template
                      </a>
                      <button
                        onClick={() => handleCopy(post)}
                        className="btn-ghost !py-1.5 !px-3 text-xs"
                      >
                        {copiedId === post.id ? <Check size={13} className="text-brand-teal" /> : <Copy size={13} />}
                        {copiedId === post.id ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deleting === post.id}
                        className="btn-ghost !py-1.5 !px-3 text-xs !text-red-400 !border-red-100 hover:!bg-red-50"
                      >
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
                <p className="text-xs text-brand-muted mb-4">Free plans show your 10 most recent posts. Upgrade to see everything.</p>
                <a href="/pricing" className="btn-primary text-sm !py-2 !px-5 inline-flex">Upgrade Now</a>
              </div>
            )}
            {hasMore && (
              <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="btn-secondary w-full text-sm !py-3">
                Load more ({visiblePosts.length - shownPosts.length} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    </AppShell>
  );
}
