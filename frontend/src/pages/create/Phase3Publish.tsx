import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, Sparkles, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { Angle, GrowthJourneyResult, STAGE_META } from './types';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

function tipFor(criterionLabel: string): string {
  const l = criterionLabel.toLowerCase();
  if (l.includes('linkedin')) return 'Connect LinkedIn to start counting toward this stage.';
  if (l.includes('voice profile')) return 'Finish your voice profile — it only takes a couple minutes.';
  if (l.includes('streak')) return 'Post on consecutive days to build your streak faster.';
  return 'Keep publishing consistently — that\'s what moves this the most.';
}

interface Phase3Props {
  userId: string;
  publishedPostUrn: string;
  linkedinConnected: boolean;
  angles: Angle[];
  selectedAngle: Angle | null;
  onDraftTomorrow: (angle: Angle) => void;
  onMaybeLater: () => void;
}

export default function Phase3Publish({
  userId, publishedPostUrn, linkedinConnected, angles, selectedAngle, onDraftTomorrow, onMaybeLater,
}: Phase3Props) {
  const [journey, setJourney] = useState<GrowthJourneyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    apiFetch(`${API_URL}/api/intelligence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'growth-journey', userId }),
    }).then(async res => {
      const data = await res.json();
      if (!data.error) setJourney(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const stageMeta = STAGE_META[journey?.stage || 'unknown'];
  const nextStageMeta = journey?.nextStage ? STAGE_META[journey.nextStage] : null;
  const primaryCriterion = journey?.criteria?.[0];

  const tomorrowAngle = angles.find(a => a.id !== selectedAngle?.id) || angles[0] || null;

  const linkedinUrl = publishedPostUrn
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(publishedPostUrn)}`
    : '';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white flex justify-center px-5 py-10">
      <div className="w-full max-w-[520px]">
        {/* Celebration header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <CheckCircle2 size={40} style={{ color: '#10B981' }} />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>You're live on LinkedIn 🎉</h1>
          <p className="text-[13px]" style={{ color: '#9CA3AF' }}>Post published · Your audience can see it now.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center bg-white rounded-[14px] py-4" style={{ border: '1.5px solid #EDE8FF' }}>
            <p className="text-xl font-extrabold" style={{ color: '#1A1A2E' }}>{loading ? '—' : `${journey?.metrics.currentStreak ?? 0} 🔥`}</p>
            <p className="text-[10px] font-semibold mt-1" style={{ color: '#9CA3AF' }}>Day streak</p>
          </div>
          <div className="text-center bg-white rounded-[14px] py-4" style={{ border: '1.5px solid #EDE8FF' }}>
            <p className="text-xl font-extrabold" style={{ color: '#1A1A2E' }}>{loading ? '—' : stageMeta.emoji}</p>
            <p className="text-[10px] font-semibold mt-1" style={{ color: '#9CA3AF' }}>{stageMeta.label}</p>
          </div>
          <div className="text-center bg-white rounded-[14px] py-4" style={{ border: '1.5px solid #EDE8FF' }}>
            <p className="text-xl font-extrabold" style={{ color: '#1A1A2E' }}>{loading ? '—' : journey?.metrics.postsPublished ?? 0}</p>
            <p className="text-[10px] font-semibold mt-1" style={{ color: '#9CA3AF' }}>Total posts</p>
          </div>
        </div>

        {/* Progress to next stage */}
        {!loading && journey && nextStageMeta && primaryCriterion && (
          <div className="bg-white rounded-[14px] p-4 mb-4" style={{ border: '1.5px solid #EDE8FF' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold" style={{ color: '#1A1A2E' }}>
                Progress to {nextStageMeta.label} {nextStageMeta.emoji}
              </p>
              <p className="text-[12px] font-bold" style={{ color: '#7C5CFC' }}>
                {Math.min(primaryCriterion.current, primaryCriterion.target)} / {primaryCriterion.target} posts
              </p>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#F0EEF8' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (primaryCriterion.current / Math.max(1, primaryCriterion.target)) * 100)}%`,
                  background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)',
                }}
              />
            </div>
            <p className="text-[11px] mt-2" style={{ color: '#9CA3AF' }}>
              {Math.max(0, primaryCriterion.target - primaryCriterion.current)} more posts to unlock {nextStageMeta.label} · {tipFor(primaryCriterion.label)}
            </p>
          </div>
        )}
        {!loading && journey && !nextStageMeta && (
          <div className="rounded-[14px] p-4 mb-4 text-center" style={{ background: 'rgba(16,185,129,0.06)' }}>
            <p className="text-[12px] font-bold" style={{ color: '#10B981' }}>You've reached the top stage — Icon 👑</p>
          </div>
        )}

        {/* Reply prompt */}
        {linkedinConnected && publishedPostUrn && (
          <div className="rounded-[14px] p-4 mb-4" style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-[13px] font-bold flex items-center gap-1.5 mb-1" style={{ color: '#F59E0B' }}>
              <Clock size={14} /> Reply to comments in the next 30 minutes
            </p>
            <p className="text-[12px] mb-2" style={{ color: '#6B7280', lineHeight: 1.5 }}>
              Responding early gets 64% more comments and 2.3× more views. Your post is at peak visibility right now.
            </p>
            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="text-[12px] font-bold flex items-center gap-1" style={{ color: '#7C5CFC' }}>
              Open post on LinkedIn <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Tomorrow's angle */}
        {tomorrowAngle && (
          <div className="bg-white rounded-[14px] p-4" style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}>
            <p className="text-[12px] font-bold flex items-center gap-1.5 mb-3" style={{ color: '#1A1A2E' }}>
              <Sparkles size={14} style={{ color: '#7C5CFC' }} /> Tomorrow's angle — ready while you're in the flow
            </p>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-2"
              style={{ background: tomorrowAngle.badgeColor, color: tomorrowAngle.badgeTextColor }}
            >
              {tomorrowAngle.styleEmoji} {tomorrowAngle.style}
            </span>
            <p className="text-[13px] mb-4" style={{ color: '#1A1A2E', lineHeight: 1.6 }}>{tomorrowAngle.hook}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onDraftTomorrow(tomorrowAngle)}
                className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-white py-2.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.25)' }}
              >
                Draft this now <ArrowRight size={14} />
              </button>
              <button onClick={onMaybeLater} className="text-[12px] font-semibold py-1.5" style={{ color: '#9CA3AF' }}>
                Maybe later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
