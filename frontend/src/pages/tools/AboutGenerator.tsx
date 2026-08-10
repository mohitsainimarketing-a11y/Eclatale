import React, { useState } from 'react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

const TONES = ['Professional', 'Conversational', 'Bold'];

export default function AboutGenerator() {
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [achievement, setAchievement] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canGenerate = role.trim() && industry.trim() && specialty.trim() && achievement.trim();

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true); setError(''); setContent('');
    try {
      const data = await callTool('about-generator', { role: role.trim(), industry: industry.trim(), specialty: specialty.trim(), achievement: achievement.trim(), tone });
      setContent(data.content || '');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">What's your role?</label>
          <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Head of Growth" className="input mt-2" />
        </div>
        <div>
          <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">What industry?</label>
          <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. B2B SaaS" className="input mt-2" />
        </div>
      </div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">What do you specialize in?</label>
      <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="e.g. Product-led growth for early-stage startups" className="input mt-2 mb-4" />
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">One key achievement or result</label>
      <input type="text" value={achievement} onChange={e => setAchievement(e.target.value)} placeholder="e.g. Grew signups 4x in 12 months at my last company" className="input mt-2 mb-4" />
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Tone</label>
      <select value={tone} onChange={e => setTone(e.target.value)} className="input mt-2 mb-5">
        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <button onClick={handleGenerate} disabled={loading || !canGenerate} className="btn-primary w-full sm:w-auto">
        {loading ? 'Generating...' : 'Generate About section'}
      </button>
      <ErrorNote message={error} />
      {loading && <LoadingMessages messages={['Reading your background...', 'Finding the hook...', 'Writing your About section...']} />}
      {content && (
        <div className="mt-6">
          <div className="p-5 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)] whitespace-pre-wrap text-sm text-brand-dark leading-relaxed">
            {content}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs font-semibold text-brand-muted">{content.length} / 1,500 chars</span>
            <CopyButton text={content} />
          </div>
        </div>
      )}
    </div>
  );
}
