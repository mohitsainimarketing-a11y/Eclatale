import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowRight, PenTool, Sparkles, Check, Loader2,
  Copy, RefreshCw, Edit3, Send, MessageSquare,
  Briefcase, Coffee, Heart, BarChart3,
  FileText, MessageCircle, Image, Globe,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const TONES = [
  { id: 'professional', label: 'Professional', icon: <Briefcase size={22} />, desc: 'Polished & authoritative', color: 'purple' },
  { id: 'casual', label: 'Casual', icon: <Coffee size={22} />, desc: 'Conversational & relatable', color: 'pink' },
  { id: 'inspirational', label: 'Inspirational', icon: <Heart size={22} />, desc: 'Uplifting & motivational', color: 'orange' },
  { id: 'data-driven', label: 'Data-Driven', icon: <BarChart3 size={22} />, desc: 'Facts & analytics first', color: 'violet' },
];

const CONTENT_TYPES = [
  { id: 'linkedin-post', label: 'LinkedIn Post', icon: <Globe size={20} />, desc: 'Short-form thought leadership' },
  { id: 'linkedin-article', label: 'LinkedIn Article', icon: <FileText size={20} />, desc: 'Long-form deep dive' },
  { id: 'twitter-thread', label: 'Twitter Thread', icon: <MessageCircle size={20} />, desc: 'Multi-tweet storytelling' },
  { id: 'instagram-caption', label: 'Instagram Caption', icon: <Image size={20} />, desc: 'Visual content copy' },
];

