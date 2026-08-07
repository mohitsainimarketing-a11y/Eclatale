import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { n: 1 as const, label: 'Find your angle' },
  { n: 2 as const, label: 'Write your post' },
  { n: 3 as const, label: 'Publish and grow' },
];

export default function PhaseNav({ currentPhase }: { currentPhase: 1 | 2 | 3 }) {
  return (
    <div className="bg-white border-b flex items-center justify-center overflow-x-auto" style={{ borderColor: '#EDE8FF' }}>
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const state = step.n < currentPhase ? 'done' : step.n === currentPhase ? 'active' : 'upcoming';
          return (
            <React.Fragment key={step.n}>
              {i > 0 && (
                <div
                  className="w-6 sm:w-14 h-[1.5px] flex-shrink-0"
                  style={{ background: step.n <= currentPhase ? '#D4CEFF' : '#EDE8FF' }}
                />
              )}
              <div
                className="flex items-center gap-2 px-2.5 sm:px-5 py-3.5 flex-shrink-0 transition-all"
                style={{ borderBottom: state === 'active' ? '2.5px solid #7C5CFC' : '2.5px solid transparent' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all"
                  style={
                    state === 'active'
                      ? { background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)', color: '#fff' }
                      : state === 'done'
                      ? { background: '#10B981', color: '#fff' }
                      : { background: '#EDE8FF', color: '#9CA3AF' }
                  }
                >
                  {state === 'done' ? <Check size={13} strokeWidth={3} /> : step.n}
                </div>
                <span
                  className="text-[13px] font-semibold whitespace-nowrap hidden sm:inline transition-colors"
                  style={{ color: state === 'active' ? '#7C5CFC' : state === 'done' ? '#10B981' : '#9CA3AF' }}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
