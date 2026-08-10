import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

function scoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

interface Result {
  totalScore: number; clarity: number; keywords: number; specificity: number; valueProposition: number;
  whatsWorking: string[]; improvements: string[]; alternatives: string[];
}

export default function HeadlineAnalyzer() {
  const [headline, setHeadline] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!headline.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callTool('headline-analyzer', { headline: headline.trim() });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const subScores = result ? [
    ['Clarity', result.clarity], ['Keywords', result.keywords],
    ['Specificity', result.specificity], ['Value proposition', result.valueProposition],
  ] as const : [];

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Paste your current LinkedIn headline</label>
      <input
        type="text"
        value={headline}
        onChange={e => setHeadline(e.target.value)}
        placeholder="e.g. Marketing Manager at Acme Inc"
        className="input mt-2 mb-5"
      />
      <button onClick={handleAnalyze} disabled={loading || !headline.trim()} className="btn-primary w-full sm:w-auto">
        {loading ? 'Analyzing...' : 'Analyze headline'}
      </button>
      <ErrorNote message={error} />
      {loading && <LoadingMessages messages={['Reading your headline...', 'Scoring clarity and keywords...', 'Drafting alternatives...']} />}
      {result && (
        <div className="mt-6">
          <div className="flex items-center gap-6 mb-6">
            <div className="text-5xl font-extrabold" style={{ color: scoreColor(result.totalScore) }}>{result.totalScore}</div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {subScores.map(([label, score]) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold" style={{ color: scoreColor(score * 4) }}>{score}/25</p>
                  <p className="text-[11px] text-brand-muted font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {result.whatsWorking.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">What's working</p>
              {result.whatsWorking.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-sm text-brand-dark mb-1.5"><CheckCircle2 size={15} className="text-green-500 mt-0.5 flex-shrink-0" />{w}</p>
              ))}
            </div>
          )}
          {result.improvements.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">What to improve</p>
              {result.improvements.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-sm text-brand-dark mb-1.5"><AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />{w}</p>
              ))}
            </div>
          )}

          {result.alternatives.length > 0 && (
            <div>
              <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">3 rewritten alternatives</p>
              <div className="space-y-2.5">
                {result.alternatives.map((alt, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)] flex items-center justify-between gap-3">
                    <p className="text-sm text-brand-dark font-medium">{alt}</p>
                    <CopyButton text={alt} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
