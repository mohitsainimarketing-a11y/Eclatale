import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen text-white" style={{background: '#0A0A0F'}}>
      
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-5 border-b border-white/10">
        <div className="text-xl font-bold" style={{color: '#7C5CFC'}}>
          Eclatale
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-full border border-white/20 hover:border-red-500 hover:text-red-400 transition-all"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        
        {/* Welcome */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-2">
            Welcome to Eclatale 👋
          </h1>
          <p className="text-gray-400">
            Your personal brand growth journey starts here.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Profile Views', value: '0', change: 'Getting started' },
            { label: 'Engagement Rate', value: '0%', change: 'Getting started' },
            { label: 'New Connections', value: '0', change: 'Getting started' },
            { label: 'Growth Score', value: '0/100', change: 'Getting started' },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl p-6 border border-white/10"
              style={{background: '#111118'}}>
              <div className="text-sm text-gray-400 mb-2">{stat.label}</div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Create Post */}
        <div className="rounded-2xl p-8 border border-white/10 mb-6"
          style={{background: '#111118'}}>
          <h2 className="text-xl font-semibold mb-6">Create Your First Post</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl border border-white/10 cursor-pointer hover:border-purple-500 transition-all"
              style={{background: '#0A0A0F'}}>
              <div className="text-2xl mb-3">🤖</div>
              <h3 className="font-semibold mb-2">AI Auto-Generate</h3>
              <p className="text-sm text-gray-400">
                Tell us your topic and we'll create a perfect LinkedIn post in seconds
              </p>
            </div>
            <div className="p-6 rounded-xl border border-white/10 cursor-pointer hover:border-purple-500 transition-all"
              style={{background: '#0A0A0F'}}>
              <div className="text-2xl mb-3">✍️</div>
              <h3 className="font-semibold mb-2">Guided Creation</h3>
              <p className="text-sm text-gray-400">
                Have an idea? We'll help you shape it into compelling content
              </p>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="rounded-2xl p-8 border border-white/10"
          style={{background: '#111118'}}>
          <h2 className="text-xl font-semibold mb-4">Coming Up Next</h2>
          <div className="space-y-3">
            {[
              '🎯 Complete your persona setup',
              '📊 Connect your LinkedIn for analytics',
              '🚀 Generate your first AI post',
              '📈 Track your growth score',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-400 text-sm">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                {item}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}