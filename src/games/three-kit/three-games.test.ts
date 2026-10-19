import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { RunnerRun, runnerCourse, runnerFrame } from './runner';
import { TeamRun, gateResult } from '../team-counters/run';
import { MonsterRun, trackHeight } from '../monster-strider/run';
import { RoombaRun, ROOM, cellPoint, roomBlocked, roomPath } from '../roomba-run/run';
import { templeCatalog } from '../temple-race/catalog';
import { subwayCatalog } from '../subway-runnerz/catalog';
import { teamCatalog } from '../team-counters/catalog';
import { monsterCatalog } from '../monster-strider/catalog';
import { roombaCatalog } from '../roomba-run/catalog';
import type { ArcadeConfig, ArcadeRun } from '../premium-kit/core';

const games = [
  { id: 'temple-race', catalog: templeCatalog, create: (save?: unknown) => new RunnerRun('temple', save) },
  { id: 'subway-runnerz', catalog: subwayCatalog, create: (save?: unknown) => new RunnerRun('subway', save) },
  { id: 'team-counters', catalog: teamCatalog, create: (save?: unknown) => new TeamRun(save) },
  { id: 'monster-strider', catalog: monsterCatalog, create: (save?: unknown) => new MonsterRun(save) },
  { id: 'roomba-run', catalog: roombaCatalog, create: (save?: unknown) => new RoombaRun(save) },
];
const advance = (run: ArcadeRun, seconds: number) => { for (let i = 0; i < seconds * 60; i++) run.step(1 / 60); };

describe.each(games)('$id scripts and saves', ({ id, catalog, create }) => {
  it.each(['python', 'swift', 'csharp'] as const)('starts fully playable, parses every mod and runtime recipe in %s', language => {
    const parse = (source: string) => parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, catalog.schema);
    for (const source of [catalog.starter, catalog.remix, ...catalog.mods.map(m => m.example), ...catalog.tools.map(t => `${catalog.starter}\n${t.example}`)]) {
      const p = parse(source); expect(p.diagnostics.filter(d => d.severity === 'error'), source).toEqual([]); expect(p.ok).toBe(true);
    }
    const run = create(); run.setProgram(parse(catalog.starter)); run.launch(); expect(run.config).toEqual(catalog.defaults); expect(run.phase).toBe('playing'); expect(run.config.assist).toBe(false); expect(run.config.overdrive).toBe(false);
    run.setProgram(parse(catalog.remix)); expect(run.config.assist).toBe(true); run.score = 10; run.step(.01); expect(run.config.overdrive).toBe(true);
  });
  it('retains the last valid program, bounds settings and holds all simulation while paused', () => {
    const run = create(), parse = (s: string) => parseGameScript<ArcadeConfig>(s, 'csharp', catalog.schema);
    run.setProgram(parse(catalog.starter)); run.launch(); run.setProgram(parse(`int ${catalog.mods.find(m => m.id === 'power')!.name} = 99999;`)); expect(run.config.power).toBe(catalog.mods.find(m => m.id === 'power')!.limits!.max);
    const config = { ...run.config }; run.setProgram(parse('int broken = ;')); expect(run.config).toEqual(config);
    run.input.left = true; run.pause(); const elapsed = run.elapsed, score = run.score; advance(run, 2); run.action('primary'); expect(run.elapsed).toBe(elapsed); expect(run.score).toBe(score); expect(run.input.left).toBe(false);
  });
  it('isolates stage checkpoints, validates game ownership and safely retries', () => {
    const run = create(); run.launch(); const saved = run.checkpoint!; const copy = create(saved); copy.launch(); expect(copy.game).toBe(id); expect(copy.level).toBe(1); expect(copy.score).toBe(saved.score);
    copy.metrics.actions++; expect(saved.metrics.actions).toBe(0); const other = create({ ...saved, game: 'other' }); expect(other.hasCheckpoint).toBe(false);
    run.score = 999; run.launch(); expect(run.score).toBe(saved.score); expect(run.phase).toBe('playing');
    expect(create({ ...saved, summary: { patches: NaN } }).hasCheckpoint).toBe(false); expect(create({ ...saved, summary: { team: 'many' } }).hasCheckpoint).toBe(false);
  });
});

