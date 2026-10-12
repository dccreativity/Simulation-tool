import type { Point } from '@/types/ecosystem';

/** Shortest distance from (x, y) to the segment a–b. */
export function distToSegment(x: number, y: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = a.x + t * dx - x;
  const py = a.y + t * dy - y;
  return Math.sqrt(px * px + py * py);
}

/** Shortest distance from (x, y) to a polyline. */
export function distToPolyline(x: number, y: number, pts: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(x, y, pts[i], pts[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Signed distance to the edge of an ellipse (approximate but smooth):
 * negative inside, positive outside, in metres.
 */
export function ellipseSignedDist(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const k = Math.sqrt(nx * nx + ny * ny);
  // Scale the normalised distance back to metres by the local radius.
  const angle = Math.atan2(ny, nx);
  const localR = Math.sqrt((rx * Math.cos(angle)) ** 2 + (ry * Math.sin(angle)) ** 2);
  return (k - 1) * localR;
}

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export function clampPoint(p: Point, width: number, height: number, margin = 0): Point {
  return {
    x: Math.min(width - margin, Math.max(margin, p.x)),
    y: Math.min(height - margin, Math.max(margin, p.y)),
  };
}

/** Deterministic pseudo-random scatter used to lay out fixed map features. */
export function scatter(seed: number, n: number, width: number, height: number, margin = 1): Point[] {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: n }, () => ({
    x: margin + next() * (width - 2 * margin),
    y: margin + next() * (height - 2 * margin),
  }));
}
