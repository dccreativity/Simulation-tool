import type { GlyphShape } from '@/types/ecosystem';

/** Add a glyph outline to the current canvas path (caller fills/strokes). */
export function traceGlyph(ctx: CanvasRenderingContext2D, shape: GlyphShape, x: number, y: number, r: number) {
  switch (shape) {
    case 'circle':
    case 'ring':
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case 'diamond':
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r * 1.15, y);
      ctx.lineTo(x, y + r * 1.15);
      ctx.lineTo(x - r * 1.15, y);
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.1, y + r * 0.8);
      ctx.lineTo(x - r * 1.1, y + r * 0.8);
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.25 : r * 0.55;
        const px = x + rr * Math.cos(a);
        const py = y + rr * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case 'cross': {
      const t = r * 0.42;
      ctx.moveTo(x - t, y - r);
      ctx.lineTo(x + t, y - r);
      ctx.lineTo(x + t, y - t);
      ctx.lineTo(x + r, y - t);
      ctx.lineTo(x + r, y + t);
      ctx.lineTo(x + t, y + t);
      ctx.lineTo(x + t, y + r);
      ctx.lineTo(x - t, y + r);
      ctx.lineTo(x - t, y + t);
      ctx.lineTo(x - r, y + t);
      ctx.lineTo(x - r, y - t);
      ctx.lineTo(x - t, y - t);
      ctx.closePath();
      break;
    }
  }
}

/** SVG path data for the same glyphs, centred on (0, 0) with radius r. */
export function glyphPath(shape: GlyphShape, r: number): string {
  const f = (n: number) => n.toFixed(2);
  switch (shape) {
    case 'circle':
    case 'ring':
      return `M${f(r)} 0 A${f(r)} ${f(r)} 0 1 1 ${f(-r)} 0 A${f(r)} ${f(r)} 0 1 1 ${f(r)} 0Z`;
    case 'square':
      return `M${f(-r * 0.85)} ${f(-r * 0.85)}h${f(r * 1.7)}v${f(r * 1.7)}h${f(-r * 1.7)}Z`;
    case 'diamond':
      return `M0 ${f(-r * 1.15)}L${f(r * 1.15)} 0L0 ${f(r * 1.15)}L${f(-r * 1.15)} 0Z`;
    case 'triangle':
      return `M0 ${f(-r * 1.2)}L${f(r * 1.1)} ${f(r * 0.8)}L${f(-r * 1.1)} ${f(r * 0.8)}Z`;
    case 'hexagon':
      return (
        Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          return `${i ? 'L' : 'M'}${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;
        }).join('') + 'Z'
      );
    case 'star':
      return (
        Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const rr = i % 2 === 0 ? r * 1.25 : r * 0.55;
          return `${i ? 'L' : 'M'}${f(rr * Math.cos(a))} ${f(rr * Math.sin(a))}`;
        }).join('') + 'Z'
      );
    case 'cross': {
      const t = r * 0.42;
      return `M${f(-t)} ${f(-r)}H${f(t)}V${f(-t)}H${f(r)}V${f(t)}H${f(t)}V${f(r)}H${f(-t)}V${f(t)}H${f(-r)}V${f(-t)}H${f(-t)}Z`;
    }
  }
}
