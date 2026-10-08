import type { ProgramResult } from '../../interpreter/core/types';
import { evaluateGameScript } from '../../interpreter/gameScript';
import { evalExpr } from '../../interpreter/core/evaluate';
import { renderText } from '../../interpreter/csharp/binder';
import { MAZE_DEFAULTS, MAZE_MODS, mazeSchema, type MazeConfig } from './mods';
import { cellKey, DIRECTIONS, distances, generateMaze, sameCell, walkable, type Cell, type Direction, type Maze } from './maze';
import { sentinelInterval, sentinelMode, sentinelTargets, steerSentinels } from './sentinels';

export type MazePhase = 'launch' | 'playing' | 'paused' | 'cleared' | 'gameover';
export interface MazeInput { up: boolean; right: boolean; down: boolean; left: boolean; phase: boolean }
export interface MazeMetrics { cores: number; dots: number; exits: number; phases: number; hits: number; steps: number; minEnergy: number; ruleTraces: string[] }
export interface MazeSnapshot {
  phase: MazePhase; config: MazeConfig; score: number; energy: number; lives: number; level: number;
  cores: number; dots: number; stunRemaining: number; phaseCooldown: number; shieldReady: boolean; metrics: MazeMetrics; messages: string[];
}
export type MazeEvent = 'dot' | 'core' | 'phase' | 'hit' | 'shield' | 'clear';
const emptyMetrics = (): MazeMetrics => ({ cores: 0, dots: 0, exits: 0, phases: 0, hits: 0, steps: 0, minEnergy: 100, ruleTraces: [] });

