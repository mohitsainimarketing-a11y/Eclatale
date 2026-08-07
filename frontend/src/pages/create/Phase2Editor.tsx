import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, Copy, Save, Calendar, Bold, Italic, Smile, Minus, List, ListOrdered,
  ChevronDown, Send, Sparkles, ShieldCheck, AlertTriangle, Clock, LayoutGrid,
  ThumbsUp, MessageCircle, Repeat2, ExternalLink, X, Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { apiFetch } from '../../lib/apiFetch';
import { copyToClipboard } from '../../utils/clipboard';
import { RICH_TEXT_STYLES } from '../../lib/richText';
import { useToast } from '../../contexts/ToastContext';
import { Angle, Source, PostLength, LENGTH_OPTIONS, AuthenticityScoreResult } from './types';
import { HOOK_TEMPLATES, CTA_TEMPLATES } from './hookCtaTemplates';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();
const BOLD = RICH_TEXT_STYLES.find(s => s.id === 'bold')!.apply;
const ITALIC = RICH_TEXT_STYLES.find(s => s.id === 'italic')!.apply;
const looksLikeUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

const LOADING_MESSAGES = [
  'Finding the latest on this topic...',
  'Crafting your hook...',
  'Matching your voice...',
  'Almost ready...',
];

function scoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#F72585';
}

function estimateSlides(content: string): number {
  const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return Math.max(3, Math.min(10, paragraphs.length + 1));
}

interface Phase2Props {
  userId: string;
  userName: string;
  userInitials: string;
  userAvatar: string;
  angle: Angle | null;
  customTopic: string;
  sources: Source[];
  editMode: boolean;
  initialPostId: string | null;
  initialContent: string;
  selectedLength: PostLength;
  onLengthChange: (l: PostLength) => void;
  onBack: () => void;
  onPublished: (postId: string, urn: string) => void;
}

