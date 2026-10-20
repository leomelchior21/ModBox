import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { RunnerRun, runnerFrame, runnerCourse, runnerStageName, LANE, type RunnerObstacle, type RunnerPickup } from './runner';
import { TeamRun, gateResult, teamCourse, formation, hazardSpans, TEAM_LEVEL_NAMES, START_TEAM, VISIBLE, SPREAD, SQUEEZED, type TeamHazard } from '../team-counters/run';
import { MonsterRun } from '../monster-strider/run';
import { MONSTER_LEVELS } from '../monster-strider/levels';
import { RoombaRun, blockedAt } from '../roomba-run/run';
import { ROOMS } from '../roomba-run/rooms';
import { templeCatalog } from '../temple-race/catalog';
import { subwayCatalog } from '../subway-runnerz/catalog';
import { teamCatalog } from '../team-counters/catalog';
import { monsterCatalog } from '../monster-strider/catalog';
import { roombaCatalog } from '../roomba-run/catalog';
import { SUBWAY_WORLDS, TEMPLE_WORLDS, RUNNER_WEATHER } from './runner-worlds';
import { runnerInvites } from './runner-invites';
import { TEAM_WORLDS, TEAM_WEATHER } from '../team-counters/worlds';
import { teamSpec } from '../team-counters/TeamScreen';
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
  /** Dodges trains early, jumps hurdles and gaps, slides under bars and takes the marked turns. */
  const bot = (run: RunnerRun) => {
    const turn = run.nextTurn; if (turn && turn.at - run.distance < 9 && !turn.queued) { run.action(turn.direction > 0 ? 'right' : 'left'); return; }
    if (turn && turn.at - run.distance < 14) return;
    const ahead = (lane: number, range: number) => run.obstacles.filter(o => !o.passed && !o.hit && o.lane === lane && o.at + o.length > run.distance - .5 && o.at - run.distance < range);
    const blocking = (lane: number, range = 16) => ahead(lane, range).some(o => o.kind === 'train' && !o.ramp), lane = run.lane;
    if (blocking(lane) && run.y < 2.4) {
      const target = [-1, 0, 1].filter(l => !blocking(l, 24)).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))[0] ?? [-1, 0, 1].filter(l => !blocking(l))[0];
      if (target !== undefined && target !== lane) { const step = target < lane ? -1 : 1; if (!ahead(lane + step, 3.5).length) { run.action(step < 0 ? 'left' : 'right'); return; } }
    }
    const next = ahead(lane, 6).filter(o => o.kind !== 'train').sort((a, b) => a.at - b.at)[0];
    if (next) { const d = next.at - run.distance, lead = run.speed * .14; if ((next.kind === 'hurdle' || next.kind === 'gap') && d < lead + .8 && d > lead - .6) run.action('primary'); if (next.kind === 'arch' && d < 3) run.action('down'); }
  };
  it.each(['temple', 'subway'] as const)('offers a fair route through %s at several difficulties', theme => {
    for (const level of [1, 3, 6, 9]) {
      const run = new RunnerRun(theme); run.level = level; run.launch();
      for (let frame = 0; frame < 60 * 140 && run.phase === 'playing'; frame++) { bot(run); run.step(1 / 60); }
      expect(run.phase, `${theme} level ${level}`).toBe('cleared'); expect(run.lives, `${theme} level ${level}`).toBe(3); expect(run.metrics.clears).toBe(1); expect(run.score).toBeGreaterThan(run.goal);
      const restored = new RunnerRun(theme, run.checkpoint); restored.launch(); expect(restored.distance).toBe(run.goal); expect(restored.coins).toBe(run.coins); expect(restored.lives).toBe(run.lives); expect(restored.phase).toBe('cleared');
    }
  });
  it('builds deterministic courses that always leave a way through each row', () => {
    for (const theme of ['temple', 'subway'] as const) for (let level = 1; level <= 12; level++) {
      const c = runnerCourse(theme, level); expect(runnerCourse(theme, level)).toEqual(c); expect(c.pickups.length).toBeGreaterThan(0);
      const rows = new Map<number, RunnerObstacle[]>(); for (const o of c.obstacles.filter(o => !o.moving)) rows.set(o.at, [...(rows.get(o.at) ?? []), o]);
      for (const row of rows.values()) { const solid = row.filter(o => o.kind === 'train' && !o.ramp); expect(solid.length).toBeLessThan(3); if (row.length === 3) expect(row.some(o => o.kind !== 'train' || o.ramp)).toBe(true); }
      if (theme === 'temple') for (const o of c.obstacles) expect(c.turns.every(t => Math.abs(t.at - o.at) >= 14)).toBe(true);
    }
    expect(runnerStageName('subway', 1)).toBe('Downtown'); expect(runnerStageName('temple', 13)).toBe('Jungle Steps 2');
  });
  it('uses real right-angle path frames that zigzag without crossing', () => {
    const p = runnerFrame(82, 'temple'); expect(p.x).toBeCloseTo(10); expect(p.z).toBeCloseTo(-72); expect(p.yaw).toBeCloseTo(-Math.PI / 2);
    expect(runnerFrame(82, 'temple', 2).x).toBeCloseTo(-10); expect(Math.abs(runnerFrame(200, 'temple').yaw)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
  });
  it('jumps over a barrier, slides under a bar and spends one charm for one collision', () => {
    const run = new RunnerRun('subway'); run.launch(); const barrier = run.obstacles.find(o => o.kind === 'hurdle')!;
    run.distance = barrier.at - 2; run.x = run.lane = 0; barrier.lane = 0; run.invulnerable = 0; run.action('primary'); advance(run, .3); expect(barrier.hit).toBe(false); expect(run.y).toBeGreaterThan(.8);
    const arch = run.obstacles.find(o => o.kind === 'arch')!; run.y = 0; run.vy = 0; run.distance = arch.at - .1; arch.lane = 0; run.action('down'); advance(run, .1); expect(arch.hit).toBe(false);
    run.slide = 0; run.y = 0; run.distance = barrier.at - .05; barrier.hit = false; barrier.passed = false; run.invulnerable = 0; advance(run, .05); expect(run.lives).toBe(2); expect(run.chase).toBeGreaterThan(.9); advance(run, .05); expect(run.lives).toBe(2);
  });
  it('takes continuous ramps onto roofs, moves oncoming trains and lets a board absorb one hit', () => {
    const run = new RunnerRun('subway'); run.level = 4; run.launch(); const ramp = run.obstacles.find(o => o.ramp)!;
    run.distance = ramp.at - 5; run.lane = ramp.lane; run.x = ramp.lane * LANE; advance(run, .6); expect(run.y).toBeCloseTo(2.6, 1); expect(ramp.hit).toBe(false);
    const other = new RunnerRun('subway'); other.level = 6; other.launch(); const incoming = other.obstacles.find(o => o.moving)!; const at = incoming.at; advance(other, .1); expect(incoming.at).toBeLessThan(at);
    other.config.overdrive = true; other.action('ability'); expect(other.shield).toBe(9); other.invulnerable = 0; other.distance = incoming.at; other.x = incoming.lane * LANE; other.lane = incoming.lane; other.y = 0; other.vy = 0; other.step(.01); expect(other.lives).toBe(3); expect(other.shield).toBe(0);
  });
  it('grants power-ups: magnet pulls coins, 2× doubles points, jetpack flies over trains and sprint smashes roots', () => {
    const run = new RunnerRun('subway'); run.launch(); run.invulnerable = 0;
    const pick = (kind: RunnerPickup['kind']) => { run.pickups = [{ at: run.distance + .2, lane: run.lane, kind, taken: false }]; run.step(.02); };
    pick('double'); expect(run.multiplier).toBe(2); const before = run.score; run.tokens = [{ at: run.distance + .3, lane: run.lane, y: .9, taken: false }]; run.step(.02); expect(run.score - before).toBeGreaterThanOrEqual(run.config.bonus * 2);
    pick('magnet'); run.tokens = [{ at: run.distance + .3, lane: 1, y: .9, taken: false }]; run.lane = run.x = -1; run.step(.02); expect(run.tokens[0].taken).toBe(true);
    pick('jetpack'); advance(run, 2); expect(run.y).toBeGreaterThan(5); expect(run.tokens.some(t => t.y > 6)).toBe(true);
    run.obstacles = [{ id: 99, at: run.distance + .5, lane: run.lane, kind: 'train', variant: 'parked', length: 10, ramp: false, moving: false, speed: 0, passed: false, hit: false }]; advance(run, 1); expect(run.lives).toBe(3);
    const temple = new RunnerRun('temple'); temple.launch(); temple.invulnerable = 0; temple.pickups = [{ at: .2, lane: 0, kind: 'sprint', taken: false }]; temple.step(.03);
    temple.obstacles = [{ id: 1, at: temple.distance + 1, lane: 0, kind: 'hurdle', variant: 'root', length: 1, ramp: false, moving: false, speed: 0, passed: false, hit: false }]; advance(temple, .3); expect(temple.lives).toBe(3); expect(temple.obstacles[0].hit).toBe(true);
  });
  it('applies magnets and runtime conditions immediately and rejects unrelated touch pointers', () => {
    const run = new RunnerRun('temple'); run.launch(); run.tokens = [{ at: 1, lane: 1, y: .9, taken: false }]; run.distance = .95; run.step(.01); expect(run.coins).toBe(0);
    run.setProgram(parseGameScript<ArcadeConfig>('bool coinMagnet = true;\nbool relicShield = false;\nif (distance >= 100) { relicShield = true; }', 'csharp', templeCatalog.schema)); run.step(.01); expect(run.coins).toBe(1); expect(run.metrics.assisted).toBe(1);
    run.distance = 100; run.step(.01); expect(run.config.overdrive).toBe(true);
    run.pointer('down', 500, 300, 1); run.pointer('up', 700, 300, 2); expect(run.lane).toBe(0); run.pointer('move', 700, 300, 1); expect(run.lane).toBe(1);
  });
});

