import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { monsterCatalog } from './catalog';
import { Sim, type Particle } from './physics';
import { MONSTER_LEVELS, SEABED_Y, WATER_Y, landHeight, levelFor, levelName, type MonsterLevel } from './levels';

export const WHEEL_RADIUS = .72, WHEEL_REST = -.55;
const WHEEL_MASS = .8, WHEEL_INERTIA = .5 * WHEEL_MASS * WHEEL_RADIUS * WHEEL_RADIUS;
const TRAVEL_UP = .3, TRAVEL_DOWN = .2, STEP = 1 / 240, ITERATIONS = 6, GRIP = 1.15;
/** Chassis points in the axle frame: name, x, y, collision radius. "h" is the cab roof: touching anything with it ends the run. */
const CHASSIS = [['a0', -1.1, 0, .2], ['a1', 1.1, 0, .2], ['b0', -1.72, .45, .22], ['b1', 1.82, .25, .22], ['h', -.25, 1.32, .3], ['c0', -1.55, -.2, .18], ['c1', 1.65, -.2, .18]] as const;
type PartName = typeof CHASSIS[number][0];

export interface Truck { parts: Record<PartName, number>; wheels: [number, number]; spin: [number, number]; turn: [number, number]; touching: [number, number] }
export interface Plank { a: number; b: number; seg: number; kind: 'rope' | 'crumble' | 'seesaw'; piece: number; touched: number; delay: number; fallen: boolean }
export interface Crate { corners: readonly [number, number, number, number]; size: number }
export interface Seesaw { left: number; right: number; pivot: number; piece: number }
export interface Course { level: MonsterLevel; sim: Sim; truck: Truck; planks: Plank[]; crates: Crate[]; seesaws: Seesaw[]; anchors: { piece: number; points: [number, number][] }[] }

