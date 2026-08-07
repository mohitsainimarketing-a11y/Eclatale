import React, { useState } from 'react';
import { RefreshCw, PenLine, Check, TrendingUp, User, ShieldCheck, MessageCircle } from 'lucide-react';
import { Angle } from './types';

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

      <div className="flex items-center justify-between mb-3 pr-7">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: angle.badgeColor, color: angle.badgeTextColor }}
        >
          <span>{angle.styleEmoji}</span>{angle.style}
        </span>
        {angle.performanceStat && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: angle.performanceColor }}>
            <PerfIcon size={12} />{angle.performanceStat}
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
  userRole, userDomain, angles, loading, error, updatedAt,
  selectedAngleId, onSelectAngle, onRefresh,
  customInput, onCustomInputChange, voiceLabel, onContinue, canContinue,
}: Phase1Props) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-5 md:px-8 py-6" style={{ borderColor: '#EDE8FF' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span
              className="inline-block text-[11px] font-bold px-3 py-1 rounded-full mb-3"
              style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.12) 0%, rgba(247,37,133,0.12) 100%)', color: '#7C5CFC' }}
            >
              AI-curated for {userRole || 'you'} in {userDomain || 'your field'} · Updated {timeAgo(updatedAt)}
            </span>
            <h1 className="text-2xl md:text-[28px] font-extrabold" style={{ color: '#1A1A2E' }}>
              What will you post about{' '}
              <span style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                today?
              </span>
            </h1>
            <p className="text-[13px] mt-1.5" style={{ color: '#6B7280' }}>
              Pick an angle that resonates — each one shows why it works for your audience.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-full transition-all disabled:opacity-50"
            style={{ color: '#7C5CFC', border: '1.5px solid #EDE8FF' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            New angles
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-8 py-6">
        {error && !loading && (
          <div className="mb-4 text-[13px] font-medium px-4 py-3 rounded-xl" style={{ background: 'rgba(247,37,133,0.06)', color: '#F72585' }}>
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <AngleCardSkeleton key={i} />)
            : angles.map(angle => (
                <AngleCard key={angle.id} angle={angle} selected={selectedAngleId === angle.id} onClick={() => onSelectAngle(angle)} />
              ))}
        </div>

        {/* Custom input */}
        <div className="max-w-3xl mx-auto mt-4">
          <div
            className="flex items-center gap-3 px-4 py-3.5 transition-all"
            style={{ border: '1.5px dashed #D4CEFF', borderRadius: 12, background: customInput ? '#FDFCFF' : 'transparent' }}
          >
            <PenLine size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <input
              type="text"
              value={customInput}
              onChange={e => onCustomInputChange(e.target.value)}
              placeholder="Or describe what's on your mind — a reaction, a question you keep getting asked, something that happened..."
              className="flex-1 min-w-0 text-[13px] bg-transparent outline-none"
              style={{ color: '#1A1A2E' }}
            />
            <span className="text-[11px] font-medium whitespace-nowrap hidden sm:inline" style={{ color: '#9CA3AF' }}>or paste a URL</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t px-5 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: '#EDE8FF' }}>
        <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#6B7280' }}>
          <span style={{ color: '#10B981' }}>●</span> In your voice · {voiceLabel}
          <a href="/persona-setup" className="font-semibold ml-1" style={{ color: '#7C5CFC' }}>Edit →</a>
        </div>
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="text-[13px] font-bold text-white px-6 py-2.5 rounded-full transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.25)' }}
        >
          Write this post →
        </button>
      </div>
    </div>
  );
}