describe('runner worlds, weather and coaching', () => {
  it('floats jumps in low gravity and plays the weather', () => {
    const peak = (theme: 'subway' | 'temple', world: string) => { const run = new RunnerRun(theme); run.launch(); run.config.worldTheme = world; run.action('primary'); let top = 0; for (let i = 0; i < 120; i++) { run.step(1 / 60); top = Math.max(top, run.y); } return top; };
    expect(peak('subway', 'mars')).toBeGreaterThan(peak('subway', 'classic') * 1.4); expect(peak('temple', 'sky')).toBeGreaterThan(peak('temple', 'classic') * 1.25);
    const run = new RunnerRun('subway'); run.launch(); const base = run.speed; run.config.weather = 'snow'; expect(run.speed).toBeLessThan(base); run.config.weather = 'rain'; run.action('down'); expect(run.slide).toBeGreaterThan(.9);
    for (const [catalog, worlds] of [[subwayCatalog, SUBWAY_WORLDS], [templeCatalog, TEMPLE_WORLDS]] as const) { expect(Object.keys(worlds)).toEqual(catalog.mods.find(m => m.id === 'worldTheme')!.values); for (const w of catalog.mods.find(m => m.id === 'weather')!.values!) expect(RUNNER_WEATHER[w], w).toBeDefined(); }
  });
  it('coaches from what tripped the runner, in code that parses', () => {
    const run = new RunnerRun('temple'); run.launch(); run.crashes.turn = 2;
    expect(runnerInvites(run, 'lose')[0].code).toBe('bool relicShield = true;'); expect(runnerInvites(run, 'struggle')[0].code).toBe('bool relicShield = true;');
    const subway = new RunnerRun('subway'); subway.launch(); subway.crashes.train = 3; expect(runnerInvites(subway, 'lose')[0].code).toBe('bool hoverboard = true;');
    expect(runnerInvites(subway, 'win')[0].code).toBe('string worldTheme = "tokyo";');
    for (const r of [run, subway]) for (const moment of ['lose', 'win', 'struggle'] as const) for (const invite of runnerInvites(r, moment)) expect(parseGameScript<ArcadeConfig>(invite.code, 'csharp', r.schema).ok, invite.code).toBe(true);
  });
});