interface Question {
  id: string;
  question: string;
  placeholder: string;
}

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
      if (!data.user) {
        window.location.href = '/signup';
      } else {
        setUserId(data.user.id);
      }
    });
  }, []);

  const stepIndex = { idea: 0, format: 1, questions: 2, result: 3 };
  const stepLabels = ['Your Idea', 'Format & Tone', 'AI Questions', 'Your Content'];

  const fetchQuestions = async () => {
    if (!rawIdea || !contentType || !userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/guided-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawIdea, contentType, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestions(data.questions || []);
      setStep('questions');
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions.');
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/guided-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawIdea, contentType, tone, questions, answers, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedContent(data.content);
      setEditedContent(data.content);
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Failed to generate content.');
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedContent : generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayContent = isEditing ? editedContent : generatedContent;
  const answeredCount = Object.values(answers).filter(Boolean).length;

  const toneColorMap: Record<string, { border: string; bg: string; text: string; sel: string }> = {
    purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-600', sel: 'border-purple-400' },
    pink: { border: 'border-pink-200', bg: 'bg-pink-50', text: 'text-pink-600', sel: 'border-pink-400' },
    orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-600', sel: 'border-orange-400' },
    violet: { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-600', sel: 'border-violet-400' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-pink-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-pink-600 hover:text-pink-800 transition-colors">
            <ArrowLeft size={18} />
          </a>
          <div className="text-2xl font-bold gradient-text">Eclatale</div>
        </div>
        <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-pink-100 text-pink-700 font-medium">
          <PenTool size={16} />
          Guided Creation
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Progress */}
        {step !== 'result' && (
          <div className="mb-10">
            <div className="flex gap-2 mb-2">
              {[0, 1, 2, 3].map((s) => (
                <div key={s} className="flex-1 h-2 rounded-full overflow-hidden bg-pink-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: s <= stepIndex[step] ? '100%' : '0%',
                      background: 'linear-gradient(135deg, #EC4899, #F97316)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              {stepLabels.map((label, i) => (
                <span key={i} className={`text-xs font-medium ${i <= stepIndex[step] ? 'text-pink-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Raw Idea */}
        {step === 'idea' && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-pink-100 text-pink-700 font-medium mb-4">
                <PenTool size={16} />
                Step 1
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                What's your <span className="gradient-text">idea</span>?
              </h2>
              <p className="text-gray-500 text-lg">
                Dump your rough thought — a story, a lesson, an observation. We'll shape it.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl shadow-pink-100/50 border-2 border-pink-100">
              <textarea
                value={rawIdea}
                onChange={(e) => setRawIdea(e.target.value)}
                placeholder="e.g., I just had a call with a client who was using 5 different tools to do what our product does in one. Made me think about how complexity kills productivity. Want to share this insight..."
                rows={6}
                className="w-full p-4 rounded-xl border-2 border-pink-200 bg-pink-50/30 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100 transition-all text-lg resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">{rawIdea.length} characters</span>
                <div className="flex gap-2">
                  {['A story from work', 'A lesson I learned', 'An industry trend', 'A hot take'].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => setRawIdea((prev) => prev ? prev : hint + ': ')}
                      className="text-xs px-3 py-1.5 rounded-full border border-pink-200 text-pink-600 hover:bg-pink-50 transition-all font-medium"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setStep('format')}
                disabled={rawIdea.length < 10}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-400/25 disabled:opacity-40 disabled:shadow-none"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Format & Tone */}
        {step === 'format' && (
          <div className="animate-fadeIn space-y-8">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-orange-100 text-orange-700 font-medium mb-4">
                <Sparkles size={16} />
                Step 2
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                How should it <span className="gradient-text">look & feel</span>?
              </h2>
              <p className="text-gray-500 text-lg">Pick the format and tone for your content.</p>
            </div>

            {/* Content Type */}
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-orange-100/50 border-2 border-orange-100">
              <label className="text-sm font-bold text-gray-700 mb-4 block flex items-center gap-2">
                <FileText size={16} className="text-orange-500" />
                Content format
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CONTENT_TYPES.map((ct) => {
                  const selected = contentType === ct.id;
                  return (
                    <button
                      key={ct.id}
                      onClick={() => setContentType(ct.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selected ? 'border-orange-400 bg-orange-50 shadow-md' : 'border-orange-200 hover:border-orange-300 bg-white'
                      }`}
                    >
                      <div className={`mx-auto mb-2 ${selected ? 'text-orange-600' : 'text-gray-400'}`}>{ct.icon}</div>
                      <div className="font-bold text-gray-900 text-sm">{ct.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{ct.desc}</div>
                      {selected && (
                        <div className="mt-2 mx-auto w-5 h-5 rounded-full gradient-bg flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tone */}
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-pink-100/50 border-2 border-pink-100">
              <label className="text-sm font-bold text-gray-700 mb-4 block flex items-center gap-2">
                <Heart size={16} className="text-pink-500" />
                Choose your tone
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TONES.map((t) => {
                  const selected = tone === t.id;
                  const c = toneColorMap[t.color];
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selected ? `${c.sel} ${c.bg} shadow-md` : `${c.border} bg-white`
                      }`}
                    >
                      <div className={`mx-auto mb-2 ${c.text}`}>{t.icon}</div>
                      <div className="font-bold text-gray-900 text-sm">{t.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
                      {selected && (
                        <div className="mt-2 mx-auto w-5 h-5 rounded-full gradient-bg flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Your Idea Preview */}
            <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-5 border-2 border-pink-100">
              <p className="text-xs font-bold text-pink-500 uppercase tracking-wide mb-2">Your idea</p>
              <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">{rawIdea}</p>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('idea')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-pink-600 border-2 border-pink-200 hover:bg-pink-50 transition-all"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                onClick={fetchQuestions}
                disabled={!contentType || !tone || loading}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-400/25 disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Thinking...</>
                ) : (
                  <><MessageSquare size={18} /> Get AI Questions</>
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Answer Questions */}
        {step === 'questions' && (
          <div className="animate-fadeIn space-y-6">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-purple-100 text-purple-700 font-medium mb-4">
                <MessageSquare size={16} />
                Step 3
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                Let's <span className="gradient-text">refine</span> your idea
              </h2>
              <p className="text-gray-500 text-lg">
                Answer these AI-generated questions to make your content stand out.
              </p>
            </div>

            <div className="space-y-4">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl p-6 shadow-lg shadow-purple-100/50 border-2 border-purple-100"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-sm font-bold">{i + 1}</span>
                    </div>
                    <label className="text-sm font-bold text-gray-800 leading-relaxed">
                      {q.question}
                    </label>
                  </div>
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                    rows={3}
                    className="w-full p-4 rounded-xl border-2 border-purple-200 bg-purple-50/30 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all resize-none"
                  />
                  {answers[q.id] && (
                    <div className="flex items-center gap-1 mt-2 text-green-600 text-xs font-medium">
                      <Check size={14} /> Answered
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border-2 border-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-purple-700">
                    {answeredCount} of {questions.length} answered
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Answer at least 1 to generate — more answers = better content
                  </p>
                </div>
                <div className="flex gap-1">
                  {questions.map((q) => (
                    <div
                      key={q.id}
                      className={`w-3 h-3 rounded-full transition-all ${
                        answers[q.id] ? 'gradient-bg' : 'bg-purple-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('format')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-purple-600 border-2 border-purple-200 hover:bg-purple-50 transition-all"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={answeredCount === 0 || loading}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-400/25 disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Crafting your content...</>
                ) : (
                  <><Sparkles size={18} /> Generate Content</>
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && (
          <div className="animate-fadeIn space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Your content is ready!</h3>
                  <p className="text-sm text-gray-500">
                    {displayContent.length} characters
                    {contentType === 'linkedin-post' && displayContent.length > 1300 && (
                      <span className="text-orange-500 ml-2">(over LinkedIn limit)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-pink-100 text-pink-600">
                  {TONES.find((t) => t.id === tone)?.label}
                </span>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-orange-100 text-orange-600">
                  {CONTENT_TYPES.find((ct) => ct.id === contentType)?.label}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl shadow-purple-200/30 border-2 border-purple-100">
              {isEditing ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full min-h-[300px] p-4 rounded-xl border-2 border-purple-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 focus:outline-none text-gray-800 leading-relaxed resize-y"
                />
              ) : (
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-[15px]">
                  {displayContent}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 border-purple-200 text-purple-700 hover:bg-purple-50 transition-all"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>

              <button
                onClick={() => {
                  if (isEditing) setGeneratedContent(editedContent);
                  setIsEditing(!isEditing);
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 transition-all ${
                  isEditing
                    ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                    : 'border-pink-200 text-pink-700 hover:bg-pink-50'
                }`}
              >
                <Edit3 size={18} />
                {isEditing ? 'Save Edit' : 'Edit'}
              </button>

              <button
                onClick={() => {
                  setGeneratedContent('');
                  setEditedContent('');
                  setStep('questions');
                  handleGenerate();
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 border-orange-200 text-orange-700 hover:bg-orange-50 transition-all"
              >
                <RefreshCw size={18} />
                Regenerate
              </button>

              <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-300/25">
                <Send size={18} />
                Post to LinkedIn
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  setStep('idea');
                  setRawIdea('');
                  setContentType('');
                  setTone('');
                  setQuestions([]);
                  setAnswers({});
                  setGeneratedContent('');
                  setEditedContent('');
                  setError('');
                }}
                className="text-sm text-gray-400 hover:text-pink-600 font-medium transition-colors"
              >
                Start over with a new idea
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
