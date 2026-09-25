'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crosshair, Hand, Layers, Maximize2, MousePointer2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import type { Point } from '@/types/ecosystem';
import type { PlannedQuadrat, QuadratSample, TransectRecord } from '@/types/data';
import { drawMap, renderGround, type MapLayer, type View } from '@/lib/simulation/render';
import { nearestOrganism, zoneAtPoint, zoneLabel, type Site } from '@/lib/simulation/site';
import { speciesColor } from '@/lib/simulation/palette';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/ui/tabs';
import { SpeciesGlyph } from '@/components/ecosystem/species-glyph';

export type MapTool = 'quadrat' | 'line-transect' | 'belt-transect';
export type MapMode = 'place' | 'inspect';

export interface Highlight {
  key: string;
  members: number[];
  label: string;
  x: number;
  y: number;
}

interface Props {
  site: Site;
  tool: MapTool;
  quadratSize: number;
  beltWidth: number;
  samples: QuadratSample[];
  planned: PlannedQuadrat[];
  transects: TransectRecord[];
  draft: { start: Point | null; end: Point | null };
  highlight: Highlight | null;
  focalIndex: number;
  /** Transect to animate as it is laid out. */
  recentTransectId?: string | null;
  onPlaceQuadrat: (x: number, y: number) => void;
  onCollectPlanned: (id: string) => void;
  onDraftPoint: (p: Point) => void;
}

const ASPECT = 24 / 40;

/** Ground images are expensive to paint, so keep one per site and layer. */
const groundCache = new WeakMap<Site, Map<string, HTMLCanvasElement>>();
function cachedGround(site: Site, layer: MapLayer, focalIndex: number) {
  let bySite = groundCache.get(site);
  if (!bySite) {
    bySite = new Map();
    groundCache.set(site, bySite);
  }
  const key = `${layer}:${layer === 'density' ? focalIndex : ''}`;
  let g = bySite.get(key);
  if (!g) {
    g = renderGround(site, layer, focalIndex);
    bySite.set(key, g);
  }
  return g;
}

function niceScaleBar(scale: number) {
  const target = 110 / scale;
  const steps = [0.5, 1, 2, 5, 10, 20];
  const m = steps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), steps[0]);
  return { metres: m, px: m * scale };
}

