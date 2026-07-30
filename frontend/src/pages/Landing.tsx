import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, TrendingUp, Zap, ArrowRight, ChevronDown, Menu, X,
  Check, Shield, Lock, Star, AudioWaveform, ShieldCheck, LineChart, Layers,
} from 'lucide-react';
import { trackEvent } from '../lib/analytics';
import NewsletterSignup from '../components/NewsletterSignup';

// lucide-react dropped brand/logo icons — small inline SVGs for the footer instead.
const LinkedInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
  </svg>
);
const TwitterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.9 2.25h3.07l-6.71 7.67 7.9 10.83h-6.19l-4.85-6.34-5.55 6.34H3.5l7.18-8.2L3.1 2.25h6.35l4.38 5.8 5.07-5.8Zm-1.08 16.66h1.7L7.28 4.03H5.45l12.37 14.88Z" />
  </svg>
);
const InstagramIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

function useCountUp(target: number, decimals = 0) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1400;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(target * eased);
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return { ref, display: decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString() };
}

function StatCounter({ value, suffix, label, decimals }: { value: number; suffix: string; label: string; decimals?: number }) {
  const { ref, display } = useCountUp(value, decimals || 0);
  return (
    <div ref={ref}>
      <div className="text-3xl md:text-5xl font-extrabold text-white leading-none">{display}{suffix}</div>
      <div className="text-xs md:text-sm text-white/75 font-medium mt-2">{label}</div>
    </div>
  );
}

