import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { tomatinaCatalog } from './catalog';
import { levelOf, levelName, type TomatoGoal } from './levels';
import { ROBOT_LEVELS, WEATHER } from './worlds';
export { LEVELS, levelOf, levelName, GOAL_TEXT, type TomatoGoal, type TomatinaLevel } from './levels';

/**
 * TOMATINA: a first-person tomato fight through the streets of a Spanish town. The world is a grid of 2 m cells;
 * x grows east, z grows south, y is up. Facing angle `yaw` looks along (cos yaw, sin yaw).
 * The base class runs this in 1/120 s slices, so the throws and robots behave the same at any frame rate.
 */
export const CELL = 2, EYE = 1.5, PLAYER_R = .3, TOMATO_R = .12, TILE = 1;
const TALL = '#%|=O', LOW = 'of';
/** Heights of every solid cell kind, in metres. */
export const WALL_H: Record<string, number> = { '#': 4.6, '%': 3.2, '|': 3.6, '=': 4, O: 3.6, o: 1, f: 1.1, G: 3 };
const TURN = 2.5, THROW_COOL = .34, RAIN_COOL = 14, MAX_SPLATS = 360;

export type BotKind = 'mop' | 'spray' | 'umbrella' | 'vac' | 'boss';
export const BOT_INFO: Record<BotKind, { hp: number; r: number; h: number; speed: number; name: string }> = {
  mop: { hp: 1, r: .45, h: 1.3, speed: 1.6, name: 'MOP BOT' },
  spray: { hp: 2, r: .48, h: 1.55, speed: 1.8, name: 'HOSE BOT' },
  umbrella: { hp: 2, r: .5, h: 1.5, speed: 1.4, name: 'UMBRELLA BOT' },
  vac: { hp: 1, r: .42, h: .4, speed: 4, name: 'ROBO VACUUM' },
  boss: { hp: 20, r: 1.45, h: 3.1, speed: 1.1, name: 'LA GRAN LAVADORA' },
};
const KIND_OF: Record<string, BotKind> = { M: 'mop', S: 'spray', U: 'umbrella', V: 'vac', K: 'boss' };

export interface Bot {
  id: number; kind: BotKind; x: number; z: number; yaw: number; hp: number; max: number; alive: boolean;
  splatAt: number; alert: number; noticed: boolean; cool: number; stun: number; act: number;
  /** Umbrella: tomatoes caught in the canopy, and seconds it droops after catching too many. */
  load: number; droop: number;
  /** La Gran Lavadora: door opening (0 closed, 1 open) and seconds left in this phase. */
  door: number; cycle: number; open: boolean;
  vx: number; vz: number; think: number; tx: number; tz: number; homeX: number; homeZ: number;
  /** Tomato marks stuck to the robot: angle around the body and height. */
  marks: { a: number; y: number }[];
  /** Seconds since the last hit, for a quick flash. */
  hit: number;
}
export interface Tomato { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; bounces: number; banked: boolean; size: number; damage: number; homing: boolean; from: 'you' | 'amigo' | 'rain'; ox: number; oz: number }
export interface Water { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; foam: boolean }
export interface Splat { id: number; x: number; y: number; z: number; nx: number; ny: number; nz: number; r: number; life: number; seed: number }
export type PickupKind = 'crate' | 'churros' | 'cherry' | 'mega' | 'bounce' | 'golden' | 'drop';
export interface Pickup { id: number; kind: PickupKind; x: number; z: number; away: number; gone: boolean; life: number }
export interface Amigo { id: number; x: number; z: number; yaw: number; cool: number; stun: number; walk: number; throwing: number }
export type PowerKind = 'cherry' | 'mega' | 'bounce';
export const POWER_TEXT: Record<PowerKind, string> = { cherry: 'CHERRY STORM', mega: 'MEGA TOMATO', bounce: 'BOUNCY TOMATOES' };
const PICKUP_OF: Record<string, PickupKind> = { A: 'crate', H: 'churros', c: 'cherry', m: 'mega', b: 'bounce', g: 'golden' };
const RESPAWN: Record<PickupKind, number> = { crate: 18, churros: 35, cherry: 30, mega: 30, bounce: 30, golden: 0, drop: 0 };