/** Builds the solver world for a course with the truck parked (wheels on the ground) at x. */
export function buildCourse(level: MonsterLevel, x: number, gravity: number): Course {
  const sim = new Sim(); sim.gravity = gravity;
  const course: Course = { level, sim, truck: null as unknown as Truck, planks: [], crates: [], seesaws: [], anchors: [] };
  let body = 2;
  level.pieces.forEach((piece, index) => {
    if (piece.kind === 'land') {
      const top = piece.top, last = top[top.length - 1];
      sim.outline([...top, [last[0], SEABED_Y], [top[0][0], SEABED_Y]]);
    } else if (piece.kind === 'rope') {
      const [ax, ay] = piece.from, [bx, by] = piece.to, span = Math.hypot(bx - ax, by - ay), n = piece.planks, len = span * piece.slack / n;
      const sag = Math.sqrt(Math.max(0, 3 * span * (span * piece.slack - span) / 8)), ids: number[] = [];
      for (let k = 0; k <= n; k++) { const t = k / n; ids.push(sim.particle(ax + (bx - ax) * t, ay + (by - ay) * t - 4 * sag * t * (1 - t), k === 0 || k === n ? 0 : .45, body, 0, false, 0, 2.2)); }
      for (let k = 0; k < n; k++) { sim.link(ids[k], ids[k + 1]).len = len; course.planks.push({ a: ids[k], b: ids[k + 1], seg: sim.segs.length, kind: 'rope', piece: index, touched: -1, delay: 0, fallen: false }); sim.seg(ids[k], ids[k + 1], body, course.planks.length - 1); }
      for (let k = 1; k < n; k++) { sim.tether(ids[k], ids[0], k * len); sim.tether(ids[k], ids[n], (n - k) * len); }
      course.anchors.push({ piece: index, points: [[ax, ay], [bx, by]] }); body++;
    } else if (piece.kind === 'crumble') {
      const [ax, ay] = piece.from, [bx, by] = piece.to, n = piece.planks, gap = .03;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, a = sim.particle(ax + (bx - ax) * t0 + gap, ay + (by - ay) * t0, 0, body), b = sim.particle(ax + (bx - ax) * t1 - gap, ay + (by - ay) * t1, 0, body);
        sim.link(a, b); course.planks.push({ a, b, seg: sim.segs.length, kind: 'crumble', piece: index, touched: -1, delay: piece.delay, fallen: false }); sim.seg(a, b, body, course.planks.length - 1); body++;
      }
      course.anchors.push({ piece: index, points: [[ax, ay], [bx, by]] });
    } else if (piece.kind === 'seesaw') {
      const [px, py] = piece.pivot, half = piece.length / 2, c = Math.cos(piece.tilt), s = Math.sin(piece.tilt), cx = px - .35 * s, cy = py + .35 * c;
      const pivot = sim.particle(px, py, 0, body), left = sim.particle(cx - half * c, cy - half * s, 1.4, body, .12, true, .8, .6), right = sim.particle(cx + half * c, cy + half * s, 1.4, body, .12, true, .8, .6);
      sim.link(left, right); sim.link(left, pivot); sim.link(right, pivot);
      course.planks.push({ a: left, b: right, seg: sim.segs.length, kind: 'seesaw', piece: index, touched: -1, delay: 0, fallen: false }); sim.seg(left, right, body, course.planks.length - 1);
      course.seesaws.push({ left, right, pivot, piece: index }); body++;
    } else {
      const [cx, cy] = piece.at, h = piece.size / 2;
      const ids = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([ox, oy]) => sim.particle(cx + ox, cy + oy, .3, body, .08, true, .75, .2)) as unknown as [number, number, number, number];
      for (let i = 0; i < 4; i++) { sim.link(ids[i], ids[(i + 1) % 4]); sim.seg(ids[i], ids[(i + 1) % 4], body); }
      sim.link(ids[0], ids[2]); sim.link(ids[1], ids[3]); course.crates.push({ corners: ids, size: piece.size }); body++;
    }
  });
  // Let bridges sag, seesaws tip and crates drop into their resting poses before the truck arrives.
  for (let i = 0; i < 360; i++) sim.step(STEP, 4);
  for (const q of sim.p) { q.vx = q.vy = 0; q.px = q.x; q.py = q.y; }
  const ground = landHeight(level, x) ?? 0, mount = ground + WHEEL_RADIUS - WHEEL_REST + .02;
  const parts = {} as Record<PartName, number>;
  for (const [name, px, py, r] of CHASSIS) parts[name] = sim.particle(x + px, mount + py, 5 / CHASSIS.length, 1, r, true, .55);
  const ids = CHASSIS.map(([name]) => parts[name]);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) sim.link(ids[i], ids[j]);
  for (const [a, b] of [['b0', 'h'], ['h', 'b1'], ['b1', 'c1'], ['c1', 'c0'], ['c0', 'b0']] as const) sim.seg(parts[a], parts[b], 1);
  const wheels: [number, number] = [sim.particle(x - 1.1, mount + WHEEL_REST, WHEEL_MASS, 1, WHEEL_RADIUS, true, GRIP), sim.particle(x + 1.1, mount + WHEEL_REST, WHEEL_MASS, 1, WHEEL_RADIUS, true, GRIP)];
  course.truck = { parts, wheels, spin: [0, 0], turn: [0, 0], touching: [1, 1] };
  sim.onTouch = (seg, particle) => {
    const plank = course.planks[seg.plank]; if (!plank || plank.kind !== 'crumble' || plank.touched >= 0 || sim.p[particle].body !== 1) return;
    plank.touched = 0; // the run stamps the real time; zero marks "touched this frame"
  };
  return course;
}

