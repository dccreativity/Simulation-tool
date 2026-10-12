/* Canvas drawing: the site map with its two tape measures, and the close-up of
 * the quadrat with its 5 × 5 of wires.
 *
 * Colours are read from the stylesheet at draw time, so both themes work and
 * the species colours on the map are the same ones used in the charts.
 */

const SITE_PAD = { left: 66, bottom: 66, top: 16, right: 16 };
const COVER_CELLS_PER_M = 18;

function hexToRgb(hex) {
  const h = hex.trim().replace('#', '');
  const n = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h.slice(0, 6);
  const v = parseInt(n, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, fallback) => (cs.getPropertyValue(n) || fallback).trim();
  return {
    sp: [get('--sp-1', '#2a78d6'), get('--sp-2', '#eda100'), get('--sp-3', '#e87ba4'), get('--sp-4', '#008300')],
    ink: get('--ink', '#17231d'),
    ink2: get('--ink-2', '#4b574c'),
    ink3: get('--ink-3', '#75816f'),
    panel: get('--panel', '#f9faf6'),
    rule: get('--rule', '#d3d9c8'),
    ruleStrong: get('--rule-strong', '#b2bca6'),
    marker: get('--marker', '#b4501c'),
    steel: get('--steel', '#5d6b74'),
    tape: get('--tape', '#f2e9d2'),
    tapeInk: get('--tape-ink', '#3b3a31'),
    dark: (cs.getPropertyValue('--paper') || '').trim().length > 0
      ? isDark(get('--paper', '#eaeee4')) : false,
  };
}

