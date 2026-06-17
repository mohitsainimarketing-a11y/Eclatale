import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Sparkles, Search, Copy, RefreshCw, Edit3, Send,
  Briefcase, Coffee, Heart, BarChart3, Check, Loader2,
  FileText, MessageCircle, Image, Globe
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const TONES = [
  { id: 'professional', label: 'Professional', icon: <Briefcase size={24} />, desc: 'Polished & authoritative', color: 'purple' },
  { id: 'casual', label: 'Casual', icon: <Coffee size={24} />, desc: 'Conversational & relatable', color: 'pink' },
  { id: 'inspirational', label: 'Inspirational', icon: <Heart size={24} />, desc: 'Uplifting & motivational', color: 'orange' },
  { id: 'data-driven', label: 'Data-Driven', icon: <BarChart3 size={24} />, desc: 'Facts & analytics first', color: 'violet' },
];

const CONTENT_TYPES = [
  { id: 'linkedin-post', label: 'LinkedIn Post', icon: <Globe size={20} />, desc: 'Short-form thought leadership' },
  { id: 'linkedin-article', label: 'LinkedIn Article', icon: <FileText size={20} />, desc: 'Long-form deep dive' },
  { id: 'twitter-thread', label: 'Twitter Thread', icon: <MessageCircle size={20} />, desc: 'Multi-tweet storytelling' },
  { id: 'instagram-caption', label: 'Instagram Caption', icon: <Image size={20} />, desc: 'Visual content copy' },
];

export default function CreatePost() {
  const [userId, setUserId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('');
  const [contentType, setContentType] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
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

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!userId) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`${API_URL}/api/suggest-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, userId }),
      });
      const data = await res.json();
      if (data.topics) setSuggestions(data.topics);
    } catch {
      setSuggestions([]);
    }
    setLoadingSuggestions(false);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (topic.length >= 2) {
        fetchSuggestions(topic);
        setShowSuggestions(true);
      } else if (topic.length === 0 && showSuggestions) {
        fetchSuggestions('');
        setShowSuggestions(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [topic, fetchSuggestions, showSuggestions]);

  const handleGenerate = async () => {
    if (!topic || !tone || !contentType || !userId) return;
    setIsGenerating(true);
    setError('');
    setGeneratedContent('');

    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone, contentType, userId }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedContent(data.content);
      setEditedContent(data.content);
    } catch (err: any) {
      setError(err.message || 'Failed to generate. Please try again.');
    }

    setIsGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedContent : generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canGenerate = topic && tone && contentType && !isGenerating;
  const displayContent = isEditing ? editedContent : generatedContent;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-purple-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium transition-colors">
            <ArrowLeft size={18} />
          </a>
          <div className="text-2xl font-bold gradient-text">Eclatale</div>
        </div>
        <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-purple-100 text-purple-700 font-medium">
          <Sparkles size={16} />
          AI Content Engine
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Create <span className="gradient-text">Magnetic</span> Content
          </h1>
          <p className="text-gray-500 text-lg">
            AI-powered content tailored to your voice, role, and audience.
          </p>
        </div>

        {!generatedContent ? (
          <div className="space-y-8 animate-fadeIn">
            {/* Topic Input */}
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-purple-100/50 border-2 border-purple-100">
              <label className="text-sm font-bold text-gray-700 mb-3 block flex items-center gap-2">
                <Sparkles size={16} className="text-purple-500" />
                What do you want to write about?
              </label>
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length === 0) fetchSuggestions(topic);
                    setShowSuggestions(true);
                  }}
                  placeholder="e.g., How AI is changing hiring in 2026..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-purple-200 bg-purple-50/30 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all text-lg"
                />
                {loadingSuggestions && (
                  <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 animate-spin" />
                )}
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Trending in your industry</p>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setTopic(s);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-xl border border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm text-gray-700 font-medium flex items-center gap-3"
                    >
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-xs text-purple-600 font-bold">
                        {i + 1}
                      </span>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tone Selector */}
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-purple-100/50 border-2 border-pink-100">
              <label className="text-sm font-bold text-gray-700 mb-4 block flex items-center gap-2">
                <Heart size={16} className="text-pink-500" />
                Choose your tone
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TONES.map((t) => {
                  const selected = tone === t.id;
                  const colorMap: Record<string, { border: string; bg: string; text: string; selectedBorder: string }> = {
                    purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-600', selectedBorder: 'border-purple-400' },
                    pink: { border: 'border-pink-200', bg: 'bg-pink-50', text: 'text-pink-600', selectedBorder: 'border-pink-400' },
                    orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-600', selectedBorder: 'border-orange-400' },
                    violet: { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-600', selectedBorder: 'border-violet-400' },
                  };
                  const c = colorMap[t.color];
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selected
                          ? `${c.selectedBorder} ${c.bg} shadow-md`
                          : `${c.border} hover:${c.selectedBorder} hover:shadow-sm bg-white`
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

            {/* Content Type */}
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-purple-100/50 border-2 border-orange-100">
              <label className="text-sm font-bold text-gray-700 mb-4 block flex items-center gap-2">
                <FileText size={16} className="text-orange-500" />
                Content type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CONTENT_TYPES.map((ct) => {
                  const selected = contentType === ct.id;
                  return (
                    <button
                      key={ct.id}
                      onClick={() => setContentType(ct.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selected
                          ? 'border-orange-400 bg-orange-50 shadow-md'
                          : 'border-orange-200 hover:border-orange-300 bg-white'
                      }`}
                    >
                      <div className={`mx-auto mb-2 ${selected ? 'text-orange-600' : 'text-gray-400'}`}>
                        {ct.icon}
                      </div>
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

            {/* Generate Button */}
            <div className="text-center">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="inline-flex items-center gap-3 px-10 py-4 rounded-xl font-bold text-white gradient-bg hover:opacity-90 transition-all shadow-xl shadow-purple-400/25 disabled:opacity-40 disabled:shadow-none text-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    Generating your content...
                  </>
                ) : (
                  <>
                    <Sparkles size={22} />
                    Generate Content
                  </>
                )}
              </button>
              {!canGenerate && !isGenerating && (
                <p className="text-sm text-gray-400 mt-3">
                  Fill in topic, tone, and content type to generate
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}
          </div>
        ) : (
          /* Result Display */
          <div className="animate-fadeIn space-y-6">
            {/* Result Header */}
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
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-100 text-purple-600">
                  {TONES.find(t => t.id === tone)?.label}
                </span>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-orange-100 text-orange-600">
                  {CONTENT_TYPES.find(ct => ct.id === contentType)?.label}
                </span>
              </div>
            </div>

            {/* Content Card */}
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

            {/* Action Buttons */}
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
                  if (isEditing) {
                    setGeneratedContent(editedContent);
                  }
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
                  handleGenerate();
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 border-orange-200 text-orange-700 hover:bg-orange-50 transition-all"
              >
                <RefreshCw size={18} />
                Regenerate
              </button>

              <button
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-300/25"
              >
                <Send size={18} />
                Post to LinkedIn
              </button>
            </div>

            {/* Start Over */}
            <div className="text-center">
              <button
                onClick={() => {
                  setGeneratedContent('');
                  setEditedContent('');
                  setTopic('');
                  setTone('');
                  setContentType('');
                  setSuggestions([]);
                  setError('');
                }}
                className="text-sm text-gray-400 hover:text-purple-600 font-medium transition-colors"
              >
                Start over with a new topic
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
