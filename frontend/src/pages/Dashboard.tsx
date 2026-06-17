import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart3, Users, Eye, Trophy, Sparkles, PenTool, LogOut, Home, Zap, User } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

function GrowthRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-28 h-28 md:w-32 md:h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(124,92,252,0.08)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="45" fill="none"
          stroke="url(#gradient)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ animation: 'ringProgress 1.2s ease forwards' }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C5CFC" />
            <stop offset="50%" stopColor="#F72585" />
            <stop offset="100%" stopColor="#FF6B35" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl md:text-3xl font-extrabold text-brand-dark">{score}</span>
        <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wide">Score</span>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ''}`} />;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/signup';
      } else {
        setUser(data.user);
        setLoading(false);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const stats = [
    { label: 'Profile Views', value: '0', trend: '+0%', icon: <Eye size={18} />, color: 'from-brand-purple to-[#9B7DFC]' },
    { label: 'Engagement', value: '0%', trend: '+0%', icon: <BarChart3 size={18} />, color: 'from-brand-pink to-[#FF5CAD]' },
    { label: 'Connections', value: '0', trend: '+0', icon: <Users size={18} />, color: 'from-brand-orange to-[#FF8F5E]' },
    { label: 'Growth Score', value: '0/100', trend: 'New', icon: <Trophy size={18} />, color: 'from-brand-teal to-brand-blue' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg-page p-5 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg-page pb-20 md:pb-0">
      {/* Desktop Nav */}
      <nav className="hidden md:flex items-center justify-between px-8 h-[72px] bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] sticky top-0 z-40">
        <div className="text-xl font-extrabold gradient-text">Eclatale</div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-brand-muted font-medium">{user?.email}</span>
          <button onClick={handleLogout} className="btn-ghost !py-2 !px-4 text-sm !text-red-500 !border-red-100 hover:!bg-red-50">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </nav>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-5 h-14 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] sticky top-0 z-40">
        <div className="text-lg font-extrabold gradient-text">Eclatale</div>
        <button onClick={handleLogout} className="text-sm text-red-500 font-medium p-2" aria-label="Logout">
          <LogOut size={18} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-10">
        {/* Welcome + Growth Score */}
        <div className="card p-6 md:p-8 mb-6 gradient-mesh relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-brand-dark mb-1">
                Welcome back
              </h1>
              <p className="text-sm text-brand-muted">Your personal brand growth journey is active.</p>
            </div>
            <GrowthRing score={0} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="card card-hover p-4 md:p-5">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white mb-3`}>
                {stat.icon}
              </div>
              <div className="text-xs text-brand-muted font-medium mb-1">{stat.label}</div>
              <div className="text-xl md:text-2xl font-bold text-brand-dark">{stat.value}</div>
              <div className="text-[11px] font-semibold text-brand-teal mt-1">{stat.trend}</div>
            </div>
          ))}
        </div>

        {/* Create Content */}
        <div className="card p-6 md:p-8 mb-6">
          <h2 className="text-lg font-bold text-brand-dark mb-5">Create Content</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a href="/create" className="card card-hover p-5 md:p-6 block group !shadow-none !border-[rgba(124,92,252,0.1)] hover:!border-brand-purple/30">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform">
                <Sparkles size={20} />
              </div>
              <h3 className="font-bold text-brand-dark mb-1">AI Auto-Generate</h3>
              <p className="text-sm text-brand-muted">Pick a topic and we'll create content in your voice instantly.</p>
            </a>
            <a href="/guided" className="card card-hover p-5 md:p-6 block group !shadow-none !border-[rgba(124,92,252,0.1)] hover:!border-brand-pink/30">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform">
                <PenTool size={20} />
              </div>
              <h3 className="font-bold text-brand-dark mb-1">Guided Creation</h3>
              <p className="text-sm text-brand-muted">Have an idea? We'll ask smart questions to shape it perfectly.</p>
            </a>
          </div>
        </div>

        {/* Coming Up */}
        <div className="card p-6 md:p-8">
          <h2 className="text-lg font-bold text-brand-dark mb-4">Your Roadmap</h2>
          <div className="space-y-3">
            {[
              { text: 'Complete your persona setup', done: false },
              { text: 'Connect LinkedIn for analytics', done: false },
              { text: 'Generate your first AI post', done: false },
              { text: 'Track your growth score', done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  item.done ? 'bg-brand-teal border-brand-teal' : 'border-[rgba(124,92,252,0.2)]'
                }`}>
                  {item.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className={`font-medium ${item.done ? 'text-brand-muted line-through' : 'text-brand-dark'}`}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-[rgba(124,92,252,0.06)] z-50">
        <div className="flex items-center justify-around h-16">
          {[
            { icon: <Home size={20} />, label: 'Home', href: '/dashboard', active: true },
            { icon: <Zap size={20} />, label: 'Create', href: '/create', active: false },
            { icon: <BarChart3 size={20} />, label: 'Analytics', href: '/dashboard', active: false },
            { icon: <User size={20} />, label: 'Profile', href: '/dashboard', active: false },
          ].map((tab, i) => (
            <a key={i} href={tab.href} className={`flex flex-col items-center gap-1 min-w-[60px] py-2 ${tab.active ? 'text-brand-purple' : 'text-brand-muted'}`}>
              {tab.icon}
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
