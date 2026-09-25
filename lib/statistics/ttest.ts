/**
 * Independent two-sample t-test.
 *
 *  - "student" (default): pooled variance, df = nA + nB − 2. This is the version
 *    taught in IB / Cambridge biology and the one printed critical-value tables use.
 *    It assumes the two populations have similar variances.
 *  - "welch": does not assume equal variances; df from the Welch–Satterthwaite
 *    equation. Safer when the standard deviations differ a lot.
 *
 * Both assume independent, roughly normally distributed samples.
 */

import { mean, sampleSd } from './descriptive';
import { studentTCritical, studentTTwoTailedP, studentTUpperP } from './distributions';

export type TTestVariant = 'student' | 'welch';
/** H1: the means differ / A is greater than B / A is less than B. */
export type Alternative = 'two-sided' | 'greater' | 'less';

export interface GroupSummary {
  n: number;
  mean: number;
  sd: number;
  variance: number;
}

export interface TTestResult {
  ok: true;
  variant: TTestVariant;
  alternative: Alternative;
  alpha: number;
  a: GroupSummary;
  b: GroupSummary;
  /** mean(A) − mean(B) */
  meanDifference: number;
  standardError: number;
  t: number;
  df: number;
  p: number;
  /** Critical |t| for the chosen α and alternative. */
  criticalValue: number;
  significant: boolean;
  /** (1 − α) two-sided confidence interval for mean(A) − mean(B). */
  confidenceInterval: [number, number];
  /** Larger variance ÷ smaller variance. */
  varianceRatio: number;
  warnings: string[];
}

export interface TTestFailure {
  ok: false;
  reason: string;
}

export interface TTestOptions {
  variant?: TTestVariant;
  alternative?: Alternative;
  alpha?: number;
}

function summarise(values: number[]): GroupSummary {
  const sd = sampleSd(values);
  return { n: values.length, mean: mean(values), sd, variance: sd * sd };
}

export function independentTTest(
  groupA: readonly number[],
  groupB: readonly number[],
  { variant = 'student', alternative = 'two-sided', alpha = 0.05 }: TTestOptions = {},
): TTestResult | TTestFailure {
  const a = groupA.filter(Number.isFinite);
  const b = groupB.filter(Number.isFinite);
  if (a.length < 2 || b.length < 2) {
    return {
      ok: false,
      reason: 'Each dataset needs at least two values to estimate its spread. Add more samples and try again.',
    };
  }
  if (!(alpha > 0 && alpha < 1)) {
    return { ok: false, reason: 'The significance level must be between 0 and 1 (for example 0.05).' };
  }
  const A = summarise(a);
  const B = summarise(b);
  const diff = A.mean - B.mean;

  let se: number;
  let df: number;
  if (variant === 'student') {
    df = A.n + B.n - 2;
    const pooled = ((A.n - 1) * A.variance + (B.n - 1) * B.variance) / df;
    se = Math.sqrt(pooled * (1 / A.n + 1 / B.n));
  } else {
    const va = A.variance / A.n;
    const vb = B.variance / B.n;
    se = Math.sqrt(va + vb);
    const denom = (va * va) / (A.n - 1) + (vb * vb) / (B.n - 1);
    df = denom > 0 ? ((va + vb) * (va + vb)) / denom : A.n + B.n - 2;
  }

  if (se === 0) {
    return {
      ok: false,
      reason:
        diff === 0
          ? 'Every value in both datasets is identical, so there is no variation to test.'
          : 'Neither dataset varies at all, so a t-test cannot estimate the uncertainty. Real samples almost always vary — check the data.',
    };
  }

  const t = diff / se;
  const p =
    alternative === 'two-sided'
      ? studentTTwoTailedP(t, df)
      : alternative === 'greater'
        ? studentTUpperP(t, df)
        : studentTUpperP(-t, df);
  const criticalValue = studentTCritical(alternative === 'two-sided' ? alpha / 2 : alpha, df);
  const ciHalf = studentTCritical(alpha / 2, df) * se;
  const hiVar = Math.max(A.variance, B.variance);
  const loVar = Math.min(A.variance, B.variance);
  const varianceRatio = loVar > 0 ? hiVar / loVar : Infinity;

  const warnings: string[] = [];
  if (A.n < 5 || B.n < 5) {
    warnings.push('At least one dataset has fewer than 5 values. This analysis may be unreliable with the current sample size.');
  }
  if (variant === 'student' && varianceRatio > 4) {
    warnings.push(
      `One dataset's variance is ${varianceRatio.toFixed(1)}× the other's. The standard t-test assumes similar spreads — consider Welch's t-test.`,
    );
  }

  return {
    ok: true,
    variant,
    alternative,
    alpha,
    a: A,
    b: B,
    meanDifference: diff,
    standardError: se,
    t,
    df,
    p,
    criticalValue,
    significant: p <= alpha,
    confidenceInterval: [diff - ciHalf, diff + ciHalf],
    varianceRatio,
    warnings,
  };
}
