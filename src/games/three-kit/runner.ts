import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { templeCatalog } from '../temple-race/catalog';
import { subwayCatalog } from '../subway-runnerz/catalog';
import { RUNNER_WEATHER, subwayWorld, templeWorld } from './runner-worlds';

export type RunnerTheme = 'temple' | 'subway';
export type ObstacleVariant = 'barrier' | 'cone' | 'bar' | 'sign' | 'root' | 'fire' | 'vine' | 'log' | 'pit' | 'parked' | 'oncoming';
export interface RunnerObstacle { id: number; at: number; lane: number; kind: 'hurdle' | 'arch' | 'gap' | 'train'; variant: ObstacleVariant; length: number; ramp: boolean; moving: boolean; speed: number; passed: boolean; hit: boolean }
export interface RunnerCoin { at: number; lane: number; y: number; taken: boolean }
export interface RunnerTurn { at: number; direction: -1 | 1; queued: boolean; passed: boolean }
export type PickupKind = 'magnet' | 'double' | 'jetpack' | 'sprint';
export interface RunnerPickup { at: number; lane: number; kind: PickupKind; taken: boolean }
export const LANE = 2.15, TURN_SPACING = 72, JET_HEIGHT = 6;
export const runnerGoal = (level: number) => Math.min(950, 300 + (level - 1) * 45);
export const SUBWAY_STAGES = ['Downtown', 'Rail Yard', 'Harbor Line', 'Market Street', 'Night Express', 'Uptown Loop', 'Bridge Run', 'Old Station', 'Rush Hour', 'Skyline Line', 'Neon District', 'Final Stop'];
export const TEMPLE_STAGES = ['Jungle Steps', 'Mossy Causeway', 'Serpent Bridge', 'Sun Gate', 'Root Maze', 'Fire Temple', 'Misty Falls', 'Golden Stairs', 'Monkey Ridge', 'Shadow Ruins', 'Sky Temple', 'Heart of Gold'];
export const runnerStageName = (theme: RunnerTheme, level: number) => { const list = theme === 'temple' ? TEMPLE_STAGES : SUBWAY_STAGES; return list[(Math.max(1, level) - 1) % list.length] + (level > list.length ? ` ${Math.ceil(level / list.length)}` : ''); };
/** Time of day for a stage: some stages run at dusk or at night. */
export const runnerMood = (theme: RunnerTheme, level: number): 'day' | 'dusk' | 'night' => { const i = (Math.max(1, level) - 1) % 12; return theme === 'subway' ? (i === 4 || i === 10 ? 'night' : i === 8 ? 'dusk' : 'day') : (i === 9 ? 'night' : i === 5 || i === 11 ? 'dusk' : 'day'); };
/** Temple corners alternate so the causeway zigzags without crossing itself; odd stages open with a right turn. */
export const turnDirection = (i: number, level: number): -1 | 1 => (i + level + 1) % 2 ? -1 : 1;