export class MonsterRun extends ArcadeRun {
  course: Course = buildCourse(MONSTER_LEVELS[0], MONSTER_LEVELS[0].start, 16);
  /** Chassis pose: centre between the axle mounts, nose-up angle in radians. */
  x = 0; y = 0; angle = 0; spinRate = 0; velocity = 0; grounded = true; airtime = 0;
  turbo = 0; turboCooldown = 0; hopCooldown = 0; invulnerable = 0; raceTime = 0; finishTime = 0;
  crash: { timer: number; message: string; splash: boolean } | null = null;
  splash: { x: number; at: number } | null = null;
  coins: { x: number; y: number; taken: boolean }[] = [];
  safeX = 0; flips = 0; lastLanding = '';
  private airRotation = 0; private sideTime = 0; private clock = 0; private pointers = new Map<number, 'left' | 'right'>();
  constructor(checkpoint?: unknown) {
    super('monster-strider', monsterCatalog.defaults, monsterCatalog.schema, checkpoint);
    // The intro screen previews the saved stage, not stage one.
    this.course = buildCourse(this.stage, this.stage.start, this.gravity); this.coins = this.stage.coins.map(([x, y]) => ({ x, y, taken: false })); this.pose();
  }
  get stage(): MonsterLevel { return levelFor(this.level); }
  get stageName(): string { return levelName(this.level); }
  get goal(): number { return this.stage.finish; }
  get progress(): number { return clamp((this.x - this.stage.start) / (this.stage.finish - this.stage.start), 0, 1); }
  get levelCount(): number { return MONSTER_LEVELS.length; }
  get gravity(): number { return this.config.gravity * .6; }
  protected setup(): void {
    const stage = this.stage; this.safeX = stage.start; this.course = buildCourse(stage, stage.start, this.gravity);
    this.coins = stage.coins.map(([x, y]) => ({ x, y, taken: false }));
    this.turbo = 0; this.turboCooldown = 0; this.hopCooldown = 0; this.invulnerable = .6; this.raceTime = 0; this.finishTime = 0; this.crash = null; this.splash = null;
    this.airtime = 0; this.airRotation = 0; this.sideTime = 0; this.clock = 0; this.flips = 0; this.lastLanding = ''; this.pointers.clear(); this.pose();
    this.notice = `${this.stageName.toUpperCase()} · ${stage.tip}`;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing' || this.crash) return;
    const t = this.course.truck;
    if (action === 'primary' && this.hopCooldown <= 0 && t.touching[0] < .1 && t.touching[1] < .1) {
      const p = this.course.sim.p, nx = -Math.sin(this.angle), ny = Math.cos(this.angle);
      for (const id of [...Object.values(t.parts), ...t.wheels]) { p[id].vx += nx * 6.2; p[id].vy += ny * 6.2; }
      this.hopCooldown = 1.1; this.metrics.actions++; this.cue('launch', 0, 0, 'HOP');
    }
    if (action === 'ability' && this.config.overdrive && this.turboCooldown <= 0) { this.turbo = 1.8; this.turboCooldown = 8; this.metrics.actions++; this.cue('ability', 0, 0, 'NITRO!'); }
    if (action === 'left' || action === 'right' || action === 'up' || action === 'down') this.metrics.actions++;
  }
  protected tick(dt: number): void {
    this.turbo = this.config.overdrive ? Math.max(0, this.turbo - dt) : 0; this.turboCooldown = Math.max(0, this.turboCooldown - dt);
    this.hopCooldown = Math.max(0, this.hopCooldown - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.crash) this.raceTime += dt;
    // Fixed physics steps keep position-based contacts identical at any frame rate. A crash plays out in slow motion.
    this.course.sim.gravity = this.gravity; this.clock += dt * (this.crash ? .45 : 1);
    while (this.clock >= STEP) { this.substep(STEP); this.clock -= STEP; }
    this.pose(); this.crumble(); this.rules(dt);
  }
  private throttle(): number { return this.crash ? 0 : Number(this.input.right || this.input.up) - Number(this.input.left || this.input.down); }
  private substep(h: number): void {
    const sim = this.course.sim, p = sim.p, t = this.course.truck, a0 = p[t.parts.a0], a1 = p[t.parts.a1];
    const length = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1, ux = (a1.x - a0.x) / length, uy = (a1.y - a0.y) / length, nx = -uy, ny = ux;
    const throttle = this.throttle(), boost = this.turbo > 0 ? 1.6 : 1, top = (7 + this.config.power * .45) * (this.turbo > 0 ? 1.45 : 1), drive = (20 + this.config.power * 1.1) * boost;
    const airborne = t.touching[0] > .06 && t.touching[1] > .06;
    let chassisTorque = 0;
    for (let i = 0; i < 2; i++) {
      const forward = -t.spin[i] * WHEEL_RADIUS; let torque = 0;
      if (throttle > 0) torque = forward < 0 ? -drive * 1.3 : -drive * clamp(1 - forward / top, 0, 1);
      else if (throttle < 0) torque = forward > .5 ? drive * 1.6 : drive * .75 * clamp(1 + forward / (top * .45), 0, 1);
      const before = t.spin[i]; t.spin[i] += torque / WHEEL_INERTIA * h;
      if (throttle < 0 && forward > .5 && Math.sign(t.spin[i]) !== Math.sign(before)) t.spin[i] = 0;
      if (!throttle) t.spin[i] *= 1 - Math.min(1, (airborne ? .6 : 1.4) * h);
      chassisTorque -= torque * .22;
    }
    // Air control: GAS rotates nose-up, BACK nose-down. The stabilizer steers the truck level instead.
    const omega = ((a1.vx - a0.vx) * nx + (a1.vy - a0.vy) * ny) / length;
    if (airborne) {
      if (this.config.assist) chassisTorque += -this.angle * 55 - omega * 16 + throttle * 25;
      else if (throttle * omega < 3.8) chassisTorque += throttle * 52;
    } else if (this.config.assist && Math.abs(this.angle) > .85) chassisTorque -= Math.sign(this.angle) * 40;
    const couple = chassisTorque / length * h;
    a1.vx += nx * couple * a1.w; a1.vy += ny * couple * a1.w; a0.vx -= nx * couple * a0.w; a0.vy -= ny * couple * a0.w;
    // Suspension springs push each wheel away from its mount along the chassis "up" axis.
    const k = this.gravity * 22, damping = Math.sqrt(k) * (this.config.assist ? 1.9 : 1.35);
    for (let i = 0; i < 2; i++) {
      const w = p[t.wheels[i]], m = i ? a1 : a0, height = (w.x - m.x) * nx + (w.y - m.y) * ny, rate = (w.vx - m.vx) * nx + (w.vy - m.vy) * ny;
      const force = -(k * (height - WHEEL_REST) + damping * rate) * h;
      w.vx += nx * force * w.w; w.vy += ny * force * w.w; m.vx -= nx * force * m.w; m.vy -= ny * force * m.w;
    }
    if (this.turbo > 0) for (const id of Object.values(t.parts)) { p[id].vx += ux * 9 * h; p[id].vy += uy * 9 * h; }
    sim.integrate(h);
    for (let i = 0; i < ITERATIONS; i++) { sim.solveLinks(); this.suspension(); sim.solveCollisions(); }
    sim.finishVelocities(h);
    sim.friction(h, new Set(t.wheels));
    for (let i = 0; i < 2; i++) {
      const w = p[t.wheels[i]];
      if (w.cn > 0) {
        t.touching[i] = 0;
        const tx = w.cny, ty = -w.cnx, [sx, sy] = sim.surfaceVelocity(w), slip = (w.vx - sx) * tx + (w.vy - sy) * ty + t.spin[i] * WHEEL_RADIUS;
        const limit = GRIP * w.cn / h / w.w, impulse = clamp(-slip / (w.w + WHEEL_RADIUS * WHEEL_RADIUS / WHEEL_INERTIA), -limit, limit);
        w.vx += tx * impulse * w.w; w.vy += ty * impulse * w.w; t.spin[i] += impulse * WHEEL_RADIUS / WHEEL_INERTIA;
      } else t.touching[i] += h;
      t.turn[i] += t.spin[i] * h;
    }
  }
  /** Keeps each wheel on its axle line and inside the suspension travel. */
  private suspension(): void {
    const p = this.course.sim.p, t = this.course.truck, a0 = p[t.parts.a0], a1 = p[t.parts.a1];
    const length = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1, ux = (a1.x - a0.x) / length, uy = (a1.y - a0.y) / length, nx = -uy, ny = ux;
    for (let i = 0; i < 2; i++) {
      const w = p[t.wheels[i]], m = i ? a1 : a0, sum = w.w + m.w, dx = w.x - m.x, dy = w.y - m.y;
      const lateral = dx * ux + dy * uy, height = dx * nx + dy * ny;
      const over = height > WHEEL_REST + TRAVEL_UP ? height - WHEEL_REST - TRAVEL_UP : height < WHEEL_REST - TRAVEL_DOWN ? height - WHEEL_REST + TRAVEL_DOWN : 0;
      const cx = ux * lateral + nx * over, cy = uy * lateral + ny * over;
      w.x -= cx * w.w / sum; w.y -= cy * w.w / sum; m.x += cx * m.w / sum; m.y += cy * m.w / sum;
    }
  }
  private pose(): void {
    const p = this.course.sim.p, t = this.course.truck, a0 = p[t.parts.a0], a1 = p[t.parts.a1], length = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1;
    this.x = (a0.x + a1.x) / 2; this.y = (a0.y + a1.y) / 2;
    const angle = Math.atan2(a1.y - a0.y, a1.x - a0.x), delta = Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle));
    this.angle = angle; this.spinRate = ((a1.vx - a0.vx) * -Math.sin(angle) + (a1.vy - a0.vy) * Math.cos(angle)) / length;
    this.velocity = ((a0.vx + a1.vx) * Math.cos(angle) + (a0.vy + a1.vy) * Math.sin(angle)) / 2;
    this.grounded = t.touching[0] < .06 || t.touching[1] < .06;
    if (!this.grounded) this.airRotation += delta;
  }
  private crumble(): void {
    const p = this.course.sim.p;
    for (const plank of this.course.planks) {
      if (plank.kind !== 'crumble') continue;
      if (plank.touched === 0) plank.touched = Math.max(1e-3, this.elapsed);
      if (plank.touched > 0 && !plank.fallen && this.elapsed - plank.touched > plank.delay) {
        plank.fallen = true; const a = p[plank.a], b = p[plank.b]; a.w = b.w = 1 / .4; a.vy = -.6; b.vy = -1.4;
      }
      if (plank.fallen && p[plank.a].y < WATER_Y - 3) { this.course.sim.segs[plank.seg].on = false; p[plank.a].w = p[plank.b].w = 0; }
    }
  }
  private rules(dt: number): void {
    const p = this.course.sim.p, t = this.course.truck, head = p[t.parts.h], stage = this.stage;
    if (this.crash) {
      this.crash.timer -= dt;
      if (this.crash.timer <= 0) this.respawn();
      return;
    }
    if (!this.grounded) this.airtime += dt;
    else {
      if (this.airtime > .35) this.land();
      this.airtime = 0; this.airRotation = 0;
    }
    const upsideDown = Math.abs(this.angle) > 1.95, bodyDown = Object.values(t.parts).some(id => p[id].cn > 0);
    this.sideTime = upsideDown && bodyDown && !this.grounded ? this.sideTime + dt : 0;
    if (this.invulnerable <= 0) {
      if (this.y < WATER_Y - .25 || Math.min(p[t.wheels[0]].y, p[t.wheels[1]].y) < WATER_Y - 1.2) { this.wreck('SPLASH! Build speed before the gap.', true); return; }
      if (head.cn > 0) { this.wreck('ROOF HIT! In the air, GAS tilts back and BACK tilts forward.', false); return; }
      if (this.sideTime > .7) { this.wreck('STUCK ON ITS SIDE. Keep the wheels under you.', false); return; }
    }
    for (const cp of stage.checkpoints) if (this.x > cp + 1 && cp > this.safeX && this.grounded && Math.abs(this.angle) < .6) { this.safeX = cp; this.cue('perfect', 0, 0, 'CHECKPOINT'); }
    for (const coin of this.coins) {
      if (coin.taken) continue;
      const near = Math.hypot(coin.x - this.x, coin.y - this.y) < 1.7 || t.wheels.some(id => Math.hypot(coin.x - p[id].x, coin.y - p[id].y) < 1.1);
      if (near) { coin.taken = true; this.addScore(this.config.bonus, 0, 0); }
    }
    if (this.x >= stage.finish && this.grounded && Math.abs(this.angle) < 1.2) {
      this.finishTime = this.raceTime; const fast = Math.max(0, Math.round((stage.par - this.raceTime) * 20));
      this.addScore(300 + this.lives * 50 + fast, 0, 0, 'FINISH!'); this.clear(0, 0);
    }
  }
  private land(): void {
    const turns = Math.floor((Math.abs(this.airRotation) + .6) / (Math.PI * 2)), t = this.course.truck, p = this.course.sim.p;
    const wheel = p[t.wheels[t.touching[0] === 0 ? 0 : 1]], slope = Math.atan2(-wheel.cnx, wheel.cny), clean = Math.abs(this.angle - slope) < .24;
    if (this.config.assist) this.metrics.assisted++;
    if (turns > 0) { this.flips += turns; this.addScore(150 * turns, 0, 0, `${turns > 1 ? `${turns}× ` : ''}${this.airRotation > 0 ? 'BACKFLIP' : 'FRONTFLIP'}!`); }
    if (clean) { this.metrics.perfects++; this.addScore(40 + Math.round(this.airtime * 30), 0, 0, 'PERFECT LANDING!'); this.lastLanding = 'perfect'; }
    else { this.addScore(15 + Math.round(this.airtime * 20), 0, 0, 'LANDED!'); this.lastLanding = 'landed'; }
    this.cue('hit', 0, 0);
  }
  private wreck(message: string, splash: boolean): void {
    this.crash = { timer: 1.15, message, splash }; this.notice = message; this.releaseInput(); this.pointers.clear();
    if (splash) this.splash = { x: this.x, at: this.elapsed };
    this.cue('hit', 0, 0, splash ? 'SPLASH!' : 'OUCH!');
  }
  private respawn(): void {
    const message = this.crash?.message ?? 'Try again.', splash = this.crash?.splash; this.crash = null;
    // Short word for the floating label; the full tip stays in the notice bar and on the result card.
    this.lose(0, 0, splash ? 'SPLASH' : 'WRECKED'); this.notice = message;
    if (this.phase !== 'playing') return;
    this.course = buildCourse(this.stage, this.safeX, this.gravity); this.invulnerable = 1; this.airtime = 0; this.airRotation = 0; this.sideTime = 0; this.turbo = 0; this.splash = null; this.pose();
    this.notice = `${message} Spare truck ready.`;
  }
  releaseInput(): void { super.releaseInput(); this.pointers?.clear(); }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, _y: number, pointerId = 0): void {
    if (phase === 'cancel') { this.pointers.clear(); this.input.left = false; this.input.right = false; return; }
    if (this.phase !== 'playing') return;
    if (phase === 'down') { this.pointers.set(pointerId, x < 500 ? 'left' : 'right'); this.metrics.actions++; }
    if (phase === 'up') this.pointers.delete(pointerId);
    const held = [...this.pointers.values()]; this.input.left = held.includes('left'); this.input.right = held.includes('right');
  }
  /** Replays any stage up to the furthest one reached without moving the campaign save. */
  playStage(level: number): boolean { return this.replayStage(level); }
  protected runtime() { return { distance: Math.max(0, Math.floor(this.x - this.stage.start)), velocity: Math.round(Math.abs(this.velocity)), airborne: this.grounded ? 0 : 1, tilt: Math.round(this.angle * 180 / Math.PI) }; }
  protected stageSummary() { return { lives: this.lives, coins: this.coins.reduce((mask, coin, i) => mask | (coin.taken ? 1 << i : 0), 0), time: Math.round(this.finishTime * 100), flips: this.flips }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) {
    this.course = buildCourse(this.stage, this.stage.finish, this.gravity); this.pose();
    this.lives = Math.floor(summary.lives ?? this.config.lives); this.finishTime = (summary.time ?? 0) / 100; this.raceTime = this.finishTime; this.flips = Math.floor(summary.flips ?? 0);
    this.coins.forEach((coin, i) => { coin.taken = Boolean((summary.coins ?? 0) & 1 << i); });
  }
  stats() { return [{ label: 'TIME', value: `${this.raceTime.toFixed(1)}s` }, { label: 'KM/H', value: Math.round(Math.abs(this.velocity) * 3.6) }, { label: 'TRUCKS', value: this.lives }]; }
}

/** Stopwatch format used on the result card, e.g. 0:08.21. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds), whole = Math.floor(s), minutes = Math.floor(whole / 60), rest = String(whole % 60).padStart(2, '0');
  return `${minutes}:${rest}.${String(Math.floor((s - whole) * 100)).padStart(2, '0')}`;
}
export type { Particle };
