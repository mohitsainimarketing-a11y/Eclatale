import React from 'react';
import { X, RotateCcw, Clock } from 'lucide-react';

export interface PostVersion {
  id: string;
  content: string;
  label: string | null;
  created_at: string;
}

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  versions: PostVersion[];
  currentContent: string;
  onRestore: (version: PostVersion) => void;
  onSaveCurrent: () => void;
  isSaving?: boolean;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function VersionHistoryDrawer({
  open,
  onClose,
  versions,
  currentContent,
  onRestore,
  onSaveCurrent,
  isSaving,
}: VersionHistoryDrawerProps) {
  const [preview, setPreview] = React.useState<PostVersion | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(26,26,46,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: '#FDFCFF', border: '1.5px solid #EDE8FF' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: '#EDE8FF' }}
        >
          <div className="flex items-center gap-2">
            <Clock size={15} style={{ color: '#7C5CFC' }} />
            <p className="text-[15px] font-bold" style={{ color: '#1A1A2E' }}>Version history</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: '#F3F4F6', color: '#6B7280' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Save current */}
        <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
          <button
            onClick={onSaveCurrent}
            disabled={isSaving}
            className="w-full py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
            style={{ border: '1.5px dashed #ADA8F0', color: '#7C5CFC', background: 'rgba(124,92,252,0.04)' }}
          >
            {isSaving ? 'Saving...' : 'Save current version'}
          </button>
        </div>

        {/* List or preview */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {preview ? (
            <div className="flex flex-col h-full">
              <div
                className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
                style={{ borderColor: '#EDE8FF' }}
              >
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#1A1A2E' }}>
                    {preview.label || 'Saved version'}
                  </p>
                  <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{timeAgo(preview.created_at)}</p>
                </div>
                <button
                  onClick={() => setPreview(null)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                  style={{ color: '#6B7280', background: '#F3F4F6' }}
                >
                  Back
                </button>
              </div>
              <div className="flex-1 p-5 overflow-y-auto">
                <p
                  className="text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{ color: '#1A1A2E' }}
                >
                  {preview.content}
                </p>
              </div>
              <div className="px-5 pb-5 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => { onRestore(preview); setPreview(null); onClose(); }}
                  className="flex-1 py-2.5 rounded-full font-bold text-[13px] flex items-center justify-center gap-2 text-white"
                  style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}
                >
                  <RotateCcw size={13} />
                  Restore this version
                </button>
              </div>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-5">
              <Clock size={28} style={{ color: '#EDE8FF' }} />
              <p className="text-[13px] font-semibold mt-3" style={{ color: '#1A1A2E' }}>No versions saved yet</p>
              <p className="text-[12px] mt-1 text-center" style={{ color: '#9CA3AF' }}>
                Versions are saved automatically when you use AI refinements. You can also save manually above.
              </p>
            </div>
          ) : (
            <div className="px-5 py-4 flex flex-col gap-2">
              {/* Current state always at top */}
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(124,92,252,0.06)', border: '1.5px solid #ADA8F0' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: '#7C5CFC' }}>Current</p>
                    <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: '#6B7280' }}>
                      {currentContent.slice(0, 80)}{currentContent.length > 80 ? '...' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {versions.map(v => (
                <button
                  key={v.id}
                  onClick={() => setPreview(v)}
                  className="text-left rounded-xl px-4 py-3 transition-all w-full"
                  style={{ border: '1px solid #EDE8FF', background: '#FDFCFF' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F4F0FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FDFCFF')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: '#1A1A2E' }}>
                        {v.label || 'Saved version'}
                      </p>
                      <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: '#6B7280' }}>
                        {v.content.slice(0, 80)}{v.content.length > 80 ? '...' : ''}
                      </p>
                    </div>
                    <span className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: '#9CA3AF' }}>
                      {timeAgo(v.created_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
