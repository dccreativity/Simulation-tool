/* Wiring: state, interaction, calculations. */

import { SCENARIOS, byId, acfor } from './scenarios.js';
import { Site, rollCoordinates, transectStations } from './site.js';
import { SiteMap, drawZoom, hitTest, squareAt, palette, speciesColor, drawLegendSwatch } from './render.js';
import { rngFrom, hashString, mixSeeds, mean, stdDev, quantile, clamp } from './rng.js';
import { spreadChart, convergenceChart, profileChart, kiteChart, investigateChart, legendRow } from './charts.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'quadrat-lab-v1';

const state = {
  scenarioId: 'path',
  seedText: 'HEDGE-07',
  side: 0.5,
  method: 'random',
  reveal: false,
  showAccuracy: false,
  site: null,
  samples: [],
  nextN: 1,
  rolled: null,
  pending: null,
  tally: {},
  squares: {},
  counted: new Set(),
  mode: 'count',
  focus: null,
  transect: null,
  stations: [],
  activeStation: -1,
  zoomHits: [],
  zoomFrame: null,
  invCache: null,
};

let siteMap = null;
let rng = rngFrom(Date.now() >>> 0);

/* ── helpers ─────────────────────────────────────────────────────────────── */

const fmt = (v, dp = 1) => (Number.isFinite(v) ? v.toFixed(dp) : '–');
const fmtInt = (v) => Math.round(v).toLocaleString('en-GB');
const quadratArea = () => state.side * state.side;
const quadratsInSite = () => Math.round(state.site.area / quadratArea());
const scenario = () => byId(state.scenarioId);
const isCover = (sp) => sp.kind === 'cover';
const unitOf = (sp) => (isCover(sp) ? '%' : 'count');

