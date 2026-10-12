/**
 * Optional, synthesised sound — no audio files. Off by default and never
 * needed to understand anything on screen.
 */

let ctx: AudioContext | null = null;
let ambience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A soft two-note chime for "sample recorded". */
export function playChime() {
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = now + i * 0.09;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.045, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

/** Very quiet filtered noise — a breeze through grass. */
export function startAmbience() {
  const a = audio();
  if (!a || ambience) return;
  const seconds = 4;
  const buffer = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // brown noise
    data[i] = last * 3.5;
  }
  const source = a.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  const gain = a.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.05, a.currentTime + 1.5);
  source.connect(filter).connect(gain).connect(a.destination);
  source.start();
  ambience = { source, gain };
}

export function stopAmbience() {
  const a = audio();
  if (!a || !ambience) return;
  const { source, gain } = ambience;
  gain.gain.cancelScheduledValues(a.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, a.currentTime);
  gain.gain.linearRampToValueAtTime(0, a.currentTime + 0.6);
  source.stop(a.currentTime + 0.7);
  ambience = null;
}
