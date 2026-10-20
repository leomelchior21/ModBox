import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { teamCatalog } from './catalog';
import { TEAM_WEATHER } from './worlds';

export type GateOperation = { op: '+' | '-' | '×' | '÷'; value: number };
/** A gate pair spans the runway: left half and right half. An empty side is null. */
export interface TeamGate { at: number; options: [GateOperation | null, GateOperation | null]; used: boolean }
export interface TeamEnemy { at: number; count: number; left: number; boss: boolean; defeated: boolean }
export type HazardKind = 'saw' | 'axe' | 'roller' | 'gap';
/** roller: danger from a to b. gap: rollers on both sides of an opening centred on a, b wide. saw and axe sweep with amplitude a. */
export interface TeamHazard { at: number; kind: HazardKind; a: number; b: number; speed: number; phase: number; hit: boolean }
export interface TeamCourse { name: string; gates: TeamGate[]; enemies: TeamEnemy[]; hazards: TeamHazard[]; goal: number; stepCost: number }
export interface Burst { x: number; z: number; n: number; team: 'blue' | 'red' }

export const START_TEAM = 1, HALF_WIDTH = 3.6, STEPS = 10, STEP_LENGTH = 1.5, STEP_HEIGHT = .42, VISIBLE = 240;
export const gateResult = (count: number, gate: GateOperation | null, bonus = 0) => !gate ? count : clamp(Math.floor(gate.op === '+' ? count + gate.value + bonus : gate.op === '-' ? count - gate.value : gate.op === '×' ? count * gate.value + bonus : count / gate.value), 0, 5000);
export const isPositive = (gate: GateOperation | null) => !!gate && (gate.op === '+' || gate.op === '×');
/** Sunflower packing: runner i of a crowd sits here relative to the crowd centre (z points forward). */
export function formation(i: number, spread: number) { const angle = i * 2.39996, radius = Math.sqrt(i) * spread; return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius }; }
export const SPREAD = .15, SQUEEZED = .075;
/** Danger intervals across the runway for a hazard at a moment in time. */
export function hazardSpans(h: TeamHazard, time: number): [number, number][] {
  if (h.kind === 'roller') return [[h.a, h.b]];
  if (h.kind === 'gap') return [[-HALF_WIDTH - 1, h.a - h.b / 2], [h.a + h.b / 2, HALF_WIDTH + 1]];
  const x = Math.sin(time * h.speed + h.phase) * h.a, half = h.kind === 'saw' ? .6 : .75; return [[x - half, x + half]];
}

export const TEAM_LEVEL_NAMES = ['First Steps', 'Red Means Less', 'Times Two', 'Saw Alley', 'Crowd Clash', 'Split Decision', 'Roller Run', 'Divide and Rule', 'Axe Bridge', 'Glacier Gauntlet',
  'Narrow Escape', 'Lesser Evil', 'Double Trouble', 'Frozen Fortress', 'Squeeze Play', 'Blade Runner', 'Count on It', 'Ice Storm', 'The Long Way', 'Count Master'];
export const teamLevelName = (level: number) => TEAM_LEVEL_NAMES[(level - 1) % TEAM_LEVEL_NAMES.length] + (level > TEAM_LEVEL_NAMES.length ? ` ${Math.ceil(level / TEAM_LEVEL_NAMES.length)}` : '');

