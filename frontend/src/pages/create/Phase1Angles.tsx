import React, { useState, useMemo } from 'react';
import { RefreshCw, PenLine, Check, TrendingUp, User, ShieldCheck, MessageCircle } from 'lucide-react';
import { Angle, AngleStyle } from './types';
import IndustryIntelligencePanel from './IndustryIntelligencePanel';

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

function AngleCard({ angle, selected, onClick }: { angle: Angle; selected: boolean; onClick: () => void }) {
  const PerfIcon = PERF_ICONS[angle.performanceIcon] || TrendingUp;
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="relative bg-white cursor-pointer transition-all"
      style={{
        borderRadius: 14,
        padding: 16,
        border: selected ? '2px solid #7C5CFC' : '1.5px solid #EDE8FF',
        boxShadow: selected ? '0 8px 32px rgba(124,92,252,0.18)' : '0 4px 24px rgba(124,92,252,0.08)',
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = '#ADA8F0'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,92,252,0.10)'; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = '#EDE8FF'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,92,252,0.08)'; } }}
    >
      <div
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all"
        style={selected ? { background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' } : { opacity: 0 }}
      >
        {selected && <Check size={13} color="white" strokeWidth={3} />}
      </div>

      <div className="flex items-center gap-2 mb-3 pr-7 min-w-0">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: angle.badgeColor, color: angle.badgeTextColor }}
        >
          <span>{angle.styleEmoji}</span>{angle.style}
        </span>
        {angle.performanceStat && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold min-w-0 truncate" style={{ color: angle.performanceColor }}>
            <PerfIcon size={12} className="flex-shrink-0" /><span className="truncate">{angle.performanceStat}</span>
          </span>
        )}
      </div>

      <p className="text-[13px] mb-2" style={{ color: '#1A1A2E', lineHeight: 1.65 }}>{angle.hook}</p>

      <p className="text-[10px] pt-2" style={{ color: '#9CA3AF', borderTop: '1px solid #F0EEF8' }}>{angle.insight}</p>
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
  userId, userRole, userDomain, angles, loading, error, updatedAt,
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
      {/* Header — ultra compact on mobile */}
      <div className="bg-white border-b px-4 md:px-8 py-2 md:py-5" style={{ borderColor: '#EDE8FF' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[15px] md:text-[26px] font-extrabold leading-tight" style={{ color: '#1A1A2E' }}>
              What will you post{' '}
              <span style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                today?
              </span>
            </h1>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
              AI-curated for {userRole || 'you'} in {userDomain || 'your field'} · {timeAgo(updatedAt)}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all disabled:opacity-50 flex-shrink-0"
            style={{ color: '#7C5CFC', border: '1.5px solid #EDE8FF' }}
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Cards — scrollable middle */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-3 md:py-6">
        {error && !loading && (
          <div className="mb-3 text-[12px] font-medium px-3 py-2 rounded-xl" style={{ background: 'rgba(247,37,133,0.06)', color: '#F72585' }}>
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <AngleCardSkeleton key={i} />)
            : filteredAngles.map(angle => (
                <AngleCard key={angle.id} angle={angle} selected={selectedAngleId === angle.id} onClick={() => onSelectAngle(angle)} />
              ))}
        </div>
        {!loading && !error && angles.length === 0 && (
          <div className="max-w-3xl mx-auto mb-3 px-4 py-4 rounded-2xl text-center" style={{ background: 'rgba(124,92,252,0.04)', border: '1.5px dashed rgba(124,92,252,0.2)' }}>
            <p className="text-[13px] font-semibold text-brand-dark mb-1">Couldn't load AI angles right now</p>
            <p className="text-[12px] text-brand-muted mb-3">Type your own topic below, or try refreshing.</p>
            <button onClick={onRefresh} className="text-[12px] font-bold text-brand-purple hover:underline">↻ Refresh angles</button>
          </div>
        )}
        {!loading && styleFilter && filteredAngles === angles && (
          <p className="text-center text-[11px] max-w-3xl mx-auto -mt-1 mb-2" style={{ color: '#9CA3AF' }}>
            No {styleFilter} angles right now. Showing all styles instead.
          </p>
        )}

        <IndustryIntelligencePanel
          userId={userId}
          userDomain={userDomain}
          userRole={userRole}
          onTopicClick={onCustomInputChange}
          onStyleFilterChange={setStyleFilter}
          activeStyleFilter={styleFilter}
        />
      </div>

      {/* Footer — input + CTA together so keyboard never hides the button */}
      <div className="bg-white border-t" style={{ borderColor: '#EDE8FF' }}>
        {/* Custom input row */}
        <div className="px-4 md:px-8 pt-2.5 pb-1">
          <div
            className="flex items-center gap-2 px-3 py-2.5 transition-all"
            style={{ border: '1.5px dashed #D4CEFF', borderRadius: 10, background: customInput ? '#FDFCFF' : 'transparent' }}
          >
            <PenLine size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
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
        {/* CTA row */}
        <div className="px-4 md:px-8 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-[11px] font-medium min-w-0" style={{ color: '#6B7280' }}>
            <span style={{ color: '#10B981' }}>●</span>
            <span className="truncate">{voiceLabel}</span>
            <a href="/persona-setup" className="font-semibold ml-1 flex-shrink-0" style={{ color: '#7C5CFC' }}>Edit →</a>
          </div>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="text-[13px] font-bold text-white px-5 py-2.5 rounded-full transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.25)' }}
          >
            Write this post →
          </button>
        </div>
      </div>
    </div>
  );
}
