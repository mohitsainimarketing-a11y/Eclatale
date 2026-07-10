import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Sparkles, Copy, RefreshCw, Send, Check, Loader2,
  FileText, Image, Lightbulb, Scissors,
  Wand2, Undo2, Calendar, PenTool, ExternalLink,
  ChevronDown, X, Download, Eye, EyeOff, ArrowRight,
} from 'lucide-react';
import { OVERLAY_STYLES, deriveHeadline, compositeOverlay } from '../lib/imageOverlay';
import { STYLES, formalityLabel } from '../lib/personaOptions';

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

interface AuthenticityScore {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  readyToPost: boolean;
  topSuggestion: string;
  accuracy: { score: number; claims: { claim: string; status: string; note: string }[]; summary: string };
  freshness: { score: number; assessment: string; topicSaturation: string; suggestion: string; reasoning: string };
  voice: { score: number; matchLevel: string; specificMatches: string[]; specificMismatches: string[]; suggestion: string };
}

function scoreColor(score: number): string {
  return score >= 80 ? '#06D6A0' : score >= 60 ? '#F59E0B' : '#EF4444';
}

// Actionable items behind an authenticity score, most important first — mirrors
// the priority order the backend uses to pick a single topSuggestion.
function getActionableItems(authScore: AuthenticityScore): { label: string; text: string }[] {
  const items: { label: string; text: string }[] = [];
  if (authScore.accuracy.score < 70) {
    const flagged = authScore.accuracy.claims.find(c => c.status === 'Questionable' || c.status === 'False');
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
  const [refining, setRefining]   = useState(false);

  // UI
  const [mobileView, setMobileView] = useState<'compose' | 'assistant'>('compose');
  const [error, setError] = useState('');

  // Best time to post (AI-recommended)
  const [bestTime, setBestTime] = useState<{ recommendedDays: string[]; recommendedTimes: string[]; reasoning: string; basedOn: string; confidence: string } | null>(null);

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
  const [lastTopic, setLastTopic] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const toneRef        = useRef<HTMLDivElement>(null);
  const toneMatchRef   = useRef<HTMLDivElement>(null);
  const postSuggestionsRef = useRef<HTMLDivElement>(null);
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
            if (d.recommendedDays?.[0]) setScheduleDay(d.recommendedDays[0]);
            if (d.recommendedTimes?.[0]) setScheduleTime(d.recommendedTimes[0]);
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
    setActiveFlow(null);
    handleGenerate(writeTopic);
    setWriteTopic('');
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
      body: JSON.stringify({ action: 'authenticity-score', userId, postId: postIdToCheck, postContent: content, topic }),
    })
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAuthScore(d); })
      .catch(() => {})
      .finally(() => { clearTimeout(loadingTimer); setShowAuthLoading(false); });
  }, [userId]);

  const handleFixSuggestion = (suggestion: string) => {
    if (!suggestion) return;
    setChatInput(suggestion);
    setMobileView('compose');
  };

  const handleGenerate = async (topic: string) => {
    if (!topic.trim() || !userId) return;
    setGenerating(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, tone, contentType, userId, styleNudge: nudgeApplied ? nudge?.instruction : undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateContent(data.content);
      setPublishResult(null);
      setActiveFlow(null);
      setNudgeDismissed(true);
      const label = CONTENT_TYPES.find(c => c.id === contentType)?.label || contentType;
      addActivity('sparkles', `Generated a ${label} about "${topic.substring(0, 50)}${topic.length > 50 ? '…' : ''}"`);
      const { data: inserted } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic,
        tone, content_type: contentType, source: 'auto',
      }).select('id').single();
      if (inserted) { setPostId(inserted.id); queueAnalysis(inserted.id, data.content); setLastTopic(topic); checkAuthenticityScore(inserted.id, data.content, topic); }
      checkToneMatch(data.content, tone);
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
      if (inserted) { setPostId(inserted.id); queueAnalysis(inserted.id, data.content); setLastTopic('Repurposed content'); checkAuthenticityScore(inserted.id, data.content, 'Repurposed content'); }
      checkToneMatch(data.content, tone);
    } catch (err: any) {
      addMsg('bot', `Repurpose failed: ${err.message || 'unknown error'}`, 'text');
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
      if (data.error) throw new Error(data.error);
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
      `Shifted tone to ${label}`,
      newTone
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
    navigator.clipboard.writeText(composerContent);
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
      if (data.error) throw new Error(data.error);
      setPublishResult({ success: true, urn: data.linkedinPostUrn });
      addActivity('send', 'Published to LinkedIn');
      fetch(`${API_URL}/api/persona-signal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId, postId: activePostId, action: 'kept', tone, contentType, postLength: composerContent.length }),
      }).catch(() => {});
    } catch (err: any) { setPublishResult({ error: err.message }); }
    setPublishing(false);
  };

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
        <div className="relative w-full max-w-[960px] flex min-h-0 bg-white rounded-none md:rounded-2xl md:border md:border-[rgba(0,0,0,0.08)] md:shadow-[0_4px_32px_rgba(0,0,0,0.1)] overflow-hidden">

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
        <main className={`${mobileView === 'compose' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 overflow-hidden`}>

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
            {error && <p className="text-[10px] text-red-500 mt-1 px-1">{error}</p>}
          </div>

          {/* Single-row header: avatar · name · tone */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2.5 bg-white">
            {userAvatar
              ? <img src={userAvatar} alt={userName} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
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
                <button onClick={closeActionPanel}
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
                      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)' }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.09)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)')}>
                      <div className="px-3 pt-3 pb-2 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-2 flex-shrink-0">
                          <div className="flex items-start gap-2 min-w-0">
                            {userAvatar
                              ? <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
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
                <button onClick={closeActionPanel}
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
                    <button onClick={() => setNudgeDismissed(true)}
                      className="text-brand-muted hover:text-brand-purple flex-shrink-0 p-0.5">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <button onClick={handleWriteGenerate} disabled={!writeTopic.trim() || generating}
                  className="btn-primary w-full !py-3 text-sm">
                  {generating
                    ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                    : <><Sparkles size={14} /> Generate post</>}
                </button>
              </div>
            </div>

          ) : activeFlow === 'repurpose' ? (

            /* ── REPURPOSE ─────────────────────────────────────────────── */
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[12px] font-bold text-brand-dark">Repurpose content</span>
                <button onClick={closeActionPanel}
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
                    onChange={e => setRepurposeText(e.target.value)}
                    placeholder="Paste article, newsletter, transcript, or thread…"
                    className="input !text-[13px] !min-h-[180px] !resize-none w-full !leading-relaxed"
                    autoFocus
                  />
                </div>
                <button onClick={handleRepurpose} disabled={!repurposeText.trim() || repurposing}
                  className="btn-primary w-full !py-3 text-sm">
                  {repurposing
                    ? <><Loader2 size={14} className="animate-spin" /> Repurposing…</>
                    : <><Scissors size={14} /> Repurpose this</>}
                </button>
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
                    className="w-full resize-none border-0 bg-transparent text-brand-dark text-[15px] leading-[1.75] focus:outline-none placeholder:text-[#9CA3AF] font-[inherit] min-h-[220px]"
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
                        : 'border-[rgba(0,0,0,0.06)] text-[#9CA3AF] cursor-not-allowed'
                    }`}>
                    <Image size={14} />
                    Add visual
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Char counter + action bar — hidden during write / repurpose / ideas flows */}
          {!ideasView && activeFlow !== 'write' && activeFlow !== 'repurpose' && (
            <>
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

              {/* Authenticity — single compact line by default, expands to the full score card on click */}
              {composerContent && (showAuthLoading || authScore) && (
                <div className="flex-shrink-0 px-5 pb-2.5">
                  {showAuthLoading && !authScore ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-brand-muted">
                      <span>Checking authenticity</span>
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
                        Authenticity: {authScore.overallScore} {authScore.overallScore >= 80 ? '✓' : authScore.overallScore >= 60 ? '⚠' : '✗'}
                        <ChevronDown size={11} className={`transition-transform ${authScoreExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {authScoreExpanded && (
                        <div className="card !p-4 mt-2 animate-fadeIn">
                          <div className="flex items-start gap-4">
                            <AuthenticityRing score={authScore.overallScore} />
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0 mt-1"
                              style={{ background: scoreColor(authScore.overallScore) }}>
                              {authScore.grade}
                            </span>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[11px] font-bold text-brand-dark uppercase tracking-wide">Authenticity Score</span>
                                <span title="Eclatale checks your post for factual accuracy, topic freshness, and voice consistency before you publish. This helps you post with confidence."
                                  className="w-3.5 h-3.5 rounded-full bg-[rgba(124,92,252,0.1)] text-brand-purple text-[9px] font-bold flex items-center justify-center cursor-help flex-shrink-0">?</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-brand-dark">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.accuracy.score) }} />
                                <span>✓ Factual Accuracy: {authScore.accuracy.score}/100</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-brand-dark">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.freshness.score) }} />
                                <span>↻ Topic Freshness: {authScore.freshness.score}/100</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-brand-dark">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.voice.score) }} />
                                <span>◉ Voice Match: {authScore.voice.score}/100</span>
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
                    </div>
                  )}
                </div>
              )}

              <div className="flex-shrink-0 px-5 py-3 border-t border-[rgba(124,92,252,0.06)] bg-white/40 flex items-center gap-2">
                <button onClick={handleCopy} disabled={!composerContent}
                  className="btn-ghost text-xs !py-2 !px-3 disabled:opacity-40">
                  {copied ? <><Check size={12} className="text-brand-teal" /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
                <button onClick={handleSaveDraft} disabled={!composerContent}
                  className="btn-ghost text-xs !py-2 !px-3 disabled:opacity-40">
                  {saved ? <><Check size={12} className="text-brand-teal" /> Saved</> : <><FileText size={12} /> Save Draft</>}
                </button>
                <div className="relative" ref={scheduleRef}>
                  <button disabled={!composerContent} onClick={() => setScheduleOpen(o => !o)}
                    className="btn-ghost text-xs !py-2 !px-3 disabled:opacity-40">
                    <Calendar size={12} /> {scheduleConfirmed && scheduleDay ? `${scheduleDay}, ${scheduleTime}` : 'Schedule'}
                  </button>
                  {scheduleOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-72 bg-white rounded-2xl shadow-2xl border border-[rgba(124,92,252,0.1)] p-4 z-50 animate-fadeIn">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar size={12} className="text-brand-purple" />
                        <span className="text-[11px] font-bold text-brand-dark uppercase tracking-widest">Schedule</span>
                      </div>
                      {bestTime && bestTime.recommendedDays.length > 0 && (
                        <p className="text-[11px] text-brand-purple bg-[rgba(124,92,252,0.05)] rounded-lg px-2.5 py-2 mb-3 leading-relaxed">
                          Best time ({bestTime.basedOn}): <span className="font-semibold">{bestTime.recommendedDays.join(', ')}</span> at <span className="font-semibold">{bestTime.recommendedTimes.join(', ')}</span>. Pre-filled below.
                        </p>
                      )}
                      <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-1 block">Day</label>
                      <select value={scheduleDay} onChange={e => { setScheduleDay(e.target.value); setScheduleConfirmed(false); }}
                        className="input !text-sm !py-2 mb-2">
                        <option value="">Select a day…</option>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide mb-1 block">Time window</label>
                      <input type="text" value={scheduleTime} onChange={e => { setScheduleTime(e.target.value); setScheduleConfirmed(false); }}
                        placeholder="e.g. 8:00 AM" className="input !text-sm !py-2 mb-3" />
                      <button
                        onClick={() => { setScheduleConfirmed(true); setScheduleOpen(false); addActivity('save', `Scheduled for ${scheduleDay || 'chosen day'}, ${scheduleTime || 'chosen time'}`); }}
                        disabled={!scheduleDay || !scheduleTime}
                        className="btn-primary w-full text-xs !py-2 disabled:opacity-40">
                        <Check size={12} /> Set schedule
                      </button>
                      <p className="text-[10px] text-brand-muted mt-2 leading-relaxed">Auto-publishing at the scheduled time is coming soon. For now this saves your intended slot.</p>
                    </div>
                  )}
                </div>
                <div className="flex-1" />
                <div className="flex flex-col items-end gap-1">
                  <button onClick={handlePublish}
                    disabled={!composerContent || publishing || !!publishResult?.success}
                    className="btn-primary !py-2.5 !px-5 text-xs disabled:opacity-40 shadow-[0_2px_12px_rgba(124,92,252,0.25)]">
                    {publishing ? <><Loader2 size={13} className="animate-spin" /> Publishing…</>
                      : publishResult?.success ? <><Check size={13} /> Published!</>
                      : <><Send size={13} /> Post to LinkedIn</>}
                  </button>
                  {authScore && !publishResult?.success && authScore.overallScore < 80 && (
                    <div className="relative" ref={postSuggestionsRef}>
                      <button onClick={() => setPostSuggestionsOpen(o => !o)}
                        className="text-[10px] font-semibold flex items-center gap-1.5 hover:underline">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor(authScore.overallScore) }} />
                        {authScore.overallScore >= 60 ? (
                          <span className="text-amber-500">{getActionableItems(authScore).length} suggestion{getActionableItems(authScore).length === 1 ? '' : 's'} available</span>
                        ) : (
                          <span className="text-red-500">Low authenticity score — see details</span>
                        )}
                      </button>
                      {postSuggestionsOpen && (
                        <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-[rgba(124,92,252,0.1)] p-3.5 z-50 animate-fadeIn space-y-2.5">
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
            </>
          )}
        </main>

        {/* ── VOICE PROFILE QUICK-EDIT SLIDE-OVER ─────────────────────────────── */}
        {voiceEditOpen && (
          <>
            <div className="absolute inset-0 z-40 bg-transparent" onClick={closeVoiceEdit} />
            <div className={`absolute inset-y-0 left-0 z-50 w-full sm:w-[400px] bg-white shadow-2xl overflow-y-auto ${voiceEditClosing ? 'animate-slideOutLeft' : 'animate-slideInLeft'}`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(124,92,252,0.08)] sticky top-0 bg-white z-10">
                <span className="text-sm font-bold text-brand-dark">Your Voice Profile</span>
                <button onClick={closeVoiceEdit}
                  className="w-8 h-8 rounded-xl hover:bg-[rgba(124,92,252,0.06)] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors">
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
                          className={`card !p-3 text-center transition-all ${selected ? '!border-brand-purple !shadow-brand-md' : disabled ? 'opacity-40' : 'card-hover'}`}>
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
                <div className="card !p-4 flex items-center gap-3">
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
                    <button onClick={handleDownloadVisual}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-brand-dark text-white text-[12px] font-medium px-4 py-3 rounded-xl shadow-2xl animate-fadeIn flex items-center gap-2 whitespace-nowrap">
          <Check size={14} className="text-brand-teal" />
          Voice updated — your next post will reflect these changes
        </div>
      )}
    </div>
  );
}
