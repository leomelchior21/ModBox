import type { ProgramResult } from '../../interpreter/core/types';
import { evaluateGameScript } from '../../interpreter/gameScript';
import { FORGE_DEFAULTS, forgeSchema, type ForgeConfig } from './mods';

export const SIZE = 8;
export type Cell = readonly [row: number, col: number];
export interface Piece { id: number; cells: Cell[]; color: number }
export type ForgePhase = 'ready' | 'playing' | 'paused' | 'gameover';
export interface ForgeMetrics { rotations: number; hints: number; undos: number; multiClears: number; ruleTraces: string[] }
export interface Placement { cells: number[]; cleared: number[]; lines: number; points: number; combo: number }
export const SHAPES: readonly (readonly Cell[])[] = [
  [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
];
export function rotateCells(cells: readonly Cell[]): Cell[] {
  const maxRow = Math.max(...cells.map(c => c[0]));
  return cells.map(([r, c]) => [c, maxRow - r] as Cell);
}
export function canPlace(board: readonly number[], cells: readonly Cell[], row: number, col: number): boolean {
  return Number.isInteger(row) && Number.isInteger(col) && cells.length > 0 && cells.every(([r, c]) => r + row >= 0 && r + row < SIZE && c + col >= 0 && c + col < SIZE && board[(r + row) * SIZE + c + col] === 0);
}
export function completedLines(board: readonly number[]): { cells: number[]; count: number } {
  const cells = new Set<number>(); let count = 0;
  for (let i = 0; i < SIZE; i++) {
    const row = Array.from({ length: SIZE }, (_, j) => i * SIZE + j), col = Array.from({ length: SIZE }, (_, j) => j * SIZE + i);
    for (const line of [row, col]) if (line.every(index => board[index] > 0)) { count++; for (const index of line) cells.add(index); }
  }
  return { cells: [...cells], count };
}
interface Turn {
  board: number[]; tray: (Piece | null)[]; score: number; lines: number; moves: number; combo: number;
  rng: number; nextId: number; metrics: ForgeMetrics;
}
export interface ForgeCheckpoint extends Turn { version: 1; rerolls: number; ended: boolean }
export function readForgeCheckpoint(value: unknown): ForgeCheckpoint | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as ForgeCheckpoint;
  const integer = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  if (c.version !== 1 || !Array.isArray(c.board) || c.board.length !== 64 || c.board.some(n => !integer(n, 0, 6))
    || !Array.isArray(c.tray) || c.tray.length !== 3 || c.tray.every(p => p === null)
    || !integer(c.score, 0, 1e9) || !integer(c.lines, 0, 1e7) || !integer(c.moves, 0, 1e7) || !integer(c.combo, 0, c.moves)
    || !integer(c.rng, 0, 0xffffffff) || !integer(c.nextId, 1, 1e9) || !integer(c.rerolls, 0, 3) || typeof c.ended !== 'boolean' || !c.metrics) return null;
  for (const p of c.tray) {
    if (p === null) continue;
    if (!p || !integer(p.id, 1, c.nextId - 1) || !integer(p.color, 1, 6) || !Array.isArray(p.cells) || p.cells.length < 1 || p.cells.length > 9
      || p.cells.some(cell => !Array.isArray(cell) || cell.length !== 2 || !integer(cell[0], 0, 3) || !integer(cell[1], 0, 3))
      || new Set(p.cells.map(cell => cell.join(':'))).size !== p.cells.length) return null;
  }
  if (new Set(c.tray.filter(p => p !== null).map(p => p!.id)).size !== c.tray.filter(p => p !== null).length) return null;
  for (const key of ['rotations', 'hints', 'undos', 'multiClears'] as const) if (!integer(c.metrics[key], 0, 1e9)) return null;
  if (!Array.isArray(c.metrics.ruleTraces) || c.metrics.ruleTraces.length > 1000 || c.metrics.ruleTraces.some(t => typeof t !== 'string' || t.length > 10000)) return null;
  return structuredClone({
    version: 1, board: c.board, tray: c.tray, score: c.score, lines: c.lines, moves: c.moves, combo: c.combo,
    rng: c.rng, nextId: c.nextId, rerolls: c.rerolls, ended: c.ended,
    metrics: { rotations: c.metrics.rotations, hints: c.metrics.hints, undos: c.metrics.undos, multiClears: c.metrics.multiClears, ruleTraces: c.metrics.ruleTraces },
  });
}

