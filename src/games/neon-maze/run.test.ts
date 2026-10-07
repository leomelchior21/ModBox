import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { LanguageId } from '../../interpreter/core/adapter';
import { mazeSchema, type MazeConfig } from './mods';
import { cellKey, DIRECTIONS, neighbors, sameCell, type Cell, type Direction, type Maze } from './maze';
import { NeonMazeRun, type MazeInput } from './run';
const idle: MazeInput = { up: false, right: false, down: false, left: false, phase: false };
const parse = (source: string, language: LanguageId = 'csharp') => parseGameScript<MazeConfig>(formatCodeForLanguage(source, language), language, mazeSchema);
function corridorRun(branch = false): NeonMazeRun {
  const run = new NeonMazeRun(1); run.setProgram(parse('int sentinels = 0;')); run.launch();
  const tiles = Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3]]) tiles[y][x] = true;
  if (branch) for (let x = 4; x <= 7; x++) tiles[1][x] = true;
  run.maze = { size: 9, tiles, start: { x: 1, y: 1 }, exit: { x: 3, y: 3 }, cores: [] } satisfies Maze;
  run.player = { ...run.maze.start }; run.playerFrom = { ...run.player }; run.facing = 'right';
  return run;
}
function tick(run: NeonMazeRun, input = idle) { run.step(0.1, input); run.step(0.1, input); }
function travel(run: NeonMazeRun, goal: Cell) {
  const queue = [run.player], previous = new Map<string, Cell | null>([[cellKey(run.player), null]]);
  for (let i = 0; i < queue.length && !previous.has(cellKey(goal)); i++) for (const next of neighbors(run.maze, queue[i])) {
    if (!previous.has(cellKey(next))) { previous.set(cellKey(next), queue[i]); queue.push(next); }
  }
  const path = [goal];
  while (!sameCell(path.at(-1)!, run.player)) path.push(previous.get(cellKey(path.at(-1)!))!);
  for (const next of path.reverse().slice(1)) {
    const direction = (Object.keys(DIRECTIONS) as Direction[]).find(key => run.player.x + DIRECTIONS[key].x === next.x && run.player.y + DIRECTIONS[key].y === next.y)!;
    expect(run.move(direction)).toBe(true);
  }
}
describe('Neon Maze gameplay', () => {
  it('starts cruising without input and keeps moving after steering is released', () => {
    const run = corridorRun(true);
    tick(run); expect(run.player).toEqual({ x: 2, y: 1 });
    tick(run, { ...idle, right: true }); expect(run.player).toEqual({ x: 3, y: 1 });
    tick(run); expect(run.player).toEqual({ x: 4, y: 1 });
  });
  it('remembers an early turn until its corridor opens, even after key release', () => {
    const run = corridorRun(true); run.requestTurn('down');
    tick(run); expect(run.player).toEqual({ x: 2, y: 1 }); expect(run.facing).toBe('right');
    tick(run); expect(run.player).toEqual({ x: 3, y: 1 });
    tick(run); expect(run.player).toEqual({ x: 3, y: 2 }); expect(run.facing).toBe('down');
  });
  it('flows around corners and reverses at dead ends without stalling', () => {
    const run = corridorRun();
    for (const expected of [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }]) {
      const steps = run.metrics.steps; tick(run); expect(run.player).toEqual(expected); expect(run.metrics.steps).toBe(steps + 1);
    }
  });
  it('preserves its heading on a blocked turn and can phase toward a queued turn', () => {
    const run = corridorRun(true); run.maze.tiles[3][1] = true;
    expect(run.move('down')).toBe(false); expect(run.facing).toBe('right');
    run.requestTurn('down'); expect(run.phaseJump()).toBe(true); expect(run.player).toEqual({ x: 1, y: 3 });
  });
  it('honors speed mods throughout a continuous run', () => {
    const slow = corridorRun(), fast = corridorRun();
    slow.setProgram(parse('int sentinels = 0; int moveSpeed = 2;'));
    fast.setProgram(parse('int sentinels = 0; int moveSpeed = 8;'));
    for (let i = 0; i < 100; i++) { slow.step(0.02, idle); fast.step(0.02, idle); }
    expect(slow.metrics.steps).toBeGreaterThanOrEqual(5); expect(fast.metrics.steps).toBeGreaterThanOrEqual(17);
    expect(fast.metrics.steps).toBeGreaterThan(slow.metrics.steps * 2);
  });
  it('blocks walls and the maze boundary', () => {
    const run = new NeonMazeRun(2); run.launch();
    expect(run.move('up')).toBe(false); expect(run.move('left')).toBe(false);
    expect(run.player).toEqual(run.maze.start); expect(run.metrics.steps).toBe(0);
  });
  it('collects each core once, opens the exit and continues into a new sector', () => {
    const run = new NeonMazeRun(4); run.setProgram(parse('int sentinels = 0;')); run.launch();
    travel(run, run.maze.exit); expect(run.phase).toBe('playing');
    for (const core of run.maze.cores) travel(run, core);
    expect(run.collected.size).toBe(3); expect(run.metrics.cores).toBe(3); expect(run.score).toBe(150);
    const board = run.maze.tiles;
    travel(run, run.maze.exit); expect(run.phase).toBe('cleared'); expect(run.score).toBe(250);
    expect(run.metrics.exits).toBe(1);
    run.advance(); expect(run.phase).toBe('playing'); expect(run.level).toBe(2);
    expect(run.score).toBe(250); expect(run.collected.size).toBe(0); expect(run.maze.tiles).not.toEqual(board);
    run.restart(); expect(run.metrics.exits).toBe(0); expect(run.score).toBe(0);
  });
  it('phase jumps through a wall and respects recharge', () => {
    const run = new NeonMazeRun(12); run.launch();
    let location: Cell | undefined, direction: Direction = 'right';
    for (let y = 1; y < run.maze.size - 1; y++) for (let x = 1; x < run.maze.size - 3; x++) {
      if (run.maze.tiles[y][x] && !run.maze.tiles[y][x + 1] && run.maze.tiles[y][x + 2]) location = { x, y };
    }
    expect(location).toBeDefined(); run.player = location!;
    expect(run.move(direction)).toBe(false);
    expect(run.move(direction, true)).toBe(true); expect(run.player.x).toBe(location!.x + 2);
    expect(run.metrics.phases).toBe(1); expect(run.move('left', true)).toBe(false);
  });
  it('holds all simulation state while paused and freezes on game over', () => {
    const run = new NeonMazeRun(1); run.launch(); run.pause(); const state = run.snapshot(), player = { ...run.player };
    run.step(0.1, { ...idle, right: true, phase: true });
    expect(run.snapshot()).toEqual(state); expect(run.player).toEqual(player); expect(run.move('right')).toBe(false);
    run.resume(); expect(run.phase).toBe('playing');
    run.energy = 25; run.lives = 1; run.invulnerable = 0; run.sentinels = [{ ...run.player }];
    run.step(0, idle); expect(run.phase).toBe('gameover'); expect(run.energy).toBe(0);
    const lost = run.snapshot(); run.step(0.1, idle); expect(run.snapshot()).toEqual(lost);
  });
  it('absorbs one hit with the shield and takes energy damage while it recharges', () => {
    const run = new NeonMazeRun(1); run.setProgram(parse('bool shield = true;')); run.launch();
    run.invulnerable = 0; run.sentinels = [{ ...run.player }]; run.step(0, idle);
    expect(run.energy).toBe(100); expect(run.shieldCooldown).toBe(8);
    run.invulnerable = 0; run.sentinels = [{ ...run.player }]; run.step(0, idle);
    expect(run.energy).toBe(75); expect(run.metrics.hits).toBe(1);
  });
  it('respawns into continuous movement with a grace period and hunters away from the start', () => {
    const run = new NeonMazeRun(8); run.setProgram(parse('int sentinels = 4;')); run.launch();
    travel(run, run.maze.cores[0]);
    const collected = run.collected.size;
    run.energy = 25; run.invulnerable = 0; run.sentinels = [{ ...run.player }];
    run.step(0, idle);
    expect(run.lives).toBe(2); expect(run.energy).toBe(100); expect(run.invulnerable).toBe(2);
    expect(run.player).toEqual(run.maze.start); expect(run.collected.size).toBe(collected);
    expect(run.sentinels).toHaveLength(4); expect(run.sentinels.every(cell => !sameCell(cell, run.player))).toBe(true);
    tick(run); expect(run.player).not.toEqual(run.maze.start); expect(run.lives).toBe(2);
  });
  it('changes live mods without teleporting the runner and keeps the last valid program', () => {
    const run = new NeonMazeRun(1); run.launch(); const position = { ...run.player }, maze = run.maze;
    run.setProgram(parse('int sentinels = 4; int moveSpeed = 8; int mazeSize = 9;'));
    expect(run.sentinels).toHaveLength(4); expect(run.config.moveSpeed).toBe(8);
    expect(run.player).toEqual(position); expect(run.maze).toBe(maze);
    run.setProgram(parse('int moveSpeed = ;')); expect(run.config.moveSpeed).toBe(8);
    run.restart(); expect(run.maze.size).toBe(19);
  });
  it('moves sentinels toward the runner through valid corridors', () => {
    const run = new NeonMazeRun(8); run.launch(); const initial = run.sentinels.map(cellKey);
    for (let i = 0; i < 15; i++) run.step(0.1, idle);
    expect(run.sentinels.map(cellKey)).not.toEqual(initial);
    expect(run.sentinels.every(s => run.maze.tiles[s.y][s.x])).toBe(true);
  });
  it('keeps the shield recharge and reports live rule messages across code edits', () => {
    const run = new NeonMazeRun(1), program = parse('bool shield = false;\nif (score >= 100) { shield = true; Console.WriteLine("Shield online"); }');
    run.setProgram(program); run.launch(); run.score = 100; run.step(0, idle);
    expect(run.messages).toContain('Shield online');
    run.invulnerable = 0; run.sentinels = [{ ...run.player }]; run.step(0, idle);
    expect(run.shieldCooldown).toBe(8);
    run.setProgram(program); expect(run.shieldCooldown).toBe(8);
  });
});
describe.each<LanguageId>(['csharp', 'python', 'swift'])('%s maze mods and live rules', language => {
  it('runs score and energy rules from the custom catalog', () => {
    const run = new NeonMazeRun(3);
    const program = parse('bool shield = false;\nint phaseLength = 2;\nif (score >= 100)\n{\n    shield = true;\n}\nif (energy <= 40)\n{\n    phaseLength = 4;\n}', language);
    expect(program.ok).toBe(true); run.setProgram(program); run.launch();
    run.score = 100; run.energy = 25; run.step(0.01, idle);
    expect(run.config.shield).toBe(true); expect(run.config.phaseLength).toBe(4);
    expect(run.metrics.ruleTraces).toHaveLength(2);
    run.score = 0; run.energy = 100; run.step(0.01, idle);
    expect(run.config.shield).toBe(false); expect(run.config.phaseLength).toBe(2);
  });
});
