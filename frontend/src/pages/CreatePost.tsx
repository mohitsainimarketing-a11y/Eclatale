import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Sparkles, Copy, RefreshCw, Send, Check, Loader2,
  FileText, Image, Lightbulb, Scissors,
  Wand2, Undo2, Redo2, Calendar, PenTool, ExternalLink,
  ChevronDown, X, Download, Eye, EyeOff, ArrowRight,
  ThumbsUp, MessageCircle, Repeat2, Monitor, Smartphone, PenLine,
} from 'lucide-react';
import { OVERLAY_STYLES, deriveHeadline, compositeOverlay } from '../lib/imageOverlay';
import { STYLES, formalityLabel } from '../lib/personaOptions';
import { RICH_TEXT_STYLES } from '../lib/richText';
import { copyToClipboard } from '../utils/clipboard';
import { useModalBackButton } from '../hooks/useModalBackButton';

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

const CONTENT_LENGTHS = [
  { id: 'micro',    emoji: '⚡', label: 'Micro',     range: '100-300 chars',  desc: 'Ultra short. One powerful idea. Maximum impact.',            approxSeconds: 5 },
  { id: 'short',    emoji: '📝', label: 'Short',     range: '300-800 chars',  desc: 'Punchy and scannable. Perfect for quick insights.',          approxSeconds: 15 },
  { id: 'standard', emoji: '📄', label: 'Standard',  range: '800-1500 chars', desc: 'The LinkedIn sweet spot. Story + insight + CTA.',            approxSeconds: 30 },
  { id: 'longform', emoji: '📚', label: 'Long-form', range: '1500-3000 chars', desc: 'Deep dive. Full thought leadership. Maximum authority.',    approxSeconds: 60 },
] as const;

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

const ANGLE_TAGS = [
  'Contrarian', 'Inspirational', 'Personal story', 'Lessons learned',
  'Step-by-step', 'Comparison', 'Common mistake', 'Behind the scenes',
];

const STRUCTURE_TAGS = [
  { id: 'AIDA', desc: 'Attention → Interest → Desire → Action' },
  { id: 'PAS', desc: 'Problem → Agitate → Solution' },
  { id: 'BAB', desc: 'Before → After → Bridge' },
  { id: 'PPP', desc: 'Problem → Promise → Proof' },
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

interface ReferenceItem {
  title: string;
  url: string;
  publication: string;
  publishedDate: string;
  relevance: string;
  type: 'news' | 'research' | 'data' | 'opinion';
}

interface AuthenticityScore {
  overallScore: number;
  readyToPost: boolean;
  topSuggestion: string;
  accuracy: { score: number; claims: { claim: string; status: string; note: string; sourceUrl?: string }[]; summary: string; isOpinionBased: boolean };
  freshness: { score: number; assessment: string; topicSaturation: string; suggestion: string; reasoning: string };
  voice: { score: number; matchLevel: string; specificMatches: string[]; specificMismatches: string[]; suggestion: string };
  references: { references: ReferenceItem[]; searchedFor: string; note: string };
}

function scoreColor(score: number): string {
  return score >= 80 ? '#06D6A0' : score >= 60 ? '#F59E0B' : '#EF4444';
}

function confidenceLabel(score: number): string {
  return score >= 80 ? 'Ready to post' : score >= 60 ? 'Good to post' : 'Review before posting';
}

// Actionable items behind a confidence score, most important first — mirrors
// the priority order the backend uses to pick a single topSuggestion.
function getActionableItems(authScore: AuthenticityScore): { label: string; text: string }[] {
  const items: { label: string; text: string }[] = [];
  if (!authScore.accuracy.isOpinionBased && authScore.accuracy.score < 70) {
    const flagged = authScore.accuracy.claims.find(c => c.status === 'Unverifiable' || c.status === 'False');
    items.push({ label: 'Accuracy', text: flagged ? `"${flagged.claim}"${flagged.note ? ` — ${flagged.note}` : ' could not be verified.'}` : authScore.accuracy.summary });
  }
  if (authScore.freshness.score < 70 && authScore.freshness.suggestion) {
    items.push({ label: 'Freshness', text: authScore.freshness.suggestion });
  }
  if (authScore.voice.score < 75 && authScore.voice.suggestion) {
    items.push({ label: 'Voice', text: authScore.voice.suggestion });
  }
  return items;
}

function AuthenticityRing({ score }: { score: number }) {
  const c = 2 * Math.PI * 45;
  const color = scoreColor(score);
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="9" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-extrabold text-brand-dark">{score}</span>
      </div>
    </div>
  );
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

// Translates known backend error shapes (and network failures) into copy
// that's safe and specific enough to show the user directly, rather than a
// raw error code like "weekly_limit_reached" leaking onto the screen.
function friendlyErrorMessage(data: any): string {
  const code = data?.error;
  if (code === 'api_credits_exhausted') return 'AI is taking a short break — try again in a few minutes.';
  if (code === 'weekly_limit_reached') {
    // The weekly reset always lands on Monday 00:00 UTC — format in UTC so
    // the displayed weekday matches the backend's reset day regardless of
    // the viewer's local timezone (local formatting can roll it back to Sunday).
    const resets = data?.resetsAt ? new Date(data.resetsAt) : null;
    const when = resets ? resets.toLocaleDateString([], { weekday: 'long', timeZone: 'UTC' }) : 'Monday';
    return `You've used all your free posts this week. More unlock ${when}, or upgrade for unlimited posts.`;
  }
  if (code === 'feature_locked') return data?.message || 'This feature is part of the Individual plan.';
  if (code === '__network__') return "Check your connection and try again.";
  if (code === '__rate_limit__') return "You're on a roll! Take a 60-second break before generating again.";
  return code || 'Something went wrong — please try again.';
}

// Wraps a fetch+json call so network failures (offline, DNS, CORS) surface
// through the same friendlyErrorMessage() path as backend error payloads,
// instead of throwing a raw TypeError.
async function fetchJson(url: string, options: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error(friendlyErrorMessage({ error: '__network__' }));
  }
  if (res.status === 429) throw new Error(friendlyErrorMessage({ error: '__rate_limit__' }));
  return res.json();
}

// Finds the soonest future date/time matching one of the user's recurring
// posting slots (from the /schedule calendar's "Posting times" grid).
// Requires at least 15 minutes of lead time so "now" doesn't round to a slot
// that's effectively already passed.
function nextSlotOccurrence(slots: { time: string; days: number[] }[]): Date | null {
  if (!slots.length) return null;
  const now = new Date();
  const minLead = new Date(now.getTime() + 15 * 60000);
  let best: Date | null = null;
  for (const slot of slots) {
    const [h, m] = slot.time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    for (const day of slot.days) {
      const candidate = new Date(now);
      let delta = (day - now.getDay() + 7) % 7;
      candidate.setDate(now.getDate() + delta);
      candidate.setHours(h, m, 0, 0);
      if (candidate < minLead) candidate.setDate(candidate.getDate() + 7);
      if (!best || candidate < best) best = candidate;
    }
  }
  return best;
}

function uid() { return Math.random().toString(36).slice(2); }
function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

// Pre-generation pattern nudge (Piece 13) — picks one contextual suggestion from
// the user's own writing-pattern analysis, in priority order.
function computeNudge(patterns: any): { text: string; instruction: string } | null {
  if (!patterns?.ready) return null;
  if (patterns.dominantHookType && !/bold[_ ]?statement/i.test(String(patterns.dominantHookType))) {
    return {
      text: `Your recent posts lean on ${patterns.dominantHookType} hooks — want to try a bold statement hook for variety?`,
      instruction: 'Open with a bold, declarative statement hook instead of the usual style, for variety.',
    };
  }
  if (patterns.unusedAngles?.[0]) {
    return {
      text: `You haven't posted about "${patterns.unusedAngles[0]}" yet — this could be a good time.`,
      instruction: `Where it fits naturally, bring in a perspective on: ${patterns.unusedAngles[0]}.`,
    };
  }
  if (Array.isArray(patterns.writingStrengths) && patterns.writingStrengths.some((s: string) => /data|stat/i.test(s))) {
    return {
      text: 'Posts where you included specific data performed strongly for you — consider adding a stat.',
      instruction: 'Include at least one specific, concrete data point or statistic.',
    };
  }
  if (patterns.writingOpportunities?.[0]) {
    return { text: patterns.writingOpportunities[0], instruction: patterns.writingOpportunities[0] };
  }
  return null;
}

// approximate silent adult reading speed used for the "X seconds to read" hint
const READING_CHARS_PER_SECOND = 17;

// Arrow-key navigation within a group of option buttons (tone/length
// selectors) — moves focus to the next/previous sibling button so the group
// behaves like a single tab stop with roving arrow-key selection.
function handleOptionGroupKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
  const buttons = Array.from(e.currentTarget.querySelectorAll('button'));
  const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (idx === -1) return;
  e.preventDefault();
  const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
  const next = buttons[(idx + dir + buttons.length) % buttons.length] as HTMLButtonElement;
  next.focus();
}

