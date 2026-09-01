import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { FEATURE_LABELS } from '../lib/featureGates';

interface FeatureLockProps {
  feature: string;
  children: React.ReactNode;
  description?: string;
}

export default function FeatureLock({ feature, children, description }: FeatureLockProps) {
  const { hasAccess, loading, showUpgrade } = useFeatureGate(feature);
  const [dismissed, setDismissed] = useState(false);

  if (loading || hasAccess) return <>{children}</>;

  if (!showUpgrade) return <>{children}</>;

  const label = (FEATURE_LABELS as any)[feature] || 'This feature';

  if (dismissed) {
    return (
      <div className="relative overflow-hidden rounded-2xl">
        <div className="pointer-events-none select-none blur-sm opacity-40" aria-hidden="true">
          {children}
        </div>
        <div className="absolute top-3 right-3">
          <a href="/pricing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[rgba(124,92,252,0.2)] text-[11px] font-bold text-brand-purple shadow-sm hover:shadow-md transition-all">
            <Lock size={11} /> Unlock with Individual
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-sm opacity-50" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white border border-[rgba(0,0,0,0.08)] flex items-center justify-center text-brand-muted hover:text-brand-dark transition-colors shadow-sm"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
        <div className="card p-6 max-w-xs text-center modal-shadow">
          <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-brand-purple/10 flex items-center justify-center">
            <Lock size={20} className="text-brand-purple" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-purple mb-1">Individual Plan</p>
          <h3 className="text-base font-extrabold text-brand-dark mb-2">Unlock {label}</h3>
          <p className="text-sm text-brand-muted mb-4">
            {description || `${label} is available on the Individual plan.`}
          </p>
          <a href="/pricing" className="btn-primary w-full inline-flex items-center justify-center text-sm">
            Upgrade Now
          </a>
        </div>
      </div>
    </div>
  );
}
