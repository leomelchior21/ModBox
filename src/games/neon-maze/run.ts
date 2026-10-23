import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { mazeCatalog } from './catalog';
import { carve, seal, distances, distAt, exits, step, isOpen, DIRS, OPPOSITE, random, key, type Grid, type Tile, type Dir } from './grid';
import { sectorOf, sectorName, type Sector } from './levels';
import { BRAINS, SIGNALS } from './worlds';
export { SECTORS, sectorOf, sectorName } from './levels';

/**
 * NEON MAZE: roll a light orb through neon labyrinths. Dots build your FLOW multiplier, amber gems freeze the
 * sentinels so you can catch them, sleeping drones wake and follow you in a ghost train you can devour, and three
 * gems open the exit. Movement is tile to tile with buffered turns; the base class runs it in 1/120 s slices.
 */
export type SentinelKind = 'hunter' | 'drone' | 'warden';
export type SentinelState = 'asleep' | 'active' | 'eyes' | 'gone';
export interface Mover { from: Tile; at: Tile; t: number; dir: Dir }
export interface Sentinel extends Mover { id: number; kind: SentinelKind; role: number; state: SentinelState; scared: boolean; home: Tile; wait: number; car: number; hits: number }
export interface Prism { tile: Tile; time: number }
const ROLES = 4, MAX_FLOW = 8;
const lerp = (m: Mover) => { const dx = m.at.x - m.from.x, dy = m.at.y - m.from.y; if (Math.abs(dx) + Math.abs(dy) > 1) return { x: m.at.x, y: m.at.y }; return { x: m.from.x + dx * m.t, y: m.from.y + dy * m.t }; };
const same = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;

export class NeonMazeRun extends ArcadeRun {
  grid!: Grid; sector!: Sector; dots = new Uint8Array(0); dotsLeft = 0; dotsTotal = 0; dotsEaten = 0;
  runner: Mover & { moving: boolean } = { from: { x: 1, y: 1 }, at: { x: 1, y: 1 }, t: 1, dir: 'up', moving: false };
  /** The runner waits at the start until your first input. */
  parked = true;
  want: Dir | null = null; sentinels: Sentinel[] = []; gemsTaken: boolean[] = []; cores = 0; exitOpen = false;
  stun = 0; chain = 0; flow = 1; lastDot = -9; warp = 0; warpCool = 0; dashCool = 0; dash: { from: Tile; to: Tile; t: number } | null = null;
  /** On the Warden's sector gems come back after a while, so there is always a way to freeze it again. */
  gemBack: number[] = [];
  shieldCool = 0; invuln = 0; steps = 0; wardenCaught = 0; prism: Prism | null = null; prismSpawned = false;
  /** Tiles the runner arrived on, newest first: the ghost train follows this path. */
  history: Tile[] = []; display = { text: '', timer: 0 }; briefing = 0; flash = 0; caughtAt = -9; best = 0; hitAt = -9;
  private nextId = 1; private rnd = random(1); private homeDist = new Map<number, Int16Array>();
  constructor(checkpoint?: unknown) { super('maze', mazeCatalog.defaults, mazeCatalog.schema, checkpoint); this.notice = 'Roll through the neon. Three gems open the exit.'; this.setup(); this.briefing = 0; }

  get levelName() { return sectorName(this.level); }
  get signal() { return SIGNALS[this.config.weather ?? 'clear'] ?? SIGNALS.clear; }
  get brain() { return BRAINS[this.config.difficulty ?? 'normal'] ?? BRAINS.normal; }
  get train() { return this.sentinels.filter(s => s.kind === 'drone' && s.state === 'active').length; }
  get position() { return this.dash ? { x: this.dash.from.x + (this.dash.to.x - this.dash.from.x) * this.dash.t, y: this.dash.from.y + (this.dash.to.y - this.dash.from.y) * this.dash.t } : lerp(this.runner); }
  /** The tile the runner is on (or nearest to). */
  get tile(): Tile { const r = this.runner; return r.t >= .5 ? r.at : r.from; }
  get runnerSpeed() { return (3 + this.config.power * .55) * this.signal.speed; }
  get dark() { return !this.config.revealMap && Boolean(this.sector.dark || this.signal.sight); }

