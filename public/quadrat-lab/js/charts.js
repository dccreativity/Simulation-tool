/* SVG charts.
 *
 * Counts per quadrat and percentage cover are different measurements, so they
 * never share a y axis: species are grouped by what was recorded and each
 * group gets its own chart. Chart text takes theme tokens, never a series
 * colour — identity is carried by a coloured mark beside the label.
 */

const NS = 'http://www.w3.org/2000/svg';

function mk(tag, attrs = {}, style = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  for (const [k, v] of Object.entries(style)) el.style[k] = v;
  return el;
}

const INK = 'var(--ink)';
const INK2 = 'var(--ink-2)';
const INK3 = 'var(--ink-3)';
const GRID = 'var(--grid)';
const AXIS = 'var(--axis)';
const MARKER = 'var(--marker)';
const MONO = '"IBM Plex Mono", monospace';
const DISPLAY = '"Archivo Narrow", sans-serif';

function niceTicks(max, count = 5) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const out = [];
  for (let v = 0; v <= max + step * 0.5; v += step) out.push(+v.toFixed(6));
  return out;
}

/* ── shared tooltip ──────────────────────────────────────────────────────── */

let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
function showTip(ev, html) {
  const t = tip();
  t.innerHTML = html;
  t.classList.add('on');
  const pad = 14;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  const box = t.getBoundingClientRect();
  if (x + box.width > window.innerWidth - 8) x = ev.clientX - box.width - pad;
  if (y + box.height > window.innerHeight - 8) y = ev.clientY - box.height - pad;
  t.style.left = x + 'px';
  t.style.top = y + 'px';
}
function hideTip() { if (tipEl) tipEl.classList.remove('on'); }

/* ── chart frame ─────────────────────────────────────────────────────────── */

function frame(host, { w = 680, h = 300, m = { l: 54, r: 78, t: 16, b: 46 } } = {}) {
  host.innerHTML = '';
  const svg = mk('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' });
  host.appendChild(svg);
  return { svg, w, h, m, iw: w - m.l - m.r, ih: h - m.t - m.b };
}

function axes(F, { xTicks, yTicks, xFmt = String, yFmt = String, xLabel, yLabel, xOf, yOf }) {
  const { svg, m, ih, w, h } = F;
  for (const t of yTicks) {
    const y = yOf(t);
    svg.appendChild(mk('line', { x1: m.l, x2: m.l + F.iw, y1: y, y2: y },
      { stroke: t === 0 ? AXIS : GRID, strokeWidth: '1' }));
    const lab = mk('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end' },
      { fill: INK3, font: `500 11px ${MONO}` });
    lab.textContent = yFmt(t);
    svg.appendChild(lab);
  }
  for (const t of xTicks) {
    const x = xOf(t);
    svg.appendChild(mk('line', { x1: x, x2: x, y1: m.t + ih, y2: m.t + ih + 5 }, { stroke: AXIS, strokeWidth: '1' }));
    const lab = mk('text', { x, y: m.t + ih + 19, 'text-anchor': 'middle' },
      { fill: INK3, font: `500 11px ${MONO}` });
    lab.textContent = xFmt(t);
    svg.appendChild(lab);
  }
  if (xLabel) {
    const l = mk('text', { x: m.l + F.iw / 2, y: h - 8, 'text-anchor': 'middle' },
      { fill: INK2, font: `600 12px ${DISPLAY}`, letterSpacing: '.04em' });
    l.textContent = xLabel;
    svg.appendChild(l);
  }
  if (yLabel) {
    const l = mk('text', { x: 12, y: m.t + ih / 2, 'text-anchor': 'middle',
      transform: `rotate(-90 12 ${m.t + ih / 2})` }, { fill: INK2, font: `600 12px ${DISPLAY}`, letterSpacing: '.04em' });
    l.textContent = yLabel;
    svg.appendChild(l);
  }
  void w;
}

function refLine(F, y, label, color, dash = '6 5', labelY = null) {
  const { svg, m } = F;
  svg.appendChild(mk('line', { x1: m.l, x2: m.l + F.iw, y1: y, y2: y },
    { stroke: color, strokeWidth: '1.6', strokeDasharray: dash }));
  const t = mk('text', { x: m.l + F.iw + 6, y: (labelY ?? y) + 4 }, { fill: color, font: `600 11px ${MONO}` });
  t.textContent = label;
  svg.appendChild(t);
}

