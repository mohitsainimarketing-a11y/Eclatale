import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Sparkles, Search, Copy, RefreshCw, Edit3, Send,
  Briefcase, Coffee, Heart, BarChart3, Check, Loader2,
  FileText, MessageCircle, Image, Globe,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const TONES = [
  { id: 'professional', label: 'Professional', emoji: '💼', desc: 'Polished & authoritative', color: 'brand-purple' },
  { id: 'casual', label: 'Casual', emoji: '☕', desc: 'Conversational & relatable', color: 'brand-pink' },
  { id: 'inspirational', label: 'Inspirational', emoji: '✨', desc: 'Uplifting & motivational', color: 'brand-orange' },
  { id: 'data-driven', label: 'Data-Driven', emoji: '📊', desc: 'Facts & analytics first', color: 'brand-teal' },
];

const CONTENT_TYPES = [
  { id: 'linkedin-post', label: 'LinkedIn Post', icon: <Globe size={18} />, desc: 'Short-form' },
  { id: 'linkedin-article', label: 'Article', icon: <FileText size={18} />, desc: 'Long-form' },
  { id: 'twitter-thread', label: 'X Thread', icon: <MessageCircle size={18} />, desc: 'Multi-tweet' },
  { id: 'instagram-caption', label: 'Instagram', icon: <Image size={18} />, desc: 'Visual copy' },
];