describe('3D runner routes and collision rules', () => {
  it.each(['temple', 'subway'] as const)('offers a fair route through %s at several difficulties with basic controls', theme => {
    for (const level of [1, 2, 5, 12]) {
      const run = new RunnerRun(theme); run.level = level; run.launch();
      for (let frame = 0; frame < 60 * 140 && run.phase === 'playing'; frame++) {
        const turn = run.nextTurn; if (turn && turn.at - run.distance < 10 && !turn.queued) run.action(turn.direction > 0 ? 'right' : 'left');
        const obstacle = run.obstacles.find(o => !o.passed && !o.hit && o.at - run.distance < 8 && o.at + o.length > run.distance);
        if (obstacle && run.lane === obstacle.lane && (!turn || turn.at - run.distance > 14)) run.action(obstacle.lane === -1 ? 'right' : 'left');
        run.step(1 / 60);
      }
      expect(run.phase, `${theme} level ${level}`).toBe('cleared'); expect(run.lives).toBeGreaterThan(0); expect(run.metrics.clears).toBe(1); expect(run.score).toBeGreaterThan(0);
      const restored = new RunnerRun(theme, run.checkpoint); restored.launch(); expect(restored.distance).toBe(run.goal); expect(restored.coins).toBe(run.coins); expect(restored.lives).toBe(run.lives); expect(restored.phase).toBe('cleared');
    }
  });
  it('uses real right-angle path frames and keeps obstacle rows away from turn windows', () => {
    const p = runnerFrame(82, 'temple'); expect(p.x).toBeCloseTo(10); expect(p.z).toBeCloseTo(-72); expect(p.yaw).toBeCloseTo(-Math.PI / 2);
    for (let level = 1; level <= 30; level++) { const c = runnerCourse('temple', level); for (const o of c.obstacles) expect(c.turns.every(t => Math.abs(t.at - o.at) >= 14)).toBe(true); }
  });
  it('jumps over a barrier, slides under an arch and spends one charm for one collision', () => {
    const run = new RunnerRun('subway'); run.launch(); const barrier = run.obstacles.find(o => o.kind === 'hurdle')!;
    run.distance = barrier.at - 2; run.x = run.lane = 0; barrier.lane = 0; run.invulnerable = 0; run.action('primary'); advance(run, .3); expect(barrier.hit).toBe(false); expect(run.y).toBeGreaterThan(.8);
    const arch = run.obstacles.find(o => o.kind === 'arch')!; run.y = 0; run.vy = 0; run.distance = arch.at - .1; arch.lane = 0; run.action('down'); advance(run, .1); expect(arch.hit).toBe(false);
    run.slide = 0; run.y = 0; run.distance = barrier.at - .05; barrier.hit = false; barrier.passed = false; run.invulnerable = 0; advance(run, .05); expect(run.lives).toBe(2); advance(run, .05); expect(run.lives).toBe(2);
  });
  it('takes continuous ramps onto roofs, moves oncoming trains and lets a board absorb one hit', () => {
    const run = new RunnerRun('subway'); run.launch(); const ramp = run.obstacles.find(o => o.ramp)!;
    run.distance = ramp.at - 5; run.lane = ramp.lane; run.x = ramp.lane * 2.15; advance(run, .6); expect(run.y).toBeCloseTo(2.6, 1); expect(ramp.hit).toBe(false);
    const other = new RunnerRun('subway'); other.launch(); const incoming = other.obstacles.find(o => o.moving)!; const at = incoming.at; advance(other, .1); expect(incoming.at).toBeLessThan(at);
    other.config.overdrive = true; other.action('ability'); expect(other.shield).toBe(9); other.invulnerable = 0; other.distance = incoming.at; other.x = incoming.lane * 2.15; other.lane = incoming.lane; other.y = 0; other.vy = 0; other.step(.01); expect(other.lives).toBe(3); expect(other.shield).toBe(0);
  });
  it('applies magnets and runtime conditions immediately and rejects unrelated touch pointers', () => {
    const run = new RunnerRun('temple'); run.launch(); run.tokens = [{ at: 1, lane: 1, y: .9, taken: false }]; run.distance = .95; run.step(.01); expect(run.coins).toBe(0);
    run.setProgram(parseGameScript<ArcadeConfig>('bool coinMagnet = true;\nbool relicShield = false;\nif (distance >= 100) { relicShield = true; }', 'csharp', templeCatalog.schema)); run.step(.01); expect(run.coins).toBe(1); expect(run.metrics.assisted).toBe(1);
    run.distance = 100; run.step(.01); expect(run.config.overdrive).toBe(true);
    run.pointer('down', 500, 300, 1); run.pointer('up', 700, 300, 2); expect(run.lane).toBe(0); run.pointer('up', 700, 300, 1); expect(run.lane).toBe(1);
  });
});

