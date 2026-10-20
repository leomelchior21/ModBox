import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { roombaCatalog } from './catalog';
import { legs, roomFor, roomName, type DebrisKind, type Room } from './rooms';

export const CELL = .25, RADIUS = .36;
const DEBRIS_VALUE: Record<DebrisKind, number> = { coin: 10, popcorn: 2, crumbs: 1, sock: 4, brick: 3, leaf: 1, bolt: 3 };
export interface Box { x: number; z: number; w: number; d: number }
export interface Toy { x: number; z: number; r: number; vx: number; vz: number; kind: 'ball' | 'cube'; spin: number }
export interface Grid { cols: number; rows: number; dirt: Float32Array; initial: Float32Array; cleanable: Uint8Array; reachable: Uint8Array; total: number }

/** Solid footprints the robot body collides with: walls are handled separately. */
export function blockers(room: Room): Box[] { return room.furniture.flatMap(legs); }
function hitsBox(x: number, z: number, r: number, b: Box) { return Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r; }
export function blockedAt(room: Room, boxes: readonly Box[], x: number, z: number, r = RADIUS): boolean {
  return Math.abs(x) > room.width / 2 - r || Math.abs(z) > room.depth / 2 - r || boxes.some(b => hitsBox(x, z, r, b));
}
/** Floor cells the brush can actually reach from the dock: the coverage target is fair in every room. */
export function buildGrid(room: Room, boxes: readonly Box[], level: number): Grid {
  const cols = Math.ceil(room.width / CELL), rows = Math.ceil(room.depth / CELL), n = cols * rows;
  const center = (i: number) => ({ x: (i % cols + .5) * CELL - room.width / 2, z: (Math.floor(i / cols) + .5) * CELL - room.depth / 2 });
  const free = new Uint8Array(n), reachable = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const p = center(i); free[i] = blockedAt(room, boxes, p.x, p.z) ? 0 : 1; }
  const start = Math.floor((room.dock.z + room.depth / 2) / CELL) * cols + Math.floor((room.dock.x + room.width / 2) / CELL), queue = [start];
  if (free[start]) reachable[start] = 1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], c = i % cols, r = Math.floor(i / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr, j = nr * cols + nc; if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && free[j] && !reachable[j]) { reachable[j] = 1; queue.push(j); } }
  }
  // Anything within brush reach of a reachable spot, and not under solid furniture, can be cleaned.
  const cleanable = new Uint8Array(n), reach = 2, solid = boxes;
  for (let i = 0; i < n; i++) {
    if (!reachable[i]) continue; const c = i % cols, r = Math.floor(i / cols);
    for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++) {
      const nc = c + dc, nr = r + dr; if (nc < 0 || nc >= cols || nr < 0 || nr >= rows || dc * dc + dr * dr > reach * reach) continue;
      const j = nr * cols + nc, p = center(j); if (!solid.some(b => hitsBox(p.x, p.z, 0, b))) cleanable[j] = 1;
    }
  }
  const dirt = new Float32Array(n), initial = new Float32Array(n); let total = 0;
  for (let i = 0; i < n; i++) if (cleanable[i]) { total++; const p = center(i); initial[i] = dirt[i] = room.dirt * (.55 + .45 * Math.abs(Math.sin(p.x * 1.7 + level) * Math.cos(p.z * 1.3 - level))); }
  return { cols, rows, dirt, initial, cleanable, reachable, total };
}

