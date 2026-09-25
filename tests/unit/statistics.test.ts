import { describe as suite, expect, it } from 'vitest';
import ref from './fixtures/scipy-reference.json';
import {
  chiSquaredCdf,
  chiSquaredCritical,
  chiSquaredGoodnessOfFit,
  chiSquaredIndependence,
  chiSquaredSurvival,
  describe,
  formatNumber,
  formatP,
  histogram,
  independentTTest,
  interpretTTest,
  logGamma,
  modes,
  regularizedGammaP,
  regularizedIncompleteBeta,
  studentTCdf,
  studentTCritical,
  studentTTwoTailedP,
  studentTUpperP,
} from '@/lib/statistics';

const close = (actual: number, expected: number, rel = 1e-9, abs = 1e-12) => {
  const tol = Math.max(abs, Math.abs(expected) * rel);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
};

suite('special functions (vs SciPy)', () => {
  it('logGamma', () => {
    for (const c of ref.lgamma) close(logGamma(c.x), c.v, 1e-10, 1e-10);
  });
  it('regularised incomplete beta', () => {
    for (const c of ref.ibeta) close(regularizedIncompleteBeta(c.x, c.a, c.b), c.v, 1e-9, 1e-12);
  });
  it('regularised lower incomplete gamma', () => {
    for (const c of ref.gammap) close(regularizedGammaP(c.a, c.x), c.v, 1e-9, 1e-12);
  });
});

suite("Student's t distribution (vs SciPy)", () => {
  it('cdf, two-tailed and upper-tail p', () => {
    for (const c of ref.t) {
      close(studentTCdf(c.t, c.df), c.cdf, 1e-9, 1e-13);
      close(studentTTwoTailedP(c.t, c.df), c.two, 1e-8, 1e-15);
      close(studentTUpperP(c.t, c.df), c.upper, 1e-8, 1e-15);
    }
  });
  it('critical values match printed tables', () => {
    for (const c of ref.tcrit) close(studentTCritical(c.area, c.df), c.value, 1e-8);
    // Classic table values, two-tailed α = 0.05
    expect(studentTCritical(0.025, 10).toFixed(3)).toBe('2.228');
    expect(studentTCritical(0.025, 18).toFixed(3)).toBe('2.101');
  });
});

suite('chi-squared distribution (vs SciPy)', () => {
  it('cdf and survival', () => {
    for (const c of ref.chi) {
      close(chiSquaredCdf(c.x, c.df), c.cdf, 1e-9, 1e-14);
      close(chiSquaredSurvival(c.x, c.df), c.sf, 1e-8, 1e-15);
    }
  });
  it('critical values', () => {
    for (const c of ref.chicrit) close(chiSquaredCritical(c.alpha, c.df), c.value, 1e-8);
    expect(chiSquaredCritical(0.05, 1).toFixed(2)).toBe('3.84');
    expect(chiSquaredCritical(0.05, 3).toFixed(2)).toBe('7.81');
  });
});

suite('descriptive statistics', () => {
  it('matches NumPy for mean, median, SD (sample and population) and quartiles', () => {
    for (const fixture of [ref.desc, ref.desc2]) {
      const d = describe(fixture.data)!;
      close(d.mean, fixture.mean);
      close(d.median, fixture.median);
      close(d.sd, fixture.sd);
      close(d.populationSd, fixture.psd);
      close(d.q1, fixture.q1);
      close(d.q3, fixture.q3);
    }
    close(describe(ref.desc.data)!.standardError, ref.desc.se);
  });

  it('computes range, min, max and n', () => {
    const d = describe([12, 8, 15, 7, 11, 10, 9, 14, 6, 13])!;
    expect(d.n).toBe(10);
    expect(d.min).toBe(6);
    expect(d.max).toBe(15);
    expect(d.range).toBe(9);
    expect(d.mean).toBe(10.5);
    expect(d.median).toBe(10.5);
  });

  it('returns null for an empty dataset and ignores non-finite values', () => {
    expect(describe([])).toBeNull();
    const d = describe([1, NaN, 3, Infinity])!;
    expect(d.n).toBe(2);
    expect(d.mean).toBe(2);
  });

  it('reports sample SD as undefined (NaN) for n = 1', () => {
    const d = describe([5])!;
    expect(d.sd).toBeNaN();
    expect(d.populationSd).toBe(0);
    expect(d.range).toBe(0);
  });

  it('handles modes: none, single, several, and floating-point equality', () => {
    expect(modes([1, 2, 3]).modes).toEqual([]);
    expect(modes([4, 2, 4, 3]).modes).toEqual([4]);
    expect(modes([1, 1, 2, 2, 3]).modes).toEqual([1, 2]);
    expect(modes([0.1 + 0.2, 0.3, 1]).modes).toEqual([0.3]);
    expect(describe([2.5, 3.1, 2.5, 4.8, 3.1, 2.5])!.modes).toEqual([2.5]);
  });

  it('flags outliers with Tukey fences', () => {
    const d = describe(ref.desc2.data)!;
    // Q1 = 2.6, Q3 = 3.25, IQR = 0.65 → upper fence 4.225, so 4.8 is an outlier too.
    expect(d.outliers).toEqual([4.8, 10.2]);
  });

  it('is numerically stable for large offsets', () => {
    const base = 1e9;
    const d = describe([base + 4, base + 7, base + 13, base + 16])!;
    close(d.sd, describe([4, 7, 13, 16])!.sd, 1e-6);
  });

  it('builds histograms whose counts add up', () => {
    const values = [1, 2, 2, 3, 3, 3, 4, 4, 5, 9, 12];
    const bins = histogram(values);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(values.length);
    expect(bins[0].x0).toBeLessThanOrEqual(1);
    expect(bins[bins.length - 1].x1).toBeGreaterThan(12 - 1e-9);
    expect(histogram([5, 5, 5])).toHaveLength(1);
  });
});