describe('Team Counters decisions', () => {
  it('evaluates arithmetic in order, rounds division, and bounds crowds without losing the displayed count', () => {
    expect(gateResult(7, { op: '+', value: 75 })).toBe(82); expect(gateResult(7, { op: '×', value: 10 })).toBe(70); expect(gateResult(31, { op: '÷', value: 2 })).toBe(15); expect(gateResult(5, { op: '-', value: 10 })).toBe(0); expect(gateResult(4999, { op: '×', value: 10 })).toBe(5000); expect(gateResult(10, { op: '+', value: 10 }, 5)).toBe(25);
  });
  it('wins the castle with informed basic choices, avoids saws and scores the finale once', () => {
    for (const level of [1, 2, 8]) {
      const run = new TeamRun(); run.level = level; run.launch();
      for (let i = 0; i < 60 * 60 && run.phase === 'playing'; i++) {
        const gate = run.nextGate, trap = run.traps.find(t => !t.hit && Math.abs(t.at - run.distance) < 7);
        if (gate && gate.at - run.distance < 10) { const choices = run.preview(gate); run.targetX = choices[0] > choices[1] ? -2.3 : 2.3; }
        else if (trap) run.targetX = run.trapX(trap) > 0 ? -2.5 : 2.5;
        run.step(1 / 60);
      }
      expect(run.phase, `level ${level}`).toBe('cleared'); expect(run.team).toBeGreaterThan(0); expect(run.metrics.clears).toBe(1); expect(run.victory).toBeGreaterThan(1);
      const score = run.score; advance(run, 1); expect(run.score).toBe(score);
      const restored = new TeamRun(run.checkpoint); restored.launch(); expect(restored.team).toBe(run.team); expect(restored.victory).toBe(run.victory); expect(restored.distance).toBe(run.goal);
    }
  });
  it('rewinds a losing choice without duplicating score, and keeps rally and shield cooldowns honest', () => {
    const run = new TeamRun(); run.launch(); run.action('primary'); expect(run.team).toBe(13); run.action('primary'); expect(run.team).toBe(13);
    run.gates[0].options = [{ op: '-', value: 100 }, { op: '+', value: 20 }]; run.x = run.targetX = -2; run.distance = 15.99; run.step(.01); expect(run.lives).toBe(2); expect(run.team).toBe(13); expect(run.score).toBe(0); expect(run.gates[0].used).toBe(false);
    run.config.overdrive = true; run.action('ability'); expect(run.shield).toBe(6); run.action('ability'); expect(run.shieldCooldown).toBe(14);
  });
});

describe('Monster Strider vehicle simulation', () => {
  it('accelerates, brakes, traverses both gaps and reaches the finish with basic physics', () => {
    const run = new MonsterRun(); run.launch(); run.input.right = true;
    let wasAirborne = false;
    for (let i = 0; i < 60 * 50 && run.phase === 'playing'; i++) { run.step(1 / 60); wasAirborne ||= !run.grounded; }
    expect(wasAirborne).toBe(true); expect(run.phase).toBe('cleared'); expect(run.metrics.perfects).toBeGreaterThan(0); expect(run.lives).toBe(3);
    const restored = new MonsterRun(run.checkpoint); restored.launch(); expect(restored.x).toBe(restored.goal); expect(restored.coins).toEqual(run.coins); expect(restored.phase).toBe('cleared');
    expect(trackHeight(25)).toBeNull(); expect(trackHeight(90)).toBeNull();
    const other = new MonsterRun(); other.launch(); other.input.right = true; advance(other, 1); const speed = other.velocity; other.input.right = false; other.input.left = true; advance(other, .5); expect(other.velocity).toBeLessThan(speed);
  });
  it('recovers from a fall at a safe checkpoint, applies stabilization and respects multiple touch holds', () => {
    const run = new MonsterRun(); run.launch(); run.pointer('down', 900, 200, 1); run.pointer('down', 100, 200, 2); run.pointer('up', 900, 200, 1); expect(run.input.right).toBe(false); expect(run.input.left).toBe(true); run.pointer('cancel', 0, 0); expect(run.input.left).toBe(false);
    run.invulnerable = 0; run.y = -6; run.grounded = false; run.step(.01); expect(run.lives).toBe(2); expect(run.x).toBe(2); expect(run.y).toBeGreaterThan(0);
    run.config.assist = true; run.action('primary'); run.pitch = .5; advance(run, .7); expect(Math.abs(run.pitch)).toBeLessThan(.5); expect(run.metrics.assisted).toBeGreaterThan(0);
  });
});

