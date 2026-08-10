import React, { useState } from 'react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

const GOALS = ['Comment', 'Follow', 'Connect', 'DM', 'Visit website', 'Share their experience'];

export default function CtaGenerator() {
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState(GOALS[0]);
  const [ctas, setCtas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setCtas([]);
    try {
      const data = await callTool('cta-generator', { topic: topic.trim(), goal });
      setCtas(data.ctas || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">What's your post about?</label>
      <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. How I structured my first product launch" rows={3} className="input mt-2 mb-4 resize-none" />
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">What do you want readers to do?</label>
      <select value={goal} onChange={e => setGoal(e.target.value)} className="input mt-2 mb-5">
        {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="btn-primary w-full sm:w-auto">
        {loading ? 'Generating...' : 'Generate CTAs'}
      </button>
      <ErrorNote message={error} />
      {loading && <LoadingMessages messages={['Reading your topic...', 'Matching CTAs to your goal...']} />}
      {ctas.length > 0 && (
        <div className="mt-6 space-y-3">
          {ctas.map((c, i) => (
            <div key={i} className="p-4 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)] flex items-start justify-between gap-3">
              <p className="text-sm text-brand-dark font-medium leading-relaxed">{c}</p>
              <CopyButton text={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