describe('Team Counters decisions', () => {
  const smart = (run: TeamRun) => {
    const gate = run.nextGate, hazard = run.hazards.find(h => !h.hit && h.at > run.distance && h.at - run.distance < 9), speed = run.config.speed;
    const hits = (h: TeamHazard, x: number, spread: number) => { const t = run.elapsed + (h.at - run.distance) / speed; let n = 0; for (let k = 0; k < Math.min(VISIBLE, run.team); k++) { const o = formation(k, spread); if (hazardSpans(h, t - o.z / speed).some(([a, b]) => x + o.x > a && x + o.x < b)) n++; } return n; };
    if (hazard && (!gate || hazard.at < gate.at)) {
      const spread = run.squeeze > 0 || run.squeezeCooldown <= 0 ? SQUEEZED : SPREAD; let best = run.targetX, fewest = Infinity;
      for (let x = -3.2; x <= 3.2; x += .2) { const n = hits(hazard, x, spread) + Math.abs(x - run.x) * .01; if (n < fewest) { fewest = n; best = x; } }
      run.targetX = best; if (run.squeezeCooldown <= 0 && hazard.at - run.distance < 3 && hits(hazard, best, SQUEEZED) < hits(hazard, best, SPREAD)) run.action('primary');
    } else if (gate && gate.at - run.distance < 12) { const p = run.preview(gate); run.targetX = p[0] >= p[1] ? -1.8 : 1.8; }
  };
  it('evaluates arithmetic in order, rounds division, and bounds crowds without losing the displayed count', () => {
    expect(gateResult(7, { op: '+', value: 75 })).toBe(82); expect(gateResult(7, { op: '×', value: 10 })).toBe(70); expect(gateResult(31, { op: '÷', value: 2 })).toBe(15); expect(gateResult(5, { op: '-', value: 10 })).toBe(0); expect(gateResult(4999, { op: '×', value: 10 })).toBe(5000); expect(gateResult(10, { op: '+', value: 10 }, 5)).toBe(25); expect(gateResult(12, null)).toBe(12);
  });
  it('builds twenty fair, deterministic courses that open with gates and end with an army and the stairs', () => {
    for (let level = 1; level <= 20; level++) {
      const course = teamCourse(level); expect(teamCourse(level)).toEqual(course); expect(course.name).toBe(TEAM_LEVEL_NAMES[level - 1]);
      const events = [...course.gates.map(g => ({ at: g.at, t: 'G' })), ...course.enemies.map(e => ({ at: e.at, t: 'E' })), ...course.hazards.map(h => ({ at: h.at, t: 'H' }))].sort((a, b) => a.at - b.at);
      expect(events.slice(0, 2).map(e => e.t)).toEqual(['G', 'G']); expect(events.at(-1)!.t).toBe('E'); expect(course.enemies.at(-1)!.boss).toBe(true); expect(course.goal).toBeGreaterThan(events.at(-1)!.at);
      expect(course.stepCost).toBeGreaterThanOrEqual(level < 3 ? 1 : 2);
    }
  });
  it('wins every kind of course with smart choices and steering, and scores the finale once', () => {
    for (const level of [1, 2, 8, 15, 20]) {
      const run = new TeamRun(); run.level = level; run.launch();
      for (let i = 0; i < 60 * 120 && run.phase === 'playing'; i++) { smart(run); run.step(1 / 60); }
      expect(run.phase, `level ${level}`).toBe('cleared'); expect(run.lives, `level ${level}`).toBe(3); expect(run.team).toBeGreaterThan(0); expect(run.metrics.clears).toBe(1); expect(run.victory).toBeGreaterThan(1);
      const score = run.score; advance(run, 1); expect(run.score).toBe(score);
      const restored = new TeamRun(run.checkpoint); restored.launch(); expect(restored.team).toBe(run.team); expect(restored.victory).toBe(run.victory); expect(restored.phase).toBe('cleared');
    }
  });
  it('cuts only the runners inside a blade zone, and squeezing slips a crowd through a gap', () => {
    const roller = new TeamRun(); roller.level = 4; roller.launch(); roller.team = 100; roller.x = roller.targetX = 0; roller.distance = 50;
    roller.hazards = [{ at: 50.05, kind: 'roller', a: -5, b: 0, speed: 0, phase: 0, hit: false }]; roller.gates = []; roller.enemies = []; roller.step(.02);
    expect(roller.team).toBeGreaterThan(35); expect(roller.team).toBeLessThan(65);
    const squeeze = (on: boolean) => { const run = new TeamRun(); run.level = 4; run.launch(); run.team = 60; run.distance = 50; run.gates = []; run.enemies = []; run.hazards = [{ at: 50.05, kind: 'gap', a: 0, b: 2, speed: 0, phase: 0, hit: false }]; if (on) run.action('primary'); run.step(.02); return run.team; };
    expect(squeeze(true)).toBeGreaterThan(squeeze(false)); expect(squeeze(true)).toBe(60);
  });
  it('fights one for one, then climbs the stairs until the crowd runs out', () => {
    const run = new TeamRun(); run.launch(); run.gates = []; run.hazards = []; run.team = 50; run.distance = 30;
    run.enemies = [{ at: 33, count: 20, left: 20, boss: false, defeated: false }]; advance(run, .2); expect(run.state).toBe('clash'); expect(run.distance).toBe(31); advance(run, 2);
    expect(run.enemies[0].defeated).toBe(true); expect(run.team).toBe(30); expect(run.score).toBe(run.config.bonus);
    run.enemies = []; run.course.stepCost = 5; run.team = 50; run.distance = run.goal - .1; advance(run, 8);
    expect(run.phase).toBe('cleared'); expect(run.victory).toBe(9); expect(run.team).toBe(5);
  });
  it('rewinds a losing choice without duplicating score, and keeps squeeze and shield cooldowns honest', () => {
    const run = new TeamRun(); run.launch(); run.action('primary'); expect(run.squeeze).toBeGreaterThan(0); expect(run.spread).toBe(SQUEEZED); run.action('primary'); expect(run.squeezeCooldown).toBe(3.2);
    run.gates[0].options = [{ op: '-', value: 100 }, { op: '+', value: 20 }]; run.x = run.targetX = -2; run.distance = run.gates[0].at - .01; run.step(.02);
    expect(run.team).toBe(1); expect(run.lives).toBe(3); expect(run.gates[0].used).toBe(true);
    run.enemies = [{ at: run.distance + 2.05, count: 40, left: 40, boss: false, defeated: false }]; advance(run, 1);
    expect(run.lives).toBe(2); expect(run.team).toBe(START_TEAM); expect(run.score).toBe(0); expect(run.gates[0].used).toBe(false); expect(run.enemies[0].left).toBe(40);
    run.config.overdrive = true; run.action('ability'); expect(run.shield).toBe(6); run.action('ability'); expect(run.shieldCooldown).toBe(14);
  });
  it('steers by relative drag from wherever the finger lands and ignores other pointers', () => {
    const run = new TeamRun(); run.launch(); run.targetX = .5; run.pointer('down', 800, 300, 1); run.pointer('move', 900, 300, 2); expect(run.targetX).toBe(.5);
    run.pointer('move', 900, 300, 1); expect(run.targetX).toBeCloseTo(1.6); run.pointer('up', 900, 300, 1); run.pointer('move', 100, 300, 1); expect(run.targetX).toBeCloseTo(1.6);
  });
});

