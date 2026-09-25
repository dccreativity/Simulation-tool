/** Minimal RFC 4180 CSV / TSV reading and writing. */

export type Delimiter = ',' | '\t' | ';';

/** Guess the delimiter from the first few lines. */
export function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  const score = (d: string) => {
    const counts = lines.map((l) => l.split(d).length - 1);
    if (!counts.length || counts[0] === 0) return 0;
    const consistent = counts.every((c) => c === counts[0]);
    return counts[0] * (consistent ? 2 : 1);
  };
  const candidates: Delimiter[] = ['\t', ',', ';'];
  let best: Delimiter = ',';
  let bestScore = 0;
  for (const d of candidates) {
    const s = score(d);
    if (s > bestScore) {
      best = d;
      bestScore = s;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

function escapeField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return rows.map((r) => r.map((v) => escapeField(v === null || v === undefined ? '' : String(v))).join(',')).join('\n');
}
