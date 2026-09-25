/**
 * Descriptive statistics.
 *
 * Conventions (shown to students in the Statistics Lab):
 *  - Standard deviation defaults to the SAMPLE standard deviation, dividing by
 *    n − 1 (Bessel's correction). This is the convention used in IB and
 *    Cambridge biology, in spreadsheets (STDEV.S) and on most calculators (sx).
 *    The population SD (÷ n, σx) is also returned for comparison.
 *  - Quartiles use linear interpolation between order statistics
 *    (Excel QUARTILE.INC, NumPy's default, R type 7).
 *  - Outliers are values beyond 1.5 × IQR from the quartiles (Tukey's fences).
 */

export interface Descriptive {
  n: number;
  sum: number;
  mean: number;
  median: number;
  /** Every value that occurs most often. Empty when no value repeats. */
  modes: number[];
  /** How many times each mode occurs. */
  modeFrequency: number;
  min: number;
  max: number;
  range: number;
  /** Sample variance (÷ n − 1). NaN when n < 2. */
  variance: number;
  /** Sample standard deviation (÷ n − 1). NaN when n < 2. */
  sd: number;
  /** Population variance (÷ n). */
  populationVariance: number;
  /** Population standard deviation (÷ n). */
  populationSd: number;
  /** Standard error of the mean, s / √n. NaN when n < 2. */
  standardError: number;
  /** Coefficient of variation, s / mean, as a fraction. NaN when mean is 0 or n < 2. */
  coefficientOfVariation: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  outliers: number[];
  sorted: number[];
}

export function sum(values: readonly number[]): number {
  // Kahan summation: keeps long datasets of decimals honest.
  let total = 0;
  let c = 0;
  for (const v of values) {
    const y = v - c;
    const t = total + y;
    c = t - total - y;
    total = t;
  }
  return total;
}

export function mean(values: readonly number[]): number {
  return values.length ? sum(values) / values.length : NaN;
}

/** Quantile with linear interpolation (type 7). `sorted` must be ascending. */
export function quantileSorted(sorted: readonly number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return quantileSorted(sorted, 0.5);
}

/** Round to 10 significant decimals so 0.1 + 0.2 and 0.3 count as the same value. */
const modeKey = (v: number) => Number(v.toPrecision(12));

export function modes(values: readonly number[]): { modes: number[]; frequency: number } {
  const counts = new Map<number, number>();
  for (const v of values) {
    const k = modeKey(v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let frequency = 0;
  for (const c of counts.values()) frequency = Math.max(frequency, c);
  if (frequency <= 1) return { modes: [], frequency };
  const result = [...counts.entries()]
    .filter(([, c]) => c === frequency)
    .map(([k]) => k)
    .sort((a, b) => a - b);
  return { modes: result, frequency };
}

/** Sum of squared deviations from the mean (two-pass for numerical stability). */
function sumSquares(values: readonly number[], m: number): number {
  let ss = 0;
  let comp = 0;
  for (const v of values) {
    const d = v - m;
    ss += d * d;
    comp += d;
  }
  // Correction term from the two-pass algorithm (Chan, Golub & LeVeque).
  return ss - (comp * comp) / values.length;
}

export function sampleSd(values: readonly number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(sumSquares(values, m) / (values.length - 1));
}

export function populationSd(values: readonly number[]): number {
  if (!values.length) return NaN;
  const m = mean(values);
  return Math.sqrt(sumSquares(values, m) / values.length);
}

/** Summarise a list of numbers. Returns null for an empty list. */
export function describe(input: readonly number[]): Descriptive | null {
  const values = input.filter((v) => Number.isFinite(v));
  const n = values.length;
  if (n === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const total = sum(values);
  const m = total / n;
  const ss = sumSquares(values, m);
  const variance = n > 1 ? ss / (n - 1) : NaN;
  const sd = Math.sqrt(variance);
  const populationVariance = ss / n;
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const { modes: modeList, frequency } = modes(values);
  return {
    n,
    sum: total,
    mean: m,
    median: quantileSorted(sorted, 0.5),
    modes: modeList,
    modeFrequency: frequency,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    variance,
    sd,
    populationVariance,
    populationSd: Math.sqrt(populationVariance),
    standardError: n > 1 ? sd / Math.sqrt(n) : NaN,
    coefficientOfVariation: n > 1 && m !== 0 ? sd / Math.abs(m) : NaN,
    q1,
    q3,
    iqr,
    lowerFence,
    upperFence,
    outliers: sorted.filter((v) => v < lowerFence || v > upperFence),
    sorted,
  };
}

/** Histogram bins using Sturges' rule, with "nice" bin edges. */
export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
  label: string;
}

export function histogram(values: readonly number[], binCount?: number): HistogramBin[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return [];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) {
    return [{ x0: min - 0.5, x1: max + 0.5, count: finite.length, label: formatEdge(min) }];
  }
  const k = binCount ?? Math.max(3, Math.ceil(Math.log2(finite.length) + 1));
  const rawWidth = (max - min) / k;
  const width = niceStep(rawWidth);
  const start = Math.floor(min / width) * width;
  const bins: HistogramBin[] = [];
  for (let x = start; x <= max + 1e-9; x += width) {
    bins.push({ x0: x, x1: x + width, count: 0, label: `${formatEdge(x)}–${formatEdge(x + width)}` });
  }
  for (const v of finite) {
    let i = Math.floor((v - start) / width + 1e-9);
    if (i >= bins.length) i = bins.length - 1;
    if (i < 0) i = 0;
    bins[i].count++;
  }
  return bins;
}

function formatEdge(x: number) {
  return Number(x.toPrecision(6)).toString();
}

/** Round a step up to 1, 2, 2.5 or 5 × 10^k. */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

/** Frequency of each distinct value, ascending — used for dot plots. */
export function frequencyTable(values: readonly number[]): { value: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const k = modeKey(v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value - b.value);
}