function random(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

/** Deterministic course: obstacle rows from a pattern deck, coin lines and arcs, roof trails and power-ups. Every row leaves a way through. */
export function runnerCourse(theme: RunnerTheme, level: number) {
  const goal = runnerGoal(level), rnd = random(level * 7919 + (theme === 'temple' ? 101 : 202)), tier = Math.min(4, Math.floor((level - 1) / 2));
  const obstacles: RunnerObstacle[] = [], coins: RunnerCoin[] = [], turns: RunnerTurn[] = [], pickups: RunnerPickup[] = [];
  if (theme === 'temple') for (let at = TURN_SPACING, i = 0; at < goal - 25; at += TURN_SPACING, i++) turns.push({ at, direction: turnDirection(i, level), queued: false, passed: false });
  const nearTurn = (at: number, span = 0) => turns.some(t => t.at > at - 14 && t.at < at + span + 14);
  const lanes = [-1, 0, 1], pick = <T,>(list: readonly T[]) => list[Math.floor(rnd() * list.length)], others = (lane: number) => lanes.filter(l => l !== lane);
  let id = 0;
  const add = (at: number, lane: number, kind: RunnerObstacle['kind'], variant: ObstacleVariant, extra: Partial<RunnerObstacle> = {}) => obstacles.push({ id: id++, at, lane, kind, variant, length: kind === 'gap' ? 3.2 : 1, ramp: false, moving: false, speed: 0, passed: false, hit: false, ...extra });
  const line = (at: number, lane: number, y = .9, count = 5) => { for (let j = 0; j < count; j++) coins.push({ at: at - 3 - (count - 1 - j) * 2.2, lane, y, taken: false }); };
  const arc = (at: number, lane: number) => { for (let j = 0; j < 5; j++) coins.push({ at: at - 4.4 + j * 2.2, lane, y: .9 + 1.6 * Math.sin(Math.PI * (j + .5) / 5), taken: false }); };
  const subway = ['hurdle', 'hurdles', 'bar', 'trains', 'mixed', ...(tier >= 1 ? ['ramp', 'trains', 'hurdleWall'] : []), ...(tier >= 2 ? ['oncoming', 'barWall', 'ramp'] : []), ...(tier >= 3 ? ['oncoming', 'mixed'] : [])];
  const temple = ['root', 'fire', 'vine', 'gap', 'root', ...(tier >= 1 ? ['rootWall', 'gaps', 'log'] : []), ...(tier >= 2 ? ['vineWall', 'fires', 'mixed'] : []), ...(tier >= 3 ? ['gapWall', 'mixed'] : [])];
  const spacing = Math.max(11, 17 - level * .45) + (theme === 'temple' ? 1 : 0);
  let lastPickup = 40;
  for (let at = 28; at < goal - 22;) {
    const pattern = pick(theme === 'subway' ? subway : temple), lane = pick(lanes), free = pick(others(lane));
    let span = 1;
    // Train rows leave room to drop off a roof and pick a new track before the next row.
    if (pattern === 'trains' || pattern === 'ramp' || pattern === 'oncoming') span = 26;
    if (theme === 'temple' && nearTurn(at, span)) { at += 6; continue; }
    switch (pattern) {
      case 'hurdle': add(at, lane, 'hurdle', 'barrier'); arc(at, lane); line(at, free); break;
      case 'hurdles': for (const l of others(free)) add(at, l, 'hurdle', rnd() < .5 ? 'barrier' : 'cone'); line(at, free); break;
      case 'hurdleWall': for (const l of lanes) add(at, l, 'hurdle', 'barrier'); arc(at, lane); break;
      case 'bar': add(at, lane, 'arch', rnd() < .5 ? 'bar' : 'sign'); line(at, lane, .5, 4); line(at, free); break;
      case 'barWall': for (const l of lanes) add(at, l, 'arch', 'bar'); line(at, lane, .5, 5); break;
      case 'mixed': if (theme === 'subway') { add(at, lane, 'hurdle', 'barrier'); add(at, free, 'arch', 'bar'); line(at, others(lane).find(l => l !== free)!); }
        else { add(at, lane, 'gap', 'pit'); add(at, free, 'arch', 'vine'); arc(at, lane); } break;
      case 'trains': {
        const length = 12 + Math.floor(rnd() * 3) * 2;
        for (const l of others(free)) add(at, l, 'train', 'parked', { length });
        line(at + 6, free, .9, 7); break;
      }
      case 'ramp': {
        const length = 14, blocked = others(lane);
        add(at, lane, 'train', 'parked', { length, ramp: true });
        for (const l of blocked.slice(0, tier >= 2 ? 2 : 1)) add(at, l, 'train', 'parked', { length });
        for (let j = 0; j < 6; j++) coins.push({ at: at + 1 + j * 2.2, lane, y: 3.4, taken: false });
        break;
      }
      case 'oncoming': {
        // Start the train far enough away that it meets the runner at this row, not in an earlier row's open lane.
        const speed = 5 + tier * .8, meet = at + 12, pace = subwayCatalog.defaults.speed * (1 + Math.min(.3, (level - 1) * .035));
        add(meet * (1 + speed / pace), lane, 'train', 'oncoming', { length: 10, moving: true, speed });
        add(at, free, 'hurdle', 'barrier'); line(at + 4, others(lane).find(l => l !== free)!, .9, 6); break;
      }
      case 'root': add(at, lane, 'hurdle', 'root'); arc(at, lane); line(at, free); break;
      case 'rootWall': for (const l of lanes) add(at, l, 'hurdle', 'root'); arc(at, lane); break;
      case 'fire': add(at, lane, 'hurdle', 'fire'); line(at, free); break;
      case 'fires': for (const l of others(free)) add(at, l, 'hurdle', 'fire'); line(at, free); break;
      case 'log': for (const l of lanes) add(at, l, 'hurdle', 'log'); arc(at, lane); break;
      case 'vine': add(at, lane, 'arch', 'vine'); line(at, free); break;
      case 'vineWall': for (const l of lanes) add(at, l, 'arch', 'vine'); line(at, lane, .5, 5); break;
      case 'gap': add(at, lane, 'gap', 'pit'); arc(at, lane); line(at, free); break;
      case 'gaps': for (const l of others(free)) add(at, l, 'gap', 'pit'); line(at, free); break;
      case 'gapWall': for (const l of lanes) add(at, l, 'gap', 'pit'); arc(at, lane); break;
    }
    // Power-ups sit in open lanes between rows.
    if (at - lastPickup > 85) {
      const next = at + Math.max(spacing, span + 6) / 2; if (!(theme === 'temple' && nearTurn(next))) { pickups.push({ at: next, lane: free, kind: pick(theme === 'subway' ? ['magnet', 'double', 'jetpack'] as const : ['magnet', 'double', 'sprint'] as const), taken: false }); lastPickup = at; }
    }
    at += Math.max(spacing, span + 7);
  }
  for (let at = 8; at <= 20; at += 3) coins.push({ at, lane: 0, y: .9, taken: false });
  return { obstacles, coins, turns, pickups };
}

/** Independent simulation shared by the two runners, with different routes and hazards. */
export class RunnerRun extends ArcadeRun {
  /** What tripped the runner this stage, so the coach can suggest the right mod. */
  crashes: Record<'train' | 'hurdle' | 'arch' | 'gap' | 'turn', number> = { train: 0, hurdle: 0, arch: 0, gap: 0, turn: 0 };
  distance = 0; lane = 0; x = 0; y = 0; vy = 0; slide = 0; coins = 0; chain = 0;
  invulnerable = 0; shield = 0; shieldCooldown = 0; airborne = false; roof = 0; chase = 0;
  obstacles: RunnerObstacle[] = []; tokens: RunnerCoin[] = []; turns: RunnerTurn[] = []; pickups: RunnerPickup[] = [];
  powers: Record<PickupKind, number> = { magnet: 0, double: 0, jetpack: 0, sprint: 0 };
  private gesture: { x: number; y: number; id: number } | null = null;
  constructor(readonly theme: RunnerTheme, checkpoint?: unknown) {
    const c = theme === 'temple' ? templeCatalog : subwayCatalog;
    super(theme === 'temple' ? 'temple-race' : 'subway-runnerz', c.defaults, c.schema, checkpoint);
  }
  get goal() { return runnerGoal(this.level); }
  get stageName() { return runnerStageName(this.theme, this.level); }
  get mood() { return runnerMood(this.theme, this.level); }
  get nextTurn() { return this.turns.find(t => !t.passed); }
  get multiplier() { return this.powers.double > 0 ? 2 : 1; }
  get speed() { return this.config.speed * (1 + Math.min(.3, (this.level - 1) * .035)) * (this.powers.sprint > 0 ? 1.6 : 1) * this.weather.speed; }
  /** How the chosen weather plays (speed, slide length, lane grip). */
  get weather() { return RUNNER_WEATHER[this.config.weather ?? 'clear'] ?? RUNNER_WEATHER.clear; }
  /** Gravity for the world: Mars and the Sky Temple make every jump float. */
  get gravity() { return this.config.gravity * (this.theme === 'temple' ? templeWorld(this.config.worldTheme) : subwayWorld(this.config.worldTheme)).gravity; }
  protected setup(): void {
    const c = runnerCourse(this.theme, this.level); this.obstacles = c.obstacles; this.tokens = c.coins; this.turns = c.turns; this.pickups = c.pickups;
    this.distance = 0; this.lane = 0; this.x = 0; this.y = 0; this.vy = 0; this.slide = 0; this.coins = 0; this.chain = 0; this.chase = .8;
    this.crashes = { train: 0, hurdle: 0, arch: 0, gap: 0, turn: 0 };
    this.invulnerable = 1; this.shield = 0; this.shieldCooldown = 0; this.roof = 0; this.airborne = false; this.gesture = null; this.powers = { magnet: 0, double: 0, jetpack: 0, sprint: 0 };
    this.notice = `${this.stageName.toUpperCase()} · ${this.theme === 'temple' ? 'Follow the gold. Swipe to turn at the corners, jump roots and gaps, slide under vines.' : 'Switch tracks, jump barriers, slide under bars and ride the ramps onto the train roofs.'}`;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'left' || action === 'right') {
      const direction = action === 'left' ? -1 : 1, turn = this.nextTurn;
      if (turn && turn.at - this.distance <= 13 && turn.at > this.distance) {
        turn.queued = direction === turn.direction; this.notice = turn.queued ? 'TURN LOCKED IN. Keep running!' : 'Other way! Follow the arrow.';
      } else this.lane = clamp(this.lane + direction, -1, 1);
      this.metrics.actions++;
    }
    if ((action === 'primary' || action === 'up') && this.y <= this.roof + .04 && this.vy <= .01 && this.powers.jetpack <= 0) {
      this.vy = this.config.power; this.slide = 0; this.airborne = true; this.metrics.actions++; this.cue('launch', 0, 0);
    }
    if (action === 'down') { this.slide = this.weather.slide; if (this.vy > -8 && this.y > this.roof && this.powers.jetpack <= 0) this.vy = -14; this.metrics.actions++; }
    if (action === 'ability' && this.config.overdrive && this.shieldCooldown <= 0) {
      this.shield = this.theme === 'temple' ? 7 : 9; this.shieldCooldown = 16; this.metrics.actions++;
      this.notice = this.theme === 'temple' ? 'ANCIENT AEGIS. One crash forgiven.' : 'BOARD UP. Surf through one collision.'; this.cue('ability', 0, 0, this.theme === 'temple' ? 'AEGIS' : 'BOARD UP');
    }
  }
  protected tick(dt: number): void {
    const previous = this.distance; this.distance = Math.min(this.goal, this.distance + dt * this.speed);
    // Distance is worth points too, doubled with the 2× power-up.
    const metres = Math.floor(this.distance) - Math.floor(previous); if (metres > 0) this.score += metres * this.multiplier;
    this.x += (this.lane * LANE - this.x) * Math.min(1, dt * this.weather.grip);
    this.slide = Math.max(0, this.slide - dt); this.invulnerable = Math.max(0, this.invulnerable - dt); this.chase = Math.max(0, this.chase - dt / 6);
    this.shield = this.config.overdrive ? Math.max(0, this.shield - dt) : 0; this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    const flying = this.powers.jetpack > 0;
    for (const k of Object.keys(this.powers) as PickupKind[]) this.powers[k] = Math.max(0, this.powers[k] - dt);
    if (flying && this.powers.jetpack <= 0) { this.invulnerable = Math.max(this.invulnerable, 1.2); this.notice = 'Jetpack spent. Back on the tracks!'; }
    const roof = this.obstacles.find(o => o.kind === 'train' && Math.abs(o.lane * LANE - this.x) < .75 && this.distance >= o.at - (o.ramp ? 5 : 0) && this.distance <= o.at + o.length);
    const surface = roof ? this.distance < roof.at ? (this.distance - roof.at + 5) / 5 * 2.6 : 2.6 : 0;
    // A ramp is a continuous surface. Entering a train sideways is still a collision.
    this.roof = roof?.ramp || this.y >= 2.5 ? surface : 0;
    if (this.powers.jetpack > 0) { this.y += (JET_HEIGHT - this.y) * Math.min(1, dt * 3); this.vy = 0; this.airborne = true; }
    else { this.vy -= this.gravity * dt; this.y += this.vy * dt; }
    if (this.y <= this.roof) { if (this.airborne && this.vy < -3) this.cue('hit', 0, 0); this.y = this.roof; this.vy = 0; this.airborne = false; }
    for (const t of this.turns) {
      if (!t.passed && this.powers.sprint > 0 && t.at - this.distance < 10) t.queued = true;
      if (!t.passed && previous < t.at && this.distance >= t.at) {
        t.passed = true;
        if (!t.queued) { this.crashes.turn++; this.crash('MISSED TURN. Swipe toward the arrow before the corner.'); }
        else { this.metrics.perfects++; this.addScore(60 * this.multiplier, 0, 0, 'CLEAN TURN +60'); this.notice = 'Perfect turn. Next stretch, new choices.'; }
      }
    }
    for (const o of this.obstacles) {
      if (o.passed) continue;
      if (o.moving) o.at -= dt * o.speed;
      const overlap = this.distance >= o.at - .45 && this.distance <= o.at + o.length;
      const sameLane = Math.abs(this.x - o.lane * LANE) < .72;
      const danger = !flying && (o.kind === 'hurdle' ? this.y < .85 : o.kind === 'arch' ? this.slide <= 0 || this.y > .35 : o.kind === 'gap' ? this.y < .55 && this.powers.sprint <= 0 : this.y < 2.4 && (!o.ramp || this.distance >= o.at));
      if (overlap && sameLane && danger && !o.hit) {
        o.hit = true;
        if (this.powers.sprint > 0 && o.kind !== 'train') { this.addScore(50, 0, 0, 'SMASH!'); this.cue('hit', 0, 0); }
        else { this.crashes[o.kind]++; this.crash(o.kind === 'arch' ? 'Slide under it. Swipe down or press SLIDE.' : o.kind === 'gap' ? 'Jump the broken path. Swipe up or JUMP.' : o.kind === 'train' ? 'Train ahead. Change track or run up its ramp.' : 'Jump it or change lane.'); }
      }
      if (this.distance > o.at + o.length) { o.passed = true; if (!o.hit) { this.metrics.perfects++; this.addScore(15 * this.multiplier, 0, 0); } }
    }
    const magnet = this.config.assist || this.powers.magnet > 0;
    for (const c of this.tokens) {
      if (c.taken || Math.abs(c.at - this.distance) > (magnet ? 2.2 : 1.15)) continue;
      const close = Math.abs(c.lane * LANE - this.x) < (magnet ? 4.7 : .85), height = Math.abs(c.y - (this.y + .8)) < (magnet ? 4 : 1.05);
      if (close && height) {
        c.taken = true; this.coins++; this.chain++; if (this.config.assist && Math.abs(c.lane * LANE - this.x) > .85) this.metrics.assisted++;
        const combo = 1 + Math.min(3, Math.floor(this.chain / 10)), value = this.config.bonus * combo * this.multiplier;
        this.addScore(value, 0, 0, this.chain % 10 === 0 ? `COIN CHAIN ×${combo}` : undefined);
      }
    }
    for (const p of this.pickups) {
      if (p.taken || Math.abs(p.at - this.distance) > 1.1 || Math.abs(p.lane * LANE - this.x) > .9 || this.y > 2.2 && p.kind !== 'jetpack') continue;
      p.taken = true; this.powers[p.kind] = p.kind === 'jetpack' ? 6 : p.kind === 'sprint' ? 4 : p.kind === 'magnet' ? 10 : 12; this.metrics.perfects++;
      if (p.kind === 'jetpack') for (let at = this.distance + 8; at < Math.min(this.goal - 4, this.distance + this.speed * 5.6); at += 2.4) this.tokens.push({ at, lane: Math.round(Math.sin(at * .07) * 1.2), y: JET_HEIGHT + .7, taken: false });
      const name = { magnet: 'COIN MAGNET', double: '2× SCORE', jetpack: 'JETPACK!', sprint: 'SPRINT!' }[p.kind]; this.cue('ability', 0, 0, name); this.notice = `${name} ${p.kind === 'jetpack' ? 'Fly over everything and grab the sky coins.' : p.kind === 'sprint' ? 'Smash straight through for a few seconds.' : 'For a few seconds.'}`;
    }
    if (this.distance >= this.goal && this.phase === 'playing') { this.addScore(250 + this.coins * 5, 0, 0, this.theme === 'temple' ? 'TEMPLE REACHED!' : 'STATION REACHED!'); this.clear(0, 0); }
  }
  private crash(message: string): void {
    if (this.invulnerable > 0) return;
    if (this.shield > 0) { this.shield = 0; this.invulnerable = 1.6; this.notice = 'SHIELD SAVE. Keep the streak alive.'; this.metrics.assisted++; this.cue('ability', 0, 0, 'SAVED'); return; }
    this.chain = 0; this.invulnerable = 2; this.chase = 1; this.lose(0, 0, message);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId = 0): void {
    if (phase === 'cancel') { this.gesture = null; return; }
    if (this.phase !== 'playing') return;
    if (phase === 'down') { if (!this.gesture) this.gesture = { x, y, id: pointerId }; return; }
    if (this.gesture?.id !== pointerId) return;
    const dx = x - this.gesture.x, dy = y - this.gesture.y;
    // Swipes fire as soon as the finger has moved far enough, so quick flicks feel instant on tablets.
    if (phase === 'move' && Math.hypot(dx, dy) > 46) { this.gesture = null; this.action(Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'); return; }
    if (phase === 'up') { this.gesture = null; if (Math.hypot(dx, dy) < 24) this.action('primary'); else this.action(Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'); }
  }
  protected runtime() { return { distance: Math.floor(this.distance), coins: this.coins, streak: this.chain }; }
  protected stageSummary() { return { coins: this.coins, chain: this.chain, lives: this.lives }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.distance = this.goal; this.coins = Math.floor(summary.coins ?? 0); this.chain = Math.floor(summary.chain ?? 0); this.lives = Math.floor(summary.lives ?? this.config.lives); this.obstacles.forEach(o => { o.passed = true; }); this.turns.forEach(t => { t.passed = true; }); this.chase = 0; }
  stats() { return [{ label: 'DISTANCE', value: `${Math.floor(this.distance)}m` }, { label: 'COINS', value: this.coins }, { label: this.theme === 'temple' ? 'CHARMS' : 'CHANCES', value: this.lives }]; }
}

/** Piecewise path frame for real right-angle temple corners; forward is initially -Z. */
export function runnerFrame(distance: number, theme: RunnerTheme, level = 1): { x: number; z: number; yaw: number } {
  if (theme === 'subway' || distance <= 0) return { x: 0, z: -distance, yaw: 0 };
  let x = 0, z = 0, yaw = 0, previous = 0;
  for (let at = TURN_SPACING, i = 0; at < runnerGoal(level) - 25; at += TURN_SPACING, i++) { const length = Math.min(distance, at) - previous; if (length > 0) { x -= Math.sin(yaw) * length; z -= Math.cos(yaw) * length; } if (distance <= at) return { x, z, yaw }; previous = at; yaw -= turnDirection(i, level) * Math.PI / 2; }
  const length = distance - previous; return { x: x - Math.sin(yaw) * length, z: z - Math.cos(yaw) * length, yaw };
}