function speciesColorOf(sp) { return speciesColor(sp, palette()); }

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      scenarioId: state.scenarioId, seedText: state.seedText, side: state.side,
      method: state.method, samples: state.samples, nextN: state.nextN,
      transect: state.transect, reveal: state.reveal,
    }));
  } catch { /* private browsing, or storage is full — the survey still works */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/* ── site build ──────────────────────────────────────────────────────────── */

function buildSite({ keepSamples = false } = {}) {
  const sc = scenario();
  state.site = new Site(sc, state.seedText);
  siteMap.setSite(state.site);
  state.focus = (sc.species.find(isCover) || sc.species[0]).id;
  clearTally();                 // species ids change with the habitat
  if (!keepSamples) {
    state.samples = [];
    state.nextN = 1;
  }
  state.pending = null;
  state.rolled = null;
  state.zoomHits = [];
  state.activeStation = -1;
  state.invCache = null;
  if (!state.transect || state.transect.scenarioId !== sc.id) resetTransect();
  rng = rngFrom(mixSeeds(hashString(state.seedText), Date.now() & 0xffff));
  renderLegend();
  renderCoverSelect();
  renderSiteMeta();
  layTransect(false);
  renderAll();
}

function resetTransect() {
  const t = scenario().transect;
  state.transect = { ...t, scenarioId: scenario().id };
  $('tStartX').value = t.x1; $('tStartY').value = t.y1;
  $('tEndX').value = t.x2;   $('tEndY').value = t.y2;
  $('tInterval').value = String(t.interval);
}

/* ── static bits of the page ─────────────────────────────────────────────── */

function renderHabitatSelect() {
  const sel = $('habitat');
  sel.innerHTML = '';
  for (const sc of SCENARIOS) {
    const o = document.createElement('option');
    o.value = sc.id;
    o.textContent = sc.name;
    sel.appendChild(o);
  }
  sel.value = state.scenarioId;
}

function renderLegend() {
  const ul = $('siteLegend');
  ul.innerHTML = '';
  for (const sp of state.site.speciesList) {
    const li = document.createElement('li');
    const cv = document.createElement('canvas');
    cv.width = 36; cv.height = 36;
    cv.className = 'swatch';
    drawLegendSwatch(cv, sp, speciesColorOf(sp));
    li.appendChild(cv);
    const nm = document.createElement('span');
    nm.innerHTML = `${sp.name} <span class="sci">${sp.sci}</span>`;
    li.appendChild(nm);
    const tag = document.createElement('span');
    tag.className = 'kindtag';
    tag.textContent = isCover(sp) ? '% cover' : 'count';
    li.appendChild(tag);
    ul.appendChild(li);
  }
  const note = document.createElement('li');
  note.innerHTML = '<span class="sci">Colours are identity keys, not real plant colours.</span>';
  ul.appendChild(note);
}

function renderCoverSelect() {
  const sel = $('coverSpecies');
  sel.innerHTML = '';
  for (const sp of state.site.speciesList.filter(isCover)) {
    const o = document.createElement('option');
    o.value = sp.id; o.textContent = sp.name;
    sel.appendChild(o);
  }
  const covers = state.site.speciesList.filter(isCover);
  if (covers.length) {
    if (!covers.some((s) => s.id === state.focus)) state.focus = covers[0].id;
    sel.value = state.focus;
  }
  $('coverPick').hidden = covers.length < 2;
  const hasCover = covers.length > 0;
  $('modeCover').disabled = !hasCover;
  if (!hasCover && state.mode === 'cover') { state.mode = 'count'; $('modeCount').checked = true; }
}

function renderSiteMeta() {
  const s = state.site;
  $('siteMeta').textContent =
    `${scenario().name} · ${s.w} m × ${s.h} m = ${fmtInt(s.area)} m² · `
    + `${state.side} m frame (${quadratArea().toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} m²) `
    + `· ${fmtInt(quadratsInSite())} possible quadrat positions`;
  $('methodBlurb').textContent = scenario().blurb;
  $('transectNote').textContent =
    `Recommended line for this habitat: ${scenario().transect.axis.replace(/\s*\(m\)$/, '').toLowerCase()}.`;
}

/* ── method panels ───────────────────────────────────────────────────────── */

function setMethod(m) {
  state.method = m;
  $('panel-random').hidden = m !== 'random';
  $('panel-transect').hidden = m !== 'transect';
  $('panel-choice').hidden = m !== 'choice';
  state.pending = null;
  state.rolled = null;
  state.activeStation = -1;
  $('siteHint').textContent = m === 'choice'
    ? 'Click the map to drop the quadrat wherever you like — this is the biased method.'
    : m === 'transect'
      ? 'Quadrats sit at fixed intervals along the line. Click a station to sample it.'
      : 'Tape measures run along two edges, at right angles.';
  clearTally();
  renderAll();
  save();
}

function layTransect(render = true) {
  const t = {
    x1: clamp(parseFloat($('tStartX').value) || 0, 0, state.site.w),
    y1: clamp(parseFloat($('tStartY').value) || 0, 0, state.site.h),
    x2: clamp(parseFloat($('tEndX').value) || 0, 0, state.site.w),
    y2: clamp(parseFloat($('tEndY').value) || 0, 0, state.site.h),
    interval: parseFloat($('tInterval').value) || 2,
    scenarioId: scenario().id,
  };
  state.transect = t;
  state.stations = transectStations(state.site, t, state.side);
  renderStations();
  if (render) renderAll();
  save();
}

function renderStations() {
  const host = $('stationList');
  host.innerHTML = '';
  if (state.method !== 'transect') return;
  state.stations.forEach((st, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'station';
    const done = state.samples.find((s) => s.station === i && s.side === state.side);
    if (done) b.classList.add('done');
    if (i === state.activeStation) b.classList.add('is-on');
    b.textContent = `${st.d} m`;
    b.title = `Station at ${st.d} m — ${scenario().zoneAt(st.x + state.side / 2, st.y + state.side / 2)}`;
    b.addEventListener('click', () => {
      state.activeStation = i;
      placeQuadrat(st.x, st.y, { station: i, d: st.d });
      renderStations();
    });
    host.appendChild(b);
  });
  const left = state.stations.length - state.samples.filter((s) => s.station != null).length;
  if (left > 0) {
    const n = document.createElement('p');
    n.className = 'note';
    n.style.flexBasis = '100%';
    n.textContent = `${left} of ${state.stations.length} stations still to record.`;
    host.appendChild(n);
  }
}

/* ── placing and recording ───────────────────────────────────────────────── */

function rollAndShow() {
  const steps = 9;
  let i = 0;
  $('coordX').classList.add('rolling');
  $('coordY').classList.add('rolling');
  const spin = setInterval(() => {
    const c = rollCoordinates(state.site, state.side, rng);
    $('coordX').textContent = c.x;
    $('coordY').textContent = c.y;
    if (++i >= steps) {
      clearInterval(spin);
      $('coordX').classList.remove('rolling');
      $('coordY').classList.remove('rolling');
      state.rolled = c;
      state.pending = null;
      $('placeBtn').disabled = false;
      const dup = state.samples.some((s) => s.x === c.x && s.y === c.y);
      $('rollNote').innerHTML = dup
        ? `<strong>(${c.x}, ${c.y}) again.</strong> Random coordinates can repeat. Record it a second time — or generate another pair, as long as you decide the rule before you start, not after you see the number.`
        : `The generator picked <strong>x = ${c.x} m</strong> and <strong>y = ${c.y} m</strong>. The quadrat's bottom-left corner goes there.`;
      renderAll();
    }
  }, 55);
}

function placeQuadrat(x, y, meta = {}) {
  const maxX = state.site.w - state.side, maxY = state.site.h - state.side;
  state.pending = {
    x: +clamp(x, 0, maxX).toFixed(3),
    y: +clamp(y, 0, maxY).toFixed(3),
    side: state.side,
    ...meta,
  };
  state.rolled = null;
  clearTally();
  $('recordBtn').disabled = false;
  $('checkBtn').disabled = false;
  $('autoBtn').disabled = false;
  renderAll();
}

function clearTally() {
  state._autoValues = null;
  state.tally = {};
  state.squares = {};
  state.counted = new Set();
  for (const sp of state.site ? state.site.speciesList : []) {
    if (isCover(sp)) state.squares[sp.id] = new Set();
    else state.tally[sp.id] = 0;
  }
  $('feedback').hidden = true;
}

/** What the quadrat really holds — the simulation's own answer. */
function truthFor(rect) {
  const out = {};
  for (const sp of state.site.speciesList) {
    if (isCover(sp)) {
      const m = state.site.measureCover(sp.id, rect, 60);
      out[sp.id] = { pct: m.pct, byHalfRule: m.byHalfRule, squares: m.squares };
    } else {
      out[sp.id] = { count: state.site.countIn(sp.id, rect) };
    }
  }
  return out;
}

function recordedValues() {
  const v = {};
  for (const sp of state.site.speciesList) {
    v[sp.id] = isCover(sp) ? state.squares[sp.id].size * 4 : state.tally[sp.id];
  }
  return v;
}

function recordSample({ demo = false, rect = null, values = null, meta = {} } = {}) {
  const r = rect || state.pending;
  if (!r) return;
  const truth = truthFor(r);
  const vals = values || recordedValues();
  const cx = r.x + r.side / 2, cy = r.y + r.side / 2;
  const richness = state.site.speciesList.filter((sp) => vals[sp.id] > 0).length;
  state.samples.push({
    n: state.nextN++,
    x: r.x, y: r.y, side: r.side,
    station: r.station ?? null,
    d: r.d ?? null,
    zone: scenario().zoneAt(cx, cy),
    method: state.method,
    biased: state.method === 'choice',
    demo,
    values: vals,
    truth: Object.fromEntries(Object.entries(truth).map(([k, t]) => [k, t.pct ?? t.count])),
    richness,
    ...meta,
  });
  state.pending = null;
  state.rolled = null;
  clearTally();
  $('recordBtn').disabled = true;
  $('checkBtn').disabled = true;
  $('autoBtn').disabled = true;
  $('placeBtn').disabled = true;
  if (state.method === 'transect') {
    const next = state.stations.findIndex((st, i) => !state.samples.some((s) => s.station === i));
    state.activeStation = next;
    if (next >= 0) placeQuadrat(state.stations[next].x, state.stations[next].y, { station: next, d: state.stations[next].d });
    renderStations();
  }
  renderAll();
  save();
}

/** Fill the tally with the true contents of the quadrat. */
function autoFill() {
  if (!state.pending) return;
  const truth = truthFor(state.pending);
  for (const sp of state.site.speciesList) {
    if (isCover(sp)) {
      // a careful observer reading the frame, not the 5 × 5 rounding rule
      state.squares[sp.id] = new Set();
    } else {
      state.tally[sp.id] = truth[sp.id].count;
      state.counted = new Set();
      for (const p of state.site.individualsIn(sp.id, state.pending)) state.counted.add(sp.id + ':' + p.i);
    }
  }
  const values = {};
  for (const sp of state.site.speciesList) {
    values[sp.id] = isCover(sp) ? Math.round(truth[sp.id].pct) : truth[sp.id].count;
  }
  state._autoValues = values;
  renderTally(values);
  renderZoom();
  $('feedback').hidden = false;
  $('feedback').className = 'feedback';
  $('feedback').innerHTML = 'Filled in from the simulation. Press <strong>Record this sample</strong> to keep it.';
}

function checkCount() {
  if (!state.pending) return;
  const truth = truthFor(state.pending);
  const vals = state._autoValues || recordedValues();
  const lines = [];
  let allRight = true;
  let countWrong = false;
  // only judge what this mode is actually recording
  const judged = state.site.speciesList.filter((sp) => (state.mode === 'cover' ? isCover(sp) : !isCover(sp)));
  for (const sp of judged) {
    if (isCover(sp)) {
      const t = truth[sp.id];
      const mine = vals[sp.id];
      const diff = Math.abs(mine - t.pct);
      if (diff > 8) allRight = false;
      lines.push(`<strong>${sp.name}:</strong> you recorded ${mine}%. The frame really holds `
        + `${t.pct.toFixed(1)}% — and the "more than half a square" rule on this quadrat gives ${t.byHalfRule}%.`);
    } else {
      const mine = vals[sp.id];
      const t = truth[sp.id].count;
      if (mine !== t) { allRight = false; countWrong = true; }
      lines.push(`<strong>${sp.name}:</strong> you counted ${mine}, the frame holds `
        + `<strong>${t}</strong>${mine === t ? ' ✓' : ''}.`);
    }
  }
  const fb = $('feedback');
  fb.hidden = false;
  fb.className = 'feedback' + (allRight ? ' good' : '');
  fb.innerHTML = (allRight
    ? `<strong>That matches the frame.</strong>${state.mode === 'cover' ? ' Switch to counting to check the countable species too.' : ''}`
    : '<strong>Not quite — compare them.</strong> '
      + (countWrong
        ? 'Remember an individual only counts if its centre is inside the frame.'
        : 'Judging cover by eye is genuinely hard, and the "more than half a square" rule rounds every square to 0% or 4% — so it drifts on a species that is thinly spread across many squares.'))
    + '<ul><li>' + lines.join('</li><li>') + '</li></ul>';
}

/** Auto-record a run of random quadrats, for demonstrating or getting started. */
function quickSurvey(count) {
  for (let k = 0; k < count; k++) {
    const c = rollCoordinates(state.site, state.side, rng);
    const rect = { x: c.x, y: c.y, side: state.side };
    const truth = truthFor(rect);
    const values = {};
    for (const sp of state.site.speciesList) {
      values[sp.id] = isCover(sp) ? Math.round(truth[sp.id].pct) : truth[sp.id].count;
    }
    recordSample({ demo: true, rect, values });
  }
}

/* ── tally panel ─────────────────────────────────────────────────────────── */

function renderTally(override = null) {
  const ul = $('tallyList');
  ul.innerHTML = '';
  const pal = palette();
  const placed = !!state.pending;
  const truth = placed && state.reveal ? truthFor(state.pending) : null;

  for (const sp of state.site.speciesList) {
    const li = document.createElement('li');
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32; cv.className = 'sw';
    drawLegendSwatch(cv, sp, speciesColor(sp, pal));
    li.appendChild(cv);

    const nm = document.createElement('span');
    nm.className = 'nm';
    const sub = isCover(sp)
      ? (state.mode === 'cover' && state.focus === sp.id
        ? `${state.squares[sp.id].size} of 25 squares ticked × 4%`
        : 'percentage cover')
      : 'individuals with their centre inside';
    nm.innerHTML = `${sp.name}<small>${sub}</small>`;
    li.appendChild(nm);

    const val = document.createElement('span');
    val.className = 'val';
    let shown;
    if (override && override[sp.id] != null) shown = override[sp.id];
    else shown = isCover(sp) ? state.squares[sp.id].size * 4 : state.tally[sp.id];
    const inactive = !placed || (state.mode === 'cover' && !isCover(sp)) || (state.mode === 'count' && isCover(sp));
    val.classList.toggle('dim', inactive);
    val.textContent = isCover(sp) ? `${shown}%` : String(shown);
    li.appendChild(val);

    const step = document.createElement('span');
    step.className = 'stepper';
    if (!isCover(sp)) {
      for (const [sym, delta] of [['−', -1], ['+', 1]]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = sym;
        b.disabled = !placed;
        b.setAttribute('aria-label', `${delta > 0 ? 'Add one' : 'Remove one'} ${sp.name}`);
        b.addEventListener('click', () => {
          state._autoValues = null;
          state.tally[sp.id] = Math.max(0, (state.tally[sp.id] || 0) + delta);
          renderTally();
        });
        step.appendChild(b);
      }
    }
    li.appendChild(step);

    if (truth) {
      const t = document.createElement('span');
      t.className = 'truth';
      t.style.gridColumn = '2 / -1';
      t.textContent = isCover(sp)
        ? `truly ${truth[sp.id].pct.toFixed(1)}% (half-square rule: ${truth[sp.id].byHalfRule}%)`
        : `truly ${truth[sp.id].count}`;
      li.appendChild(t);
    }
    ul.appendChild(li);
  }
}

/* ── record sheet ────────────────────────────────────────────────────────── */

function renderSheet() {
  const head = $('sheetHead'), body = $('sheetBody'), foot = $('sheetFoot');
  const sps = state.site.speciesList;
  const pal = palette();

  head.innerHTML = '';
  const hr = document.createElement('tr');
  const cols = ['#', 'Method', 'Dist. (m)', 'x', 'y', 'Zone'];
  for (const c of cols) {
    const th = document.createElement('th');
    th.textContent = c;
    if (c === 'Method' || c === 'Zone') th.className = 'lt';
    hr.appendChild(th);
  }
  for (const sp of sps) {
    const th = document.createElement('th');
    th.className = 'sp';
    th.style.borderBottomColor = speciesColor(sp, pal);
    th.innerHTML = `${sp.name}<br><span style="font-weight:400;text-transform:none;letter-spacing:0">${isCover(sp) ? '% cover' : 'count'}</span>`;
    hr.appendChild(th);
  }
  for (const c of ['Species', '']) {
    const th = document.createElement('th');
    th.textContent = c;
    hr.appendChild(th);
  }
  head.appendChild(hr);

  body.innerHTML = '';
  for (const s of state.samples) {
    const tr = document.createElement('tr');
    const cells = [
      String(s.n),
      `<span class="chip ${s.biased ? 'biased' : ''}">${s.method === 'choice' ? 'chosen' : s.method === 'transect' ? 'transect' : 'random'}</span>${s.demo ? ' <span class="chip demo">auto</span>' : ''}`,
      s.d != null ? String(s.d) : '–',
      String(s.x), String(s.y),
      s.zone,
    ];
    cells.forEach((c, i) => {
      const td = document.createElement('td');
      td.innerHTML = c;
      if (i === 1 || i === 5) td.className = 'lt';
      tr.appendChild(td);
    });
    for (const sp of sps) {
      const td = document.createElement('td');
      const v = s.values[sp.id];
      td.textContent = v == null ? '–' : (isCover(sp) ? `${v}%` : String(v));
      if (scenario().acfor && isCover(sp) && v != null) {
        td.innerHTML = `${v}% <span class="chip">${acfor(v).code}</span>`;
      }
      tr.appendChild(td);
    }
    const rt = document.createElement('td');
    rt.textContent = String(s.richness);
    tr.appendChild(rt);
    const del = document.createElement('td');
    const b = document.createElement('button');
    b.className = 'rowdel';
    b.type = 'button';
    b.textContent = '×';
    b.title = `Delete sample ${s.n}`;
    b.setAttribute('aria-label', `Delete sample ${s.n}`);
    b.addEventListener('click', () => {
      state.samples = state.samples.filter((x) => x !== s);
      renderAll();
      save();
    });
    del.appendChild(b);
    tr.appendChild(del);
    body.appendChild(tr);
  }

  foot.innerHTML = '';
  if (state.samples.length) {
    const tr = document.createElement('tr');
    const lead = document.createElement('th');
    lead.colSpan = 6;
    lead.className = 'lt';
    lead.textContent = `Mean of ${state.samples.length} quadrat${state.samples.length > 1 ? 's' : ''}`;
    tr.appendChild(lead);
    for (const sp of sps) {
      const td = document.createElement('td');
      const vals = state.samples.map((s) => s.values[sp.id]).filter((v) => v != null);
      td.textContent = vals.length ? (isCover(sp) ? `${fmt(mean(vals), 1)}%` : fmt(mean(vals), 2)) : '–';
      tr.appendChild(td);
    }
    const rt = document.createElement('td');
    rt.textContent = fmt(mean(state.samples.map((s) => s.richness)), 1);
    tr.appendChild(rt);
    tr.appendChild(document.createElement('td'));
    foot.appendChild(tr);

    if (state.reveal) {
      const tr2 = document.createElement('tr');
      tr2.className = 'truth';
      const l2 = document.createElement('th');
      l2.colSpan = 6;
      l2.className = 'lt';
      l2.textContent = 'True mean per quadrat';
      tr2.appendChild(l2);
      for (const sp of sps) {
        const td = document.createElement('td');
        const t = state.site.trueMeanPerQuadrat(sp.id, state.side);
        td.textContent = isCover(sp) ? `${fmt(t, 1)}%` : fmt(t, 2);
        tr2.appendChild(td);
      }
      tr2.appendChild(document.createElement('td'));
      tr2.appendChild(document.createElement('td'));
      foot.appendChild(tr2);
    }
  }

  const n = state.samples.length;
  $('sampleCount').textContent = n === 0
    ? 'No samples yet.'
    : `${n} quadrat${n > 1 ? 's' : ''} recorded · ${n < 10 ? `${10 - n} more to reach the usual minimum of ten` : 'at or above the usual minimum of ten'}`;

  const demo = state.samples.filter((s) => s.demo).length;
  const banner = $('sheetBanner');
  if (demo && demo === n) {
    banner.hidden = false;
    banner.innerHTML = `These ${demo} quadrats were filled in automatically so you can see the method working. <strong>Clear the sheet</strong> and record your own.`;
  } else if (state.samples.some((s) => s.biased)) {
    banner.hidden = false;
    banner.innerHTML = 'This sheet contains quadrats you placed by eye. Those samples are <strong>biased</strong> — keep them separate from random ones when you write up.';
  } else {
    banner.hidden = true;
  }
}

/* ── analysis ────────────────────────────────────────────────────────────── */

function speciesStats(sp) {
  const vals = state.samples.map((s) => s.values[sp.id]).filter((v) => v != null);
  if (!vals.length) return null;
  const m = mean(vals);
  const truth = state.site.trueTotal(sp.id);
  const estimate = isCover(sp) ? m : m * quadratsInSite();
  return {
    sp, vals, n: vals.length, mean: m, sd: stdDev(vals),
    estimate, truth,
    error: truth > 0 ? ((estimate - truth) / truth) * 100 : 0,
    running: vals.map((_, i) => {
      const mm = mean(vals.slice(0, i + 1));
      return isCover(sp) ? mm : mm * quadratsInSite();
    }),
  };
}

function verdict(errPct) {
  const a = Math.abs(errPct);
  if (a < 10) return { cls: 'ok', text: `within ${fmt(a, 1)}% of the truth` };
  if (a < 25) return { cls: 'warn', text: `${fmt(a, 1)}% out` };
  return { cls: 'bad', text: `${fmt(a, 1)}% out` };
}

function renderAnalysis() {
  const has = state.samples.length > 0;
  $('analysisEmpty').hidden = has;
  $('analysisBody').hidden = !has;
  if (!has) return;

  const pal = palette();
  const stats = state.site.speciesList.map(speciesStats).filter(Boolean);
  const n = state.samples.length;

  $('calcSub').textContent =
    `${n} quadrat${n > 1 ? 's' : ''} · ${state.side} m frame = ${quadratArea()} m² · `
    + `site ${fmtInt(state.site.area)} m² · one quadrat is 1/${fmtInt(quadratsInSite())} of the site`;

  const tCount = state.samples.filter((s) => s.station != null).length;
  const caveat = $('calcCaveat');
  if (tCount > n / 2) {
    caveat.hidden = false;
    caveat.innerHTML = '<strong>These are mostly transect quadrats.</strong> A transect is laid along a '
      + 'gradient on purpose, so its quadrats are not a fair sample of the whole site. Use it to show how '
      + 'abundance <em>changes</em> with distance — scale up to a population estimate from random quadrats instead.';
  } else if (state.samples.some((s) => s.biased)) {
    caveat.hidden = false;
    caveat.innerHTML = '<strong>This sheet includes quadrats placed by eye.</strong> Those are biased, so the '
      + 'estimate below is not a fair one.';
  } else {
    caveat.hidden = true;
  }

  const host = $('calcPanel');
  host.innerHTML = '';
  for (const st of stats) {
    const card = document.createElement('div');
    card.className = 'calc';
    card.style.borderTopColor = speciesColor(st.sp, pal);
    const total = st.vals.reduce((a, b) => a + b, 0);
    const work = isCover(st.sp)
      ? `<em>sum of cover</em> ${fmt(total, 0)}% ÷ ${st.n} quadrats<br>`
        + `= <strong>${fmt(st.mean, 1)}%</strong> mean cover<br>`
        + `<em>area covered</em> ${fmt(st.mean, 1)}% × ${fmtInt(state.site.area)} m² = ${fmt((st.mean / 100) * state.site.area, 0)} m²`
      : `<em>total counted</em> ${total} ÷ ${st.n} quadrats = <strong>${fmt(st.mean, 2)}</strong> per quadrat<br>`
        + `<em>quadrats in site</em> ${fmtInt(state.site.area)} m² ÷ ${quadratArea()} m² = ${fmtInt(quadratsInSite())}<br>`
        + `<em>estimate</em> ${fmt(st.mean, 2)} × ${fmtInt(quadratsInSite())}`;
    card.innerHTML =
      `<h3>${st.sp.name}</h3><p class="sci">${st.sp.sci}</p>`
      + `<p class="work">${work}</p>`
      + `<p class="big">${isCover(st.sp) ? fmt(st.estimate, 1) + '%' : fmtInt(st.estimate)} `
      + `<small>${isCover(st.sp) ? 'cover across the site' : 'individuals in the site'}</small></p>`
      + `<p class="work" style="margin-top:6px">spread between quadrats: <strong>± ${fmt(st.sd, isCover(st.sp) ? 1 : 2)}</strong>${isCover(st.sp) ? '%' : ''} (standard deviation)</p>`;
    if (state.showAccuracy) {
      const v = verdict(st.error);
      card.innerHTML += `<p class="verdict ${v.cls}"><span class="dot"></span>`
        + `true value ${isCover(st.sp) ? fmt(st.truth, 1) + '%' : fmtInt(st.truth)} — ${v.text}</p>`;
    }
    host.appendChild(card);
  }

  // spread + convergence for the first species with any variation
  const focusSt = stats.find((s) => s.sd > 0) || stats[0];
  $('spreadSub').textContent =
    `${focusSt.sp.name} in each quadrat. A wide spread means one quadrat tells you very little.`;
  spreadChart($('chartSpread'), {
    values: focusSt.vals,
    labels: state.samples.map((s) => s.n),
    color: speciesColor(focusSt.sp, pal),
    unit: unitOf(focusSt.sp) === '%' ? '%' : 'n',
    sampleMean: focusSt.mean,
    truth: state.showAccuracy ? state.site.trueMeanPerQuadrat(focusSt.sp.id, state.side) : null,
  });
  convergenceChart($('chartConverge'), {
    running: focusSt.running,
    truth: state.showAccuracy ? focusSt.truth : null,
    unit: unitOf(focusSt.sp) === '%' ? '%' : 'n',
    color: speciesColor(focusSt.sp, pal),
  });

  renderTransectSection(stats, pal);
  renderDiversity(stats);
  renderAccuracy(stats, pal);
}

function renderTransectSection(stats, pal) {
  const tSamples = state.samples.filter((s) => s.station != null && s.d != null)
    .sort((a, b) => a.d - b.d);
  const section = $('transectSection');
  if (tSamples.length < 3) { section.hidden = true; return; }
  section.hidden = false;

  const stations = tSamples.map((s) => ({ d: s.d }));
  const zones = tSamples.map((s) => s.zone);
  const mkSeries = (kind) => state.site.speciesList.filter((sp) => sp.kind === kind).map((sp) => ({
    id: sp.id, name: sp.name, color: speciesColor(sp, pal), kind,
    values: tSamples.map((s) => s.values[sp.id] ?? 0),
  }));

  $('profSub').textContent =
    `${tSamples.length} stations along the line, ${state.transect.interval} m apart. `
    + `Counts and percentage cover are different measurements, so they get separate axes.`;

  const host = $('chartProfile');
  host.innerHTML = '';
  for (const kind of ['cover', 'count']) {
    const series = mkSeries(kind).filter((s) => s.values.some((v) => v > 0));
    if (!series.length) continue;
    const block = document.createElement('div');
    const h = document.createElement('p');
    h.className = 'panel-h';
    h.textContent = kind === 'cover' ? 'Percentage cover' : 'Individuals per quadrat';
    block.appendChild(h);
    if (series.length > 1) block.appendChild(legendRow(series));
    const chart = document.createElement('div');
    block.appendChild(chart);
    host.appendChild(block);
    profileChart(chart, {
      stations, series, zones,
      xLabel: scenario().transect.axis,
      unit: kind === 'cover' ? '%' : 'n',
    });
  }

  const all = [...mkSeries('cover'), ...mkSeries('count')].filter((s) => s.values.some((v) => v > 0));
  kiteChart($('chartKite'), {
    stations, series: all,
    xLabel: scenario().transect.axis,
    unitOf: (s) => (s.kind === 'cover' ? '%' : 'n'),
  });
  void stats;
}

function renderDiversity(stats) {
  const host = $('diversityPanel');
  const counts = stats.filter((s) => !isCover(s.sp));
  const totalRichness = stats.filter((s) => s.vals.some((v) => v > 0)).length;
  const meanRichness = mean(state.samples.map((s) => s.richness));
  let simpson = null;
  if (counts.length >= 2) {
    const totals = counts.map((s) => s.vals.reduce((a, b) => a + b, 0));
    const N = totals.reduce((a, b) => a + b, 0);
    if (N > 1) simpson = 1 - totals.reduce((acc, n) => acc + (n / N) * (n / N), 0);
  }
  host.innerHTML = `<p class="panel-h">Diversity</p><ul class="kv">
    <li><span class="k">Species found in your quadrats</span><span class="v">${totalRichness} of ${state.site.speciesList.length}</span></li>
    <li><span class="k">Mean species richness per quadrat</span><span class="v">${fmt(meanRichness, 2)}</span></li>
    ${simpson != null
      ? `<li><span class="k">Simpson's index of diversity (1 − Σ(n/N)²)</span><span class="v">${fmt(simpson, 3)}</span></li>`
      : ''}
  </ul>
  <p class="explain">${simpson != null
    ? 'Simpson\'s index uses the countable species only: percentage cover is not a number of individuals, so it cannot go into the same sum. 0 means one species dominates, and the closer to 1 the more even the community.'
    : 'Simpson\'s index needs at least two countable species, so it is not calculated for this habitat.'}</p>`;
}

function renderAccuracy(stats, pal) {
  const host = $('accuracyPanel');
  if (!state.showAccuracy) {
    host.innerHTML = `<p class="panel-h">Accuracy</p>
      <p class="explain">Write down what you think the real population is before you look. The simulation
      knows the exact answer for every species on this site.</p>
      <button class="btn btn-primary" id="revealAcc" type="button" style="margin-top:10px">Check my estimates</button>`;
    $('revealAcc').addEventListener('click', () => {
      state.showAccuracy = true;
      renderAnalysis();
    });
    return;
  }
  const rows = stats.map((st) => {
    const v = verdict(st.error);
    return `<li><span class="k"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${speciesColor(st.sp, pal)};margin-right:6px"></span>${st.sp.name}</span>
      <span class="v">${isCover(st.sp) ? fmt(st.estimate, 1) + '%' : fmtInt(st.estimate)}
      <span style="color:var(--ink-3)">vs</span> ${isCover(st.sp) ? fmt(st.truth, 1) + '%' : fmtInt(st.truth)}
      <span style="color:var(--${v.cls === 'ok' ? 'good' : v.cls === 'warn' ? 'warning' : 'critical'})">${st.error >= 0 ? '+' : ''}${fmt(st.error, 1)}%</span></span></li>`;
  }).join('');
  const biased = state.samples.some((s) => s.biased);
  host.innerHTML = `<p class="panel-h">Accuracy — your estimate against the truth</p><ul class="kv">${rows}</ul>
    <p class="explain">${biased
      ? 'Some of these quadrats were placed by eye, so expect the estimate to sit consistently above or below the truth rather than scattering around it — that is bias, not bad luck.'
      : 'With random quadrats the error should scatter either side of zero and shrink as you add more quadrats. A large error from ten quadrats is not a mistake; it is sampling error, and the Investigate tab measures how big it should be.'}</p>`;
}

/* ── investigate ─────────────────────────────────────────────────────────── */

function renderInvSpecies() {
  const sel = $('invSpecies');
  const prev = sel.value;
  sel.innerHTML = '';
  for (const sp of state.site.speciesList) {
    const o = document.createElement('option');
    o.value = sp.id;
    o.textContent = `${sp.name} (${isCover(sp) ? '% cover' : 'count'})`;
    sel.appendChild(o);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function runInvestigation() {
  const spId = $('invSpecies').value || state.site.speciesList[0].id;
  const sp = state.site.species(spId);
  const side = state.side;
  const map = state.site.positionMap(side);
  const vals = map.values.get(spId);
  const truth = state.site.trueTotal(spId);
  const scaleUp = isCover(sp) ? 1 : quadratsInSite();
  const reps = 300;
  const ns = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = rngFrom(mixSeeds(hashString(state.seedText), hashString(spId), 4241));

  // "where it looks best": the top 40% of positions for this species
  const order = Array.from(vals.keys()).sort((a, b) => vals[b] - vals[a]);
  const good = order.slice(0, Math.max(1, Math.round(order.length * 0.4)));

  const pick = {
    random: (n) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += vals[Math.floor(r() * vals.length)];
      return s / n;
    },
    systematic: (n) => {
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const sx = state.site.w / cols, sy = state.site.h / rows;
      const ox = r() * sx, oy = r() * sy;
      let s = 0, got = 0;
      for (let j = 0; j < rows && got < n; j++) {
        for (let i = 0; i < cols && got < n; i++) {
          const ia = clamp(Math.round((ox + i * sx) / side), 0, map.xs.length - 1);
          const ib = clamp(Math.round((oy + j * sy) / side), 0, map.ys.length - 1);
          s += vals[ib * map.xs.length + ia];
          got++;
        }
      }
      return s / got;
    },
    biased: (n) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += vals[good[Math.floor(r() * good.length)]];
      return s / n;
    },
  };

  const pal = palette();
  const defs = [
    { key: 'random', name: 'Random', color: pal.sp[0] },
    { key: 'systematic', name: 'Systematic grid', color: pal.sp[3] },
    { key: 'biased', name: 'Chosen by eye', color: pal.sp[2] },
  ];
  const strategies = defs.map((d) => ({ ...d, mid: [], lo: [], hi: [], meanAt: [] }));

  for (const n of ns) {
    for (const st of strategies) {
      const ests = new Array(reps);
      for (let k = 0; k < reps; k++) ests[k] = pick[st.key](n) * scaleUp;
      ests.sort((a, b) => a - b);
      st.mid.push(quantile(ests, 0.5));
      st.lo.push(quantile(ests, 0.1));
      st.hi.push(quantile(ests, 0.9));
      st.meanAt.push(mean(ests));
    }
  }

  state.invCache = { spId, strategies, ns, truth, unit: isCover(sp) ? '%' : 'n', sp };
  drawInvestigation();
}

function drawInvestigation() {
  const c = state.invCache;
  const host = $('chartInvestigate');
  if (!c) {
    host.innerHTML = '';
    $('invReadout').innerHTML = '';
    return;
  }
  host.innerHTML = '';
  const legend = legendRow(c.strategies.map((s) => ({ name: s.name, color: s.color })));
  host.appendChild(legend);
  const chart = document.createElement('div');
  host.appendChild(chart);
  investigateChart(chart, { ns: c.ns, strategies: c.strategies, truth: c.truth, unit: c.unit });

  const f = (v) => (c.unit === '%' ? fmt(v, 1) + '%' : fmtInt(v));
  const within10 = (st) => {
    const i = st.lo.findIndex((lo, k) => lo >= c.truth * 0.9 && st.hi[k] <= c.truth * 1.1);
    return i === -1 ? null : c.ns[i];
  };
  const rnd = c.strategies[0], sys = c.strategies[1], bias = c.strategies[2];
  const at10 = (st) => `${f(st.lo[9])} – ${f(st.hi[9])}`;
  const needRnd = within10(rnd);

  $('invReadout').innerHTML = `
    <div class="inv-card" style="border-left-color:${rnd.color}">
      <h3>Ten random quadrats</h3>
      <p class="num">${at10(rnd)}</p>
      <p>where 8 surveys in 10 land, against a true ${f(c.truth)}. The middle of that range sits on the
      truth — random sampling is not systematically wrong, just imprecise.</p>
    </div>
    <div class="inv-card" style="border-left-color:${sys.color}">
      <h3>Ten on a systematic grid</h3>
      <p class="num">${at10(sys)}</p>
      <p>Spreading quadrats evenly with a random starting point is usually a little more precise than
      random placement, because it cannot leave a whole corner of the site unsampled.</p>
    </div>
    <div class="inv-card" style="border-left-color:${bias.color}">
      <h3>Ten chosen by eye</h3>
      <p class="num">${at10(bias)}</p>
      <p>Quadrats dropped on the best-looking ground overestimate ${c.sp.name.toLowerCase()} by about
      <strong>${fmt(((bias.mid[9] - c.truth) / c.truth) * 100, 0)}%</strong>. More quadrats do not fix
      this: the range narrows around the wrong answer.</p>
    </div>
    <div class="inv-card" style="border-left-color:var(--marker)">
      <h3>Quadrats needed</h3>
      <p class="num">${needRnd ? needRnd : 'more than 30'}</p>
      <p>${needRnd
        ? `random quadrats before 8 surveys in 10 land within 10% of the truth for ${c.sp.name.toLowerCase()}.`
        : `random quadrats is not enough to be reliably within 10% — this species is too patchy for a small survey.`}
      ${c.sp.clump && c.sp.clump.weight > 0.6 ? ' Clumped species need far more quadrats than evenly spread ones.' : ''}</p>
    </div>`;
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

function buildCsv() {
  const sps = state.site.speciesList;
  const head = ['Sample', 'Method', 'Distance_m', 'x_m', 'y_m', 'Zone',
    ...sps.map((sp) => `${sp.name.replace(/\s+/g, '_')}_${isCover(sp) ? 'pct_cover' : 'count'}`),
    'Species_richness'];
  const rows = state.samples.map((s) => [
    s.n, s.method, s.d ?? '', s.x, s.y, `"${s.zone}"`,
    ...sps.map((sp) => s.values[sp.id] ?? ''), s.richness,
  ].join(','));
  const meta = [
    `# Quadrat & Transect Lab — ${scenario().name}`,
    `# site code: ${state.seedText} · site ${state.site.w}x${state.site.h} m · quadrat ${state.side} m (${quadratArea()} m2)`,
    `# quadrat positions in site: ${quadratsInSite()}`,
  ];
  return [...meta, head.join(','), ...rows].join('\n');
}