describe('Roomba Run cleaning and navigation', () => {
  it('excludes unreachable furniture cells and plans legal paths under the tables', () => {
    const run = new RoombaRun(); run.launch(); expect(run.cells.length).toBeGreaterThan(400);
    for (const cell of run.cells) expect(roomBlocked(cell.x, cell.z)).toBe(false);
    const start = [...run.walkable][0], goal = [...run.walkable].at(-1)!, path = roomPath(start, goal, run.walkable); expect(path.length).toBeGreaterThan(0);
    for (const cell of path) { const point = cellPoint(cell); expect(roomBlocked(point.x, point.z)).toBe(false); }
    expect(roomBlocked(1.7, -.3)).toBe(false); expect(roomBlocked(-3.4, -2.65)).toBe(true);
  });
  it('cleans visibly, cannot score the same patch twice and preserves dirt progress when recharging', () => {
    const run = new RoombaRun(); run.launch(); const cell = run.cells.find(c => Math.hypot(c.x, c.z) < .6)!; run.x = cell.x; run.z = cell.z; advance(run, 1);
    expect(run.cleanedCells).toBeGreaterThan(0); const score = run.score, count = run.cleanedCells; advance(run, 1); expect(run.score).toBe(score); expect(run.cleanedCells).toBe(count);
    run.x = ROOM.dockX; run.z = ROOM.dockZ; run.battery = 10; run.action('primary'); advance(run, 3); expect(run.battery).toBeGreaterThan(60); expect(run.cleanedCells).toBeGreaterThanOrEqual(count);
  });
  it('lets a real smart route finish the room and dock within the available battery packs', () => {
    const run = new RoombaRun(); run.setProgram(parseGameScript<ArcadeConfig>('bool smartRoute = true;', 'csharp', roombaCatalog.schema)); run.launch();
    for (let i = 0; i < 60 * 360 && run.phase === 'playing'; i++) run.step(1 / 60);
    expect(run.phase, `${run.coverage}% at ${run.x},${run.z}, battery ${run.battery}`).toBe('cleared'); expect(run.coverage).toBeGreaterThanOrEqual(90); expect(run.dockDistance).toBeLessThan(.72); expect(run.lives).toBeGreaterThan(0); expect(run.metrics.assisted).toBeGreaterThan(0);
    const restored = new RoombaRun(run.checkpoint); restored.launch(); expect(restored.coverage).toBe(run.coverage); expect(restored.battery).toBe(run.battery); expect(restored.phase).toBe('cleared');
  });
  it('reacts to low battery through the interpreter and returns to charge without resetting the room', () => {
    const run = new RoombaRun(); run.setProgram(parseGameScript<ArcadeConfig>('bool smartRoute = false;\nif (battery <= 25) { smartRoute = true; }', 'csharp', roombaCatalog.schema)); run.launch(); run.x = 3; run.z = 2; run.battery = 24;
    advance(run, .1); expect(run.config.assist).toBe(true); expect(run.docking).toBe(false); run.battery = 20; advance(run, 12); expect(run.dockDistance).toBeLessThan(.72); expect(run.battery).toBeGreaterThan(25);
    expect(run.metrics.ruleTraces.some(t => t.includes('smartRoute'))).toBe(true);
  });
});
