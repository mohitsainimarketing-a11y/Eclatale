import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Sparkles, Copy, RefreshCw, Send, Check, Loader2,
  FileText, Image, Lightbulb, Scissors,
  Wand2, Undo2, Calendar, PenTool, ExternalLink,
  ChevronDown, X, Download, Eye, EyeOff,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const TONES = [
  { id: 'professional',  label: 'Professional',  emoji: '💼' },
  { id: 'casual',        label: 'Casual',         emoji: '☕' },
  { id: 'inspirational', label: 'Inspirational',  emoji: '✨' },
  { id: 'data-driven',   label: 'Data-Driven',    emoji: '📊' },
];

const CONTENT_TYPES = [
  { id: 'linkedin-post',     label: 'LinkedIn Post', short: 'LinkedIn'  },
  { id: 'linkedin-article',  label: 'Article',       short: 'Article'   },
  { id: 'twitter-thread',    label: 'X Thread',      short: 'X Thread'  },
  { id: 'instagram-caption', label: 'Instagram',     short: 'Instagram' },
];

const VISUAL_STYLES = [
  { id: 'minimal',       label: 'Minimal',       emoji: '🤍' },
  { id: 'bold',          label: 'Bold',           emoji: '🔥' },
  { id: 'professional',  label: 'Professional',   emoji: '💼' },
  { id: 'illustrated',   label: 'Illustrated',    emoji: '🎨' },
  { id: 'dataviz',       label: 'Data Viz',       emoji: '📊' },
];

const IMPROVE_CHIPS = [
  'Stronger hook', 'Shorter & punchier', 'Add a data point',
  'More casual', 'Better ending', 'More data-driven',
];

const CHAR_LIMIT = 3000;

// ── Types ────────────────────────────────────────────────────────────────────

type FlowType = null | 'write' | 'repurpose' | 'improve';
type MsgType = 'text' | 'activity' | 'ideas' | 'improve-options' | 'repurpose-input';
type ActivityIcon = 'sparkles' | 'scissors' | 'wand' | 'refresh' | 'copy' | 'save' | 'send';

interface ChatMsg {
  id: string;
  role: 'bot' | 'user';
  content: string;
  type: MsgType;
  activityIcon?: ActivityIcon;
  time?: string;
  ideas?: string[];
}

function AIcon({ type, size = 11 }: { type: ActivityIcon; size?: number }) {
  const cls = 'text-brand-purple';
  if (type === 'sparkles') return <Sparkles size={size} className={cls} />;
  if (type === 'scissors') return <Scissors size={size} className={cls} />;
  if (type === 'wand')     return <Wand2    size={size} className={cls} />;
  if (type === 'refresh')  return <RefreshCw size={size} className={cls} />;
  if (type === 'copy')     return <Copy     size={size} className={cls} />;
  if (type === 'save')     return <FileText size={size} className={cls} />;
  return <Send size={size} className={cls} />;
}

function uid() { return Math.random().toString(36).slice(2); }
function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

// ── Component ────────────────────────────────────────────────────────────────

