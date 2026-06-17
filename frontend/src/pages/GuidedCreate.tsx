import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowRight, PenTool, Sparkles, Check, Loader2,
  Copy, RefreshCw, Edit3, Send, MessageSquare, Heart,
  Briefcase, Coffee, BarChart3,
  FileText, MessageCircle, Image, Globe,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const TONES = [
  { id: 'professional', emoji: '💼', label: 'Professional', desc: 'Polished & authoritative' },
  { id: 'casual', emoji: '☕', label: 'Casual', desc: 'Conversational & relatable' },
  { id: 'inspirational', emoji: '✨', label: 'Inspirational', desc: 'Uplifting & motivational' },
  { id: 'data-driven', emoji: '📊', label: 'Data-Driven', desc: 'Facts & analytics first' },
];

const CONTENT_TYPES = [
  { id: 'linkedin-post', label: 'LinkedIn Post', icon: <Globe size={18} />, desc: 'Short-form' },
  { id: 'linkedin-article', label: 'Article', icon: <FileText size={18} />, desc: 'Long-form' },
  { id: 'twitter-thread', label: 'X Thread', icon: <MessageCircle size={18} />, desc: 'Multi-tweet' },
  { id: 'instagram-caption', label: 'Instagram', icon: <Image size={18} />, desc: 'Visual copy' },
];

interface Question { id: string; question: string; placeholder: string; }
type Step = 'idea' | 'format' | 'questions' | 'result';

