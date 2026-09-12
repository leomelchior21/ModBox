import { DEFAULT_CONFIG } from '../../../interpreter/core/limits';
import type {
  GameConfig,
  GameRule,
  LiteralValue,
  RuntimeValues,
} from '../../../interpreter/core/types';
import { applyOverrides, evaluateRules } from '../../../interpreter/core/rules';
import { evalExpr, makeScope } from '../../../interpreter/core/evaluate';
import { synth } from '../audio/synth';
import { FIELD, HUD, PALETTE } from './constants';
import {
  clampEnemyCount,
  childrenOf,
  createRock,
  retypeRock,
  sizeFromEnemyKind,
  spawnPositionFor,
} from './asteroids';
import { circlesOverlap, clamp, dampen, rand, TAU, vec, wrapPosition } from './vector';
import type {
  Bullet,
  CommsEntry,
  ConfigChange,
  EngineCallbacks,
  EngineSnapshot,
  InputState,
  Particle,
  Phase,
  ProgramInput,
  Rock,
  RuntimeMetrics,
  ScorePop,
  Ship,
} from './types';
import {
  drawBullet,
  drawParticle,
  drawRock,
  drawScorePop,
  drawShip,
} from '../rendering/entities';
import { createStars, drawStars, drawVignette, fieldTint } from '../rendering/starfield';
import { drawHud, type HudView, type Toast } from '../rendering/hud';
import { renderText } from '../../../interpreter/csharp/binder';

/* ============================================================================
   VECTOR ZERO — GAME ENGINE
   Fixed-timestep simulation on top of requestAnimationFrame. All gameplay
   state lives outside React; React only renders overlays when the phase
   changes.
   ========================================================================== */

const STEP = 1 / 60;
const MAX_SUBSTEPS = 5;

export interface EngineOptions extends EngineCallbacks {
  reducedMotion?: boolean;
  bestScore?: number;
}

export class VectorZeroEngine {
  readonly input: InputState = { left: false, right: false, thrust: false, fire: false, brake: false };

  phase: Phase = 'launch';
  soundOn = true;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly reducedMotion: boolean;
  private readonly callbacks: EngineOptions;
  private canvas: HTMLCanvasElement;
  private width = 800;
  private height = 600;
  private dpr = 1;

  private rafId = 0;
  private lastTime = 0;
  private running = false;
  private destroyed = false;

  private ship: Ship = {
    pos: vec(0, 0),
    vel: vec(0, 0),
    angle: -Math.PI / 2,
    radius: FIELD.shipRadius,
    thrusting: false,
    recoil: 0,
    invuln: 0,
    alive: true,
    hitFlash: 0,
  };