export default function Phase2Editor({
  userId, userName, userInitials, userAvatar, angle, customTopic, sources,
  editMode, initialPostId, initialContent, selectedLength, onLengthChange, onBack, onPublished,
}: Phase2Props) {
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState(initialContent);
  const [postId, setPostId] = useState<string | null>(initialPostId);
  const [isGenerating, setIsGenerating] = useState(!editMode);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [genError, setGenError] = useState('');
  const [sparkInput, setSparkInput] = useState('');

  const [hooksOpen, setHooksOpen] = useState(false);
  const [ctasOpen, setCtasOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const [ariaInput, setAriaInput] = useState('');
  const [ariaRefining, setAriaRefining] = useState(false);

  const [authScore, setAuthScore] = useState<AuthenticityScoreResult | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authLocked, setAuthLocked] = useState(false);
  const checkedRef = useRef(false);

  const [bestTime, setBestTime] = useState<{ recommendedDays: string[]; recommendedTimes: string[] } | null>(null);
  const [bestTimeLoading, setBestTimeLoading] = useState(true);
  const [bestTimeLocked, setBestTimeLocked] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const [carouselState, setCarouselState] = useState<'idle' | 'generating'>('idle');
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ── Generation ────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenError('');
    checkedRef.current = false;
    try {
      let spark = sparkInput.trim();
      if (spark && looksLikeUrl(spark)) {
        try {
          const res = await apiFetch(`${API_URL}/api/intelligence`, {
            method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ action: 'fetch-url', url: spark }),
          });
          const data = await res.json();
          if (!data.error && data.text) spark = data.text;
        } catch { /* fall back to the raw URL as context */ }
      }

      const topic = angle?.hook ? angle.hook.slice(0, 150) : (customTopic.trim() || 'a timely update').slice(0, 150);

      const res = await apiFetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          topic, tone: 'professional', contentType: 'linkedin-post', contentLength: selectedLength,
          angle: angle ? { style: angle.style, styleId: angle.styleId, hook: angle.hook, insight: angle.insight } : undefined,
          spark: spark || undefined,
          userId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);

      setContent(data.content);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic, tone: 'professional', content_type: 'linkedin-post', source: 'auto',
      }).select('id').single();
      if (inserted) setPostId(inserted.id);
    } catch (e: any) {
      setGenError(e.message || "Couldn't generate a post — try again.");
    }
    setIsGenerating(false);
  }, [angle, customTopic, selectedLength, sparkInput, userId]);

  useEffect(() => {
    if (!editMode) handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2000);
    return () => clearInterval(t);
  }, [isGenerating]);

  // ── Authenticity score (2s after content is ready) + best time ─────────────

  useEffect(() => {
    if (isGenerating || !postId || !content.trim() || checkedRef.current) return;
    checkedRef.current = true;
    const t = setTimeout(async () => {
      setAuthLoading(true);
      try {
        const res = await apiFetch(`${API_URL}/api/intelligence`, {
          method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ action: 'authenticity-score', userId, postId, postContent: content, topic: angle?.hook || customTopic, contentLength: selectedLength }),
        });
        const data = await res.json();
        if (data.error === 'feature_locked') { setAuthLocked(true); }
        else if (!data.error) setAuthScore(data);
      } catch { /* leave card in its empty state */ }
      setAuthLoading(false);
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, postId]);

  useEffect(() => {
    if (!userId) return;
    setBestTimeLoading(true);
    apiFetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'best-time', userId }),
    }).then(async res => {
      const data = await res.json();
      if (data.error === 'feature_locked') setBestTimeLocked(true);
      else if (!data.error) setBestTime(data);
    }).catch(() => {}).finally(() => setBestTimeLoading(false));
  }, [userId]);

  // ── Aria refine ──────────────────────────────────────────────────────────

  const handleAriaRefine = async () => {
    if (!ariaInput.trim() || ariaRefining) return;
    setAriaRefining(true);
    try {
      const res = await apiFetch(`${API_URL}/api/refine-content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: content, instruction: ariaInput.trim(), userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      setContent(data.content);
      setAriaInput('');
      checkedRef.current = false;
      if (postId) await supabase.from('posts').update({ content: data.content }).eq('id', postId);
    } catch (e: any) {
      showToast('error', e.message || 'Refine failed — try again.');
    }
    setAriaRefining(false);
  };

  // ── Toolbar helpers ──────────────────────────────────────────────────────

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) { setContent(c => c + text); return; }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + text.length; });
  };

  const transformSelection = (fn: (t: string) => string) => {
    const el = textareaRef.current;
    if (!el || el.selectionStart === el.selectionEnd) { showToast('info', 'Select some text first.'); return; }
    const start = el.selectionStart, end = el.selectionEnd;
    const selected = content.slice(start, end);
    const next = content.slice(0, start) + fn(selected) + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => el.focus());
  };

  const prefixLines = (prefix: (i: number) => string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0, end = el.selectionEnd ?? content.length;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = end > start ? end : content.indexOf('\n', end) === -1 ? content.length : content.indexOf('\n', end);
    const block = content.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const next = content.slice(0, lineStart) + lines.map((l, i) => `${prefix(i)}${l}`).join('\n') + content.slice(lineEnd);
    setContent(next);
  };

  // ── Bottom bar actions ───────────────────────────────────────────────────

  const persistContent = async (): Promise<string | null> => {
    if (postId) {
      await supabase.from('posts').update({ content }).eq('id', postId);
      return postId;
    }
    const { data: inserted } = await supabase.from('posts').insert({
      user_id: userId, content, topic: angle?.hook?.slice(0, 150) || customTopic.slice(0, 150) || 'Draft',
      tone: 'professional', content_type: 'linkedin-post', source: 'auto',
    }).select('id').single();
    if (inserted) { setPostId(inserted.id); return inserted.id; }
    return null;
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(content);
    showToast(ok ? 'success' : 'error', ok ? 'Copied to clipboard.' : 'Could not copy — select and copy manually.');
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    const id = await persistContent();
    setSavingDraft(false);
    showToast(id ? 'success' : 'error', id ? 'Draft saved.' : 'Could not save draft.');
  };

  const openSchedule = () => {
    if (bestTimeLocked) { showToast('info', 'Scheduling is an Individual plan feature.', { action: { label: 'Upgrade', onClick: () => { window.location.href = '/pricing'; } } }); return; }
    if (!scheduleDate) {
      const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const target = new Date();
      const recDay = bestTime?.recommendedDays?.[0];
      const idx = recDay ? DAYS.indexOf(recDay) : -1;
      if (idx !== -1) {
        let delta = (idx - target.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        target.setDate(target.getDate() + delta);
      } else {
        target.setDate(target.getDate() + 1);
      }
      setScheduleDate(target.toISOString().slice(0, 10));
      const match = bestTime?.recommendedTimes?.[0]?.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        if (/pm/i.test(match[3]) && h !== 12) h += 12;
        if (/am/i.test(match[3]) && h === 12) h = 0;
        setScheduleTime(`${String(h).padStart(2, '0')}:00`);
      } else {
        setScheduleTime('08:00');
      }
    }
    setScheduleOpen(o => !o);
  };

  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) return;
    setScheduling(true);
    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (scheduledFor.getTime() < Date.now()) throw new Error('Pick a time in the future.');
      const id = await persistContent();
      if (!id) throw new Error('Could not save post.');
      const res = await apiFetch(`${API_URL}/api/schedule/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, postId: id, scheduledFor: scheduledFor.toISOString() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      showToast('success', `Scheduled for ${scheduledFor.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} at ${scheduledFor.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
      setScheduleOpen(false);
    } catch (e: any) {
      showToast('error', e.message || 'Failed to schedule.');
    }
    setScheduling(false);
  };

  const handlePublish = async () => {
    if (!content.trim()) return;
    setPublishing(true);
    try {
      const statusRes = await apiFetch(`${API_URL}/api/linkedin/status?userId=${userId}`);
      const statusData = await statusRes.json();
      if (!statusData.connected) {
        showToast('warning', 'LinkedIn not connected.', { action: { label: 'Connect', onClick: () => { window.location.href = '/settings'; } } });
        setPublishing(false);
        return;
      }
      const id = await persistContent();
      if (!id) throw new Error('Could not save post.');
      const res = await apiFetch(`${API_URL}/api/linkedin/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ postId: id, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      onPublished(id, data.linkedinPostUrn || '');
    } catch (e: any) {
      showToast('error', e.message || 'Publish failed — try again.');
    }
    setPublishing(false);
  };

  const handleCarousel = () => {
    setCarouselState('generating');
    const topic = content.split('\n').find(l => l.trim())?.slice(0, 120) || 'LinkedIn carousel';
    window.location.href = `/create-visual?format=carousel&topic=${encodeURIComponent(topic)}`;
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const CUTOFF = 210;
  const cutoffIdx = content.length > CUTOFF
    ? (content.slice(0, CUTOFF).lastIndexOf('\n') > 100 ? content.slice(0, CUTOFF).lastIndexOf('\n') : (content.indexOf(' ', CUTOFF) === -1 ? content.length : content.indexOf(' ', CUTOFF)))
    : -1;
  const visibleTop = cutoffIdx === -1 ? content : content.slice(0, cutoffIdx);
  const visibleRest = cutoffIdx === -1 ? '' : content.slice(cutoffIdx);

  const topSources = sources.slice(0, 3);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Spark bar */}
      <div className="bg-white border-b px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap" style={{ borderColor: '#EDE8FF' }}>
        {angle ? (
          <span
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
            style={{ border: '1.5px solid #D4CEFF', color: '#7C5CFC' }}
          >
            <Check size={12} /> {angle.style} · {angle.hook.slice(0, 40)}{angle.hook.length > 40 ? '…' : ''}
            <button onClick={onBack} aria-label="Change angle" className="ml-1 hover:opacity-70"><X size={12} /></button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0" style={{ border: '1.5px solid #D4CEFF', color: '#7C5CFC' }}>
            {editMode ? 'Editing draft' : (customTopic.slice(0, 40) || 'Custom post')}
            <button onClick={onBack} aria-label="Back" className="ml-1 hover:opacity-70"><X size={12} /></button>
          </span>
        )}
        <input
          type="text"
          value={sparkInput}
          onChange={e => setSparkInput(e.target.value)}
          placeholder="What sparked this? Paste a URL, quote, or describe what triggered it (optional but powerful)"
          className="flex-1 min-w-[160px] text-[13px] bg-transparent outline-none px-2"
          style={{ color: '#1A1A2E' }}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          {LENGTH_OPTIONS.map(l => (
            <button
              key={l.id}
              onClick={() => onLengthChange(l.id)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all"
              style={selectedLength === l.id
                ? { background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', color: 'white' }
                : { color: '#6B7280', border: '1px solid #EDE8FF' }}
            >
              {l.emoji} {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* Left column — editor */}
        <div className="flex-1 min-w-0 bg-white flex flex-col md:border-r" style={{ borderColor: '#EDE8FF' }}>
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b flex-wrap" style={{ borderColor: '#EDE8FF' }}>
            <ToolBtn icon={Bold} onClick={() => transformSelection(BOLD)} label="Bold" />
            <ToolBtn icon={Italic} onClick={() => transformSelection(ITALIC)} label="Italic" />
            <div className="relative">
              <ToolBtn icon={Smile} onClick={() => setEmojiOpen(o => !o)} label="Emoji" />
              {emojiOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl p-2 flex gap-1 z-20 modal-shadow flex-wrap w-48">
                  {['😀', '🔥', '💡', '✅', '📈', '🎯', '🚀', '👏', '💬', '⚡', '🙌', '✨'].map(e => (
                    <button key={e} onClick={() => { insertAtCursor(e); setEmojiOpen(false); }} className="text-lg p-1 hover:bg-[rgba(124,92,252,0.06)] rounded-lg">{e}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-px h-5 mx-1" style={{ background: '#EDE8FF' }} />
            <ToolBtn icon={Minus} onClick={() => insertAtCursor('\n───\n')} label="Divider" />
            <ToolBtn icon={List} onClick={() => prefixLines(() => '• ')} label="Bullets" />
            <ToolBtn icon={ListOrdered} onClick={() => prefixLines(i => `${i + 1}. `)} label="Numbers" />
            <div className="w-px h-5 mx-1" style={{ background: '#EDE8FF' }} />

            <div className="relative">
              <button onClick={() => setHooksOpen(o => !o)} className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1.5 rounded-full" style={{ color: '#7C5CFC', background: 'rgba(124,92,252,0.06)' }}>
                Hooks <ChevronDown size={12} />
              </button>
              {hooksOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl p-2 z-20 modal-shadow w-80 max-h-72 overflow-y-auto">
                  {HOOK_TEMPLATES.map((h, i) => (
                    <button key={i} onClick={() => { insertAtCursor(h + '\n\n'); setHooksOpen(false); }} className="block w-full text-left text-[12px] px-2.5 py-2 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setCtasOpen(o => !o)} className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1.5 rounded-full" style={{ color: '#7C5CFC', background: 'rgba(124,92,252,0.06)' }}>
                CTAs <ChevronDown size={12} />
              </button>
              {ctasOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl p-2 z-20 modal-shadow w-80 max-h-72 overflow-y-auto">
                  {CTA_TEMPLATES.map((c, i) => (
                    <button key={i} onClick={() => { insertAtCursor('\n\n' + c); setCtasOpen(false); }} className="block w-full text-left text-[12px] px-2.5 py-2 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {topSources.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {topSources.map((s, i) => (
                  <span key={i} title={s.excerpt} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: '#F8F5FF', color: '#6B7280' }}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: scoreColor(s.trustScore) }}>{s.trustScore}</span>
                    {s.domain}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-[280px] p-4">
            {isGenerating ? (
              <div className="h-full rounded-xl p-4 flex flex-col gap-3" style={{ background: '#FDFCFF', border: '1.5px solid #EDE8FF' }}>
                {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-3.5 rounded" style={{ width: `${90 - i * 12}%` }} />)}
                <p className="text-[12px] font-semibold mt-2 animate-fadeIn" style={{ color: '#7C5CFC' }} key={loadingMsgIdx}>
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
              </div>
            ) : genError ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <p className="text-[13px]" style={{ color: '#F72585' }}>{genError}</p>
                <button onClick={handleGenerate} className="text-[12px] font-bold px-4 py-2 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>Try again</button>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full h-full min-h-[280px] outline-none resize-y"
                style={{ border: '1.5px solid #EDE8FF', borderRadius: 12, padding: 16, fontSize: 13.5, lineHeight: 1.85, color: '#1A1A2E', background: '#FDFCFF' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7C5CFC'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124,92,252,0.06)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#EDE8FF'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            )}
          </div>

          {/* Editor footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t flex-wrap" style={{ borderColor: '#EDE8FF' }}>
            <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>{content.length} / 3,000</span>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Sparkles size={14} style={{ color: '#7C5CFC', flexShrink: 0 }} />
              <input
                type="text"
                value={ariaInput}
                onChange={e => setAriaInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAriaRefine(); }}
                placeholder="Ask Aria to refine — make it shorter, add a stat, change the ending..."
                className="flex-1 min-w-0 text-[12px] bg-transparent outline-none"
                style={{ color: '#1A1A2E' }}
              />
              <button
                onClick={handleAriaRefine}
                disabled={ariaRefining || !ariaInput.trim()}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}
              >
                <Send size={12} color="white" />
              </button>
            </div>
          </div>
        </div>

        {/* Right column — intelligence panel */}
        <div className="w-full md:w-[240px] flex-shrink-0 p-4 flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-y-auto snap-x snap-mandatory md:snap-none" style={{ background: '#F8F5FF' }}>
          {/* LinkedIn preview */}
          <div className="bg-white rounded-[14px] p-3.5 flex-shrink-0 w-[200px] md:w-auto snap-start" style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}>
            <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: '#9CA3AF' }}>LinkedIn Preview</p>
            <div className="flex items-center gap-2 mb-2">
              {userAvatar ? <img src={userAvatar} alt={userName} className="w-7 h-7 rounded-full object-cover" /> : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>{userInitials}</div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-bold truncate" style={{ color: '#1A1A2E' }}>{userName || 'You'}</p>
                <p className="text-[9px]" style={{ color: '#9CA3AF' }}>Just now</p>
              </div>
            </div>
            <p className="text-[11px] whitespace-pre-wrap break-words" style={{ color: '#1A1A2E', lineHeight: 1.5 }}>{visibleTop || 'Your post will appear here...'}</p>
            {visibleRest && (
              <>
                <div className="my-1.5 border-t border-dashed" style={{ borderColor: '#EDE8FF' }} />
                <p className="text-[9px] mb-1" style={{ color: '#9CA3AF' }}>hook ends · {CUTOFF} chars</p>
                <p className="text-[11px] whitespace-pre-wrap break-words" style={{ color: '#9CA3AF', lineHeight: 1.5 }}>{visibleRest}</p>
              </>
            )}
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t" style={{ borderColor: '#F0EEF8' }}>
              <ThumbsUp size={12} style={{ color: '#9CA3AF' }} />
              <MessageCircle size={12} style={{ color: '#9CA3AF' }} />
              <Repeat2 size={12} style={{ color: '#9CA3AF' }} />
            </div>
          </div>

          {/* Voice signal */}
          <div className="bg-white rounded-[14px] p-3.5 flex-shrink-0 w-[200px] md:w-auto snap-start" style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}>
            <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: '#9CA3AF' }}>Voice Signal</p>
            {authLocked ? (
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Upgrade to Individual to check authenticity.</p>
            ) : authLoading ? (
              <div className="space-y-1.5"><div className="skeleton h-3 w-3/4 rounded" /><div className="skeleton h-6 w-full rounded" /></div>
            ) : authScore ? (
              <>
                <p className="text-[11px] font-bold flex items-center gap-1 mb-2" style={{ color: authScore.overallScore >= 70 ? '#10B981' : '#F59E0B' }}>
                  {authScore.overallScore >= 70 ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                  {authScore.overallScore >= 70 ? 'Sounds like you' : (authScore.voice?.suggestion || 'One thing to adjust')}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['Accuracy', authScore.accuracy?.score], ['Freshness', authScore.freshness?.score], ['Voice', authScore.voice?.score]].map(([label, score]) => (
                    <div key={label as string} className="text-center rounded-lg py-1.5" style={{ background: '#F8F5FF' }}>
                      <p className="text-[12px] font-extrabold" style={{ color: scoreColor(Number(score) || 0) }}>{score ?? '—'}</p>
                      <p className="text-[8px] font-semibold" style={{ color: '#9CA3AF' }}>{label as string}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Checking in a moment...</p>
            )}
          </div>

          {/* Best time */}
          <div className="bg-white rounded-[14px] p-3.5 flex-shrink-0 w-[200px] md:w-auto snap-start relative" style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}>
            <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: '#9CA3AF' }}>Best Time To Post</p>
            {bestTimeLocked ? (
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Upgrade to Individual to see this.</p>
            ) : bestTimeLoading ? (
              <div className="skeleton h-8 w-full rounded" />
            ) : (
              <>
                <p className="text-[13px] font-bold flex items-center gap-1.5 mb-0.5" style={{ color: '#1A1A2E' }}>
                  <Clock size={13} style={{ color: '#7C5CFC' }} />
                  {bestTime?.recommendedDays?.[0] ? `${bestTime.recommendedDays[0].slice(0, 3)} ${bestTime.recommendedTimes?.[0] || ''}` : 'Not enough data yet'}
                </p>
                <p className="text-[10px] mb-2.5" style={{ color: '#9CA3AF' }}>Your audience peaks then</p>
                <button onClick={openSchedule} className="text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ color: '#7C5CFC', border: '1.5px solid #EDE8FF' }}>Schedule</button>
              </>
            )}
            {scheduleOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-xl p-3 z-20 modal-shadow w-56">
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full text-[12px] px-2 py-1.5 rounded-lg mb-1.5" style={{ border: '1px solid #EDE8FF' }} />
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full text-[12px] px-2 py-1.5 rounded-lg mb-2" style={{ border: '1px solid #EDE8FF' }} />
                <button onClick={handleConfirmSchedule} disabled={scheduling} className="w-full text-[12px] font-bold text-white py-1.5 rounded-full disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
                  {scheduling ? 'Scheduling...' : 'Confirm'}
                </button>
              </div>
            )}
          </div>

          {/* Carousel CTA */}
          <div className="rounded-[14px] p-3.5 flex-shrink-0 w-[200px] md:w-auto snap-start relative" style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(247,37,133,0.08) 100%)' }}>
            <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'white', color: '#7C5CFC' }}>Recommended</span>
            <LayoutGrid size={16} style={{ color: '#7C5CFC' }} className="mb-1.5" />
            <p className="text-[12px] font-bold mb-1.5" style={{ color: '#7C5CFC' }}>Turn into carousel</p>
            <p className="text-[10px] mb-2.5" style={{ color: '#6B7280', lineHeight: 1.5 }}>
              Carousels average 1,451 impressions vs 605 for images. This post has {estimateSlides(content)} perfect slides in it.
            </p>
            {carouselState === 'generating' ? (
              <p className="text-[11px] font-bold" style={{ color: '#10B981' }}>Carousel generating...</p>
            ) : (
              <button onClick={handleCarousel} className="text-[11px] font-bold" style={{ color: '#7C5CFC' }}>
                Generate {estimateSlides(content)}-slide carousel →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-2" style={{ borderColor: '#EDE8FF' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-full" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
            <ArrowLeft size={13} /> Back
          </button>
          <button onClick={handleCopy} className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-full" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
            <Copy size={13} /> Copy
          </button>
          <button onClick={handleSaveDraft} disabled={savingDraft} className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-full disabled:opacity-50" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
            <Save size={13} /> {savingDraft ? 'Saving...' : 'Save draft'}
          </button>
          <div className="relative">
            <button onClick={openSchedule} className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-full" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
              <Calendar size={13} /> Schedule
            </button>
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={handlePublish}
          disabled={publishing || isGenerating || !content.trim()}
          className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-white px-6 py-2.5 rounded-full disabled:opacity-50 w-full md:w-auto"
          style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.25)' }}
        >
          {publishing ? 'Publishing...' : 'Post to LinkedIn →'}
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ icon: Icon, onClick, label }: { icon: React.ComponentType<any>; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#6B7280' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,92,252,0.06)'; e.currentTarget.style.color = '#7C5CFC'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; }}
    >
      <Icon size={14} />
    </button>
  );
}
