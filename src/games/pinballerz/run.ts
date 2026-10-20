import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { pinballCatalog } from './catalog';

/** Table space: 640 × 920 units, y grows toward the player and the drain. */
export const TABLE = { width: 640, height: 920, centre: 298 }, BALL_R = 11, STEP = 1 / 600;
export interface Pinball { id: number; x: number; y: number; vx: number; vy: number; ramp: { s: number; speed: number } | null; trail: { x: number; y: number }[] }
export interface Bumper { x: number; y: number; radius: number; flash: number; cooldown: number }
export interface Flipper { x: number; y: number; angle: number; omega: number; left: boolean; rest: number; up: number; length: number; pressed: number }
export interface Sling { a: [number, number]; b: [number, number]; d: [number, number]; flash: number }
export interface DropTarget { x: number; y0: number; y1: number; down: boolean; flash: number }
export type PinGoal = 'score' | 'bumpers' | 'drops' | 'ramps' | 'spins' | 'lanes' | 'multiball' | 'jackpots';
export interface PinStage { name: string; tip: string; goals: readonly [PinGoal, number][] }
type Seg = readonly [number, number, number, number];

export function closestSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / Math.max(1e-6, dx * dx + dy * dy), 0, 1);
  return { x: ax + dx * t, y: ay + dy * t, t };
}
const mirror = ([ax, ay, bx, by]: Seg): Seg => [TABLE.centre * 2 - ax, ay, TABLE.centre * 2 - bx, by];
/** The top of the cabinet is an elliptical arch over the playfield and the shooter lane. */
export const arcY = (x: number) => 310 - 260 * Math.sqrt(Math.max(0, 1 - ((x - 320) / 280) ** 2));
const ARC: Seg[] = Array.from({ length: 32 }, (_, i) => { const a0 = Math.PI - i * Math.PI / 32, a1 = Math.PI - (i + 1) * Math.PI / 32; return [320 + 280 * Math.cos(a0), 310 - 260 * Math.sin(a0), 320 + 280 * Math.cos(a1), 310 - 260 * Math.sin(a1)]; });
export const LANES = [238, 298, 358], LANE_DIVIDERS = [208, 268, 328, 388];
const LEFT_SIDE: Seg[] = [[70, 596, 70, 760], [70, 760, 198, 805], [40, 556, 58, 584]];
export const SLINGS_GEOMETRY: [number, number][][] = [[[118, 640], [118, 725], [186, 762]], [[478, 640], [478, 725], [410, 762]]];
/** Static rails: cabinet walls, the arch, lane dividers, outlanes, inlane guides, the ramp throat and the spinner lane. */
export const PIN_RAILS: readonly Seg[] = [
  ...ARC, [40, 310, 40, 940], [600, 310, 600, 905], [556, 332, 556, 905], [556, 892, 600, 892],
  ...LANE_DIVIDERS.map((x): Seg => [x, arcY(x), x, 165]),
  ...LEFT_SIDE, ...LEFT_SIDE.map(mirror),
  [432, 548, 446, 478], [516, 528, 504, 462],
  [190, 500, 190, 560], [256, 500, 256, 560],
];
/** Rubber posts that split balls between the outlanes and inlanes. */
export const POSTS: readonly [number, number, number][] = [[70, 590, 7], [TABLE.centre * 2 - 70, 590, 7]];
export const GATE: Seg = [600, 292, 556, 332];
export const RAMP_MOUTH: Seg = [446, 478, 504, 462];
/** Ramp centre line in table space with height above the playfield; it carries the ball up and over to the left inlane. */
export const RAMP_PATH: readonly [number, number, number][] = [[475, 470, 0], [482, 380, 30], [474, 270, 60], [430, 180, 80], [345, 140, 90], [250, 160, 90], [165, 225, 80], [118, 330, 62], [100, 450, 42], [98, 560, 22], [98, 640, 4]];
const RAMP_LENGTHS = RAMP_PATH.slice(1).map((p, i) => Math.hypot(p[0] - RAMP_PATH[i][0], p[1] - RAMP_PATH[i][1]));
export const RAMP_LENGTH = RAMP_LENGTHS.reduce((a, b) => a + b, 0);
export function rampPoint(s: number) {
  let left = clamp(s, 0, RAMP_LENGTH);
  for (let i = 0; i < RAMP_LENGTHS.length; i++) {
    if (left <= RAMP_LENGTHS[i] || i === RAMP_LENGTHS.length - 1) { const t = clamp(left / RAMP_LENGTHS[i], 0, 1), a = RAMP_PATH[i], b = RAMP_PATH[i + 1]; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t }; }
    left -= RAMP_LENGTHS[i];
  }
  return { x: RAMP_PATH[0][0], y: RAMP_PATH[0][1], z: 0 };
}
export const SPINNER = { x0: 196, x1: 250, y: 530 };
const PLUNGER = { x: 578, y: 892 - BALL_R - 4 };

