import type { Vec } from './types';

/* ============================================================================
   VECTOR ZERO — small vector helpers (no library, no allocation surprises)
   ========================================================================== */

export const TAU = Math.PI * 2;

export function vec(x = 0, y = 0): Vec {
  return { x, y };
}

export function length(v: Vec): number {
  return Math.hypot(v.x, v.y);
}

export function normalize(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/** deterministic PRNG so a rock looks the same every time it spawns */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** keeps an object inside the playfield by wrapping it to the other side */
export function wrapPosition(pos: Vec, width: number, height: number, margin: number): void {
  const minX = -margin;
  const maxX = width + margin;
  const minY = -margin;
  const maxY = height + margin;
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  if (pos.x < minX) pos.x += spanX;
  else if (pos.x > maxX) pos.x -= spanX;
  if (pos.y < minY) pos.y += spanY;
  else if (pos.y > maxY) pos.y -= spanY;
}

export function circlesOverlap(a: Vec, ar: number, b: Vec, br: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = ar + br;
  return dx * dx + dy * dy <= radius * radius;
}

/** exponential damping that is stable regardless of frame rate */
export function dampen(value: number, perSecond: number, dt: number): number {
  return value * Math.exp(-perSecond * dt);
}

export function angleDifference(a: number, b: number): number {
  let diff = (b - a) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return diff;
}
