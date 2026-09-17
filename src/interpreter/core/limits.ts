import type { GameConfig, Notice, VarType } from './types';

/* ============================================================================
   MODBOX — SAFE LIMITS + CLAMPING
   A student can write 9999999. The game must never crash; MODBOX interprets
   the intent safely, tells them, and explains the allowed range.
   ========================================================================== */

export interface NumericLimit {
  min: number;
  max: number;
  /** integer values only (counts, lives) */
  integer: boolean;
  /** how the range is described to the student */
  range: string;
  /** short label used in the Mod Library */
  label: string;
  /** unit word for playful messages */
  unit: string;
  /** optional personality for the "too big / too small" case */
  overflow?: string;
}

export const DEFAULT_CONFIG: GameConfig = {
  shipName: "Brian's ship",
  shipType: 'dart',
  backgroundColor: 'green',
  rockShape: 'jagged',
  enemyType: 'small-rock',
  enemyCount: 3,
  enemySpeed: 2,
  weaponType: 'laser',
  laserPower: 1,
  lives: 3,
  shieldEnabled: false,
  rapidFireEnabled: false,
  homingEnabled: false,
  scoreMultiplier: 1,
  worldGravity: 0,
};

export const ENEMY_KINDS = ['small-rock', 'medium-rock', 'big-rock'] as const;
export const WEAPON_KINDS = ['laser', 'spread', 'pulse'] as const;
export const SHIP_TYPES = ['dart', 'scout', 'wing'] as const;
export const BACKGROUND_COLORS = ['green', 'blue', 'purple'] as const;
export const ROCK_SHAPES = ['jagged', 'crystal', 'square'] as const;

export const NUMERIC_LIMITS: Record<
  'enemyCount' | 'enemySpeed' | 'laserPower' | 'lives' | 'scoreMultiplier' | 'worldGravity',
  NumericLimit
> = {
  enemyCount: {
    min: 1,
    max: 20,
    integer: true,
    range: '1–20',
    label: 'asteroids in the field',
    unit: 'asteroids',
    overflow:
      '{v} asteroids would destroy the browser before they destroy your ship. MODBOX capped this at 20.',
  },
  enemySpeed: {
    min: 1,
    max: 8,
    integer: true,
    range: '1–8',
    label: 'rock speed',
    unit: 'speed',
    overflow: 'Speed {v} is faster than light. MODBOX pinned it to 8.',
  },
  laserPower: {
    min: 1,
    max: 10,
    integer: true,
    range: '1–10',
    label: 'weapon power',
    unit: 'power',
    overflow: 'Power {v} would cut the sector in half. MODBOX capped it at 10.',
  },
  lives: {
    min: 1,
    max: 9,
    integer: true,
    range: '1–9',
    label: 'ships in reserve',
    unit: 'lives',
    overflow: '{v} lives is very generous. Even so, MODBOX kept the cap at 9.',
  },
  scoreMultiplier: {
    min: 1,
    max: 10,
    integer: true,
    range: '1–10',
    label: 'score multiplier',
    unit: 'multiplier',
    overflow: 'Multiplier {v} would break the scoreboard. MODBOX capped it at 10.',
  },
  worldGravity: {
    min: 0,
    max: 5,
    integer: true,
    range: '0–5',
    label: 'world gravity',
    unit: 'gravity',
    overflow: 'Gravity {v} would crush the ship. MODBOX capped it at 5.',
  },
};

export const TEXT_LIMITS: Record<'shipName' | 'weaponType', { maxLength: number; label: string }> = {
  shipName: { maxLength: 18, label: 'ship name' },
  weaponType: { maxLength: 12, label: 'weapon' },
};

export interface ClampOutcome<T> {
  value: T;
  notice?: Notice;
}

export function clampNumber(
  key: 'enemyCount' | 'enemySpeed' | 'laserPower' | 'lives' | 'scoreMultiplier' | 'worldGravity',
  raw: number,
): ClampOutcome<number> {
  const limit = NUMERIC_LIMITS[key];
  let value = limit.integer ? Math.round(raw) : raw;
  if (!Number.isFinite(value)) value = limit.min;
  if (value < limit.min) {
    return {
      value: limit.min,
      notice: {
        id: `clamp:${key}:min`,
        tone: 'info',
        message: `${limit.label} cannot go below ${limit.min}. MODBOX set it to ${limit.min}.`,
      },
    };
  }
  if (value > limit.max) {
    const template = limit.overflow ?? '{v} is outside the allowed range. MODBOX capped it at ' + limit.max + '.';
    return {
      value: limit.max,
      notice: {
        id: `clamp:${key}:max`,
        tone: 'playful',
        message: template.replace('{v}', String(value)),
      },
    };
  }
  return { value };
}

export function clampText(
  key: 'shipName' | 'weaponType',
  raw: string,
): ClampOutcome<string> {
  const limit = TEXT_LIMITS[key];
  const trimmed = raw.trim();
  const value = trimmed.length ? trimmed : DEFAULT_CONFIG[key];
  if (value.length > limit.maxLength) {
    const cut = value.slice(0, limit.maxLength);
    return {
      value: cut,
      notice: {
        id: `clamp:${key}:len`,
        tone: 'info',
        message: `That ${limit.label} is longer than the hull can hold. MODBOX shortened it to "${cut}".`,
      },
    };
  }
  return { value };
}

export function clampEnemyType(raw: string): ClampOutcome<GameConfig['enemyType']> {
  const normalised = raw.trim().toLowerCase();
  if ((ENEMY_KINDS as readonly string[]).includes(normalised)) {
    return { value: normalised as GameConfig['enemyType'] };
  }
  return {
    value: 'small-rock',
    notice: {
      id: 'clamp:enemy',
      tone: 'playful',
      message: `"${raw}" is not a rock in this sector. MODBOX spawned small-rock instead. Known rocks: ${ENEMY_KINDS.join(', ')}.`,
    },
  };
}

export function clampWeapon(raw: string): ClampOutcome<string> {
  const normalised = raw.trim().toLowerCase();
  if ((WEAPON_KINDS as readonly string[]).includes(normalised)) {
    return { value: normalised };
  }
  return {
    value: 'laser',
    notice: {
      id: 'clamp:weapon',
      tone: 'playful',
      message: `No "${raw}" in the armoury. MODBOX fitted the default laser instead.`,
    },
  };
}

export function clampChoice<K extends 'shipType' | 'backgroundColor' | 'rockShape'>(
  key: K,
  raw: string,
): ClampOutcome<GameConfig[K]> {
  const choices = {
    shipType: SHIP_TYPES,
    backgroundColor: BACKGROUND_COLORS,
    rockShape: ROCK_SHAPES,
  } as const;
  const labels = { shipType: 'ship type', backgroundColor: 'background color', rockShape: 'rock shape' };
  const normalised = raw.trim().toLowerCase();
  const allowed = choices[key] as readonly string[];
  if (allowed.includes(normalised)) return { value: normalised as GameConfig[K] };
  return {
    value: DEFAULT_CONFIG[key],
    notice: {
      id: `clamp:${key}`,
      tone: 'playful',
      message: `Unknown ${labels[key]} "${raw}". Try: ${allowed.join(', ')}.`,
    },
  };
}

export function defaultValueFor(type: VarType): string | number | boolean {
  if (type === 'string') return '';
  if (type === 'int') return 0;
  return false;
}
