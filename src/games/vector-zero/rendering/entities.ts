import { PALETTE } from '../engine/constants';
import type { Bullet, Particle, Rock, ScorePop, Ship } from '../engine/types';
import { rockPoints } from '../engine/asteroids';
import { TAU } from '../engine/vector';

/* ============================================================================
   VECTOR ZERO — ENTITY DRAWING
   All geometry is generated here: original vector art, no sprite assets.
   ========================================================================== */

export function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  options: {
    shield: boolean;
    shieldRatio: number;
    power: number;
    time: number;
    thrusting: boolean;
    reducedMotion: boolean;
  },
): void {
  const { pos, angle, radius } = ship;
  const alpha = ship.invuln > 0 && !options.reducedMotion
    ? 0.45 + 0.45 * Math.abs(Math.sin(ship.invuln * 12))
    : 1;

  ctx.save();
  ctx.translate(pos.x - Math.cos(angle) * ship.recoil, pos.y - Math.sin(angle) * ship.recoil);
  ctx.rotate(angle);

  // engine trail
  if (options.thrusting) {
    const flicker = 0.55 + Math.random() * 0.45;
    const trail = radius * (2.1 * flicker);
    const gradient = ctx.createLinearGradient(-radius, 0, -trail, 0);
    gradient.addColorStop(0, 'rgba(122,166,255,0.85)');
    gradient.addColorStop(1, 'rgba(44,92,255,0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 1.1, -radius * 0.34);
    ctx.lineTo(-trail, 0);
    ctx.lineTo(-radius * 1.1, radius * 0.34);
    ctx.stroke();
  }

  // hull
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ship.hitFlash > 0 ? PALETTE.flareBright : PALETTE.cream;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(radius * 1.35, 0);
  ctx.lineTo(-radius * 0.85, -radius * 0.95);
  ctx.lineTo(-radius * 0.45, 0);
  ctx.lineTo(-radius * 0.85, radius * 0.95);
  ctx.closePath();
  ctx.stroke();

  // cockpit accent — the weapon colour tells the student their power level
  ctx.strokeStyle = options.power >= 5 ? PALETTE.flare : PALETTE.blueBright;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(radius * 0.5, 0);
  ctx.lineTo(-radius * 0.2, -radius * 0.3);
  ctx.moveTo(radius * 0.5, 0);
  ctx.lineTo(-radius * 0.2, radius * 0.3);
  ctx.stroke();

  // shield
  if (options.shield && options.shieldRatio > 0.01) {
    const ratio = options.shieldRatio;
    ctx.save();
    ctx.rotate(-angle);
    ctx.strokeStyle = ratio >= 1 ? PALETTE.blueBright : 'rgba(122,166,255,0.75)';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.35 + 0.55 * ratio;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2.1, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
    ctx.stroke();
    ctx.globalAlpha = 0.16 * ratio;
    ctx.fillStyle = PALETTE.blue;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export function drawRock(
  ctx: CanvasRenderingContext2D,
  rock: Rock,
  highlight: boolean,
): void {
  const points = rockPoints(rock, rock.phaseIn < 1 ? 0.6 + 0.4 * rock.phaseIn : 1);
  const flashing = rock.hitFlash > 0;

  ctx.save();
  ctx.globalAlpha = rock.phaseIn < 1 ? Math.max(0.15, rock.phaseIn) : 1;
  ctx.lineJoin = 'round';
  ctx.lineWidth = rock.size === 'big' ? 2.2 : rock.size === 'medium' ? 1.8 : 1.4;
  ctx.strokeStyle = flashing ? '#FFFFFF' : highlight ? PALETTE.blueBright : PALETTE.cream;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();

  // danger accent on the heaviest rocks
  if (rock.size === 'big' && !flashing) {
    ctx.globalAlpha *= 0.4;
    ctx.strokeStyle = PALETTE.flare;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (flashing) {
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }

  ctx.restore();
}

export function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet): void {
  const speed = Math.hypot(bullet.vel.x, bullet.vel.y) || 1;
  const tailLength = bullet.pierce ? 16 : 10;
  const dx = (bullet.vel.x / speed) * tailLength;
  const dy = (bullet.vel.y / speed) * tailLength;
  const flare = bullet.pierce;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = flare ? PALETTE.flareBright : PALETTE.blueBright;
  ctx.lineWidth = flare ? 2.6 : 1.8;
  ctx.beginPath();
  ctx.moveTo(bullet.pos.x - dx, bullet.pos.y - dy);
  ctx.lineTo(bullet.pos.x, bullet.pos.y);
  ctx.stroke();

  ctx.fillStyle = flare ? PALETTE.cream : '#FFFFFF';
  ctx.beginPath();
  ctx.arc(bullet.pos.x, bullet.pos.y, flare ? 2.6 : 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
  const alpha = Math.max(0, particle.life / particle.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = particle.color;
  ctx.lineWidth = particle.kind === 'fragment' ? 1.6 : 1.1;
  ctx.lineCap = 'round';

  if (particle.kind === 'flash') {
    ctx.beginPath();
    ctx.arc(particle.pos.x, particle.pos.y, particle.size * (1.4 - alpha), 0, TAU);
    ctx.stroke();
  } else {
    const dx = Math.cos(particle.angle) * particle.length;
    const dy = Math.sin(particle.angle) * particle.length;
    ctx.beginPath();
    ctx.moveTo(particle.pos.x, particle.pos.y);
    ctx.lineTo(particle.pos.x - dx, particle.pos.y - dy);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawScorePop(ctx: CanvasRenderingContext2D, pop: ScorePop): void {
  const progress = 1 - pop.life / pop.maxLife;
  const alpha = Math.max(0, 1 - progress * 1.1);
  const rise = progress * 20;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '600 14px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle =
    pop.tone === 'shield' ? PALETTE.blueBright : pop.tone === 'power' ? PALETTE.flareBright : PALETTE.cream;
  ctx.fillText(pop.text, pop.pos.x, pop.pos.y - rise);
  ctx.restore();
}
