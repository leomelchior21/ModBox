import type { ProgramResult } from '../../interpreter/core/types';
import { evaluateGameScript } from '../../interpreter/gameScript';
import { evalExpr } from '../../interpreter/core/evaluate';
import { renderText } from '../../interpreter/csharp/binder';
import { YARD_DEFAULTS, YARD_MODS, yardSchema, type YardConfig } from './mods';

export const ROWS = 5, COLS = 9, WAVES = 3;
export type UnitKind = 'saw' | 'charger' | 'wall' | 'frost';
export type YardTool = UnitKind | 'upgrade' | 'recycle';
export const UNIT_INFO = {
  saw: { name: 'CIRCULAR SAW', cost: 100, detail: 'Shoots spinning blades', hp: 180, cooldown: 1.2, sprite: 0 },
  charger: { name: 'BATTERY BANK', cost: 50, detail: '+25 power every 8s', hp: 140, cooldown: 8, sprite: 1 },
  wall: { name: 'BARRICADE', cost: 75, detail: 'Stops hungry zombies', hp: 450, cooldown: 0, sprite: 2 },
  frost: { name: 'FROST SAW', cost: 150, detail: 'Slows zombies by 55%', hp: 180, cooldown: 1.6, sprite: 3 },
} as const;
export type ZombieKind = 'worker' | 'hardhat' | 'sprinter' | 'brute';
export const ZOMBIE_INFO = {
  worker: { hp: 65, speed: 0.115, bite: 22, sprite: 4 },
  hardhat: { hp: 145, speed: 0.1, bite: 25, sprite: 5 },
  sprinter: { hp: 60, speed: 0.21, bite: 18, sprite: 6 },
  brute: { hp: 360, speed: 0.075, bite: 50, sprite: 7 },
} as const;
export interface Defender { id: number; kind: UnitKind; row: number; col: number; hp: number; maxHp: number; level: number; timer: number; flash: number; invested: number }
export interface Zombie { id: number; kind: ZombieKind; row: number; x: number; hp: number; maxHp: number; slowed: number; flash: number; biteTimer: number; chewing: boolean }
export interface Blade { id: number; row: number; x: number; damage: number; frost: boolean }
export interface Battery { id: number; row: number; x: number; value: number; age: number }
export interface Sweeper { row: number; x: number; active: boolean; used: boolean }
export type YardPhase = 'launch' | 'playing' | 'paused' | 'cleared' | 'gameover';
export type YardEvent = 'place' | 'shoot' | 'hit' | 'kill' | 'charge' | 'wave' | 'breach' | 'upgrade' | 'clear' | 'error' | 'sweep';
export interface YardCue { kind: YardEvent; row: number; x: number; text?: string }
export interface YardMetrics { placed: number; collected: number; kills: number; upgrades: number; slowed: number; clears: number; shots: number; ruleTraces: string[] }
const freshMetrics = (): YardMetrics => ({ placed: 0, collected: 0, kills: 0, upgrades: 0, slowed: 0, clears: 0, shots: 0, ruleTraces: [] });
export interface YardSnapshot {
  phase: YardPhase; config: YardConfig; power: number; score: number; lives: number; wave: number; night: number;
  countdown: number; spawning: boolean; remaining: number; batteries: number; deployed: number;
  metrics: YardMetrics; messages: string[]; notice: string; noticeKind: YardEvent; noticeId: number;
}

