import type { ProgramResult } from '../../interpreter/core/types';
import type { BindingSchema } from '../../interpreter/core/schema';
import { evaluateGameScript } from '../../interpreter/gameScript';

export interface ArcadeConfig {
  palette: string; playerName: string; power: number; speed: number; gravity: number;
  assist: boolean; overdrive: boolean; lives: number; bonus: number;
}
export type ArcadePhase = 'ready' | 'playing' | 'paused' | 'cleared' | 'gameover';
export type ArcadeAction = 'primary' | 'left' | 'right' | 'up' | 'down' | 'ability' | 'launch' | 'nudge';
export interface ArcadeInput { left: boolean; right: boolean; up: boolean; down: boolean }
export interface ArcadeCue { kind: 'launch' | 'hit' | 'score' | 'perfect' | 'lose' | 'clear' | 'ability'; x: number; y: number; text?: string; color?: string }
export interface ArcadeMetrics { actions: number; scored: number; assisted: number; clears: number; perfects: number; ruleTraces: string[] }
export interface CampaignSave { version: 1; game: string; level: number; score: number; cleared: boolean; metrics: ArcadeMetrics; summary?: Record<string, number> }
const freshMetrics = (): ArcadeMetrics => ({ actions: 0, scored: 0, assisted: 0, clears: 0, perfects: 0, ruleTraces: [] });
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function readCampaign(value: unknown, game: string): CampaignSave | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as CampaignSave, integer = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  if (s.version !== 1 || s.game !== game || !integer(s.level, 1, 999) || !integer(s.score, 0, 1e9) || typeof s.cleared !== 'boolean' || !s.metrics) return null;
  for (const k of ['actions', 'scored', 'assisted', 'clears', 'perfects'] as const) if (!integer(s.metrics[k], 0, 1e9)) return null;
  if (!Array.isArray(s.metrics.ruleTraces) || s.metrics.ruleTraces.length > 200 || s.metrics.ruleTraces.some(t => typeof t !== 'string' || t.length > 2000)) return null;
  if (s.summary !== undefined && (!s.summary || typeof s.summary !== 'object' || Array.isArray(s.summary) || Object.keys(s.summary).length > 16 || Object.entries(s.summary).some(([key, value]) => !/^[a-z][a-zA-Z0-9]{0,23}$/.test(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9))) return null;
  return { version: 1, game, level: s.level, score: s.score, cleared: s.cleared, metrics: { actions: s.metrics.actions, scored: s.metrics.scored, assisted: s.metrics.assisted, clears: s.metrics.clears, perfects: s.metrics.perfects, ruleTraces: [...s.metrics.ruleTraces] }, ...(s.summary ? { summary: { ...s.summary } } : {}) };
}