export default function CreatePost() {
  const [userId, setUserId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('');
  const [contentType, setContentType] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [postId, setPostId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success?: boolean; error?: string; urn?: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    if (topicParam) setTopic(topicParam);

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login';
      else setUserId(data.user.id);
    });
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!userId) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`${API_URL}/api/suggest-topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ query, userId }),
      });
      const data = await res.json();
      if (data.topics) setSuggestions(data.topics);
    } catch { setSuggestions([]); }
    setLoadingSuggestions(false);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (topic.length >= 2) { fetchSuggestions(topic); setShowSuggestions(true); }
    }, 300);
    return () => clearTimeout(timer);
  }, [topic, fetchSuggestions]);

  const handleGenerate = async () => {
    if (!topic || !tone || !contentType || !userId) return;
    setIsGenerating(true); setError(''); setGeneratedContent('');
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, tone, contentType, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedContent(data.content); setEditedContent(data.content);
      const { data: insertedPost } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic, tone, content_type: contentType, source: 'auto',
      }).select('id').single();
      if (insertedPost) setPostId(insertedPost.id);
    } catch (err: any) { setError(err.message || 'Failed to generate.'); }
    setIsGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedContent : generatedContent);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    if (userId) {
      fetch(`${API_URL}/api/persona-signal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, action: 'kept', tone, contentType, topicSnippet: topic.substring(0, 100), postLength: generatedContent.length }),
      }).catch(() => {});
    }
  };

  const handlePublishLinkedIn = async () => {
    if (!postId || !userId) return;
    setPublishing(true); setPublishResult(null);
    try {
      const statusRes = await fetch(`${API_URL}/api/linkedin/status?userId=${userId}`);
      const statusData = await statusRes.json();
      if (!statusData.connected) {
        setPublishResult({ error: 'LinkedIn not connected. Connect it from your dashboard first.' });
        setPublishing(false);
        return;
      }
      const res = await fetch(`${API_URL}/api/linkedin/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ postId, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPublishResult({ success: true, urn: data.linkedinPostUrn });
    } catch (err: any) { setPublishResult({ error: err.message }); }
    setPublishing(false);
  };

  const canGenerate = topic && tone && contentType && !isGenerating;
  const displayContent = isEditing ? editedContent : generatedContent;

  return (
    <div className="min-h-screen gradient-bg-page">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-2 -ml-2 text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <a href="/dashboard" className="text-lg font-extrabold gradient-text hidden sm:block">Eclatale</a>
        </div>
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple">
          <Sparkles size={12} /> AI Generate
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
        {!generatedContent ? (
          <div className="animate-fadeIn">
            {/* Header */}
            <div className="text-center mb-8 md:mb-10">
              <h1 className="h2 text-brand-dark mb-2">Create <span className="gradient-text">Magnetic</span> Content</h1>
              <p className="body-text text-sm">AI-powered content tailored to your voice and audience.</p>
            </div>

            {/* Topic */}
            <div className="card p-5 md:p-6 mb-4">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">Topic</label>
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onFocus={() => { if (!suggestions.length) fetchSuggestions(topic); setShowSuggestions(true); }}
                  placeholder="What do you want to write about?"
                  className="input !pl-11 !text-base"
                />
                {loadingSuggestions && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-purple animate-spin" />}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="tiny text-brand-muted uppercase">Trending in your industry</p>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setTopic(s); setShowSuggestions(false); }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-brand-bg transition-colors text-sm text-brand-dark font-medium">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tone */}
            <div className="card p-5 md:p-6 mb-4">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">Tone</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {TONES.map(t => {
                  const selected = tone === t.id;
                  return (
                    <button key={t.id} onClick={() => setTone(t.id)}
                      className={`p-3.5 rounded-2xl border-[1.5px] transition-all text-center min-h-[44px] ${
                        selected ? 'border-brand-purple bg-[rgba(124,92,252,0.04)] shadow-brand' : 'border-[rgba(124,92,252,0.08)] hover:border-brand-purple/30'
                      }`}>
                      <div className="text-xl mb-1.5">{t.emoji}</div>
                      <div className="text-xs font-bold text-brand-dark">{t.label}</div>
                      <div className="text-[10px] text-brand-muted mt-0.5">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Type */}
            <div className="card p-5 md:p-6 mb-6">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">Format</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {CONTENT_TYPES.map(ct => {
                  const selected = contentType === ct.id;
                  return (
                    <button key={ct.id} onClick={() => setContentType(ct.id)}
                      className={`p-3.5 rounded-2xl border-[1.5px] transition-all text-center min-h-[44px] ${
                        selected ? 'border-brand-purple bg-[rgba(124,92,252,0.04)] shadow-brand' : 'border-[rgba(124,92,252,0.08)] hover:border-brand-purple/30'
                      }`}>
                      <div className={`mx-auto mb-1.5 ${selected ? 'text-brand-purple' : 'text-brand-muted'}`}>{ct.icon}</div>
                      <div className="text-xs font-bold text-brand-dark">{ct.label}</div>
                      <div className="text-[10px] text-brand-muted mt-0.5">{ct.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate */}
            <button onClick={handleGenerate} disabled={!canGenerate} className="btn-primary w-full md:w-auto md:mx-auto md:flex text-base">
              {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : <><Sparkles size={18} /> Generate Content</>}
            </button>
            {error && <div className="mt-4 card !bg-red-50 !border-red-100 p-4 text-sm text-red-600 font-medium text-center animate-shake">{error}</div>}
          </div>
        ) : (
          <div className="animate-slideUp space-y-5">
            {/* Result Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white"><Sparkles size={16} /></div>
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">Content ready</h3>
                  <p className="text-xs text-brand-muted">{displayContent.length} chars</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[11px]">{TONES.find(t => t.id === tone)?.label}</span>
              </div>
            </div>

            {/* Content */}
            <div className="card p-5 md:p-7">
              {isEditing ? (
                <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                  className="input !min-h-[280px] !resize-y !leading-relaxed !rounded-xl" />
              ) : (
                <div className="whitespace-pre-wrap text-brand-dark leading-relaxed text-[15px]">{displayContent}</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 justify-center">
              <button onClick={handleCopy} className="btn-secondary text-sm !py-3">
                {copied ? <Check size={16} className="text-brand-teal" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => { if (isEditing) setGeneratedContent(editedContent); setIsEditing(!isEditing); }}
                className={`btn-secondary text-sm !py-3 ${isEditing ? '!border-brand-teal !text-brand-teal' : ''}`}>
                <Edit3 size={16} /> {isEditing ? 'Save' : 'Edit'}
              </button>
              <button onClick={() => { setGeneratedContent(''); setEditedContent(''); handleGenerate(); }} className="btn-secondary text-sm !py-3">
                <RefreshCw size={16} /> Regenerate
              </button>
              <button onClick={handlePublishLinkedIn} disabled={publishing || publishResult?.success} className="btn-primary text-sm !py-3">
                {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> :
                 publishResult?.success ? <><Check size={16} /> Published!</> :
                 <><Send size={16} /> Post to LinkedIn</>}
              </button>
            </div>
            {publishResult?.error && (
              <div className="card !bg-red-50 !border-red-100 p-3 text-sm text-red-600 font-medium text-center mt-3 animate-shake">{publishResult.error}</div>
            )}
            {publishResult?.success && (
              <div className="card !bg-[rgba(6,214,160,0.06)] !border-brand-teal/20 p-3 text-sm text-brand-teal font-medium text-center mt-3 animate-fadeIn">
                Published to LinkedIn!
                {publishResult.urn && (
                  <a href={`https://www.linkedin.com/feed/update/${publishResult.urn}`} target="_blank" rel="noopener noreferrer" className="ml-2 underline">View post</a>
                )}
              </div>
            )}

            <div className="text-center">
              <button onClick={() => { setGeneratedContent(''); setEditedContent(''); setTopic(''); setTone(''); setContentType(''); setSuggestions([]); setError(''); }}
                className="text-sm text-brand-muted hover:text-brand-purple font-medium transition-colors">Start over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
