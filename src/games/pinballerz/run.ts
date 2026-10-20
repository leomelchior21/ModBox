import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { pinballCatalog } from './catalog';
import { pinStage, pinStageName, type Defender, type PinGoal } from './levels';
export { PIN_STAGES, pinStage, pinStageName, GOAL_TEXT, type PinGoal, type PinStage } from './levels';

/**
 * Soccer pinball. Table space is 640 × 1000 units with y growing toward your own goal; the rival goal is at the top.
 * Physics runs in 600 Hz sub-steps, so the feel is the same at any frame rate.
 */
export const TABLE = { width: 640, height: 1000, centre: 320 }, BALL_R = 13, STEP = 1 / 600;
/** Rival goal mouth (between the posts) and your own goal at the bottom. */
export const GOAL = { y: 104, left: 210, right: 430, back: 50 }, HOME = { y: 972, left: 250, right: 390, back: 1004 };
/** Half-width of the rival keeper's body (the arms reach a little further). */
export const KEEPER_REACH = 10;
export const KEEPER_Y = 132, HOME_KEEPER_Y = 944, CENTRE_SPOT = { x: 320, y: 520 }, PLAYER_R = 18, TOKEN_R = 20;
type Seg = readonly [number, number, number, number];

export function closestSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / Math.max(1e-6, dx * dx + dy * dy), 0, 1);
  return { x: ax + dx * t, y: ay + dy * t, t };
}
const mirror = ([ax, ay, bx, by]: Seg): Seg => [TABLE.width - ax, ay, TABLE.width - bx, by];
/** The rounded corner where the top rail meets the side rail. */
const CORNER: Seg[] = Array.from({ length: 8 }, (_, i) => { const a0 = -Math.PI / 2 - i * Math.PI / 16, a1 = a0 - Math.PI / 16; return [130 + 50 * Math.cos(a0), 154 + 50 * Math.sin(a0), 130 + 50 * Math.cos(a1), 154 + 50 * Math.sin(a1)]; });
const LEFT: Seg[] = [[GOAL.left - 7, GOAL.y, 130, GOAL.y], ...CORNER, [80, 154, 80, 655], [80, 655, 92, 698], [92, 698, 188, 838]];
/** The white boundary: top rail either side of the goal, rounded corners, touchline rails and the funnel to the flippers. */
export const PIN_RAILS: readonly Seg[] = [...LEFT, ...LEFT.map(mirror)];
/** Hidden guides that seal the pocket under each flipper and steer a drained ball into your net. */
const GUIDE: Seg[] = [[200, 862, 266, 912], [266, 912, HOME.left, HOME.y + 6]];
const HOME_GUIDES: readonly Seg[] = [...GUIDE, ...GUIDE.map(mirror)];
/** Goal posts and the flipper pivots. */
export const POSTS: readonly [number, number, number][] = [[GOAL.left, GOAL.y, 7], [GOAL.right, GOAL.y, 7], [196, 846, 5], [444, 846, 5]];
/** Open spots where power-up tokens can appear. */
const TOKEN_SPOTS = [[160, 290], [480, 290], [320, 470], [175, 590], [465, 590], [320, 690], [250, 210], [390, 210], [140, 420], [500, 420]] as const;
const EXTRA_DEFENDERS = [[320, 330], [150, 420], [490, 420], [250, 650], [390, 650], [150, 255], [490, 255], [320, 185], [320, 250]] as const;
const MATE_SPOTS = [[150, 610], [490, 610], [255, 690], [385, 690], [125, 480], [515, 480]] as const;

