'use client';

import { Download, Table2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
}

function downloadSvg(root: HTMLElement | null, name: string) {
  const svg = root?.querySelector('svg.recharts-surface, svg[data-chart]') as SVGSVGElement | null;
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const { width, height } = svg.getBoundingClientRect();
  clone.setAttribute('width', String(Math.round(width)));
  clone.setAttribute('height', String(Math.round(height)));
  clone.setAttribute('style', 'font-family: Arial, Helvetica, sans-serif; background: #fffcf4');
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'chart'}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Frame for every chart: a title, an accessible table view (so values are
 * never locked inside colour or shape), and an SVG download.
 */
export function ChartFrame({
  title,
  description,
  table,
  children,
  className,
  actions,
}: {
  title: string;
  description?: ReactNode;
  table?: TableView;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <figure className={cn('flex flex-col gap-2', className)} ref={ref}>
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {description && <p className="text-xs text-ink-3">{description}</p>}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((s) => !s)}
              aria-pressed={showTable}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-2 hover:bg-teal-50"
            >
              <Table2 className="size-3.5" aria-hidden />
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
          {!showTable && (
            <button
              type="button"
              onClick={() => downloadSvg(ref.current, title)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-2 hover:bg-teal-50"
              aria-label={`Download ${title} as SVG`}
            >
              <Download className="size-3.5" aria-hidden />
              SVG
            </button>
          )}
        </div>
      </figcaption>
      {showTable && table ? (
        <div className="scrollbar-thin max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-cream-100 text-xs text-ink-3">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((v, j) => (
                    <td key={j} className="num px-3 py-1.5 text-ink-2">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

export const AXIS = { stroke: '#56696f', fontSize: 11, tickLine: false } as const;
export const GRID = '#e6dcc3';
