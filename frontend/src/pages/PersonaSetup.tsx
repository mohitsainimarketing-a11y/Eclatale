import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, Sparkles, Check, Loader2, MessageSquare } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const STYLES = [
  { id: 'direct', label: 'Direct', emoji: '🎯', desc: 'Straight to the point' },
  { id: 'warm', label: 'Warm', emoji: '🤝', desc: 'Empathetic and personal' },
  { id: 'analytical', label: 'Analytical', emoji: '🔬', desc: 'Data and logic first' },
  { id: 'witty', label: 'Witty', emoji: '😏', desc: 'Clever and sharp' },
  { id: 'visionary', label: 'Visionary', emoji: '🔮', desc: 'Big-picture thinking' },
  { id: 'contrarian', label: 'Contrarian', emoji: '⚡', desc: 'Against the grain' },
  { id: 'storyteller', label: 'Storyteller', emoji: '📖', desc: 'Narrative-driven' },
];

export default function PersonaSetup() {
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [styles, setStyles] = useState<string[]>([]);
  const [formality, setFormality] = useState(50);
  const [expertise, setExpertise] = useState('');
  const [hotTake, setHotTake] = useState('');
  const [voiceSamples, setVoiceSamples] = useState('');
  const [samplePost, setSamplePost] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login';
      else setUserId(data.user.id);
    });
  }, []);

  const toggleStyle = (id: string) => {
    setStyles(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const formalityLabel = (v: number) => {
    if (v <= 20) return 'Very casual';
    if (v <= 40) return 'Casual';
    if (v <= 60) return 'Balanced';
    if (v <= 80) return 'Professional';
    return 'Very formal';
  };

  const parseSamples = (): string[] => {
    return voiceSamples
      .split(/\n{2,}/)
      .map(s => s.trim())
      .filter(s => s.length > 20);
  };

  const handleGenerateSample = async () => {
    if (!userId) return;
    setGenerating(true);
    try {
      await savePersona(false);
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          topic: expertise || 'a lesson I learned recently in my career',
          tone: formality <= 40 ? 'casual' : formality >= 70 ? 'professional' : 'inspirational',
          contentType: 'linkedin-post',
          userId,
        }),
      });
      const data = await res.json();
      if (data.content) setSamplePost(data.content);
    } catch {}
    setGenerating(false);
  };

  const savePersona = async (markComplete: boolean) => {
    if (!userId) return;
    const samples = parseSamples();
    await supabase.from('persona_profiles').upsert({
      user_id: userId,
      communication_styles: styles,
      formality_score: formality,
      expertise_topic: expertise || null,
      contrarian_take: hotTake || null,
      voice_samples: samples,
      ...(markComplete ? { persona_completed_at: new Date().toISOString() } : {}),
    });
  };

  const handleFinish = async () => {
    setSaving(true);
    await savePersona(true);
    window.location.href = '/dashboard';
  };

  const canProceed1 = styles.length > 0;
  const canProceed2 = expertise.length > 0;

  return (
    <div className="min-h-screen gradient-bg-page">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-2 -ml-2 text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <a href="/dashboard" className="text-lg font-extrabold gradient-text hidden sm:block">Eclatale</a>
        </div>
        <span className="text-xs font-semibold text-brand-muted">Step {step}/4</span>
      </nav>

      {/* Progress */}
      <div className="px-5 md:px-8 pt-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex-1 h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] overflow-hidden">
              <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: s <= step ? '100%' : '0%' }} />
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-8">
        {/* Step 1: Identity & Voice */}
        {step === 1 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h2 className="h2 text-brand-dark mb-2">How do you <span className="gradient-text">communicate</span>?</h2>
              <p className="body-text text-sm">Pick up to 3 styles that feel like you. This shapes how your content sounds.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {STYLES.map(s => {
                const selected = styles.includes(s.id);
                const disabled = !selected && styles.length >= 3;
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStyle(s.id)}
                    disabled={disabled}
                    className={`card p-4 text-center transition-all min-h-[44px] ${
                      selected ? '!border-brand-purple !shadow-brand-md' : disabled ? 'opacity-40' : 'card-hover'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{s.emoji}</span>
                    <span className="text-sm font-bold text-brand-dark block">{s.label}</span>
                    <span className="text-[11px] text-brand-muted">{s.desc}</span>
                    {selected && (
                      <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center mx-auto mt-2 animate-checkmark">
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="card p-5 mb-8">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide">Formality</label>
                <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-xs">{formalityLabel(formality)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={formality}
                onChange={e => setFormality(parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7C5CFC ${formality}%, rgba(124,92,252,0.1) ${formality}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-brand-muted">Casual</span>
                <span className="text-[10px] text-brand-muted">Formal</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={!canProceed1} className="btn-primary text-sm">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Expertise */}
        {step === 2 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h2 className="h2 text-brand-dark mb-2">What's your <span className="gradient-text">superpower</span>?</h2>
              <p className="body-text text-sm">This becomes your content anchor — the thing you're known for.</p>
            </div>

            <div className="card p-5 mb-5">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">
                The ONE topic people come to you for
              </label>
              <input
                type="text"
                value={expertise}
                onChange={e => setExpertise(e.target.value)}
                placeholder="e.g., Scaling B2B SaaS from $1M to $10M ARR"
                className="input !text-base"
              />
            </div>

            <div className="card p-5 mb-8">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">
                Your hot take (optional but powerful)
              </label>
              <textarea
                value={hotTake}
                onChange={e => setHotTake(e.target.value)}
                placeholder="e.g., Most startups fail because they hire too fast, not too slow. Growth should follow product-market fit, not precede it."
                rows={3}
                className="input !resize-none !min-h-[80px]"
              />
              <p className="text-[11px] text-brand-muted mt-2">A contrarian view makes your content stand out from the crowd.</p>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn-ghost text-sm !py-3"><ArrowLeft size={16} /> Back</button>
              <button onClick={() => setStep(3)} disabled={!canProceed2} className="btn-primary text-sm">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Voice Samples */}
        {step === 3 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h2 className="h2 text-brand-dark mb-2">Teach us your <span className="gradient-text">voice</span></h2>
              <p className="body-text text-sm">Paste 1-3 things you've actually written. LinkedIn posts, emails, Slack messages — anything.</p>
            </div>

            <div className="card p-5 mb-4">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">
                Your writing samples
              </label>
              <textarea
                value={voiceSamples}
                onChange={e => setVoiceSamples(e.target.value)}
                placeholder={"Paste your first writing sample here...\n\nSeparate multiple samples with a blank line.\n\nThe more you share, the more Eclatale sounds like YOU."}
                rows={8}
                className="input !resize-none !min-h-[200px] !leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-brand-muted">{parseSamples().length} sample{parseSamples().length !== 1 ? 's' : ''} detected</span>
                <span className="text-xs text-brand-muted">{voiceSamples.length} chars</span>
              </div>
            </div>

            {!voiceSamples && (
              <div className="card p-4 !bg-[rgba(255,107,53,0.04)] !border-brand-orange/20 mb-6">
                <p className="text-xs text-brand-orange font-medium">
                  Skipping this step means we'll use a generic professional voice until you add samples. You can always come back later.
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="btn-ghost text-sm !py-3"><ArrowLeft size={16} /> Back</button>
              <button onClick={() => setStep(4)} className="btn-primary text-sm">
                {voiceSamples ? 'Continue' : 'Skip for now'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h2 className="h2 text-brand-dark mb-2">Your <span className="gradient-text">Voice Profile</span></h2>
              <p className="body-text text-sm">Here's what Eclatale learned about you. Every post will be shaped by this.</p>
            </div>

            <div className="card p-6 mb-6">
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Communication Style</span>
                  <div className="flex gap-2 mt-1.5">
                    {styles.map(s => {
                      const style = STYLES.find(st => st.id === s);
                      return (
                        <span key={s} className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-xs">
                          {style?.emoji} {style?.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Formality</span>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex-1 h-2 rounded-full bg-[rgba(124,92,252,0.08)]">
                      <div className="h-full rounded-full gradient-primary" style={{ width: `${formality}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-brand-dark">{formalityLabel(formality)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Core Expertise</span>
                  <p className="text-sm font-medium text-brand-dark mt-1">{expertise}</p>
                </div>

                {hotTake && (
                  <div>
                    <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Hot Take</span>
                    <p className="text-sm text-brand-dark mt-1 italic">"{hotTake}"</p>
                  </div>
                )}

                <div>
                  <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Voice Samples</span>
                  <p className="text-sm text-brand-dark mt-1">
                    {parseSamples().length > 0 ? `${parseSamples().length} sample${parseSamples().length > 1 ? 's' : ''} provided` : 'None yet — using default voice'}
                  </p>
                </div>
              </div>
            </div>

            {/* Generate sample */}
            <div className="card p-5 mb-6">
              <button
                onClick={handleGenerateSample}
                disabled={generating}
                className="btn-secondary w-full text-sm !py-3 mb-4"
              >
                {generating ? <><Loader2 size={16} className="animate-spin" /> Generating sample in your voice...</> : <><MessageSquare size={16} /> Generate a sample post in your voice</>}
              </button>

              {samplePost && (
                <div className="mt-2 p-4 rounded-xl bg-brand-bg border border-[rgba(124,92,252,0.1)]">
                  <p className="text-[11px] font-semibold text-brand-purple uppercase tracking-wide mb-2">Preview — this is your voice</p>
                  <div className="whitespace-pre-wrap text-sm text-brand-dark leading-relaxed">{samplePost}</div>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="btn-ghost text-sm !py-3"><ArrowLeft size={16} /> Back</button>
              <button onClick={handleFinish} disabled={saving} className="btn-primary text-sm">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Sparkles size={16} /> Save &amp; Start Creating</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
