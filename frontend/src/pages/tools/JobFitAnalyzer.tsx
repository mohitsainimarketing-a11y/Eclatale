import React, { useState } from 'react';
import { apiFetch } from '../../lib/apiFetch';

interface JobFitResult {
  matchScore: number;
  keywordMatchPct: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  profileSuggestions: { section: string; current: string; rewrite: string }[];
  coverLetterOpener: string;
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(124,92,252,0.08)" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="40" y="45" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1A1A2E">{score}</text>
      </svg>
      <span className="text-[11px] font-semibold text-brand-muted">{label}</span>
    </div>
  );
}

export default function JobFitAnalyzer() {
  const [profileText, setProfileText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<JobFitResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAnalyze() {
    if (!profileText.trim() || !jobDescription.trim()) {
      setError('Paste both your LinkedIn profile text and the job description.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch('/api/intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'job-fit-analyzer', profileText, jobDescription }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('Something went wrong. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  function scoreColor(score: number) {
    if (score >= 75) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  }

  function scoreLabel(score: number) {
    if (score >= 75) return 'Strong fit';
    if (score >= 50) return 'Partial fit';
    return 'Low fit';
  }

  async function copyOpener() {
    if (!result) return;
    await navigator.clipboard.writeText(result.coverLetterOpener);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-brand-dark mb-1.5">
            Your LinkedIn profile text
          </label>
          <textarea
            rows={10}
            value={profileText}
            onChange={e => setProfileText(e.target.value)}
            placeholder="Paste your headline, About section, experience, and skills here..."
            className="w-full text-sm border border-[rgba(124,92,252,0.15)] rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-brand-purple/40 bg-white text-brand-dark placeholder:text-brand-muted/60"
          />
          <p className="text-[11px] text-brand-muted mt-1">Tip: copy your full profile from LinkedIn and paste it here.</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-brand-dark mb-1.5">
            Job description
          </label>
          <textarea
            rows={10}
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            className="w-full text-sm border border-[rgba(124,92,252,0.15)] rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-brand-purple/40 bg-white text-brand-dark placeholder:text-brand-muted/60"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="btn-primary w-full md:w-auto !px-8 !py-3 text-sm font-bold disabled:opacity-60"
      >
        {loading ? 'Analyzing…' : 'Analyze fit'}
      </button>

      {result && (
        <div className="space-y-5 pt-2">
          {/* Score overview */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-brand-dark mb-4">Match overview</h3>
            <div className="flex items-center justify-around flex-wrap gap-4">
              <ScoreRing score={result.matchScore} label="Overall fit" color={scoreColor(result.matchScore)} />
              <ScoreRing score={result.keywordMatchPct} label="Keyword match" color={scoreColor(result.keywordMatchPct)} />
              <div className="text-center">
                <div className="text-2xl font-extrabold mb-0.5" style={{ color: scoreColor(result.matchScore) }}>
                  {scoreLabel(result.matchScore)}
                </div>
                <p className="text-[11px] text-brand-muted">
                  {result.matchedKeywords.length} of {result.matchedKeywords.length + result.missingKeywords.length} keywords matched
                </p>
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div className="grid md:grid-cols-2 gap-4">
            {result.matchedKeywords.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-bold text-brand-dark mb-3">Keywords you have</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.matchedKeywords.map((kw, i) => (
                    <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.missingKeywords.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-bold text-brand-dark mb-3">Keywords you are missing</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.missingKeywords.map((kw, i) => (
                    <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile suggestions */}
          {result.profileSuggestions.length > 0 && (
            <div className="card p-4 space-y-4">
              <p className="text-xs font-bold text-brand-dark">Profile improvements</p>
              {result.profileSuggestions.map((s, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-[11px] font-bold text-brand-purple uppercase tracking-wide">{s.section}</p>
                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-[rgba(239,68,68,0.04)] border border-red-100 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-red-400 mb-1">Current</p>
                      <p className="text-brand-dark/80 leading-relaxed">{s.current}</p>
                    </div>
                    <div className="bg-[rgba(16,185,129,0.04)] border border-emerald-100 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-emerald-600 mb-1">Suggested</p>
                      <p className="text-brand-dark leading-relaxed">{s.rewrite}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cover letter opener */}
          {result.coverLetterOpener && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-brand-dark">Cover letter opener</p>
                <button
                  onClick={copyOpener}
                  className="text-[11px] font-semibold text-brand-purple hover:underline"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-brand-dark leading-relaxed bg-[rgba(124,92,252,0.03)] border border-[rgba(124,92,252,0.1)] rounded-xl px-4 py-3">
                {result.coverLetterOpener}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
