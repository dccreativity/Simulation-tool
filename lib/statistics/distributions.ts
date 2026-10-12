/**
 * Probability distributions used by the hypothesis tests.
 *
 * Implemented from the standard continued-fraction / series expansions
 * (Numerical Recipes, 3rd ed., §6.1–6.4) so the app has no statistics
 * dependency. Accuracy is checked against SciPy in tests/unit/distributions.test.ts.
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** Natural log of the gamma function (Lanczos approximation, g = 7). */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula keeps the approximation accurate for small x.
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

const EPS = 1e-15;
const FPMIN = 1e-300;
const MAX_ITER = 500;

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a;
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Lower regularised incomplete gamma P(a, x) by its series (x < a + 1). */
function gammaSeries(a: number, x: number): number {
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 1; n <= MAX_ITER; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Upper regularised incomplete gamma Q(a, x) by continued fraction (x ≥ a + 1). */
function gammaContinuedFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITER; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Lower regularised incomplete gamma function P(a, x). */
export function regularizedGammaP(a: number, x: number): number {
  if (!(a > 0) || x < 0) return NaN;
  if (x === 0) return 0;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

/** Upper regularised incomplete gamma function Q(a, x) = 1 − P(a, x). */
export function regularizedGammaQ(a: number, x: number): number {
  if (!(a > 0) || x < 0) return NaN;
  if (x === 0) return 1;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

/* ── Student's t ─────────────────────────────────────────────────────────── */

/** P(T ≤ t) for Student's t with `df` degrees of freedom (df may be fractional). */
export function studentTCdf(t: number, df: number): number {
  if (!(df > 0) || Number.isNaN(t)) return NaN;
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  const x = df / (df + t * t);
  const tail = 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Two-tailed p-value P(|T| ≥ |t|). Computed directly so tiny p-values stay accurate. */
export function studentTTwoTailedP(t: number, df: number): number {
  if (!(df > 0) || Number.isNaN(t)) return NaN;
  if (!Number.isFinite(t)) return 0;
  return regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Upper-tail probability P(T ≥ t). */
export function studentTUpperP(t: number, df: number): number {
  if (!(df > 0) || Number.isNaN(t)) return NaN;
  if (t === Infinity) return 0;
  if (t === -Infinity) return 1;
  const half = 0.5 * regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? half : 1 - half;
}

/**
 * Critical value t* with P(T ≥ t*) = upperTailArea.
 * For a two-tailed test at significance α use upperTailArea = α / 2.
 */
export function studentTCritical(upperTailArea: number, df: number): number {
  if (!(upperTailArea > 0 && upperTailArea < 1) || !(df > 0)) return NaN;
  if (upperTailArea > 0.5) return -studentTCritical(1 - upperTailArea, df);
  let lo = 0;
  let hi = 1;
  while (studentTUpperP(hi, df) > upperTailArea) {
    hi *= 2;
    if (hi > 1e8) return Infinity;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTUpperP(mid, df) > upperTailArea) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

/* ── chi-squared ─────────────────────────────────────────────────────────── */

/** P(X ≤ x) for the chi-squared distribution. */
export function chiSquaredCdf(x: number, df: number): number {
  if (!(df > 0) || Number.isNaN(x)) return NaN;
  if (x <= 0) return 0;
  return regularizedGammaP(df / 2, x / 2);
}

/** Upper-tail p-value P(X ≥ x) for the chi-squared distribution. */
export function chiSquaredSurvival(x: number, df: number): number {
  if (!(df > 0) || Number.isNaN(x)) return NaN;
  if (x <= 0) return 1;
  if (x === Infinity) return 0;
  return regularizedGammaQ(df / 2, x / 2);
}

/** Critical value χ²* with P(X ≥ χ²*) = alpha. */
export function chiSquaredCritical(alpha: number, df: number): number {
  if (!(alpha > 0 && alpha < 1) || !(df > 0)) return NaN;
  let lo = 0;
  let hi = Math.max(1, df);
  while (chiSquaredSurvival(hi, df) > alpha) {
    hi *= 2;
    if (hi > 1e8) return Infinity;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (chiSquaredSurvival(mid, df) > alpha) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}
