'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, CloudOff, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'info' | 'warn' | 'offline';
interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
}

const ToastContext = createContext<{ notify: (t: Omit<Toast, 'id'>) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.notify;
}

const icons = {
  success: <CircleCheck className="size-5 text-success" aria-hidden />,
  info: <Info className="size-5 text-teal" aria-hidden />,
  warn: <TriangleAlert className="size-5 text-warn" aria-hidden />,
  offline: <CloudOff className="size-5 text-ink-3" aria-hidden />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = next.current++;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.tone === 'warn' ? 6500 : 3800);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3 shadow-lift',
                // On phones and tablets only the newest message shows, so the map stays clear.
                'max-lg:[&:not(:last-child)]:hidden max-lg:py-2.5',
              )}
              role="status"
            >
              {icons[t.tone]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-ink-3">{t.body}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-mr-1 rounded-md p-1 text-ink-3 hover:bg-teal-50 hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
