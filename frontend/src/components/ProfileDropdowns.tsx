import React, { useState, useMemo } from 'react';
import { Search, Check, Sparkles } from 'lucide-react';

export const ROLES = [
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

export const INDUSTRIES = [
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

export const SENIORITY_LEVELS = [
  'Entry-level',
  'Mid-level',
  'Senior',
  'Executive / C-suite',
];

// Use the browser's native IANA timezone list where available, fall back to a curated set
const _nativeTZ: string[] | null = (() => {
  try { return (Intl as any).supportedValuesOf?.('timeZone') ?? null; } catch { return null; }
})();

export const TIMEZONES: string[] = _nativeTZ ?? [
  'Pacific/Midway','Pacific/Honolulu','America/Anchorage','America/Los_Angeles',
  'America/Denver','America/Chicago','America/New_York','America/Sao_Paulo',
  'America/Argentina/Buenos_Aires','Atlantic/Azores','Europe/London','Europe/Paris',
  'Europe/Berlin','Europe/Helsinki','Europe/Istanbul','Asia/Dubai','Asia/Karachi',
  'Asia/Kolkata','Asia/Dhaka','Asia/Bangkok','Asia/Singapore','Asia/Tokyo',
  'Asia/Seoul','Australia/Sydney','Pacific/Auckland',
];

export function SearchableDropdown({ options, value, onChange, placeholder }: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
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
                  type="button"
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