/** Nudge labels apart so end-of-line captions never overprint each other. */
function spreadLabels(ys, minGap, lo, hi) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  for (const o of order) { o.adj = Math.max(o.y, prev + minGap); prev = o.adj; }
  const over = order.length ? order[order.length - 1].adj - hi : 0;
  if (over > 0) {
    let next = Infinity;
    for (let k = order.length - 1; k >= 0; k--) {
      order[k].adj = Math.min(order[k].adj - over, next - minGap);
      next = order[k].adj;
    }
  }
  const out = new Array(ys.length);
  for (const o of order) out[o.i] = Math.max(lo, o.adj);
  return out;
}

/* ── 1. spread of the individual quadrats ────────────────────────────────── */

export function spreadChart(host, { values, color, unit, sampleMean, truth, labels }) {
  const F = frame(host, { h: 270, m: { l: 54, r: 96, t: 14, b: 48 } });
  const { svg, m, ih, iw } = F;
  const max = Math.max(...values, truth ?? 0, sampleMean, 1);
  const yTicks = niceTicks(max * 1.1, 4);
  const top = yTicks[yTicks.length - 1];
  const yOf = (v) => m.t + ih - (v / top) * ih;
  const bw = Math.min(34, (iw / values.length) * 0.68);
  const xOf = (i) => m.l + (iw / values.length) * (i + 0.5);

  axes(F, {
    xTicks: [], yTicks, yFmt: (v) => (unit === '%' ? v + '%' : String(v)),
    xLabel: 'Quadrat, in the order you recorded it', yLabel: unit === '%' ? 'Cover (%)' : 'Individuals per quadrat',
    xOf, yOf,
  });

  values.forEach((v, i) => {
    const hgt = Math.max(v > 0 ? 2 : 0, (v / top) * ih);
    const r = mk('rect', {
      x: xOf(i) - bw / 2, y: m.t + ih - hgt, width: bw, height: hgt, rx: Math.min(2, bw / 3),
    }, { fill: color });
    r.addEventListener('mouseenter', (ev) => showTip(ev,
      `<b>Quadrat ${labels[i]}</b><br>${unit === '%' ? v.toFixed(0) + '% cover' : v + (v === 1 ? ' individual' : ' individuals')}`));
    r.addEventListener('mouseleave', hideTip);
    svg.appendChild(r);
    if (values.length <= 16) {
      const t = mk('text', { x: xOf(i), y: m.t + ih + 17, 'text-anchor': 'middle' },
        { fill: INK3, font: `500 10px ${MONO}` });
      t.textContent = labels[i];
      svg.appendChild(t);
    }
  });

  const refs = [{ y: yOf(sampleMean), label: 'your mean', color: INK, dash: '6 5' }];
  if (truth != null) refs.push({ y: yOf(truth), label: 'true mean', color: MARKER, dash: '3 4' });
  const refYs = spreadLabels(refs.map((r) => r.y), 15, m.t + 9, m.t + ih);
  refs.forEach((r, i) => refLine(F, r.y, r.label, r.color, r.dash, refYs[i]));
  return F;
}

/* ── 2. running estimate ─────────────────────────────────────────────────── */

export function convergenceChart(host, { running, truth, unit, color }) {
  const F = frame(host, { h: 270, m: { l: 60, r: 96, t: 14, b: 48 } });
  const { svg, m, ih, iw } = F;
  const max = Math.max(...running, truth ?? 0) * 1.15;
  const yTicks = niceTicks(max, 4);
  const top = yTicks[yTicks.length - 1];
  const yOf = (v) => m.t + ih - (v / top) * ih;
  const n = running.length;
  const xOf = (i) => m.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const xTicks = [];
  for (let i = 0; i < n; i++) if (n <= 12 || i % Math.ceil(n / 10) === 0 || i === n - 1) xTicks.push(i);

  axes(F, {
    xTicks, yTicks, xFmt: (i) => String(i + 1),
    yFmt: (v) => (unit === '%' ? v + '%' : (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v))),
    xLabel: 'Quadrats used in the mean', yLabel: unit === '%' ? 'Estimated cover (%)' : 'Estimated population',
    xOf, yOf,
  });

  if (truth != null) refLine(F, yOf(truth), 'true value', MARKER, '4 4');

  const pts = running.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  svg.appendChild(mk('polyline', { points: pts }, { fill: 'none', stroke: color, strokeWidth: '2', strokeLinejoin: 'round' }));
  running.forEach((v, i) => {
    const c = mk('circle', { cx: xOf(i), cy: yOf(v), r: i === n - 1 ? 5 : 4 },
      { fill: color, stroke: 'var(--panel)', strokeWidth: '2' });
    c.addEventListener('mouseenter', (ev) => showTip(ev,
      `<b>After ${i + 1} quadrat${i ? 's' : ''}</b><br>estimate ${unit === '%' ? v.toFixed(1) + '%' : Math.round(v).toLocaleString()}`));
    c.addEventListener('mouseleave', hideTip);
    svg.appendChild(c);
  });
  return F;
}

