import React, { useState, useMemo } from 'react';

const AVERAGE = 3.85;

function tierFor(rate: number): { label: string; color: string; tips: string[] } {
  if (rate < 1) return {
    label: 'Below average — here\'s why', color: '#EF4444',
    tips: [
      'Your hook likely isn\'t stopping the scroll — rewrite the first 1-2 lines.',
      'Add a clear question or opinion that invites a reply, not just a like.',
      'Post when your audience is actually online — try Tuesday or Thursday mornings.',
    ],
  };
  if (rate < 3) return {
    label: 'Below average — here\'s why', color: '#F59E0B',
    tips: [
      'Break up long paragraphs — LinkedIn rewards scannable posts.',
      'End with a specific, easy-to-answer question instead of a generic CTA.',
      'Add one concrete detail (a number, a name, a date) to make it feel real.',
    ],
  };
  if (rate < 5) return {
    label: 'At average', color: '#7C5CFC',
    tips: [
      'You\'re doing the basics right — now sharpen your hook to push past average.',
      'Try a more specific or contrarian angle on your next few posts.',
      'Reply to every comment in the first 30 minutes to boost distribution further.',
    ],
  };
  if (rate < 8) return {
    label: 'Above average 🔥', color: '#10B981',
    tips: [
      'This is working — study your last 3 posts and repeat the pattern.',
      'Consider turning your best-performing post into a carousel for more reach.',
      'Post consistently at this cadence — algorithms reward reliability.',
    ],
  };
  return {
    label: 'Exceptional', color: '#10B981',
    tips: [
      'This is elite-tier engagement — double down on whatever you just did.',
      'Repurpose this post\'s angle into a follow-up or a deeper dive.',
      'Engage with everyone who comments — this is peak distribution window.',
    ],
  };
}

export default function EngagementCalculator() {
  const [impressions, setImpressions] = useState('');
  const [reactions, setReactions] = useState('');
  const [commentsReposts, setCommentsReposts] = useState('');

  const rate = useMemo(() => {
    const imp = Number(impressions), r = Number(reactions), cr = Number(commentsReposts);
    if (!imp || imp <= 0) return null;
    return ((r + cr) / imp) * 100;
  }, [impressions, reactions, commentsReposts]);

  const tier = rate !== null ? tierFor(rate) : null;
  const barPct = rate !== null ? Math.min(100, (rate / 10) * 100) : 0;
  const avgPct = (AVERAGE / 10) * 100;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Total impressions</label>
          <input type="number" min={0} value={impressions} onChange={e => setImpressions(e.target.value)} placeholder="e.g. 4200" className="input mt-2" />
        </div>
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Total reactions</label>
          <input type="number" min={0} value={reactions} onChange={e => setReactions(e.target.value)} placeholder="e.g. 110" className="input mt-2" />
        </div>
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Comments + reposts</label>
          <input type="number" min={0} value={commentsReposts} onChange={e => setCommentsReposts(e.target.value)} placeholder="e.g. 24" className="input mt-2" />
        </div>
      </div>

      {rate !== null && tier && (
        <div>
          <div className="flex items-end gap-3 mb-2">
            <p className="text-4xl font-extrabold" style={{ color: tier.color }}>{rate.toFixed(2)}%</p>
            <p className="text-sm font-bold pb-1.5" style={{ color: tier.color }}>{tier.label}</p>
          </div>
          <p className="text-xs text-brand-muted mb-4">Your rate vs LinkedIn 2026 average ({AVERAGE}%)</p>

          <div className="relative h-3 rounded-full bg-[#F0EEF8] mb-1 overflow-visible">
            <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: tier.color }} />
            <div className="absolute top-[-6px] w-0.5 h-6 bg-brand-dark" style={{ left: `${avgPct}%` }} title="2026 average" />
          </div>
          <p className="text-[10px] text-brand-muted mb-6">↑ marker shows the {AVERAGE}% average</p>

          <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">Tips for your situation</p>
          {tier.tips.map((t, i) => <p key={i} className="text-sm text-brand-dark mb-1.5">• {t}</p>)}
        </div>
      )}
    </div>
  );
}
