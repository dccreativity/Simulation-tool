/**
 * Plain-language interpretation of test results.
 *
 * Wording rules: never say a test "proves" anything, never claim causation,
 * and always separate statistical significance from biological importance.
 */

import type { GoodnessOfFitResult, IndependenceResult } from './chisquare';
import { formatDf, formatNumber, pStatement } from './format';
import type { TTestResult } from './ttest';

export interface Interpretation {
  headline: string;
  detail: string;
  caveats: string[];
}

export function interpretTTest(r: TTestResult, labelA = 'Dataset A', labelB = 'Dataset B'): Interpretation {
  const stats = `t = ${formatNumber(r.t, 3)}, df = ${formatDf(r.df)}, ${pStatement(r.p)}`;
  const means = `${labelA}: mean ${formatNumber(r.a.mean)}; ${labelB}: mean ${formatNumber(r.b.mean)}`;
  const direction =
    r.alternative === 'two-sided'
      ? 'the two sample means'
      : r.alternative === 'greater'
        ? `${labelA} being greater than ${labelB}`
        : `${labelA} being less than ${labelB}`;

  const headline = r.significant
    ? r.alternative === 'two-sided'
      ? `The difference between the two sample means is statistically significant at the ${r.alpha} level.`
      : `The evidence for ${direction} is statistically significant at the ${r.alpha} level.`
    : r.alternative === 'two-sided'
      ? `The difference between the two sample means is not statistically significant at the ${r.alpha} level.`
      : `There is not enough evidence for ${direction} at the ${r.alpha} level.`;

  const detail = r.significant
    ? `${means} (${stats}). If there were really no difference between the populations, a difference at least this large would be expected in fewer than ${formatNumber(r.alpha * 100, 1)}% of samples, so we reject the null hypothesis.`
    : `${means} (${stats}). A difference this large could easily arise by chance, so we cannot reject the null hypothesis. This does not show the populations are the same — the samples may be too small or too variable to detect a real difference.`;

  const [lo, hi] = r.confidenceInterval;
  const caveats = [
    `Statistical significance is not the same as biological importance. The estimated difference is ${formatNumber(r.meanDifference)} (${formatNumber((1 - r.alpha) * 100, 0)}% confidence interval ${formatNumber(lo)} to ${formatNumber(hi)}) — ask whether a difference of that size matters ecologically.`,
    'A significant result shows an association, not a cause. Other factors that differ between the two sites or groups could explain the pattern.',
    'The t-test assumes independent samples from roughly normal populations. Samples placed close together or chosen by eye break these assumptions.',
    ...r.warnings,
  ];
  return { headline, detail, caveats };
}

export function interpretGoodnessOfFit(r: GoodnessOfFitResult): Interpretation {
  const stats = `χ² = ${formatNumber(r.chiSquared, 3)}, df = ${r.df}, ${pStatement(r.p)}`;
  const biggest = [...r.categories].sort((a, b) => b.contribution - a.contribution)[0];
  const headline = r.significant
    ? `The observed frequencies differ significantly from the expected frequencies at the ${r.alpha} level.`
    : `The observed frequencies are not significantly different from the expected frequencies at the ${r.alpha} level.`;
  const detail = r.significant
    ? `${stats}. The critical value is ${formatNumber(r.criticalValue, 3)}, and χ² is larger, so we reject the null hypothesis that the data follow the expected distribution. "${biggest.label}" contributes most to the difference (observed ${formatNumber(biggest.observed)}, expected ${formatNumber(biggest.expected)}).`
    : `${stats}. χ² is below the critical value of ${formatNumber(r.criticalValue, 3)}, so the differences between observed and expected are small enough to be explained by chance. We cannot reject the null hypothesis.`;
  const caveats = [
    'The test tells you whether observed and expected differ, not why. A significant result needs a biological explanation.',
    'Chi-squared tests must use raw counts, and each observation must be independent.',
    ...r.warnings,
  ];
  return { headline, detail, caveats };
}

export function interpretIndependence(r: IndependenceResult, labels?: { a: string; b: string }): Interpretation {
  const stats = `χ² = ${formatNumber(r.chiSquared, 3)}, df = ${r.df}, ${pStatement(r.p)}`;
  const pair = labels ? `${labels.a} and ${labels.b}` : 'the two variables';
  let headline: string;
  if (r.significant) {
    headline =
      r.association === 'positive'
        ? `There is a significant positive association between ${pair}: they occur together more often than expected by chance.`
        : r.association === 'negative'
          ? `There is a significant negative association between ${pair}: they occur together less often than expected by chance.`
          : `There is a significant association between ${pair}.`;
  } else {
    headline = `There is no significant association between ${pair} at the ${r.alpha} level.`;
  }
  const detail = r.significant
    ? `${stats}. χ² exceeds the critical value of ${formatNumber(r.criticalValue, 3)}, so we reject the null hypothesis that ${pair} are independent.`
    : `${stats}. χ² is below the critical value of ${formatNumber(r.criticalValue, 3)}, so we cannot reject the null hypothesis that ${pair} are distributed independently.`;
  const caveats = [
    'An association does not mean one species causes the other to be present. Both may respond to the same environmental factor, such as moisture or light.',
    ...r.warnings,
  ];
  return { headline, detail, caveats };
}
