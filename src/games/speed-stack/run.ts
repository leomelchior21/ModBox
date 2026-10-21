import { ArcadeRun, type ArcadeAction } from '../premium-kit/core';
import { stackCatalog } from './catalog';
import { STACK_WEATHER } from './worlds';

export interface StackSlab { x: number; z: number; w: number; d: number; layer: number; color: number; perfect: boolean; gold?: boolean }
export interface FallingSlab { slab: StackSlab; vx: number; vz: number; fall: number; velocity: number; age: number; spin: number }
export interface StackLevel { name: string; tip: string; floors: number; width: number; tempo: number; hue: number; gold: number; gust: boolean; night: boolean }
export function overlap1D(a: number, sizeA: number, b: number, sizeB: number): { start: number; size: number } { const start = Math.max(a, b); return { start, size: Math.max(0, Math.min(a + sizeA, b + sizeB) - start) }; }

export const BASE_WIDTH = 280, MAX_WIDTH = 300, SWEEP = 320;
/** Twelve skylines. Tempo scales the slab speed; gold marks every nth slab; gusts make the slab speed surge and ease. */
export const STACK_LEVELS: readonly StackLevel[] = [
  { name: 'First Floors', tip: 'Tap when the sliding slab lines up with the tower.', floors: 12, width: 280, tempo: 1, hue: 190, gold: 0, gust: false, night: false },
  { name: 'Steady Hands', tip: 'Three perfect drops in a row grow the tower back.', floors: 15, width: 280, tempo: 1.05, hue: 160, gold: 0, gust: false, night: false },
  { name: 'Golden Hour', tip: 'Gold slabs pay triple for a perfect drop and widen the tower.', floors: 15, width: 280, tempo: 1.1, hue: 30, gold: 4, gust: false, night: false },
  { name: 'Express Lift', tip: 'Faster slabs. Watch the edge, not the middle.', floors: 16, width: 280, tempo: 1.3, hue: 280, gold: 0, gust: false, night: false },
  { name: 'Narrow Escape', tip: 'You start thin. Every perfect counts.', floors: 16, width: 200, tempo: 1.1, hue: 330, gold: 5, gust: false, night: false },
  { name: 'Night Shift', tip: 'The city lights up. Keep your rhythm in the dark.', floors: 18, width: 280, tempo: 1.2, hue: 230, gold: 0, gust: false, night: true },
  { name: 'Crosswind', tip: 'Gusts speed the slab up and slow it down. Wait for the calm.', floors: 18, width: 280, tempo: 1.15, hue: 120, gold: 0, gust: true, night: false },
  { name: 'Rush Hour', tip: 'Every floor is a little faster than the last.', floors: 20, width: 260, tempo: 1.35, hue: 10, gold: 4, gust: false, night: false },
  { name: 'Aurora', tip: 'Northern lights and gusty air.', floors: 20, width: 260, tempo: 1.25, hue: 170, gold: 5, gust: true, night: true },
  { name: 'Cloud Nine', tip: 'Above the clouds. Narrow and quick.', floors: 22, width: 220, tempo: 1.4, hue: 210, gold: 4, gust: false, night: false },
  { name: 'Storm Front', tip: 'Strong gusts, fast slabs. Stay calm.', floors: 22, width: 260, tempo: 1.45, hue: 260, gold: 0, gust: true, night: true },
  { name: 'Skyline Legend', tip: 'The tallest tower in the city. Make it perfect.', floors: 25, width: 240, tempo: 1.55, hue: 45, gold: 3, gust: true, night: false },
];
export const stackLevel = (level: number): StackLevel => {
  const base = STACK_LEVELS[(Math.max(1, level) - 1) % STACK_LEVELS.length], loop = Math.floor((Math.max(1, level) - 1) / STACK_LEVELS.length);
  return loop ? { ...base, floors: base.floors + loop * 3, tempo: base.tempo + loop * .15 } : base;
};
export const stackLevelName = (level: number) => stackLevel(level).name + (level > STACK_LEVELS.length ? ` ${Math.ceil(level / STACK_LEVELS.length)}` : '');

