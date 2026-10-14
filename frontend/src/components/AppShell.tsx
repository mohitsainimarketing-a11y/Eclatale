import React, { useState } from 'react';
import { Home, PenLine, Lightbulb, CalendarDays, MoreHorizontal, BarChart3, Brain, Wrench, Settings, X } from 'lucide-react';
import Sidebar, { MobileHeader } from './Sidebar';
import { useSidebar } from '../contexts/SidebarContext';

const CREATE_PATHS = ['/create', '/create-talk', '/create-resource', '/create-visual'];

function CreateFAB() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  // On mobile the bottom nav has Create; only show FAB on desktop
  if (CREATE_PATHS.some(p => path.startsWith(p))) return null;
  return (
    <a
      href="/create"
      className="hidden md:flex animate-fabPop fixed z-50 items-center gap-2 text-white font-bold shadow-lg"
      style={{
        bottom: 24, right: 24, height: 48, paddingInline: '20px', borderRadius: 24,
        background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)',
        boxShadow: '0 6px 24px rgba(124,92,252,0.35)', fontSize: 13, textDecoration: 'none',
      }}
      aria-label="Create post"
    >
      <PenLine size={16} />
      <span>Create</span>
    </a>
  );
}

const BOTTOM_NAV = [
  { href: '/dashboard', icon: <Home size={20} />, label: 'Home' },
  { href: '/create',    icon: <PenLine size={20} />, label: 'Create', primary: true },
  { href: '/ideas',     icon: <Lightbulb size={20} />, label: 'Ideas' },
  { href: '/calendar',  icon: <CalendarDays size={20} />, label: 'Calendar' },
];

const MORE_ITEMS = [
  { href: '/analytics',   icon: <BarChart3 size={18} />, label: 'Analytics' },
  { href: '/brand-brain', icon: <Brain size={18} />, label: 'Brand Brain' },
  { href: '/tools',       icon: <Wrench size={18} />, label: 'Free Tools' },
  { href: '/settings',    icon: <Settings size={18} />, label: 'Settings' },
];

function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  const isActive = (href: string) => {
    if (href === '/dashboard') return path === '/dashboard';
    return path.startsWith(href);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[rgba(124,92,252,0.08)] safe-bottom">
        <div className="flex items-center" style={{ height: 60 }}>
          {BOTTOM_NAV.map(item => {
            const active = isActive(item.href);
            if (item.primary) {
              return (
                <a key={item.href} href={item.href}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
                  aria-label={item.label}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center -mt-5 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)' }}>
                    <PenLine size={18} className="text-white" />
                  </div>
                  <span className="text-[9px] font-semibold" style={{ color: '#7C5CFC' }}>{item.label}</span>
                </a>
              );
            }
            return (
              <a key={item.href} href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors"
                style={{ color: active ? '#7C5CFC' : '#9CA3AF' }}
                aria-label={item.label}>
                {item.icon}
                <span className="text-[9px] font-semibold">{item.label}</span>
              </a>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors"
            style={{ color: '#9CA3AF' }}
            aria-label="More">
            <MoreHorizontal size={20} />
            <span className="text-[9px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5 safe-bottom animate-slideUp"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-brand-dark">More</p>
              <button onClick={() => setMoreOpen(false)} className="w-8 h-8 rounded-full bg-[rgba(0,0,0,0.05)] flex items-center justify-center text-brand-muted">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {MORE_ITEMS.map(item => (
                <a key={item.href} href={item.href} onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-[rgba(124,92,252,0.04)] hover:bg-[rgba(124,92,252,0.08)] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center" style={{ color: '#7C5CFC' }}>
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-semibold text-brand-dark text-center leading-tight">{item.label}</span>
                </a>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-[rgba(0,0,0,0.06)]">
              <a href="/leads" onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[rgba(124,92,252,0.04)] transition-colors">
                <span className="text-sm font-semibold text-brand-dark">Leads</span>
              </a>
              <a href="/pricing" onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[rgba(124,92,252,0.04)] transition-colors">
                <span className="text-sm font-semibold gradient-text">Upgrade plan</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AppShell({ children, mobileTitle }: { children: React.ReactNode; mobileTitle?: string }) {
  const { sidebarWidth, breakpoint } = useSidebar();

  return (
    <div className="min-h-screen bg-[#FAFAFE]">
      <Sidebar />
      <div
        className="min-h-screen transition-[margin] duration-200 ease-out"
        style={{ marginLeft: breakpoint === 'mobile' ? 0 : sidebarWidth }}
      >
        <MobileHeader title={mobileTitle} />
        {/* pb-20 on mobile gives clearance above the bottom nav */}
        <div className="pb-20 md:pb-0">
          {children}
        </div>
      </div>
      <MobileBottomNav />
      <CreateFAB />
    </div>
  );
}
