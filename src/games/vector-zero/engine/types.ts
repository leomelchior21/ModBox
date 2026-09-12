import type { GameConfig, GameRule } from '../../../interpreter/core/types';

/* ============================================================================
   VECTOR ZERO — ENGINE TYPES
   ========================================================================== */

export type Phase = 'launch' | 'playing' | 'paused' | 'respawn' | 'gameover';
export type RockSize = 'small' | 'medium' | 'big';

export interface Vec {
  x: number;
  y: number;
}

export interface Ship {
  pos: Vec;
  vel: Vec;
  angle: number;
  radius: number;
  thrusting: boolean;
  recoil: number;
  invuln: number;
  alive: boolean;
  hitFlash: number;
}

export interface Rock {
  id: number;
  size: RockSize;
  pos: Vec;
  vel: Vec;
  radius: number;
  angle: number;
  spin: number;
  /** per-vertex radius multipliers, seeded per rock */
  shape: number[];
  hp: number;
  maxHp: number;
  hitFlash: number;
  /** 0 → 1 spawn-in fade so rocks can "phase in" when code adds them */
  phaseIn: number;
  seed: number;
}

export interface Bullet {
  id: number;
  pos: Vec;
  vel: Vec;
  life: number;
  power: number;
  pierce: boolean;
  trail: number;
}

export interface Particle {
  kind: 'spark' | 'fragment' | 'flash';
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  angle: number;
  length: number;
  color: string;
  size: number;
}

export interface ScorePop {
  pos: Vec;
  text: string;
  life: number;
  maxLife: number;
  tone: 'score' | 'power' | 'shield';
}

export interface CommsEntry {
  id: string;
  text: string;
  tone: 'in' | 'system';
}

export interface InputState {
  left: boolean;
  right: boolean;
  thrust: boolean;
  fire: boolean;
  brake: boolean;
}

export interface ProgramInput {
  /** live config: defaults + scenario + code (already filtered by unlocks) */
  config: GameConfig;
  rules: GameRule[];
  comms: CommsEntry[];
  /** student-invented variables, so rule conditions can read them */
  constants: Record<string, string | number | boolean>;
  missionLabel: string;
}

export interface RuntimeMetrics {
  maxScore: number;
  minHealth: number;
  kills: number;
  hitsTaken: number;
  deaths: number;
  wavesReached: number;
  playTimeMs: number;
  ruleTraces: string[];
  ruleActivations: number;
}

export interface EngineSnapshot {
  phase: Phase;
  score: number;
  lives: number;
  wave: number;
  health: number;
  best: number;
  config: GameConfig;
  activeRuleTexts: string[];
  metrics: RuntimeMetrics;
}

export interface EngineCallbacks {
  onPhase?: (phase: Phase, snapshot: EngineSnapshot) => void;
  onComms?: (entries: CommsEntry[]) => void;
  onUpdate?: (change: ConfigChange) => void;
  onGameOver?: (score: number, metrics: RuntimeMetrics) => void;
}

export type ConfigChange =
  | 'shipName'
  | 'enemyType'
  | 'enemyCount'
  | 'enemySpeed'
  | 'weapon'
  | 'lives'
  | 'shield'
  | 'rapidFire'
  | 'homing'
  | 'power'
  | 'gravity'
  | 'multiplier'
  | 'rules';
