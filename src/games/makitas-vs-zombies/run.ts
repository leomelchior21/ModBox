import type { ProgramResult } from '../../interpreter/core/types';
import { evaluateGameScript } from '../../interpreter/gameScript';
import { evalExpr } from '../../interpreter/core/evaluate';
import { renderText } from '../../interpreter/csharp/binder';
import { YARD_DEFAULTS, YARD_MODS, yardSchema, type YardConfig } from './mods';
import { YARD_LEVELS, yardLevel, yardLevelName, yardToughness, type UnitKind, type YardLevel, type ZombieKind } from './levels';

export type { UnitKind, ZombieKind };
export const ROWS = 5, COLS = 9;
export const UNIT_INFO: Record<UnitKind, { name: string; short: string; cost: number; recharge: number; detail: string }> = {
  saw: { name: 'SAW SHOOTER', short: 'SAW', cost: 100, recharge: 7.5, detail: 'Fires spinning saw blades down its lane.' },
  charger: { name: 'BATTERY CHARGER', short: 'CHARGER', cost: 50, recharge: 7.5, detail: 'Makes a 25-power battery every 10 seconds.' },
  wall: { name: 'TOOLBOX WALL', short: 'TOOLBOX', cost: 50, recharge: 25, detail: 'A heavy steel box zombies must chew through.' },
  mine: { name: 'NAIL MINE', short: 'MINE', cost: 25, recharge: 25, detail: 'Arms in 12 seconds, then blasts the first zombie on it.' },
  frost: { name: 'FROST SAW', short: 'FROST', cost: 175, recharge: 7.5, detail: 'Icy blades that slow zombies to half speed.' },
  chainsaw: { name: 'CHAINSAW', short: 'CHAINSAW', cost: 150, recharge: 7.5, detail: 'Cuts down the zombie right in front, then cools down.' },
  twin: { name: 'TWIN SAW', short: 'TWIN', cost: 200, recharge: 7.5, detail: 'Fires two blades every shot.' },
};
export const ZOMBIE_INFO: Record<ZombieKind, { name: string; hp: number; speed: number; bite: number; points: number }> = {
  worker: { name: 'WORKER', hp: 190, speed: .22, bite: 50, points: 50 },
  flag: { name: 'FLAG BEARER', hp: 190, speed: .3, bite: 50, points: 50 },
  hardhat: { name: 'HARD HAT', hp: 560, speed: .22, bite: 50, points: 100 },
  runner: { name: 'RUNNER', hp: 335, speed: .45, bite: 50, points: 75 },
  welder: { name: 'WELDER', hp: 1000, speed: .2, bite: 60, points: 150 },
  brute: { name: 'BRUTE', hp: 2200, speed: .15, bite: 0, points: 400 },
};
const BLADE_SPEED = 5.5, SAW_INTERVAL = 1.3, CHARGER_INTERVAL = 10, MINE_ARM = 12, MINE_DAMAGE = 1800, CHAINSAW_REST = 20, SKY_INTERVAL = 6;
export interface Defender { id: number; kind: UnitKind; row: number; col: number; hp: number; maxHp: number; timer: number; flash: number; armed: number; busy: number }
export interface Zombie { id: number; kind: ZombieKind; row: number; x: number; hp: number; maxHp: number; slowed: number; flash: number; eating: boolean; smash: number }
export interface Blade { id: number; row: number; x: number; damage: number; frost: boolean }
export interface Battery { id: number; row: number; x: number; y: number; value: number; age: number; sky: boolean }
export interface Sweeper { row: number; x: number; state: 'ready' | 'running' | 'used' }
export type YardPhase = 'launch' | 'playing' | 'paused' | 'cleared' | 'gameover';
export type YardEvent = 'place' | 'shoot' | 'hit' | 'kill' | 'charge' | 'wave' | 'breach' | 'clear' | 'error' | 'sweep' | 'boom' | 'chomp' | 'shovel';
export interface YardCue { kind: YardEvent; row: number; x: number; text?: string }
export interface YardMetrics { placed: number; collected: number; kills: number; walls: number; shots: number; clears: number; ruleTraces: string[] }
export interface YardCard { kind: UnitKind; cost: number; ready: number; affordable: boolean }
export interface YardSnapshot {
  phase: YardPhase; config: YardConfig; power: number; score: number; level: number; levelName: string; tip: string; wave: number; waves: number;
  progress: number; flags: number[]; cards: YardCard[]; banner: string; bannerId: number; reward: UnitKind | null; night: boolean; lanes: readonly number[];
  metrics: YardMetrics; messages: string[]; notice: string; noticeKind: YardEvent; noticeId: number; sweepersLeft: number;
}
export interface YardCheckpoint { version: 2; level: number; best: number; score: number; metrics: YardMetrics }
const freshMetrics = (): YardMetrics => ({ placed: 0, collected: 0, kills: 0, walls: 0, shots: 0, clears: 0, ruleTraces: [] });