/* ── render everything ───────────────────────────────────────────────────── */

function renderZoom() {
  const canvas = $('zoomCanvas');
  if (!state.pending) {
    const ctx = canvas.getContext('2d');
    const pal = palette();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = pal.dark ? 'rgba(0,0,0,.22)' : '#e4e9db';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = pal.ink3;
    ctx.font = '500 26px "Archivo Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No quadrat placed yet', canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = '400 19px "IBM Plex Sans", sans-serif';
    ctx.fillText(state.method === 'random' ? 'Generate coordinates in step 3'
      : state.method === 'transect' ? 'Lay the transect, then pick a station'
        : 'Click the map above', canvas.width / 2, canvas.height / 2 + 22);
    $('zoomHint').textContent = ' ';
    return;
  }
  const res = drawZoom(canvas, state.site, state.pending, {
    mode: state.mode,
    focus: state.focus,
    marked: state.squares[state.focus] || new Set(),
    counted: state.counted,
    showTruth: state.reveal,
  });
  state.zoomHits = res.hits;
  state.zoomFrame = res.frame;
  $('zoomHint').textContent = state.mode === 'count'
    ? 'Click each organism to tick it off. Only those with their centre inside the frame count.'
    : `Click every small square that ${state.site.species(state.focus).name.toLowerCase()} fills more than half of. Each square is 4%.`;
}