export default function CreatePost() {
  // Auth + profile
  const [userId, setUserId]       = useState<string | null>(null);
  const [hasPersona, setHasPersona] = useState(false);
  const [userName, setUserName]   = useState('');
  const [userRole, setUserRole]   = useState('');
  const [userInitials, setUserInitials] = useState('');

  // Composer
  const [composerContent, setComposerContent] = useState('');
  const [contentHistory, setContentHistory]   = useState<string[]>([]);
  const [contentType, setContentType]         = useState('linkedin-post');
  const [tone, setTone]                       = useState('professional');
  const [postId, setPostId]                   = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success?: boolean; error?: string; urn?: string } | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);

  // Visual attachment
  const [attachedImage, setAttachedImage]     = useState<string | null>(null);
  const [visualModalOpen, setVisualModalOpen] = useState(false);
  const [visualPreview, setVisualPreview]     = useState<string | null>(null);
  const [visualStyle, setVisualStyle]         = useState('minimal');
  const [generatingVisual, setGeneratingVisual] = useState(false);
  const [visualError, setVisualError]         = useState('');
  const [showTextOverlay, setShowTextOverlay] = useState(true);
  const [ideasView, setIdeasView]             = useState(false);
  const [ideasList, setIdeasList]             = useState<string[]>([]);
  const [loadingIdeas, setLoadingIdeas]       = useState(false);

  // Conversational assistant
  const [chatMsgs, setChatMsgs]   = useState<ChatMsg[]>([]);
  const [activeFlow, setActiveFlow] = useState<FlowType>(null);
  const [chatInput, setChatInput] = useState('');
  const [generating, setGenerating]   = useState(false);
  const [repurposing, setRepurposing] = useState(false);
  const [repurposeText, setRepurposeText] = useState('');
  const [refining, setRefining]   = useState(false);

  // UI
  const [mobileView, setMobileView] = useState<'compose' | 'assistant'>('compose');
  const [error, setError] = useState('');

  const toneRef    = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    if (topicParam) {
      addMsg('bot', "What would you like to write about? I've pre-filled the topic below.", 'text');
      setChatInput(topicParam);
      setActiveFlow('write');
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      const u = data.user;
      setUserId(u.id);
      const meta = (u.user_metadata || {}) as Record<string, string>;
      const raw = meta.full_name || meta.name || (u.email?.split('@')[0] || '');
      const display = raw.replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
      setUserName(display);
      const parts = display.split(' ').filter(Boolean);
      setUserInitials(parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : display.substring(0, 2).toUpperCase());
      supabase.from('profiles').select('role, domain').eq('id', u.id).single()
        .then(({ data: p }) => { if (p) setUserRole([p.role, p.domain].filter(Boolean).join(' · ')); });
      supabase.from('persona_profiles').select('persona_completed_at').eq('user_id', u.id).single()
        .then(({ data: persona }) => setHasPersona(!!persona?.persona_completed_at));
    });
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chatMsgs.length]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const addMsg = (role: ChatMsg['role'], content: string, type: MsgType = 'text', extra?: Partial<ChatMsg>) => {
    setChatMsgs(prev => [...prev, { id: uid(), role, content, type, time: nowTime(), ...extra }]);
  };

  const addActivity = (icon: ActivityIcon, text: string) => {
    setChatMsgs(prev => [...prev, { id: uid(), role: 'bot', content: text, type: 'activity', activityIcon: icon, time: nowTime() }]);
  };

  const updateContent = useCallback((newContent: string) => {
    setComposerContent(prev => {
      if (prev) setContentHistory(h => [...h.slice(-19), prev]);
      return newContent;
    });
  }, []);

  const handleUndo = () => {
    if (!contentHistory.length) return;
    setComposerContent(contentHistory[contentHistory.length - 1]);
    setContentHistory(h => h.slice(0, -1));
  };

  // ── Card clicks ───────────────────────────────────────────────────────────

  const handleCardIdeas = async () => {
    setIdeasView(true);
    setIdeasList([]);
    setLoadingIdeas(true);
    try {
      const res = await fetch(`${API_URL}/api/suggest-topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ query: '', userId }),
      });
      const data = await res.json();
      if (data.topics) setIdeasList(data.topics);
    } catch { }
    setLoadingIdeas(false);
  };

  const handleCardWrite = () => {
    addMsg('bot', "What would you like to write about? I'll use your current format and tone settings.", 'text');
    setActiveFlow('write');
  };

  const handleCardRepurpose = () => {
    addMsg('bot', `Paste the content you'd like to repurpose. I'll rewrite it as a ${CONTENT_TYPES.find(c => c.id === contentType)?.label || 'LinkedIn Post'} in a ${TONES.find(t => t.id === tone)?.label || 'Professional'} tone.`, 'repurpose-input');
    setActiveFlow('repurpose');
  };

  const handleCardImprove = () => {
    if (composerContent) {
      addMsg('bot', 'How would you like to improve it? Pick a quick edit or type your own instruction below.', 'improve-options');
      setActiveFlow('improve');
    } else {
      addMsg('bot', "Let's write something first. What would you like to post about?", 'text');
      setActiveFlow('write');
    }
  };

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async (topic: string) => {
    if (!topic.trim() || !userId) return;
    setGenerating(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, tone, contentType, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      setPublishResult(null);
      setActiveFlow(null);
      const label = CONTENT_TYPES.find(c => c.id === contentType)?.label || contentType;
      addActivity('sparkles', `Generated a ${label} about "${topic.substring(0, 50)}${topic.length > 50 ? '…' : ''}"`);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic,
        tone, content_type: contentType, source: 'auto',
      }).select('id').single();
      if (inserted) setPostId(inserted.id);
    } catch (err: any) {
      addMsg('bot', `Sorry, couldn't generate: ${err.message || 'unknown error'}`, 'text');
    }
    setGenerating(false);
  };

  // ── Repurpose ─────────────────────────────────────────────────────────────

  const handleRepurpose = async () => {
    if (!repurposeText.trim() || !userId) return;
    setRepurposing(true);
    try {
      const res = await fetch(`${API_URL}/api/repurpose`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ sourceText: repurposeText, contentType, tone, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      setPublishResult(null);
      setActiveFlow(null);
      const label = CONTENT_TYPES.find(c => c.id === contentType)?.label || contentType;
      addActivity('scissors', `Repurposed content as a ${label}`);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic: 'Repurposed content',
        tone, content_type: contentType, source: 'repurpose',
      }).select('id').single();
      if (inserted) setPostId(inserted.id);
    } catch (err: any) {
      addMsg('bot', `Repurpose failed: ${err.message || 'unknown error'}`, 'text');
    }
    setRepurposing(false);
  };

  // ── Refine ────────────────────────────────────────────────────────────────

  const handleRefineWithInstruction = async (instruction: string, label?: string) => {
    if (!composerContent || !instruction.trim() || !userId) return;
    setRefining(true);
    try {
      const res = await fetch(`${API_URL}/api/refine-content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: composerContent, instruction, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      addActivity('wand', label || `Applied: "${instruction.substring(0, 45)}${instruction.length > 45 ? '…' : ''}"`);
    } catch (err: any) { setError(err.message || 'Refinement failed'); }
    setRefining(false);
  };

  // ── Chat submit ───────────────────────────────────────────────────────────

  const handleChatSubmit = async () => {
    const input = chatInput.trim();
    if (!input) return;
    setChatInput('');
    addMsg('user', input, 'text');

    if (activeFlow === 'write') {
      setActiveFlow(null);
      await handleGenerate(input);
    } else if (activeFlow === 'improve' || (activeFlow === null && composerContent)) {
      setActiveFlow(null);
      await handleRefineWithInstruction(input);
    }
  };

  const handleIdeaSelect = (idea: string) => {
    setIdeasView(false);
    addMsg('user', idea, 'text');
    setActiveFlow(null);
    handleGenerate(idea);
  };

  const handleImproveChip = (suggestion: string) => {
    addMsg('user', suggestion, 'text');
    setActiveFlow(null);
    handleRefineWithInstruction(suggestion);
  };

  // ── Format adaptation ─────────────────────────────────────────────────────

  const handleAdaptFormat = async (newFormat: string) => {
    if (newFormat === contentType) return;
    setContentType(newFormat);
    if (!composerContent || !userId) return;
    setAdapting(true);
    try {
      const res = await fetch(`${API_URL}/api/adapt-content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: composerContent, targetFormat: newFormat, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      addActivity('refresh', `Adapted to ${CONTENT_TYPES.find(c => c.id === newFormat)?.label}`);
    } catch { /* silent — content stays as-is */ }
    setAdapting(false);
  };

  // ── Tone shift ────────────────────────────────────────────────────────────

  const handleToneShift = (newTone: string) => {
    setTone(newTone);
    setToneOpen(false);
    if (!composerContent || !userId) return;
    const label = TONES.find(t => t.id === newTone)?.label || newTone;
    handleRefineWithInstruction(
      `Rewrite this in a ${label.toLowerCase()} tone. Keep the same structure, story, and key points.`,
      `Shifted tone to ${label}`
    );
  };

  // ── Visual ────────────────────────────────────────────────────────────────

  const handleGenerateVisual = async () => {
    if (!userId) return;
    setGeneratingVisual(true); setVisualError(''); setVisualPreview(null);
    try {
      const topic = (composerContent.split('\n').find(l => l.trim()) || composerContent).substring(0, 80);
      const res = await fetch(`${API_URL}/api/generate-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, format: 'square', style: visualStyle, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVisualPreview(data.imageUrl);
    } catch (err: any) { setVisualError(err.message || 'Image generation failed'); }
    setGeneratingVisual(false);
  };

  const handleUseVisual = () => {
    setAttachedImage(visualPreview);
    setVisualModalOpen(false);
    setVisualPreview(null);
    addActivity('sparkles', 'Added a visual to the post');
  };

  // ── Composer actions ──────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!composerContent) return;
    navigator.clipboard.writeText(composerContent);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    addActivity('copy', 'Copied to clipboard');
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
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      addActivity('save', 'Saved as draft');
    } catch { }
  };

  const handlePublish = async () => {
    if (!composerContent || !userId) return;
    setPublishing(true); setPublishResult(null);
    try {
      const statusRes = await fetch(`${API_URL}/api/linkedin/status?userId=${userId}`);
      const statusData = await statusRes.json();
      if (!statusData.connected) {
        setPublishResult({ error: 'LinkedIn not connected. Connect it from your dashboard.' });
        setPublishing(false); return;
      }
      let activePostId = postId;
      if (activePostId) {
        await supabase.from('posts').update({ content: composerContent, tone, content_type: contentType }).eq('id', activePostId);
      } else {
        const { data: inserted } = await supabase.from('posts').insert({
          user_id: userId, content: composerContent, topic: 'Draft',
          tone, content_type: contentType, source: 'manual',
        }).select('id').single();
        if (inserted) { activePostId = inserted.id; setPostId(inserted.id); }
      }
      if (!activePostId) throw new Error('Failed to save post. Please try again.');
      const res = await fetch(`${API_URL}/api/linkedin/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ postId: activePostId, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPublishResult({ success: true, urn: data.linkedinPostUrn });
      addActivity('send', 'Published to LinkedIn');
    } catch (err: any) { setPublishResult({ error: err.message }); }
    setPublishing(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const charLen  = composerContent.length;
  const charPct  = Math.min(100, (charLen / CHAR_LIMIT) * 100);
  const charColor = charLen > 2900 ? 'text-red-500' : charLen > 2500 ? 'text-amber-500' : 'text-brand-muted';
  const barColor  = charLen > 2900 ? 'bg-red-400' : charLen > 2500 ? 'bg-amber-400' : 'bg-brand-purple';
  const currentTone = TONES.find(t => t.id === tone);

  const chatDisabled = !composerContent && activeFlow === null;
  const chatPlaceholder = activeFlow === 'write'
    ? 'Type your topic or idea…'
    : activeFlow === 'repurpose'
    ? ''
    : chatDisabled
    ? 'Generate a post first, then ask me to refine it'
    : 'e.g. make the hook stronger, add a stat, shorten this…';

  const composerPlaceholder = contentType !== 'linkedin-post' && !composerContent
    ? `Generate a post first — switch here to see it adapted as a ${CONTENT_TYPES.find(c => c.id === contentType)?.label}.`
    : 'Start typing, or ask the assistant to write your first draft…';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#EAE5F5]">

      {/* Nav */}
      <nav className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-6 h-14 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-1.5 -ml-1.5 text-brand-muted hover:text-brand-purple transition-colors"><ArrowLeft size={18} /></a>
          <a href="/dashboard" className="text-base font-extrabold gradient-text hidden sm:block">Eclatale</a>
        </div>
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[11px]">
          <Sparkles size={11} /> Create
        </div>
      </nav>

      {/* Mobile tab switcher */}
      <div className="md:hidden flex-shrink-0 flex border-b border-[rgba(124,92,252,0.06)] bg-white/60">
        <button onClick={() => setMobileView('compose')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${mobileView === 'compose' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-brand-muted'}`}>Compose</button>
        <button onClick={() => setMobileView('assistant')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${mobileView === 'assistant' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-brand-muted'}`}>AI Assistant</button>
      </div>

      {/* Centered workspace — floats on page bg on wide screens */}
      <div className="flex-1 min-h-0 overflow-hidden flex items-stretch justify-center md:px-6 md:py-5">
        <div className="w-full max-w-[960px] flex min-h-0 bg-white rounded-none md:rounded-2xl md:border md:border-[rgba(0,0,0,0.08)] md:shadow-[0_4px_32px_rgba(0,0,0,0.1)] overflow-hidden">

        {/* ── LEFT: AI ASSISTANT ────────────────────────────────────────────── */}
        <aside className={`${mobileView === 'assistant' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[340px] flex-shrink-0 border-r border-[rgba(124,92,252,0.07)] bg-white/50 overflow-hidden`}>

          {/* Header */}
          <div className="flex-shrink-0 px-5 py-3.5 border-b border-[rgba(124,92,252,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white flex-shrink-0">
                <Sparkles size={12} />
              </div>
              <span className="text-sm font-bold text-brand-dark">AI Assistant</span>
            </div>
            {hasPersona ? (
              <span className="badge bg-[rgba(6,214,160,0.08)] text-brand-teal text-[10px] !py-1"><Check size={10} /> In your voice</span>
            ) : (
              <a href="/persona-setup" className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[10px] !py-1 hover:bg-[rgba(124,92,252,0.12)] transition-colors">Set up voice</a>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Quick-action cards */}
            <div>
              <p className="text-[10px] text-brand-muted uppercase tracking-widest font-semibold mb-3">Quick actions</p>
              <div className="space-y-2">

                <button onClick={handleCardIdeas}
                  className="w-full card !p-3.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
                  <div className="w-7 h-7 rounded-xl bg-[rgba(124,92,252,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Lightbulb size={13} className="text-brand-purple" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-brand-dark">Find ideas</div>
                    <div className="text-[10px] text-brand-muted">AI-curated topics for your industry</div>
                  </div>
                </button>

                <button onClick={handleCardWrite}
                  className="w-full card !p-3.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
                  <div className="w-7 h-7 rounded-xl bg-[rgba(247,37,133,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <PenTool size={13} className="text-brand-pink" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-brand-dark">Write a post</div>
                    <div className="text-[10px] text-brand-muted">Generate from a topic or idea</div>
                  </div>
                </button>

                <button onClick={handleCardRepurpose}
                  className="w-full card !p-3.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
                  <div className="w-7 h-7 rounded-xl bg-[rgba(255,107,53,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Scissors size={13} className="text-brand-orange" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-brand-dark">Repurpose content</div>
                    <div className="text-[10px] text-brand-muted">Paste an article, thread, or transcript</div>
                  </div>
                </button>

                <button onClick={handleCardImprove}
                  className="w-full card !p-3.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
                  <div className="w-7 h-7 rounded-xl bg-[rgba(6,214,160,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Wand2 size={13} className="text-brand-teal" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-brand-dark">Improve my draft</div>
                    <div className="text-[10px] text-brand-muted">{composerContent ? 'Suggest improvements' : 'Write something first, then improve it'}</div>
                  </div>
                </button>

              </div>
            </div>

            {/* Chat thread */}
            {chatMsgs.length > 0 && (
              <div className="space-y-2">
                {chatMsgs.map(msg => {
                  if (msg.type === 'activity') {
                    return (
                      <div key={msg.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[rgba(124,92,252,0.03)] transition-colors">
                        <div className="w-5 h-5 rounded-lg bg-[rgba(124,92,252,0.06)] flex items-center justify-center flex-shrink-0">
                          {msg.activityIcon && <AIcon type={msg.activityIcon} />}
                        </div>
                        <span className="text-[11px] text-brand-muted flex-1 leading-tight truncate">{msg.content}</span>
                        <span className="text-[10px] text-brand-muted/40 flex-shrink-0 tabular-nums">{msg.time}</span>
                      </div>
                    );
                  }

                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] bg-[rgba(124,92,252,0.08)] text-brand-dark text-[12px] leading-relaxed rounded-2xl rounded-br-sm px-3 py-2">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  // Bot message
                  return (
                    <div key={msg.id} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={9} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-white border border-[rgba(124,92,252,0.08)] rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

                          {msg.type === 'ideas' && msg.ideas ? (
                            <div>
                              <p className="text-[12px] text-brand-dark mb-2 leading-relaxed">{msg.content}</p>
                              <div className="space-y-1.5">
                                {msg.ideas.map((idea, i) => (
                                  <button key={i} onClick={() => handleIdeaSelect(idea)}
                                    className="w-full text-left text-[11px] px-3 py-2 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)] text-brand-dark hover:border-brand-purple/30 hover:bg-[rgba(124,92,252,0.07)] transition-all leading-snug">
                                    {idea}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : msg.type === 'improve-options' ? (
                            <div>
                              <p className="text-[12px] text-brand-dark mb-2.5 leading-relaxed">{msg.content}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {IMPROVE_CHIPS.map(s => (
                                  <button key={s} onClick={() => handleImproveChip(s)}
                                    className="text-[10px] px-2.5 py-1.5 rounded-full border border-[rgba(124,92,252,0.2)] text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors font-medium">
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : msg.type === 'repurpose-input' ? (
                            <div>
                              <p className="text-[12px] text-brand-dark mb-2 leading-relaxed">{msg.content}</p>
                              <textarea
                                value={repurposeText}
                                onChange={e => setRepurposeText(e.target.value)}
                                placeholder="Paste article, newsletter, transcript, or thread…"
                                className="input !text-[11px] !min-h-[100px] !resize-none w-full !leading-relaxed mb-2"
                              />
                              <button onClick={handleRepurpose} disabled={!repurposeText.trim() || repurposing}
                                className="btn-primary w-full text-xs !py-2">
                                {repurposing ? <><Loader2 size={12} className="animate-spin" /> Repurposing…</> : <><Scissors size={12} /> Repurpose this</>}
                              </button>
                            </div>
                          ) : (
                            <p className="text-[12px] text-brand-dark leading-relaxed">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(generating || refining || repurposing) && (
                  <div className="flex items-center gap-2 pl-7">
                    <div className="flex gap-1 px-3 py-2 bg-white border border-[rgba(124,92,252,0.08)] rounded-2xl rounded-bl-sm shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Persistent chat input */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-[rgba(124,92,252,0.06)] bg-white/40">
            <div className="relative">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !chatDisabled) { e.preventDefault(); handleChatSubmit(); } }}
                placeholder={chatPlaceholder}
                disabled={chatDisabled || generating || refining}
                className={`input !pr-12 !py-2.5 !text-sm w-full transition-opacity ${chatDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <button
                onClick={handleChatSubmit}
                disabled={!chatInput.trim() || chatDisabled || generating || refining}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white disabled:opacity-30 transition-opacity">
                {(generating || refining) ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
            {error && <p className="text-[10px] text-red-500 mt-1.5 px-1">{error}</p>}
          </div>
        </aside>

        {/* Divider */}
        <div className="hidden md:block w-px flex-shrink-0" style={{ background: 'linear-gradient(to bottom,transparent,rgba(124,92,252,0.1) 20%,rgba(124,92,252,0.1) 80%,transparent)' }} />

        {/* ── RIGHT: POST COMPOSER ───────────────────────────────────────────── */}
        <main className={`${mobileView === 'compose' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 overflow-hidden`}>

          {/* Single-row header: avatar · name · tone */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2.5 bg-white">
            <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 select-none">
              {userInitials || 'Y'}
            </div>
            <span className="text-[12px] font-semibold text-brand-dark leading-none truncate max-w-[130px]">{userName || 'Your Name'}</span>
            <ChevronDown size={11} className="text-brand-muted/40 flex-shrink-0 -ml-1.5" />
            <div className="flex-1 min-w-0" />
            <div className="relative flex-shrink-0" ref={toneRef}>
              <button onClick={() => setToneOpen(o => !o)}
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

          {/* Composer — conditionally shows ideas panel or post editor */}
          {ideasView ? (
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setIdeasView(false)}
                  className="p-1 -ml-1 rounded-lg hover:bg-[rgba(124,92,252,0.06)] transition-colors text-brand-muted hover:text-brand-purple">
                  <ArrowLeft size={15} />
                </button>
                <span className="text-[12px] font-bold text-brand-dark">Topic ideas for you</span>
              </div>
              {loadingIdeas ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 size={20} className="animate-spin text-brand-purple" />
                  <p className="text-[12px] text-brand-muted">Finding ideas based on your profile…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ideasList.map((idea, i) => (
                    <div key={i} className="border border-[rgba(0,0,0,0.07)] rounded-2xl p-4 hover:shadow-sm transition-all bg-white/60">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {userInitials || 'Y'}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-brand-dark leading-none">{userName || 'Your Name'}</div>
                          <div className="text-[9px] text-brand-muted mt-0.5">LinkedIn · Just now</div>
                        </div>
                      </div>
                      <p className="text-[13px] text-brand-dark leading-snug mb-3 line-clamp-3">{idea}</p>
                      <button onClick={() => handleIdeaSelect(idea)}
                        className="btn-primary text-xs !py-1.5 !px-4">
                        <Sparkles size={11} /> Generate from this
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-5 pt-5 pb-2">
                {adapting ? (
                  <div className="min-h-[200px] flex flex-col items-center justify-center gap-3">
                    <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                      <Loader2 size={17} className="animate-spin text-white" />
                    </div>
                    <p className="text-xs text-brand-muted font-medium">
                      Adapting to {CONTENT_TYPES.find(c => c.id === contentType)?.label}…
                    </p>
                  </div>
                ) : (
                  <textarea
                    value={composerContent}
                    onChange={e => setComposerContent(e.target.value)}
                    placeholder={composerPlaceholder}
                    className="w-full resize-none border-0 bg-transparent text-brand-dark text-[15px] leading-[1.75] focus:outline-none placeholder:text-brand-muted/30 font-[inherit] min-h-[220px]"
                  />
                )}
              </div>

              {/* Visual attachment */}
              <div className="px-5 pb-5">
                {attachedImage ? (
                  <div className="relative rounded-xl overflow-hidden group">
                    <img src={attachedImage} alt="Post visual" className="w-full rounded-xl object-cover max-h-[240px]" />
                    {showTextOverlay && composerContent && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-10 pb-4 rounded-b-xl pointer-events-none">
                        <p className="text-white text-[13px] font-semibold leading-snug line-clamp-2">
                          {(composerContent.split('\n').find(l => l.trim()) || '').substring(0, 100)}
                        </p>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                      <button onClick={() => setShowTextOverlay(o => !o)}
                        className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm flex items-center gap-1">
                        {showTextOverlay ? <EyeOff size={9} /> : <Eye size={9} />} Text
                      </button>
                      <button onClick={() => { setVisualModalOpen(true); setVisualPreview(null); }}
                        className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm">
                        Change
                      </button>
                      <button onClick={() => setAttachedImage(null)}
                        className="w-6 h-6 rounded-lg bg-black/60 text-white flex items-center justify-center backdrop-blur-sm">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => composerContent ? setVisualModalOpen(true) : undefined}
                    disabled={!composerContent}
                    className={`w-full border-2 border-dashed rounded-xl py-3 flex items-center justify-center gap-2 transition-all text-[12px] font-medium ${
                      composerContent
                        ? 'border-[rgba(124,92,252,0.2)] text-brand-muted hover:border-brand-purple/40 hover:text-brand-purple cursor-pointer'
                        : 'border-[rgba(0,0,0,0.06)] text-brand-muted/30 cursor-not-allowed'
                    }`}>
                    <Image size={14} />
                    Add visual
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Char counter */}
          <div className="flex-shrink-0 px-5 py-2.5 flex items-center gap-3 border-t border-[rgba(124,92,252,0.04)] bg-white/20">
            <div className="flex-1 h-1 rounded-full bg-[rgba(124,92,252,0.06)]">
              <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${charPct}%` }} />
            </div>
            <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${charColor}`}>
              {charLen.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
            </span>
            {contentHistory.length > 0 && (
              <button onClick={handleUndo} className="text-[11px] text-brand-purple flex items-center gap-1 hover:underline flex-shrink-0 font-medium">
                <Undo2 size={11} /> Undo
              </button>
            )}
          </div>

          {/* Action bar — Copy/Save/Schedule left · Post to LinkedIn right */}
          <div className="flex-shrink-0 px-5 py-3 border-t border-[rgba(124,92,252,0.06)] bg-white/40 flex items-center gap-2">
            <button onClick={handleCopy} disabled={!composerContent}
              className="btn-ghost text-xs !py-2 !px-3 disabled:opacity-40">
              {copied ? <><Check size={12} className="text-brand-teal" /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
            <button onClick={handleSaveDraft} disabled={!composerContent}
              className="btn-ghost text-xs !py-2 !px-3 disabled:opacity-40">
              {saved ? <><Check size={12} className="text-brand-teal" /> Saved</> : <><FileText size={12} /> Save Draft</>}
            </button>
            <button disabled={!composerContent} title="Scheduled posting coming soon"
              className="btn-ghost text-xs !py-2 !px-3 disabled:opacity-40">
              <Calendar size={12} /> Schedule
            </button>
            <div className="flex-1" />
            <button onClick={handlePublish}
              disabled={!composerContent || publishing || !!publishResult?.success}
              className="btn-primary !py-2.5 !px-5 text-xs disabled:opacity-40 shadow-[0_2px_12px_rgba(124,92,252,0.25)]">
              {publishing ? <><Loader2 size={13} className="animate-spin" /> Publishing…</>
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
                <a href={`https://www.linkedin.com/feed/update/${publishResult.urn}`} target="_blank" rel="noopener noreferrer"
                  className="underline flex items-center gap-1">
                  View post <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
        </main>
        </div>
      </div>

      {/* ── VISUAL CREATION MODAL ─────────────────────────────────────────────── */}
      {visualModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[rgba(124,92,252,0.06)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl gradient-primary flex items-center justify-center">
                  <Image size={12} className="text-white" />
                </div>
                <span className="text-sm font-bold text-brand-dark">Add a visual</span>
              </div>
              <button onClick={() => { setVisualModalOpen(false); setVisualPreview(null); setVisualError(''); }}
                className="w-8 h-8 rounded-xl hover:bg-[rgba(124,92,252,0.06)] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Context from post */}
              <div>
                <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-1.5 block">Post context (auto-filled)</label>
                <div className="text-[12px] text-brand-muted bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.08)] rounded-xl px-3 py-2.5 leading-relaxed max-h-16 overflow-hidden">
                  {composerContent.substring(0, 160)}{composerContent.length > 160 ? '…' : ''}
                </div>
              </div>

              {/* Style picker */}
              <div>
                <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-1.5 block">Visual style</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {VISUAL_STYLES.map(s => (
                    <button key={s.id} onClick={() => setVisualStyle(s.id)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-all ${
                        visualStyle === s.id
                          ? 'border-brand-purple bg-[rgba(124,92,252,0.06)] text-brand-purple'
                          : 'border-[rgba(124,92,252,0.1)] text-brand-muted hover:border-brand-purple/30'
                      }`}>
                      <span className="text-base">{s.emoji}</span>
                      <span className="text-[9px] font-semibold">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button onClick={handleGenerateVisual} disabled={generatingVisual}
                className="btn-primary w-full text-sm !py-3">
                {generatingVisual
                  ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                  : <><Sparkles size={15} /> Generate visual</>}
              </button>

              {visualError && <p className="text-xs text-red-500 text-center">{visualError}</p>}

              {/* Preview */}
              {visualPreview && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={visualPreview} alt="Generated visual" className="w-full rounded-xl object-cover" />
                    {showTextOverlay && composerContent && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-10 pb-4 rounded-b-xl pointer-events-none">
                        <p className="text-white text-[13px] font-semibold leading-snug line-clamp-2">
                          {(composerContent.split('\n').find(l => l.trim()) || '').substring(0, 100)}
                        </p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowTextOverlay(o => !o)}
                    className="btn-ghost text-[10px] !py-1.5 flex items-center gap-1.5 justify-center w-full">
                    {showTextOverlay ? <><EyeOff size={10} /> Hide text overlay</> : <><Eye size={10} /> Show text overlay</>}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={handleUseVisual}
                      className="btn-primary flex-1 text-sm !py-2.5">
                      <Check size={13} /> Use this image
                    </button>
                    <button onClick={handleGenerateVisual} disabled={generatingVisual}
                      className="btn-secondary !py-2.5 !px-3.5">
                      <RefreshCw size={13} />
                    </button>
                    <a href={visualPreview} download={`visual-${Date.now()}.png`}
                      className="btn-secondary !py-2.5 !px-3.5 flex items-center">
                      <Download size={13} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
