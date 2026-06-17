import React, { useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const ROLES = [
  'CEO', 'Founder', 'Co-Founder', 'Managing Director', 'Chief Operating Officer',
  'Chief Technology Officer', 'Chief Marketing Officer', 'Chief Financial Officer',
  'Chief Product Officer', 'Chief Revenue Officer', 'Chief People Officer',
  'Vice President', 'VP of Engineering', 'VP of Sales', 'VP of Marketing',
  'VP of Product', 'VP of Operations', 'Director', 'Director of Engineering',
  'Director of Marketing', 'Director of Sales', 'Director of Product',
  'Senior Manager', 'Engineering Manager', 'Product Manager', 'Senior Product Manager',
  'Project Manager', 'Program Manager', 'Marketing Manager', 'Sales Manager',
  'Account Manager', 'Customer Success Manager', 'Operations Manager',
  'HR Manager', 'People Operations Manager', 'Finance Manager',
  'Software Engineer', 'Senior Software Engineer', 'Staff Engineer',
  'Principal Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Mobile Developer', 'DevOps Engineer',
  'Data Scientist', 'Data Analyst', 'Data Engineer', 'ML Engineer',
  'AI Researcher', 'UX Designer', 'UI Designer', 'Product Designer',
  'Graphic Designer', 'Creative Director', 'Art Director',
  'Content Writer', 'Copywriter', 'Technical Writer', 'Content Strategist',
  'Social Media Manager', 'Digital Marketing Specialist', 'SEO Specialist',
  'Growth Marketer', 'Brand Strategist', 'Marketing Analyst',
  'Sales Representative', 'Business Development Representative',
  'Account Executive', 'Sales Director', 'Inside Sales Representative',
  'Consultant', 'Management Consultant', 'Strategy Consultant',
  'Business Analyst', 'Financial Analyst', 'Investment Analyst',
  'Venture Capitalist', 'Angel Investor', 'Private Equity Associate',
  'Freelancer', 'Independent Consultant', 'Solopreneur', 'Entrepreneur',
  'Startup Advisor', 'Board Member', 'Executive Coach',
  'Recruiter', 'Talent Acquisition Specialist', 'HR Business Partner',
  'Learning & Development Specialist', 'Organizational Development Specialist',
  'Attorney', 'Lawyer', 'Legal Counsel', 'Paralegal',
  'Physician', 'Nurse Practitioner', 'Healthcare Administrator',
  'Professor', 'Teacher', 'Academic Researcher', 'Dean',
  'Real Estate Agent', 'Property Manager', 'Real Estate Investor',
  'Architect', 'Civil Engineer', 'Mechanical Engineer',
  'Supply Chain Manager', 'Logistics Coordinator', 'Procurement Manager',
  'Public Relations Specialist', 'Communications Director',
  'Event Planner', 'Community Manager', 'Partnerships Manager',
  'Solutions Architect', 'Technical Program Manager', 'Scrum Master',
  'Agile Coach', 'Quality Assurance Engineer', 'Security Engineer',
  'Cloud Architect', 'Site Reliability Engineer', 'Database Administrator',
  'Blockchain Developer', 'Game Developer', 'Embedded Systems Engineer',
  'Photographer', 'Videographer', 'Film Director', 'Podcast Host',
  'Journalist', 'Editor', 'Author', 'Influencer', 'Creator',
];

const INDUSTRIES = [
  'Technology', 'Software & SaaS', 'Artificial Intelligence', 'Cybersecurity',
  'Cloud Computing', 'Blockchain & Web3', 'Internet of Things',
  'Marketing & Advertising', 'Digital Marketing', 'Content Marketing',
  'Social Media', 'Public Relations', 'Brand Strategy',
  'Finance & Banking', 'Investment Banking', 'Venture Capital',
  'Private Equity', 'Fintech', 'Cryptocurrency', 'Insurance',
  'Wealth Management', 'Accounting',
  'Healthcare & Medicine', 'Biotechnology', 'Pharmaceuticals',
  'Mental Health', 'Telemedicine', 'Medical Devices',
  'Education & EdTech', 'Higher Education', 'K-12 Education',
  'Online Learning', 'Corporate Training',
  'Real Estate', 'Property Technology', 'Construction',
  'Architecture & Design',
  'Law & Legal Services', 'Corporate Law', 'Intellectual Property',
  'Legal Tech',
  'Design & Creative', 'UX/UI Design', 'Graphic Design',
  'Industrial Design', 'Fashion Design', 'Interior Design',
  'Sales & Business Development', 'Enterprise Sales', 'Retail Sales',
  'E-Commerce', 'Direct-to-Consumer',
  'Human Resources', 'Talent Acquisition', 'People Operations',
  'HR Technology', 'Employee Experience',
  'Consulting', 'Management Consulting', 'Strategy Consulting',
  'IT Consulting', 'Business Consulting',
  'Media & Entertainment', 'Film & Television', 'Music',
  'Publishing', 'Gaming', 'Streaming',
  'Fashion & Apparel', 'Luxury Goods', 'Beauty & Cosmetics',
  'Sports & Fitness', 'Esports', 'Wellness',
  'Food & Beverage', 'Hospitality', 'Travel & Tourism',
  'Restaurant Technology',
  'Automotive', 'Electric Vehicles', 'Autonomous Driving',
  'Energy & Sustainability', 'Clean Energy', 'Renewable Energy',
  'Environmental Services',
  'Manufacturing', 'Supply Chain & Logistics', 'Aerospace & Defense',
  'Agriculture & AgTech', 'Mining',
  'Telecommunications', 'Networking', '5G Technology',
  'Government & Public Sector', 'Nonprofit', 'Social Impact',
  'International Development',
  'Data Science & Analytics', 'Machine Learning', 'Big Data',
  'Robotics', 'Space Technology',
];

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

function SearchableDropdown({ options, value, onChange, placeholder }: {
  options: string[]; value: string; onChange: (val: string) => void; placeholder: string;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 15);
    const lower = search.toLowerCase();
    return options
      .filter(opt => opt.toLowerCase().includes(lower))
      .sort((a, b) => {
        const al = a.toLowerCase();
        const bl = b.toLowerCase();
        if (al.startsWith(lower) && !bl.startsWith(lower)) return -1;
        if (!al.startsWith(lower) && bl.startsWith(lower)) return 1;
        return 0;
      })
      .slice(0, 15);
  }, [search, options]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input
          type="text"
          value={isOpen ? search : value || search}
          onChange={(e) => { setSearch(e.target.value); onChange(''); if (!isOpen) setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="input !pl-11 !pr-11 !rounded-2xl !text-base"
          role="combobox"
          aria-expanded={isOpen}
        />
        <Sparkles size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-purple/40" />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-2 card !rounded-2xl max-h-60 overflow-y-auto shadow-brand-lg" role="listbox">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-brand-muted">No matches. Try a different search.</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  role="option"
                  aria-selected={value === opt}
                  onClick={() => { onChange(opt); setSearch(opt); setIsOpen(false); }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-brand-bg transition-colors text-sm ${
                    value === opt ? 'bg-brand-bg text-brand-purple font-semibold' : 'text-brand-dark'
                  }`}
                >
                  <span className="font-medium">{opt}</span>
                  {value === opt && <Check size={16} className="text-brand-purple" />}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [goals, setGoals] = useState<string[]>([]);

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const canProceed = (step === 1 && role) || (step === 2 && industry) || (step === 3 && goals.length > 0);

  const handleFinish = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, role, industry, goals });
    }
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen gradient-bg-page flex flex-col">
      {/* Header */}
      <div className="px-5 md:px-8 h-14 md:h-16 flex items-center justify-between flex-shrink-0">
        <div className="text-lg md:text-xl font-extrabold gradient-text">Eclatale</div>
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
                <h2 className="h2 text-brand-dark mb-2">What's your <span className="gradient-text">role</span>?</h2>
                <p className="body-text text-sm">We'll personalize your content strategy.</p>
              </div>
              <div className="card p-5 md:p-6">
                <SearchableDropdown options={ROLES} value={role} onChange={setRole} placeholder="Search your role..." />
                {role && (
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-purple animate-checkmark">
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
                <p className="body-text text-sm">Pick all that apply — we'll build your roadmap.</p>
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
