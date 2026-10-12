/**
 * Map rendering. The ground is painted once into an offscreen canvas per
 * layer; organisms are drawn live, culled to the viewport and batched per
 * species so tens of thousands of individuals pan and zoom smoothly.
 */

import type { MapFeature } from '@/types/ecosystem';
import { makeNoise2D } from './rng';
import { traceGlyph } from './glyphs';
import { DENSITY_RAMP, speciesColor } from './palette';
import type { Site } from './site';

export type MapLayer = 'field' | 'zones' | 'density';

export const GROUND_RES = 12; // pixels per metre in the cached ground image

export const ZONE_TINTS = ['#cfe2dd', '#efe0b8', '#b7d0d3', '#e3cfc2', '#d6e3c1', '#c9c3dc'];

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** Interpolate the sequential density ramp; t in [0, 1]. */
export function rampColor(t: number): [number, number, number] {
  const k = Math.max(0, Math.min(1, t)) * (DENSITY_RAMP.length - 1);
  const i = Math.min(DENSITY_RAMP.length - 2, Math.floor(k));
  const a = hexToRgb(DENSITY_RAMP[i]);
  const b = hexToRgb(DENSITY_RAMP[i + 1]);
  const f = k - i;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function drawFeatures(ctx: CanvasRenderingContext2D, features: MapFeature[], res: number) {
  // Rocks first, then shrubs/trees on top.
  for (const f of features) {
    if (f.type !== 'rock') continue;
    const noise = makeNoise2D(f.seed);
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = f.r * (0.82 + 0.3 * noise(Math.cos(a) * 1.5 + 3, Math.sin(a) * 1.5 + 3)) * res;
      const x = f.x * res + Math.cos(a) * rr;
      const y = f.y * res + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#a9a595';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(40,40,32,0.35)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(f.x * res - f.r * res * 0.25, f.y * res - f.r * res * 0.3, f.r * res * 0.4, f.r * res * 0.25, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of features) {
    if (f.type !== 'tree') continue;
    const x = f.x * res;
    const y = f.y * res;
    const r = f.r * res;
    if (f.kind === 'shrub') {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#6f8f63');
      g.addColorStop(1, '#4b6b4a');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ctx.moveTo(x + Math.cos(a) * r * 0.55 + r * 0.42, y + Math.sin(a) * r * 0.55);
        ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, 0, Math.PI * 2);
      }
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (f.kind === 'palm') {
      ctx.strokeStyle = 'rgba(31,74,69,0.55)';
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6 - r * 0.1, x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = '#5c4d3a';
      ctx.beginPath();
      ctx.arc(x, y, (f.trunk ?? 0.2) * res, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // Broadleaf canopy: translucent, so the understorey stays visible for sampling.
    ctx.fillStyle = 'rgba(27,64,55,0.20)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(27,64,55,0.35)';
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#5c4d3a';
    ctx.beginPath();
    ctx.arc(x, y, (f.trunk ?? 0.3) * res, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Paint the cached ground image for one layer. */
export function renderGround(site: Site, layer: MapLayer, focalIndex: number): HTMLCanvasElement {
  const res = GROUND_RES;
  const W = Math.round(site.width * res);
  const H = Math.round(site.height * res);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const grain = makeNoise2D(site.seed ^ 0x5bd1e995);
  const eco = site.eco;
  const zoneRgb = ZONE_TINTS.map(hexToRgb);
  const grid = site.densityGrids[focalIndex];
  let maxD = 0;
  if (layer === 'density') for (let i = 0; i < grid.length; i++) maxD = Math.max(maxD, grid[i]);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / res;
      const y = (py + 0.5) / res;
      const e = eco.env(x, y);
      const n = 0.55 * grain(x * 1.6, y * 1.6) + 0.45 * grain(x * 6.5 + 50, y * 6.5);
      let c = eco.ground(x, y, e, n);
      if (layer === 'zones') {
        const zi = eco.zones.findIndex((z) => z.id === eco.zoneAt(x, y, e));
        const t = zoneRgb[Math.max(0, zi) % zoneRgb.length];
        c = [c[0] * 0.25 + t[0] * 0.75, c[1] * 0.25 + t[1] * 0.75, c[2] * 0.25 + t[2] * 0.75];
      } else if (layer === 'density') {
        // Bilinear sample of the 1 m density grid.
        const gx = Math.max(0, Math.min(site.densityGridCols - 1.001, x - 0.5));
        const gy = Math.max(0, Math.min(site.densityGridRows - 1.001, y - 0.5));
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = gx - x0;
        const fy = gy - y0;
        const cols = site.densityGridCols;
        const v =
          grid[y0 * cols + x0] * (1 - fx) * (1 - fy) +
          grid[y0 * cols + x0 + 1] * fx * (1 - fy) +
          grid[(y0 + 1) * cols + x0] * (1 - fx) * fy +
          grid[(y0 + 1) * cols + x0 + 1] * fx * fy;
        const t = rampColor(maxD > 0 ? Math.sqrt(v / maxD) : 0);
        c = [c[0] * 0.15 + t[0] * 0.85, c[1] * 0.15 + t[1] * 0.85, c[2] * 0.15 + t[2] * 0.85];
      }
      const shade = 0.93 + 0.14 * n;
      const i = (py * W + px) * 4;
      img.data[i] = Math.min(255, c[0] * shade);
      img.data[i + 1] = Math.min(255, c[1] * shade);
      img.data[i + 2] = Math.min(255, c[2] * shade);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (layer !== 'density') drawFeatures(ctx, eco.features, res);
  return canvas;
}

export interface View {
  scale: number; // pixels per metre
  ox: number;
  oy: number;
}

/** Draw ground + organisms for the current view. */
export function drawMap(
  ctx: CanvasRenderingContext2D,
  site: Site,
  ground: HTMLCanvasElement,
  view: View,
  width: number,
  height: number,
  dpr: number,
  dimSpecies: number | null,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ground, view.ox, view.oy, site.width * view.scale, site.height * view.scale);

  // Visible world rectangle.
  const x0 = -view.ox / view.scale - 1;
  const y0 = -view.oy / view.scale - 1;
  const x1 = (width - view.ox) / view.scale + 1;
  const y1 = (height - view.oy) / view.scale + 1;

  const species = site.eco.species;
  const detailed = view.scale >= 60;
  species.forEach((sp, si) => {
    const rTrue = sp.radius * view.scale;
    // Physically large plants (shrubs, ferns, lily pads) are drawn at true size as
    // translucent discs; everything else as its glyph, capped so it stays legible.
    const big = sp.radius >= 0.18 && rTrue > 7;
    const r = big ? rTrue : Math.min(11, Math.max(detailed ? 2.6 : view.scale < 25 ? 0.85 : 1.3, rTrue));
    ctx.beginPath();
    const { cell, cols, rows, start, items } = site.index;
    const c0 = Math.max(0, Math.floor(x0 / cell));
    const c1 = Math.min(cols - 1, Math.floor(x1 / cell));
    const r0 = Math.max(0, Math.floor(y0 / cell));
    const r1 = Math.min(rows - 1, Math.floor(y1 / cell));
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        const k = rr * cols + cc;
        for (let j = start[k]; j < start[k + 1]; j++) {
          const i = items[j];
          if (site.species[i] !== si) continue;
          const sx = site.xs[i] * view.scale + view.ox;
          const sy = site.ys[i] * view.scale + view.oy;
          if (r < 2.2 && !big) ctx.rect(sx - r, sy - r, r * 2, r * 2);
          else traceGlyph(ctx, big ? 'circle' : sp.glyph, sx, sy, r);
        }
      }
    }
    const color = speciesColor(sp.slot);
    ctx.globalAlpha = dimSpecies !== null && dimSpecies !== si ? 0.15 : big ? 0.45 : view.scale < 25 ? 0.9 : 1;
    if (sp.glyph === 'ring' && !big) {
      ctx.lineWidth = Math.max(1, r * 0.45);
      ctx.strokeStyle = color;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
      if (r >= 2.6 || big) {
        ctx.lineWidth = big ? 1.5 : 0.9;
        ctx.strokeStyle = big ? color : 'rgba(255,252,244,0.9)';
        ctx.globalAlpha = dimSpecies !== null && dimSpecies !== si ? 0.18 : 0.9;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  });
}