/* ── 3. transect profile ─────────────────────────────────────────────────── */

export function profileChart(host, { stations, series, xLabel, unit, zones }) {
  const F = frame(host, { h: 320, m: { l: 58, r: 120, t: 22, b: 52 } });
  const { svg, m, ih, iw } = F;
  const xs = stations.map((s) => s.d);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const yTicks = niceTicks(max * 1.12, 4);
  const top = yTicks[yTicks.length - 1];
  const yOf = (v) => m.t + ih - (v / top) * ih;
  const xOf = (d) => m.l + (xMax === xMin ? iw / 2 : ((d - xMin) / (xMax - xMin)) * iw);

  // habitat zones behind the data
  if (zones && zones.length) {
    let i = 0;
    while (i < zones.length) {
      let j = i;
      while (j + 1 < zones.length && zones[j + 1] === zones[i]) j++;
      const x0 = xOf(xs[i]) - (i === 0 ? 0 : 1);
      const x1 = xOf(xs[j]);
      if (i % 2 === 0) {
        svg.appendChild(mk('rect', { x: x0, y: m.t, width: Math.max(2, x1 - x0), height: ih },
          { fill: 'var(--inset)', opacity: '.55' }));
      }
      const lab = mk('text', { x: (x0 + x1) / 2, y: m.t - 7, 'text-anchor': 'middle' },
        { fill: INK3, font: `600 10px ${DISPLAY}`, letterSpacing: '.08em', textTransform: 'uppercase' });
      lab.textContent = zones[i].toUpperCase();
      if (x1 - x0 > 48) svg.appendChild(lab);
      i = j + 1;
    }
  }

  const xTicks = xs.filter((d, i) => xs.length <= 12 || i % Math.ceil(xs.length / 10) === 0);
  axes(F, {
    xTicks, yTicks, xFmt: (d) => String(d),
    yFmt: (v) => (unit === '%' ? v + '%' : String(v)),
    xLabel, yLabel: unit === '%' ? 'Cover (%)' : 'Individuals per quadrat',
    xOf, yOf,
  });

  for (const s of series) {
    svg.appendChild(mk('polyline', { points: s.values.map((v, i) => `${xOf(xs[i])},${yOf(v)}`).join(' ') },
      { fill: 'none', stroke: s.color, strokeWidth: '2', strokeLinejoin: 'round', strokeLinecap: 'round' }));
    s.values.forEach((v, i) => {
      svg.appendChild(mk('circle', { cx: xOf(xs[i]), cy: yOf(v), r: 4.2 },
        { fill: s.color, stroke: 'var(--panel)', strokeWidth: '1.6' }));
    });
  }
  // direct labels at the ends of the lines, in ink with a coloured mark, nudged apart
  const endYs = spreadLabels(series.map((s) => yOf(s.values[s.values.length - 1])), 15, m.t + 9, m.t + ih);
  series.forEach((s, k) => {
    svg.appendChild(mk('circle', { cx: m.l + iw + 10, cy: endYs[k] - 3, r: 3.6 }, { fill: s.color }));
    const t = mk('text', { x: m.l + iw + 18, y: endYs[k] }, { fill: INK2, font: `600 11px ${DISPLAY}` });
    t.textContent = s.name;
    svg.appendChild(t);
  });

  // crosshair + tooltip
  const hair = mk('line', { y1: m.t, y2: m.t + ih }, { stroke: AXIS, strokeWidth: '1', strokeDasharray: '3 3', opacity: '0' });
  svg.appendChild(hair);
  const zone = mk('rect', { x: m.l, y: m.t, width: iw, height: ih }, { fill: 'transparent' });
  zone.addEventListener('mousemove', (ev) => {
    const box = svg.getBoundingClientRect();
    const px = ((ev.clientX - box.left) / box.width) * F.w;
    let best = 0, bd = Infinity;
    xs.forEach((d, i) => { const dd = Math.abs(xOf(d) - px); if (dd < bd) { bd = dd; best = i; } });
    hair.setAttribute('x1', xOf(xs[best]));
    hair.setAttribute('x2', xOf(xs[best]));
    hair.style.opacity = '1';
    const rows = series.map((s) =>
      `<span style="color:${s.color}">&#9632;</span> ${s.name}: <b>${unit === '%' ? s.values[best].toFixed(0) + '%' : s.values[best]}</b>`).join('<br>');
    showTip(ev, `<b>${xLabel.replace(/\s*\(m\)$/, '')} ${xs[best]} m</b>${zones && zones[best] ? ' · ' + zones[best] : ''}<br>${rows}`);
  });
  zone.addEventListener('mouseleave', () => { hair.style.opacity = '0'; hideTip(); });
  svg.appendChild(zone);
  return F;
}

