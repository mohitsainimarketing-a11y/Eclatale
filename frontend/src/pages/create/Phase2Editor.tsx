import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, Copy, Save, Calendar, Bold, Italic, Strikethrough, Minus, List, ListOrdered, MoreHorizontal,
  ChevronDown, Send, Sparkles, AlertTriangle, Clock, LayoutGrid,
  ThumbsUp, MessageCircle, Repeat2, X, Check, ChevronRight, Wand2, RefreshCw, FlaskConical, Layers,
  Monitor, Smartphone, Eye, Pencil, Zap, Smile, History, Settings2,
  Undo2, Redo2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { apiFetch } from '../../lib/apiFetch';
import { copyToClipboard } from '../../utils/clipboard';
import { RICH_TEXT_STYLES, applyStrikethrough } from '../../lib/richText';
import { useToast } from '../../contexts/ToastContext';
import { Angle, Source, PostLength, LENGTH_OPTIONS, AuthenticityScoreResult, ResearchBrief } from './types';
import { CTA_TEMPLATES } from './hookCtaTemplates';
import HookLibraryPanel from './HookLibraryPanel';
import Avatar from '../../components/Avatar';
import { useUndoStack } from '../../hooks/useUndoStack';
import EmojiPickerLazy from './EmojiPickerLazy';
import MoreStylesDrawer from './MoreStylesDrawer';
import VersionHistoryDrawer, { PostVersion } from './VersionHistoryDrawer';
import { ContentStyle } from './contentStyles';

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

const ARIA_THINKING_MSGS = [
  'Aria is on it...',
  'Consulting the writing gods...',
  'Teaching words to behave...',
  'Polishing every syllable...',
  'Sprinkling the magic dust...',
  'Almost done, pinky promise...',
];

const VARIANT_STYLES = [
  { styleId: 'storyteller', label: 'Tell a story', emoji: '📖' },
  { styleId: 'contrarian', label: 'Challenge the norm', emoji: '🔥' },
  { styleId: 'analyst', label: 'Lead with data', emoji: '📊' },
] as const;

const QUICK_ACTIONS = [
  {
    label: 'Improve this post',
    emoji: '⚡',
    instruction: 'Improve the overall quality of this post. Make it more engaging, punchy, and ready to perform on LinkedIn. Keep the core message and structure.',
  },
  {
    label: 'Rewrite the hook',
    emoji: '🎣',
    instruction: 'Rewrite only the opening line or two (the hook). Make it more attention-grabbing and scroll-stopping. Keep the rest of the post exactly the same.',
  },
  {
    label: 'Fix grammar',
    emoji: '✅',
    instruction: 'Fix all grammar and spelling mistakes. Do not change the tone, structure, or meaning. Minimal edits only.',
  },
  {
    label: 'Remove AI tells',
    emoji: '🧹',
    instruction: 'Remove all AI writing patterns: no em dashes, no staccato stacks, no banned words like "delve", "leverage", "transformative", "cutting-edge". Make it sound like a real human wrote it.',
  },
];

const MAKE_IT_PILLS = [
  { label: 'Shorter', instruction: 'Make this post shorter. Cut it by about 30% while keeping all key points.' },
  { label: 'Longer', instruction: 'Expand this post with more depth, examples, or supporting detail. Add roughly 30% more content.' },
  { label: 'Bolder', instruction: 'Make the language bolder and more confident. Stronger verbs, more decisive statements, less hedging.' },
  { label: 'Funnier', instruction: 'Add a touch of wit and dry humor. Keep it professional but make it more enjoyable to read.' },
  { label: 'Casual', instruction: 'Make the tone more casual and conversational. Like explaining to a smart friend over coffee.' },
  { label: 'Formal', instruction: 'Make the tone more formal and professional. Appropriate for a senior corporate audience.' },
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
  preloadedResearchBrief?: ResearchBrief;
  presetStyleId?: string;
}

