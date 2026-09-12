/* ============================================================================
   VECTOR ZERO — TUNING + PALETTE
   Kept in one place so game feel can be tuned without touching logic.
   ========================================================================== */

export const PALETTE = {
  space: '#06140b',
  spaceDeep: '#020b06',
  cream: '#e7ffdb',
  creamDim: 'rgba(224,255,210,0.55)',
  creamFaint: 'rgba(224,255,210,0.16)',
  blue: '#a7e9ab',
  blueBright: '#d5ffd1',
  flare: '#FF4A18',
  flareBright: '#FF8A5E',
  ok: '#35E08F',
};

export const FIELD = {
  /** minimum asteroid radius by size */
  rockRadius: { big: 46, medium: 27, small: 15 } as const,
  rockHp: { big: 3, medium: 2, small: 1 } as const,
  rockScore: { big: 20, medium: 50, small: 100 } as const,
  rockDamage: { big: 40, medium: 28, small: 18 } as const,
  rockBaseSpeed: { big: 30, medium: 42, small: 56 } as const,
  rockSpin: { big: 0.5, medium: 0.9, small: 1.5 } as const,

  /** enemySpeed 1–8 maps to this multiplier */
  speedFactorMin: 0.62,
  speedFactorPerLevel: 0.19,

  shipRadius: 12,
  shipAccel: 250,
  shipMaxSpeed: 340,
  shipTurnSpeed: 3.5,
  dragPerSecond: 0.16,
  brakePerSecond: 3.4,

  bulletSpeed: 560,
  bulletInherit: 0.45,
  bulletLife: 1.15,
  bulletCooldown: 0.21,
  bulletCooldownRapid: 0.085,
  bulletRadius: 3,

  fireShake: 0.9,
  hitShake: 1.6,
  breakShake: 2.2,
  deathShake: 7,
  maxShake: 9,

  maxParticles: 260,
  maxBullets: 60,

  shieldRecharge: 3.4,
  invulnOnRespawn: 2.2,
  respawnDelay: 1.4,
  waveIntermission: 1.35,
  healthRegen: 2.4,
  healthRegenDelay: 3.4,
  maxHealth: 100,
  maxRocks: 20,
} as const;

export const STAR_LAYERS = [
  { count: 34, size: 0.7, parallax: 0.014, brightness: 0.3 },
  { count: 26, size: 1.05, parallax: 0.03, brightness: 0.45 },
  { count: 14, size: 1.5, parallax: 0.055, brightness: 0.62 },
] as const;

/** HUD is drawn in canvas so gameplay never triggers React re-renders. */
export const HUD = {
  font: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  label: 11,
  value: 26,
  small: 12,
  comms: 13,
  pad: 16,
  commsLines: 4,
} as const;
