import { STAR_LAYERS, PALETTE } from '../engine/constants';
import type { BackgroundColor } from '../../../interpreter/core/types';

/* ============================================================================
   VECTOR ZERO — STARFIELD
   Very subtle. Stars live in normalised space so a resize costs nothing.
   ========================================================================== */

export interface Star {
  x: number;
  y: number;
  size: number;
  layer: number;
  brightness: number;
  phase: number;
}

export function createStars(): Star[] {
  const stars: Star[] = [];
  STAR_LAYERS.forEach((layer, layerIndex) => {
    for (let i = 0; i < layer.count; i += 1) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: layer.size,
        layer: layerIndex,
        brightness: layer.brightness * (0.7 + Math.random() * 0.5),
        phase: Math.random() * Math.PI * 2,
      });
    }
  });
  return stars;
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  width: number,
  height: number,
  time: number,
  driftX: number,
  driftY: number,
  reducedMotion: boolean,
): void {
  for (const star of stars) {
    const layer = STAR_LAYERS[star.layer];
    const offsetX = ((driftX * layer.parallax) % 1 + 1) % 1;
    const offsetY = ((driftY * layer.parallax) % 1 + 1) % 1;
    const x = (((star.x + offsetX) % 1) + 1) % 1;
    const y = (((star.y + offsetY) % 1) + 1) % 1;
    const twinkle = reducedMotion ? 1 : 0.82 + 0.18 * Math.sin(time * 1.6 + star.phase);
    const alpha = star.brightness * twinkle;

    ctx.fillStyle = `rgba(223,255,209,${alpha.toFixed(3)})`;
    const size = star.size;
    ctx.fillRect(x * width, y * height, size, size);
  }
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.2,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.75,
  );
  gradient.addColorStop(0, 'rgba(4,18,9,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function fieldTint(health: number, backgroundColor: BackgroundColor = 'green'): string {
  const healthy = { green: PALETTE.space, blue: '#050d20', purple: '#150820' }[backgroundColor];
  if (health > 60) return healthy;
  const danger = 1 - health / 60;
  const base = backgroundColor === 'blue' ? [8, 13, 34] : backgroundColor === 'purple' ? [23, 8, 31] : [20, 8, 16];
  return `rgba(${Math.round(base[0] + 40 * danger)},${Math.round(base[1] + 4 * danger)},${Math.round(base[2] + 4 * danger)},1)`;
}
