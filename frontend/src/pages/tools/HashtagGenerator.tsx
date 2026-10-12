import React, { useState } from 'react';
import { LoadingMessages, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

interface HashtagResult { high: string[]; mid: string[]; niche: string[]; }

function HashtagGroup({ label, tags, color }: { label: string; tags: string[]; color: string }) {
  const [copied, setCopied] = useState(false);
  const allText = tags.join(' ');
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(allText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  if (!tags.length) return null;
  return (
    <div className="p-4 rounded-xl border border-[rgba(124,92,252,0.1)] bg-[rgba(124,92,252,0.03)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
          <span className="ml-2 text-[10px] text-brand-muted font-medium">{tags.length} tags</span>
        </div>
        <button onClick={handleCopy} className="btn-secondary !py-1.5 !px-3 text-xs">
          {copied ? 'Copied ✓' : 'Copy all'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <button
            key={i}
            onClick={() => navigator.clipboard.writeText(tag).catch(() => {})}
            title="Click to copy"
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80 active:scale-95"
            style={{ background: color + '15', color, border: `1px solid ${color}30` }}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HashtagGenerator() {
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState<HashtagResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callTool('hashtag-generator', { topic: topic.trim() });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const allTags = result ? [...(result.high || []), ...(result.mid || []), ...(result.niche || [])] : [];

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
        Your post topic or paste your post
      </label>
      <textarea
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder="e.g. Why most startups fail at hiring their first 10 engineers"
        rows={4}
        className="input mt-2 mb-5 resize-none"
      />
      <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="btn-primary w-full sm:w-auto">
        {loading ? 'Finding hashtags...' : 'Generate hashtags'}
      </button>
      <ErrorNote message={error} />
      {loading && <LoadingMessages messages={['Analyzing your topic...', 'Matching communities...', 'Balancing reach and niche...']} />}
      {result && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-brand-muted uppercase tracking-wide">{allTags.length} hashtags across 3 tiers</p>
            <button
              onClick={() => navigator.clipboard.writeText(allTags.join(' ')).catch(() => {})}
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              Copy all {allTags.length}
            </button>
          </div>
          <HashtagGroup label="High reach (1M+)" tags={result.high} color="#7C5CFC" />
          <HashtagGroup label="Mid range (100K-1M)" tags={result.mid} color="#F72585" />
          <HashtagGroup label="Niche community" tags={result.niche} color="#0EA5E9" />
        </div>
      )}
    </div>
  );
}