export class RoombaRun extends ArcadeRun {
  room: Room = roomFor(1); boxes: Box[] = blockers(this.room); grid: Grid = buildGrid(this.room, this.boxes, 1);
  x = 0; z = 0; heading = Math.PI; speedNow = 0; battery = 100; cleanedCells = 0; money = 0;
  debris: { kind: DebrisKind; x: number; z: number; taken: boolean }[] = []; toys: Toy[] = [];
  docking = false; charging = false; turbo = 0; turboCooldown = 0; cameraClose = true; brushAngle = 0; dirtRevision = 0;
  path: { x: number; z: number }[] = []; joystick: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
  /** Cells cleaned since the view last painted them, so the floor trail stays in sync. */
  freshlyCleaned: number[] = [];
  private routeTimer = 0;
  constructor(checkpoint?: unknown) { super('roomba-run', roombaCatalog.defaults, roombaCatalog.schema, checkpoint); this.prepare(); }
  get coverage() { return this.grid.total ? this.cleanedCells / this.grid.total * 100 : 0; }
  get target() { return this.room.target; }
  get dockDistance() { return Math.hypot(this.x - this.room.dock.x, this.z - this.room.dock.z); }
  get radius() { return .4 + this.config.power / 300 + (this.turbo > 0 ? .3 : 0); }
  get roomName() { return roomName(this.level); }
  private prepare() {
    this.room = roomFor(this.level); this.boxes = blockers(this.room); this.grid = buildGrid(this.room, this.boxes, this.level);
    this.x = this.room.dock.x; this.z = this.room.dock.z - .1; this.heading = Math.PI; this.speedNow = 0; this.cleanedCells = 0; this.freshlyCleaned = [];
    this.debris = this.room.debris.filter(d => !blockedAt(this.room, this.boxes, d.x, d.z, .05)).map(d => ({ ...d, taken: false }));
    this.toys = this.room.toys.map(t => ({ ...t, vx: 0, vz: 0, spin: 0 }));
  }
  protected setup(): void {
    this.prepare(); this.battery = 100; this.money = 0; this.docking = false; this.charging = false; this.turbo = 0; this.turboCooldown = 0; this.brushAngle = 0; this.path = []; this.joystick = null; this.routeTimer = 0; this.dirtRevision++;
    this.notice = `${this.roomName.toUpperCase()} · ${this.room.tip}`;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'left' || action === 'right' || action === 'up' || action === 'down') this.metrics.actions++;
    if (action === 'primary') { this.docking = true; this.route(this.room.dock.x, this.room.dock.z); this.notice = this.coverage >= this.target ? 'Job nearly done. Heading home to the dock.' : 'Heading to the dock to recharge.'; this.metrics.actions++; }
    if (action === 'nudge') { this.cameraClose = !this.cameraClose; this.metrics.actions++; }
    if (action === 'ability' && this.config.overdrive && this.turboCooldown <= 0 && this.battery >= 8) { this.turbo = 4; this.turboCooldown = 12; this.metrics.actions++; this.cue('ability', 0, 0, 'TURBO TIDY'); this.notice = 'TURBO TIDY! Wider sweep, faster wheels, more battery.'; }
  }
  /** Grid route (breadth-first) around furniture, used by smart route and the dock button. */
  route(x: number, z: number) {
    const g = this.grid, cell = (px: number, pz: number) => clamp(Math.floor((pz + this.room.depth / 2) / CELL), 0, g.rows - 1) * g.cols + clamp(Math.floor((px + this.room.width / 2) / CELL), 0, g.cols - 1);
    let start = cell(this.x, this.z), goal = cell(x, z);
    const nearest = (i: number) => { if (g.reachable[i]) return i; let best = -1, distance = Infinity; for (let j = 0; j < g.reachable.length; j++) if (g.reachable[j]) { const d = (j % g.cols - i % g.cols) ** 2 + (Math.floor(j / g.cols) - Math.floor(i / g.cols)) ** 2; if (d < distance) { distance = d; best = j; } } return best; };
    start = nearest(start); goal = nearest(goal); if (start < 0 || goal < 0) { this.path = []; return; }
    const previous = new Int32Array(g.reachable.length).fill(-2), queue = [start]; previous[start] = -1;
    for (let q = 0; q < queue.length && previous[goal] === -2; q++) {
      const i = queue[q], c = i % g.cols, r = Math.floor(i / g.cols);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr, j = nr * g.cols + nc; if (nc >= 0 && nc < g.cols && nr >= 0 && nr < g.rows && g.reachable[j] && previous[j] === -2) { previous[j] = i; queue.push(j); } }
    }
    const steps: { x: number; z: number }[] = [];
    for (let at = goal; at >= 0 && previous[at] !== -2; at = previous[at]) { steps.push({ x: (at % g.cols + .5) * CELL - this.room.width / 2, z: (Math.floor(at / g.cols) + .5) * CELL - this.room.depth / 2 }); if (previous[at] === -1) break; }
    this.path = steps.reverse().filter((_, i, all) => i % 3 === 0 || i === all.length - 1);
  }
  protected tick(dt: number): void {
    this.turbo = this.config.overdrive ? Math.max(0, this.turbo - dt) : 0; this.turboCooldown = Math.max(0, this.turboCooldown - dt); this.routeTimer = Math.max(0, this.routeTimer - dt);
    const stick = this.joystick, jx = stick ? clamp((stick.x - stick.ox) / 110, -1, 1) : 0, jy = stick ? clamp((stick.y - stick.oy) / 110, -1, 1) : 0;
    let throttle = Number(this.input.up) - Number(this.input.down) * .7 - (Math.abs(jy) > .15 ? jy : 0), turn = Number(this.input.right) - Number(this.input.left) + (Math.abs(jx) > .15 ? jx : 0);
    const manual = Math.abs(throttle) > .01 || Math.abs(turn) > .01;
    if (manual) { this.path = []; this.docking = false; }
    // Smart route: chase the nearest dirt, and head home when the battery or the job says so.
    if (!manual && this.config.assist && !this.path.length && this.routeTimer <= 0 && (!this.charging || this.battery >= 99)) {
      if (this.battery < 22 || this.coverage >= this.target) { this.docking = true; this.route(this.room.dock.x, this.room.dock.z); }
      else { const target = this.nearestDirt(); if (target) { this.route(target.x, target.z); this.metrics.assisted++; } }
      this.routeTimer = .25;
    }
    if (!manual && this.path.length) {
      const next = this.path[0], dx = next.x - this.x, dz = next.z - this.z, d = Math.hypot(dx, dz);
      if (d < .2) this.path.shift();
      else { const desired = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(desired - this.heading), Math.cos(desired - this.heading)); turn = clamp(diff * 3, -1, 1); throttle = Math.abs(diff) > 1.2 ? .15 : 1; }
    }
    const top = this.config.speed * .55 * (this.turbo > 0 ? 1.3 : 1), want = clamp(throttle, -.7, 1) * top;
    this.speedNow += clamp(want - this.speedNow, -9 * dt, 7 * dt);
    this.heading += turn * (2.4 + Math.abs(this.speedNow) * .2) * dt;
    this.move(this.speedNow * Math.sin(this.heading) * dt, this.speedNow * Math.cos(this.heading) * dt);
    this.pushToys(dt);
    // Docking, charging and finishing the job.
    this.charging = this.dockDistance < .6 && Math.abs(this.speedNow) < .4 && !manual;
    if (this.charging) {
      if (this.docking && this.path.length === 0) this.speedNow = 0;
      this.battery = Math.min(100, this.battery + dt * 26);
      if (this.coverage >= this.target) { const bonus = 300 + Math.round(this.battery) + this.money * 5; this.addScore(bonus, 0, 0, 'SPOTLESS!'); this.clear(0, 0); return; }
      if (this.battery >= 99 && this.docking) { this.docking = false; this.path = []; }
    } else this.battery = Math.max(0, this.battery - dt * (.3 + Math.abs(this.speedNow) * .22 + (this.turbo > 0 ? 1.6 : 0)));
    this.brushAngle += dt * (this.turbo > 0 ? 45 : 22);
    this.clean(dt);
    if (this.battery <= 0) {
      this.lose(0, 0, 'BATTERY EMPTY. A spare pack brings you home: recharge at the dock.');
      if (this.phase === 'playing') { this.x = this.room.dock.x; this.z = this.room.dock.z - .1; this.heading = Math.PI; this.speedNow = 0; this.battery = 40; this.path = []; this.docking = false; }
    }
  }
  private move(dx: number, dz: number) {
    const room = this.room;
    if (!blockedAt(room, this.boxes, this.x + dx, this.z)) this.x += dx; else this.speedNow *= .6;
    if (!blockedAt(room, this.boxes, this.x, this.z + dz)) this.z += dz; else this.speedNow *= .6;
  }
  private pushToys(dt: number) {
    for (const toy of this.toys) {
      const dx = toy.x - this.x, dz = toy.z - this.z, d = Math.hypot(dx, dz), overlap = RADIUS + toy.r - d;
      if (overlap > 0 && d > 1e-4) { toy.x += dx / d * overlap; toy.z += dz / d * overlap; toy.vx += dx / d * (1.5 + Math.abs(this.speedNow)) ; toy.vz += dz / d * (1.5 + Math.abs(this.speedNow)); this.speedNow *= .97; }
      const nx = toy.x + toy.vx * dt, nz = toy.z + toy.vz * dt;
      if (blockedAt(this.room, this.boxes, nx, toy.z, toy.r)) toy.vx *= -.5; else toy.x = nx;
      if (blockedAt(this.room, this.boxes, toy.x, nz, toy.r)) toy.vz *= -.5; else toy.z = nz;
      const friction = Math.max(0, 1 - dt * 1.8); toy.vx *= friction; toy.vz *= friction; toy.spin += Math.hypot(toy.vx, toy.vz) * dt / toy.r;
    }
  }
  private clean(dt: number) {
    const g = this.grid, r = this.radius, rate = this.config.power / 11 * (this.turbo > 0 ? 1.8 : 1), cells = Math.ceil(r / CELL);
    const c0 = Math.floor((this.x + this.room.width / 2) / CELL), r0 = Math.floor((this.z + this.room.depth / 2) / CELL);
    let fresh = 0;
    for (let row = r0 - cells; row <= r0 + cells; row++) for (let col = c0 - cells; col <= c0 + cells; col++) {
      if (row < 0 || col < 0 || row >= g.rows || col >= g.cols) continue;
      const i = row * g.cols + col; if (!g.cleanable[i] || g.dirt[i] <= 0) continue;
      const cx = (col + .5) * CELL - this.room.width / 2, cz = (row + .5) * CELL - this.room.depth / 2;
      if ((cx - this.x) ** 2 + (cz - this.z) ** 2 > r * r) continue;
      g.dirt[i] = Math.max(0, g.dirt[i] - dt * rate);
      if (g.dirt[i] === 0) { this.cleanedCells++; fresh++; this.freshlyCleaned.push(i); }
    }
    if (fresh) {
      this.dirtRevision++; this.score += fresh * this.config.bonus / 4; this.score = Math.round(this.score);
      const tenth = Math.floor(this.coverage / 10), before = Math.floor((this.cleanedCells - fresh) / g.total * 10);
      if (tenth > before) { this.metrics.perfects++; this.cue('perfect', 0, 0, `${tenth * 10}% CLEAN`); }
      this.notice = this.coverage >= this.target ? `${Math.floor(this.coverage)}% clean! Return to the glowing dock to finish.` : `${Math.floor(this.coverage)}% of ${this.roomName} clean. Find the dusty patches.`;
    }
    for (const d of this.debris) if (!d.taken && (d.x - this.x) ** 2 + (d.z - this.z) ** 2 < (r * .9) ** 2) {
      d.taken = true; const value = DEBRIS_VALUE[d.kind]; this.money += value; this.addScore(this.config.bonus * value / 2, 0, 0, `+$${value}`);
    }
  }
  private nearestDirt() {
    const g = this.grid; let best = -1, distance = Infinity;
    for (let i = 0; i < g.dirt.length; i++) if (g.dirt[i] > 0 && g.reachable[i]) { const x = (i % g.cols + .5) * CELL - this.room.width / 2, z = (Math.floor(i / g.cols) + .5) * CELL - this.room.depth / 2, d = (x - this.x) ** 2 + (z - this.z) ** 2; if (d < distance) { distance = d; best = i; } }
    if (best < 0) { for (let i = 0; i < g.dirt.length; i++) if (g.dirt[i] > 0) { best = i; break; } }
    return best < 0 ? null : { x: (best % g.cols + .5) * CELL - this.room.width / 2, z: (Math.floor(best / g.cols) + .5) * CELL - this.room.depth / 2 };
  }
  releaseInput(): void { super.releaseInput(); this.joystick = null; }
  /** Virtual joystick: press anywhere on the floor and drag. Up drives forward, sideways steers. */
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId = 0): void {
    if (phase === 'cancel' || phase === 'up' && this.joystick?.id === pointerId) { this.joystick = null; return; }
    if (this.phase !== 'playing') return;
    if (phase === 'down' && !this.joystick) { this.joystick = { ox: x, oy: y, x, y, id: pointerId }; this.metrics.actions++; }
    if (phase === 'move' && this.joystick?.id === pointerId) { this.joystick.x = x; this.joystick.y = y; }
  }
  protected runtime() { return { battery: Math.floor(this.battery), cleaned: Math.floor(this.coverage), patches: this.cleanedCells }; }
  protected stageSummary() { return { patches: this.cleanedCells, battery: Math.round(this.battery), lives: this.lives, money: this.money }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) {
    const done = clamp(Math.floor(summary.patches ?? this.grid.total), 0, this.grid.total); let marked = 0;
    for (let i = 0; i < this.grid.dirt.length && marked < done; i++) if (this.grid.cleanable[i]) { this.grid.dirt[i] = 0; this.freshlyCleaned.push(i); marked++; }
    this.cleanedCells = done; this.battery = clamp(summary.battery ?? 100, 0, 100); this.lives = Math.floor(summary.lives ?? this.config.lives); this.money = Math.floor(summary.money ?? 0);
    this.dirtRevision++;
  }
  stats() { return [{ label: 'ROOM', value: `${Math.floor(this.coverage)}%` }, { label: 'BATTERY', value: `${Math.ceil(this.battery)}%` }, { label: 'CASH', value: `$${this.money}` }]; }
}