export class StackRun extends ArcadeRun {
  slabs: StackSlab[] = []; falling: FallingSlab[] = []; moving: StackSlab = { x: -140, z: -140, w: BASE_WIDTH, d: BASE_WIDTH, layer: 1, color: 1, perfect: false };
  axis: 'x' | 'z' = 'x'; offset = -SWEEP; direction = 1; placed = 0; streak = 0; best = 0; perfects = 0; camera = 0; focus = 0; focusCooldown = 0; dropLock = 0;
  /** Seconds since the last perfect, for the ripple, and since the last grow, for the flash. */
  ripple = 99; grew = 99; gustPhase = 0;
  constructor(checkpoint?: unknown) { super('speed-stack', stackCatalog.defaults, stackCatalog.schema, checkpoint); }
  get stage() { return stackLevel(this.level); }
  get levelName() { return stackLevelName(this.level); }
  get goal(): number { return this.stage.floors; }
  get top(): StackSlab { return this.slabs[this.slabs.length - 1]; }
  /** Slab speed now: the tempo mod, the stage tempo, a little per floor and the wind. */
  get speed(): number {
    const w = this.weather, gust = this.stage.gust || w.gust ? 1 + Math.sin(this.gustPhase) * .45 : 1;
    return (this.config.speed * this.stage.tempo + this.placed * 3.2) * gust * w.speed * (this.focus > 0 ? .43 : 1);
  }
  get weather() { return STACK_WEATHER[this.config.weather ?? 'clear'] ?? STACK_WEATHER.clear; }
  /** Misses and near-misses this stage, for the foreman's advice. */
  misses = 0; cuts = 0;
  protected setup(): void {
    const w = this.stage.width, start = -w / 2;
    this.slabs = [{ x: start, z: start, w, d: w, layer: 0, color: 0, perfect: true }]; this.falling = []; this.placed = 0; this.streak = 0; this.best = 0; this.perfects = 0;
    this.misses = 0; this.cuts = 0;
    this.camera = 0; this.focus = 0; this.focusCooldown = 0; this.dropLock = 0; this.ripple = 99; this.grew = 99; this.gustPhase = 0;
    this.spawn(); this.notice = `${this.levelName.toUpperCase()} · ${this.stage.tip}`;
  }
  private spawn(): void {
    const top = this.top, layer = this.placed + 1; this.axis = this.placed % 2 ? 'z' : 'x'; this.offset = this.placed % 4 < 2 ? -SWEEP : SWEEP; this.direction = this.offset < 0 ? 1 : -1;
    this.moving = { ...top, layer, color: layer, perfect: false, gold: this.stage.gold > 0 && layer % this.stage.gold === 0 }; this.positionMoving();
  }
  private positionMoving(): void { const top = this.top; if (!top) return; this.moving.x = top.x + (this.axis === 'x' ? this.offset : 0); this.moving.z = top.z + (this.axis === 'z' ? this.offset : 0); }
  drop(): boolean {
    if (this.phase !== 'playing' || this.dropLock > 0) return false;
    this.metrics.actions++; this.dropLock = .16;
    const top = this.top, delta = this.axis === 'x' ? this.moving.x - top.x : this.moving.z - top.z, gold = !!this.moving.gold;
    const perfect = Math.abs(delta) <= (this.config.power + (this.config.assist ? 10 : 0)) * this.weather.window;
    if (perfect) {
      this.moving.x = top.x; this.moving.z = top.z; this.moving.perfect = true; this.streak++; this.perfects++; this.best = Math.max(this.best, this.streak); this.metrics.perfects++; this.ripple = 0;
      if (this.config.assist) this.metrics.assisted++;
      // Every third perfect in a row, and every perfect gold slab, grows the tower back toward full width.
      const grow = gold ? 24 : this.streak % 3 === 0 ? 12 : 0, widen = Math.max(0, Math.min(grow, MAX_WIDTH - this.moving.w, MAX_WIDTH - this.moving.d));
      if (widen > 0) { this.moving.x -= widen / 2; this.moving.z -= widen / 2; this.moving.w += widen; this.moving.d += widen; this.grew = 0; }
      const points = (25 + this.config.bonus * this.streak) * (gold ? 3 : 1);
      this.addScore(points, 420, 400, gold ? `GOLD ×3 · +${points}` : this.streak > 1 ? `PERFECT ×${this.streak}` : 'PERFECT'); this.cue('perfect', 420, 400);
      this.notice = gold ? 'GOLDEN PERFECT! Triple points and a wider tower.' : widen > 0 ? 'THREE PERFECTS! Your tower grows wider.' : `PERFECT · streak ${this.streak}`;
    } else {
      const overlapX = overlap1D(top.x, top.w, this.moving.x, this.moving.w), overlapZ = overlap1D(top.z, top.d, this.moving.z, this.moving.d);
      if (overlapX.size < 8 || overlapZ.size < 8) {
        this.falling.push({ slab: { ...this.moving }, vx: this.axis === 'x' ? this.direction * 100 : 0, vz: this.axis === 'z' ? this.direction * 100 : 0, fall: 0, velocity: 0, age: 0, spin: this.direction });
        this.streak = 0; this.misses++; this.lose(420, 420, 'MISSED THE TOWER'); if (this.phase === 'playing') { this.spawn(); this.notice = 'A second chance. Wait until the next slab lines up.'; } return false;
      }
      const cutSize = this.axis === 'x' ? this.moving.w - overlapX.size : this.moving.d - overlapZ.size, cut = { ...this.moving, gold: false };
      if (this.axis === 'x') { cut.w = cutSize; cut.x = delta > 0 ? overlapX.start + overlapX.size : this.moving.x; }
      else { cut.d = cutSize; cut.z = delta > 0 ? overlapZ.start + overlapZ.size : this.moving.z; }
      this.falling.push({ slab: cut, vx: this.axis === 'x' ? Math.sign(delta) * 100 : 0, vz: this.axis === 'z' ? Math.sign(delta) * 100 : 0, fall: 0, velocity: 0, age: 0, spin: Math.sign(delta) });
      this.moving.x = overlapX.start; this.moving.z = overlapZ.start; this.moving.w = overlapX.size; this.moving.d = overlapZ.size; this.moving.gold = false; this.streak = 0; this.cuts++;
      this.addScore(25, 420, 400, '+25'); this.cue('hit', 420, 450); this.notice = `CLEAN CUT · ${Math.round(Math.min(this.moving.w, this.moving.d))} wide. Aim for a perfect.`;
    }
    this.slabs.push({ ...this.moving }); this.placed++;
    if (this.placed >= this.goal) { this.addScore(this.lives * 250, 420, 300, 'SKYLINE COMPLETE'); this.clear(420, 300); } else this.spawn(); return true;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' || action === 'launch') this.drop();
    if (action === 'ability' && this.config.overdrive && this.focusCooldown <= 0) { this.focus = 3; this.focusCooldown = 12; this.cue('ability', 420, 300, 'FOCUS'); this.notice = 'FOCUS ACTIVE. Three seconds to find your perfect moment.'; }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', _x: number, _y: number): void { if (phase === 'down') this.drop(); }
  protected tick(dt: number): void {
    this.focus = Math.max(0, this.focus - dt); this.focusCooldown = Math.max(0, this.focusCooldown - dt); this.dropLock = Math.max(0, this.dropLock - dt);
    this.ripple += dt; this.grew += dt; this.gustPhase += dt * 1.7;
    this.offset += this.direction * this.speed * dt;
    if (this.offset > SWEEP) { this.offset = SWEEP * 2 - this.offset; this.direction = -1; } if (this.offset < -SWEEP) { this.offset = -SWEEP * 2 - this.offset; this.direction = 1; }
    this.positionMoving(); this.camera += (this.placed - this.camera) * Math.min(1, dt * 4);
    for (const f of this.falling) { f.age += dt; f.velocity += 550 * dt; f.fall += f.velocity * dt; f.slab.x += f.vx * dt; f.slab.z += f.vz * dt; }
    this.falling = this.falling.filter(f => f.age < 2.4).slice(-12);
  }
  protected runtime() { return { floors: this.placed, streak: this.streak }; }
  protected stageSummary() { return { floors: this.placed, best: this.best, perfects: this.perfects, lives: this.lives }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) {
    this.best = Math.floor(summary.best ?? 0); this.perfects = Math.floor(summary.perfects ?? 0); this.lives = Math.floor(summary.lives ?? this.config.lives);
    const floors = Math.min(this.goal, Math.floor(summary.floors ?? this.goal)), base = this.slabs[0];
    // Rebuild a tidy finished tower for the result screen.
    for (let layer = 1; layer <= floors; layer++) this.slabs.push({ ...base, layer, color: layer, perfect: true });
    this.placed = floors; this.camera = floors;
  }
  stats() { return [{ label: 'FLOORS', value: `${this.placed}/${this.goal}` }, { label: 'PERFECT', value: `×${this.streak}` }, { label: 'CHANCES', value: this.lives }]; }
}