  protected setup(): void {
    const s = this.sector = sectorOf(this.level), size = clamp((this.config.mazeSize ?? 7) + s.grow, 4, 11);
    this.rnd = random(s.seed * 31 + 7);
    let g = carve(size, size + 2, s.seed, s.loops ?? .22, s.portals);
    // Wall in some gems (only a phase dash gets in), keeping the rest of the maze connected.
    for (let k = 0; k < (s.sealed ?? 0); k++) {
      for (let tries = 0; tries < 8; tries++) {
        const copy: Grid = { ...g, open: g.open.map(r => [...r]) }, gem = copy.gems[(k + tries) % copy.gems.length]; seal(copy, gem);
        const dist = distances(copy, copy.start); let ok = distAt(copy, dist, copy.exit) >= 0;
        for (let y = 0; y < copy.h && ok; y++) for (let x = 0; x < copy.w; x++) if (copy.open[y][x] && !same({ x, y }, gem) && dist[y * copy.w + x] < 0) { ok = false; break; }
        if (ok) { g = copy; break; }
      }
    }
    this.grid = g; this.homeDist.clear();
    this.dots = new Uint8Array(g.w * g.h); this.dotsLeft = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.open[y][x] && !same({ x, y }, g.start) && !same({ x, y }, g.exit) && !g.gems.some(t => same(t, { x, y }))) { this.dots[y * g.w + x] = 1; this.dotsLeft++; }
    this.dotsTotal = this.dotsLeft; this.dotsEaten = 0; this.gemsTaken = g.gems.map(() => false); this.gemBack = g.gems.map(() => 0); this.cores = 0; this.exitOpen = false;
    this.stun = this.chain = 0; this.flow = 1; this.lastDot = -9; this.warp = this.warpCool = this.dashCool = 0; this.dash = null; this.shieldCool = 0; this.steps = 0;
    this.wardenCaught = 0; this.prism = null; this.prismSpawned = false; this.best = 0; this.display = { text: '', timer: 0 }; this.briefing = 4.5; this.flash = 0;
    // Sentinels: hunters start in the far rooms, drones sleep along the corridors, the warden guards the exit.
    this.sentinels = []; const dist = distances(g, g.start), rooms: { t: Tile; d: number }[] = [];
    for (let y = 1; y < g.h; y += 2) for (let x = 1; x < g.w; x += 2) if (g.open[y][x]) rooms.push({ t: { x, y }, d: distAt(g, dist, { x, y }) });
    const far = rooms.filter(r => r.d >= 8).sort((a, b) => b.d - a.d), mid = rooms.filter(r => r.d >= 4 && !g.gems.some(t => same(t, r.t)) && !same(r.t, g.exit));
    const hunters = s.hunters + (this.config.rivals ?? 0), sleepers = s.sleepers + (this.config.sleepers ?? 0);
    for (let i = 0; i < hunters; i++) { const r = far[(i * 3 + 1) % Math.max(1, far.length)]?.t ?? g.exit; this.addSentinel('hunter', i % ROLES, r); }
    for (let i = 0; i < sleepers && mid.length; i++) { const r = mid.splice(Math.floor(this.rnd() * mid.length), 1)[0].t; this.addSentinel('drone', 0, r); }
    if (s.warden) this.addSentinel('warden', 0, g.exit);
    this.respawn(); this.history = [];
  }
  private addSentinel(kind: SentinelKind, role: number, t: Tile) {
    this.sentinels.push({ id: this.nextId++, kind, role, state: kind === 'drone' ? 'asleep' : 'active', scared: false, home: { ...t }, from: { ...t }, at: { ...t }, t: 1, dir: 'up', wait: kind === 'drone' ? 0 : 1 + role * 1.2, car: 0, hits: 0 });
  }
  private respawn() {
    const g = this.grid; this.runner = { from: { ...g.start }, at: { ...g.start }, t: 1, dir: 'up', moving: false }; this.want = null; this.parked = true; this.dash = null; this.invuln = 2; this.stun = 0;
    for (const s of this.sentinels) { if (s.state === 'gone') continue; s.from = { ...s.home }; s.at = { ...s.home }; s.t = 1; s.scared = false; s.wait = s.kind === 'drone' ? 0 : 1.5 + s.role; if (s.kind === 'drone') s.state = 'asleep'; else if (s.state === 'eyes') s.state = 'active'; }
  }

  protected runtime(): Record<string, number> { return { dots: this.dotsEaten, cores: this.cores, stun: Math.ceil(this.stun), flow: Math.floor(this.flow), train: this.train, steps: this.steps, energy: Math.round(this.lives / Math.max(1, this.config.lives) * 100) }; }
  protected stageSummary(): Record<string, number> { return { dots: this.dotsEaten, total: this.dotsTotal, best: this.best, time: Math.round(this.elapsed) }; }
  protected restoreSummary(s: Readonly<Record<string, number>>): void { this.dotsEaten = s.dots ?? 0; this.best = s.best ?? 0; this.elapsed = s.time ?? 0; if (s.total) this.dotsTotal = s.total; }
  stats() { return [{ label: 'GEMS', value: this.sector?.warden ? `${this.wardenCaught}/3` : `${this.cores}/${this.gemsTaken.length}` }, { label: 'FLOW', value: `×${Math.floor(this.flow)}` }, { label: 'TRAIN', value: this.train || '—' }]; }
  goalProgress(): { kind: 'gems' | 'warden' | 'exit'; value: number; count: number }[] {
    return [this.sector?.warden ? { kind: 'warden', value: this.wardenCaught, count: 3 } : { kind: 'gems', value: this.cores, count: this.gemsTaken.length }, { kind: 'exit', value: this.phase === 'cleared' ? 1 : 0, count: 1 }];
  }

  // ---------------------------------------------------------------- controls
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') this.steer(action);
    else if (action === 'primary') this.phaseDash();
    else if (action === 'ability') this.timeWarp();
  }
  /** Queue a turn (arrow keys, the pad or a swipe). Reversing happens at once. */
  steer(dir: Dir) {
    if (this.phase !== 'playing') return; this.want = dir; this.parked = false; const r = this.runner;
    if (r.moving && dir === OPPOSITE[r.dir] && !this.dash) { const f = r.from; r.from = r.at; r.at = f; r.t = 1 - r.t; r.dir = dir; this.metrics.actions++; }
    if (!r.moving && r.t >= 1 && isOpen(this.grid, step(this.grid, r.at, dir).x, step(this.grid, r.at, dir).y)) this.metrics.actions++;
  }
  /** PHASE DASH: jump up to phaseLength tiles in the direction you are pressing, straight through walls. */
  phaseDash(): boolean {
    if (this.phase !== 'playing' || this.dashCool > 0 || this.dash) return false;
    const dir = this.want ?? this.runner.dir, base = this.tile, n = this.config.phaseLength ?? 2;
    for (let k = n; k >= 1; k--) {
      const to = { x: base.x + DIRS[dir].x * k, y: base.y + DIRS[dir].y * k };
      if (!isOpen(this.grid, to.x, to.y)) continue;
      this.parked = false; this.dash = { from: { ...this.position }, to, t: 0 }; this.dashCool = 2.4; this.invuln = Math.max(this.invuln, .35); this.runner.dir = dir; this.metrics.actions++;
      this.cue('launch', to.x, to.y); return true;
    }
    this.say('NO ROOM TO PHASE', .7); return false;
  }
  /** TIME WARP: sentinels crawl for four seconds. */
  timeWarp() { if (!this.config.overdrive || this.warpCool > 0 || this.phase !== 'playing') return; this.warp = 4; this.warpCool = 14; this.cue('ability', this.tile.x, this.tile.y, 'TIME WARP'); this.say('TIME WARP', 1.2); }
  say(text: string, time = 1.2) { this.display = { text, timer: time }; }

  // ---------------------------------------------------------------- simulation
  protected tick(dt: number): void {
    this.display.timer = Math.max(0, this.display.timer - dt); this.briefing = Math.max(0, this.briefing - dt); this.flash = Math.max(0, this.flash - dt);
    this.dashCool = Math.max(0, this.dashCool - dt); this.warpCool = Math.max(0, this.warpCool - dt); this.warp = Math.max(0, this.warp - dt);
    this.shieldCool = Math.max(0, this.shieldCool - dt); this.invuln = Math.max(0, this.invuln - dt);
    if (this.stun > 0) { this.stun = Math.max(0, this.stun - dt); if (!this.stun) { for (const s of this.sentinels) s.scared = false; this.invuln = Math.max(this.invuln, .7); } }
    if (this.elapsed - this.lastDot > 1.2) this.flow = Math.max(1, this.flow - dt * 2.5);
    if (this.sector.warden && !this.exitOpen) this.gemBack.forEach((t, i) => { if (this.gemsTaken[i] && t > 0) { this.gemBack[i] = t - dt; if (this.gemBack[i] <= 0) { this.gemsTaken[i] = false; this.say('A GEM IS BACK', 1); } } });
    if (this.prism) { this.prism.time -= dt; if (this.prism.time <= 0) this.prism = null; }
    if (this.signal.storm && this.rnd() < dt * .35) this.flash = .35;
    // Held keys keep steering (the newest press wins until it is released).
    const i = this.input, held = (['up', 'down', 'left', 'right'] as Dir[]).filter(d => i[d]);
    if (held.length && (!this.want || !held.includes(this.want))) this.steer(held[0]);
    this.moveRunner(dt);
    if (this.briefing <= 0) this.moveSentinels(dt);
    this.collide();
  }
  private moveRunner(dt: number) {
    if (this.dash) {
      this.dash.t = Math.min(1, this.dash.t + dt / .22);
      if (this.dash.t >= 1) { const to = this.dash.to; this.dash = null; this.runner = { from: { ...to }, at: { ...to }, t: 1, dir: this.runner.dir, moving: false }; this.arrive(to); }
      return;
    }
    if (this.parked) return;
    const r = this.runner, g = this.grid; let move = this.runnerSpeed * dt;
    while (move > 0) {
      if (r.t >= 1) {
        const choice = this.want && exits(g, r.at).includes(this.want) ? this.want : exits(g, r.at).includes(r.dir) ? r.dir : null;
        if (!choice) { r.moving = false; return; }
        if (choice !== r.dir) this.metrics.actions++;
        const next = step(g, r.at, choice); r.from = r.at; r.at = next; r.dir = choice; r.t = 0; r.moving = true;
      }
      const take = Math.min(move, 1 - r.t); r.t += take; move -= take;
      if (r.t >= 1) this.arrive(r.at);
    }
  }
  /** Arriving on a tile: dots, gems, the prism and the exit. */
  private arrive(t: Tile) {
    const g = this.grid, k = t.y * g.w + t.x; this.steps++; this.history.unshift({ ...t }); if (this.history.length > 80) this.history.pop();
    if (this.dots[k]) {
      this.dots[k] = 0; this.dotsLeft--; this.dotsEaten++; this.lastDot = this.elapsed; this.flow = Math.min(MAX_FLOW, this.flow + .14);
      this.score += Math.round(10 * Math.floor(this.flow));
      if (!this.prismSpawned && this.dotsEaten >= this.dotsTotal / 2) this.spawnPrism();
      if (!this.dotsLeft) { this.addScore(1000, t.x, t.y, 'EVERY DOT! +1000'); this.say('PERFECT · EVERY DOT', 1.6); }
    }
    g.gems.forEach((gem, i) => {
      if (this.gemsTaken[i] || !same(gem, t)) return;
      this.gemsTaken[i] = true; this.gemBack[i] = 12; this.cores++; this.addScore(this.config.bonus, t.x, t.y, `GEM +${this.config.bonus}`);
      this.stun = this.config.gemDuration ?? 6; this.chain = 0; this.cue('perfect', t.x, t.y);
      for (const s of this.sentinels) if (s.state === 'active') { s.scared = true; const f = s.from; s.from = s.at; s.at = f; s.t = 1 - s.t; s.dir = OPPOSITE[s.dir]; }
      if (!this.sector.warden && this.cores >= this.gemsTaken.length) { this.exitOpen = true; this.say('EXIT OPEN · SENTINELS FROZEN', 1.8); } else this.say(this.train >= 3 ? `TURN AROUND · EAT THE TRAIN ×${this.train}` : 'SENTINELS FROZEN · CATCH THEM', 1.6);
    });
    if (this.prism && same(this.prism.tile, t)) { this.addScore(500 * Math.floor(this.flow), t.x, t.y, `PRISM +${500 * Math.floor(this.flow)}`); this.prism = null; this.cue('perfect', t.x, t.y); }
    if (this.exitOpen && same(t, g.exit)) {
      this.addScore(500 + Math.max(0, 900 - Math.round(this.elapsed) * 6), t.x, t.y, 'SECTOR CLEAR'); this.clear(t.x, t.y); this.say('SECTOR CLEAR', 3);
    }
  }
  private spawnPrism() {
    this.prismSpawned = true; const g = this.grid, here = this.tile, options: Tile[] = [];
    for (let y = 1; y < g.h; y += 2) for (let x = 1; x < g.w; x += 2) if (g.open[y][x] && Math.abs(x - here.x) + Math.abs(y - here.y) > 8) options.push({ x, y });
    if (options.length) { this.prism = { tile: options[Math.floor(this.rnd() * options.length)], time: 10 }; this.say('A PRISM APPEARED', 1.4); }
  }

  private sentinelSpeed(s: Sentinel) {
    const base = (2.3 + this.config.speed * .5) * this.sector.pace * this.brain.speed * this.signal.speed;
    const slow = this.warp > 0 ? .35 : 1;
    if (s.state === 'eyes') return 9;
    if (s.kind === 'drone' && s.state === 'active' && !s.scared) return this.runnerSpeed * .93 * slow;
    return base * (s.scared ? .55 : 1) * (s.kind === 'warden' ? .85 : 1) * slow;
  }
  private moveSentinels(dt: number) {
    for (const s of this.sentinels) {
      if (s.state === 'gone') continue;
      if (s.state === 'asleep') { const p = this.position; if (Math.hypot(p.x - s.at.x, p.y - s.at.y) < 1.6 && this.invuln <= 0) { s.state = 'active'; s.car = this.train; this.say(`DRONE AWAKE · TRAIN ×${this.train}`, 1); this.cue('hit', s.at.x, s.at.y); } continue; }
      if (s.wait > 0) { s.wait -= dt; continue; }
      let move = this.sentinelSpeed(s) * dt;
      while (move > 0) {
        if (s.t >= 1) {
          if (s.state === 'eyes' && same(s.at, s.home)) { s.state = 'active'; s.scared = false; s.wait = .8; break; }
          const d = this.choose(s); if (!d) break;
          s.from = s.at; s.at = step(this.grid, s.at, d); s.dir = d; s.t = 0;
        }
        const take = Math.min(move, 1 - s.t); s.t += take; move -= take;
      }
    }
  }
  /** Picks a sentinel's next direction at a junction. */
  private choose(s: Sentinel): Dir | null {
    const g = this.grid, options = exits(g, s.at), forward = options.filter(d => d !== OPPOSITE[s.dir]), list = forward.length ? forward : options;
    if (!list.length) return null;
    if (s.state === 'eyes') return this.best1(list, s.at, this.distTo(s.home));
    const here = this.tile;
    if (s.scared) { // flee: the exit that ends up furthest from you, with a little randomness
      return list.slice().sort((a, b) => { const na = step(g, s.at, a), nb = step(g, s.at, b); return (Math.abs(nb.x - here.x) + Math.abs(nb.y - here.y)) - (Math.abs(na.x - here.x) + Math.abs(na.y - here.y)) + (this.rnd() - .5) * 2; })[0];
    }
    if (this.rnd() < this.brain.wander && s.kind !== 'drone') return list[Math.floor(this.rnd() * list.length)];
    let target: Tile = here;
    if (s.kind === 'drone') target = this.history[Math.min(this.history.length - 1, (s.car + 1) * 3)] ?? here;
    else if (s.kind === 'hunter') {
      const scatter = this.brain.scatter && this.elapsed % 18 > 13, corners = [{ x: g.w - 2, y: 1 }, { x: 1, y: 1 }, { x: g.w - 2, y: g.h - 2 }, { x: 1, y: g.h - 2 }];
      const r = this.runner.dir, ahead = { x: here.x + DIRS[r].x * this.brain.lookAhead, y: here.y + DIRS[r].y * this.brain.lookAhead };
      if (scatter) target = corners[s.role % 4];
      else if (s.role === 1) target = ahead;
      else if (s.role === 2) { const lead = this.sentinels.find(o => o.kind === 'hunter' && o.role === 0) ?? s; target = { x: ahead.x * 2 - lead.at.x, y: ahead.y * 2 - lead.at.y }; }
      else if (s.role === 3) { const gem = g.gems.find((_, i) => !this.gemsTaken[i]); target = gem ?? (Math.abs(s.at.x - here.x) + Math.abs(s.at.y - here.y) < 8 ? here : g.exit); }
      target = this.nearestOpen(target);
    }
    return this.best1(list, s.at, this.distTo(target));
  }
  private best1(list: Dir[], at: Tile, dist: Int16Array): Dir { const g = this.grid; let best = list[0], bd = Infinity; for (const d of list) { const n = step(g, at, d), v = distAt(g, dist, n); const c = v < 0 ? 1e4 : v; if (c < bd) { bd = c; best = d; } } return best; }
  private distTo(t: Tile): Int16Array { const k = key(t); let d = this.homeDist.get(k); if (!d) { d = distances(this.grid, t); if (this.homeDist.size > 64) this.homeDist.clear(); this.homeDist.set(k, d); } return d; }
  private nearestOpen(t: Tile): Tile {
    const g = this.grid, x0 = clamp(Math.round(t.x), 0, g.w - 1), y0 = clamp(Math.round(t.y), 0, g.h - 1);
    for (let r = 0; r < Math.max(g.w, g.h); r++) for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) if (isOpen(g, x, y)) return { x, y };
    return g.start;
  }
  /** Sentinels, gems and you: catching frozen ones, or getting caught. */
  private collide() {
    if (this.dash || this.phase !== 'playing') return;
    const p = this.position;
    for (const s of this.sentinels) {
      if (s.state !== 'active') continue;
      const q = lerp(s); if (Math.hypot(q.x - p.x, q.y - p.y) > .62) continue;
      if (s.scared) { this.catchSentinel(s); continue; }
      if (this.invuln > 0) continue;
      // Bumping into your own ghost train scatters it: the drones doze off where they are and your flow resets.
      if (s.kind === 'drone') { this.scatterTrain(); return; }
      if (this.config.assist && this.shieldCool <= 0) {
        this.shieldCool = 8; this.invuln = 1.2; this.metrics.assisted++; this.say('SHIELD SAVED YOU', 1.2); this.cue('ability', p.x, p.y);
        const f = s.from; s.from = s.at; s.at = f; s.t = 1 - s.t; s.dir = OPPOSITE[s.dir]; s.wait = .6; continue;
      }
      this.hitAt = this.elapsed; this.flow = 1; this.lose(p.x, p.y, 'CAUGHT! The signal resets.');
      if (this.phase === 'playing') { this.respawn(); this.say(`CAUGHT · ${this.lives} ORB${this.lives === 1 ? '' : 'S'} LEFT`, 1.8); }
      return;
    }
  }
  private scatterTrain() {
    const n = this.train; this.flow = 1; this.invuln = .8;
    for (const d of this.sentinels) if (d.kind === 'drone' && d.state === 'active') { d.state = 'asleep'; d.home = { ...(d.t >= .5 ? d.at : d.from) }; d.from = { ...d.home }; d.at = { ...d.home }; d.t = 1; d.wait = 0; }
    this.say(`TRAIN SCATTERED ×${n} · FLOW LOST`, 1.4); this.cue('lose', this.tile.x, this.tile.y);
  }
  private catchSentinel(s: Sentinel) {
    this.chain++; const points = Math.min(6400, this.config.bonus * 2 ** this.chain); this.best = Math.max(this.best, this.chain); this.caughtAt = this.elapsed;
    if (s.kind === 'drone') s.state = 'gone'; else { s.state = 'eyes'; s.scared = false; }
    if (s.kind === 'warden') { this.wardenCaught++; if (this.wardenCaught >= 3) { this.exitOpen = true; this.say('THE WARDEN FALLS · EXIT OPEN', 2); } else this.say(`WARDEN HIT ${this.wardenCaught}/3`, 1.4); }
    else this.say(this.chain >= 3 ? `TRAIN DEVOURED ×${this.chain}` : `CAUGHT ×${this.chain}`, 1);
    if (this.chain >= 3) this.metrics.perfects++;
    this.addScore(points, s.at.x, s.at.y, `+${points}`); this.cue(this.chain >= 3 ? 'perfect' : 'hit', s.at.x, s.at.y);
    // The rest of the train re-forms behind you.
    let car = 0; for (const o of this.sentinels) if (o.kind === 'drone' && o.state === 'active') o.car = car++;
  }
}
