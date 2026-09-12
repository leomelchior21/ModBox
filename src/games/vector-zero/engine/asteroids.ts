import type { Rock, RockSize, Vec } from './types';
import { FIELD } from './constants';
import { TAU, clamp, mulberry32, rand, vec } from './vector';
import { ENEMY_KINDS } from '../../../interpreter/core/limits';
import type { AsteroidKind } from '../../../interpreter/core/types';

/* ============================================================================
   VECTOR ZERO — PROCEDURAL ROCKS
   Original irregular vector polygons: a seeded set of vertex radius
   multipliers, so every rock has its own silhouette and keeps it.
   ========================================================================== */

const KIND_TO_SIZE: Record<AsteroidKind, RockSize> = {
  'small-rock': 'small',
  'medium-rock': 'medium',
  'big-rock': 'big',
};

export function sizeFromEnemyKind(kind: string): RockSize {
  const normalised = (ENEMY_KINDS as readonly string[]).includes(kind) ? kind : 'small-rock';
  return KIND_TO_SIZE[normalised as AsteroidKind] ?? 'small';
}

export function rockVertexCount(size: RockSize): number {
  return size === 'big' ? 11 : size === 'medium' ? 9 : 7;
}

export function makeRockShape(size: RockSize, seed: number): number[] {
  const random = mulberry32(seed);
  const count = rockVertexCount(size);
  const shape: number[] = [];
  const variance = size === 'big' ? 0.34 : size === 'medium' ? 0.3 : 0.26;
  for (let i = 0; i < count; i += 1) {
    shape.push(1 - variance / 2 + random() * variance);
  }
  return shape;
}

export function rockPoints(rock: Rock, scale = 1): { x: number; y: number }[] {
  const count = rock.shape.length;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const radius = rock.radius * rock.shape[i] * scale;
    points.push({
      x: rock.pos.x + Math.cos(angle + rock.angle) * radius,
      y: rock.pos.y + Math.sin(angle + rock.angle) * radius,
    });
  }
  return points;
}

export interface SpawnOptions {
  id: number;
  size: RockSize;
  pos: Vec;
  speedFactor: number;
  seed?: number;
  /** direction of travel, default random */
  direction?: Vec;
  phaseIn?: number;
}

export function createRock(options: SpawnOptions): Rock {
  const seed = options.seed ?? Math.floor(Math.random() * 100000);
  const radius = FIELD.rockRadius[options.size];
  const baseSpeed = FIELD.rockBaseSpeed[options.size] * options.speedFactor;
  const direction = options.direction
    ? options.direction
    : { x: Math.cos(rand(0, TAU)), y: Math.sin(rand(0, TAU)) };
  const speed = baseSpeed * rand(0.75, 1.25);
  const hp = FIELD.rockHp[options.size];

  return {
    id: options.id,
    size: options.size,
    pos: vec(options.pos.x, options.pos.y),
    vel: vec(direction.x * speed, direction.y * speed),
    radius,
    angle: rand(0, TAU),
    spin: rand(-1, 1) * FIELD.rockSpin[options.size],
    shape: makeRockShape(options.size, seed),
    hp,
    maxHp: hp,
    hitFlash: 0,
    phaseIn: options.phaseIn ?? 1,
    seed,
  };
}

/** big → medium, medium → small, small → gone */
export function childrenOf(size: RockSize): RockSize[] {
  if (size === 'big') return ['medium', 'medium'];
  if (size === 'medium') return ['small', 'small'];
  return [];
}

export function spawnPositionFor(
  shipPos: Vec,
  width: number,
  height: number,
  safeDistance: number,
): Vec {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const pos = vec(rand(0, width), rand(0, height));
    if (Math.hypot(pos.x - shipPos.x, pos.y - shipPos.y) > safeDistance) return pos;
  }
  return vec(rand(0, width), rand(0, height));
}

export function clampEnemyCount(count: number): number {
  return Math.round(clamp(count, 1, FIELD.maxRocks));
}

/**
 * Re-forms an existing rock into another size. Used when `string enemy`
 * changes before launch, so the student sees the field transform instead of
 * waiting for the next wave.
 */
export function retypeRock(rock: Rock, size: RockSize): void {
  const radius = FIELD.rockRadius[size];
  const hp = FIELD.rockHp[size];
  rock.size = size;
  rock.radius = radius;
  rock.hp = hp;
  rock.maxHp = hp;
  rock.seed = Math.floor(Math.random() * 100000);
  rock.shape = makeRockShape(size, rock.seed);
  rock.spin = rand(-1, 1) * FIELD.rockSpin[size];

  const speed = Math.hypot(rock.vel.x, rock.vel.y) || FIELD.rockBaseSpeed[size];
  const scale = FIELD.rockBaseSpeed[size] / speed;
  rock.vel.x *= scale;
  rock.vel.y *= scale;
  rock.phaseIn = 0.35;
  rock.hitFlash = 0.1;
}
