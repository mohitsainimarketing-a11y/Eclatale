import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Home, Sparkles, CalendarDays, FolderOpen, BarChart3, Target, Compass,
  Settings, MessageCircle, Wrench, CreditCard, Search, ArrowRight,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  group: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

function buildItems(close: () => void): PaletteItem[] {
  const nav = (label: string, description: string, icon: React.ReactNode, href: string, shortcut?: string): PaletteItem => ({
    id: href,
    group: 'Navigate',
    icon,
    label,
    description,
    shortcut,
    action: () => { close(); window.location.href = href; },
  });

  return [
    nav('Dashboard',        'Your brand overview and stats',          <Home size={16} />,        '/dashboard'),
    nav('Create post',      'Start a new LinkedIn post',              <Sparkles size={16} />,    '/create', 'N'),
    nav('Schedule',         'Plan and queue your posts',              <CalendarDays size={16} />, '/schedule'),
    nav('Content Library',  'Browse all your past drafts and posts',  <FolderOpen size={16} />,  '/history'),
    nav('Intelligence',     'Brand score and post analytics',         <BarChart3 size={16} />,   '/intelligence'),
    nav('Voice Profile',    'Set your personal writing voice',        <Target size={16} />,      '/persona-setup'),
    nav('Discover',         'Trending topics and inspiration',        <Compass size={16} />,     '/discover'),
    nav('Free Tools',       '9 free LinkedIn tools',                  <Wrench size={16} />,      '/tools'),
    nav('Settings',         'Account, LinkedIn, notifications',       <Settings size={16} />,    '/settings'),
    nav('Pricing',          'Plans and billing',                      <CreditCard size={16} />,  '/pricing'),
    {
      id: 'aria',
      group: 'Actions',
      icon: <MessageCircle size={16} />,
      label: 'Talk to Aria',
      description: 'Ask your AI brand coach anything',
      action: () => { close(); window.dispatchEvent(new Event('aria:open')); },
    },
  ];
}

function fuzzyMatch(item: PaletteItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.label.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false) ||
    item.group.toLowerCase().includes(q)
  );
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(''); setActiveIndex(0); }, []);

  const items = buildItems(close);
  const filtered = items.filter(item => fuzzyMatch(item, query));

  // Group filtered items
  const groups = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  // Flat index list for keyboard nav
  const flatItems = Object.values(groups).flat();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        if (!open) setActiveIndex(0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flatItems[activeIndex]?.action();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  let flatIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'rgba(10,10,20,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl overflow-hidden animate-fadeIn"
        style={{
          background: '#fff',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid rgba(124,92,252,0.12)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 border-b" style={{ borderColor: 'rgba(124,92,252,0.08)', height: 56 }}>
          <Search size={17} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-[15px] outline-none placeholder-[#9CA3AF]"
            style={{ color: '#1A1A2E' }}
          />
          <kbd
            className="hidden sm:flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: '#F3F0FF', color: '#7C5CFC', border: '1px solid rgba(124,92,252,0.2)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto py-2" style={{ maxHeight: 380 }}>
          {flatItems.length === 0 ? (
            <p className="text-center text-[13px] py-10" style={{ color: '#9CA3AF' }}>No results for "{query}"</p>
          ) : (
            Object.entries(groups).map(([group, groupItems]) => (
              <div key={group}>
                <p className="text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: '#C4C4D4' }}>
                  {group}
                </p>
                {groupItems.map(item => {
                  flatIdx++;
                  const idx = flatIdx;
                  const isActive = activeIndex === idx;
                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{ background: isActive ? 'rgba(124,92,252,0.07)' : 'transparent' }}
                    >
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isActive ? 'rgba(124,92,252,0.14)' : 'rgba(124,92,252,0.06)',
                          color: isActive ? '#7C5CFC' : '#9CA3AF',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold truncate" style={{ color: '#1A1A2E' }}>
                          {item.label}
                        </span>
                        {item.description && (
                          <span className="block text-[11px] truncate" style={{ color: '#9CA3AF' }}>
                            {item.description}
                          </span>
                        )}
                      </span>
                      {item.shortcut && (
                        <kbd
                          className="hidden sm:flex text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: '#F3F0FF', color: '#7C5CFC', border: '1px solid rgba(124,92,252,0.2)' }}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                      {isActive && <ArrowRight size={13} style={{ color: '#7C5CFC', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t" style={{ borderColor: 'rgba(124,92,252,0.06)', background: 'rgba(250,250,254,0.8)' }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[10px]" style={{ color: '#9CA3AF' }}>
              <kbd
                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{ background: '#F3F0FF', color: '#7C5CFC', border: '1px solid rgba(124,92,252,0.2)' }}
              >
                {key}
              </kbd>
              {label}
            </span>
          ))}
          <span className="ml-auto text-[10px] font-semibold" style={{ color: '#C4C4D4' }}>⌘K</span>
        </div>
      </div>
    </div>
  );
}
