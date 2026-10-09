import type { ProgramResult } from '../../interpreter/core/types';
import { evaluateGameScript } from '../../interpreter/gameScript';
import { evalExpr } from '../../interpreter/core/evaluate';
import { renderText } from '../../interpreter/csharp/binder';
import { FLOOR_DEFAULTS, FLOOR_MODS, floorSchema, type FloorConfig } from './mods';
import type { FloorCue } from './effects';

export interface FloorInput { left: boolean; right: boolean; jump: boolean }
export interface Platform { id: number; x: number; y: number; width: number; checkpoint: boolean; spike: boolean }
export interface Crystal { id: number; x: number; y: number }
export interface Cavern { platforms: Platform[]; crystals: Crystal[]; width: number; exit: { x: number; y: number } }
export type FloorPhase = 'launch' | 'playing' | 'paused' | 'cleared' | 'gameover';
export type FloorEvent = 'jump' | 'crystal' | 'hit' | 'shield' | 'checkpoint' | 'clear' | 'land' | 'crumble';
export interface FloorMetrics { jumps: number; doubleJumps: number; crystals: number; exits: number; hits: number; minLives: number; ruleTraces: string[] }
export interface FloorSnapshot {
  phase: FloorPhase; config: FloorConfig; score: number; lives: number; level: number;
  gems: number; checkpoint: number; shieldReady: boolean; floorRemaining: number | null;
  routeProgress: number; airJumpReady: boolean; shieldCooldown: number;
  metrics: FloorMetrics; messages: string[];
}
export const LAVA_Y = 490;
export const HERO_WIDTH = 22, HERO_HEIGHT = 30;
const metrics = (): FloorMetrics => ({ jumps: 0, doubleJumps: 0, crystals: 0, exits: 0, hits: 0, minLives: 3, ruleTraces: [] });

/** Every default jump can clear a gap and the next platform's height change. */
export function generateCavern(level = 1): Cavern {
  const platforms: Platform[] = [{ id: 0, x: 0, y: 430, width: 330, checkpoint: true, spike: false }];
  let x = 410;
  for (let id = 1; id <= 14; id++) {
    const y = [410, 390, 420, 400][(id + level - 2) % 4];
    platforms.push({ id, x, y, width: id === 14 ? 260 : 170, checkpoint: id % 4 === 0, spike: id % 4 === 3 });
    x += 250;
  }
  const last = platforms.at(-1)!;
  return { platforms, crystals: platforms.slice(1).map(p => ({ id: p.id, x: p.x + p.width * 0.65, y: p.y - 55 })),
    width: last.x + last.width + 80, exit: { x: last.x + last.width - 50, y: last.y } };
}