function TypingLine({ text, delayMs = 0 }: { text: string; delayMs?: number }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, 45);
    }, delayMs);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, delayMs]);
  return <span>{shown}<span className="inline-block w-[2px] h-[1em] bg-brand-purple align-middle ml-0.5 animate-pulse" /></span>;
}

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

  const handleStartFree = () => trackEvent('begin_signup', { location: 'landing' });
  const handleViewPricing = () => trackEvent('view_pricing');

  const features = [
    { icon: <AudioWaveform size={24} />, title: 'Learns Your Voice', desc: 'Feed Eclatale a few writing samples. Tell it your communication style. The more you use it, the more it sounds like the real you — not a polished, corporate, forgettable version of you.' },
    { icon: <Sparkles size={24} />, title: 'Smart Content Engine', desc: 'Two ways to create. Auto-generate from a topic in seconds, or bring your own idea and let Eclatale shape it into something worth reading. You control how much AI helps.' },
    { icon: <ShieldCheck size={24} />, title: 'Confidence Score Before You Post', desc: 'Before every post goes live, Eclatale checks it. Factual accuracy. Topic freshness. Voice consistency. You see a score, specific suggestions, and supporting references. Post with evidence, not hope.' },
    { icon: <LineChart size={24} />, title: 'Real Growth Intelligence', desc: 'Track what actually matters — not vanity metrics, but patterns. Which hooks work for you. Which topics resonate. Which times drive real engagement. Intelligence that makes your next post better than your last.' },
    { icon: <Layers size={24} />, title: 'One Post, Every Platform', desc: 'Write once. Eclatale adapts it for LinkedIn, Twitter, Instagram, and more. Each version tuned for that platform\'s style, character limit, and audience expectation.' },
    { icon: <TrendingUp size={24} />, title: 'Your Brand, Compounding', desc: 'Thirty days from now, Eclatale will know you better than any tool you\'ve ever used. Sixty days in, your content will feel effortless. This is what compounding looks like for personal brands.' },
  ];

  const testimonials = [
    { quote: 'My profile views went from 200 to 1,400 in 6 weeks.', name: 'Sarah K.', role: 'VP of Product' },
    { quote: 'I landed my first consulting client directly from a LinkedIn post.', name: 'Marcus J.', role: 'Startup Founder' },
    { quote: 'For the first time, my posts actually sound like me.', name: 'Priya R.', role: 'Marketing Director' },
    { quote: 'I went from posting once a month to posting three times a week — and loving it.', name: 'David L.', role: 'Agency Owner' },
    { quote: 'My CEO asked me how I got so good at LinkedIn. I told him about Eclatale.', name: 'Amara T.', role: 'Chief of Staff' },
    { quote: 'The authenticity score changed how I think about content entirely.', name: 'James O.', role: 'Solo Consultant' },
  ];

  const faqs = [
    { q: 'What exactly does Eclatale do?', a: 'Eclatale is a personal brand growth engine. It learns your authentic voice, checks every post for accuracy and freshness before you publish, and tracks the real career outcomes that matter — not vanity metrics — as part of a strategy built around your goals.' },
    { q: 'Will the content sound like me?', a: 'Yes. Our AI analyzes your writing style, industry expertise, and personality to generate content that sounds authentically you. Every post is unique to your voice.' },
    { q: 'Is Eclatale safe for my LinkedIn account?', a: 'Yes. Eclatale publishes exclusively through LinkedIn\'s official API, so your account stays fully compliant with zero risk of automation-related bans.' },
    { q: 'Is there a free plan?', a: 'Yes! Start with 10 AI generations per month for free. Upgrade when you\'re ready to scale your content creation.' },
    { q: 'How quickly will I see results?', a: 'Most users see engagement increase within 2-3 weeks of consistent posting. Personal brand growth compounds — the earlier and more consistently you post, the faster it builds.' },
    { q: 'Does it work for non-English speakers?', a: 'Eclatale is currently optimized for English. Support for other languages is coming soon — join the waitlist from Settings and we\'ll let you know when yours is ready.' },
    { q: 'Can I use Eclatale for my company LinkedIn page?', a: 'The Individual plan covers personal profiles. Company page support is coming in our upcoming SMB plan — reach out if you want early access.' },
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Nav */}
      <nav ref={navRef} className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-extrabold gradient-text">Eclatale</a>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">Features</a>
            <a href="/pricing" onClick={handleViewPricing} className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">Pricing</a>
            <a href="/blog" className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">Blog</a>
            <a href="#faq" className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">FAQ</a>
            <a href="/login" className="text-sm font-medium text-brand-muted hover:text-brand-purple hover:underline transition-colors">Sign In</a>
            <a href="/signup" onClick={handleStartFree} className="btn-primary text-sm !py-2.5 !px-6">Start Free</a>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center" aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[rgba(124,92,252,0.06)] px-5 py-4 space-y-3 animate-fadeIn">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-sm font-medium text-brand-muted">Features</a>
            <a href="/pricing" onClick={() => { setMobileMenuOpen(false); handleViewPricing(); }} className="block py-3 text-sm font-medium text-brand-muted">Pricing</a>
            <a href="/blog" className="block py-3 text-sm font-medium text-brand-muted">Blog</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-sm font-medium text-brand-muted">FAQ</a>
            <a href="/login" className="block py-3 text-sm font-medium text-brand-muted">Sign In</a>
            <a href="/signup" onClick={handleStartFree} className="btn-primary text-sm w-full text-center mt-2">Start Free</a>
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
            Burst Onto Your Industry.<br className="hidden sm:block" />
            Be Seen. <span className="gradient-text">Be Known.</span>
          </h1>

          <p className="body-text max-w-xl mx-auto mb-8 md:mb-10 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            Your personal brand AI. It learns how you think. It writes how you speak.
            It checks what you publish. And it gets better every single day.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <a href="/signup" onClick={handleStartFree} className="btn-primary w-full sm:w-auto text-base">
              Start Free — No Credit Card <ArrowRight size={18} />
            </a>
            <a href="#demo" className="btn-secondary w-full sm:w-auto text-base">
              See How It Works →
            </a>
          </div>

          <div className="mt-8 md:mt-10 flex flex-col items-center gap-2 animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['SK', 'MJ', 'PR', 'DL', 'AT'].map((initials, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full gradient-primary border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className="fill-brand-orange text-brand-orange" />
                ))}
              </div>
            </div>
            <p className="text-sm text-brand-muted font-medium">Join 500+ founders and executives</p>
          </div>
        </div>

        {/* Floating accents */}
        <div className="hidden md:block absolute top-32 left-[10%] w-16 h-16 rounded-full bg-gradient-to-br from-brand-purple/10 to-brand-pink/10 animate-float" />
        <div className="hidden md:block absolute bottom-20 right-[12%] w-12 h-12 rounded-full bg-gradient-to-br from-brand-orange/10 to-brand-pink/10 animate-float" style={{ animationDelay: '2s' }} />
        <div className="hidden md:block absolute top-48 right-[8%] w-8 h-8 rounded-full bg-brand-teal/10 animate-float" style={{ animationDelay: '1s' }} />

        {/* Floating UI element screenshots — makes the hero feel alive without a video */}
        <div
          className="hidden lg:block absolute top-40 left-[4%] w-40 card p-4 !rounded-2xl modal-shadow animate-float"
          style={{ animationDelay: '0.3s' }}
          aria-hidden="true"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="tiny text-brand-muted">GROWTH SCORE</span>
          </div>
          <div className="flex items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(124,92,252,0.12)" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke="#7C5CFC" strokeWidth="4" strokeDasharray="113" strokeDashoffset="22" strokeLinecap="round" transform="rotate(-90 22 22)" />
            </svg>
            <div>
              <div className="text-xl font-extrabold text-brand-dark leading-none">82</div>
              <div className="text-[11px] text-brand-teal font-semibold">↑ 6 this week</div>
            </div>
          </div>
        </div>

        <div
          className="hidden lg:block absolute top-24 right-[3%] w-44 card p-4 !rounded-2xl modal-shadow animate-float"
          style={{ animationDelay: '1.4s' }}
          aria-hidden="true"
        >
          <span className="tiny text-brand-muted">AUTHENTICITY SCORE</span>
          <div className="flex items-end gap-2 mt-1.5">
            <span className="text-2xl font-extrabold text-brand-teal leading-none">87</span>
            <span className="text-xs text-brand-muted mb-0.5">/100</span>
          </div>
          <div className="h-1.5 rounded-full bg-[rgba(6,214,160,0.15)] mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-brand-teal" style={{ width: '87%' }} />
          </div>
        </div>

        <div
          className="hidden lg:block absolute bottom-6 left-[8%] w-48 card p-4 !rounded-2xl modal-shadow animate-float"
          style={{ animationDelay: '2.2s' }}
          aria-hidden="true"
        >
          <span className="tiny text-brand-muted">IDEA</span>
          <p className="text-xs font-semibold text-brand-dark mt-1.5 leading-snug">"The one leadership lesson nobody teaches in business school"</p>
        </div>
      </section>

      {/* Wave divider */}
      <div className="relative -mt-1">
        <svg viewBox="0 0 1440 80" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0 40C360 80 720 0 1080 40C1260 60 1360 50 1440 40V80H0V40Z" fill="#FDF4FF" />
        </svg>
      </div>

      {/* Live product preview — replaces the old video/demo section */}
      <section id="demo" className="bg-brand-bg py-16 md:py-20 px-5 md:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="h2 text-brand-dark mb-4">
            Generate a post in seconds. In your voice. <span className="gradient-text">Verified authentic.</span>
          </h2>
          <p className="body-text max-w-md mx-auto mb-10 md:mb-12">
            No demo video needed — here's exactly what happens when you type a topic into Eclatale.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 text-left">
            {/* LEFT: AI Assistant panel with a topic being typed */}
            <div className="card p-6 md:p-7">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="text-sm font-bold text-brand-dark">What do you want to write about?</span>
              </div>
              <div className="input !min-h-[96px] flex items-start pt-3.5 text-brand-dark text-[15px]">
                <TypingLine text="The future of AI in marketing" delayMs={400} />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {['Confident', 'Story-driven', 'Standard length'].map((tag) => (
                  <span key={tag} className="badge bg-[rgba(124,92,252,0.06)] text-brand-purple text-xs">{tag}</span>
                ))}
              </div>
              <div className="btn-primary w-full mt-5 text-sm opacity-90 cursor-default">
                <Sparkles size={15} /> Generate Post
              </div>
            </div>

            {/* RIGHT: generated LinkedIn post appearing with authenticity score */}
            <div className="card p-6 md:p-7 animate-fadeIn" style={{ animationDelay: '1.6s' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">YOU</div>
                  <div>
                    <div className="text-sm font-semibold text-brand-dark leading-tight">Your Name</div>
                    <div className="text-xs text-brand-muted">Now · 🌐</div>
                  </div>
                </div>
                <div className="badge bg-[rgba(6,214,160,0.1)] text-brand-teal text-xs flex-shrink-0">
                  <Check size={12} /> 87/100
                </div>
              </div>
              <p className="post-content text-[14px] mb-4">
                Everyone's talking about AI replacing marketers. That's the wrong question.<br /><br />
                The real shift: AI handles the drafts. You bring the judgment, the story, the voice only you have.<br /><br />
                The marketers who win in 2026 aren't the ones avoiding AI — they're the ones who stay unmistakably themselves while using it.
              </p>
              <div className="flex items-center gap-4 pt-3 border-t border-[rgba(124,92,252,0.06)] text-xs text-brand-muted">
                <span>👍 248</span>
                <span>💬 34 comments</span>
                <span>↻ 12 reposts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof stats bar */}
      <section className="gradient-primary py-12 md:py-16 px-5 md:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
          {[
            { value: 500, suffix: '+', label: 'professionals' },
            { value: 10000, suffix: '+', label: 'posts generated' },
            { value: 87, suffix: '%', label: 'avg. voice match' },
            { value: 4.8, suffix: '/5', label: 'rating', decimals: 1 },
          ].map((stat, i) => (
            <StatCounter key={i} value={stat.value} suffix={stat.suffix} label={stat.label} decimals={stat.decimals} />
          ))}
        </div>
      </section>

      {/* Trust signals (incl. "Built for professionals at") */}
      <section className="py-16 md:py-20 px-5 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="tiny text-brand-muted text-center mb-6">BUILT FOR PROFESSIONALS AT</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-12 md:mb-16">
            {['Series A Startups', 'Fortune 500 Companies', 'Consulting Firms', 'Growth-Stage SaaS', 'Boutique Agencies'].map((name) => (
              <span key={name} className="text-sm md:text-base font-bold text-brand-muted/60 tracking-tight">{name}</span>
            ))}
          </div>
          <h2 className="h2 text-brand-dark text-center mb-10 md:mb-12">
            Why professionals <span className="gradient-text">trust Eclatale</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            <div className="card p-6 md:p-7 text-center">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white mx-auto mb-4">
                <Shield size={22} />
              </div>
              <h3 className="text-sm font-bold text-brand-dark mb-2">100% LinkedIn compliant</h3>
              <p className="text-sm text-brand-muted leading-relaxed">Official API only. Zero ban risk — no browser automation, ever.</p>
            </div>
            <div className="card p-6 md:p-7 text-center">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white mx-auto mb-4">
                <Lock size={22} />
              </div>
              <h3 className="text-sm font-bold text-brand-dark mb-2">Your data stays yours</h3>
              <p className="text-sm text-brand-muted leading-relaxed">Your data never leaves your account. No sharing, no reselling.</p>
            </div>
            <div className="card p-6 md:p-7 text-center">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white mx-auto mb-4">
                <Sparkles size={22} />
              </div>
              <h3 className="text-sm font-bold text-brand-dark mb-2">Gets smarter over time</h3>
              <p className="text-sm text-brand-muted leading-relaxed">AI that gets smarter with every post you keep, edit, or publish.</p>
            </div>
          </div>
        </div>
      </section>

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

      {/* Philosophy */}
      <section className="py-16 md:py-24 px-5 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="h2 text-brand-dark mb-4">
              Built on a <span className="gradient-text">different philosophy</span>
            </h2>
            <p className="body-text max-w-md mx-auto">
              Most content tools generate posts. Eclatale builds your brand.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-14 md:mb-16">
            <div className="card card-hover p-7 md:p-8">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white mb-5">
                <AudioWaveform size={26} />
              </div>
              <h3 className="text-lg font-bold text-brand-dark mb-2.5">Your voice, not a template</h3>
              <p className="text-sm text-brand-muted leading-relaxed">
                Eclatale doesn't give you 50 post templates. It learns exactly how you write, think, and express ideas — then generates content that sounds like you wrote it on your best day. Every post makes the AI smarter about you.
              </p>
            </div>
            <div className="card card-hover p-7 md:p-8">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white mb-5">
                <ShieldCheck size={26} />
              </div>
              <h3 className="text-lg font-bold text-brand-dark mb-2.5">Confidence before you publish</h3>
              <p className="text-sm text-brand-muted leading-relaxed">
                Every post you create gets checked for factual accuracy, topic freshness, and voice consistency before it goes live. You post knowing it's authentic, current, and credibly yours — not hoping it is.
              </p>
            </div>
            <div className="card card-hover p-7 md:p-8">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white mb-5">
                <LineChart size={26} />
              </div>
              <h3 className="text-lg font-bold text-brand-dark mb-2.5">Growth that compounds</h3>
              <p className="text-sm text-brand-muted leading-relaxed">
                Your tenth post will be better than your first. Your fiftieth will be better than your tenth. Eclatale gets smarter with every post you keep, every refinement you make, every piece of feedback the market gives you.
              </p>
            </div>
          </div>
          <p className="text-center text-xl md:text-3xl font-extrabold text-brand-dark leading-snug max-w-2xl mx-auto">
            This isn't a scheduler. This isn't a template library.<br className="hidden sm:block" /> This is the AI that learns <span className="gradient-text">you</span>.
          </p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 md:py-24 px-5 md:px-8 bg-brand-bg">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="h2 text-brand-dark mb-12 md:mb-16">
            Loved by <span className="gradient-text">ambitious</span> professionals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="card p-6 md:p-7 text-left relative bg-white">
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

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-24 px-5 md:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="badge bg-[rgba(255,107,53,0.1)] text-brand-orange mb-5 mx-auto">
            <Zap size={13} /> Launch Special: Use LAUNCH50 for 50% off first 3 months
          </div>
          <h2 className="h2 text-brand-dark mb-4">
            Simple, <span className="gradient-text">honest</span> pricing
          </h2>
          <p className="body-text max-w-md mx-auto mb-10">
            Most founders pay less per month than one coffee meeting.
          </p>
          <div className="card p-8 md:p-10 max-w-md mx-auto text-left">
            <div className="text-sm font-semibold text-brand-purple uppercase tracking-wide mb-2">Individual</div>
            <div className="flex items-end gap-3 mb-1">
              <span className="text-2xl text-brand-muted line-through">$49</span>
              <span className="text-5xl font-extrabold text-brand-dark">$19</span>
              <span className="text-brand-muted mb-1">/mo</span>
            </div>
            <p className="text-xs text-brand-muted mb-6">Billed monthly. Cancel anytime.</p>
            <ul className="space-y-3 mb-8">
              {['Unlimited AI post generation', 'Persona voice learning engine', 'Content authenticity score', 'Direct LinkedIn publishing', 'Growth analytics dashboard'].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-brand-dark">
                  <Check size={16} className="text-brand-teal flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
            <a href="/signup" onClick={handleStartFree} className="btn-primary w-full text-center justify-center text-[15px]">
              Start Free — No Credit Card
            </a>
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
                  <ChevronDown size={18} className={`text-brand-muted flex-shrink-0 transition-transform duration-300 ease-out ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: openFaq === i ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm text-brand-muted leading-relaxed px-5 md:px-6 pb-5 md:pb-6">{faq.a}</p>
                  </div>
                </div>
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
              <a href="/signup" onClick={handleStartFree} className="inline-flex items-center gap-2 bg-white text-brand-purple font-semibold px-8 py-4 rounded-full hover:bg-brand-bg transition-all shadow-brand-lg text-base">
                Get Started Free <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-14 pb-8 px-5 md:px-8 border-t border-[rgba(124,92,252,0.06)] bg-brand-bg">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
            <div>
              <a href="/" className="text-lg font-extrabold gradient-text">Eclatale</a>
              <p className="text-sm text-brand-muted mt-2 max-w-xs">Made with ❤️ in Toronto, Canada</p>
            </div>
            <NewsletterSignup />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-[rgba(124,92,252,0.06)]">
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <a href="/blog" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Blog</a>
              <a href="/pricing" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Pricing</a>
              <a href="/privacy" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Privacy</a>
              <a href="/terms" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Terms</a>
              <a href="/refund-policy" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Refund Policy</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://linkedin.com/company/eclatale" target="_blank" rel="noopener noreferrer" aria-label="Eclatale on LinkedIn" className="w-9 h-9 rounded-full flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-purple transition-colors border border-[rgba(124,92,252,0.15)]">
                <LinkedInIcon />
              </a>
              <a href="https://twitter.com/eclatale" target="_blank" rel="noopener noreferrer" aria-label="Eclatale on X (Twitter)" className="w-9 h-9 rounded-full flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-purple transition-colors border border-[rgba(124,92,252,0.15)]">
                <TwitterIcon />
              </a>
              <a href="https://instagram.com/eclatale" target="_blank" rel="noopener noreferrer" aria-label="Eclatale on Instagram" className="w-9 h-9 rounded-full flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-purple transition-colors border border-[rgba(124,92,252,0.15)]">
                <InstagramIcon />
              </a>
            </div>
            <p className="text-sm text-brand-muted">&copy; {new Date().getFullYear()} Eclatale. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
