import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, TrendingUp, Zap, ArrowRight, ChevronDown, Menu, X, Target, Users, BarChart3,
  Check, Shield, Lock, Star, Play,
} from 'lucide-react';
import { trackEvent } from '../lib/analytics';

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
    { icon: <Sparkles size={24} />, title: 'AI Content Engine', desc: 'Generate posts that sound like you, not a robot. Trained on your authentic voice and industry expertise.' },
    { icon: <TrendingUp size={24} />, title: 'Growth Analytics', desc: 'Track what matters. Not vanity metrics, but real career outcomes like leads, opportunities, and influence.' },
    { icon: <Zap size={24} />, title: 'Smart Scheduling', desc: 'Post at the perfect time. Our AI analyzes when your specific audience is most active and engaged.' },
    { icon: <Target size={24} />, title: 'Persona Builder', desc: 'Define your unique voice, values, and positioning. Every piece of content stays authentic to who you are.' },
    { icon: <Users size={24} />, title: 'Network Intelligence', desc: 'Identify and engage with the right people. Build meaningful connections that drive real opportunities.' },
    { icon: <BarChart3 size={24} />, title: 'Growth Score', desc: 'One number that tells you exactly where you stand. Track your personal brand trajectory over time.' },
  ];

  const comparisonRows = [
    { label: 'Learns your voice', eclatale: true, taplio: false, supergrow: false, generic: false },
    { label: 'Authenticity score before posting', eclatale: true, taplio: false, supergrow: false, generic: false },
    { label: 'LinkedIn account safe (official API)', eclatale: true, taplio: false, supergrow: true, generic: true },
    { label: 'Unlimited posts (paid plan)', eclatale: true, taplio: true, supergrow: false, generic: false },
    { label: 'Starting price', eclatale: '$19/mo', taplio: '$52/mo', supergrow: '$29/mo', generic: 'Varies' },
  ];

  const testimonials = [
    { quote: 'My LinkedIn profile views went from 200 to 1,400 in 6 weeks.', name: 'Sarah K.', role: 'VP of Product' },
    { quote: 'I landed 3 consulting clients directly from LinkedIn posts Eclatale helped me write.', name: 'Marcus J.', role: 'Startup Founder' },
    { quote: 'Finally sounds like ME, not a robot.', name: 'Priya R.', role: 'Marketing Director' },
    { quote: 'Switched from Taplio — no more fear of getting banned.', name: 'David L.', role: 'Agency Owner' },
    { quote: 'My CEO uses this and swears by it.', name: 'Amara T.', role: 'Chief of Staff' },
    { quote: 'Best $19 I spend every month.', name: 'James O.', role: 'Solo Consultant' },
  ];

  const faqs = [
    { q: 'How is this different from other LinkedIn tools?', a: 'Eclatale isn\'t a LinkedIn optimizer. It\'s a growth engine. We learn your authentic voice, track real career outcomes (not vanity metrics), and build a personalized strategy based on your goals.' },
    { q: 'Will the content sound like me?', a: 'Yes. Our AI analyzes your writing style, industry expertise, and personality to generate content that sounds authentically you. Every post is unique to your voice.' },
    { q: 'Is Eclatale safe for my LinkedIn account?', a: 'Yes. Eclatale publishes exclusively through LinkedIn\'s official API, so there is zero risk of automation-related account bans, unlike browser-extension tools.' },
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
            <a href="#pricing" onClick={handleViewPricing} className="text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors">Pricing</a>
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
            <a href="#pricing" onClick={() => { setMobileMenuOpen(false); handleViewPricing(); }} className="block py-3 text-sm font-medium text-brand-muted">Pricing</a>
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
            The AI That Writes LinkedIn Posts<br className="hidden sm:block" />
            in Your <span className="gradient-text">Authentic Voice</span>
          </h1>

          <p className="body-text max-w-xl mx-auto mb-8 md:mb-10 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            Stop sounding like every other generic LinkedIn post. Eclatale learns exactly how you
            write and think — then generates content your audience will know is really you.
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
      </section>

      {/* Wave divider */}
      <div className="relative -mt-1">
        <svg viewBox="0 0 1440 80" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0 40C360 80 720 0 1080 40C1260 60 1360 50 1440 40V80H0V40Z" fill="#FDF4FF" />
        </svg>
      </div>

      {/* Demo section */}
      <section id="demo" className="bg-brand-bg py-16 md:py-20 px-5 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="h2 text-brand-dark mb-4">See it <span className="gradient-text">in action</span></h2>
          <p className="body-text max-w-md mx-auto mb-10">
            Watch how Eclatale turns a rough idea into a polished, on-voice LinkedIn post in seconds.
          </p>
          <div className="card p-3 md:p-4 max-w-2xl mx-auto">
            <div className="aspect-video rounded-2xl gradient-primary flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 dot-grid opacity-15" />
              <button
                type="button"
                aria-label="Play product demo"
                className="relative z-10 w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <Play size={26} className="text-brand-purple ml-1" fill="currentColor" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="py-16 md:py-20 px-5 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
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

      {/* Comparison */}
      <section className="py-16 md:py-24 px-5 md:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="h2 text-brand-dark mb-4">
              Why founders <span className="gradient-text">switch to Eclatale</span>
            </h2>
            <p className="body-text max-w-md mx-auto">
              See how Eclatale stacks up against other LinkedIn content tools.
            </p>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-[rgba(124,92,252,0.08)]">
                  <th className="text-left font-semibold text-brand-muted p-4 md:p-5">&nbsp;</th>
                  <th className="text-center font-bold text-brand-purple p-4 md:p-5">Eclatale</th>
                  <th className="text-center font-semibold text-brand-muted p-4 md:p-5">Taplio</th>
                  <th className="text-center font-semibold text-brand-muted p-4 md:p-5">Supergrow</th>
                  <th className="text-center font-semibold text-brand-muted p-4 md:p-5">Generic AI</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-b border-[rgba(124,92,252,0.06)] last:border-0">
                    <td className="p-4 md:p-5 font-medium text-brand-dark">{row.label}</td>
                    {([row.eclatale, row.taplio, row.supergrow, row.generic] as (boolean | string)[]).map((val, j) => (
                      <td key={j} className="p-4 md:p-5 text-center">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check size={18} className="inline text-brand-teal" />
                          ) : (
                            <X size={18} className="inline text-brand-muted opacity-40" />
                          )
                        ) : (
                          <span className={j === 0 ? 'font-bold text-brand-purple' : 'text-brand-muted'}>{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <a href="/signup" onClick={handleStartFree} className="inline-flex items-center gap-2 bg-white text-brand-purple font-semibold px-8 py-4 rounded-full hover:bg-brand-bg transition-all shadow-lg text-base">
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
          <div className="flex items-center gap-6">
            <a href="/blog" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Blog</a>
            <a href="#pricing" className="text-sm text-brand-muted hover:text-brand-purple transition-colors">Pricing</a>
          </div>
          <p className="text-sm text-brand-muted">&copy; {new Date().getFullYear()} Eclatale. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
