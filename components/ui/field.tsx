'use client';

import { ChevronDown, Minus, Plus } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

const control =
  'w-full rounded-xl border border-line-strong bg-paper px-3.5 text-[0.95rem] text-ink transition-colors placeholder:text-ink-3/70 hover:border-teal/60 focus:border-teal-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-teal-600';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 py-3 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-11 appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
});

/** Number input with − / + buttons (touch friendly). */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 100,
  step = 1,
  label,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-line-strong bg-paper focus-within:border-teal-600">
      <button
        type="button"
        className="flex w-11 items-center justify-center text-ink-2 hover:bg-teal-50 disabled:opacity-40"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        className="num w-full min-w-0 border-x border-line bg-transparent text-center text-[0.95rem] focus:outline-none"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(clamp(v));
        }}
      />
      <button
        type="button"
        className="flex w-11 items-center justify-center text-ink-2 hover:bg-teal-50 disabled:opacity-40"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
