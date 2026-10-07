import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, Copy, Save, Calendar, Bold, Italic, Strikethrough, Minus, List, ListOrdered, MoreHorizontal,
  ChevronDown, Send, Sparkles, AlertTriangle, Clock, LayoutGrid,
  ThumbsUp, MessageCircle, Repeat2, X, Check, ChevronRight, Wand2, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { apiFetch } from '../../lib/apiFetch';
import { copyToClipboard } from '../../utils/clipboard';
import { RICH_TEXT_STYLES, applyStrikethrough } from '../../lib/richText';
import { useToast } from '../../contexts/ToastContext';
import { Angle, Source, PostLength, LENGTH_OPTIONS, AuthenticityScoreResult } from './types';
import { CTA_TEMPLATES } from './hookCtaTemplates';
import HookLibraryPanel from './HookLibraryPanel';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();
const BOLD = RICH_TEXT_STYLES.find(s => s.id === 'bold')!.apply;
const ITALIC = RICH_TEXT_STYLES.find(s => s.id === 'italic')!.apply;
const BOLD_ITALIC = RICH_TEXT_STYLES.find(s => s.id === 'bold-italic')!.apply;
const looksLikeUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

const LOADING_MESSAGES = [
  'Finding the latest on this topic...',
  'Crafting your hook...',
  'Matching your voice...',
  'Almost ready...',
];

// Mirrors backend/lib/writingStyles.ts WRITING_STYLES ids. Used to build real
// variants of the same topic/hook in genuinely different voices, not just
// reworded copies of one draft.
const VARIANT_STYLES: { id: string; emoji: string; label: string }[] = [
  { id: 'storyteller', emoji: '📖', label: 'Storyteller' },
  { id: 'contrarian', emoji: '🔥', label: 'Contrarian' },
  { id: 'teacher', emoji: '🎓', label: 'The Teacher' },
  { id: 'insider', emoji: '🕵️', label: 'The Insider' },
  { id: 'motivator', emoji: '💪', label: 'Motivator' },
  { id: 'analyst', emoji: '📊', label: 'The Analyst' },
];
const VARIANT_COUNT = 3;

function pickVariantStyleIds(preferredId?: string): string[] {
  const others = VARIANT_STYLES.map(s => s.id).filter(id => id !== preferredId);
  const shuffled = [...others].sort(() => Math.random() - 0.5);
  const rest = shuffled.slice(0, preferredId ? VARIANT_COUNT - 1 : VARIANT_COUNT);
  return preferredId ? [preferredId, ...rest] : rest;
}

interface Variant { styleId: string; content: string; }

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
  userRole: string;
  userDomain: string;
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
  preloadedSpark?: string;
  // Writing style chosen outside the angle picker (currently the homepage
  // demo chips). Only consulted when there is no angle to take a style from.
  presetStyleId?: string;
}

