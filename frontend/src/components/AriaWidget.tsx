import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Send, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

interface AriaMsg {
  role: 'user' | 'assistant';
  content: string;
}

// Aria only appears on authenticated "app" pages, not marketing/legal/auth pages.
const ARIA_ROUTES = ['/dashboard', '/create', '/history', '/persona-setup', '/settings', '/create-visual', '/intelligence', '/pricing', '/onboarding'];

const QUICK_ACTIONS: Record<string, string[]> = {
  '/dashboard': ['Generate a post', 'Check my score', 'Find ideas'],
  '/create': ['Make it shorter', 'Change the tone', 'Add a stat'],
  '/intelligence': ["What's my best post?", 'How can I improve?'],
  '/pricing': ["What's included?", 'How does the trial work?'],
};

function quickActionsFor(pathname: string): string[] {
  const match = Object.keys(QUICK_ACTIONS).find(p => pathname.startsWith(p));
  return match ? QUICK_ACTIONS[match] : ['How do I generate a post?', 'What does the authenticity score mean?'];
}

async function ariaFetch(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function AriaWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [open, setOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [messages, setMessages] = useState<AriaMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [proactiveMsg, setProactiveMsg] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const showWidget = ARIA_ROUTES.some(r => location.pathname.startsWith(r)) && !!userId;

  // Auth + initial context
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
    });
  }, []);

  // Load prior conversation + decide a proactive nudge, once we know who the user is.
  useEffect(() => {
    if (!userId || historyLoaded) return;
    setHistoryLoaded(true);

    ariaFetch('/api/aria/history', { userId }).then(d => {
      if (Array.isArray(d?.messages) && d.messages.length > 0) setMessages(d.messages);
    }).catch(() => {});

    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, subscription_tier, created_at, posts_this_week')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.first_name) setFirstName(profile.first_name);

      const { data: posts } = await supabase
        .from('posts')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const name = profile?.first_name || 'there';
      const accountAgeMs = profile?.created_at ? Date.now() - new Date(profile.created_at).getTime() : Infinity;
      const isNewAccount = accountAgeMs < 2 * 24 * 60 * 60 * 1000;
      const daysSinceLastPost = posts?.[0]?.created_at
        ? (Date.now() - new Date(posts[0].created_at).getTime()) / (24 * 60 * 60 * 1000)
        : Infinity;

      if (isNewAccount && (!posts || posts.length === 0)) {
        setProactiveMsg(`Hi ${name}! I'm Aria, your personal brand assistant. Want me to help you generate your first post? 🚀`);
      } else if (daysSinceLastPost >= 3 && daysSinceLastPost !== Infinity) {
        setProactiveMsg(`Hey ${name}, it's been a few days since your last post — want me to help you generate something in 30 seconds?`);
      } else if (profile?.subscription_tier === 'free' && (profile?.posts_this_week || 0) >= 3) {
        setProactiveMsg(`You've hit your free limit this week. Want me to show you what's included in the Individual plan?`);
      }
    })().catch(() => {});
  }, [userId, historyLoaded]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const applyAction = (action: any) => {
    if (!action) return;
    if (action.action === 'navigate' && action.url) {
      navigate(action.url);
    } else if (action.action === 'prefill' && action.page) {
      // /create already supports a ?topic= query param that pre-fills the
      // write flow (see CreatePost.tsx init effect) — reuse it directly
      // rather than inventing a second prefill channel.
      const topic = (action.data as any)?.topic;
      const url = topic ? `${action.page}?topic=${encodeURIComponent(String(topic))}` : action.page;
      navigate(url);
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || !userId || sending) return;
    setSending(true);
    setProactiveMsg(null);
    const nextMessages: AriaMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    try {
      const d = await ariaFetch('/api/aria/chat', {
        userId, message: text, conversationHistory: messages, currentPage: location.pathname,
      });
      if (d?.reply) {
        setMessages(m => [...m, { role: 'assistant', content: d.reply }]);
        applyAction(d.action);
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: "Sorry, I couldn't reach the server just now — try again in a moment." }]);
    }
    setSending(false);
  };

  if (!showWidget) return null;

  const chips = quickActionsFor(location.pathname);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setHasInteracted(true); }}
        aria-label="Open Aria, your brand assistant"
        className={`fixed z-[70] bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] right-5 w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-white modal-shadow transition-transform hover:scale-105 active:scale-95 ${!hasInteracted && !open ? 'animate-pulse' : ''}`}
      >
        {open ? <X size={22} /> : <span className="text-lg font-extrabold">A</span>}
        {!open && proactiveMsg && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-brand-orange border-2 border-white" />
        )}
      </button>

      {/* Proactive bubble, shown collapsed above the trigger until opened */}
      {!open && proactiveMsg && (
        <button
          type="button"
          onClick={() => { setOpen(true); setHasInteracted(true); }}
          className="fixed z-[70] bottom-[calc(max(1.25rem,env(safe-area-inset-bottom)+0.75rem)+72px)] right-5 max-w-[240px] card !rounded-2xl modal-shadow p-3 text-left animate-fadeIn"
        >
          <p className="text-[12px] text-brand-dark leading-snug">{proactiveMsg}</p>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed z-[70] bottom-0 right-0 sm:bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+5.5rem))] sm:right-5 w-full sm:w-[380px] h-[60vh] sm:h-[520px] bg-white sm:rounded-[24px] rounded-t-[24px] modal-shadow flex flex-col overflow-hidden animate-slideUp">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(124,92,252,0.08)] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
              <div>
                <div className="text-[13px] font-bold text-brand-dark leading-tight flex items-center gap-1.5">
                  Aria <span className="w-1.5 h-1.5 rounded-full bg-brand-teal inline-block" />
                </div>
                <div className="text-[10px] text-brand-muted">Your Brand Assistant</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.06)] text-brand-muted hover:text-brand-purple transition-colors">
              <X size={16} />
            </button>
          </div>

          <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !proactiveMsg && (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white mx-auto mb-3">
                  <Sparkles size={16} />
                </div>
                <p className="text-[12px] text-brand-muted">
                  Hi{firstName ? ` ${firstName}` : ''}! Ask me anything about Eclatale, or pick a quick action below.
                </p>
              </div>
            )}
            {proactiveMsg && messages.length === 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-white border border-[rgba(124,92,252,0.1)] rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-brand text-[13px] text-brand-dark leading-relaxed">
                  {proactiveMsg}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === 'user'
                    ? 'gradient-primary text-white rounded-2xl rounded-br-md'
                    : 'bg-white border border-[rgba(124,92,252,0.1)] text-brand-dark rounded-2xl rounded-bl-md shadow-brand'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-[rgba(124,92,252,0.1)] rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-brand">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {chips.map(c => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-[rgba(124,92,252,0.2)] text-brand-purple hover:bg-[rgba(124,92,252,0.08)] transition-colors font-medium"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 px-4 py-3 border-t border-[rgba(124,92,252,0.08)] flex-shrink-0"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Aria anything..."
              className="input !py-2.5 !min-h-0 flex-1 !text-[13px]"
            />
            <button type="submit" disabled={!input.trim() || sending} aria-label="Send" className="w-9 h-9 rounded-full gradient-primary text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
