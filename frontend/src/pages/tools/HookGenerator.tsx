import React, { useState } from 'react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

const STYLES = ['Contrarian', 'Question', 'Bold Stat', 'Story opener', 'List preview', 'Surprising fact'];

export default function HookGenerator() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState(STYLES[0]);
  const [hooks, setHooks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setHooks([]);
    try {
      const data = await callTool('hook-generator', { topic: topic.trim(), style });
      setHooks(data.hooks || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">What's your post about?</label>
      <textarea
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder="e.g. Why most startups fail at hiring"
        rows={3}
        className="input mt-2 mb-4 resize-none"
      />
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Hook style</label>
      <select value={style} onChange={e => setStyle(e.target.value)} className="input mt-2 mb-5">
        {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="btn-primary w-full sm:w-auto">
        {loading ? 'Generating...' : 'Generate hooks'}
      </button>
      <ErrorNote message={error} />
      {loading && <LoadingMessages messages={['Studying your topic...', 'Drafting hooks...', 'Sharpening the openers...']} />}
      {hooks.length > 0 && (
        <div className="mt-6 space-y-3">
          {hooks.map((h, i) => (
            <div key={i} className="p-4 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)] flex items-start justify-between gap-3">
              <p className="text-sm text-brand-dark font-medium leading-relaxed">{h}</p>
              <CopyButton text={h} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
