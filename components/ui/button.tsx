'use client';

import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,box-shadow,color,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0 select-none whitespace-nowrap';
const variants: Record<Variant, string> = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-[0_1px_0_rgb(3_25_38/0.12)]',
  secondary: 'bg-paper text-ink border border-line-strong hover:bg-cream-100 hover:border-teal/50',
  ghost: 'text-ink-2 hover:bg-teal-50 hover:text-ink',
  subtle: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
  danger: 'bg-paper text-danger border border-danger-line hover:bg-danger-bg',
  dark: 'bg-navy text-cream hover:bg-navy-700',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[0.95rem]',
  lg: 'h-13 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
  iconRight,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  variant = 'ghost',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
