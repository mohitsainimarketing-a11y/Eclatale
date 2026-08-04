import React, { useEffect, useState } from 'react';
import {
  Home, Sparkles, BarChart3, TrendingUp, FolderOpen, Target, UserCog, Settings,
  MessageCircle, HelpCircle, ChevronLeft, ChevronRight, Menu, X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSidebar, EXPANDED_WIDTH, COLLAPSED_WIDTH } from '../contexts/SidebarContext';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  primary?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: <Home size={18} />, label: 'Dashboard', href: '/dashboard' },
  { icon: <Sparkles size={18} />, label: 'Create', href: '/create', primary: true },
  { icon: <BarChart3 size={18} />, label: 'Analytics', href: '/intelligence' },
  { icon: <TrendingUp size={18} />, label: 'Competitor Intel', href: '/intelligence' },
  { icon: <FolderOpen size={18} />, label: 'Content Library', href: '/history' },
  { icon: <Target size={18} />, label: 'Voice Profile', href: '/persona-setup' },
  { icon: <UserCog size={18} />, label: 'Profile Optimizer', href: '/intelligence' },
  { icon: <Settings size={18} />, label: 'Settings', href: '/settings' },
];

interface SidebarUser {
  name: string;
  avatar: string;
  initials: string;
  tier: 'free' | 'individual';
  postsThisWeek: number;
  postsAllowed: number;
}

function useSidebarUser(): SidebarUser {
  const [user, setUser] = useState<SidebarUser>({
    name: '', avatar: '', initials: 'Y', tier: 'free', postsThisWeek: 0, postsAllowed: 3,
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u || !mounted) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, profile_photo_url, subscription_tier, posts_this_week')
        .eq('id', u.id).single();
      if (!mounted) return;
      const fn = (profile?.first_name || '').trim();
      const ln = (profile?.last_name || '').trim();
      const name = [fn, ln].filter(Boolean).join(' ') || (u.email?.split('@')[0] || 'You');
      const initials = fn && ln ? (fn[0] + ln[0]).toUpperCase() : name.substring(0, 2).toUpperCase();
      const tier = (profile?.subscription_tier === 'individual' ? 'individual' : 'free') as 'free' | 'individual';
      setUser({
        name,
        avatar: profile?.profile_photo_url || '',
        initials,
        tier,
        postsThisWeek: profile?.posts_this_week || 0,
        postsAllowed: tier === 'individual' ? -1 : 3,
      });
    });
    return () => { mounted = false; };
  }, []);

  return user;
}

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const [hovering, setHovering] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <a
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          collapsed ? 'justify-center' : ''
        } ${
          item.primary
            ? 'gradient-primary text-white shadow-[0_2px_10px_rgba(124,92,252,0.3)]'
            : active
            ? 'bg-[rgba(124,92,252,0.08)] text-brand-purple'
            : 'text-brand-muted hover:bg-[rgba(124,92,252,0.04)] hover:text-brand-dark'
        }`}
      >
        {item.icon}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </a>
      {collapsed && hovering && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 rounded-lg bg-[#1A1A2E] text-white text-xs font-semibold whitespace-nowrap z-50 animate-fadeIn pointer-events-none">
          {item.label}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const user = useSidebarUser();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  const planLabel = user.tier === 'individual'
    ? 'Individual · Unlimited'
    : `Free · ${user.postsThisWeek}/${user.postsAllowed} posts used`;

  return (
    <div className="flex flex-col h-full" onClick={onNavigate}>
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-[rgba(124,92,252,0.06)] flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <a href="/dashboard" className="text-xl font-extrabold gradient-text">
          {collapsed ? 'E' : 'Eclatale'}
        </a>
      </div>

      {/* User */}
      <div className={`flex items-center gap-2.5 py-3.5 border-b border-[rgba(124,92,252,0.06)] flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        {user.avatar
          ? <img src={user.avatar} alt={user.name} loading="lazy" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          : <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{user.initials}</div>
        }
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-dark truncate">{user.name}</p>
            <p className={`text-[10px] font-semibold truncate ${user.tier === 'individual' ? 'text-brand-teal' : 'text-brand-muted'}`}>
              {user.tier === 'individual' ? 'Individual plan' : 'Free plan'}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item, i) => (
          <NavLink key={i} item={item} collapsed={collapsed} active={path === item.href} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-[rgba(124,92,252,0.06)] space-y-0.5 flex-shrink-0">
        <button
          onClick={() => window.dispatchEvent(new Event('aria:open'))}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-muted hover:bg-[rgba(124,92,252,0.04)] hover:text-brand-dark transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <MessageCircle size={18} />
          {!collapsed && <span>Talk to Aria</span>}
        </button>
        <a
          href="/create?shortcuts=1"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-muted hover:bg-[rgba(124,92,252,0.04)] hover:text-brand-dark transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <HelpCircle size={18} />
          {!collapsed && <span>Help & Shortcuts</span>}
        </a>
        {!collapsed && (
          <div className="px-3 pt-2">
            <p className="text-[11px] font-semibold text-brand-muted">{planLabel}</p>
            {user.tier === 'free' && (
              <a href="/pricing" className="text-[11px] font-semibold text-brand-purple hover:underline">Upgrade →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile, breakpoint, sidebarWidth } = useSidebar();

  if (breakpoint === 'mobile') {
    return (
      <>
        {mobileOpen && (
          <div className="fixed inset-0 z-[60] bg-black/40 animate-fadeIn" onClick={closeMobile} />
        )}
        <aside
          className={`fixed top-0 left-0 h-full bg-white z-[70] shadow-2xl transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ width: 280 }}
        >
          <button onClick={closeMobile} aria-label="Close menu" className="absolute top-4 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-brand-muted hover:bg-[rgba(124,92,252,0.06)]">
            <X size={18} />
          </button>
          <SidebarContent collapsed={false} onNavigate={closeMobile} />
        </aside>
      </>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col fixed top-0 left-0 h-full bg-white border-r border-[rgba(124,92,252,0.06)] z-40 nav-shadow transition-[width] duration-200 ease-out"
      style={{ width: sidebarWidth }}
    >
      <div className="flex-1 min-h-0">
        <SidebarContent collapsed={collapsed} />
      </div>
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute top-16 -right-3 w-6 h-6 rounded-full bg-white border border-[rgba(124,92,252,0.15)] shadow-sm flex items-center justify-center text-brand-muted hover:text-brand-purple hover:border-brand-purple/40 transition-colors"
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </aside>
  );
}

export function MobileHeader({ title }: { title?: string }) {
  const { toggleMobile, breakpoint } = useSidebar();
  if (breakpoint !== 'mobile') return null;
  return (
    <div className="md:hidden sticky top-0 z-30 h-14 bg-white/90 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] flex items-center px-4 gap-3">
      <button onClick={toggleMobile} aria-label="Open menu" className="w-9 h-9 -ml-1.5 flex items-center justify-center text-brand-dark">
        <Menu size={20} />
      </button>
      <span className="text-base font-extrabold gradient-text">{title || 'Eclatale'}</span>
    </div>
  );
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };
