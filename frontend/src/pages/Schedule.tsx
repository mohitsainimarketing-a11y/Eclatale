import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, Settings2, X, Loader2, Check, Clock } from 'lucide-react';
import AppShell from '../components/AppShell';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface ScheduledPost {
  id: string;
  content: string;
  scheduled_for: string;
  schedule_status: 'scheduled' | 'published' | 'failed' | 'cancelled' | null;
}

interface Slot { time: string; days: number[]; } // days: 0=Sun..6=Sat

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_INDEX = [1, 2, 3, 4, 5, 6, 0]; // maps Mon-first column to JS getDay() index

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first offset
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Schedule() {
  const [userId, setUserId] = useState('');
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [savingSlots, setSavingSlots] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const today = dateKey(new Date());

  const loadPosts = useCallback(async (uid: string, y: number, m: number) => {
    setLoading(true);
    const rangeStart = new Date(y, m - 1, 21).toISOString();
    const rangeEnd = new Date(y, m + 2, 10).toISOString();
    const { data } = await supabase.from('posts')
      .select('id, content, scheduled_for, schedule_status')
      .eq('user_id', uid)
      .eq('schedule_status', 'scheduled')
      .gte('scheduled_for', rangeStart)
      .lte('scheduled_for', rangeEnd)
      .order('scheduled_for', { ascending: true });
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
      loadPosts(data.user.id, year, month);
      supabase.from('user_schedule_slots').select('slots').eq('user_id', data.user.id).single()
        .then(({ data: row }) => { if (row?.slots?.length) setSlots(row.slots); });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userId) loadPosts(userId, year, month);
  }, [userId, year, month, loadPosts]);

  const postsByDay = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    for (const p of posts) {
      if (!p.scheduled_for) continue;
      const k = dateKey(new Date(p.scheduled_for));
      (map[k] ||= []).push(p);
    }
    return map;
  }, [posts]);

  const handleCancelScheduled = async (postId: string) => {
    setCancelingId(postId);
    try {
      const res = await apiFetch(`${API_URL}/api/schedule/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, postId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPosts(prev => prev.filter(p => p.id !== postId));
      setSelectedPost(null);
    } catch (err: any) {
      alert(err.message || 'Could not cancel scheduled post.');
    }
    setCancelingId(null);
  };

  const handleDrop = async (day: Date) => {
    setDragOverDay(null);
    if (!draggingId) return;
    const post = posts.find(p => p.id === draggingId);
    setDraggingId(null);
    if (!post) return;
    const original = new Date(post.scheduled_for);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), original.getHours(), original.getMinutes());
    if (dateKey(next) === dateKey(original)) return;
    if (next.getTime() < Date.now()) { alert("Can't reschedule a post into the past."); return; }
    const nextIso = next.toISOString();
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, scheduled_for: nextIso } : p));
    await supabase.from('posts').update({ scheduled_for: nextIso }).eq('id', post.id);
  };

  const saveSlots = async () => {
    setSavingSlots(true);
    await supabase.from('user_schedule_slots').upsert({ user_id: userId, slots, updated_at: new Date().toISOString() });
    setSavingSlots(false);
  };

  const addSlot = () => setSlots(s => [...s, { time: '12:00', days: [0, 1, 2, 3, 4, 5, 6] }]);
  const removeSlot = (i: number) => setSlots(s => s.filter((_, si) => si !== i));
  const toggleSlotDay = (i: number, day: number) => setSlots(s => s.map((slot, si) => si === i
    ? { ...slot, days: slot.days.includes(day) ? slot.days.filter(d => d !== day) : [...slot.days, day] }
    : slot));

  return (
    <AppShell mobileTitle="Schedule">
    <div className="min-h-screen gradient-bg-page pb-20 md:pb-0">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-end gap-3">
        <button onClick={() => setSlotsOpen(true)} className="btn-secondary text-sm !py-2 !px-4 flex items-center gap-1.5">
          <Settings2 size={14} /> Posting times
        </button>
        <a href="/create" className="btn-primary text-sm !py-2 !px-5">New Post</a>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl md:text-2xl font-extrabold text-brand-dark">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h1>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-brand-muted hover:text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="text-xs font-semibold text-brand-purple px-2.5 py-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)] transition-colors">
              Today
            </button>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-brand-muted hover:text-brand-purple hover:bg-[rgba(124,92,252,0.06)] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.06)]">
          {WEEKDAYS.map(d => (
            <div key={d} className="bg-[rgba(124,92,252,0.03)] text-center py-2 text-[11px] font-bold text-brand-muted uppercase tracking-wide">{d}</div>
          ))}
          {grid.map((day, i) => {
            const inMonth = day.getMonth() === month;
            const k = dateKey(day);
            const dayPosts = postsByDay[k] || [];
            const isToday = k === today;
            return (
              <div key={i}
                onDragOver={e => { e.preventDefault(); setDragOverDay(k); }}
                onDragLeave={() => setDragOverDay(prev => prev === k ? null : prev)}
                onDrop={e => { e.preventDefault(); handleDrop(day); }}
                className={`min-h-[110px] p-1.5 flex flex-col gap-1 transition-colors ${
                  inMonth ? 'bg-white' : 'bg-[rgba(0,0,0,0.015)]'
                } ${dragOverDay === k ? 'bg-[rgba(124,92,252,0.08)]' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? 'gradient-primary text-white' : inMonth ? 'text-brand-dark' : 'text-[#C4C4C4]'
                  }`}>
                    {day.getDate()}
                  </span>
                  <a href={`/create?scheduleDate=${k}`} aria-label={`Schedule a post for ${k}`}
                    className="text-[13px] leading-none text-brand-muted hover:text-brand-purple opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity">+</a>
                </div>
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {dayPosts.slice(0, 3).map(p => (
                    <button key={p.id} draggable
                      onDragStart={() => setDraggingId(p.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => setSelectedPost(p)}
                      className={`text-left text-[10px] leading-snug px-1.5 py-1 rounded-md bg-[rgba(124,92,252,0.08)] text-brand-purple font-medium truncate cursor-grab active:cursor-grabbing transition-opacity ${
                        draggingId === p.id ? 'opacity-30' : 'hover:bg-[rgba(124,92,252,0.14)]'
                      }`}>
                      {new Date(p.scheduled_for).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {(p.content || '').split('\n')[0].slice(0, 40) || 'Untitled'}
                    </button>
                  ))}
                  {dayPosts.length > 3 && <span className="text-[10px] text-brand-muted px-1.5">+{dayPosts.length - 3} more</span>}
                </div>
              </div>
            );
          })}
        </div>
        {loading && <p className="text-[12px] text-brand-muted mt-3 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Loading scheduled posts…</p>}
        <p className="text-[11px] text-brand-muted mt-4">Drag a post onto another day to reschedule it (same time of day is kept). Times shown in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
      </div>

      {/* Post detail popover */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedPost(null)}>
          <div className="card !p-5 w-full max-w-sm animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-brand-purple flex items-center gap-1.5">
                <Clock size={12} /> {new Date(selectedPost.scheduled_for).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
              <button onClick={() => setSelectedPost(null)} aria-label="Close" className="text-brand-muted hover:text-brand-purple">
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-brand-dark leading-relaxed whitespace-pre-wrap line-clamp-[8] mb-4">{selectedPost.content}</p>
            <div className="flex items-center gap-2">
              <a href={`/create?postId=${selectedPost.id}`} className="btn-secondary flex-1 text-xs !py-2 text-center">Edit</a>
              <button onClick={() => handleCancelScheduled(selectedPost.id)} disabled={cancelingId === selectedPost.id}
                className="flex-1 text-xs font-semibold text-red-500 border border-red-200 rounded-xl py-2 hover:bg-red-50 transition-colors disabled:opacity-50">
                {cancelingId === selectedPost.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring posting-times editor */}
      {slotsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSlotsOpen(false)}>
          <div className="card !p-5 w-full max-w-lg animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[14px] font-bold text-brand-dark">Your posting times</span>
              <button onClick={() => setSlotsOpen(false)} aria-label="Close" className="text-brand-muted hover:text-brand-purple">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-brand-muted mb-3">These are the default times Eclatale suggests when you schedule a post. Times are in your local time zone.</p>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-center border-collapse min-w-[420px]">
                <thead>
                  <tr>
                    <th className="text-[10px] font-bold text-brand-muted text-left pb-2">Time</th>
                    {WEEKDAYS.map(d => <th key={d} className="text-[10px] font-bold text-brand-muted pb-2">{d}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot, i) => (
                    <tr key={i}>
                      <td className="py-1">
                        <input type="time" value={slot.time}
                          onChange={e => setSlots(s => s.map((sl, si) => si === i ? { ...sl, time: e.target.value } : sl))}
                          className="text-[12px] border-0 bg-[rgba(0,0,0,0.03)] rounded-lg px-2 py-1 w-[90px]" />
                      </td>
                      {WEEKDAY_INDEX.map(jsDay => (
                        <td key={jsDay} className="py-1">
                          <input type="checkbox" checked={slot.days.includes(jsDay)} onChange={() => toggleSlotDay(i, jsDay)}
                            className="w-4 h-4 accent-[#7C5CFC] cursor-pointer" />
                        </td>
                      ))}
                      <td>
                        <button onClick={() => removeSlot(i)} aria-label="Remove time slot" className="text-brand-muted hover:text-red-500 p-1">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {slots.length === 0 && <p className="text-[11px] text-brand-muted py-3 text-center">No posting times set yet.</p>}
            <div className="flex items-center justify-between mt-3">
              <button onClick={addSlot} className="text-[12px] font-semibold text-brand-purple hover:underline">+ Add a time slot</button>
              <button onClick={saveSlots} disabled={savingSlots} className="btn-primary text-xs !py-2 !px-4">
                {savingSlots ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
