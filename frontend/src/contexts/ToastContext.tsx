import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction { label: string; onClick: () => void; }
interface ToastItem {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
  action?: ToastAction;
  exiting?: boolean;
}

interface ToastOptions { title?: string; action?: ToastAction; }

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const CONFIGS: Record<ToastType, { icon: React.ElementType; iconBg: string; iconColor: string; accent: string }> = {
  success: { icon: CheckCircle,   iconBg: 'rgba(16,185,129,0.12)', iconColor: '#10B981', accent: '#10B981' },
  error:   { icon: AlertCircle,   iconBg: 'rgba(239,68,68,0.12)',  iconColor: '#EF4444', accent: '#EF4444' },
  warning: { icon: AlertTriangle, iconBg: 'rgba(245,158,11,0.12)', iconColor: '#F59E0B', accent: '#F59E0B' },
  info:    { icon: Info,          iconBg: 'rgba(124,92,252,0.12)', iconColor: '#7C5CFC', accent: '#7C5CFC' },
};

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    // mark as exiting to play the out animation, then remove
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 240);
    timers.current.set(id, removeTimer);
  }, []);

  const showToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, type, message, title: options?.title, action: options?.action }]);
    if (type !== 'error' && !options?.action) {
      const duration = type === 'warning' ? 6000 : 4000;
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2.5 items-end pointer-events-none" style={{ maxWidth: 'min(380px, calc(100vw - 24px))' }}>
        {toasts.map(t => {
          const { icon: Icon, iconBg, iconColor, accent } = CONFIGS[t.type];
          return (
            <div
              key={t.id}
              className={`w-full pointer-events-auto ${t.exiting ? 'animate-toastOut' : 'animate-toastIn'}`}
              style={{
                background: 'rgba(255,255,255,0.97)',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
                border: '1px solid rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              {/* accent bar */}
              <div style={{ height: 3, background: accent, borderRadius: '16px 16px 0 0' }} />
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ background: iconBg }}>
                  <Icon size={16} style={{ color: iconColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  {t.title && <p className="text-[13px] font-bold leading-snug mb-0.5" style={{ color: '#1A1A2E' }}>{t.title}</p>}
                  <p className="text-[12px] leading-relaxed" style={{ color: '#6B7280' }}>{t.message}</p>
                  {t.action && (
                    <button
                      onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                      className="mt-2 text-[11px] font-bold hover:underline"
                      style={{ color: accent }}
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-black/6"
                  style={{ color: '#9CA3AF' }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
