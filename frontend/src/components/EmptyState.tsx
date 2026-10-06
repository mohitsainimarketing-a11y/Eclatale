import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  heading: string;
  subtext?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

export default function EmptyState({ icon, heading, subtext, cta, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(124,92,252,0.08)' }}
      >
        <span style={{ color: '#7C5CFC' }}>{icon}</span>
      </div>
      <p className="text-[15px] font-bold mb-1.5" style={{ color: '#1A1A2E' }}>{heading}</p>
      {subtext && (
        <p className="text-[13px] max-w-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{subtext}</p>
      )}
      {cta && (
        cta.href ? (
          <a
            href={cta.href}
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-white px-5 py-2.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.25)' }}
          >
            {cta.label}
          </a>
        ) : (
          <button
            onClick={cta.onClick}
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-white px-5 py-2.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', boxShadow: '0 4px 16px rgba(124,92,252,0.25)' }}
          >
            {cta.label}
          </button>
        )
      )}
    </div>
  );
}
