import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface PersonalBestHook { hookType: string; avgHookStrength: number; exampleHook: string; postCount: number; }
interface HookTemplate { text: string; performanceBadge: string; }
interface IndustryHookCategory { type: string; templates: HookTemplate[]; }
interface TrendingHook { hook: string; why: string; }
interface HookLibraryResult {
  personalBest: PersonalBestHook[];
  industryTemplates: IndustryHookCategory[];
  trending: TrendingHook[];
}

function BracketText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[') && p.endsWith(']')
          ? <span key={i} style={{ color: '#7C5CFC', fontWeight: 700 }}>{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

const BADGE_COLOR: Record<string, string> = {
  'High reach': '#10B981', 'High comments': '#7C5CFC', 'High saves': '#F59E0B',
};

interface Props {
  userId: string;
  userRole: string;
  userDomain: string;
  onInsert: (text: string) => void;
}

export default function HookLibraryPanel({ userId, userRole, userDomain, onInsert }: Props) {
  const [data, setData] = useState<HookLibraryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiFetch(`${API_URL}/api/create/hooks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userId }),
    }).then(async res => {
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    }).catch(e => setError(e.message || "Couldn't load the hook library.")).finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl z-20 modal-shadow w-[380px] max-h-[420px] overflow-y-auto p-3">
      {loading && (
        <div className="space-y-2 p-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-3 w-3/5 rounded" />
        </div>
      )}
      {error && !loading && <p className="text-[12px] p-2" style={{ color: '#F72585' }}>{error}</p>}
      {data && !loading && (
        <div className="space-y-5">
          {/* Section 1: personal best */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide px-1 mb-2" style={{ color: '#9CA3AF' }}>Your best-performing hook patterns</p>
            {data.personalBest.length === 0 ? (
              <p className="text-[11px] px-1" style={{ color: '#9CA3AF' }}>Not enough post history yet — this fills in as you publish more.</p>
            ) : (
              <div className="space-y-1.5">
                {data.personalBest.map((p, i) => (
                  <button key={i} onClick={() => onInsert(p.exampleHook)} className="block w-full text-left px-2.5 py-2 rounded-lg hover:bg-[rgba(124,92,252,0.06)]">
                    <p className="text-[12px] font-semibold" style={{ color: '#1A1A2E' }}>
                      Your {p.hookType} hooks average hook strength {p.avgHookStrength}/100 <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({p.postCount} posts)</span>
                    </p>
                    {p.exampleHook && <p className="text-[11px] mt-0.5 italic" style={{ color: '#6B7280' }}>"{p.exampleHook}"</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: industry templates */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide px-1 mb-2" style={{ color: '#9CA3AF' }}>
              Proven hooks for {userRole || 'your role'}s in {userDomain || 'your industry'}
            </p>
            <div className="space-y-3">
              {data.industryTemplates.map(cat => (
                <div key={cat.type}>
                  <p className="text-[10px] font-bold px-1 mb-1" style={{ color: '#7C5CFC' }}>{cat.type.toUpperCase()}</p>
                  {cat.templates.map((t, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.04)] group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] leading-snug"><BracketText text={t.text} /></p>
                        <span className="inline-block text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-full" style={{ background: `${BADGE_COLOR[t.performanceBadge]}1A`, color: BADGE_COLOR[t.performanceBadge] }}>
                          {t.performanceBadge}
                        </span>
                      </div>
                      <button onClick={() => onInsert(t.text)} className="text-[10px] font-bold flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#7C5CFC' }}>
                        Use this →
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: trending */}
          {data.trending.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide px-1 mb-2 flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                <Sparkles size={11} /> Today's trending hooks
              </p>
              <div className="space-y-1.5">
                {data.trending.map((t, i) => (
                  <button key={i} onClick={() => onInsert(t.hook)} className="block w-full text-left px-2.5 py-2 rounded-lg hover:bg-[rgba(124,92,252,0.06)]">
                    <p className="text-[12px] font-semibold" style={{ color: '#1A1A2E' }}>{t.hook}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{t.why}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