export function FieldMap(props: Props) {
  const { site, tool, quadratSize, beltWidth, samples, planned, transects, draft, highlight, focalIndex } = props;
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, ox: 0, oy: 0 });
  const [layer, setLayer] = useState<MapLayer>('field');
  const [mode, setMode] = useState<MapMode>('place');
  const [hover, setHover] = useState<Point | null>(null);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [inspect, setInspect] = useState<{ i: number; sx: number; sy: number } | null>(null);
  const [dimSpecies, setDimSpecies] = useState<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean; pinch?: { d: number; scale: number; cx: number; cy: number } } | null>(null);

  // Fit the site to the container.
  const fit = useCallback((w: number, h: number) => {
    const scale = Math.min(w / site.width, h / site.height);
    return { scale, ox: (w - site.width * scale) / 2, oy: (h - site.height * scale) / 2 };
  }, [site.width, site.height]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = w * ASPECT;
      setSize({ w, h });
      setView(fit(w, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const ground = useMemo(() => (typeof document === 'undefined' ? null : cachedGround(site, layer, focalIndex)), [site, layer, focalIndex]);

  // Redraw on any view change.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !ground || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(size.w * dpr)) {
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const raf = requestAnimationFrame(() => drawMap(ctx, site, ground, view, size.w, size.h, dpr, dimSpecies));
    return () => cancelAnimationFrame(raf);
  }, [site, ground, view, size, dimSpecies]);

  const minScale = size.w ? fit(size.w, size.h).scale : 1;
  const maxScale = minScale * 14;

  const clampView = useCallback(
    (v: View): View => {
      const scale = Math.min(maxScale, Math.max(minScale, v.scale));
      const wW = site.width * scale;
      const wH = site.height * scale;
      const ox = wW <= size.w ? (size.w - wW) / 2 : Math.min(0, Math.max(size.w - wW, v.ox));
      const oy = wH <= size.h ? (size.h - wH) / 2 : Math.min(0, Math.max(size.h - wH, v.oy));
      return { scale, ox, oy };
    },
    [minScale, maxScale, site.width, site.height, size.w, size.h],
  );

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setView((v) => {
        const scale = Math.min(maxScale, Math.max(minScale, v.scale * factor));
        const k = scale / v.scale;
        return clampView({ scale, ox: cx - (cx - v.ox) * k, oy: cy - (cy - v.oy) * k });
      });
    },
    [clampView, minScale, maxScale],
  );

  // Wheel zoom (non-passive so the page does not scroll).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const toWorld = useCallback((sx: number, sy: number): Point => ({ x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale }), [view]);
  const inSite = (p: Point) => p.x >= 0 && p.y >= 0 && p.x <= site.width && p.y <= site.height;

  const activate = useCallback(
    (sx: number, sy: number) => {
      const p = toWorld(sx, sy);
      if (!inSite(p)) return;
      if (mode === 'inspect') {
        const i = nearestOrganism(site, p.x, p.y, Math.max(0.15, 14 / view.scale));
        setInspect(i === null ? null : { i, sx, sy });
        return;
      }
      if (tool === 'quadrat') {
        const hit = planned.find((q) => p.x >= q.x && p.x < q.x + q.size && p.y >= q.y && p.y < q.y + q.size);
        if (hit) props.onCollectPlanned(hit.id);
        else props.onPlaceQuadrat(p.x, p.y);
      } else {
        props.onDraftPoint({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toWorld, mode, tool, planned, site, view.scale, props.onCollectPlanned, props.onPlaceQuadrat, props.onDraftPoint],
  );

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { x: p.x, y: p.y, ox: view.ox, oy: view.oy, moved: true, pinch: { d: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 } };
    } else {
      drag.current = { x: p.x, y: p.y, ox: view.ox, oy: view.oy, moved: false };
    }
  };

  const onPointerMove = (e: RPointerEvent) => {
    const p = local(e);
    setKeyboardFocus(false);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (d?.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = d.pinch.scale * (dist / d.pinch.d);
      const k = scale / d.pinch.scale;
      setView(clampView({ scale, ox: d.pinch.cx - (d.pinch.cx - d.ox) * k, oy: d.pinch.cy - (d.pinch.cy - d.oy) * k }));
      return;
    }
    if (d && pointers.current.size === 1) {
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
      if (d.moved) {
        setView(clampView({ scale: view.scale, ox: d.ox + dx, oy: d.oy + dy }));
        setHover(null);
        return;
      }
    }
    const w = toWorld(p.x, p.y);
    setHover(inSite(w) ? w : null);
  };

  const onPointerUp = (e: RPointerEvent) => {
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (d && !d.moved) activate(d.x, d.y);
      drag.current = null;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = 40;
    const cx = size.w / 2;
    const cy = size.h / 2;
    if (e.key === 'ArrowLeft') setView((v) => clampView({ ...v, ox: v.ox + step }));
    else if (e.key === 'ArrowRight') setView((v) => clampView({ ...v, ox: v.ox - step }));
    else if (e.key === 'ArrowUp') setView((v) => clampView({ ...v, oy: v.oy + step }));
    else if (e.key === 'ArrowDown') setView((v) => clampView({ ...v, oy: v.oy - step }));
    else if (e.key === '+' || e.key === '=') zoomAt(1.4, cx, cy);
    else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.4, cx, cy);
    else if (e.key === 'Enter' || e.key === ' ') activate(cx, cy);
    else if (e.key === 'Escape') setInspect(null);
    else return;
    e.preventDefault();
    setKeyboardFocus(true);
    setHover(toWorld(cx, cy));
  };

  const sx = (x: number) => x * view.scale + view.ox;
  const sy = (y: number) => y * view.scale + view.oy;
  const bar = niceScaleBar(view.scale);
  const species = site.eco.species;
  const inspected = inspect ? { i: inspect.i, sp: species[site.species[inspect.i]] } : null;
  const hoverSize = quadratSize;
  const cursor = mode === 'inspect' ? 'cursor-help' : 'cursor-crosshair';
  const lastSample = samples[samples.length - 1];

  const instructions =
    mode === 'inspect'
      ? 'Inspect mode: click an organism to identify it.'
      : tool === 'quadrat'
        ? 'Click to place a quadrat. Click a dashed quadrat to sample it.'
        : !draft.start
          ? 'Click to set the start of the tape.'
          : !draft.end
            ? 'Click to set the end of the tape.'
            : 'Tape laid out. Adjust it by clicking again, or run the transect.';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Map interaction"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'place', label: <span className="flex items-center gap-1.5"><MousePointer2 className="size-3.5" aria-hidden />Sample</span> },
            { value: 'inspect', label: <span className="flex items-center gap-1.5"><Hand className="size-3.5" aria-hidden />Inspect</span> },
          ]}
        />
        <Segmented
          label="Map layer"
          size="sm"
          value={layer}
          onChange={setLayer}
          options={[
            { value: 'field', label: 'Field', title: 'Aerial field view' },
            { value: 'zones', label: 'Zones', title: 'Habitat zones' },
            { value: 'density', label: 'True density', title: 'Reveal the actual population density of the species you are counting' },
          ]}
        />
      </div>

      <div
        ref={wrap}
        className={cn('field-map relative w-full overflow-hidden rounded-2xl border border-line bg-sage-100 outline-none focus-visible:ring-2 focus-visible:ring-teal-600', cursor)}
        style={{ height: size.h || undefined, aspectRatio: size.h ? undefined : '5 / 3' }}
        tabIndex={0}
        role="application"
        aria-label={`${site.eco.name} field map, ${site.width} by ${site.height} metres. ${instructions} Keyboard: arrow keys pan, plus and minus zoom, Enter samples at the centre crosshair.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setKeyboardFocus(false)}
      >
        <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
        {size.w > 0 && (
          <svg className="absolute inset-0 size-full" width={size.w} height={size.h} aria-hidden>
            <defs>
              <filter id="qshadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#031926" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Transects */}
            {transects.map((t) => {
              const angle = (Math.atan2(t.end.y - t.start.y, t.end.x - t.start.x) * 180) / Math.PI;
              const len = t.length * view.scale;
              const isNew = t.id === props.recentTransectId;
              return (
                <g key={t.id} transform={`translate(${sx(t.start.x)} ${sy(t.start.y)}) rotate(${angle})`}>
                  {t.kind === 'belt' ? (
                    <>
                      <motion.rect
                        x={0}
                        y={(-(t.width ?? 1) / 2) * view.scale}
                        height={(t.width ?? 1) * view.scale}
                        initial={isNew && !reduce ? { width: 0 } : false}
                        animate={{ width: len }}
                        transition={{ duration: 1.2, ease: 'easeInOut' }}
                        fill="rgba(244,233,205,0.28)"
                        stroke="#f4e9cd"
                        strokeWidth={1.5}
                      />
                      {t.segments.slice(1).map((g, i) => (
                        <line key={i} x1={g.from * view.scale} x2={g.from * view.scale} y1={(-(t.width ?? 1) / 2) * view.scale} y2={((t.width ?? 1) / 2) * view.scale} stroke="#f4e9cd" strokeOpacity={0.6} strokeWidth={1} />
                      ))}
                    </>
                  ) : (
                    <>
                      <motion.line
                        x1={0}
                        y1={0}
                        x2={len}
                        y2={0}
                        initial={isNew && !reduce ? { pathLength: 0 } : false}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: 'easeInOut' }}
                        stroke="#f4e9cd"
                        strokeWidth={3}
                        strokeLinecap="round"
                        filter="url(#qshadow)"
                      />
                      {t.segments.map((g, i) => (
                        <line key={i} x1={g.from * view.scale} x2={g.from * view.scale} y1={-5} y2={5} stroke="#031926" strokeWidth={1.5} />
                      ))}
                    </>
                  )}
                  <g transform={`rotate(${-angle})`}>
                    <circle r={9} fill="#031926" />
                    <text textAnchor="middle" dy="0.35em" fontSize={10} fill="#f4e9cd" fontWeight={600}>
                      T{t.number}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Planned quadrats */}
            {planned.map((q) => (
              <rect
                key={q.id}
                x={sx(q.x)}
                y={sy(q.y)}
                width={Math.max(4, q.size * view.scale)}
                height={Math.max(4, q.size * view.scale)}
                fill="rgba(255,252,244,0.12)"
                stroke="#fffcf4"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                filter="url(#qshadow)"
              />
            ))}

            {/* Collected quadrats */}
            {samples.map((s) => {
              const w = Math.max(4, s.size * view.scale);
              const isLast = s.id === lastSample?.id;
              return (
                <motion.g
                  key={s.id}
                  initial={reduce ? false : { opacity: 0, scale: 1.25 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: `${sx(s.x) + w / 2}px ${sy(s.y) + w / 2}px` }}
                >
                  <rect x={sx(s.x)} y={sy(s.y)} width={w} height={w} fill="rgba(255,252,244,0.10)" stroke={isLast ? '#f4e9cd' : '#fffcf4'} strokeWidth={isLast ? 2.5 : 1.8} filter="url(#qshadow)" />
                  {w > 10 && (
                    <g transform={`translate(${sx(s.x) + w} ${sy(s.y)})`}>
                      <circle r={9} fill="#031926" />
                      <text textAnchor="middle" dy="0.35em" fontSize={9.5} fill="#f4e9cd" fontWeight={600}>
                        {s.number}
                      </text>
                    </g>
                  )}
                </motion.g>
              );
            })}

            {/* Highlight organisms inside the latest sample */}
            <AnimatePresence>
              {highlight && (
                <motion.g key={highlight.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  {highlight.members.slice(0, 600).map((i) => (
                    <circle
                      key={i}
                      cx={sx(site.xs[i])}
                      cy={sy(site.ys[i])}
                      r={Math.max(4, species[site.species[i]].radius * view.scale + 3)}
                      fill="none"
                      stroke="#fffcf4"
                      strokeWidth={1.5}
                    />
                  ))}
                  <g transform={`translate(${sx(highlight.x)} ${sy(highlight.y) - 16})`}>
                    <rect x={-Math.max(40, highlight.label.length * 3.6)} y={-13} width={Math.max(80, highlight.label.length * 7.2)} height={24} rx={12} fill="#031926" opacity={0.9} />
                    <text textAnchor="middle" dy="0.35em" y={-1} fontSize={11.5} fill="#f4e9cd" fontWeight={600}>
                      {highlight.label}
                    </text>
                  </g>
                </motion.g>
              )}
            </AnimatePresence>

            {/* Draft transect */}
            {draft.start && (
              <g>
                {(() => {
                  const end = draft.end ?? (hover && mode === 'place' ? hover : null);
                  if (!end) return null;
                  const len = Math.hypot(end.x - draft.start.x, end.y - draft.start.y);
                  const angle = (Math.atan2(end.y - draft.start.y, end.x - draft.start.x) * 180) / Math.PI;
                  return (
                    <g>
                      {tool === 'belt-transect' && (
                        <rect
                          transform={`translate(${sx(draft.start.x)} ${sy(draft.start.y)}) rotate(${angle})`}
                          x={0}
                          y={(-beltWidth / 2) * view.scale}
                          width={len * view.scale}
                          height={beltWidth * view.scale}
                          fill="rgba(244,233,205,0.18)"
                          stroke="#f4e9cd"
                          strokeDasharray="5 4"
                        />
                      )}
                      <line x1={sx(draft.start.x)} y1={sy(draft.start.y)} x2={sx(end.x)} y2={sy(end.y)} stroke="#f4e9cd" strokeWidth={2} strokeDasharray="6 4" />
                      <g transform={`translate(${(sx(draft.start.x) + sx(end.x)) / 2} ${(sy(draft.start.y) + sy(end.y)) / 2 - 14})`}>
                        <rect x={-28} y={-11} width={56} height={20} rx={10} fill="#031926" opacity={0.85} />
                        <text textAnchor="middle" dy="0.35em" y={-1} fontSize={11} fill="#f4e9cd">
                          {len.toFixed(1)} m
                        </text>
                      </g>
                      {draft.end && <circle cx={sx(draft.end.x)} cy={sy(draft.end.y)} r={6} fill="#bb6f58" stroke="#fffcf4" strokeWidth={2} />}
                    </g>
                  );
                })()}
                <circle cx={sx(draft.start.x)} cy={sy(draft.start.y)} r={6} fill="#14989e" stroke="#fffcf4" strokeWidth={2} />
              </g>
            )}

            {/* Placement preview */}
            {hover && mode === 'place' && tool === 'quadrat' && (
              <rect
                x={sx(Math.min(site.width - hoverSize, Math.max(0, hover.x - hoverSize / 2)))}
                y={sy(Math.min(site.height - hoverSize, Math.max(0, hover.y - hoverSize / 2)))}
                width={Math.max(4, hoverSize * view.scale)}
                height={Math.max(4, hoverSize * view.scale)}
                fill="rgba(255,252,244,0.18)"
                stroke="#fffcf4"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
            )}

            {/* Keyboard crosshair */}
            {keyboardFocus && (
              <g transform={`translate(${size.w / 2} ${size.h / 2})`} stroke="#fffcf4" strokeWidth={2}>
                <line x1={-12} x2={12} />
                <line y1={-12} y2={12} />
              </g>
            )}

            {/* Tape-measure ticks along the top and left edges */}
            {Array.from({ length: Math.floor(site.width / 5) + 1 }, (_, i) => i * 5).map((m) => (
              <g key={`tx${m}`} transform={`translate(${sx(m)} ${Math.max(0, sy(0))})`}>
                <line y2={6} stroke="#031926" strokeOpacity={0.55} />
                {m > 0 && m < site.width && (
                  <text y={16} textAnchor="middle" fontSize={9.5} fill="#031926" fillOpacity={0.7}>
                    {m}
                  </text>
                )}
              </g>
            ))}
            {Array.from({ length: Math.floor(site.height / 5) + 1 }, (_, i) => i * 5).map((m) => (
              <g key={`ty${m}`} transform={`translate(${Math.max(0, sx(0))} ${sy(m)})`}>
                <line x2={6} stroke="#031926" strokeOpacity={0.55} />
                {m > 0 && m < site.height && (
                  <text x={9} dy="0.35em" fontSize={9.5} fill="#031926" fillOpacity={0.7}>
                    {m}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}

        {/* North arrow */}
        <div className="pointer-events-none absolute top-2 right-2 flex size-9 flex-col items-center justify-center rounded-full bg-paper/85 text-[0.6rem] font-bold text-navy shadow" aria-hidden>
          N
          <svg viewBox="0 0 10 10" className="size-3">
            <path d="M5 0 L9 10 L5 7 L1 10Z" fill="#031926" />
          </svg>
        </div>

        {/* Zoom controls */}
        <div className="absolute right-2 bottom-2 flex flex-col overflow-hidden rounded-xl border border-line bg-paper/95 shadow">
          <button type="button" className="flex size-9 items-center justify-center hover:bg-teal-50" onClick={() => zoomAt(1.5, size.w / 2, size.h / 2)} aria-label="Zoom in" onPointerDown={(e) => e.stopPropagation()}>
            <ZoomIn className="size-4" aria-hidden />
          </button>
          <button type="button" className="flex size-9 items-center justify-center border-y border-line hover:bg-teal-50" onClick={() => zoomAt(1 / 1.5, size.w / 2, size.h / 2)} aria-label="Zoom out" onPointerDown={(e) => e.stopPropagation()}>
            <ZoomOut className="size-4" aria-hidden />
          </button>
          <button type="button" className="flex size-9 items-center justify-center hover:bg-teal-50" onClick={() => setView(fit(size.w, size.h))} aria-label="Fit the whole site" onPointerDown={(e) => e.stopPropagation()}>
            <Maximize2 className="size-4" aria-hidden />
          </button>
        </div>

        {/* Scale bar + coordinates */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-1 rounded-lg bg-paper/85 px-2.5 py-1.5 text-[0.68rem] text-ink-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="block h-1.5 border-x-2 border-b-2 border-navy" style={{ width: bar.px }} aria-hidden />
            <span className="num">{bar.metres} m</span>
          </div>
          <span className="num flex items-center gap-1" aria-live="off">
            <Crosshair className="size-3" aria-hidden />
            {hover ? `x ${hover.x.toFixed(1)} m · y ${hover.y.toFixed(1)} m · ${zoneLabel(site, zoneAtPoint(site, hover.x, hover.y))}` : `${site.width} m × ${site.height} m`}
          </span>
        </div>

        {/* Inspect card */}
        <AnimatePresence>
          {inspected && inspect && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute z-10 w-60 rounded-2xl border border-line bg-paper p-3 text-sm shadow-lift"
              style={{ left: Math.min(size.w - 250, Math.max(8, inspect.sx + 12)), top: Math.min(size.h - 150, Math.max(8, inspect.sy - 20)) }}
              onPointerDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={`${inspected.sp.name} details`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SpeciesGlyph species={inspected.sp} size={16} />
                  <div>
                    <p className="font-semibold text-ink">{inspected.sp.name}</p>
                    <p className="text-xs text-ink-3 italic">{inspected.sp.scientific}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setInspect(null)} className="rounded p-0.5 text-ink-3 hover:bg-teal-50" aria-label="Close">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">{inspected.sp.description}</p>
              <p className="mt-2 text-[0.7rem] text-ink-3">
                At x {site.xs[inspected.i].toFixed(1)} m, y {site.ys[inspected.i].toFixed(1)} m · {zoneLabel(site, zoneAtPoint(site, site.xs[inspected.i], site.ys[inspected.i]))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-3" aria-live="polite">
          {instructions} Drag to pan · scroll or pinch to zoom.
        </p>
        {layer === 'density' && (
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <Layers className="size-3.5" aria-hidden />
            True density of {species[focalIndex].name.toLowerCase()}: low
            <span className="h-2 w-16 rounded-full" style={{ background: 'linear-gradient(90deg,#eef4f2,#85b8b1,#27616a,#12424f)' }} aria-hidden />
            high
          </p>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Species key">
        {species.map((sp, i) => (
          <li key={sp.id}>
            <button
              type="button"
              onMouseEnter={() => setDimSpecies(i)}
              onMouseLeave={() => setDimSpecies(null)}
              onFocus={() => setDimSpecies(i)}
              onBlur={() => setDimSpecies(null)}
              className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-ink-2 hover:bg-teal-50"
              title={`Highlight ${sp.name} on the map`}
            >
              <SpeciesGlyph species={sp} />
              <span className={cn(i === focalIndex && 'font-semibold text-ink')}>{sp.name}</span>
              <span className="sr-only">(colour {speciesColor(sp.slot)})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
