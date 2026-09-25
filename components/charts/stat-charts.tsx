'use client';

import { motion } from 'framer-motion';
import { useElementWidth } from '@/hooks/use-element-width';
import { niceStep, type Descriptive } from '@/lib/statistics/descriptive';
import { formatNumber } from '@/lib/statistics/format';

export function niceTicks(min: number, max: number, count = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const step = niceStep((max - min) / count);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toPrecision(10)));
  return ticks;
}

/** Deterministic jitter so points do not dance between renders. */
const jitter = (i: number) => (((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5;

export interface BoxGroup {
  label: string;
  stats: Descriptive;
  values: number[];
  color: string;
}

/** Horizontal box plots: median, quartiles, Tukey whiskers, outliers, and the mean (◆). */
export function BoxPlot({ groups, xLabel }: { groups: BoxGroup[]; xLabel: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const labelW = groups.length > 1 ? Math.min(140, width * 0.28) : 12;
  const rowH = 64;
  const top = 12;
  const height = top + groups.length * rowH + 40;
  const all = groups.flatMap((g) => g.values);
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const plotW = width - labelW - 16;
  const x = (v: number) => labelW + ((v - lo) / (hi - lo || 1)) * plotW;
  return (
    <div ref={ref} className="w-full">
      <svg data-chart width={width} height={height} role="img" aria-label={`Box plot of ${xLabel}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={height - 34} stroke="#e6dcc3" />
            <text x={x(t)} y={height - 20} textAnchor="middle" fontSize={11} fill="#56696f">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <text x={labelW + plotW / 2} y={height - 4} textAnchor="middle" fontSize={11} fill="#56696f">
          {xLabel}
        </text>
        {groups.map((g, gi) => {
          const cy = top + gi * rowH + rowH / 2;
          const s = g.stats;
          const inside = s.sorted.filter((v) => v >= s.lowerFence && v <= s.upperFence);
          const wLo = inside.length ? inside[0] : s.min;
          const wHi = inside.length ? inside[inside.length - 1] : s.max;
          return (
            <g key={g.label}>
              {groups.length > 1 && (
                <text x={0} y={cy} dy="0.35em" fontSize={12} fill="#2b4250">
                  {g.label.length > 20 ? `${g.label.slice(0, 19)}…` : g.label}
                </text>
              )}
              {g.values.map((v, i) => (
                <circle key={i} cx={x(v)} cy={cy + jitter(i) * 26} r={2.6} fill={g.color} fillOpacity={0.35}>
                  <title>{formatNumber(v)}</title>
                </circle>
              ))}
              <line x1={x(wLo)} x2={x(wHi)} y1={cy} y2={cy} stroke="#031926" strokeWidth={1.5} />
              <line x1={x(wLo)} x2={x(wLo)} y1={cy - 8} y2={cy + 8} stroke="#031926" strokeWidth={1.5} />
              <line x1={x(wHi)} x2={x(wHi)} y1={cy - 8} y2={cy + 8} stroke="#031926" strokeWidth={1.5} />
              <motion.rect
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                x={x(s.q1)}
                y={cy - 15}
                width={Math.max(2, x(s.q3) - x(s.q1))}
                height={30}
                rx={4}
                fill={g.color}
                fillOpacity={0.28}
                stroke={g.color}
                strokeWidth={2}
              >
                <title>{`Q1 ${formatNumber(s.q1)} · median ${formatNumber(s.median)} · Q3 ${formatNumber(s.q3)}`}</title>
              </motion.rect>
              <line x1={x(s.median)} x2={x(s.median)} y1={cy - 15} y2={cy + 15} stroke="#031926" strokeWidth={2.5} />
              <path d={`M${x(s.mean)} ${cy - 6} l6 6 l-6 6 l-6 -6Z`} fill="#fffcf4" stroke="#031926" strokeWidth={1.5}>
                <title>{`Mean ${formatNumber(s.mean)}`}</title>
              </path>
              {s.outliers.map((v, i) => (
                <circle key={`o${i}`} cx={x(v)} cy={cy} r={5} fill="#fffcf4" stroke="#bb6f58" strokeWidth={2}>
                  <title>{`Outlier: ${formatNumber(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-ink-3">
        <span>Box: middle 50% (Q1–Q3)</span>
        <span>Thick line: median</span>
        <span>◆ mean</span>
        <span>Whiskers: data within 1.5 × IQR</span>
        <span>
          <span className="inline-block size-2.5 rounded-full border-2 border-[#bb6f58] align-middle" aria-hidden /> outlier
        </span>
      </p>
    </div>
  );
}

/**
 * Dot plot that makes standard deviation visible: every value as a dot, the
 * mean as a line, and bands at ±1 SD and ±2 SD.
 */
export function SpreadDotPlot({ values, stats, xLabel, color = '#14989e' }: { values: number[]; stats: Descriptive; xLabel: string; color?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const sd = Number.isFinite(stats.sd) ? stats.sd : 0;
  const lo0 = stats.min >= 0 ? Math.max(0, Math.min(stats.min, stats.mean - 2 * sd)) : Math.min(stats.min, stats.mean - 2 * sd);
  const hi0 = Math.max(stats.max, stats.mean + 2 * sd);
  const ticks = niceTicks(lo0, hi0, 7);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const pad = 16;
  const plotW = width - pad * 2;
  const x = (v: number) => pad + ((v - lo) / (hi - lo || 1)) * plotW;
  // Stack dots that fall within one dot-width of each other.
  const dotR = Math.max(3, Math.min(7, plotW / (values.length * 1.6 + 20)));
  const bucket = ((hi - lo) / plotW) * dotR * 2.1;
  const stacks = new Map<number, number>();
  const placed = [...values]
    .sort((a, b) => a - b)
    .map((v) => {
      const key = Math.round(v / bucket);
      const level = stacks.get(key) ?? 0;
      stacks.set(key, level + 1);
      return { v, cx: x(key * bucket), level };
    });
  const maxLevel = Math.max(1, ...placed.map((p) => p.level + 1));
  const baseY = Math.max(120, maxLevel * dotR * 2.1 + 50);
  const height = baseY + 44;
  const within1 = sd > 0 ? values.filter((v) => Math.abs(v - stats.mean) <= sd).length : values.length;
  return (
    <div ref={ref} className="w-full">
      <svg data-chart width={width} height={height} role="img" aria-label={`Dot plot of ${xLabel} with mean and standard deviation bands`}>
        {sd > 0 && (
          <>
            <rect x={x(stats.mean - 2 * sd)} y={16} width={x(stats.mean + 2 * sd) - x(stats.mean - 2 * sd)} height={baseY - 16} fill="#77aca2" fillOpacity={0.1} />
            <motion.rect
              initial={false}
              animate={{ x: x(stats.mean - sd), width: x(stats.mean + sd) - x(stats.mean - sd) }}
              transition={{ duration: 0.4 }}
              y={16}
              height={baseY - 16}
              fill="#77aca2"
              fillOpacity={0.22}
            />
            {[-2, -1, 1, 2].map((k) => (
              <text key={k} x={x(stats.mean + k * sd)} y={12} textAnchor="middle" fontSize={10} fill="#56696f">
                {k > 0 ? `+${k}` : k} SD
              </text>
            ))}
          </>
        )}
        <line x1={pad} x2={width - pad} y1={baseY} y2={baseY} stroke="#56696f" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={baseY} y2={baseY + 5} stroke="#56696f" />
            <text x={x(t)} y={baseY + 18} textAnchor="middle" fontSize={11} fill="#56696f">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {placed.map((p, i) => (
          <motion.circle
            key={i}
            initial={{ opacity: 0, cx: p.cx, cy: baseY - dotR - 12 }}
            animate={{ opacity: 1, cy: baseY - dotR - 2 - p.level * dotR * 2.1, cx: p.cx }}
            transition={{ duration: 0.35, delay: Math.min(i, 30) * 0.012 }}
            r={dotR}
            fill={color}
            stroke="#fffcf4"
            strokeWidth={1.2}
          >
            <title>{formatNumber(p.v)}</title>
          </motion.circle>
        ))}
        <motion.g initial={false} animate={{ x: x(stats.mean) }} transition={{ duration: 0.4 }}>
          <line x1={0} x2={0} y1={20} y2={baseY} stroke="#031926" strokeWidth={2} strokeDasharray="5 3" />
          <rect x={-34} y={20} width={68} height={18} rx={9} fill="#031926" />
          <text y={32} textAnchor="middle" fontSize={10.5} fill="#f4e9cd" fontWeight={600}>
            mean {formatNumber(stats.mean)}
          </text>
        </motion.g>
        <text x={width / 2} y={height - 4} textAnchor="middle" fontSize={11} fill="#56696f">
          {xLabel}
        </text>
      </svg>
      {sd > 0 && (
        <p className="mt-1 text-xs text-ink-3">
          The dark band spans one standard deviation either side of the mean ({formatNumber(stats.mean - sd)} to {formatNumber(stats.mean + sd)}).{' '}
          <span className="font-medium text-ink-2">
            {within1} of {values.length} values ({Math.round((within1 / values.length) * 100)}%)
          </span>{' '}
          fall inside it — for roughly normal data, expect about 68%.
        </p>
      )}
    </div>
  );
}

export interface MeanGroup {
  label: string;
  values: number[];
  mean: number;
  sd: number;
  color: string;
}

/** Two (or more) groups side by side: every value, the mean, and ±1 SD error bars. */
export function MeanSdChart({ groups, yLabel }: { groups: MeanGroup[]; yLabel: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const height = 280;
  const left = 52;
  const bottom = 40;
  const top = 12;
  const all = groups.flatMap((g) => [...g.values, g.mean + (g.sd || 0), g.mean - (g.sd || 0)]);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all), 6);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const plotH = height - top - bottom;
  const y = (v: number) => top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const colW = (width - left - 12) / groups.length;
  return (
    <div ref={ref} className="w-full">
      <svg data-chart width={width} height={height} role="img" aria-label={`Comparison of ${yLabel} between groups`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={width - 8} y1={y(t)} y2={y(t)} stroke="#e6dcc3" />
            <text x={left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11} fill="#56696f">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <text transform={`translate(12 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#56696f">
          {yLabel}
        </text>
        {groups.map((g, gi) => {
          const cx = left + colW * gi + colW / 2;
          return (
            <g key={g.label}>
              {g.values.map((v, i) => (
                <circle key={i} cx={cx - 18 + jitter(i + gi * 97) * 22} cy={y(v)} r={3.5} fill={g.color} fillOpacity={0.55}>
                  <title>{formatNumber(v)}</title>
                </circle>
              ))}
              {Number.isFinite(g.sd) && (
                <g stroke="#031926" strokeWidth={1.8}>
                  <line x1={cx + 18} x2={cx + 18} y1={y(g.mean - g.sd)} y2={y(g.mean + g.sd)} />
                  <line x1={cx + 12} x2={cx + 24} y1={y(g.mean - g.sd)} y2={y(g.mean - g.sd)} />
                  <line x1={cx + 12} x2={cx + 24} y1={y(g.mean + g.sd)} y2={y(g.mean + g.sd)} />
                </g>
              )}
              <motion.rect initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} x={cx + 6} y={y(g.mean) - 2.5} width={24} height={5} rx={2.5} fill={g.color}>
                <title>{`Mean ${formatNumber(g.mean)} ± ${formatNumber(g.sd)} SD`}</title>
              </motion.rect>
              <text x={cx} y={height - bottom + 18} textAnchor="middle" fontSize={12} fill="#2b4250">
                {g.label.length > 26 ? `${g.label.slice(0, 25)}…` : g.label}
              </text>
              <text x={cx} y={height - bottom + 32} textAnchor="middle" fontSize={10.5} fill="#56696f">
                mean {formatNumber(g.mean)} ± {formatNumber(g.sd)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[0.7rem] text-ink-3">Dots: individual values · bar: mean · whiskers: ±1 standard deviation.</p>
    </div>
  );
}