describe('Team Counters courses, weather and coaching', () => {
  it('lets the wind push the crowd and snow slow the march', () => {
    const calm = new TeamRun(), windy = new TeamRun(); calm.launch(); windy.launch(); windy.config.weather = 'wind';
    for (let i = 0; i < 90; i++) { calm.step(1 / 60); windy.step(1 / 60); }
    expect(Math.abs(windy.x)).toBeGreaterThan(Math.abs(calm.x) + .2);
    const snow = new TeamRun(); snow.launch(); snow.config.weather = 'snow'; const clear = new TeamRun(); clear.launch(); for (let i = 0; i < 60; i++) { snow.step(1 / 60); clear.step(1 / 60); } expect(snow.distance).toBeLessThan(clear.distance);
    expect(Object.keys(TEAM_WORLDS)).toEqual(teamCatalog.mods.find(m => m.id === 'worldTheme')!.values); for (const w of teamCatalog.mods.find(m => m.id === 'weather')!.values!) expect(TEAM_WEATHER[w], w).toBeDefined();
  });
  it('coaches the maths after a wrong gate and dares a win', () => {
    const run = new TeamRun(); run.launch(); run.losses.badGates = 2;
    expect(teamSpec.invites!(run, 'lose')[0].code).toBe('bool gatePreview = true;'); expect(teamSpec.invites!(run, 'struggle')[0].code).toBe('bool gatePreview = true;');
    expect(teamSpec.invites!(run, 'win')[0].code).toBe('string worldTheme = "candy";');
    for (const moment of ['lose', 'win', 'struggle'] as const) for (const invite of teamSpec.invites!(run, moment)) expect(parseGameScript<ArcadeConfig>(invite.code, 'csharp', run.schema).ok, invite.code).toBe(true);
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
  it('collides with furniture but slips between table legs, and every room target is reachable', () => {
    for (let level = 1; level <= ROOMS.length; level++) {
      const run = new RoombaRun(); run.level = level; run.launch(); const room = run.room;
      expect(run.grid.total, room.name).toBeGreaterThan(800); expect(blockedAt(room, run.boxes, room.dock.x, room.dock.z)).toBe(false);
      const table = room.furniture.find(f => f.type === 'table' || f.type === 'coffeeTable' || f.type === 'desk');
      if (table) expect(blockedAt(room, run.boxes, table.x, table.z), `${room.name} under the table`).toBe(false);
      const solid = room.furniture.find(f => f.type === 'sofa' || f.type === 'bed' || f.type === 'counter' || f.type === 'workbench');
      if (solid) expect(blockedAt(room, run.boxes, solid.x, solid.z)).toBe(true);
    }
  });
  it('drives with momentum, steers, cleans a trail, collects debris and pushes toys', () => {
    const run = new RoombaRun(); run.launch(); const start = { x: run.x, z: run.z };
    run.input.up = true; advance(run, 1.5); expect(Math.hypot(run.x - start.x, run.z - start.z)).toBeGreaterThan(1.5); expect(run.cleanedCells).toBeGreaterThan(10); expect(run.freshlyCleaned.length).toBeGreaterThan(0);
    const heading = run.heading; run.input.right = true; advance(run, .5); expect(run.heading).not.toBeCloseTo(heading); run.releaseInput();
    const coin = run.debris.find(d => d.kind === 'coin')!; run.x = coin.x; run.z = coin.z; advance(run, .05); expect(coin.taken).toBe(true); expect(run.money).toBeGreaterThanOrEqual(10);
    const toy = run.toys[0], before = { x: toy.x, z: toy.z }; run.x = toy.x; run.z = toy.z + .5; run.heading = Math.PI; run.input.up = true; advance(run, .6); run.releaseInput();
    expect(Math.hypot(toy.x - before.x, toy.z - before.z)).toBeGreaterThan(.1);
  });
  it('steers right when RIGHT is held, as seen from the chase camera behind the robot', () => {
    for (const key of ['right', 'left'] as const) {
      const run = new RoombaRun(); run.launch(); run.x = 0; run.z = 0; const h = run.heading, side = { x: -Math.cos(h), z: Math.sin(h) }; // camera-right at the start
      run.input.up = true; run.input[key] = true; advance(run, .8);
      const lateral = (run.x * side.x + run.z * side.z) * (key === 'right' ? 1 : -1); expect(lateral, key).toBeGreaterThan(.1);
    }
  });
  it('steers with the touch joystick and releases it on cancel', () => {
    const run = new RoombaRun(); run.launch(); const start = { x: run.x, z: run.z };
    run.pointer('down', 500, 500, 1); run.pointer('move', 500, 380, 1); advance(run, 1); expect(Math.hypot(run.x - start.x, run.z - start.z)).toBeGreaterThan(.8);
    run.pointer('down', 100, 100, 2); expect(run.joystick?.id).toBe(1); run.pointer('cancel', 0, 0); expect(run.joystick).toBeNull();
  });
  it('drains the battery, spends a spare pack when empty, and recharges at the dock', () => {
    const run = new RoombaRun(); run.launch(); run.x = 0; run.z = -1; run.battery = .05; run.input.up = true; advance(run, .3); run.releaseInput();
    expect(run.lives).toBe(2); expect(run.dockDistance).toBeLessThan(.3); const low = run.battery; advance(run, 1.5); expect(run.battery).toBeGreaterThan(low);
  });
  it('lets the coded smart route clean every room to its target and dock within the battery packs', () => {
    for (let level = 1; level <= ROOMS.length; level++) {
      const run = new RoombaRun(); run.setProgram(parseGameScript<ArcadeConfig>('bool smartRoute = true;', 'csharp', roombaCatalog.schema)); run.level = level; run.launch();
      for (let i = 0; i < 60 * 600 && run.phase === 'playing'; i++) run.step(1 / 60);
      expect(run.phase, `${run.room.name} at ${run.coverage.toFixed(1)}%`).toBe('cleared'); expect(run.coverage).toBeGreaterThanOrEqual(run.target); expect(run.lives).toBeGreaterThan(0); expect(run.metrics.assisted).toBeGreaterThan(0);
      if (level === 1) { const restored = new RoombaRun(run.checkpoint); restored.launch(); expect(restored.phase).toBe('cleared'); expect(restored.cleanedCells).toBe(run.cleanedCells); expect(restored.money).toBe(run.money); }
    }
  });
  it('reacts to low battery through the interpreter and heads home without losing the cleaned floor', () => {
    const run = new RoombaRun(); run.setProgram(parseGameScript<ArcadeConfig>('bool smartRoute = false;\nif (battery <= 25) { smartRoute = true; }', 'csharp', roombaCatalog.schema)); run.launch(); run.x = 3; run.z = 0; run.battery = 21;
    advance(run, .1); expect(run.config.assist).toBe(true); const cleaned = run.cleanedCells; advance(run, 14); expect(run.dockDistance).toBeLessThan(.7); expect(run.battery).toBeGreaterThan(25); expect(run.cleanedCells).toBeGreaterThanOrEqual(cleaned);
    expect(run.metrics.ruleTraces.some(t => t.includes('smartRoute'))).toBe(true);
  });
});