suite('independent t-test (vs scipy.stats.ttest_ind)', () => {
  it("matches Student's and Welch's versions, one- and two-tailed, with CI", () => {
    for (const c of ref.ttest) {
      const variant = c.equal_var ? 'student' : 'welch';
      const r = independentTTest(c.a, c.b, { variant });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      close(r.t, c.t, 1e-10);
      close(r.df, c.df, 1e-10);
      close(r.p, c.p, 1e-8);
      close(r.confidenceInterval[0], c.ci[0], 1e-8);
      close(r.confidenceInterval[1], c.ci[1], 1e-8);
      const g = independentTTest(c.a, c.b, { variant, alternative: 'greater' });
      const l = independentTTest(c.a, c.b, { variant, alternative: 'less' });
      if (g.ok) close(g.p, c.p_greater, 1e-8);
      if (l.ok) close(l.p, c.p_less, 1e-8);
    }
  });

  it('uses the critical value to decide significance consistently with p', () => {
    const r = independentTTest([12, 8, 15, 7, 11, 10, 9, 14, 6, 13], [9, 14, 13, 6, 10, 5, 7, 4, 8, 6]);
    if (!r.ok) throw new Error('expected ok');
    expect(r.df).toBe(18);
    expect(Math.abs(r.t) >= r.criticalValue).toBe(r.significant);
  });

  it('refuses datasets that are too small or have no variation', () => {
    expect(independentTTest([1], [2, 3]).ok).toBe(false);
    expect(independentTTest([2, 2, 2], [2, 2, 2]).ok).toBe(false);
    expect(independentTTest([2, 2, 2], [3, 3, 3]).ok).toBe(false);
  });

  it('warns about small samples and unequal variances', () => {
    const r = independentTTest([1, 2, 3], [10, 30, 50, 70]);
    if (!r.ok) throw new Error('expected ok');
    expect(r.warnings.some((w) => w.includes('fewer than 5'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('Welch'))).toBe(true);
  });

  it('interprets without claiming proof or causation', () => {
    const r = independentTTest([12, 8, 15, 7, 11, 10, 9, 14, 6, 13], [9, 14, 13, 6, 10, 5, 7, 4, 8, 6]);
    if (!r.ok) throw new Error('expected ok');
    const text = interpretTTest(r);
    const all = [text.headline, text.detail, ...text.caveats].join(' ').toLowerCase();
    expect(all).not.toMatch(/\bproves?\b/);
    expect(all).toContain('not the same as biological importance');
  });
});

suite('chi-squared tests (vs SciPy)', () => {
  it('goodness of fit with expected ratios scaled to the observed total', () => {
    for (const c of ref.gof) {
      const labels = c.observed.map((_, i) => `C${i}`);
      const r = chiSquaredGoodnessOfFit(labels, c.observed, c.ratio);
      if (!r.ok) throw new Error(r.reason);
      close(r.chiSquared, c.chi2, 1e-10);
      close(r.p, c.p, 1e-8);
      expect(r.df).toBe(c.observed.length - 1);
      r.categories.forEach((cat, i) => close(cat.expected, c.expected[i], 1e-12));
    }
  });

  it("Mendel's 9:3:3:1 data is not significant; critical value 7.815", () => {
    const r = chiSquaredGoodnessOfFit(['a', 'b', 'c', 'd'], [315, 108, 101, 32], [9, 3, 3, 1]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.significant).toBe(false);
    expect(r.criticalValue.toFixed(3)).toBe('7.815');
  });

  it('warns when expected frequencies are below 5', () => {
    const r = chiSquaredGoodnessOfFit(['a', 'b'], [12, 3], [3, 1]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('rejects invalid input', () => {
    expect(chiSquaredGoodnessOfFit(['a'], [3], [1]).ok).toBe(false);
    expect(chiSquaredGoodnessOfFit(['a', 'b'], [-1, 3], [1, 1]).ok).toBe(false);
    expect(chiSquaredGoodnessOfFit(['a', 'b'], [0, 0], [1, 1]).ok).toBe(false);
    expect(chiSquaredGoodnessOfFit(['a', 'b'], [4, 3], [0, 1]).ok).toBe(false);
  });

  it('test of independence without continuity correction', () => {
    for (const c of ref.independence) {
      const r = chiSquaredIndependence(c.table);
      if (!r.ok) throw new Error(r.reason);
      close(r.chiSquared, c.chi2, 1e-10, 1e-12);
      close(r.p, c.p, 1e-8, 1e-12);
      expect(r.df).toBe(c.df);
    }
    const r = chiSquaredIndependence([
      [18, 7],
      [5, 20],
    ]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.association).toBe('positive');
  });
});

suite('formatting', () => {
  it('formats numbers and p-values for students', () => {
    expect(formatNumber(10.5)).toBe('10.5');
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(3.14159, 3)).toBe('3.142');
    expect(formatNumber(-2.5)).toBe('−2.5');
    expect(formatNumber(NaN)).toBe('—');
    expect(formatP(0.0004)).toBe('< 0.001');
    expect(formatP(0.0132)).toBe('0.013');
  });
});
