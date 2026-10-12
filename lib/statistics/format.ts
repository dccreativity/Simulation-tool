/** Number formatting shared by stat cards, tables and reports. */

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '−∞';
  const fixed = value.toFixed(decimals);
  // Trim trailing zeros but keep at least one decimal when decimals > 0.
  const trimmed = decimals > 0 ? fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') : fixed;
  return trimmed.replace('-', '−');
}

/** Choose sensible precision from the magnitude of the data. */
export function autoDecimals(values: readonly number[]): number {
  const maxDecimals = values.reduce((m, v) => {
    if (!Number.isFinite(v)) return m;
    const s = String(v);
    const i = s.indexOf('.');
    return Math.max(m, i === -1 ? 0 : s.length - i - 1);
  }, 0);
  return Math.min(4, maxDecimals + 1);
}

/** p-values: three decimal places, "< 0.001" below that. */
export function formatP(p: number): string {
  if (Number.isNaN(p)) return '—';
  if (p < 0.001) return '< 0.001';
  if (p > 0.999) return '> 0.999';
  return p.toFixed(3);
}

/** "p = 0.013" or "p < 0.001" */
export function pStatement(p: number): string {
  const f = formatP(p);
  return f.startsWith('<') || f.startsWith('>') ? `p ${f}` : `p = ${f}`;
}

export function formatDf(df: number): string {
  return Number.isInteger(df) ? String(df) : df.toFixed(2);
}

export function formatPercent(fraction: number, decimals = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(decimals)}%`;
}