/** Engines own simulation; this base only handles campaign boundaries and scripts. */
export abstract class ArcadeRun {
  phase: ArcadePhase = 'ready'; config: ArcadeConfig; score = 0; level = 1; lives = 3; elapsed = 0;
  metrics = freshMetrics(); notice = 'Your next high score starts here.';
  input: ArcadeInput = { left: false, right: false, up: false, down: false };
  cues: ArcadeCue[] = []; revision = 0; checkpointRevision = 0;
  private program: ProgramResult<ArcadeConfig> | null = null;
  private base: ArcadeConfig; private saved: CampaignSave | null;
  constructor(readonly game: string, readonly defaults: ArcadeConfig, readonly schema: BindingSchema<keyof ArcadeConfig>, checkpoint?: unknown) {
    this.base = { ...defaults }; this.config = { ...defaults }; this.saved = readCampaign(checkpoint, game);
    if (this.saved) { this.level = this.saved.level; this.score = this.saved.score; this.metrics = structuredClone(this.saved.metrics); }
  }
  setProgram(program: ProgramResult<ArcadeConfig>): void {
    if (!program.ok) return;
    this.program = program; this.base = { ...this.defaults, ...program.config }; this.evaluate();
  }
  launch(fresh = false): void {
    if (fresh) { this.saved = null; this.level = 1; this.score = 0; this.metrics = freshMetrics(); }
    if (this.saved) { this.level = this.saved.level; this.score = this.saved.score; this.metrics = structuredClone(this.saved.metrics); }
    this.evaluate(); this.lives = this.config.lives; this.elapsed = 0; this.cues = []; this.releaseInput(); this.revision++;
    this.phase = this.saved?.cleared ? 'cleared' : 'playing'; this.setup();
    if (this.saved?.cleared) this.restoreSummary(this.saved.summary ?? {});
    this.evaluate();
    if (!this.saved) this.saveBoundary();
  }
  advance(): void {
    if (this.phase !== 'cleared') return;
    this.level++; this.phase = 'playing'; this.evaluate(); this.lives = this.config.lives; this.elapsed = 0;
    this.releaseInput(); this.cues = []; this.revision++; this.setup(); this.evaluate(); this.saveBoundary();
  }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; this.releaseInput(); }
  resume(): void { if (this.phase === 'paused') this.phase = 'playing'; }
  releaseInput(): void { this.input = { left: false, right: false, up: false, down: false }; }
  step(dt: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.evaluate(); let remaining = Math.min(dt, 0.1);
    while (remaining > 1e-8 && this.phase === 'playing') { const slice = Math.min(remaining, 1 / 120); this.elapsed += slice; this.tick(slice); remaining -= slice; }
    this.evaluate();
  }
  protected abstract setup(): void;
  protected abstract tick(dt: number): void;
  abstract action(action: ArcadeAction): void;
  pointer(_phase: 'down' | 'move' | 'up' | 'cancel', _x: number, _y: number, _pointerId?: number): void { /* Optional game-specific gesture. */ }
  abstract stats(): { label: string; value: string | number }[];
  protected runtime(): Record<string, number> { return {}; }
  protected stageSummary(): Record<string, number> { return {}; }
  protected restoreSummary(_summary: Readonly<Record<string, number>>): void { /* Optional completed-stage presentation. */ }
  protected addScore(points: number, x: number, y: number, text?: string): void {
    this.score += Math.round(points); this.metrics.scored++; this.cue('score', x, y, text ?? `+${Math.round(points)}`); this.evaluate();
  }
  protected lose(x: number, y: number, message: string): void {
    this.lives = Math.max(0, this.lives - 1); this.cue('lose', x, y, message); this.notice = message;
    if (!this.lives) { this.phase = 'gameover'; this.releaseInput(); }
  }
  protected clear(x: number, y: number): void {
    if (this.phase !== 'playing') return;
    this.phase = 'cleared'; this.metrics.clears++; this.releaseInput(); this.notice = 'STAGE SECURED. Your progress is saved.';
    this.cue('clear', x, y, 'STAGE CLEAR'); this.evaluate(); this.saveBoundary();
  }
  protected cue(kind: ArcadeCue['kind'], x: number, y: number, text?: string, color?: string): void { this.cues.push({ kind, x, y, text, color }); this.cues = this.cues.slice(-80); }
  get checkpoint(): CampaignSave | null { return this.saved ? structuredClone(this.saved) : null; }
  get hasCheckpoint(): boolean { return this.saved !== null; }
  private saveBoundary(): void { this.saved = { version: 1, game: this.game, level: this.level, score: this.score, cleared: this.phase === 'cleared', metrics: structuredClone(this.metrics), ...(this.phase === 'cleared' ? { summary: this.stageSummary() } : {}) }; this.checkpointRevision++; }
  private evaluate(): void {
    if (!this.program) return;
    const runtime = { ...this.runtime(), score: this.score, level: this.level, lives: this.lives, actions: this.metrics.actions, collected: this.metrics.scored, perfects: this.metrics.perfects };
    const evaluated = evaluateGameScript(this.program, this.base, runtime, this.schema); this.config = evaluated.config;
    for (const trace of evaluated.frame.traces) if (!this.metrics.ruleTraces.includes(trace.text)) this.metrics.ruleTraces = [...this.metrics.ruleTraces, trace.text].slice(-200);
  }
}