/** Fixed substeps keep landing, hazard and lava collisions consistent at any frame rate. */
export class DevilFloorRun {
  phase: FloorPhase = 'launch';
  config: FloorConfig = { ...FLOOR_DEFAULTS };
  cavern = generateCavern();
  player = { x: 70, y: 430 - HERO_HEIGHT, vx: 0, vy: 0 };
  grounded: number | null = 0;
  facing = 1;
  elapsed = 0;
  score = 0;
  lives = 3;
  level = 1;
  checkpoint = 0;
  invulnerable = 0;
  shieldCooldown = 0;
  collected = new Set<number>();
  platformHeat = new Map<number, number>();
  collapsed = new Set<number>();
  metrics = metrics();
  messages = ['THE FLOOR IS ALIVE · Keep moving. Reach the exit beacon.'];
  events: FloorEvent[] = [];
  feedback: FloorCue[] = [];
  visualRevision = 0;
  private program: ProgramResult<FloorConfig> | null = null;
  private base = { ...FLOOR_DEFAULTS };
  private activeRules = new Set<string>();
  private jumpHeld = false;
  private jumpBuffer = 0;
  private coyote = 0.1;
  private airJumpUsed = false;
  setProgram(program: ProgramResult<FloorConfig>): void {
    if (!program.ok) return;
    this.program = program; this.base = { ...FLOOR_DEFAULTS, ...program.config }; this.evaluate();
    this.messages = [...program.comms.map(line => line.text), ...this.messages].filter((line, i, all) => all.indexOf(line) === i).slice(0, 4);
  }
  launch(): void { this.restart(); }
  restart(): void {
    this.score = 0; this.lives = 3; this.level = 1; this.metrics = metrics(); this.events = []; this.feedback = [];
    this.activeRules.clear(); this.config = { ...this.base }; this.resetStage(); this.phase = 'playing'; this.evaluate();
  }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; this.releaseInput(); }
  resume(): void { if (this.phase === 'paused') this.phase = 'playing'; }
  releaseInput(): void { this.jumpHeld = false; this.jumpBuffer = 0; }
  advance(): void {
    if (this.phase !== 'cleared') return;
    this.level++; this.resetStage(); this.phase = 'playing'; this.evaluate();
    this.log(`CAVERN ${this.level} · A new route through the fire.`);
  }
  snapshot(): FloorSnapshot {
    return { phase: this.phase, config: { ...this.config }, score: this.score, lives: this.lives, level: this.level,
      gems: this.collected.size, checkpoint: this.checkpoint, shieldReady: this.config.shield && this.shieldCooldown <= 0,
      routeProgress: Math.min(100, Math.round(this.player.x / this.cavern.exit.x * 100)),
      airJumpReady: this.config.doubleJump && !this.airJumpUsed, shieldCooldown: this.shieldCooldown,
      floorRemaining: this.grounded !== null && this.grounded !== 0 && !this.config.safeFloor
        ? Math.max(0, this.config.meltDelay - (this.platformHeat.get(this.grounded) ?? 0)) : null,
      metrics: { ...this.metrics, ruleTraces: [...this.metrics.ruleTraces] }, messages: [...this.messages] };
  }
  private resetStage(): void {
    this.visualRevision++; this.feedback = [];
    this.cavern = generateCavern(this.level); this.collected.clear(); this.checkpoint = 0;
    this.elapsed = 0; this.shieldCooldown = 0; this.respawn();
  }
  private respawn(): void {
    const platform = this.cavern.platforms[this.config.checkpoints ? this.checkpoint : 0];
    this.player = { x: platform.x + 35, y: platform.y - HERO_HEIGHT, vx: 0, vy: 0 };
    this.grounded = platform.id; this.coyote = 0.1; this.airJumpUsed = false; this.invulnerable = 1.3;
    this.platformHeat.clear(); this.collapsed.clear(); this.releaseInput();
    this.cue('respawn', this.player.x + HERO_WIDTH / 2, this.player.y + HERO_HEIGHT / 2);
  }
  fireballs(): { x: number; y: number }[] {
    return this.cavern.platforms.filter(p => p.id > 0 && p.id % 3 === 2).map(p => ({
      x: p.x - 40, y: LAVA_Y - 18 - (Math.sin(this.elapsed * (1.4 + this.config.lavaSpeed * 0.4) + p.id) + 1) * 65,
    }));
  }
  step(dt: number, input: FloorInput): void {
    if (this.phase !== 'playing') return;
    dt = Math.max(0, Math.min(0.1, dt));
    if (input.jump && !this.jumpHeld) this.jumpBuffer = 0.14;
    this.jumpHeld = input.jump;
    this.evaluate();
    let remaining = dt;
    while (remaining > 0 && this.phase === 'playing') {
      const slice = Math.min(remaining, 1 / 120); this.tick(slice, input); remaining -= slice;
    }
    this.evaluate();
  }
  private tick(dt: number, input: FloorInput): void {
    this.elapsed += dt; this.invulnerable = Math.max(0, this.invulnerable - dt); this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    if (this.grounded !== null) { this.coyote = 0.1; this.airJumpUsed = false; }
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0) {
      const groundJump = this.grounded !== null || this.coyote > 0;
      if (groundJump || (this.config.doubleJump && !this.airJumpUsed)) {
        if (!groundJump) { this.airJumpUsed = true; this.metrics.doubleJumps++; }
        this.player.vy = -(330 + this.config.jumpHeight * 20); this.grounded = null; this.coyote = 0;
        this.jumpBuffer = 0; this.metrics.jumps++; this.events.push('jump');
        this.cue(groundJump ? 'jump' : 'doubleJump', this.player.x + HERO_WIDTH / 2, this.player.y + HERO_HEIGHT, groundJump ? undefined : 'AIR JUMP');
      } else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    }
    const direction = Number(input.right) - Number(input.left);
    this.player.vx = direction * (140 + this.config.moveSpeed * 25);
    if (direction) this.facing = direction;
    const oldBottom = this.player.y + HERO_HEIGHT;
    const airborne = this.grounded === null;
    this.player.x = Math.max(0, Math.min(this.cavern.width - HERO_WIDTH, this.player.x + this.player.vx * dt));
    this.player.vy += this.config.gravity * 100 * dt;
    this.player.y += this.player.vy * dt;
    this.grounded = null;
    for (const p of this.cavern.platforms) {
      if (this.collapsed.has(p.id) || this.player.x + HERO_WIDTH <= p.x || this.player.x >= p.x + p.width) continue;
      if (this.player.vy >= 0 && oldBottom <= p.y + 0.5 && this.player.y + HERO_HEIGHT >= p.y) {
        if (airborne && this.player.vy > 100) {
          this.events.push('land'); this.cue('land', this.player.x + HERO_WIDTH / 2, p.y, undefined, this.player.vy);
        }
        this.player.y = p.y - HERO_HEIGHT; this.player.vy = 0; this.grounded = p.id;
        if (p.checkpoint && this.config.checkpoints && p.id > this.checkpoint) {
          this.checkpoint = p.id; this.events.push('checkpoint'); this.log(`CHECKPOINT ${p.id / 4} · Route saved.`);
          this.cue('checkpoint', p.x + 20, p.y - 38, 'CHECKPOINT SAVED');
        }
        break;
      }
    }
    if (this.grounded !== null && this.grounded !== 0 && !this.config.safeFloor) {
      const heat = (this.platformHeat.get(this.grounded) ?? 0) + dt; this.platformHeat.set(this.grounded, heat);
      if (heat >= this.config.meltDelay) {
        const platform = this.cavern.platforms[this.grounded];
        this.events.push('crumble'); this.cue('crumble', platform.x + platform.width / 2, platform.y, 'FLOOR LOST', platform.width);
        this.collapsed.add(this.grounded); this.grounded = null;
      }
    }
    for (const crystal of this.cavern.crystals) {
      if (!this.collected.has(crystal.id) && Math.hypot(this.player.x + HERO_WIDTH / 2 - crystal.x, this.player.y + HERO_HEIGHT / 2 - crystal.y) < 30) {
        this.collected.add(crystal.id); this.score += this.config.crystalValue; this.metrics.crystals++; this.events.push('crystal');
        this.cue('crystal', crystal.x, crystal.y, `+${this.config.crystalValue}`);
        this.evaluate();
      }
    }
    if (this.player.y + HERO_HEIGHT >= LAVA_Y) { this.hit(true); return; }
    const spikes = this.cavern.platforms.filter(p => p.spike && !this.collapsed.has(p.id));
    if (spikes.some(p => this.player.x + HERO_WIDTH > p.x + 65 && this.player.x < p.x + 93
      && this.player.y + HERO_HEIGHT > p.y - 18 && this.player.y < p.y)) this.hit(false);
    if (this.fireballs().some(f => Math.hypot(this.player.x + HERO_WIDTH / 2 - f.x, this.player.y + HERO_HEIGHT / 2 - f.y) < 27)) this.hit(false);
    if (this.phase === 'playing' && Math.abs(this.player.x + HERO_WIDTH / 2 - this.cavern.exit.x) < 30
      && this.grounded === this.cavern.platforms.at(-1)!.id) {
      this.score += 250; this.metrics.exits++; this.phase = 'cleared'; this.events.push('clear'); this.log('EXIT REACHED · Cavern conquered.');
      this.cue('clear', this.cavern.exit.x, this.cavern.exit.y - 35, 'CAVERN CLEARED +250');
    }
  }
  private hit(lava: boolean): void {
    if (this.phase !== 'playing' || (!lava && this.invulnerable > 0)) return;
    if (!lava && this.config.shield && this.shieldCooldown <= 0) {
      this.shieldCooldown = 8; this.invulnerable = 1.2; this.events.push('shield'); this.log('HEAT SHIELD · Impact absorbed.');
      this.cue('shield', this.player.x + HERO_WIDTH / 2, this.player.y + HERO_HEIGHT / 2, 'SHIELD BLOCKED'); return;
    }
    this.lives--; this.metrics.hits++; this.metrics.minLives = Math.min(this.metrics.minLives, this.lives); this.events.push('hit');
    this.log(`${lava ? 'LAVA' : 'HAZARD'} · ${this.lives} lives remaining.`);
    this.cue('hit', this.player.x + HERO_WIDTH / 2, lava ? LAVA_Y : this.player.y + HERO_HEIGHT / 2, lava ? 'LAVA · −1 LIFE' : 'HIT · −1 LIFE');
    if (this.lives <= 0) this.phase = 'gameover'; else this.respawn();
    this.evaluate();
  }
  private evaluate(): void {
    if (!this.program) return;
    const runtime = { score: this.score, lives: this.lives, gems: this.collected.size, height: Math.max(0, Math.round(LAVA_Y - this.player.y - HERO_HEIGHT)), stage: this.level, jumps: this.metrics.jumps };
    const { config, frame } = evaluateGameScript(this.program, this.base, runtime, floorSchema); this.config = config;
    for (const trace of frame.traces) {
      if (!this.metrics.ruleTraces.includes(trace.text)) this.metrics.ruleTraces.push(trace.text);
      if (!this.activeRules.has(trace.ruleId)) {
        this.log(`RULE LIVE · ${trace.text}`);
        for (const write of trace.writes) {
          const value = evalExpr(write.arg, { runtime, modValues: Object.fromEntries(FLOOR_MODS.map(mod => [mod.name, this.base[mod.id]])),
            constants: Object.fromEntries(this.program.symbols.filter(s => s.userOnly).map(s => [s.name, s.value])) });
          if (value.ok) this.log(renderText(value.value));
        }
      }
    }
    this.activeRules = new Set(frame.activeRuleIds);
  }
  private log(message: string): void { this.messages = [message, ...this.messages].slice(0, 4); }
  private cue(kind: FloorCue['kind'], x: number, y: number, text?: string, power?: number): void {
    this.feedback.push({ kind, x, y, text, power }); this.feedback = this.feedback.slice(-64);
  }
}