/** Turn-based puzzle. Randomness, scoring, previews and undo share one pure state. */
export class ForgeRun {
  phase: ForgePhase = 'ready'; config = { ...FORGE_DEFAULTS };
  board: number[] = Array(SIZE * SIZE).fill(0); tray: (Piece | null)[] = [];
  score = 0; lines = 0; moves = 0; combo = 0; rerolls = 3;
  metrics: ForgeMetrics = { rotations: 0, hints: 0, undos: 0, multiClears: 0, ruleTraces: [] };
  notice = 'Fit the pieces. Fill a line. Find your flow.';
  private program: ProgramResult<ForgeConfig> | null = null;
  private base = { ...FORGE_DEFAULTS }; private rng: number; private nextId = 1; private previous: Turn | null = null;
  private saved: ForgeCheckpoint | null;
  constructor(seed = 2026, checkpoint?: unknown) { this.rng = seed >>> 0; this.saved = readForgeCheckpoint(checkpoint); this.resetBoard(); }
  get hasSavedBoard(): boolean { return this.saved !== null; }
  checkpoint(): ForgeCheckpoint {
    return structuredClone({ version: 1, board: this.board, tray: this.tray, score: this.score, lines: this.lines, moves: this.moves, combo: this.combo, rng: this.rng, nextId: this.nextId, metrics: this.metrics, rerolls: this.rerolls, ended: this.phase === 'gameover' });
  }
  private random(): number { this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0; return this.rng / 4294967296; }
  private piece(shape: number): Piece { return { id: this.nextId++, cells: SHAPES[shape].map(([r, c]) => [r, c]), color: 1 + Math.floor(this.random() * 6) }; }
  private resetBoard(): void {
    this.board = Array(SIZE * SIZE).fill(0);
    // An inviting first clear teaches the mechanic without a tutorial dialog.
    for (let col = 0; col < 6; col++) this.board[7 * SIZE + col] = col < 3 ? 2 : 4;
    this.tray = [this.piece(1), this.piece(5), this.piece(10)];
  }
  launch(fresh = true): void {
    if (!fresh && this.saved) {
      const { ended, version: _version, ...turn } = structuredClone(this.saved);
      Object.assign(this, turn); this.previous = null; this.saved = null; this.phase = ended ? 'gameover' : 'playing';
      this.notice = 'Welcome back. Your next piece is waiting.'; this.evaluate(); this.checkMoves(); return;
    }
    this.saved = null;
    this.score = 0; this.lines = 0; this.moves = 0; this.combo = 0; this.rerolls = 3; this.previous = null;
    this.metrics = { rotations: 0, hints: 0, undos: 0, multiClears: 0, ruleTraces: [] };
    this.resetBoard(); this.phase = 'playing'; this.notice = 'Try the two-block piece in the gap on the bottom row.'; this.evaluate();
  }
  setProgram(program: ProgramResult<ForgeConfig>): void { if (!program.ok) return; this.program = program; this.base = { ...FORGE_DEFAULTS, ...program.config }; this.evaluate(); if (this.phase === 'gameover' && this.hasMoves()) this.phase = 'playing'; }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
  resume(): void { if (this.phase === 'paused') this.phase = 'playing'; }
  preview(slot: number, row: number, col: number): Placement | null {
    const piece = this.tray[slot]; if (!piece || !canPlace(this.board, piece.cells, row, col)) return null;
    const cells = piece.cells.map(([r, c]) => (r + row) * SIZE + c + col), board = [...this.board];
    for (const index of cells) board[index] = piece.color;
    const cleared = completedLines(board), combo = cleared.count ? this.combo + 1 : 0;
    const points = cells.length * 5 + cleared.count * this.config.linePoints + Math.max(0, cleared.count - 1) * 100 + Math.max(0, combo - 1) * (this.config.comboBoost ? 100 : 50);
    return { cells, cleared: cleared.cells, lines: cleared.count, points, combo };
  }
  place(slot: number, row: number, col: number): Placement | null {
    if (this.phase !== 'playing') return null;
    const result = this.preview(slot, row, col), piece = this.tray[slot];
    if (!result || !piece) { this.notice = 'That piece does not fit. Try another tile or rotate it.'; return null; }
    this.previous = { board: [...this.board], tray: structuredClone(this.tray), score: this.score, lines: this.lines, moves: this.moves, combo: this.combo, rng: this.rng, nextId: this.nextId, metrics: structuredClone(this.metrics) };
    for (const index of result.cells) this.board[index] = piece.color;
    for (const index of result.cleared) this.board[index] = 0;
    this.tray[slot] = null; this.score += result.points; this.lines += result.lines; this.moves++; this.combo = result.combo;
    if (result.lines > 1) this.metrics.multiClears++;
    if (this.tray.every(p => !p)) this.deal();
    this.notice = result.lines ? `${result.lines > 1 ? `${result.lines} LINES!` : 'LINE CLEAR!'} +${result.points}${this.combo > 1 ? ` / COMBO x${this.combo}` : ''}` : `+${result.points} / Keep room for the bigger pieces.`;
    this.evaluate(); this.checkMoves(); return result;
  }
  rotate(slot: number): boolean {
    const piece = this.tray[slot]; if (this.phase !== 'playing' || !this.config.rotations || !piece) return false;
    piece.cells = rotateCells(piece.cells); this.metrics.rotations++; this.notice = 'A fresh angle. Find your fit.'; return true;
  }
  hint(slot?: number): { slot: number; row: number; col: number } | null {
    if (this.phase !== 'playing' || !this.config.showHints) return null;
    const slots = slot === undefined ? [0, 1, 2] : [slot];
    let best: { slot: number; row: number; col: number; points: number } | null = null;
    for (const s of slots) for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
      const preview = this.preview(s, row, col);
      if (preview && (!best || preview.points > best.points)) best = { slot: s, row, col, points: preview.points };
    }
    if (best) { this.metrics.hints++; this.notice = 'Follow the glowing outline, or make your own move.'; }
    return best;
  }
  get canUndo(): boolean { return this.config.allowUndo && Boolean(this.previous) && (this.phase === 'playing' || this.phase === 'gameover'); }
  undo(): boolean {
    if (!this.canUndo || !this.previous) return false;
    const undos = this.metrics.undos + 1, turn = this.previous;
    Object.assign(this, structuredClone(turn)); this.metrics.undos = undos; this.previous = null;
    this.phase = 'playing'; this.notice = 'Last move undone. A little room to rethink.'; this.evaluate(); return true;
  }
  reshuffle(): boolean {
    if (!this.rerolls || !['playing', 'gameover'].includes(this.phase)) return false;
    this.rerolls--; this.previous = null; this.deal(); this.phase = 'playing'; this.notice = 'Fresh pieces. Make them count.'; this.checkMoves(); return true;
  }
  private deal(): void {
    const fitting = SHAPES.map((_, i) => i).filter(i => this.fits(SHAPES[i]));
    this.tray = Array.from({ length: 3 }, () => this.piece(fitting.length ? fitting[Math.floor(this.random() * fitting.length)] : 0));
  }
  private fits(cells: readonly Cell[]): boolean {
    for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (canPlace(this.board, cells, row, col)) return true;
    return false;
  }
  hasMoves(): boolean {
    return this.tray.some(p => {
      if (!p) return false;
      let cells = p.cells;
      for (let turn = 0; turn < (this.config.rotations ? 4 : 1); turn++) { if (this.fits(cells)) return true; cells = rotateCells(cells); }
      return false;
    });
  }
  private checkMoves(): void { if (!this.hasMoves()) { this.phase = 'gameover'; this.notice = 'No pieces fit. Try a reshuffle or start a fresh board.'; } }
  private evaluate(): void {
    if (!this.program) return;
    const result = evaluateGameScript(this.program, this.base, { score: this.score, lines: this.lines, moves: this.moves, combo: this.combo }, forgeSchema);
    this.config = result.config;
    for (const trace of result.frame.traces) if (!this.metrics.ruleTraces.includes(trace.text)) this.metrics.ruleTraces.push(trace.text);
  }
}