function LengthSelector({ value, onChange }: { value: typeof CONTENT_LENGTHS[number]['id']; onChange: (v: typeof CONTENT_LENGTHS[number]['id']) => void }) {
  const active = CONTENT_LENGTHS.find(l => l.id === value) || CONTENT_LENGTHS[2];
  const maxChars = 3000;
  const activeMaxChars = Number(active.range.split('-')[1]?.replace(/\D/g, '')) || 1500;
  const barPct = Math.min(100, Math.round((activeMaxChars / maxChars) * 100));
  const approxSeconds = Math.round(activeMaxChars / READING_CHARS_PER_SECOND);

  return (
    <div>
      <p className="text-[12px] font-semibold text-brand-dark mb-2">Post length</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Post length" onKeyDown={handleOptionGroupKeyDown}>
        {CONTENT_LENGTHS.map(l => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={value === l.id}
            onClick={() => onChange(l.id)}
            className={`text-left rounded-xl border p-2.5 transition-all ${
              value === l.id
                ? 'border-brand-purple bg-[rgba(124,92,252,0.06)]'
                : 'border-[rgba(0,0,0,0.08)] hover:border-brand-purple/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">{l.emoji}</span>
              <span className="text-[11px] font-bold text-brand-dark">{l.label}</span>
            </div>
            <p className="text-[9.5px] text-brand-muted mt-1 leading-snug">{l.desc}</p>
            <p className="text-[9px] text-brand-muted/70 mt-1">{l.range}</p>
          </button>
        ))}
      </div>
      <div className="mt-2.5">
        <div className="h-1.5 rounded-full bg-[rgba(124,92,252,0.1)] overflow-hidden">
          <div className="h-full rounded-full gradient-primary transition-all duration-300" style={{ width: `${barPct}%` }} />
        </div>
        <p className="text-[10px] text-brand-muted mt-1.5">This will take about {approxSeconds} seconds to read</p>
      </div>
    </div>
  );
}

// LinkedIn truncates the feed body at ~210 chars before showing "…more" —
// mirror that so the preview's truncation point matches the real feed.
const PREVIEW_TRUNCATE_AT = 210;
function truncatePreviewBody(text: string): { shown: string; truncated: boolean } {
  if (text.length <= PREVIEW_TRUNCATE_AT) return { shown: text, truncated: false };
  const cut = text.slice(0, PREVIEW_TRUNCATE_AT);
  const lastSpace = cut.lastIndexOf(' ');
  return { shown: cut.slice(0, lastSpace > 0 ? lastSpace : PREVIEW_TRUNCATE_AT), truncated: true };
}

function LinkedInPreviewCard({
  content, imageUrl, userName, userRole, userAvatar, userInitials, device, poll,
}: {
  content: string; imageUrl: string | null; userName: string; userRole: string;
  userAvatar: string; userInitials: string; device: 'desktop' | 'mobile';
  poll?: { question: string; options: string[]; duration: string } | null;
}) {
  const { shown, truncated } = truncatePreviewBody(content);
  const mobile = device === 'mobile';

  return (
    <div className="mx-auto rounded-xl border border-[rgba(0,0,0,0.08)] bg-white overflow-hidden shadow-sm transition-all"
      style={{ maxWidth: mobile ? 340 : '100%' }}>
      <div className="p-4">
        <div className="flex items-start gap-2.5 mb-3">
          {userAvatar
            ? <img src={userAvatar} alt={userName} loading="lazy" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
            : <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0 select-none">{userInitials || 'Y'}</div>
          }
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold leading-tight truncate" style={{ color: '#1A1A2E' }}>{userName || 'Your Name'}</div>
            {userRole && <div className="text-[12px] leading-snug line-clamp-1" style={{ color: '#6B7280' }}>{userRole}</div>}
            <div className="text-[12px]" style={{ color: '#6B7280' }}>now · 🌐</div>
          </div>
        </div>
        {content ? (
          <p className="text-[14px] leading-[1.5] whitespace-pre-wrap" style={{ color: '#1A1A2E' }}>
            {shown}
            {truncated && <span className="font-semibold" style={{ color: '#6B7280' }}>…more</span>}
          </p>
        ) : (
          <p className="text-[14px] italic" style={{ color: '#9CA3AF' }}>Your post will show up here exactly as it looks on LinkedIn.</p>
        )}
        {poll && (
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: '#E8E8E8' }}>
            <p className="text-[13px] font-semibold mb-2.5" style={{ color: '#1A1A2E' }}>{poll.question || 'Poll question'}</p>
            <div className="space-y-1.5">
              {poll.options.filter(Boolean).map((opt, i) => (
                <div key={i} className="text-[12px] font-medium rounded-md border px-3 py-1.5" style={{ borderColor: '#0A66C2', color: '#0A66C2' }}>
                  {opt}
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: '#6B7280' }}>0 votes · {poll.duration} left</p>
          </div>
        )}
      </div>
      {imageUrl && <img src={imageUrl} alt="Post visual" loading="lazy" className="w-full object-cover max-h-[400px]" />}
      <div className={`px-4 flex items-center border-t ${mobile ? 'justify-between py-3' : 'justify-between py-2 gap-1'}`} style={{ borderColor: '#E8E8E8' }}>
        {mobile ? (
          <>
            <ThumbsUp size={18} style={{ color: '#6B7280' }} />
            <MessageCircle size={18} style={{ color: '#6B7280' }} />
            <Repeat2 size={18} style={{ color: '#6B7280' }} />
            <Send size={16} style={{ color: '#6B7280' }} />
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold flex-1 justify-center" style={{ color: '#6B7280' }}><ThumbsUp size={16} /> Like</span>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold flex-1 justify-center" style={{ color: '#6B7280' }}><MessageCircle size={16} /> Comment</span>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold flex-1 justify-center" style={{ color: '#6B7280' }}><Repeat2 size={16} /> Repost</span>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold flex-1 justify-center" style={{ color: '#6B7280' }}><Send size={15} /> Send</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CreatePost() {
  // Auth + profile
  const [userId, setUserId]       = useState<string | null>(null);
  const [hasPersona, setHasPersona] = useState(false);
  const [userName, setUserName]   = useState('');
  const [userRole, setUserRole]   = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [userAvatar, setUserAvatar]   = useState('');

  // Voice profile quick-edit (Piece: /create quick-access voice panel)
  const [personaData, setPersonaData] = useState<{
    communication_styles: string[]; formality_score: number;
    expertise_topic: string | null; contrarian_take: string | null; voice_samples: string[];
  } | null>(null);
  const [voiceEditOpen, setVoiceEditOpen] = useState(false);
  const [voiceEditClosing, setVoiceEditClosing] = useState(false);
  const [editStyles, setEditStyles] = useState<string[]>([]);
  const [editFormality, setEditFormality] = useState(50);
  const [editExpertise, setEditExpertise] = useState('');
  const [voiceMatchScore, setVoiceMatchScore] = useState<number | null>(null);
  const [loadingVoiceScore, setLoadingVoiceScore] = useState(false);
  const [savingVoice, setSavingVoice] = useState(false);
  const [voiceToast, setVoiceToast] = useState(false);

  // Composer
  const [composerContent, setComposerContent] = useState('');
  const [contentHistory, setContentHistory]   = useState<string[]>([]);
  const [redoStack, setRedoStack]             = useState<string[]>([]);
  const [shortcutsOpen, setShortcutsOpen]     = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [lastTopicAttempt, setLastTopicAttempt] = useState('');
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [restorePrompt, setRestorePrompt] = useState<{ content: string; savedAt: number } | null>(null);
  const lastAutosavedContent = useRef('');
  const [contentType, setContentType]         = useState('linkedin-post');
  const [tone, setTone]                       = useState(() => localStorage.getItem('eclatale_pref_tone') || 'professional');
  const [contentLength, setContentLength]     = useState<'micro' | 'short' | 'standard' | 'longform'>(() => {
    const saved = localStorage.getItem('eclatale_pref_length');
    return (saved === 'micro' || saved === 'short' || saved === 'standard' || saved === 'longform') ? saved : 'standard';
  });
  // Remember the user's last tone/length choice locally so it's the default
  // next visit, even before their profile default (if any) has loaded.
  useEffect(() => { try { localStorage.setItem('eclatale_pref_tone', tone); } catch {} }, [tone]);
  useEffect(() => { try { localStorage.setItem('eclatale_pref_length', contentLength); } catch {} }, [contentLength]);
  const [postId, setPostId]                   = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success?: boolean; error?: string; urn?: string } | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);

  // Live LinkedIn preview
  const [composerView, setComposerView] = useState<'edit' | 'preview'>('edit');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Poll (composer-only — LinkedIn's public API has no poll-publishing endpoint,
  // so this is a draft/preview aid; publishing is blocked while one is attached)
  const [pollData, setPollData] = useState<{ question: string; options: string[]; duration: string } | null>(null);

  // Visual attachment
  const [attachedImage, setAttachedImage]     = useState<string | null>(null);
  const [visualModalOpen, setVisualModalOpen] = useState(false);
  const [visualPreview, setVisualPreview]     = useState<string | null>(null);
  const [visualStyle, setVisualStyle]         = useState('minimal');
  const [visualStyleAutoPicked, setVisualStyleAutoPicked] = useState(false);
  const [generatingVisual, setGeneratingVisual] = useState(false);
  const [imageUsage, setImageUsage] = useState<{ used: number; limit: number } | null>(null);
  const [visualError, setVisualError]         = useState('');
  const [showTextOverlay, setShowTextOverlay] = useState(true);
  const [ideasView, setIdeasView]             = useState(false);
  const [ideasList, setIdeasList]             = useState<{ topic: string; whyNow: string; trending: boolean }[]>([]);
  const [loadingIdeas, setLoadingIdeas]       = useState(false);
  const [writeTopic, setWriteTopic]           = useState('');

  // Conversational assistant
  const [chatMsgs, setChatMsgs]   = useState<ChatMsg[]>([]);
  const [activeFlow, setActiveFlow] = useState<FlowType>(null);
  const [chatInput, setChatInput] = useState('');
  const [generating, setGenerating]   = useState(false);
  const [repurposing, setRepurposing] = useState(false);
  const [repurposeText, setRepurposeText] = useState('');
  const [repurposeMode, setRepurposeMode] = useState<'voice' | 'pattern' | 'reaction'>('voice');
  const [userReaction, setUserReaction] = useState('');
  const [urlFetchState, setUrlFetchState] = useState<'idle' | 'fetching' | 'loaded' | 'error'>('idle');
  const [urlFetchMessage, setUrlFetchMessage] = useState('');
  const [extractedPattern, setExtractedPattern] = useState('');
  const [refining, setRefining]   = useState(false);

  // UI
  const [error, setError] = useState('');

  // Best time to post (AI-recommended)
  const [bestTime, setBestTime] = useState<{ recommendedDays: string[]; recommendedTimes: string[]; reasoning: string; basedOn: string; confidence: string } | null>(null);
  const [scheduleSlots, setScheduleSlots] = useState<{ time: string; days: number[] }[]>([]);

  // Writing-pattern nudge (Piece 13) + tone match feedback (Piece 14)
  const [patterns, setPatterns] = useState<any>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [nudgeApplied, setNudgeApplied] = useState(false);
  const [toneMatch, setToneMatch] = useState<{ match: boolean; matchScore: number; drift: string; suggestion: string } | null>(null);
  const [checkingToneMatch, setCheckingToneMatch] = useState(false);
  const [toneMatchOpen, setToneMatchOpen] = useState(false);
  const [authScore, setAuthScore] = useState<AuthenticityScore | null>(null);
  const [showAuthLoading, setShowAuthLoading] = useState(false);
  const [authScoreExpanded, setAuthScoreExpanded] = useState(false);
  const [postSuggestionsOpen, setPostSuggestionsOpen] = useState(false);
  const [referencesExpanded, setReferencesExpanded] = useState(false);
  const [referenceUsed, setReferenceUsed] = useState(false);
  const [referenceHintDismissed, setReferenceHintDismissed] = useState(false);
  const [usingReferenceUrl, setUsingReferenceUrl] = useState<string | null>(null);
  const [copiedRefUrl, setCopiedRefUrl] = useState<string | null>(null);
  const [lastTopic, setLastTopic] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleConfirmedFor, setScheduleConfirmedFor] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleErr, setScheduleErr] = useState('');
  const scheduleRef = useRef<HTMLDivElement>(null);

  const toneRef        = useRef<HTMLDivElement>(null);
  const toneMatchRef   = useRef<HTMLDivElement>(null);
  const postSuggestionsRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Angle & structure tags (Write flow)
  const [angleTags, setAngleTags] = useState<string[]>([]);
  const [structureTag, setStructureTag] = useState<string | null>(null);
  const toggleAngleTag = (tag: string) => setAngleTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length >= 3 ? prev : [...prev, tag]);

  // Rich text + snippets toolbar
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const richTextRef = useRef<HTMLDivElement>(null);
  const snippetsRef = useRef<HTMLDivElement>(null);
  const [richTextOpen, setRichTextOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [snippets, setSnippets] = useState<{ id: string; label: string; content: string }[]>([]);
  const [newSnippetLabel, setNewSnippetLabel] = useState('');

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    if (topicParam) {
      addMsg('bot', "What would you like to write about? I've pre-filled the topic below.", 'text');
      setChatInput(topicParam);
      setActiveFlow('write');
    }
    if (params.get('action') === 'ideas') {
      handleCardIdeas();
    }
    const scheduleDateParam = params.get('scheduleDate');
    if (scheduleDateParam) setScheduleDate(scheduleDateParam);
    const editPostId = params.get('postId');

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      const u = data.user;
      setUserId(u.id);
      if (editPostId) {
        supabase.from('posts').select('id, content, tone, content_type, scheduled_for').eq('id', editPostId).eq('user_id', u.id).single()
          .then(({ data: post }) => {
            if (!post) return;
            setPostId(post.id);
            setComposerContent(post.content || '');
            if (post.tone) setTone(post.tone);
            if (post.content_type) setContentType(post.content_type);
            if (post.scheduled_for) {
              const d = new Date(post.scheduled_for);
              setScheduleDate(d.toISOString().slice(0, 10));
              setScheduleTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
            }
          });
      }
      supabase.from('profiles').select('role, domain, first_name, last_name, profile_photo_url, default_tone').eq('id', u.id).single()
        .then(({ data: p }) => {
          if (p) {
            setUserRole([p.role, p.domain].filter(Boolean).join(' · '));
            if (p.profile_photo_url) setUserAvatar(p.profile_photo_url);
            if (p.default_tone) setTone(p.default_tone);
            if (p.first_name || p.last_name) {
              const full = [p.first_name, p.last_name].filter(Boolean).join(' ');
              setUserName(full);
              const fn = (p.first_name || '').trim();
              const ln = (p.last_name || '').trim();
              setUserInitials(fn && ln ? (fn[0] + ln[0]).toUpperCase() : (fn || ln).substring(0, 2).toUpperCase());
              return;
            }
          }
          // Fall back to email-derived name if no profile name set
          const meta = (u.user_metadata || {}) as Record<string, string>;
          const raw = meta.full_name || meta.name || (u.email?.split('@')[0] || '');
          const display = raw.replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
          setUserName(display);
          const parts = display.split(' ').filter(Boolean);
          setUserInitials(parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : display.substring(0, 2).toUpperCase());
        });
      loadSnippets(u.id);
      supabase.from('user_schedule_slots').select('slots').eq('user_id', u.id).single()
        .then(({ data: row }) => { if (row?.slots?.length) setScheduleSlots(row.slots); });
      supabase.from('persona_profiles').select('*').eq('user_id', u.id).single()
        .then(({ data: persona }) => {
          setHasPersona(!!persona?.persona_completed_at);
          if (persona) {
            setPersonaData({
              communication_styles: persona.communication_styles || [],
              formality_score: typeof persona.formality_score === 'number' ? persona.formality_score : 50,
              expertise_topic: persona.expertise_topic || null,
              contrarian_take: persona.contrarian_take || null,
              voice_samples: persona.voice_samples || [],
            });
          }
        });
      // LinkedIn picture is secondary fallback — only used if no profile_photo_url
      fetch(`${API_URL}/api/linkedin/status?userId=${u.id}`)
        .then(r => r.json())
        .then(d => { if (d.picture) setUserAvatar(prev => prev || d.picture); })
        .catch(() => {});
      // AI-recommended best time to post (per-user, cached server-side)
      fetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'best-time', userId: u.id }),
      })
        .then(r => r.json())
        .then(d => {
          if (d && !d.error) {
            setBestTime(d);
          }
        })
        .catch(() => {});
      // Writing-pattern analysis, used to power the pre-generation nudge (Piece 13)
      fetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'user-patterns', userId: u.id }),
      })
        .then(r => r.json())
        .then(d => { if (d && !d.error) setPatterns(d); })
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false);
      if (scheduleRef.current && !scheduleRef.current.contains(e.target as Node)) setScheduleOpen(false);
      if (toneMatchRef.current && !toneMatchRef.current.contains(e.target as Node)) setToneMatchOpen(false);
      if (postSuggestionsRef.current && !postSuggestionsRef.current.contains(e.target as Node)) setPostSuggestionsOpen(false);
      if (richTextRef.current && !richTextRef.current.contains(e.target as Node)) setRichTextOpen(false);
      if (snippetsRef.current && !snippetsRef.current.contains(e.target as Node)) setSnippetsOpen(false);
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
    setRedoStack([]);
    setComposerContent(prev => {
      if (prev) setContentHistory(h => [...h.slice(-19), prev]);
      return newContent;
    });
  }, []);

  const handleUndo = () => {
    if (!contentHistory.length) return;
    setComposerContent(prev => {
      setRedoStack(r => [...r.slice(-19), prev]);
      return contentHistory[contentHistory.length - 1];
    });
    setContentHistory(h => h.slice(0, -1));
  };

  const handleRedo = () => {
    if (!redoStack.length) return;
    setComposerContent(prev => {
      setContentHistory(h => [...h.slice(-19), prev]);
      return redoStack[redoStack.length - 1];
    });
    setRedoStack(r => r.slice(0, -1));
  };

  // ── Rich text + snippets ─────────────────────────────────────────────────

  const applyRichTextStyle = (styleId: string) => {
    const style = RICH_TEXT_STYLES.find(s => s.id === styleId);
    if (!style) return;
    const el = composerTextareaRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? composerContent.length;
    const hasSelection = el && start !== end;
    const target = hasSelection ? composerContent.slice(start, end) : composerContent;
    const styled = style.apply(target);
    const next = hasSelection
      ? composerContent.slice(0, start) + styled + composerContent.slice(end)
      : styled;
    updateContent(next);
    setRichTextOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = (hasSelection ? start : 0) + styled.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  const loadSnippets = useCallback(async (uid: string) => {
    const { data } = await supabase.from('post_snippets').select('id, label, content').eq('user_id', uid).order('created_at', { ascending: false });
    if (data) setSnippets(data);
  }, []);

  const insertSnippet = (content: string) => {
    const el = composerTextareaRef.current;
    const start = el?.selectionStart ?? composerContent.length;
    const end = el?.selectionEnd ?? composerContent.length;
    const next = composerContent.slice(0, start) + content + composerContent.slice(end);
    updateContent(next);
    setSnippetsOpen(false);
    requestAnimationFrame(() => { el?.focus(); const caret = start + content.length; el?.setSelectionRange(caret, caret); });
  };

  const saveCurrentAsSnippet = async () => {
    if (!userId || !composerContent.trim() || !newSnippetLabel.trim()) return;
    const { data } = await supabase.from('post_snippets')
      .insert({ user_id: userId, label: newSnippetLabel.trim(), content: composerContent })
      .select('id, label, content').single();
    if (data) setSnippets(s => [data, ...s]);
    setNewSnippetLabel('');
  };

  const deleteSnippet = async (id: string) => {
    setSnippets(s => s.filter(sn => sn.id !== id));
    await supabase.from('post_snippets').delete().eq('id', id);
  };

  // ── Card clicks ───────────────────────────────────────────────────────────

  const handleCardIdeas = async () => {
    setActiveFlow(null);
    setIdeasView(true);
    setIdeasList([]);
    setLoadingIdeas(true);
    try {
      const res = await fetch(`${API_URL}/api/suggest-topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ query: '', userId }),
      });
      const data = await res.json();
      if (Array.isArray(data.topics)) setIdeasList(data.topics);
    } catch { }
    setLoadingIdeas(false);
  };

  const handleCardWrite = () => {
    setIdeasView(false);
    setWriteTopic('');
    setActiveFlow('write');
  };

  const handleCardRepurpose = () => {
    setIdeasView(false);
    setRepurposeText('');
    setActiveFlow('repurpose');
  };

  const handleCardImprove = () => {
    setIdeasView(false);
    if (composerContent) {
      setActiveFlow('improve');
    } else {
      setWriteTopic('');
      setActiveFlow('write');
    }
  };

  const closeActionPanel = () => {
    setActiveFlow(null);
    setIdeasView(false);
  };

  // ── Voice profile quick-edit ─────────────────────────────────────────────

  const openVoiceEdit = () => {
    setEditStyles(personaData?.communication_styles || []);
    setEditFormality(personaData?.formality_score ?? 50);
    setEditExpertise(personaData?.expertise_topic || '');
    setVoiceEditClosing(false);
    setVoiceEditOpen(true);
    if (userId) {
      setLoadingVoiceScore(true);
      fetch(`${API_URL}/api/voice-match-score?userId=${userId}`)
        .then(r => r.json())
        .then(d => { if (typeof d.score === 'number') setVoiceMatchScore(d.score); })
        .catch(() => {})
        .finally(() => setLoadingVoiceScore(false));
    }
  };

  const closeVoiceEdit = () => {
    setVoiceEditClosing(true);
    setTimeout(() => { setVoiceEditOpen(false); setVoiceEditClosing(false); }, 220);
  };
  useModalBackButton(voiceEditOpen, closeVoiceEdit);

  const closeVisualModal = () => {
    setVisualModalOpen(false);
    setVisualPreview(null);
    setVisualError('');
  };
  useModalBackButton(visualModalOpen, closeVisualModal);

  const toggleEditStyle = (id: string) => {
    setEditStyles(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSaveVoice = async () => {
    if (!userId) return;
    setSavingVoice(true);
    try {
      const { error } = await supabase.from('persona_profiles').upsert({
        user_id: userId,
        communication_styles: editStyles,
        formality_score: editFormality,
        expertise_topic: editExpertise || null,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setPersonaData(prev => ({
        communication_styles: editStyles,
        formality_score: editFormality,
        expertise_topic: editExpertise || null,
        contrarian_take: prev?.contrarian_take ?? null,
        voice_samples: prev?.voice_samples ?? [],
      }));
      setVoiceToast(true);
      setTimeout(() => setVoiceToast(false), 3500);
      closeVoiceEdit();
    } catch { /* silent — user can retry */ }
    setSavingVoice(false);
  };

  const voiceSummary = personaData && (personaData.communication_styles.length || personaData.expertise_topic)
    ? [
        personaData.communication_styles.slice(0, 2).map(id => STYLES.find(s => s.id === id)?.label || id).join(', '),
        formalityLabel(personaData.formality_score),
        personaData.expertise_topic ? (personaData.expertise_topic.length > 24 ? personaData.expertise_topic.slice(0, 24) + '…' : personaData.expertise_topic) : '',
      ].filter(Boolean).join(' · ')
    : '';

  const handleWriteGenerate = () => {
    if (!writeTopic.trim()) return;
    addMsg('user', writeTopic, 'text');
    // Stay on the write panel until generation actually succeeds — closing
    // it optimistically meant a failed generation left the error with
    // nowhere visible to render (activeFlow was already null by then).
    handleGenerate(writeTopic);
  };

  // Fire-and-forget background semantic analysis after a post is saved.
  // Never awaited in the UI path, so save/publish never waits on it.
  const queueAnalysis = (postId: string | null, content: string) => {
    if (!postId || !userId || !content.trim()) return;
    fetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'analyze-post', userId, postId, postContent: content }),
    }).catch(() => {});
  };

  // ── Generate ──────────────────────────────────────────────────────────────

  // Tone match feedback (Piece 14) — compares intended vs actual tone after any
  // AI generation/refinement, never blocks the composer.
  const checkToneMatch = useCallback(async (content: string, toneToCheck: string) => {
    if (!content.trim() || !userId) return;
    setCheckingToneMatch(true);
    try {
      const res = await fetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'tone-match', userId, intendedTone: toneToCheck, postContent: content }),
      });
      const d = await res.json();
      if (d && !d.error) setToneMatch(d);
    } catch { }
    setCheckingToneMatch(false);
  }, [userId]);

  // Content Authenticity Score (factual accuracy + topic freshness + voice match).
  // Runs in the background after generation — never blocks reading/editing the post.
  const checkAuthenticityScore = useCallback((postIdToCheck: string | null, content: string, topic: string) => {
    if (!postIdToCheck || !content.trim() || !userId) return;
    setAuthScore(null);
    const loadingTimer = setTimeout(() => setShowAuthLoading(true), 1200);
    fetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'authenticity-score', userId, postId: postIdToCheck, postContent: content, topic, contentLength }),
    })
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAuthScore(d); })
      .catch(() => {})
      .finally(() => { clearTimeout(loadingTimer); setShowAuthLoading(false); });
  }, [userId, contentLength]);

  const handleFixSuggestion = (suggestion: string) => {
    if (!suggestion) return;
    setChatInput(suggestion);
  };

  const handleUseReference = async (ref: ReferenceItem) => {
    setUsingReferenceUrl(ref.url);
    await handleRefineWithInstruction(
      `Add a reference to "${ref.title}" by ${ref.publication} to strengthen the post's credibility. Weave it in naturally, don't just append it.`,
      `Added a reference to ${ref.publication}`
    );
    setReferenceUsed(true);
    setUsingReferenceUrl(null);
  };

  const handleCopyReferenceLink = (url: string) => {
    copyToClipboard(url);
    setCopiedRefUrl(url);
    setTimeout(() => setCopiedRefUrl(null), 2000);
  };

  // Rotating status copy + a "taking a moment" upgrade after 10s, shown
  // wherever `generating` is true (prevents a bare spinner feeling stuck).
  useEffect(() => {
    if (!generating && !repurposing) { setGenerationStage(''); return; }
    const messages = repurposing
      ? ['Reading your source material…', 'Extracting the core idea…', 'Matching your voice…', 'Adding the finishing touches…']
      : ['Analyzing your industry…', 'Crafting your hook…', 'Matching your voice…', 'Adding the finishing touches…'];
    let i = 0;
    setGenerationStage(messages[0]);
    const rotate = setInterval(() => { i = (i + 1) % messages.length; setGenerationStage(messages[i]); }, 2800);
    const slow = setTimeout(() => setGenerationStage('This is taking a moment — our AI is being thorough…'), 10000);
    return () => { clearInterval(rotate); clearTimeout(slow); };
  }, [generating, repurposing]);

  const handleGenerate = async (topic: string) => {
    if (!topic.trim() || !userId) return;
    setGenerating(true); setError(''); setLastTopicAttempt(topic);
    try {
      const data = await fetchJson(`${API_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, tone, contentType, contentLength, userId, styleNudge: nudgeApplied ? nudge?.instruction : undefined, angleTags, structureTag }),
      });
      if (data.error) throw new Error(friendlyErrorMessage(data));
      updateContent(data.content);
      setPublishResult(null);
      setActiveFlow(null);
      setWriteTopic('');
      setNudgeDismissed(true);
      const label = CONTENT_TYPES.find(c => c.id === contentType)?.label || contentType;
      addActivity('sparkles', `Generated a ${label} about "${topic.substring(0, 50)}${topic.length > 50 ? '…' : ''}"`);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic,
        tone, content_type: contentType, source: 'auto',
      }).select('id').single();
      if (inserted) {
        setPostId(inserted.id); queueAnalysis(inserted.id, data.content); setLastTopic(topic);
        setReferenceUsed(false); setReferenceHintDismissed(false); setReferencesExpanded(false);
        checkAuthenticityScore(inserted.id, data.content, topic);
        // Fire-and-forget: server checks the actual weekly count and dedupes
        // via email_log, so it's safe to call after every generated post.
        fetch(`${API_URL}/api/email/send-free-limit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }).catch(() => {});
      }
      checkToneMatch(data.content, tone);
    } catch (err: any) {
      const msg = err.message || 'Something went wrong — please try again.';
      addMsg('bot', `Sorry, couldn't generate: ${msg}`, 'text');
      setError(msg);
    }
    setGenerating(false);
  };

  // ── Repurpose ─────────────────────────────────────────────────────────────

  // URLs auto-fetch on paste/blur so the user never has to leave the app to
  // copy article text; LinkedIn URLs are rejected server-side with a
  // specific message since that content isn't scrapeable.
  const looksLikeUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

  const tryFetchUrl = async (text: string) => {
    if (!looksLikeUrl(text) || urlFetchState === 'fetching') return;
    setUrlFetchState('fetching');
    setUrlFetchMessage('Fetching content from URL…');
    try {
      const data = await fetchJson(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'fetch-url', url: text.trim() }),
      });
      if (data.error === 'linkedin_private') {
        setUrlFetchState('error');
        setUrlFetchMessage(data.message);
        return;
      }
      if (data.error) {
        setUrlFetchState('error');
        setUrlFetchMessage(data.message || "Couldn't fetch this URL — paste the text directly instead.");
        return;
      }
      setRepurposeText(data.text);
      setUrlFetchState('loaded');
      setUrlFetchMessage(`Content loaded from ${data.domain}`);
    } catch {
      setUrlFetchState('error');
      setUrlFetchMessage("Couldn't fetch this URL — paste the text directly instead.");
    }
  };

  const handleRepurpose = async () => {
    if (!repurposeText.trim() || !userId) return;
    if (repurposeMode === 'reaction' && !userReaction.trim()) return;
    setRepurposing(true); setError(''); setExtractedPattern('');
    try {
      const data = await fetchJson(`${API_URL}/api/repurpose`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ sourceText: repurposeText, contentType, tone, contentLength, userId, mode: repurposeMode, userReaction }),
      });
      if (data.error) throw new Error(friendlyErrorMessage(data));
      if (data.extractedPattern) setExtractedPattern(data.extractedPattern);
      updateContent(data.content);
      setPublishResult(null);
      setActiveFlow(null);
      const label = CONTENT_TYPES.find(c => c.id === contentType)?.label || contentType;
      addActivity('scissors', data.extractedPattern
        ? `Repurposed as a ${label} using pattern: ${data.extractedPattern}`
        : `Repurposed content as a ${label}`);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic: 'Repurposed content',
        tone, content_type: contentType, source: 'repurpose',
      }).select('id').single();
      if (inserted) {
        setPostId(inserted.id); queueAnalysis(inserted.id, data.content); setLastTopic('Repurposed content');
        setReferenceUsed(false); setReferenceHintDismissed(false); setReferencesExpanded(false);
        checkAuthenticityScore(inserted.id, data.content, 'Repurposed content');
      }
      checkToneMatch(data.content, tone);
    } catch (err: any) {
      const msg = err.message || 'Something went wrong — please try again.';
      addMsg('bot', `Repurpose failed: ${msg}`, 'text');
      setError(msg);
    }
    setRepurposing(false);
  };

  // ── Refine ────────────────────────────────────────────────────────────────

  const handleRefineWithInstruction = async (instruction: string, label?: string, toneOverride?: string) => {
    if (!composerContent || !instruction.trim() || !userId) return;
    setRefining(true);
    try {
      const res = await fetch(`${API_URL}/api/refine-content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ currentContent: composerContent, instruction, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(friendlyErrorMessage(data));
      updateContent(data.content);
      addActivity('wand', label || `Applied: "${instruction.substring(0, 45)}${instruction.length > 45 ? '…' : ''}"`);
      fetch(`${API_URL}/api/persona-signal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, postId, action: 'refined', tone, contentType }),
      }).catch(() => {});
      checkToneMatch(data.content, toneOverride || tone);
      checkAuthenticityScore(postId, data.content, lastTopic);
    } catch (err: any) { setError(err.message || 'Refinement failed'); }
    setRefining(false);
  };

  // One-click tone adjustment from the tone-match inline suggestion (Piece 14).
  const handleAdjustTone = () => {
    if (!toneMatch) return;
    handleRefineWithInstruction(
      `Adjust the tone to better align with ${currentTone?.label}. ${toneMatch.suggestion}`,
      'Adjusted tone alignment'
    );
  };

  // ── Chat submit ───────────────────────────────────────────────────────────

  const handleChatSubmit = async () => {
    const input = chatInput.trim();
    if (!input || !composerContent) return;
    setChatInput('');
    addMsg('user', input, 'text');
    setActiveFlow(null);
    await handleRefineWithInstruction(input);
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
      if (data.error) throw new Error(friendlyErrorMessage(data));
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
      `Shifted tone to ${label}`,
      newTone
    );
  };

  // ── Visual ────────────────────────────────────────────────────────────────

  // Suggests a visual style that matches the post's current tone — user's
  // own pick (if they change it) always wins for the rest of the session.
  const TONE_STYLE_SUGGESTION: Record<string, string> = {
    professional: 'professional', 'data-driven': 'dataviz', casual: 'illustrated', inspirational: 'bold',
  };
  const openVisualModal = () => {
    if (!visualStyleAutoPicked) {
      const suggested = TONE_STYLE_SUGGESTION[tone];
      if (suggested) setVisualStyle(suggested);
    }
    setVisualModalOpen(true);
    setVisualPreview(null);
  };

  const handleGenerateVisual = async () => {
    if (!userId) return;
    setGeneratingVisual(true); setVisualError(''); setVisualPreview(null);
    try {
      const topic = (composerContent.split('\n').find(l => l.trim()) || composerContent).substring(0, 80);
      const data = await fetchJson(`${API_URL}/api/generate-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, format: 'square', style: visualStyle, userId }),
      });
      if (typeof data.usageToday === 'number') setImageUsage({ used: data.usageToday, limit: data.usageLimit });
      if (data.error) throw new Error(friendlyErrorMessage(data));
      setVisualPreview(data.imageUrl);
      // Default the overlay on for styles that carry a headline.
      setShowTextOverlay(OVERLAY_STYLES.has(visualStyle));
    } catch (err: any) { setVisualError(err.message || 'Image generation failed'); }
    setGeneratingVisual(false);
  };

  // Produce the final image, baking the real headline overlay into the pixels
  // when the overlay is enabled (so it persists on attach/download, not just preview).
  const buildFinalVisual = async (): Promise<string | null> => {
    if (!visualPreview) return null;
    if (showTextOverlay && composerContent.trim()) {
      try {
        return await compositeOverlay(visualPreview, deriveHeadline(composerContent), { position: 'bottom' });
      } catch { return visualPreview; }
    }
    return visualPreview;
  };

  const handleUseVisual = async () => {
    const final = await buildFinalVisual();
    setAttachedImage(final);
    setVisualModalOpen(false);
    setVisualPreview(null);
    addActivity('sparkles', 'Added a visual to the post');
  };

  const handleDownloadVisual = async () => {
    const final = await buildFinalVisual();
    if (!final) return;
    const a = document.createElement('a');
    a.href = final;
    a.download = `visual-${Date.now()}.png`;
    a.click();
  };

  // ── Composer actions ──────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!composerContent) return;
    copyToClipboard(composerContent);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    addActivity('copy', 'Copied to clipboard');
    if (userId) {
      fetch(`${API_URL}/api/persona-signal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, postId, action: 'kept', tone, contentType, postLength: composerContent.length }),
      }).catch(() => {});
    }
  };

  const handleSaveDraft = async () => {
    if (!composerContent || !userId) return;
    try {
      if (postId) {
        await supabase.from('posts').update({ content: composerContent, tone, content_type: contentType }).eq('id', postId);
        queueAnalysis(postId, composerContent);
      } else {
        const { data: inserted } = await supabase.from('posts').insert({
          user_id: userId, content: composerContent, topic: 'Draft',
          tone, content_type: contentType, source: 'auto',
        }).select('id').single();
        if (inserted) { setPostId(inserted.id); queueAnalysis(inserted.id, composerContent); }
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      addActivity('save', 'Saved as draft');
    } catch { }
  };

  // ── Autosave + draft recovery ────────────────────────────────────────────
  const draftStorageKey = userId ? `eclatale_draft_${userId}` : null;

  // localStorage mirror — instant, survives a network blip; written on every
  // real content change (not on a timer) since it's just a synchronous write.
  useEffect(() => {
    if (!draftStorageKey || !composerContent) return;
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        content: composerContent, topic: lastTopic || writeTopic, tone, contentType, savedAt: Date.now(),
      }));
    } catch { /* storage full or disabled — silent, Supabase autosave still covers it */ }
  }, [composerContent, draftStorageKey, tone, contentType, lastTopic, writeTopic]);

  // Supabase autosave — every 30s, only if there's content and it actually
  // changed since the last autosave (avoids hammering the DB while idle).
  useEffect(() => {
    if (!composerContent || !userId) return;
    const interval = setInterval(async () => {
      if (composerContent === lastAutosavedContent.current) return;
      setAutosaveState('saving');
      try {
        if (postId) {
          await supabase.from('posts').update({ content: composerContent, tone, content_type: contentType }).eq('id', postId);
        } else {
          const { data: inserted } = await supabase.from('posts').insert({
            user_id: userId, content: composerContent, topic: lastTopic || writeTopic || 'Draft',
            tone, content_type: contentType, source: 'auto',
          }).select('id').single();
          if (inserted) setPostId(inserted.id);
        }
        lastAutosavedContent.current = composerContent;
        setAutosaveState('saved');
        setTimeout(() => setAutosaveState('idle'), 2000);
      } catch {
        setAutosaveState('idle');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [composerContent, userId, postId, tone, contentType, lastTopic, writeTopic]);

  // On mount, offer to restore a localStorage draft newer than what's already
  // loaded (covers a crashed tab / lost network before the Supabase write landed).
  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.content && !composerContent) {
        setRestorePrompt({ content: parsed.content, savedAt: parsed.savedAt });
      }
    } catch { /* corrupt/old entry — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  const restoreDraft = () => {
    if (!restorePrompt) return;
    updateContent(restorePrompt.content);
    setRestorePrompt(null);
  };

  const dismissRestorePrompt = () => {
    if (draftStorageKey) { try { localStorage.removeItem(draftStorageKey); } catch {} }
    setRestorePrompt(null);
  };

  // Warn on tab close / refresh / typed-URL navigation if there's content
  // that hasn't made it to Supabase yet (autosave runs every 30s, so this
  // only fires in that narrow window).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (composerContent && composerContent !== lastAutosavedContent.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [composerContent]);

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
      queueAnalysis(activePostId, composerContent);
      if (!activePostId) throw new Error('Failed to save post. Please try again.');
      const res = await fetch(`${API_URL}/api/linkedin/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ postId: activePostId, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(friendlyErrorMessage(data));
      setPublishResult({ success: true, urn: data.linkedinPostUrn });
      addActivity('send', 'Published to LinkedIn');
      if (draftStorageKey) { try { localStorage.removeItem(draftStorageKey); } catch {} }
      fetch(`${API_URL}/api/persona-signal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, postId: activePostId, action: 'kept', tone, contentType, postLength: composerContent.length }),
      }).catch(() => {});
    } catch (err: any) { setPublishResult({ error: err.message }); }
    setPublishing(false);
  };

  // ── Scheduling ────────────────────────────────────────────────────────────

  const openSchedulePanel = () => {
    if (!scheduleDate) {
      // Prefer the user's own recurring posting-times grid (set at /schedule)
      // over the AI's best-time guess — it's an explicit preference, not an inference.
      const slotOccurrence = nextSlotOccurrence(scheduleSlots);
      if (slotOccurrence) {
        setScheduleDate(slotOccurrence.toISOString().slice(0, 10));
        setScheduleTime(`${String(slotOccurrence.getHours()).padStart(2, '0')}:${String(slotOccurrence.getMinutes()).padStart(2, '0')}`);
      } else {
        // Fall back to the AI's best-time recommendation: next occurrence of
        // the recommended weekday, at the recommended time.
        const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const recDay = bestTime?.recommendedDays?.[0];
        const target = new Date();
        if (recDay) {
          const targetIdx = DAYS.indexOf(recDay);
          if (targetIdx !== -1) {
            let delta = (targetIdx - target.getDay() + 7) % 7;
            if (delta === 0) delta = 7; // today already may have passed the slot — default to next week
            target.setDate(target.getDate() + delta);
          }
        } else {
          target.setDate(target.getDate() + 1);
        }
        setScheduleDate(target.toISOString().slice(0, 10));

        const recTime = bestTime?.recommendedTimes?.[0];
        const match = recTime?.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
        if (match) {
          let h = parseInt(match[1], 10);
          const m = match[2] ? parseInt(match[2], 10) : 0;
          if (/pm/i.test(match[3]) && h !== 12) h += 12;
          if (/am/i.test(match[3]) && h === 12) h = 0;
          setScheduleTime(`${String(h).padStart(2, '0')}:${String(Math.round(m / 30) * 30).padStart(2, '0')}`);
        } else {
          setScheduleTime('08:00');
        }
      }
    }
    setScheduleOpen(o => !o);
  };

  const handleSchedulePost = async () => {
    if (!composerContent || !userId || !scheduleDate || !scheduleTime) return;
    setScheduling(true); setScheduleErr('');
    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (scheduledFor.getTime() < Date.now()) throw new Error('Pick a time in the future.');

      let activePostId = postId;
      if (activePostId) {
        await supabase.from('posts').update({ content: composerContent, tone, content_type: contentType }).eq('id', activePostId);
      } else {
        const { data: inserted } = await supabase.from('posts').insert({
          user_id: userId, content: composerContent, topic: lastTopic || writeTopic || 'Draft',
          tone, content_type: contentType, source: 'auto',
        }).select('id').single();
        if (inserted) { activePostId = inserted.id; setPostId(inserted.id); }
      }
      if (!activePostId) throw new Error('Failed to save post. Please try again.');

      const data = await fetchJson(`${API_URL}/api/schedule/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, postId: activePostId, scheduledFor: scheduledFor.toISOString() }),
      });
      if (data.error) throw new Error(friendlyErrorMessage(data));

      setScheduleConfirmedFor(scheduledFor.toISOString());
      setScheduleOpen(false);
      addActivity('save', `Scheduled for ${scheduledFor.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} at ${scheduledFor.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    } catch (err: any) {
      setScheduleErr(err.message || 'Failed to schedule post.');
    }
    setScheduling(false);
  };

  // ── Global keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (composerContent && !publishing) handlePublish();
        return;
      }
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (composerContent) handleSaveDraft();
        return;
      }
      if (mod && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (activeFlow === 'write' && writeTopic.trim()) handleWriteGenerate();
        else if (!activeFlow && !ideasView) handleCardWrite();
        return;
      }
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('aria:open'));
        return;
      }
      if (mod && (e.key === 'z' || e.key === 'Z') && !typing) {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y') && !typing) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.key === 'Escape') {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (visualModalOpen) { closeVisualModal(); return; }
        if (voiceEditOpen) { closeVoiceEdit(); return; }
        if (toneOpen) { setToneOpen(false); return; }
        if (toneMatchOpen) { setToneMatchOpen(false); return; }
        if (activeFlow || ideasView) { closeActionPanel(); return; }
        return;
      }
      if (e.key === '?' && !typing) {
        e.preventDefault();
        setShortcutsOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [composerContent, publishing, activeFlow, writeTopic, ideasView, shortcutsOpen, visualModalOpen, voiceEditOpen, toneOpen, toneMatchOpen, contentHistory, redoStack]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const charLen  = composerContent.length;
  const charPct  = Math.min(100, (charLen / CHAR_LIMIT) * 100);
  const charColor = charLen > 2900 ? 'text-red-500' : charLen > 2500 ? 'text-amber-500' : 'text-brand-muted';
  const barColor  = charLen > 2900 ? 'bg-red-400' : charLen > 2500 ? 'bg-amber-400' : 'bg-brand-purple';
  const currentTone = TONES.find(t => t.id === tone);
  const nudge = computeNudge(patterns);

  const chatDisabled = !composerContent || activeFlow === 'write' || activeFlow === 'repurpose';
  const chatPlaceholder = activeFlow === 'write' || activeFlow === 'repurpose'
    ? 'Use the panel on the right →'
    : !composerContent
    ? 'Ask me to find ideas, write a post, or repurpose content…'
    : 'Ask me to improve this post, make it shorter, change the tone…';

  const composerPlaceholder = contentType !== 'linkedin-post' && !composerContent
    ? `Generate a post first — switch here to see it adapted as a ${CONTENT_TYPES.find(c => c.id === contentType)?.label}.`
    : 'Start typing, or ask the assistant to write your first draft…';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-app-shell flex flex-col overflow-hidden bg-[#EAE5F5]">

      {/* Nav */}
      <nav className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-6 h-14 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="min-w-[44px] min-h-[44px] -ml-1.5 flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors"><ArrowLeft size={18} /></a>
          <a href="/dashboard" className="text-base font-extrabold gradient-text hidden sm:block">Eclatale</a>
        </div>
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[11px]">
          <Sparkles size={11} /> Create
        </div>
      </nav>

      {/* Mobile voice-status row — replaces desktop's AI Assistant panel header on small screens */}
      <div className="md:hidden flex-shrink-0 h-11 px-4 flex items-center justify-between border-b border-[rgba(124,92,252,0.06)] bg-white/60">
        {hasPersona ? (
          <span className="badge bg-[rgba(6,214,160,0.08)] text-brand-teal text-[10px] !py-1"><Check size={10} /> In your voice</span>
        ) : (
          <a href="/persona-setup" className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[10px] !py-1">Set up voice</a>
        )}
        {hasPersona && (
          <button onClick={openVoiceEdit} className="text-[11px] font-semibold text-brand-purple">Edit voice →</button>
        )}
      </div>

      {/* Centered workspace — floats on page bg on wide screens */}
      <div className="flex-1 min-h-0 overflow-hidden flex items-stretch justify-center md:px-6 md:py-5 pb-14 md:pb-0">
        <div className="relative w-full max-w-[1320px] flex min-h-0 bg-white rounded-none md:rounded-2xl md:border md:border-[rgba(0,0,0,0.08)] md:shadow-[0_4px_32px_rgba(0,0,0,0.1)] overflow-hidden">

        {/* ── LEFT: AI ASSISTANT — desktop/tablet only; mobile uses the bottom nav instead ── */}
        <aside className="hidden md:flex flex-col w-full md:w-[300px] lg:w-[380px] flex-shrink-0 border-r border-[rgba(124,92,252,0.07)] bg-white/50 overflow-hidden">

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

          {/* Voice summary row — quick-access to the voice profile quick-edit panel */}
          {hasPersona && (
            <div className="flex-shrink-0 px-5 py-2 border-b border-[rgba(124,92,252,0.06)] flex items-center justify-between gap-2 bg-white/40">
              <span className="text-[10px] text-brand-muted truncate">{voiceSummary || 'Voice profile set up'}</span>
              <button onClick={openVoiceEdit}
                className="text-[10px] font-semibold text-brand-purple hover:underline flex-shrink-0 whitespace-nowrap">
                Edit voice →
              </button>
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Quick-action cards */}
            <div>
              <p className="text-[10px] text-brand-muted uppercase tracking-widest font-semibold mb-3">Quick actions</p>
              <div className="space-y-2">

                <button onClick={handleCardIdeas}
                  className="w-full card !p-6.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
                  <div className="w-7 h-7 rounded-xl bg-[rgba(124,92,252,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Lightbulb size={13} className="text-brand-purple" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-brand-dark">Find ideas</div>
                    <div className="text-[10px] text-brand-muted">AI-curated topics for your industry</div>
                  </div>
                </button>

                <button onClick={handleCardWrite}
                  className="w-full card !p-6.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
                  <div className="w-7 h-7 rounded-xl bg-[rgba(247,37,133,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <PenTool size={13} className="text-brand-pink" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-brand-dark">Write a post</div>
                    <div className="text-[10px] text-brand-muted">Generate from a topic or idea</div>
                  </div>
                </button>

                <button onClick={handleCardRepurpose}
                  className="w-full card !p-6.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
                  <div className="w-7 h-7 rounded-xl bg-[rgba(255,107,53,0.08)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Scissors size={13} className="text-brand-orange" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-brand-dark">Repurpose content</div>
                    <div className="text-[10px] text-brand-muted">Paste an article, thread, or transcript</div>
                  </div>
                </button>

                <button onClick={handleCardImprove}
                  className="w-full card !p-6.5 text-left hover:shadow-brand-md transition-all group flex items-center gap-3 !rounded-2xl">
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

            {/* Activity log — running record of what's happened */}
            {chatMsgs.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-brand-muted uppercase tracking-widest font-semibold mb-2">Activity</p>
                {chatMsgs.map(msg => {
                  if (msg.type === 'activity') {
                    return (
                      <div key={msg.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[rgba(124,92,252,0.03)] transition-colors">
                        <div className="w-5 h-5 rounded-lg bg-[rgba(124,92,252,0.06)] flex items-center justify-center flex-shrink-0">
                          {msg.activityIcon && <AIcon type={msg.activityIcon} />}
                        </div>
                        <span className="text-[11px] text-brand-muted flex-1 leading-tight">{msg.content}</span>
                        <span className="text-[10px] text-brand-muted flex-shrink-0 tabular-nums">{msg.time}</span>
                      </div>
                    );
                  }
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end px-1">
                        <div className="max-w-[85%] bg-[rgba(124,92,252,0.07)] text-brand-dark text-[11px] leading-relaxed rounded-xl px-2.5 py-1.5">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className="flex items-start gap-2 px-1">
                      <div className="w-4 h-4 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={8} className="text-white" />
                      </div>
                      <p className="text-[11px] text-brand-muted leading-relaxed flex-1">{msg.content}</p>
                    </div>
                  );
                })}
                {(generating || refining || repurposing) && (
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

        </aside>

        {/* Divider */}
        <div className="hidden md:block w-px flex-shrink-0" style={{ background: 'linear-gradient(to bottom,transparent,rgba(124,92,252,0.1) 20%,rgba(124,92,252,0.1) 80%,transparent)' }} />

        {/* ── RIGHT: POST COMPOSER ───────────────────────────────────────────── */}
        <main className="flex flex-col flex-1 min-w-0 lg:min-w-[600px] overflow-hidden">

          {/* Refinement input — top of right panel, directly above content */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-[rgba(0,0,0,0.05)] bg-white/70">
            <div className="relative">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !chatDisabled) { e.preventDefault(); handleChatSubmit(); } }}
                placeholder={chatPlaceholder}
                disabled={chatDisabled || generating || refining}
                className={`input !pr-10 !py-2 !text-[12px] w-full transition-opacity ${chatDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              />
              <button
                onClick={handleChatSubmit}
                disabled={!chatInput.trim() || chatDisabled || generating || refining}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white disabled:opacity-30 transition-opacity">
                {(generating || refining) ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              </button>
            </div>
            {error && activeFlow !== 'write' && activeFlow !== 'repurpose' && <p className="text-[10px] text-red-500 mt-1 px-1" role="alert">{error}</p>}
          </div>

          {/* Single-row header: avatar · name · tone */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2.5 bg-white">
            {userAvatar
              ? <img src={userAvatar} alt={userName} loading="lazy" onError={() => setUserAvatar('')} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              : <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 select-none">{userInitials || 'Y'}</div>
            }
            <span className="text-[12px] font-semibold text-brand-dark leading-none truncate max-w-[130px]">{userName || 'Your Name'}</span>
            <ChevronDown size={11} className="text-brand-muted flex-shrink-0 -ml-1.5" />
            <div className="flex-1 min-w-0" />
            {toneMatch && composerContent && !checkingToneMatch && (
              toneMatch.matchScore >= 70 ? (
                <span className="text-[10px] font-semibold flex items-center gap-0.5 flex-shrink-0 text-brand-teal">
                  {currentTone?.label} ✓ matched
                </span>
              ) : (
              <div className="relative flex-shrink-0" ref={toneMatchRef}>
                <button
                  onClick={() => setToneMatchOpen(o => !o)}
                  className="text-[10px] font-semibold flex items-center gap-0.5 text-amber-500 hover:underline">
                  {currentTone?.label} ≈ partial match
                </button>
                {toneMatchOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-brand-md border border-amber-200 p-3.5 z-30 animate-fadeIn">
                    <p className="text-[12px] text-amber-700 leading-snug mb-2.5">
                      {toneMatch.drift || `This reads a bit different from ${currentTone?.label}`} — want me to adjust?
                    </p>
                    <button onClick={() => { handleAdjustTone(); setToneMatchOpen(false); }} disabled={refining}
                      className="text-[11px] font-semibold text-amber-700 hover:underline disabled:opacity-50">
                      Adjust →
                    </button>
                  </div>
                )}
              </div>
              )
            )}
            <div className="relative flex-shrink-0" ref={toneRef}>
              <button onClick={() => setToneOpen(o => !o)}
                className="badge bg-[rgba(124,92,252,0.06)] text-brand-purple text-[10px] hover:bg-[rgba(124,92,252,0.1)] transition-colors cursor-pointer flex items-center gap-1">
                {currentTone?.emoji} {currentTone?.label}
                <ChevronDown size={10} className={`transition-transform duration-200 ${toneOpen ? 'rotate-180' : ''}`} />
              </button>
              {toneOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl shadow-brand-md border border-[rgba(124,92,252,0.08)] p-2 w-52 z-30 animate-fadeIn" role="radiogroup" aria-label="Tone" onKeyDown={handleOptionGroupKeyDown}>
                  {composerContent && (
                    <p className="text-[10px] text-brand-muted px-2 pb-2 border-b border-[rgba(124,92,252,0.06)] mb-1 leading-relaxed">
                      Selecting a tone will rewrite your current draft.
                    </p>
                  )}
                  {TONES.map(t => (
                    <button key={t.id} onClick={() => handleToneShift(t.id)} role="radio" aria-checked={tone === t.id}
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

          {/* Action switcher pill strip — shown whenever an action panel is open */}
          {(ideasView || activeFlow === 'write' || activeFlow === 'repurpose' || activeFlow === 'improve') && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-[rgba(0,0,0,0.05)] flex items-center gap-1.5 bg-white/70 overflow-x-auto">
              {[
                { key: 'ideas', emoji: '💡', label: 'Ideas', onClick: handleCardIdeas, active: ideasView, dim: false },
                { key: 'write', emoji: '✍️', label: 'Write', onClick: handleCardWrite, active: activeFlow === 'write', dim: false },
                { key: 'repurpose', emoji: '♻️', label: 'Repurpose', onClick: handleCardRepurpose, active: activeFlow === 'repurpose', dim: false },
                { key: 'improve', emoji: '⚡', label: 'Improve', onClick: handleCardImprove, active: activeFlow === 'improve', dim: !composerContent },
              ].map(tab => (
                <button key={tab.key} onClick={tab.onClick}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 flex-shrink-0 transition-all ${
                    tab.active ? 'gradient-primary text-white' : tab.dim ? 'text-brand-muted bg-[rgba(0,0,0,0.03)] opacity-50' : 'text-brand-dark bg-[rgba(0,0,0,0.04)] hover:bg-[rgba(124,92,252,0.08)]'
                  }`}>
                  <span>{tab.emoji}</span> {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Right panel — 4 modes: ideas / write / repurpose / composer (with optional improve strip) */}
          {ideasView ? (

            /* ── IDEAS (LinkedIn-style cards) ─────────────────────────── */
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] font-bold text-brand-dark">Topic ideas for you</span>
                <button onClick={closeActionPanel} aria-label="Close panel"
                  className="p-1 rounded-lg hover:bg-[rgba(124,92,252,0.06)] transition-colors text-brand-muted hover:text-brand-purple">
                  <X size={15} />
                </button>
              </div>
              {loadingIdeas ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 size={20} className="animate-spin text-brand-purple" />
                  <p className="text-[12px] text-brand-muted">Finding ideas based on your profile…</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ideasList.map((idea, i) => (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden flex flex-col transition-shadow"
                      style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,92,252,0.16)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,92,252,0.08)')}>
                      <div className="px-3 pt-3 pb-2 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-2 flex-shrink-0">
                          <div className="flex items-start gap-2 min-w-0">
                            {userAvatar
                              ? <img src={userAvatar} alt={userName} loading="lazy" onError={() => setUserAvatar('')} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                              : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 select-none"
                                  style={{ background: 'linear-gradient(135deg,#7C5CFC 0%,#F725C5 100%)' }}>
                                  {userInitials || 'Y'}
                                </div>
                            }
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: '#1A1A2E' }}>{userName || 'Your Name'}</div>
                              {userRole && <div className="text-[10px] leading-snug mt-0.5 line-clamp-1" style={{ color: '#6B7280' }}>{userRole}</div>}
                              <div className="text-[10px] mt-0.5" style={{ color: '#6B7280' }}>Just now · 🌐</div>
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${
                            idea.trending ? 'bg-[rgba(255,107,53,0.1)] text-brand-orange' : 'bg-[rgba(107,114,128,0.1)] text-brand-muted'
                          }`}>
                            {idea.trending ? '🔥 Trending' : '💡 Evergreen'}
                          </span>
                        </div>
                        <p className="text-[13px] leading-[1.55] line-clamp-3 flex-1" style={{ color: '#1A1A2E' }}>{idea.topic}</p>
                        {idea.whyNow && (
                          <p className="text-[10px] leading-snug mt-1.5 line-clamp-2" style={{ color: '#6B7280' }}>
                            <span className="font-semibold">Why now:</span> {idea.whyNow}
                          </p>
                        )}
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between border-t flex-shrink-0" style={{ borderColor: '#E0E0E0' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-medium select-none" style={{ color: '#6B7280' }}>👍 Like</span>
                          <span className="text-[11px] font-medium select-none" style={{ color: '#6B7280' }}>💬</span>
                        </div>
                        <button onClick={() => handleIdeaSelect(idea.topic)}
                          className="text-[11px] font-semibold text-white px-3 py-1 rounded-full transition-all hover:brightness-110 active:scale-95 flex-shrink-0"
                          style={{ background: '#0A66C2' }}>
                          Use idea →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : activeFlow === 'write' ? (

            /* ── WRITE A POST ──────────────────────────────────────────── */
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[12px] font-bold text-brand-dark">Write a post</span>
                <button onClick={closeActionPanel} aria-label="Close panel"
                  className="p-1 rounded-lg hover:bg-[rgba(124,92,252,0.06)] transition-colors text-brand-muted hover:text-brand-purple">
                  <X size={15} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[14px] font-semibold text-brand-dark mb-1">What's this post about?</p>
                  <p className="text-[12px] text-brand-muted mb-3 leading-relaxed">Give me a topic, idea, or perspective you want to share. The more specific, the better.</p>
                  <textarea
                    value={writeTopic}
                    onChange={e => setWriteTopic(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleWriteGenerate(); } }}
                    placeholder="e.g. Why most B2B content fails, lessons from 100 customer calls, how I grew my newsletter to 10k…"
                    className="input !text-[13px] !min-h-[110px] !resize-none w-full !leading-relaxed"
                    autoFocus
                  />
                  <p className="text-[10px] text-brand-muted mt-1.5">⌘ Enter to generate</p>
                </div>
                {nudge && !nudgeDismissed && (
                  <div className={`rounded-xl border p-3 flex items-start gap-2.5 transition-colors ${
                    nudgeApplied ? 'border-brand-purple/30 bg-[rgba(124,92,252,0.07)]' : 'border-[rgba(124,92,252,0.15)] bg-[rgba(124,92,252,0.03)]'
                  }`}>
                    <Lightbulb size={14} className="text-brand-purple flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-brand-dark leading-relaxed">{nudge.text}</p>
                      <button onClick={() => setNudgeApplied(a => !a)}
                        className={`text-[11px] font-semibold mt-1.5 transition-colors ${nudgeApplied ? 'text-brand-purple' : 'text-brand-muted hover:text-brand-purple'}`}>
                        {nudgeApplied ? '✓ Will apply to this post' : 'Yes, try it →'}
                      </button>
                    </div>
                    <button onClick={() => setNudgeDismissed(true)} aria-label="Dismiss suggestion"
                      className="text-brand-muted hover:text-brand-purple flex-shrink-0 p-0.5">
                      <X size={13} />
                    </button>
                  </div>
                )}
                {contentType === 'linkedin-post' && (
                  <LengthSelector value={contentLength} onChange={setContentLength} />
                )}
                <div>
                  <p className="text-[12px] font-semibold text-brand-dark mb-2">Angle <span className="text-brand-muted font-normal">(optional, up to 3)</span></p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Angle tags">
                    {ANGLE_TAGS.map(tag => (
                      <button key={tag} type="button" onClick={() => toggleAngleTag(tag)} aria-pressed={angleTags.includes(tag)}
                        className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                          angleTags.includes(tag)
                            ? 'border-brand-purple bg-[rgba(124,92,252,0.08)] text-brand-purple'
                            : 'border-[rgba(0,0,0,0.08)] text-brand-muted hover:border-brand-purple/40 hover:text-brand-purple'
                        }`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-brand-dark mb-2">Structure <span className="text-brand-muted font-normal">(optional)</span></p>
                  <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Structure framework">
                    {STRUCTURE_TAGS.map(s => (
                      <button key={s.id} type="button" role="radio" aria-checked={structureTag === s.id} title={s.desc}
                        onClick={() => setStructureTag(prev => prev === s.id ? null : s.id)}
                        className={`text-[11px] font-bold py-1.5 rounded-lg border transition-colors ${
                          structureTag === s.id
                            ? 'border-brand-purple bg-[rgba(124,92,252,0.08)] text-brand-purple'
                            : 'border-[rgba(0,0,0,0.08)] text-brand-muted hover:border-brand-purple/40 hover:text-brand-purple'
                        }`}>
                        {s.id}
                      </button>
                    ))}
                  </div>
                  {structureTag && <p className="text-[10px] text-brand-muted mt-1.5">{STRUCTURE_TAGS.find(s => s.id === structureTag)?.desc}</p>}
                </div>
                <button onClick={handleWriteGenerate} disabled={!writeTopic.trim() || generating}
                  className="btn-primary w-full !py-3 text-sm" aria-live="polite">
                  {generating
                    ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                    : <><Sparkles size={14} /> Generate post</>}
                </button>
                {generating && generationStage && (
                  <p className="text-[11px] text-brand-muted text-center mt-2 animate-fadeIn" aria-live="polite">{generationStage}</p>
                )}
                {error && (
                  <div className="mt-3 p-3 rounded-xl bg-[rgba(239,68,68,0.06)] border border-red-100 text-center" role="alert" aria-live="assertive">
                    <p className="text-[12px] text-red-600 font-medium mb-2">{error}</p>
                    <button onClick={() => handleGenerate(lastTopicAttempt || writeTopic)}
                      className="text-[11px] font-semibold text-brand-purple hover:underline">
                      Try again
                    </button>
                  </div>
                )}
              </div>
            </div>

          ) : activeFlow === 'repurpose' ? (

            /* ── REPURPOSE ─────────────────────────────────────────────── */
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[12px] font-bold text-brand-dark">Repurpose content</span>
                <button onClick={closeActionPanel} aria-label="Close panel"
                  className="p-1 rounded-lg hover:bg-[rgba(124,92,252,0.06)] transition-colors text-brand-muted hover:text-brand-purple">
                  <X size={15} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[14px] font-semibold text-brand-dark mb-1">Paste content to repurpose</p>
                  <p className="text-[12px] text-brand-muted mb-3 leading-relaxed">Article, newsletter, transcript, tweet thread — I'll rewrite it as a {CONTENT_TYPES.find(c => c.id === contentType)?.label || 'LinkedIn Post'} in your voice.</p>
                  <textarea
                    value={repurposeText}
                    onChange={e => { setRepurposeText(e.target.value); if (urlFetchState !== 'idle') setUrlFetchState('idle'); }}
                    onBlur={e => tryFetchUrl(e.target.value)}
                    placeholder="Paste an article, URL, newsletter, transcript, or thread…"
                    className="input !text-[13px] !min-h-[180px] !resize-none w-full !leading-relaxed"
                    autoFocus
                  />
                  {urlFetchState !== 'idle' && (
                    <p className={`text-[11px] mt-1.5 flex items-center gap-1.5 ${urlFetchState === 'error' ? 'text-red-500' : urlFetchState === 'fetching' ? 'text-brand-muted' : 'text-brand-teal'}`} aria-live="polite">
                      {urlFetchState === 'fetching' && <Loader2 size={11} className="animate-spin" />}
                      {urlFetchState === 'loaded' && <Check size={11} />}
                      {urlFetchMessage}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[12px] font-semibold text-brand-dark mb-2">Transform mode</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'voice' as const, label: 'In my voice', desc: 'Reframe as my take' },
                      { id: 'pattern' as const, label: 'Extract pattern', desc: 'Reuse the structure' },
                      { id: 'reaction' as const, label: 'My reaction', desc: 'Build on my opinion' },
                    ].map(m => (
                      <button key={m.id} type="button" onClick={() => setRepurposeMode(m.id)}
                        className={`text-left rounded-xl border p-2.5 transition-all ${
                          repurposeMode === m.id ? 'border-brand-purple bg-[rgba(124,92,252,0.06)]' : 'border-[rgba(0,0,0,0.08)] hover:border-brand-purple/40'
                        }`}>
                        <div className="text-[11px] font-bold text-brand-dark">{m.label}</div>
                        <div className="text-[9.5px] text-brand-muted mt-0.5 leading-snug">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {repurposeMode === 'reaction' && (
                  <div>
                    <label className="text-[12px] font-semibold text-brand-dark mb-1.5 block">What's your take on this?</label>
                    <textarea
                      value={userReaction}
                      onChange={e => setUserReaction(e.target.value)}
                      placeholder="e.g. I actually disagree — here's why…"
                      className="input !text-[13px] !min-h-[70px] !resize-none w-full !leading-relaxed"
                    />
                  </div>
                )}

                {contentType === 'linkedin-post' && (
                  <LengthSelector value={contentLength} onChange={setContentLength} />
                )}
                <button onClick={handleRepurpose} disabled={!repurposeText.trim() || repurposing || (repurposeMode === 'reaction' && !userReaction.trim())}
                  className="btn-primary w-full !py-3 text-sm" aria-live="polite">
                  {repurposing
                    ? <><Loader2 size={14} className="animate-spin" /> Repurposing…</>
                    : <><Scissors size={14} /> Repurpose this</>}
                </button>
                {repurposing && generationStage && (
                  <p className="text-[11px] text-brand-muted text-center mt-2 animate-fadeIn" aria-live="polite">{generationStage}</p>
                )}
                {error && (
                  <div className="mt-3 p-3 rounded-xl bg-[rgba(239,68,68,0.06)] border border-red-100 text-center" role="alert" aria-live="assertive">
                    <p className="text-[12px] text-red-600 font-medium mb-2">{error}</p>
                    <button onClick={handleRepurpose} className="text-[11px] font-semibold text-brand-purple hover:underline">
                      Try again
                    </button>
                  </div>
                )}
              </div>
            </div>

          ) : (

            /* ── COMPOSER (+ optional improve strip) ───────────────────── */
            <div className="flex-1 min-h-0 overflow-y-auto">

              {activeFlow === 'improve' && (
                <div className="px-5 pt-4 pb-3.5 border-b border-[rgba(124,92,252,0.1)] bg-[rgba(124,92,252,0.025)]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold text-brand-dark">How would you like to improve it?</span>
                    <button onClick={closeActionPanel}
                      className="w-5 h-5 rounded-md hover:bg-[rgba(124,92,252,0.08)] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {IMPROVE_CHIPS.map(s => (
                      <button key={s} onClick={() => handleImproveChip(s)}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-[rgba(124,92,252,0.2)] text-brand-purple hover:bg-[rgba(124,92,252,0.08)] transition-colors font-medium">
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-brand-muted">Or type a custom instruction in the chat below ↓</p>
                </div>
              )}

              {/* Edit / Preview toggle */}
              <div className="px-5 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-1 bg-[rgba(0,0,0,0.03)] rounded-full p-0.5" role="tablist" aria-label="Composer view">
                  <button role="tab" aria-selected={composerView === 'edit'} onClick={() => setComposerView('edit')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
                      composerView === 'edit' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-muted hover:text-brand-dark'
                    }`}>
                    <PenLine size={12} /> Edit
                  </button>
                  <button role="tab" aria-selected={composerView === 'preview'} onClick={() => setComposerView('preview')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
                      composerView === 'preview' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-muted hover:text-brand-dark'
                    }`}>
                    <Eye size={12} /> Preview
                  </button>
                </div>
                {composerView === 'preview' && (
                  <div className="flex items-center gap-1 bg-[rgba(0,0,0,0.03)] rounded-full p-0.5">
                    <button onClick={() => setPreviewDevice('desktop')} aria-label="Preview as desktop" aria-pressed={previewDevice === 'desktop'}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        previewDevice === 'desktop' ? 'bg-white text-brand-purple shadow-sm' : 'text-brand-muted hover:text-brand-dark'
                      }`}>
                      <Monitor size={13} />
                    </button>
                    <button onClick={() => setPreviewDevice('mobile')} aria-label="Preview as mobile" aria-pressed={previewDevice === 'mobile'}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        previewDevice === 'mobile' ? 'bg-white text-brand-purple shadow-sm' : 'text-brand-muted hover:text-brand-dark'
                      }`}>
                      <Smartphone size={13} />
                    </button>
                  </div>
                )}
              </div>

              {composerView === 'edit' && (
                <div className="px-5 pt-2 flex items-center gap-1.5">
                  <div className="relative" ref={richTextRef}>
                    <button onClick={() => { setSnippetsOpen(false); setRichTextOpen(o => !o); }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-brand-muted hover:text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors flex items-center gap-1">
                      𝐀𝐚 Rich text
                    </button>
                    {richTextOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-brand-md border border-[rgba(124,92,252,0.08)] p-1.5 z-30 animate-fadeIn">
                        {RICH_TEXT_STYLES.map(s => (
                          <button key={s.id} onClick={() => applyRichTextStyle(s.id)}
                            className="w-full text-left px-3 py-2 rounded-xl text-[13px] text-brand-dark hover:bg-[rgba(124,92,252,0.06)] transition-colors flex items-center justify-between gap-2">
                            <span className="truncate">{s.apply('Sample Text')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={snippetsRef}>
                    <button onClick={() => { setRichTextOpen(false); setSnippetsOpen(o => !o); }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-brand-muted hover:text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors flex items-center gap-1">
                      <FileText size={12} /> Snippets
                    </button>
                    {snippetsOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto bg-white rounded-2xl shadow-brand-md border border-[rgba(124,92,252,0.08)] p-2.5 z-30 animate-fadeIn">
                        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-[rgba(0,0,0,0.05)]">
                          <input type="text" value={newSnippetLabel} onChange={e => setNewSnippetLabel(e.target.value)}
                            placeholder="Save current draft as…" className="input !text-[11px] !py-1.5 flex-1" />
                          <button onClick={saveCurrentAsSnippet} disabled={!composerContent.trim() || !newSnippetLabel.trim()}
                            className="text-[11px] font-semibold text-brand-purple disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 px-1">
                            Save
                          </button>
                        </div>
                        {snippets.length === 0 ? (
                          <p className="text-[11px] text-brand-muted px-1 py-2">No snippets yet — write a hook, CTA, or signature once and reuse it everywhere.</p>
                        ) : (
                          snippets.map(sn => (
                            <div key={sn.id} className="group flex items-start gap-1.5 px-1.5 py-1.5 rounded-xl hover:bg-[rgba(124,92,252,0.04)]">
                              <button onClick={() => insertSnippet(sn.content)} className="flex-1 min-w-0 text-left">
                                <div className="text-[11px] font-semibold text-brand-dark truncate">{sn.label}</div>
                                <div className="text-[10px] text-brand-muted line-clamp-1">{sn.content}</div>
                              </button>
                              <button onClick={() => deleteSnippet(sn.id)} aria-label={`Delete snippet ${sn.label}`}
                                className="opacity-0 group-hover:opacity-100 text-brand-muted hover:text-red-500 transition-opacity flex-shrink-0 p-0.5">
                                <X size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {!pollData && (
                    <button onClick={() => setPollData({ question: '', options: ['', ''], duration: '1 week' })}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-brand-muted hover:text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors flex items-center gap-1">
                      📊 Poll
                    </button>
                  )}
                </div>
              )}

              {composerView === 'edit' && pollData && (
                <div className="mx-5 mt-2 p-3.5 rounded-2xl border border-[rgba(124,92,252,0.15)] bg-[rgba(124,92,252,0.03)]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold text-brand-dark flex items-center gap-1.5">📊 Poll</span>
                    <button onClick={() => setPollData(null)} aria-label="Remove poll" className="text-brand-muted hover:text-red-500 p-0.5">
                      <X size={13} />
                    </button>
                  </div>
                  <input type="text" value={pollData.question} onChange={e => setPollData(p => p && { ...p, question: e.target.value })}
                    placeholder="Ask a question…" maxLength={140}
                    className="input !text-[13px] !py-2 w-full mb-2" />
                  <div className="space-y-1.5 mb-2">
                    {pollData.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input type="text" value={opt}
                          onChange={e => setPollData(p => p && { ...p, options: p.options.map((o, oi) => oi === i ? e.target.value : o) })}
                          placeholder={`Option ${i + 1}`} maxLength={30}
                          className="input !text-[12px] !py-1.5 flex-1" />
                        {pollData.options.length > 2 && (
                          <button onClick={() => setPollData(p => p && { ...p, options: p.options.filter((_, oi) => oi !== i) })}
                            aria-label={`Remove option ${i + 1}`} className="text-brand-muted hover:text-red-500 p-1 flex-shrink-0">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    {pollData.options.length < 4 ? (
                      <button onClick={() => setPollData(p => p && { ...p, options: [...p.options, ''] })}
                        className="text-[11px] font-semibold text-brand-purple hover:underline">
                        + Add option
                      </button>
                    ) : <span />}
                    <select value={pollData.duration} onChange={e => setPollData(p => p && { ...p, duration: e.target.value })}
                      className="text-[11px] font-semibold text-brand-muted bg-transparent border-0 focus:outline-none cursor-pointer">
                      {['1 day', '3 days', '1 week', '2 weeks'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <p className="text-[10px] text-brand-muted mt-2 leading-relaxed">
                    LinkedIn's public API doesn't support publishing polls yet — this shows up in your preview as a draft aid. Post it manually on LinkedIn, or remove it to publish the rest through Eclatale.
                  </p>
                </div>
              )}

              {composerView === 'preview' ? (
                <div className="px-5 pt-4 pb-6">
                  <LinkedInPreviewCard
                    content={composerContent}
                    imageUrl={attachedImage}
                    userName={userName}
                    userRole={userRole}
                    userAvatar={userAvatar}
                    userInitials={userInitials}
                    device={previewDevice}
                    poll={pollData}
                  />
                </div>
              ) : (
              <>
              <div className="px-5 pt-3 pb-2">
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
                    ref={composerTextareaRef}
                    value={composerContent}
                    onChange={e => setComposerContent(e.target.value)}
                    onKeyDown={e => {
                      // Content creators use Tab to insert indentation, not to move focus.
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const el = e.currentTarget;
                        const start = el.selectionStart, end = el.selectionEnd;
                        const next = composerContent.slice(0, start) + '  ' + composerContent.slice(end);
                        setComposerContent(next);
                        requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
                      }
                    }}
                    placeholder={composerPlaceholder}
                    className="w-full resize-none border-0 bg-transparent text-brand-dark text-[15px] leading-[1.75] focus:outline-none placeholder:text-[#9CA3AF] font-[inherit] min-h-[220px] max-h-[520px]"
                    style={{ caretColor: '#7C5CFC' }}
                  />
                )}
              </div>


              {/* Visual attachment */}
              <div className="px-5 pb-5">
                {attachedImage ? (
                  <div className="relative rounded-xl overflow-hidden group">
                    <img src={attachedImage} alt="Post visual" loading="lazy" className="w-full rounded-xl object-cover max-h-[240px]" />
                    {showTextOverlay && composerContent && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-10 pb-4 rounded-b-xl pointer-events-none">
                        <p className="text-white text-[13px] font-semibold leading-snug line-clamp-2">
                          {(composerContent.split('\n').find(l => l.trim()) || '').substring(0, 100)}
                        </p>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity flex gap-1.5">
                      <button onClick={() => setShowTextOverlay(o => !o)}
                        className="px-2.5 py-1.5 rounded-lg bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm flex items-center gap-1 min-h-[32px]">
                        {showTextOverlay ? <EyeOff size={9} /> : <Eye size={9} />} Text
                      </button>
                      <button onClick={openVisualModal}
                        className="px-2.5 py-1.5 rounded-lg bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm min-h-[32px]">
                        Change
                      </button>
                      <button onClick={() => setAttachedImage(null)} aria-label="Remove visual"
                        className="w-8 h-8 rounded-lg bg-black/60 text-white flex items-center justify-center backdrop-blur-sm">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => composerContent ? openVisualModal() : undefined}
                    disabled={!composerContent}
                    className={`w-full border-2 border-dashed rounded-xl py-3 flex items-center justify-center gap-2 transition-all text-[12px] font-medium ${
                      composerContent
                        ? 'border-[rgba(124,92,252,0.2)] text-brand-muted hover:border-brand-purple/40 hover:text-brand-purple cursor-pointer'
                        : 'border-[rgba(0,0,0,0.06)] text-[#9CA3AF] cursor-not-allowed'
                    }`}>
                    <Image size={14} />
                    Add visual
                  </button>
                )}
              </div>
              </>
              )}
            </div>
          )}

          {/* Char counter + action bar — hidden during write / repurpose / ideas flows */}
          {!ideasView && activeFlow !== 'write' && activeFlow !== 'repurpose' && (
            <>
              <div className="flex-shrink-0 px-5 py-2.5 flex items-center gap-3 border-t border-[rgba(124,92,252,0.04)] bg-white/20">
                {autosaveState !== 'idle' && (
                  <span className="text-[10px] text-brand-muted flex items-center gap-1 flex-shrink-0 animate-fadeIn" aria-live="polite">
                    {autosaveState === 'saving'
                      ? <><Loader2 size={9} className="animate-spin" /> Saving…</>
                      : <><Check size={9} className="text-brand-teal" /> Saved</>}
                  </span>
                )}
                <div className="flex-1 h-1 rounded-full bg-[rgba(124,92,252,0.06)]">
                  <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${charPct}%` }} />
                </div>
                <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${charColor}`}>
                  {charLen.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
                </span>
                {contentHistory.length > 0 && (
                  <button onClick={handleUndo} aria-label="Undo" className="text-[11px] text-brand-purple flex items-center gap-1 hover:underline flex-shrink-0 font-medium">
                    <Undo2 size={11} /> Undo
                  </button>
                )}
                {redoStack.length > 0 && (
                  <button onClick={handleRedo} aria-label="Redo" className="text-[11px] text-brand-purple flex items-center gap-1 hover:underline flex-shrink-0 font-medium">
                    <Redo2 size={11} /> Redo
                  </button>
                )}
              </div>

              {/* Content Confidence — single compact line by default, expands to the full score card on click */}
              {composerContent && (showAuthLoading || authScore) && (
                <div className="flex-shrink-0 px-5 pb-2.5">
                  {showAuthLoading && !authScore ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-brand-muted">
                      <span>Checking confidence</span>
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 rounded-full bg-brand-purple/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  ) : authScore && (
                    <div>
                      <button onClick={() => setAuthScoreExpanded(o => !o)}
                        className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
                        style={{ color: scoreColor(authScore.overallScore) }}>
                        Confidence: {authScore.overallScore} {authScore.overallScore >= 80 ? '✓' : authScore.overallScore >= 60 ? '⚠' : '✗'}
                        <ChevronDown size={11} className={`transition-transform ${authScoreExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {authScoreExpanded && (
                        <div className="card !p-6 mt-2 animate-fadeIn">
                          <div className="flex items-start gap-4">
                            <AuthenticityRing score={authScore.overallScore} />
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[11px] font-bold text-brand-dark uppercase tracking-wide">Content Confidence Score</span>
                                <span title="This score helps you post with confidence. Most great LinkedIn posts score 65-80. Authentic human voices never score 100 — and they shouldn't."
                                  className="w-3.5 h-3.5 rounded-full bg-[rgba(124,92,252,0.1)] text-brand-purple text-[9px] font-bold flex items-center justify-center cursor-help flex-shrink-0">?</span>
                              </div>
                              <p className="text-[12px] font-semibold" style={{ color: scoreColor(authScore.overallScore) }}>
                                {confidenceLabel(authScore.overallScore)}
                                {getActionableItems(authScore).length > 0 && (
                                  <span className="text-brand-muted font-normal"> · {getActionableItems(authScore).length} optional improvement{getActionableItems(authScore).length === 1 ? '' : 's'}</span>
                                )}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-brand-dark pt-1">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.accuracy.score) }} />
                                {authScore.accuracy.isOpinionBased ? (
                                  <span>✓ Opinion-based — no facts to verify</span>
                                ) : authScore.accuracy.claims.some(c => c.status === 'Unverifiable' || c.status === 'False') ? (
                                  <span>⚠ {authScore.accuracy.claims.filter(c => c.status === 'Unverifiable' || c.status === 'False').length} claim{authScore.accuracy.claims.filter(c => c.status === 'Unverifiable' || c.status === 'False').length === 1 ? '' : 's'} need{authScore.accuracy.claims.filter(c => c.status === 'Unverifiable' || c.status === 'False').length === 1 ? 's' : ''} a source</span>
                                ) : (
                                  <span>✓ {authScore.accuracy.claims.filter(c => c.status === 'Verified').length || 'No'} fact{authScore.accuracy.claims.filter(c => c.status === 'Verified').length === 1 ? '' : 's'} verified</span>
                                )}
                              </div>
                              {!authScore.accuracy.isOpinionBased && authScore.accuracy.claims.filter(c => c.status === 'Verified' && c.sourceUrl).length > 0 && (
                                <div className="flex flex-wrap gap-2 pl-3.5">
                                  {authScore.accuracy.claims.filter(c => c.status === 'Verified' && c.sourceUrl).map((c, i) => (
                                    <a key={i} href={c.sourceUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-[10px] text-brand-purple hover:underline">Source {i + 1} ↗</a>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-[11px] text-brand-dark">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.freshness.score) }} />
                                {authScore.freshness.score >= 70 ? (
                                  <span>✓ Fresh angle</span>
                                ) : (
                                  <span>Fresh angle available ↗ {authScore.freshness.suggestion}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-brand-dark">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.voice.score) }} />
                                {authScore.voice.score >= 75 ? (
                                  <span>✓ Sounds like you</span>
                                ) : (
                                  <span>{authScore.voice.specificMismatches[0] || 'A bit off from your usual voice'}{authScore.voice.suggestion ? ` — ${authScore.voice.suggestion}` : ''}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {authScore.overallScore < 70 && authScore.topSuggestion && (
                            <div className="mt-3 pt-3 border-t border-[rgba(124,92,252,0.08)] flex items-center justify-between gap-3">
                              <p className="text-[11px] text-brand-muted leading-relaxed">Tip: {authScore.topSuggestion}</p>
                              <button onClick={() => handleFixSuggestion(authScore.topSuggestion)}
                                className="text-[11px] font-semibold text-brand-purple hover:underline flex-shrink-0 whitespace-nowrap">
                                Fix this →
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Supporting References — directly below the score card, same collapse/expand pattern */}
                      <div className="mt-2">
                      <button onClick={() => setReferencesExpanded(o => !o)}
                        className="text-[11px] font-semibold flex items-center gap-1.5 text-brand-purple hover:underline">
                        📎 Supporting References
                        {authScore.references.references.length > 0 && <span className="text-brand-muted font-normal">({authScore.references.references.length})</span>}
                        <ChevronDown size={11} className={`transition-transform ${referencesExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {referencesExpanded && (
                        <div className="card !p-6 mt-2 animate-fadeIn">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold text-brand-dark uppercase tracking-wide">Supporting References</span>
                            <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[9px] !py-1">Powered by live web search</span>
                          </div>
                          {authScore.references.references.length === 0 ? (
                            <p className="text-[11px] text-brand-muted leading-relaxed">No supporting references found for this angle — consider adding your own source or data point to strengthen credibility.</p>
                          ) : (
                            <div className="space-y-2.5">
                              {authScore.references.references.map((ref, i) => (
                                <div key={i} className="rounded-xl border border-[rgba(124,92,252,0.08)] p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-brand-dark">{ref.publication}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                      ref.type === 'news' ? 'bg-[rgba(17,138,178,0.1)] text-brand-blue'
                                      : ref.type === 'research' ? 'bg-[rgba(124,92,252,0.1)] text-brand-purple'
                                      : ref.type === 'data' ? 'bg-[rgba(6,214,160,0.1)] text-brand-teal'
                                      : 'bg-[rgba(255,107,53,0.1)] text-brand-orange'
                                    }`}>{ref.type.charAt(0).toUpperCase() + ref.type.slice(1)}</span>
                                    {ref.publishedDate && <span className="text-[10px] text-brand-muted">{ref.publishedDate}</span>}
                                  </div>
                                  <a href={ref.url} target="_blank" rel="noopener noreferrer"
                                    className="text-[12px] font-semibold text-brand-dark hover:text-brand-purple hover:underline block mb-1">
                                    {ref.title}
                                  </a>
                                  <p className="text-[11px] text-brand-muted leading-relaxed mb-2">{ref.relevance}</p>
                                  <div className="flex items-center gap-3">
                                    <button onClick={() => handleUseReference(ref)} disabled={refining && usingReferenceUrl === ref.url}
                                      className="text-[11px] font-semibold text-brand-purple hover:underline disabled:opacity-50">
                                      {usingReferenceUrl === ref.url ? 'Adding…' : 'Use in post →'}
                                    </button>
                                    <button onClick={() => handleCopyReferenceLink(ref.url)}
                                      className="text-[10px] text-brand-muted hover:text-brand-purple flex items-center gap-1">
                                      {copiedRefUrl === ref.url ? <><Check size={10} className="text-brand-teal" /> Copied</> : <><Copy size={10} /> Copy link</>}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-shrink-0 px-3 sm:px-5 py-3 safe-bottom border-t border-[rgba(124,92,252,0.06)] bg-white/40 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
                <button onClick={handleCopy} disabled={!composerContent} aria-label={copied ? 'Copied' : 'Copy'}
                  className="btn-ghost text-xs !py-2 !px-2.5 sm:!px-3 disabled:opacity-40 flex-shrink-0">
                  {copied ? <><Check size={12} className="text-brand-teal" /> <span className="hidden sm:inline">Copied</span></> : <><Copy size={12} /> <span className="hidden sm:inline">Copy</span></>}
                </button>
                <button onClick={handleSaveDraft} disabled={!composerContent} aria-label={saved ? 'Saved' : 'Save draft'}
                  className="btn-ghost text-xs !py-2 !px-2.5 sm:!px-3 disabled:opacity-40 flex-shrink-0">
                  {saved ? <><Check size={12} className="text-brand-teal" /> <span className="hidden sm:inline">Saved</span></> : <><FileText size={12} /> <span className="hidden sm:inline">Save Draft</span></>}
                </button>
                <div className="relative flex-shrink-0" ref={scheduleRef}>
                  <button disabled={!composerContent} onClick={openSchedulePanel}
                    aria-label={scheduleConfirmedFor ? `Scheduled for ${new Date(scheduleConfirmedFor).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Schedule'}
                    className="btn-ghost text-xs !py-2 !px-2.5 sm:!px-3 disabled:opacity-40">
                    <Calendar size={12} /> <span className="hidden sm:inline">
                      {scheduleConfirmedFor ? new Date(scheduleConfirmedFor).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'Schedule'}
                    </span>
                  </button>
                  {scheduleOpen && (
                    <div className="fixed left-4 right-4 bottom-20 sm:left-auto sm:right-4 sm:w-80 bg-white rounded-2xl modal-shadow border border-[rgba(124,92,252,0.1)] p-4 z-50 animate-fadeIn">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar size={12} className="text-brand-purple" />
                        <span className="text-[11px] font-bold text-brand-dark uppercase tracking-widest">Schedule</span>
                      </div>
                      {bestTime && bestTime.recommendedDays.length > 0 && (
                        <p className="text-[11px] text-brand-purple bg-[rgba(124,92,252,0.05)] rounded-lg px-2.5 py-2 mb-3 leading-relaxed">
                          Best time ({bestTime.basedOn}): <span className="font-semibold">{bestTime.recommendedDays[0]}</span> at <span className="font-semibold">{bestTime.recommendedTimes[0]}</span> — pre-filled below.
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-1 block">Date</label>
                          <input type="date" value={scheduleDate}
                            min={new Date().toISOString().slice(0, 10)}
                            max={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                            onChange={e => { setScheduleDate(e.target.value); setScheduleConfirmedFor(null); }}
                            className="input !text-sm !py-2" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-1 block">Time</label>
                          <input type="time" step={1800} value={scheduleTime}
                            onChange={e => { setScheduleTime(e.target.value); setScheduleConfirmedFor(null); }}
                            className="input !text-sm !py-2" />
                        </div>
                      </div>
                      <p className="text-[10px] text-brand-muted mb-1">Your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p>
                      <p className="text-[10px] text-brand-muted mb-3">
                        {scheduleSlots.length > 0 ? 'Prefilled from your ' : 'Set '}
                        <a href="/schedule" className="text-brand-purple hover:underline">posting times</a>
                        {scheduleSlots.length > 0 ? '.' : ' to auto-fill this next time.'}
                      </p>
                      {scheduleErr && <p className="text-[11px] text-red-500 mb-2" role="alert">{scheduleErr}</p>}
                      <button
                        onClick={handleSchedulePost}
                        disabled={!scheduleDate || !scheduleTime || scheduling}
                        className="btn-primary w-full text-xs !py-2 disabled:opacity-40">
                        {scheduling ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {scheduling ? 'Scheduling…' : `Schedule for ${scheduleDate && scheduleTime ? new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '…'}`}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1" />
                <div className="flex flex-col items-end gap-1">
                  <button onClick={handlePublish}
                    disabled={!composerContent || publishing || !!publishResult?.success || !!pollData}
                    title={pollData ? "Remove the poll to publish — LinkedIn's public API doesn't support publishing polls yet" : undefined}
                    className="btn-primary !py-2.5 !px-5 text-xs disabled:opacity-40 shadow-[0_2px_12px_rgba(124,92,252,0.25)]">
                    {publishing ? <><Loader2 size={13} className="animate-spin" /> Publishing…</>
                      : publishResult?.success ? <><Check size={13} /> Published!</>
                      : <><Send size={13} /> Post to LinkedIn</>}
                  </button>
                  {pollData && !publishResult?.success && (
                    <p className="text-[10px] text-amber-600 text-right max-w-[180px] leading-snug">Remove the poll to publish, or post it manually on LinkedIn</p>
                  )}
                  {authScore && !publishResult?.success && authScore.overallScore < 80 && (
                    <div className="relative" ref={postSuggestionsRef}>
                      <button onClick={() => setPostSuggestionsOpen(o => !o)}
                        className="text-[10px] font-semibold flex items-center gap-1.5 hover:underline">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.overallScore) }} />
                        {authScore.overallScore >= 60 ? (
                          <span className="text-amber-500">{getActionableItems(authScore).length} suggestion{getActionableItems(authScore).length === 1 ? '' : 's'} available</span>
                        ) : (
                          <span className="text-red-500">Review before posting — see details</span>
                        )}
                      </button>
                      {postSuggestionsOpen && (
                        <div className="fixed left-4 right-4 bottom-20 sm:absolute sm:bottom-full sm:right-0 sm:left-auto sm:mb-2 sm:w-72 bg-white rounded-2xl modal-shadow border border-[rgba(124,92,252,0.1)] p-3.5 z-50 animate-fadeIn space-y-2.5">
                          {getActionableItems(authScore).slice(0, 2).map((item, i) => (
                            <div key={i}>
                              <span className="text-[10px] font-bold text-brand-dark uppercase tracking-wide">{item.label}</span>
                              <p className="text-[11px] text-brand-muted leading-relaxed">{item.text}</p>
                            </div>
                          ))}
                          <button onClick={() => { handleFixSuggestion(authScore.topSuggestion); setPostSuggestionsOpen(false); }}
                            className="text-[11px] font-semibold text-brand-purple hover:underline">
                            Fix this →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {!publishResult?.success && (
                    referenceUsed ? (
                      <span className="text-[10px] font-semibold text-brand-teal">✓ Source included</span>
                    ) : authScore && authScore.references.references.length > 0 && !referenceHintDismissed ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setReferencesExpanded(true)}
                          className="text-[10px] font-semibold text-brand-purple hover:underline">
                          💡 Add a source to boost credibility · See references ↑
                        </button>
                        <button onClick={() => setReferenceHintDismissed(true)} aria-label="Dismiss" className="text-brand-muted hover:text-brand-dark">
                          <X size={10} />
                        </button>
                      </div>
                    ) : null
                  )}
                </div>
              </div>

              {composerContent && bestTime && bestTime.recommendedDays.length > 0 && (
                <button onClick={() => setScheduleOpen(true)}
                  className="flex-shrink-0 mx-5 mb-3 flex items-center gap-2 text-left w-[calc(100%-2.5rem)] rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.08)] px-3 py-2 hover:border-brand-purple/25 transition-all">
                  <span className="text-sm">📅</span>
                  <span className="text-[11px] text-brand-dark leading-snug">
                    <span className="font-semibold">Best time to post:</span> {bestTime.recommendedDays[0]} {bestTime.recommendedTimes[0]}
                    <span className="text-brand-muted"> · tap to schedule</span>
                  </span>
                </button>
              )}

              {publishResult?.error && (
                <div className="flex-shrink-0 mx-5 mb-3 card !bg-red-50 !border-red-100 p-6 text-xs text-red-600 font-medium text-center animate-shake">
                  {publishResult.error}
                </div>
              )}
              {publishResult?.success && (
                <div className="flex-shrink-0 mx-5 mb-3 card !bg-[rgba(6,214,160,0.06)] !border-brand-teal/20 p-6 text-xs text-brand-teal font-medium text-center animate-fadeIn flex items-center justify-center gap-2">
                  Published to LinkedIn!
                  {publishResult.urn && (
                    <a href={`https://www.linkedin.com/feed/update/${publishResult.urn}`} target="_blank" rel="noopener noreferrer"
                      className="underline flex items-center gap-1">
                      View post <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── VOICE PROFILE QUICK-EDIT SLIDE-OVER ─────────────────────────────── */}
        {voiceEditOpen && (
          <>
            <div className="absolute inset-0 z-40 bg-transparent" onClick={closeVoiceEdit} />
            <div className={`absolute inset-y-0 left-0 z-50 w-full sm:w-[400px] bg-white modal-shadow overflow-y-auto ${voiceEditClosing ? 'animate-slideOutLeft' : 'animate-slideInLeft'}`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(124,92,252,0.08)] sticky top-0 bg-white z-10">
                <span className="text-sm font-bold text-brand-dark">Your Voice Profile</span>
                <button onClick={closeVoiceEdit}
                  className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-[rgba(124,92,252,0.06)] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-5 space-y-6">
                {/* Communication styles */}
                <div>
                  <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-wide mb-3 block">Communication styles</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STYLES.map(s => {
                      const selected = editStyles.includes(s.id);
                      const disabled = !selected && editStyles.length >= 3;
                      return (
                        <button key={s.id} onClick={() => toggleEditStyle(s.id)} disabled={disabled}
                          className={`card !p-6 text-center transition-all ${selected ? '!border-brand-purple !shadow-brand-md' : disabled ? 'opacity-40' : 'card-hover'}`}>
                          <span className="text-lg block mb-1">{s.emoji}</span>
                          <span className="text-[11px] font-bold text-brand-dark block">{s.label}</span>
                          {selected && (
                            <div className="w-4 h-4 rounded-full gradient-primary flex items-center justify-center mx-auto mt-1.5">
                              <Check size={9} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Formality slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-wide">Formality</label>
                    <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-xs">{formalityLabel(editFormality)}</span>
                  </div>
                  <input type="range" min="0" max="100" value={editFormality}
                    onChange={e => setEditFormality(parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #7C5CFC ${editFormality}%, rgba(124,92,252,0.1) ${editFormality}%)` }} />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-brand-muted">Casual</span>
                    <span className="text-[10px] text-brand-muted">Formal</span>
                  </div>
                </div>

                {/* Expertise topic */}
                <div>
                  <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Expertise topic</label>
                  <input type="text" value={editExpertise} onChange={e => setEditExpertise(e.target.value)}
                    placeholder="e.g., Scaling B2B SaaS from $1M to $10M ARR" className="input !text-sm" />
                </div>

                {/* Voice match score */}
                <div className="card !p-6 flex items-center gap-3">
                  {loadingVoiceScore ? (
                    <Loader2 size={16} className="animate-spin text-brand-purple" />
                  ) : voiceMatchScore !== null ? (
                    <>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0"
                        style={{ background: voiceMatchScore >= 80 ? '#06D6A0' : voiceMatchScore >= 60 ? '#F59E0B' : '#EF4444' }}>
                        {voiceMatchScore}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-brand-dark">Voice Match Score</div>
                        <div className="text-[10px] text-brand-muted">How closely your posts match this profile</div>
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-brand-muted">Voice match score unavailable</span>
                  )}
                </div>

                <button onClick={handleSaveVoice} disabled={savingVoice || editStyles.length === 0}
                  className="btn-primary w-full !py-3 text-sm disabled:opacity-40">
                  {savingVoice ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save changes'}
                </button>

                <a href="/persona-setup" className="flex items-center justify-center gap-1 text-[11px] font-semibold text-brand-purple hover:underline">
                  Full voice profile <ArrowRight size={11} />
                </a>
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* ── VISUAL CREATION PANEL — bottom sheet on mobile, right-side drawer on desktop ── */}
      {visualModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-stretch justify-end animate-fadeIn" onClick={closeVisualModal}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-t-4xl sm:rounded-none sm:rounded-l-3xl modal-shadow w-full sm:w-[400px] sm:h-full max-h-[90vh] sm:max-h-none overflow-y-auto animate-fadeIn sm:animate-slideInRight">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[rgba(124,92,252,0.06)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl gradient-primary flex items-center justify-center">
                  <Image size={12} className="text-white" />
                </div>
                <span className="text-sm font-bold text-brand-dark">Add a visual</span>
              </div>
              <button onClick={closeVisualModal}
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-[rgba(124,92,252,0.06)] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 safe-bottom space-y-4">
              {/* Context from post */}
              <div>
                <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest mb-1.5 block">Post context (auto-filled)</label>
                <div className="text-[12px] text-brand-muted bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.08)] rounded-xl px-3 py-2.5 leading-relaxed max-h-16 overflow-hidden">
                  {composerContent.substring(0, 160)}{composerContent.length > 160 ? '…' : ''}
                </div>
              </div>

              {/* Style picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-brand-dark uppercase tracking-widest block">Visual style</label>
                  {!visualStyleAutoPicked && TONE_STYLE_SUGGESTION[tone] === visualStyle && (
                    <span className="text-[9px] text-brand-purple font-medium">Suggested for {tone} tone</span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {VISUAL_STYLES.map(s => (
                    <button key={s.id} onClick={() => { setVisualStyle(s.id); setVisualStyleAutoPicked(true); }}
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
              <p className="text-[10px] text-brand-muted text-center -mt-2">
                {generatingVisual ? 'Usually takes 8-12 seconds' : imageUsage ? `${imageUsage.used} of ${imageUsage.limit} images today` : 'Usually takes 8-12 seconds'}
              </p>

              {visualError && <p className="text-xs text-red-500 text-center">{visualError}</p>}

              {/* Preview */}
              {visualPreview && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={visualPreview} alt="Generated visual" loading="lazy" className="w-full rounded-xl object-cover" />
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
                    <button onClick={handleGenerateVisual} disabled={generatingVisual} aria-label="Regenerate visual"
                      className="btn-secondary !py-2.5 !px-3.5">
                      <RefreshCw size={13} />
                    </button>
                    <button onClick={handleDownloadVisual} aria-label="Download visual"
                      className="btn-secondary !py-2.5 !px-3.5 flex items-center">
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Voice updated toast */}
      {voiceToast && (
        <div className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] left-1/2 -translate-x-1/2 z-[60] bg-brand-dark text-white text-[12px] font-medium px-4 py-3 rounded-xl modal-shadow animate-fadeIn flex items-center gap-2 max-w-[calc(100vw-2rem)] sm:whitespace-nowrap sm:max-w-none">
          <Check size={14} className="text-brand-teal" />
          Voice updated — your next post will reflect these changes
        </div>
      )}

      {/* Unsaved draft recovery prompt */}
      {restorePrompt && (
        <div className="fixed inset-x-0 top-0 z-[65] flex justify-center px-4 pt-4 animate-fadeIn" role="alert" aria-live="assertive">
          <div className="card modal-shadow !rounded-2xl px-4 py-3 flex items-center gap-3 max-w-md w-full">
            <div className="w-8 h-8 rounded-full bg-[rgba(124,92,252,0.08)] flex items-center justify-center flex-shrink-0">
              <FileText size={14} className="text-brand-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-brand-dark">You have an unsaved draft</p>
              <p className="text-[11px] text-brand-muted truncate">{restorePrompt.content.slice(0, 60)}{restorePrompt.content.length > 60 ? '…' : ''}</p>
            </div>
            <button onClick={restoreDraft} className="text-[11px] font-semibold text-white gradient-primary rounded-full px-3 py-1.5 flex-shrink-0">
              Restore
            </button>
            <button onClick={dismissRestorePrompt} aria-label="Dismiss" className="text-brand-muted hover:text-brand-dark flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation — Ideas / Write / Repurpose / Improve */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[rgba(124,92,252,0.08)] shadow-[0_-2px_16px_rgba(0,0,0,0.06)] flex safe-bottom" style={{ height: 'calc(56px + env(safe-area-inset-bottom))' }}>
        {[
          { key: 'ideas', emoji: '💡', label: 'Ideas', active: ideasView, onClick: handleCardIdeas },
          { key: 'write', emoji: '✍️', label: 'Write', active: activeFlow === 'write', onClick: handleCardWrite },
          { key: 'repurpose', emoji: '♻️', label: 'Repurpose', active: activeFlow === 'repurpose', onClick: handleCardRepurpose },
          { key: 'improve', emoji: '⚡', label: 'Improve', active: activeFlow === 'improve', onClick: handleCardImprove },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={tab.onClick}
            aria-label={tab.label}
            aria-current={tab.active ? 'page' : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-1.5 min-h-[44px] relative"
          >
            <span className={`text-base leading-none ${tab.active ? '' : 'opacity-50'}`}>{tab.emoji}</span>
            <span className={`text-[10px] font-semibold ${tab.active ? 'gradient-text' : 'text-[#6B7280]'}`}>{tab.label}</span>
            {tab.active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full gradient-primary" />}
          </button>
        ))}
      </nav>

      {/* Keyboard shortcuts hint — desktop only */}
      <button
        onClick={() => setShortcutsOpen(true)}
        aria-label="Show keyboard shortcuts"
        className="hidden md:flex fixed bottom-3 left-3 z-30 items-center gap-1.5 text-[11px] text-brand-muted hover:text-brand-purple bg-white/80 backdrop-blur-sm border border-[rgba(124,92,252,0.1)] rounded-full px-3 py-1.5 transition-colors"
      >
        Press <kbd className="px-1.5 py-0.5 rounded bg-[rgba(124,92,252,0.08)] font-semibold">?</kbd> for keyboard shortcuts
      </button>

      {/* ── KEYBOARD SHORTCUTS PANEL ──────────────────────────────────────────── */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
          onClick={() => setShortcutsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
        >
          <div
            className="bg-white rounded-t-4xl sm:rounded-4xl modal-shadow w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[rgba(124,92,252,0.06)]">
              <span id="shortcuts-title" className="text-sm font-bold text-brand-dark">Keyboard shortcuts</span>
              <button onClick={() => setShortcutsOpen(false)} aria-label="Close"
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-[rgba(124,92,252,0.06)] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-1 safe-bottom">
              {[
                { keys: ['Ctrl', 'Enter'], label: 'Post to LinkedIn' },
                { keys: ['Ctrl', 'S'], label: 'Save draft' },
                { keys: ['Ctrl', 'G'], label: 'Generate post' },
                { keys: ['Ctrl', 'K'], label: 'Open Aria assistant' },
                { keys: ['Ctrl', 'Z'], label: 'Undo' },
                { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo' },
                { keys: ['Tab'], label: 'Insert indentation (in composer)' },
                { keys: ['Esc'], label: 'Close panel or dropdown' },
                { keys: ['?'], label: 'Show this panel' },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-sm text-brand-dark">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k, j) => (
                      <kbd key={j} className="px-2 py-1 rounded-lg bg-[rgba(124,92,252,0.06)] text-brand-purple text-xs font-semibold min-w-[28px] text-center">{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-brand-muted pt-2">On Mac, use ⌘ instead of Ctrl.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
