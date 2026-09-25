'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { formatNumber } from '@/lib/statistics/format';
import type { HistogramBin } from '@/lib/statistics/descriptive';
import { AXIS, GRID } from './chart-frame';
import { TooltipCard } from './tooltip';

const TEAL = '#14989e';
const MEAN = '#031926';

export interface IndexedValue {
  index: number;
  value: number;
  label?: string;
}

/** Each sample's value against its sample number, with the mean and a ±1 SD band. */
export function SampleIndexChart({
  data,
  mean,
  sd,
  yLabel,
  height = 220,
  color = TEAL,
}: {
  data: IndexedValue[];
  mean?: number;
  sd?: number;
  yLabel: string;
  height?: number;
  color?: string;
}) {
  const hasSd = mean !== undefined && sd !== undefined && Number.isFinite(sd);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 12, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            type="number"
            dataKey="index"
            name="Sample"
            {...AXIS}
            allowDecimals={false}
            domain={[0, 'dataMax + 1']}
            label={{ value: 'Sample number', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#56696f' }}
          />
          <YAxis type="number" dataKey="value" name={yLabel} {...AXIS} width={42} allowDecimals domain={[0, 'auto']} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#56696f', style: { textAnchor: 'middle' } }} />
          {hasSd && <ReferenceArea y1={Math.max(0, mean! - sd!)} y2={mean! + sd!} fill="#77aca2" fillOpacity={0.16} ifOverflow="extendDomain" />}
          {mean !== undefined && Number.isFinite(mean) && (
            <ReferenceLine y={mean} stroke={MEAN} strokeDasharray="5 4" label={{ value: `Mean ${formatNumber(mean)}`, position: 'insideTopRight', fontSize: 11, fill: MEAN }} />
          )}
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TooltipCard
                  title={`Sample ${(payload[0].payload as IndexedValue).label ?? (payload[0].payload as IndexedValue).index}`}
                  rows={[{ label: yLabel, value: formatNumber((payload[0].payload as IndexedValue).value), color }]}
                />
              ) : null
            }
          />
          <Scatter data={data} fill={color} stroke="#fffcf4" strokeWidth={1.5} isAnimationActive shape="circle" legendType="none" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One bar per sample. */
export function SampleBarChart({ data, mean, yLabel, height = 220, color = TEAL }: { data: IndexedValue[]; mean?: number; yLabel: string; height?: number; color?: string }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 18, left: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="index" {...AXIS} label={{ value: 'Sample number', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#56696f' }} />
          <YAxis {...AXIS} width={42} allowDecimals label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#56696f', style: { textAnchor: 'middle' } }} />
          {mean !== undefined && Number.isFinite(mean) && (
            <ReferenceLine y={mean} stroke={MEAN} strokeDasharray="5 4" label={{ value: `Mean ${formatNumber(mean)}`, position: 'insideTopRight', fontSize: 11, fill: MEAN }} />
          )}
          <Tooltip
            cursor={{ fill: '#e3eeeb', opacity: 0.6 }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TooltipCard
                  title={`Sample ${(payload[0].payload as IndexedValue).label ?? (payload[0].payload as IndexedValue).index}`}
                  rows={[{ label: yLabel, value: formatNumber((payload[0].payload as IndexedValue).value), color }]}
                />
              ) : null
            }
          />
          <Bar dataKey="value" name={yLabel} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Histogram of binned values. */
export function HistogramChart({ bins, xLabel, height = 220, color = TEAL }: { bins: HistogramBin[]; xLabel: string; height?: number; color?: string }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 10, right: 12, bottom: 18, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" label={{ value: xLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#56696f' }} />
          <YAxis {...AXIS} width={36} allowDecimals={false} label={{ value: 'Frequency', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#56696f', style: { textAnchor: 'middle' } }} />
          <Tooltip
            cursor={{ fill: '#e3eeeb', opacity: 0.6 }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TooltipCard title={(payload[0].payload as HistogramBin).label} rows={[{ label: 'Frequency', value: (payload[0].payload as HistogramBin).count, color }]} />
              ) : null
            }
          />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ProfileSeries {
  key: string;
  label: string;
  color: string;
  emphasis?: boolean;
}

/** Abundance of each species against distance along a transect. */
export function TransectProfileChart({
  data,
  series,
  yLabel = 'Individuals',
  height = 260,
}: {
  data: Record<string, number>[];
  series: ProfileSeries[];
  yLabel?: string;
  height?: number;
}) {
  const dashes = ['0', '6 3', '2 3', '8 3 2 3', '4 4', '1 3', '10 4'];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="distance" type="number" domain={['dataMin', 'dataMax']} {...AXIS} label={{ value: 'Distance along transect (m)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#56696f' }} />
          <YAxis {...AXIS} width={40} allowDecimals label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#56696f', style: { textAnchor: 'middle' } }} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={`${formatNumber(Number(label))} m`}
                  rows={payload.map((p) => ({ label: String(p.name), value: formatNumber(Number(p.value)), color: String(p.color) }))}
                />
              ) : null
            }
          />
          <Legend verticalAlign="top" height={30} iconType="plainline" wrapperStyle={{ fontSize: 11, color: '#2b4250' }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.emphasis ? 2.5 : 1.75}
              strokeDasharray={s.emphasis ? undefined : dashes[i % dashes.length]}
              dot={{ r: s.emphasis ? 3 : 2, strokeWidth: 0, fill: s.color }}
              activeDot={{ r: 5 }}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Observed next to expected frequencies, per category. */
export function ObservedExpectedChart({ data, height = 260 }: { data: { label: string; observed: number; expected: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 8, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...AXIS} interval={0} />
          <YAxis {...AXIS} width={42} label={{ value: 'Frequency', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#56696f', style: { textAnchor: 'middle' } }} />
          <Tooltip
            cursor={{ fill: '#e3eeeb', opacity: 0.6 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard title={String(label)} rows={payload.map((p) => ({ label: String(p.name), value: formatNumber(Number(p.value)), color: String(p.color) }))} />
              ) : null
            }
          />
          <Legend verticalAlign="top" height={28} iconType="square" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="observed" name="Observed" fill="#14989e" radius={[4, 4, 0, 0]} maxBarSize={48} />
          <Bar dataKey="expected" name="Expected" fill="#87580d" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
