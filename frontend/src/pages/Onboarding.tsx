import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Check, ArrowRight, ArrowLeft, Sparkles, Link2 } from 'lucide-react';
import { SearchableDropdown, ROLES, INDUSTRIES } from '../components/ProfileDropdowns';
import { hasPendingDemo } from '../lib/pendingDemo';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const GROWTH_GOALS = [
  { id: 'visible', label: 'Get Visible Online', emoji: '👁️', desc: 'Stand out in your industry' },
  { id: 'clients', label: 'Land More Clients', emoji: '🤝', desc: 'Attract high-quality leads' },
  { id: 'promoted', label: 'Get Promoted', emoji: '📈', desc: 'Accelerate career growth' },
  { id: 'thought-leader', label: 'Build Thought Leadership', emoji: '💡', desc: 'Become the go-to voice' },
  { id: 'new-job', label: 'Find a New Job', emoji: '🎯', desc: 'Make opportunities come to you' },
  { id: 'network', label: 'Grow My Network', emoji: '🌐', desc: 'Connect at scale' },
  { id: 'launch', label: 'Launch My Business', emoji: '🚀', desc: 'Build audience before launch' },
  { id: 'speaker', label: 'Become a Speaker', emoji: '🎤', desc: 'Land speaking gigs' },
];


export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [userId, setUserId] = useState('');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const canProceed =
    (step === 1 && firstName.trim() && lastName.trim() && role) ||
    (step === 2 && industry) ||
    (step === 3 && goals.length > 0) ||
    step === 4;

  const handleFinish = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, first_name: firstName.trim(), last_name: lastName.trim(), role, domain: industry, goals });
    }
    // If they came from the homepage demo, land them in the create flow —
    // CreatePost picks up the pending topic and writes the post immediately.
    window.location.href = hasPendingDemo() ? '/create' : '/dashboard';
  };

  return (
    <div className="min-h-screen gradient-bg-page flex flex-col">
      {/* Header */}
      <div className="px-5 md:px-8 h-14 md:h-16 flex items-center justify-between flex-shrink-0">
        <a href="/dashboard" className="text-lg md:text-xl font-extrabold gradient-text">Eclatale</a>
        <span className="text-xs font-semibold text-brand-muted">Step {step}/4</span>
      </div>

      {/* Progress */}
      <div className="px-5 md:px-8 mb-6 md:mb-8">
        <div className="max-w-2xl mx-auto flex gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex-1 h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] overflow-hidden">
              <div
                className="h-full rounded-full gradient-primary transition-all duration-500"
                style={{ width: s <= step ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start md:items-center justify-center px-5 py-4 md:py-8">
        <div className="w-full max-w-xl">
          {step === 1 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6 md:mb-8">
                <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple mb-4">
                  <Sparkles size={13} /> AI-Powered
                </div>
                <h2 className="h2 text-brand-dark mb-2">Tell us about <span className="gradient-text">yourself</span></h2>
                <p className="body-text text-sm">We'll personalize your content strategy.</p>
              </div>
              <div className="card p-6 md:p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1.5 block">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="input"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1.5 block">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-1.5 block">Your Role</label>
                  <SearchableDropdown options={ROLES} value={role} onChange={setRole} placeholder="Search your role..." />
                </div>
                {role && (
                  <div className="flex items-center gap-2 text-sm font-medium text-brand-purple animate-checkmark">
                    <Check size={16} className="text-brand-teal" /> {role}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6 md:mb-8">
                <div className="badge bg-[rgba(247,37,133,0.08)] text-brand-pink mb-4">
                  <Sparkles size={13} /> AI-Powered
                </div>
                <h2 className="h2 text-brand-dark mb-2">What's your <span className="gradient-text">industry</span>?</h2>
                <p className="body-text text-sm">We'll tailor content for your audience.</p>
              </div>
              <div className="card p-6 md:p-6">
                <SearchableDropdown options={INDUSTRIES} value={industry} onChange={setIndustry} placeholder="Search your industry..." />
                {industry && (
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-pink animate-checkmark">
                    <Check size={16} className="text-brand-teal" /> {industry}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6 md:mb-8">
                <div className="badge bg-[rgba(255,107,53,0.08)] text-brand-orange mb-4">
                  <Sparkles size={13} /> Select Multiple
                </div>
                <h2 className="h2 text-brand-dark mb-2">Your <span className="gradient-text">growth goals</span></h2>
                <p className="body-text text-sm">Pick all that apply. We'll build your roadmap.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GROWTH_GOALS.map(goal => {
                  const selected = goals.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`card card-hover p-6 text-left !transition-all ${
                        selected ? '!border-brand-purple !shadow-brand-md' : ''
                      }`}
                      aria-pressed={selected}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{goal.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-brand-dark">{goal.label}</h3>
                          <p className="text-xs text-brand-muted mt-0.5">{goal.desc}</p>
                        </div>
                        {selected && (
                          <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center animate-checkmark flex-shrink-0">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6 md:mb-8">
                <div className="badge bg-[rgba(10,102,194,0.08)] text-[#0A66C2] mb-4">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z"/></svg>
                  Connect LinkedIn
                </div>
                <h2 className="h2 text-brand-dark mb-2">Connect your <span className="gradient-text">LinkedIn</span></h2>
                <p className="body-text text-sm">Unlock your growth score, track followers, and publish posts directly.</p>
              </div>
              <div className="card p-6 md:p-7 flex flex-col items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-[rgba(10,102,194,0.08)] flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z"/></svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-brand-dark mb-1">What you unlock:</p>
                  <ul className="text-xs text-brand-muted space-y-1 mt-2">
                    <li className="flex items-center gap-2"><Check size={12} className="text-brand-teal flex-shrink-0" /> Real follower count as your Growth Score</li>
                    <li className="flex items-center gap-2"><Check size={12} className="text-brand-teal flex-shrink-0" /> One-click post publishing to LinkedIn</li>
                    <li className="flex items-center gap-2"><Check size={12} className="text-brand-teal flex-shrink-0" /> AI trained on your voice & style</li>
                  </ul>
                </div>
                <a
                  href={`${process.env.REACT_APP_API_URL || 'https://api.eclatale.com'}/api/auth/linkedin/callback?userId=${encodeURIComponent(userId)}`}
                  className="btn-primary w-full justify-center gap-2.5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z"/></svg>
                  Connect LinkedIn
                </a>
                <button onClick={handleFinish} className="text-xs text-brand-muted hover:text-brand-purple transition-colors underline underline-offset-2">
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between mt-6 md:mt-8">
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} className="btn-ghost text-sm !py-3">
                <ArrowLeft size={16} /> Back
              </button>
            ) : <div />}
            {step < 4 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
                className="btn-primary text-sm"
              >
                {step === 3 ? 'Continue' : 'Continue'} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
