import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface SidebarContextValue {
  // Whether the sidebar is rendered in icon-only (collapsed) form right now.
  collapsed: boolean;
  toggleCollapsed: () => void;
  // Mobile overlay open/close state (not persisted — always starts closed)
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
  breakpoint: Breakpoint;
  // Actual rendered width in px, for pages to offset their layout by
  sidebarWidth: number;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = 'eclatale_sidebar_collapsed';
const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

function getBreakpoint(width: number): Breakpoint {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window === 'undefined' ? 'desktop' : getBreakpoint(window.innerWidth)
  );
  // The user's persisted desktop preference.
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  // Tablet always starts collapsed each session (per spec), independent of
  // the desktop preference, but can be expanded on demand for that session.
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const bp = getBreakpoint(window.innerWidth);
      setBreakpoint(bp);
      if (bp !== 'mobile') setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleCollapsed = useCallback(() => {
    if (breakpoint === 'tablet') {
      setTabletExpanded(e => !e);
    } else {
      setDesktopCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
        return next;
      });
    }
  }, [breakpoint]);

  const collapsed = breakpoint === 'tablet' ? !tabletExpanded : desktopCollapsed;
  const sidebarWidth = breakpoint === 'mobile' ? 0 : (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);

  const value: SidebarContextValue = {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    openMobile: () => setMobileOpen(true),
    closeMobile: () => setMobileOpen(false),
    toggleMobile: () => setMobileOpen(o => !o),
    breakpoint,
    sidebarWidth,
  };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
  return ctx;
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };
