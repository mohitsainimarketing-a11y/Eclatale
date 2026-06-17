import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart3, Users, Eye, Trophy, Sparkles, PenTool, LogOut } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/signup';
      } else {
        setUser(data.user);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const stats = [
    { label: 'Profile Views', value: '0', icon: <Eye size={20} className="text-purple-500" />, bg: 'bg-purple-50', border: 'border-purple-100' },
    { label: 'Engagement Rate', value: '0%', icon: <BarChart3 size={20} className="text-pink-500" />, bg: 'bg-pink-50', border: 'border-pink-100' },
    { label: 'New Connections', value: '0', icon: <Users size={20} className="text-orange-500" />, bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Growth Score', value: '0/100', icon: <Trophy size={20} className="text-violet-500" />, bg: 'bg-violet-50', border: 'border-violet-100' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Nav */}
      <nav className="bg-white border-b border-purple-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="text-2xl font-bold gradient-text">Eclatale</div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 font-medium">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-full border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all font-medium"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* Welcome Banner */}
        <div className="gradient-bg rounded-2xl p-8 mb-8 shadow-lg shadow-purple-300/20">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to Eclatale
          </h1>
          <p className="text-white/80 text-lg">
            Your personal brand growth journey starts here.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className={`bg-white rounded-2xl p-6 border-2 ${stat.border} hover:shadow-lg transition-all`}>
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                {stat.icon}
              </div>
              <div className="text-sm text-gray-500 font-medium mb-1">{stat.label}</div>
              <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-400 mt-1 font-medium">Getting started</div>
            </div>
          ))}
        </div>

        {/* Create Post */}
        <div className="bg-white rounded-2xl p-8 border-2 border-purple-100 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Create Your First Post</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a href="/create" className="p-6 rounded-xl border-2 border-purple-100 cursor-pointer hover:border-purple-400 hover:shadow-lg transition-all bg-gradient-to-br from-purple-50 to-pink-50 group block">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <Sparkles className="text-purple-600" size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">AI Auto-Generate</h3>
              <p className="text-sm text-gray-500">
                Tell us your topic and we'll create a perfect LinkedIn post in seconds
              </p>
            </a>
            <div className="p-6 rounded-xl border-2 border-pink-100 cursor-pointer hover:border-pink-400 hover:shadow-lg transition-all bg-gradient-to-br from-pink-50 to-orange-50 group">
              <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center mb-4 group-hover:bg-pink-200 transition-colors">
                <PenTool className="text-pink-600" size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Guided Creation</h3>
              <p className="text-sm text-gray-500">
                Have an idea? We'll help you shape it into compelling content
              </p>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white rounded-2xl p-8 border-2 border-orange-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Coming Up Next</h2>
          <div className="space-y-3">
            {[
              { text: 'Complete your persona setup', color: 'bg-purple-500' },
              { text: 'Connect your LinkedIn for analytics', color: 'bg-pink-500' },
              { text: 'Generate your first AI post', color: 'bg-orange-500' },
              { text: 'Track your growth score', color: 'bg-violet-500' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-600 text-sm font-medium">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color}`}></div>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
