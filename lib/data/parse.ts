/**
 * Turn pasted text into a dataset.
 *
 * Handles the three shapes students usually have:
 *   values     "12, 15, 8, 17"   or one number per line
 *   groups     two numeric columns (Group A | Group B)
 *   frequency  a text column and a count column (Category | Observed [| Expected])
 * and falls back to a general table for anything else.
 */

import type { Column, Row } from '@/types/data';
import { parseCsv, detectDelimiter } from './csv';
import { uid } from './ids';
import { parseNumber } from '@/lib/validation/numbers';

export type PasteShape = 'values' | 'groups' | 'frequency' | 'table';

export interface InvalidCell {
  row: number;
  column: string;
  value: string;
}

export interface ParsedPaste {
  shape: PasteShape;
  columns: Column[];
  rows: Row[];
  invalid: InvalidCell[];
}

const slug = (s: string, i: number) =>
  `c${i}_${s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24)}`;

function buildValues(tokens: string[], label?: string): ParsedPaste {
  const column: Column = { key: 'value', label: label || 'Value', type: 'number' };
  const invalid: InvalidCell[] = [];
  const rows: Row[] = tokens.map((t, i) => {
    const n = parseNumber(t);
    if (n === null) invalid.push({ row: i, column: column.label, value: t });
    return { id: uid(), values: { value: n ?? t } };
  });
  return { shape: 'values', columns: [column], rows, invalid };
}

export function parsePastedData(text: string): ParsedPaste {
  const trimmed = text.trim();
  if (!trimmed) return { shape: 'values', columns: [{ key: 'value', label: 'Value', type: 'number' }], rows: [], invalid: [] };

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const hasTabs = lines.some((l) => l.includes('\t'));
  const multiColumn =
    lines.length > 1 &&
    (hasTabs || lines.every((l) => /[,;]/.test(l)) || lines.every((l) => l.trim().split(/\s{2,}|\s*\|\s*/).length > 1));

  if (!multiColumn) {
    const tokens = trimmed.split(/[\s,;|]+/).filter(Boolean);
    const firstIsLabel = tokens.length > 1 && parseNumber(tokens[0]) === null && tokens.slice(1).every((t) => parseNumber(t) !== null);
    // A multi-word heading on its own line, e.g. "Leaf length (mm)\n12\n15".
    if (lines.length > 1 && parseNumber(lines[0].trim()) === null && lines.slice(1).every((l) => l.trim().split(/[\s,;]+/).every((t) => parseNumber(t) !== null))) {
      return buildValues(lines.slice(1).join(' ').split(/[\s,;]+/).filter(Boolean), lines[0].trim());
    }
    return firstIsLabel ? buildValues(tokens.slice(1), tokens[0]) : buildValues(tokens);
  }

  // Table: tabs, commas, semicolons, pipes or runs of spaces.
  let matrix: string[][];
  if (lines.every((l) => l.includes('|'))) {
    matrix = lines.map((l) => l.split('|').map((c) => c.trim()).filter((c, i, arr) => !(c === '' && (i === 0 || i === arr.length - 1))));
  } else if (hasTabs || lines.some((l) => /[,;]/.test(l))) {
    matrix = parseCsv(lines.join('\n'), detectDelimiter(lines.join('\n')));
  } else {
    matrix = lines.map((l) => l.trim().split(/\s{2,}/));
  }
  const width = Math.max(...matrix.map((r) => r.length));
  matrix = matrix.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));

  const body0 = matrix.slice(1);
  const numericShare = (col: number, rows: string[][]) => {
    const cells = rows.map((r) => r[col]).filter((c) => c !== '');
    return cells.length ? cells.filter((c) => parseNumber(c) !== null).length / cells.length : 0;
  };
  const header =
    matrix.length > 1 &&
    matrix[0].some((c, i) => c !== '' && parseNumber(c) === null && numericShare(i, body0) >= 0.5) ||
    (matrix.length > 1 && matrix[0].every((c) => c === '' || parseNumber(c) === null));
  const headings = header ? matrix[0] : [];
  const body = header ? matrix.slice(1) : matrix;

  const columns: Column[] = Array.from({ length: width }, (_, i) => {
    const label = headings[i]?.trim() || (width === 2 && !header ? (i === 0 ? 'Group A' : 'Group B') : `Column ${i + 1}`);
    const type = numericShare(i, body) >= 0.8 ? 'number' : 'text';
    return { key: slug(label, i), label, type };
  });

  const invalid: InvalidCell[] = [];
  const rows: Row[] = body.map((r, ri) => {
    const values: Row['values'] = {};
    columns.forEach((col, ci) => {
      const raw = r[ci] ?? '';
      if (col.type === 'number') {
        if (raw === '') values[col.key] = null;
        else {
          const n = parseNumber(raw);
          if (n === null) invalid.push({ row: ri, column: col.label, value: raw });
          values[col.key] = n ?? raw;
        }
      } else values[col.key] = raw === '' ? null : raw;
    });
    return { id: uid(), values };
  });

  let shape: PasteShape = 'table';
  const types = columns.map((c) => c.type);
  if (width === 1 && types[0] === 'number') shape = 'values';
  else if (width === 2 && types[0] === 'number' && types[1] === 'number') shape = 'groups';
  else if ((width === 2 || width === 3) && types[0] === 'text' && types.slice(1).every((t) => t === 'number')) shape = 'frequency';

  if (shape === 'frequency' && !header) {
    columns[0].label = 'Category';
    columns[1].label = 'Observed';
    if (columns[2]) columns[2].label = 'Expected';
  }
  return { shape, columns, rows, invalid };
}
