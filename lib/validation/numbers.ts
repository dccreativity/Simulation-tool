/** Parse a student-typed number. Accepts "12", "-3.5", ".5", "1e3", "−2" (unicode minus). */
const NUMBER = /^[+\-−]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

export function parseNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = raw.trim().replace(/−/g, '-');
  if (!s || !NUMBER.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const isNumeric = (raw: string | number | null | undefined) => parseNumber(raw) !== null;
