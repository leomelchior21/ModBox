import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { anominersCatalog } from './catalog';
import { asteroidOf, asteroidName, type Asteroid } from './levels';
import { MOODS, SECTORS, WEATHER } from './worlds';
export { ASTEROIDS, asteroidOf, asteroidName } from './levels';

/**
 * ANOMINERS: a cozy asteroid-mining roguelike. The asteroid is a grid of cells; your ship flies over it in cell
 * units, its drill beam cuts the rock in front of it, loose minerals float to your ship and you bank them at your
 * base. When the timer runs out the anomaly opens a rift and sends anomalites after you: fight them, destroy the
 * rift, or bank your quota and warp away. The base class runs this in 1/120 s slices.
 */
export const EMPTY = 0, ROCK = 1, HARD = 2, COPPER = 3, CRYSTAL = 4, GOLD = 5, TECH = 6, MAGMA = 7, ICE = 8, VOID = 9;
export const HARDNESS = [0, 1, 3, 1.3, 2.2, 2.8, 2.4, 1.6, .55, 4];
export const ORE_VALUE: Record<number, number> = { [COPPER]: 1, [CRYSTAL]: 3, [GOLD]: 5, [ICE]: 1 };
export const SHIP_R = .8, MARGIN = 12;
export type ChunkKind = 'copper' | 'crystal' | 'gold' | 'ice' | 'tech' | 'shard';
const KIND_OF: Record<number, ChunkKind> = { [COPPER]: 'copper', [CRYSTAL]: 'crystal', [GOLD]: 'gold', [ICE]: 'ice', [TECH]: 'tech' };
export interface Chunk { id: number; x: number; y: number; vx: number; vy: number; kind: ChunkKind; value: number; age: number; from: number }
export interface Glitch { id: number; x: number; y: number; vx: number; vy: number; hp: number; cool: number; seed: number }
export interface Bolt { id: number; x: number; y: number; vx: number; vy: number; t: number; dmg: number }
export interface Drone { id: number; x: number; y: number; carry: number; target: number; stun: number }
export interface Rift { x: number; y: number; r: number; hp: number; max: number; spawn: number; corrupt: number; core: boolean }
export interface Meteor { id: number; x: number; y: number; vx: number; vy: number }