export type PowerKind = 'fire' | 'multi' | 'wall' | 'freeze' | 'double';
export const POWER_TEXT: Record<PowerKind, string> = { fire: 'FIREBALL', multi: 'MULTIBALL', wall: 'THE WALL', freeze: 'ICE KEEPER', double: 'DOUBLE POINTS' };
export interface Touch { defender: boolean; rail: boolean; keeper: boolean; mate: boolean; power: boolean }
export interface Pinball { id: number; x: number; y: number; vx: number; vy: number; state: 'play' | 'net' | 'lost'; timer: number; fire: number; kickAt: number; touch: Touch; trail: { x: number; y: number }[] }
export interface Player { id: number; x: number; y: number; hx: number; hy: number; vx: number; vy: number; flash: number; cooldown: number; phase: number; plan: Defender; mate: boolean }
export interface Flipper { x: number; y: number; angle: number; omega: number; left: boolean; rest: number; up: number; length: number; pressed: number }
export interface Keeper { x: number; vx: number; target: number; error: number; shot: number; dive: number; knocked: number; saves: number }
export interface Token { id: number; kind: PowerKind; x: number; y: number; life: number }
export interface GoalEvent { id: number; text: string; detail: string; points: number; combo: number; x: number; conceded: boolean }
const DIFFICULTY: Record<string, number> = { easy: .7, normal: 1, hard: 1.25, pro: 1.5 };
/** How the weather plays: grass drag on the ball (per second) and whether gusts blow across the pitch. */
export const WEATHER: Record<string, { drag: number; wind: boolean; text: string }> = {
  clear: { drag: .3, wind: false, text: '' }, rain: { drag: .14, wind: false, text: 'WET PITCH · the ball skids faster' },
  snow: { drag: .5, wind: false, text: 'SNOW · the ball rolls heavy and slow' }, fog: { drag: .3, wind: false, text: 'FOG · the far goal fades from view' },
  storm: { drag: .16, wind: true, text: 'STORM · gusts push the ball sideways' },
};

