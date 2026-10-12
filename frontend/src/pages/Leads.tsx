import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Search, Trash2, ExternalLink, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import AppShell from '../components/AppShell';
import { apiFetch } from '../lib/apiFetch';
import { useToast } from '../contexts/ToastContext';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

interface Lead {
  id: string;
  linkedin_url: string | null;
  name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  connection_degree: string | null;
  notes: string;
  tags: string[];
  saved_at: string;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function LeadCard({ lead, onDelete, onUpdateNotes }: {
  lead: Lead;
  onDelete: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function saveNotes() {
    setSaving(true);
    await onUpdateNotes(lead.id, notes);
    setSaving(false);
    showToast('success', 'Notes saved');
  }

  const dmUrl = lead.name
    ? `/tools/linkedin-dm-writer?recipient=${encodeURIComponent(lead.name)}`
    : '/tools/linkedin-dm-writer';

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {initials(lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm text-brand-dark">{lead.name || 'Unknown'}</p>
                {lead.connection_degree && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(124,92,252,0.08)] text-brand-purple">
                    {lead.connection_degree}
                  </span>
                )}
              </div>
              {lead.headline && <p className="text-xs text-brand-muted mt-0.5 line-clamp-1">{lead.headline}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {lead.company && <span className="text-[11px] text-brand-dark font-medium">{lead.company}</span>}
                {lead.location && <span className="text-[11px] text-brand-muted">{lead.location}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {lead.linkedin_url && (
                <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)] text-brand-muted hover:text-brand-purple transition-colors">
                  <ExternalLink size={13} />
                </a>
              )}
              <a href={dmUrl}
                className="p-1.5 rounded-lg hover:bg-[rgba(247,37,133,0.06)] text-brand-muted hover:text-[#F72585] transition-colors"
                title="Write a DM">
                <MessageSquare size={13} />
              </a>
              <button onClick={() => onDelete(lead.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-brand-muted hover:text-red-500 transition-colors">
                <Trash2 size={13} />
              </button>
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)] text-brand-muted transition-colors">
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-[rgba(124,92,252,0.08)] space-y-3">
              <div>
                <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wide mb-1.5">Notes</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={3}
                  className="w-full text-xs text-brand-dark bg-[rgba(124,92,252,0.03)] border border-[rgba(124,92,252,0.12)] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-brand-purple/40"
                />
                <button onClick={saveNotes} disabled={saving}
                  className="mt-1 text-xs font-semibold text-brand-purple hover:underline disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save notes'}
                </button>
              </div>
              <p className="text-[10px] text-brand-muted">Saved {timeAgo(lead.saved_at)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'list-leads', userId: user.id }),
      });
      const data = await res.json();
      setLeads(data.leads || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function handleDelete(id: string) {
    if (!user) return;
    await apiFetch('/api/intelligence', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete-lead', userId: user.id, leadId: id }),
    }).then(r => r.json());
    setLeads(l => l.filter(x => x.id !== id));
    showToast('success', 'Lead removed');
  }

  async function handleUpdateNotes(id: string, notes: string) {
    if (!user) return;
    await apiFetch('/api/intelligence', {
      method: 'POST',
      body: JSON.stringify({ action: 'update-lead', userId: user.id, leadId: id, notes }),
    }).then(r => r.json());
    setLeads(l => l.map(x => x.id === id ? { ...x, notes } : x));
  }

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [l.name, l.headline, l.company, l.location, l.notes].some(f => f?.toLowerCase().includes(q));
  });

  if (!user) return null;

  return (
    <AppShell mobileTitle="Leads">
      <div className="min-w-0 pb-8">
        <div className="max-w-[900px] mx-auto px-5 md:px-8 py-6 md:py-8">

          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-brand-dark flex items-center gap-2">
                <Users size={22} className="text-brand-purple" /> Lead Manager
              </h1>
              <p className="text-sm text-brand-muted mt-1">
                Save LinkedIn profiles from the extension. Write a DM or add notes from here.
              </p>
            </div>
            <a href="/tools/linkedin-dm-writer"
              className="btn-primary !py-2.5 !px-5 text-sm">
              <MessageSquare size={14} /> Write a DM
            </a>
          </div>

          {leads.length === 0 && !loading ? (
            <div className="card p-10 text-center">
              <Users size={32} className="text-brand-purple/30 mx-auto mb-3" />
              <p className="font-bold text-brand-dark mb-1">No leads yet</p>
              <p className="text-sm text-brand-muted max-w-sm mx-auto">
                Visit a LinkedIn profile with the Eclatale extension installed and click "Save Lead" to capture their info here.
              </p>
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search by name, company, headline…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-[rgba(124,92,252,0.15)] rounded-xl bg-white focus:outline-none focus:border-brand-purple/40"
                />
              </div>

              <p className="text-xs text-brand-muted mb-3">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</p>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card p-4 animate-pulse">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-[rgba(124,92,252,0.08)]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-[rgba(124,92,252,0.08)] rounded w-1/3" />
                          <div className="h-2.5 bg-[rgba(124,92,252,0.05)] rounded w-2/3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onDelete={handleDelete}
                      onUpdateNotes={handleUpdateNotes}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-brand-muted text-center py-8">No results for "{search}"</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
