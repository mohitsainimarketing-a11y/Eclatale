import React from 'react';
import Sidebar, { MobileHeader } from './Sidebar';
import { useSidebar } from '../contexts/SidebarContext';

// Wraps every authenticated "app" page (Dashboard, Create, Schedule, Content
// Library, Analytics, Voice Profile, Settings, ...) with the persistent
// sidebar. Handles the content offset itself so pages never need to think
// about sidebar width — they just render their content as normal.
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
        {children}
      </div>
    </div>
  );
}
