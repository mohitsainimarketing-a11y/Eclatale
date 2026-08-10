import React, { useState } from 'react';
import { LoadingMessages, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

function scoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

const LABELS: Record<string, string> = {
  ready: 'Ready to publish ✓',
  needs_work: 'Needs work',
  low_reach: 'Low reach risk',
};

interface Result {
  viralScore: number; hookStrength: number; readability: number; engagementTriggers: number; lengthOptimization: number;
  label: string; improvements: string[];
}

function RingGauge({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = scoreColor(score);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#F0EEF8" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 70 70)"
      />
      <text x="70" y="76" textAnchor="middle" fontSize="32" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

export default function ViralScoreChecker() {
  const [post, setPost] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!post.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callTool('viral-score', { post: post.trim() });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const cutoffIdx = post.length > 210 ? (post.indexOf(' ', 210) === -1 ? post.length : post.indexOf(' ', 210)) : -1;

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Paste your LinkedIn post</label>
      <textarea value={post} onChange={e => setPost(e.target.value)} placeholder="Paste your full post here..." rows={8} className="input mt-2 mb-2 resize-none" />
      {cutoffIdx !== -1 && (
        <p className="text-xs text-brand-muted mb-3">"See more" cutoff hits at character 210 — {post.slice(0, 40)}... <span className="text-brand-purple font-semibold">| cutoff here</span></p>
      )}
      <button onClick={handleAnalyze} disabled={loading || !post.trim()} className="btn-primary w-full sm:w-auto mt-3">
        {loading ? 'Analyzing...' : 'Check viral score'}
      </button>
      <ErrorNote message={error} />
      {loading && <LoadingMessages messages={['Reading your hook...', 'Checking readability...', 'Scoring engagement triggers...']} />}
      {result && (
        <div className="mt-6">
          <div className="flex items-center gap-6 mb-6 flex-wrap">
            <RingGauge score={result.viralScore} />
            <div>
              <p className="text-lg font-bold" style={{ color: scoreColor(result.viralScore) }}>{LABELS[result.label] || result.label}</p>
              <p className="text-sm text-brand-muted">out of 100</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[['Hook strength', result.hookStrength], ['Readability', result.readability], ['Engagement triggers', result.engagementTriggers], ['Length optimization', result.lengthOptimization]].map(([label, score]) => (
              <div key={label as string} className="text-center p-3 rounded-xl bg-[rgba(124,92,252,0.04)]">
                <p className="text-lg font-bold" style={{ color: scoreColor(score as number) }}>{score}</p>
                <p className="text-[10px] text-brand-muted font-semibold leading-tight mt-1">{label}</p>
              </div>
            ))}
          </div>
          {result.improvements.length > 0 && (
            <div>
              <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">3 ways to improve</p>
              {result.improvements.map((imp, i) => (
                <p key={i} className="text-sm text-brand-dark mb-1.5">• {imp}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