function random(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

/** Builds a gate pair for a crowd of c. Returns [better, worse] so the caller can shuffle sides. */
function gatePair(c: number, level: number, rnd: () => number): [GateOperation | null, GateOperation | null] {
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)], big = c > 220, small = Math.max(5, Math.round(c * (.35 + rnd() * .4) / 5) * 5);
  const kinds = ['plusplus', 'plustimes', ...(level >= 2 ? ['goodbad', 'goodbad'] : []), ...(level >= 3 ? ['single'] : []), ...(level >= 5 ? ['timestimes'] : []), ...(level >= 8 ? ['lesser'] : [])];
  const kind = big ? pick(['plusplus', 'goodbad', 'lesser']) : c < 4 ? 'plustimes' : pick(kinds);
  if (kind === 'plusplus') { const a = small + 5 + Math.round(rnd() * 3) * 5, b = Math.max(3, a - 10 - Math.round(rnd() * 2) * 5); return [{ op: '+', value: a }, { op: '+', value: b }]; }
  if (kind === 'plustimes') {
    // The classic lesson: is +k bigger than doubling? It depends on the crowd you have now.
    const times = c < 30 && rnd() < .4 ? 3 : 2, gain = c * (times - 1), k = Math.max(5, Math.round(gain * (rnd() < .5 ? .7 : 1.35) / 5) * 5);
    const plus: GateOperation = { op: '+', value: k }, mult: GateOperation = { op: '×', value: times };
    return gateResult(c, plus) >= gateResult(c, mult) ? [plus, mult] : [mult, plus];
  }
  if (kind === 'goodbad') return [rnd() < .5 && !big ? { op: '×', value: 2 } : { op: '+', value: small + 10 }, rnd() < .5 ? { op: '-', value: Math.max(5, Math.round(c * .4 / 5) * 5) } : { op: '÷', value: 2 }];
  if (kind === 'single') return rnd() < .5 ? [{ op: '+', value: small + 15 }, null] : [null, { op: '-', value: Math.max(5, Math.round(c * .5 / 5) * 5) }];
  if (kind === 'timestimes') return [{ op: '×', value: 3 }, { op: '×', value: 2 }];
  // Both hurt: choose the smaller loss.
  const minus = Math.max(5, Math.round(c * (rnd() < .5 ? .3 : .7) / 5) * 5), half: GateOperation = { op: '÷', value: 2 }, sub: GateOperation = { op: '-', value: minus };
  return gateResult(c, sub) >= gateResult(c, half) ? [sub, half] : [half, sub];
}

/** Twenty-level campaign. Enemy armies and the stair price are sized from the best possible crowd, so smart play always has room. */
export function teamCourse(level: number): TeamCourse {
  // Try a few layouts and keep the first whose best-play crowd peaks in a satisfying range.
  let course = buildCourse(level, 0);
  for (let attempt = 1; attempt < 40 && (course.peak < (level < 3 ? 60 : 110) || course.peak > 1500 || course.stepCost < 2); attempt++) course = buildCourse(level, attempt);
  const { peak: _peak, ...result } = course; return result;
}
function buildCourse(level: number, attempt: number): TeamCourse & { peak: number } {
  const rnd = random(level * 7919 + 13 + attempt * 104729), tier = Math.min(1, (level - 1) / 15), lv = (level - 1) % 20 + 1;
  const gates = 5 + Math.min(5, Math.floor(lv / 2.5)), hazards = lv === 1 ? 0 : Math.min(6, 1 + Math.floor(lv / 3)), enemies = lv === 1 ? 0 : Math.min(3, Math.floor(lv / 4));
  const middle: string[] = [...Array(gates - 2).fill('G'), ...Array(hazards).fill('H'), ...Array(enemies).fill('E')];
  for (let i = middle.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [middle[i], middle[j]] = [middle[j], middle[i]]; }
  // Never start the middle with a fight, and never fight twice in a row.
  for (let i = 0; i < middle.length; i++) if (middle[i] === 'E' && (i === 0 || middle[i - 1] === 'E')) { const swap = middle.findIndex((t, j) => j > i && t === 'G'); if (swap > 0) [middle[i], middle[swap]] = [middle[swap], middle[i]]; }
  const sequence = ['G', 'G', ...middle, 'G', 'E'], spacing = 19 - tier * 3;
  const course: TeamCourse & { peak: number } = { name: teamLevelName(level), gates: [], enemies: [], hazards: [], goal: 0, stepCost: 1, peak: START_TEAM };
  let c = START_TEAM, at = 12; const hazardKinds: HazardKind[] = lv < 4 ? ['roller', 'saw'] : lv < 9 ? ['roller', 'saw', 'gap', 'saw'] : ['saw', 'axe', 'gap', 'roller', 'axe'];
  sequence.forEach((type, index) => {
    if (type === 'G') {
      const [better, worse] = gatePair(c, lv, rnd), swap = rnd() < .5; course.gates.push({ at, options: swap ? [worse, better] : [better, worse], used: false });
      c = Math.max(gateResult(c, better), gateResult(c, worse)); course.peak = Math.max(course.peak, c);
    } else if (type === 'H') {
      const kind = hazardKinds[Math.floor(rnd() * hazardKinds.length)], side = rnd() < .5 ? -1 : 1;
      if (kind === 'roller') course.hazards.push({ at, kind, a: side < 0 ? -HALF_WIDTH - 1 : -.2 + rnd() * .6, b: side < 0 ? .2 - rnd() * .6 : HALF_WIDTH + 1, speed: 0, phase: 0, hit: false });
      else if (kind === 'gap') course.hazards.push({ at, kind, a: (rnd() - .5) * 3, b: 2.6 - tier * .6, speed: 0, phase: 0, hit: false });
      else course.hazards.push({ at, kind, a: 2.6, b: 0, speed: 1.1 + rnd() * .5 + tier * .6, phase: rnd() * Math.PI * 2, hit: false });
      c = Math.round(c * .9);
    } else {
      const boss = index === sequence.length - 1, count = Math.max(boss ? 6 : 3, Math.round(c * (boss ? .45 + tier * .2 : .28 + tier * .2)));
      course.enemies.push({ at, count, left: count, boss, defeated: false }); c -= count;
    }
    at += type === 'E' ? spacing + 4 : spacing;
  });
  course.goal = at; course.stepCost = Math.max(1, Math.floor(c / 8.5));
  return course;
}

