import React, { useState } from 'react';
import { LoadingMessages, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

// ── Types ────────────────────────────────────────────────────────────────────

interface Result {
  overallScore: number;
  verdict: 'strong' | 'decent' | 'needs_work' | 'weak';
  hookScore: number;
  hookType: string;
  hookFeedback: string;
  structureScore: number;
  structureFeedback: string;
  engagementScore: number;
  engagementFeedback: string;
  algorithmScore: number;
  algorithmFeedback: string;
  ctaScore: number;
  ctaFeedback: string;
  estimatedReachTier: 'viral' | 'high' | 'medium' | 'low';
  strengths: string[];
  improvements: string[];
  charCount: number;
  wordCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'rgba(16,185,129,0.08)';
  if (score >= 50) return 'rgba(245,158,11,0.08)';
  return 'rgba(239,68,68,0.08)';
}

const VERDICT_CONFIG = {
  strong:     { label: 'Strong post',    bg: 'rgba(16,185,129,0.10)', color: '#10B981' },
  decent:     { label: 'Decent post',    bg: 'rgba(124,92,252,0.10)', color: '#7C5CFC' },
  needs_work: { label: 'Needs work',     bg: 'rgba(245,158,11,0.10)', color: '#F59E0B' },
  weak:       { label: 'Weak post',      bg: 'rgba(239,68,68,0.10)',  color: '#EF4444' },
};

const REACH_CONFIG = {
  viral:  { label: 'Viral potential',  bg: 'rgba(16,185,129,0.10)',  color: '#10B981',  desc: 'This post has the signals that drive outsized distribution.' },
  high:   { label: 'High reach',       bg: 'rgba(124,92,252,0.10)',  color: '#7C5CFC',  desc: 'Strong reach likely. Solid hook and structure.' },
  medium: { label: 'Medium reach',     bg: 'rgba(245,158,11,0.10)',  color: '#F59E0B',  desc: 'Typical reach for well-written posts. Room to grow.' },
  low:    { label: 'Low reach risk',   bg: 'rgba(239,68,68,0.10)',   color: '#EF4444',  desc: 'Several factors are limiting reach. See the fixes below.' },
};

const HOOK_TYPE_LABELS: Record<string, string> = {
  bold_statement: 'Bold statement',
  story:          'Story opener',
  statistic:      'Statistic',
  contrarian:     'Contrarian',
  list_preview:   'List preview',
  result_reveal:  'Result reveal',
  question:       'Question',
  none:           'No clear hook',
  unknown:        'Unknown type',
};

function charLengthLabel(chars: number): { label: string; color: string } {
  if (chars < 300)  return { label: 'Very short (under 300)',      color: '#EF4444' };
  if (chars < 600)  return { label: 'Short (300-600)',             color: '#F59E0B' };
  if (chars < 900)  return { label: 'Below sweet spot (600-900)', color: '#F59E0B' };
  if (chars <= 1300) return { label: 'Sweet spot (900-1,300)',     color: '#10B981' };
  if (chars <= 1800) return { label: 'Long (1,300-1,800)',         color: '#F59E0B' };
  return { label: 'Very long (1,800+)',                             color: '#EF4444' };
}

// ── Ring gauge (same pattern as ViralScoreChecker) ───────────────────────────

function RingGauge({ score }: { score: number }) {
  const r = 52; const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = scoreColor(score);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#F0EEF8" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 70 70)" />
      <text x="70" y="68" textAnchor="middle" fontSize="30" fontWeight="800" fill={color}>{score}</text>
      <text x="70" y="86" textAnchor="middle" fontSize="11" fill="#9CA3AF" fontWeight="600">out of 100</text>
    </svg>
  );
}

// ── Mini score bar ────────────────────────────────────────────────────────────

