import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { slingersCatalog } from './catalog';
import { World2D, type Body } from './physics2d';
import { slingLevel, slingLevelName, type BladeKind, type Material, type RobotKind, type SlingLevel } from './levels';

export const SLING = { x: 0, y: 2.3 }, MAX_PULL = 3.2, STEP = 1 / 240;
export type PieceKind = Material | RobotKind | 'blade' | 'ground';
export interface Piece { kind: PieceKind; hp: number; maxHp: number; blade?: BladeKind; born: number }
const HP: Record<Material | RobotKind, number> = { wood: 40, glass: 16, steel: 130, tnt: 6, robot: 22, helmet: 55, boss: 280 };
const FRAGILITY: Record<Material | RobotKind, number> = { wood: .8, glass: 1.8, steel: .25, tnt: 3, robot: 1.4, helmet: .8, boss: .4 };
const DENSITY: Record<Material, number> = { wood: .7, glass: .6, steel: 3, tnt: .8 };
const POINTS: Record<Material, number> = { wood: 100, glass: 60, steel: 250, tnt: 150 };
const BLADE_RADIUS: Record<BladeKind, number> = { saw: .32, split: .27, turbo: .3, bomb: .38 };
export const pieceOf = (b: Body) => b.tag as Piece;

export class SlingersRun extends ArcadeRun {
  world = new World2D(); stage: SlingLevel = slingLevel(1);
  /** Blades still waiting in the rack (the loaded one is queue[0]). */
  queue: BladeKind[] = []; flying: Body[] = []; special = false;
  aimAngle = .55; aimPower = .85; dragging = false; pull = { x: 0, y: 0 }; private dragStart = { x: 0, y: 0 };
  state: 'aim' | 'flight' | 'settle' = 'aim'; settleTimer = 0; lastPath: { x: number; y: number }[] = []; path: { x: number; y: number }[] = [];
  robotsLeft = 0; private clock = 0; private pathTimer = 0; private grace = 0; private exploding: { x: number; y: number; r: number }[] = [];
  constructor(checkpoint?: unknown) { super('makita-slingers', slingersCatalog.defaults, slingersCatalog.schema, checkpoint); this.build(); }
  get levelName() { return slingLevelName(this.level); }
  get gravity() { return this.config.gravity / 32; }
  get maxSpeed() { return this.config.power * .19; }
  get loaded(): BladeKind | null { return this.state === 'aim' && this.queue.length ? this.queue[0] : null; }
  get structureEnd() { return Math.max(...this.stage.blocks.map(b => b.x + b.w / 2), ...this.stage.robots.map(r => r.x + 1), ...this.stage.hills.map(h => h.x + h.w / 2)); }
  private build() {
    this.stage = slingLevel(this.level); const w = new World2D(); this.world = w; w.gravity = -this.gravity;
    const ground = (x: number, y: number, width: number, h: number) => w.add('box', x, y, { w: width, h }, 0, { friction: .8, tag: { kind: 'ground', hp: Infinity, maxHp: Infinity, born: 0 } satisfies Piece });
    ground(10, -1, 80, 2); ground(-1.2, .45, 4, .9);
    for (const h of this.stage.hills) ground(h.x, h.h / 2, h.w, h.h);
    for (const b of this.stage.blocks) w.add('box', b.x, b.y, { w: b.w, h: b.h }, DENSITY[b.material], { friction: b.material === 'glass' ? .4 : .7, restitution: .05, tag: { kind: b.material, hp: HP[b.material], maxHp: HP[b.material], born: 0 } satisfies Piece });
    for (const r of this.stage.robots) { const size = r.kind === 'boss' ? 1.5 : .84; w.add('box', r.x, r.y, { w: size, h: size }, .9, { friction: .8, tag: { kind: r.kind, hp: HP[r.kind], maxHp: HP[r.kind], born: 0 } satisfies Piece }); }
    // Settle the structures before anything can take damage, then freeze them.
    for (let i = 0; i < 480; i++) w.step(STEP);
    for (const b of w.bodies) { b.vx = b.vy = b.w0 = 0; b.awake = false; }
    w.onImpact = (a, b, speed) => { this.impact(a, b, speed); };
    this.robotsLeft = this.stage.robots.length;
  }
  protected setup(): void {
    this.build(); this.queue = Array.from({ length: Math.max(1, this.config.lives) }, (_, i) => this.stage.blades[i % this.stage.blades.length]);
    this.lives = this.queue.length; this.flying = []; this.special = false; this.state = 'aim'; this.settleTimer = 0; this.path = []; this.lastPath = []; this.dragging = false; this.pull = { x: 0, y: 0 };
    this.clock = 0; this.grace = .4; this.exploding = []; this.aimAngle = .55; this.aimPower = .85;
    this.notice = `${this.levelName.toUpperCase()} · ${this.stage.tip}`;
  }
  /** Launch velocity for the current aim (or drag). */
  velocity(): { x: number; y: number } {
    const speed = this.maxSpeed * this.aimPower; return { x: Math.cos(this.aimAngle) * speed, y: Math.sin(this.aimAngle) * speed };
  }
  /** Predicted path of a blade fired with the current aim, for the trajectory guide. */
  preview(points = 36): { x: number; y: number }[] {
    const v = this.velocity(), g = this.gravity, out: { x: number; y: number }[] = [];
    for (let i = 1; i <= points; i++) { const t = i * .07, y = SLING.y + v.y * t - g * t * t / 2; if (y < -.2) break; out.push({ x: SLING.x + v.x * t, y }); }
    return out;
  }
  fire(): boolean {
    const kind = this.loaded; if (this.phase !== 'playing' || !kind || this.aimPower < .1) return false;
    const v = this.velocity(), blade = this.world.add('circle', SLING.x, SLING.y, { r: BLADE_RADIUS[kind] }, kind === 'bomb' ? 6 : 5, { friction: .5, restitution: .3, tag: { kind: 'blade', hp: Infinity, maxHp: Infinity, blade: kind, born: this.elapsed } satisfies Piece });
    blade.vx = v.x; blade.vy = v.y; blade.w0 = -14;
    this.queue.shift(); this.lives = this.queue.length; this.flying = [blade]; this.special = false; this.state = 'flight'; this.settleTimer = 0;
    this.lastPath = this.path; this.path = []; this.pathTimer = 0; this.dragging = false; this.pull = { x: 0, y: 0 };
    this.metrics.actions++; if (this.config.assist) this.metrics.assisted++;
    this.cue('launch', SLING.x, SLING.y); this.notice = kind === 'saw' ? 'BLADE AWAY!' : 'BLADE AWAY! Tap again in flight for its special move.'; return true;
  }
  /** Tap in flight: each blade has its own trick. */
  private trigger(): void {
    if (this.state !== 'flight' || this.special || !this.flying.length) return;
    const lead = this.flying[0], piece = pieceOf(lead), kind = piece.blade!; this.special = true;
    if (kind === 'split') {
      const speed = Math.hypot(lead.vx, lead.vy), heading = Math.atan2(lead.vy, lead.vx);
      for (const spread of [-.22, .22]) { const copy = this.world.add('circle', lead.x, lead.y, { r: .22 }, 5, { friction: .5, restitution: .3, tag: { ...piece } }); copy.vx = Math.cos(heading + spread) * speed; copy.vy = Math.sin(heading + spread) * speed; copy.w0 = -14; this.flying.push(copy); }
      this.cue('ability', lead.x, lead.y, 'SPLIT!');
    } else if (kind === 'turbo') { lead.vx *= 2.1; lead.vy *= 1.4; this.cue('ability', lead.x, lead.y, 'TURBO!'); }
    else if (kind === 'bomb') this.detonate(lead);
    else { this.special = false; return; }
    this.metrics.actions++;
  }
  private detonate(blade: Body): void {
    this.blast(blade.x, blade.y, 3.2, 70); this.world.remove(blade); this.flying = this.flying.filter(b => b !== blade); this.cue('ability', blade.x, blade.y, 'KABOOM!');
  }
  private blast(x: number, y: number, radius: number, power: number): void {
    this.exploding.push({ x, y, r: radius });
    for (const b of this.world.explode(x, y, radius, power)) { const p = pieceOf(b); if (p.kind !== 'blade' && p.kind !== 'ground') p.hp -= power * 2.2 * (1 - Math.min(1, Math.hypot(b.x - x, b.y - y) / radius)) * FRAGILITY[p.kind]; }
  }
  private impact(a: Body, b: Body, speed: number): void {
    if (this.grace > 0 || speed < 2.5) return;
    for (const [self, other] of [[a, b], [b, a]] as const) {
      const p = pieceOf(self), o = pieceOf(other); if (p.kind === 'blade' || p.kind === 'ground') continue;
      const weight = other.invMass === 0 ? 2 : Math.min(2, other.mass), cut = o.kind === 'blade' ? 1.5 : 1;
      p.hp -= (speed - 2.5) * 6 * weight * cut * FRAGILITY[p.kind];
      if (o.kind === 'blade') { const piece = pieceOf(other); if (piece.blade === 'bomb' && !this.special && this.flying.includes(other)) { this.special = true; this.detonate(other); } }
    }
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' || action === 'launch') { if (this.state === 'aim') this.fire(); else this.trigger(); }
    if (this.state === 'aim' && (action === 'up' || action === 'down')) { this.aimAngle = clamp(this.aimAngle + (action === 'up' ? .05 : -.05), -.2, 1.35); this.metrics.actions++; }
    if (this.state === 'aim' && (action === 'left' || action === 'right')) { this.aimPower = clamp(this.aimPower + (action === 'right' ? .05 : -.05), .2, 1); this.metrics.actions++; }
    if (action === 'ability' && this.config.overdrive && this.state === 'flight' && this.flying.length) { this.special = true; this.detonate(this.flying[0]); this.metrics.actions++; }
  }
  /** Drag anywhere: pull back and down to aim up and forward; release to fire. Taps in flight trigger specials. */
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number): void {
    if (phase === 'cancel') { this.dragging = false; this.pull = { x: 0, y: 0 }; return; }
    if (this.phase !== 'playing') return;
    if (this.state === 'flight') { if (phase === 'down') this.trigger(); return; }
    if (this.state !== 'aim') return;
    if (phase === 'down') { this.dragging = true; this.dragStart = { x, y }; this.pull = { x: 0, y: 0 }; return; }
    if (!this.dragging) return;
    const dx = x - this.dragStart.x, dy = y - this.dragStart.y, length = Math.hypot(dx, dy), scale = length > MAX_PULL ? MAX_PULL / length : 1;
    this.pull = { x: dx * scale, y: dy * scale };
    if (length > .15) { this.aimAngle = clamp(Math.atan2(-dy, -dx), -.2, 1.35); this.aimPower = clamp(Math.min(length, MAX_PULL) / MAX_PULL, .1, 1); }
    if (phase === 'up') { this.dragging = false; if (length > .3) this.fire(); this.pull = { x: 0, y: 0 }; }
  }
  protected tick(dt: number): void {
    this.world.gravity = -this.gravity; this.grace = Math.max(0, this.grace - dt); this.clock += dt;
    while (this.clock >= STEP) { this.world.step(STEP); this.clock -= STEP; }
    this.exploding = [];
    // Pieces that ran out of health break apart; crates take their neighbours with them.
    for (const b of [...this.world.bodies]) {
      const p = pieceOf(b);
      if (p.kind === 'blade' || p.kind === 'ground') continue;
      if (b.y < -3 || Math.abs(b.x) > 80) p.hp = 0;
      if (p.hp > 0) continue;
      this.world.remove(b);
      if (p.kind === 'robot' || p.kind === 'helmet' || p.kind === 'boss') { this.robotsLeft--; this.metrics.perfects++; this.addScore(this.config.bonus * (p.kind === 'boss' ? 3 : 1), b.x, b.y, `ROBOT +${this.config.bonus * (p.kind === 'boss' ? 3 : 1)}`); }
      else { this.addScore(POINTS[p.kind], b.x, b.y); if (p.kind === 'tnt') { this.blast(b.x, b.y, 3, 60); this.cue('hit', b.x, b.y, 'BOOM!'); } }
      this.cue('hit', b.x, b.y);
    }
    if (this.state === 'flight') {
      const lead = this.flying[0];
      if (lead) { this.pathTimer -= dt; if (this.pathTimer <= 0) { this.path.push({ x: lead.x, y: lead.y }); this.pathTimer = .045; } }
      for (const blade of [...this.flying]) if (blade.y < -2 || blade.x > this.structureEnd + 12 || Math.hypot(blade.vx, blade.vy) < .5 && this.elapsed - pieceOf(blade).born > 1.2) {
        this.flying = this.flying.filter(f => f !== blade);
      }
      if (!this.flying.length || this.elapsed - (pieceOf(this.flying[0]).born) > 9) { this.state = 'settle'; this.settleTimer = 0; }
    }
    if (this.state === 'settle') {
      this.settleTimer += dt;
      const calm = this.world.bodies.every(b => !b.awake || b.invMass === 0 || pieceOf(b).kind === 'blade' || Math.hypot(b.vx, b.vy) < .3);
      if (this.robotsLeft <= 0 && this.settleTimer > .8) {
        const bonus = this.queue.length * 500; this.addScore(bonus, 0, 0, bonus ? `${this.queue.length} SPARE BLADES +${bonus}` : 'CLEARED!'); this.clear(0, 0); return;
      }
      if (calm && this.settleTimer > 1 || this.settleTimer > 5) {
        for (const b of this.world.bodies.filter(b => pieceOf(b).kind === 'blade')) this.world.remove(b);
        if (!this.queue.length) { this.phase = 'gameover'; this.notice = 'Out of blades. Try a different angle: hit the supports, not the walls.'; this.cue('lose', 0, 0, 'OUT OF BLADES'); this.releaseInput(); return; }
        this.state = 'aim'; this.notice = `${this.robotsLeft} robot${this.robotsLeft === 1 ? '' : 's'} left. Next blade: ${this.queue[0].toUpperCase()}.`;
      }
    }
  }
  get stars(): number { const max = this.stage.robots.length * this.config.bonus + this.stage.blocks.length * 100 + (this.stage.blades.length - 1) * 500; const got = this.score; return got >= max * .7 ? 3 : got >= max * .45 ? 2 : 1; }
  protected runtime() { return { robots: this.robotsLeft, blades: this.queue.length }; }
  protected stageSummary() { return { blades: this.queue.length }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.queue = this.queue.slice(0, clamp(Math.floor(summary.blades ?? 0), 0, this.queue.length)); this.lives = this.queue.length; this.robotsLeft = 0; for (const b of [...this.world.bodies]) { const k = pieceOf(b).kind; if (k === 'robot' || k === 'helmet' || k === 'boss') this.world.remove(b); } }
  stats() { return [{ label: 'BLADES', value: this.queue.length }, { label: 'ROBOTS', value: this.robotsLeft }, { label: 'AIM', value: `${Math.round(this.aimAngle * 180 / Math.PI)}°` }]; }
}
