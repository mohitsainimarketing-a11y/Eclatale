import React from 'react';
import { Sparkles, TrendingUp, Zap, ArrowRight } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center px-8 py-5 z-10 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="text-2xl font-bold gradient-text">Eclatale</div>
        <a
          href="/signup"
          className="text-sm px-6 py-2.5 rounded-full font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-300/30"
        >
          Get Early Access
        </a>
      </nav>

      {/* Hero */}
      <div className="gradient-bg-hero pt-32 pb-20 px-6">
        <div className="text-center max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 text-sm px-5 py-2 rounded-full mb-8 font-medium text-purple-700 bg-purple-100 border border-purple-200"
          >
            <Sparkles size={16} className="text-purple-500" />
            AI Personal Brand Growth OS
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-gray-900">
            Burst onto your
            <span className="gradient-text"> industry.</span>
          </h1>

          <p className="text-lg text-gray-600 mb-10 max-w-xl mx-auto leading-relaxed">
            Eclatale learns your authentic voice, generates content in your style,
            and tracks real career outcomes. Not a LinkedIn optimizer — a growth engine.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/signup"
              className="px-8 py-4 rounded-full font-semibold text-white gradient-bg hover:opacity-90 transition-all text-center shadow-xl shadow-purple-400/25 flex items-center justify-center gap-2"
            >
              Start Growing Free <ArrowRight size={18} />
            </a>
            <button className="px-8 py-4 rounded-full font-semibold border-2 border-purple-200 text-purple-700 hover:bg-purple-50 transition-all">
              See How It Works
            </button>
          </div>

          <p className="mt-10 text-sm text-gray-500 font-medium">
            Join 500+ founders and executives building their personal brand
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="py-20 px-6 gradient-bg-soft">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Everything you need to <span className="gradient-text">grow</span>
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-lg mx-auto">
            AI-powered tools that understand your unique voice and amplify it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Sparkles className="text-purple-500" size={28} />,
                title: 'AI Content Engine',
                desc: 'Generate posts that sound like you, not a robot. Trained on your style.',
                color: 'purple',
              },
              {
                icon: <TrendingUp className="text-pink-500" size={28} />,
                title: 'Growth Analytics',
                desc: 'Track what matters — not vanity metrics, but real career outcomes.',
                color: 'pink',
              },
              {
                icon: <Zap className="text-orange-500" size={28} />,
                title: 'Smart Scheduling',
                desc: 'Post at the perfect time. Our AI knows when your audience is active.',
                color: 'orange',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-8 shadow-lg shadow-purple-100/50 border border-purple-100/50 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 ${
                    feature.color === 'purple'
                      ? 'bg-purple-100'
                      : feature.color === 'pink'
                      ? 'bg-pink-100'
                      : 'bg-orange-100'
                  }`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center gradient-bg rounded-3xl p-12 shadow-2xl shadow-purple-400/20">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to build your personal brand?
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            Join thousands of professionals growing their influence with AI.
          </p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold bg-white text-purple-700 hover:bg-purple-50 transition-all shadow-lg"
          >
            Get Started Free <ArrowRight size={18} />
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="py-8 px-6 border-t border-purple-100 text-center">
        <span className="text-sm font-bold gradient-text">Eclatale</span>
        <span className="text-sm text-gray-400 ml-2">&copy; 2026. All rights reserved.</span>
      </div>
    </div>
  );
}