export default function Phase2Editor({
  userId, userName, userInitials, userAvatar, userRole, userDomain, angle, customTopic, sources,
  editMode, initialPostId, initialContent, selectedLength, onLengthChange, onBack, onPublished,
  preloadedSpark, preloadedResearchBrief, presetStyleId,
}: Phase2Props) {
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState(initialContent);
  const [postId, setPostId] = useState<string | null>(initialPostId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [genError, setGenError] = useState('');
  const [sparkInput, setSparkInput] = useState(preloadedSpark || '');
  const [researchPanelOpen, setResearchPanelOpen] = useState(true);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variants, setVariants] = useState<{ styleId: string; label: string; emoji: string; content: string }[]>([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);

  // New UI state for LinkedIn-style editor
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const [ariaThinkingIdx, setAriaThinkingIdx] = useState(0);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

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

  // ── Phase 2: Undo/redo ──────────────────────────────────────────────────────
  const { push: pushUndo, undo: undoStep, redo: redoStep, canUndo, canRedo, reset: resetUndo } = useUndoStack(initialContent);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Phase 2: Diff preview (Make-It pills + More styles) ──────────────────────
  const [pendingDiff, setPendingDiff] = useState<{ before: string; after: string; label: string } | null>(null);

  // ── Phase 2: More styles drawer ──────────────────────────────────────────────
  const [moreStylesOpen, setMoreStylesOpen] = useState(false);
  const [formatOptionsOpen, setFormatOptionsOpen] = useState(false);

  // ── Phase 2: Version history ─────────────────────────────────────────────────
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [savingVersion, setSavingVersion] = useState(false);

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

  const generateStreaming = useCallback(async (
    spark: string,
    onChunk: (text: string) => void,
    styleId?: string,
    includeHook: boolean = true,
    lengthOverride?: PostLength,
  ): Promise<void> => {
    const res = await apiFetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        topic: currentTopic(), tone: 'professional', contentType: 'linkedin-post', contentLength: lengthOverride ?? selectedLength,
        angle: angle
          ? { style: angle.style, styleId: styleId || angle.styleId, hook: includeHook ? angle.hook : undefined, insight: angle.insight }
          : ((styleId || presetStyleId) ? { styleId: styleId || presetStyleId } : undefined),
        spark: spark || undefined,
        userId,
      }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: 'Generation failed' }));
      throw new Error(err.message || err.error || 'Generation failed');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') return;
        try { const { text } = JSON.parse(payload); if (text) onChunk(text); } catch { /* skip malformed */ }
      }
    }
  }, [angle, currentTopic, selectedLength, userId, presetStyleId]);

  const savePost = useCallback(async (postContent: string) => {
    const { data: inserted } = await supabase.from('posts').insert({
      user_id: userId, content: postContent, topic: currentTopic(), tone: 'professional', content_type: 'linkedin-post', source: 'auto',
    }).select('id').single();
    if (inserted) setPostId(inserted.id);
  }, [userId, currentTopic]);

  const handleGenerate = useCallback(async (lengthOverride?: PostLength) => {
    setIsGenerating(true);
    setGenError('');
    checkedRef.current = false;
    let accumulated = '';
    try {
      const spark = await resolveSpark();
      setContent('');
      await generateStreaming(spark, (chunk) => {
        accumulated += chunk;
        setContent(accumulated);
      }, undefined, true, lengthOverride);
      if (accumulated) await savePost(accumulated);
    } catch (e: any) {
      setGenError(e.message || "Couldn't generate a post. Try again.");
    }
    setIsGenerating(false);
  }, [resolveSpark, generateStreaming, savePost]);

  const handleLengthAndRegenerate = (l: PostLength) => {
    onLengthChange(l);
    handleGenerate(l);
  };

  useEffect(() => {
    if (!editMode) handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2000);
    return () => clearInterval(t);
  }, [isGenerating]);

  // Rotate Aria thinking messages while refining
  useEffect(() => {
    if (!ariaRefining) return;
    const t = setInterval(() => setAriaThinkingIdx(i => (i + 1) % ARIA_THINKING_MSGS.length), 1800);
    return () => clearInterval(t);
  }, [ariaRefining]);

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

  // ── Aria refine (accepts optional preset instruction for quick actions) ──

  const handleAriaRefine = async (overrideInstruction?: string) => {
    const instruction = overrideInstruction || ariaInput.trim();
    if (!instruction || ariaRefining) return;
    setAriaRefining(true);
    const prevContent = content;
    try {
      const res = await apiFetch(`${API_URL}/api/refine-content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: content, instruction, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      pushUndo(prevContent);
      setContent(data.content);
      if (!overrideInstruction) setAriaInput('');
      checkedRef.current = false;
      if (postId) {
        await supabase.from('posts').update({ content: data.content }).eq('id', postId);
        await saveVersion('Before AI refinement').catch(() => {});
      }
    } catch (e: any) {
      showToast('error', e.message || 'Refine failed. Try again.');
    }
    setAriaRefining(false);
  };

  // ── Variant generation ────────────────────────────────────────────────────

  const handleGenerateVariants = useCallback(async () => {
    if (generatingVariants || isGenerating) return;
    setGeneratingVariants(true);
    setVariantsOpen(true);
    setVariants(VARIANT_STYLES.map(s => ({ ...s, content: '' })));
    const spark = await resolveSpark();
    await Promise.allSettled(
      VARIANT_STYLES.map(async (style, idx) => {
        try {
          let acc = '';
          await generateStreaming(spark, (chunk) => {
            acc += chunk;
            setVariants(prev => prev.map((v, i) => i === idx ? { ...v, content: acc } : v));
          }, style.styleId, false);
        } catch { /* leave variant empty on error */ }
      })
    );
    setGeneratingVariants(false);
  }, [generatingVariants, isGenerating, resolveSpark, generateStreaming]);

  // ── 4-pass humanizer ─────────────────────────────────────────────────────

  const handleHumanize = async () => {
    if (!content.trim() || humanizing) return;
    setHumanizing(true);
    const prevContent = content;
    try {
      const res = await apiFetch(`${API_URL}/api/humanize-post`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ postContent: content, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      pushUndo(prevContent);
      setContent(data.content);
      checkedRef.current = false;
      if (postId) {
        await supabase.from('posts').update({ content: data.content }).eq('id', postId);
        await saveVersion('Before humanize').catch(() => {});
      }
      showToast('success', 'AI tells removed. Post humanized.');
    } catch (e: any) {
      showToast('error', e.message || 'Humanize failed. Try again.');
    }
    setHumanizing(false);
  };

  // ── Phase 2: save / load versions ────────────────────────────────────────

  const saveVersion = useCallback(async (label: string) => {
    if (!postId || !content.trim()) return;
    setSavingVersion(true);
    try {
      await supabase.from('post_versions').insert({
        post_id: postId, user_id: userId, content, label,
      });
      await loadVersions();
    } catch { /* table may not exist yet */ }
    setSavingVersion(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, userId, content]);

  const loadVersions = useCallback(async () => {
    if (!postId) return;
    try {
      const { data } = await supabase
        .from('post_versions')
        .select('id,content,label,created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setVersions(data as PostVersion[]);
    } catch { /* ignore if table does not exist yet */ }
  }, [postId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const handleRestore = useCallback(async (version: PostVersion) => {
    pushUndo(content);
    const restoredContent = version.content;
    setContent(restoredContent);
    checkedRef.current = false;
    if (postId) {
      await supabase.from('posts').update({ content: restoredContent }).eq('id', postId);
      // Restore creates a new version so history is never lost
      await supabase.from('post_versions').insert({
        post_id: postId, user_id: userId, content: restoredContent, label: `Restored: ${version.label || 'version'}`,
      });
      await loadVersions();
    }
    showToast('success', 'Version restored. Previous state saved for undo.');
  }, [content, postId, userId, pushUndo, loadVersions, showToast]);

  // ── Phase 2: style refine (shows diff, reversible) ────────────────────────

  const handleStyleRefine = async (instruction: string, label: string) => {
    if (!content.trim() || ariaRefining) return;
    setAriaRefining(true);
    try {
      const res = await apiFetch(`${API_URL}/api/refine-content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: content, instruction, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      setPendingDiff({ before: content, after: data.content, label });
    } catch (e: any) {
      showToast('error', e.message || 'Style change failed. Try again.');
    }
    setAriaRefining(false);
  };

  const acceptDiff = async () => {
    if (!pendingDiff) return;
    pushUndo(pendingDiff.before);
    setContent(pendingDiff.after);
    checkedRef.current = false;
    if (postId) {
      await supabase.from('posts').update({ content: pendingDiff.after }).eq('id', postId);
      await saveVersion(`Before: ${pendingDiff.label}`).catch(() => {});
    }
    setPendingDiff(null);
  };

  const rejectDiff = () => setPendingDiff(null);

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
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; pushUndo(content); }
      const prev = undoStep();
      if (prev !== null) setContent(prev);
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      const next = redoStep();
      if (next !== null) setContent(next);
    } else if (e.key === 'b' && !e.shiftKey) { e.preventDefault(); transformSelection(BOLD); }
    else if (e.key === 'i' && !e.shiftKey) { e.preventDefault(); transformSelection(ITALIC); }
    else if (e.key === 'b' && e.shiftKey) { e.preventDefault(); transformSelection(BOLD_ITALIC); }
    else if ((e.key === 'x' || e.key === 'X') && e.shiftKey) { e.preventDefault(); transformSelection(applyStrikethrough); }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { pushUndo(val); debounceRef.current = null; }, 1000);
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

  const topSources = sources.slice(0, 3);
  const isRefining = ariaRefining || humanizing;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 flex flex-col">

      {/* ── Mobile compact header ── */}
      <div className="md:hidden bg-white border-b flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0" style={{ color: '#6B7280' }}>
          <ArrowLeft size={18} />
        </button>
        {/* Edit / Preview toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl flex-shrink-0" style={{ background: '#F3F2EF' }}>
          <button onClick={() => setPreviewMode('edit')} className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all" style={previewMode === 'edit' ? { background: 'white', color: '#1A1A2E', boxShadow: '0 1px 3px rgba(0,0,0,0.10)' } : { color: '#6B7280' }}>Edit</button>
          <button onClick={() => setPreviewMode('preview')} className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all" style={previewMode === 'preview' ? { background: 'white', color: '#1A1A2E', boxShadow: '0 1px 3px rgba(0,0,0,0.10)' } : { color: '#6B7280' }}>Preview</button>
        </div>
        <span className="flex-1" />
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: content.length > 2700 ? '#F72585' : '#9CA3AF' }}>{content.length}</span>
      </div>

      {/* ── Desktop top bar: topic chip + spark + length + controls ── */}
      <div className="hidden md:flex bg-white border-b px-4 py-2 items-center gap-2 flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
        {angle ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0" style={{ border: '1.5px solid #D4CEFF', color: '#7C5CFC' }}>
            <Check size={11} /> {angle.style} · {angle.hook.slice(0, 35)}{angle.hook.length > 35 ? '…' : ''}
            <button onClick={onBack} aria-label="Change angle" className="ml-1 hover:opacity-70"><X size={11} /></button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0" style={{ border: '1.5px solid #D4CEFF', color: '#7C5CFC' }}>
            {editMode ? 'Editing draft' : (customTopic.slice(0, 35) || 'Custom post')}
            <button onClick={onBack} aria-label="Back" className="ml-1 hover:opacity-70"><X size={11} /></button>
          </span>
        )}
        <input
          type="text"
          value={sparkInput}
          onChange={e => setSparkInput(e.target.value)}
          placeholder="Paste a URL, quote, or what sparked this post (optional)"
          className="flex-1 min-w-0 text-[12px] bg-transparent outline-none px-2"
          style={{ color: '#1A1A2E' }}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleGenerateVariants}
            disabled={generatingVariants || isGenerating}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all disabled:opacity-50 ml-1"
            style={variantsOpen
              ? { background: 'linear-gradient(135deg, #7C5CFC, #F72585)', color: 'white' }
              : { color: '#6B7280', border: '1px solid #EDE8FF' }}
          >
            <Layers size={10} /> 3 Styles
          </button>
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all disabled:opacity-50 ml-1"
            style={{ color: '#7C5CFC', border: '1px solid #D4CEFF', background: 'rgba(124,92,252,0.06)' }}
          >
            <RefreshCw size={10} className={isGenerating ? 'animate-spin' : ''} />
            {isGenerating ? 'Writing...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">

        {/* Variant comparison overlay */}
        {variantsOpen && (
          <div className="absolute inset-0 z-30 flex flex-col bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
              <div>
                <p className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>3 writing styles, same topic</p>
                <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                  {generatingVariants ? 'Generating all three...' : 'Pick the one that fits you best'}
                </p>
              </div>
              <button onClick={() => setVariantsOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ color: '#6B7280', background: '#F3F4F6' }}>
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-3 p-4 h-full" style={{ minWidth: variants.length * 290 }}>
                {variants.map((v, i) => (
                  <div key={v.styleId} className="flex flex-col rounded-2xl overflow-hidden flex-shrink-0" style={{ width: 280, border: '1.5px solid #EDE8FF', background: '#FDFCFF' }}>
                    <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
                      <span className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>{v.emoji} {v.label}</span>
                      {v.content && !generatingVariants && (
                        <button
                          onClick={() => { setContent(v.content); setVariantsOpen(false); checkedRef.current = false; if (postId) supabase.from('posts').update({ content: v.content }).eq('id', postId); }}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-full text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}
                        >
                          Use this
                        </button>
                      )}
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                      {v.content ? (
                        <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: '#1A1A2E' }}>{v.content}</p>
                      ) : (
                        <div className="flex flex-col gap-2 pt-1">
                          {[80, 65, 90, 55, 75].map((w, j) => (
                            <div key={j} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pending diff overlay (Make-It pills and More styles) */}
        {pendingDiff && (
          <div className="absolute inset-0 z-30 flex flex-col bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
              <div>
                <p className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>"{pendingDiff.label}" preview</p>
                <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Accept to apply, reject to keep your original</p>
              </div>
              <button onClick={rejectDiff} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ color: '#6B7280', background: '#F3F4F6' }}>
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex gap-3 p-4 overflow-hidden">
              <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ border: '1.5px solid #EDE8FF', background: '#FDFCFF' }}>
                <div className="px-4 py-2.5 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
                  <span className="text-[11px] font-bold" style={{ color: '#9CA3AF' }}>Before</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                  <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: '#6B7280' }}>{pendingDiff.before}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ border: '1.5px solid #ADA8F0', background: '#FDFCFF' }}>
                <div className="px-4 py-2.5 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
                  <span className="text-[11px] font-bold" style={{ color: '#7C5CFC' }}>After</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                  <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: '#1A1A2E' }}>{pendingDiff.after}</p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 flex gap-3 flex-shrink-0">
              <button onClick={rejectDiff} className="flex-1 py-2 rounded-full font-bold text-[13px]" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>Reject</button>
              <button onClick={acceptDiff} className="flex-1 py-2 rounded-full font-bold text-[13px] text-white" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>Accept</button>
            </div>
          </div>
        )}

        {/* ── LEFT: AI Panel (desktop only) ── */}
        <div className="hidden md:flex w-[264px] flex-shrink-0 border-r flex-col" style={{ borderColor: '#EDE8FF', background: '#FAFAFE' }}>

          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}>
                <Sparkles size={12} color="white" />
              </div>
              <span className="text-[13px] font-extrabold" style={{ color: '#1A1A2E' }}>AI Edit</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,92,252,0.10)', color: '#7C5CFC' }}>Aria</span>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>Refine your draft, in your own voice.</p>
          </div>

          {/* Quick action buttons */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="flex flex-col gap-1.5">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => handleAriaRefine(action.instruction)}
                  disabled={isRefining || isGenerating || !content.trim()}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-xl transition-all disabled:opacity-40"
                  style={{ background: 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.10)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,92,252,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,92,252,0.06)'; }}
                >
                  <span className="text-[16px] flex-shrink-0">{action.emoji}</span>
                  <span className="text-[12px] font-semibold" style={{ color: '#1A1A2E' }}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Make it... pills */}
          <div className="px-3 pb-3 flex-shrink-0 border-b" style={{ borderColor: '#EDE8FF' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Make it...</p>
            <div className="flex flex-wrap gap-1.5">
              {MAKE_IT_PILLS.map(pill => (
                <button
                  key={pill.label}
                  onClick={() => handleStyleRefine(pill.instruction, pill.label)}
                  disabled={isRefining || isGenerating || !content.trim()}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all disabled:opacity-40"
                  style={{ background: 'white', border: '1.5px solid #EDE8FF', color: '#6B7280' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ADA8F0'; e.currentTarget.style.color = '#7C5CFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDE8FF'; e.currentTarget.style.color = '#6B7280'; }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMoreStylesOpen(true)}
              disabled={isRefining || isGenerating || !content.trim()}
              className="mt-2 w-full text-[11px] font-bold py-1.5 rounded-lg transition-all disabled:opacity-40"
              style={{ color: '#7C5CFC', background: 'rgba(124,92,252,0.06)', border: '1px dashed #D4CEFF' }}
            >
              More styles...
            </button>
          </div>

          {/* Length */}
          <div className="px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Length</p>
            <div className="flex flex-wrap gap-1.5">
              {LENGTH_OPTIONS.map(l => (
                <button
                  key={l.id}
                  onClick={() => handleLengthAndRegenerate(l.id)}
                  disabled={isGenerating}
                  title={selectedLength === l.id ? 'Regenerate at this length' : `Switch to ${l.label}`}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all disabled:opacity-50"
                  style={selectedLength === l.id
                    ? { background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', color: 'white' }
                    : { background: 'white', border: '1.5px solid #EDE8FF', color: '#6B7280' }}
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hooks + CTAs */}
          <div className="px-3 py-2.5 border-b flex items-center gap-2 flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
            <div className="relative flex-1">
              <button
                onClick={() => { setHooksOpen(o => !o); setCtasOpen(false); }}
                className="w-full flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-lg"
                style={{ background: hooksOpen ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.06)', color: '#7C5CFC' }}
              >
                Hooks <ChevronDown size={11} />
              </button>
              {hooksOpen && (
                <div className="absolute top-full left-0 mt-1 z-20 w-80 max-w-[calc(100vw-32px)]">
                  <HookLibraryPanel userId={userId} userRole={userRole} userDomain={userDomain} onInsert={text => { insertHookTemplate(text); setHooksOpen(false); }} />
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <button
                onClick={() => { setCtasOpen(o => !o); setHooksOpen(false); }}
                className="w-full flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-lg"
                style={{ background: ctasOpen ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.06)', color: '#7C5CFC' }}
              >
                CTAs <ChevronDown size={11} />
              </button>
              {ctasOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl p-2 z-20 modal-shadow w-80 max-w-[calc(100vw-32px)] max-h-64 overflow-y-auto">
                  {CTA_TEMPLATES.map((c, i) => (
                    <button key={i} onClick={() => { insertAtCursor('\n\n' + c); setCtasOpen(false); }} className="block w-full text-left text-[12px] px-2.5 py-2 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Research brief (if available) */}
          {preloadedResearchBrief && preloadedResearchBrief.stats.length > 0 && (
            <div className="mx-3 mt-2 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1.5px solid #BAE6FD' }}>
              <button onClick={() => setResearchPanelOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: '#0284C7' }}>
                  <FlaskConical size={10} /> Research used
                </span>
                <span className="text-[9px] font-semibold" style={{ color: '#9CA3AF' }}>
                  {researchPanelOpen ? 'hide' : `${preloadedResearchBrief.stats.length} stats`}
                </span>
              </button>
              {researchPanelOpen && (
                <div className="px-3 pb-2.5 flex flex-col gap-1.5">
                  {preloadedResearchBrief.stats.slice(0, 3).map((stat, i) => (
                    <p key={i} className="text-[10px] leading-snug p-2 rounded-lg" style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}>
                      {stat}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Content signal (compact) */}
          {authScore?.signal && !authScore.signal.readyToPost && (
            <div className="mx-3 mb-2 flex-shrink-0">
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)' }}>
                <p className="text-[10px] font-bold mb-1.5" style={{ color: '#92400E' }}>
                  {authScore.signal.issues.length} thing{authScore.signal.issues.length !== 1 ? 's' : ''} to check
                </p>
                {authScore.signal.issues.slice(0, 2).map((issue, i) => (
                  <p key={i} className="text-[10px] leading-snug mb-1" style={{ color: '#B45309' }}>
                    <AlertTriangle size={9} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                    {issue.suggestion}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Aria free-text input */}
          <div className="px-3 pb-3 flex-shrink-0">
            {isRefining ? (
              <div className="rounded-xl px-3 py-3 flex flex-col items-center gap-2" style={{ background: 'rgba(124,92,252,0.06)', border: '1.5px solid #D4CEFF' }}>
                <AriaClockSpinner />
                <p className="text-[11px] font-semibold text-center animate-pulse" style={{ color: '#7C5CFC' }} key={ariaThinkingIdx}>
                  {ARIA_THINKING_MSGS[ariaThinkingIdx]}
                </p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #EDE8FF' }}>
                <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1">
                  <Sparkles size={12} style={{ color: '#7C5CFC', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={ariaInput}
                    onChange={e => setAriaInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAriaRefine(); }}
                    placeholder="Ask Aria anything..."
                    className="flex-1 min-w-0 text-[12px] bg-transparent outline-none"
                    style={{ color: '#1A1A2E' }}
                  />
                </div>
                <div className="flex items-center gap-1 px-2.5 pb-2">
                  <span className="text-[10px]" style={{ color: '#C4BAF0' }}>e.g. make it shorter, add a hook, change the ending</span>
                  <button
                    onClick={() => handleAriaRefine()}
                    disabled={!ariaInput.trim() || isRefining || !content.trim()}
                    className="ml-auto w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}
                  >
                    <Send size={10} color="white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: LinkedIn-style editor (desktop only) ── */}
        <div className="hidden md:flex flex-1 min-h-0 flex-col" style={{ background: '#F3F2EF' }}>

          {/* Editor top controls: Edit/Preview + Desktop/Mobile */}
          <div className="hidden md:flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ background: '#F3F2EF' }}>
            {/* Left: Edit / Preview tabs */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.06)' }}>
              <button
                onClick={() => setPreviewMode('edit')}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                style={previewMode === 'edit'
                  ? { background: 'white', color: '#1A1A2E', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
                  : { color: '#6B7280' }}
              >
                <Pencil size={11} /> Edit
              </button>
              <button
                onClick={() => setPreviewMode('preview')}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                style={previewMode === 'preview'
                  ? { background: 'white', color: '#1A1A2E', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
                  : { color: '#6B7280' }}
              >
                <Eye size={11} /> Preview
              </button>
            </div>

            {/* Right: Desktop / Mobile toggle */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.06)' }}>
              <button
                onClick={() => setDeviceView('desktop')}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                style={deviceView === 'desktop'
                  ? { background: 'white', color: '#1A1A2E', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
                  : { color: '#6B7280' }}
              >
                <Monitor size={11} /> Desktop
              </button>
              <button
                onClick={() => setDeviceView('mobile')}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                style={deviceView === 'mobile'
                  ? { background: 'white', color: '#1A1A2E', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
                  : { color: '#6B7280' }}
              >
                <Smartphone size={11} /> Mobile
              </button>
            </div>
          </div>

          {/* LinkedIn card area */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center py-4 px-4">
            <div
              className="w-full"
              style={{ maxWidth: deviceView === 'mobile' ? 400 : 600 }}
            >
              {/* LinkedIn-style post card */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.08)' }}>

                {/* Card header: avatar + name + Edit/Preview */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <Avatar src={userAvatar} initials={userInitials || 'Y'} alt={userName} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold leading-tight" style={{ color: '#1A1A2E' }}>{userName || 'You'}</p>
                    <p className="text-[11px]" style={{ color: '#888' }}>Just now · 🌐</p>
                  </div>
                  {/* Mobile edit/preview toggle in the card header */}
                  <div className="md:hidden flex items-center gap-1 p-0.5 rounded-xl" style={{ background: '#F3F2EF' }}>
                    <button onClick={() => setPreviewMode('edit')} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={previewMode === 'edit' ? { background: 'white', color: '#1A1A2E' } : { color: '#888' }}>Edit</button>
                    <button onClick={() => setPreviewMode('preview')} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={previewMode === 'preview' ? { background: 'white', color: '#1A1A2E' } : { color: '#888' }}>Preview</button>
                  </div>
                </div>

                {/* Content area */}
                <div className="px-4 pb-3">
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-10">
                      <GenerationTimer />
                      <p className="text-[12px] font-semibold animate-fadeIn text-center" style={{ color: '#7C5CFC' }} key={loadingMsgIdx}>
                        {LOADING_MESSAGES[loadingMsgIdx]}
                      </p>
                      <div className="w-full flex flex-col gap-2">
                        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-3.5 rounded" style={{ width: `${90 - i * 12}%` }} />)}
                      </div>
                    </div>
                  ) : genError ? (
                    <div className="flex flex-col items-center justify-center text-center gap-3 py-8">
                      <p className="text-[13px]" style={{ color: '#F72585' }}>{genError}</p>
                      <button onClick={() => handleGenerate()} className="text-[12px] font-bold px-4 py-2 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>Try again</button>
                    </div>
                  ) : previewMode === 'preview' ? (
                    <LinkedInPostPreview content={content} />
                  ) : (
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={e => handleContentChange(e.target.value)}
                      onKeyDown={handleEditorKeyDown}
                      className="w-full outline-none resize-none"
                      style={{
                        minHeight: 220,
                        fontSize: 14,
                        lineHeight: 1.8,
                        color: '#1A1A2E',
                        background: 'transparent',
                        border: 'none',
                      }}
                      placeholder="Write your LinkedIn post here..."
                    />
                  )}
                </div>

                {/* Engagement strip */}
                <div className="px-4 py-2.5 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#666' }}>
                      <ThumbsUp size={14} /> Like
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#666' }}>
                      <MessageCircle size={14} /> Comment
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#666' }}>
                      <Repeat2 size={14} /> Repost
                    </span>
                  </div>
                </div>

                {/* Bottom toolbar: formatting + emoji + undo/redo + char count */}
                <div className="px-3 pb-3 flex items-center gap-1 flex-wrap border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <button onClick={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; pushUndo(content); } const prev = undoStep(); if (prev !== null) setContent(prev); }} disabled={!canUndo} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30" style={{ color: '#444' }} title="Undo (Ctrl+Z)" onMouseEnter={e => { e.currentTarget.style.background = '#F0EEF8'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}><Undo2 size={13} /></button>
                  <button onClick={() => { const next = redoStep(); if (next !== null) setContent(next); }} disabled={!canRedo} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30" style={{ color: '#444' }} title="Redo (Ctrl+Shift+Z)" onMouseEnter={e => { e.currentTarget.style.background = '#F0EEF8'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}><Redo2 size={13} /></button>
                  <div className="w-px h-5 mx-0.5" style={{ background: '#EDE8FF' }} />
                  <button onClick={() => transformSelection(BOLD)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[14px] font-extrabold transition-colors" style={{ color: '#444' }} onMouseEnter={e => { e.currentTarget.style.background = '#F0EEF8'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>B</button>
                  <button onClick={() => transformSelection(ITALIC)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[14px] italic transition-colors" style={{ color: '#444', fontStyle: 'italic' }} onMouseEnter={e => { e.currentTarget.style.background = '#F0EEF8'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>I</button>
                  <button onClick={() => transformSelection(applyStrikethrough)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[13px] line-through transition-colors" style={{ color: '#444' }} onMouseEnter={e => { e.currentTarget.style.background = '#F0EEF8'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>S</button>
                  <div className="w-px h-5 mx-0.5" style={{ background: '#EDE8FF' }} />
                  {/* Emoji picker (full emoji-mart) */}
                  <div className="relative">
                    <button
                      onClick={() => setFormatMoreOpen(o => !o)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                      style={{ color: '#666', background: formatMoreOpen ? '#F0EEF8' : 'transparent' }}
                      title="Add emoji"
                    >
                      <Smile size={15} />
                    </button>
                    {formatMoreOpen && (
                      <div className="absolute bottom-full left-0 mb-1 z-20" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.12))' }}>
                        <EmojiPickerLazy onSelect={emoji => { insertAtCursor(emoji); setFormatMoreOpen(false); }} />
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => { setFormatOptionsOpen(o => !o); setFormatMoreOpen(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                      style={{ color: '#666', background: formatOptionsOpen ? '#F0EEF8' : 'transparent' }}
                      title="Format"
                      onMouseEnter={e => { if (!formatOptionsOpen) e.currentTarget.style.background = '#F0EEF8'; }}
                      onMouseLeave={e => { if (!formatOptionsOpen) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {formatOptionsOpen && (
                      <div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl p-2 z-20 modal-shadow" style={{ width: 160 }}>
                        <button onClick={() => { prefixLines(() => '• '); setFormatOptionsOpen(false); }} className="flex items-center gap-2 w-full text-left text-[11px] px-2 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#444' }}>
                          <List size={12} /> Add bullets
                        </button>
                        <button onClick={() => { prefixLines(i => `${i + 1}. `); setFormatOptionsOpen(false); }} className="flex items-center gap-2 w-full text-left text-[11px] px-2 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#444' }}>
                          <ListOrdered size={12} /> Add numbers
                        </button>
                        <button onClick={() => { insertAtCursor('\n───\n'); setFormatOptionsOpen(false); }} className="flex items-center gap-2 w-full text-left text-[11px] px-2 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)]" style={{ color: '#444' }}>
                          <Minus size={12} /> Divider
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="w-px h-5 mx-0.5" style={{ background: '#EDE8FF' }} />
                  <button
                    onClick={handleHumanize}
                    disabled={humanizing || !content.trim()}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full disabled:opacity-40 transition-all"
                    style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}
                  >
                    <Wand2 size={11} />
                    {humanizing ? 'Humanizing…' : 'Humanize'}
                  </button>
                  {/* Source trust badges */}
                  {topSources.length > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      {topSources.map((s, i) => (
                        <span key={i} title={s.excerpt} className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#F8F5FF', color: '#6B7280' }}>
                          <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: scoreColor(s.trustScore) }}>{s.trustScore}</span>
                          {s.domain}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="ml-auto text-[11px] font-semibold" style={{ color: content.length > 2700 ? '#F72585' : '#9CA3AF' }}>{content.length} / 3,000</span>
                </div>

                {/* Char count bar */}
                <div className="px-3 pb-3">
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#F0EEF8' }}>
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{
                        width: `${Math.min(100, (content.length / 3000) * 100)}%`,
                        background: content.length > 2850 ? '#F72585' : content.length > 2400 ? '#F59E0B' : '#10B981',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Content signal + Best time (below card) */}
              <div className="flex gap-3 mt-3">
                {/* Content signal */}
                <div className="flex-1 bg-white rounded-xl p-3" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9CA3AF' }}>Content Signal</p>
                  {authLocked ? (
                    <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Upgrade to check.</p>
                  ) : authLoading ? (
                    <div className="skeleton h-4 w-3/4 rounded" />
                  ) : authScore?.signal ? (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: authScore.signal.readyToPost ? '#10B981' : '#F59E0B', boxShadow: authScore.signal.readyToPost ? '0 0 0 3px rgba(16,185,129,0.20)' : '0 0 0 3px rgba(245,158,11,0.20)' }} />
                      <span className="text-[11px] font-bold" style={{ color: '#1A1A2E' }}>{authScore.signal.label}</span>
                    </div>
                  ) : (
                    <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Checking...</p>
                  )}
                </div>

                {/* Best time */}
                <div className="flex-1 bg-white rounded-xl p-3" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9CA3AF' }}>Best Time</p>
                  {bestTimeLocked ? (
                    <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Upgrade to see.</p>
                  ) : bestTimeLoading ? (
                    <div className="skeleton h-4 w-2/3 rounded" />
                  ) : (
                    <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: '#1A1A2E' }}>
                      <Clock size={11} style={{ color: '#7C5CFC' }} />
                      {bestTime?.recommendedDays?.[0] ? `${bestTime.recommendedDays[0].slice(0, 3)} ${bestTime.recommendedTimes?.[0] || ''}` : 'Not enough data'}
                    </p>
                  )}
                </div>

                {/* Carousel */}
                <div className="flex-1 rounded-xl p-3 cursor-pointer" style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.10) 0%, rgba(247,37,133,0.10) 100%)', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} onClick={handleCarousel}>
                  <p className="text-[9px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#7C5CFC' }}>Carousel</p>
                  <p className="text-[11px] font-bold" style={{ color: '#7C5CFC' }}>{estimateSlides(content)} slides</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Desktop bottom action bar ── */}
          <div className="hidden md:flex bg-white border-t px-4 py-2.5 items-center gap-2 flex-shrink-0" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-full" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
              <ArrowLeft size={12} /> Back
            </button>
            <button onClick={handleCopy} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-full" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
              <Copy size={12} /> Copy
            </button>
            <button onClick={handleSaveDraft} disabled={savingDraft} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-full disabled:opacity-50" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
              <Save size={12} /> {savingDraft ? 'Saving...' : 'Save draft'}
            </button>
            <button onClick={() => setVersionHistoryOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-full" style={{ color: '#6B7280', border: '1px solid #EDE8FF' }}>
              <History size={12} /> History
            </button>
            <div className="flex-1" />
            <button onClick={openSchedule} className="flex items-center gap-1.5 text-[13px] font-bold px-4 py-2 rounded-full" style={{ color: '#7C5CFC', border: '1.5px solid #D4CEFF', background: 'rgba(124,92,252,0.06)' }}>
              <Calendar size={13} /> Schedule
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || isGenerating || !content.trim()}
              className="flex items-center gap-1.5 text-[13px] font-bold text-white px-5 py-2 rounded-full disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)', boxShadow: '0 4px 14px rgba(10,102,194,0.35)' }}
            >
              {publishing ? 'Publishing...' : 'Post to LinkedIn'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile: edit or preview ── */}
      <div className="md:hidden flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
        {previewMode === 'preview' ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <Avatar src={userAvatar} initials={userInitials || 'Y'} alt={userName} size={40} />
                <div>
                  <p className="text-[14px] font-bold" style={{ color: '#1A1A2E' }}>{userName || 'You'}</p>
                  <p className="text-[11px]" style={{ color: '#888' }}>Just now · 🌐</p>
                </div>
              </div>
              <div className="px-4 pb-4">
                <LinkedInPostPreview content={content} />
              </div>
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#666' }}><ThumbsUp size={14} /> Like</span>
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#666' }}><MessageCircle size={14} /> Comment</span>
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#666' }}><Repeat2 size={14} /> Repost</span>
                </div>
              </div>
            </div>
          </div>
        ) : isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <GenerationTimer />
            <p className="text-[13px] font-semibold text-center" style={{ color: '#7C5CFC' }} key={loadingMsgIdx}>{LOADING_MESSAGES[loadingMsgIdx]}</p>
            <div className="w-full flex flex-col gap-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-3.5 rounded" style={{ width: `${90 - i * 12}%` }} />)}
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            className="flex-1 min-h-0 w-full outline-none resize-none px-5 py-4"
            style={{ fontSize: 16, lineHeight: 1.8, color: '#1A1A2E', background: 'transparent', border: 'none' }}
            placeholder="Your post appears here..."
          />
        )}
      </div>

      {/* ── Mobile bottom bar ── */}
      <div className="md:hidden bg-white border-t flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
        {/* Minimal formatting row */}
        <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: '#F0EEF8' }}>
          <button onClick={() => transformSelection(BOLD)} className="w-9 h-9 flex items-center justify-center rounded-xl text-[15px] font-extrabold" style={{ color: '#1A1A2E' }}>B</button>
          <button onClick={() => transformSelection(ITALIC)} className="w-9 h-9 flex items-center justify-center rounded-xl text-[15px] italic" style={{ color: '#1A1A2E', fontStyle: 'italic' }}>I</button>
          <button onClick={() => transformSelection(applyStrikethrough)} className="w-9 h-9 flex items-center justify-center rounded-xl text-[14px] line-through" style={{ color: '#1A1A2E' }}>S</button>
          <div className="w-px h-5 mx-1" style={{ background: '#EDE8FF' }} />
          <div className="relative">
            <button onClick={() => setFormatMoreOpen(o => !o)} className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ color: '#6B7280', background: formatMoreOpen ? '#F0EEF8' : 'transparent' }}>
              <Smile size={17} />
            </button>
            {formatMoreOpen && (
              <div className="absolute bottom-full left-0 mb-1 z-20" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.12))' }}>
                <EmojiPickerLazy onSelect={emoji => { insertAtCursor(emoji); setFormatMoreOpen(false); }} />
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button
            onClick={handleHumanize}
            disabled={humanizing || !content.trim()}
            className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
            style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}
          >
            <Wand2 size={12} /> {humanizing ? 'Humanizing…' : 'Humanize'}
          </button>
          <div className="w-px h-5 mx-1" style={{ background: '#EDE8FF' }} />
          <button
            onClick={() => setAiPanelOpen(true)}
            className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)', color: 'white' }}
          >
            <Sparkles size={12} /> AI Edit
          </button>
        </div>
        {/* Action row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handlePublish}
            disabled={publishing || isGenerating || !content.trim()}
            className="flex-1 flex items-center justify-center gap-2 text-[14px] font-bold text-white py-3 rounded-2xl disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)', boxShadow: '0 6px 20px rgba(10,102,194,0.30)' }}
          >
            {publishing ? 'Publishing...' : 'Post to LinkedIn'}
          </button>
          <button onClick={() => setMobileDrawerOpen(true)} className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0" style={{ border: '1.5px solid #EDE8FF', color: '#6B7280' }}>
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Hooks panel */}
      {hooksOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end" onClick={() => setHooksOpen(false)}>
          <div className="mx-4 mb-[112px] rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(124,92,252,0.18)' }}>
            <HookLibraryPanel userId={userId} userRole={userRole} userDomain={userDomain} onInsert={text => { insertHookTemplate(text); setHooksOpen(false); }} />
          </div>
        </div>
      )}

      {/* Mobile CTAs panel */}
      {ctasOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end" onClick={() => setCtasOpen(false)}>
          <div className="mx-4 mb-[112px] bg-white rounded-2xl p-3 overflow-y-auto" onClick={e => e.stopPropagation()} style={{ maxHeight: '60vh', boxShadow: '0 -4px 32px rgba(124,92,252,0.18)' }}>
            <p className="text-[10px] font-bold uppercase px-1 pb-2 mb-1 border-b" style={{ color: '#9CA3AF', borderColor: '#EDE8FF' }}>Call to action</p>
            {CTA_TEMPLATES.map((c, i) => (
              <button key={i} onClick={() => { insertAtCursor('\n\n' + c); setCtasOpen(false); }} className="block w-full text-left text-[13px] px-2 py-2.5 rounded-xl active:bg-[rgba(124,92,252,0.06)]" style={{ color: '#1A1A2E' }}>{c}</button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile AI panel (slide-up sheet) */}
      {aiPanelOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fadeIn" style={{ background: 'rgba(0,0,0,0.40)' }} onClick={() => setAiPanelOpen(false)}>
          <div className="bg-white rounded-t-3xl px-4 pt-4 pb-8" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: '#E5E7EB' }} />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}>
                <Sparkles size={12} color="white" />
              </div>
              <span className="text-[14px] font-extrabold" style={{ color: '#1A1A2E' }}>AI Edit</span>
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-2 mb-4">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => { handleAriaRefine(action.instruction); setAiPanelOpen(false); }}
                  disabled={isRefining || !content.trim()}
                  className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-2xl disabled:opacity-40"
                  style={{ background: 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.12)' }}
                >
                  <span className="text-[18px]">{action.emoji}</span>
                  <span className="text-[13px] font-semibold" style={{ color: '#1A1A2E' }}>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Make it pills */}
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Make it...</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {MAKE_IT_PILLS.map(pill => (
                <button
                  key={pill.label}
                  onClick={() => { handleStyleRefine(pill.instruction, pill.label); setAiPanelOpen(false); }}
                  disabled={isRefining || !content.trim()}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-40"
                  style={{ background: '#F4F0FF', color: '#7C5CFC' }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setMoreStylesOpen(true); setAiPanelOpen(false); }}
              disabled={isRefining || !content.trim()}
              className="w-full text-[12px] font-bold py-2 rounded-xl mb-4 disabled:opacity-40"
              style={{ color: '#7C5CFC', background: 'rgba(124,92,252,0.06)', border: '1px dashed #D4CEFF' }}
            >
              More styles...
            </button>

            {/* Length */}
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Post length</p>
            <div className="flex gap-2 mb-4">
              {LENGTH_OPTIONS.map(l => (
                <button
                  key={l.id}
                  onClick={() => { handleLengthAndRegenerate(l.id); setAiPanelOpen(false); }}
                  disabled={isGenerating}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-50"
                  style={selectedLength === l.id
                    ? { background: 'linear-gradient(135deg, #7C5CFC, #F72585)', color: 'white' }
                    : { color: '#6B7280', border: '1.5px solid #EDE8FF' }}
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>

            {/* Aria input */}
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Ask Aria</p>
            {isRefining ? (
              <div className="rounded-xl px-4 py-4 flex flex-col items-center gap-3 mb-4" style={{ background: 'rgba(124,92,252,0.06)', border: '1.5px solid #D4CEFF' }}>
                <AriaClockSpinner />
                <p className="text-[12px] font-semibold text-center" style={{ color: '#7C5CFC' }} key={ariaThinkingIdx}>
                  {ARIA_THINKING_MSGS[ariaThinkingIdx]}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4" style={{ border: '1.5px solid #EDE8FF' }}>
                <Sparkles size={15} style={{ color: '#7C5CFC', flexShrink: 0 }} />
                <input
                  type="text"
                  value={ariaInput}
                  onChange={e => setAriaInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && ariaInput.trim()) { handleAriaRefine(); setAiPanelOpen(false); } }}
                  placeholder="Shorten it, add a stat, change the ending..."
                  className="flex-1 text-[13px] bg-transparent outline-none"
                  style={{ color: '#1A1A2E' }}
                />
                <button
                  onClick={() => { if (ariaInput.trim()) { handleAriaRefine(); setAiPanelOpen(false); } }}
                  disabled={!ariaInput.trim()}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7C5CFC, #F72585)' }}
                >
                  <Send size={13} color="white" />
                </button>
              </div>
            )}

            {/* Secondary actions */}
            <div className="grid grid-cols-3 gap-2.5">
              <button onClick={() => { handleCopy(); setAiPanelOpen(false); }} className="flex flex-col items-center gap-2 py-4 rounded-2xl" style={{ border: '1.5px solid #EDE8FF' }}>
                <Copy size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Copy</span>
              </button>
              <button onClick={() => { handleSaveDraft(); setAiPanelOpen(false); }} disabled={savingDraft} className="flex flex-col items-center gap-2 py-4 rounded-2xl disabled:opacity-50" style={{ border: '1.5px solid #EDE8FF' }}>
                <Save size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>{savingDraft ? 'Saving…' : 'Save'}</span>
              </button>
              <button onClick={() => { openSchedule(); setAiPanelOpen(false); }} className="flex flex-col items-center gap-2 py-4 rounded-2xl" style={{ border: '1.5px solid #EDE8FF' }}>
                <Calendar size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile more options drawer */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fadeIn" style={{ background: 'rgba(0,0,0,0.40)' }} onClick={() => setMobileDrawerOpen(false)}>
          <div className="bg-white rounded-t-3xl px-5 pt-4 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#E5E7EB' }} />
            <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: '#9CA3AF' }}>Options</p>
            <div className="grid grid-cols-3 gap-2.5">
              <button onClick={() => { handleCopy(); setMobileDrawerOpen(false); }} className="flex flex-col items-center gap-2 py-4 rounded-2xl" style={{ border: '1.5px solid #EDE8FF' }}>
                <Copy size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Copy</span>
              </button>
              <button onClick={() => { handleSaveDraft(); setMobileDrawerOpen(false); }} disabled={savingDraft} className="flex flex-col items-center gap-2 py-4 rounded-2xl disabled:opacity-50" style={{ border: '1.5px solid #EDE8FF' }}>
                <Save size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>{savingDraft ? 'Saving…' : 'Save'}</span>
              </button>
              <button onClick={() => { openSchedule(); setMobileDrawerOpen(false); }} className="flex flex-col items-center gap-2 py-4 rounded-2xl" style={{ border: '1.5px solid #EDE8FF' }}>
                <Calendar size={18} style={{ color: '#6B7280' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* More styles drawer */}
      <MoreStylesDrawer
        open={moreStylesOpen}
        onClose={() => setMoreStylesOpen(false)}
        onApply={(style: ContentStyle) => handleStyleRefine(style.promptFragment, style.label)}
        disabled={isRefining || isGenerating || !content.trim()}
      />

      {/* Version history drawer */}
      <VersionHistoryDrawer
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        versions={versions}
        currentContent={content}
        onRestore={handleRestore}
        onSaveCurrent={() => saveVersion('Manual save')}
        isSaving={savingVersion}
      />

      {/* Schedule modal */}
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
            <input type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setScheduleDate(e.target.value)} className="w-full text-[13px] px-3 py-2 rounded-xl mb-3" style={{ border: '1.5px solid #EDE8FF' }} />
            <label className="block text-[11px] font-bold mb-1" style={{ color: '#6B7280' }}>Time</label>
            <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full text-[13px] px-3 py-2 rounded-xl mb-4" style={{ border: '1.5px solid #EDE8FF' }} />
            <button onClick={handleConfirmSchedule} disabled={scheduling || !scheduleDate || !scheduleTime} className="w-full text-[13px] font-bold text-white py-2.5 rounded-full disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
              {scheduling ? 'Scheduling...' : 'Confirm schedule'}
            </button>
            <p className="text-[10px] text-center mt-2" style={{ color: '#9CA3AF' }}>Posts publish within the hour of your selected time.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Spinning clock animation used in Aria's loading state
function AriaClockSpinner() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(i => (i + 1) % 12), 200);
    return () => clearInterval(t);
  }, []);
  const handAngle = tick * 30;
  return (
    <div className="relative" style={{ width: 44, height: 44 }}>
      <svg width={44} height={44} viewBox="0 0 44 44">
        <circle cx={22} cy={22} r={19} stroke="rgba(124,92,252,0.20)" strokeWidth={3} fill="none" />
        <circle cx={22} cy={22} r={19} stroke="url(#ariaGrad)" strokeWidth={3} fill="none" strokeDasharray={120} strokeDashoffset={80} strokeLinecap="round" />
        <line
          x1={22} y1={22}
          x2={22 + 11 * Math.sin((handAngle * Math.PI) / 180)}
          y2={22 - 11 * Math.cos((handAngle * Math.PI) / 180)}
          stroke="#7C5CFC" strokeWidth={2} strokeLinecap="round"
        />
        <line
          x1={22} y1={22}
          x2={22 + 7 * Math.sin(((handAngle * 12) * Math.PI) / 180)}
          y2={22 - 7 * Math.cos(((handAngle * 12) * Math.PI) / 180)}
          stroke="#F72585" strokeWidth={2.5} strokeLinecap="round"
        />
        <circle cx={22} cy={22} r={2} fill="#7C5CFC" />
        <defs>
          <linearGradient id="ariaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C5CFC" />
            <stop offset="100%" stopColor="#F72585" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Generation spinner (used while post is streaming)
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
          <circle cx={28} cy={28} r={22} stroke="url(#genTimerGradient)" strokeWidth={4} fill="none" strokeDasharray={138} strokeDashoffset={95} strokeLinecap="round" />
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

// Read-only LinkedIn post preview (used in Preview mode)
function LinkedInPostPreview({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const CUTOFF = 210;
  const needsSeeMore = content.length > CUTOFF;
  const visibleText = (!needsSeeMore || expanded) ? content : content.slice(0, CUTOFF);

  if (!content.trim()) {
    return <p className="text-[13px] italic py-4" style={{ color: '#C4C4C4' }}>Your post will appear here as you write...</p>;
  }
  return (
    <div>
      <p className="text-[14px] whitespace-pre-wrap break-words leading-relaxed" style={{ color: '#1A1A2E' }}>
        {visibleText}
      </p>
      {needsSeeMore && (
        <button onClick={() => setExpanded(e => !e)} className="text-[13px] font-semibold mt-0.5" style={{ color: '#0a66c2' }}>
          {expanded ? 'see less' : '...see more'}
        </button>
      )}
    </div>
  );
}