function DimensionRow({ label, score, feedback }: { label: string; score: number; feedback: string }) {
  const color = scoreColor(score);
  return (
    <div className="py-3 border-b last:border-b-0" style={{ borderColor: 'rgba(124,92,252,0.06)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold" style={{ color: '#1A1A2E' }}>{label}</span>
        <span className="text-[12px] font-extrabold" style={{ color }}>{score}</span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: '#F0EEF8' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      {feedback && <p className="text-[11px]" style={{ color: '#9CA3AF', lineHeight: 1.5 }}>{feedback}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LinkedInPostAnalyzer() {
  const [post, setPost] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const charCount = post.length;
  const lengthInfo = charLengthLabel(charCount);

  async function handleAnalyze() {
    const trimmed = post.trim();
    if (!trimmed || trimmed.length < 30) { setError('Please paste a post with at least 30 characters.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callTool('linkedin-post-analyzer', { post: trimmed });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  const verdict = result ? VERDICT_CONFIG[result.verdict] : null;
  const reach   = result ? REACH_CONFIG[result.estimatedReachTier] : null;

  return (
    <div>
      {/* Input */}
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
        Paste your LinkedIn post
      </label>
      <textarea
        value={post}
        onChange={e => setPost(e.target.value)}
        placeholder="Paste your full LinkedIn post here. The more complete it is, the more accurate the analysis."
        rows={9}
        className="input mt-2 resize-none"
        style={{ fontFamily: 'inherit', lineHeight: 1.6 }}
      />

      {/* Live char count */}
      <div className="flex items-center justify-between mt-1.5 mb-4">
        <span className="text-[11px] font-semibold" style={{ color: lengthInfo.color }}>
          {charCount} chars · {lengthInfo.label}
        </span>
        {charCount > 0 && charCount < 30 && (
          <span className="text-[11px]" style={{ color: '#9CA3AF' }}>Keep typing...</span>
        )}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || post.trim().length < 30}
        className="btn-primary w-full sm:w-auto"
      >
        {loading ? 'Analyzing...' : 'Analyze post'}
      </button>

      <ErrorNote message={error} />

      {loading && (
        <LoadingMessages messages={[
          'Reading your hook...', 'Checking mobile structure...', 'Scoring engagement signals...',
          'Checking 2026 algorithm fit...', 'Building your report...',
        ]} />
      )}

      {/* Results */}
      {result && verdict && reach && (
        <div className="mt-8 space-y-6">

          {/* Overall score + verdict + reach */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl" style={{ background: 'rgba(124,92,252,0.03)', border: '1.5px solid #EDE8FF' }}>
            <RingGauge score={result.overallScore} />
            <div className="flex-1 text-center sm:text-left">
              <span
                className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full mb-2"
                style={{ background: verdict.bg, color: verdict.color }}
              >
                {verdict.label}
              </span>
              <p className="text-[13px] mb-3" style={{ color: '#6B7280' }}>
                {result.wordCount} words · {result.charCount} characters
              </p>
              {/* Hook type badge */}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mr-2 mb-1" style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}>
                Hook: {HOOK_TYPE_LABELS[result.hookType] || result.hookType}
              </span>
              {/* Reach tier badge */}
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-1"
                style={{ background: reach.bg, color: reach.color }}
              >
                {reach.label}
              </span>
              <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>{reach.desc}</p>
            </div>
          </div>

          {/* 5 dimension scores */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #EDE8FF' }}>
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>5-dimension breakdown</p>
            </div>
            <div className="px-5 pb-4">
              <DimensionRow label="Hook strength"    score={result.hookScore}        feedback={result.hookFeedback} />
              <DimensionRow label="Mobile structure" score={result.structureScore}   feedback={result.structureFeedback} />
              <DimensionRow label="Engagement pull"  score={result.engagementScore}  feedback={result.engagementFeedback} />
              <DimensionRow label="Algorithm fit"    score={result.algorithmScore}   feedback={result.algorithmFeedback} />
              <DimensionRow label="Call to action"   score={result.ctaScore}         feedback={result.ctaFeedback} />
            </div>
          </div>

          {/* Strengths */}
          {result.strengths.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(16,185,129,0.05)', border: '1.5px solid rgba(16,185,129,0.15)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#10B981' }}>
                What this post does well
              </p>
              {result.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 mb-2 last:mb-0">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold" style={{ background: '#10B981', color: '#fff' }}>✓</span>
                  <p className="text-[13px]" style={{ color: '#1A1A2E', lineHeight: 1.55 }}>{s}</p>
                </div>
              ))}
            </div>
          )}

          {/* Improvements */}
          {result.improvements.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(124,92,252,0.03)', border: '1.5px solid #EDE8FF' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#7C5CFC' }}>
                Specific fixes, ranked by impact
              </p>
              {result.improvements.map((imp, i) => (
                <div key={i} className="flex items-start gap-2.5 mb-3 last:mb-0">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold"
                    style={{ background: 'linear-gradient(135deg,#7C5CFC,#F72585)', color: '#fff' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[13px]" style={{ color: '#1A1A2E', lineHeight: 1.55 }}>{imp}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quick meta stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Overall', value: result.overallScore, suffix: '/100' },
              { label: 'Characters', value: result.charCount, suffix: '' },
              { label: 'Words', value: result.wordCount, suffix: '' },
            ].map(({ label, value, suffix }) => (
              <div key={label} className="text-center rounded-xl py-3" style={{ background: scoreBg(label === 'Overall' ? result.overallScore : 75) }}>
                <p className="text-lg font-extrabold" style={{ color: '#1A1A2E' }}>{value}{suffix}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