/** A small deterministic random generator, so every street plays the same way for tests and bots. */
function random(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class TomatinaRun extends ArcadeRun {
  grid: string[][] = []; cols = 0; rows = 0; gatesOpen = false; exitOpen = false;
  px = 0; pz = 0; yaw = 0; speed = 0; startX = 0; startZ = 0; startYaw = 0;
  dry = 100; ammo = 20; cool = 0; rainCool = 0; invuln = 0; hurt = 0; happy = 0; bob = 0; throwAnim = 0; soakedAt = -9;
  power: Record<PowerKind, number> = { cherry: 0, mega: 0, bounce: 0 };
  bots: Bot[] = []; tomatoes: Tomato[] = []; water: Water[] = []; splats: Splat[] = []; pickups: Pickup[] = []; amigos: Amigo[] = [];
  /** Floor paint at 1 m resolution: 1 painted, 0 clean. Zone tiles belong to the plaza that a level asks you to paint. */
  paint = new Uint8Array(0); paintable = new Uint8Array(0); zone = new Uint8Array(0);
  paintedTiles = 0; paintableTiles = 0; zoneTiles = 0; zonePainted = 0;
  /** Target cells (row * cols + col) and the ones already hit. */
  targets: number[] = []; targetsHit = new Set<number>();
  tally = { robots: 0, golden: 0, exit: 0, boss: 0 };
  combo = 0; best = 0; lastSplat = -9; tags: string[] = []; blockedThrows = 0;
  display = { text: '', timer: 0 }; windX = 0; windZ = 0;
  private nextId = 1; private rng = random(1); private flows = new Map<number, Int16Array>(); private flowGates = false;
  private seed = 1; private washClock = 0;
  constructor(checkpoint?: unknown) { super('tomatina', tomatinaCatalog.defaults, tomatinaCatalog.schema, checkpoint); this.notice = 'The Limpiabots stole the tomatoes. Take them back and paint the town red!'; }

  get stage() { return levelOf(this.level); }
  get levelName() { return levelName(this.level); }
  get weather() { return WEATHER[this.config.weather ?? 'clear'] ?? WEATHER.clear; }
  get night() { return this.config.weather === 'night' || Boolean(this.stage.night); }
  get brains() { return ROBOT_LEVELS[this.config.difficulty ?? 'normal'] ?? ROBOT_LEVELS.normal; }
  get bag() { return this.config.ammo ?? 20; }
  get live() { return this.bots.filter(b => b.alive); }
  get paintPercent() { return this.paintableTiles ? Math.round(this.paintedTiles / this.paintableTiles * 100) : 0; }
  get zonePercent() { return this.zoneTiles ? Math.floor(this.zonePainted / this.zoneTiles * 100) : 0; }

  // ---------------------------------------------------------------- map
  at(col: number, row: number): string { return row < 0 || col < 0 || row >= this.rows || col >= this.cols ? '#' : this.grid[row][col]; }
  cellOf(x: number, z: number): [number, number] { return [Math.floor(x / CELL), Math.floor(z / CELL)]; }
  /** Walls, props and closed gates stop feet. */
  blocks(col: number, row: number): boolean { const c = this.at(col, row); return TALL.includes(c) || LOW.includes(c) || c === 'G' && !this.gatesOpen; }
  /** Tall walls stop eyes; low props and gate bars do not. */
  blind(col: number, row: number): boolean { return TALL.includes(this.at(col, row)); }
  /** Height that stops a flying tomato in this cell (0 for open street). */
  ceiling(col: number, row: number): number { const c = this.at(col, row); if (TALL.includes(c) || LOW.includes(c)) return WALL_H[c]; return c === 'G' && !this.gatesOpen ? WALL_H.G : 0; }
  center(col: number, row: number) { return { x: (col + .5) * CELL, z: (row + .5) * CELL }; }

  protected setup(): void {
    const stage = this.stage, map = stage.map, width = Math.max(...map.map(r => r.length));
    this.seed = this.level * 7919 + 13; this.rng = random(this.seed);
    this.grid = map.map(r => r.padEnd(width, '#').split('')); this.rows = map.length; this.cols = width; this.gatesOpen = false; this.exitOpen = false; this.flows.clear();
    this.bots = []; this.tomatoes = []; this.water = []; this.splats = []; this.pickups = []; this.amigos = []; this.targets = []; this.targetsHit = new Set();
    this.tally = { robots: 0, golden: 0, exit: 0, boss: 0 }; this.combo = 0; this.best = 0; this.lastSplat = -9; this.tags = []; this.blockedThrows = 0;
    this.power = { cherry: 0, mega: 0, bounce: 0 }; this.cool = 0; this.rainCool = 0; this.display = { text: stage.name.toUpperCase(), timer: 2.4 };
    const tw = this.cols * 2, th = this.rows * 2; this.paint = new Uint8Array(tw * th); this.paintable = new Uint8Array(tw * th); this.zone = new Uint8Array(tw * th);
    this.paintedTiles = this.paintableTiles = this.zoneTiles = this.zonePainted = 0;
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) {
      const c = this.grid[row][col], { x, z } = this.center(col, row);
      if (c === 'P') { this.startX = x; this.startZ = z; this.startYaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][stage.face]; }
      if (c === 'O') this.targets.push(row * this.cols + col);
      if (KIND_OF[c]) this.spawnBot(KIND_OF[c], x, z);
      if (PICKUP_OF[c]) this.pickups.push({ id: this.nextId++, kind: PICKUP_OF[c], x, z, away: 0, gone: false, life: 0 });
      const floor = !TALL.includes(c) && !LOW.includes(c) && c !== 'G';
      for (let k = 0; k < 4; k++) { const i = (row * 2 + (k >> 1)) * tw + col * 2 + (k & 1); if (floor) { this.paintable[i] = 1; this.paintableTiles++; } if (c === ',') { this.zone[i] = 1; this.zoneTiles++; } }
    }
    // Extra robots from the ROBOT INVASION mod, far from where you start.
    const kinds = [...new Set(this.bots.map(b => b.kind).filter(k => k !== 'boss'))]; if (!kinds.length) kinds.push('mop');
    const open: [number, number][] = [];
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) { const { x, z } = this.center(col, row); if ('.,'.includes(this.grid[row][col]) && Math.hypot(x - this.startX, z - this.startZ) > 12) open.push([x, z]); }
    for (let i = 0; i < (this.config.rivals ?? 0) && open.length; i++) { const [x, z] = open.splice(Math.floor(this.rng() * open.length), 1)[0]; this.spawnBot(kinds[i % kinds.length], x, z); }
    for (let i = 0; i < (this.config.teammates ?? 0); i++) this.amigos.push({ id: this.nextId++, x: this.startX, z: this.startZ, yaw: this.startYaw, cool: 1 + i * .5, stun: 0, walk: 0, throwing: 0 });
    this.respawn(); this.dry = 100; this.ammo = this.bag; this.windX = this.windZ = 0;
  }
  private spawnBot(kind: BotKind, x: number, z: number) {
    const info = BOT_INFO[kind], extra = kind === 'boss' ? Math.round(4 * (this.brains.speed - 1) + (this.level > 12 ? 4 : 0)) : 0;
    this.bots.push({ id: this.nextId++, kind, x, z, yaw: Math.PI / 2, hp: info.hp + extra, max: info.hp + extra, alive: true, splatAt: 0, alert: 0, noticed: false, cool: 1 + this.rng() * 1.5, stun: 0, act: 0, load: 0, droop: 0, door: 0, cycle: 4, open: false, vx: 0, vz: 0, think: this.rng(), tx: x, tz: z, homeX: x, homeZ: z, marks: [], hit: 9 });
  }
  private respawn() { this.px = this.startX; this.pz = this.startZ; this.yaw = this.startYaw; this.speed = 0; this.invuln = 2.5; this.hurt = 0; for (const a of this.amigos) { a.x = this.startX; a.z = this.startZ; } }

  // ---------------------------------------------------------------- runtime and summaries
  protected runtime(): Record<string, number> { return { splats: this.tally.robots, paint: this.paintPercent, tomatoes: this.ammo, dry: Math.round(this.dry), combo: this.combo }; }
  protected stageSummary(): Record<string, number> { return { robots: this.tally.robots, paint: this.paintPercent, best: this.best, golden: this.tally.golden, time: Math.round(this.elapsed) }; }
  protected restoreSummary(s: Readonly<Record<string, number>>): void { this.tally.robots = s.robots ?? 0; this.best = s.best ?? 0; this.tally.golden = s.golden ?? 0; this.elapsed = s.time ?? 0; }
  stats() { return [{ label: 'ROBOTS', value: `${this.tally.robots}/${this.bots.length}` }, { label: 'PAINT', value: `${this.paintPercent}%` }, { label: 'COMBO', value: this.combo > 1 ? `×${this.combo}` : '—' }]; }
  goalProgress(): { kind: TomatoGoal; value: number; count: number }[] {
    return this.stage.goals.map(([kind, count]) => ({ kind, count, value: Math.min(count, kind === 'robots' ? this.tally.robots : kind === 'zone' ? this.zonePercent : kind === 'targets' ? this.targetsHit.size : kind === 'golden' ? this.tally.golden : kind === 'boss' ? this.tally.boss : this.tally.exit) }));
  }

  // ---------------------------------------------------------------- controls
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary') this.aimAt(0, 0);
    else if (action === 'ability') this.tomatoRain();
  }
  /** Turns the view (drag to look). */
  look(delta: number) { if (this.phase === 'playing') this.yaw = wrap(this.yaw + clamp(delta, -1, 1)); }
  /** Where a throw starts: your right hand, just below the eyes. */
  hand() { const f = [Math.cos(this.yaw), Math.sin(this.yaw)], r = [-f[1], f[0]]; return { x: this.px + f[0] * .3 + r[0] * .22, y: EYE - .22, z: this.pz + f[1] * .3 + r[1] * .22 }; }
  /**
   * Throws at whatever is under a point on screen: `yaw` is the angle right of where you face and `pitch` the angle
   * above the horizon. The tomato is lobbed on the arc that lands exactly there (tap a robot, a wall or the street).
   * Tapping open sky throws high, which is how you lob over an umbrella.
   */
  aimAt(yaw: number, pitch: number): boolean {
    const a = this.yaw + yaw, dir = { x: Math.cos(a) * Math.cos(pitch), y: Math.sin(pitch), z: Math.sin(a) * Math.cos(pitch) };
    const hit = this.castRay(this.px, EYE, this.pz, dir.x, dir.y, dir.z, 60);
    return hit ? this.throwAt(hit.x, hit.y, hit.z) : this.throwDirection(a, pitch + .1);
  }
  /** First thing a ray from the eye meets: a robot (with a generous radius, for small fingers), a wall or the street. */
  castRay(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): { x: number; y: number; z: number; bot?: Bot } | null {
    let best = max, found: Bot | undefined;
    for (const bot of this.live) {
      const info = BOT_INFO[bot.kind], r = info.r + .3, fx = ox - bot.x, fz = oz - bot.z, a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c;
      if (a < 1e-6 || disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a), y = oy + dy * t;
      if (t > 0 && t < best && y > -.2 && y < info.h + .4 && !this.blockedBetween(ox, oz, ox + dx * t, oz + dz * t)) { best = t; found = bot; }
    }
    if (found) { const info = BOT_INFO[found.kind]; return { x: found.x, y: Math.min(info.h * .6, Math.max(.2, oy + dy * best)), z: found.z, bot: found }; }
    for (let t = .2; t < best; t += .05) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y <= 0) return { x, y: 0, z };
      const [col, row] = this.cellOf(x, z); if (y < this.ceiling(col, row)) return { x, y, z };
    }
    return null;
  }
  private blockedBetween(x0: number, z0: number, x1: number, z1: number) { return !this.lineOfSight(x0, z0, x1, z1); }
  /** Line of sight at eye height: only tall walls block it. */
  lineOfSight(x0: number, z0: number, x1: number, z1: number): boolean {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / .25);
    for (let i = 1; i < n; i++) { const t = i / n, [col, row] = this.cellOf(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t); if (this.blind(col, row)) return false; }
    return true;
  }
  /** Launch speed and the low arc that lands on a point (or a 45° throw if it is out of range). */
  ballistic(fx: number, fy: number, fz: number, x: number, y: number, z: number, speed: number, gravity: number, high = false) {
    const dx = x - fx, dz = z - fz, d = Math.max(.05, Math.hypot(dx, dz)), h = y - fy, v2 = speed * speed;
    const disc = v2 * v2 - gravity * (gravity * d * d + 2 * h * v2);
    const angle = disc >= 0 ? Math.atan((v2 + (high ? 1 : -1) * Math.sqrt(disc)) / (gravity * d)) : Math.PI / 4;
    return { vx: dx / d * speed * Math.cos(angle), vy: speed * Math.sin(angle), vz: dz / d * speed * Math.cos(angle), reach: disc >= 0 };
  }
  throwAt(x: number, y: number, z: number): boolean {
    const o = this.hand(); return this.release(this.ballistic(o.x, o.y, o.z, x, y, z, this.config.power, this.config.gravity));
  }
  throwDirection(angle: number, pitch: number): boolean {
    const v = this.config.power; return this.release({ vx: Math.cos(angle) * Math.cos(pitch) * v, vy: Math.sin(pitch) * v, vz: Math.sin(angle) * Math.cos(pitch) * v });
  }
  private release(v: { vx: number; vy: number; vz: number }): boolean {
    if (this.phase !== 'playing' || this.cool > 0) return false;
    if (this.ammo <= 0) { this.say('OUT OF TOMATOES! FIND A CRATE', 1.4); return false; }
    const o = this.hand(), cherry = this.power.cherry > 0, spread = cherry ? [-.1, 0, .1] : [0];
    for (const s of spread) {
      const c = Math.cos(s), n = Math.sin(s);
      this.tomatoes.push(this.tomato(o.x, o.y, o.z, v.vx * c - v.vz * n, v.vy, v.vx * n + v.vz * c, 'you'));
    }
    this.ammo--; this.cool = cherry ? .16 : THROW_COOL; this.throwAnim = 1; this.metrics.actions++; this.cue('launch', this.px, this.pz);
    return true;
  }
  private tomato(x: number, y: number, z: number, vx: number, vy: number, vz: number, from: Tomato['from']): Tomato {
    const mega = this.power.mega > 0 && from === 'you';
    return { id: this.nextId++, x, y, z, vx, vy, vz, t: 0, bounces: (this.config.bounces ?? 0) + (this.power.bounce > 0 && from === 'you' ? 3 : 0), banked: false, size: mega ? 5 : this.config.splash ?? 2, damage: mega ? 3 : 1, homing: false, from, ox: x, oz: z };
  }
  /** TOMATO RAIN: tomatoes pour from the sky onto every robot near you. */
  tomatoRain() {
    if (!this.config.overdrive || this.rainCool > 0 || this.phase !== 'playing') return;
    this.rainCool = RAIN_COOL; let n = 0;
    for (const bot of this.live) if (Math.hypot(bot.x - this.px, bot.z - this.pz) < 13) { for (let k = 0; k < 2; k++) this.tomatoes.push(this.tomato(bot.x + (k - .5) * .2, 7 + k * 1.5, bot.z, 0, -3, 0, 'rain')); n++; }
    for (let i = 0; i < 16 - Math.min(8, n); i++) { const a = this.rng() * Math.PI * 2, d = 1.5 + this.rng() * 7; this.tomatoes.push(this.tomato(this.px + Math.cos(a) * d, 6 + this.rng() * 4, this.pz + Math.sin(a) * d, 0, -2, 0, 'rain')); }
    this.cue('ability', this.px, this.pz, 'TOMATO RAIN!'); this.say('¡LLUVIA DE TOMATES!', 1.6);
  }
  say(text: string, time = 1.2) { this.display = { text, timer: time }; }

  // ---------------------------------------------------------------- simulation
  protected tick(dt: number): void {
    const w = this.weather;
    this.display.timer = Math.max(0, this.display.timer - dt); this.cool = Math.max(0, this.cool - dt); this.rainCool = Math.max(0, this.rainCool - dt);
    this.invuln = Math.max(0, this.invuln - dt); this.hurt = Math.max(0, this.hurt - dt); this.happy = Math.max(0, this.happy - dt); this.throwAnim = Math.max(0, this.throwAnim - dt * 3.2);
    for (const k of Object.keys(this.power) as PowerKind[]) this.power[k] = Math.max(0, this.power[k] - dt);
    if (w.wind) { const a = this.elapsed * .13 + this.seed, gust = w.wind * (.6 + .4 * Math.sin(this.elapsed * .7)); this.windX = Math.cos(a) * gust; this.windZ = Math.sin(a) * gust; } else this.windX = this.windZ = 0;
    this.movePlayer(dt);
    this.updateTomatoes(dt); this.updateWater(dt); this.updateBots(dt); this.updateAmigos(dt); this.updatePickups(dt);
    for (const s of this.splats) if (s.life < 1 && s.life > 0) s.life = Math.max(0, s.life - dt * .05);
    if (w.wash) this.washRain(dt, w.wash);
    this.splats = this.splats.filter(s => s.life > 0);
    this.checkGoals();
  }
  private movePlayer(dt: number) {
    const i = this.input, turn = (i.right ? 1 : 0) - (i.left ? 1 : 0), go = (i.up ? 1 : 0) - (i.down ? .7 : 0);
    this.yaw = wrap(this.yaw + turn * TURN * dt);
    const target = go * this.config.speed * this.weather.grip; this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (Math.abs(this.speed) > .05) { this.slide(Math.cos(this.yaw) * this.speed * dt, Math.sin(this.yaw) * this.speed * dt); this.bob += dt * Math.abs(this.speed) * 1.9; }
    // Robots and friends push back gently, so you never walk through them.
    for (const b of this.live) { const r = BOT_INFO[b.kind].r + PLAYER_R, dx = this.px - b.x, dz = this.pz - b.z, d = Math.hypot(dx, dz); if (d < r && d > 1e-4) this.slide(dx / d * (r - d), dz / d * (r - d)); }
    if (this.exitOpen && this.at(...this.cellOf(this.px, this.pz)) === 'X' && !this.tally.exit) { this.tally.exit = 1; this.checkGoals(); }
  }
  /** Moves with wall sliding: each axis separately against solid cells (circle against squares). */
  private slide(dx: number, dz: number) {
    const tryMove = (x: number, z: number) => {
      const [c0, r0] = this.cellOf(x - PLAYER_R, z - PLAYER_R), [c1, r1] = this.cellOf(x + PLAYER_R, z + PLAYER_R);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.blocks(c, r)) {
        const nx = clamp(x, c * CELL, (c + 1) * CELL), nz = clamp(z, r * CELL, (r + 1) * CELL); if (Math.hypot(x - nx, z - nz) < PLAYER_R) return false;
      }
      return true;
    };
    if (tryMove(this.px + dx, this.pz)) this.px += dx;
    if (tryMove(this.px, this.pz + dz)) this.pz += dz;
  }
  private moveBody(b: { x: number; z: number }, r: number, dx: number, dz: number): boolean {
    const free = (x: number, z: number) => { const [c0, r0] = this.cellOf(x - r, z - r), [c1, r1] = this.cellOf(x + r, z + r); for (let row = r0; row <= r1; row++) for (let c = c0; c <= c1; c++) if (this.blocks(c, row)) { const nx = clamp(x, c * CELL, (c + 1) * CELL), nz = clamp(z, row * CELL, (row + 1) * CELL); if (Math.hypot(x - nx, z - nz) < r) return false; } return true; };
    let moved = false; if (free(b.x + dx, b.z)) { b.x += dx; moved = true; } if (free(b.x, b.z + dz)) { b.z += dz; moved = true; } return moved;
  }

  private updateTomatoes(dt: number) {
    const g = this.config.gravity, keep: Tomato[] = [];
    for (const t of this.tomatoes) {
      t.t += dt; t.vy -= g * dt; t.vx += this.windX * dt; t.vz += this.windZ * dt;
      if (this.config.assist && t.from === 'you') this.home(t, dt);
      const px = t.x, pz = t.z; t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
      let done = false;
      for (const bot of this.live) {
        const info = BOT_INFO[bot.kind];
        if (Math.hypot(t.x - bot.x, t.z - bot.z) < info.r + TOMATO_R * t.size / 2 && t.y > -.1 && t.y < info.h + .1) { this.hitBot(bot, t); done = true; break; }
      }
      if (!done && t.y <= 0) { this.splatAt(t, t.x, 0, t.z, 0, 1, 0); done = true; }
      if (!done) {
        const [col, row] = this.cellOf(t.x, t.z), top = this.ceiling(col, row);
        if (t.y < top) {
          const [pc, pr] = this.cellOf(px, pz), sideX = pc !== col, sideZ = pr !== row;
          if (top < 1.5 && t.y > top - .25 && !sideX && !sideZ) { this.splatAt(t, t.x, top, t.z, 0, 1, 0); done = true; }
          else if (t.bounces > 0) {
            t.x = px; t.z = pz; if (sideX || !sideZ) t.vx = -t.vx * .8; if (sideZ || !sideX) t.vz = -t.vz * .8; t.vy *= .8; t.bounces--; t.banked = true;
          } else {
            const nx = sideX ? Math.sign(px - t.x) : 0, nz = !sideX ? Math.sign(pz - t.z) || 1 : 0;
            const fx = sideX ? (nx > 0 ? (col + 1) * CELL : col * CELL) : t.x, fz = !sideX ? (nz > 0 ? (row + 1) * CELL : row * CELL) : t.z;
            this.splatAt(t, fx, t.y, fz, nx, 0, nz);
            if (this.at(col, row) === 'O') this.hitTarget(row * this.cols + col, t);
            done = true;
          }
        }
      }
      if (!done && (t.t > 6 || t.y < -2 || t.x < -4 || t.z < -4 || t.x > this.cols * CELL + 4 || t.z > this.rows * CELL + 4)) done = true;
      if (!done) keep.push(t);
    }
    this.tomatoes = keep;
  }
  /** TOMATO RADAR: bends a flying tomato toward the nearest robot ahead of it. */
  private home(t: Tomato, dt: number) {
    const speed = Math.hypot(t.vx, t.vz); if (speed < 1) return;
    let best: Bot | null = null, bestD = 22;
    for (const b of this.live) { const dx = b.x - t.x, dz = b.z - t.z, d = Math.hypot(dx, dz); if (d < bestD && (dx * t.vx + dz * t.vz) / (d * speed) > .8 && this.lineOfSight(t.x, t.z, b.x, b.z)) { best = b; bestD = d; } }
    if (!best) return;
    const want = Math.atan2(best.z - t.z, best.x - t.x), now = Math.atan2(t.vz, t.vx), turn = clamp(wrap(want - now), -3 * dt, 3 * dt);
    if (Math.abs(turn) > 1e-4) { const a = now + turn; t.vx = Math.cos(a) * speed; t.vz = Math.sin(a) * speed; t.homing = true; }
    // Keep the arc dropping onto the robot, not over it.
    const info = BOT_INFO[best.kind], fall = (t.y - info.h * .5) / Math.max(.1, bestD / speed); if (t.vy > -fall) t.vy -= Math.min(6 * dt, t.vy + fall);
  }
  private hitBot(bot: Bot, t: Tomato) {
    const info = BOT_INFO[bot.kind], toward = Math.atan2(t.z - bot.z, t.x - bot.x), front = Math.cos(wrap(toward - bot.yaw)) > .35;
    const falling = t.vy < -3 && t.y > info.h * .75;
    if (bot.kind === 'umbrella' && front && !falling && bot.droop <= 0) {
      bot.load++; bot.hit = 0; if (t.from === 'you') this.blockedThrows++; bot.alert = Math.max(bot.alert, 5); this.splatAt(t, bot.x + Math.cos(bot.yaw) * .8, 0, bot.z + Math.sin(bot.yaw) * .8, 0, 1, 0, true);
      if (bot.load >= 3) { bot.droop = 3.5; bot.load = 0; this.say('THE UMBRELLA DROOPS!', 1.3); } else this.say('BLOCKED! TRY THE SIDE', .9);
      this.cue('hit', bot.x, bot.z); return;
    }
    if (bot.kind === 'boss' && (!bot.open || !front)) {
      bot.hit = 0; this.splatAt(t, bot.x, 0, bot.z, 0, 1, 0, true); this.say(bot.open ? 'HIT THE OPEN DOOR!' : 'CLANG! WAIT FOR THE DOOR', .9); this.cue('hit', bot.x, bot.z); return;
    }
    bot.hp -= t.damage; bot.hit = 0; bot.stun = bot.kind === 'boss' ? .4 : .35; bot.alert = Math.max(bot.alert, 6); bot.marks = [...bot.marks, { a: wrap(toward - bot.yaw), y: clamp(t.y, .2, info.h) }].slice(-8);
    if (t.homing) this.metrics.assisted++;
    // La Gran Lavadora slams its door after five tomatoes in one opening.
    if (bot.kind === 'boss' && ++bot.load >= 5 && bot.hp > t.damage) { bot.open = false; bot.cycle = 4.4; bot.load = 0; this.say('¡AY! THE DOOR SLAMS SHUT', 1.4); }
    this.splatAt(t, t.x, Math.max(0, t.y), t.z, 0, 0, 0, true);
    if (bot.hp <= 0) this.splatBot(bot, t);
    else { this.cue('hit', bot.x, bot.z); this.say(bot.kind === 'boss' ? `¡OLÉ! ${bot.hp} TO GO` : 'SPLAT!', .7); }
  }
  private splatBot(bot: Bot, t: Tomato | null) {
    bot.alive = false; bot.splatAt = this.elapsed; bot.hp = 0; this.tally.robots++; if (bot.kind === 'boss') this.tally.boss = 1;
    this.combo = this.elapsed - this.lastSplat < 2.5 ? this.combo + 1 : 1; this.lastSplat = this.elapsed; this.best = Math.max(this.best, this.combo);
    const tags: string[] = [], dist = t ? Math.hypot(bot.x - t.ox, bot.z - t.oz) : 0;
    if (t?.banked) tags.push('BANK SHOT'); if (t && dist > 15) tags.push('LONG SHOT'); if (t && bot.kind === 'umbrella' && t.vy < -3) tags.push('LOB');
    if (!bot.noticed) tags.push('SNEAKY'); if (this.combo >= 3) tags.push(`COMBO ×${this.combo}`);
    this.tags = tags; if (tags.length) this.metrics.perfects++;
    const points = this.config.bonus * Math.min(this.combo, 5) * (1 + tags.length * .5) * (bot.kind === 'boss' ? 10 : 1);
    this.addScore(points, bot.x, bot.z, tags.length ? `${tags.join(' · ')} +${Math.round(points)}` : `SPLAT! +${Math.round(points)}`);
    this.say(bot.kind === 'boss' ? '¡LA LAVADORA ESTÁ KAPUT!' : tags.length ? tags.join(' · ') : '¡SPLAT!', 1.4); this.happy = 1.2;
    if (tags.length || this.combo >= 3) this.cue('perfect', bot.x, bot.z);
    this.paintFloor(bot.x, bot.z, bot.kind === 'boss' ? 4 : 1.7); this.addSplat(bot.x, 0, bot.z, 0, 1, 0, bot.kind === 'boss' ? 3.6 : 1.5);
    // Splatted robots drop the tomatoes they confiscated.
    if (bot.kind !== 'vac') this.pickups.push({ id: this.nextId++, kind: 'drop', x: bot.x + .4, z: bot.z, away: 0, gone: false, life: 25 });
  }
  private hitTarget(cell: number, t: Tomato) {
    if (this.targetsHit.has(cell)) return;
    this.targetsHit.add(cell); this.addScore(150 * (t.banked ? 2 : 1), t.x, t.z, t.banked ? 'BANK SHOT BULLSEYE!' : 'BULLSEYE!'); this.cue('perfect', t.x, t.z);
    this.say(this.targetsHit.size >= this.targets.length ? 'THE GATE IS OPEN!' : `BULLSEYE! ${this.targetsHit.size}/${this.targets.length}`, 1.4);
    if (this.targetsHit.size >= this.targets.length && !this.gatesOpen) { this.gatesOpen = true; this.flows.clear(); }
  }
  /** A tomato bursts: paint a splat, maybe splash robots standing close. */
  private splatAt(t: Tomato, x: number, y: number, z: number, nx: number, ny: number, nz: number, quiet = false) {
    const radius = .5 + .3 * t.size;
    if (ny === 1 && y === 0) this.paintFloor(x, z, radius);
    if (nx || ny || nz) this.addSplat(x, y, z, nx, ny, nz, radius);
    if (t.size >= 4) for (const bot of this.live) if (Math.hypot(bot.x - x, bot.z - z) < radius + BOT_INFO[bot.kind].r && bot.kind !== 'boss') {
      bot.hp -= 1; bot.hit = 0; bot.alert = 6; if (bot.hp <= 0) this.splatBot(bot, t);
    }
    if (!quiet) this.cue('hit', x, z);
  }
  private addSplat(x: number, y: number, z: number, nx: number, ny: number, nz: number, r: number) {
    this.splats.push({ id: this.nextId++, x, y, z, nx, ny, nz, r, life: 1, seed: this.rng() }); if (this.splats.length > MAX_SPLATS) this.splats.shift();
  }
  private tiles(x: number, z: number, r: number, each: (i: number) => void) {
    const tw = this.cols * 2; for (let tz = Math.floor((z - r) / TILE); tz <= Math.floor((z + r) / TILE); tz++) for (let tx = Math.floor((x - r) / TILE); tx <= Math.floor((x + r) / TILE); tx++) {
      if (tx < 0 || tz < 0 || tx >= tw || tz >= this.rows * 2 || Math.hypot((tx + .5) * TILE - x, (tz + .5) * TILE - z) > r + .35) continue; each(tz * tw + tx);
    }
  }
  paintFloor(x: number, z: number, r: number) {
    let fresh = 0;
    this.tiles(x, z, r, i => { if (this.paintable[i] && !this.paint[i]) { this.paint[i] = 1; this.paintedTiles++; fresh++; if (this.zone[i]) this.zonePainted++; } });
    if (fresh) this.score += fresh * 2;
  }
  cleanFloor(x: number, z: number, r: number, rate: number) {
    this.tiles(x, z, r, i => { if (this.paint[i]) { this.paint[i] = 0; this.paintedTiles--; if (this.zone[i]) this.zonePainted--; } });
    for (const s of this.splats) if (s.ny === 1 && Math.hypot(s.x - x, s.z - z) < r + s.r * .5) s.life = Math.min(s.life, 1) - rate;
  }
  private washRain(dt: number, wash: number) {
    this.washClock += dt; if (this.washClock < .5) return; this.washClock = 0;
    const tw = this.cols * 2;
    // Every half second each painted tile has a small chance to rinse clean.
    for (let i = 0; i < this.paint.length; i++) if (this.paint[i] && this.rng() < wash * .5) { this.paint[i] = 0; this.paintedTiles--; if (this.zone[i]) this.zonePainted--; const x = (i % tw + .5) * TILE, z = (Math.floor(i / tw) + .5) * TILE; for (const s of this.splats) if (s.ny === 1 && Math.hypot(s.x - x, s.z - z) < s.r * .6) s.life = Math.min(s.life, .999) - .15; }
  }

  private updateWater(dt: number) {
    const keep: Water[] = [];
    for (const w of this.water) {
      w.t += dt; if (!w.foam) w.vy -= 9 * dt; w.vx += this.windX * dt * .6; w.vz += this.windZ * dt * .6;
      w.x += w.vx * dt; w.y += w.vy * dt; w.z += w.vz * dt;
      const [col, row] = this.cellOf(w.x, w.z);
      if (Math.hypot(w.x - this.px, w.z - this.pz) < .45 && w.y < 1.9) { this.soak(w.foam ? 10 : 12, w.x, w.z); continue; }
      const friend = this.amigos.find(a => Math.hypot(w.x - a.x, w.z - a.z) < .4 && w.y < 1.8); if (friend) { friend.stun = 2.5; continue; }
      if (w.y <= 0) { this.cleanFloor(w.x, w.z, .7, .35); continue; }
      if (w.y < this.ceiling(col, row) || w.t > (w.foam ? 4.5 : 3)) continue;
      keep.push(w);
    }
    this.water = keep;
  }
  /** Getting hit by water. At zero you are soaked and change into a spare shirt back at the start. */
  soak(amount: number, x: number, z: number) {
    if (this.invuln > 0 || this.phase !== 'playing') return;
    this.dry = Math.max(0, this.dry - amount * this.brains.soak); this.hurt = .6; this.cue('hit', x, z);
    if (this.dry > 0) return;
    this.soakedAt = this.elapsed; this.lose(this.px, this.pz, 'SOAKED! Back to the start in a dry shirt.'); this.combo = 0;
    if (this.phase === 'playing') { this.respawn(); this.dry = 100; this.ammo = Math.max(this.ammo, Math.ceil(this.bag / 2)); this.water = []; this.say('SOAKED! FRESH SHIRT ON', 1.8); }
  }

  private flowTo(col: number, row: number): Int16Array {
    if (this.flowGates !== this.gatesOpen) { this.flows.clear(); this.flowGates = this.gatesOpen; }
    const key = row * this.cols + col, cached = this.flows.get(key); if (cached) return cached;
    const dist = new Int16Array(this.cols * this.rows).fill(-1), queue = [key]; dist[key] = 0;
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q], c = cur % this.cols, r = Math.floor(cur / this.cols);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr, n = nr * this.cols + nc; if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows || dist[n] >= 0 || this.blocks(nc, nr)) continue; dist[n] = dist[cur] + 1; queue.push(n); }
    }
    if (this.flows.size > 24) this.flows.delete(this.flows.keys().next().value!);
    this.flows.set(key, dist); return dist;
  }
  /** Next cell centre on the shortest walk to a goal cell, or null when already there (or no way through). */
  stepToward(x: number, z: number, goalCol: number, goalRow: number): { x: number; z: number } | null {
    const [c, r] = this.cellOf(x, z); if (c === goalCol && r === goalRow) return null;
    const dist = this.flowTo(goalCol, goalRow); let best = -1, bestD = dist[r * this.cols + c] >= 0 ? dist[r * this.cols + c] : 1e4;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (r + dr) * this.cols + c + dc; if (c + dc < 0 || r + dr < 0 || c + dc >= this.cols || r + dr >= this.rows) continue; if (dist[n] >= 0 && dist[n] < bestD) { bestD = dist[n]; best = n; } }
    return best < 0 ? null : this.center(best % this.cols, Math.floor(best / this.cols));
  }
  /** Walking distance in cells between two points (or -1 when walled off). */
  walkCells(x0: number, z0: number, x1: number, z1: number) { const [c, r] = this.cellOf(x0, z0), [gc, gr] = this.cellOf(x1, z1); return this.flowTo(gc, gr)[r * this.cols + c]; }

  private updateBots(dt: number) {
    const brains = this.brains, pace = this.stage.pace * brains.speed, sight = brains.sight * this.weather.sight * (this.night ? .6 / Math.max(.6, this.weather.sight) : 1) * Math.min(1.2, .7 + this.stage.pace * .3);
    for (const b of this.bots) {
      b.hit += dt;
      if (!b.alive) continue;
      const info = BOT_INFO[b.kind], dx = this.px - b.x, dz = this.pz - b.z, d = Math.hypot(dx, dz), facing = Math.atan2(dz, dx);
      b.stun = Math.max(0, b.stun - dt); b.act = Math.max(0, b.act - dt); b.droop = Math.max(0, b.droop - dt); b.cool -= dt; b.think -= dt;
      const sees = d < sight && this.lineOfSight(b.x, b.z, this.px, this.pz);
      if (sees || d < 3) { b.alert = Math.max(b.alert, 3); if (!b.noticed && (sees && d < sight * .85 || d < 2.2)) b.noticed = true; } else b.alert = Math.max(0, b.alert - dt);
      if (b.stun > 0) continue;
      const speed = info.speed * pace, turnTo = (a: number, rate: number) => { b.yaw = wrap(b.yaw + clamp(wrap(a - b.yaw), -rate * dt, rate * dt)); };
      const walk = (tx: number, tz: number, s = speed) => {
        const [gc, gr] = this.cellOf(tx, tz), step = this.lineOfSight(b.x, b.z, tx, tz) && Math.hypot(tx - b.x, tz - b.z) < 4 ? { x: tx, z: tz } : this.stepToward(b.x, b.z, gc, gr) ?? { x: tx, z: tz };
        const ax = step.x - b.x, az = step.z - b.z, l = Math.hypot(ax, az); if (l < .05) return;
        turnTo(Math.atan2(az, ax), 6); const m = Math.min(l, s * dt); this.moveBody(b, info.r, ax / l * m, az / l * m);
      };
      switch (b.kind) {
        case 'mop': {
          if (b.alert > 0 && d < 7) { walk(this.px, this.pz, speed * 1.15); if (d < info.r + PLAYER_R + .25 && b.cool <= 0) { b.cool = 1.1; b.act = .4; this.soak(6, b.x, b.z); } break; }
          if (b.think <= 0) { b.think = 1.2; const target = this.nearestPaint(b.x, b.z, 11); if (target) { b.tx = target.x; b.tz = target.z; } else { b.tx = b.homeX + (this.rng() - .5) * 6; b.tz = b.homeZ + (this.rng() - .5) * 6; } }
          if (Math.hypot(b.tx - b.x, b.tz - b.z) > .6) walk(b.tx, b.tz, speed * .8); else if (this.paint[this.tileIndex(b.tx, b.tz)]) { b.act = .5; this.cleanFloor(b.x, b.z, .9, dt * 2.2); }
          break;
        }
        case 'spray': {
          if (b.alert > 0) {
            turnTo(facing, 4);
            if (d > 9 || !sees) walk(this.px, this.pz); else if (d < 4.5) { const l = Math.max(.01, d); this.moveBody(b, info.r, -dx / l * speed * .8 * dt, -dz / l * speed * .8 * dt); }
            if (sees && b.cool <= 0 && d < sight) {
              b.cool = brains.fire / Math.max(.7, this.stage.pace); b.act = .45; const lead = Math.min(.5, d / 10), tx = this.px + Math.cos(this.yaw) * this.speed * lead, tz = this.pz + Math.sin(this.yaw) * this.speed * lead;
              const sx = b.x + Math.cos(b.yaw) * .6, sz = b.z + Math.sin(b.yaw) * .6, v = this.ballistic(sx, 1.1, sz, tx, 1.1, tz, 10, 9);
              this.water.push({ id: this.nextId++, x: sx, y: 1.1, z: sz, vx: v.vx, vy: v.vy, vz: v.vz, t: 0, foam: false });
            }
          } else if (b.think <= 0) { b.think = 2.5; b.tx = b.homeX + (this.rng() - .5) * 4; b.tz = b.homeZ + (this.rng() - .5) * 4; } else if (Math.hypot(b.tx - b.x, b.tz - b.z) > .5) walk(b.tx, b.tz, speed * .5);
          break;
        }
        case 'umbrella': {
          if (b.alert > 0) {
            turnTo(facing, b.droop > 0 ? .4 : 1.5);
            if (d > info.r + PLAYER_R + .5) walk(this.px, this.pz, speed);
            if (d < 1.5 && b.cool <= 0) { b.cool = 1.3; b.act = .45; this.soak(8, b.x, b.z); }
            turnTo(facing, b.droop > 0 ? .4 : 1.5);
          } else if (b.think <= 0) { b.think = 2; b.tx = b.homeX + (this.rng() - .5) * 4; b.tz = b.homeZ + (this.rng() - .5) * 4; } else if (Math.hypot(b.tx - b.x, b.tz - b.z) > .5) walk(b.tx, b.tz, speed * .5);
          break;
        }
        case 'vac': {
          if (b.think <= 0 || Math.hypot(b.vx, b.vz) < .1) { b.think = 1 + this.rng() * 2; const a = b.alert > 0 && sees && this.rng() < .5 ? facing : this.rng() * Math.PI * 2; b.vx = Math.cos(a) * speed; b.vz = Math.sin(a) * speed; }
          if (!this.moveBody(b, info.r, b.vx * dt, b.vz * dt) || this.blocks(...this.cellOf(b.x + b.vx * .2, b.z + b.vz * .2))) { const a = Math.atan2(b.vz, b.vx) + Math.PI * (.6 + this.rng() * .8); b.vx = Math.cos(a) * speed; b.vz = Math.sin(a) * speed; }
          turnTo(Math.atan2(b.vz, b.vx), 8); this.cleanFloor(b.x, b.z, .6, dt * 3);
          if (d < info.r + PLAYER_R + .15 && b.cool <= 0) { b.cool = 1; this.soak(4, b.x, b.z); }
          break;
        }
        case 'boss': {
          turnTo(facing, .9); b.cycle -= dt;
          if (b.cycle <= 0) { b.open = !b.open; b.load = 0; b.cycle = b.open ? 3 : 4.4 / Math.max(.8, pace); if (b.open) this.say('THE DOOR IS OPEN! SPLAT THE DRUM!', 1.6); }
          b.door += ((b.open ? 1 : 0) - b.door) * Math.min(1, dt * 6);
          if (!b.open) {
            if (d > 5) walk(this.px, this.pz, speed);
            if (b.cool <= 0) { b.cool = 2.2 / Math.max(.8, pace); b.act = .6; for (let k = 0; k < 10; k++) { const a = b.yaw + k / 10 * Math.PI * 2; this.water.push({ id: this.nextId++, x: b.x + Math.cos(a) * 1.6, y: .45, z: b.z + Math.sin(a) * 1.6, vx: Math.cos(a) * 4.6, vy: 0, vz: Math.sin(a) * 4.6, t: 0, foam: true }); } }
          }
          break;
        }
      }
      // Robots keep a little space between them.
      for (const o of this.bots) if (o !== b && o.alive) { const sx = b.x - o.x, sz = b.z - o.z, sd = Math.hypot(sx, sz), r = info.r + BOT_INFO[o.kind].r; if (sd < r && sd > 1e-4) this.moveBody(b, info.r, sx / sd * (r - sd) * .5, sz / sd * (r - sd) * .5); }
    }
  }
  tileIndex(x: number, z: number) { return Math.floor(z / TILE) * this.cols * 2 + Math.floor(x / TILE); }
  private nearestPaint(x: number, z: number, r: number): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null, bestD = r; const tw = this.cols * 2;
    for (let tz = Math.max(0, Math.floor(z - r)); tz < Math.min(this.rows * 2, Math.ceil(z + r)); tz++) for (let tx = Math.max(0, Math.floor(x - r)); tx < Math.min(tw, Math.ceil(x + r)); tx++) {
      if (!this.paint[tz * tw + tx]) continue; const cx = tx + .5, cz = tz + .5, d = Math.hypot(cx - x, cz - z); if (d < bestD) { bestD = d; best = { x: cx, z: cz }; }
    }
    return best;
  }
  private updateAmigos(dt: number) {
    this.amigos.forEach((a, i) => {
      a.stun = Math.max(0, a.stun - dt); a.cool -= dt; a.throwing = Math.max(0, a.throwing - dt * 3); if (a.stun > 0) return;
      const side = i % 2 ? 1 : -1, back = 1.4 + Math.floor(i / 2) * 1.2, fx = Math.cos(this.yaw), fz = Math.sin(this.yaw);
      let tx = this.px - fx * back - fz * side * 1.1, tz = this.pz - fz * back + fx * side * 1.1;
      if (this.blocks(...this.cellOf(tx, tz))) { tx = this.px - fx * back; tz = this.pz - fz * back; }
      const d = Math.hypot(tx - a.x, tz - a.z);
      if (d > 8 || !this.lineOfSight(a.x, a.z, this.px, this.pz)) { const step = this.stepToward(a.x, a.z, ...this.cellOf(this.px, this.pz)); if (step) { tx = step.x; tz = step.z; } }
      if (d > .3) { const s = Math.min(d, this.config.speed * 1.1 * dt); this.moveBody(a, .28, (tx - a.x) / d * s, (tz - a.z) / d * s); a.walk += dt * 7; a.yaw = Math.atan2(tz - a.z, tx - a.x); }
      if (a.cool <= 0) {
        const target = this.live.filter(b => Math.hypot(b.x - a.x, b.z - a.z) < 11 && this.lineOfSight(a.x, a.z, b.x, b.z)).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
        a.cool = target ? 2.2 : .5;
        if (target) { a.yaw = Math.atan2(target.z - a.z, target.x - a.x); a.throwing = 1; const v = this.ballistic(a.x, 1.4, a.z, target.x, BOT_INFO[target.kind].h * .55, target.z, Math.max(14, this.config.power), this.config.gravity); this.tomatoes.push(this.tomato(a.x, 1.4, a.z, v.vx, v.vy, v.vz, 'amigo')); }
      }
    });
  }
  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      if (p.gone) continue;
      if (p.kind === 'drop') { p.life -= dt; if (p.life <= 0) { p.gone = true; continue; } }
      if (p.away > 0) { p.away = Math.max(0, p.away - dt); continue; }
      if (Math.hypot(p.x - this.px, p.z - this.pz) > .9) continue;
      switch (p.kind) {
        case 'crate': if (this.ammo >= this.bag) continue; this.ammo = Math.min(this.bag, this.ammo + 10); this.say('+10 TOMATOES', 1); break;
        case 'drop': if (this.ammo >= this.bag) continue; this.ammo = Math.min(this.bag, this.ammo + 3); this.say('+3 TOMATOES', .8); break;
        case 'churros': if (this.dry >= 100) continue; this.dry = Math.min(100, this.dry + 40); this.say('CHURROS! +40 DRY', 1.1); break;
        case 'golden': this.tally.golden++; this.addScore(500, p.x, p.z, 'GOLDEN TOMATO!'); this.say('¡TOMATE DE ORO!', 1.5); this.cue('perfect', p.x, p.z); break;
        default: this.power[p.kind] = 10; this.ammo = Math.min(this.bag, this.ammo + 5); this.say(POWER_TEXT[p.kind], 1.4); this.cue('ability', p.x, p.z);
      }
      if (RESPAWN[p.kind]) p.away = RESPAWN[p.kind]; else p.gone = true;
      this.cue('score', p.x, p.z);
    }
    this.pickups = this.pickups.filter(p => !p.gone || p.kind !== 'drop');
  }
  private checkGoals() {
    if (this.phase !== 'playing') return;
    const goals = this.stage.goals, others = goals.filter(([k]) => k !== 'exit'), progress = this.goalProgress();
    const done = (kind: TomatoGoal) => { const g = progress.find(p => p.kind === kind)!; return g.value >= g.count; };
    if (!others.every(([k]) => done(k))) return;
    if (goals.some(([k]) => k === 'exit') && !this.tally.exit) { if (!this.exitOpen) { this.exitOpen = true; this.say('THE FIESTA IS OPEN! RUN TO THE EXIT', 2.2); } return; }
    this.addScore(1000 + Math.max(0, 600 - Math.round(this.elapsed) * 4), this.px, this.pz, 'STREET CLEAR!');
    this.clear(this.px, this.pz); this.say('¡FIESTA!', 3);
  }
}
