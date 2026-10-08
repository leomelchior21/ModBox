import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { LanguageId } from '../../interpreter/core/adapter';
import { mazeSchema, type MazeConfig } from './mods';
import { cellKey, DIRECTIONS, distances, neighbors, sameCell, type Cell, type Direction, type Maze } from './maze';
import { NeonMazeRun, type MazeInput } from './run';
const idle: MazeInput = { up: false, right: false, down: false, left: false, phase: false };
const parse = (source: string, language: LanguageId = 'csharp') => parseGameScript<MazeConfig>(formatCodeForLanguage(source, language), language, mazeSchema);
function corridorRun(branch = false): NeonMazeRun {
  const run = new NeonMazeRun(1); run.setProgram(parse('int sentinels = 0;')); run.launch();
  const tiles = Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3]]) tiles[y][x] = true;
  if (branch) for (let x = 4; x <= 7; x++) tiles[1][x] = true;
  run.maze = { size: 9, tiles, start: { x: 1, y: 1 }, exit: { x: 3, y: 3 }, cores: [] } satisfies Maze;
  run.player = { ...run.maze.start }; run.playerFrom = { ...run.player }; run.facing = 'right'; run.dots.clear();
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
  it('stops at corners and dead ends until the player changes direction', () => {
    const run = corridorRun();
    tick(run); tick(run);
    for (let i = 0; i < 10; i++) tick(run, { ...idle, right: true });
    expect(run.player).toEqual({ x: 3, y: 1 }); expect(run.metrics.steps).toBe(2);
    run.step(0.016, { ...idle, down: true }); expect(run.player).toEqual({ x: 3, y: 2 });
    tick(run); tick(run); expect(run.player).toEqual({ x: 3, y: 3 });
    for (let i = 0; i < 10; i++) tick(run);
    expect(run.player).toEqual({ x: 3, y: 3 }); expect(run.facing).toBe('down');
    run.step(0.016, { ...idle, up: true }); expect(run.player).toEqual({ x: 3, y: 2 });
  });
  it('reverses immediately during a step without a visual snap', () => {
    const run = corridorRun(true); run.move('right'); run.step(0.05, idle);
    const position = run.playerPosition();
    run.requestTurn('left'); expect(run.playerPosition().x).toBeCloseTo(position.x);
    run.step(0.02, { ...idle, left: true }); expect(run.playerPosition().x).toBeLessThan(position.x);
    expect(run.facing).toBe('left');
  });
  it('damages visible overlapping actors even when their target tiles differ', () => {
    const run = corridorRun(true); run.move('right'); run.moveAge = 0.15;
    run.sentinels = [{ x: 3, y: 1 }]; run.sentinelFrom = [{ x: 2, y: 1 }];
    run.sentinelDuration = 0.2; run.sentinelAge = 0.05; run.invulnerable = 0;
    run.step(0, idle); expect(run.energy).toBe(75); expect(run.metrics.hits).toBe(1);
    run.step(0, idle); expect(run.energy).toBe(75);
  });
  it('starts phase jumps from the visible orb and keeps an active segment stable through speed edits', () => {
    const run = corridorRun(true); run.move('right'); run.step(0.05, idle);
    const position = run.playerPosition(), duration = run.moveDuration;
    run.setProgram(parse('int sentinels = 0; int moveSpeed = 8;'));
    expect(run.playerPosition()).toEqual(position); expect(run.moveDuration).toBe(duration);
    run.phaseJump(); expect(run.playerPosition()).toEqual(position);
    expect(run.moveDuration).toBe(0.12); expect(run.metrics.phases).toBe(1);
  });
  it('preserves its heading on a blocked turn and can phase toward a queued turn', () => {
    const run = corridorRun(true); run.maze.tiles[3][1] = true;
    expect(run.move('down')).toBe(false); expect(run.facing).toBe('right');
    run.requestTurn('down'); expect(run.phaseJump()).toBe(true); expect(run.player).toEqual({ x: 1, y: 3 });
  });
  it('honors speed mods throughout a continuous run', () => {
    const slow = corridorRun(), fast = corridorRun();
    for (const run of [slow, fast]) run.maze = { ...run.maze, size: 102,
      tiles: Array.from({ length: 3 }, (_, y) => Array.from({ length: 102 }, (_, x) => y === 1 && x > 0 && x < 101)) };
    slow.setProgram(parse('int sentinels = 0; int moveSpeed = 2;'));
    fast.setProgram(parse('int sentinels = 0; int moveSpeed = 8;'));
    for (let i = 0; i < 100; i++) { slow.step(0.02, idle); fast.step(0.02, idle); }
    expect(slow.metrics.steps).toBeGreaterThanOrEqual(5); expect(fast.metrics.steps).toBeGreaterThanOrEqual(17);
    expect(fast.metrics.steps).toBeGreaterThan(slow.metrics.steps * 2);
  });
  it('blocks walls and the maze boundary', () => {
    const run = new NeonMazeRun(2); run.launch();
    run.player = { x: 1, y: 1 };
    expect(run.move('up')).toBe(false); expect(run.move('left')).toBe(false);
    expect(run.player).toEqual({ x: 1, y: 1 }); expect(run.metrics.steps).toBe(0);
  });
  it('collects each core once, opens the exit and continues into a new sector', () => {
    const run = new NeonMazeRun(4); run.setProgram(parse('int sentinels = 0;')); run.launch();
    travel(run, run.maze.exit); expect(run.phase).toBe('playing');
    for (const core of run.maze.cores) travel(run, core);
    expect(run.collected.size).toBe(3); expect(run.metrics.cores).toBe(3);
    expect(run.score).toBe(150 + run.metrics.dots * 5);
    const board = run.maze.tiles;
    travel(run, run.maze.exit); expect(run.phase).toBe('playing');
    expect(run.score).toBe(250 + run.metrics.dots * 5);
    expect(run.metrics.exits).toBe(1);
    expect(run.level).toBe(2); expect(run.collected.size).toBe(0); expect(run.maze.tiles).not.toEqual(board);
    expect(run.stunRemaining).toBeGreaterThan(0); expect(run.player).toEqual(run.maze.start);
    const score = run.score; tick(run); expect(run.metrics.steps).toBeGreaterThan(0); expect(run.score).toBeGreaterThanOrEqual(score);
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
    run.energy = 25; run.invulnerable = 0; run.stunRemaining = 0; run.sentinels = [{ ...run.player }];
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
    run.restart(); expect(run.maze.size).toBe(37);
  });
  it('moves sentinels toward the runner through valid corridors', () => {
    const run = new NeonMazeRun(8); run.launch(); const initial = run.sentinels.map(cellKey);
    for (let i = 0; i < 15; i++) run.step(0.1, idle);
    expect(run.sentinels.map(cellKey)).not.toEqual(initial);
    expect(run.sentinels.every(s => run.maze.tiles[s.y][s.x])).toBe(true);
  });
  it('spawns distinct hunters within chasing distance, with room to escape', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = new NeonMazeRun(seed); run.setProgram(parse('int sentinels = 5;')); run.launch();
      const paths = distances(run.maze, run.player);
      expect(run.sentinels).toHaveLength(5); expect(new Set(run.sentinels.map(cellKey)).size).toBe(5);
      expect(run.sentinels.every(s => paths.get(cellKey(s))! >= 6 && paths.get(cellKey(s))! <= 16)).toBe(true);
    }
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