/* ── 4. kite diagram ─────────────────────────────────────────────────────── */

export function kiteChart(host, { stations, series, xLabel, unitOf }) {
  const rowH = 64, gap = 16;
  const m = { l: 130, r: 58, t: 14, b: 48 };
  const h = m.t + m.b + series.length * (rowH + gap);
  const F = frame(host, { h, m: { ...m, b: m.b } });
  const { svg, iw } = F;
  const xs = stations.map((s) => s.d);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const xOf = (d) => m.l + (xMax === xMin ? iw / 2 : ((d - xMin) / (xMax - xMin)) * iw);

  series.forEach((s, k) => {
    const cy = m.t + k * (rowH + gap) + rowH / 2;
    const peak = Math.max(...s.values, 1e-6);
    const half = rowH / 2;
    const up = s.values.map((v, i) => `${xOf(xs[i])},${cy - (v / peak) * half}`);
    const down = s.values.map((v, i) => `${xOf(xs[i])},${cy + (v / peak) * half}`).reverse();
    svg.appendChild(mk('polygon', { points: up.concat(down).join(' ') },
      { fill: s.color, fillOpacity: '.62', stroke: s.color, strokeWidth: '1.4' }));
    svg.appendChild(mk('line', { x1: m.l, x2: m.l + iw, y1: cy, y2: cy },
      { stroke: AXIS, strokeWidth: '1', strokeDasharray: '2 3' }));

    svg.appendChild(mk('circle', { cx: 10, cy: cy - 7, r: 4 }, { fill: s.color }));
    const nm = mk('text', { x: 20, y: cy - 3 }, { fill: INK2, font: `600 12px ${DISPLAY}` });
    nm.textContent = s.name;
    svg.appendChild(nm);
    const sc = mk('text', { x: 20, y: cy + 13 }, { fill: INK3, font: `400 10.5px ${MONO}` });
    sc.textContent = `peak ${unitOf(s) === '%' ? peak.toFixed(0) + '%' : peak + '/quadrat'}`;
    svg.appendChild(sc);

    s.values.forEach((v, i) => {
      const hit = mk('rect', { x: xOf(xs[i]) - 9, y: cy - half, width: 18, height: rowH }, { fill: 'transparent' });
      hit.addEventListener('mouseenter', (ev) => showTip(ev,
        `<b>${s.name}</b><br>${xs[i]} m: ${unitOf(s) === '%' ? v.toFixed(0) + '%' : v + '/quadrat'}`));
      hit.addEventListener('mouseleave', hideTip);
      svg.appendChild(hit);
    });
  });

  const yB = m.t + series.length * (rowH + gap) - gap + 6;
  svg.appendChild(mk('line', { x1: m.l, x2: m.l + iw, y1: yB, y2: yB }, { stroke: AXIS, strokeWidth: '1' }));
  const xTicks = xs.filter((d, i) => xs.length <= 12 || i % Math.ceil(xs.length / 10) === 0);
  for (const d of xTicks) {
    svg.appendChild(mk('line', { x1: xOf(d), x2: xOf(d), y1: yB, y2: yB + 5 }, { stroke: AXIS, strokeWidth: '1' }));
    const t = mk('text', { x: xOf(d), y: yB + 19, 'text-anchor': 'middle' }, { fill: INK3, font: `500 11px ${MONO}` });
    t.textContent = String(d);
    svg.appendChild(t);
  }
  const xl = mk('text', { x: m.l + iw / 2, y: yB + 38, 'text-anchor': 'middle' },
    { fill: INK2, font: `600 12px ${DISPLAY}`, letterSpacing: '.04em' });
  xl.textContent = xLabel;
  svg.appendChild(xl);
  return F;
}

