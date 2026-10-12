import type { SpeciesDef } from '@/types/ecosystem';
import { glyphPath } from '@/lib/simulation/glyphs';
import { speciesColor } from '@/lib/simulation/palette';

/** A species' map glyph as a small inline SVG — used in legends, tables and charts. */
export function SpeciesGlyph({ species, size = 14 }: { species: Pick<SpeciesDef, 'glyph' | 'slot'>; size?: number }) {
  const r = size * 0.36;
  const ring = species.glyph === 'ring';
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden className="shrink-0">
      <path
        d={glyphPath(species.glyph, r)}
        fill={ring ? 'none' : speciesColor(species.slot)}
        stroke={ring ? speciesColor(species.slot) : '#fffcf4'}
        strokeWidth={ring ? 2 : 1}
      />
    </svg>
  );
}
