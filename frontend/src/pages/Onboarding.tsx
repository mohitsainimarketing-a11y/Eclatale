import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { SearchableDropdown, ROLES, INDUSTRIES } from '../components/ProfileDropdowns';

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

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const canProceed = (step === 1 && firstName.trim() && lastName.trim() && role) || (step === 2 && industry) || (step === 3 && goals.length > 0);

  const handleFinish = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, first_name: firstName.trim(), last_name: lastName.trim(), role, domain: industry, goals });
    }
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen gradient-bg-page flex flex-col">
      {/* Header */}
      <div className="px-5 md:px-8 h-14 md:h-16 flex items-center justify-between flex-shrink-0">
        <a href="/dashboard" className="text-lg md:text-xl font-extrabold gradient-text">Eclatale</a>
        <span className="text-xs font-semibold text-brand-muted">Step {step}/3</span>
      </div>

      {/* Progress */}
      <div className="px-5 md:px-8 mb-6 md:mb-8">
        <div className="max-w-2xl mx-auto flex gap-2">
          {[1, 2, 3].map(s => (
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
              <div className="card p-5 md:p-6 space-y-4">
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
              <div className="card p-5 md:p-6">
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
                      className={`card card-hover p-4 text-left !transition-all ${
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

          {/* Nav */}
          <div className="flex justify-between mt-6 md:mt-8">
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} className="btn-ghost text-sm !py-3">
                <ArrowLeft size={16} /> Back
              </button>
            ) : <div />}
            <button
              onClick={() => { if (step < 3) setStep(step + 1); else handleFinish(); }}
              disabled={!canProceed}
              className="btn-primary text-sm"
            >
              {step === 3 ? 'Get Started' : 'Continue'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
