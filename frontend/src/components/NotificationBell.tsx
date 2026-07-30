import React, { useEffect, useRef, useState } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  cta_text: string | null;
  cta_url: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications?userId=${userId}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative min-w-[44px] min-h-[44px] flex items-center justify-center text-brand-muted hover:text-brand-purple transition-colors"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-pink text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] card p-0 overflow-hidden modal-shadow z-50 animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(124,92,252,0.08)]">
            <h3 className="text-sm font-bold text-brand-dark">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-purple font-semibold hover:underline">Mark all as read</button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center"><Loader2 size={18} className="animate-spin text-brand-muted mx-auto" /></div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-brand-muted">No notifications yet.</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`px-4 py-3 border-b border-[rgba(124,92,252,0.04)] last:border-0 cursor-pointer transition-colors ${n.read ? 'bg-white' : 'bg-[rgba(124,92,252,0.04)]'} hover:bg-[rgba(124,92,252,0.06)]`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-brand-dark leading-snug">{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-brand-purple flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-xs text-brand-muted mt-0.5 leading-snug">{n.message}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-brand-muted">{timeAgo(n.created_at)}</span>
                    {n.cta_url && n.cta_text && (
                      <a href={n.cta_url} className="text-[11px] text-brand-purple font-semibold hover:underline">{n.cta_text}</a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[rgba(124,92,252,0.08)] text-center">
              <button onClick={() => setOpen(false)} className="text-xs text-brand-muted hover:text-brand-purple inline-flex items-center gap-1">
                <X size={11} /> Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
