import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { templeCatalog } from '../temple-race/catalog';
import { subwayCatalog } from '../subway-runnerz/catalog';

export type RunnerTheme = 'temple' | 'subway';
export interface RunnerObstacle { id: number; at: number; lane: number; kind: 'hurdle' | 'arch' | 'gap' | 'train'; length: number; ramp: boolean; moving: boolean; passed: boolean; hit: boolean }
export interface RunnerCoin { at: number; lane: number; y: number; taken: boolean }
export interface RunnerTurn { at: number; direction: -1 | 1; queued: boolean; passed: boolean }
export const runnerGoal = (level: number) => Math.min(950, 300 + (level - 1) * 45);
export function runnerCourse(theme: RunnerTheme, level: number) {
  const goal = runnerGoal(level), obstacles: RunnerObstacle[] = [], coins: RunnerCoin[] = [], turns: RunnerTurn[] = [];
  if (theme === 'temple') for (let at = 72, i = 0; at < goal - 25; at += 72, i++) turns.push({ at, direction: i % 2 ? -1 : 1, queued: false, passed: false });
  const nearTurn = (at: number) => turns.some(t => Math.abs(t.at - at) < 14);
  for (let at = 30, i = 0; at < goal - 18; at += theme === 'temple' ? 15 : 18, i++) {
    if (nearTurn(at)) continue;
    const lane = ((i * 7 + level) % 3) - 1;
    const kind = theme === 'subway' && i % 3 === 1 ? 'train' : theme === 'temple' && i % 7 === 4 ? 'gap' : i % 3 === 2 ? 'arch' : 'hurdle';
    const ramp = kind === 'train' && i % 2 === 0;
    obstacles.push({ id: i, at, lane, kind, length: kind === 'train' ? 10 : kind === 'gap' ? 3.2 : 1, ramp, moving: kind === 'train' && !ramp, passed: false, hit: false });
    // Each row leaves two lanes free. Coins also advertise the traversable roof route.
    for (let j = 0; j < 4; j++) coins.push({ at: at - 6 + j * 2.1, lane: ramp ? lane : lane === 1 ? 0 : 1, y: ramp && j >= 2 ? 3.4 : .9, taken: false });
  }
  for (let at = 8; at <= 20; at += 3) coins.push({ at, lane: 0, y: .9, taken: false });
  return { obstacles, coins, turns };
}

