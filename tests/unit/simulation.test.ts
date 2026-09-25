import { describe, expect, it } from 'vitest';
import { ECOSYSTEMS, getEcosystem } from '@/data/ecosystems';
import { generateSite, type Site } from '@/lib/simulation/site';
import { rngFrom } from '@/lib/simulation/rng';
import { countQuadrat, planLocations, runBeltTransect, runLineTransect } from '@/lib/sampling/sampling';
import { assessBias } from '@/lib/sampling/bias';

const sites = new Map<string, Site>();
function site(id: string): Site {
  if (!sites.has(id)) sites.set(id, generateSite(getEcosystem(id)!, getEcosystem(id)!.defaultSiteCode));
  return sites.get(id)!;
}

describe('site generation', () => {
  it('generates every ecosystem quickly with a realistic population', () => {
    const rows: string[] = [];
    for (const eco of ECOSYSTEMS) {
      const t0 = performance.now();
      const s = generateSite(eco, eco.defaultSiteCode);
      const ms = performance.now() - t0;
      sites.set(eco.id, s);
      expect(s.count).toBeGreaterThan(500);
      expect(s.count).toBeLessThan(40000);
      expect(ms).toBeLessThan(3000);
      const focal = eco.species.findIndex((sp) => sp.id === eco.mission.focalSpeciesId);
      expect(focal).toBeGreaterThanOrEqual(0);
      const zones = eco.zones.map((z, i) => `${z.id}:${Math.round((s.zoneAreas[i] / 1000) * 100)}%`).join(' ');
      rows.push(
        `${eco.id.padEnd(16)} n=${String(s.count).padStart(6)} ${ms.toFixed(0).padStart(4)}ms focal=${eco.mission.focalSpeciesId} ${s.truth[focal].density.toFixed(2)}/m² | ${zones}`,
      );
      // Every species actually occurs somewhere.
      for (const t of s.truth) expect(t.total, `${eco.id}/${t.speciesId}`).toBeGreaterThan(0);
      // Every zone exists on the map.
      eco.zones.forEach((z, i) => expect(s.zoneAreas[i], `${eco.id}/${z.id}`).toBeGreaterThan(0));
    }
    console.log(rows.join('\n'));
  });

  it('is reproducible from the site code, and different codes give different sites', () => {
    const eco = getEcosystem('grassland')!;
    const a = generateSite(eco, 'meadow-01');
    const b = generateSite(eco, ' MEADOW-01 ');
    const c = generateSite(eco, 'MEADOW-99');
    expect(a.count).toBe(b.count);
    expect(Array.from(a.xs.slice(0, 50))).toEqual(Array.from(b.xs.slice(0, 50)));
    expect(c.count).not.toBe(a.count);
  });

  it('keeps land plants out of water and water plants in it', () => {
    const s = site('pond');
    const lily = s.eco.species.findIndex((sp) => sp.id === 'water-lily');
    const mint = s.eco.species.findIndex((sp) => sp.id === 'water-mint');
    for (let i = 0; i < s.count; i++) {
      const e = s.eco.env(s.xs[i], s.ys[i]);
      if (s.species[i] === lily) expect(e.water).toBeGreaterThan(0.5);
      if (s.species[i] === mint) expect(e.water).toBeLessThan(0.5);
    }
  });
});

describe('quadrats', () => {
  it('tile the site exactly, so the quadrat estimator is unbiased', () => {
    const s = site('grassland');
    for (const size of [0.5, 1, 2]) {
      let total = 0;
      for (let y = 0; y + size <= s.height + 1e-9; y += size) {
        for (let x = 0; x + size <= s.width + 1e-9; x += size) total += countQuadrat(s, x, y, size).total;
      }
      expect(total).toBe(s.count);
    }
  });

  it('count exactly what a brute-force scan finds', () => {
    const s = site('woodland');
    const q = countQuadrat(s, 12.3, 7.7, 1);
    let brute = 0;
    for (let i = 0; i < s.count; i++) {
      if (s.xs[i] >= 12.3 && s.xs[i] < 13.3 && s.ys[i] >= 7.7 && s.ys[i] < 8.7) brute++;
    }
    expect(q.total).toBe(brute);
    expect(q.members).toHaveLength(brute);
    expect(q.richness).toBe(q.counts.filter((c) => c > 0).length);
  });

  it('random, systematic and stratified plans stay inside the site', () => {
    const s = site('grassland');
    const rng = rngFrom(42);
    for (const strategy of ['random', 'systematic', 'stratified'] as const) {
      for (const size of [0.25, 0.5, 1, 2]) {
        const plan = planLocations(s, strategy, 12, size, rng);
        expect(plan.length).toBe(12);
        for (const p of plan) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.x + size).toBeLessThanOrEqual(s.width + 1e-9);
          expect(p.y + size).toBeLessThanOrEqual(s.height + 1e-9);
        }
      }
    }
    const random = planLocations(s, 'random', 30, 1, rng);
    expect(new Set(random.map((p) => `${p.x},${p.y}`)).size).toBe(30);
  });

  it('stratified sampling represents every zone', () => {
    const s = site('pond');
    const plan = planLocations(s, 'stratified', 12, 1, rngFrom(7));
    const zones = new Set(plan.map((p) => countQuadrat(s, p.x, p.y, 1).zone));
    expect(zones.size).toBe(s.eco.zones.length);
  });

  it('random sampling recovers the true density on average', () => {
    const s = site('grassland');
    const focal = 0;
    const rng = rngFrom(99);
    let sum = 0;
    const surveys = 300;
    for (let k = 0; k < surveys; k++) {
      const plan = planLocations(s, 'random', 10, 1, rng);
      sum += plan.reduce((t, p) => t + countQuadrat(s, p.x, p.y, 1).counts[focal], 0) / 10;
    }
    const estimate = sum / surveys;
    expect(Math.abs(estimate - s.truth[focal].density) / s.truth[focal].density).toBeLessThan(0.06);
  });
});

