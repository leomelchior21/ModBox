import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { ForgeRun, SIZE, canPlace, completedLines, rotateCells, readForgeCheckpoint, type Piece } from './run';
import { FORGE_DEFAULTS, FORGE_MODS, FORGE_TOOLS, forgeSchema, type ForgeConfig } from './mods';
import { FORGE_MISSIONS, FORGE_STARTER, FORGE_REMIX, forgeMissionPassed } from './missions';

const parse = (source: string) => parseGameScript<ForgeConfig>(source, 'csharp', forgeSchema);
const single = (id = 90): Piece => ({ id, cells: [[0, 0]], color: 1 });
const launch = (code = FORGE_REMIX) => { const run = new ForgeRun(42); run.setProgram(parse(code)); run.launch(); return run; };

describe('Block Forge puzzle rules', () => {
  it('offers a first clear, charges no time and rejects occupied or out-of-bounds placements atomically', () => {
    const run = new ForgeRun(); expect(run.place(0, 7, 6)).toBeNull(); run.launch();
    const board = [...run.board], tray = structuredClone(run.tray);
    for (const [row, col] of [[-1, 0], [7, 7], [7, 0], [0.5, 0], [8, 0]]) expect(run.place(0, row, col)).toBeNull();
    expect(run.board).toEqual(board); expect(run.tray).toEqual(tray); expect(run.score).toBe(0);
    const preview = run.preview(0, 7, 6); expect(preview?.lines).toBe(1); expect(run.board).toEqual(board);
    const result = run.place(0, 7, 6); expect(result).toEqual(preview); expect(run.lines).toBe(1); expect(run.score).toBe(110); expect(run.board.every(n => n === 0)).toBe(true);
  });
  it('clears a crossing row and column simultaneously and counts their intersection once', () => {
    const run = launch(); run.board.fill(0); run.tray = [single(), null, single(91)];
    for (let i = 1; i < SIZE; i++) { run.board[i] = 3; run.board[i * SIZE] = 4; }
    const result = run.place(0, 0, 0)!;
    expect(result.lines).toBe(2); expect(result.cleared).toHaveLength(15); expect(result.points).toBe(405);
    expect(run.metrics.multiClears).toBe(1); expect(run.board.every(n => n === 0)).toBe(true);
  });
  it('chains clearing moves, applies live bonuses on the next move, and breaks the combo on an ordinary placement', () => {
    const run = launch(); run.place(0, 7, 6); expect(run.config.comboBoost).toBe(true);
    run.board.fill(0); for (let c = 0; c < 7; c++) run.board[c] = 2;
    run.tray = [single(), single(91), null];
    const second = run.place(0, 0, 7)!; expect(second.combo).toBe(2); expect(second.points).toBe(255);
    run.place(1, 2, 2); expect(run.combo).toBe(0);
  });
  it('deals a tray only after all three pieces are placed and reproduces the same deal after undo', () => {
    const run = launch(); run.board.fill(0); run.tray = [single(), single(91), single(92)];
    run.place(0, 0, 0); expect(run.tray[0]).toBeNull(); run.place(1, 0, 1); expect(run.tray[1]).toBeNull();
    run.place(2, 0, 2); const deal = structuredClone(run.tray), score = run.score;
    expect(run.tray.every(Boolean)).toBe(true); expect(run.undo()).toBe(true); expect(run.moves).toBe(2); expect(run.tray[0]).toBeNull();
    run.place(2, 0, 2); expect(run.tray).toEqual(deal); expect(run.score).toBe(score);
  });
  it('undo restores cleared cells, scoring and live rule state without allowing repeated undo', () => {
    const run = launch(), board = [...run.board]; run.place(0, 7, 6);
    expect(run.config.comboBoost).toBe(true); expect(run.undo()).toBe(true);
    expect(run.board).toEqual(board); expect(run.lines).toBe(0); expect(run.score).toBe(0); expect(run.moves).toBe(0); expect(run.config.comboBoost).toBe(false); expect(run.metrics.ruleTraces).toEqual([]);
    expect(run.metrics.undos).toBe(1); expect(run.undo()).toBe(false);
  });
  it('finds a clearing hint without mutating the board and gates hint, rotation and undo behind mods', () => {
    const run = launch(FORGE_STARTER), board = [...run.board]; expect(run.hint()).toBeNull(); expect(run.rotate(0)).toBe(false);
    run.setProgram(parse(FORGE_REMIX)); const hint = run.hint()!; expect(run.preview(hint.slot, hint.row, hint.col)?.lines).toBe(1); expect(run.board).toEqual(board);
    expect(run.metrics.hints).toBe(1); const cells = structuredClone(run.tray[2]!.cells);
    for (let i = 0; i < 4; i++) expect(run.rotate(2)).toBe(true); expect(run.tray[2]!.cells).toEqual(cells);
  });
  it('recognizes a legal rotated move before ending a run', () => {
    const run = launch(); run.board.fill(1); run.board[0] = 0; run.board[8] = 0; run.tray = [{ id: 90, cells: [[0, 0], [0, 1]], color: 2 }, null, null];
    expect(run.hasMoves()).toBe(true); run.setProgram(parse('bool rotations = false;')); expect(run.hasMoves()).toBe(false);
    run.setProgram(parse('bool rotations = true;')); run.rotate(0); expect(run.preview(0, 0, 0)).not.toBeNull();
  });
  it('limits reshuffles, prevents undo across a reshuffle and handles a full board without hanging', () => {
    const run = launch(); run.place(0, 7, 6); run.reshuffle(); expect(run.canUndo).toBe(false); expect(run.rerolls).toBe(2);
    run.board.fill(1); run.reshuffle(); expect(run.phase).toBe('gameover'); expect(run.hasMoves()).toBe(false);
    run.reshuffle(); expect(run.rerolls).toBe(0); expect(run.reshuffle()).toBe(false); run.launch(); expect(run.rerolls).toBe(3); expect(run.phase).toBe('playing');
  });
  it('holds actions while paused and keeps the last valid config during syntax errors', () => {
    const run = launch(); run.pause(); const board = [...run.board];
    expect(run.place(0, 7, 6)).toBeNull(); expect(run.rotate(0)).toBe(false); expect(run.hint()).toBeNull(); expect(run.reshuffle()).toBe(false); expect(run.board).toEqual(board);
    run.setProgram(parse('int linePoints = ;')); expect(run.config.linePoints).toBe(150); run.resume(); expect(run.place(0, 7, 6)).not.toBeNull();
  });
  it('checks board boundaries and detects all complete lines', () => {
    expect(canPlace(Array(64).fill(0), [[0, 0]], NaN, 0)).toBe(false);
    expect(completedLines(Array(64).fill(1))).toMatchObject({ count: 16 }); expect(completedLines(Array(64).fill(1)).cells).toHaveLength(64);
    expect(rotateCells([[0, 0], [1, 0], [1, 1]])).toEqual([[0, 1], [0, 0], [1, 0]]);
  });
  it('validates and restores a saved board, tray and resources without sharing mutable state', () => {
    const run = launch(); run.place(0, 7, 6); run.rotate(1); run.reshuffle(); const saved = run.checkpoint();
    const restored = new ForgeRun(2026, saved); restored.setProgram(parse(FORGE_REMIX)); expect(restored.hasSavedBoard).toBe(true);
    restored.launch(false); expect(restored.board).toEqual(run.board); expect(restored.tray).toEqual(run.tray); expect(restored.score).toBe(run.score); expect(restored.rerolls).toBe(2); expect(restored.config.comboBoost).toBe(true);
    restored.board[0] = 6; expect(saved.board[0]).toBe(0); expect(restored.canUndo).toBe(false);
    expect(readForgeCheckpoint({ ...saved, board: [0] })).toBeNull(); expect(readForgeCheckpoint({ ...saved, rerolls: -1 })).toBeNull();
    expect(readForgeCheckpoint({ ...saved, tray: [{ ...saved.tray[0], cells: [[20, 0]] }, null, null] })).toBeNull();
    expect(readForgeCheckpoint({ ...saved, metrics: {} })).toBeNull(); expect(readForgeCheckpoint({ ...saved, combo: 999 })).toBeNull();
    expect(readForgeCheckpoint({ ...saved, phase: 'playing', evaluate: null })).not.toHaveProperty('evaluate');
    restored.launch(); expect(restored.lines).toBe(0); expect(restored.rerolls).toBe(3);
  });
});