export const PIN_STAGES: readonly PinStage[] = [
  { name: 'Warm Up', tip: 'Tap LAUNCH, then flip. Hold a flipper up to catch the ball.', goals: [['score', 2500]] },
  { name: 'Pop Party', tip: 'The three pop bumpers kick back hard. Feed them.', goals: [['bumpers', 15]] },
  { name: 'Knock Down', tip: 'Shoot the orange targets on the left wall. Drop all three.', goals: [['drops', 1]] },
  { name: 'Ramp Rider', tip: 'Fire the LEFT flipper up the glowing ramp on the right.', goals: [['ramps', 2]] },
  { name: 'Spin Doctor', tip: 'Shoot the RIGHT flipper through the spinner lane.', goals: [['spins', 30]] },
  { name: 'Light the Lanes', tip: 'Roll through N, E and O at the top. Flippers move the lit lanes.', goals: [['lanes', 1]] },
  { name: 'Combo Crew', tip: 'Ramps and targets: mix your shots.', goals: [['ramps', 3], ['drops', 1]] },
  { name: 'Multiball', tip: 'Three ramp shots start MULTIBALL. Keep every ball alive!', goals: [['multiball', 1]] },
  { name: 'Jackpot Hunter', tip: 'During multiball, every ramp is a JACKPOT.', goals: [['jackpots', 1]] },
  { name: 'Full House', tip: 'Lanes and targets, twice each.', goals: [['lanes', 2], ['drops', 2]] },
  { name: 'Spin Cycle', tip: 'Spinner and ramp: a real pinball workout.', goals: [['spins', 60], ['ramps', 4]] },
  { name: 'Grand Champion', tip: 'Two jackpots and a monster score. Go!', goals: [['jackpots', 2], ['score', 60000]] },
];
export const pinStage = (level: number): PinStage => {
  const base = PIN_STAGES[(Math.max(1, level) - 1) % PIN_STAGES.length], loop = Math.floor((Math.max(1, level) - 1) / PIN_STAGES.length);
  return loop ? { ...base, goals: base.goals.map(([k, n]) => [k, k === 'multiball' || k === 'jackpots' ? n + loop : Math.round(n * (1 + loop * .5))]) } : base;
};
export const pinStageName = (level: number) => pinStage(level).name + (level > PIN_STAGES.length ? ` ${Math.ceil(level / PIN_STAGES.length)}` : '');
export const GOAL_TEXT: Record<PinGoal, string> = { score: 'POINTS', bumpers: 'BUMPER HITS', drops: 'TARGET BANKS', ramps: 'RAMP SHOTS', spins: 'SPINS', lanes: 'LANE SETS', multiball: 'MULTIBALL', jackpots: 'JACKPOTS' };

