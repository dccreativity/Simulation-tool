/**
 * Categorical species palette (fixed order, never cycled).
 *
 * Muted hues chosen to sit with the navy / teal / sage brand palette, then
 * validated with the data-viz palette checker against the card surface
 * #FFFCF4: every slot inside the OKLCH lightness band with chroma ≥ 0.10,
 * worst adjacent colour-vision-deficiency ΔE 12.9 (target ≥ 8), worst adjacent
 * normal-vision ΔE 20.9 (floor 15), and every slot ≥ 3:1 contrast.
 * Species identity is never colour-alone: each species also has its own glyph.
 */
export const SPECIES_COLORS = [
  '#14989e', // 1 teal
  '#87580d', // 2 ochre
  '#4470a9', // 3 blue
  '#bb6f58', // 4 terracotta
  '#6d457f', // 5 plum
  '#8f8939', // 6 olive
  '#843d58', // 7 rose
  '#58894e', // 8 green
] as const;

export const speciesColor = (slot: number) => SPECIES_COLORS[(Math.max(1, slot) - 1) % SPECIES_COLORS.length];

/** Two-group comparisons (Dataset A / Dataset B) use the first two slots. */
export const GROUP_COLORS = { a: SPECIES_COLORS[0], b: SPECIES_COLORS[1] } as const;

/** Sequential ramp for the true-density heatmap: one hue, light → dark. */
export const DENSITY_RAMP = ['#eef4f2', '#d3e6e2', '#afd1cb', '#85b8b1', '#5f9c99', '#3f7f82', '#27616a', '#12424f'] as const;
