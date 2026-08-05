import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction { label: string; onClick: () => void; }
interface ToastItem { id: number; type: ToastType; title?: string; message: string; action?: ToastAction; }

interface ToastOptions { title?: string; action?: ToastAction; }

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, { icon: React.ElementType; color: string; border: string }> = {
  success: { icon: CheckCircle, color: '#10B981', border: '#10B981' },
  error: { icon: AlertCircle, color: '#EF4444', border: '#EF4444' },
  warning: { icon: AlertTriangle, color: '#F59E0B', border: '#F59E0B' },
  info: { icon: Info, color: '#3B82F6', border: '#3B82F6' },
};

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, type, message, title: options?.title, action: options?.action }]);
    // Errors and toasts with an action stay until the user dismisses them.
    if (type !== 'error' && !options?.action) {
      const duration = type === 'warning' ? 6000 : 4000;
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[200] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => {
          const { icon: Icon, color, border } = ICONS[t.type];
          return (
            <div
              key={t.id}
              className="w-full sm:w-[360px] bg-white rounded-2xl overflow-hidden pointer-events-auto animate-slideUp"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)', borderLeft: `4px solid ${border}` }}
            >
              <div className="flex items-start gap-3 p-4">
                <Icon size={18} style={{ color }} className="flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  {t.title && <p className="text-sm font-bold text-brand-dark leading-snug">{t.title}</p>}
                  <p className="text-[13px] text-brand-muted leading-snug">{t.message}</p>
                  {t.action && (
                    <button
                      onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                      className="mt-2 text-xs font-semibold text-brand-purple hover:underline"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex-shrink-0 text-brand-muted hover:text-brand-dark p-0.5">
                  <X size={14} />
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