export class PinballRun extends ArcadeRun {
  balls: Pinball[] = []; waiting = true; bumpers: Bumper[] = []; flippers: Flipper[] = []; slings: Sling[] = []; drops: DropTarget[] = [];
  lanes = [false, false, false]; laneFlash = [0, 0, 0]; spinner = { angle: 0, omega: 0 }; rampFlash = 0;
  tally: Record<PinGoal, number> = { score: 0, bumpers: 0, drops: 0, ramps: 0, spins: 0, lanes: 0, multiball: 0, jackpots: 0 };
  hits = 0; nudges = 3; nudgeCooldown = 0; saveTimer = 0; saveUsed = false; stageScore = 0; pulse = 0; bonus = 1; locks = 0;
  /** Short message for the dot-matrix display. */
  display = { text: '', timer: 0 };
  private nextId = 1; private autoLaunch: number[] = []; private dropReset = 0; private stuck = new Map<number, number>(); private trailTimer = 0;
  private pointerSides = new Map<number, 'left' | 'right'>(); private wasHeld = [false, false];
  constructor(checkpoint?: unknown) { super('pinballerz', pinballCatalog.defaults, pinballCatalog.schema, checkpoint); }
  get stage() { return pinStage(this.level); }
  get levelName() { return pinStageName(this.level); }
  /** The first ball, for older callers and the camera. */
  get ball(): Pinball { return this.balls[0] ?? this.newBall(); }
  get multiball() { return this.balls.length > 1; }
  /** Just enough to top the arch and drop onto the lanes, whatever the table gravity. */
  get plungeSpeed() { return Math.sqrt(2 * this.gravity * (PLUNGER.y - 150) + 430 ** 2); }
  get gravity() { return this.config.gravity * (1 + Math.min(.3, (this.level - 1) * .025)); }
  goalProgress() { return this.stage.goals.map(([kind, count]) => ({ kind, count, value: Math.min(count, kind === 'score' ? this.score - this.stageScore : this.tally[kind]) })); }
  protected setup(): void {
    this.pointerSides.clear(); this.wasHeld = [false, false];
    this.bumpers = [[230, 268], [366, 268], [298, 352]].map(([x, y]) => ({ x, y, radius: 30, flash: 0, cooldown: 0 }));
    this.flippers = [{ x: 202, y: 818, angle: .5, omega: 0, left: true, rest: .5, up: -.45, length: 80, pressed: 0 }, { x: 394, y: 818, angle: Math.PI - .5, omega: 0, left: false, rest: Math.PI - .5, up: Math.PI + .45, length: 80, pressed: 0 }];
    this.slings = SLINGS_GEOMETRY.map(([a, b, d]) => ({ a, b, d, flash: 0 }));
    this.drops = [392, 432, 472].map(y0 => ({ x: 52, y0, y1: y0 + 36, down: false, flash: 0 }));
    this.lanes = [false, false, false]; this.laneFlash = [0, 0, 0]; this.spinner = { angle: 0, omega: 0 }; this.rampFlash = 0;
    this.tally = { score: 0, bumpers: 0, drops: 0, ramps: 0, spins: 0, lanes: 0, multiball: 0, jackpots: 0 };
    this.hits = 0; this.stageScore = this.score; this.pulse = 0; this.bonus = 1; this.locks = 0; this.autoLaunch = []; this.dropReset = 0; this.stuck.clear();
    this.serve(); this.show(this.levelName.toUpperCase(), 3);
    this.notice = `${this.levelName.toUpperCase()} · ${this.stage.tip}`;
  }
  private newBall(): Pinball { return { id: this.nextId++, x: PLUNGER.x, y: PLUNGER.y, vx: 0, vy: 0, ramp: null, trail: [] }; }
  private show(text: string, seconds = 1.8) { this.display = { text, timer: seconds }; }
  private serve(): void { this.balls = [this.newBall()]; this.waiting = true; this.saveUsed = false; this.saveTimer = 0; this.nudges = 3; this.stuck.clear(); }
  launchBall(): boolean {
    if (this.phase !== 'playing' || !this.waiting) return false;
    this.waiting = false; const b = this.balls[0]; b.x = PLUNGER.x; b.y = PLUNGER.y; b.vx = 0; b.vy = -this.plungeSpeed; this.metrics.actions++; this.saveTimer = this.config.assist ? 8 : 0;
    this.cue('launch', b.x, b.y); this.notice = 'BALL IN PLAY. Left and right flippers: arrows, A/D, or tap each half of the table.'; return true;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' || action === 'launch') { if (!this.launchBall()) { this.pulse = .17; this.metrics.actions++; } }
    if (action === 'nudge' || action === 'ability') {
      if (this.waiting || this.nudges <= 0 || this.nudgeCooldown > 0) return;
      this.nudges--; this.nudgeCooldown = 1.5; this.metrics.actions++;
      for (const b of this.balls) if (!b.ramp) { b.vy -= 260; b.vx += clamp((TABLE.centre - b.x) * .8, -200, 200); }
      this.cue('ability', this.ball.x, this.ball.y, 'NUDGE'); this.notice = `${this.nudges} nudge${this.nudges === 1 ? '' : 's'} left on this ball.`;
    }
    if (action === 'left' || action === 'right') { this.metrics.actions++; const f = this.flippers.find(f => f.left === (action === 'left')); if (f) f.pressed = .18; }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, _y: number, pointerId = 0): void {
    if (phase === 'move' && !this.pointerSides.has(pointerId)) return;
    if (phase === 'cancel') this.pointerSides.clear();
    else if (phase === 'up') this.pointerSides.delete(pointerId);
    else this.pointerSides.set(pointerId, x < TABLE.width / 2 ? 'left' : 'right');
    this.input.left = [...this.pointerSides.values()].includes('left'); this.input.right = [...this.pointerSides.values()].includes('right');
    if (phase === 'down' && this.waiting) this.launchBall();
  }
  held(f: Flipper) { return this.pulse > 0 || (f.left ? this.input.left : this.input.right) || f.pressed > 0; }
  protected tick(dt: number): void {
    this.pulse = Math.max(0, this.pulse - dt); this.nudgeCooldown = Math.max(0, this.nudgeCooldown - dt); this.saveTimer = Math.max(0, this.saveTimer - dt);
    this.display.timer = Math.max(0, this.display.timer - dt); this.rampFlash = Math.max(0, this.rampFlash - dt); this.laneFlash = this.laneFlash.map(t => Math.max(0, t - dt));
    for (const b of this.bumpers) { b.flash = Math.max(0, b.flash - dt); b.cooldown = Math.max(0, b.cooldown - dt); }
    for (const s of this.slings) s.flash = Math.max(0, s.flash - dt);
    for (const d of this.drops) d.flash = Math.max(0, d.flash - dt);
    if (this.dropReset > 0) { this.dropReset -= dt; if (this.dropReset <= 0) for (const d of this.drops) d.down = false; }
    // Pressing a flipper rotates the lit top lanes, so a skilled player can line up the gap.
    this.flippers.forEach((f, i) => {
      f.pressed = Math.max(0, f.pressed - dt); const held = this.held(f);
      if (held && !this.wasHeld[i] && !this.lanes.every(l => l === this.lanes[0])) this.lanes = f.left ? [...this.lanes.slice(1), this.lanes[0]] : [this.lanes[2], ...this.lanes.slice(0, 2)];
      this.wasHeld[i] = held;
    });
    this.autoLaunch = this.autoLaunch.map(t => t - dt);
    while (this.autoLaunch.length && this.autoLaunch[0] <= 0) { this.autoLaunch.shift(); const b = this.newBall(); b.vy = -this.plungeSpeed; this.balls.push(b); this.cue('launch', b.x, b.y); }
    const steps = Math.max(1, Math.round(dt / STEP)), h = dt / steps;
    for (let s = 0; s < steps && this.phase === 'playing'; s++) this.substep(h);
    if (this.phase !== 'playing') return;
    this.spinner.angle += this.spinner.omega * dt; this.spinner.omega *= Math.exp(-dt * 1.1);
    while (this.spinner.angle > Math.PI * 2) { this.spinner.angle -= Math.PI * 2; this.tally.spins++; this.addScore(100, SPINNER.x0 + 27, SPINNER.y); }
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) { this.trailTimer = .016; for (const b of this.balls) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 14) b.trail.shift(); } }
    for (const b of this.balls) {
      // A ball that rolls back down the shooter lane waits for another launch; one wedged elsewhere gets a shake.
      const speed = Math.hypot(b.vx, b.vy), wait = (this.stuck.get(b.id) ?? 0) + dt, resting = speed < 25 && !b.ramp;
      this.stuck.set(b.id, resting ? wait : 0);
      if (resting && b.x > 556 && b.y > 850 && this.balls.length === 1) { this.waiting = true; b.x = PLUNGER.x; b.y = PLUNGER.y; b.vx = b.vy = 0; }
      else if (resting && wait > 2.5 && b.y < 760) { b.vy = -320; b.vx += b.x < TABLE.centre ? 120 : -120; this.stuck.set(b.id, 0); }
    }
    if (this.goalProgress().every(g => g.value >= g.count)) { this.show('STAGE CLEAR', 4); this.clear(TABLE.centre, 460); }
  }
  private substep(h: number): void {
    // Coil strength sets how fast the bats swing, and so how hard they hit.
    const swing = 21 * this.config.power / 900;
    for (const f of this.flippers) {
      const target = this.held(f) ? f.up : f.rest, previous = f.angle; f.angle += clamp(target - f.angle, -h * swing, h * swing); f.omega = (f.angle - previous) / h;
    }
    if (this.waiting) return;
    const g = this.gravity;
    for (const b of [...this.balls]) {
      if (b.ramp) { this.rideRamp(b, h); continue; }
      const px = b.x, py = b.y; b.vy += g * h; b.vx *= 1 - h * .08; b.vy *= 1 - h * .08; b.x += b.vx * h; b.y += b.vy * h;
      for (const r of PIN_RAILS) this.collide(b, r[0], r[1], r[2], r[3], 3, .45);
      for (const [x, y, r] of POSTS) this.collide(b, x, y, x, y, r, .7);
      if (b.vy > 0) this.collide(b, GATE[0], GATE[1], GATE[2], GATE[3], 3, .3);
      this.rampMouth(b, px, py); if (b.ramp) continue;
      for (const s of this.slings) this.sling(b, s);
      for (const bumper of this.bumpers) this.bumper(b, bumper);
      for (const d of this.drops) if (!d.down) { const n = this.collide(b, d.x, d.y0, d.x, d.y1, 4, .3); if (n > 140) this.dropHit(d); }
      for (const f of this.flippers) this.flipper(b, f);
      if (py >= 130 !== b.y >= 130) LANES.forEach((x, i) => { if (Math.abs(b.x - x) < 26) this.laneHit(i); });
      if (py >= SPINNER.y !== b.y >= SPINNER.y && b.x > SPINNER.x0 && b.x < SPINNER.x1) { this.spinner.omega = Math.min(70, Math.max(this.spinner.omega, Math.abs(b.vy) / 22)); this.cue('hit', b.x, b.y); }
      const speed = Math.hypot(b.vx, b.vy); if (speed > 2600) { b.vx *= 2600 / speed; b.vy *= 2600 / speed; }
      if (b.y > 945) { this.drain(b); if (this.phase !== 'playing') return; }
    }
    // Balls knock into each other during multiball.
    for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
      const a = this.balls[i], c = this.balls[j]; if (a.ramp || c.ramp) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy); if (d >= BALL_R * 2 || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, push = (BALL_R * 2 - d) / 2; a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
      const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; c.vx -= rel * nx; c.vy -= rel * ny; }
    }
  }
  /** Pushes the ball out of a capsule rail and bounces it. Returns the approach speed, or 0 without contact. */
  private collide(b: Pinball, ax: number, ay: number, bx: number, by: number, radius: number, restitution: number, surface = { x: 0, y: 0 }): number {
    const p = closestSegment(b.x, b.y, ax, ay, bx, by), dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), min = BALL_R + radius;
    if (d >= min) return 0;
    const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1; b.x = p.x + nx * min; b.y = p.y + ny * min;
    const vn = (b.vx - surface.x) * nx + (b.vy - surface.y) * ny; if (vn >= 0) return 0;
    b.vx -= (1 + restitution) * vn * nx; b.vy -= (1 + restitution) * vn * ny; return -vn;
  }
  private flipper(b: Pinball, f: Flipper): void {
    const ex = f.x + Math.cos(f.angle) * f.length, ey = f.y + Math.sin(f.angle) * f.length, p = closestSegment(b.x, b.y, f.x, f.y, ex, ey), radius = 12 - 5 * p.t;
    // The rubber moves with the bat: a swinging flipper hands its surface speed to the ball.
    const surface = { x: -f.omega * (p.y - f.y), y: f.omega * (p.x - f.x) }, speed = this.collide(b, f.x, f.y, ex, ey, radius, .3, surface);
    if (speed > 300 && Math.abs(f.omega) > 1) this.cue('launch', b.x, b.y);
  }
  private sling(b: Pinball, s: Sling): void {
    this.collide(b, s.a[0], s.a[1], s.b[0], s.b[1], 4, .4); this.collide(b, s.b[0], s.b[1], s.d[0], s.d[1], 4, .4);
    const face = closestSegment(b.x, b.y, s.a[0], s.a[1], s.d[0], s.d[1]).t, n = this.collide(b, s.a[0], s.a[1], s.d[0], s.d[1], 5, .5);
    // Only the rubber face kicks, never the corners; it fires toward the middle of the table.
    if (n > 90 && s.flash <= 0 && face > .08 && face < .92) {
      const ex = s.d[0] - s.a[0], ey = s.d[1] - s.a[1], len = Math.hypot(ex, ey), left = s.a[0] < TABLE.centre, nx = (left ? ey : -ey) / len, ny = (left ? -ex : ex) / len;
      b.vx += nx * 520; b.vy += ny * 520; s.flash = .12; this.addScore(10, b.x, b.y); this.cue('hit', b.x, b.y);
    }
  }
  private bumper(b: Pinball, bumper: Bumper): void {
    const dx = b.x - bumper.x, dy = b.y - bumper.y, d = Math.hypot(dx, dy), min = bumper.radius + BALL_R; if (d >= min) return;
    const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1; b.x = bumper.x + nx * min; b.y = bumper.y + ny * min;
    const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
    const out = b.vx * nx + b.vy * ny; if (out < 720) { b.vx += (720 - out) * nx; b.vy += (720 - out) * ny; }
    if (bumper.cooldown <= 0) { bumper.flash = .22; bumper.cooldown = .08; this.hits++; this.tally.bumpers++; this.addScore(this.config.bonus * (this.config.overdrive ? 2 : 1), bumper.x, bumper.y); this.cue('hit', bumper.x, bumper.y); }
  }
  private dropHit(d: DropTarget): void {
    d.down = true; d.flash = .3; this.addScore(500, d.x, (d.y0 + d.y1) / 2); this.cue('hit', d.x, d.y0);
    if (this.drops.every(t => t.down)) { this.tally.drops++; this.dropReset = 1.4; this.addScore(2500 * this.bonus, 80, 430, 'TARGETS DOWN'); this.show('TARGETS DOWN'); this.metrics.perfects++; }
  }
  private laneHit(i: number): void {
    if (this.lanes[i]) return; this.lanes[i] = true; this.laneFlash[i] = .4; this.addScore(300, LANES[i], 130);
    if (this.lanes.every(Boolean)) { this.tally.lanes++; this.bonus = Math.min(5, this.bonus + 1); this.lanes = [false, false, false]; this.addScore(2000, TABLE.centre, 140, `BONUS ×${this.bonus}`); this.show(`BONUS X${this.bonus}`); this.metrics.perfects++; }
  }
  private rampMouth(b: Pinball, px: number, py: number): void {
    const [ax, ay, bx, by] = RAMP_MOUTH, ex = bx - ax, ey = by - ay, len = Math.hypot(ex, ey), nx = ey / len, ny = -ex / len;
    const before = (px - ax) * nx + (py - ay) * ny, after = (b.x - ax) * nx + (b.y - ay) * ny, along = ((b.x - ax) * ex + (b.y - ay) * ey) / (len * len);
    // n points up the ramp: only a ball crossing upward from the playfield can enter. Balls dropping from behind pass under.
    if (!(before < 0 && after >= 0) || along < -.05 || along > 1.05) return;
    const into = b.vx * nx + b.vy * ny;
    if (into > 680) { b.ramp = { s: 0, speed: Math.min(1500, into * .85 + 250) }; this.cue('launch', b.x, b.y); return; }
    // Too slow: the ball rolls back out of the ramp throat.
    b.x = px; b.y = py; b.vx -= 1.4 * into * nx; b.vy -= 1.4 * into * ny; this.show('TOO SLOW', 1);
  }
  private rideRamp(b: Pinball, h: number): void {
    const r = b.ramp!; r.speed = Math.max(520, r.speed - 260 * h); r.s += r.speed * h; const p = rampPoint(r.s); b.x = p.x; b.y = p.y;
    if (r.s < RAMP_LENGTH) return;
    b.ramp = null; b.vx = 0; b.vy = 380; this.rampFlash = .6; this.tally.ramps++;
    if (this.multiball) { this.tally.jackpots++; this.addScore(10000 * (this.config.overdrive ? 2 : 1), 300, 150, 'JACKPOT!'); this.show('JACKPOT!', 2.5); this.metrics.perfects++; return; }
    this.locks++; this.addScore(1500 * this.bonus, 300, 150, 'RAMP!');
    if (this.locks >= 3) { this.locks = 0; this.tally.multiball++; this.autoLaunch.push(.3, 1.1); this.show('MULTIBALL!', 3); this.notice = 'MULTIBALL! Every ramp is a JACKPOT while two balls are in play.'; this.cue('perfect', 300, 300, 'MULTIBALL!'); }
    else this.show(`RAMP ${this.locks}/3`);
  }
  private drain(b: Pinball): void {
    this.balls = this.balls.filter(x => x !== b); this.stuck.delete(b.id);
    if (this.balls.length || this.autoLaunch.length) { if (this.balls.length === 1 && !this.autoLaunch.length) this.show('MULTIBALL OVER'); return; }
    if (this.config.assist && this.saveTimer > 0 && !this.saveUsed) {
      this.saveUsed = true; this.metrics.assisted++; this.autoLaunch.push(.4); this.cue('ability', TABLE.centre, 780, 'BALL SAVED'); this.show('BALL SAVED'); this.notice = 'BALL SAVED. You are still in the game!'; return;
    }
    this.lose(TABLE.centre, 810, 'BALL DRAINED'); this.show(this.lives ? `${this.lives} BALL${this.lives === 1 ? '' : 'S'} LEFT` : 'GAME OVER', 2);
    if (this.phase === 'playing') { this.locks = 0; this.bonus = 1; this.serve(); }
  }
  protected runtime() { return { ramps: this.tally.ramps, drops: this.tally.drops }; }
  protected stageSummary() { return { stageScore: this.score - this.stageScore, lives: this.lives, ramps: this.tally.ramps }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.stageScore = Math.max(0, this.score - Math.floor(summary.stageScore ?? 0)); this.lives = Math.floor(summary.lives ?? this.config.lives); this.tally.ramps = Math.floor(summary.ramps ?? 0); this.show('STAGE CLEAR', 99); }
  stats() { return [{ label: 'BALLS', value: this.lives }, { label: 'BONUS', value: `×${this.bonus}` }, { label: 'RAMPS', value: this.tally.ramps }]; }
}
