import type { Dataset } from '@/types/data';
import { newDataset } from './datasets';
import { parsePastedData, type ParsedPaste } from './parse';

/** Build a dataset from pasted or uploaded text. */
export function datasetFromParsed(name: string, parsed: ParsedPaste, source: Dataset['source'] = 'user'): Dataset {
  const valueColumn =
    parsed.shape === 'frequency'
      ? parsed.columns[1]?.key
      : parsed.columns.find((c) => c.type === 'number')?.key;
  const groupColumn = parsed.shape === 'table' ? parsed.columns.find((c) => c.type === 'text')?.key : undefined;
  const d = newDataset({
    name: name.trim() || 'My data',
    kind: parsed.shape === 'frequency' ? 'frequency' : 'custom',
    source,
    columns: parsed.columns,
    valueColumn,
    groupColumn,
  });
  d.rows = parsed.rows;
  return d;
}

export function datasetFromText(name: string, text: string): { dataset: Dataset; parsed: ParsedPaste } {
  const parsed = parsePastedData(text);
  return { dataset: datasetFromParsed(name, parsed), parsed };
}

/** Read a user-chosen file as text (CSV, TSV or plain text). */
export async function readTextFile(file: File, maxBytes = 2_000_000): Promise<string> {
  if (file.size > maxBytes) throw new Error('This file is larger than 2 MB. Try a smaller CSV.');
  return file.text();
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