/** Validate persisted progress before it enters the simulation. Older saves start a fresh campaign. */
export function readYardCheckpoint(value: unknown): YardCheckpoint | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as YardCheckpoint, count = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
  if (c.version !== 2 || !count(c.level, 999) || c.level < 1 || !count(c.best ?? c.level, 999) || !count(c.score, 1e9) || !c.metrics) return null;
  for (const key of ['placed', 'collected', 'kills', 'walls', 'shots', 'clears'] as const) if (!count(c.metrics[key], 1e9)) return null;
  if (!Array.isArray(c.metrics.ruleTraces) || c.metrics.ruleTraces.length > 1000 || c.metrics.ruleTraces.some(t => typeof t !== 'string')) return null;
  return { ...structuredClone(c), best: Math.max(c.level, c.best ?? c.level) };
}

/** Pure, deterministic lane defense; the screen owns clocks, input and rendering. */
export class YardRun {
  phase: YardPhase = 'launch'; config = { ...YARD_DEFAULTS };
  level = 1; score = 0; power = YARD_DEFAULTS.startingPower; elapsed = 0; wave = 0;
  units: Defender[] = []; zombies: Zombie[] = []; blades: Blade[] = []; batteries: Battery[] = []; sweepers: Sweeper[] = [];
  cooldowns: Partial<Record<UnitKind, number>> = {};
  metrics = freshMetrics(); messages: string[] = ['Protect the workshop. Every lane needs a saw.'];
  feedback: YardCue[] = []; events: YardEvent[] = []; revision = 0;
  notice = 'Pick a tool card, then tap a tile in an open lane.'; noticeKind: YardEvent = 'place'; noticeId = 0; banner = ''; bannerId = 0;
  checkpoint: YardCheckpoint | null = null; checkpointRevision = 0;
  private program: ProgramResult<YardConfig> | null = null; private base = { ...YARD_DEFAULTS }; private activeRules = new Set<string>();
  private nextId = 1; private skyTimer = 4; private waveClock = 0; private queue: { kind: ZombieKind; at: number; row: number }[] = []; private seed = 1; private spawned = 0;
  constructor(checkpoint?: unknown) { this.checkpoint = readYardCheckpoint(checkpoint); if (this.checkpoint) { this.level = this.checkpoint.level; this.score = this.checkpoint.score; this.metrics = structuredClone(this.checkpoint.metrics); } }
  get stage(): YardLevel { return yardLevel(this.level); }
  get totalZombies(): number { return this.stage.waves.reduce((sum, w) => sum + w.zombies.length, 0); }
  get remaining(): number { return this.totalZombies - this.spawned + this.zombies.length; }
  setProgram(program: ProgramResult<YardConfig>): void {
    if (!program.ok) return;
    this.program = program; this.base = { ...YARD_DEFAULTS, ...program.config }; this.evaluate();
    this.messages = [...program.comms.map(c => c.text), ...this.messages].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  }
  /** Starts (or retries) the saved level from scratch. */
  launch(): void {
    if (this.checkpoint) { this.level = this.checkpoint.level; this.score = this.checkpoint.score; this.metrics = structuredClone(this.checkpoint.metrics); }
    this.begin();
  }
  advance(): void { if (this.phase === 'cleared') { this.level++; this.begin(); } }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
  resume(): void { if (this.phase === 'paused') this.phase = 'playing'; }
  private begin(): void {
    this.evaluate(); this.config = { ...this.base }; this.evaluate();
    this.power = this.config.startingPower + (this.stage.night ? 150 : 0); this.elapsed = 0; this.wave = 0; this.waveClock = 0; this.spawned = 0; this.queue = []; this.seed = this.level * 9301 + 49297;
    this.units = []; this.zombies = []; this.blades = []; this.batteries = []; this.feedback = []; this.events = []; this.activeRules.clear();
    this.sweepers = this.stage.lanes.map(row => ({ row, x: -.35, state: 'ready' as const }));
    this.cooldowns = { wall: UNIT_INFO.wall.recharge * .5, mine: UNIT_INFO.mine.recharge * .5 };
    this.skyTimer = 4; this.revision++; this.phase = 'playing';
    this.saveCheckpoint(this.level);
    this.show(`LEVEL ${this.level} · ${yardLevelName(this.level).toUpperCase()}`); this.announce('place', this.stage.tip);
  }
  private saveCheckpoint(level: number): void { this.checkpoint = { version: 2, level, best: Math.max(level, this.checkpoint?.best ?? 1), score: this.score, metrics: structuredClone(this.metrics) }; this.checkpointRevision++; }
  /** Highest level reached; any level up to it can be replayed. */
  get frontier(): number { return Math.max(this.level, this.checkpoint?.best ?? 1); }
  playLevel(level: number): boolean { if (!Number.isInteger(level) || level < 1 || level > this.frontier) return false; this.level = level; this.begin(); return true; }
  available(kind: UnitKind): boolean { return this.stage.cards.includes(kind); }
  cardReady(kind: UnitKind): number { return 1 - (this.cooldowns[kind] ?? 0) / UNIT_INFO[kind].recharge; }
  canPlace(kind: UnitKind, row: number, col: number): boolean {
    return this.phase === 'playing' && this.available(kind) && this.stage.lanes.includes(row) && col >= 0 && col < COLS && Number.isInteger(col)
      && !this.units.some(u => u.row === row && u.col === col) && this.power >= UNIT_INFO[kind].cost && (this.cooldowns[kind] ?? 0) <= 0;
  }
  place(kind: UnitKind, row: number, col: number): boolean {
    if (this.phase !== 'playing') return false;
    const info = UNIT_INFO[kind];
    if (!this.available(kind)) return this.fail(row, col, `${info.name} unlocks in a later level.`);
    if (!Number.isInteger(row) || !Number.isInteger(col) || !this.stage.lanes.includes(row) || col < 0 || col >= COLS) return this.fail(row, col, 'That lane is closed. Build on the grass.');
    if (this.units.some(u => u.row === row && u.col === col)) return this.fail(row, col, 'Tile taken. Use the shovel to clear it first.');
    if ((this.cooldowns[kind] ?? 0) > 0) return this.fail(row, col, `${info.short} is recharging.`);
    if (this.power < info.cost) return this.fail(row, col, `Not enough power. ${info.name} costs ${info.cost}.`);
    this.power -= info.cost; this.cooldowns[kind] = info.recharge * (this.config.quickHands ? .5 : 1);
    const hp = kind === 'wall' ? this.config.wallHealth : 300;
    this.units.push({ id: this.nextId++, kind, row, col, hp, maxHp: hp, timer: kind === 'charger' ? 5 : .2, flash: 0, armed: 0, busy: 0 });
    this.metrics.placed++; if (kind === 'wall') this.metrics.walls++;
    this.cue('place', row, col + .5); this.announce('place', `${info.name} placed. ${this.power} power left.`); this.evaluate(); return true;
  }
  shovel(row: number, col: number): boolean {
    if (this.phase !== 'playing') return false;
    const unit = this.units.find(u => u.row === row && u.col === col); if (!unit) return this.fail(row, col, 'Nothing to dig up here.');
    this.units = this.units.filter(u => u !== unit); this.cue('shovel', row, col + .5); this.announce('place', `${UNIT_INFO[unit.kind].name} removed.`); return true;
  }
  collect(id: number): boolean {
    if (this.phase !== 'playing') return false;
    const drop = this.batteries.find(b => b.id === id); if (!drop) return false;
    this.power += drop.value; this.metrics.collected += drop.value; this.batteries = this.batteries.filter(b => b !== drop);
    this.cue('charge', drop.row, drop.x, `+${drop.value}`); this.evaluate(); return true;
  }
  collectAll(): void { for (const b of [...this.batteries]) this.collect(b.id); }
  step(dt: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    let left = Math.min(dt, .1); this.evaluate();
    while (left > 1e-9 && this.phase === 'playing') { const slice = Math.min(left, 1 / 60); this.tick(slice); left -= slice; }
    this.evaluate();
  }
  private random(): number { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  private tick(dt: number): void {
    const stage = this.stage, speedScale = this.config.zombieSpeed / 3;
    this.elapsed += dt;
    for (const kind of Object.keys(this.cooldowns) as UnitKind[]) this.cooldowns[kind] = Math.max(0, (this.cooldowns[kind] ?? 0) - dt * (this.config.quickHands ? 2 : 1));
    // Waves arrive on schedule, and sooner when the yard is already clear.
    this.waveClock += dt * (this.wave > 0 && !this.zombies.length && !this.queue.length ? 1.6 : 1);
    while (this.wave < stage.waves.length && this.waveClock >= stage.waves[this.wave].at) {
      const next = stage.waves[this.wave++], last = this.wave === stage.waves.length;
      next.zombies.forEach((kind, i) => this.queue.push({ kind, at: this.elapsed + i * (next.huge ? .55 : 1.6), row: kind === 'flag' ? stage.lanes[Math.floor(stage.lanes.length / 2)] : stage.lanes[Math.floor(this.random() * stage.lanes.length)] }));
      if (next.huge) { this.show(last ? 'FINAL WAVE!' : 'A HUGE WAVE IS COMING!'); this.cue('wave', 2, 4.5); }
    }
    for (const q of this.queue.filter(q => q.at <= this.elapsed)) {
      const info = ZOMBIE_INFO[q.kind], hp = Math.round(info.hp * yardToughness(this.level));
      this.zombies.push({ id: this.nextId++, kind: q.kind, row: q.row, x: COLS + .45 + this.random() * .3, hp, maxHp: hp, slowed: 0, flash: 0, eating: false, smash: 0 }); this.spawned++;
    }
    this.queue = this.queue.filter(q => q.at > this.elapsed);
    // Power: batteries drift down from the sky by day.
    if (!stage.night) {
      this.skyTimer -= dt;
      if (this.skyTimer <= 0) { this.skyTimer += SKY_INTERVAL; this.drop(stage.lanes[Math.floor(this.random() * stage.lanes.length)], 1 + this.random() * 7, 5.5, this.config.chargeRate * 5, true); }
    }
    for (const b of this.batteries) { if (b.y > 0) b.y = Math.max(0, b.y - dt * (b.sky ? 1.3 : 3)); else b.age += dt; }
    this.batteries = this.batteries.filter(b => b.age < 9);
    if (this.config.autoCollect) this.collectAll();
    for (const u of this.units) this.operate(u, dt);
    for (const blade of this.blades) {
      const old = blade.x; blade.x += dt * BLADE_SPEED;
      const victim = this.zombies.filter(z => z.hp > 0 && z.row === blade.row && z.x + .3 >= old && z.x - .3 <= blade.x).sort((a, b) => a.x - b.x)[0];
      if (victim) { this.hurt(victim, blade.damage); if (blade.frost) victim.slowed = 4; blade.x = COLS + 5; this.cue('hit', victim.row, victim.x); }
    }
    this.blades = this.blades.filter(b => b.x < COLS + 1);
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      const info = ZOMBIE_INFO[z.kind], slow = z.slowed > 0 ? .5 : 1;
      z.slowed = Math.max(0, z.slowed - dt); z.flash = Math.max(0, z.flash - dt);
      const target = this.units.filter(u => u.hp > 0 && u.kind !== 'mine' && u.row === z.row && u.col + .5 <= z.x - .05 && u.col + .5 >= z.x - .62).sort((a, b) => b.col - a.col)[0];
      z.eating = Boolean(target);
      if (target) {
        if (z.kind === 'brute') { z.smash += dt * slow; if (z.smash >= 1.8) { target.hp = 0; z.smash = 0; this.cue('breach', target.row, target.col + .5, 'SMASH!'); this.announce('breach', `A brute smashed your ${UNIT_INFO[target.kind].name}.`); } }
        else { target.hp -= info.bite * slow * dt; target.flash = .12; if (target.hp <= 0) this.announce('breach', `${UNIT_INFO[target.kind].name} lost in lane ${target.row + 1}.`); }
      } else { z.smash = 0; z.x -= info.speed * speedScale * slow * dt; }
      const sweep = this.sweepers.find(s => s.row === z.row);
      if (sweep?.state === 'ready' && z.x < .2) { sweep.state = 'running'; sweep.x = -.35; this.cue('sweep', z.row, 0); this.show('LANE SWEEPER!'); this.announce('sweep', `Lane ${z.row + 1} sweeper launched! It only works once.`); }
      if (z.x < -.55 && sweep?.state !== 'running') { this.phase = 'gameover'; this.cue('breach', z.row, 0); this.show('THE ZOMBIES GOT IN!'); this.announce('breach', 'A zombie reached the workshop. Retry the level with stronger lanes.'); return; }
    }
    for (const sweep of this.sweepers) {
      if (sweep.state !== 'running') continue;
      sweep.x += 4.5 * dt;
      for (const z of this.zombies) if (z.hp > 0 && z.row === sweep.row && z.x < sweep.x + .35) this.hurt(z, 1e6);
      if (sweep.x > COLS + .8) sweep.state = 'used';
    }
    this.units = this.units.filter(u => u.hp > 0); this.zombies = this.zombies.filter(z => z.hp > 0);
    if (this.wave >= stage.waves.length && !this.queue.length && !this.zombies.length) this.win();
  }
  private operate(u: Defender, dt: number): void {
    u.flash = Math.max(0, u.flash - dt); u.timer = Math.max(0, u.timer - dt);
    if (u.kind === 'charger') { if (u.timer <= 0) { this.drop(u.row, u.col + .5, .01, 25, false); u.timer = CHARGER_INTERVAL; this.cue('charge', u.row, u.col + .5); } return; }
    if (u.kind === 'wall') return;
    if (u.kind === 'mine') {
      u.armed = Math.min(1, u.armed + dt / MINE_ARM);
      if (u.armed >= 1 && this.zombies.some(z => z.hp > 0 && z.row === u.row && Math.abs(z.x - u.col - .5) < .55)) {
        for (const z of this.zombies) if (z.hp > 0 && z.row === u.row && Math.abs(z.x - u.col - .5) < 1) this.hurt(z, MINE_DAMAGE);
        u.hp = 0; this.cue('boom', u.row, u.col + .5, 'BOOM!');
      }
      return;
    }
    if (u.kind === 'chainsaw') {
      u.busy = Math.max(0, u.busy - dt); if (u.busy > 0) return;
      const victim = this.zombies.filter(z => z.hp > 0 && z.row === u.row && z.x > u.col + .3 && z.x < u.col + 1.75).sort((a, b) => a.x - b.x)[0];
      if (victim) { this.hurt(victim, victim.kind === 'brute' ? 1000 : 1e6); u.busy = CHAINSAW_REST; u.flash = .3; this.cue('chomp', u.row, victim.x, 'RIIIP!'); }
      return;
    }
    if (u.timer > 0 || !this.zombies.some(z => z.hp > 0 && z.row === u.row && z.x > u.col + .3 && z.x < COLS + .2)) return;
    const count = (u.kind === 'twin' ? 2 : 1) * (this.config.doubleShot ? 2 : 1), frost = u.kind === 'frost';
    for (let i = 0; i < count; i++) this.blades.push({ id: this.nextId++, row: u.row, x: u.col + .8 - i * .28, damage: this.config.bladeDamage, frost });
    this.metrics.shots += count; u.flash = .14; u.timer = SAW_INTERVAL / (this.config.overdrive ? 1.4 : 1); this.cue('shoot', u.row, u.col + .8);
  }
  private hurt(z: Zombie, damage: number): void {
    if (z.hp <= 0) return;
    z.hp -= damage; z.flash = .12;
    if (z.hp <= 0) { const points = ZOMBIE_INFO[z.kind].points; this.score += points; this.metrics.kills++; this.cue('kill', z.row, z.x, `+${points}`); }
  }
  private win(): void {
    const sweepers = this.sweepers.filter(s => s.state === 'ready').length, bonus = 500 + sweepers * 100;
    this.score += bonus; this.metrics.clears++; this.phase = 'cleared'; this.cue('clear', 2, 4.5, `+${bonus}`);
    this.show('YARD SECURED!'); this.announce('clear', this.stage.reward ? `Level clear! New tool unlocked: ${UNIT_INFO[this.stage.reward].name}.` : 'Level clear! The workshop survives another shift.');
    this.saveCheckpoint(this.level + 1);
  }
  private drop(row: number, x: number, y: number, value: number, sky: boolean): void { if (this.batteries.length < 24) this.batteries.push({ id: this.nextId++, row, x, y, value, age: 0, sky }); }
  private fail(row: number, col: number, text: string): false { this.cue('error', row, col + .5); this.announce('error', text); return false; }
  private announce(kind: YardEvent, text: string): void { this.notice = text; this.noticeKind = kind; this.noticeId++; }
  private show(text: string): void { this.banner = text; this.bannerId++; }
  private cue(kind: YardEvent, row: number, x: number, text?: string): void { this.feedback.push({ kind, row, x, text }); this.events.push(kind); this.feedback = this.feedback.slice(-80); this.events = this.events.slice(-80); }
  snapshot(): YardSnapshot {
    const stage = this.stage, total = this.totalZombies;
    let count = 0; const flags = stage.waves.map(w => { count += w.zombies.length; return w.huge ? count / total : -1; }).filter(f => f >= 0);
    return {
      phase: this.phase, config: { ...this.config }, power: this.power, score: this.score, level: this.level, levelName: yardLevelName(this.level), tip: stage.tip,
      wave: this.wave, waves: stage.waves.length, progress: total ? this.spawned / total : 0, flags,
      cards: stage.cards.map(kind => ({ kind, cost: UNIT_INFO[kind].cost, ready: this.cardReady(kind), affordable: this.power >= UNIT_INFO[kind].cost })),
      banner: this.banner, bannerId: this.bannerId, reward: stage.reward ?? null, night: Boolean(stage.night), lanes: stage.lanes,
      metrics: { ...this.metrics, ruleTraces: [...this.metrics.ruleTraces] }, messages: [...this.messages], notice: this.notice, noticeKind: this.noticeKind, noticeId: this.noticeId,
      sweepersLeft: this.sweepers.filter(s => s.state === 'ready').length,
    };
  }
  private evaluate(): void {
    if (!this.program) return;
    const runtime = { score: this.score, power: this.power, wave: this.wave, kills: this.metrics.kills, placed: this.metrics.placed, level: this.level };
    const { config, frame } = evaluateGameScript(this.program, this.base, runtime, yardSchema); this.config = config;
    for (const trace of frame.traces) {
      if (!this.metrics.ruleTraces.includes(trace.text)) this.metrics.ruleTraces = [...this.metrics.ruleTraces, trace.text].slice(-200);
      if (this.activeRules.has(trace.ruleId)) continue;
      this.messages = [`RULE LIVE · ${trace.text}`, ...this.messages].slice(0, 3);
      for (const write of trace.writes) {
        const value = evalExpr(write.arg, { runtime, modValues: Object.fromEntries(YARD_MODS.map(m => [m.name, this.base[m.id]])), constants: Object.fromEntries(this.program.symbols.filter(s => s.userOnly).map(s => [s.name, s.value])) });
        if (value.ok) this.messages = [renderText(value.value), ...this.messages].slice(0, 3);
      }
    }
    this.activeRules = new Set(frame.activeRuleIds);
  }
}
export { YARD_LEVELS };