/* ── 5. precision against sample size ───────────────────────────────────── */

export function investigateChart(host, { ns, strategies, truth, unit }) {
  const F = frame(host, { h: 340, m: { l: 64, r: 122, t: 18, b: 52 } });
  const { svg, m, ih, iw } = F;
  const hiMax = Math.max(truth, ...strategies.flatMap((s) => s.hi));
  const yTicks = niceTicks(hiMax * 1.05, 5);
  const top = yTicks[yTicks.length - 1];
  const yOf = (v) => m.t + ih - (v / top) * ih;
  const xOf = (n) => m.l + ((n - ns[0]) / (ns[ns.length - 1] - ns[0])) * iw;

  axes(F, {
    xTicks: ns.filter((n) => n === 1 || n % 5 === 0), yTicks,
    yFmt: (v) => (unit === '%' ? v + '%' : (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)))),
    xLabel: 'Number of quadrats in the survey',
    yLabel: unit === '%' ? 'Estimated cover (%)' : 'Estimated population',
    xOf, yOf,
  });

  refLine(F, yOf(truth), 'truth', MARKER, '4 4');

  for (const s of strategies) {
    const band = ns.map((n, i) => `${xOf(n)},${yOf(s.hi[i])}`)
      .concat(ns.map((n, i) => `${xOf(n)},${yOf(s.lo[i])}`).reverse()).join(' ');
    svg.appendChild(mk('polygon', { points: band }, { fill: s.color, fillOpacity: '.15' }));
  }
  for (const s of strategies) {
    svg.appendChild(mk('polyline', { points: ns.map((n, i) => `${xOf(n)},${yOf(s.mid[i])}`).join(' ') },
      { fill: 'none', stroke: s.color, strokeWidth: '2', strokeLinejoin: 'round' }));
  }
  const endYs = spreadLabels(strategies.map((s) => yOf(s.mid[s.mid.length - 1])), 15, m.t + 10, m.t + ih);
  strategies.forEach((s, k) => {
    svg.appendChild(mk('circle', { cx: m.l + iw + 10, cy: endYs[k] - 3, r: 3.6 }, { fill: s.color }));
    const t = mk('text', { x: m.l + iw + 18, y: endYs[k] }, { fill: INK2, font: `600 11px ${DISPLAY}` });
    t.textContent = s.name;
    svg.appendChild(t);
  });

  const hair = mk('line', { y1: m.t, y2: m.t + ih }, { stroke: AXIS, strokeWidth: '1', strokeDasharray: '3 3', opacity: '0' });
  svg.appendChild(hair);
  const zone = mk('rect', { x: m.l, y: m.t, width: iw, height: ih }, { fill: 'transparent' });
  zone.addEventListener('mousemove', (ev) => {
    const box = svg.getBoundingClientRect();
    const px = ((ev.clientX - box.left) / box.width) * F.w;
    let best = 0, bd = Infinity;
    ns.forEach((n, i) => { const d = Math.abs(xOf(n) - px); if (d < bd) { bd = d; best = i; } });
    hair.setAttribute('x1', xOf(ns[best]));
    hair.setAttribute('x2', xOf(ns[best]));
    hair.style.opacity = '1';
    const f = (v) => (unit === '%' ? v.toFixed(1) + '%' : Math.round(v).toLocaleString());
    const rows = strategies.map((s) =>
      `<span style="color:${s.color}">&#9632;</span> ${s.name}: <b>${f(s.mid[best])}</b> <span style="opacity:.75">(${f(s.lo[best])}–${f(s.hi[best])})</span>`).join('<br>');
    showTip(ev, `<b>${ns[best]} quadrat${ns[best] > 1 ? 's' : ''}</b> · middle 80% of surveys<br>${rows}`);
  });
  zone.addEventListener('mouseleave', () => { hair.style.opacity = '0'; hideTip(); });
  svg.appendChild(zone);
  return F;
}

/** HTML legend row — always present when a chart carries two or more series. */
export function legendRow(series) {
  const ul = document.createElement('ul');
  ul.className = 'legend';
  for (const s of series) {
    const li = document.createElement('li');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = s.color;
    sw.style.width = '11px';
    sw.style.height = '11px';
    sw.style.borderRadius = '50%';
    li.appendChild(sw);
    li.appendChild(document.createTextNode(s.name));
    ul.appendChild(li);
  }
  return ul;
}
