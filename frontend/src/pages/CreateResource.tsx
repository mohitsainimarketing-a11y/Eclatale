import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Check, Send, X, FileText, Link2, Upload, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import AppShell from '../components/AppShell';
import { apiFetch } from '../lib/apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const WRITING_STYLES = [
  { id: 'storyteller', emoji: '📖', label: 'Storyteller' },
  { id: 'contrarian', emoji: '🔥', label: 'Contrarian' },
  { id: 'teacher', emoji: '🎓', label: 'The Teacher' },
  { id: 'insider', emoji: '🕵️', label: 'The Insider' },
  { id: 'motivator', emoji: '💪', label: 'Motivator' },
  { id: 'analyst', emoji: '📊', label: 'The Analyst' },
];
const LENGTH_OPTIONS = [
  { id: 'micro', label: 'Micro', words: '50-150w' },
  { id: 'short', label: 'Short', words: '150-300w' },
  { id: 'standard', label: 'Standard', words: '300-500w' },
  { id: 'longform', label: 'Long-form', words: '500-800w' },
];

interface Resource { label: string; text: string; themes: string[]; angles: string[]; pageCount?: number; }
interface ChatMsg { role: 'user' | 'assistant'; content: string; }

export default function CreateResource() {
  const [userId, setUserId] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<string | null>(null);
  const [length, setLength] = useState('standard');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
    });
  }, []);

  const analyzeAndAdd = async (label: string, text: string, pageCount?: number) => {
    setProcessing(label);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'resource-analyze', resourceText: text, resourceLabel: label, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const resource: Resource = { label, text, themes: data.keyThemes || [], angles: data.angles || [], pageCount };
      setResources(prev => [...prev, resource]);
      setMessages(prev => [...prev, { role: 'assistant', content: data.openingLine || `I've read ${label}. What kind of post do you want to make from it?` }]);
    } catch (e: any) {
      setError(e.message || 'Could not analyze this resource.');
    }
    setProcessing(null);
  };

  const handleUrl = async () => {
    if (!urlInput.trim()) return;
    setProcessing(`Fetching ${urlInput}…`);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'fetch-url', url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      setProcessing(null);
      await analyzeAndAdd(data.domain || urlInput, data.text);
      setUrlInput('');
    } catch (e: any) {
      setProcessing(null);
      setError(e.message || "Couldn't fetch that URL — try pasting the text instead.");
    }
  };

  const handlePaste = async () => {
    if (!pasteInput.trim()) return;
    const text = pasteInput.trim();
    setPasteInput('');
    await analyzeAndAdd('Pasted text', text);
  };

  const handleFile = async (file: File) => {
    if (resources.length >= 3) { setError('Up to 3 resources per session.'); return; }
    setProcessing(`Reading ${file.name}…`);
    setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'resource-upload', fileBase64: base64, mimeType: file.type, filename: file.name, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProcessing(null);
      await analyzeAndAdd(`${file.name}${data.pageCount ? ` (${data.pageCount} pages)` : ''}`, data.text, data.pageCount);
    } catch (e: any) {
      setProcessing(null);
      setError(e.message || 'Could not read this file.');
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          action: 'resource-converse',
          resourceTexts: resources.map(r => r.text),
          history: messages,
          message: userMsg,
          userId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (!topic) setTopic(userMsg.slice(0, 140));
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I hit an error there — try again?" }]);
    }
    setChatBusy(false);
  };

  const handleGenerate = async () => {
    if (!style || !topic) return;
    setGenerating(true);
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/intelligence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          action: 'create-talk-generate', topic, style, length, userId,
          resourceContext: resources.map(r => `[${r.label}]\n${r.text}`).join('\n\n'),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const { data: inserted, error: insertErr } = await supabase.from('posts').insert({
        user_id: userId, content: data.content, topic, tone: 'professional', content_type: 'linkedin-post', source: 'repurpose',
      }).select('id').single();
      if (insertErr || !inserted) throw new Error('Could not save the generated post.');
      window.location.href = `/create?postId=${inserted.id}`;
    } catch (e: any) {
      setError(e.message || 'Generation failed.');
      setGenerating(false);
    }
  };

  return (
    <AppShell mobileTitle="Drop a Resource">
      <div className="min-h-screen gradient-bg-page">
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 flex items-center gap-3">
          <a href="/create" className="min-w-[36px] min-h-[36px] -ml-2 flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </a>
          <span className="text-sm font-bold text-brand-dark">📎 Drop a Resource</span>
        </div>

        <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-12 space-y-6">
          {resources.length === 0 ? (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-brand-purple bg-[rgba(124,92,252,0.04)]' : 'border-[rgba(124,92,252,0.2)] hover:border-brand-purple/40'}`}
              >
                {processing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={22} className="animate-spin text-brand-purple" />
                    <p className="text-sm text-brand-muted">{processing}</p>
                  </div>
                ) : (
                  <>
                    <Upload size={26} className="text-brand-purple mx-auto mb-3" />
                    <p className="text-sm font-semibold text-brand-dark mb-1">Drop anything here</p>
                    <p className="text-[12px] text-brand-muted">📄 PDF &nbsp; 📁 Document &nbsp; 📊 Spreadsheet &nbsp; 📝 Text</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.csv,.txt"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-brand-muted flex-shrink-0" />
                <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrl()}
                  placeholder="Or paste a URL…" className="input !text-[13px] flex-1" />
                <button onClick={handleUrl} disabled={!urlInput.trim() || !!processing} className="btn-secondary !py-2 !px-3 text-xs disabled:opacity-40">Fetch</button>
              </div>

              <div className="flex items-start gap-2">
                <FileText size={14} className="text-brand-muted flex-shrink-0 mt-2.5" />
                <textarea value={pasteInput} onChange={e => setPasteInput(e.target.value)}
                  placeholder="Or paste text directly…" className="input !text-[13px] !min-h-[80px] !resize-none flex-1" />
              </div>
              <button onClick={handlePaste} disabled={!pasteInput.trim() || !!processing} className="btn-primary w-full text-sm disabled:opacity-40">Use this text</button>

              {error && <p className="text-[12px] text-red-500">{error}</p>}
            </>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              {resources.map((r, i) => (
                <div key={i} className="card !p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-brand-teal" />
                    <span className="text-[13px] font-bold text-brand-dark">{r.label}</span>
                  </div>
                  {r.themes.length > 0 && (
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      <span className="font-semibold">Key themes:</span> {r.themes.join(' · ')}
                    </p>
                  )}
                </div>
              ))}

              {resources.length < 3 && (
                <div className="flex items-center gap-2">
                  <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrl()}
                    placeholder="Add another resource — paste a URL…" className="input !text-[12px] flex-1" />
                  <button onClick={handleUrl} disabled={!urlInput.trim() || !!processing} className="btn-secondary !py-2 !px-3 text-xs disabled:opacity-40">Add</button>
                  <button onClick={() => fileInputRef.current?.click()} className="btn-secondary !py-2 !px-3 text-xs">File</button>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.csv,.txt"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              )}
              {processing && <p className="text-[11px] text-brand-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> {processing}</p>}

              {/* Notebook conversation */}
              <div className="border-t border-[rgba(124,92,252,0.08)] pt-5">
                <div className="space-y-3 mb-4">
                  {messages.map((m, i) => (
                    <div key={i} className={`max-w-[85%] ${m.role === 'user' ? 'ml-auto' : ''}`}>
                      <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-brand-purple text-white' : 'bg-[rgba(124,92,252,0.05)] text-brand-dark'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatBusy && <Loader2 size={14} className="animate-spin text-brand-purple" />}
                </div>
                <div className="relative">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="e.g. Turn the 34% revenue stat into a post…"
                    className="input !text-[13px] !pr-10 w-full" />
                  <button onClick={sendChat} disabled={!chatInput.trim() || chatBusy} aria-label="Send"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white disabled:opacity-40">
                    <Send size={12} />
                  </button>
                </div>
                {messages.length > 0 && !showGenerate && (
                  <button onClick={() => setShowGenerate(true)} className="text-[12px] font-semibold text-brand-purple hover:underline mt-3">
                    Ready to write the post →
                  </button>
                )}
              </div>

              {showGenerate && (
                <div className="border-t border-[rgba(124,92,252,0.08)] pt-5 space-y-5 animate-fadeIn">
                  <div>
                    <label className="text-[11px] font-semibold text-brand-muted mb-1.5 block">What's the post about?</label>
                    <input type="text" value={topic} onChange={e => setTopic(e.target.value)} className="input !text-[13px]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-brand-dark mb-2">Writing style</p>
                    <div className="grid grid-cols-3 gap-2">
                      {WRITING_STYLES.map(s => (
                        <button key={s.id} onClick={() => setStyle(s.id)}
                          className={`text-center p-2.5 rounded-xl border text-[11px] font-semibold transition-all ${style === s.id ? 'border-brand-purple bg-[rgba(124,92,252,0.06)] text-brand-purple' : 'border-[rgba(0,0,0,0.08)] text-brand-dark'}`}>
                          {s.emoji} {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-brand-dark mb-2">Length</p>
                    <div className="grid grid-cols-4 gap-2">
                      {LENGTH_OPTIONS.map(l => (
                        <button key={l.id} onClick={() => setLength(l.id)}
                          className={`text-center py-2 rounded-xl border text-[11px] font-semibold transition-all ${length === l.id ? 'border-brand-purple bg-[rgba(124,92,252,0.06)] text-brand-purple' : 'border-[rgba(0,0,0,0.08)] text-brand-dark'}`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {error && <p className="text-[12px] text-red-500">{error}</p>}
                  <button onClick={handleGenerate} disabled={!style || !topic || generating} className="btn-primary w-full !py-3.5 text-sm disabled:opacity-40">
                    {generating ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Sparkles size={15} /> Generate my post →</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