export default function Phase2Editor({
  userId, userName, userInitials, userAvatar, userRole, userDomain, angle, customTopic, sources,
  editMode, initialPostId, initialContent, selectedLength, onLengthChange, onBack, onPublished,
  preloadedSpark, presetStyleId,
}: Phase2Props) {
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState(initialContent);
  const [postId, setPostId] = useState<string | null>(initialPostId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [genError, setGenError] = useState('');
  const [sparkInput, setSparkInput] = useState(preloadedSpark || '');

  // A fresh post starts with 3 real variants (same topic/hook, genuinely
  // different voices) to choose from, rather than one take with no comparison.
  const [flowStage, setFlowStage] = useState<'variants' | 'editor'>(editMode ? 'editor' : 'variants');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(!editMode);
  const [variantsError, setVariantsError] = useState('');

  const [hooksOpen, setHooksOpen] = useState(false);
  const [ctasOpen, setCtasOpen] = useState(false);
  const [formatMoreOpen, setFormatMoreOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const [ariaInput, setAriaInput] = useState('');
  const [ariaRefining, setAriaRefining] = useState(false);
  const [humanizing, setHumanizing] = useState(false);

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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // ── Generation ────────────────────────────────────────────────────────────

  const resolveSpark = useCallback(async (): Promise<string> => {
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
    return spark;
  }, [sparkInput]);

  const currentTopic = useCallback(
    () => (angle?.hook ? angle.hook.slice(0, 150) : (customTopic.trim() || 'a timely update').slice(0, 150)),
    [angle, customTopic]
  );

  // One generation call. `styleId`, when passed, overrides the angle's own
  // style so the same hook/topic can be regenerated in a different voice
  // (used to build variants); omit it to use the angle's own style as-is.
  // `includeHook` false drops the original angle's exact hook text so an
  // alternate-style variant can find its own opening instead of being
  // instructed to reuse someone else's, which otherwise makes every variant
  // start with a near-identical first line regardless of style.
  const generateOne = useCallback(async (spark: string, styleId?: string, includeHook: boolean = true): Promise<string> => {
    const res = await apiFetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        topic: currentTopic(), tone: 'professional', contentType: 'linkedin-post', contentLength: selectedLength,
        angle: angle
          ? { style: angle.style, styleId: styleId || angle.styleId, hook: includeHook ? angle.hook : undefined, insight: angle.insight }
          : ((styleId || presetStyleId) ? { styleId: styleId || presetStyleId } : undefined),
        spark: spark || undefined,
        userId,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.message || data.error);
    return data.content;
  }, [angle, currentTopic, selectedLength, userId, presetStyleId]);

  const savePost = useCallback(async (postContent: string) => {
    const { data: inserted } = await supabase.from('posts').insert({
      user_id: userId, content: postContent, topic: currentTopic(), tone: 'professional', content_type: 'linkedin-post', source: 'auto',
    }).select('id').single();
    if (inserted) setPostId(inserted.id);
  }, [userId, currentTopic]);

  // Single regenerate, used by the in-editor "Try again" retry after a
  // variant has already been chosen and something goes wrong.
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenError('');
    checkedRef.current = false;
    try {
      const spark = await resolveSpark();
      const result = await generateOne(spark);
      setContent(result);
      await savePost(result);
    } catch (e: any) {
      setGenError(e.message || "Couldn't generate a post. Try again.");
    }
    setIsGenerating(false);
  }, [resolveSpark, generateOne, savePost]);

  const handleGenerateVariants = useCallback(async () => {
    setVariantsLoading(true);
    setVariantsError('');
    try {
      const spark = await resolveSpark();
      const styleIds = pickVariantStyleIds(angle?.styleId);
      // Only the variant matching the angle's own originally-picked style
      // keeps that exact hook; the alternates write their own opening.
      const results = await Promise.all(
        styleIds.map((id, i) => generateOne(spark, id, i === 0 && id === angle?.styleId))
      );
      setVariants(styleIds.map((styleId, i) => ({ styleId, content: results[i] })));
    } catch (e: any) {
      setVariantsError(e.message || "Couldn't generate drafts. Try again.");
    }
    setVariantsLoading(false);
  }, [resolveSpark, generateOne, angle]);

  const chooseVariant = useCallback(async (variant: Variant) => {
    setContent(variant.content);
    await savePost(variant.content);
    setFlowStage('editor');
  }, [savePost]);

  useEffect(() => {
    if (!editMode) handleGenerateVariants();
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
      showToast('error', e.message || 'Refine failed. Try again.');
    }
    setAriaRefining(false);
  };

  // ── 4-pass humanizer ─────────────────────────────────────────────────────

  const handleHumanize = async () => {
    if (!content.trim() || humanizing) return;
    setHumanizing(true);
    try {
      const res = await apiFetch(`${API_URL}/api/humanize-post`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ postContent: content, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setContent(data.content);
      checkedRef.current = false;
      if (postId) await supabase.from('posts').update({ content: data.content }).eq('id', postId);
      showToast('success', 'AI tells removed. Post humanized.');
    } catch (e: any) {
      showToast('error', e.message || 'Humanize failed. Try again.');
    }
    setHumanizing(false);
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

  // Same as insertAtCursor, but if the inserted text has a [placeholder],
  // selects it so the user can just start typing over it, since a textarea has
  // no rich-text highlighting, so a text selection is the closest thing.
  const insertHookTemplate = (text: string) => {
    const el = textareaRef.current;
    const insertText = text + '\n\n';
    const bracketMatch = insertText.match(/\[[^\]]+\]/);
    if (!el) { setContent(c => c + insertText); return; }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + insertText + content.slice(end);
    setContent(next);
    const selStart = bracketMatch ? start + (bracketMatch.index || 0) : start + insertText.length;
    const selEnd = bracketMatch ? selStart + bracketMatch[0].length : selStart;
    requestAnimationFrame(() => { el.focus(); el.selectionStart = selStart; el.selectionEnd = selEnd; });
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

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key === 'b' && !e.shiftKey) { e.preventDefault(); transformSelection(BOLD); }
    else if (e.key === 'i' && !e.shiftKey) { e.preventDefault(); transformSelection(ITALIC); }
    else if (e.key === 'b' && e.shiftKey) { e.preventDefault(); transformSelection(BOLD_ITALIC); }
    else if ((e.key === 'x' || e.key === 'X') && e.shiftKey) { e.preventDefault(); transformSelection(applyStrikethrough); }
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
    showToast(ok ? 'success' : 'error', ok ? 'Copied to clipboard.' : 'Could not copy. Select and copy manually.');
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
      showToast('error', e.message || 'Publish failed. Try again.');
    }
    setPublishing(false);
  };

  const handleCarousel = () => {
    setCarouselState('generating');
    const topic = content.split('\n').find(l => l.trim())?.slice(0, 120) || 'LinkedIn carousel';
    window.location.href = `/create-visual?format=carousel&topic=${encodeURIComponent(topic)}`;
  };

  // ── Variant picker (shown once, before the editor, for a fresh post) ──────

  if (flowStage === 'variants') {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Compact header */}
        <div className="bg-white border-b px-4 md:px-8 py-2.5 md:py-5" style={{ borderColor: '#EDE8FF' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[15px] md:text-[22px] font-extrabold" style={{ color: '#1A1A2E' }}>Pick your take</h1>
              <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>Same idea, three voices. Tap the one that feels like you.</p>
            </div>
            <button
              onClick={handleGenerateVariants}
              disabled={variantsLoading}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all disabled:opacity-50 flex-shrink-0"
              style={{ color: '#7C5CFC', border: '1.5px solid #EDE8FF' }}
            >
              <RefreshCw size={11} className={variantsLoading ? 'animate-spin' : ''} />
              {variantsLoading ? 'Writing…' : 'New 3'}
            </button>
          </div>
        </div>

        {/* Cards — horizontal scroll on mobile, grid on desktop */}
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-y-auto">
          {variantsError && !variantsLoading && (
            <div className="mx-4 mt-4 text-[12px] font-medium px-3 py-2 rounded-xl" style={{ background: 'rgba(247,37,133,0.06)', color: '#F72585' }}>
              {variantsError}
            </div>
          )}
          {variantsLoading && (
            <div className="flex justify-center py-8">
              <GenerationTimer label="Writing three takes on your idea…" />
            </div>
          )}

          {/* Mobile: horizontal scroll strip */}
          {!variantsLoading && (
            <>
              <div className="md:hidden flex gap-3 px-4 py-4 overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                {variants.map((v, i) => {
                  const meta = VARIANT_STYLES.find(s => s.id === v.styleId);
                  return (
                    <button
                      key={i}
                      onClick={() => chooseVariant(v)}
                      className="flex-shrink-0 snap-center bg-white text-left active:scale-[0.98] transition-transform"
                      style={{ width: 'calc(85vw)', borderRadius: 16, border: '1.5px solid #EDE8FF', boxShadow: '0 4px 20px rgba(124,92,252,0.10)', padding: 16 }}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2.5" style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}>
                        <span>{meta?.emoji}</span>{meta?.label || v.styleId}
                      </span>
                      <p className="text-[13px] leading-relaxed line-clamp-6 mb-3" style={{ color: '#1A1A2E', whiteSpace: 'pre-wrap' }}>
                        {v.content}
                      </p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[11px] text-brand-muted">Tap to use</span>
                        <span className="text-[11px] font-bold text-brand-purple">Use this →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Scroll dots indicator */}
              {variants.length > 1 && (
                <div className="md:hidden flex justify-center gap-1.5 pb-2">
                  {variants.map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand-purple/20" />
                  ))}
                </div>
              )}

              {/* Desktop: 3-col grid */}
              <div className="hidden md:grid md:grid-cols-3 gap-4 max-w-5xl mx-auto px-8 py-6">
                {variants.map((v, i) => {
                  const meta = VARIANT_STYLES.find(s => s.id === v.styleId);
                  return (
                    <button
                      key={i}
                      onClick={() => chooseVariant(v)}
                      className="bg-white flex flex-col text-left hover:shadow-lg hover:-translate-y-0.5 transition-all"
                      style={{ borderRadius: 14, padding: 16, border: '1.5px solid #EDE8FF', boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3 self-start" style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}>
                        <span>{meta?.emoji}</span>{meta?.label || v.styleId}
                      </span>
                      <p className="text-[12.5px] flex-1 line-clamp-8 mb-3" style={{ color: '#1A1A2E', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {v.content}
                      </p>
                      <div className="w-full text-[12px] font-bold text-brand-purple text-center py-2 rounded-full" style={{ border: '1.5px solid #EDE8FF' }}>
                        Use this version
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {variantsLoading && (
            <div className="md:hidden flex gap-3 px-4 pb-4 overflow-x-auto">
              {Array.from({ length: VARIANT_COUNT }).map((_, i) => (
                <div key={i} className="flex-shrink-0 bg-white flex flex-col gap-2" style={{ width: 'calc(85vw)', borderRadius: 16, padding: 16, border: '1.5px solid #EDE8FF', minHeight: 220 }}>
                  <div className="skeleton h-5 w-20 rounded-full mb-2" />
                  {[0,1,2,3].map(j => <div key={j} className="skeleton h-3 rounded" style={{ width: `${88 - j * 10}%` }} />)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border-t px-4 md:px-8 py-3 flex items-center justify-between" style={{ borderColor: '#EDE8FF' }}>
          <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: '#6B7280' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <p className="text-[11px] text-brand-muted">Swipe to see all three</p>
        </div>
      </div>
    );
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const CUTOFF = 210;

  const topSources = sources.slice(0, 3);

  return (
    <div className="flex-1 min-h-0 flex flex-col">

      {/* ── Mobile-only compact header ── */}
      <div className="md:hidden bg-white border-b flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0" style={{ color: '#6B7280' }}>
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={onBack}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full truncate text-left"
          style={{ border: '1.5px solid #D4CEFF', color: '#7C5CFC' }}
        >
          <Check size={11} className="flex-shrink-0" />
          <span className="truncate">
            {angle ? `${angle.style} · ${angle.hook.slice(0, 28)}${angle.hook.length > 28 ? '…' : ''}` : (editMode ? 'Editing draft' : customTopic.slice(0, 28) || 'New post')}
          </span>
        </button>
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: content.length > 2700 ? '#F72585' : '#9CA3AF' }}>{content.length}</span>
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ color: '#6B7280' }}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* ── Desktop-only spark bar ── */}
      <div className="hidden md:flex bg-white border-b px-6 py-2.5 items-center gap-2 flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
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
          placeholder="What sparked this? A URL, quote, or what triggered it (optional)"
          className="flex-1 min-w-0 text-[13px] bg-transparent outline-none px-2 py-0.5"
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

      {/* ── Main content area ── */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left column / mobile full editor */}
        <div className="flex-1 min-w-0 bg-white flex flex-col md:border-r" style={{ borderColor: '#EDE8FF' }}>

          {/* Desktop-only toolbar */}
          <div className="hidden md:flex items-center gap-1 px-4 py-2 border-b flex-wrap" style={{ borderColor: '#EDE8FF' }}>
            <FormatBtn icon={Bold} onClick={() => transformSelection(BOLD)} label="Bold" shortcut="⌘B" preview="𝗕" />
            <FormatBtn icon={Italic} onClick={() => transformSelection(ITALIC)} label="Italic" shortcut="⌘I" preview="𝘐" />
            <FormatBtn icon={Bold} onClick={() => transformSelection(BOLD_ITALIC)} label="Bold Italic" shortcut="⌘⇧B" preview="𝗕𝘐" />
            <FormatBtn icon={Strikethrough} onClick={() => transformSelection(applyStrikethrough)} label="Strikethrough" shortcut="⌘⇧X" preview="S̶" />
            <div className="w-px h-5 mx-0.5" style={{ background: '#EDE8FF' }} />
            <div className="relative">
              <ToolBtn icon={MoreHorizontal} onClick={() => setFormatMoreOpen(o => !o)} label="More formatting" />
              {formatMoreOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl p-2 z-20 modal-shadow w-48 max-w-[calc(100vw-32px)]">
                  <div className="flex gap-1 flex-wrap mb-2 pb-2 border-b" style={{ borderColor: '#EDE8FF' }}>
                    {['😀', '🔥', '💡', '✅', '📈', '🎯', '🚀', '👏', '💬', '⚡', '🙌', '✨'].map(e => (
                      <button key={e} onClick={() => { insertAtCursor(e); setFormatMoreOpen(false); }} className="text-lg p-1 hover:bg-[rgba(124,92,252,0.06)] rounded-lg">{e}</button>
                    ))}
                  </div>
                  <button onClick={() => { insertAtCursor('\n───\n'); setFormatMoreOpen(false); }} className="flex items-center gap-2 w-full text-left text-[12px] font-medium px-2 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>
                    <Minus size={13} /> Divider
                  </button>
                  <button onClick={() => { prefixLines(() => '• '); setFormatMoreOpen(false); }} className="flex items-center gap-2 w-full text-left text-[12px] font-medium px-2 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>
                    <List size={13} /> Bullets
                  </button>
                  <button onClick={() => { prefixLines(i => `${i + 1}. `); setFormatMoreOpen(false); }} className="flex items-center gap-2 w-full text-left text-[12px] font-medium px-2 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>
                    <ListOrdered size={13} /> Numbers
                  </button>
                </div>
              )}
            </div>
            <div className="w-px h-5 mx-1" style={{ background: '#EDE8FF' }} />
            <div className="relative">
              <button onClick={() => setHooksOpen(o => !o)} className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1.5 rounded-full" style={{ color: '#7C5CFC', background: 'rgba(124,92,252,0.06)' }}>
                Hooks <ChevronDown size={12} />
              </button>
              {hooksOpen && (
                <HookLibraryPanel
                  userId={userId}
                  userRole={userRole}
                  userDomain={userDomain}
                  onInsert={text => { insertHookTemplate(text); setHooksOpen(false); }}
                />
              )}
            </div>
            <div className="relative">
              <button onClick={() => setCtasOpen(o => !o)} className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1.5 rounded-full" style={{ color: '#7C5CFC', background: 'rgba(124,92,252,0.06)' }}>
                CTAs <ChevronDown size={12} />
              </button>
              {ctasOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl p-2 z-20 modal-shadow w-80 max-w-[calc(100vw-32px)] max-h-72 overflow-y-auto">
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

          {/* Editor textarea */}
          <div className="flex-1 min-h-0 p-4">
            {isGenerating ? (
              <div className="h-full rounded-xl p-4 flex flex-col items-center justify-center gap-4" style={{ background: '#FDFCFF', border: '1.5px solid #EDE8FF' }}>
                <GenerationTimer />
                <p className="text-[12px] font-semibold animate-fadeIn text-center" style={{ color: '#7C5CFC' }} key={loadingMsgIdx}>
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
                <div className="w-full max-w-sm flex flex-col gap-2">
                  {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-3.5 rounded" style={{ width: `${90 - i * 12}%` }} />)}
                </div>
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
                onKeyDown={handleEditorKeyDown}
                className="w-full h-full min-h-[200px] outline-none md:resize-y resize-none"
                style={{ border: '1.5px solid #EDE8FF', borderRadius: 12, padding: 16, fontSize: 14, lineHeight: 1.9, color: '#1A1A2E', background: '#FDFCFF' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7C5CFC'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124,92,252,0.06)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#EDE8FF'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            )}
          </div>

          {/* Desktop-only editor footer (Aria refine + char count) */}
          <div className="hidden md:flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 border-t" style={{ borderColor: '#EDE8FF' }}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>{content.length} / 3,000</span>
              <button
                onClick={handleHumanize}
                disabled={humanizing || !content.trim()}
                title="Remove AI tells: banned words, staccato stacks, reveal bridges, and more"
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full disabled:opacity-40 transition-opacity"
                style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}
              >
                <Wand2 size={10} />
                {humanizing ? 'Humanizing…' : 'Humanize'}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Sparkles size={14} style={{ color: '#7C5CFC', flexShrink: 0 }} />
              <input
                type="text"
                value={ariaInput}
                onChange={e => setAriaInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAriaRefine(); }}
                placeholder="Ask Aria to refine: make it shorter, add a stat, change the ending..."
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

        {/* Right column: desktop only */}
        <div className="hidden md:flex md:w-[240px] flex-shrink-0 p-4 flex-col gap-3 overflow-y-auto" style={{ background: '#F8F5FF' }}>
          <LinkedInPreviewCard
            userName={userName}
            userInitials={userInitials}
            userAvatar={userAvatar}
            content={content}
            cutoff={CUTOFF}
          />
          {!insightsOpen ? (
            <button
              onClick={() => setInsightsOpen(true)}
              className="text-left rounded-[14px] p-3.5"
              style={{ background: 'white', border: '1.5px dashed #D4CEFF' }}
            >
              <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: '#7C5CFC' }}>
                Show more tools <ChevronDown size={12} />
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>Content score, best time to post, carousel</p>
            </button>
          ) : (
            <>
              <div className="bg-white rounded-[14px] p-3.5" style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}>
                <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: '#9CA3AF' }}>Content Signal</p>
                {authLocked ? (
                  <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Upgrade to Individual to enable AI content check.</p>
                ) : authLoading ? (
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-2/3 rounded" />
                    <div className="skeleton h-5 w-full rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                  </div>
                ) : authScore?.signal ? (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[13px] font-extrabold" style={{ color: '#1A1A2E' }}>{authScore.signal.label}</span>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: authScore.signal.readyToPost ? '#10B981' : '#F59E0B', boxShadow: authScore.signal.readyToPost ? '0 0 0 3px rgba(16,185,129,0.2)' : '0 0 0 3px rgba(245,158,11,0.2)' }} />
                    </div>
                    {authScore.signal.readyToPost ? (
                      <p className="text-[11px] font-semibold" style={{ color: '#10B981' }}>✓ Looks ready to post</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase" style={{ color: '#F59E0B' }}>{authScore.signal.issues.length} thing{authScore.signal.issues.length !== 1 ? 's' : ''} to check</p>
                        {authScore.signal.issues.map((issue, i) => (
                          <div key={i} className="rounded-lg p-2" style={{ background: '#FFFBF0', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <p className="text-[10px] leading-snug mb-1" style={{ color: '#92400E' }}>
                              <AlertTriangle size={9} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                              {issue.message}
                            </p>
                            <p className="text-[9px] flex items-start gap-0.5" style={{ color: '#B45309' }}>
                              <ChevronRight size={9} className="flex-shrink-0 mt-0.5" />
                              {issue.suggestion}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : authScore ? (
                  <p className="text-[11px] font-semibold" style={{ color: authScore.readyToPost ? '#10B981' : '#F59E0B' }}>
                    {authScore.readyToPost ? '✓ Looks ready to post' : 'One thing to review'}
                  </p>
                ) : (
                  <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Checking in a moment...</p>
                )}
              </div>
              <div className="bg-white rounded-[14px] p-3.5" style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}>
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
              </div>
              <div className="rounded-[14px] p-3.5 relative" style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(247,37,133,0.08) 100%)' }}>
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
              <button onClick={() => setInsightsOpen(false)} className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>Hide extra tools</button>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile-only bottom bar ── */}
      <div className="md:hidden bg-white border-t flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
        {/* Mobile Hooks panel: slides up above the bottom bar */}
        {hooksOpen && (
          <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden" onClick={() => setHooksOpen(false)}>
            <div className="mx-0 mb-[112px] mx-4 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(124,92,252,0.18)' }}>
              <HookLibraryPanel
                userId={userId}
                userRole={userRole}
                userDomain={userDomain}
                onInsert={text => { insertHookTemplate(text); setHooksOpen(false); }}
              />
            </div>
          </div>
        )}
        {/* Mobile CTAs panel */}
        {ctasOpen && (
          <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden" onClick={() => setCtasOpen(false)}>
            <div className="mx-4 mb-[112px] bg-white rounded-2xl p-3 overflow-y-auto" onClick={e => e.stopPropagation()} style={{ maxHeight: '60vh', boxShadow: '0 -4px 32px rgba(124,92,252,0.18)' }}>
              <p className="text-[10px] font-bold uppercase px-1 pb-2 mb-1 border-b" style={{ color: '#9CA3AF', borderColor: '#EDE8FF' }}>Call to action</p>
              {CTA_TEMPLATES.map((c, i) => (
                <button key={i} onClick={() => { insertAtCursor('\n\n' + c); setCtasOpen(false); }} className="block w-full text-left text-[13px] px-2 py-2.5 rounded-xl active:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formatting toolbar row */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b overflow-x-auto flex-shrink-0" style={{ borderColor: '#F0EEF8', scrollbarWidth: 'none' }}>
          <button onClick={() => transformSelection(BOLD)} className="w-9 h-9 flex items-center justify-center rounded-xl text-[15px] font-extrabold flex-shrink-0" style={{ color: '#1A1A2E' }}>B</button>
          <button onClick={() => transformSelection(ITALIC)} className="w-9 h-9 flex items-center justify-center rounded-xl text-[15px] font-medium italic flex-shrink-0" style={{ color: '#1A1A2E', fontStyle: 'italic' }}>I</button>
          <button onClick={() => transformSelection(applyStrikethrough)} className="w-9 h-9 flex items-center justify-center rounded-xl text-[14px] flex-shrink-0 line-through" style={{ color: '#1A1A2E' }}>S</button>
          <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#EDE8FF' }} />
          <button
            onClick={() => { setHooksOpen(o => !o); setCtasOpen(false); }}
            className="flex items-center gap-1 text-[12px] font-bold px-3 py-2 rounded-full flex-shrink-0"
            style={{ color: '#7C5CFC', background: hooksOpen ? 'rgba(124,92,252,0.14)' : 'rgba(124,92,252,0.07)' }}
          >
            Hooks
          </button>
          <button
            onClick={() => { setCtasOpen(o => !o); setHooksOpen(false); }}
            className="flex items-center gap-1 text-[12px] font-bold px-3 py-2 rounded-full flex-shrink-0"
            style={{ color: '#7C5CFC', background: ctasOpen ? 'rgba(124,92,252,0.14)' : 'rgba(124,92,252,0.07)' }}
          >
            CTAs
          </button>
          <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#EDE8FF' }} />
          <button
            onClick={handleHumanize}
            disabled={humanizing || !content.trim()}
            className="flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-full flex-shrink-0 disabled:opacity-40"
            style={{ background: 'rgba(124,92,252,0.07)', color: '#7C5CFC' }}
          >
            <Wand2 size={11} />
            {humanizing ? 'Working…' : 'Humanize'}
          </button>
        </div>

        {/* Primary CTA row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handlePublish}
            disabled={publishing || isGenerating || !content.trim()}
            className="flex-1 flex items-center justify-center gap-2 text-[14px] font-bold text-white py-3.5 rounded-2xl disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 6px 20px rgba(124,92,252,0.28)' }}
          >
            {publishing ? 'Publishing...' : 'Post to LinkedIn'}
          </button>
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{ border: '1.5px solid #EDE8FF', color: '#6B7280' }}
            aria-label="More options"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* ── Desktop-only bottom action bar ── */}
      <div className="hidden md:flex bg-white border-t px-6 py-3 flex-row items-center gap-2" style={{ borderColor: '#EDE8FF' }}>
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
          <button onClick={openSchedule} className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-full" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
            <Calendar size={13} /> Schedule
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={handlePublish}
          disabled={publishing || isGenerating || !content.trim()}
          className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-white px-6 py-2.5 rounded-full disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.25)' }}
        >
          {publishing ? 'Publishing...' : 'Post to LinkedIn →'}
        </button>
      </div>

      {/* ── Mobile drawer (bottom sheet for secondary actions) ── */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fadeIn" style={{ background: 'rgba(0,0,0,0.40)' }} onClick={() => setMobileDrawerOpen(false)}>
          <div className="bg-white rounded-t-3xl px-5 pt-4 pb-8" onClick={e => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#E5E7EB' }} />

            {/* Length */}
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: '#9CA3AF' }}>Post length</p>
            <div className="flex gap-2 mb-5">
              {LENGTH_OPTIONS.map(l => (
                <button
                  key={l.id}
                  onClick={() => onLengthChange(l.id)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                  style={selectedLength === l.id
                    ? { background: 'linear-gradient(135deg, #7C5CFC, #F72585)', color: 'white' }
                    : { color: '#6B7280', border: '1.5px solid #EDE8FF' }}
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>

            {/* Aria refine */}
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: '#9CA3AF' }}>Refine with Aria</p>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-5" style={{ border: '1.5px solid #EDE8FF' }}>
              <Sparkles size={14} style={{ color: '#7C5CFC', flexShrink: 0 }} />
              <input
                type="text"
                value={ariaInput}
                onChange={e => setAriaInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && ariaInput.trim()) { handleAriaRefine(); setMobileDrawerOpen(false); } }}
                placeholder="Shorten it, add a stat, change the ending..."
                className="flex-1 text-[13px] bg-transparent outline-none"
                style={{ color: '#1A1A2E' }}
              />
              <button
                onClick={() => { if (ariaInput.trim()) { handleAriaRefine(); setMobileDrawerOpen(false); } }}
                disabled={ariaRefining || !ariaInput.trim()}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}
              >
                <Send size={12} color="white" />
              </button>
            </div>

            {/* Add context */}
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: '#9CA3AF' }}>Add context (optional)</p>
            <input
              type="text"
              value={sparkInput}
              onChange={e => setSparkInput(e.target.value)}
              placeholder="A URL, quote, or what inspired this post..."
              className="w-full text-[13px] px-3 py-2.5 rounded-xl mb-5 outline-none"
              style={{ border: '1.5px solid #EDE8FF', color: '#1A1A2E' }}
            />

            {/* Actions grid */}
            <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: '#9CA3AF' }}>Actions</p>
            <div className="grid grid-cols-3 gap-2.5">
              <button onClick={() => { handleCopy(); setMobileDrawerOpen(false); }} className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform" style={{ border: '1.5px solid #EDE8FF' }}>
                <Copy size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Copy</span>
              </button>
              <button onClick={() => { handleSaveDraft(); setMobileDrawerOpen(false); }} disabled={savingDraft} className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-50" style={{ border: '1.5px solid #EDE8FF' }}>
                <Save size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>{savingDraft ? 'Saving…' : 'Save'}</span>
              </button>
              <button onClick={() => { openSchedule(); setMobileDrawerOpen(false); }} className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform" style={{ border: '1.5px solid #EDE8FF' }}>
                <Calendar size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal: fixed overlay, triggered from both the bottom bar and Best Time panel */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 animate-fadeIn" onClick={() => setScheduleOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[14px] font-bold" style={{ color: '#1A1A2E' }}>Schedule this post</p>
              <button onClick={() => setScheduleOpen(false)} style={{ color: '#9CA3AF' }}><X size={16} /></button>
            </div>
            {bestTime?.recommendedDays?.[0] && (
              <div className="rounded-xl px-3 py-2 mb-3 text-[11px] font-semibold flex items-center gap-1.5" style={{ background: 'rgba(124,92,252,0.06)', color: '#7C5CFC' }}>
                <Clock size={11} /> Best time: {bestTime.recommendedDays[0]} at {bestTime.recommendedTimes?.[0] || ''}
              </div>
            )}
            <label className="block text-[11px] font-bold mb-1" style={{ color: '#6B7280' }}>Date</label>
            <input
              type="date"
              value={scheduleDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setScheduleDate(e.target.value)}
              className="w-full text-[13px] px-3 py-2 rounded-xl mb-3"
              style={{ border: '1.5px solid #EDE8FF' }}
            />
            <label className="block text-[11px] font-bold mb-1" style={{ color: '#6B7280' }}>Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={e => setScheduleTime(e.target.value)}
              className="w-full text-[13px] px-3 py-2 rounded-xl mb-4"
              style={{ border: '1.5px solid #EDE8FF' }}
            />
            <button
              onClick={handleConfirmSchedule}
              disabled={scheduling || !scheduleDate || !scheduleTime}
              className="w-full text-[13px] font-bold text-white py-2.5 rounded-full disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}
            >
              {scheduling ? 'Scheduling...' : 'Confirm schedule'}
            </button>
            <p className="text-[10px] text-center mt-2" style={{ color: '#9CA3AF' }}>
              Posts publish within the hour of your selected time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Indeterminate spinner + live elapsed-seconds readout for the generation
// waits, which run anywhere from ~2s to ~15s depending on length/variant
// count. No fake progress-to-100%, since we don't know the real duration.
function GenerationTimer({ label }: { label?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center gap-2.5">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <svg width={56} height={56} className="animate-spin" style={{ animationDuration: '1.1s' }}>
          <circle cx={28} cy={28} r={22} stroke="rgba(124,92,252,0.12)" strokeWidth={4} fill="none" />
          <circle
            cx={28} cy={28} r={22} stroke="url(#genTimerGradient)" strokeWidth={4} fill="none"
            strokeDasharray={138} strokeDashoffset={95} strokeLinecap="round"
          />
          <defs>
            <linearGradient id="genTimerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C5CFC" />
              <stop offset="100%" stopColor="#F72585" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-extrabold" style={{ color: '#7C5CFC' }}>{elapsed.toFixed(1)}s</span>
        </div>
      </div>
      {label && <p className="text-[12px] font-semibold text-center" style={{ color: '#7C5CFC' }}>{label}</p>}
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

// Simulates a LinkedIn feed post card with the real "see more" expand/collapse
// and a character count progress bar at the bottom.
function LinkedInPreviewCard({
  userName, userInitials, userAvatar, content, cutoff,
}: { userName: string; userInitials: string; userAvatar: string; content: string; cutoff: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const LIMIT = 3000;
  const pct = Math.min(100, (content.length / LIMIT) * 100);
  const overLimit = content.length > LIMIT;
  const needsSeeMore = content.length > cutoff;

  const visibleText = (!needsSeeMore || expanded) ? content : content.slice(0, cutoff);

  // Bar color: green up to 80%, amber 80-95%, red 95%+
  const barColor = pct >= 95 ? '#F72585' : pct >= 80 ? '#F59E0B' : '#10B981';

  return (
    <div className="bg-white rounded-[14px] flex-shrink-0 w-[210px] md:w-auto snap-start overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(124,92,252,0.10)', border: '1px solid #EDE8FF' }}>
      {/* Card header */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Preview</p>
        <div className="flex items-center gap-2 mb-2">
          {userAvatar
            ? <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>{userInitials || 'Y'}</div>
          }
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold truncate leading-tight" style={{ color: '#1A1A2E' }}>{userName || 'You'}</p>
            <p className="text-[9px] leading-tight" style={{ color: '#9CA3AF' }}>Just now · 🌐</p>
          </div>
        </div>

        {/* Post text */}
        {content.trim() ? (
          <div>
            <p className="text-[11px] whitespace-pre-wrap break-words leading-relaxed" style={{ color: '#1A1A2E' }}>
              {visibleText}
            </p>
            {needsSeeMore && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-[11px] font-semibold mt-0.5"
                style={{ color: '#0a66c2' }}
              >
                {expanded ? 'see less' : '...see more'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] italic" style={{ color: '#C4C4C4' }}>Your post will appear here as you type...</p>
        )}
      </div>

      {/* Engagement strip */}
      <div className="px-3 pb-2.5">
        <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: '#F0EEF8' }}>
          <span className="flex items-center gap-1 text-[10px]" style={{ color: '#9CA3AF' }}>
            <ThumbsUp size={11} /> Like
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{ color: '#9CA3AF' }}>
            <MessageCircle size={11} /> Comment
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{ color: '#9CA3AF' }}>
            <Repeat2 size={11} /> Repost
          </span>
        </div>
      </div>

      {/* Character count bar */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold" style={{ color: overLimit ? '#F72585' : '#9CA3AF' }}>
            {overLimit ? `${content.length - LIMIT} over limit` : `${content.length} / ${LIMIT}`}
          </span>
          {needsSeeMore && !expanded && (
            <span className="text-[9px] font-semibold" style={{ color: '#7C5CFC' }}>
              Hook: {cutoff} chars
            </span>
          )}
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#F0EEF8' }}>
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      </div>
    </div>
  );
}

// Format button: shows a styled-text preview and a keyboard shortcut tooltip.
function FormatBtn({ icon: Icon, onClick, label, shortcut, preview }: {
  icon: React.ComponentType<any>; onClick: () => void; label: string; shortcut: string; preview: string;
}) {
  const [hov, setHov] = React.useState(false);
  return (
    <div className="relative">
      <button
        onClick={onClick}
        aria-label={`${label} (${shortcut})`}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="h-7 px-2 rounded-lg flex items-center gap-1 transition-colors text-[13px] font-semibold"
        style={{ color: '#6B7280' }}
        onMouseDown={e => { e.currentTarget.style.background = 'rgba(124,92,252,0.10)'; }}
        onMouseUp={e => { e.currentTarget.style.background = hov ? 'rgba(124,92,252,0.06)' : 'transparent'; e.currentTarget.style.color = '#7C5CFC'; }}
      >
        <span style={{ fontFamily: 'inherit' }}>{preview}</span>
      </button>
      {hov && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap pointer-events-none z-50"
          style={{ background: '#1A1A2E', color: 'white' }}>
          {label} <span style={{ opacity: 0.6 }}>{shortcut}</span>
        </div>
      )}
    </div>
  );
}
