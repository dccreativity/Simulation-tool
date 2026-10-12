'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@/lib/statistics/format';

/** Animates between numeric values; shows the final value immediately when motion is reduced. */
export function CountUp({ value, decimals = 1, className }: { value: number | null | undefined; decimals?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null | undefined>(value);
  const from = useRef<number | null | undefined>(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduce || value === null || value === undefined || !Number.isFinite(value) || start === null || start === undefined || !Number.isFinite(start)) {
      setShown(value);
      return;
    }
    const controls = animate(start, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span className={className} aria-label={value === null || value === undefined ? 'not available' : formatNumber(value, decimals)}>
      <span aria-hidden>{shown === null || shown === undefined ? '—' : formatNumber(shown, decimals)}</span>
    </span>
  );
}