/** Independent simulation shared by the two runners, with different routes and hazards. */
export class RunnerRun extends ArcadeRun {
  distance = 0; lane = 0; x = 0; y = 0; vy = 0; slide = 0; coins = 0; chain = 0;
  invulnerable = 0; shield = 0; shieldCooldown = 0; airborne = false; roof = 0;
  obstacles: RunnerObstacle[] = []; tokens: RunnerCoin[] = []; turns: RunnerTurn[] = [];
  private gesture: { x: number; y: number; id: number } | null = null;
  constructor(readonly theme: RunnerTheme, checkpoint?: unknown) {
    const c = theme === 'temple' ? templeCatalog : subwayCatalog;
    super(theme === 'temple' ? 'temple-race' : 'subway-runnerz', c.defaults, c.schema, checkpoint);
  }
  get goal() { return runnerGoal(this.level); }
  get nextTurn() { return this.turns.find(t => !t.passed); }
  protected setup(): void {
    const c = runnerCourse(this.theme, this.level); this.obstacles = c.obstacles; this.tokens = c.coins; this.turns = c.turns;
    this.distance = 0; this.lane = 0; this.x = 0; this.y = 0; this.vy = 0; this.slide = 0; this.coins = 0; this.chain = 0;
    this.invulnerable = 1; this.shield = 0; this.shieldCooldown = 0; this.roof = 0; this.airborne = false; this.gesture = null;
    this.notice = this.theme === 'temple' ? 'Follow the gold. Swipe or use arrows. Turn at the amber signs.' : 'Choose a track. Jump barriers, duck signs and take ramps onto train roofs.';
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'left' || action === 'right') {
      const direction = action === 'left' ? -1 : 1, turn = this.nextTurn;
      if (turn && turn.at - this.distance <= 13 && turn.at > this.distance) {
        turn.queued = direction === turn.direction; this.notice = turn.queued ? 'TURN LOCKED IN. Keep running!' : 'Other way! Follow the amber arrow.';
      } else this.lane = clamp(this.lane + direction, -1, 1);
      this.metrics.actions++;
    }
    if ((action === 'primary' || action === 'up') && this.y <= this.roof + .04 && this.vy <= .01) {
      this.vy = this.config.power; this.slide = 0; this.airborne = true; this.metrics.actions++; this.cue('launch', 0, 0);
    }
    if (action === 'down') { this.slide = .75; if (this.vy > -8 && this.y > this.roof) this.vy = -14; this.metrics.actions++; }
    if (action === 'ability' && this.config.overdrive && this.shieldCooldown <= 0) {
      this.shield = this.theme === 'temple' ? 7 : 9; this.shieldCooldown = 16; this.metrics.actions++;
      this.notice = this.theme === 'temple' ? 'ANCIENT AEGIS. One crash forgiven.' : 'BOARD UP. Surf through one collision.'; this.cue('ability', 0, 0, this.theme === 'temple' ? 'AEGIS' : 'BOARD UP');
    }
  }
  protected tick(dt: number): void {
    const previous = this.distance; this.distance = Math.min(this.goal, this.distance + dt * this.config.speed * (1 + Math.min(.3, (this.level - 1) * .035)));
    this.x += (this.lane * 2.15 - this.x) * Math.min(1, dt * 17);
    this.slide = Math.max(0, this.slide - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shield = this.config.overdrive ? Math.max(0, this.shield - dt) : 0; this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    const roof = this.obstacles.find(o => o.kind === 'train' && Math.abs(o.lane * 2.15 - this.x) < .75 && this.distance >= o.at - (o.ramp ? 5 : 0) && this.distance <= o.at + o.length);
    const surface = roof ? this.distance < roof.at ? (this.distance - roof.at + 5) / 5 * 2.6 : 2.6 : 0;
    // A ramp is a continuous surface. Entering a train sideways is still a collision.
    this.roof = roof?.ramp || this.y >= 2.5 ? surface : 0;
    this.vy -= this.config.gravity * dt; this.y += this.vy * dt;
    if (this.y <= this.roof) { if (this.airborne && this.vy < -3) this.cue('hit', 0, 0); this.y = this.roof; this.vy = 0; this.airborne = false; }
    for (const t of this.turns) if (!t.passed && previous < t.at && this.distance >= t.at) {
      t.passed = true;
      if (!t.queued) this.crash('MISSED TURN. Watch for the amber arrow.');
      else { this.metrics.perfects++; this.addScore(60, 0, 0, 'CLEAN TURN +60'); this.notice = 'Perfect turn. Next stretch, new choices.'; }
    }
    for (const o of this.obstacles) {
      if (o.passed) continue;
      if (o.moving) o.at -= dt * 1.6;
      const overlap = this.distance >= o.at - .45 && this.distance <= o.at + o.length;
      const sameLane = Math.abs(this.x - o.lane * 2.15) < .72;
      const danger = o.kind === 'hurdle' ? this.y < .85 : o.kind === 'arch' ? this.slide <= 0 || this.y > .35 : o.kind === 'gap' ? this.y < .55 : this.y < 2.4 && (!o.ramp || this.distance >= o.at);
      if (overlap && sameLane && danger && !o.hit) { o.hit = true; this.crash(o.kind === 'arch' ? 'Duck the overhead sign. Down or SLIDE.' : o.kind === 'gap' ? 'Jump the broken path. Up or JUMP.' : o.kind === 'train' ? 'Train ahead. Change track or use its ramp.' : 'Barrier ahead. Jump or change lane.'); }
      if (this.distance > o.at + o.length) { o.passed = true; if (!o.hit) { this.metrics.perfects++; this.addScore(15, 0, 0, 'CLEAR +15'); } }
    }
    for (const c of this.tokens) {
      if (c.taken || Math.abs(c.at - this.distance) > 1.15) continue;
      const close = Math.abs(c.lane * 2.15 - this.x) < (this.config.assist ? 4.7 : .85), height = Math.abs(c.y - (this.y + .8)) < (this.config.assist ? 4 : 1.05);
      if (close && height) { c.taken = true; this.coins++; this.chain++; if (this.config.assist && Math.abs(c.lane * 2.15 - this.x) > .85) this.metrics.assisted++;
        const multiplier = 1 + Math.min(3, Math.floor(this.chain / 10)); this.addScore(this.config.bonus * multiplier, 0, 0, this.chain % 10 === 0 ? `COIN CHAIN ×${multiplier}` : undefined);
      }
    }
    if (this.distance >= this.goal && this.phase === 'playing') { this.addScore(250 + this.coins * 5, 0, 0, 'BEACON REACHED'); this.clear(0, 0); }
  }
  private crash(message: string): void {
    if (this.invulnerable > 0) return;
    if (this.shield > 0) { this.shield = 0; this.invulnerable = 1.6; this.notice = 'SHIELD SAVE. Keep the streak alive.'; this.metrics.assisted++; this.cue('ability', 0, 0, 'SAVED'); return; }
    this.chain = 0; this.invulnerable = 2; this.lose(0, 0, message);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId = 0): void {
    if (phase === 'cancel') { this.gesture = null; return; }
    if (this.phase !== 'playing') return;
    if (phase === 'down') { if (!this.gesture) this.gesture = { x, y, id: pointerId }; return; }
    if (this.gesture?.id !== pointerId) return;
    if (phase === 'up') {
      const dx = x - this.gesture.x, dy = y - this.gesture.y; this.gesture = null;
      if (Math.hypot(dx, dy) < 24) this.action('primary'); else this.action(Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down');
    }
  }
  protected runtime() { return { distance: Math.floor(this.distance), coins: this.coins, streak: this.chain }; }
  protected stageSummary() { return { coins: this.coins, chain: this.chain, lives: this.lives }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.distance = this.goal; this.coins = Math.floor(summary.coins ?? 0); this.chain = Math.floor(summary.chain ?? 0); this.lives = Math.floor(summary.lives ?? this.config.lives); this.obstacles.forEach(o => { o.passed = true; }); this.turns.forEach(t => { t.passed = true; }); }
  stats() { return [{ label: 'DISTANCE', value: `${Math.floor(this.distance)}m` }, { label: 'COINS', value: this.coins }, { label: this.theme === 'temple' ? 'CHARMS' : 'CHANCES', value: this.lives }]; }
}

/** Piecewise path frame for real right-angle temple corners; forward is initially -Z. */
export function runnerFrame(distance: number, theme: RunnerTheme, level = 1): { x: number; z: number; yaw: number } {
  if (theme === 'subway' || distance <= 0) return { x: 0, z: -distance, yaw: 0 };
  let x = 0, z = 0, yaw = 0, previous = 0;
  for (let at = 72, i = 0; at < runnerGoal(level) - 25; at += 72, i++) { const length = Math.min(distance, at) - previous; if (length > 0) { x -= Math.sin(yaw) * length; z -= Math.cos(yaw) * length; } if (distance <= at) return { x, z, yaw }; previous = at; yaw -= (i % 2 ? -1 : 1) * Math.PI / 2; }
  const length = distance - previous; return { x: x - Math.sin(yaw) * length, z: z - Math.cos(yaw) * length, yaw };
}
