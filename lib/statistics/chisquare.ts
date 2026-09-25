/**
 * Chi-squared tests.
 *
 *  - Goodness of fit: do observed frequencies match an expected distribution?
 *    Expected values are given as a ratio (e.g. 1:1:1 or 9:3:3:1) and scaled to
 *    the observed total, so they always sum to N as the test requires.
 *  - Test of independence / association (r × c contingency table), e.g. are two
 *    species found together in quadrats more (or less) often than chance predicts?
 *
 * No continuity correction is applied (matching IB / Cambridge practice).
 */

import { chiSquaredCritical, chiSquaredSurvival } from './distributions';

export interface GoodnessOfFitCategory {
  label: string;
  observed: number;
  expected: number;
  /** (O − E)² / E */
  contribution: number;
}

export interface GoodnessOfFitResult {
  ok: true;
  categories: GoodnessOfFitCategory[];
  total: number;
  chiSquared: number;
  df: number;
  p: number;
  alpha: number;
  criticalValue: number;
  significant: boolean;
  warnings: string[];
}

export interface ChiSquaredFailure {
  ok: false;
  reason: string;
}

export function chiSquaredGoodnessOfFit(
  labels: readonly string[],
  observed: readonly number[],
  expectedRatio: readonly number[],
  alpha = 0.05,
): GoodnessOfFitResult | ChiSquaredFailure {
  if (observed.length !== expectedRatio.length || observed.length !== labels.length) {
    return { ok: false, reason: 'Each category needs an observed and an expected value.' };
  }
  if (observed.length < 2) {
    return { ok: false, reason: 'A chi-squared test needs at least two categories.' };
  }
  if (observed.some((o) => !Number.isFinite(o) || o < 0)) {
    return { ok: false, reason: 'Observed frequencies must be zero or positive counts.' };
  }
  if (expectedRatio.some((e) => !Number.isFinite(e) || e < 0)) {
    return { ok: false, reason: 'Expected values must be zero or positive.' };
  }
  const total = observed.reduce((s, v) => s + v, 0);
  const ratioTotal = expectedRatio.reduce((s, v) => s + v, 0);
  if (total <= 0) return { ok: false, reason: 'Your observed frequencies add up to zero.' };
  if (ratioTotal <= 0) return { ok: false, reason: 'Your expected values add up to zero.' };
  if (!(alpha > 0 && alpha < 1)) {
    return { ok: false, reason: 'The significance level must be between 0 and 1 (for example 0.05).' };
  }

  const categories: GoodnessOfFitCategory[] = observed.map((o, i) => {
    const expected = (expectedRatio[i] / ratioTotal) * total;
    return {
      label: labels[i],
      observed: o,
      expected,
      contribution: expected > 0 ? ((o - expected) * (o - expected)) / expected : o > 0 ? Infinity : 0,
    };
  });
  if (categories.some((c) => c.expected === 0 && c.observed > 0)) {
    return {
      ok: false,
      reason: 'A category with an expected frequency of zero was actually observed. Expected frequencies must be greater than zero.',
    };
  }
  const used = categories.filter((c) => c.expected > 0);
  const chiSquared = used.reduce((s, c) => s + c.contribution, 0);
  const df = used.length - 1;
  if (df < 1) return { ok: false, reason: 'A chi-squared test needs at least two categories with expected frequencies above zero.' };

  const warnings: string[] = [];
  if (used.some((c) => c.expected < 5)) {
    warnings.push('Some expected frequencies are below 5, so the chi-squared result may be unreliable. Consider collecting more data or combining categories.');
  }
  if (observed.some((o) => !Number.isInteger(o))) {
    warnings.push('Chi-squared tests need counts (frequencies). Percentages, means or measurements will give a misleading result.');
  }

  const p = chiSquaredSurvival(chiSquared, df);
  return {
    ok: true,
    categories,
    total,
    chiSquared,
    df,
    p,
    alpha,
    criticalValue: chiSquaredCritical(alpha, df),
    significant: p <= alpha,
    warnings,
  };
}

export interface IndependenceResult {
  ok: true;
  observed: number[][];
  expected: number[][];
  rowTotals: number[];
  columnTotals: number[];
  total: number;
  chiSquared: number;
  df: number;
  p: number;
  alpha: number;
  criticalValue: number;
  significant: boolean;
  /** For 2 × 2 tables: are the two "present" categories found together more or less than expected? */
  association: 'positive' | 'negative' | 'none' | null;
  warnings: string[];
}

export function chiSquaredIndependence(
  table: readonly (readonly number[])[],
  alpha = 0.05,
): IndependenceResult | ChiSquaredFailure {
  const rows = table.length;
  const cols = rows ? table[0].length : 0;
  if (rows < 2 || cols < 2 || table.some((r) => r.length !== cols)) {
    return { ok: false, reason: 'A test of association needs a table with at least two rows and two columns.' };
  }
  if (table.some((r) => r.some((v) => !Number.isFinite(v) || v < 0))) {
    return { ok: false, reason: 'Every cell must be a count of zero or more.' };
  }
  const rowTotals = table.map((r) => r.reduce((s, v) => s + v, 0));
  const columnTotals = Array.from({ length: cols }, (_, j) => table.reduce((s, r) => s + r[j], 0));
  const total = rowTotals.reduce((s, v) => s + v, 0);
  if (total === 0) return { ok: false, reason: 'The table is empty.' };
  if (rowTotals.some((t) => t === 0) || columnTotals.some((t) => t === 0)) {
    return {
      ok: false,
      reason: 'A whole row or column is zero, so expected frequencies cannot be calculated. Collect more samples first.',
    };
  }
  const expected = table.map((_, i) => columnTotals.map((ct) => (rowTotals[i] * ct) / total));
  let chiSquared = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const e = expected[i][j];
      chiSquared += ((table[i][j] - e) * (table[i][j] - e)) / e;
    }
  }
  const df = (rows - 1) * (cols - 1);
  const p = chiSquaredSurvival(chiSquared, df);
  const warnings: string[] = [];
  if (expected.some((r) => r.some((e) => e < 5))) {
    warnings.push('Some expected frequencies are below 5, so the result may be unreliable. Collect more samples if you can.');
  }
  let association: IndependenceResult['association'] = null;
  if (rows === 2 && cols === 2) {
    const d = table[0][0] - expected[0][0];
    association = Math.abs(d) < 1e-12 ? 'none' : d > 0 ? 'positive' : 'negative';
  }
  return {
    ok: true,
    observed: table.map((r) => [...r]),
    expected,
    rowTotals,
    columnTotals,
    total,
    chiSquared,
    df,
    p,
    alpha,
    criticalValue: chiSquaredCritical(alpha, df),
    significant: p <= alpha,
    association,
    warnings,
  };
}
