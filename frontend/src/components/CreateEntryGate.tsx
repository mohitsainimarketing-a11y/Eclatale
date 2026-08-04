import React, { useEffect, useState } from 'react';
import { MessageCircle, BookOpen, Paperclip, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface OptionCard {
  id: 'talk' | 'library' | 'resource';
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
}

const OPTIONS: OptionCard[] = [
  { id: 'talk', icon: <MessageCircle size={22} />, title: 'Talk to AI', desc: "Tell me what you want to write about. AI finds the latest on it.", cta: 'Start talking', href: '/create/talk' },
  { id: 'library', icon: <BookOpen size={22} />, title: 'Content Library', desc: 'Browse & tag your posts. Find the right content fast.', cta: 'Browse posts', href: '/history' },
  { id: 'resource', icon: <Paperclip size={22} />, title: 'Drop a Resource', desc: 'URL, PDF, doc, or file. AI reads it and creates with you.', cta: 'Drop something', href: '/create/resource' },
];

export default function CreateEntryGate({ onSkip }: { onSkip: () => void }) {
  const [recommended, setRecommended] = useState<OptionCard['id'] | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: posts } = await supabase.from('posts').select('source').eq('user_id', uid).order('created_at', { ascending: false }).limit(20);
      if (!posts?.length) return;
      const repurposeCount = posts.filter(p => p.source === 'repurpose').length;
      // "Repurpose" usage history maps most closely to the resource-driven flow.
      if (repurposeCount / posts.length > 0.4) setRecommended('resource');
      else setRecommended('talk');
    });
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-8 max-w-md">
        <h1 className="text-2xl font-extrabold text-brand-dark mb-1.5">How do you want to create today?</h1>
        <p className="text-sm text-brand-muted">Pick a starting point — you can always switch later.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {OPTIONS.map(opt => (
          <a key={opt.id} href={opt.href}
            className="group relative flex flex-col p-6 rounded-3xl border border-[rgba(0,0,0,0.06)] bg-white hover:border-transparent transition-all hover:-translate-y-1"
            style={{ boxShadow: '0 4px 24px rgba(124,92,252,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,92,252,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,92,252,0.08)')}
          >
            {recommended === opt.id && (
              <span className="absolute -top-2.5 left-5 badge bg-[rgba(255,107,53,0.1)] text-brand-orange text-[10px] !py-1">✨ Recommended</span>
            )}
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white mb-4">{opt.icon}</div>
            <h3 className="text-base font-bold text-brand-dark mb-1.5">{opt.title}</h3>
            <p className="text-[13px] text-brand-muted leading-relaxed mb-5 flex-1">{opt.desc}</p>
            <span className="text-[13px] font-semibold text-brand-purple flex items-center gap-1 group-hover:gap-2 transition-all">
              {opt.cta} <ArrowRight size={14} />
            </span>
          </a>
        ))}
      </div>
      <button onClick={onSkip} className="text-[12px] font-semibold text-brand-muted hover:text-brand-purple mt-8 transition-colors">
        Or use the classic composer →
      </button>
    </div>
  );
}
