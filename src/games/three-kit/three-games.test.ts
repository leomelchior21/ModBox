import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { RunnerRun, runnerCourse, runnerFrame } from './runner';
import { TeamRun, gateResult } from '../team-counters/run';
import { MonsterRun } from '../monster-strider/run';
import { MONSTER_LEVELS } from '../monster-strider/levels';
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
  /** A fair human-like driver: throttle on the ground, and counter-steering pitch in the air. */
  const drive = (run: MonsterRun, seconds: number, until: () => boolean = () => false, jitter = false) => {
    for (let i = 0; i < seconds * 60 && run.phase === 'playing' && !until(); i++) {
      run.input.right = true; run.input.left = false;
      if (run.airtime > .1) { if (run.angle - .12 * run.spinRate > .25) { run.input.right = false; run.input.left = true; } else if (run.angle < -.3 || run.spinRate < -2.5) run.input.right = true; else run.input.right = run.angle < 0; }
      else if (run.angle > .75) run.input.right = false;
      run.step(jitter ? 1 / 144 + (i * 7919 % 1000) / 1000 * (1 / 20 - 1 / 144) : 1 / 60);
    }
  };
  const teleport = (run: MonsterRun, dx: number, dy: number, flip = false) => {
    const p = run.course.sim.p, t = run.course.truck, cx = run.x, cy = run.y + 1.8;
    for (const id of [...Object.values(t.parts), ...t.wheels]) { const q = p[id]; q.x = flip ? 2 * cx - q.x : q.x + dx; q.y = flip ? 2 * cy - q.y : q.y + dy; q.px = q.x; q.py = q.y; q.vx = q.vy = 0; }
  };
  it('clears the first course just by holding GAS, with air time, landings and a restorable finish', () => {
    const run = new MonsterRun(); run.launch(); run.input.right = true; let airborne = false;
    for (let i = 0; i < 60 * 20 && run.phase === 'playing'; i++) { run.step(1 / 60); airborne ||= run.airtime > .3; }
    expect(run.phase).toBe('cleared'); expect(airborne).toBe(true); expect(run.lives).toBe(3); expect(run.finishTime).toBeGreaterThan(5); expect(run.finishTime).toBeLessThan(10);
    expect(run.metrics.scored).toBeGreaterThan(1); expect(run.score).toBeGreaterThan(300);
    const restored = new MonsterRun(run.checkpoint); restored.launch(); expect(restored.phase).toBe('cleared'); expect(restored.x).toBeGreaterThan(restored.goal - 3);
    expect(restored.coins).toEqual(run.coins); expect(restored.finishTime).toBeCloseTo(run.finishTime, 1);
  });
  it('offers a fair route through every course at any frame rate, and pars are reachable', () => {
    expect(MONSTER_LEVELS.length).toBeGreaterThanOrEqual(20); expect(new Set(MONSTER_LEVELS.map(l => l.name)).size).toBe(MONSTER_LEVELS.length);
    for (let level = 1; level <= MONSTER_LEVELS.length; level++) {
      const run = new MonsterRun(); run.level = level; run.launch(); drive(run, 40, undefined, true);
      expect(run.phase, `level ${level} ${run.stage.name} at x=${run.x.toFixed(1)}`).toBe('cleared'); expect(run.lives, `level ${level} ${run.stage.name}`).toBe(3); expect(run.finishTime).toBeLessThan(run.stage.par);
    }
  });
  it('sags rope bridges under the truck, drops crumbling boards and tips seesaws', () => {
    const rope = new MonsterRun(); rope.launch(); const p = rope.course.sim.p, chain = rope.course.planks.map(plank => plank.a), rest = chain.map(id => p[id].y); let dip = 0;
    drive(rope, 6, () => { dip = Math.max(dip, ...chain.map((id, i) => rest[i] - p[id].y)); return rope.x > 22; }); expect(dip).toBeGreaterThan(.12); expect(rope.lives).toBe(3);
    const crumble = new MonsterRun(); crumble.level = 6; crumble.launch(); drive(crumble, 6, () => crumble.x > 27);
    expect(crumble.course.planks.filter(plank => plank.fallen).length).toBeGreaterThan(8); expect(crumble.lives).toBe(3);
    const seesaw = new MonsterRun(); seesaw.level = 3; seesaw.launch(); const left = seesaw.course.sim.p[seesaw.course.seesaws[0].left], start = left.y;
    drive(seesaw, 6, () => seesaw.x > 21); expect(left.y).toBeGreaterThan(start + .5);
  });
  it('brakes, reverses, ends a roof landing and a splash with spare trucks at the last checkpoint', () => {
    const run = new MonsterRun(); run.launch(); run.input.right = true; advance(run, 1.2); const speed = run.velocity; expect(speed).toBeGreaterThan(5);
    run.input.right = false; run.input.left = true; advance(run, .5); expect(run.velocity).toBeLessThan(speed); advance(run, 2.5); expect(run.velocity).toBeLessThan(0);
    run.input.left = false; advance(run, 1); teleport(run, 0, 0, true); advance(run, .7); expect(run.crash?.message).toMatch(/ROOF/);
    advance(run, 1.6); expect(run.crash).toBeNull(); expect(run.lives).toBe(2); expect(Math.abs(run.angle)).toBeLessThan(.2); expect(run.x).toBeCloseTo(run.stage.start, 0);
    drive(run, 8, () => run.safeX === 28 || run.x > 37); expect(run.safeX).toBe(28); teleport(run, -16 - run.x, 1); for (let i = 0; i < 240 && !run.crash; i++) run.step(1 / 60); expect(run.crash?.splash).toBe(true); expect(run.splash).not.toBeNull();
    advance(run, 1.6); expect(run.lives).toBe(1); expect(run.x).toBeCloseTo(28, 0); expect(run.phase).toBe('playing');
  });
  it('stabilizes in the air through code, counts assisted landings and respects multiple touch holds', () => {
    const run = new MonsterRun(); run.setProgram(parseGameScript<ArcadeConfig>('bool autoBalance = false;\nif (airborne > 0) { autoBalance = true; }', 'csharp', monsterCatalog.schema)); run.level = 2; run.launch();
    let tilt = 0; for (let i = 0; i < 60 * 30 && run.phase === 'playing'; i++) { run.input.right = true; run.step(1 / 60); if (run.airtime > .4) tilt = Math.max(tilt, Math.abs(run.angle)); }
    expect(run.phase).toBe('cleared'); expect(run.metrics.assisted).toBeGreaterThan(0); expect(tilt).toBeLessThan(.6); expect(run.metrics.ruleTraces.some(t => t.includes('autoBalance'))).toBe(true);
    const touch = new MonsterRun(); touch.launch(); touch.pointer('down', 900, 200, 1); touch.pointer('down', 100, 200, 2); touch.pointer('up', 900, 200, 1);
    expect(touch.input.right).toBe(false); expect(touch.input.left).toBe(true); touch.pointer('cancel', 0, 0); expect(touch.input.left).toBe(false);
  });
  it('replays an earlier stage without rewriting the campaign save, then rejoins it', () => {
    const run = new MonsterRun(); run.launch(); drive(run, 20); run.advance(); const saved = run.checkpoint!; expect(saved.level).toBe(2); expect(run.frontier).toBe(2);
    expect(run.replayStage(3)).toBe(false); expect(run.replayStage(1)).toBe(true); expect([run.level, run.phase, run.score]).toEqual([1, 'playing', saved.score]);
    drive(run, 20); expect(run.phase).toBe('cleared'); expect(run.checkpoint).toEqual(saved);
    run.advance(); expect([run.level, run.score]).toEqual([2, saved.score]); expect(run.checkpoint).toEqual(saved);
    run.replayStage(1); run.lives = 1; run.invulnerable = 0; teleport(run, 0, -9); advance(run, 2); expect(run.phase).toBe('gameover');
    run.retryStage(); expect([run.level, run.phase]).toEqual([1, 'playing']); expect(run.checkpoint).toEqual(saved);
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
