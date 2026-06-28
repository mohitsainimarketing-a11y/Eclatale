import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Sparkles, Copy, RefreshCw, Send, Check, Loader2,
  FileText, MessageCircle, Image, Globe, Lightbulb, Scissors,
  Wand2, ChevronLeft, Undo2, Calendar, PenTool, ExternalLink, ChevronDown,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const TONES = [
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'casual', label: 'Casual', emoji: '☕' },
  { id: 'inspirational', label: 'Inspirational', emoji: '✨' },
  { id: 'data-driven', label: 'Data-Driven', emoji: '📊' },
];

const CONTENT_TYPES = [
  { id: 'linkedin-post', label: 'LinkedIn Post', icon: <Globe size={13} /> },
  { id: 'linkedin-article', label: 'Article', icon: <FileText size={13} /> },
  { id: 'twitter-thread', label: 'X Thread', icon: <MessageCircle size={13} /> },
  { id: 'instagram-caption', label: 'Instagram', icon: <Image size={13} /> },
];

const CHAR_LIMIT = 3000;

type AssistantMode = 'cards' | 'ideas' | 'write' | 'repurpose' | 'improve';
type ActivityIcon = 'sparkles' | 'scissors' | 'wand' | 'refresh' | 'copy' | 'save' | 'send';

interface Activity {
  id: string;
  icon: ActivityIcon;
  text: string;
  time: string;
}