  private rocks: Rock[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private pops: ScorePop[] = [];
  private stars = createStars();

  private baseConfig: GameConfig = { ...DEFAULT_CONFIG };
  private liveConfig: GameConfig = { ...DEFAULT_CONFIG };
  private rules: GameRule[] = [];
  private constants: Record<string, LiteralValue> = {};
  private missionLabel = '';
  private initialComms: CommsEntry[] = [];

  private comms: CommsEntry[] = [];
  private toasts: Toast[] = [];
  private banner: { text: string; sub: string; life: number; maxLife: number } | null = null;
  private activeRuleIds: string[] = [];
  private activeRuleTexts: string[] = [];

  private score = 0;
  private lives = 3;
  private wave = 1;
  private health: number = FIELD.maxHealth;
  private best = 0;

  private fireCooldown = 0;
  private respawnTimer = 0;
  private waveTimer = 0;
  private healthRegenDelay = 0;
  private shieldCharge = 1;
  private shipNamePulse = 0;
  private shake = 0;
  private flash = 0;
  private elapsed = 0;
  private driftX = 0;
  private driftY = 0;
  private nextId = 1;
  private keyEnabled = true;

  private metrics: RuntimeMetrics = {
    maxScore: 0,
    minHealth: FIELD.maxHealth,
    kills: 0,
    hitsTaken: 0,
    deaths: 0,
    wavesReached: 1,
    playTimeMs: 0,
    ruleTraces: [],
    ruleActivations: 0,
  };

  constructor(canvas: HTMLCanvasElement, options: EngineOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('VECTOR ZERO needs a 2D canvas');
    this.ctx = ctx;
    this.best = options.bestScore ?? 0;
    this.callbacks = options;
    this.reducedMotion =
      options.reducedMotion ??
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    this.resize();
    this.resetRun(false);
    this.attachListeners();
  }

  /* ============================================================ public API */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.destroyed = true;
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.detachListeners();
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  /** Live code update: re-apply the student's GameConfig + rules without a
   *  compile step, changing only what actually differs. */
  setProgram(input: ProgramInput): void {
    const previous = this.liveConfig;
    const previousRuleCount = this.rules.length;
    this.baseConfig = input.config;
    this.rules = input.rules;
    this.missionLabel = input.missionLabel;
    this.initialComms = input.comms;
    this.constants = input.constants;
    this.seedComms();

    const changes = this.applyConfig(input.config, previous);
    if (previousRuleCount !== input.rules.length) changes.push('rules');
    const unique = [...new Set<ConfigChange>(changes)];
    if (unique.length) this.callbacks.onUpdate?.(unique[0]);
    this.emitPhase();
  }

  launch(): void {
    synth.unlock();
    this.resetRun(true);
    this.setPhase('playing');
    this.showBanner('SURVIVE IT.', this.liveConfig.shipName.toUpperCase(), 1.1);
    synth.play('wave');
  }

  pause(): void {
    if (this.phase !== 'playing' && this.phase !== 'respawn') return;
    this.setPhase('paused');
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    synth.unlock();
    this.setPhase(this.respawnTimer > 0 ? 'respawn' : 'playing');
  }

  togglePause(): void {
    if (this.phase === 'paused') this.resume();
    else this.pause();
  }

  restart(): void {
    synth.unlock();
    this.resetRun(true);
    this.setPhase('playing');
  }

  /** Back to the pre-flight screen without losing the student's code. */
  toLaunch(): void {
    this.resetRun(false);
    this.setPhase('launch');
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    synth.setMuted(!on);
  }

  setKeyEnabled(enabled: boolean): void {
    this.keyEnabled = enabled;
    if (!enabled) {
      this.input.left = false;
      this.input.right = false;
      this.input.thrust = false;
      this.input.fire = false;
      this.input.brake = false;
    }
  }

  getSnapshot(): EngineSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      health: this.health,
      best: Math.max(this.best, this.score),
      config: this.liveConfig,
      activeRuleTexts: this.activeRuleTexts,
      metrics: this.metrics,
    };
  }

  getMetrics(): RuntimeMetrics {
    return { ...this.metrics, ruleTraces: [...this.metrics.ruleTraces] };
  }

  getConfig(): GameConfig {
    return this.liveConfig;
  }

  getMissionLabel(): string {
    return this.missionLabel;
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emitPhase();
  }

  private emitPhase(): void {
    this.callbacks.onPhase?.(this.phase, this.getSnapshot());
  }

  /* ============================================================== listeners */

  private attachListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
    } else {
      window.addEventListener('resize', this.resize);
    }
  }

  private detachListeners(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.resize);
  }

  resize = (): void => {
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(220, Math.floor(rect.height));
    this.width = width;
    this.height = height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  private onBlur = (): void => {
    this.input.left = false;
    this.input.right = false;
    this.input.thrust = false;
    this.input.fire = false;
    this.input.brake = false;
    if (this.phase === 'playing') this.pause();
  };

  private onVisibility = (): void => {
    if (document.hidden) this.pause();
  };

  /** While the editor owns the keyboard, gameplay keys stay silent (§26). */
  private isTypingTarget(): boolean {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return false;
    const tag = element.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (element.isContentEditable) return true;
    return !!element.closest('.cm-editor');
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (this.isTypingTarget() || !this.keyEnabled) return;

    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = true;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.input.thrust = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.brake = true;
        break;
      case 'Space':
        this.input.fire = true;
        break;
      case 'KeyP':
        this.togglePause();
        return;
      case 'Enter':
        if (this.phase === 'launch') {
          this.launch();
          return;
        }
        if (this.phase === 'gameover') {
          this.restart();
          return;
        }
        break;
      default:
        return;
    }
    synth.unlock();
    if (event.code === 'Space') event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = false;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.input.thrust = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.brake = false;
        break;
      case 'Space':
        this.input.fire = false;
        break;
      default:
        break;
    }
  };

  private resizeObserver: ResizeObserver | null = null;
  private accumulator = 0;

  /* ============================================================== simulation */

  private frame = (time: number): void => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.frame);
    const delta = Math.min(0.25, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;

    if (this.phase !== 'paused') {
      this.accumulator += delta;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_SUBSTEPS) {
        this.step(STEP);
        this.accumulator -= STEP;
        steps += 1;
      }
      if (steps === MAX_SUBSTEPS) this.accumulator = 0;
    }

    this.render();
  };

  private step(dt: number): void {
    this.elapsed += dt;

    this.shake = Math.max(0, this.shake - dt * 16);
    this.flash = Math.max(0, this.flash - dt * 3.4);
    this.shipNamePulse = Math.max(0, this.shipNamePulse - dt);
    this.ship.recoil = dampen(this.ship.recoil, 16, dt);
    this.ship.hitFlash = Math.max(0, this.ship.hitFlash - dt);
    for (const rock of this.rocks) rock.hitFlash = Math.max(0, rock.hitFlash - dt);

    this.updateToasts(dt);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    switch (this.phase) {
      case 'launch':
        this.updateIdle(dt);
        break;
      case 'playing':
        this.updateShip(dt);
        this.updateBullets(dt);
        this.updateRocks(dt);
        this.updateParticles(dt);
        this.resolveBulletHits();
        this.resolveShipHits();
        this.updateRules();
        this.updateHealth(dt);
        this.updateWaves(dt);
        this.metrics.playTimeMs += dt * 1000;
        this.metrics.maxScore = Math.max(this.metrics.maxScore, this.score);
        this.metrics.minHealth = Math.min(this.metrics.minHealth, this.health);
        break;
      case 'respawn':
        this.updateRocks(dt);
        this.updateParticles(dt);
        this.updateRules();
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.reviveShip();
          this.setPhase('playing');
        }
        break;
      case 'gameover':
        this.updateRocks(dt);
        this.updateParticles(dt);
        this.ship.thrusting = false;
        break;
      default:
        break;
    }

    this.driftX += (this.ship.vel.x / 60) * dt;
    this.driftY += (this.ship.vel.y / 60) * dt;
  }

  /** Pre-flight: the world is alive and shows exactly what the code asks for. */
  private updateIdle(dt: number): void {
    this.ship.angle += dt * 0.32;
    this.ship.pos.x += this.ship.vel.x * dt;
    this.ship.pos.y += this.ship.vel.y * dt;
    this.ship.vel = { x: dampen(this.ship.vel.x, 0.4, dt), y: dampen(this.ship.vel.y, 0.4, dt) };
    wrapPosition(this.ship.pos, this.width, this.height, 40);
    this.updateRocks(dt);
    this.updateParticles(dt);
    this.ship.thrusting = false;
  }

  private updateShip(dt: number): void {
    const ship = this.ship;
    const config = this.liveConfig;

    if (this.input.left) ship.angle -= FIELD.shipTurnSpeed * dt;
    if (this.input.right) ship.angle += FIELD.shipTurnSpeed * dt;

    ship.thrusting = this.input.thrust;
    if (this.input.thrust) {
      ship.vel.x += Math.cos(ship.angle) * FIELD.shipAccel * dt;
      ship.vel.y += Math.sin(ship.angle) * FIELD.shipAccel * dt;
    }

    const drag = this.input.brake ? FIELD.brakePerSecond : FIELD.dragPerSecond;
    ship.vel.x = dampen(ship.vel.x, drag, dt);
    ship.vel.y = dampen(ship.vel.y, drag, dt);

    if (config.worldGravity > 0) ship.vel.y += config.worldGravity * 7 * dt;

    const speed = Math.hypot(ship.vel.x, ship.vel.y);
    if (speed > FIELD.shipMaxSpeed) {
      const scale = FIELD.shipMaxSpeed / speed;
      ship.vel.x *= scale;
      ship.vel.y *= scale;
    }

    ship.pos.x += ship.vel.x * dt;
    ship.pos.y += ship.vel.y * dt;
    wrapPosition(ship.pos, this.width, this.height, ship.radius * 2);
    ship.invuln = Math.max(0, ship.invuln - dt);

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.input.fire) this.fire();
  }

  private fire(): void {
    if (!this.ship.alive || this.fireCooldown > 0) return;
    if (this.bullets.length >= FIELD.maxBullets) return;

    const config = this.liveConfig;
    this.fireCooldown = config.rapidFireEnabled ? FIELD.bulletCooldownRapid : FIELD.bulletCooldown;

    const origin = {
      x: this.ship.pos.x + Math.cos(this.ship.angle) * this.ship.radius * 1.5,
      y: this.ship.pos.y + Math.sin(this.ship.angle) * this.ship.radius * 1.5,
    };
    const spread = config.weaponType === 'spread' ? 3 : 1;
    const power = config.laserPower;

    for (let i = 0; i < spread; i += 1) {
      const offset = spread === 1 ? 0 : (i - 1) * 0.09;
      const angle = this.ship.angle + offset + rand(-0.012, 0.012);
      const speed = FIELD.bulletSpeed + Math.random() * 24;
      this.bullets.push({
        id: this.nextId++,
        pos: { ...origin },
        vel: {
          x: Math.cos(angle) * speed + this.ship.vel.x * FIELD.bulletInherit,
          y: Math.sin(angle) * speed + this.ship.vel.y * FIELD.bulletInherit,
        },
        life: FIELD.bulletLife,
        power,
        pierce: power >= 5,
        trail: 0,
      });
    }

    this.ship.recoil += 1.6;
    this.addShake(FIELD.fireShake);
    if (this.soundOn) synth.play('laser');
  }

  private updateRocks(dt: number): void {
    for (const rock of this.rocks) {
      if (rock.phaseIn < 1) rock.phaseIn = Math.min(1, rock.phaseIn + dt * 2.2);
      rock.angle += rock.spin * dt;
      if (this.liveConfig.worldGravity > 0) rock.vel.y += this.liveConfig.worldGravity * 4.5 * dt;
      rock.pos.x += rock.vel.x * dt;
      rock.pos.y += rock.vel.y * dt;
      wrapPosition(rock.pos, this.width, this.height, rock.radius + 8);
    }
  }

  private updateBullets(dt: number): void {
    if (!this.bullets.length) return;
    const homing = this.liveConfig.homingEnabled;
    const survivors: Bullet[] = [];

    for (const bullet of this.bullets) {
      bullet.life -= dt;
      if (bullet.life <= 0) continue;

      if (homing) {
        const target = this.nearestRock(bullet.pos, 260);
        if (target) {
          const speed = Math.hypot(bullet.vel.x, bullet.vel.y) || 1;
          const desired = Math.atan2(target.pos.y - bullet.pos.y, target.pos.x - bullet.pos.x);
          const current = Math.atan2(bullet.vel.y, bullet.vel.x);
          let diff = (desired - current) % TAU;
          if (diff > Math.PI) diff -= TAU;
          if (diff < -Math.PI) diff += TAU;
          const turn = clamp(diff, -3.4 * dt, 3.4 * dt);
          bullet.vel.x = Math.cos(current + turn) * speed;
          bullet.vel.y = Math.sin(current + turn) * speed;
        }
      }

      bullet.pos.x += bullet.vel.x * dt;
      bullet.pos.y += bullet.vel.y * dt;
      wrapPosition(bullet.pos, this.width, this.height, 6);
      survivors.push(bullet);
    }

    this.bullets = survivors;
  }

  private updateParticles(dt: number): void {
    if (this.particles.length) {
      const survivors: Particle[] = [];
      for (const particle of this.particles) {
        particle.life -= dt;
        if (particle.life <= 0) continue;
        particle.pos.x += particle.vel.x * dt;
        particle.pos.y += particle.vel.y * dt;
        particle.vel.x = dampen(particle.vel.x, 1.6, dt);
        particle.vel.y = dampen(particle.vel.y, 1.6, dt);
        survivors.push(particle);
      }
      this.particles = survivors;
    }

    if (this.pops.length) {
      const survivors: ScorePop[] = [];
      for (const pop of this.pops) {
        pop.life -= dt;
        if (pop.life > 0) survivors.push(pop);
      }
      this.pops = survivors;
    }
  }

  private updateToasts(dt: number): void {
    if (!this.toasts.length) return;
    const survivors: Toast[] = [];
    for (const toast of this.toasts) {
      toast.life -= dt;
      if (toast.life > 0) survivors.push(toast);
    }
    this.toasts = survivors;
  }

  private nearestRock(pos: { x: number; y: number }, maxDistance: number): Rock | null {
    let best: Rock | null = null;
    let bestDistance = maxDistance;
    for (const rock of this.rocks) {
      const distance = Math.hypot(rock.pos.x - pos.x, rock.pos.y - pos.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = rock;
      }
    }
    return best;
  }

  /* ============================================================= collisions */

  private resolveBulletHits(): void {
    if (!this.bullets.length || !this.rocks.length) return;
    const survivors: Bullet[] = [];
    const destroyed: Rock[] = [];

    for (const bullet of this.bullets) {
      let consumed = false;
      for (const rock of this.rocks) {
        if (destroyed.includes(rock)) continue;
        if (!circlesOverlap(bullet.pos, FIELD.bulletRadius, rock.pos, rock.radius * 0.92)) continue;

        rock.hp -= bullet.power;
        rock.hitFlash = 0.08;
        this.spawnImpact(bullet.pos, rock);
        if (this.soundOn) synth.play('hit');

        if (rock.hp <= 0) {
          destroyed.push(rock);
          // a piercing shot survives a small rock, but stops on heavy ones
          if (!bullet.pierce || rock.size !== 'small') consumed = true;
        } else {
          consumed = true;
        }
        if (consumed) break;
      }
      if (!consumed) survivors.push(bullet);
    }

    this.bullets = survivors;
    if (!destroyed.length) return;

    for (const rock of destroyed) this.destroyRock(rock);
    this.rocks = this.rocks.filter((rock) => !destroyed.includes(rock));
  }

  private destroyRock(rock: Rock): void {
    const gained = FIELD.rockScore[rock.size] * this.liveConfig.scoreMultiplier;
    this.score += gained;
    this.metrics.kills += 1;

    this.pops.push({
      pos: { x: rock.pos.x, y: rock.pos.y - rock.radius * 0.6 },
      text: `+${gained}`,
      life: 0.85,
      maxLife: 0.85,
      tone: 'score',
    });

    this.spawnBreak(rock);
    this.addShake(FIELD.breakShake);
    if (this.soundOn) synth.play('break');

    for (const size of childrenOf(rock.size)) {
      if (this.rocks.length >= FIELD.maxRocks + 24) break;
      const child = createRock({
        id: this.nextId++,
        size,
        pos: {
          x: rock.pos.x + rand(-rock.radius * 0.4, rock.radius * 0.4),
          y: rock.pos.y + rand(-rock.radius * 0.4, rock.radius * 0.4),
        },
        speedFactor: this.speedFactor() * 1.08,
        phaseIn: 0.3,
      });
      child.vel.x += rock.vel.x * 0.35;
      child.vel.y += rock.vel.y * 0.35;
      this.rocks.push(child);
    }
  }

  private resolveShipHits(): void {
    if (!this.ship.alive || this.ship.invuln > 0) return;

    for (const rock of this.rocks) {
      if (rock.phaseIn < 0.5) continue;
      if (!circlesOverlap(this.ship.pos, this.ship.radius * 0.82, rock.pos, rock.radius * 0.9)) {
        continue;
      }

      if (this.liveConfig.shieldEnabled && this.shieldCharge >= 1) {
        this.shieldCharge = 0;
        rock.hitFlash = 0.12;
        this.flash = 0.45;
        this.addShake(3);
        this.pops.push({
          pos: { x: this.ship.pos.x, y: this.ship.pos.y - 26 },
          text: 'SHIELD HELD',
          life: 0.9,
          maxLife: 0.9,
          tone: 'shield',
        });
        this.pushComms('SHIELD HELD — recharging', 'system');
        if (this.soundOn) synth.play('shield');
        const dx = rock.pos.x - this.ship.pos.x;
        const dy = rock.pos.y - this.ship.pos.y;
        const distance = Math.hypot(dx, dy) || 1;
        rock.vel.x += (dx / distance) * 60;
        rock.vel.y += (dy / distance) * 60;
        this.ship.invuln = 0.9;
        return;
      }

      const damage = FIELD.rockDamage[rock.size];
      rock.hitFlash = 0.12;
      this.damageShip(damage);
      return;
    }
  }

  private damageShip(amount: number): void {
    this.health -= amount;
    this.metrics.hitsTaken += 1;
    this.healthRegenDelay = FIELD.healthRegenDelay;
    this.ship.hitFlash = 0.2;
    this.flash = 0.3;
    this.addShake(FIELD.hitShake);
    this.spawnImpact(this.ship.pos, null, PALETTE.cream);
    if (this.soundOn) synth.play('hit');
    if (this.health <= 0) this.destroyShip();
  }

  private destroyShip(): void {
    const ship = this.ship;
    ship.alive = false;
    this.health = 0;
    this.metrics.deaths += 1;
    this.flash = 0.55;
    this.addShake(FIELD.deathShake);
    if (this.soundOn) synth.play('death');

    for (let i = 0; i < 10; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(40, 160);
      this.particles.push({
        kind: 'fragment',
        pos: { x: ship.pos.x, y: ship.pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: rand(0.5, 1.1),
        maxLife: 1.1,
        angle,
        length: rand(6, 14),
        color: i % 3 === 0 ? PALETTE.blueBright : PALETTE.cream,
        size: 2,
      });
    }

    this.lives -= 1;
    if (this.lives > 0) {
      this.respawnTimer = FIELD.respawnDelay;
      this.setPhase('respawn');
      this.pushComms(`SHIP LOST — ${this.lives} IN RESERVE`, 'system');
    } else {
      this.setPhase('gameover');
      this.showBanner('GAME OVER', `${this.score} POINTS`, 3.2);
      this.callbacks.onGameOver?.(this.score, this.getMetrics());
    }
  }

  private reviveShip(): void {
    const ship = this.ship;
    ship.alive = true;
    ship.vel = { x: 0, y: 0 };
    ship.angle = -Math.PI / 2;
    ship.invuln = FIELD.invulnOnRespawn;
    ship.recoil = 0;
    this.health = FIELD.maxHealth;
    this.shieldCharge = 1;
    this.healthRegenDelay = 0;

    let best = { x: this.width / 2, y: this.height / 2 };
    let bestClearance = -1;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const candidate = {
        x: rand(this.width * 0.2, this.width * 0.8),
        y: rand(this.height * 0.2, this.height * 0.8),
      };
      let clearance = Number.POSITIVE_INFINITY;
      for (const rock of this.rocks) {
        clearance = Math.min(
          clearance,
          Math.hypot(rock.pos.x - candidate.x, rock.pos.y - candidate.y),
        );
      }
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = candidate;
        if (clearance > 200) break;
      }
    }
    ship.pos = best;
    this.shipNamePulse = 0.9;
  }

  private updateHealth(dt: number): void {
    if (!this.ship.alive) return;
    if (this.healthRegenDelay > 0) {
      this.healthRegenDelay -= dt;
      return;
    }
    if (this.health < FIELD.maxHealth) {
      this.health = Math.min(FIELD.maxHealth, this.health + FIELD.healthRegen * dt);
    }
    if (this.liveConfig.shieldEnabled && this.shieldCharge < 1) {
      this.shieldCharge = Math.min(1, this.shieldCharge + dt / FIELD.shieldRecharge);
    }
  }

  private updateWaves(dt: number): void {
    if (this.rocks.length !== 0) {
      this.waveTimer = 0;
      return;
    }
    if (this.waveTimer === 0) {
      this.waveTimer = FIELD.waveIntermission;
      if (this.wave > 1) {
        const bonus = 50 * this.liveConfig.scoreMultiplier;
        this.score += bonus;
        this.showBanner(`WAVE ${this.wave - 1} CLEARED`, `+${bonus} BONUS`, 1.4);
      }
      return;
    }
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = 0;
      this.wave += 1;
      this.metrics.wavesReached = Math.max(this.metrics.wavesReached, this.wave);
      this.spawnWave();
      this.showBanner(`WAVE ${this.wave}`, `${this.rocks.length} ROCKS INBOUND`, 1.3);
      if (this.soundOn) synth.play('wave');
    }
  }

  /* ================================================================ feedback */

  private spawnImpact(
    pos: { x: number; y: number },
    rock: Rock | null,
    color?: string,
  ): void {
    if (this.particles.length > FIELD.maxParticles) return;
    const sparks = rock ? 3 : 4;
    for (let i = 0; i < sparks; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(50, 190);
      this.particles.push({
        kind: 'spark',
        pos: { x: pos.x, y: pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: rand(0.12, 0.3),
        maxLife: 0.3,
        angle,
        length: rand(5, 12),
        color: color ?? (rock?.size === 'big' ? PALETTE.flareBright : PALETTE.cream),
        size: 1.5,
      });
    }
    this.particles.push({
      kind: 'flash',
      pos: { x: pos.x, y: pos.y },
      vel: { x: 0, y: 0 },
      life: 0.16,
      maxLife: 0.16,
      angle: 0,
      length: 0,
      color: PALETTE.cream,
      size: rock ? rock.radius * 0.5 : 16,
    });
  }

  private spawnBreak(rock: Rock): void {
    const budget = FIELD.maxParticles - this.particles.length;
    const fragments = Math.min(rock.size === 'big' ? 9 : 6, Math.max(0, budget));
    for (let i = 0; i < fragments; i += 1) {
      const angle = (i / fragments) * TAU + rand(-0.2, 0.2);
      const speed = rand(30, 120);
      this.particles.push({
        kind: 'fragment',
        pos: {
          x: rock.pos.x + Math.cos(angle) * rock.radius * 0.55,
          y: rock.pos.y + Math.sin(angle) * rock.radius * 0.55,
        },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: rand(0.3, 0.6),
        maxLife: 0.6,
        angle: angle + Math.PI,
        length: rand(7, 16),
        color: rock.size === 'big' ? PALETTE.flareBright : PALETTE.cream,
        size: 1.6,
      });
    }
  }

  private addShake(amount: number): void {
    if (this.reducedMotion) return;
    this.shake = Math.min(FIELD.maxShake, this.shake + amount);
  }

  private showBanner(text: string, sub: string, duration: number): void {
    this.banner = { text, sub, life: duration, maxLife: duration };
  }

  addToast(text: string, tone: Toast['tone'] = 'info', duration = 1.7): void {
    this.toasts.push({
      id: `toast-${this.nextId++}`,
      text,
      tone,
      life: duration,
      maxLife: duration,
    });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  pushComms(text: string, tone: CommsEntry['tone'] = 'in'): void {
    if (!text) return;
    this.comms.push({ id: `live-${this.nextId++}`, text, tone });
    if (this.comms.length > 24) this.comms = this.comms.slice(-24);
    this.callbacks.onComms?.(this.comms.slice(-8));
  }

  /* ============================================================= live rules */

  private runtimeValues(): RuntimeValues {
    return {
      score: this.score,
      health: Math.max(0, Math.round(this.health)),
      wave: this.wave,
      enemiesRemaining: this.rocks.length,
    };
  }

  private updateRules(): void {
    if (!this.rules.length && !this.activeRuleIds.length) return;

    const runtime = this.runtimeValues();
    const frame = evaluateRules(this.rules, this.baseConfig, runtime, this.constants);
    const scope = makeScope(this.baseConfig, runtime, this.constants);

    for (const trace of frame.traces) {
      if (this.activeRuleIds.includes(trace.ruleId)) continue;
      this.metrics.ruleActivations += 1;
      if (!this.metrics.ruleTraces.includes(trace.text)) this.metrics.ruleTraces.push(trace.text);
      for (const write of trace.writes) {
        const evaluated = evalExpr(write.arg, scope);
        if (evaluated.ok) this.pushComms(renderText(evaluated.value), 'system');
      }
      if (this.phase === 'playing') {
        this.addToast(`RULE ACTIVE · ${trace.text}`, 'warn', 2);
        if (this.soundOn) synth.play('unlock');
      }
    }

    this.activeRuleIds = frame.activeRuleIds;
    this.activeRuleTexts = frame.traces.map((trace) => trace.text);

    if (frame.errors.length) {
      const message = frame.errors[0];
      if (!this.reportedRuleErrors.has(message)) {
        this.reportedRuleErrors.add(message);
        this.pushComms(`RULE ERROR — ${message}`, 'system');
      }
    }

    this.applyConfig(applyOverrides(this.baseConfig, frame.overrides), this.liveConfig);
  }

  private readonly reportedRuleErrors = new Set<string>();

  private seedComms(): void {
    this.comms = this.initialComms.map((entry) => ({ ...entry }));
    this.callbacks.onComms?.(this.comms.slice(-8));
  }

  /* ============================================================ run control */

  private resetRun(play: boolean): void {
    this.score = 0;
    this.wave = 1;
    this.health = FIELD.maxHealth;
    this.shieldCharge = 1;
    this.fireCooldown = 0;
    this.respawnTimer = 0;
    this.waveTimer = 0;
    this.healthRegenDelay = 0;
    this.bullets = [];
    this.particles = [];
    this.pops = [];
    this.toasts = [];
    this.banner = null;
    this.flash = 0;
    this.shake = 0;
    this.activeRuleIds = [];
    this.activeRuleTexts = [];
    this.reportedRuleErrors.clear();

    this.liveConfig = { ...this.baseConfig };
    this.lives = Math.max(1, this.liveConfig.lives);

    const ship = this.ship;
    ship.alive = true;
    ship.pos = { x: this.width / 2, y: this.height / 2 };
    ship.vel = play ? { x: 0, y: 0 } : { x: rand(-8, 8), y: rand(-8, 8) };
    ship.angle = -Math.PI / 2;
    ship.invuln = play ? 1.6 : 0;
    ship.recoil = 0;
    ship.hitFlash = 0;

    this.metrics.minHealth = FIELD.maxHealth;
    if (play) this.metrics.playTimeMs = 0;
    this.metrics.wavesReached = Math.max(1, this.metrics.wavesReached);

    this.spawnWave();
    this.seedComms();
    this.emitPhase();
  }

  private spawnWave(): void {
    const config = this.liveConfig;
    const count = clampEnemyCount(config.enemyCount + (this.wave - 1));
    const size = sizeFromEnemyKind(config.enemyType);
    this.rocks = [];

    for (let i = 0; i < count; i += 1) {
      const pos = spawnPositionFor(this.ship.pos, this.width, this.height, 180);
      this.rocks.push(
        createRock({
          id: this.nextId++,
          size,
          pos,
          speedFactor: this.speedFactor(),
          phaseIn: i < 4 ? rand(0.15, 0.5) : 1,
        }),
      );
    }
  }

  private speedFactor(): number {
    return this.speedFactorFor(this.liveConfig.enemySpeed, this.wave);
  }

  /** Keeps the rock field in sync with `int enemies = n;` while you type. */
  private syncRockCount(target: number): void {
    const wanted = clampEnemyCount(target);
    if (this.rocks.length < wanted) {
      const size = sizeFromEnemyKind(this.liveConfig.enemyType);
      const missing = wanted - this.rocks.length;
      for (let i = 0; i < missing; i += 1) {
        this.rocks.push(
          createRock({
            id: this.nextId++,
            size,
            pos: spawnPositionFor(this.ship.pos, this.width, this.height, 150),
            speedFactor: this.speedFactor(),
            phaseIn: 0.2,
          }),
        );
      }
      if (this.phase === 'playing') {
        this.addToast(`${missing} MORE ROCK${missing > 1 ? 'S' : ''}`, 'warn', 1.2);
        if (this.soundOn) synth.play('wave');
      }
    } else if (this.rocks.length > wanted) {
      const removed = this.rocks.splice(wanted);
      for (const rock of removed) this.spawnImpact(rock.pos, rock);
      if (this.phase === 'playing' && wanted > 0) {
        this.addToast(`FIELD CLEARED TO ${wanted}`, 'info', 1.2);
      }
    }
  }

  /* ======================================================== config bridging */

  private speedFactorFor(level: number, wave: number): number {
    const clamped = Math.max(1, level);
    return FIELD.speedFactorMin + (clamped - 1) * FIELD.speedFactorPerLevel + (wave - 1) * 0.08;
  }

  /**
   * Applies a new GameConfig to the living world. Harmless changes land
   * immediately; changes that would disrupt an active run wait for the next
   * wave or respawn. Every change is reported so the UI can react.
   */
  private applyConfig(next: GameConfig, previous: GameConfig): ConfigChange[] {
    const changes: ConfigChange[] = [];
    const inRun = this.phase === 'playing' || this.phase === 'respawn';

    if (next.enemySpeed !== previous.enemySpeed) {
      const before = this.speedFactorFor(previous.enemySpeed, this.wave);
      const after = this.speedFactorFor(next.enemySpeed, this.wave);
      const ratio = before > 0 ? after / before : 1;
      for (const rock of this.rocks) {
        rock.vel.x *= ratio;
        rock.vel.y *= ratio;
      }
      changes.push('enemySpeed');
    }

    this.liveConfig = { ...next };

    if (next.shipName !== previous.shipName) {
      this.shipNamePulse = 1.1;
      changes.push('shipName');
    }

    if (next.enemyType !== previous.enemyType) {
      changes.push('enemyType');
      if (this.phase === 'launch') {
        // pre-flight: morph the whole field so the change is immediately visible
        const size = sizeFromEnemyKind(next.enemyType);
        for (const rock of this.rocks) retypeRock(rock, size);
      } else if (inRun) {
        this.addToast('NEW ROCK FORMS INBOUND', 'info', 1.2);
      }
    }

    if (next.enemyCount !== previous.enemyCount) {
      this.syncRockCount(next.enemyCount);
      changes.push('enemyCount');
    }

    if (next.shieldEnabled !== previous.shieldEnabled) {
      this.shieldCharge = 1;
      changes.push('shield');
      if (inRun) {
        this.addToast(next.shieldEnabled ? 'SHIELD ONLINE' : 'SHIELD OFFLINE', next.shieldEnabled ? 'ok' : 'info', 1.4);
        if (this.soundOn && next.shieldEnabled) synth.play('shield');
      }
    }

    if (next.rapidFireEnabled !== previous.rapidFireEnabled) {
      changes.push('rapidFire');
      if (inRun) {
        this.addToast(next.rapidFireEnabled ? 'RAPID FIRE ONLINE' : 'RAPID FIRE OFFLINE', next.rapidFireEnabled ? 'ok' : 'info', 1.4);
      }
    }

    if (next.homingEnabled !== previous.homingEnabled) {
      changes.push('homing');
      if (inRun) {
        this.addToast(next.homingEnabled ? 'HOMING ONLINE' : 'HOMING OFFLINE', next.homingEnabled ? 'ok' : 'info', 1.4);
      }
    }

    if (next.laserPower !== previous.laserPower) {
      changes.push('power');
      if (inRun) {
        this.pops.push({
          pos: { x: this.ship.pos.x, y: this.ship.pos.y - 30 },
          text: `PWR ${next.laserPower}`,
          life: 0.9,
          maxLife: 0.9,
          tone: 'power',
        });
        if (this.soundOn) synth.play('ui');
      }
    }

    if (next.lives !== previous.lives) {
      changes.push('lives');
      // extra lives are a gift; losing one only takes effect next run
      if (next.lives > previous.lives) this.lives += next.lives - previous.lives;
    }

    if (next.scoreMultiplier !== previous.scoreMultiplier) changes.push('multiplier');
    if (next.worldGravity !== previous.worldGravity) changes.push('gravity');
    if (next.weaponType !== previous.weaponType) {
      changes.push('weapon');
      if (inRun && this.soundOn) synth.play('ui');
    }

    return changes;
  }

  /* ================================================================ render */

  private render(): void {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;

    ctx.fillStyle = fieldTint(this.health);
    ctx.fillRect(0, 0, width, height);

    drawStars(ctx, this.stars, width, height, this.elapsed, this.driftX, this.driftY, this.reducedMotion);
    drawVignette(ctx, width, height);

    ctx.save();
    if (this.shake > 0.05) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    for (const rock of this.rocks) drawRock(ctx, rock, false);
    for (const bullet of this.bullets) drawBullet(ctx, bullet);
    for (const particle of this.particles) drawParticle(ctx, particle);
    for (const pop of this.pops) drawScorePop(ctx, pop);

    if (this.ship.alive) {
      drawShip(ctx, this.ship, {
        shield: this.liveConfig.shieldEnabled,
        shieldRatio: this.liveConfig.shieldEnabled ? this.shieldCharge : 0,
        power: this.liveConfig.laserPower,
        time: this.elapsed,
        thrusting: this.ship.thrusting,
        reducedMotion: this.reducedMotion,
      });
    }
    ctx.restore();

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,244,218,${Math.min(0.3, this.flash * 0.45).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }

    const view: HudView = {
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      health: this.health,
      shipName: this.liveConfig.shipName,
      weaponLabel: this.liveConfig.weaponType,
      shield: this.liveConfig.shieldEnabled,
      shieldRatio: this.shieldCharge,
      power: this.liveConfig.laserPower,
      rapidFire: this.liveConfig.rapidFireEnabled,
      comms: this.comms.slice(-HUD.commsLines),
      activeRules: this.activeRuleTexts,
      toasts: this.toasts,
      banner: this.banner,
      shipNamePulse: this.shipNamePulse,
    };
    drawHud(ctx, width, height, view);
  }
}
