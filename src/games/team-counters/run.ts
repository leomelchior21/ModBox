import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { teamCatalog } from './catalog';

export type GateOperation = { op: '+' | '-' | '×' | '÷'; value: number };
export interface TeamGate { at: number; options: [GateOperation, GateOperation]; used: boolean }
export interface TeamEnemy { at: number; count: number; boss: boolean; defeated: boolean }
export interface TeamTrap { at: number; x: number; moving: boolean; hit: boolean }
export const gateResult = (count: number, gate: GateOperation, bonus = 0) => clamp(Math.floor(gate.op === '+' ? count + gate.value + bonus : gate.op === '-' ? count - gate.value : gate.op === '×' ? count * gate.value + bonus : count / gate.value), 0, 5000);
export function teamCourse(level: number) {
  const growth = Math.min(20, level - 1);
  const pairs: [GateOperation, GateOperation][] = [
    [{ op: '+', value: 12 }, { op: '×', value: 2 }], [{ op: '+', value: 20 }, { op: '×', value: 2 }],
    [{ op: '÷', value: 2 }, { op: '+', value: 18 }], [{ op: '×', value: 3 }, { op: '+', value: 24 }],
    [{ op: '+', value: 35 }, { op: '×', value: 2 }], [{ op: '-', value: 15 }, { op: '+', value: 30 }],
    [{ op: '×', value: 2 }, { op: '+', value: 40 }],
  ];
  return {
    gates: pairs.map((options, i): TeamGate => ({ at: 16 + i * 22, options: (level % 2 === 0 ? [...options].reverse() : options) as [GateOperation, GateOperation], used: false })),
    enemies: [{ at: 49, count: 12 + growth * 2, boss: false, defeated: false }, { at: 115, count: 28 + growth * 3, boss: false, defeated: false }, { at: 175, count: 55 + growth * 5, boss: true, defeated: false }],
    traps: [{ at: 69, x: -2, moving: true, hit: false }, { at: 137, x: 1.8, moving: true, hit: false }],
  };
}
export class TeamRun extends ArcadeRun {
  distance = 0; x = 0; targetX = 0; team = 10; peak = 10; gates: TeamGate[] = []; enemies: TeamEnemy[] = []; traps: TeamTrap[] = [];
  shield = 0; shieldCooldown = 0; rallyCooldown = 0; invulnerable = 0; victory = 0;
  private dragId: number | null = null;
  private retry = { distance: 0, team: 10, score: 0, metrics: structuredClone(this.metrics) };
  constructor(checkpoint?: unknown) { super('team-counters', teamCatalog.defaults, teamCatalog.schema, checkpoint); }
  get goal() { return 190; }
  get nextGate() { return this.gates.find(g => !g.used); }
  preview(gate: TeamGate) { return gate.options.map(o => gateResult(this.team, o, this.config.power)); }
  protected setup(): void {
    const course = teamCourse(this.level); this.gates = course.gates; this.enemies = course.enemies; this.traps = course.traps;
    this.distance = 0; this.x = 0; this.targetX = 0; this.team = 10; this.peak = 10; this.shield = 0; this.shieldCooldown = 0; this.rallyCooldown = 0; this.invulnerable = 0; this.victory = 0; this.dragId = null;
    this.retry = { distance: 0, team: 10, score: this.score, metrics: structuredClone(this.metrics) }; this.notice = 'Slide left or right. Pick a gate, grow your crowd and reach the castle.';
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'left' || action === 'right') { this.targetX = action === 'left' ? -2 : 2; this.metrics.actions++; }
    if (action === 'primary' && this.rallyCooldown <= 0) { this.team = Math.min(5000, this.team + 3); this.peak = Math.max(this.peak, this.team); this.rallyCooldown = 8; this.metrics.actions++; this.cue('ability', 0, 0, '+3 RECRUITS'); this.notice = 'RALLY! Three more runners joined the crew.'; }
    if (action === 'ability' && this.config.overdrive && this.shieldCooldown <= 0) { this.shield = 6; this.shieldCooldown = 14; this.metrics.actions++; this.cue('ability', 0, 0, 'TEAM SHIELD'); this.notice = 'Together, stronger. One trap or battle loss softened.'; }
  }
  trapX(trap: TeamTrap) { return trap.moving ? Math.sin(this.elapsed * 1.5 + trap.at) * 2.25 : trap.x; }
  protected tick(dt: number): void {
    this.shield = this.config.overdrive ? Math.max(0, this.shield - dt) : 0; this.shieldCooldown = Math.max(0, this.shieldCooldown - dt); this.rallyCooldown = Math.max(0, this.rallyCooldown - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.input.left || this.input.right) this.targetX = clamp(this.targetX + (Number(this.input.right) - Number(this.input.left)) * dt * 7, -2.7, 2.7);
    this.x += (this.targetX - this.x) * Math.min(1, dt * 14);
    const previous = this.distance; this.distance = Math.min(this.goal, this.distance + dt * this.config.speed);
    for (const gate of this.gates) if (!gate.used && previous < gate.at && this.distance >= gate.at) {
      const side = this.x < 0 ? 0 : 1, option = gate.options[side], outcomes = this.preview(gate), before = this.team;
      this.retry = { distance: Math.max(0, gate.at - 8), team: before, score: this.score, metrics: structuredClone(this.metrics) };
      this.team = outcomes[side]; this.peak = Math.max(this.peak, this.team); gate.used = true; this.metrics.actions++;
      if (this.config.assist) this.metrics.assisted++;
      if (outcomes[side] >= outcomes[1 - side]) { this.metrics.perfects++; this.cue('perfect', 0, 0, 'SMART CHOICE'); }
      this.addScore(Math.max(5, this.team - before), 0, 0, `${option.op}${option.value} → ${this.team}`); this.notice = `${option.op}${option.value}: ${before} became ${this.team}. Keep counting!`;
      if (this.team <= 0) { this.recover('Empty squad. Try the other gate.'); return; }
    }
    for (const trap of this.traps) if (!trap.hit && this.distance >= trap.at - .5 && this.distance <= trap.at + 1 && Math.abs(this.x - this.trapX(trap)) < 1.05) {
      trap.hit = true;
      if (this.shield > 0) { this.shield = 0; this.metrics.assisted++; this.notice = 'SHIELD SAVE. Every runner counts.'; this.cue('ability', 0, 0, 'SAVED'); }
      else { const lost = Math.max(3, Math.ceil(this.team * .3)); this.team = Math.max(0, this.team - lost); this.cue('lose', 0, 0, `−${lost} RUNNERS`); this.notice = 'Watch the moving saw. Keep your crowd out of its path.'; if (!this.team) { this.recover('The saw scattered your squad. Rally at the last gate.'); return; } }
    }
    for (const enemy of this.enemies) if (!enemy.defeated && previous < enemy.at && this.distance >= enemy.at) {
      const cost = Math.ceil(enemy.count * (this.shield > 0 ? .5 : 1));
      if (this.team <= cost) { this.recover(`${enemy.count} rivals ahead. Bring a bigger crowd or activate a shield.`); return; }
      if (this.shield > 0) { this.shield = 0; this.metrics.assisted++; }
      this.team -= cost; enemy.defeated = true; this.metrics.perfects++; this.addScore(this.config.bonus * (enemy.boss ? 4 : 1), 0, 0, enemy.boss ? 'CASTLE TAKEN!' : 'CLASH WON');
      this.notice = enemy.boss ? 'Castle taken. Your remaining runners power the victory steps!' : `Clash won. ${this.team} runners still standing.`;
    }
    if (this.distance >= this.goal) { this.victory = Math.min(10, 1 + Math.floor(this.team / 12)); this.addScore(this.team * this.victory, 0, 0, `VICTORY ×${this.victory}`); this.clear(0, 0); }
  }
  private recover(message: string): void {
    if (this.invulnerable > 0) return;
    this.lose(0, 0, message);
    if (this.phase === 'playing') {
      // Rewind to before the last choice so a losing route is recoverable.
      this.distance = this.retry.distance; this.team = this.retry.team; this.score = this.retry.score; this.metrics = structuredClone(this.retry.metrics);
      for (const gate of this.gates) gate.used = gate.at < this.distance;
      for (const enemy of this.enemies) enemy.defeated = enemy.at < this.distance;
      for (const trap of this.traps) trap.hit = trap.at < this.distance;
      this.invulnerable = 1; this.x = 0; this.targetX = 0;
    }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, _y: number, pointerId = 0): void {
    if (phase === 'cancel') { this.dragId = null; return; }
    if (this.phase !== 'playing') return;
    if (phase === 'down' && this.dragId === null) { this.dragId = pointerId; this.metrics.actions++; }
    if (this.dragId !== pointerId) return;
    this.targetX = clamp((x / 1000 - .5) * 7.2, -2.7, 2.7);
    if (phase === 'up') this.dragId = null;
  }
  protected runtime() { return { distance: Math.floor(this.distance), team: this.team, gates: this.gates.filter(g => g.used).length }; }
  protected stageSummary() { return { team: this.team, peak: this.peak, victory: this.victory, lives: this.lives }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.distance = this.goal; this.team = clamp(Math.floor(summary.team ?? 10), 0, 5000); this.peak = Math.max(this.team, summary.peak ?? this.team); this.victory = clamp(Math.floor(summary.victory ?? 1), 1, 10); this.lives = Math.floor(summary.lives ?? this.config.lives); this.gates.forEach(g => { g.used = true; }); this.enemies.forEach(e => { e.defeated = true; }); }
  stats() { return [{ label: 'YOUR TEAM', value: this.team }, { label: 'BEST CROWD', value: this.peak }, { label: 'RALLIES', value: this.lives }]; }
}
