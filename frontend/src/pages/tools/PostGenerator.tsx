import React, { useState } from 'react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

const STYLES = [
  { id: 'contrarian', label: 'Contrarian' },
  { id: 'storyteller', label: 'Storyteller' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'insider', label: 'Insider' },
  { id: 'motivator', label: 'Motivator' },
];
const LENGTHS = [
  { id: 'short', label: 'Short' },
  { id: 'standard', label: 'Standard' },
  { id: 'longform', label: 'Long' },
];

export default function PostGenerator() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState(STYLES[0].id);
  const [length, setLength] = useState('standard');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setContent('');
    try {
      const data = await callTool('post-generator', { topic: topic.trim(), style, length });
      setContent(data.content || '');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const wordCount = content ? content.trim().split(/\s+/).length : 0;

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">What do you want to write about?</label>
      <textarea
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder="e.g. Lessons from my first year as a manager"
        rows={3}
        className="input mt-2 mb-4 resize-none"
      />
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Style</label>
          <select value={style} onChange={e => setStyle(e.target.value)} className="input mt-2">
            {STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Length</label>
          <select value={length} onChange={e => setLength(e.target.value)} className="input mt-2">
            {LENGTHS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="btn-primary w-full sm:w-auto">
        {loading ? 'Generating...' : 'Generate post'}
      </button>
      <ErrorNote message={error} />
      {loading && <LoadingMessages messages={['Finding the angle...', 'Writing the hook...', 'Building the post...', 'Almost ready...']} />}
      {content && (
        <div className="mt-6">
          <div className="p-5 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)] whitespace-pre-wrap text-sm text-brand-dark leading-relaxed">
            {content}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs font-semibold text-brand-muted">{wordCount} words · {content.length} chars</span>
            <CopyButton text={content} />
          </div>
          <p className="text-xs text-brand-muted mt-4">
            This is a generic demo. <a href="/signup" className="text-brand-purple font-semibold hover:underline">Generate unlimited posts in your own voice on Eclatale →</a>
          </p>
        </div>
      )}
    </div>
  );
}