function random(seed: number) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export class AnominersRun extends ArcadeRun {
  ast!: Asteroid; w = 0; h = 0; grid = new Uint8Array(0); hp = new Float32Array(0);
  /** Cells changed since the view last looked (it redraws only those). */
  dirty: number[] = []; broken: { x: number; y: number; kind: number }[] = [];
  x = 0; y = 0; vx = 0; vy = 0; angle = 0; hull = 100; cargo = 0; bank = 0; techFound = 0; techTotal = 0;
  baseX = 0; baseY = 0; docked = false; warp = 0; ready = false;
  beam: { x: number; y: number } | null = null; fireCool = 0; invuln = 0; hurt = 0;
  chunks: Chunk[] = []; glitches: Glitch[] = []; bolts: Bolt[] = []; drones: Drone[] = []; meteors: Meteor[] = [];
  rift: Rift | null = null; anomalyClock = 0; coreDown = false; contained = false; strike: { x: number; y: number; t: number } | null = null;
  /** Where a held finger or mouse wants the ship to fly (cells), or null. */
  steerTo: { x: number; y: number } | null = null;
  display = { text: '', timer: 0 }; briefing = 0; windAngle = 0;
  private nextId = 1; private rnd = random(1); private meteorClock = 0; private stormClock = 0;
  constructor(checkpoint?: unknown) { super('anominers', anominersCatalog.defaults, anominersCatalog.schema, checkpoint); this.notice = 'Mine the asteroid. Bank your minerals. Beware the anomaly.'; this.setup(); this.briefing = 0; }

  get levelName() { return asteroidName(this.level); }
  get sector() { return SECTORS[this.config.worldTheme ?? 'classic'] ?? SECTORS.classic; }
  get weather() { return WEATHER[this.config.weather ?? 'clear'] ?? WEATHER.clear; }
  get mood() { return MOODS[this.config.difficulty ?? 'normal'] ?? MOODS.normal; }
  get hold() { return this.config.ammo ?? 30; }
  get threat() { return this.rift ? this.ast.threat : 0; }
  get goalsMet() { return this.bank >= this.ast.quota && this.techFound >= this.techTotal && (!this.ast.core || this.coreDown); }
  at(x: number, y: number) { x = Math.floor(x); y = Math.floor(y); return x < 0 || y < 0 || x >= this.w || y >= this.h ? EMPTY : this.grid[y * this.w + x]; }
  solid(x: number, y: number) { return this.at(x, y) !== EMPTY; }

  // ---------------------------------------------------------------- the asteroid
  protected setup(): void {
    const a = this.ast = asteroidOf(this.level), rnd = this.rnd = random(a.seed * 977 + 3);
    const W = this.w = a.size[0] + MARGIN * 2, H = this.h = a.size[1] + MARGIN; const grid = this.grid = new Uint8Array(W * H);
    const cx = MARGIN + a.size[0] / 2, cy = H / 2, rx = a.size[0] * .46, ry = a.size[1] * .44, p = [rnd() * 6, rnd() * 6, rnd() * 6];
    const depth = (x: number, y: number) => Math.hypot((x - cx) / rx, (y - cy) / ry);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ang = Math.atan2(y - cy, x - cx), edge = 1 + .1 * Math.sin(3 * ang + p[0]) + .07 * Math.sin(5 * ang + p[1]) + .05 * Math.sin(11 * ang + p[2]);
      if (depth(x, y) < edge) grid[y * W + x] = rnd() < a.caves ? EMPTY : ROCK;
    }
    // Caves: a few rounds of cellular automata inside the asteroid's outline.
    for (let k = 0; k < 4; k++) {
      const next = grid.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const ang = Math.atan2(y - cy, x - cx), edge = 1 + .1 * Math.sin(3 * ang + p[0]) + .07 * Math.sin(5 * ang + p[1]) + .05 * Math.sin(11 * ang + p[2]);
        if (depth(x, y) >= edge) continue; let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && grid[(y + dy) * W + x + dx]) n++;
        next[y * W + x] = n >= 5 ? ROCK : n <= 3 ? EMPTY : grid[y * W + x];
      }
      grid.set(next);
    }
    // Hard rock in the heart, mineral veins (richer deeper in), magma pockets and lost technology.
    for (let i = 0; i < W * H; i++) if (grid[i] && depth(i % W, Math.floor(i / W)) < .32 && rnd() < .55) grid[i] = HARD;
    const total = a.ores.copper + a.ores.crystal + a.ores.gold + a.ores.ice, veins = Math.round(a.size[0] * a.size[1] / 55);
    for (let v = 0; v < veins; v++) {
      let r = rnd() * total; const kind = (r -= a.ores.copper) < 0 ? COPPER : (r -= a.ores.crystal) < 0 ? CRYSTAL : (r -= a.ores.gold) < 0 ? GOLD : ICE;
      let x = Math.floor(cx + (rnd() - .5) * rx * 2), y = Math.floor(cy + (rnd() - .5) * ry * 2);
      const d = depth(x, y); if (kind === GOLD && d > .6 || kind === CRYSTAL && d > .85) { v--; if (rnd() < .02) v++; continue; }
      for (let s = 0; s < 3 + rnd() * 6; s++) { const i = y * W + x; if (grid[i] === ROCK || grid[i] === HARD) grid[i] = kind; x = clamp(x + Math.round(rnd() * 2 - 1), 1, W - 2); y = clamp(y + Math.round(rnd() * 2 - 1), 1, H - 2); }
    }
    if (a.magma) for (let k = 0; k < Math.round(6 * a.magma); k++) { let x = Math.floor(cx + (rnd() - .5) * rx), y = Math.floor(cy + (rnd() - .5) * ry); for (let s = 0; s < 6; s++) { const i = y * W + x; if (grid[i] === ROCK || grid[i] === HARD) grid[i] = MAGMA; x += Math.round(rnd() * 2 - 1); y += Math.round(rnd() * 2 - 1); } }
    this.techTotal = a.tech ?? 0;
    for (let k = 0; k < this.techTotal; k++) for (let tries = 0; tries < 200; tries++) {
      const x = Math.floor(cx + (rnd() - .5) * rx * 1.1), y = Math.floor(cy + (rnd() - .5) * ry * 1.1), i = y * W + x;
      if (!grid[i] || grid[i] === TECH || Math.abs(x - cx) < 4 && a.core) continue;
      grid[i] = TECH; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && grid[(y + dy) * W + x + dx] !== TECH) grid[(y + dy) * W + x + dx] = HARD; break;
    }
    // The final asteroid opens around the anomaly core.
    if (a.core) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - cx, y - cy) < 7) grid[y * W + x] = EMPTY;
    this.hp = new Float32Array(W * H); for (let i = 0; i < W * H; i++) this.hp[i] = HARDNESS[grid[i]];
    // Base: parked just off the asteroid's left edge, with clear space around it.
    this.baseX = 5; this.baseY = cy; for (let y = 0; y < H; y++) for (let x = 0; x < 11; x++) if (Math.hypot(x - this.baseX, y - this.baseY) < 5) grid[y * W + x] = EMPTY;
    this.dirty = []; this.broken = []; this.chunks = []; this.glitches = []; this.bolts = []; this.meteors = []; this.drones = [];
    this.rift = null; this.coreDown = false; this.contained = false; this.strike = null; this.techFound = 0; this.bank = 0; this.cargo = 0; this.ready = false; this.warp = 0;
    this.anomalyClock = a.timer ? a.timer * this.mood.timer * (this.weather.sight ? 1.3 : 1) : 0;
    if (a.core) this.openRift(cx, cy, true);
    for (let i = 0; i < (this.config.teammates ?? 0); i++) this.drones.push({ id: this.nextId++, x: this.baseX + 1, y: this.baseY + i, carry: 0, target: -1, stun: 0 });
    this.respawn(); this.hull = 100; this.display = { text: '', timer: 0 }; this.briefing = 4.5; this.meteorClock = 2; this.stormClock = 3;
  }
  private respawn() { this.x = this.baseX + 2.5; this.y = this.baseY; this.vx = this.vy = 0; this.angle = 0; this.invuln = 2; this.steerTo = null; }

  protected runtime(): Record<string, number> { return { ore: this.cargo, bank: this.bank, hull: Math.round(this.hull), threat: this.threat, timer: Math.ceil(this.anomalyClock), drones: this.drones.length }; }
  protected stageSummary(): Record<string, number> { return { bank: this.bank, tech: this.techFound, time: Math.round(this.elapsed), contained: this.contained ? 1 : 0 }; }
  protected restoreSummary(s: Readonly<Record<string, number>>): void { this.bank = s.bank ?? 0; this.techFound = s.tech ?? 0; this.elapsed = s.time ?? 0; this.contained = Boolean(s.contained); }
  stats() { return [{ label: 'BANK', value: this.ast?.quota ? `${this.bank}/${this.ast.quota}` : this.bank }, { label: 'CARGO', value: `${this.cargo}/${this.hold}` }, { label: 'HULL', value: Math.round(this.hull) }]; }
  goalProgress(): { kind: 'bank' | 'tech' | 'core'; value: number; count: number }[] {
    const out: { kind: 'bank' | 'tech' | 'core'; value: number; count: number }[] = [];
    if (this.ast.quota) out.push({ kind: 'bank', value: Math.min(this.bank, this.ast.quota), count: this.ast.quota });
    if (this.techTotal) out.push({ kind: 'tech', value: this.techFound, count: this.techTotal });
    if (this.ast.core) out.push({ kind: 'core', value: this.coreDown ? 1 : 0, count: 1 });
    return out;
  }

  // ---------------------------------------------------------------- controls
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary') this.blast();
    else if (action === 'ability') this.buildDrone();
  }
  /** BLAST: shoots at the nearest anomalite (or the rift), otherwise straight ahead. Bolts also chip rock. */
  blast(): boolean {
    if (this.phase !== 'playing' || this.fireCool > 0) return false;
    let target: { x: number; y: number } | null = null, best = 20;
    for (const g of this.glitches) { const d = Math.hypot(g.x - this.x, g.y - this.y); if (d < best) { best = d; target = g; } }
    if (!target && this.rift && Math.hypot(this.rift.x - this.x, this.rift.y - this.y) < 26) target = this.rift;
    const base = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.angle, level = this.config.bounces ?? 1;
    for (const s of level >= 3 ? [-.14, 0, .14] : [0]) { const a = base + s; this.bolts.push({ id: this.nextId++, x: this.x + Math.cos(a), y: this.y + Math.sin(a), vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, t: 0, dmg: level }); }
    if (target) this.angle = base;
    this.fireCool = .28; this.metrics.actions++; this.cue('launch', this.x, this.y); return true;
  }
  buildDrone(): boolean {
    if (!this.config.overdrive || this.phase !== 'playing') return false;
    if (this.drones.length >= 4) { this.say('DRONE BAY FULL', 1); return false; }
    if (this.cargo < 10) { this.say('A DRONE COSTS 10 MINERALS', 1.2); return false; }
    this.cargo -= 10; this.drones.push({ id: this.nextId++, x: this.x, y: this.y, carry: 0, target: -1, stun: 0 }); this.say('DRONE BUILT', 1); this.cue('ability', this.x, this.y); return true;
  }
  say(text: string, time = 1.2) { this.display = { text, timer: time }; }

  // ---------------------------------------------------------------- simulation
  protected tick(dt: number): void {
    this.display.timer = Math.max(0, this.display.timer - dt); this.briefing = Math.max(0, this.briefing - dt); this.fireCool = Math.max(0, this.fireCool - dt);
    this.invuln = Math.max(0, this.invuln - dt); this.hurt = Math.max(0, this.hurt - dt); this.windAngle += dt * .1;
    if (this.strike) { this.strike.t -= dt; if (this.strike.t <= 0) this.strike = null; }
    this.fly(dt); this.drill(dt); this.updateChunks(dt); this.updateDrones(dt); this.updateBolts(dt);
    if (this.briefing <= 0) { this.updateAnomaly(dt); this.updateWeather(dt); }
    this.dock(dt);
  }
  private fly(dt: number) {
    const i = this.input; let ax = (i.right ? 1 : 0) - (i.left ? 1 : 0), ay = (i.down ? 1 : 0) - (i.up ? 1 : 0);
    if (this.steerTo) { const dx = this.steerTo.x - this.x, dy = this.steerTo.y - this.y, d = Math.hypot(dx, dy); if (d > .6) { ax = dx / d; ay = dy / d; } }
    const len = Math.hypot(ax, ay), max = 3 + this.config.speed * 1.4;
    if (len > 0) { ax /= len; ay /= len; const want = Math.atan2(ay, ax), diff = Math.atan2(Math.sin(want - this.angle), Math.cos(want - this.angle)); this.angle += clamp(diff, -9 * dt, 9 * dt); }
    this.vx += ax * max * 5 * dt; this.vy += ay * max * 5 * dt;
    const w = this.weather.wind; if (w) { this.vx += Math.cos(this.windAngle) * w * dt; this.vy += Math.sin(this.windAngle) * w * dt; }
    const drag = Math.exp(-this.sector.drag * dt); this.vx *= drag; this.vy *= drag;
    const sp = Math.hypot(this.vx, this.vy); if (sp > max) { this.vx *= max / sp; this.vy *= max / sp; }
    this.move(this.vx * dt, 0); this.move(0, this.vy * dt);
    this.x = clamp(this.x, 1, this.w - 1); this.y = clamp(this.y, 1, this.h - 1);
    // Touching magma burns.
    if (this.invuln <= 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.at(this.x + dx * (SHIP_R + .3), this.y + dy * (SHIP_R + .3)) === MAGMA) { this.damage(7, 'MAGMA BURNS!'); return; }
  }
  private move(dx: number, dy: number) {
    const nx = this.x + dx, ny = this.y + dy;
    for (let cy = Math.floor(ny - SHIP_R); cy <= Math.floor(ny + SHIP_R); cy++) for (let cx = Math.floor(nx - SHIP_R); cx <= Math.floor(nx + SHIP_R); cx++) {
      if (!this.solid(cx, cy)) continue; const px = clamp(nx, cx, cx + 1), py = clamp(ny, cy, cy + 1);
      if (Math.hypot(nx - px, ny - py) < SHIP_R) { if (dx) this.vx *= -.15; if (dy) this.vy *= -.15; return; }
    }
    this.x = nx; this.y = ny;
  }
  /** The drill beam bites the nearest rock in front of the ship. */
  private drill(dt: number) {
    const range = this.config.splash ?? 6; let best: { x: number; y: number } | null = null, bestD = range;
    for (const off of [0, -.22, .22, -.45, .45]) {
      const a = this.angle + off, cx = Math.cos(a), cy = Math.sin(a);
      for (let d = .5; d < bestD; d += .35) { const x = this.x + cx * d, y = this.y + cy * d; if (this.solid(x, y)) { best = { x: Math.floor(x), y: Math.floor(y) }; bestD = d; break; } }
    }
    this.beam = best;
    if (!best) return;
    const rate = (.8 + this.config.power * .45) * (this.weather.lightning ? .85 : 1);
    this.chip(best.x, best.y, rate * dt);
  }
  /** Damages a cell; breaking it releases its mineral as a floating chunk. */
  chip(x: number, y: number, amount: number) {
    const i = y * this.w + x, kind = this.grid[i]; if (!kind) return;
    if (this.dirty.length > 6000) this.dirty.splice(0, 3000);
    const before = this.hp[i]; this.hp[i] -= amount;
    if (this.hp[i] > 0) { if (Math.ceil(before / HARDNESS[kind] * 3) !== Math.ceil(this.hp[i] / HARDNESS[kind] * 3)) this.dirty.push(i); return; }
    this.grid[i] = EMPTY; this.hp[i] = 0; this.dirty.push(i, i - 1, i + 1, i - this.w, i + this.w); this.broken.push({ x: x + .5, y: y + .5, kind });
    if (this.broken.length > 60) this.broken.shift();
    const chunk = KIND_OF[kind];
    if (chunk) this.chunks.push({ id: this.nextId++, x: x + .5, y: y + .5, vx: (this.rnd() - .5) * 2, vy: (this.rnd() - .5) * 2, kind: chunk, value: ORE_VALUE[kind] ?? 0, age: 0, from: Math.hypot(x + .5 - this.x, y + .5 - this.y) });
    if (kind === COPPER || kind === CRYSTAL || kind === GOLD) this.cue('hit', x, y);
  }
  private updateChunks(dt: number) {
    const reach = this.config.assist ? 10 : 2.4, keep: Chunk[] = [];
    for (const c of this.chunks) {
      c.age += dt; const dx = this.x - c.x, dy = this.y - c.y, d = Math.hypot(dx, dy), room = c.kind === 'tech' || c.kind === 'shard' || this.cargo < this.hold;
      if (d < reach && room) { c.vx += dx / d * 30 * dt; c.vy += dy / d * 30 * dt; }
      const w = this.weather.wind; if (w) { c.vx += Math.cos(this.windAngle) * w * .5 * dt; c.vy += Math.sin(this.windAngle) * w * .5 * dt; }
      c.vx *= Math.exp(-2 * dt); c.vy *= Math.exp(-2 * dt);
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt; if (!this.solid(nx, ny)) { c.x = nx; c.y = ny; } else { c.vx *= -.4; c.vy *= -.4; }
      if (d < 1 && room) { this.collect(c); continue; }
      keep.push(c);
    }
    this.chunks = keep.slice(-300);
  }
  private collect(c: Chunk) {
    if (this.config.assist && c.from > 3.5 && c.kind !== 'shard') this.metrics.assisted++;
    if (c.kind === 'tech') { this.techFound++; this.addScore(500, c.x, c.y, 'LOST TECH RECOVERED'); this.say(`LOST TECHNOLOGY ${this.techFound}/${this.techTotal}`, 1.6); this.cue('perfect', c.x, c.y); return; }
    if (c.kind === 'shard') { this.score += 20; this.cue('score', c.x, c.y); return; }
    this.cargo = Math.min(this.hold, this.cargo + c.value); this.cue('score', c.x, c.y);
    if (this.cargo >= this.hold) this.say('CARGO FULL · FLY HOME TO BANK IT', 1.6);
  }
  private updateDrones(dt: number) {
    const ores: number[] = [];
    if (this.drones.some(d => d.target < 0 || this.grid[d.target] === EMPTY)) for (let i = 0; i < this.grid.length; i++) { const k = this.grid[i]; if (k === COPPER || k === CRYSTAL || k === GOLD || k === ICE) ores.push(i); }
    for (const d of this.drones) {
      d.stun = Math.max(0, d.stun - dt); if (d.stun > 0) continue;
      const go = (tx: number, ty: number, speed: number) => { const dx = tx - d.x, dy = ty - d.y, l = Math.hypot(dx, dy); if (l > .05) { const s = Math.min(l, speed * dt); d.x += dx / l * s; d.y += dy / l * s; } return l; };
      if (d.carry >= 4 || d.carry > 0 && d.target < 0) { if (go(this.x, this.y, 9) < 1.4 && this.cargo < this.hold) { const n = Math.min(d.carry, this.hold - this.cargo); this.cargo += n; d.carry -= n; this.cue('score', this.x, this.y); } continue; }
      if (d.target < 0 || this.grid[d.target] === EMPTY) {
        let best = -1, bd = 26; for (const i of ores) { const x = i % this.w + .5, y = Math.floor(i / this.w) + .5, dist = Math.hypot(x - this.x, y - this.y); if (dist < bd && !this.drones.some(o => o !== d && o.target === i)) { bd = dist; best = i; } }
        d.target = best; if (best < 0) { go(this.x + Math.cos(d.id) * 2, this.y + Math.sin(d.id) * 2, 8); continue; }
      }
      const tx = d.target % this.w + .5, ty = Math.floor(d.target / this.w) + .5;
      if (go(tx, ty, 7) < 1) { const kind = this.grid[d.target]; this.hp[d.target] -= 1.2 * dt; if (this.hp[d.target] <= 0) { this.grid[d.target] = EMPTY; this.dirty.push(d.target, d.target - 1, d.target + 1, d.target - this.w, d.target + this.w); this.broken.push({ x: tx, y: ty, kind }); d.carry += ORE_VALUE[kind] ?? 1; d.target = -1; } }
    }
  }
  private updateBolts(dt: number) {
    const keep: Bolt[] = [];
    for (const b of this.bolts) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; let gone = b.t > 1.2;
      for (const g of this.glitches) if (!gone && Math.hypot(g.x - b.x, g.y - b.y) < 1.1) { g.hp -= b.dmg; gone = true; if (g.hp <= 0) this.killGlitch(g); }
      if (!gone && this.rift && Math.hypot(this.rift.x - b.x, this.rift.y - b.y) < Math.max(1.5, this.rift.r * .6)) { this.hitRift(b.dmg); gone = true; }
      if (!gone && this.solid(b.x, b.y)) { this.chip(Math.floor(b.x), Math.floor(b.y), b.dmg * .6); gone = true; }
      if (!gone) keep.push(b);
    }
    this.bolts = keep; this.glitches = this.glitches.filter(g => g.hp > 0);
  }
  private killGlitch(g: Glitch) { g.hp = 0; this.addScore(25, g.x, g.y, '+25'); this.chunks.push({ id: this.nextId++, x: g.x, y: g.y, vx: 0, vy: 0, kind: 'shard', value: 0, age: 0, from: 0 }); this.cue('hit', g.x, g.y); }
  private openRift(x: number, y: number, core: boolean) {
    const t = this.ast.threat, max = core ? 36 : 10 + t * 6;
    this.rift = { x, y, r: core ? 4 : 1, hp: max, max, spawn: 2, corrupt: 1, core }; this.say(core ? 'THE ANOMALY CORE' : 'THE ANOMALY HAS WOKEN', 2); this.cue('lose', x, y);
  }
  private hitRift(dmg: number) {
    const r = this.rift!; r.hp -= dmg; this.cue('hit', r.x, r.y);
    if (r.hp > 0) return;
    this.addScore(300 * Math.max(1, this.ast.threat), r.x, r.y, r.core ? 'CORE DESTROYED' : 'ANOMALY CONTAINED'); this.cue('perfect', r.x, r.y); this.metrics.perfects++;
    for (const g of this.glitches) this.killGlitch(g); this.glitches = [];
    if (r.core) this.coreDown = true; this.contained = true; this.rift = null; this.anomalyClock = 0;
    this.say(r.core ? 'THE ANOMALY IS GONE · WARP HOME' : 'ANOMALY CONTAINED', 2.2);
  }
  private updateAnomaly(dt: number) {
    if (!this.rift && this.anomalyClock > 0 && !this.contained) {
      this.anomalyClock -= dt;
      if (this.anomalyClock <= 15 && this.anomalyClock + dt > 15) this.say('THE ANOMALY STIRS · 15 SECONDS', 1.6);
      if (this.anomalyClock <= 0) {
        // It opens in an empty pocket of the asteroid, away from you and your base.
        const cx = MARGIN + this.ast.size[0] / 2, cy = this.h / 2; let spot = { x: cx, y: cy };
        for (let k = 0; k < 400; k++) { const x = MARGIN + 4 + this.rnd() * (this.ast.size[0] - 8), y = 4 + this.rnd() * (this.h - 8); if (!this.solid(x, y) && Math.hypot(x - this.x, y - this.y) > 16 && x > this.baseX + 14) { spot = { x, y }; break; } }
        this.openRift(spot.x, spot.y, false);
      }
      return;
    }
    const r = this.rift; if (!r) return;
    const t = Math.max(1, this.ast.threat); r.r = Math.min(r.core ? 5 : 2.5 + t * .5, r.r + dt * .8);
    r.spawn -= dt;
    const cap = (r.core ? 6 : 3 + t * 2) + (this.config.rivals ?? 0);
    if (r.spawn <= 0) {
      r.spawn = 7 / (1 + t * .3) * this.mood.spawn;
      for (let k = 0; k < (r.core ? 2 : 1 + Math.floor(t / 2)) + Math.ceil((this.config.rivals ?? 0) / 2) && this.glitches.length < cap; k++) { const a = this.rnd() * Math.PI * 2; this.glitches.push({ id: this.nextId++, x: r.x + Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r, vx: 0, vy: 0, hp: 1 + Math.floor(t / 3), cool: 0, seed: this.rnd() }); }
    }
    r.corrupt -= dt;
    if (r.corrupt <= 0) { r.corrupt = 1.4; for (let k = 0; k < 6; k++) { const a = this.rnd() * Math.PI * 2, d = r.r + this.rnd() * 5, x = Math.floor(r.x + Math.cos(a) * d), y = Math.floor(r.y + Math.sin(a) * d), i = y * this.w + x; if (x > 0 && y > 0 && x < this.w && y < this.h && (this.grid[i] === ROCK || this.grid[i] === HARD)) { this.grid[i] = VOID; this.hp[i] = HARDNESS[VOID]; this.dirty.push(i); break; } } }
    // Anomalites drift through rock toward you (or your drones), and hurt on contact.
    const speed = (3.2 + Math.min(t, 4) * .3) * this.mood.speed, sight = this.weather.sight ? 10 : 40;
    for (const g of this.glitches) {
      g.cool = Math.max(0, g.cool - dt); let tx = this.x, ty = this.y;
      const drone = this.drones.find(d => Math.hypot(d.x - g.x, d.y - g.y) < 6); if (drone) { tx = drone.x; ty = drone.y; }
      const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy) || 1, wander = d > sight;
      const ax = wander ? Math.cos(this.elapsed + g.seed * 9) : dx / d, ay = wander ? Math.sin(this.elapsed * 1.3 + g.seed * 7) : dy / d;
      g.vx += ax * speed * 3 * dt; g.vy += ay * speed * 3 * dt; const s = Math.hypot(g.vx, g.vy); if (s > speed) { g.vx *= speed / s; g.vy *= speed / s; }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (drone && Math.hypot(drone.x - g.x, drone.y - g.y) < 1) { this.drones = this.drones.filter(o => o !== drone); this.say('A DRONE WAS LOST', 1.2); this.cue('lose', drone.x, drone.y); }
      if (Math.hypot(this.x - g.x, this.y - g.y) < 1.3 && g.cool <= 0) { g.cool = 1; g.vx = -g.vx; g.vy = -g.vy; this.damage(12, 'HIT BY THE ANOMALY'); }
    }
  }
  private updateWeather(dt: number) {
    const w = this.weather;
    if (w.meteors) {
      this.meteorClock -= dt; if (this.meteorClock <= 0) { this.meteorClock = 3.5 + this.rnd() * 2; const x = this.x + (this.rnd() - .5) * 30; this.meteors.push({ id: this.nextId++, x: x - 14, y: this.y - 18, vx: 9, vy: 12 }); }
      const keep: Meteor[] = [];
      for (const m of this.meteors) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (Math.hypot(m.x - this.x, m.y - this.y) < 1.3 && this.invuln <= 0) { this.damage(10, 'METEOR STRIKE'); continue; }
        if (this.solid(m.x, m.y)) { this.crater(m.x, m.y, 1.8); continue; }
        if (m.y < this.h + 5) keep.push(m);
      }
      this.meteors = keep;
    } else this.meteors = [];
    if (w.lightning) {
      this.stormClock -= dt;
      if (this.stormClock <= 0) {
        this.stormClock = 3 + this.rnd() * 3; const a = this.rnd() * Math.PI * 2, d = 2 + this.rnd() * 12, x = this.x + Math.cos(a) * d, y = this.y + Math.sin(a) * d; this.strike = { x, y, t: .35 };
        if (Math.hypot(x - this.x, y - this.y) < 3) this.damage(8, 'LIGHTNING!'); for (const dr of this.drones) if (Math.hypot(dr.x - x, dr.y - y) < 4) dr.stun = 3; this.crater(x, y, 1); this.cue('ability', x, y);
      }
    }
  }
  /** Knocks a hole in the rock (meteors, lightning); minerals inside break loose. */
  crater(x: number, y: number, r: number) {
    for (let cy = Math.floor(y - r); cy <= Math.ceil(y + r); cy++) for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++) if (Math.hypot(cx + .5 - x, cy + .5 - y) <= r && cx > 0 && cy > 0 && cx < this.w - 1 && cy < this.h - 1) { const k = this.grid[cy * this.w + cx]; if (k && k !== TECH) this.chip(cx, cy, 99); }
  }
  damage(amount: number, message: string) {
    if (this.invuln > 0 || this.phase !== 'playing') return;
    this.hull = Math.max(0, this.hull - amount); this.hurt = .5; this.invuln = .6; this.say(message, 1); this.cue('hit', this.x, this.y);
    if (this.hull > 0) return;
    // Wrecked: half the cargo spills where you were, and a spare hull launches from the base.
    const spill = Math.floor(this.cargo / 2); for (let k = 0; k < spill; k++) this.chunks.push({ id: this.nextId++, x: this.x + (this.rnd() - .5) * 2, y: this.y + (this.rnd() - .5) * 2, vx: (this.rnd() - .5) * 4, vy: (this.rnd() - .5) * 4, kind: 'copper', value: 1, age: 0, from: 0 });
    this.cargo = 0; this.lose(this.x, this.y, 'SHIP WRECKED');
    if (this.phase === 'playing') { this.respawn(); this.hull = 100; this.say('A SPARE HULL LAUNCHES FROM THE BASE', 1.8); }
  }
  private dock(dt: number) {
    const near = Math.hypot(this.x - this.baseX, this.y - this.baseY) < 4;
    if (near && !this.docked && this.cargo > 0) { const n = this.cargo; this.bank += n; this.cargo = 0; this.addScore(n * this.config.bonus, this.baseX, this.baseY, `BANKED ${n}`); this.say(`BANKED ${n} MINERALS`, 1.2); }
    this.docked = near; if (near) this.hull = Math.min(100, this.hull + 25 * dt);
    if (this.goalsMet && !this.ready) { this.ready = true; this.say('WARP READY · DOCK AT THE BASE', 2); }
    if (this.ready && near) {
      this.warp += dt; if (this.warp >= 2.5) { this.addScore(1000 + Math.max(0, 600 - Math.round(this.elapsed) * 3), this.baseX, this.baseY, 'WARP!'); this.clear(this.baseX, this.baseY); this.say('WARP!', 3); }
    } else this.warp = 0;
  }
}
