import React, { useState } from 'react';
import { ChevronDown, Clock, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { IndustryIntelligenceResult, HOOK_TYPE_TO_ANGLE_STYLE, AngleStyle } from './types';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const BAR_COLORS = ['#7C5CFC', '#F72585', '#118AB2', '#06D6A0', '#FF6B35'];

interface Props {
  userId: string;
  userDomain: string;
  userRole: string;
  onTopicClick: (topic: string) => void;
  onStyleFilterChange: (style: AngleStyle | null) => void;
  activeStyleFilter: AngleStyle | null;
}

export default function IndustryIntelligencePanel({ userId, userDomain, userRole, onTopicClick, onStyleFilterChange, activeStyleFilter }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<IndustryIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !fetched && userId) {
      setLoading(true);
      setFetched(true);
      try {
        const res = await apiFetch(`${API_URL}/api/create/industry-intelligence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ userId }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (e: any) {
        setError(e.message || "Couldn't load industry intelligence.");
      }
      setLoading(false);
    }
  };

  const handleHookTypeClick = (type: string) => {
    const mapped = HOOK_TYPE_TO_ANGLE_STYLE[type];
    if (!mapped) return;
    onStyleFilterChange(activeStyleFilter === mapped ? null : mapped);
  };

  return (
    <div className="max-w-3xl mx-auto mt-4">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-[13px] font-bold w-full py-2"
        style={{ color: '#7C5CFC' }}
      >
        📊 What's working in {userDomain || 'your field'} this week
        <ChevronDown size={14} className="transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
      </button>

      {expanded && (
        <div className="rounded-2xl p-5 mt-1" style={{ background: '#FDFCFF', border: '1.5px solid #EDE8FF' }}>
          {loading && (
            <div className="space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-4/5 rounded" />
              <div className="skeleton h-4 w-3/5 rounded" />
            </div>
          )}
          {error && !loading && <p className="text-[13px]" style={{ color: '#F72585' }}>{error}</p>}
          {data && !loading && (
            <div className="space-y-6">
              {/* Top hook types */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: '#9CA3AF' }}>
                  Top hook types for {userRole || 'your role'} in {userDomain}
                  {data.dataSource === 'estimated' && <span className="font-normal normal-case"> · industry research estimate</span>}
                </p>
                <div className="space-y-2">
                  {data.topHookTypes.map((h, i) => {
                    const mapped = HOOK_TYPE_TO_ANGLE_STYLE[h.type];
                    const active = mapped && activeStyleFilter === mapped;
                    return (
                      <button
                        key={h.type}
                        onClick={() => handleHookTypeClick(h.type)}
                        disabled={!mapped}
                        className="w-full text-left group"
                        style={{ cursor: mapped ? 'pointer' : 'default' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: active ? BAR_COLORS[i % BAR_COLORS.length] : '#1A1A2E' }}>
                            {h.type} {mapped && <span className="text-[10px] font-normal" style={{ color: '#9CA3AF' }}>{active ? '(showing only these)' : '(click to filter)'}</span>}
                          </span>
                          <span className="text-[12px] font-bold" style={{ color: '#6B7280' }}>{h.percentage}%</span>
                        </div>
                        <div className="h-2 rounded-full w-full" style={{ background: '#F0EEF8' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${h.percentage}%`, background: BAR_COLORS[i % BAR_COLORS.length], opacity: active || !activeStyleFilter ? 1 : 0.35 }}
                          />
                        </div>
                        {h.relativePerformance && <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{h.relativePerformance}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Best length */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9CA3AF' }}>Best content length</p>
                <p className="text-[13px]" style={{ color: '#1A1A2E' }}>{data.bestLength.insight}</p>
              </div>

              {/* Best times */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9CA3AF' }}>Best posting times</p>
                <p className="text-[13px] flex items-center gap-1.5" style={{ color: '#1A1A2E' }}>
                  <Clock size={13} style={{ color: '#7C5CFC' }} />
                  {data.bestTimes.map(t => `${t.day} ${t.time}`).join(' and ')}
                </p>
              </div>

              {/* Trending topics */}
              {data.trendingTopics.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Trending topics this week</p>
                  <div className="flex flex-wrap gap-2">
                    {data.trendingTopics.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => onTopicClick(t.topic)}
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                        style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}
                      >
                        <Sparkles size={11} />{t.topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Structure insight */}
              {data.topStructureInsight && (
                <div className="pt-1 border-t" style={{ borderColor: '#F0EEF8' }}>
                  <p className="text-[12px] pt-3" style={{ color: '#6B7280', lineHeight: 1.6 }}>{data.topStructureInsight}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
