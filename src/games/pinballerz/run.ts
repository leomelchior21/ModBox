import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { pinballCatalog } from './catalog';
export interface Pinball { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[] }
export interface Bumper { x: number; y: number; radius: number; flash: number; cooldown: number }
export interface Flipper { x: number; y: number; angle: number; omega: number; left: boolean; cooldown: number; pressed: number }
export const PIN_RAILS: readonly (readonly [number, number, number, number])[] = [
  [70, 110, 210, 52], [210, 52, 430, 52], [430, 52, 580, 110], [70, 110, 48, 620], [580, 110, 592, 880],
  [520, 340, 520, 905], [48, 620, 146, 754], [520, 620, 475, 754],
  [95, 535, 178, 634], [178, 634, 105, 675], [105, 675, 95, 535],
  [475, 535, 392, 634], [392, 634, 465, 675], [465, 675, 475, 535],
];
export function closestSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / Math.max(1e-6, dx * dx + dy * dy), 0, 1);
  return { x: ax + dx * t, y: ay + dy * t, t };
}
export class PinballRun extends ArcadeRun {
  ball: Pinball = { x: 560, y: 830, vx: 0, vy: 0, trail: [] }; waiting = true;
  bumpers: Bumper[] = []; flippers: Flipper[] = []; targets = [false, false, false]; targetFlash = [0, 0, 0];
  hits = 0; nudges = 3; nudgeCooldown = 0; saveTimer = 0; saveUsed = false; stageScore = 0; pulse = 0;
  private trailTimer = 0; private stuck = 0;
  private pointerSides = new Map<number, 'left' | 'right'>();
  constructor(checkpoint?: unknown) { super('pinballerz', pinballCatalog.defaults, pinballCatalog.schema, checkpoint); }
  get goal(): number { return 1500 + (this.level - 1) * 500; }
  protected setup(): void {
    this.pointerSides.clear();
    this.bumpers = [[220, 270], [390, 270], [305, 410]].map(([x, y]) => ({ x, y, radius: 39, flash: 0, cooldown: 0 }));
    this.flippers = [{ x: 160, y: 773, angle: 0.35, omega: 0, left: true, cooldown: 0, pressed: 0 }, { x: 460, y: 773, angle: Math.PI - 0.35, omega: 0, left: false, cooldown: 0, pressed: 0 }];
    this.targets = [false, false, false]; this.targetFlash = [0, 0, 0]; this.hits = 0; this.nudges = 3; this.nudgeCooldown = 0; this.stageScore = this.score; this.pulse = 0; this.serve();
    this.notice = 'Launch, then time the flippers. Light all three stars for a jackpot.';
  }
  private serve(): void { this.ball = { x: 560, y: 830, vx: 0, vy: 0, trail: [] }; this.waiting = true; this.saveUsed = false; this.saveTimer = 0; this.stuck = 0; }
  launchBall(): boolean {
    if (this.phase !== 'playing' || !this.waiting) return false;
    this.waiting = false; this.ball.vx = -35; this.ball.vy = -1100; this.metrics.actions++; this.saveTimer = this.config.assist ? 7 : 0;
    this.cue('launch', this.ball.x, this.ball.y); this.notice = 'BALL IN PLAY. Left/right arrows or the touch flippers.'; return true;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' || action === 'launch') { if (!this.launchBall()) this.pulse = 0.17; }
    if (action === 'nudge' || action === 'ability') {
      if (this.waiting || this.nudges <= 0 || this.nudgeCooldown > 0) return;
      this.nudges--; this.nudgeCooldown = 2; this.ball.vy -= 250; this.ball.vx += (310 - this.ball.x) * 0.7; this.metrics.actions++; this.cue('ability', this.ball.x, this.ball.y, 'NUDGE'); this.notice = `${this.nudges} nudges left. Keep them for a close call.`;
    }
    if (action === 'left' || action === 'right') { this.metrics.actions++; const f = this.flippers.find(f => f.left === (action === 'left')); if (f) f.pressed = 0.18; }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, _y: number, pointerId = 0): void {
    if (phase === 'move' && !this.pointerSides.has(pointerId)) return;
    if (phase === 'cancel') this.pointerSides.clear();
    else if (phase === 'up') this.pointerSides.delete(pointerId);
    else if (phase === 'down' || phase === 'move' && this.pointerSides.has(pointerId)) this.pointerSides.set(pointerId, x < 320 ? 'left' : 'right');
    this.input.left = [...this.pointerSides.values()].includes('left'); this.input.right = [...this.pointerSides.values()].includes('right');
    if (phase === 'down' && this.waiting) { this.launchBall(); return; }
  }
  protected tick(dt: number): void {
    this.pulse = Math.max(0, this.pulse - dt); this.nudgeCooldown = Math.max(0, this.nudgeCooldown - dt); this.saveTimer = Math.max(0, this.saveTimer - dt);
    for (const b of this.bumpers) { b.flash = Math.max(0, b.flash - dt); b.cooldown = Math.max(0, b.cooldown - dt); }
    this.targetFlash = this.targetFlash.map(t => Math.max(0, t - dt));
    for (const f of this.flippers) {
      f.cooldown = Math.max(0, f.cooldown - dt); f.pressed = Math.max(0, f.pressed - dt);
      const held = this.pulse > 0 || (f.left ? this.input.left : this.input.right) || f.pressed > 0;
      const target = f.left ? held ? -0.5 : 0.35 : held ? Math.PI + 0.5 : Math.PI - 0.35;
      const previous = f.angle; f.angle += clamp(target - f.angle, -dt * 16, dt * 16); f.omega = (f.angle - previous) / dt;
    }
    if (this.waiting) return;
    const b = this.ball;
    b.vy += this.config.gravity * (1 + Math.min(0.25, (this.level - 1) * 0.035)) * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    b.vx *= Math.exp(-dt * 0.025); b.vy *= Math.exp(-dt * 0.025);
    // The top-of-lane deflector sends the launch into the jet-bumper cluster.
    if (b.y < 185 && b.x > 515) { b.vx = -510; b.vy = 180; }
    if (b.x < 43) { b.x = 43; b.vx = Math.abs(b.vx) * 0.88; } if (b.x > 597) { b.x = 597; b.vx = -Math.abs(b.vx) * 0.88; }
    if (b.y < 65) { b.y = 65; b.vy = Math.abs(b.vy) * 0.9; }
    for (const [ax, ay, bx, by] of PIN_RAILS) this.rail(ax, ay, bx, by, 7);
    for (const bumper of this.bumpers) {
      const dx = b.x - bumper.x, dy = b.y - bumper.y, distance = Math.hypot(dx, dy), min = bumper.radius + 13;
      if (distance >= min) continue;
      const nx = distance > 0.001 ? dx / distance : 0, ny = distance > 0.001 ? dy / distance : -1; b.x = bumper.x + nx * (min + 1); b.y = bumper.y + ny * (min + 1);
      if (bumper.cooldown <= 0) { const speed = Math.max(520, Math.hypot(b.vx, b.vy) * 0.95); b.vx = nx * speed; b.vy = ny * speed; bumper.flash = 0.25; bumper.cooldown = 0.12; this.hits++; this.addScore(this.config.bonus * (this.config.overdrive ? 2 : 1), bumper.x, bumper.y); this.cue('hit', bumper.x, bumper.y); }
    }
    for (const [i, target] of [[145, 180], [305, 125], [465, 180]].entries()) {
      const dx = b.x - target[0], dy = b.y - target[1], distance = Math.hypot(dx, dy);
      if (distance >= 35 || this.targetFlash[i] > 0) continue;
      const nx = dx / Math.max(1, distance), ny = dy / Math.max(1, distance); b.vx += nx * 270; b.vy += ny * 270; this.targetFlash[i] = 0.3;
      if (!this.targets[i]) { this.targets[i] = true; this.metrics.perfects++; this.addScore(150, target[0], target[1], 'STAR +150'); }
      if (this.targets.every(Boolean)) { this.addScore(this.config.overdrive ? 1000 : 500, 305, 210, 'THREE STAR JACKPOT'); this.targets = [false, false, false]; this.cue('perfect', 305, 240, 'JACKPOT'); }
    }
    for (const f of this.flippers) {
      const ex = f.x + Math.cos(f.angle) * 128, ey = f.y + Math.sin(f.angle) * 128;
      const contact = closestSegment(b.x, b.y, f.x, f.y, ex, ey), dx = b.x - contact.x, dy = b.y - contact.y, distance = Math.hypot(dx, dy);
      if (distance >= 27) continue;
      const nx = distance > 0.001 ? dx / distance : 0, ny = distance > 0.001 ? dy / distance : -1;
      b.x = contact.x + nx * 27.2; b.y = contact.y + ny * 27.2;
      const sx = -f.omega * (contact.y - f.y), sy = f.omega * (contact.x - f.x), relative = (b.vx - sx) * nx + (b.vy - sy) * ny;
      if (relative < 0) { b.vx -= relative * 1.7 * nx; b.vy -= relative * 1.7 * ny; }
      if (f.cooldown <= 0 && (Math.abs(f.omega) > 1 || f.pressed > 0 || this.pulse > 0) && ny < 0.5) { b.vy = Math.min(b.vy, -this.config.power * (0.65 + contact.t * 0.35)); b.vx += (f.left ? 1 : -1) * this.config.power * 0.15; f.cooldown = 0.1; this.cue('launch', b.x, b.y); }
    }
    const speed = Math.hypot(b.vx, b.vy); if (speed > 1450) { b.vx *= 1450 / speed; b.vy *= 1450 / speed; }
    this.stuck = speed < 35 ? this.stuck + dt : 0; if (this.stuck > 2) { b.vy = -280; b.vx += 100; this.stuck = 0; }
    this.trailTimer -= dt; if (this.trailTimer <= 0) { b.trail.push({ x: b.x, y: b.y }); b.trail = b.trail.slice(-18); this.trailTimer = 0.018; }
    if (this.score - this.stageScore >= this.goal) { this.clear(310, 430); return; }
    if (b.y > 925) {
      if (this.config.assist && this.saveTimer > 0 && !this.saveUsed) { this.saveUsed = true; this.metrics.assisted++; b.x = 560; b.y = 820; b.vx = -35; b.vy = -1100; b.trail = []; this.cue('ability', 310, 780, 'BALL SAVED'); this.notice = 'BALL SAVED. You are still in the game!'; }
      else { this.lose(310, 810, 'BALL DRAINED'); if (this.phase === 'playing') this.serve(); }
    }
  }
  private rail(ax: number, ay: number, bx: number, by: number, radius: number): void {
    const b = this.ball, point = closestSegment(b.x, b.y, ax, ay, bx, by), dx = b.x - point.x, dy = b.y - point.y, distance = Math.hypot(dx, dy), min = radius + 13;
    if (distance >= min || distance < 0.001) return;
    const nx = dx / distance, ny = dy / distance; b.x = point.x + nx * min; b.y = point.y + ny * min;
    const relative = b.vx * nx + b.vy * ny; if (relative < 0) { b.vx -= relative * 1.87 * nx; b.vy -= relative * 1.87 * ny; }
  }
  stats() { return [{ label: 'BALLS', value: this.lives }, { label: 'BUMPER HITS', value: this.hits }, { label: 'TARGET', value: this.goal }]; }
}