export default function GuidedCreate() {
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('idea');
  const [rawIdea, setRawIdea] = useState('');
  const [contentType, setContentType] = useState('');
  const [tone, setTone] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login';
      else setUserId(data.user.id);
    });
  }, []);

  const stepIndex: Record<Step, number> = { idea: 0, format: 1, questions: 2, result: 3 };

  const fetchQuestions = async () => {
    if (!rawIdea || !contentType || !userId) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/guided-questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ rawIdea, contentType, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestions(data.questions || []); setStep('questions');
    } catch (err: any) { setError(err.message || 'Failed to generate questions.'); }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!userId) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/guided-generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ rawIdea, contentType, tone, questions, answers, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedContent(data.content); setEditedContent(data.content); setStep('result');
    } catch (err: any) { setError(err.message || 'Failed to generate.'); }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedContent : generatedContent);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const displayContent = isEditing ? editedContent : generatedContent;
  const answeredCount = Object.values(answers).filter(Boolean).length;

  return (
    <div className="min-h-screen gradient-bg-page">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-2 -ml-2 text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <span className="text-lg font-extrabold gradient-text hidden sm:block">Eclatale</span>
        </div>
        <div className="badge bg-[rgba(247,37,133,0.08)] text-brand-pink">
          <PenTool size={12} /> Guided
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
        {/* Progress */}
        {step !== 'result' && (
          <div className="mb-8">
            <div className="flex gap-2">
              {[0, 1, 2, 3].map(s => (
                <div key={s} className="flex-1 h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] overflow-hidden">
                  <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: s <= stepIndex[step] ? '100%' : '0%' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Idea */}
        {step === 'idea' && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6 md:mb-8">
              <h2 className="h2 text-brand-dark mb-2">What's your <span className="gradient-text">idea</span>?</h2>
              <p className="body-text text-sm">Dump your rough thought. We'll shape it into something great.</p>
            </div>
            <div className="card p-5 md:p-6 mb-6">
              <textarea
                value={rawIdea}
                onChange={(e) => setRawIdea(e.target.value)}
                placeholder="A story, a lesson, an observation, a hot take..."
                rows={5}
                className="input !min-h-[140px] !resize-none !leading-relaxed"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {['A story from work', 'A lesson learned', 'An industry trend', 'A hot take'].map(hint => (
                  <button key={hint} onClick={() => setRawIdea(prev => prev || hint + ': ')}
                    className="text-xs px-3 py-1.5 rounded-full border border-[rgba(124,92,252,0.12)] text-brand-purple font-medium hover:bg-brand-bg transition-colors min-h-[32px]">
                    {hint}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep('format')} disabled={rawIdea.length < 10} className="btn-primary text-sm">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Format & Tone */}
        {step === 'format' && (
          <div className="animate-fadeIn space-y-5">
            <div className="text-center mb-6">
              <h2 className="h2 text-brand-dark mb-2">How should it <span className="gradient-text">feel</span>?</h2>
              <p className="body-text text-sm">Pick the format and tone.</p>
            </div>

            <div className="card p-5 md:p-6">
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
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card p-5 md:p-6">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">Tone</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {TONES.map(t => {
                  const selected = tone === t.id;
                  return (
                    <button key={t.id} onClick={() => setTone(t.id)}
                      className={`p-3.5 rounded-2xl border-[1.5px] transition-all text-center min-h-[44px] ${
                        selected ? 'border-brand-purple bg-[rgba(124,92,252,0.04)] shadow-brand' : 'border-[rgba(124,92,252,0.08)] hover:border-brand-purple/30'
                      }`}>
                      <div className="text-xl mb-1">{t.emoji}</div>
                      <div className="text-xs font-bold text-brand-dark">{t.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep('idea')} className="btn-ghost text-sm !py-3"><ArrowLeft size={16} /> Back</button>
              <button onClick={fetchQuestions} disabled={!contentType || !tone || loading} className="btn-primary text-sm">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Thinking...</> : <><MessageSquare size={16} /> Get Questions</>}
              </button>
            </div>
            {error && <div className="card !bg-red-50 !border-red-100 p-4 text-sm text-red-600 font-medium text-center animate-shake">{error}</div>}
          </div>
        )}

        {/* Step 3: Questions */}
        {step === 'questions' && (
          <div className="animate-fadeIn space-y-4">
            <div className="text-center mb-6">
              <h2 className="h2 text-brand-dark mb-2">Let's <span className="gradient-text">refine</span> it</h2>
              <p className="body-text text-sm">Answer these to make your content stand out.</p>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className="card p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{i + 1}</div>
                  <label className="text-sm font-semibold text-brand-dark leading-relaxed">{q.question}</label>
                </div>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={2}
                  className="input !resize-none !min-h-[72px]"
                />
              </div>
            ))}

            <div className="card p-4 !bg-brand-bg flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-dark">{answeredCount}/{questions.length} answered</span>
              <div className="flex gap-1">
                {questions.map(q => (
                  <div key={q.id} className={`w-2.5 h-2.5 rounded-full transition-all ${answers[q.id] ? 'gradient-primary' : 'bg-[rgba(124,92,252,0.15)]'}`} />
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('format')} className="btn-ghost text-sm !py-3"><ArrowLeft size={16} /> Back</button>
              <button onClick={handleGenerate} disabled={answeredCount === 0 || loading} className="btn-primary text-sm">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Crafting...</> : <><Sparkles size={16} /> Generate</>}
              </button>
            </div>
            {error && <div className="card !bg-red-50 !border-red-100 p-4 text-sm text-red-600 font-medium text-center animate-shake">{error}</div>}
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && (
          <div className="animate-slideUp space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white"><Sparkles size={16} /></div>
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">Content ready</h3>
                  <p className="text-xs text-brand-muted">{displayContent.length} chars</p>
                </div>
              </div>
            </div>

            <div className="card p-5 md:p-7">
              {isEditing ? (
                <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                  className="input !min-h-[280px] !resize-y !leading-relaxed !rounded-xl" />
              ) : (
                <div className="whitespace-pre-wrap text-brand-dark leading-relaxed text-[15px]">{displayContent}</div>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 justify-center">
              <button onClick={handleCopy} className="btn-secondary text-sm !py-3">
                {copied ? <Check size={16} className="text-brand-teal" /> : <Copy size={16} />} {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => { if (isEditing) setGeneratedContent(editedContent); setIsEditing(!isEditing); }}
                className={`btn-secondary text-sm !py-3 ${isEditing ? '!border-brand-teal !text-brand-teal' : ''}`}>
                <Edit3 size={16} /> {isEditing ? 'Save' : 'Edit'}
              </button>
              <button onClick={() => { setGeneratedContent(''); setEditedContent(''); handleGenerate(); }} className="btn-secondary text-sm !py-3">
                <RefreshCw size={16} /> Regenerate
              </button>
              <button className="btn-primary text-sm !py-3"><Send size={16} /> Post to LinkedIn</button>
            </div>

            <div className="text-center">
              <button onClick={() => { setStep('idea'); setRawIdea(''); setContentType(''); setTone(''); setQuestions([]); setAnswers({}); setGeneratedContent(''); setEditedContent(''); setError(''); }}
                className="text-sm text-brand-muted hover:text-brand-purple font-medium transition-colors">Start over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
