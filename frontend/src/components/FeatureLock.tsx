import React from 'react';
import { Lock } from 'lucide-react';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { FEATURE_LABELS } from '../lib/featureGates';

interface FeatureLockProps {
  feature: string;
  children: React.ReactNode;
  description?: string;
}

export default function FeatureLock({ feature, children, description }: FeatureLockProps) {
  const { hasAccess, loading, showUpgrade } = useFeatureGate(feature);

  if (loading || hasAccess) return <>{children}</>;

  if (!showUpgrade) return <>{children}</>;

  const label = (FEATURE_LABELS as any)[feature] || 'This feature';

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-sm opacity-50" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
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
