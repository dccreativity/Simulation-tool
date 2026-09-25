import type { NotebookEntry } from '@/types/notebook';
import { formatNumber, formatP } from '@/lib/statistics/format';

const v = (x: unknown) => (x === null || x === undefined ? '' : String(x));

/** A plain Markdown report of a notebook entry, for sharing or pasting into a lab book. */
export function entryToMarkdown(e: NotebookEntry): string {
  const lines: string[] = [];
  lines.push(`# ${e.title}`, '');
  lines.push(`*${e.ecosystemName ? `${e.ecosystemName} simulation` : 'My data'} · ${new Date(e.createdAt).toLocaleDateString()}${e.siteCode ? ` · site ${e.siteCode}` : ''}*`, '');
  if (e.researchQuestion) lines.push('## Research question', '', e.researchQuestion, '');
  if (e.hypothesis) lines.push('## Hypothesis', '', e.hypothesis, '');
  if (e.samplingMethod) lines.push('## Method', '', e.samplingMethod + (e.sampleSize ? ` (sample size ${e.sampleSize})` : ''), '');
  if (e.descriptive.length) {
    lines.push('## Descriptive statistics', '', '| Data | n | Mean | Median | Mode | Range | SD |', '|---|---|---|---|---|---|---|');
    for (const d of e.descriptive) {
      lines.push(`| ${d.label} | ${d.n} | ${formatNumber(d.mean)} | ${formatNumber(d.median)} | ${d.modes.length ? d.modes.join(', ') : 'none'} | ${formatNumber(d.range)} | ${formatNumber(d.sd)} |`);
    }
    lines.push('');
  }
  if (e.tests.length) {
    lines.push('## Statistical tests', '');
    for (const t of e.tests) {
      lines.push(`### ${t.title}`, '');
      const r = t.result;
      if (typeof r.p === 'number') lines.push(`p ${formatP(r.p).startsWith('<') ? formatP(r.p) : `= ${formatP(r.p)}`}`);
      lines.push('', t.headline, '', t.detail, '');
    }
  }
  if (e.conclusion) lines.push('## Conclusion', '', e.conclusion, '');
  if (e.limitations) lines.push('## Limitations', '', e.limitations, '');
  for (const d of e.datasets) {
    lines.push(`## Data: ${d.name}`, '', `| ${d.columns.map((c) => c.label).join(' | ')} |`, `|${d.columns.map(() => '---').join('|')}|`);
    for (const r of d.rows) lines.push(`| ${d.columns.map((c) => v(r.values[c.key])).join(' | ')} |`);
    lines.push('');
  }
  lines.push('---', 'Recorded with Eco Field Lab — Real Data. Real Decisions. Healthier Planets.');
  return lines.join('\n');
}
