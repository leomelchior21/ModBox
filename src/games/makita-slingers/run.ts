import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { slingersCatalog } from './catalog';

export interface SlingBody { id: number; kind: 'wood' | 'steel' | 'crate' | 'robot' | 'helmet'; x: number; y: number; w: number; h: number; vx: number; vy: number; angle: number; spin: number; hp: number; maxHp: number; mass: number; flash: number }
export interface Sawblade { x: number; y: number; vx: number; vy: number; age: number; hits: number[]; blasted: boolean; trail: { x: number; y: number }[] }
export const SLING = { x: 160, y: 425 }, FLOOR = 562;
export class SlingersRun extends ArcadeRun {
  bodies: SlingBody[] = []; blade: Sawblade | null = null; aim = { x: -96, y: 22 }; dragging = false; angle = 13; flightWait = 0;
  private nextId = 1; private trailTimer = 0;
  constructor(checkpoint?: unknown) { super('makita-slingers', slingersCatalog.defaults, slingersCatalog.schema, checkpoint); }
  protected setup(): void {
    this.bodies = []; this.blade = null; this.dragging = false; this.flightWait = 0; this.angle = 13; this.setAim(); this.nextId = 1;
    const body = (kind: SlingBody['kind'], x: number, y: number, w: number, h: number) => {
      const hp = (kind === 'steel' ? 95 : kind === 'robot' ? 52 : kind === 'helmet' ? 90 : kind === 'crate' ? 28 : 42) * (1 + Math.min(5, this.level - 1) * 0.08);
      this.bodies.push({ id: this.nextId++, kind, x, y, w, h, vx: 0, vy: 0, angle: 0, spin: 0, hp, maxHp: hp, mass: kind === 'steel' ? 3 : kind === 'robot' || kind === 'helmet' ? 1.2 : 1.8, flash: 0 });
    };
    for (const [i, x] of [615, 800].entries()) {
      const steel = this.level > 1 && i === 1;
      body(steel ? 'steel' : 'wood', x - 38, 507, 22, 110); body('wood', x + 38, 507, 22, 110);
      body('wood', x, 440, 132, 24); body(i === 1 && this.level > 1 ? 'helmet' : 'robot', x, 403, 44, 50);
      if (this.level > 2) body('crate', x + 8, 355, 44, 44);
    }
    body('crate', 884, 530, 48, 64); body('helmet', 934, 536, 42, 52);
    this.notice = 'Pull the blade back, then release. Aim for the supports.';
  }
  private setAim(): void { this.aim = { x: -Math.cos(this.angle * Math.PI / 180) * 100, y: Math.sin(this.angle * Math.PI / 180) * 100 }; }
  velocity(): { x: number; y: number } { return { x: -this.aim.x * this.config.power * 0.08, y: -this.aim.y * this.config.power * 0.08 }; }
  fire(): boolean {
    if (this.phase !== 'playing' || this.blade || this.lives <= 0 || Math.hypot(this.aim.x, this.aim.y) < 12) return false;
    const v = this.velocity(); this.blade = { x: SLING.x, y: SLING.y, vx: v.x, vy: v.y, age: 0, hits: [], blasted: false, trail: [] };
    this.lives--; this.metrics.actions++; if (this.config.assist) this.metrics.assisted++;
    this.dragging = false; this.cue('launch', SLING.x, SLING.y); this.notice = this.config.overdrive ? 'BLADE AWAY! Press BLAST in flight for a shockwave.' : 'BLADE AWAY! Watch the supports.'; return true;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' || action === 'launch') this.fire();
    if (!this.blade && (action === 'up' || action === 'down')) { this.angle = clamp(this.angle + (action === 'up' ? 3 : -3), 3, 65); this.setAim(); }
    if (action === 'ability' && this.config.overdrive && this.blade && !this.blade.blasted) {
      this.blade.blasted = true; this.explode(this.blade.x, this.blade.y, 145, 100); this.blade.age = 7;
      this.cue('ability', this.blade.x, this.blade.y, 'BLAST BLADE');
    }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number): void {
    if (phase === 'cancel') { this.dragging = false; return; }
    if (this.phase !== 'playing' || this.blade) return;
    if (phase === 'down') this.dragging = Math.hypot(x - SLING.x, y - SLING.y) < 160;
    if (this.dragging && (phase === 'move' || phase === 'down')) { const dx = clamp(x - SLING.x, -115, -8), dy = clamp(y - SLING.y, -25, 110), length = Math.hypot(dx, dy), factor = Math.min(1, 115 / length); this.aim = { x: dx * factor, y: dy * factor }; }
    if (phase === 'up' && this.dragging) this.fire();
  }
  private explode(x: number, y: number, radius: number, damage: number): void {
    for (const b of this.bodies) { const dx = b.x - x, dy = b.y - y, distance = Math.hypot(dx, dy); if (b.hp <= 0 || distance > radius) continue; const strength = 1 - distance / radius; b.hp -= damage * strength; b.vx += (dx / Math.max(20, distance)) * strength * 370 / b.mass; b.vy -= (120 + Math.abs(dy) * 2) * strength / b.mass; b.spin += dx * 0.035; b.flash = 0.2; }
    this.cue('hit', x, y, 'SCRAP STORM', '#ffd28e');
  }
  protected tick(dt: number): void {
    for (const b of this.bodies) {
      if (b.hp <= 0) continue;
      b.flash = Math.max(0, b.flash - dt); b.vy += this.config.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.angle = clamp(b.angle + b.spin * dt, -0.65, 0.65); b.spin *= Math.exp(-dt * 2);
      if (b.y + b.h / 2 > FLOOR) { const impact = b.vy; b.y = FLOOR - b.h / 2; b.vy = Math.abs(b.vy) < 25 ? 0 : -b.vy * 0.12; b.vx *= Math.exp(-dt * 12); if (impact > 125 && this.elapsed > 0.6) b.hp -= (impact - 100) * 0.17; }
      if (b.x < -80 || b.x > 1080 || b.y > 750) b.hp = 0;
    }
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j]; if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, ox = (a.w + b.w) / 2 - Math.abs(dx), oy = (a.h + b.h) / 2 - Math.abs(dy); if (ox <= 0 || oy <= 0) continue;
      const horizontal = ox < oy, nx = horizontal ? Math.sign(dx) || 1 : 0, ny = horizontal ? 0 : Math.sign(dy) || 1;
      const ia = 1 / a.mass, ib = 1 / b.mass, correction = Math.max(0, (horizontal ? ox : oy) - 0.03) * 0.85 / (ia + ib);
      a.x -= nx * correction * ia; a.y -= ny * correction * ia; b.x += nx * correction * ib; b.y += ny * correction * ib;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative < 0) { const impulse = -relative * 1.05 / (ia + ib); a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia; b.vx += impulse * nx * ib; b.vy += impulse * ny * ib; if (pass === 0 && -relative > 95 && this.elapsed > 0.6) { a.hp -= -relative * 0.08; b.hp -= -relative * 0.08; } }
    }
    const blade = this.blade;
    if (blade) {
      blade.age += dt; blade.vy += this.config.gravity * dt; blade.x += blade.vx * dt; blade.y += blade.vy * dt;
      this.trailTimer -= dt; if (this.trailTimer <= 0) { blade.trail.push({ x: blade.x, y: blade.y }); blade.trail = blade.trail.slice(-22); this.trailTimer = 0.025; }
      for (const b of this.bodies) {
        if (b.hp <= 0 || blade.hits.includes(b.id)) continue;
        const cx = clamp(blade.x, b.x - b.w / 2, b.x + b.w / 2), cy = clamp(blade.y, b.y - b.h / 2, b.y + b.h / 2);
        if (Math.hypot(blade.x - cx, blade.y - cy) > 19) continue;
        const speed = Math.hypot(blade.vx, blade.vy); b.hp -= speed * (this.config.overdrive ? 0.25 : 0.16); b.vx += blade.vx * 0.55 / b.mass; b.vy += blade.vy * 0.35 / b.mass - 45; b.spin += blade.vx * 0.008; b.flash = 0.18;
        blade.hits.push(b.id); blade.vx *= 0.76; blade.vy *= 0.85; this.cue('hit', b.x, b.y); this.metrics.perfects += b.kind === 'robot' || b.kind === 'helmet' ? 1 : 0;
      }
      if (blade.y > FLOOR - 15) { blade.y = FLOOR - 15; blade.vy = -Math.abs(blade.vy) * 0.28; blade.vx *= 0.97; }
      if (blade.x > 1080 || blade.x < -80 || blade.age > 6 || Math.hypot(blade.vx, blade.vy) < 30) { this.blade = null; this.flightWait = 1.4; }
    } else this.flightWait = Math.max(0, this.flightWait - dt);
    for (let processed = 0; processed < 40; processed++) {
      const b = this.bodies.find(body => body.hp <= 0); if (!b) break;
      this.bodies = this.bodies.filter(body => body !== b);
      const robot = b.kind === 'robot' || b.kind === 'helmet'; this.addScore(robot ? this.config.bonus : 25, b.x, b.y, robot ? `ROBOT +${this.config.bonus}` : '+25 SCRAP');
      if (b.kind === 'crate') this.explode(b.x, b.y, 125, 85);
    }
    this.bodies = this.bodies.filter(b => b.hp > 0);
    if (!this.bodies.some(b => b.kind === 'robot' || b.kind === 'helmet')) { this.score += this.lives * 100; this.clear(650, 250); }
    else if (!this.blade && this.lives === 0 && this.flightWait <= 0) { this.phase = 'gameover'; this.notice = 'Blade rack empty. Retry the stage and aim for the supports.'; }
  }
  stats() { return [{ label: 'BLADES', value: this.lives }, { label: 'ROBOTS', value: this.bodies.filter(b => b.kind === 'robot' || b.kind === 'helmet').length }, { label: 'AIM', value: `${this.angle}°` }]; }
}