function renderZoomMeta() {
  const p = state.pending;
  $('zoomMeta').textContent = p
    ? `Quadrat at x = ${p.x} m, y = ${p.y} m · ${scenario().zoneAt(p.x + p.side / 2, p.y + p.side / 2)}`
      + (p.d != null ? ` · station ${p.d} m along the transect` : '')
    : 'Place a quadrat first.';
}

function renderAll() {
  siteMap.draw({
    samples: state.samples,
    pending: state.pending,
    transect: state.method === 'transect' ? state.transect : null,
    stations: state.method === 'transect' ? state.stations : [],
    activeStation: state.activeStation,
    rolled: state.rolled,
    side: state.side,
  });
  renderZoom();
  renderZoomMeta();
  renderTally(state._autoValues);
  renderSheet();
  renderAnalysis();
  renderStations();
  if (state.invCache) drawInvestigation();
}

/* ── events ──────────────────────────────────────────────────────────────── */

function wire() {
  $('habitat').addEventListener('change', (e) => {
    state.scenarioId = e.target.value;
    state.transect = null;
    resetTransect();
    buildSite();
    state.showAccuracy = state.reveal;
    save();
  });

  $('quadratSide').addEventListener('change', (e) => {
    state.side = parseFloat(e.target.value);
    state.samples = [];
    state.nextN = 1;
    buildSite();
    save();
  });

  $('seed').addEventListener('change', (e) => {
    state.seedText = e.target.value.trim().toUpperCase() || 'SITE';
    e.target.value = state.seedText;
    buildSite();
    save();
  });

  $('newSite').addEventListener('click', () => {
    const words = ['HEDGE', 'COPSE', 'MEADOW', 'DUNE', 'BROOK', 'HEATH', 'LEDGE', 'FURROW'];
    state.seedText = `${words[Math.floor(Math.random() * words.length)]}-${String(Math.floor(Math.random() * 90) + 10)}`;
    $('seed').value = state.seedText;
    buildSite();
    save();
  });

  $('reveal').addEventListener('change', (e) => {
    state.reveal = e.target.checked;
    if (state.reveal) state.showAccuracy = true;
    renderAll();
    save();
  });

  for (const id of ['m-random', 'm-transect', 'm-choice']) {
    $(id).addEventListener('change', (e) => { if (e.target.checked) setMethod(e.target.value); });
  }

  $('rollBtn').addEventListener('click', rollAndShow);
  $('placeBtn').addEventListener('click', () => {
    if (state.rolled) placeQuadrat(state.rolled.x, state.rolled.y);
  });

  $('layBtn').addEventListener('click', () => layTransect());
  $('tPreset').addEventListener('click', () => { resetTransect(); layTransect(); });
  for (const id of ['tStartX', 'tStartY', 'tEndX', 'tEndY', 'tInterval']) {
    $(id).addEventListener('change', () => layTransect());
  }

  $('siteCanvas').addEventListener('click', (ev) => {
    if (state.method !== 'choice') return;
    const w = siteMap.worldFromEvent(ev);
    if (w.x < 0 || w.y < 0 || w.x > state.site.w || w.y > state.site.h) return;
    placeQuadrat(w.x - state.side / 2, w.y - state.side / 2);
  });

  $('zoomCanvas').addEventListener('click', (ev) => {
    if (!state.pending) return;
    state._autoValues = null;
    if (state.mode === 'count') {
      const h = hitTest(state.zoomHits, $('zoomCanvas'), ev);
      if (!h) return;
      if (!h.inside) {
        $('feedback').hidden = false;
        $('feedback').className = 'feedback';
        $('feedback').innerHTML = 'That one\'s centre is <strong>outside</strong> the frame, so it is not part of this sample.';
        return;
      }
      if (state.counted.has(h.key)) {
        state.counted.delete(h.key);
        state.tally[h.spId] = Math.max(0, state.tally[h.spId] - 1);
      } else {
        state.counted.add(h.key);
        state.tally[h.spId] = (state.tally[h.spId] || 0) + 1;
      }
    } else {
      const idx = squareAt(state.zoomFrame, $('zoomCanvas'), ev);
      if (idx == null) return;
      const set = state.squares[state.focus];
      if (set.has(idx)) set.delete(idx); else set.add(idx);
    }
    renderZoom();
    renderTally();
  });

  for (const id of ['modeCount', 'modeCover']) {
    $(id).addEventListener('change', (e) => {
      if (!e.target.checked) return;
      state.mode = e.target.value;
      renderZoom();
      renderTally(state._autoValues);
    });
  }
  $('coverSpecies').addEventListener('change', (e) => {
    state.focus = e.target.value;
    renderZoom();
    renderTally();
  });

  $('recordBtn').addEventListener('click', () => {
    if (state._autoValues) recordSample({ values: state._autoValues });
    else recordSample();
    state._autoValues = null;
  });
  $('checkBtn').addEventListener('click', checkCount);
  $('autoBtn').addEventListener('click', autoFill);

  $('quickBtn').addEventListener('click', () => {
    const before = state.method;
    state.method = 'random';
    quickSurvey(10);
    state.method = before;
    renderAll();
    save();
  });

  $('clearSheetBtn').addEventListener('click', () => {
    state.samples = [];
    state.nextN = 1;
    state.showAccuracy = state.reveal;
    renderAll();
    save();
  });

  $('csvBtn').addEventListener('click', () => {
    if (!state.samples.length) return;
    $('csvText').value = buildCsv();
    $('csvPanel').hidden = false;
    $('csvText').focus();
    $('csvText').select();
  });
  $('csvClose').addEventListener('click', () => { $('csvPanel').hidden = true; });
  $('csvCopy').addEventListener('click', async () => {
    const btn = $('csvCopy');
    try {
      await navigator.clipboard.writeText($('csvText').value);
      btn.textContent = 'Copied';
    } catch {
      $('csvText').select();
      btn.textContent = 'Press Ctrl/Cmd-C';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 2200);
  });

  $('invSpecies').addEventListener('change', () => { state.invCache = null; drawInvestigation(); });
  $('invRun').addEventListener('click', () => {
    const btn = $('invRun');
    btn.disabled = true;
    btn.textContent = 'Running…';
    requestAnimationFrame(() => {
      setTimeout(() => {
        runInvestigation();
        btn.disabled = false;
        btn.textContent = 'Run again';
      }, 20);
    });
  });

  // tabs
  const tabs = [...document.querySelectorAll('.tab')];
  const show = (name) => {
    for (const t of tabs) {
      const on = t.id === 'tab-' + name;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (name === 'investigate') renderInvSpecies();
  };
  for (const t of tabs) t.addEventListener('click', () => show(t.id.replace('tab-', '')));
  for (const b of document.querySelectorAll('[data-goto]')) {
    b.addEventListener('click', () => show(b.dataset.goto));
  }

  // theme changes repaint the canvases
  const repaint = () => { siteMap.baseKey = null; renderAll(); };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint);
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ── boot ────────────────────────────────────────────────────────────────── */

function boot(restored) {
  siteMap = new SiteMap($('siteCanvas'));
  if (restored) {
    Object.assign(state, {
      scenarioId: restored.scenarioId ?? state.scenarioId,
      seedText: restored.seedText ?? state.seedText,
      side: restored.side ?? state.side,
      method: restored.method ?? state.method,
      samples: Array.isArray(restored.samples) ? restored.samples : [],
      nextN: restored.nextN ?? 1,
      reveal: !!restored.reveal,
    });
    state.showAccuracy = state.reveal;
  }
  renderHabitatSelect();
  $('seed').value = state.seedText;
  $('quadratSide').value = String(state.side);
  $('reveal').checked = state.reveal;
  $(`m-${state.method}`).checked = true;

  buildSite({ keepSamples: true });
  setMethod(state.method);
  renderInvSpecies();
  wire();

  // open in a working state: a short worked example, clearly marked
  if (!state.samples.length) quickSurvey(8);
  renderAll();
}

const restored = load();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => boot(restored));
} else {
  boot(restored);
}