describe('transects', () => {
  it('line transect records only individuals touching the tape', () => {
    const s = site('coastal');
    const start = { x: 20, y: 21 };
    const end = { x: 20, y: 0.5 };
    const r = runLineTransect(s, start, end, 1);
    expect(r.segments).toHaveLength(Math.ceil(20.5));
    for (const i of r.members) {
      const reach = s.eco.species[s.species[i]].radius + 0.01;
      expect(Math.abs(s.xs[i] - 20)).toBeLessThanOrEqual(reach + 1e-6);
    }
    expect(r.segments.reduce((t, g) => t + g.total, 0)).toBe(r.members.length);
  });

  it('belt transect counts match a brute-force scan of the strip', () => {
    const s = site('pond');
    const start = { x: 21, y: 12.5 };
    const end = { x: 39.5, y: 12.5 };
    const r = runBeltTransect(s, start, end, 1, 2);
    let brute = 0;
    for (let i = 0; i < s.count; i++) {
      if (s.xs[i] >= 21 && s.xs[i] < 39.5 && s.ys[i] >= 12 && s.ys[i] < 13) brute++;
    }
    expect(r.segments.reduce((t, g) => t + g.total, 0)).toBe(brute);
    expect(r.segments[0].area).toBe(2);
    // Last section is shorter: 18.5 m in 2 m sections.
    expect(r.segments[r.segments.length - 1].to - r.segments[r.segments.length - 1].from).toBeCloseTo(0.5);
  });

  it('coastal belt transect shows zonation: limpets peak mid-shore', () => {
    const s = site('coastal');
    const r = runBeltTransect(s, { x: 20, y: 21 }, { x: 20, y: 0.5 }, 2, 2);
    const limpet = s.eco.species.findIndex((sp) => sp.id === 'limpet');
    const counts = r.segments.map((g) => g.counts[limpet]);
    const peak = counts.indexOf(Math.max(...counts));
    const peakHeight = (r.segments[peak].from + r.segments[peak].to) / 2;
    expect(peakHeight).toBeGreaterThan(3);
    expect(peakHeight).toBeLessThan(15);
  });
});

describe('sampling bias detection', () => {
  it('rarely raises a false alarm for random sampling', () => {
    for (const id of ['grassland', 'woodland', 'urban-park']) {
      const s = site(id);
      const focal = s.eco.species.findIndex((sp) => sp.id === s.eco.mission.focalSpeciesId);
      const rng = rngFrom(123);
      let flagged = 0;
      const trials = 200;
      for (let k = 0; k < trials; k++) {
        const plan = planLocations(s, 'random', 10, 1, rng);
        const samples = plan.map((p) => ({ ...p, size: 1, count: countQuadrat(s, p.x, p.y, 1).counts[focal] }));
        if (assessBias(s, focal, samples).biased) flagged++;
      }
      expect(flagged / trials, id).toBeLessThan(0.05);
    }
  });

  it('flags samples chosen in the densest patches', () => {
    const s = site('grassland');
    const focal = 0;
    // "Choose by eye": the 10 densest 1 m cells.
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) cells.push({ x, y, d: countQuadrat(s, x, y, 1).counts[focal] });
    }
    cells.sort((a, b) => b.d - a.d);
    const samples = cells.slice(0, 10).map((c) => ({ x: c.x, y: c.y, size: 1, count: c.d }));
    const result = assessBias(s, focal, samples);
    expect(result.biased).toBe(true);
    expect(result.relativeError).toBeGreaterThan(0.5);
  });

  it('flags samples bunched into one corner', () => {
    const s = site('woodland');
    const focal = 0;
    const samples = Array.from({ length: 8 }, (_, i) => {
      const x = 30 + (i % 4) * 1.2;
      const y = 20 + Math.floor(i / 4) * 1.2;
      return { x, y, size: 1, count: countQuadrat(s, x, y, 1).counts[focal] };
    });
    const result = assessBias(s, focal, samples);
    expect(result.issues.some((i) => i.kind === 'clustered')).toBe(true);
  });
});
