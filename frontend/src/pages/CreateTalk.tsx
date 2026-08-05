import React, { useEffect, useState } from 'react';
import { ArrowLeft, Send, Loader2, ExternalLink, Sparkles, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import AppShell from '../components/AppShell';
import { apiFetch } from '../lib/apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const WRITING_STYLES = [
  { id: 'storyteller', emoji: '📖', label: 'Storyteller', desc: 'Personal story → insight → lesson' },
  { id: 'contrarian', emoji: '🔥', label: 'Contrarian', desc: 'Challenges the status quo with data' },
  { id: 'teacher', emoji: '🎓', label: 'The Teacher', desc: 'Breaks complex ideas into simple steps' },
  { id: 'insider', emoji: '🕵️', label: 'The Insider', desc: "Shares what others in industry won't" },
  { id: 'motivator', emoji: '💪', label: 'Motivator', desc: 'Inspires with energy and conviction' },
  { id: 'analyst', emoji: '📊', label: 'The Analyst', desc: 'Leads with data, backs everything' },
];

const LENGTH_OPTIONS = [
  { id: 'micro', emoji: '⚡', label: 'Micro', words: '50-150 words', desc: 'One idea. Maximum impact.' },
  { id: 'short', emoji: '📝', label: 'Short', words: '150-300 words', desc: 'Punchy. Scannable. Done.' },
  { id: 'standard', emoji: '📄', label: 'Standard', words: '300-500 words', desc: 'The LinkedIn sweet spot.' },
  { id: 'longform', emoji: '📚', label: 'Long-form', words: '500-800 words', desc: 'Deep dive. Full authority.' },
];

interface Source { title: string; url: string; domain: string; excerpt: string; publishedDate: string | null; trustScore: number; }

function trustColor(score: number): string {
  if (score >= 85) return 'text-brand-teal';
  if (score >= 65) return 'text-amber-500';
  return 'text-brand-muted';
}