function ActivityIconEl({ type }: { type: ActivityIcon }) {
  const cls = 'text-brand-purple';
  const s = 11;
  if (type === 'sparkles') return <Sparkles size={s} className={cls} />;
  if (type === 'scissors') return <Scissors size={s} className={cls} />;
  if (type === 'wand')     return <Wand2 size={s} className={cls} />;
  if (type === 'refresh')  return <RefreshCw size={s} className={cls} />;
  if (type === 'copy')     return <Copy size={s} className={cls} />;
  if (type === 'save')     return <FileText size={s} className={cls} />;
  return <Send size={s} className={cls} />;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CreatePost() {
  // Auth + profile
  const [userId, setUserId] = useState<string | null>(null);
  const [hasPersona, setHasPersona] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userInitials, setUserInitials] = useState('');

  // Composer (right panel)
  const [composerContent, setComposerContent] = useState('');
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [contentType, setContentType] = useState('linkedin-post');
  const [tone, setTone] = useState('professional');
  const [postId, setPostId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success?: boolean; error?: string; urn?: string } | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);

  // Assistant (left panel)
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('cards');
  const [chatInput, setChatInput] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [refining, setRefining] = useState(false);
  const [improveRedirected, setImproveRedirected] = useState(false);

  // Ideas mode
  const [ideas, setIdeas] = useState<string[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  // Write mode
  const [writeTopic, setWriteTopic] = useState('');
  const [writeTone, setWriteTone] = useState('professional');
  const [writeContentType, setWriteContentType] = useState('linkedin-post');
  const [generating, setGenerating] = useState(false);

  // Repurpose mode
  const [repurposeText, setRepurposeText] = useState('');
  const [repurposeTone, setRepurposeTone] = useState('professional');
  const [repurposeContentType, setRepurposeContentType] = useState('linkedin-post');
  const [repurposing, setRepurposing] = useState(false);

  // UI
  const [mobileView, setMobileView] = useState<'compose' | 'assistant'>('compose');
  const [error, setError] = useState('');

  const toneRef = useRef<HTMLDivElement>(null);
  const activitiesEndRef = useRef<HTMLDivElement>(null);

  // ── INIT ──

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    if (topicParam) { setWriteTopic(topicParam); setAssistantMode('write'); }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      const u = data.user;
      setUserId(u.id);

      const meta = (u.user_metadata || {}) as Record<string, string>;
      const raw = meta.full_name || meta.name || (u.email?.split('@')[0] || '');
      const display = raw.replace(/[._\-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
      setUserName(display);
      const parts = display.split(' ').filter(Boolean);
      setUserInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : display.substring(0, 2).toUpperCase()
      );

      supabase.from('profiles').select('role, domain').eq('id', u.id).single()
        .then(({ data: p }) => {
          if (p) setUserRole([p.role, p.domain].filter(Boolean).join(' · '));
        });

      supabase.from('persona_profiles').select('persona_completed_at').eq('user_id', u.id).single()
        .then(({ data: persona }) => setHasPersona(!!persona?.persona_completed_at));
    });
  }, []);

  // Close tone dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll to newest activity
  useEffect(() => {
    if (activities.length > 0) {
      activitiesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activities.length]);

  // ── HELPERS ──

  const addActivity = useCallback((icon: ActivityIcon, text: string) => {
    setActivities(prev => [...prev, { id: Math.random().toString(36).slice(2), icon, text, time: nowTime() }]);
  }, []);

  const updateContent = useCallback((newContent: string) => {
    setComposerContent(prev => {
      if (prev) setContentHistory(h => [...h.slice(-19), prev]);
      return newContent;
    });
  }, []);

  const handleUndo = () => {
    if (contentHistory.length === 0) return;
    setComposerContent(contentHistory[contentHistory.length - 1]);
    setContentHistory(h => h.slice(0, -1));
  };

  // ── IDEAS ──

  const handleFetchIdeas = useCallback(async () => {
    if (!userId) return;
    setLoadingIdeas(true);
    try {
      const res = await fetch(`${API_URL}/api/suggest-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ query: '', userId }),
      });
      const data = await res.json();
      if (data.topics) setIdeas(data.topics);
    } catch { setIdeas([]); }
    setLoadingIdeas(false);
  }, [userId]);

  const handleGoIdeas = () => {
    setAssistantMode('ideas');
    if (ideas.length === 0) handleFetchIdeas();
  };

  // ── GENERATE ──

  const handleGenerate = async () => {
    if (!writeTopic.trim() || !userId) return;
    setGenerating(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic: writeTopic, tone: writeTone, contentType: writeContentType, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      setContentType(writeContentType);
      setTone(writeTone);
      setAssistantMode('cards');
      setImproveRedirected(false);
      setPublishResult(null);
      const label = CONTENT_TYPES.find(c => c.id === writeContentType)?.label || writeContentType;
      addActivity('sparkles', `Generated a ${label} about "${writeTopic.substring(0, 50)}${writeTopic.length > 50 ? '…' : ''}"`);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic: writeTopic,
        tone: writeTone, content_type: writeContentType, source: 'auto',
      }).select('id').single();
      if (inserted) setPostId(inserted.id);
    } catch (err: any) { setError(err.message || 'Failed to generate.'); }
    setGenerating(false);
  };

  // ── REPURPOSE ──

  const handleRepurpose = async () => {
    if (!repurposeText.trim() || !userId) return;
    setRepurposing(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/repurpose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ sourceText: repurposeText, contentType: repurposeContentType, tone: repurposeTone, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      setContentType(repurposeContentType);
      setTone(repurposeTone);
      setAssistantMode('cards');
      setPublishResult(null);
      const label = CONTENT_TYPES.find(c => c.id === repurposeContentType)?.label || repurposeContentType;
      addActivity('scissors', `Repurposed content as a ${label}`);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic: 'Repurposed content',
        tone: repurposeTone, content_type: repurposeContentType, source: 'repurpose',
      }).select('id').single();
      if (inserted) setPostId(inserted.id);
    } catch (err: any) { setError(err.message || 'Failed to repurpose.'); }
    setRepurposing(false);
  };

  // ── REFINE ──

  const handleRefineWithInstruction = async (instruction: string, activityLabel?: string) => {
    if (!composerContent || !instruction.trim() || !userId) return;
    setRefining(true);
    try {
      const res = await fetch(`${API_URL}/api/refine-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: composerContent, instruction, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      const label = activityLabel || `Applied: "${instruction.substring(0, 45)}${instruction.length > 45 ? '…' : ''}"`;
      addActivity('wand', label);
    } catch (err: any) { setError(err.message || 'Refinement failed'); }
    setRefining(false);
  };

  const handleRefine = () => {
    if (!chatInput.trim()) return;
    const instruction = chatInput.trim();
    setChatInput('');
    handleRefineWithInstruction(instruction);
  };

  // ── FORMAT ADAPTATION ──

  const handleAdaptFormat = async (newFormat: string) => {
    if (newFormat === contentType) return;
    setContentType(newFormat);
    if (!composerContent || !userId) return;
    setAdapting(true);
    try {
      const res = await fetch(`${API_URL}/api/adapt-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: composerContent, targetFormat: newFormat, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      const label = CONTENT_TYPES.find(c => c.id === newFormat)?.label || newFormat;
      addActivity('refresh', `Adapted to ${label}`);
    } catch { /* silent — content stays as-is */ }
    setAdapting(false);
  };

  // ── TONE SHIFT ──

  const handleToneShift = (newTone: string) => {
    setTone(newTone);
    setToneOpen(false);
    if (!composerContent || !userId) return;
    const toneLabel = TONES.find(t => t.id === newTone)?.label || newTone;
    handleRefineWithInstruction(
      `Rewrite this in a ${toneLabel.toLowerCase()} tone. Keep the same structure, story, and key points — only adjust voice and language.`,
      `Shifted tone to ${toneLabel}`
    );
  };

  // ── COMPOSER ACTIONS ──

  const handleCopy = () => {
    if (!composerContent) return;
    navigator.clipboard.writeText(composerContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addActivity('copy', 'Copied to clipboard');
    if (userId) {
      fetch(`${API_URL}/api/persona-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, action: 'kept', tone, contentType, topicSnippet: composerContent.substring(0, 100), postLength: composerContent.length }),
      }).catch(() => {});
    }
  };

  const handleSaveDraft = async () => {
    if (!composerContent || !userId) return;
    try {
      if (postId) {
        await supabase.from('posts').update({ content: composerContent, tone, content_type: contentType }).eq('id', postId);
      } else {
        const { data: inserted } = await supabase.from('posts').insert({
          user_id: userId, content: composerContent, topic: 'Draft',
          tone, content_type: contentType, source: 'auto',
        }).select('id').single();
        if (inserted) setPostId(inserted.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      addActivity('save', 'Saved as draft');
    } catch { }
  };

  const handleGenerateVisual = () => {
    if (!composerContent) return;
    window.location.href = `/create-visual?topic=${encodeURIComponent(composerContent.substring(0, 300))}`;
  };

  const handlePublish = async () => {
    if (!postId || !userId) return;
    setPublishing(true); setPublishResult(null);
    try {
      const statusRes = await fetch(`${API_URL}/api/linkedin/status?userId=${userId}`);
      const statusData = await statusRes.json();
      if (!statusData.connected) {
        setPublishResult({ error: 'LinkedIn not connected. Connect it from your dashboard.' });
        setPublishing(false);
        return;
      }
      await supabase.from('posts').update({ content: composerContent, tone, content_type: contentType }).eq('id', postId);
      const res = await fetch(`${API_URL}/api/linkedin/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ postId, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPublishResult({ success: true, urn: data.linkedinPostUrn });
      addActivity('send', 'Published to LinkedIn');
    } catch (err: any) { setPublishResult({ error: err.message }); }
    setPublishing(false);
  };

  // ── COMPUTED ──

  const charPct = Math.min(100, (composerContent.length / CHAR_LIMIT) * 100);
  const charColor = composerContent.length > 2800 ? 'text-red-500' : composerContent.length > 2400 ? 'text-amber-500' : 'text-brand-muted';
  const barColor = composerContent.length > 2800 ? 'bg-red-400' : composerContent.length > 2400 ? 'bg-amber-400' : 'bg-brand-purple';
  const currentTone = TONES.find(t => t.id === tone);

  const composerPlaceholder = contentType !== 'linkedin-post' && !composerContent
    ? `Generate a LinkedIn post first — then switch here to see it adapted as a ${CONTENT_TYPES.find(c => c.id === contentType)?.label}.`
    : 'Start typing, or ask the assistant on the left to write your first draft...';

  // ── SUB-COMPONENTS ──

  const ToneGrid = ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <div className="grid grid-cols-2 gap-1.5">
      {TONES.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3 py-2 rounded-xl border transition-all text-left flex items-center gap-2 ${
            value === t.id ? 'border-brand-purple bg-[rgba(124,92,252,0.04)] text-brand-purple' : 'border-[rgba(124,92,252,0.1)] text-brand-muted hover:border-brand-purple/30'
          }`}>
          <span className="text-sm">{t.emoji}</span>
          <span className="text-[11px] font-semibold">{t.label}</span>
        </button>
      ))}
    </div>
  );

  const FormatGrid = ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <div className="grid grid-cols-2 gap-1.5">
      {CONTENT_TYPES.map(ct => (
        <button key={ct.id} onClick={() => onChange(ct.id)}
          className={`px-3 py-2 rounded-xl border transition-all text-left flex items-center gap-2 ${
            value === ct.id ? 'border-brand-purple bg-[rgba(124,92,252,0.04)] text-brand-purple' : 'border-[rgba(124,92,252,0.1)] text-brand-muted hover:border-brand-purple/30'
          }`}>
          <span className={value === ct.id ? 'text-brand-purple' : 'text-brand-muted'}>{ct.icon}</span>
          <span className="text-[11px] font-semibold text-brand-dark">{ct.label}</span>
        </button>
      ))}
    </div>
  );

  const PanelBack = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={() => { setAssistantMode('cards'); setError(''); setImproveRedirected(false); }}
        className="w-7 h-7 rounded-lg hover:bg-[rgba(124,92,252,0.06)] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors">
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-bold text-brand-dark">{label}</span>
    </div>
  );

  // ── RENDER ──

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDF4FF 60%, #F5F0FF 100%)' }}>

      {/* Nav */}
      <nav className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-6 h-14 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-1.5 -ml-1.5 text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <a href="/dashboard" className="text-base font-extrabold gradient-text hidden sm:block">Eclatale</a>
        </div>
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[11px]">
          <Sparkles size={11} /> Create
        </div>
      </nav>

      {/* Mobile tab switcher */}
      <div className="md:hidden flex-shrink-0 flex border-b border-[rgba(124,92,252,0.06)] bg-white/60">
        <button
          onClick={() => setMobileView('compose')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${mobileView === 'compose' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-brand-muted'}`}>
          Compose
        </button>
        <button
          onClick={() => setMobileView('assistant')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${mobileView === 'assistant' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-brand-muted'}`}>
          AI Assistant
        </button>
      </div>

      {/* Two-panel workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── LEFT: AI ASSISTANT ── */}
        <aside className={`${mobileView === 'assistant' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[360px] lg:w-[400px] flex-shrink-0 border-r border-[rgba(124,92,252,0.07)] bg-white/50 overflow-hidden`}>

          {/* Header */}
          <div className="flex-shrink-0 px-5 py-3.5 border-b border-[rgba(124,92,252,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white flex-shrink-0">
                <Sparkles size={12} />
              </div>
              <span className="text-sm font-bold text-brand-dark">AI Assistant</span>
            </div>
            {hasPersona ? (
              <span className="badge bg-[rgba(6,214,160,0.08)] text-brand-teal text-[10px] !py-1">
                <Check size={10} /> In your voice
              </span>
            ) : (
              <a href="/persona-setup" className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[10px] !py-1 hover:bg-[rgba(124,92,252,0.12)] transition-colors">
                Set up voice
              </a>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">

            {/* ─ CARDS MODE ─ */}
            {assistantMode === 'cards' && (
              <div className="animate-fadeIn">
                <p className="text-[10px] text-brand-muted uppercase tracking-widest font-semibold mb-3">What would you like to do?</p>

                <div className="space-y-2.5">
                  <button onClick={handleGoIdeas}
                    className="w-full card !p-4 text-left hover:shadow-brand-md transition-all group flex items-start gap-3 !rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(124,92,252,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Lightbulb size={15} className="text-brand-purple" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-brand-dark">Help me find ideas</div>
                      <div className="text-[11px] text-brand-muted mt-0.5">AI-curated topics for your industry</div>
                    </div>
                  </button>

                  <button onClick={() => setAssistantMode('write')}
                    className="w-full card !p-4 text-left hover:shadow-brand-md transition-all group flex items-start gap-3 !rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(247,37,133,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <PenTool size={15} className="text-brand-pink" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-brand-dark">Help me write a post</div>
                      <div className="text-[11px] text-brand-muted mt-0.5">Generate from a topic or idea</div>
                    </div>
                  </button>

                  <button onClick={() => setAssistantMode('repurpose')}
                    className="w-full card !p-4 text-left hover:shadow-brand-md transition-all group flex items-start gap-3 !rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(255,107,53,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Scissors size={15} className="text-brand-orange" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-brand-dark">Repurpose something I found</div>
                      <div className="text-[11px] text-brand-muted mt-0.5">Paste an article, thread, or transcript</div>
                    </div>
                  </button>

                  {/* Fix 2: never disabled — auto-redirects to write if no content */}
                  <button
                    onClick={() => {
                      if (composerContent) {
                        setAssistantMode('improve');
                      } else {
                        setImproveRedirected(true);
                        setAssistantMode('write');
                      }
                    }}
                    className="w-full card !p-4 text-left hover:shadow-brand-md transition-all group flex items-start gap-3 !rounded-2xl cursor-pointer">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(6,214,160,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Wand2 size={15} className="text-brand-teal" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-brand-dark">Improve my draft</div>
                      <div className="text-[11px] text-brand-muted mt-0.5">
                        {composerContent ? 'Analyze and suggest improvements' : 'Write something first, then improve it'}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Fix 3: session activity thread */}
                {activities.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] text-brand-muted uppercase tracking-widest font-semibold mb-2">This session</p>
                    <div className="space-y-0.5">
                      {activities.map(a => (
                        <div key={a.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[rgba(124,92,252,0.03)] transition-colors">
                          <div className="w-5 h-5 rounded-lg bg-[rgba(124,92,252,0.06)] flex items-center justify-center flex-shrink-0">
                            <ActivityIconEl type={a.icon} />
                          </div>
                          <span className="text-[11px] text-brand-muted flex-1 leading-tight truncate">{a.text}</span>
                          <span className="text-[10px] text-brand-muted/40 flex-shrink-0 tabular-nums">{a.time}</span>
                        </div>
                      ))}
                      <div ref={activitiesEndRef} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─ IDEAS MODE ─ */}
            {assistantMode === 'ideas' && (
              <div className="animate-fadeIn">
                <PanelBack label="Find ideas" />
                {loadingIdeas ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
                  </div>
                ) : ideas.length > 0 ? (
                  <div className="space-y-2">
                    {ideas.map((idea, i) => (
                      <button key={i}
                        onClick={() => { setWriteTopic(idea); setAssistantMode('write'); }}
                        className="w-full card !p-3.5 text-left hover:shadow-brand transition-all group !rounded-2xl">
                        <div className="text-sm text-brand-dark font-medium group-hover:text-brand-purple transition-colors leading-snug">{idea}</div>
                        <div className="text-[10px] text-brand-muted mt-1.5 flex items-center gap-1">
                          <PenTool size={9} /> Click to write about this
                        </div>
                      </button>
                    ))}
                    <button onClick={handleFetchIdeas} disabled={loadingIdeas}
                      className="w-full btn-ghost text-xs !py-2.5 mt-1">
                      <RefreshCw size={11} /> New ideas
                    </button>
                  </div>
                ) : (
                  <button onClick={handleFetchIdeas} className="btn-primary w-full text-sm !py-3">
                    <Sparkles size={15} /> Generate ideas for my industry
                  </button>
                )}
              </div>
            )}

            {/* ─ WRITE MODE ─ */}
            {assistantMode === 'write' && (
              <div className="animate-fadeIn">
                <PanelBack label="Write a post" />

                {/* Fix 2: redirect notice */}
                {improveRedirected && (
                  <div className="flex items-center gap-2 bg-[rgba(124,92,252,0.05)] border border-[rgba(124,92,252,0.1)] rounded-xl px-3 py-2.5 mb-4">
                    <Wand2 size={12} className="text-brand-purple flex-shrink-0" />
                    <p className="text-[11px] text-brand-muted leading-tight">Let's start with a draft first, then we'll improve it.</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-2 block">Your topic or idea</label>
                    <textarea
                      value={writeTopic}
                      onChange={e => setWriteTopic(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && e.metaKey && handleGenerate()}
                      placeholder="What do you want to write about?"
                      className="input !text-sm !min-h-[80px] !resize-none w-full !leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-2 block">Tone</label>
                    <ToneGrid value={writeTone} onChange={setWriteTone} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-2 block">Format</label>
                    <FormatGrid value={writeContentType} onChange={setWriteContentType} />
                  </div>
                  {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                  <button onClick={handleGenerate} disabled={!writeTopic.trim() || generating}
                    className="btn-primary w-full text-sm !py-3">
                    {generating ? <><Loader2 size={15} className="animate-spin" /> Writing your post...</> : <><Sparkles size={15} /> Generate Post</>}
                  </button>
                </div>
              </div>
            )}

            {/* ─ REPURPOSE MODE ─ */}
            {assistantMode === 'repurpose' && (
              <div className="animate-fadeIn">
                <PanelBack label="Repurpose content" />
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-2 block">Paste the source</label>
                    <textarea
                      value={repurposeText}
                      onChange={e => setRepurposeText(e.target.value)}
                      placeholder="Paste an article, newsletter, tweet, podcast transcript, or your own notes..."
                      className="input !text-sm !min-h-[130px] !resize-none w-full !leading-relaxed"
                    />
                    <p className="text-[10px] text-brand-muted mt-1.5">The AI will extract key insights and rewrite in your voice.</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-2 block">Tone</label>
                    <ToneGrid value={repurposeTone} onChange={setRepurposeTone} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-2 block">Format</label>
                    <FormatGrid value={repurposeContentType} onChange={setRepurposeContentType} />
                  </div>
                  {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                  <button onClick={handleRepurpose} disabled={!repurposeText.trim() || repurposing}
                    className="btn-primary w-full text-sm !py-3">
                    {repurposing ? <><Loader2 size={15} className="animate-spin" /> Repurposing...</> : <><Scissors size={15} /> Repurpose This</>}
                  </button>
                </div>
              </div>
            )}

            {/* ─ IMPROVE MODE ─ */}
            {assistantMode === 'improve' && (
              <div className="animate-fadeIn">
                <PanelBack label="Improve your draft" />
                <p className="text-xs text-brand-muted mb-3">Quick edits, or type your own instruction below.</p>
                <div className="space-y-2">
                  {[
                    'Make the hook stronger',
                    'Make it shorter and punchier',
                    'Add a specific data point',
                    'Make the ending more compelling',
                    'More casual and conversational',
                    'Make it more data-driven',
                  ].map(suggestion => (
                    <button key={suggestion}
                      onClick={() => { setAssistantMode('cards'); handleRefineWithInstruction(suggestion); }}
                      disabled={refining}
                      className="w-full card !p-3 text-left hover:shadow-brand transition-all text-xs text-brand-dark font-medium !rounded-xl flex items-center justify-between group">
                      <span>{suggestion}</span>
                      <Send size={11} className="text-brand-muted group-hover:text-brand-purple transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-[rgba(124,92,252,0.06)] bg-white/40">
            {composerContent ? (
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                  placeholder="Make it shorter, add a stat, punchier hook..."
                  className="input !pr-12 !py-2.5 !text-sm w-full"
                  disabled={refining}
                />
                <button onClick={handleRefine} disabled={!chatInput.trim() || refining}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white disabled:opacity-40 transition-opacity">
                  {refining ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-brand-muted text-center py-1">Generate content first, then refine it here</p>
            )}
          </div>
        </aside>

        {/* Divider */}
        <div className="hidden md:block w-px flex-shrink-0" style={{ background: 'linear-gradient(to bottom, transparent, rgba(124,92,252,0.1) 20%, rgba(124,92,252,0.1) 80%, transparent)' }} />

        {/* ── RIGHT: POST COMPOSER ── */}
        <main className={`${mobileView === 'compose' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 overflow-hidden bg-white/30`}>

          {/* Format tabs + tone badge */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-[rgba(124,92,252,0.06)] flex items-center gap-1.5 flex-wrap bg-white/40">
            {CONTENT_TYPES.map(ct => (
              <button key={ct.id} onClick={() => handleAdaptFormat(ct.id)}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-all font-semibold flex items-center gap-1.5 ${
                  contentType === ct.id
                    ? 'border-brand-purple bg-[rgba(124,92,252,0.06)] text-brand-purple'
                    : 'border-[rgba(124,92,252,0.1)] text-brand-muted hover:border-brand-purple/30 hover:text-brand-dark'
                }`}>
                <span className="opacity-70">{ct.icon}</span> {ct.label}
              </button>
            ))}

            {/* Fix 5: interactive tone badge */}
            <div className="ml-auto relative" ref={toneRef}>
              <button
                onClick={() => setToneOpen(o => !o)}
                className="badge bg-[rgba(124,92,252,0.06)] text-brand-purple text-[10px] hover:bg-[rgba(124,92,252,0.1)] transition-colors cursor-pointer flex items-center gap-1">
                {currentTone?.emoji} {currentTone?.label}
                <ChevronDown size={10} className={`transition-transform duration-200 ${toneOpen ? 'rotate-180' : ''}`} />
              </button>
              {toneOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl shadow-brand-md border border-[rgba(124,92,252,0.08)] p-2 w-52 z-30 animate-fadeIn">
                  {composerContent && (
                    <p className="text-[10px] text-brand-muted px-2 pb-2 border-b border-[rgba(124,92,252,0.06)] mb-1 leading-relaxed">
                      Selecting a tone will rewrite your current draft.
                    </p>
                  )}
                  {TONES.map(t => (
                    <button key={t.id} onClick={() => handleToneShift(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
                        tone === t.id ? 'bg-[rgba(124,92,252,0.06)] text-brand-purple' : 'text-brand-dark hover:bg-[rgba(124,92,252,0.04)]'
                      }`}>
                      {t.emoji} {t.label}
                      {tone === t.id && <Check size={11} className="ml-auto text-brand-purple" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fix 1: LinkedIn post preview shell */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-5 md:p-8 min-h-full">
              <div className="max-w-[640px] mx-auto">
                <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] shadow-[0_2px_16px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.03)]">

                  {/* Profile header */}
                  <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none">
                      {userInitials || 'Y'}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="text-sm font-bold text-brand-dark leading-tight truncate">
                        {userName || 'Your Name'}
                      </div>
                      <div className="text-[11px] text-brand-muted leading-tight mt-0.5 truncate">
                        {userRole || 'Complete your voice profile to personalize this'}
                      </div>
                      <div className="text-[10px] text-brand-muted/50 mt-1 flex items-center gap-1">
                        Just now · <Globe size={8} />
                      </div>
                    </div>
                  </div>

                  {/* Editable content */}
                  <div className="px-5 pb-6">
                    {adapting ? (
                      <div className="min-h-[260px] flex flex-col items-center justify-center gap-3">
                        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                          <Loader2 size={17} className="animate-spin text-white" />
                        </div>
                        <p className="text-xs text-brand-muted font-medium">
                          Adapting to {CONTENT_TYPES.find(c => c.id === contentType)?.label}...
                        </p>
                      </div>
                    ) : (
                      <textarea
                        value={composerContent}
                        onChange={e => setComposerContent(e.target.value)}
                        placeholder={composerPlaceholder}
                        className="w-full resize-none border-0 bg-transparent text-brand-dark text-[15px] leading-[1.75] focus:outline-none placeholder:text-brand-muted/30 font-[inherit] min-h-[280px]"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Char counter */}
          <div className="flex-shrink-0 px-5 py-2.5 flex items-center gap-3 border-t border-[rgba(124,92,252,0.04)] bg-white/20">
            <div className="flex-1 h-1 rounded-full bg-[rgba(124,92,252,0.06)]">
              <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${charPct}%` }} />
            </div>
            <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${charColor}`}>
              {composerContent.length.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
            </span>
            {contentHistory.length > 0 && (
              <button onClick={handleUndo}
                className="text-[11px] text-brand-purple flex items-center gap-1 hover:underline flex-shrink-0 font-medium">
                <Undo2 size={11} /> Undo
              </button>
            )}
          </div>

          {/* Action bar */}
          <div className="flex-shrink-0 px-5 py-3 border-t border-[rgba(124,92,252,0.06)] bg-white/40 flex flex-wrap items-center gap-2">
            <button onClick={handleCopy} disabled={!composerContent}
              className="btn-secondary text-xs !py-2 !px-3.5 disabled:opacity-40">
              {copied ? <><Check size={13} className="text-brand-teal" /> Copied!</> : <><Copy size={13} /> Copy</>}
            </button>
            <button onClick={handleSaveDraft} disabled={!composerContent}
              className="btn-secondary text-xs !py-2 !px-3.5 disabled:opacity-40">
              {saved ? <><Check size={13} className="text-brand-teal" /> Saved</> : <><FileText size={13} /> Save Draft</>}
            </button>
            <button onClick={handleGenerateVisual} disabled={!composerContent}
              className="btn-secondary text-xs !py-2 !px-3.5 disabled:opacity-40"
              title="Opens Visual Creator with your post content">
              <Image size={13} /> Visual
            </button>
            <div className="flex-1 min-w-0" />
            <button disabled={!composerContent}
              className="btn-ghost text-xs !py-2 !px-3.5 disabled:opacity-40"
              title="Scheduled posting coming soon">
              <Calendar size={13} /> Schedule
            </button>
            <button onClick={handlePublish}
              disabled={!composerContent || !postId || publishing || !!publishResult?.success}
              className="btn-primary text-xs !py-2 !px-3.5 disabled:opacity-40">
              {publishing ? <><Loader2 size={13} className="animate-spin" /> Publishing...</>
                : publishResult?.success ? <><Check size={13} /> Published!</>
                : <><Send size={13} /> Post to LinkedIn</>}
            </button>
          </div>

          {/* Publish feedback */}
          {publishResult?.error && (
            <div className="flex-shrink-0 mx-5 mb-3 card !bg-red-50 !border-red-100 p-3 text-xs text-red-600 font-medium text-center animate-shake">
              {publishResult.error}
            </div>
          )}
          {publishResult?.success && (
            <div className="flex-shrink-0 mx-5 mb-3 card !bg-[rgba(6,214,160,0.06)] !border-brand-teal/20 p-3 text-xs text-brand-teal font-medium text-center animate-fadeIn flex items-center justify-center gap-2">
              Published to LinkedIn!
              {publishResult.urn && (
                <a href={`https://www.linkedin.com/feed/update/${publishResult.urn}`}
                  target="_blank" rel="noopener noreferrer"
                  className="underline flex items-center gap-1">
                  View post <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
