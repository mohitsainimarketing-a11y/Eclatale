import React, { useEffect, useRef, useState } from 'react';
import { Bell, X, Loader2, Flame, TrendingUp, Sparkles, Zap, Target, Lightbulb, Link2, ArrowUp, Calendar, MessageCircle, BellOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { apiFetch } from '../lib/apiFetch';

const TYPE_ICON: Record<string, { icon: React.ElementType; bg: string; fg: string }> = {
  streak: { icon: Flame, bg: '#FEF3C7', fg: '#D97706' },
  growth_stage: { icon: TrendingUp, bg: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(247,37,133,0.1))', fg: '#7C5CFC' },
  first_post: { icon: Sparkles, bg: '#F3E8FF', fg: '#9333EA' },
  free_limit: { icon: Zap, bg: '#FEE2E2', fg: '#DC2626' },
  post_milestone: { icon: Target, bg: '#D1FAE5', fg: '#059669' },
  voice_complete: { icon: Lightbulb, bg: '#DBEAFE', fg: '#2563EB' },
  linkedin_connected: { icon: Link2, bg: '#DBEAFE', fg: '#0A66C2' },
  upgrade: { icon: ArrowUp, bg: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(247,37,133,0.1))', fg: '#7C5CFC' },
  streak_risk: { icon: Calendar, bg: '#FEF3C7', fg: '#D97706' },
  aria: { icon: MessageCircle, bg: '#F3E8FF', fg: '#9333EA' },
};

function iconFor(type: string) {
  if (type === 'post_milestone' || type.startsWith('growth_milestone')) return TYPE_ICON.post_milestone;
  if (type.startsWith('streak_risk')) return TYPE_ICON.streak_risk;
  if (type.startsWith('streak')) return TYPE_ICON.streak;
  if (type.startsWith('growth_stage')) return TYPE_ICON.growth_stage;
  if (type === 'free_limit_reached') return TYPE_ICON.free_limit;
  if (type === 'voice_complete') return TYPE_ICON.voice_complete;
  if (type === 'linkedin_connected') return TYPE_ICON.linkedin_connected;
  if (type.includes('upgrade')) return TYPE_ICON.upgrade;
  if (type.includes('aria')) return TYPE_ICON.aria;
  return TYPE_ICON.first_post;
}

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

const BASE_POLL_MS = 5 * 60 * 1000; // 5 min fallback poll — realtime subscription handles instant updates
const MAX_POLL_MS = 20 * 60 * 1000;

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ringing, setRinging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(BASE_POLL_MS);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/notifications?userId=${userId}`);
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      backoffRef.current = BASE_POLL_MS;
    } catch {
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_POLL_MS);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    load();

    const scheduleNext = () => {
      if (cancelled) return;
      timeoutRef.current = setTimeout(async () => {
        await load();
        scheduleNext();
      }, backoffRef.current);
    };
    scheduleNext();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const n = payload.new as Notification;
          setNotifications(prev => [n, ...prev]);
          setUnreadCount(c => c + 1);
          setRinging(true);
          setTimeout(() => setRinging(false), 500);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    apiFetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    apiFetch(`${API_URL}/api/notifications/read-all`, {
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
        <Bell size={19} className={ringing ? 'animate-bellRing' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-pink text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[380px] max-w-[90vw] bg-white rounded-2xl p-0 overflow-hidden z-50 animate-fadeIn"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(124,92,252,0.08)]">
            <h3 className="text-base font-bold text-brand-dark">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-purple font-semibold hover:underline">Mark all read</button>
            )}
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center"><Loader2 size={18} className="animate-spin text-brand-muted mx-auto" /></div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <BellOff size={32} className="mx-auto mb-3 text-brand-muted/40" />
                <p className="text-sm font-semibold text-brand-dark">You're all caught up!</p>
                <p className="text-xs text-brand-muted mt-1">Notifications will appear here as you use Eclatale</p>
              </div>
            ) : (
              notifications.map(n => {
                const { icon: Icon, bg, fg } = iconFor(n.type);
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.cta_url) window.location.href = n.cta_url;
                    }}
                    className={`flex gap-3 px-4 py-3 border-b border-[rgba(124,92,252,0.04)] last:border-0 cursor-pointer transition-colors ${n.read ? 'bg-white' : 'bg-[rgba(124,92,252,0.04)]'} hover:bg-[rgba(124,92,252,0.06)]`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: bg }}
                    >
                      <Icon size={16} style={{ color: fg }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-brand-dark leading-snug">{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-brand-purple flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-brand-muted mt-0.5 leading-snug">{n.message}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-brand-muted">{timeAgo(n.created_at)}</span>
                        {n.cta_url && n.cta_text && (
                          <span className="text-[11px] text-brand-purple font-semibold">{n.cta_text}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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