/** Pure simulation: no timers, DOM or globals. The screen owns its lifecycle. */
export class NeonMazeRun {
  phase: MazePhase = 'launch';
  config: MazeConfig = { ...MAZE_DEFAULTS };
  maze: Maze;
  player: Cell;
  playerFrom: Cell;
  moveAge = 1;
  moveDuration = 0.2;
  facing: Direction = 'right';
  sentinels: Cell[] = [];
  sentinelFrom: Cell[] = [];
  sentinelAge = 1;
  sentinelDuration = sentinelInterval(MAZE_DEFAULTS.sentinelSpeed);
  elapsed = 0;
  collected = new Set<string>();
  dots = new Set<string>();
  collectedDots = new Set<string>();
  stunRemaining = 0;
  visited = new Set<string>();
  trail: Cell[] = [];
  score = 0;
  energy = 100;
  lives = 3;
  level = 1;
  phaseCooldown = 0;
  invulnerable = 1.5;
  shieldCooldown = 0;
  metrics = emptyMetrics();
  messages = ['KEEP ROLLING · Dots score points. Gems stun sentinels.'];
  events: MazeEvent[] = [];
  private program: ProgramResult<MazeConfig> | null = null;
  private base = { ...MAZE_DEFAULTS };
  private moveTimer = 0;
  private hunterTimer = 0;
  private hunterMode: 'chase' | 'scatter' = 'chase';
  private seed: number;
  private activeRules = new Set<string>();
  private queuedTurn: Direction | null = null;
  private stopped = false;
  constructor(seed = Math.floor(Math.random() * 1000000) + 1) {
    this.seed = seed; this.maze = generateMaze(this.config.mazeSize, seed);
    this.player = { ...this.maze.start }; this.playerFrom = { ...this.player };
    this.resetSector();
  }
  setProgram(program: ProgramResult<MazeConfig>): void {
    if (!program.ok) return;
    this.program = program; this.base = { ...MAZE_DEFAULTS, ...program.config };
    this.evaluate(); this.syncSentinels();
    this.messages = [...program.comms.map(line => line.text), ...this.messages].filter((message, i, all) => all.indexOf(message) === i).slice(0, 4);
  }
  launch(): void { this.restart(); }
  restart(): void {
    this.score = 0; this.energy = 100; this.lives = 3; this.level = 1;
    this.metrics = emptyMetrics(); this.activeRules.clear(); this.config = { ...this.base };
    this.events = []; this.resetSector(); this.phase = 'playing';
  }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
  resume(): void { if (this.phase === 'paused') this.phase = 'playing'; }
  advance(): void {
    if (this.phase !== 'cleared') return;
    this.level++; this.energy = Math.min(100, this.energy + 25);
    const stun = this.stunRemaining;
    this.resetSector(); this.stunRemaining = stun; this.phase = 'playing';
    this.log(`SECTOR ${String(this.level).padStart(2, '0')} · Keep rolling. Find 3 new gems.`);
  }
  snapshot(): MazeSnapshot {
    return { phase: this.phase, config: { ...this.config }, score: this.score, energy: this.energy, lives: this.lives,
      level: this.level, cores: this.collected.size, dots: this.collectedDots.size, stunRemaining: this.stunRemaining, phaseCooldown: this.phaseCooldown,
      shieldReady: this.config.shield && this.shieldCooldown <= 0,
      metrics: { ...this.metrics, ruleTraces: [...this.metrics.ruleTraces] }, messages: [...this.messages] };
  }
  private resetSector(): void {
    this.maze = generateMaze(this.config.mazeSize, this.seed + this.level * 7919);
    this.player = { ...this.maze.start }; this.playerFrom = { ...this.player }; this.moveAge = 1;
    this.facing = this.openDirections()[0] ?? 'right'; this.queuedTurn = null; this.stopped = false;
    this.sentinels = []; this.sentinelFrom = []; this.sentinelAge = 1; this.elapsed = 0; this.hunterMode = 'chase';
    this.collected.clear(); this.collectedDots.clear(); this.dots.clear(); this.stunRemaining = 0;
    this.visited.clear(); this.trail = [];
    const gems = new Set(this.maze.cores.map(cellKey));
    for (const key of distances(this.maze, this.maze.start).keys()) {
      if (key !== cellKey(this.maze.start) && key !== cellKey(this.maze.exit) && !gems.has(key)) this.dots.add(key);
    }
    this.phaseCooldown = 0; this.invulnerable = 1.5; this.shieldCooldown = 0;
    this.moveDuration = 1 / (this.config.moveSpeed + 1); this.moveTimer = this.moveDuration;
    this.sentinelDuration = sentinelInterval(this.config.sentinelSpeed); this.hunterTimer = this.sentinelDuration; this.syncSentinels(); this.explore();
  }
  private syncSentinels(): void {
    this.sentinels = this.sentinels.slice(0, this.config.sentinelCount);
    this.sentinelFrom = this.sentinelFrom.slice(0, this.config.sentinelCount);
    const occupied = new Set(this.sentinels.map(cellKey));
    const far = [...distances(this.maze, this.player)].filter(([key, d]) => d >= 6 && d <= 16 && !occupied.has(key)).sort((a, b) => b[1] - a[1]);
    while (this.sentinels.length < this.config.sentinelCount && far.length) {
      const candidate = far.splice((this.sentinels.length * 5 + this.level * 3) % far.length, 1)[0][0];
      const [x, y] = candidate.split(',').map(Number); this.sentinels.push({ x, y }); this.sentinelFrom.push({ x, y });
    }
  }
  private explore(): void {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) this.visited.add(cellKey({ x: this.player.x + x, y: this.player.y + y }));
  }
  requestTurn(direction: Direction): void {
    if (this.phase !== 'playing') return;
    this.queuedTurn = direction;
    const reverse = { up: 'down', right: 'left', down: 'up', left: 'right' } as const;
    // Reverse along the current segment immediately, without snapping to a tile.
    if (direction === reverse[this.facing] && this.moveAge < this.moveDuration
      && Math.abs(this.player.x - this.playerFrom.x) + Math.abs(this.player.y - this.playerFrom.y) === 1) {
      const from = this.playerFrom; this.playerFrom = this.player; this.player = from;
      this.moveAge = this.moveDuration - this.moveAge; this.moveTimer = this.moveDuration - this.moveAge;
      this.facing = direction; this.queuedTurn = null; this.stopped = false;
    } else if (this.stopped && this.openDirections().includes(direction)) this.moveTimer = 0;
  }
  playerPosition(): Cell {
    const blend = Math.min(1, this.moveAge / this.moveDuration);
    return { x: this.playerFrom.x + (this.player.x - this.playerFrom.x) * blend, y: this.playerFrom.y + (this.player.y - this.playerFrom.y) * blend };
  }
  sentinelPositions(): Cell[] {
    const blend = Math.min(1, this.sentinelAge / this.sentinelDuration);
    return this.sentinels.map((cell, i) => {
      const from = this.sentinelFrom[i] ?? cell;
      return { x: from.x + (cell.x - from.x) * blend, y: from.y + (cell.y - from.y) * blend };
    });
  }
  phaseJump(): boolean { return this.move(this.queuedTurn ?? this.facing, true); }
  private openDirections(): Direction[] {
    return (Object.keys(DIRECTIONS) as Direction[]).filter(key => walkable(this.maze, { x: this.player.x + DIRECTIONS[key].x, y: this.player.y + DIRECTIONS[key].y }));
  }
  private cruise(): void {
    const exits = this.openDirections();
    // Buffer early turns, but never choose a corner or reverse for the player.
    const direction = this.queuedTurn && exits.includes(this.queuedTurn) ? this.queuedTurn
      : exits.includes(this.facing) ? this.facing : null;
    if (direction) this.move(direction);
    else { this.stopped = true; this.moveTimer = 0; }
  }
  step(dt: number, input: MazeInput): void {
    if (this.phase !== 'playing') return;
    dt = Math.max(0, Math.min(dt, 0.1));
    const visualPlayer = this.playerPosition(), visualHunters = this.sentinelPositions();
    this.elapsed += dt; this.moveAge += dt; this.moveTimer -= dt;
    // Stunned hunters finish their current visual step, then stay still and harmless.
    this.sentinelAge += dt;
    const hunterDt = Math.max(0, dt - this.stunRemaining);
    this.stunRemaining = Math.max(0, this.stunRemaining - dt); this.hunterTimer -= hunterDt;
    this.phaseCooldown = Math.max(0, this.phaseCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    const direction = (Object.keys(DIRECTIONS) as Direction[]).find(key => input[key]);
    if (direction) this.requestTurn(direction);
    this.resolveContact();
    const previousPlayer = { ...this.player };
    if (dt > 0 && this.phase === 'playing') {
      if (input.phase && this.phaseCooldown <= 0) this.phaseJump();
      else if (this.moveTimer <= 0) {
        const remainder = this.stopped ? 0 : Math.max(-dt, this.moveTimer);
        this.cruise();
        if (!this.stopped) { this.moveTimer += remainder; this.moveAge = -remainder; }
      }
    }
    this.resolveContact();
    if (dt > 0 && this.hunterTimer <= 0 && this.phase === 'playing' && this.stunRemaining <= 0) {
      const overshoot = Math.max(0, -this.hunterTimer);
      this.hunterTimer += sentinelInterval(this.config.sentinelSpeed);
      const before = this.sentinels;
      this.sentinels = steerSentinels(this.maze, before, this.sentinelFrom,
        sentinelTargets(this.maze, this.player, this.facing, before, this.collected, this.elapsed), this.hunterMode !== sentinelMode(this.elapsed));
      this.hunterMode = sentinelMode(this.elapsed);
      this.sentinelFrom = before.map(cell => ({ ...cell })); this.sentinelAge = overshoot;
      this.sentinelDuration = sentinelInterval(this.config.sentinelSpeed);
      // Catch head-on tile swaps as well as sharing a tile.
      if (!sameCell(previousPlayer, this.player) && before.some((cell, i) => sameCell(cell, this.player) && sameCell(this.sentinels[i], previousPlayer))) this.takeHit();
      this.resolveContact();
    }
    // Sweep relative visual motion so grazing contacts and crossing actors cannot miss a hit.
    const player = this.playerPosition();
    if (this.sentinelPositions().some((hunter, i) => {
      const before = visualHunters[i] ?? hunter;
      const x = visualPlayer.x - before.x, y = visualPlayer.y - before.y;
      const dx = player.x - hunter.x - x, dy = player.y - hunter.y - y;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length)) : 0;
      return Math.hypot(x + dx * t, y + dy * t) < 0.54;
    })) this.takeHit();
    this.evaluate();
  }
  move(direction: Direction, phase = false): boolean {
    if (this.phase !== 'playing' || (phase && this.phaseCooldown > 0)) return false;
    const delta = DIRECTIONS[direction];
    let target: Cell | undefined;
    for (let distance = phase ? this.config.phaseLength : 1; distance >= 1; distance--) {
      const next = { x: this.player.x + delta.x * distance, y: this.player.y + delta.y * distance };
      if (walkable(this.maze, next)) { target = next; break; }
    }
    if (!target) { this.stopped = true; this.moveTimer = 0; return false; }
    const visualFrom = phase ? this.playerPosition() : this.player;
    this.stopped = false;
    this.facing = direction; if (this.queuedTurn === direction) this.queuedTurn = null;
    this.playerFrom = { ...visualFrom }; this.trail.push({ ...this.player }); this.trail = this.trail.slice(-16);
    this.player = target; this.moveAge = 0;
    this.moveDuration = phase ? 0.12 : 1 / (this.config.moveSpeed + 1); this.moveTimer = this.moveDuration;
    this.metrics.steps++; this.explore();
    if (phase) { this.phaseCooldown = 2.4; this.invulnerable = 0.65; this.metrics.phases++; this.events.push('phase'); }
    if (this.dots.has(cellKey(this.player)) && !this.collectedDots.has(cellKey(this.player))) {
      this.collectedDots.add(cellKey(this.player)); this.score += 5; this.metrics.dots++; this.events.push('dot');
    }
    if (this.maze.cores.some(core => sameCell(core, this.player)) && !this.collected.has(cellKey(this.player))) {
      this.collected.add(cellKey(this.player)); this.score += this.config.coreValue; this.metrics.cores++;
      this.stunRemaining = this.config.gemDuration;
      this.log(`GEM ${this.collected.size}/3 · SENTINELS STUNNED ${this.stunRemaining}s${this.collected.size === 3 ? ' · EXIT OPEN' : ''}`); this.events.push('core');
    }
    if (this.collected.size === 3 && sameCell(this.player, this.maze.exit)) {
      this.score += 100; this.metrics.exits++; this.phase = 'cleared'; this.events.push('clear');
      // Crossing a gate rolls directly into another sector; the run never stops for a menu.
      this.evaluate(); this.advance();
    }
    this.evaluate(); return true;
  }
  private resolveContact(): void {
    if (this.phase !== 'playing' || this.invulnerable > 0 || this.stunRemaining > 0 || !this.sentinels.some(s => sameCell(s, this.player))) return;
    this.takeHit();
  }
  private takeHit(): void {
    if (this.phase !== 'playing' || this.invulnerable > 0 || this.stunRemaining > 0) return;
    if (this.config.shield && this.shieldCooldown <= 0) {
      this.shieldCooldown = 8; this.invulnerable = 1.5; this.log('SHIELD ABSORBED AN IMPACT'); this.events.push('shield'); return;
    }
    this.energy = Math.max(0, this.energy - 25); this.metrics.hits++; this.metrics.minEnergy = Math.min(this.metrics.minEnergy, this.energy);
    this.invulnerable = 1.5; this.events.push('hit'); this.log(`SIGNAL HIT · Energy ${this.energy}%`);
    if (this.energy === 0) {
      this.lives--;
      if (this.lives <= 0) this.phase = 'gameover';
      else {
        this.energy = 100; this.player = { ...this.maze.start }; this.playerFrom = { ...this.player }; this.moveAge = 1; this.invulnerable = 2;
        this.facing = this.openDirections()[0] ?? 'right'; this.queuedTurn = null; this.stopped = false;
        this.moveTimer = 1 / (this.config.moveSpeed + 1); this.sentinels = []; this.sentinelFrom = []; this.syncSentinels(); this.explore();
      }
    }
  }
  private evaluate(): void {
    if (!this.program) return;
    const before = this.config;
    const { config, frame } = evaluateGameScript(this.program, this.base, {
      score: this.score, energy: this.energy, cores: this.collected.size, level: this.level, steps: this.metrics.steps, dots: this.collectedDots.size, stun: this.stunRemaining,
    }, mazeSchema);
    this.config = config;
    if (config.shield && !before.shield) this.shieldCooldown = 0;
    if (config.sentinelCount !== before.sentinelCount) this.syncSentinels();
    for (const trace of frame.traces) {
      if (!this.metrics.ruleTraces.includes(trace.text)) this.metrics.ruleTraces.push(trace.text);
      if (!this.activeRules.has(trace.ruleId)) {
        this.log(`RULE LIVE · ${trace.text}`);
        for (const write of trace.writes) {
          const value = evalExpr(write.arg, {
            runtime: { score: this.score, energy: this.energy, cores: this.collected.size, level: this.level, steps: this.metrics.steps, dots: this.collectedDots.size, stun: this.stunRemaining },
            modValues: Object.fromEntries(MAZE_MODS.map(mod => [mod.name, this.base[mod.id]])),
            constants: Object.fromEntries(this.program.symbols.filter(s => s.userOnly).map(s => [s.name, s.value])),
          });
          if (value.ok) this.log(renderText(value.value));
        }
      }
    }
    this.activeRules = new Set(frame.activeRuleIds);
  }
  private log(message: string): void { this.messages = [message, ...this.messages].slice(0, 4); }
}