describe('Block Forge learning and languages', () => {
  it.each(['python', 'swift', 'csharp'] as const)('parses every mod and starter in %s and executes the combo rule', language => {
    for (const source of [FORGE_STARTER, FORGE_REMIX, ...FORGE_MODS.map(m => m.example), ...FORGE_TOOLS.map(t => `bool comboBoost = false;\n${t.example}`)]) {
      const program = parseGameScript<ForgeConfig>(formatCodeForLanguage(source, language), language, forgeSchema);
      expect(program.diagnostics.filter(d => d.severity === 'error'), source).toEqual([]); expect(program.ok, source).toBe(true);
    }
    const run = new ForgeRun(); run.setProgram(parseGameScript<ForgeConfig>(formatCodeForLanguage(FORGE_REMIX, language), language, forgeSchema)); run.launch(); run.place(0, 7, 6); expect(run.config.comboBoost).toBe(true);
  });
  it.each(['python', 'swift', 'csharp'] as const)('starts basic and applies rotation, hints, undo and live rules without mission gates in %s', language => {
    const run = new ForgeRun(), basic = parseGameScript<ForgeConfig>(formatCodeForLanguage(FORGE_STARTER, language), language, forgeSchema);
    run.setProgram(basic); run.launch();
    expect(basic.config).toEqual(FORGE_DEFAULTS); expect(run.hint()).toBeNull(); expect(run.rotate(0)).toBe(false);
    run.setProgram(parseGameScript<ForgeConfig>(formatCodeForLanguage(FORGE_REMIX, language), language, forgeSchema));
    expect(run.rotate(2)).toBe(true); expect(run.hint()).not.toBeNull();
    expect(run.place(0, 7, 6)?.lines).toBe(1); expect(run.config.comboBoost).toBe(true); expect(run.undo()).toBe(true);
  });
  it('requires actual arithmetic, player actions and an executed current rule for completion', () => {
    const run = launch(); expect(forgeMissionPassed(FORGE_MISSIONS[2], parse('int linePoints = 150;'), run)).toBe(false);
    expect(forgeMissionPassed(FORGE_MISSIONS[2], parse(FORGE_REMIX), run)).toBe(true);
    for (const i of [3, 4, 5, 6]) expect(forgeMissionPassed(FORGE_MISSIONS[i], parse(FORGE_REMIX), run)).toBe(false);
    run.rotate(0); run.hint(); run.place(0, 0, 0); run.undo();
    for (const i of [3, 4, 5]) expect(forgeMissionPassed(FORGE_MISSIONS[i], parse(FORGE_REMIX), run)).toBe(true);
    run.launch(); run.place(0, 7, 6); expect(forgeMissionPassed(FORGE_MISSIONS[6], parse(FORGE_REMIX), run)).toBe(true);
    expect(forgeMissionPassed(FORGE_MISSIONS[6], parse('bool comboBoost = true;'), run)).toBe(false);
  });
});