/** Pure, deterministic lane simulation; only the screen owns clocks and input. */
export class YardRun {
  phase: YardPhase = 'launch'; config = { ...YARD_DEFAULTS };
  power = YARD_DEFAULTS.startingPower; score = 0; lives = 3; wave = 0; night = 1; elapsed = 0;
  countdown = 15; spawning = false; spawnIndex = 0; spawnTotal = 0; spawnTimer = 0;
  units: Defender[] = []; zombies: Zombie[] = []; blades: Blade[] = []; batteries: Battery[] = [];
  sweepers: Sweeper[] = Array.from({ length: ROWS }, (_, row) => ({ row, x: -0.4, active: false, used: false }));
  metrics = freshMetrics(); messages = ['Protect the workshop. Chargers fund your defense.'];
  feedback: YardCue[] = []; events: YardEvent[] = []; revision = 0;
  notice = 'Select a tool, then tap an empty lawn tile.'; noticeKind: YardEvent = 'place'; noticeId = 0;
  private program: ProgramResult<YardConfig> | null = null;
  private base = { ...YARD_DEFAULTS }; private activeRules = new Set<string>();
  private nextId = 1; private skyTimer = 3;
  setProgram(program: ProgramResult<YardConfig>): void {
    if (!program.ok) return;
    this.program = program; this.base = { ...YARD_DEFAULTS, ...program.config }; this.evaluate();
    this.messages = [...program.comms.map(c => c.text), ...this.messages].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  }
  launch(): void {
    this.night = 1; this.score = 0; this.metrics = freshMetrics(); this.reset();
  }
  private reset(): void {
    this.config = { ...this.base }; this.power = this.config.startingPower; this.lives = 3;
    this.wave = 0; this.elapsed = 0; this.countdown = 15; this.spawning = false; this.spawnIndex = 0; this.spawnTotal = 0; this.spawnTimer = 0;
    this.units = []; this.zombies = []; this.blades = []; this.batteries = []; this.feedback = []; this.events = [];
    this.sweepers = Array.from({ length: ROWS }, (_, row) => ({ row, x: -0.4, active: false, used: false }));
    this.skyTimer = 3; this.activeRules.clear(); this.revision++; this.phase = 'playing'; this.evaluate();
    this.announce('place', 'Build your defense. First invasion arrives in 15 seconds.');
  }
  advance(): void { if (this.phase === 'cleared') { this.night++; this.reset(); } }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
  resume(): void { if (this.phase === 'paused') this.phase = 'playing'; }
  snapshot(): YardSnapshot {
    return { phase: this.phase, config: { ...this.config }, power: this.power, score: this.score, lives: this.lives, wave: this.wave, night: this.night,
      countdown: Math.ceil(this.countdown), spawning: this.spawning, remaining: this.zombies.length + (this.spawning ? this.spawnTotal - this.spawnIndex : 0),
      batteries: this.batteries.length, deployed: this.units.length, metrics: { ...this.metrics, ruleTraces: [...this.metrics.ruleTraces] },
      messages: [...this.messages], notice: this.notice, noticeKind: this.noticeKind, noticeId: this.noticeId };
  }
  upgradeCost(unit: Defender): number { return unit.level === 1 ? 90 : 150; }
  interact(tool: YardTool, row: number, col: number): boolean {
    if (this.phase !== 'playing' || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    const unit = this.units.find(u => u.row === row && u.col === col);
    if (tool === 'recycle') {
      if (!unit) return this.fail(row, col, 'Choose a defender to recycle.');
      const refund = Math.floor(unit.invested / 2); this.power += refund; this.units = this.units.filter(u => u !== unit);
      this.cue('charge', row, col + 0.5, `+${refund}`); this.announce('charge', `Recycled. ${refund} power refunded.`); return true;
    }
    if (tool === 'upgrade') {
      if (!unit) return this.fail(row, col, 'Choose a defender to upgrade.');
      if (unit.level >= 3) return this.fail(row, col, 'Already at maximum level.');
      const cost = this.upgradeCost(unit);
      if (this.power < cost) return this.fail(row, col, `Upgrade needs ${cost} power.`);
      this.power -= cost; unit.invested += cost; unit.level++; unit.maxHp = Math.round(unit.maxHp * 1.4); unit.hp = unit.maxHp;
      this.metrics.upgrades++; this.cue('upgrade', row, col + 0.5, `LEVEL ${unit.level}`); this.announce('upgrade', `${UNIT_INFO[unit.kind].name} upgraded to level ${unit.level}.`); this.evaluate(); return true;
    }
    if (unit) return this.fail(row, col, 'Tile occupied. Upgrade or recycle this defender.');
    if (this.zombies.some(z => z.row === row && Math.abs(z.x - col - 0.5) < 0.45)) return this.fail(row, col, 'Zombie on this tile. Build behind the front line.');
    const info = UNIT_INFO[tool];
    if (this.power < info.cost) return this.fail(row, col, `Not enough power. ${info.name} costs ${info.cost}.`);
    this.power -= info.cost;
    const hp = tool === 'wall' ? this.config.barricadeHealth : info.hp;
    this.units.push({ id: this.nextId++, kind: tool, row, col, hp, maxHp: hp, level: 1, timer: tool === 'charger' ? 5 : 0.15, flash: 0, invested: info.cost });
    this.metrics.placed++; this.cue('place', row, col + 0.5, info.name); this.announce('place', `${info.name} deployed. ${this.power} power left.`); this.evaluate(); return true;
  }
  collect(id: number): boolean {
    if (this.phase !== 'playing') return false;
    const drop = this.batteries.find(b => b.id === id); if (!drop) return false;
    this.power += drop.value; this.metrics.collected += drop.value;
    this.batteries = this.batteries.filter(b => b.id !== id); this.cue('charge', drop.row, drop.x, `+${drop.value}`);
    this.announce('charge', `+${drop.value} battery power.`); this.evaluate(); return true;
  }
  collectAll(): void { for (const b of [...this.batteries]) this.collect(b.id); }
  sendWave(): boolean {
    if (this.phase !== 'playing' || this.spawning || this.zombies.length || this.wave >= WAVES) return false;
    this.wave++; this.spawnTotal = 5 + this.wave * 2 + (this.night - 1) * 2; this.spawnIndex = 0; this.spawnTimer = 0; this.spawning = true; this.countdown = 0;
    this.announce('wave', this.wave === WAVES ? 'FINAL WAVE — the foreman is coming!' : `WAVE ${this.wave} — defend all five lanes!`);
    this.cue('wave', 2, 4.5, `WAVE ${this.wave}`); this.evaluate(); return true;
  }
  step(dt: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    let left = Math.min(dt, 0.1); this.evaluate();
    while (left > 0 && this.phase === 'playing') { const slice = Math.min(left, 1 / 60); this.tick(slice); left -= slice; }
    this.evaluate();
  }
  private tick(dt: number): void {
    this.elapsed += dt; this.skyTimer -= dt;
    if (this.skyTimer <= 0) { this.skyTimer += 6; this.drop((Math.floor(this.elapsed / 6) * 3) % ROWS, 2 + Math.floor(this.elapsed / 6) % 5, this.config.chargeRate * 5); }
    for (const b of this.batteries) b.age += dt;
    this.batteries = this.batteries.filter(b => b.age < 22);
    if (this.config.autoCollect) this.collectAll();
    if (!this.spawning && !this.zombies.length && this.wave < WAVES && (this.wave === 0 || this.countdown > 0)) { this.countdown -= dt; if (this.countdown <= 0) this.sendWave(); }
    if (this.spawning) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const i = this.spawnIndex++, row = [2, 0, 4, 1, 3][i % ROWS];
        const kind: ZombieKind = this.wave === 3 && i === this.spawnTotal - 1 ? 'brute' : this.wave >= 2 && i % 4 === 2 ? 'sprinter' : this.wave >= 2 && i % 3 === 0 ? 'hardhat' : 'worker';
        const hp = Math.round(ZOMBIE_INFO[kind].hp * (1 + (this.night - 1) * 0.22));
        this.zombies.push({ id: this.nextId++, kind, row, x: COLS + 0.35, hp, maxHp: hp, slowed: 0, flash: 0, biteTimer: 0.6, chewing: false });
        this.spawnTimer = Math.max(1, 2.3 - this.wave * 0.15);
        if (this.spawnIndex >= this.spawnTotal) this.spawning = false;
      }
    }
    for (const u of this.units) {
      u.flash = Math.max(0, u.flash - dt); u.timer = Math.max(0, u.timer - dt);
      if (u.kind === 'charger') { if (u.timer <= 0) { this.drop(u.row, u.col + 0.5, 25 + (u.level - 1) * 15); u.timer = 8 - (u.level - 1); } continue; }
      if (u.kind === 'wall' || u.timer > 0 || !this.zombies.some(z => z.hp > 0 && z.row === u.row && z.x > u.col + 0.3)) continue;
      const frost = u.kind === 'frost';
      const damage = Math.round(this.config.bladeDamage * (frost ? 0.65 : 1) * (1 + (u.level - 1) * 0.5));
      const count = this.config.doubleShot ? 2 : 1;
      for (let i = 0; i < count; i++) this.blades.push({ id: this.nextId++, row: u.row, x: u.col + 0.95 - i * 0.3, damage, frost });
      this.metrics.shots += count; u.flash = 0.12; u.timer = UNIT_INFO[u.kind].cooldown / ((this.config.overdrive ? 1.4 : 1) * (1 + (u.level - 1) * 0.15));
      this.cue('shoot', u.row, u.col + 0.85);
    }
    for (const blade of this.blades) {
      const old = blade.x; blade.x += dt * 5.2;
      const victim = this.zombies.filter(z => z.hp > 0 && z.row === blade.row && z.x + 0.2 >= old && z.x - 0.2 <= blade.x).sort((a, b) => a.x - b.x)[0];
      if (victim) {
        victim.hp -= blade.damage; victim.flash = 0.12; blade.x = COLS + 2;
        if (blade.frost) { victim.slowed = 3.5; this.metrics.slowed++; }
        this.cue('hit', victim.row, victim.x, `−${blade.damage}`);
        if (victim.hp <= 0) this.defeat(victim);
      }
    }
    this.blades = this.blades.filter(b => b.x < COLS + 0.8);
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      z.slowed = Math.max(0, z.slowed - dt); z.flash = Math.max(0, z.flash - dt);
      const target = this.units.filter(u => u.hp > 0 && u.row === z.row && u.col + 0.5 <= z.x + 0.25 && z.x - u.col - 0.5 < 0.65).sort((a, b) => b.col - a.col)[0];
      z.chewing = Boolean(target);
      if (target) {
        z.biteTimer -= dt;
        if (z.biteTimer <= 0) { target.hp -= ZOMBIE_INFO[z.kind].bite; target.flash = 0.18; z.biteTimer = 0.8; this.cue('hit', target.row, target.col + 0.5);
          if (target.hp <= 0) { this.cue('breach', target.row, target.col + 0.5, 'TOOL LOST'); this.announce('breach', `${UNIT_INFO[target.kind].name} destroyed in lane ${target.row + 1}.`); }
        }
      } else z.x -= ZOMBIE_INFO[z.kind].speed * this.config.zombieSpeed / 3 * (z.slowed > 0 ? 0.45 : 1) * dt;
      const sweep = this.sweepers[z.row];
      if (z.x < 0.25 && !sweep.used) { sweep.used = true; sweep.active = true; sweep.x = -0.35; this.cue('sweep', z.row, 0, 'EMERGENCY SWEEPER'); this.announce('sweep', `Lane ${z.row + 1} emergency sweeper activated!`); }
      if (z.x < -0.6 && !sweep.active) { z.hp = 0; this.lives = Math.max(0, this.lives - 1); this.cue('breach', z.row, 0, '−1 INTEGRITY'); this.announce('breach', `Workshop breached! ${this.lives} integrity remaining.`); if (this.lives === 0) { this.phase = 'gameover'; break; } }
    }
    if (this.phase === 'gameover') { this.zombies = this.zombies.filter(z => z.hp > 0); this.units = this.units.filter(u => u.hp > 0); return; }
    for (const sweep of this.sweepers) {
      if (!sweep.active) continue;
      sweep.x += 5 * dt;
      for (const z of this.zombies) if (z.hp > 0 && z.row === sweep.row && z.x < sweep.x + 0.4) { z.hp = 0; this.defeat(z); }
      if (sweep.x > COLS + 0.8) sweep.active = false;
    }
    this.units = this.units.filter(u => u.hp > 0); this.zombies = this.zombies.filter(z => z.hp > 0);
    if (!this.spawning && !this.zombies.length && this.wave > 0 && this.countdown <= 0 && this.phase === 'playing') {
      if (this.wave >= WAVES) { this.phase = 'cleared'; this.metrics.clears++; this.score += this.lives * 100; this.cue('clear', 2, 4.5, 'WORKSHOP SAVED'); this.announce('clear', 'Three waves defeated. The workshop survives!'); }
      else { this.countdown = 12; this.power += 75; this.cue('charge', 2, 4.5, 'WAVE CLEAR +75'); this.announce('charge', 'Wave cleared! +75 power. Repair and reinforce.'); }
    }
  }
  private drop(row: number, x: number, value: number): void { if (this.batteries.length < 20) this.batteries.push({ id: this.nextId++, row, x, value, age: 0 }); }
  private defeat(z: Zombie): void { this.score += 50; this.metrics.kills++; this.cue('kill', z.row, z.x, '+50'); }
  private fail(row: number, col: number, text: string): false { this.cue('error', row, col + 0.5, text); this.announce('error', text); return false; }
  private announce(kind: YardEvent, text: string): void { this.notice = text; this.noticeKind = kind; this.noticeId++; }
  private cue(kind: YardEvent, row: number, x: number, text?: string): void { this.feedback.push({ kind, row, x, text }); this.events.push(kind); this.feedback = this.feedback.slice(-80); this.events = this.events.slice(-80); }
  private evaluate(): void {
    if (!this.program) return;
    const runtime = { score: this.score, power: this.power, wave: this.wave, kills: this.metrics.kills, lives: this.lives, placed: this.metrics.placed };
    const { config, frame } = evaluateGameScript(this.program, this.base, runtime, yardSchema); this.config = config;
    for (const trace of frame.traces) {
      if (!this.metrics.ruleTraces.includes(trace.text)) this.metrics.ruleTraces.push(trace.text);
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
