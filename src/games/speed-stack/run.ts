import { ArcadeRun, type ArcadeAction } from '../premium-kit/core';
import { stackCatalog } from './catalog';
export interface StackSlab { x: number; z: number; w: number; d: number; layer: number; color: number; perfect: boolean }
export interface FallingSlab { slab: StackSlab; vx: number; vz: number; fall: number; velocity: number; age: number }
export function overlap1D(a: number, sizeA: number, b: number, sizeB: number): { start: number; size: number } { const start = Math.max(a, b); return { start, size: Math.max(0, Math.min(a + sizeA, b + sizeB) - start) }; }
export class StackRun extends ArcadeRun {
  slabs: StackSlab[] = []; falling: FallingSlab[] = []; moving: StackSlab = { x: -140, z: -140, w: 280, d: 280, layer: 1, color: 1, perfect: false };
  axis: 'x' | 'z' = 'x'; offset = -320; direction = 1; placed = 0; streak = 0; camera = 0; focus = 0; focusCooldown = 0; dropLock = 0;
  constructor(checkpoint?: unknown) { super('speed-stack', stackCatalog.defaults, stackCatalog.schema, checkpoint); }
  get goal(): number { return Math.min(25, 15 + this.level - 1); }
  protected setup(): void {
    this.slabs = [{ x: -140, z: -140, w: 280, d: 280, layer: 0, color: 0, perfect: true }]; this.falling = []; this.placed = 0; this.streak = 0; this.camera = 0; this.focus = 0; this.focusCooldown = 0; this.dropLock = 0;
    this.spawn(); this.notice = 'Tap DROP or press Space when the slab aligns. Keep it clean.';
  }
  private spawn(): void {
    const top = this.slabs[this.slabs.length - 1]; this.axis = this.placed % 2 ? 'z' : 'x'; this.offset = this.placed % 4 < 2 ? -320 : 320; this.direction = this.offset < 0 ? 1 : -1;
    this.moving = { ...top, layer: this.placed + 1, color: (this.placed + 1) % 4, perfect: false }; this.positionMoving();
  }
  private positionMoving(): void { const top = this.slabs[this.slabs.length - 1]; if (!top) return; this.moving.x = top.x + (this.axis === 'x' ? this.offset : 0); this.moving.z = top.z + (this.axis === 'z' ? this.offset : 0); }
  drop(): boolean {
    if (this.phase !== 'playing' || this.dropLock > 0) return false;
    this.metrics.actions++; this.dropLock = 0.16;
    const top = this.slabs[this.slabs.length - 1], delta = this.axis === 'x' ? this.moving.x - top.x : this.moving.z - top.z;
    const perfect = Math.abs(delta) <= this.config.power + (this.config.assist ? 10 : 0);
    if (perfect) {
      this.moving.x = top.x; this.moving.z = top.z; this.moving.perfect = true; this.streak++; this.metrics.perfects++; if (this.config.assist) this.metrics.assisted++;
      if (this.streak % 3 === 0) { const widen = Math.min(10, 300 - this.moving.w, 300 - this.moving.d); this.moving.x -= widen / 2; this.moving.z -= widen / 2; this.moving.w += widen; this.moving.d += widen; }
      this.addScore(25 + this.config.bonus * this.streak, 420, 400, this.streak > 1 ? `PERFECT ×${this.streak}` : 'PERFECT'); this.cue('perfect', 420, 400);
      this.notice = this.streak % 3 === 0 ? 'THREE PERFECTS! Your tower grows wider.' : `PERFECT ALIGNMENT · streak ${this.streak}`;
    } else {
      const overlapX = overlap1D(top.x, top.w, this.moving.x, this.moving.w), overlapZ = overlap1D(top.z, top.d, this.moving.z, this.moving.d);
      if (overlapX.size < 8 || overlapZ.size < 8) {
        this.falling.push({ slab: { ...this.moving }, vx: this.axis === 'x' ? this.direction * 100 : 0, vz: this.axis === 'z' ? this.direction * 100 : 0, fall: 0, velocity: 0, age: 0 });
        this.streak = 0; this.lose(420, 420, 'MISSED THE SKYLINE'); if (this.phase === 'playing') { this.spawn(); this.notice = 'A second chance. Wait until the next slab lines up.'; } return false;
      }
      const cutSize = this.axis === 'x' ? this.moving.w - overlapX.size : this.moving.d - overlapZ.size;
      const cut = { ...this.moving };
      if (this.axis === 'x') { cut.w = cutSize; cut.x = delta > 0 ? overlapX.start + overlapX.size : this.moving.x; }
      else { cut.d = cutSize; cut.z = delta > 0 ? overlapZ.start + overlapZ.size : this.moving.z; }
      this.falling.push({ slab: cut, vx: this.axis === 'x' ? Math.sign(delta) * 100 : 0, vz: this.axis === 'z' ? Math.sign(delta) * 100 : 0, fall: 0, velocity: 0, age: 0 });
      this.moving.x = overlapX.start; this.moving.z = overlapZ.start; this.moving.w = overlapX.size; this.moving.d = overlapZ.size; this.streak = 0;
      this.addScore(25, 420, 400, '+25'); this.cue('hit', 420, 450); this.notice = `CLEAN CUT · ${Math.round(Math.min(this.moving.w, this.moving.d))} width left. Aim for a perfect.`;
    }
    this.slabs.push({ ...this.moving }); this.placed++;
    if (this.placed >= this.goal) this.clear(420, 300); else this.spawn(); return true;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' || action === 'launch') this.drop();
    if (action === 'ability' && this.config.overdrive && this.focusCooldown <= 0) { this.focus = 3; this.focusCooldown = 12; this.cue('ability', 420, 300, 'FOCUS'); this.notice = 'FOCUS ACTIVE. Three seconds to find your perfect moment.'; }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', _x: number, _y: number): void { if (phase === 'down') this.drop(); }
  protected tick(dt: number): void {
    this.focus = Math.max(0, this.focus - dt); this.focusCooldown = Math.max(0, this.focusCooldown - dt); this.dropLock = Math.max(0, this.dropLock - dt);
    const speed = (this.config.speed + this.placed * 3.2 + (this.level - 1) * 7) * (this.focus > 0 ? 0.43 : 1);
    this.offset += this.direction * speed * dt;
    if (this.offset > 320) { this.offset = 640 - this.offset; this.direction = -1; } if (this.offset < -320) { this.offset = -640 - this.offset; this.direction = 1; }
    this.positionMoving(); this.camera += (Math.max(0, (this.placed - 7) * 26) - this.camera) * Math.min(1, dt * 5);
    for (const f of this.falling) { f.age += dt; f.velocity += 550 * dt; f.fall += f.velocity * dt; f.slab.x += f.vx * dt; f.slab.z += f.vz * dt; }
    this.falling = this.falling.filter(f => f.age < 2.4).slice(-12);
  }
  stats() { return [{ label: 'FLOORS', value: `${this.placed}/${this.goal}` }, { label: 'PERFECT', value: `×${this.streak}` }, { label: 'CHANCES', value: this.lives }]; }
}
