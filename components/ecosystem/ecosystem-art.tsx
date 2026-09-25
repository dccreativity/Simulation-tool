import type { EcosystemDef } from '@/types/ecosystem';
import { useId } from 'react';

/** Small deterministic generator so illustrations are identical on server and client. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 320;
const H = 200;

function Hills({ y, amp, color, seed, opacity = 1 }: { y: number; amp: number; color: string; seed: number; opacity?: number }) {
  const r = seeded(seed);
  const pts: string[] = [`M0 ${H}`, `L0 ${y}`];
  let x = 0;
  while (x < W) {
    const nx = x + 60 + r() * 50;
    const cy = y - amp * (0.4 + r() * 0.6);
    pts.push(`Q${(x + nx) / 2} ${cy} ${Math.min(nx, W + 40)} ${y + (r() - 0.5) * amp * 0.4}`);
    x = nx;
  }
  pts.push(`L${W + 40} ${H}`, 'Z');
  return <path d={pts.join(' ')} fill={color} opacity={opacity} />;
}

function Mountains({ y, color, seed, height = 60 }: { y: number; color: string; seed: number; height?: number }) {
  const r = seeded(seed);
  let d = `M-10 ${H} L-10 ${y}`;
  let x = -10;
  while (x < W + 10) {
    const peak = x + 30 + r() * 40;
    const next = peak + 30 + r() * 40;
    d += ` L${peak} ${y - height * (0.5 + r() * 0.5)} L${next} ${y - height * r() * 0.25}`;
    x = next;
  }
  d += ` L${W + 10} ${H} Z`;
  return <path d={d} fill={color} />;
}

function RoundTree({ x, y, s, crown, trunk }: { x: number; y: number; s: number; crown: string; trunk: string }) {
  return (
    <g>
      <rect x={x - s * 0.08} y={y - s * 0.6} width={s * 0.16} height={s * 0.6} fill={trunk} rx={s * 0.04} />
      <circle cx={x} cy={y - s * 0.95} r={s * 0.55} fill={crown} />
      <circle cx={x - s * 0.18} cy={y - s * 1.1} r={s * 0.28} fill="#fff" opacity={0.08} />
    </g>
  );
}

function Conifer({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return <path d={`M${x} ${y - s * 1.6} L${x + s * 0.45} ${y} L${x - s * 0.45} ${y} Z`} fill={color} />;
}

function Motif({ eco, uid }: { eco: EcosystemDef; uid: string }) {
  const a = eco.art;
  const r = seeded(eco.id.length * 977 + eco.id.charCodeAt(0));
  switch (a.motif) {
    case 'meadow':
      return (
        <g>
          <Hills y={120} amp={34} color={a.far} seed={3} />
          <Hills y={140} amp={26} color={a.mid} seed={8} />
          <path d={`M210 200 C 230 170, 250 160, 300 150 L 320 148 L 320 158 C 290 165, 262 176, 244 200 Z`} fill={a.water} opacity={0.85} />
          <Hills y={165} amp={18} color={a.near} seed={11} />
          {Array.from({ length: 38 }, (_, i) => (
            <circle key={i} cx={r() * W} cy={158 + r() * 40} r={1.2 + r() * 1.6} fill={i % 3 === 0 ? a.accent : '#e7efe9'} opacity={0.9} />
          ))}
          <circle cx={40} cy={150} r={12} fill="#4d7a64" />
          <circle cx={56} cy={154} r={9} fill="#4d7a64" />
        </g>
      );
    case 'forest':
      return (
        <g>
          <Hills y={110} amp={30} color={a.far} seed={5} />
          {Array.from({ length: 11 }, (_, i) => (
            <RoundTree key={i} x={i * 32 + r() * 10} y={150} s={34 + r() * 14} crown={a.mid} trunk="#4b5f55" />
          ))}
          <Hills y={170} amp={10} color={a.near} seed={2} />
          {Array.from({ length: 7 }, (_, i) => (
            <RoundTree key={`n${i}`} x={i * 52 + 10 + r() * 14} y={200} s={46 + r() * 18} crown={a.near} trunk="#23413d" />
          ))}
          <path d="M150 200 C 160 180, 170 172, 178 165 L 186 165 C 182 175, 180 186, 186 200 Z" fill={a.accent} opacity={0.55} />
        </g>
      );
    case 'pond':
      return (
        <g>
          <Hills y={112} amp={26} color={a.far} seed={9} />
          <Hills y={130} amp={16} color={a.mid} seed={4} />
          <ellipse cx={170} cy={165} rx={130} ry={30} fill={a.water} />
          <ellipse cx={150} cy={160} rx={70} ry={8} fill="#fff" opacity={0.12} />
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={110 + r() * 130} cy={162 + r() * 18} rx={7} ry={2.6} fill="#77aca2" />
          ))}
          <path d="M0 200 L0 170 C 40 175, 50 185, 60 200 Z" fill={a.near} />
          <path d="M320 200 L320 168 C 290 176, 280 186, 272 200 Z" fill={a.near} />
          {Array.from({ length: 26 }, (_, i) => {
            const x = i < 13 ? 6 + r() * 60 : 262 + r() * 58;
            const h = 18 + r() * 22;
            return <line key={i} x1={x} y1={200} x2={x + (r() - 0.5) * 6} y2={200 - h} stroke="#3f6b5a" strokeWidth={1.6} strokeLinecap="round" />;
          })}
        </g>
      );
    case 'shore':
      return (
        <g>
          <rect x={0} y={105} width={W} height={95} fill={a.water} />
          <rect x={0} y={105} width={W} height={3} fill="#fff" opacity={0.25} />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${r() * 280} ${120 + i * 9} q 10 -4 20 0 t 20 0`} stroke="#fff" strokeOpacity={0.3} fill="none" strokeWidth={1.2} />
          ))}
          <Mountains y={108} color="#9dbebb" seed={21} height={16} />
          <path d="M0 200 L0 150 L40 140 L70 152 L110 146 L150 160 L200 150 L240 162 L280 150 L320 158 L320 200 Z" fill={a.near} />
          <path d="M0 200 L0 170 L50 162 L90 176 L140 168 L190 182 L250 172 L320 180 L320 200 Z" fill="#5f6259" />
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={i} cx={r() * W} cy={176 + r() * 20} r={1.6} fill={a.accent} opacity={0.8} />
          ))}
        </g>
      );
    case 'dunes':
      return (
        <g>
          <circle cx={250} cy={62} r={22} fill="#f4e9cd" opacity={0.9} />
          <Hills y={128} amp={30} color={a.far} seed={14} />
          <path d="M0 200 L0 150 C 60 128, 110 132, 160 152 C 210 170, 260 150, 320 140 L 320 200 Z" fill={a.mid} />
          <path d="M0 200 L0 180 C 70 165, 140 170, 200 185 C 250 196, 290 182, 320 176 L 320 200 Z" fill={a.near} />
          {[60, 230].map((x, i) => (
            <g key={i} fill="#5d7a60">
              <rect x={x} y={140 + i * 12} width={8} height={40} rx={4} />
              <rect x={x - 9} y={152 + i * 12} width={6} height={16} rx={3} />
              <rect x={x - 9} y={164 + i * 12} width={12} height={5} rx={2.5} />
              <rect x={x + 11} y={146 + i * 12} width={6} height={18} rx={3} />
            </g>
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={r() * W} cy={180 + r() * 18} r={3 + r() * 3} fill="#7f8a64" opacity={0.7} />
          ))}
        </g>
      );
    case 'marsh':
      return (
        <g>
          <Hills y={118} amp={16} color={a.far} seed={31} />
          <rect x={0} y={132} width={W} height={68} fill={a.mid} />
          <path d={`M-10 160 C 60 150, 110 175, 170 165 C 230 155, 270 170, 330 158 L 330 170 C 270 182, 230 166, 170 177 C 110 187, 60 162, -10 172 Z`} fill={a.water} />
          <path d={`M40 200 C 60 190, 90 186, 120 192 L 118 200 Z`} fill={a.water} opacity={0.8} />
          {Array.from({ length: 40 }, (_, i) => {
            const x = r() * W;
            const y = 140 + r() * 60;
            return <line key={i} x1={x} y1={y} x2={x + (r() - 0.5) * 5} y2={y - 8 - r() * 10} stroke={a.near} strokeWidth={1.5} strokeLinecap="round" />;
          })}
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={`c${i}`} cx={r() * W} cy={138 + r() * 55} r={1.8} fill={a.accent} />
          ))}
        </g>
      );
    case 'park':
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={i * 36 + r() * 8} y={70 + r() * 30} width={20 + r() * 10} height={80} fill="#c7d3cf" opacity={0.7} />
          ))}
          <rect x={0} y={128} width={W} height={72} fill={a.mid} />
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={`s${i}`} x={i * 44} y={128} width={22} height={72} fill="#fff" opacity={0.05} />
          ))}
          <path d="M-10 200 C 80 170, 170 160, 330 140 L 330 150 C 180 170, 100 182, 30 200 Z" fill={a.accent} opacity={0.9} />
          <RoundTree x={60} y={150} s={44} crown={a.near} trunk="#3f5550" />
          <RoundTree x={250} y={140} s={40} crown={a.near} trunk="#3f5550" />
          <RoundTree x={290} y={176} s={48} crown="#4c7a62" trunk="#3f5550" />
          <rect x={150} y={150} width={24} height={4} rx={1} fill="#6b5a45" />
          <rect x={152} y={154} width={2} height={6} fill="#6b5a45" />
          <rect x={170} y={154} width={2} height={6} fill="#6b5a45" />
          {Array.from({ length: 20 }, (_, i) => (
            <circle key={`d${i}`} cx={r() * W} cy={165 + r() * 30} r={1.4} fill="#fff" opacity={0.85} />
          ))}
        </g>
      );
    case 'jungle':
      return (
        <g>
          <Hills y={100} amp={28} color={a.far} seed={41} />
          {Array.from({ length: 9 }, (_, i) => (
            <RoundTree key={i} x={i * 40 + r() * 10} y={140} s={48 + r() * 16} crown={a.mid} trunk="#2d4a40" />
          ))}
          <rect x={0} y={130} width={W} height={24} fill="#fff" opacity={0.07} />
          {Array.from({ length: 6 }, (_, i) => {
            const x = 20 + i * 56 + r() * 16;
            return (
              <g key={`p${i}`} stroke={a.near} strokeWidth={5} strokeLinecap="round" fill="none">
                <path d={`M${x} 200 L${x + 4} 150`} stroke="#3a5a4a" strokeWidth={3} />
                <path d={`M${x + 4} 150 q -18 -6 -30 8`} />
                <path d={`M${x + 4} 150 q 18 -6 30 8`} />
                <path d={`M${x + 4} 150 q -8 -16 -22 -16`} />
                <path d={`M${x + 4} 150 q 8 -16 22 -16`} />
              </g>
            );
          })}
          <path d="M0 200 L0 178 C 60 170, 120 186, 180 178 C 240 170, 280 182, 320 176 L320 200 Z" fill={a.near} />
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={`f${i}`} cx={r() * W} cy={182 + r() * 16} r={2} fill={i % 2 ? '#c86b5a' : a.accent} opacity={0.85} />
          ))}
        </g>
      );
  }
  return <g id={uid} />;
}

export function EcosystemArt({ eco, className }: { eco: EcosystemDef; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={`Illustration of a ${eco.name.toLowerCase()} ecosystem`}>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={eco.art.sky} />
          <stop offset="1" stopColor="#f7f2e4" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${id})`} />
      <Motif eco={eco} uid={id} />
    </svg>
  );
}

/** The landing-page landscape: mountains, forest and a lake in the brand palette. */
export function HeroArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const r = seeded(2024);
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`hs-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dce8e4" />
          <stop offset="0.6" stopColor="#f1ecdc" />
          <stop offset="1" stopColor="#f4e9cd" />
        </linearGradient>
        <linearGradient id={`hl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#77aca2" />
          <stop offset="1" stopColor="#468189" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#hs-${id})`} />
      <circle cx="486" cy="92" r="30" fill="#f4e9cd" />
      <path d="M-10 230 L60 150 L110 190 L180 96 L250 176 L300 140 L360 200 L430 110 L500 180 L560 130 L650 210 L650 360 L-10 360 Z" fill="#9dbebb" />
      <path d="M180 96 L205 128 L192 124 L180 136 L170 122 L160 124 Z M430 110 L452 138 L440 134 L430 146 L420 132 L410 136 Z" fill="#f4e9cd" opacity="0.8" />
      <path d="M-10 250 C 80 214, 150 236, 230 222 C 320 206, 400 232, 480 214 C 560 198, 610 222, 650 214 L650 360 L-10 360 Z" fill="#77aca2" />
      {Array.from({ length: 34 }, (_, i) => {
        const x = i * 20 + r() * 8 - 10;
        const s = 26 + r() * 20;
        return <Conifer key={i} x={x} y={262 + r() * 8} s={s} color={i % 3 ? '#2f5f5a' : '#3f7466'} />;
      })}
      <path d="M-10 272 C 120 262, 240 280, 360 270 C 480 262, 560 276, 650 268 L650 360 L-10 360 Z" fill={`url(#hl-${id})`} />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={40 + i * 64 + r() * 20} y={290 + r() * 40} width={30 + r() * 30} height={1.6} rx={0.8} fill="#fff" opacity={0.35} />
      ))}
      <path d="M-10 330 C 80 318, 150 326, 220 340 L 220 360 L -10 360 Z" fill="#1f4a45" />
      <path d="M420 360 C 480 330, 560 322, 650 326 L 650 360 Z" fill="#1f4a45" />
    </svg>
  );
}
