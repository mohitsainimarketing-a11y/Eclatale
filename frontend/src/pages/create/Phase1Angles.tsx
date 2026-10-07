import React, { useState, useMemo } from 'react';
import { RefreshCw, PenLine, Check, TrendingUp, User, ShieldCheck, MessageCircle } from 'lucide-react';
import { Angle, AngleStyle, Source } from './types';

const PERF_ICONS: Record<string, React.ComponentType<any>> = {
  'trending-up': TrendingUp,
  user: User,
  'shield-check': ShieldCheck,
  'message-circle': MessageCircle,
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'just now';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
}

const STYLE_ACCENT: Record<string, string> = {
  Contrarian: '#F72585',
  Story: '#7C5CFC',
  Data: '#0EA5E9',
  Practical: '#10B981',
  'Hot Take': '#F59E0B',
  Authority: '#6366F1',
  Insight: '#8B5CF6',
};

function AngleCard({ angle, selected, onClick }: { angle: Angle; selected: boolean; onClick: () => void }) {
  const PerfIcon = PERF_ICONS[angle.performanceIcon] || TrendingUp;
  const accent = STYLE_ACCENT[angle.style] || '#7C5CFC';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="cursor-pointer h-full flex flex-col overflow-hidden"
      style={{
        borderRadius: 20,
        border: selected ? `2px solid ${accent}` : '1.5px solid #E8E2FF',
        background: '#fff',
        boxShadow: selected
          ? `0 8px 32px ${accent}22, 0 2px 8px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.07)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {/* Colored top accent bar */}
      <div style={{
        height: 4,
        background: selected
          ? `linear-gradient(90deg, ${accent}, ${accent}BB)`
          : `linear-gradient(90deg, ${accent}50, ${accent}10)`,
        flexShrink: 0,
        transition: 'background 0.2s',
      }} />

      <div className="flex flex-col flex-1 p-4">
        {/* Badge row */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: angle.badgeColor, color: angle.badgeTextColor }}
            >
              {angle.styleEmoji} {angle.style}
            </span>
            {angle.performanceStat && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold truncate" style={{ color: angle.performanceColor }}>
                <PerfIcon size={10} className="flex-shrink-0" />
                <span className="truncate">{angle.performanceStat}</span>
              </span>
            )}
          </div>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={selected
              ? { background: accent, boxShadow: `0 2px 8px ${accent}60` }
              : { background: '#F0EEF8' }}
          >
            {selected && <Check size={12} color="white" strokeWidth={3} />}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#F4F0FF', marginBottom: 12, flexShrink: 0 }} />

        {/* Hook */}
        <p className="flex-1" style={{ fontSize: 15, fontWeight: 600, color: '#111827', lineHeight: 1.6 }}>
          {angle.hook}
        </p>

        {/* Insight */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F4F0FF', flexShrink: 0 }}>
          <p style={{ fontSize: 11.5, color: '#A0A0B0', lineHeight: 1.5 }}>{angle.insight}</p>
          <div className="flex items-center justify-between mt-2">
            <span style={{ fontSize: 10.5, fontWeight: 600, color: selected ? accent : '#C4BAF0' }}>
              {selected ? 'Selected' : 'Tap to select'}
            </span>
            {selected && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${accent}15`, color: accent }}>
                <Check size={9} strokeWidth={3} /> Ready
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AngleCardSkeleton() {
  return (
    <div className="bg-white" style={{ borderRadius: 14, padding: 16, border: '1.5px solid #EDE8FF' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-5 w-20 rounded-full" />
        <div className="skeleton h-4 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3 w-full rounded mb-1.5" />
      <div className="skeleton h-3 w-4/5 rounded mb-3" />
      <div className="skeleton h-2.5 w-3/5 rounded" />
    </div>
  );
}

interface Phase1Props {
  userId: string;
  userRole: string;
  userDomain: string;
  angles: Angle[];
  sources: Source[];
  loading: boolean;
  error: string;
  updatedAt: string | null;
  selectedAngleId: string | null;
  onSelectAngle: (angle: Angle) => void;
  onRefresh: () => void;
  customInput: string;
  onCustomInputChange: (v: string) => void;
  voiceLabel: string;
  onContinue: () => void;
  canContinue: boolean;
}

export default function Phase1Angles({
  userId, userRole, userDomain, angles, sources, loading, error, updatedAt,
  selectedAngleId, onSelectAngle, onRefresh,
  customInput, onCustomInputChange, voiceLabel, onContinue, canContinue,
}: Phase1Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [styleFilter, setStyleFilter] = useState<AngleStyle | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const filteredAngles = useMemo(() => {
    if (!styleFilter) return angles;
    const matches = angles.filter(a => a.style === styleFilter);
    return matches.length > 0 ? matches : angles;
  }, [angles, styleFilter]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-8 py-3 md:py-5" style={{ borderColor: '#EDE8FF' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[17px] md:text-[26px] font-extrabold leading-tight" style={{ color: '#1A1A2E' }}>
              What will you post{' '}
              <span style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                today?
              </span>
            </h1>
            {sources.length > 0 ? (
              <p className="text-[11px] mt-0.5 font-medium truncate" style={{ color: '#B0A8D0' }}>
                Sourced from{' '}
                <span style={{ color: '#7C5CFC' }}>
                  {sources.slice(0, 3).map(s => s.domain.replace(/^www\./, '')).join(', ')}
                </span>
              </p>
            ) : (
              <p className="text-[11px] mt-0.5 font-medium truncate" style={{ color: '#B0A8D0' }}>
                Trend-grounded for {userRole || 'you'} in {userDomain || 'your field'}
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-full transition-all disabled:opacity-50 flex-shrink-0"
            style={{ color: '#7C5CFC', background: 'rgba(124,92,252,0.07)', border: '1.5px solid rgba(124,92,252,0.12)' }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 flex flex-col md:overflow-y-auto">
        {error && !loading && (
          <div className="mx-4 mt-3 text-[12px] font-medium px-3 py-2 rounded-xl flex-shrink-0" style={{ background: 'rgba(247,37,133,0.06)', color: '#F72585' }}>
            {error}
          </div>
        )}

        {/* Mobile: full-height swipe, one card at a time */}
        <div className="md:hidden flex-1 min-h-0 flex flex-col" style={{ background: '#F4F0FF' }}>
          <div
            className="flex-1 min-h-0 flex gap-4 overflow-x-auto snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', padding: '16px 20px 12px' }}
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 snap-center h-full" style={{ width: 'calc(88vw)', borderRadius: 22, padding: 20, background: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(237,232,255,0.9)' }}>
                    <AngleCardSkeleton />
                  </div>
                ))
              : filteredAngles.map(angle => (
                  <div key={angle.id} className="flex-shrink-0 snap-center h-full" style={{ width: 'calc(88vw)' }}>
                    <AngleCard angle={angle} selected={selectedAngleId === angle.id} onClick={() => onSelectAngle(angle)} />
                  </div>
                ))
            }
          </div>
          {/* Dots */}
          {!loading && filteredAngles.length > 1 && (
            <div className="flex justify-center items-center gap-2 pb-3 flex-shrink-0">
              {filteredAngles.map(a => (
                <span
                  key={a.id}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: selectedAngleId === a.id ? 20 : 6,
                    height: 6,
                    background: selectedAngleId === a.id
                      ? 'linear-gradient(90deg, #7C5CFC, #F72585)'
                      : 'rgba(124,92,252,0.2)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop: 2-col grid */}
        <div className="hidden md:block px-8 py-6">
          <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <AngleCardSkeleton key={i} />)
              : filteredAngles.map(angle => (
                  <AngleCard key={angle.id} angle={angle} selected={selectedAngleId === angle.id} onClick={() => onSelectAngle(angle)} />
                ))}
          </div>
        </div>

        {!loading && !error && angles.length === 0 && (
          <div className="mx-4 mb-3 px-4 py-4 rounded-2xl text-center" style={{ background: 'rgba(124,92,252,0.04)', border: '1.5px dashed rgba(124,92,252,0.2)' }}>
            <p className="text-[13px] font-semibold text-brand-dark mb-1">Couldn't load AI angles right now</p>
            <p className="text-[12px] text-brand-muted mb-3">Type your own topic below, or try refreshing.</p>
            <button onClick={onRefresh} className="text-[12px] font-bold text-brand-purple hover:underline">↻ Refresh angles</button>
          </div>
        )}
        {!loading && styleFilter && filteredAngles === angles && (
          <p className="text-center text-[11px] mb-2" style={{ color: '#9CA3AF' }}>
            No {styleFilter} angles right now. Showing all styles instead.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t" style={{ borderColor: '#EDE8FF' }}>
        <div className="px-4 md:px-8 pt-3 pb-1">
          <div
            className="flex items-center gap-2 px-3.5 py-3 transition-all"
            style={{
              border: customInput ? '1.5px solid #ADA8F0' : '1.5px dashed #D4CEFF',
              borderRadius: 14,
              background: customInput ? '#FDFCFF' : 'rgba(124,92,252,0.02)',
            }}
          >
            <PenLine size={15} style={{ color: customInput ? '#7C5CFC' : '#9CA3AF', flexShrink: 0 }} />
            <input
              type="text"
              value={customInput}
              onChange={e => onCustomInputChange(e.target.value)}
              placeholder="Or type your own topic, idea, or paste a URL..."
              className="flex-1 min-w-0 text-[13px] bg-transparent outline-none"
              style={{ color: '#1A1A2E' }}
            />
          </div>
        </div>
        <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-[11px] font-medium min-w-0" style={{ color: '#9CA3AF' }}>
            <span style={{ color: '#10B981', fontSize: 8 }}>●</span>
            <span className="truncate">{voiceLabel}</span>
            <a href="/persona-setup" className="font-semibold ml-1 flex-shrink-0" style={{ color: '#7C5CFC' }}>Edit</a>
          </div>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="text-[14px] font-bold text-white px-6 py-3 rounded-2xl transition-all disabled:opacity-40 flex-shrink-0"
            style={{
              background: canContinue
                ? 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)'
                : 'linear-gradient(135deg, #C4BAF0 0%, #F0A0C0 100%)',
              boxShadow: canContinue ? '0 6px 20px rgba(124,92,252,0.30)' : 'none',
            }}
          >
            Write this post →
          </button>
        </div>
      </div>
    </div>
  );
}
