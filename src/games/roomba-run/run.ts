import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { roombaCatalog } from './catalog';

export interface Furniture { x: number; z: number; w: number; d: number; type: 'sofa' | 'cabinet' | 'plant' | 'leg' }
export const ROOM_FURNITURE: readonly Furniture[] = [
  { x: -3.4, z: -2.65, w: 3.7, d: 1.55, type: 'sofa' }, { x: 4.65, z: -2.9, w: 1.05, d: 2.6, type: 'cabinet' },
  { x: -4.9, z: 3.5, w: .65, d: .65, type: 'plant' }, { x: 4.7, z: 3.55, w: .65, d: .65, type: 'plant' },
  ...[-.58, .58].flatMap(x => [-.55, .55].map(z => ({ x: 1.7 + x, z: -.3 + z, w: .17, d: .17, type: 'leg' as const }))),
  ...[-.9, .9].flatMap(x => [-.48, .48].map(z => ({ x: -2.5 + x, z: 1.4 + z, w: .18, d: .18, type: 'leg' as const }))),
];
export const ROOM = { width: 12, depth: 10, columns: 32, rows: 26, radius: .34, dockX: 0, dockZ: 4.05 };
export interface DirtCell { x: number; z: number; index: number; dirt: number; initial: number }
export function roomBlocked(x: number, z: number, radius = ROOM.radius): boolean {
  return Math.abs(x) > ROOM.width / 2 - radius || Math.abs(z) > ROOM.depth / 2 - radius || ROOM_FURNITURE.some(f => Math.abs(x - f.x) < f.w / 2 + radius && Math.abs(z - f.z) < f.d / 2 + radius);
}
export const cellPoint = (index: number) => ({ x: (index % ROOM.columns + .5) / ROOM.columns * ROOM.width - ROOM.width / 2, z: (Math.floor(index / ROOM.columns) + .5) / ROOM.rows * ROOM.depth - ROOM.depth / 2 });
export const pointCell = (x: number, z: number) => clamp(Math.floor((z + ROOM.depth / 2) / ROOM.depth * ROOM.rows), 0, ROOM.rows - 1) * ROOM.columns + clamp(Math.floor((x + ROOM.width / 2) / ROOM.width * ROOM.columns), 0, ROOM.columns - 1);
export function roomWalkable(): Set<number> {
  const candidates = new Set<number>();
  for (let i = 0; i < ROOM.columns * ROOM.rows; i++) { const p = cellPoint(i); if (!roomBlocked(p.x, p.z, .39)) candidates.add(i); }
  const start = pointCell(ROOM.dockX, ROOM.dockZ), reached = new Set<number>([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const n of neighbors(queue[i])) if (candidates.has(n) && !reached.has(n)) { reached.add(n); queue.push(n); }
  return reached;
}
function neighbors(index: number) {
  const row = Math.floor(index / ROOM.columns), col = index % ROOM.columns, result: number[] = [];
  if (col) result.push(index - 1); if (col < ROOM.columns - 1) result.push(index + 1);
  if (row) result.push(index - ROOM.columns); if (row < ROOM.rows - 1) result.push(index + ROOM.columns);
  return result;
}
/** A shortest grid path around inflated furniture; every target is reachable from the dock. */
export function roomPath(start: number, goal: number, walkable: ReadonlySet<number>): number[] {
  if (!walkable.has(start) || !walkable.has(goal)) return [];
  const queue = [start], previous = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length && !previous.has(goal); i++) for (const n of neighbors(queue[i])) if (walkable.has(n) && !previous.has(n)) { previous.set(n, queue[i]); queue.push(n); }
  if (!previous.has(goal)) return [];
  const path: number[] = []; for (let at = goal; at !== start; at = previous.get(at)!) path.push(at);
  return path.reverse();
}
export class RoombaRun extends ArcadeRun {
  x = ROOM.dockX; z = ROOM.dockZ; heading = Math.PI; battery = 100; cleanedCells = 0; speedNow = 0;
  cells: DirtCell[] = []; walkable = roomWalkable(); path: number[] = []; docking = false; charging = false;
  turbo = 0; turboCooldown = 0; cameraClose = true; brushAngle = 0; dirtRevision = 0;
  private manualGrace = 0; private routeTimer = 0;
  constructor(checkpoint?: unknown) { super('roomba-run', roombaCatalog.defaults, roombaCatalog.schema, checkpoint); }
  get coverage() { return this.cells.length ? this.cleanedCells / this.cells.length * 100 : 0; }
  get dockDistance() { return Math.hypot(this.x - ROOM.dockX, this.z - ROOM.dockZ); }
  get radius() { return .44 + this.config.power / 170 + (this.turbo > 0 ? .45 : 0); }
  protected setup(): void {
    this.x = ROOM.dockX; this.z = ROOM.dockZ; this.heading = Math.PI; this.battery = 100; this.cleanedCells = 0; this.speedNow = 0; this.path = [];
    this.docking = false; this.charging = false; this.turbo = 0; this.turboCooldown = 0; this.manualGrace = 0; this.routeTimer = 0; this.brushAngle = 0;
    this.cells = [...this.walkable].filter(i => { const p = cellPoint(i); return Math.hypot(p.x - ROOM.dockX, p.z - ROOM.dockZ) > .8; }).map(index => {
      const p = cellPoint(index), initial = .6 + ((index * 17 + this.level * 7) % 11) / 13; return { ...p, index, initial, dirt: initial };
    });
    this.dirtRevision++; this.notice = 'Drive with arrows / WASD, or tap the floor to choose a route. Clean 90%, then dock.';
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'left' || action === 'right' || action === 'up' || action === 'down') {
      if (!this.input[action]) this.targetFloor(this.x + (action === 'right' ? .7 : action === 'left' ? -.7 : 0), this.z + (action === 'down' ? .7 : action === 'up' ? -.7 : 0)); else this.metrics.actions++;
    }
    if (action === 'primary') { this.docking = true; this.goTo(ROOM.dockX, ROOM.dockZ); this.notice = this.coverage >= 90 ? 'Job nearly done. Returning to the dock.' : 'Returning to the dock to recharge. Your clean floor stays clean.'; this.metrics.actions++; }
    if (action === 'nudge') { this.cameraClose = !this.cameraClose; this.metrics.actions++; }
    if (action === 'ability' && this.config.overdrive && this.turboCooldown <= 0 && this.battery >= 8) { this.turbo = 4; this.turboCooldown = 12; this.metrics.actions++; this.cue('ability', 0, 0, 'TURBO TIDY'); this.notice = 'TURBO TIDY. Wider sweep, stronger suction, more battery used.'; }
  }
  private nearestWalkable(x: number, z: number): number {
    let nearest = -1, distance = Infinity;
    for (const i of this.walkable) { const p = cellPoint(i), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < distance) { distance = d; nearest = i; } }
    return nearest;
  }
  goTo(x: number, z: number): void {
    const start = this.nearestWalkable(this.x, this.z), goal = this.nearestWalkable(clamp(x, -5.6, 5.6), clamp(z, -4.6, 4.6));
    this.path = roomPath(start, goal, this.walkable); this.routeTimer = 0;
    if (!this.path.length && goal === start) this.path = [goal];
  }
  targetFloor(x: number, z: number): void { if (this.phase !== 'playing') return; this.docking = false; this.goTo(x, z); this.metrics.actions++; this.manualGrace = .3; this.cue('launch', 0, 0); }
  protected tick(dt: number): void {
    this.turbo = this.config.overdrive ? Math.max(0, this.turbo - dt) : 0; this.turboCooldown = Math.max(0, this.turboCooldown - dt); this.manualGrace = Math.max(0, this.manualGrace - dt); this.routeTimer = Math.max(0, this.routeTimer - dt);
    let dx = Number(this.input.right) - Number(this.input.left), dz = Number(this.input.down) - Number(this.input.up);
    const manual = dx !== 0 || dz !== 0;
    if (manual) { this.manualGrace = 1.5; this.path = []; this.docking = false; }
    if (this.config.assist && !manual && this.manualGrace <= 0) {
      if (this.battery < 22 || this.coverage >= 90) this.docking = true;
      if (!this.path.length && !this.charging && this.routeTimer <= 0) {
        if (this.docking) this.goTo(ROOM.dockX, ROOM.dockZ);
        else {
          let nearest: DirtCell | undefined, distance = Infinity;
          for (const c of this.cells) if (c.dirt > 0) { const d = Math.hypot(c.x - this.x, c.z - this.z); if (d < distance) { nearest = c; distance = d; } }
          if (nearest) { this.goTo(nearest.x, nearest.z); this.metrics.assisted++; }
        }
        this.routeTimer = .2;
      }
    }
    if (!manual && this.path.length) {
      const p = cellPoint(this.path[0]); dx = p.x - this.x; dz = p.z - this.z;
      if (Math.hypot(dx, dz) < .12) { this.path.shift(); dx = 0; dz = 0; }
    }
    const length = Math.hypot(dx, dz), speed = this.config.speed * .6 * (this.turbo > 0 ? 1.35 : 1);
    if (length > .001) {
      const movement = Math.min(speed * dt, manual ? Infinity : length), nx = dx / length, nz = dz / length;
      if (!roomBlocked(this.x + nx * movement, this.z)) this.x += nx * movement;
      if (!roomBlocked(this.x, this.z + nz * movement)) this.z += nz * movement;
      const desired = Math.atan2(nx, nz), difference = Math.atan2(Math.sin(desired - this.heading), Math.cos(desired - this.heading)); this.heading += difference * Math.min(1, dt * 12);
      this.speedNow = speed;
    } else this.speedNow = 0;
    this.charging = this.dockDistance < .72 && !manual && (!this.path.length || this.docking);
    if (this.charging) {
      this.battery = Math.min(100, this.battery + dt * 24);
      if (this.coverage >= 90) { this.addScore(200 + Math.round(this.battery), 0, 0, 'SPOTLESS DELIVERY'); this.clear(0, 0); return; }
      if (this.battery >= 98 && this.config.assist) { this.docking = false; this.charging = false; this.path = []; }
    } else this.battery = Math.max(0, this.battery - dt * (.4 + (this.speedNow > 0 ? .16 : 0) + (this.turbo > 0 ? 1.8 : 0)));
    this.brushAngle += dt * (this.turbo > 0 ? 45 : 22);
    let newlyCleaned = 0;
    for (const c of this.cells) if (c.dirt > 0 && Math.hypot(c.x - this.x, c.z - this.z) < this.radius) {
      c.dirt = Math.max(0, c.dirt - dt * this.config.power / 18 * (this.turbo > 0 ? 2 : 1)); this.dirtRevision++;
      if (!c.dirt) { this.cleanedCells++; newlyCleaned++; }
    }
    if (newlyCleaned) {
      this.addScore(this.config.bonus * newlyCleaned, 0, 0, `+${newlyCleaned} CLEAN`);
      if (this.cleanedCells % 25 < newlyCleaned) { this.metrics.perfects++; this.cue('perfect', 0, 0, `${Math.floor(this.coverage)}% SPOTLESS`); }
      this.notice = this.coverage >= 90 ? '90% CLEAN. Return to the glowing dock to finish the job.' : `${Math.floor(this.coverage)}% clean. Follow the dusty patches; clean floors keep their shine.`;
    }
    if (this.battery <= 0) {
      this.lose(0, 0, 'BATTERY EMPTY. A spare pack brings you home. Recharge at the dock.');
      if (this.phase === 'playing') { this.x = ROOM.dockX; this.z = ROOM.dockZ; this.battery = 30; this.docking = true; this.path = []; }
    }
  }
  protected runtime() { return { battery: Math.floor(this.battery), cleaned: Math.floor(this.coverage), patches: this.cleanedCells }; }
  protected stageSummary() { return { patches: this.cleanedCells, battery: this.battery, lives: this.lives }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.cleanedCells = clamp(Math.floor(summary.patches ?? Math.ceil(this.cells.length * .9)), 0, this.cells.length); this.cells.forEach((cell, i) => { if (i < this.cleanedCells) cell.dirt = 0; }); this.battery = clamp(summary.battery ?? 100, 0, 100); this.lives = Math.floor(summary.lives ?? this.config.lives); this.x = ROOM.dockX; this.z = ROOM.dockZ; }
  stats() { return [{ label: 'FLOOR CLEAN', value: `${Math.floor(this.coverage)}%` }, { label: 'BATTERY', value: `${Math.ceil(this.battery)}%` }, { label: 'PACKS', value: this.lives }]; }
}
