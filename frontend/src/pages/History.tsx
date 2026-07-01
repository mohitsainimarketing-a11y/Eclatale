import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Copy, Check, Trash2, Globe, FileText, MessageCircle, Image, Clock, Loader2, Sparkles } from 'lucide-react';

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, Analysis>>({});
  const [filterHook, setFilterHook] = useState('');
  const [filterTone, setFilterTone] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'readability'>('date');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login';
        return;
      }
      loadPosts(data.user.id);
    });
  }, []);

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
    navigator.clipboard.writeText(post.content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (postId: string) => {
    setDeleting(postId);
    await supabase.from('posts').delete().eq('id', postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setDeleting(null);
  };

  // Available filter options derived from loaded analytics.
  const { hookOptions, toneOptions, topicOptions } = useMemo(() => {
    const hooks = new Set<string>(), tones = new Set<string>(), topics = new Set<string>();
    Object.values(analytics).forEach(a => {
      if (a.hook_type) hooks.add(a.hook_type);
      if (a.tone_detected) tones.add(a.tone_detected);
      (a.topic_tags || []).forEach(t => topics.add(t));
    });
    return { hookOptions: Array.from(hooks), toneOptions: Array.from(tones), topicOptions: Array.from(topics) };
  }, [analytics]);

  const visiblePosts = useMemo(() => {
    let list = [...posts];
    if (filterHook) list = list.filter(p => analytics[p.id]?.hook_type === filterHook);
    if (filterTone) list = list.filter(p => analytics[p.id]?.tone_detected === filterTone);
    if (filterTopic) list = list.filter(p => (analytics[p.id]?.topic_tags || []).includes(filterTopic));
    if (sortBy === 'readability') {
      list.sort((a, b) => (analytics[b.id]?.readability_score || 0) - (analytics[a.id]?.readability_score || 0));
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [posts, analytics, filterHook, filterTone, filterTopic, sortBy]);

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
    <div className="min-h-screen gradient-bg-page pb-20 md:pb-0">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-2 -ml-2 text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <a href="/dashboard" className="text-lg font-extrabold gradient-text hidden sm:block">Eclatale</a>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-brand-muted font-medium">{posts.length} posts</span>
          <a href="/create" className="btn-primary text-sm !py-2 !px-5">New Post</a>
        </div>
      </nav>

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
            {/* Filter / sort bar (shown once semantic analysis exists) */}
            {hasAnalytics && (
              <div className="card p-3 flex flex-wrap items-center gap-2 mb-2">
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
                {topicOptions.length > 0 && (
                  <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark max-w-[160px]">
                    <option value="">All topics</option>
                    {topicOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <div className="flex-1" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-xs rounded-lg border border-[rgba(124,92,252,0.15)] px-2 py-1.5 bg-white text-brand-dark">
                  <option value="date">Newest first</option>
                  <option value="readability">Highest readability</option>
                </select>
                {(filterHook || filterTone || filterTopic) && (
                  <button onClick={() => { setFilterHook(''); setFilterTone(''); setFilterTopic(''); }} className="text-xs text-brand-purple font-semibold hover:underline">Clear</button>
                )}
              </div>
            )}
            {visiblePosts.map(post => {
              const isExpanded = expandedId === post.id;
              const analysis = analytics[post.id];
              const preview = post.content.length > 200 && !isExpanded
                ? post.content.substring(0, 200) + '...'
                : post.content;

              return (
                <div key={post.id} className="card card-hover p-5 md:p-6">
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
          </div>
        )}
      </div>
    </div>
  );
}