export class TeamRun extends ArcadeRun {
  distance = 0; x = 0; targetX = 0; team = START_TEAM; peak = START_TEAM; course = teamCourse(1);
  gates: TeamGate[] = []; enemies: TeamEnemy[] = []; hazards: TeamHazard[] = [];
  state: 'run' | 'clash' | 'finale' = 'run'; clash: TeamEnemy | null = null; squeeze = 0; squeezeCooldown = 0;
  shield = 0; shieldCooldown = 0; invulnerable = 0; victory = 0; climbed = 0; finaleTeam = 0; bursts: Burst[] = [];
  private clashCarry = 0; private dragId: number | null = null; private dragStart = 0; private dragFrom = 0;
  private retry = { distance: 0, team: START_TEAM, score: 0, metrics: structuredClone(this.metrics) };
  /** What cost runners this stage: blades, lost fights and gates where the other side was better. */
  losses = { blades: 0, clashes: 0, badGates: 0 };
  /** Sideways push from the wind this frame (meters per second). */
  gust = 0;
  constructor(checkpoint?: unknown) { super('team-counters', teamCatalog.defaults, teamCatalog.schema, checkpoint); }
  get weather() { return TEAM_WEATHER[this.config.weather ?? 'clear'] ?? TEAM_WEATHER.clear; }
  get goal() { return this.course.goal; }
  get levelName() { return this.course.name; }
  get nextGate() { return this.gates.find(g => !g.used); }
  get spread() { return this.squeeze > 0 ? SQUEEZED : SPREAD; }
  /** Crowd radius in meters, for steering limits and the view. */
  get radius() { return Math.sqrt(Math.min(VISIBLE, this.team)) * this.spread; }
  preview(gate: TeamGate) { return gate.options.map(o => gateResult(this.team, o, isPositive(o) ? this.config.power : 0)); }
  protected setup(): void {
    this.course = teamCourse(this.level); this.gates = this.course.gates; this.enemies = this.course.enemies; this.hazards = this.course.hazards;
    this.distance = 0; this.x = 0; this.targetX = 0; this.team = START_TEAM; this.peak = START_TEAM; this.state = 'run'; this.clash = null; this.squeeze = 0; this.squeezeCooldown = 0;
    this.losses = { blades: 0, clashes: 0, badGates: 0 }; this.gust = 0;
    this.shield = 0; this.shieldCooldown = 0; this.invulnerable = 0; this.victory = 0; this.climbed = 0; this.finaleTeam = 0; this.bursts = []; this.clashCarry = 0; this.dragId = null;
    this.retry = { distance: 0, team: START_TEAM, score: this.score, metrics: structuredClone(this.metrics) };
    this.notice = `${this.levelName.toUpperCase()} · Slide through the best gate, dodge the blades and beat the red army.`;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'left' || action === 'right') { this.targetX = clamp(this.targetX + (action === 'left' ? -.9 : .9), -this.limit, this.limit); this.metrics.actions++; }
    if (action === 'primary' && this.squeezeCooldown <= 0 && this.state !== 'finale') { this.squeeze = 1.6; this.squeezeCooldown = 3.2; this.metrics.actions++; this.cue('ability', 0, 0, 'SQUEEZE!'); this.notice = 'Squeeze! A tight crowd slips past blades and through narrow gaps.'; }
    if (action === 'ability' && this.config.overdrive && this.shieldCooldown <= 0) { this.shield = 6; this.shieldCooldown = 14; this.metrics.actions++; this.cue('ability', 0, 0, 'TEAM SHIELD'); this.notice = 'Together, stronger. One hazard blocked or one battle softened.'; }
  }
  private get limit() { return Math.max(.6, HALF_WIDTH - Math.max(.35, this.radius * .7)); }
  hazardSpans(h: TeamHazard) { return hazardSpans(h, this.elapsed); }
  protected tick(dt: number): void {
    this.squeeze = Math.max(0, this.squeeze - dt); this.squeezeCooldown = Math.max(0, this.squeezeCooldown - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shield = this.config.overdrive ? Math.max(0, this.shield - dt) : 0; this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    if (this.state === 'finale') { this.finale(dt); return; }
    if (this.input.left || this.input.right) this.targetX += (Number(this.input.right) - Number(this.input.left)) * dt * 7;
    this.gust = this.weather.gust * Math.sin(this.elapsed * .55) * (.7 + .3 * Math.sin(this.elapsed * 1.9)); if (this.state === 'run') this.targetX += this.gust * dt;
    this.targetX = clamp(this.targetX, -this.limit, this.limit); this.x += (this.targetX - this.x) * Math.min(1, dt * this.weather.grip);
    if (this.state === 'clash') { this.fight(dt); return; }
    const previous = this.distance; this.distance += dt * this.config.speed * this.weather.speed;
    for (const gate of this.gates) if (!gate.used && previous < gate.at && this.distance >= gate.at) {
      const side = this.x < 0 ? 0 : 1, option = gate.options[side], outcomes = this.preview(gate), before = this.team;
      this.retry = { distance: Math.max(0, gate.at - 8), team: before, score: this.score, metrics: structuredClone(this.metrics) };
      gate.used = true; this.metrics.actions++; if (this.config.assist) this.metrics.assisted++;
      if (!option) { this.notice = 'You went around that gate.'; continue; }
      // A gate can shrink the crowd but never empty it: the leader always walks through.
      this.team = Math.max(1, outcomes[side]); this.peak = Math.max(this.peak, this.team);
      const smart = outcomes[side] >= outcomes[1 - side]; if (smart) this.metrics.perfects++; else this.losses.badGates++;
      if (this.team > before) this.addScore(this.team - before, 0, 0, `${option.op}${option.value} → ${this.team}${smart ? '!' : ''}`); else this.cue('lose', 0, 0, `${option.op}${option.value} → ${this.team}`);
      this.notice = `${option.op}${option.value}: ${before} became ${this.team}.`;
    }
    for (const hazard of this.hazards) if (!hazard.hit && previous < hazard.at && this.distance >= hazard.at) { hazard.hit = true; this.crossHazard(hazard); if (this.team <= 0) { this.recover('The blades got everyone. Rally at the last gate.'); return; } }
    for (const enemy of this.enemies) if (!enemy.defeated && this.distance >= enemy.at - 2) { this.distance = enemy.at - 2; this.state = 'clash'; this.clash = enemy; this.clashCarry = 0; this.notice = `CLASH! ${this.team} against ${enemy.left}. One for one.`; this.cue('hit', 0, 0, 'CLASH!'); return; }
    if (this.distance >= this.goal) { this.distance = this.goal; this.state = 'finale'; this.finaleTeam = this.team; this.x = this.targetX = 0; this.notice = 'The victory stairs! Every step costs runners. How high can you climb?'; }
  }
  /** Each runner checks the danger zone at the moment its own row crosses the hazard. */
  private crossHazard(h: TeamHazard): void {
    const visible = Math.min(VISIBLE, this.team), speed = Math.max(.5, this.config.speed); let hits = 0, hx = 0;
    for (let i = 0; i < visible; i++) {
      const o = formation(i, this.spread), x = this.x + o.x, spans = hazardSpans(h, this.elapsed - o.z / speed);
      if (spans.some(([a, b]) => x > a && x < b)) { hits++; hx += x; }
    }
    if (!hits) { this.cue('perfect', 0, 0, 'CLEAN!'); this.metrics.perfects++; return; }
    if (this.shield > 0) { this.shield = 0; this.metrics.assisted++; this.cue('ability', 0, 0, 'SHIELDED'); this.notice = 'Shield save. Every runner counts.'; return; }
    const lost = Math.min(this.team, Math.ceil(hits * this.team / visible)); this.team -= lost; this.losses.blades += lost; this.bursts.push({ x: hx / hits, z: h.at, n: Math.min(30, lost), team: 'blue' });
    this.cue('lose', 0, 0, `−${lost}`); this.notice = h.kind === 'gap' ? 'Too wide for the gap. Squeeze with Space before narrow spots.' : `Lost ${lost} runners. Steer clear, or squeeze to make your crowd smaller.`;
  }
  private fight(dt: number): void {
    const enemy = this.clash!; this.clashCarry += (12 + Math.min(this.team, enemy.left) * 2.2) * dt; let lost = 0, killed = 0;
    while (this.clashCarry >= 1 && this.team > 0 && enemy.left > 0) { this.clashCarry--; enemy.left--; killed++; if (this.shield > 0 && killed % 2 === 0) continue; this.team--; lost++; }
    if (killed) this.bursts.push({ x: this.x, z: enemy.at - 1, n: Math.min(6, killed), team: 'red' });
    if (lost) this.bursts.push({ x: this.x, z: enemy.at - 2.4, n: Math.min(6, lost), team: 'blue' });
    if (enemy.left <= 0) {
      enemy.defeated = true; this.state = 'run'; this.clash = null; if (this.shield > 0) { this.shield = 0; this.metrics.assisted++; }
      this.metrics.perfects++; this.addScore(this.config.bonus * (enemy.boss ? 4 : 1), 0, 0, enemy.boss ? 'ARMY BEATEN!' : 'CLASH WON'); this.notice = `Clash won. ${this.team} runners still standing.`;
    } else if (this.team <= 0) { this.losses.clashes++; this.recover(`${enemy.count} rivals were too many. Pick bigger gates before a fight.`); }
  }
  private finale(dt: number): void {
    this.distance += dt * Math.max(3, this.config.speed * .7); const reach = Math.floor((this.distance - this.goal) / STEP_LENGTH) + 1;
    while (this.climbed < Math.min(STEPS, reach)) {
      if (this.team - this.course.stepCost < 1) break;
      this.team -= this.course.stepCost; this.climbed++; this.victory = this.climbed; this.cue('score', 0, 0);
    }
    const stuck = this.climbed < STEPS && this.climbed < reach;
    if (this.climbed >= STEPS || stuck) {
      this.distance = this.goal + Math.max(0, this.climbed - .5) * STEP_LENGTH; this.victory = Math.max(1, this.climbed);
      this.addScore(this.finaleTeam * this.victory, 0, 0, `VICTORY ×${this.victory}`); this.clear(0, 0);
    }
  }
  private recover(message: string): void {
    if (this.invulnerable > 0) { this.team = Math.max(1, this.team); return; }
    this.lose(0, 0, message); this.state = 'run'; this.clash = null;
    if (this.phase === 'playing') {
      // Rewind to before the last choice so a losing route is recoverable.
      this.distance = this.retry.distance; this.team = this.retry.team; this.score = this.retry.score; this.metrics = structuredClone(this.retry.metrics);
      for (const gate of this.gates) gate.used = gate.at < this.distance;
      for (const enemy of this.enemies) { enemy.defeated = enemy.at < this.distance; if (!enemy.defeated) enemy.left = enemy.count; }
      for (const hazard of this.hazards) hazard.hit = hazard.at < this.distance;
      this.invulnerable = 1; this.x = 0; this.targetX = 0;
    }
  }
  /** Relative drag: the crowd follows the finger from wherever it touched down. */
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, _y: number, pointerId = 0): void {
    if (phase === 'cancel') { this.dragId = null; return; }
    if (this.phase !== 'playing') return;
    if (phase === 'down' && this.dragId === null) { this.dragId = pointerId; this.dragStart = x; this.dragFrom = this.targetX; this.metrics.actions++; }
    if (this.dragId !== pointerId) return;
    this.targetX = clamp(this.dragFrom + (x - this.dragStart) / 1000 * 11, -this.limit, this.limit);
    if (phase === 'up') this.dragId = null;
  }
  protected runtime() { return { distance: Math.floor(this.distance), team: this.team, gates: this.gates.filter(g => g.used).length }; }
  protected stageSummary() { return { team: this.team, peak: this.peak, victory: this.victory, lives: this.lives, finale: this.finaleTeam }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) {
    this.victory = clamp(Math.floor(summary.victory ?? 1), 1, STEPS); this.climbed = this.victory; this.distance = this.goal + (this.victory - .5) * STEP_LENGTH; this.state = 'finale';
    this.team = clamp(Math.floor(summary.team ?? START_TEAM), 0, 5000); this.peak = Math.max(this.team, summary.peak ?? this.team); this.lives = Math.floor(summary.lives ?? this.config.lives); this.finaleTeam = clamp(Math.floor(summary.finale ?? this.team), 0, 5000);
    this.gates.forEach(g => { g.used = true; }); this.enemies.forEach(e => { e.defeated = true; e.left = 0; }); this.hazards.forEach(h => { h.hit = true; });
  }
  stats() { return [{ label: 'YOUR CROWD', value: this.team }, { label: 'BIGGEST CROWD', value: this.peak }, { label: 'MULTIPLIER', value: this.victory }]; }
}
