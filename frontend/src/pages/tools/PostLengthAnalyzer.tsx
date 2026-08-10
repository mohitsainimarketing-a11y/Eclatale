import React, { useState, useMemo } from 'react';

const ZONES = [
  { min: 0, max: 300, label: 'Too short for reach', color: '#EF4444' },
  { min: 300, max: 600, label: 'Dead zone — avoid', color: '#F59E0B' },
  { min: 600, max: 900, label: 'Acceptable', color: '#7C5CFC' },
  { min: 900, max: 1300, label: 'Sweet spot 🔥 — 3.07× viral rate', color: '#10B981' },
  { min: 1300, max: 2000, label: 'Good for long-form', color: '#7C5CFC' },
  { min: 2000, max: Infinity, label: 'May feel long', color: '#F59E0B' },
];
const SCALE_MAX = 2400;

export default function PostLengthAnalyzer() {
  const [post, setPost] = useState('');

  const stats = useMemo(() => {
    const charCount = post.length;
    const wordCount = post.trim() ? post.trim().split(/\s+/).filter(Boolean).length : 0;
    const zone = ZONES.find(z => charCount >= z.min && charCount < z.max) || ZONES[ZONES.length - 1];
    const avgCharsPerWord = wordCount > 0 ? charCount / wordCount : 5.5;
    const charsToSweetSpot = charCount < 900 ? 900 - charCount : 0;
    const wordsToSweetSpot = Math.ceil(charsToSweetSpot / avgCharsPerWord);
    return { charCount, wordCount, zone, wordsToSweetSpot };
  }, [post]);

  const markerPct = Math.min(98, (stats.charCount / SCALE_MAX) * 100);
  const cutoffPct = (210 / SCALE_MAX) * 100;

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Paste your LinkedIn post</label>
      <textarea value={post} onChange={e => setPost(e.target.value)} placeholder="Paste your full post here..." rows={8} className="input mt-2 mb-6 resize-none" />

      <div className="flex items-end gap-6 mb-5 flex-wrap">
        <div>
          <p className="text-4xl font-extrabold text-brand-dark">{stats.charCount}</p>
          <p className="text-xs text-brand-muted font-semibold">characters</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-brand-dark">{stats.wordCount}</p>
          <p className="text-xs text-brand-muted font-semibold">words</p>
        </div>
      </div>

      <p className="text-sm font-bold mb-3" style={{ color: stats.zone.color }}>{stats.zone.label}</p>

      <div className="relative h-8 rounded-full overflow-hidden flex mb-2">
        {ZONES.map((z, i) => {
          const width = ((Math.min(z.max, SCALE_MAX) - z.min) / SCALE_MAX) * 100;
          return <div key={i} style={{ width: `${width}%`, background: z.color, opacity: z === stats.zone ? 1 : 0.25 }} />;
        })}
        {post.length > 0 && (
          <div className="absolute top-[-4px] w-1 h-10 bg-brand-dark rounded-full" style={{ left: `${markerPct}%` }} title="Your post" />
        )}
        <div className="absolute top-[-2px] w-0.5 h-8 bg-white/70" style={{ left: `${cutoffPct}%` }} title="'See more' cutoff (210 chars)" />
      </div>
      <p className="text-[11px] text-brand-muted mb-6">
        "See more" cutoff hits at 210 characters (dashed marker) · your post at {stats.charCount} chars
      </p>

      {stats.wordsToSweetSpot > 0 && post.trim() && (
        <p className="text-sm text-brand-dark">
          Add about <span className="font-bold text-brand-purple">{stats.wordsToSweetSpot} more words</span> to reach the 900-1,300 character sweet spot.
        </p>
      )}
      {stats.charCount >= 900 && stats.charCount <= 1300 && (
        <p className="text-sm font-semibold text-green-600">You're in the algorithm sweet spot.</p>
      )}
    </div>
  );
}
