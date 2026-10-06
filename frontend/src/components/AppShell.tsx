import React from 'react';
import { PenLine } from 'lucide-react';
import Sidebar, { MobileHeader } from './Sidebar';
import { useSidebar } from '../contexts/SidebarContext';

const CREATE_PATHS = ['/create', '/create-talk', '/create-resource', '/create-visual'];

function CreateFAB() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (CREATE_PATHS.some(p => path.startsWith(p))) return null;
  return (
    <a
      href="/create"
      className="animate-fabPop fixed z-50 flex items-center gap-2 text-white font-bold shadow-lg"
      style={{
        bottom: 24,
        right: 24,
        height: 48,
        paddingInline: '20px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)',
        boxShadow: '0 6px 24px rgba(124,92,252,0.35)',
        fontSize: 13,
        textDecoration: 'none',
      }}
      aria-label="Create post"
    >
      <PenLine size={16} />
      <span className="hidden sm:inline">Create</span>
    </a>
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
        {/* pb-20 on mobile gives 80px clearance so the fixed FAB never covers page content */}
        <div className="pb-20 md:pb-0">
          {children}
        </div>
      </div>
      <CreateFAB />
    </div>
  );
}