export class PinballRun extends ArcadeRun {
  balls: Pinball[] = []; waiting = true; flippers: Flipper[] = []; players: Player[] = []; tokens: Token[] = [];
  keeper: Keeper = this.freshKeeper(); home: Keeper = this.freshKeeper();
  tally: Record<PinGoal | 'saves', number> = { goals: 0, volleys: 0, powerups: 0, hattricks: 0, score: 0, saves: 0 };
  /** Active power-up timers in seconds. */
  power: Record<PowerKind, number> = { fire: 0, multi: 0, wall: 0, freeze: 0, double: 0 };
  /** Sideways wind on the ball in table units per second squared; only storms blow. */
  wind = 0; savesSinceGoal = 0; lastGoalAt = 0;
  streak = 0; best = 0; stageScore = 0; conceded = 0; kickoffTimer = 0; powerArmed = 0; powerCooldown = 0; pulse = 0;
  /** The latest goal (or goal against) for the scoreboard banner and the stadium celebration. */
  goal: GoalEvent | null = null; goalTimer = 0; goals = 0;
  /** Short message for the in-game banner. */
  display = { text: '', timer: 0 };
  private nextId = 1; private seed = 1; private tokenTimer = 0; private layout = ''; private stuck = new Map<number, number>(); private trailTimer = 0;
  private pointerSides = new Map<number, 'left' | 'right'>();
  constructor(checkpoint?: unknown) { super('pinballerz', pinballCatalog.defaults, pinballCatalog.schema, checkpoint); }
  get stage() { return pinStage(this.level); }
  get levelName() { return pinStageName(this.level); }
  /** The first ball, for older callers and the camera. */
  get ball(): Pinball { return this.balls[0] ?? this.newBall(); }
  get live() { return this.balls.filter(b => b.state === 'play'); }
  get multiball() { return this.live.length > 1; }
  get gravity() { return this.config.gravity * (1 + Math.min(.2, (this.level - 1) * .018)); }
  get weather() { return WEATHER[this.config.weather ?? 'clear'] ?? WEATHER.clear; }
  get skill() { return DIFFICULTY[this.config.difficulty ?? 'normal'] ?? 1; }
  /** How fast your keeper moves across the goal. */
  get homeSpeed() { return this.config.assist ? 340 : Math.max(60, 160 - (this.level - 1) * 9) / this.skill; }
  /** Half-width of your keeper's body; an easy match gives you a bigger keeper. */
  get homeReach() { return this.config.difficulty === 'easy' ? 12 : this.config.difficulty === 'pro' ? 3 : 7; }
  goalProgress() { return this.stage.goals.map(([kind, count]) => ({ kind, count, value: Math.min(count, kind === 'score' ? this.score - this.stageScore : this.tally[kind]) })); }
  /** Seeded so a stage plays the same way in tests and in replays. */
  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  private freshKeeper(): Keeper { return { x: TABLE.centre, vx: 0, target: TABLE.centre, error: 0, shot: -1, dive: 0, knocked: 0, saves: 0 }; }
  protected setup(): void {
    this.pointerSides.clear(); this.seed = this.level * 7919 + 17;
    this.flippers = [{ x: 196, y: 846, angle: .62, omega: 0, left: true, rest: .62, up: -.42, length: 92, pressed: 0 }, { x: 444, y: 846, angle: Math.PI - .62, omega: 0, left: false, rest: Math.PI - .62, up: Math.PI + .42, length: 92, pressed: 0 }];
    this.keeper = this.freshKeeper(); this.home = this.freshKeeper(); this.tokens = []; this.layout = ''; this.arrange();
    this.tally = { goals: 0, volleys: 0, powerups: 0, hattricks: 0, score: 0, saves: 0 }; this.power = { fire: 0, multi: 0, wall: 0, freeze: 0, double: 0 };
    this.streak = 0; this.best = 0; this.conceded = 0; this.wind = 0; this.savesSinceGoal = 0; this.lastGoalAt = 0; this.stageScore = this.score; this.kickoffTimer = 0; this.powerArmed = 0; this.powerCooldown = 0; this.pulse = 0;
    this.goal = null; this.goalTimer = 0; this.tokenTimer = this.stage.powerups ? Math.min(5, this.stage.powerups) : 0; this.stuck.clear();
    this.serve(true); this.show(this.levelName.toUpperCase(), 2.5);
    this.notice = `${this.levelName.toUpperCase()} · ${this.stage.tip}`;
  }
  /** Places rival defenders and your teammates for the stage and the current squad mods. */
  private arrange(): void {
    const key = `${this.level}|${this.config.rivals ?? 0}|${this.config.teammates ?? 0}`; if (key === this.layout) return; this.layout = key;
    const plans: { plan: Defender; mate: boolean }[] = this.stage.defenders.map(plan => ({ plan, mate: false })), clear = (x: number, y: number, gap: number) => plans.every(p => Math.hypot(p.plan.x - x, p.plan.y - y) >= gap) && Math.hypot(x - CENTRE_SPOT.x, y - CENTRE_SPOT.y) > 50;
    let extra = clamp(this.config.rivals ?? 0, 0, 4);
    for (const [x, y] of EXTRA_DEFENDERS) if (extra > 0 && clear(x, y, 70)) { plans.push({ plan: { x, y }, mate: false }); extra--; }
    let mates = clamp(this.config.teammates ?? 0, 0, 4);
    for (const [x, y] of MATE_SPOTS) if (mates > 0 && clear(x, y, 60)) { plans.push({ plan: { x, y }, mate: true }); mates--; }
    // Keep existing players where they are so a live mod change does not teleport the squad.
    const previous = this.players;
    this.players = plans.map(({ plan, mate }, i) => previous.find(p => p.plan === plan && p.mate === mate) ?? { id: this.nextId++, x: plan.x, y: plan.y, hx: plan.x, hy: plan.y, vx: 0, vy: 0, flash: 0, cooldown: 0, phase: i * 1.7, plan, mate });
  }
  private newBall(x: number = CENTRE_SPOT.x, y: number = CENTRE_SPOT.y): Pinball { return { id: this.nextId++, x, y, vx: 0, vy: 0, state: 'play', timer: 0, fire: 0, kickAt: -9, touch: { defender: false, rail: false, keeper: false, mate: false, power: false }, trail: [] }; }
  private show(text: string, seconds = 1.8) { this.display = { text, timer: seconds }; }
  /** Puts the kick-off balls on the centre spot. They wait for a tap unless the stage just restarted after a goal. */
  private serve(wait: boolean): void {
    const count = Math.max(this.stage.balls, clamp(this.config.balls ?? 1, 1, 3));
    this.balls = Array.from({ length: count }, (_, i) => this.newBall(CENTRE_SPOT.x + (i - (count - 1) / 2) * 34, CENTRE_SPOT.y));
    this.waiting = wait; this.stuck.clear(); if (!wait) this.kickOff(true);
  }
  /** Kick-off: the ball is passed out wide so it rolls down a side lane onto a flipper. Returns false when there is nothing to kick off. */
  kickOff(auto = false): boolean {
    if (this.phase !== 'playing' || (!this.waiting && !auto)) return false;
    this.waiting = false; const first = this.rand() < .5 ? -1 : 1;
    this.balls.forEach((b, i) => { const side = i % 2 ? -first : first; b.vx = side * (360 + this.rand() * 80); b.vy = -40 + this.rand() * 60; });
    if (!auto) this.metrics.actions++;
    this.cue('launch', CENTRE_SPOT.x, CENTRE_SPOT.y); this.notice = 'KICK-OFF! Tap the left or right side (or use the arrow keys) to swing a flipper.'; return true;
  }
  /** Older name kept for the shared controls. */
  launchBall(): boolean { return this.kickOff(); }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' || action === 'launch') { if (!this.kickOff()) { this.pulse = .17; this.metrics.actions++; } }
    if (action === 'ability' || action === 'nudge') {
      if (!this.config.overdrive || this.powerCooldown > 0 || this.waiting) return;
      this.powerArmed = 3; this.powerCooldown = 8; this.metrics.actions++; this.cue('ability', TABLE.centre, 820, 'POWER SHOT READY!');
      this.show('POWER SHOT READY', 1.5); this.notice = 'POWER SHOT armed: strike the ball with a flipper in the next three seconds.';
    }
    if (action === 'left' || action === 'right') { this.metrics.actions++; const f = this.flippers.find(f => f.left === (action === 'left')); if (f) f.pressed = .18; }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, _y: number, pointerId = 0): void {
    if (phase === 'move' && !this.pointerSides.has(pointerId)) return;
    if (phase === 'cancel') this.pointerSides.clear();
    else if (phase === 'up') this.pointerSides.delete(pointerId);
    else this.pointerSides.set(pointerId, x < TABLE.width / 2 ? 'left' : 'right');
    this.input.left = [...this.pointerSides.values()].includes('left'); this.input.right = [...this.pointerSides.values()].includes('right');
    if (phase === 'down') { if (this.waiting) this.kickOff(); else this.metrics.actions++; }
  }
  held(f: Flipper) { return this.pulse > 0 || (f.left ? this.input.left : this.input.right) || f.pressed > 0; }
  protected tick(dt: number): void {
    this.arrange();
    this.pulse = Math.max(0, this.pulse - dt); this.display.timer = Math.max(0, this.display.timer - dt); this.goalTimer = Math.max(0, this.goalTimer - dt);
    this.powerArmed = Math.max(0, this.powerArmed - dt); this.powerCooldown = Math.max(0, this.powerCooldown - dt);
    for (const k of Object.keys(this.power) as PowerKind[]) this.power[k] = Math.max(0, this.power[k] - dt);
    for (const f of this.flippers) f.pressed = Math.max(0, f.pressed - dt);
    if (this.kickoffTimer > 0) { this.kickoffTimer -= dt; if (this.kickoffTimer <= 0 && this.phase === 'playing') { this.kickoffTimer = 0; this.serve(false); this.show('KICK-OFF', 1.2); } }
    this.wind = this.weather.wind ? Math.sin(this.elapsed * .42) * 230 + Math.sin(this.elapsed * 1.7 + 1) * 90 : 0;
    this.movePlayers(dt); this.moveKeepers(dt); this.spawnTokens(dt);
    const steps = Math.max(1, Math.round(dt / STEP)), h = dt / steps;
    for (let s = 0; s < steps && this.phase === 'playing'; s++) this.substep(h);
    if (this.phase !== 'playing') return;
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) { this.trailTimer = .016; for (const b of this.balls) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 14) b.trail.shift(); } }
    for (const b of this.balls) {
      b.fire = Math.max(0, b.fire - dt);
      if (b.state !== 'play') { b.timer -= dt; continue; }
      // A ball that stops dead out on the pitch gets a referee's drop ball toward your flippers.
      const resting = Math.hypot(b.vx, b.vy) < 22 && b.y < 780, wait = resting && !this.waiting ? (this.stuck.get(b.id) ?? 0) + dt : 0; this.stuck.set(b.id, wait);
      if (wait > 2.5) { b.vy = 240; b.vx = (TABLE.centre - b.x) * .6; this.stuck.set(b.id, 0); this.show('DROP BALL', 1); }
    }
    for (const b of this.balls.filter(b => b.state !== 'play' && b.timer <= 0)) this.retire(b);
    if (this.phase === 'playing' && this.goalProgress().every(g => g.value >= g.count)) { this.show('FULL TIME!', 4); this.clear(TABLE.centre, 300); }
  }
  /** Rival defenders patrol or shadow the ball; teammates hold their spots. */
  private movePlayers(dt: number): void {
    const lead = this.live.reduce<Pinball | null>((best, b) => !best || b.y < best.y ? b : best, null), pace = this.skill;
    for (const p of this.players) {
      p.flash = Math.max(0, p.flash - dt); p.cooldown = Math.max(0, p.cooldown - dt);
      const { plan } = p, px = p.x, py = p.y;
      if (plan.patrol) { const offset = plan.patrol * Math.sin(this.elapsed * Math.PI * 2 * (plan.speed ?? .5) * pace + p.phase); if (plan.vertical) p.y = plan.y + offset; else p.x = plan.x + offset; }
      else if (plan.mark) { const target = clamp(lead ? lead.x : plan.x, plan.x - plan.mark, plan.x + plan.mark), step = (plan.speed ?? 90) * pace * dt; p.x += clamp(target - p.x, -step, step); }
      p.vx = (p.x - px) / dt; p.vy = (p.y - py) / dt;
    }
  }
  private moveKeepers(dt: number): void {
    const k = this.keeper, s = this.stage, limit = (x: number) => clamp(x, GOAL.left + 30, GOAL.right - 30);
    k.dive = Math.max(0, Math.abs(k.dive) - dt * 2.5) * Math.sign(k.dive); k.knocked = Math.max(0, k.knocked - dt);
    // Read the most urgent shot: where it will cross the keeper's line, blurred by how sharp this keeper is.
    let urgent: Pinball | null = null, soonest = 9;
    for (const b of this.live) if (b.vy < -120 && b.y < 760) { const t = (b.y - KEEPER_Y) / -b.vy; if (t < soonest) { soonest = t; urgent = b; } }
    if (urgent) {
      if (k.shot !== urgent.kickAt) { k.shot = urgent.kickAt; k.error = (this.rand() * 2 - 1) * (1 - Math.min(.95, s.smart + (this.skill - 1) * .25)) * 80; }
      k.target = limit(urgent.x + urgent.vx * soonest + k.error);
      if (soonest < .3 && Math.abs(k.target - k.x) > 10 && !k.dive) k.dive = Math.sign(k.target - k.x) * .6;
    } else k.target = limit(TABLE.centre + Math.sin(this.elapsed * .9) * 55 * (1 - s.smart) + ((this.live[0]?.x ?? TABLE.centre) - TABLE.centre) * .3 * s.smart);
    const speed = this.power.freeze > 0 || k.knocked > 0 ? 0 : s.keeper * this.skill, before = k.x;
    k.x = limit(k.x + clamp(k.target - k.x, -speed * dt, speed * dt)); k.vx = (k.x - before) / dt;
    // Your keeper follows the ball across the goal: quick on early stages, slower later. SUPER KEEPER is quicker still.
    const h = this.home, hb = h.x; h.dive = Math.max(0, Math.abs(h.dive) - dt * 2.5) * Math.sign(h.dive);
    const danger = this.live.filter(b => b.vy > -50).sort((a, b) => b.y - a.y)[0];
    h.target = danger ? danger.x : TABLE.centre + Math.sin(this.elapsed * 1.3) * 30;
    const hs = this.homeSpeed; h.x = clamp(h.x + clamp(h.target - h.x, -hs * dt, hs * dt), HOME.left + 30, HOME.right - 30); h.vx = (h.x - hb) / dt;
  }
  private spawnTokens(dt: number): void {
    const every = this.stage.powerups; if (!every || this.waiting) return;
    for (const t of this.tokens) t.life -= dt; this.tokens = this.tokens.filter(t => t.life > 0);
    this.tokenTimer -= dt; if (this.tokenTimer > 0 || this.tokens.length >= 2) return;
    this.tokenTimer = every * (.8 + this.rand() * .4);
    const spots = TOKEN_SPOTS.filter(([x, y]) => this.players.every(p => Math.hypot(p.x - x, p.y - y) > 55) && this.tokens.every(t => Math.hypot(t.x - x, t.y - y) > 80) && this.live.every(b => Math.hypot(b.x - x, b.y - y) > 60));
    if (!spots.length) return;
    const [x, y] = spots[Math.floor(this.rand() * spots.length)], kinds: PowerKind[] = ['fire', 'multi', 'wall', 'freeze', 'double'];
    this.tokens.push({ id: this.nextId++, kind: kinds[Math.floor(this.rand() * kinds.length)], x, y, life: 10 });
  }
  private substep(h: number): void {
    // Boot power sets how fast the flippers swing, and so how hard they strike.
    const swing = 21 * this.config.power / 900;
    for (const f of this.flippers) { const target = this.held(f) ? f.up : f.rest, previous = f.angle; f.angle += clamp(target - f.angle, -h * swing, h * swing); f.omega = (f.angle - previous) / h; }
    if (this.waiting) return;
    const g = this.gravity;
    for (const b of this.balls) {
      if (b.state !== 'play') { this.inNet(b, h); continue; }
      b.vy += g * h; b.vx += this.wind * h; const drag = 1 - h * this.weather.drag; b.vx *= drag; b.vy *= drag; b.x += b.vx * h; b.y += b.vy * h;
      // Rails are lively up the pitch and dead low down, so a ball rolls down the side lanes onto a flipper.
      for (const r of PIN_RAILS) if (this.collide(b, r[0], r[1], r[2], r[3], 4, r[1] > 640 ? .08 : .45) > 60) b.touch.rail = true;
      for (const r of HOME_GUIDES) this.collide(b, r[0], r[1], r[2], r[3], 3, .3);
      for (const [x, y, r] of POSTS) this.collide(b, x, y, x, y, r, .6);
      for (const p of this.players) this.player(b, p);
      this.rivalKeeper(b); this.homeKeeper(b); this.wall(b);
      for (const f of this.flippers) this.flipper(b, f);
      for (const t of this.tokens) if (Math.hypot(b.x - t.x, b.y - t.y) < BALL_R + TOKEN_R) this.collect(t, b);
      const speed = Math.hypot(b.vx, b.vy); if (speed > 2800) { b.vx *= 2800 / speed; b.vy *= 2800 / speed; }
      if (b.y < GOAL.y - 6 && b.x > GOAL.left && b.x < GOAL.right) this.scored(b);
      else if (b.y > HOME.y) this.lostBall(b);
    }
    // Balls knock into each other during multiball.
    const live = this.live;
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], c = live[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy); if (d >= BALL_R * 2 || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, push = (BALL_R * 2 - d) / 2; a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
      const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; c.vx -= rel * nx; c.vy -= rel * ny; }
    }
  }
  /** A ball in either net slows down inside it. */
  private inNet(b: Pinball, h: number): void {
    const top = b.state === 'net', drag = 1 - h * 6; b.vx *= drag; b.vy *= drag; b.x += b.vx * h; b.y += b.vy * h;
    const net = top ? GOAL : HOME; b.x = clamp(b.x, net.left + BALL_R, net.right - BALL_R);
    if (top) b.y = clamp(b.y, GOAL.back + BALL_R, GOAL.y); else b.y = clamp(b.y, HOME.y, HOME.back - BALL_R);
  }
  /** Pushes the ball out of a capsule and bounces it. Returns the approach speed, or 0 without contact. */
  private collide(b: Pinball, ax: number, ay: number, bx: number, by: number, radius: number, restitution: number, sx = 0, sy = 0): number {
    const p = closestSegment(b.x, b.y, ax, ay, bx, by), dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), min = BALL_R + radius;
    if (d >= min) return 0;
    const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1; b.x = p.x + nx * min; b.y = p.y + ny * min;
    const vn = (b.vx - sx) * nx + (b.vy - sy) * ny; if (vn >= 0) return 0;
    b.vx -= (1 + restitution) * vn * nx; b.vy -= (1 + restitution) * vn * ny; return -vn;
  }
  private flipper(b: Pinball, f: Flipper): void {
    const ex = f.x + Math.cos(f.angle) * f.length, ey = f.y + Math.sin(f.angle) * f.length, p = closestSegment(b.x, b.y, f.x, f.y, ex, ey), radius = 9 - 3 * p.t;
    // The rubber moves with the boot: a swinging flipper hands its surface speed to the ball.
    const speed = this.collide(b, f.x, f.y, ex, ey, radius, .3, -f.omega * (p.y - f.y), f.omega * (p.x - f.x));
    if (!speed || Math.abs(f.omega) < 2 || speed < 150) return;
    b.kickAt = this.elapsed; b.touch = { defender: false, rail: false, keeper: false, mate: false, power: false };
    if (this.powerArmed > 0 && b.vy < 0) {
      // POWER SHOT: a blazing drive at the corner the keeper is not covering.
      const aim = this.keeper.x > TABLE.centre ? GOAL.left + 34 : GOAL.right - 34, dx = aim - b.x, dy = GOAL.y - 30 - b.y, len = Math.hypot(dx, dy);
      b.vx = dx / len * 2300; b.vy = dy / len * 2300; b.fire = 1.2; b.touch.power = true; this.powerArmed = 0; this.cue('perfect', b.x, b.y, 'POWER SHOT!');
    } else this.cue('launch', b.x, b.y);
  }
  private player(b: Pinball, p: Player): void {
    if (b.fire > 0 && !p.mate) return;
    const speed = this.collide(b, p.x, p.y, p.x, p.y, PLAYER_R, .7, p.vx, p.vy); if (!speed) return;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (p.mate) {
      if (p.cooldown > 0) return;
      // A teammate passes it on toward the far post from the keeper.
      const aim = this.keeper.x > TABLE.centre ? GOAL.left + 40 : GOAL.right - 40, ax = aim - b.x, ay = GOAL.y - 20 - b.y, len = Math.hypot(ax, ay);
      b.vx = ax / len * 1550; b.vy = ay / len * 1550; b.touch.mate = true; p.cooldown = .4; p.flash = .4; this.addScore(50, p.x, p.y, 'PASS!'); this.cue('hit', p.x, p.y); return;
    }
    // Defenders clear the ball out wide: it leaves with at least clearance speed, angled toward the nearer touchline.
    const out = b.vx * dx / d + b.vy * dy / d; if (out < 420) { b.vx += (420 - out) * dx / d; b.vy += (420 - out) * dy / d; }
    if (b.vy > 0) b.vx += (b.x < TABLE.centre ? -1 : 1) * 220;
    b.touch.defender = true;
    if (p.cooldown <= 0) { p.cooldown = .15; p.flash = .3; this.addScore(25, p.x, p.y); this.cue('hit', p.x, p.y); }
  }
  private rivalKeeper(b: Pinball): void {
    const k = this.keeper, reach = KEEPER_REACH;
    if (b.fire > 0) { if (Math.abs(b.x - k.x) < reach + 20 && Math.abs(b.y - KEEPER_Y) < 24 && !k.knocked) { k.knocked = 1; this.show('UNSTOPPABLE!', 1.2); } return; }
    if (!this.collide(b, k.x - reach, KEEPER_Y, k.x + reach, KEEPER_Y, 11, .45, k.vx, 0)) return;
    if (b.vy < 280) { b.vy = 280 + this.rand() * 200; b.vx += (b.x - k.x) * 6 + (this.rand() - .5) * 200; }
    if (!b.touch.keeper) { k.saves++; this.savesSinceGoal++; k.dive = Math.sign(b.x - k.x || 1) * .5; this.show('SAVED!', 1); this.cue('hit', b.x, b.y, 'SAVED!'); }
    b.touch.keeper = true;
  }
  private homeKeeper(b: Pinball): void {
    const h = this.home, reach = this.homeReach;
    if (!this.collide(b, h.x - reach, HOME_KEEPER_Y, h.x + reach, HOME_KEEPER_Y, 9, .4, h.vx, 0) || b.vy < -300) return;
    // A save boots the ball back up the pitch.
    b.vy = -(780 + this.rand() * 220); b.vx = (b.x - h.x) * 9 + (this.rand() - .5) * 240; h.dive = Math.sign(b.x - h.x || 1) * .5; h.saves++; this.tally.saves++;
    if (this.config.assist) this.metrics.assisted++;
    this.addScore(100, h.x, HOME_KEEPER_Y, 'GREAT SAVE!'); this.show('GREAT SAVE!', 1.2);
  }
  private wall(b: Pinball): void {
    if (this.power.wall <= 0 || !this.collide(b, 262, 912, 378, 912, 12, .3)) return;
    b.vy = -760; b.vx += (b.x - TABLE.centre) * 4; this.cue('hit', b.x, b.y, 'HEADER!');
  }
  private collect(t: Token, b: Pinball): void {
    this.tokens = this.tokens.filter(x => x !== t); this.tally.powerups++; this.metrics.perfects++;
    const k = t.kind; this.power[k] = k === 'fire' ? 8 : k === 'wall' ? 10 : k === 'freeze' ? 6 : k === 'double' ? 12 : 1;
    if (k === 'fire') for (const ball of this.live) ball.fire = 8;
    if (k === 'multi') for (let i = 0; i < 2; i++) { const nb = this.newBall(CENTRE_SPOT.x + (i ? 30 : -30), CENTRE_SPOT.y); nb.vx = (i ? 1 : -1) * (120 + this.rand() * 80); nb.vy = 220; this.balls.push(nb); }
    this.show(POWER_TEXT[k], 2); this.cue('ability', t.x, t.y, `${POWER_TEXT[k]}!`); this.addScore(250, b.x, b.y);
    this.notice = { fire: 'FIREBALL! Your shots burn through defenders and the keeper for eight seconds.', multi: 'MULTIBALL! Two more balls from the centre spot.', wall: 'THE WALL! Your teammates guard the goal for ten seconds.', freeze: 'ICE KEEPER! The rival keeper is frozen for six seconds.', double: 'DOUBLE POINTS for twelve seconds!' }[k];
  }
  private scored(b: Pinball): void {
    b.state = 'net'; b.timer = .7; this.goals++; this.savesSinceGoal = 0; this.lastGoalAt = this.elapsed; this.tally.goals++; this.streak++; this.best = Math.max(this.best, this.streak);
    const t = b.touch, volley = !t.defender && !t.keeper && !t.rail && !t.mate && !t.power && this.elapsed - b.kickAt < 1.6;
    const [text, mult] = t.power ? ['POWER SHOT', 2] : t.mate ? ['TEAM GOAL', 1.5] : volley ? ['VOLLEY', 1.5] : t.keeper ? ['REBOUND', 1.25] : t.rail && !t.defender ? ['BANK SHOT', 1.25] : ['GOAL', 1];
    if (volley) this.tally.volleys++;
    const combo = Math.min(5, this.streak), points = this.config.bonus * combo * mult * (this.power.double > 0 ? 2 : 1);
    const details = [text === 'GOAL' ? '' : text, combo > 1 ? `COMBO ×${combo}` : ''];
    if (this.streak % 3 === 0) { this.tally.hattricks++; details.push('HAT-TRICK!'); this.addScore(2000, TABLE.centre, 300, 'HAT-TRICK!'); }
    this.goal = { id: this.goals, text: 'GOAL!', detail: details.filter(Boolean).join(' · '), points: Math.round(points), combo, x: b.x, conceded: false }; this.goalTimer = 2.2;
    this.addScore(points, b.x, GOAL.y, `GOAL! +${Math.round(points)}`); this.cue('perfect', b.x, GOAL.y); this.metrics.perfects++;
    this.show(text === 'GOAL' ? 'GOAL!' : `${text}!`, 2); this.notice = `GOAL! ${details.filter(Boolean).join(' · ') || 'Keep the streak going for a combo.'}`;
  }
  private lostBall(b: Pinball): void { b.state = 'lost'; b.timer = .5; this.cue('lose', b.x, HOME.y); }
  /** Removes a ball that finished in a net, then kicks off again or costs a ball from the rack. */
  private retire(b: Pinball): void {
    this.balls = this.balls.filter(x => x !== b); this.stuck.delete(b.id);
    if (this.balls.some(x => x.state === 'play') || this.kickoffTimer > 0) return;
    if (b.state === 'net' || this.balls.some(x => x.state === 'net')) { if (!this.balls.length) this.kickoffTimer = 1.3; return; }
    if (this.balls.length) return;
    this.streak = 0; this.conceded++; this.goal = { id: this.goals + 1000 * this.conceded, text: 'CONCEDED', detail: this.lives > 1 ? `${this.lives - 1} BALL${this.lives === 2 ? '' : 'S'} LEFT` : 'FULL TIME', points: 0, combo: 0, x: b.x, conceded: true }; this.goalTimer = 1.8;
    this.lose(TABLE.centre, HOME.y, 'GOAL AGAINST');
    this.show(this.lives ? `${this.lives} BALL${this.lives === 1 ? '' : 'S'} LEFT` : 'GAME OVER', 2);
    if (this.phase === 'playing') { this.power = { fire: 0, multi: 0, wall: 0, freeze: 0, double: 0 }; this.serve(true); this.notice = 'Goal against! Tap or press Space to kick off again.'; }
  }
  protected runtime() { return { goals: this.tally.goals, streak: this.streak, saves: this.tally.saves }; }
  protected stageSummary() { return { stageScore: this.score - this.stageScore, lives: this.lives, goals: this.tally.goals }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.stageScore = Math.max(0, this.score - Math.floor(summary.stageScore ?? 0)); this.lives = Math.floor(summary.lives ?? this.config.lives); this.tally.goals = Math.floor(summary.goals ?? 0); this.show('FULL TIME!', 99); }
  stats() { const main = this.goalProgress()[0]; return [{ label: 'BALLS', value: this.lives }, { label: main.kind === 'goals' ? 'GOALS' : main.kind.toUpperCase(), value: `${main.value}/${main.count}` }, { label: 'COMBO', value: `×${Math.max(1, Math.min(5, this.streak))}` }]; }
}
