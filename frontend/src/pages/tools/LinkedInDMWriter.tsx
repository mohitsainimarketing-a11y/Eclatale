import React, { useState } from 'react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

const GOALS = ['Connect', 'Collaborate', 'Pitch', 'Get advice', 'Follow up'];

const GOAL_DESCRIPTIONS: Record<string, string> = {
  Connect: 'Warm intro, no pitch',
  Collaborate: 'Propose working together',
  Pitch: 'Soft sell, lead with their problem',
  'Get advice': 'One specific, easy-to-answer ask',
  'Follow up': 'After a post, comment, or event',
};

export default function LinkedInDMWriter() {
  const [recipientRole, setRecipientRole] = useState('');
  const [yourRole, setYourRole] = useState('');
  const [goal, setGoal] = useState(GOALS[0]);
  const [context, setContext] = useState('');
  const [dms, setDms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canGenerate = recipientRole.trim().length > 0 && yourRole.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError('');
    setDms([]);
    try {
      const data = await callTool('linkedin-dm-writer', {
        recipientRole: recipientRole.trim(),
        yourRole: yourRole.trim(),
        goal,
        context: context.trim(),
      });
      setDms(data.dms || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
            Who are you messaging?
          </label>
          <input
            value={recipientRole}
            onChange={e => setRecipientRole(e.target.value)}
            placeholder="e.g. VP of Sales at a SaaS startup"
            className="input mt-2"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
            Who are you?
          </label>
          <input
            value={yourRole}
            onChange={e => setYourRole(e.target.value)}
            placeholder="e.g. Founder of a recruiting agency"
            className="input mt-2"
          />
        </div>
      </div>

      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
        What's the goal?
      </label>
      <div className="mt-2 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {GOALS.map(g => (
          <button
            key={g}
            onClick={() => setGoal(g)}
            className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              goal === g
                ? 'border-brand-purple bg-[rgba(124,92,252,0.06)] text-brand-purple'
                : 'border-[rgba(124,92,252,0.12)] text-brand-muted hover:border-brand-purple/30 hover:text-brand-dark'
            }`}
          >
            <span className="font-bold block">{g}</span>
            <span className="text-xs font-normal">{GOAL_DESCRIPTIONS[g]}</span>
          </button>
        ))}
      </div>

      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
        Any context? (optional)
      </label>
      <textarea
        value={context}
        onChange={e => setContext(e.target.value)}
        placeholder="e.g. They just posted about struggling to hire SDRs. We met at SaaStr last month."
        rows={3}
        className="input mt-2 mb-5 resize-none"
      />

      <button
        onClick={handleGenerate}
        disabled={loading || !canGenerate}
        className="btn-primary w-full sm:w-auto"
      >
        {loading ? 'Writing DMs...' : 'Write 3 DM variations'}
      </button>

      <ErrorNote message={error} />

      {loading && (
        <LoadingMessages
          messages={[
            'Reading the situation...',
            'Drafting your angle...',
            'Making them sound human...',
          ]}
        />
      )}

      {dms.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-3">
            3 DM variations ready
          </p>
          {dms.map((dm, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)]"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-muted">
                  Variation {i + 1}
                </span>
                <CopyButton text={dm} />
              </div>
              <p className="text-sm text-brand-dark leading-relaxed whitespace-pre-wrap">{dm}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
