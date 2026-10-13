import React, { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { CONTENT_STYLE_GROUPS, searchStyles, ContentStyle } from './contentStyles';

interface MoreStylesDrawerProps {
  open: boolean;
  onClose: () => void;
  onApply: (style: ContentStyle) => void;
  disabled?: boolean;
}

export default function MoreStylesDrawer({ open, onClose, onApply, disabled }: MoreStylesDrawerProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => (query.trim() ? searchStyles(query) : null),
    [query]
  );

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
          <div>
            <p className="text-[15px] font-bold" style={{ color: '#1A1A2E' }}>Content styles</p>
            <p className="text-[12px]" style={{ color: '#9CA3AF' }}>Choose a style to apply. You can accept or reject the change.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: '#F3F4F6', color: '#6B7280' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: '#EDE8FF' }}>
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: '#F4F0FF', border: '1.5px solid #EDE8FF' }}
          >
            <Search size={14} style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search styles..."
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: '#1A1A2E' }}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ color: '#9CA3AF' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Style list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {results ? (
            <div className="px-5 py-4">
              {results.length === 0 ? (
                <p className="text-[13px] text-center py-8" style={{ color: '#9CA3AF' }}>No styles match that search</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {results.map(style => (
                    <StyleRow key={style.id} style={style} onApply={onApply} disabled={disabled} onClose={onClose} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-4 flex flex-col gap-5">
              {CONTENT_STYLE_GROUPS.map(group => (
                <div key={group.group}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide mb-2"
                    style={{ color: '#9CA3AF' }}
                  >
                    {group.group}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {group.styles.map(style => (
                      <StyleRow key={style.id} style={style} onApply={onApply} disabled={disabled} onClose={onClose} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StyleRow({
  style,
  onApply,
  disabled,
  onClose,
}: {
  style: ContentStyle;
  onApply: (s: ContentStyle) => void;
  disabled?: boolean;
  onClose: () => void;
}) {
  return (
    <button
      onClick={() => { onApply(style); onClose(); }}
      disabled={disabled}
      className="text-left w-full rounded-xl px-3 py-2.5 transition-all disabled:opacity-50"
      style={{ border: '1px solid transparent' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = '#F4F0FF';
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#EDE8FF';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: '#1A1A2E' }}>{style.label}</p>
          <p className="text-[12px] mt-0.5 truncate" style={{ color: '#6B7280' }}>{style.description}</p>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(124,92,252,0.08)', color: '#7C5CFC' }}
        >
          Apply
        </span>
      </div>
    </button>
  );
}
