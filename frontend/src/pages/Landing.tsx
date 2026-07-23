import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, TrendingUp, Zap, ArrowRight, ChevronDown, Menu, X, Target, Users, BarChart3 } from 'lucide-react';

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [mobileMenuOpen]);

  const features = [
    { icon: <Sparkles size={24} />, title: 'AI Content Engine', desc: 'Generate posts that sound like you, not a robot. Trained on your authentic voice and industry expertise.' },
    { icon: <TrendingUp size={24} />, title: 'Growth Analytics', desc: 'Track what matters. Not vanity metrics, but real career outcomes like leads, opportunities, and influence.' },
    { icon: <Zap size={24} />, title: 'Smart Scheduling', desc: 'Post at the perfect time. Our AI analyzes when your specific audience is most active and engaged.' },
    { icon: <Target size={24} />, title: 'Persona Builder', desc: 'Define your unique voice, values, and positioning. Every piece of content stays authentic to who you are.' },
    { icon: <Users size={24} />, title: 'Network Intelligence', desc: 'Identify and engage with the right people. Build meaningful connections that drive real opportunities.' },
    { icon: <BarChart3 size={24} />, title: 'Growth Score', desc: 'One number that tells you exactly where you stand. Track your personal brand trajectory over time.' },
  ];

  const faqs = [
    { q: 'How is this different from other LinkedIn tools?', a: 'Eclatale isn\'t a LinkedIn optimizer. It\'s a growth engine. We learn your authentic voice, track real career outcomes (not vanity metrics), and build a personalized strategy based on your goals.' },
    { q: 'Will the content sound like me?', a: 'Yes. Our AI analyzes your writing style, industry expertise, and personality to generate content that sounds authentically you. Every post is unique to your voice.' },
    { q: 'What platforms do you support?', a: 'Currently LinkedIn posts, LinkedIn articles, Twitter/X threads, and Instagram captions. More platforms coming soon based on user feedback.' },
    { q: 'Is there a free plan?', a: 'Yes! Start with 10 AI generations per month for free. Upgrade when you\'re ready to scale your content creation.' },
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Nav */}
      <nav ref={navRef} className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">Features</a>
            <a href="#faq" className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">FAQ</a>
            <a href="/login" className="text-sm font-medium text-brand-muted hover:text-brand-purple hover:underline transition-colors">Sign In</a>
            <a href="/signup" className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center" aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[rgba(124,92,252,0.06)] px-5 py-4 space-y-3 animate-fadeIn">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-sm font-medium text-brand-muted">Features</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-sm font-medium text-brand-muted">FAQ</a>
            <a href="/login" className="block py-3 text-sm font-medium text-brand-muted">Sign In</a>
            <a href="/signup" className="btn-primary text-sm w-full text-center mt-2">Start Free</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="gradient-hero dot-grid pt-28 md:pt-36 pb-20 md:pb-32 px-5 md:px-8 relative">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple mb-6 md:mb-8 animate-fadeIn">
            <Sparkles size={14} />
            AI Personal Brand Growth OS
          </div>

          <h1 className="h1 text-brand-dark mb-5 md:mb-6 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            Burst onto your<br className="hidden sm:block" />
            <span className="gradient-text"> industry.</span>
          </h1>

          <p className="body-text max-w-lg mx-auto mb-8 md:mb-10 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            Eclatale learns your authentic voice, generates content in your style,
            and tracks real career outcomes. Not a LinkedIn optimizer. A growth engine.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <a href="/signup" className="btn-primary w-full sm:w-auto text-base">
              Start Growing Free <ArrowRight size={18} />
            </a>
            <a href="#features" className="btn-secondary w-full sm:w-auto text-base">
              See How It Works
            </a>
          </div>

          <p className="mt-8 md:mt-10 text-sm text-brand-muted font-medium animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            Trusted by 500+ founders and executives
          </p>
        </div>

        {/* Floating accents */}
        <div className="hidden md:block absolute top-32 left-[10%] w-16 h-16 rounded-full bg-gradient-to-br from-brand-purple/10 to-brand-pink/10 animate-float" />
        <div className="hidden md:block absolute bottom-20 right-[12%] w-12 h-12 rounded-full bg-gradient-to-br from-brand-orange/10 to-brand-pink/10 animate-float" style={{ animationDelay: '2s' }} />
        <div className="hidden md:block absolute top-48 right-[8%] w-8 h-8 rounded-full bg-brand-teal/10 animate-float" style={{ animationDelay: '1s' }} />
      </section>

      {/* Wave divider */}
      <div className="relative -mt-1">
        <svg viewBox="0 0 1440 80" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0 40C360 80 720 0 1080 40C1260 60 1360 50 1440 40V80H0V40Z" fill="#FDF4FF" />
        </svg>
      </div>

      {/* Features */}
      <section id="features" className="bg-brand-bg py-16 md:py-24 px-5 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="h2 text-brand-dark mb-4">
              Everything you need to <span className="gradient-text">grow</span>
            </h2>
            <p className="body-text max-w-md mx-auto">
              AI-powered tools that understand your unique voice and amplify it across every platform.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {features.map((f, i) => (
              <div key={i} className="card card-hover p-7 md:p-8">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white mb-5">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-brand-dark mb-2">{f.title}</h3>
                <p className="text-sm text-brand-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 md:py-24 px-5 md:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="h2 text-brand-dark mb-12 md:mb-16">
            Loved by <span className="gradient-text">ambitious</span> professionals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {[
              { quote: 'Eclatale helped me land 3 speaking gigs in 2 months. The AI actually sounds like me.', name: 'Sarah K.', role: 'VP of Product' },
              { quote: 'My LinkedIn impressions went from 2K to 50K/week. The content strategy is unreal.', name: 'Marcus J.', role: 'Startup Founder' },
              { quote: 'I was skeptical about AI writing. But this genuinely captures my voice. Game changer.', name: 'Priya R.', role: 'Marketing Director' },
            ].map((t, i) => (
              <div key={i} className="card p-6 md:p-7 text-left relative">
                <div className="absolute top-5 left-6 text-4xl font-serif gradient-text opacity-30">"</div>
                <p className="text-sm text-brand-dark leading-relaxed mb-5 mt-4">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-brand-dark">{t.name}</div>
                    <div className="text-xs text-brand-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24 px-5 md:px-8 bg-brand-bg">
        <div className="max-w-2xl mx-auto">
          <h2 className="h2 text-brand-dark text-center mb-10 md:mb-12">
            Frequently asked <span className="gradient-text">questions</span>
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="font-semibold text-brand-dark text-[15px] pr-4">{faq.q}</span>
                  <ChevronDown size={18} className={`text-brand-muted flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 md:px-6 pb-5 md:pb-6 animate-fadeIn">
                    <p className="text-sm text-brand-muted leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 px-5 md:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="gradient-primary rounded-3xl md:rounded-[32px] p-8 md:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 dot-grid opacity-10" />
            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Ready to build your<br />personal brand?
              </h2>
              <p className="text-white/75 mb-8 text-base md:text-lg max-w-md mx-auto">
                Join thousands of professionals growing their influence with AI.
              </p>
              <a href="/signup" className="inline-flex items-center gap-2 bg-white text-brand-purple font-semibold px-8 py-4 rounded-full hover:bg-brand-bg transition-all shadow-lg text-base">
                Get Started Free <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
          <p className="text-sm text-brand-muted">&copy; 2026 Eclatale. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
