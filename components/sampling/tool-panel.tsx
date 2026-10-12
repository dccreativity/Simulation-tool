'use client';

import { Dices, Grid3x3, Layers, Play, RectangleHorizontal, RotateCcw, Route, Spline, Square, Wand2 } from 'lucide-react';
import { useId } from 'react';
import type { EcosystemDef, Point } from '@/types/ecosystem';
import type { PlannedQuadrat, SimulationSettings } from '@/types/data';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Stepper } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { QUADRAT_SIZES } from '@/lib/sampling/sampling';

const TOOLS = [
  { id: 'quadrat', label: 'Quadrat', icon: Square },
  { id: 'line-transect', label: 'Line Transect', icon: Spline },
  { id: 'belt-transect', label: 'Belt Transect', icon: RectangleHorizontal },
] as const;

const STRATEGY_HELP = {
  random: 'Every position in the site has an equal chance of being chosen — like reading coordinates from a random number table.',
  systematic: 'Quadrats are spread on an even grid. Good coverage, but can miss patterns that repeat at the grid spacing.',
  stratified: 'The site is split into habitat zones and each zone gets samples in proportion to its area.',
} as const;

export function ToolPanel({
  eco,
  settings,
  onSettings,
  planned,
  draft,
  onGenerate,
  onCollectAll,
  onClearPlanned,
  onSuggested,
  onRunTransect,
  onClearDraft,
  onSetLength,
  collecting,
}: {
  eco: EcosystemDef;
  settings: SimulationSettings;
  onSettings: (s: Partial<SimulationSettings>) => void;
  planned: PlannedQuadrat[];
  draft: { start: Point | null; end: Point | null };
  onGenerate: () => void;
  onCollectAll: () => void;
  onClearPlanned: () => void;
  onSuggested: () => void;
  onRunTransect: () => void;
  onClearDraft: () => void;
  onSetLength: (m: number) => void;
  collecting: boolean;
}) {
  const id = useId();
  const tool = settings.tool;
  const length = draft.start && draft.end ? Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) : null;

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Sampling tool" className="grid grid-cols-3 gap-2">
        {TOOLS.map((t) => {
          const available = eco.methods.includes(t.id);
          const on = tool === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!available}
              title={available ? t.label : `${t.label} is not used in this ecosystem`}
              onClick={() => onSettings({ tool: t.id })}
              className={cn(
                'flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-center text-[0.78rem] font-medium transition-all',
                on ? 'border-navy bg-navy text-cream shadow-card' : 'border-line bg-paper text-ink-2 hover:border-teal/60 hover:text-ink',
                !available && 'cursor-not-allowed opacity-40 hover:border-line',
              )}
            >
              <Icon className={cn('size-6', on ? 'text-cream' : 'text-teal-700')} strokeWidth={1.6} aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {tool === 'quadrat' ? (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink">Sample settings</h3>
          <Field label="Quadrat size" htmlFor={`${id}-size`}>
            <Select id={`${id}-size`} value={settings.quadratSize} onChange={(e) => onSettings({ quadratSize: Number(e.target.value) })}>
              {QUADRAT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} m × {s} m ({(s * s).toString()} m²)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Number of samples" htmlFor={`${id}-n`}>
            <Stepper id={`${id}-n`} label="number of samples" value={settings.sampleCount} min={1} max={60} onChange={(v) => onSettings({ sampleCount: v })} />
          </Field>
          <Field label="Sampling method" htmlFor={`${id}-strategy`} hint={STRATEGY_HELP[settings.strategy]}>
            <Select id={`${id}-strategy`} value={settings.strategy} onChange={(e) => onSettings({ strategy: e.target.value as SimulationSettings['strategy'] })}>
              <option value="random">Random</option>
              <option value="systematic">Systematic (grid)</option>
              <option value="stratified">Stratified (by zone)</option>
            </Select>
          </Field>
          <Button
            onClick={onGenerate}
            icon={settings.strategy === 'random' ? <Dices className="size-4" aria-hidden /> : settings.strategy === 'systematic' ? <Grid3x3 className="size-4" aria-hidden /> : <Layers className="size-4" aria-hidden />}
            disabled={collecting}
          >
            Generate locations
          </Button>
          {planned.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-teal-100 bg-teal-50 p-3">
              <p className="text-sm text-ink-2">
                <span className="font-semibold text-ink">{planned.length}</span> locations planned. Visit each one on the map, or collect them all.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={onCollectAll} loading={collecting} icon={<Play className="size-3.5" aria-hidden />}>
                  {collecting ? 'Collecting…' : 'Collect all'}
                </Button>
                <Button size="sm" variant="ghost" onClick={onClearPlanned} disabled={collecting}>
                  Clear plan
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs leading-relaxed text-ink-3">Or click anywhere on the map to place a quadrat yourself — then see whether your choices bias the estimate.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink">{tool === 'line-transect' ? 'Line transect' : 'Belt transect'} settings</h3>
          <ol className="flex flex-col gap-1.5 text-sm text-ink-2">
            <li className={cn('flex items-center gap-2', draft.start && 'text-ink-3 line-through')}>
              <span className="flex size-5 items-center justify-center rounded-full bg-[#14989e] text-[0.65rem] font-bold text-white">1</span>
              Click the map to set the start
            </li>
            <li className={cn('flex items-center gap-2', draft.end && 'text-ink-3 line-through')}>
              <span className="flex size-5 items-center justify-center rounded-full bg-[#bb6f58] text-[0.65rem] font-bold text-white">2</span>
              Click again to set the end
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[0.65rem] font-bold text-cream">3</span>
              Run the transect
            </li>
          </ol>
          <Button variant="subtle" size="sm" onClick={onSuggested} icon={<Wand2 className="size-4" aria-hidden />}>
            Use the mission’s suggested line
          </Button>
          <Field label="Length (m)" htmlFor={`${id}-len`} hint={length === null ? 'Set a start and end point first.' : 'Change the length to move the end point along the same line.'}>
            <Input
              id={`${id}-len`}
              type="number"
              min={1}
              max={47}
              step={0.5}
              disabled={length === null}
              value={length === null ? '' : Number(length.toFixed(1))}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) onSetLength(v);
              }}
            />
          </Field>
          {tool === 'belt-transect' && (
            <Field label="Belt width" htmlFor={`${id}-w`}>
              <Select id={`${id}-w`} value={settings.beltWidth} onChange={(e) => onSettings({ beltWidth: Number(e.target.value) })}>
                {[0.5, 1, 2].map((w) => (
                  <option key={w} value={w}>
                    {w} m
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label={tool === 'line-transect' ? 'Recording interval' : 'Section length (interval)'}
            htmlFor={`${id}-int`}
            hint={tool === 'line-transect' ? 'Organisms touching the tape are grouped into sections of this length.' : 'The belt is divided into sections this long; each is counted separately.'}
          >
            <Select
              id={`${id}-int`}
              value={tool === 'line-transect' ? settings.lineInterval : settings.beltInterval}
              onChange={(e) => onSettings(tool === 'line-transect' ? { lineInterval: Number(e.target.value) } : { beltInterval: Number(e.target.value) })}
            >
              {[0.5, 1, 2].map((w) => (
                <option key={w} value={w}>
                  every {w} m
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button onClick={onRunTransect} disabled={!draft.start || !draft.end} icon={<Route className="size-4" aria-hidden />} className="flex-1">
              Run transect
            </Button>
            <Button variant="ghost" onClick={onClearDraft} disabled={!draft.start} aria-label="Clear the tape" icon={<RotateCcw className="size-4" aria-hidden />} />
          </div>
        </div>
      )}
    </div>
  );
}
