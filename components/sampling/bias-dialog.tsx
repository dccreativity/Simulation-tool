'use client';

import { useEffect, useRef } from 'react';
import type { QuadratSample } from '@/types/data';
import type { BiasAssessment } from '@/lib/sampling/bias';
import { renderGround } from '@/lib/simulation/render';
import type { Site } from '@/lib/simulation/site';
import { Dialog } from '@/components/ui/dialog';
import { Callout } from '@/components/ui/callout';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercent } from '@/lib/statistics/format';

function MiniMap({ site, focalIndex, samples, mode, label }: { site: Site; focalIndex: number; samples: QuadratSample[]; mode: 'actual' | 'sample'; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ground = renderGround(site, mode === 'actual' ? 'density' : 'field', focalIndex);
    const W = 400;
    const H = (W * site.height) / site.width;
    c.width = W * 2;
    c.height = H * 2;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.drawImage(ground, 0, 0, W, H);
    if (mode === 'sample') {
      ctx.fillStyle = 'rgba(247,242,228,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
    const s = W / site.width;
    for (const q of samples) {
      const size = Math.max(5, q.size * s);
      ctx.fillStyle = mode === 'sample' ? 'rgba(3,25,38,0.85)' : 'rgba(255,252,244,0.25)';
      ctx.strokeStyle = mode === 'sample' ? '#fffcf4' : '#fffcf4';
      ctx.lineWidth = 1.5;
      ctx.fillRect(q.x * s, q.y * s, size, size);
      ctx.strokeRect(q.x * s, q.y * s, size, size);
    }
  }, [site, focalIndex, samples, mode]);
  return <canvas ref={ref} className="w-full rounded-xl border border-line" style={{ aspectRatio: `${site.width} / ${site.height}` }} role="img" aria-label={label} />;
}

export function BiasDialog({
  open,
  onClose,
  site,
  focalIndex,
  samples,
  bias,
}: {
  open: boolean;
  onClose: () => void;
  site: Site;
  focalIndex: number;
  samples: QuadratSample[];
  bias: BiasAssessment | null;
}) {
  const sp = site.eco.species[focalIndex];
  const truth = bias?.trueDensity ?? 0;
  const est = bias?.estimatedDensity ?? NaN;
  const max = Math.max(truth, Number.isFinite(est) ? est : 0) * 1.15 || 1;
  return (
    <Dialog open={open} onClose={onClose} title="Actual population vs your sample" description={`${sp.name} in the ${site.eco.name.toLowerCase()} site ${site.siteCode}`} size="xl" footer={<Button onClick={onClose}>Back to sampling</Button>}>
      {bias && (
        <div className="flex flex-col gap-5">
          {bias.biased ? (
            <Callout tone="warn" title="⚠ Sampling bias detected">
              {bias.issues
                .filter((i) => i.severity === 'warning')
                .map((i) => (
                  <p key={i.kind}>{i.message}</p>
                ))}
            </Callout>
          ) : (
            <Callout tone={bias.assessed ? 'success' : 'info'}>{bias.summary}</Callout>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Actual population</p>
              <MiniMap site={site} focalIndex={focalIndex} samples={samples} mode="actual" label={`Heat map of the true ${sp.name} density with your sample locations outlined`} />
              <p className="text-xs text-ink-3">Darker = more {sp.name.toLowerCase()} per m². Every individual in the site is counted here.</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Your sample</p>
              <MiniMap site={site} focalIndex={focalIndex} samples={samples} mode="sample" label="Map of your sample locations" />
              <p className="text-xs text-ink-3">{samples.length} quadrats. Are they spread across the whole site, or bunched in one area?</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="flex flex-col gap-3" role="group" aria-label="Density comparison">
              {[
                { label: 'Actual density', value: truth, color: '#031926' },
                { label: 'Your estimate', value: est, color: bias.biased ? '#bb6f58' : '#14989e' },
              ].map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink-2">{b.label}</span>
                    <span className="num font-semibold text-ink">{formatNumber(b.value)} per m²</span>
                  </div>
                  <div className="h-3 rounded-full bg-cream-100">
                    <div className="h-3 rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, (Number.isFinite(b.value) ? b.value : 0) / max) * 100}%`, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-cream-100 px-4 py-3 text-center">
              <p className="text-xs text-ink-3">Difference</p>
              <p className="num text-2xl font-semibold text-ink">{Number.isFinite(bias.relativeError) ? `${bias.relativeError > 0 ? '+' : ''}${formatPercent(bias.relativeError)}` : '—'}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Where your samples fell</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-3">
                <tr>
                  <th scope="col" className="py-1 font-medium">Zone</th>
                  <th scope="col" className="py-1 font-medium">Share of site</th>
                  <th scope="col" className="py-1 font-medium">Share of your samples</th>
                </tr>
              </thead>
              <tbody>
                {bias.zoneCoverage.map((z) => (
                  <tr key={z.id} className="border-t border-line">
                    <td className="py-1.5 text-ink-2">{z.label}</td>
                    <td className="num py-1.5 text-ink-2">{formatPercent(z.areaFraction)}</td>
                    <td className="num py-1.5 font-medium text-ink">
                      {formatPercent(z.sampleFraction)} <span className="text-xs text-ink-3">({z.samples})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-sage-100 px-4 py-3 text-sm leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">Why this matters</p>
            <p className="mt-1">
              A sample is only useful if it represents the whole population. Choosing spots by eye tends to favour places that look interesting — often where
              plants are densest — which pushes the estimate up. Random or stratified placement gives every part of the site a fair chance of being sampled.
            </p>
            <p className="mt-1">
              Even without bias, a small random sample will usually miss the true value a little. That is <em>sampling error</em>, and it shrinks as the number of
              samples grows. Bias does not shrink — more biased samples just give a more confident wrong answer.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
