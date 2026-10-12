/**
 * Sampling-bias detection.
 *
 * The simulation knows the true population, so it can ask the question a real
 * ecologist never can: are these sample locations unusual compared with
 * locations chosen at random?
 *
 *  1. Density preference — the mean true local density at the sample
 *     locations is compared with the site mean using its standard error under
 *     random placement (a z-test). |z| > 2.33 (1% each tail) *and* a practical
 *     difference of more than 20% flags a preference for dense or sparse areas.
 *  2. Clustering — the Clark–Evans ratio of the sample positions, measured
 *     against the whole site area, falls well below 1 when samples are bunched
 *     together.
 *  3. Zone coverage (a note, not a flag) — large habitat zones with no samples.
 */

import { localDensity, type Site } from '@/lib/simulation/site';

export interface SampleLocation {
  x: number;
  y: number;
  size: number;
  /** Count of the focal species in this sample. */
  count: number;
}

export interface BiasIssue {
  kind: 'dense' | 'sparse' | 'clustered' | 'zone-missing';
  severity: 'warning' | 'note';
  message: string;
}

export interface ZoneCoverage {
  id: string;
  label: string;
  areaFraction: number;
  samples: number;
  sampleFraction: number;
}

export interface BiasAssessment {
  n: number;
  /** False until there are enough samples to judge. */
  assessed: boolean;
  biased: boolean;
  issues: BiasIssue[];
  trueDensity: number;
  estimatedDensity: number;
  /** (estimate − truth) / truth */
  relativeError: number;
  meanLocalDensity: number;
  z: number;
  clarkEvans: number | null;
  zoneCoverage: ZoneCoverage[];
  summary: string;
}

export const MIN_SAMPLES_FOR_BIAS = 4;

export function assessBias(site: Site, speciesIndex: number, samples: readonly SampleLocation[]): BiasAssessment {
  const n = samples.length;
  const species = site.eco.species[speciesIndex];
  const trueDensity = site.truth[speciesIndex]?.density ?? 0;
  const perArea = samples.map((s) => s.count / (s.size * s.size));
  const estimatedDensity = n ? perArea.reduce((a, b) => a + b, 0) / n : NaN;
  const relativeError = trueDensity > 0 ? (estimatedDensity - trueDensity) / trueDensity : NaN;

  // Local density field statistics over the whole site.
  const grid = site.densityGrids[speciesIndex];
  let gMean = 0;
  for (let i = 0; i < grid.length; i++) gMean += grid[i];
  gMean /= grid.length;
  let gVar = 0;
  for (let i = 0; i < grid.length; i++) gVar += (grid[i] - gMean) ** 2;
  const gSd = Math.sqrt(gVar / grid.length);
  const centres = samples.map((s) => ({ x: s.x + s.size / 2, y: s.y + s.size / 2 }));
  const meanLocalDensity = n ? centres.reduce((t, c) => t + localDensity(site, speciesIndex, c.x, c.y), 0) / n : NaN;
  const se = n ? gSd / Math.sqrt(n) : NaN;
  const z = se > 0 ? (meanLocalDensity - gMean) / se : 0;

  // Clark–Evans nearest-neighbour ratio against the whole site.
  let clarkEvans: number | null = null;
  if (n >= 6) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      let best = Infinity;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        best = Math.min(best, Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y));
      }
      total += best;
    }
    const expected = 0.5 * Math.sqrt((site.width * site.height) / n);
    clarkEvans = total / n / expected;
  }

  // Zone coverage.
  const siteArea = site.width * site.height;
  const zoneCounts = site.eco.zones.map(() => 0);
  const { res, cols, rows, zones } = site.zoneGrid;
  for (const c of centres) {
    const col = Math.min(cols - 1, Math.max(0, Math.floor(c.x / res)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(c.y / res)));
    zoneCounts[zones[row * cols + col]]++;
  }
  const zoneCoverage: ZoneCoverage[] = site.eco.zones.map((zone, i) => ({
    id: zone.id,
    label: zone.label,
    areaFraction: site.zoneAreas[i] / siteArea,
    samples: zoneCounts[i],
    sampleFraction: n ? zoneCounts[i] / n : 0,
  }));

  const issues: BiasIssue[] = [];
  const assessed = n >= MIN_SAMPLES_FOR_BIAS;
  if (assessed) {
    if (clarkEvans !== null && clarkEvans < 0.5) {
      issues.push({
        kind: 'clustered',
        severity: 'warning',
        message: 'Your samples are concentrated in one part of the ecosystem. Your estimate may not represent the population.',
      });
    }
    if (z > 2.33 && meanLocalDensity > gMean * 1.2) {
      issues.push({
        kind: 'dense',
        severity: 'warning',
        message: `Your samples fall mostly where ${species.name.toLowerCase()} is unusually dense, so your estimate is likely to be too high.`,
      });
    } else if (z < -2.33 && meanLocalDensity < gMean * 0.8) {
      issues.push({
        kind: 'sparse',
        severity: 'warning',
        message: `Your samples fall mostly where ${species.name.toLowerCase()} is unusually sparse, so your estimate is likely to be too low.`,
      });
    }
    if (n >= 8) {
      for (const zc of zoneCoverage) {
        if (zc.areaFraction >= 0.2 && zc.samples === 0) {
          issues.push({
            kind: 'zone-missing',
            severity: 'note',
            message: `None of your samples are in the ${zc.label.toLowerCase()} zone, which covers ${Math.round(zc.areaFraction * 100)}% of the site. Stratified sampling makes sure every zone is represented.`,
          });
        }
      }
    }
  }
  const biased = issues.some((i) => i.severity === 'warning');

  let summary: string;
  if (!assessed) {
    summary = `Collect at least ${MIN_SAMPLES_FOR_BIAS} samples to check for sampling bias.`;
  } else if (biased) {
    summary = 'This sampling strategy may introduce bias. Compare your sample with the actual population to see why.';
  } else if (Math.abs(relativeError) > 0.25) {
    summary =
      'No sign of bias in where you sampled. The gap between your estimate and the true value is sampling error, which shrinks as you take more samples.';
  } else {
    summary = 'Your samples are spread across the site and your estimate is close to the true population density.';
  }

  return {
    n,
    assessed,
    biased,
    issues,
    trueDensity,
    estimatedDensity,
    relativeError,
    meanLocalDensity,
    z,
    clarkEvans,
    zoneCoverage,
    summary,
  };
}