describe('Rolling maze collectibles and stun', () => {
  it('places dots only on reachable corridors, apart from the start, gems and gate', () => {
    const run = new NeonMazeRun(7); run.launch();
    expect(run.dots.size).toBeGreaterThan(100);
    const excluded = [run.maze.start, run.maze.exit, ...run.maze.cores].map(cellKey);
    expect(excluded.every(key => !run.dots.has(key))).toBe(true);
    for (const key of run.dots) {
      const [x, y] = key.split(',').map(Number); expect(run.maze.tiles[y][x]).toBe(true);
    }
  });
  it('scores a dot only once, keeps it collected after a life loss, and restores it on restart', () => {
    const run = corridorRun(); run.dots.add('2,1');
    run.move('right'); expect(run.score).toBe(5); expect(run.snapshot().dots).toBe(1);
    run.move('left'); run.move('right'); expect(run.score).toBe(5); expect(run.metrics.dots).toBe(1);
    run.energy = 25; run.invulnerable = 0; run.sentinels = [{ ...run.player }]; run.step(0, idle);
    expect(run.collectedDots.has('2,1')).toBe(true);
    run.restart(); expect(run.collectedDots.size).toBe(0); expect(run.metrics.dots).toBe(0); expect(run.score).toBe(0);
  });
  it('freezes the whole sentinel squad and prevents contact damage during a gem stun', () => {
    const run = corridorRun(true); run.maze.cores = [{ x: 2, y: 1 }];
    run.move('right'); expect(run.stunRemaining).toBe(6); expect(run.score).toBe(50);
    run.sentinels = [{ x: 2, y: 1 }, { x: 5, y: 1 }]; run.sentinelFrom = run.sentinels.map(c => ({ ...c })); run.invulnerable = 0;
    const hunters = run.sentinels.map(c => ({ ...c }));
    run.step(0, idle); expect(run.energy).toBe(100);
    for (let i = 0; i < 20; i++) run.step(0.1, idle);
    expect(run.sentinels).toEqual(hunters); expect(run.metrics.hits).toBe(0); expect(run.stunRemaining).toBeCloseTo(4);
    expect(run.metrics.steps).toBeGreaterThan(1);
  });
  it('resumes danger when stun expires and holds the countdown while paused', () => {
    const run = corridorRun(); run.stunRemaining = 0.1;
    run.pause(); const state = run.snapshot(); run.step(0.1, idle); expect(run.snapshot()).toEqual(state);
    run.resume(); run.invulnerable = 0; run.sentinels = [{ ...run.player }]; run.step(0.1, idle);
    expect(run.stunRemaining).toBe(0); expect(run.energy).toBe(75); expect(run.metrics.hits).toBe(1);
    run.restart(); expect(run.stunRemaining).toBe(0);
  });
  it('refreshes stun on a new gem, but revisiting a collected gem gives no extra points or stun', () => {
    const run = corridorRun(); run.maze.cores = [{ x: 2, y: 1 }, { x: 3, y: 1 }];
    run.move('right'); run.stunRemaining = 1; run.move('right');
    expect(run.stunRemaining).toBe(6); expect(run.score).toBe(100);
    run.stunRemaining = 2; run.move('left'); expect(run.stunRemaining).toBe(2); expect(run.score).toBe(100);
  });
});
describe.each<LanguageId>(['csharp', 'python', 'swift'])('%s maze mods and live rules', language => {
  it('uses the gem duration mod and exposes dot and stun values to live rules', () => {
    const run = corridorRun();
    const program = parse(['int sentinels = 0;', 'int gemDuration = 9;', 'bool shield = false;', 'int phaseLength = 2;', 'if (dots >= 1)', '{', '    shield = true;', '}', 'if (stun > 0)', '{', '    phaseLength = 4;', '}'].join('\n'), language);
    expect(program.ok, JSON.stringify(program.diagnostics)).toBe(true); run.setProgram(program);
    run.dots.add('2,1'); run.maze.cores = [{ x: 3, y: 1 }];
    run.move('right'); expect(run.config.shield).toBe(true);
    run.move('right'); expect(run.stunRemaining).toBe(9); expect(run.config.phaseLength).toBe(4);
  });
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
