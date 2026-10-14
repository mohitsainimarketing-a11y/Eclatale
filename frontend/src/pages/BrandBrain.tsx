import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Check, Loader2, MessageSquare, Sparkles, Brain, Palette, BookOpen, Bot,
} from 'lucide-react';
import { STYLES, formalityLabel } from '../lib/personaOptions';
import AppShell from '../components/AppShell';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

// ─────────────────────────────────────────────────────────────────────────────
// VOICE TAB
// ─────────────────────────────────────────────────────────────────────────────

function VoiceTab({ userId }: { userId: string }) {
  const { showToast } = useToast();
  const [styles, setStyles] = useState<string[]>([]);
  const [formality, setFormality] = useState(50);
  const [expertise, setExpertise] = useState('');
  const [hotTake, setHotTake] = useState('');
  const [voiceSamples, setVoiceSamples] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [samplePost, setSamplePost] = useState('');

  useEffect(() => {
    supabase.from('persona_profiles').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStyles(data.communication_styles || []);
          setFormality(data.formality_score ?? 50);
          setExpertise(data.expertise_topic || '');
          setHotTake(data.contrarian_take || '');
          setVoiceSamples((data.voice_samples || []).join('\n\n'));
        }
        setLoading(false);
      });
  }, [userId]);

  const toggleStyle = (id: string) => setStyles(prev => {
    if (prev.includes(id)) return prev.filter(s => s !== id);
    if (prev.length >= 3) return prev;
    return [...prev, id];
  });

  const parseSamples = () => voiceSamples.split(/\n{2,}/).map(s => s.trim()).filter(s => s.length > 20);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('persona_profiles').upsert({
      user_id: userId,
      communication_styles: styles,
      formality_score: formality,
      expertise_topic: expertise || null,
      contrarian_take: hotTake || null,
      voice_samples: parseSamples(),
    }, { onConflict: 'user_id' });
    if (error) showToast('error', 'Could not save. Please try again.');
    else showToast('success', 'Voice profile saved.');
    setSaving(false);
  };

  const generateSample = async () => {
    setGenerating(true);
    try {
      await save();
      const res = await apiFetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          topic: expertise || 'a lesson I learned recently in my career',
          tone: formality <= 40 ? 'casual' : formality >= 70 ? 'professional' : 'inspirational',
          contentType: 'linkedin-post', userId,
        }),
      });
      const data = await res.json();
      if (data.content) setSamplePost(data.content);
    } catch {}
    setGenerating(false);
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-2xl" />)}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Communication styles */}
      <div className="card p-6">
        <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-4">
          Communication style <span className="normal-case font-normal">(pick up to 3)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STYLES.map(s => {
            const selected = styles.includes(s.id);
            const disabled = !selected && styles.length >= 3;
            return (
              <button key={s.id} onClick={() => toggleStyle(s.id)} disabled={disabled}
                className={`p-4 rounded-xl text-center border transition-all ${
                  selected ? 'border-brand-purple bg-[rgba(124,92,252,0.06)] shadow-brand' : disabled ? 'opacity-40 border-[rgba(0,0,0,0.06)] bg-white' : 'border-[rgba(0,0,0,0.06)] bg-white hover:border-brand-purple/30'
                }`}>
                <span className="text-xl block mb-1">{s.emoji}</span>
                <span className="text-sm font-bold text-brand-dark block">{s.label}</span>
                <span className="text-[11px] text-brand-muted">{s.desc}</span>
                {selected && <div className="w-4 h-4 rounded-full gradient-primary flex items-center justify-center mx-auto mt-2"><Check size={10} className="text-white" /></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formality */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[11px] font-bold text-brand-muted uppercase tracking-wide">Formality</label>
          <span className="text-xs font-semibold text-brand-purple bg-[rgba(124,92,252,0.08)] px-2 py-0.5 rounded-full">{formalityLabel(formality)}</span>
        </div>
        <input type="range" min="0" max="100" value={formality} onChange={e => setFormality(parseInt(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #7C5CFC ${formality}%, rgba(124,92,252,0.1) ${formality}%)` }} />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-brand-muted">Casual</span>
          <span className="text-[10px] text-brand-muted">Formal</span>
        </div>
      </div>

      {/* Expertise and hot take */}
      <div className="card p-6 space-y-5">
        <div>
          <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">Core expertise</label>
          <input type="text" value={expertise} onChange={e => setExpertise(e.target.value)}
            placeholder="e.g., Scaling B2B SaaS from $1M to $10M ARR"
            className="input w-full text-sm" />
          <p className="text-[11px] text-brand-muted mt-1.5">The one topic your audience associates with you.</p>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">Hot take <span className="normal-case font-normal">(optional)</span></label>
          <textarea value={hotTake} onChange={e => setHotTake(e.target.value)}
            placeholder="A contrarian view that makes your content stand out..."
            rows={3} className="input w-full text-sm resize-none" />
        </div>
      </div>

      {/* Voice samples */}
      <div className="card p-6">
        <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">Voice samples</label>
        <p className="text-[12px] text-brand-muted mb-3">Paste 1 to 3 things you've written. LinkedIn posts, emails, anything. Separate them with a blank line.</p>
        <textarea value={voiceSamples} onChange={e => setVoiceSamples(e.target.value)}
          placeholder={"Paste your first writing sample here...\n\nSeparate multiple samples with a blank line."}
          rows={8} className="input w-full text-sm resize-none leading-relaxed" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-brand-muted">{parseSamples().length} sample{parseSamples().length !== 1 ? 's' : ''} detected</span>
          <span className="text-[11px] text-brand-muted">{voiceSamples.length} chars</span>
        </div>
      </div>

      {/* Generate preview */}
      <div className="card p-6">
        <button onClick={generateSample} disabled={generating}
          className="btn-secondary w-full text-sm !py-3 mb-4">
          {generating
            ? <><Loader2 size={14} className="animate-spin" /> Generating sample post...</>
            : <><MessageSquare size={14} /> Preview a post in your voice</>}
        </button>
        {samplePost && (
          <div className="mt-2 p-4 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)]">
            <p className="text-[10px] font-bold text-brand-purple uppercase tracking-wide mb-2">Preview: this is your voice</p>
            <p className="whitespace-pre-wrap text-sm text-brand-dark leading-relaxed">{samplePost}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Sparkles size={14} /> Save voice profile</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT TAB
// ─────────────────────────────────────────────────────────────────────────────

const PERSONALITY_OPTIONS = [
  { id: 'supportive', label: 'Supportive coach', desc: 'Encouraging, warm, focuses on your wins' },
  { id: 'direct', label: 'Direct advisor', desc: 'Blunt feedback, no fluff, respects your time' },
  { id: 'creative', label: 'Creative collaborator', desc: 'Generates ideas, challenges your thinking' },
  { id: 'analyst', label: 'Data analyst', desc: 'Numbers-first, cites patterns, backs up claims' },
];

function AssistantTab({ userId }: { userId: string }) {
  const { showToast } = useToast();
  const [name, setName] = useState('Aria');
  const [emoji, setEmoji] = useState('✨');
  const [personality, setPersonality] = useState('supportive');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('assistant_name, assistant_emoji, assistant_personality').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.assistant_name) setName(data.assistant_name);
          if (data.assistant_emoji) setEmoji(data.assistant_emoji);
          if (data.assistant_personality) setPersonality(data.assistant_personality);
        }
        setLoading(false);
      });
  }, [userId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      assistant_name: name.trim() || 'Aria',
      assistant_emoji: emoji.trim() || '✨',
      assistant_personality: personality,
    }).eq('id', userId);
    if (error) showToast('error', 'Could not save. Please try again.');
    else showToast('success', 'Assistant settings saved.');
    setSaving(false);
  };

  if (loading) return <div className="skeleton h-48 w-full max-w-2xl rounded-2xl" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">Assistant name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={20}
              placeholder="Aria" className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">Emoji</label>
            <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4}
              placeholder="✨" className="input w-full text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wide mb-3">Personality</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERSONALITY_OPTIONS.map(p => (
              <button key={p.id} onClick={() => setPersonality(p.id)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                  personality === p.id ? 'border-brand-purple bg-[rgba(124,92,252,0.06)]' : 'border-[rgba(0,0,0,0.06)] hover:border-brand-purple/30'
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  personality === p.id ? 'border-brand-purple bg-brand-purple' : 'border-brand-muted'
                }`}>
                  {personality === p.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-dark">{p.label}</p>
                  <p className="text-[11px] text-brand-muted mt-0.5">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-[rgba(124,92,252,0.06)]">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[rgba(124,92,252,0.04)]">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-lg flex-shrink-0">
              {emoji || '✨'}
            </div>
            <div>
              <p className="text-sm font-bold text-brand-dark">{name || 'Aria'}</p>
              <p className="text-[11px] text-brand-muted">{PERSONALITY_OPTIONS.find(p => p.id === personality)?.desc}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <>Save assistant settings</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE TAB (placeholder)
// ─────────────────────────────────────────────────────────────────────────────

function KnowledgeTab() {
  return (
    <div className="max-w-2xl">
      <div className="card p-10 text-center border-2 border-dashed border-[rgba(124,92,252,0.15)]">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
          <BookOpen size={22} className="text-white" />
        </div>
        <h3 className="text-base font-bold text-brand-dark mb-2">Knowledge base</h3>
        <p className="text-sm text-brand-muted max-w-sm mx-auto leading-relaxed">
          Upload documents, paste URLs, or add topic notes. Your AI will cite them when generating content. Coming in the next release.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAND KIT TAB (placeholder)
// ─────────────────────────────────────────────────────────────────────────────

function BrandKitTab() {
  return (
    <div className="max-w-2xl">
      <div className="card p-10 text-center border-2 border-dashed border-[rgba(124,92,252,0.15)]">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
          <Palette size={22} className="text-white" />
        </div>
        <h3 className="text-base font-bold text-brand-dark mb-2">Brand kit</h3>
        <p className="text-sm text-brand-muted max-w-sm mx-auto leading-relaxed">
          Store your logo, brand colors, taglines, and boilerplate bio. Auto-inject them into every post and visual. Coming in the next release.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SHELL
// ─────────────────────────────────────────────────────────────────────────────

type BBTab = 'voice' | 'assistant' | 'knowledge' | 'brand-kit';

const TABS: { id: BBTab; label: string; icon: React.ReactNode }[] = [
  { id: 'voice',      label: 'Voice',      icon: <Brain size={15} /> },
  { id: 'assistant',  label: 'Assistant',  icon: <Bot size={15} /> },
  { id: 'knowledge',  label: 'Knowledge',  icon: <BookOpen size={15} /> },
  { id: 'brand-kit',  label: 'Brand Kit',  icon: <Palette size={15} /> },
];

export default function BrandBrain() {
  const [tab, setTab] = useState<BBTab>(() => {
    if (typeof window === 'undefined') return 'voice';
    const p = new URLSearchParams(window.location.search).get('tab');
    return (TABS.some(t => t.id === p) ? p : 'voice') as BBTab;
  });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
    });
  }, []);

  return (
    <AppShell mobileTitle="Brand Brain">
      <div className="min-h-screen bg-[#FAFAFE]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-8">
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Brand Brain</h1>
            <p className="text-sm text-brand-muted mt-0.5">Your voice, knowledge, and assistant in one place.</p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-white border border-[rgba(124,92,252,0.1)] rounded-xl mb-8 w-fit overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  tab === t.id ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-muted hover:text-brand-dark'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {!userId ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-2xl" />)}</div>
          ) : (
            <>
              {tab === 'voice'     && <VoiceTab     userId={userId} />}
              {tab === 'assistant' && <AssistantTab userId={userId} />}
              {tab === 'knowledge' && <KnowledgeTab />}
              {tab === 'brand-kit' && <BrandKitTab />}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