function isDark(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

export function speciesColor(sp, pal) { return pal.sp[(sp.slot - 1) % 4]; }

/* ── glyphs ──────────────────────────────────────────────────────────────── */

/** One organism. `detail` false draws the cheap version used when zoomed out. */
export function drawGlyph(ctx, kind, x, y, r, color, angle = 0, detail = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (!detail || r < 3.2) {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.85, r * 0.82), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  switch (kind) {
    case 'rosette': {                                  // daisy
      const petals = 9;
      for (let i = 0; i < petals; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.cos((i / petals) * 2 * Math.PI) * r * 0.6,
                    Math.sin((i / petals) * 2 * Math.PI) * r * 0.6,
                    r * 0.4, r * 0.23, (i / petals) * 2 * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
      ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      break;
    }
    case 'ray': {                                      // dandelion
      ctx.lineWidth = Math.max(0.9, r * 0.17);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'trefoil': {                                  // clover
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * 2 * Math.PI - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.47, r * 0.38, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'broadleaf': {                                // plantain rosette
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * Math.PI;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, r * 0.52, r * 0.3, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'limpet': {                                   // conical shell from above
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(-r * 0.12, -r * 0.12, r * 0.3, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'thistle': {
      ctx.lineWidth = Math.max(0.9, r * 0.13);
      for (let i = 0; i < 13; i++) {
        const a = (i / 13) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
        ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'blade': {                                    // grass tuft
      ctx.lineWidth = Math.max(0.9, r * 0.26);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.16, r * 0.9);
        ctx.quadraticCurveTo(i * r * 0.4, 0, i * r * 0.8, -r * 0.95);
        ctx.stroke();
      }
      break;
    }
    case 'cushion': {                                  // moss cushion
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.46, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'frond': {                                    // seaweed strap
      ctx.lineWidth = Math.max(1, r * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.quadraticCurveTo(r * 0.3, 0, 0, -r);
      ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, r * 0.1 * s);
        ctx.quadraticCurveTo(s * r * 0.7, -r * 0.3, s * r * 0.55, -r * 0.85);
        ctx.stroke();
      }
      break;
    }
    default:
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Draw a species glyph into a small legend canvas. */
export function drawLegendSwatch(canvas, sp, color) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  drawGlyph(ctx, sp.glyph, s / 2, s / 2, s * 0.42, color, 0, true);
}

/* ── the site map ────────────────────────────────────────────────────────── */

export class SiteMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = canvas.width;
    this.base.height = canvas.height;
    this.baseKey = null;
  }

  get scale() {
    return (this.canvas.width - SITE_PAD.left - SITE_PAD.right) / this.site.w;
  }
  sx(x) { return SITE_PAD.left + x * this.scale; }
  sy(y) { return this.canvas.height - SITE_PAD.bottom - y * this.scale; }

  /** Pointer position → world metres (may fall outside the site). */
  worldFromEvent(ev) {
    const box = this.canvas.getBoundingClientRect();
    const px = ((ev.clientX - box.left) / box.width) * this.canvas.width;
    const py = ((ev.clientY - box.top) / box.height) * this.canvas.height;
    return {
      x: (px - SITE_PAD.left) / this.scale,
      y: (this.canvas.height - SITE_PAD.bottom - py) / this.scale,
    };
  }

  setSite(site) { this.site = site; this.baseKey = null; }

  _drawFeatureGround(ctx, pal) {
    const sc = this.site.scenario;
    for (const f of sc.features || []) {
      if (f.type === 'path') {
        const earth = pal.dark ? '#3a3026' : '#b9a184';
        const g = ctx.createLinearGradient(0, this.sy(f.y + f.margin), 0, this.sy(f.y - f.margin));
        g.addColorStop(0, earth + '00');
        g.addColorStop(0.5, earth);
        g.addColorStop(1, earth + '00');
        ctx.fillStyle = g;
        ctx.fillRect(this.sx(0), this.sy(f.y + f.margin), this.site.w * this.scale, 2 * f.margin * this.scale);
      } else if (f.type === 'water') {
        ctx.fillStyle = pal.dark ? '#16313b' : '#7fa6b3';
        ctx.fillRect(this.sx(0), this.sy(f.y), this.site.w * this.scale, f.y * this.scale + 1);
      }
    }
  }

  _drawCover(ctx, pal) {
    const site = this.site;
    const covers = site.speciesList.filter((s) => s.kind === 'cover');
    if (!covers.length) return;
    const n = Math.round(site.w * COVER_CELLS_PER_M);
    const m = Math.round(site.h * COVER_CELLS_PER_M);
    const off = document.createElement('canvas');
    off.width = n; off.height = m;
    const octx = off.getContext('2d');
    const img = octx.createImageData(n, m);
    const rgb = covers.map((sp) => hexToRgb(speciesColor(sp, pal)));
    for (let j = 0; j < m; j++) {
      const wy = ((m - 1 - j + 0.5) / m) * site.h;
      for (let i = 0; i < n; i++) {
        const wx = ((i + 0.5) / n) * site.w;
        let pr = 0, pg = 0, pb = 0, pa = 0;     // premultiplied
        for (let k = 0; k < covers.length; k++) {
          const a = site.coverAt(covers[k].id, wx, wy) * 0.86;   // let the ground tint show through
          if (a <= 0.002) continue;
          pr = rgb[k].r * a + pr * (1 - a);
          pg = rgb[k].g * a + pg * (1 - a);
          pb = rgb[k].b * a + pb * (1 - a);
          pa = a + pa * (1 - a);
        }
        const o = (j * n + i) * 4;
        if (pa > 0.002) {
          img.data[o] = pr / pa; img.data[o + 1] = pg / pa; img.data[o + 2] = pb / pa;
          img.data[o + 3] = Math.round(pa * 255);
        }
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, this.sx(0), this.sy(site.h), site.w * this.scale, site.h * this.scale);
  }

  _drawFeatureOverlay(ctx, pal) {
    for (const f of this.site.scenario.features || []) {
      if (f.type === 'canopy') {
        const g = ctx.createRadialGradient(this.sx(f.x), this.sy(f.y), 0, this.sx(f.x), this.sy(f.y), f.r * this.scale);
        g.addColorStop(0, pal.dark ? 'rgba(0,0,0,.5)' : 'rgba(22,34,24,.38)');
        g.addColorStop(0.62, pal.dark ? 'rgba(0,0,0,.34)' : 'rgba(22,34,24,.22)');
        g.addColorStop(1, 'rgba(22,34,24,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.sx(f.x), this.sy(f.y), f.r * this.scale, 0, Math.PI * 2); ctx.fill();

        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = pal.dark ? 'rgba(220,230,210,.4)' : 'rgba(28,40,30,.4)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(this.sx(f.x), this.sy(f.y), f.r * this.scale, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = pal.dark ? '#5b4a38' : '#4a3726';
        ctx.beginPath(); ctx.arc(this.sx(f.x), this.sy(f.y), Math.max(4, f.trunkR * this.scale), 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = pal.dark ? 'rgba(230,238,222,.78)' : 'rgba(26,38,28,.72)';
        ctx.font = '600 15px "Archivo Narrow", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('canopy edge', this.sx(f.x), this.sy(f.y - f.r) - 8);
      } else if (f.type === 'tideline') {
        ctx.setLineDash([10, 7]);
        ctx.strokeStyle = pal.dark ? 'rgba(170,205,220,.75)' : 'rgba(40,70,85,.6)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(this.sx(0), this.sy(f.y)); ctx.lineTo(this.sx(this.site.w), this.sy(f.y));
        ctx.stroke();
        ctx.setLineDash([]);
        if (f.label) {
          ctx.fillStyle = pal.dark ? 'rgba(200,225,235,.9)' : 'rgba(30,55,70,.85)';
          ctx.font = '600 14px "Archivo Narrow", sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(f.label, this.sx(this.site.w) - 6, this.sy(f.y) - 6);
        }
      }
    }
  }

  _drawBase(pal) {
    const key = [this.site.seedText, this.site.scenario.id, pal.dark].join('|');
    if (this.baseKey === key) return;
    const ctx = this.base.getContext('2d');
    ctx.clearRect(0, 0, this.base.width, this.base.height);
    // draw into the cached layer using the same coordinate helpers
    ctx.fillStyle = this.site.scenario.ground[pal.dark ? 'dark' : 'light'];
    ctx.fillRect(this.sx(0), this.sy(this.site.h), this.site.w * this.scale, this.site.h * this.scale);
    this._drawFeatureGround(ctx, pal);
    this._drawCover(ctx, pal);
    this._drawFeatureOverlay(ctx, pal);

    for (const sp of this.site.speciesList) {
      if (sp.kind !== 'count') continue;
      const color = speciesColor(sp, pal);
      const r = Math.max(1.6, sp.size * this.scale);
      const detail = r > 4.5;
      for (const p of this.site.individuals.get(sp.id)) {
        drawGlyph(ctx, sp.glyph, this.sx(p.x), this.sy(p.y), r, color, p.a, detail);
      }
    }
    this.baseKey = key;
  }

  _drawTapes(pal) {
    const ctx = this.ctx;
    const site = this.site;
    const tapeW = 30;
    const x0 = this.sx(0), y0 = this.sy(0), x1 = this.sx(site.w), y1 = this.sy(site.h);

    const tape = (horizontal) => {
      ctx.save();
      ctx.fillStyle = pal.tape;
      ctx.strokeStyle = pal.ruleStrong;
      ctx.lineWidth = 1;
      if (horizontal) ctx.fillRect(x0, y0 + 10, x1 - x0, tapeW);
      else ctx.fillRect(x0 - 10 - tapeW, y1, tapeW, y0 - y1);
      if (horizontal) ctx.strokeRect(x0, y0 + 10, x1 - x0, tapeW);
      else ctx.strokeRect(x0 - 10 - tapeW, y1, tapeW, y0 - y1);

      ctx.strokeStyle = pal.tapeInk;
      ctx.fillStyle = pal.tapeInk;
      ctx.font = '600 15px "IBM Plex Mono", monospace';
      const span = horizontal ? site.w : site.h;
      for (let v = 0; v <= span; v += 0.5) {
        const major = Number.isInteger(v);
        const len = major ? (v % 2 === 0 ? 11 : 7) : 4;
        ctx.lineWidth = major ? 1.4 : 1;
        ctx.beginPath();
        if (horizontal) {
          const px = this.sx(v);
          ctx.moveTo(px, y0 + 10); ctx.lineTo(px, y0 + 10 + len);
        } else {
          const py = this.sy(v);
          ctx.moveTo(x0 - 10, py); ctx.lineTo(x0 - 10 - len, py);
        }
        ctx.stroke();
        if (major && v % 2 === 0 && v <= span - 0.5) {
          if (horizontal) {
            ctx.textAlign = v === 0 ? 'left' : 'center';
            ctx.fillText(String(v), this.sx(v) + (v === 0 ? 2 : 0), y0 + 10 + tapeW - 7);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(String(v), x0 - 10 - tapeW + 5, this.sy(v) + (v === 0 ? -4 : 5));
          }
        }
      }
      ctx.restore();
    };
    tape(true);
    tape(false);

    ctx.save();
    ctx.fillStyle = pal.ink3;
    ctx.font = '600 14px "Archivo Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('x  —  metres along', (x0 + x1) / 2, y0 + 58);
    ctx.translate(x0 - 54, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('y  —  metres up', 0, 0);
    ctx.restore();
  }

  _drawQuadratOutline(rect, { fill, stroke, label, dash, width = 2.4, labelBg = '#17231d', labelFg = '#ffffff' }) {
    const ctx = this.ctx;
    const px = this.sx(rect.x), py = this.sy(rect.y + rect.side);
    const s = rect.side * this.scale;
    ctx.save();
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(px, py, s, s); }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.strokeRect(px, py, s, s);
    ctx.setLineDash([]);
    if (label != null) {
      const r = Math.max(9, Math.min(13, s * 0.42));
      ctx.fillStyle = labelBg;
      ctx.beginPath(); ctx.arc(px + s + r * 0.2, py - r * 0.2, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = labelFg;
      ctx.font = `600 ${Math.round(r * 1.25)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(label), px + s + r * 0.2, py - r * 0.2 + 0.5);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  draw({ samples = [], pending = null, transect = null, stations = [], activeStation = -1, rolled = null, side = 0.5 }) {
    const pal = palette();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawBase(pal);
    ctx.drawImage(this.base, 0, 0);

    // frame round the sample area
    ctx.strokeStyle = pal.ruleStrong;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.sx(0), this.sy(this.site.h), this.site.w * this.scale, this.site.h * this.scale);

    this._drawTapes(pal);

    if (transect && stations.length) {
      ctx.save();
      ctx.strokeStyle = pal.marker;
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.moveTo(this.sx(transect.x1), this.sy(transect.y1));
      ctx.lineTo(this.sx(transect.x2), this.sy(transect.y2));
      ctx.stroke();
      ctx.restore();
      stations.forEach((st, i) => {
        const done = samples.some((s) => s.station === i);
        this._drawQuadratOutline({ x: st.x, y: st.y, side }, {
          fill: i === activeStation ? 'rgba(180,80,28,.18)' : 'rgba(255,255,255,.07)',
          stroke: i === activeStation ? pal.marker : (done ? pal.sp[3] : pal.steel),
          width: i === activeStation ? 3 : 1.8,
          label: done ? samples.find((s) => s.station === i).n : null,
          labelBg: pal.ink, labelFg: pal.panel,
        });
      });
    }

    for (const s of samples) {
      if (s.station != null && stations.length) continue;
      this._drawQuadratOutline({ x: s.x, y: s.y, side: s.side }, {
        fill: s.biased ? 'rgba(208,59,59,.14)' : 'rgba(255,255,255,.12)',
        stroke: s.biased ? '#d03b3b' : pal.ink,
        label: s.n,
        width: 2,
        labelBg: s.biased ? '#d03b3b' : pal.ink,
        labelFg: pal.panel,
      });
    }

    if (rolled && !pending) {
      // show where the rolled coordinates point before the frame goes down
      ctx.save();
      ctx.strokeStyle = pal.marker;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.sx(0), this.sy(rolled.y)); ctx.lineTo(this.sx(rolled.x), this.sy(rolled.y));
      ctx.moveTo(this.sx(rolled.x), this.sy(0)); ctx.lineTo(this.sx(rolled.x), this.sy(rolled.y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.marker;
      ctx.beginPath(); ctx.arc(this.sx(rolled.x), this.sy(rolled.y), 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (pending) {
      this._drawQuadratOutline(pending, {
        fill: 'rgba(180,80,28,.16)', stroke: pal.marker, width: 3.4, dash: null,
      });
      const px = this.sx(pending.x), py = this.sy(pending.y + pending.side);
      const s = pending.side * this.scale;
      ctx.save();
      ctx.strokeStyle = pal.marker;
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(px + (s / 5) * i, py); ctx.lineTo(px + (s / 5) * i, py + s);
        ctx.moveTo(px, py + (s / 5) * i); ctx.lineTo(px + s, py + (s / 5) * i);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/* ── the quadrat close-up ────────────────────────────────────────────────── */

const ZOOM_PAD_FRAC = 0.11;   // how much ground outside the frame stays visible

function zoomGeom(canvas, rect) {
  const pad = rect.side * ZOOM_PAD_FRAC;
  const span = rect.side + 2 * pad;
  const scale = canvas.width / span;
  return {
    pad, span, scale,
    sx: (x) => (x - (rect.x - pad)) * scale,
    sy: (y) => canvas.height - (y - (rect.y - pad)) * scale,
    wx: (px) => rect.x - pad + (px / scale),
    wy: (py) => rect.y - pad + ((canvas.height - py) / scale),
  };
}

export function drawZoom(canvas, site, rect, opts = {}) {
  const { mode = 'count', focus = null, marked = new Set(), counted = new Set(), showTruth = false } = opts;
  const pal = palette();
  const ctx = canvas.getContext('2d');
  const g = zoomGeom(canvas, rect);
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = site.scenario.ground[pal.dark ? 'dark' : 'light'];
  ctx.fillRect(0, 0, W, H);

  // habitat features that change the ground itself
  for (const f of site.scenario.features || []) {
    if (f.type === 'path') {
      const earth = pal.dark ? '#3a3026' : '#b9a184';
      const top = g.sy(f.y + f.margin), bot = g.sy(f.y - f.margin);
      const grad = ctx.createLinearGradient(0, bot, 0, top);
      grad.addColorStop(0, earth + '00'); grad.addColorStop(0.5, earth); grad.addColorStop(1, earth + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(0, top, W, bot - top);
    } else if (f.type === 'water' && rect.y < f.y) {
      ctx.fillStyle = pal.dark ? '#16313b' : '#7fa6b3';
      ctx.fillRect(0, g.sy(f.y), W, H);
    }
  }
  for (const f of site.scenario.features || []) {
    if (f.type === 'canopy') {
      const d = Math.hypot(rect.x + rect.side / 2 - f.x, rect.y + rect.side / 2 - f.y);
      const shade = Math.max(0, 1 - Math.max(0, (d - 3) / 3.6));
      if (shade > 0.02) {
        ctx.fillStyle = `rgba(20,32,22,${(pal.dark ? 0.45 : 0.3) * shade})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  // carpet species, then countable species
  const covers = site.speciesList.filter((s) => s.kind === 'cover');
  for (const sp of covers) {
    const dim = mode === 'cover' && focus && focus !== sp.id;
    ctx.globalAlpha = dim ? 0.3 : 1;
    const color = speciesColor(sp, pal);
    for (const u of site.coverUnits(sp.id, rect, g.pad + sp.unitR)) {
      drawGlyph(ctx, sp.glyph, g.sx(u.x), g.sy(u.y), u.r * g.scale, color, u.a, true);
    }
    ctx.globalAlpha = 1;
  }

  const hits = [];
  for (const sp of site.speciesList) {
    if (sp.kind !== 'count') continue;
    const dim = mode === 'cover';
    const color = speciesColor(sp, pal);
    for (const p of site.individualsAround(sp.id, rect, g.pad + sp.size)) {
      const px = g.sx(p.x), py = g.sy(p.y), pr = p.r * g.scale;
      ctx.globalAlpha = dim ? 0.45 : (p.inside ? 1 : 0.5);
      drawGlyph(ctx, sp.glyph, px, py, pr, color, p.a, true);
      ctx.globalAlpha = 1;
      hits.push({ spId: sp.id, key: sp.id + ':' + p.i, px, py, pr, inside: p.inside });
    }
  }

  // anything outside the frame is out of the sample
  const fx = g.sx(rect.x), fy = g.sy(rect.y + rect.side), fs = rect.side * g.scale;
  ctx.save();
  ctx.fillStyle = pal.dark ? 'rgba(10,12,9,.62)' : 'rgba(238,241,234,.66)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(fx, fy, fs, fs);
  ctx.fill('evenodd');
  ctx.restore();

  // marked small squares
  if (mode === 'cover' && focus) {
    const sp = site.species(focus);
    const color = speciesColor(sp, pal);
    ctx.save();
    for (const idx of marked) {
      const col = idx % 5, row = Math.floor(idx / 5);
      const cx = fx + (fs / 5) * col, cy = fy + (fs / 5) * row;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.26;
      ctx.fillRect(cx, cy, fs / 5, fs / 5);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx + fs / 5 * 0.2, cy + fs / 5 * 0.52);
      ctx.lineTo(cx + fs / 5 * 0.42, cy + fs / 5 * 0.74);
      ctx.lineTo(cx + fs / 5 * 0.8, cy + fs / 5 * 0.26);
      ctx.stroke();
    }
    ctx.restore();
  }

  // counted individuals
  if (mode === 'count') {
    ctx.save();
    ctx.strokeStyle = pal.marker;
    ctx.lineWidth = 2.4;
    for (const h of hits) {
      if (!counted.has(h.key)) continue;
      ctx.beginPath();
      ctx.arc(h.px, h.py, Math.max(7, h.pr * 1.55), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // the frame: galvanised steel, strung into 25 squares
  ctx.save();
  ctx.strokeStyle = pal.steel;
  ctx.lineWidth = 1.4;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(fx + (fs / 5) * i, fy); ctx.lineTo(fx + (fs / 5) * i, fy + fs);
    ctx.moveTo(fx, fy + (fs / 5) * i); ctx.lineTo(fx + fs, fy + (fs / 5) * i);
    ctx.stroke();
  }
  ctx.lineWidth = 9;
  ctx.strokeStyle = pal.steel;
  ctx.strokeRect(fx, fy, fs, fs);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.strokeRect(fx - 3.5, fy - 3.5, fs + 7, fs + 7);
  ctx.restore();

  // scale bar along the bottom of the frame
  ctx.save();
  ctx.fillStyle = pal.ink2;
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${rect.side} m`, fx + fs / 2, fy + fs + 30);
  ctx.restore();

  if (showTruth) {
    ctx.save();
    ctx.fillStyle = pal.marker;
    ctx.font = '600 19px "Archivo Narrow", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('true values shown', 10, 26);
    ctx.restore();
  }

  return { hits, geom: g, frame: { fx, fy, fs } };
}

/** Which organism was clicked, if any. */
export function hitTest(hits, canvas, ev) {
  const box = canvas.getBoundingClientRect();
  const px = ((ev.clientX - box.left) / box.width) * canvas.width;
  const py = ((ev.clientY - box.top) / box.height) * canvas.height;
  let best = null, bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.px - px, h.py - py);
    const reach = Math.max(h.pr + 10, 16);
    if (d < reach && d < bestD) { best = h; bestD = d; }
  }
  return best;
}

/** Which of the 25 small squares was clicked (0 = top-left, reading order). */
export function squareAt(frame, canvas, ev) {
  const box = canvas.getBoundingClientRect();
  const px = ((ev.clientX - box.left) / box.width) * canvas.width;
  const py = ((ev.clientY - box.top) / box.height) * canvas.height;
  const col = Math.floor(((px - frame.fx) / frame.fs) * 5);
  const row = Math.floor(((py - frame.fy) / frame.fs) * 5);
  if (col < 0 || col > 4 || row < 0 || row > 4) return null;
  return row * 5 + col;
}