export default function CreateTalk() {
  const [userId, setUserId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [trendingChips, setTrendingChips] = useState<string[]>([]);
  const [voiceChips, setVoiceChips] = useState<string[]>([]);
  const [lastTopic, setLastTopic] = useState('');

  const [topic, setTopic] = useState('');
  const [step, setStep] = useState<'input' | 'compose'>('input');
  const [researching, setResearching] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [clarifyingQuestion, setClarifyingQuestion] = useState('');
  const [clarifyingAnswer, setClarifyingAnswer] = useState('');
  const [style, setStyle] = useState<string | null>(null);
  const [length, setLength] = useState('standard');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templatePreview, setTemplatePreview] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) { window.location.href = '/login'; return; }
      setUserId(u.id);
      const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', u.id).single();
      setFirstName(profile?.first_name || '');

      const { data: lastPost } = await supabase.from('posts').select('topic').eq('user_id', u.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (lastPost?.topic) setLastTopic(lastPost.topic);

      const templateId = new URLSearchParams(window.location.search).get('template');
      if (templateId) {
        const { data: templatePost } = await supabase.from('posts').select('content').eq('id', templateId).eq('user_id', u.id).single();
        if (templatePost?.content) {
          setTemplateContent(templatePost.content);
          setTemplatePreview(templatePost.content.slice(0, 100));
        }
      }

      apiFetch(`${API_URL}/api/suggest-topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '', userId: u.id }),
      }).then(r => r.json()).then(d => {
        if (Array.isArray(d.topics)) {
          setTrendingChips(d.topics.filter((t: any) => t.trending).slice(0, 3).map((t: any) => t.topic));
          setVoiceChips(d.topics.filter((t: any) => !t.trending).slice(0, 2).map((t: any) => t.topic));
        }
      }).catch(() => {});
    });
  }, []);

  const startResearch = async (t: string) => {
    const finalTopic = t.trim();
    if (!finalTopic) return;
    setTopic(finalTopic);
    setError('');

    // Using an existing post as a structure template — skip fresh web research
    // and go straight to style/length; the template's structure does the work.
    if (templateContent) {
      setSources([]);
      setClarifyingQuestion('');
      setStep('compose');
      return;
    }

    setResearching(true);
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'create-talk-start', topic: finalTopic, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSources(data.sources || []);
      setClarifyingQuestion(data.clarifyingQuestion || '');
      setStep('compose');
    } catch (e: any) {
      setError(e.message || 'Something went wrong finding sources — you can still continue.');
      setStep('compose');
    }
    setResearching(false);
  };

  const handleGenerate = async () => {
    if (!style) return;
    setGenerating(true);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          action: 'create-talk-generate', topic, style, length, clarifyingAnswer, sources, userId,
          resourceContext: templateContent ? `Mimic the structure, pacing, and format of this reference post — but write entirely new content about the new topic:\n\n${templateContent}` : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const { data: inserted, error: insertErr } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic, tone: 'professional', content_type: 'linkedin-post', source: 'auto',
      }).select('id').single();
      if (insertErr || !inserted) throw new Error('Could not save the generated post.');
      window.location.href = `/create?postId=${inserted.id}`;
    } catch (e: any) {
      setError(e.message || 'Generation failed — please try again.');
      setGenerating(false);
    }
  };

  return (
    <AppShell mobileTitle="Talk to AI">
      <div className="min-h-screen gradient-bg-page">
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 flex items-center gap-3">
          <a href="/create" className="min-w-[36px] min-h-[36px] -ml-2 flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <span className="text-sm font-bold text-brand-dark flex items-center gap-1.5"><MessageIcon /> Talk to AI</span>
        </div>

        <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-12">
          {step === 'input' ? (
            <div className="animate-fadeIn">
              <h1 className="text-2xl font-extrabold text-brand-dark mb-6">
                Hi {firstName || 'there'} 👋 What would you like to write about today?
              </h1>
              {templatePreview && (
                <div className="mb-4 p-3 rounded-xl bg-[rgba(124,92,252,0.05)] border border-[rgba(124,92,252,0.15)] text-[12px] text-brand-dark">
                  <span className="font-semibold text-brand-purple">Using as structure reference: </span>
                  "{templatePreview}{templatePreview.length >= 100 ? '…' : ''}"
                </div>
              )}
              <div className="relative">
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); startResearch(topic); } }}
                  placeholder="Tell me anything... a topic, an idea, something that happened, a question you keep getting asked..."
                  className="input !text-[15px] !min-h-[120px] !resize-none w-full !leading-relaxed !pr-14"
                  autoFocus
                />
                <button onClick={() => startResearch(topic)} disabled={!topic.trim() || researching}
                  aria-label="Start"
                  className="absolute right-3 bottom-3 w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white disabled:opacity-40 transition-opacity">
                  {researching ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>

              <div className="mt-8 space-y-5">
                {trendingChips.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-brand-muted mb-2">Trending in your industry right now:</p>
                    <div className="flex flex-wrap gap-2">
                      {trendingChips.map((t, i) => (
                        <button key={i} onClick={() => startResearch(t)} className="text-[12px] font-medium px-3 py-2 rounded-xl border border-[rgba(124,92,252,0.15)] text-brand-dark hover:border-brand-purple/40 hover:bg-[rgba(124,92,252,0.03)] transition-colors text-left max-w-full">
                          🔥 {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {voiceChips.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-brand-muted mb-2">Based on your voice profile:</p>
                    <div className="flex flex-wrap gap-2">
                      {voiceChips.map((t, i) => (
                        <button key={i} onClick={() => startResearch(t)} className="text-[12px] font-medium px-3 py-2 rounded-xl border border-[rgba(124,92,252,0.15)] text-brand-dark hover:border-brand-purple/40 hover:bg-[rgba(124,92,252,0.03)] transition-colors text-left max-w-full">
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {lastTopic && (
                  <div>
                    <p className="text-[11px] font-semibold text-brand-muted mb-2">Continue from last time:</p>
                    <button onClick={() => startResearch(lastTopic)} className="text-[12px] font-medium px-3 py-2 rounded-xl border border-[rgba(124,92,252,0.15)] text-brand-dark hover:border-brand-purple/40 hover:bg-[rgba(124,92,252,0.03)] transition-colors">
                      {lastTopic}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-fadeIn space-y-8">
              <div>
                <p className="text-[11px] font-semibold text-brand-muted mb-1">Writing about</p>
                <p className="text-base font-bold text-brand-dark">{topic}</p>
              </div>

              {researching ? (
                <div className="flex items-center gap-2 text-sm text-brand-muted"><Loader2 size={14} className="animate-spin" /> Researching current sources…</div>
              ) : sources.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-brand-muted mb-2">Sources found</p>
                  <div className="space-y-2">
                    {sources.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl border border-[rgba(0,0,0,0.06)] hover:border-brand-purple/30 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[12px] font-bold text-brand-dark truncate">📰 {s.domain}</span>
                          <span className={`text-[11px] font-bold flex-shrink-0 ${trustColor(s.trustScore)}`}>{s.trustScore}</span>
                        </div>
                        <p className="text-[12px] text-brand-muted line-clamp-2">{s.excerpt || s.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-brand-muted">{s.publishedDate || ''}</span>
                          <ExternalLink size={10} className="text-brand-muted" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {clarifyingQuestion && (
                <div>
                  <p className="text-[13px] font-semibold text-brand-dark mb-2">{clarifyingQuestion}</p>
                  <input type="text" value={clarifyingAnswer} onChange={e => setClarifyingAnswer(e.target.value)}
                    placeholder="Your answer (optional)…" className="input !text-[13px]" />
                </div>
              )}

              <div>
                <p className="text-[12px] font-bold text-brand-dark mb-3">Choose a writing style</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {WRITING_STYLES.map(s => (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      className={`text-left p-3.5 rounded-2xl border transition-all ${style === s.id ? 'border-brand-purple bg-[rgba(124,92,252,0.06)]' : 'border-[rgba(0,0,0,0.08)] hover:border-brand-purple/30'}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{s.emoji}</span>
                        {style === s.id && <Check size={12} className="text-brand-purple ml-auto" />}
                      </div>
                      <p className="text-[12px] font-bold text-brand-dark">{s.label}</p>
                      <p className="text-[10px] text-brand-muted leading-snug mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[12px] font-bold text-brand-dark mb-3">Content length</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {LENGTH_OPTIONS.map(l => (
                    <button key={l.id} onClick={() => setLength(l.id)}
                      className={`text-left p-3 rounded-2xl border transition-all ${length === l.id ? 'border-brand-purple bg-[rgba(124,92,252,0.06)]' : 'border-[rgba(0,0,0,0.08)] hover:border-brand-purple/30'}`}>
                      <p className="text-[12px] font-bold text-brand-dark">{l.emoji} {l.label}</p>
                      <p className="text-[10px] text-brand-muted">{l.words} — {l.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-[12px] text-red-500">{error}</p>}

              <button onClick={handleGenerate} disabled={!style || generating}
                className="btn-primary w-full !py-3.5 text-sm disabled:opacity-40">
                {generating ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Sparkles size={15} /> Generate my post →</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MessageIcon() {
  return <span>💬</span>;
}
