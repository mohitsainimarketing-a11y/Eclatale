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
  { id: 'visible', label: 'Get Visible Online', icon: '👁', desc: 'Stand out in your industry and become known' },
  { id: 'clients', label: 'Land More Clients', icon: '🤝', desc: 'Attract high-quality leads through your brand' },
  { id: 'promoted', label: 'Get Promoted', icon: '📈', desc: 'Accelerate your career growth trajectory' },
  { id: 'thought-leader', label: 'Build Thought Leadership', icon: '💡', desc: 'Become the go-to voice in your domain' },
  { id: 'new-job', label: 'Find a New Job', icon: '🎯', desc: 'Make opportunities come to you' },
  { id: 'network', label: 'Grow My Network', icon: '🌐', desc: 'Connect with the right people at scale' },
  { id: 'launch', label: 'Launch My Business', icon: '🚀', desc: 'Build an audience before you launch' },
  { id: 'speaker', label: 'Become a Speaker', icon: '🎤', desc: 'Land speaking gigs and conference spots' },
];

function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 20);
    const lower = search.toLowerCase();
    const exact: string[] = [];
    const startsWith: string[] = [];
    const contains: string[] = [];
    for (const opt of options) {
      const l = opt.toLowerCase();
      if (l === lower) exact.push(opt);
      else if (l.startsWith(lower)) startsWith.push(opt);
      else if (l.includes(lower)) contains.push(opt);
    }
    return [...exact, ...startsWith, ...contains].slice(0, 20);
  }, [search, options]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
        <Sparkles size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-400" />
        <input
          type="text"
          value={isOpen ? search : value || search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange('');
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-purple-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all text-lg"
        />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-2 bg-white rounded-2xl shadow-2xl shadow-purple-200/50 border-2 border-purple-100 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No matches found. Try a different search.
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setSearch(opt);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-5 py-3 hover:bg-purple-50 transition-colors flex items-center justify-between group ${
                    value === opt ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
                  }`}
                >
                  <span className="font-medium">{opt}</span>
                  {value === opt && <Check size={18} className="text-purple-500" />}
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
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const canProceed =
    (step === 1 && role) ||
    (step === 2 && industry) ||
    (step === 3 && goals.length > 0);

  const handleFinish = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        role,
        industry,
        goals,
      });
    }
    window.location.href = '/dashboard';
  };

  const stepLabels = ['Your Role', 'Your Domain', 'Your Goals'];

  return (
    <div className="min-h-screen gradient-bg-hero flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between">
        <div className="text-2xl font-bold gradient-text">Eclatale</div>
        <div className="text-sm text-gray-500 font-medium">Step {step} of 3</div>
      </div>

      {/* Progress Bar */}
      <div className="px-8 mb-2">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 h-2 rounded-full overflow-hidden bg-purple-100">
              <div
                className="h-full rounded-full transition-all duration-500 gradient-bg"
                style={{ width: s <= step ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {stepLabels.map((label, i) => (
            <span
              key={i}
              className={`text-xs font-medium ${
                i + 1 <= step ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">

          {/* Step 1: Role */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-purple-100 text-purple-700 font-medium mb-4">
                  <Sparkles size={16} />
                  AI-Powered Matching
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  What's your <span className="gradient-text">role</span>?
                </h2>
                <p className="text-gray-500 text-lg">
                  We'll personalize your content strategy for your position.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-xl shadow-purple-200/30 border-2 border-purple-100">
                <SearchableDropdown
                  options={ROLES}
                  value={role}
                  onChange={setRole}
                  placeholder="Search your role... (e.g., CEO, Designer)"
                />
                {role && (
                  <div className="mt-4 flex items-center gap-2 text-purple-600 font-medium">
                    <Check size={18} className="text-green-500" />
                    Selected: <span className="font-bold">{role}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Industry */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-pink-100 text-pink-700 font-medium mb-4">
                  <Sparkles size={16} />
                  AI-Powered Matching
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  What's your <span className="gradient-text">domain</span>?
                </h2>
                <p className="text-gray-500 text-lg">
                  We'll tailor content for your industry's audience.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-xl shadow-purple-200/30 border-2 border-pink-100">
                <SearchableDropdown
                  options={INDUSTRIES}
                  value={industry}
                  onChange={setIndustry}
                  placeholder="Search your industry... (e.g., Technology, Finance)"
                />
                {industry && (
                  <div className="mt-4 flex items-center gap-2 text-pink-600 font-medium">
                    <Check size={18} className="text-green-500" />
                    Selected: <span className="font-bold">{industry}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Goals */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-orange-100 text-orange-700 font-medium mb-4">
                  <Sparkles size={16} />
                  Select Multiple
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  What are your <span className="gradient-text">growth goals</span>?
                </h2>
                <p className="text-gray-500 text-lg">
                  Pick all that apply — we'll build your roadmap.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GROWTH_GOALS.map((goal) => {
                  const selected = goals.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all hover:shadow-lg ${
                        selected
                          ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md'
                          : 'border-purple-100 bg-white hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{goal.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className={`font-bold ${selected ? 'text-purple-700' : 'text-gray-900'}`}>
                              {goal.label}
                            </h3>
                            {selected && (
                              <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                                <Check size={14} className="text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{goal.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-purple-600 hover:bg-purple-50 transition-all border-2 border-purple-200"
              >
                <ArrowLeft size={18} /> Back
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={() => {
                if (step < 3) setStep(step + 1);
                else handleFinish();
              }}
              disabled={!canProceed}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-400/25 disabled:opacity-40 disabled:shadow-none"
            >
              {step === 3 ? 'Get Started' : 'Continue'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
