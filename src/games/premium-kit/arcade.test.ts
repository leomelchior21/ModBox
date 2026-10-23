import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { SlingersRun, pieceOf } from '../makita-slingers/run';
import { World2D } from '../makita-slingers/physics2d';
import { SLING_LEVELS } from '../makita-slingers/levels';
import { slingersCatalog } from '../makita-slingers/catalog';
import { NajaRun, type Tile } from '../naja-run/run';
import { najaCatalog } from '../naja-run/catalog';
import { PinballRun, PIN_STAGES, GOAL, HOME, KEEPER_Y, closestSegment, pinStage } from '../pinballerz/run';
import { flipBot, aimBot, playStage } from '../pinballerz/testBots';
import { WEATHER } from '../pinballerz/run';
import { VENUES } from '../pinballerz/stadium';
import { YOUR_KITS, rivalKit } from '../pinballerz/kits';
import { pinballerzSpec } from '../pinballerz/PinballScreen';
import { STACK_WORLDS, STACK_WEATHER } from '../speed-stack/worlds';
import { speedStackSpec } from '../speed-stack/StackScreen';
import { NAJA_GARDENS, NAJA_WEATHER } from '../naja-run/worlds';
import { najaRunSpec } from '../naja-run/NajaScreen';
import { SLING_WORLDS, SLING_WEATHER } from '../makita-slingers/worlds';
import { makitaSlingersSpec } from '../makita-slingers/SlingersScreen';
import { pinballCatalog } from '../pinballerz/catalog';
import { StackRun, overlap1D, STACK_LEVELS } from '../speed-stack/run';
import { stackCatalog } from '../speed-stack/catalog';
import { TomatinaRun } from '../tomatina/run';
import { NeonMazeRun } from '../neon-maze/run';
import { mazeCatalog } from '../neon-maze/catalog';
import { AnominersRun } from '../anominers/run';
import { anominersCatalog } from '../anominers/catalog';
import { tomatinaCatalog } from '../tomatina/catalog';
import { readCampaign, type ArcadeConfig, type ArcadeRun } from './core';
import { ArcadeEffects } from './visuals';

const games = [
  { id: 'makita-slingers', catalog: slingersCatalog, create: (save?: unknown) => new SlingersRun(save) },
  { id: 'naja-run', catalog: najaCatalog, create: (save?: unknown) => new NajaRun(save) },
  { id: 'pinballerz', catalog: pinballCatalog, create: (save?: unknown) => new PinballRun(save) },
  { id: 'speed-stack', catalog: stackCatalog, create: (save?: unknown) => new StackRun(save) },
  { id: 'tomatina', catalog: tomatinaCatalog, create: (save?: unknown) => new TomatinaRun(save) },
  { id: 'maze', catalog: mazeCatalog, create: (save?: unknown) => new NeonMazeRun(save) },
  { id: 'anominers', catalog: anominersCatalog, create: (save?: unknown) => new AnominersRun(save) },
];
const advance = (run: ArcadeRun, time: number) => { for (let frame = 0; frame < Math.ceil(time * 120); frame++) run.step(1 / 120); };

describe.each(games)('$id campaign and interpreter', ({ id, catalog, create }) => {
  it.each(['python', 'swift', 'csharp'] as const)('parses every control, starter and sandbox in %s', language => {
    for (const source of [catalog.starter, catalog.remix, ...catalog.mods.map(m => m.example)]) {
      const program = parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, catalog.schema);
      expect(program.diagnostics.filter(d => d.severity === 'error'), source).toEqual([]); expect(program.ok, source).toBe(true);
    }
  });
  it('keeps the last valid script, clamps controls, and applies rules without accumulating', () => {
    const run = create(), parse = (source: string) => parseGameScript<ArcadeConfig>(source, 'csharp', catalog.schema);
    run.setProgram(parse(catalog.remix)); run.launch();
    expect(run.config.overdrive).toBe(false); run.score = 1; run.step(0.01); expect(run.config.overdrive).toBe(true); expect(run.metrics.ruleTraces.length).toBeGreaterThan(0);
    run.score = 0; run.step(0.01); expect(run.config.overdrive).toBe(false);
    const before = { ...run.config }; run.setProgram(parse('int nonsense = ;')); expect(run.config).toEqual(before);
    const power = catalog.mods.find(m => m.id === 'power')!; run.setProgram(parse(`int ${power.name} = 99999;`)); expect(run.config.power).toBe(power.limits!.max);
  });
  it.each(['python', 'swift', 'csharp'] as const)('starts a complete basic game and accepts every mod immediately in %s', language => {
    const run = create(), parse = (source: string) => parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, catalog.schema);
    const basic = parse(catalog.starter); run.setProgram(basic); run.launch();
    expect(basic.ok).toBe(true); expect(Object.keys(basic.config)).toEqual(["worldTheme", "characterStyle", "weather"]);
    expect(run.config).toEqual(catalog.defaults); expect(run.phase).toBe('playing');
    expect(run.config.assist).toBe(false); expect(run.config.overdrive).toBe(false);
    run.setProgram(parse(catalog.remix)); expect(run.config.assist).toBe(true);
    run.score = 1; run.step(.01); expect(run.config.overdrive).toBe(true);
    expect(run.metrics.ruleTraces.length).toBeGreaterThan(0);
  });
  it('teaches eight missions with available targets and requires real arithmetic, assistance and executed rules', () => {
    const run = create(), parse = (s: string) => parseGameScript<ArcadeConfig>(s, 'csharp', catalog.schema), full = parse(catalog.remix); run.setProgram(full); run.launch();
    expect(catalog.missions.filter(m => m.kind !== 'sandbox')).toHaveLength(8);
    for (const mission of catalog.missions) if (mission.targetId) expect([...catalog.mods, ...catalog.tools].find(m => m.id === mission.targetId)!.unlockAt).toBeLessThanOrEqual(mission.order);
    expect(catalog.passed(catalog.missions[0], full, run)).toBe(true); expect(catalog.passed(catalog.missions[2], full, run)).toBe(true);
    const power = catalog.mods.find(m => m.id === 'power')!;
    expect(catalog.passed(catalog.missions[2], parse(`int ${power.name} = ${run.config.power};`), run)).toBe(false);
    expect(catalog.passed(catalog.missions[3], full, run)).toBe(false); run.metrics.assisted++; expect(catalog.passed(catalog.missions[3], full, run)).toBe(true);
    expect(catalog.passed(catalog.missions[6], full, run)).toBe(false); run.score = 100; run.step(.01); expect(catalog.passed(catalog.missions[6], full, run)).toBe(true);
    expect(catalog.passed(catalog.missions[7], full, run)).toBe(false); run.metrics.clears++; expect(catalog.passed(catalog.missions[7], full, run)).toBe(true);
    expect(catalog.passed(catalog.missions[7], parse(catalog.mods.map(m => m.example).join('\n')), run)).toBe(false);
  });
  it('pauses simulation and actions, rejects invalid time, and resumes input cleanly', () => {
    const run = create(); run.launch(); run.input.left = true; run.pause(); expect(run.input.left).toBe(false);
    const score = run.score, elapsed = run.elapsed, actions = run.metrics.actions;
    advance(run, 1); run.action('primary'); expect(run.elapsed).toBe(elapsed); expect(run.score).toBe(score); expect(run.metrics.actions).toBe(actions);
    run.resume(); run.step(NaN); run.step(-1); run.step(Infinity); expect(run.elapsed).toBe(elapsed); run.step(.01); expect(run.elapsed).toBeGreaterThan(elapsed);
  });
  it('saves stage boundaries, isolates campaigns, and rejects malformed persisted state', () => {
    const run = create(); run.launch(); run.score = 300; run.metrics.scored = 4; run.phase = 'cleared'; run.advance(); const saved = run.checkpoint;
    expect(saved?.level).toBe(2); const restored = create(saved); restored.launch(); expect(restored.level).toBe(2); expect(restored.score).toBe(300); expect(restored.metrics.scored).toBe(4);
    restored.score = 0; expect(saved!.score).toBe(300); restored.launch(true); expect(restored.level).toBe(1); expect(restored.score).toBe(0);
    expect(readCampaign(saved, 'another-game')).toBeNull(); expect(readCampaign({ ...saved, level: 0 }, id)).toBeNull(); expect(readCampaign({ ...saved, metrics: {} }, id)).toBeNull();
    expect(readCampaign({ ...saved, level: 2, score: NaN }, id)).toBeNull(); expect(readCampaign({ ...saved, evaluate: null }, id)).not.toHaveProperty('evaluate');
  });
});

describe('Makita Slingers physics', () => {
  const play = (level: number, shots: [number, number][]) => {
    const run = new SlingersRun(); run.level = level; run.launch(); const near = Math.min(...run.stage.blocks.map(b => b.x - b.w / 2), ...run.stage.robots.map(r => r.x)) - 3.5;
    for (const [angle, power] of shots) {
      if (run.phase !== 'playing') break; run.aimAngle = angle; run.aimPower = power; run.fire(); let special = false;
      for (let i = 0; i < 60 * 12 && run.phase === 'playing' && run.state !== 'aim'; i++) { if (!special && run.flying[0] && pieceOf(run.flying[0]).blade !== 'bomb' && run.flying[0].x > near) { run.action('primary'); special = true; } run.step(1 / 60); }
    }
    return run;
  };
  it('stacks rigid bodies stably at rest and puts the scene to sleep', () => {
    const w = new World2D(); w.add('box', 0, -.5, { w: 60, h: 1 }, 0); for (let i = 0; i < 10; i++) w.add('box', 0, .5 + i, { w: 1, h: 1 }, 1);
    const top = w.bodies[w.bodies.length - 1]; for (let i = 0; i < 240 * 4; i++) w.step(1 / 240);
    expect(Math.abs(top.x)).toBeLessThan(.02); expect(top.y).toBeGreaterThan(9.4); expect(top.awake).toBe(false);
  });
  it('keeps every unhit level standing with no passive points', () => {
    for (let level = 1; level <= SLING_LEVELS.length; level++) {
      const run = new SlingersRun(); run.level = level; run.launch(); const count = run.world.bodies.length; advance(run, 3);
      expect(run.score, run.stage.name).toBe(0); expect(run.robotsLeft).toBe(run.stage.robots.length); expect(run.world.bodies).toHaveLength(count);
    }
  });
  it('fires one blade at a time from the rack and charges ammo once', () => {
    const run = new SlingersRun(); expect(run.fire()).toBe(false); run.launch(); run.config.assist = true;
    expect(run.preview().length).toBeGreaterThan(5); const start = run.queue.length;
    expect(run.fire()).toBe(true); expect(run.fire()).toBe(false); expect(run.queue).toHaveLength(start - 1); expect(run.metrics.assisted).toBe(1);
    advance(run, 8); expect(run.state).toBe('aim');
  });
  it('aims by dragging anywhere, bounds the pull and cancels without firing', () => {
    const run = new SlingersRun(); run.launch(); run.pointer('down', 5, 5); run.pointer('move', -10, -12);
    expect(Math.hypot(run.pull.x, run.pull.y)).toBeLessThanOrEqual(3.21); expect(run.aimPower).toBe(1); expect(run.aimAngle).toBeGreaterThan(0);
    run.pointer('cancel', 0, 0); run.pointer('up', 0, 0); expect(run.state).toBe('aim'); expect(run.flying).toHaveLength(0);
    run.pointer('down', 5, 5); run.pointer('move', 3, 4); run.pointer('up', 3, 4); expect(run.state).toBe('flight');
  });
  it('splits, boosts and detonates special blades, and gates the blast upgrade', () => {
    const split = new SlingersRun(); split.level = 3; split.launch(); split.queue[0] = 'split'; split.fire(); split.action('primary'); expect(split.flying).toHaveLength(3);
    const turbo = new SlingersRun(); turbo.launch(); turbo.queue[0] = 'turbo'; turbo.fire(); const v = turbo.flying[0].vx; turbo.action('primary'); expect(turbo.flying[0].vx).toBeGreaterThan(v * 1.9);
    const blast = new SlingersRun(); blast.launch(); blast.fire(); blast.action('ability'); expect(blast.flying).toHaveLength(1);
    blast.config.overdrive = true; blast.action('ability'); expect(blast.flying).toHaveLength(0);
  });
  it('can clear every level with a known sequence of shots and rewards spare blades', () => {
    const solutions: [number, number][][] = [[[.1, .8]], [[.1, 1], [.1, .5]], [[.1, 1]], [[.1, 1]], [[.85, .8], [.325, .8]], [[.175, 1]], [[.1, .5], [.1, .9]], [[.7, .8], [.475, .9]], [[.175, .9]], [[.4, 1]], [[.925, .5]], [[.325, .9]]];
    for (let level = 1; level <= SLING_LEVELS.length; level++) {
      const run = play(level, solutions[level - 1]); expect(run.phase, `${level} ${run.stage.name}`).toBe('cleared'); expect(run.stars).toBeGreaterThanOrEqual(1);
      if (level === 1) { const restored = new SlingersRun(run.checkpoint); restored.launch(); expect(restored.phase).toBe('cleared'); expect(restored.robotsLeft).toBe(0); }
    }
  });
});

describe('Naja Run movement', () => {
  it('collects the opening fruit, grows, and clears a five-fruit garden once', () => {
    const run = new NajaRun(); run.launch(); const initial = run.body.length;
    for (let i = 0; i < 5; i++) { run.food = { x: run.body[0].x + 1, y: run.body[0].y }; advance(run, run.interval + .001); }
    expect(run.body.length).toBeGreaterThan(initial); expect(run.fruits).toBe(5); expect(run.phase).toBe('cleared'); expect(run.metrics.clears).toBe(1); const score = run.score; advance(run, 2); expect(run.score).toBe(score);
  });
  it('buffers two legal turns but prevents a queued reversal', () => {
    const run = new NajaRun(); run.launch(); expect(run.turn('left')).toBe(false); expect(run.turn('up')).toBe(true); expect(run.turn('down')).toBe(false); expect(run.turn('left')).toBe(true); expect(run.turn('down')).toBe(false);
    advance(run, run.interval + .001); expect(run.direction).toBe('up'); advance(run, run.interval + .001); expect(run.direction).toBe('left');
  });
  it('allows a move into the vacating tail and detects real self collisions', () => {
    const run = new NajaRun(); run.launch(); run.body = [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 }]; run.previousBody = structuredClone(run.body); run.food = { x: 10, y: 10 }; run.direction = 'up'; run.turn('right'); advance(run, run.interval + .001); expect(run.lives).toBe(3); expect(run.body[0]).toEqual({ x: 5, y: 4 });
    run.body = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 4, y: 5 }]; run.direction = 'right'; run.timer = 0; advance(run, run.interval + .001); expect(run.lives).toBe(2);
  });
  it('wraps edges only with the portal mod and spends a charm otherwise', () => {
    const run = new NajaRun(); run.launch(); run.body = [{ x: 17, y: 9 }, { x: 16, y: 9 }]; run.config.assist = true; advance(run, run.interval + .001); expect(run.body[0].x).toBe(0); expect(run.metrics.assisted).toBe(1);
    run.config.assist = false; run.body = [{ x: 17, y: 9 }, { x: 16, y: 9 }]; run.timer = 0; advance(run, run.interval + .001); expect(run.lives).toBe(2);
  });
  it('uses a shield once and keeps spawned food away from body and stones', () => {
    const run = new NajaRun(); run.launch(); run.config.overdrive = true; run.action('ability'); expect(run.shield).toBe(4);
    run.obstacles = [{ x: 9, y: 9 }]; advance(run, run.interval + .001); expect(run.lives).toBe(3); expect(run.obstacles).toHaveLength(0); expect(run.shield).toBe(0);
    run.food = { x: 10, y: 9 }; advance(run, run.interval + .001); const occupied: Tile[] = [...run.body, ...run.obstacles]; expect(occupied.some(t => t.x === run.food.x && t.y === run.food.y)).toBe(false);
  });
});

describe('Pinballerz soccer pinball', () => {
  /** A resting ball on the striking face of a flipper, `along` units from the pivot. */
  const onFlipper = (run: PinballRun, left: boolean, along = 60) => {
    const f = run.flippers.find(f => f.left === left)!, a = f.angle, px = f.x + Math.cos(a) * along, py = f.y + Math.sin(a) * along, n = left ? [Math.sin(a), -Math.cos(a)] : [-Math.sin(a), Math.cos(a)];
    Object.assign(run.ball, { x: px + n[0] * 21, y: py + n[1] * 21, vx: 0, vy: 0 }); return run.ball;
  };
  const shoot = (run: PinballRun, x: number, y: number, vx: number, vy: number) => { const b = run.ball; Object.assign(b, { x, y, vx, vy, state: 'play', kickAt: -9, touch: { defender: false, rail: false, keeper: false, mate: false, power: false } }); return b; };
  it('waits on the centre spot, kicks off once and keeps physics finite through a long rally', () => {
    const run = new PinballRun(); run.launch(); expect(run.waiting).toBe(true); expect(run.ball).toMatchObject({ x: 320, y: 520 });
    expect(run.kickOff()).toBe(true); expect(run.kickOff()).toBe(false); expect(Math.abs(run.ball.vx)).toBeGreaterThan(300);
    for (let i = 0; i < 60 * 40; i++) { flipBot(run); run.step(1 / 60); }
    expect(run.balls.every(b => [b.x, b.y, b.vx, b.vy].every(Number.isFinite))).toBe(true); expect(run.ball.trail.length).toBeLessThanOrEqual(14);
  });
  it('steps the same at 30, 60 and 144 frames per second', () => {
    const at = (fps: number) => { const run = new PinballRun(); run.launch(); run.kickOff(); for (let i = 0; i < Math.round(1.5 * fps); i++) run.step(1 / fps); return run.ball; };
    const a = at(30), b = at(60), c = at(144); expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(6); expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeLessThan(6);
  });
  it('hands a swinging flipper speed to the ball and cradles it on a held flipper', () => {
    const run = new PinballRun(); run.launch(); run.kickOff(); const b = onFlipper(run, true); run.input.left = true;
    for (let i = 0; i < 12; i++) run.step(1 / 120); expect(b.vy).toBeLessThan(-900); expect(run.elapsed - b.kickAt).toBeLessThan(.2);
    const cradle = new PinballRun(); cradle.launch(); cradle.kickOff(); const g = cradle.flippers[1]; g.angle = g.up; cradle.input.right = true; const c = onFlipper(cradle, false, 50);
    for (let i = 0; i < 240; i++) cradle.step(1 / 120); expect(Math.hypot(c.vx, c.vy)).toBeLessThan(40); expect(c.y).toBeLessThan(g.y); expect(c.state).toBe('play');
  });
  it('scores through the goal mouth, pays goalPoints and multiplies the combo streak', () => {
    const run = new PinballRun(); run.launch(); run.kickOff(); run.keeper.x = 250;
    shoot(run, 330, 220, 0, -1600); for (let i = 0; i < 30; i++) run.step(1 / 60);
    expect(run.tally.goals).toBe(1); expect(run.score).toBe(500); expect(run.goal).toMatchObject({ conceded: false, points: 500 }); expect(run.ball.state).toBe('net');
    for (let i = 0; i < 60 * 2.5; i++) run.step(1 / 60); expect(run.balls).toHaveLength(1); expect(run.ball.state).toBe('play');
    run.keeper.x = 250; shoot(run, 330, 220, 0, -1600); for (let i = 0; i < 30; i++) run.step(1 / 60); expect(run.streak).toBe(2); expect(run.score).toBe(1500);
    for (let i = 0; i < 60 * 2.5; i++) run.step(1 / 60); shoot(run, 150, 160, 0, -900); for (let i = 0; i < 20; i++) run.step(1 / 60); expect(run.tally.goals).toBe(2);
  });
  it('lets the rival keeper save a shot at its body, but not a fireball', () => {
    const run = new PinballRun(); run.launch(); run.kickOff(); run.keeper.x = 320; shoot(run, 320, 260, 0, -1500);
    for (let i = 0; i < 12; i++) run.step(1 / 60); expect(run.keeper.saves).toBe(1); expect(run.ball.vy).toBeGreaterThan(0); expect(run.tally.goals).toBe(0);
    const fire = new PinballRun(); fire.launch(); fire.kickOff(); fire.keeper.x = 320; const b = shoot(fire, 320, 260, 0, -1500); b.fire = 3;
    for (let i = 0; i < 20; i++) fire.step(1 / 60); expect(fire.tally.goals).toBe(1); expect(fire.keeper.knocked).toBeGreaterThan(0);
    expect(KEEPER_Y).toBeGreaterThan(GOAL.y);
  });
  it('costs a ball only when the last ball is lost, and serves a fresh kick-off', () => {
    const run = new PinballRun(); run.launch(); run.kickOff(); run.home.x = 280; shoot(run, 360, HOME.y + 2, 0, 300);
    run.step(1 / 60); expect(run.ball.state).toBe('lost'); for (let i = 0; i < 60; i++) run.step(1 / 60);
    expect(run.lives).toBe(2); expect(run.waiting).toBe(true); expect(run.goal?.conceded).toBe(true); expect(run.streak).toBe(0);
    run.kickOff(); const b = run.ball; run.tokens.push({ id: 99, kind: 'multi', x: b.x, y: b.y, life: 5 }); run.step(1 / 60); expect(run.balls).toHaveLength(3); expect(run.tally.powerups).toBe(1);
    shoot(run, 360, HOME.y + 2, 0, 300); for (let i = 0; i < 60; i++) run.step(1 / 60); expect(run.lives).toBe(2); expect(run.balls.length).toBe(2);
  });
  it('lets SUPER KEEPER save and count assistance, and THE WALL head the ball clear', () => {
    const run = new PinballRun(); run.launch(); run.kickOff(); run.config.assist = true; run.home.x = 320; shoot(run, 322, 880, 0, 420);
    for (let i = 0; i < 20; i++) run.step(1 / 60); expect(run.metrics.assisted).toBe(1); expect(run.tally.saves).toBe(1); expect(run.ball.vy).toBeLessThan(0);
    const wall = new PinballRun(); wall.launch(); wall.kickOff(); wall.power.wall = 5; shoot(wall, 300, 860, 0, 400); for (let i = 0; i < 10; i++) wall.step(1 / 60); expect(wall.ball.vy).toBeLessThan(0);
  });
  it('arms a POWER SHOT that blazes past the keeper off the next flipper strike', () => {
    const run = new PinballRun(); run.launch(); run.kickOff(); run.action('ability'); expect(run.powerArmed).toBe(0);
    run.config.overdrive = true; run.action('ability'); expect(run.powerArmed).toBeGreaterThan(0); run.keeper.x = 320;
    const b = onFlipper(run, true); run.input.left = true; for (let i = 0; i < 6; i++) run.step(1 / 120); run.input.left = false;
    expect(b.touch.power).toBe(true); expect(b.fire).toBeGreaterThan(0); for (let i = 0; i < 60; i++) run.step(1 / 60); expect(run.tally.goals).toBe(1); expect(run.goal?.detail).toContain('POWER SHOT');
  });
  it('fields teammates and extra defenders from live squad mods, and teammates pass toward goal', () => {
    const run = new PinballRun(); run.launch(); const parse = (src: string) => parseGameScript<ArcadeConfig>(src, 'csharp', pinballCatalog.schema);
    run.setProgram(parse('int teammates = 2;\nint extraDefenders = 3;\nint ballsInPlay = 3;\nstring difficulty = "hard";')); run.step(1 / 60);
    expect(run.players.filter(p => p.mate)).toHaveLength(2); expect(run.players.filter(p => !p.mate)).toHaveLength(PIN_STAGES[0].defenders.length + 3);
    expect(run.skill).toBeGreaterThan(1); run.launch(); expect(run.balls).toHaveLength(3);
    run.kickOff(); const mate = run.players.find(p => p.mate)!; shoot(run, mate.x + 40, mate.y, -300, 0); run.step(1 / 60); run.step(1 / 60);
    expect(run.ball.touch.mate).toBe(true); expect(run.ball.vy).toBeLessThan(-1000);
  });
  it('collects power-up tokens and runs their timers', () => {
    const run = new PinballRun(); run.level = 4; run.launch(); run.kickOff(); const b = run.ball;
    for (const kind of ['fire', 'freeze', 'double', 'wall'] as const) { run.tokens.push({ id: 1, kind, x: b.x, y: b.y, life: 5 }); run.step(1 / 60); expect(run.power[kind]).toBeGreaterThan(0); }
    expect(b.fire).toBeGreaterThan(0); expect(run.tally.powerups).toBe(4); const k = run.keeper.x; run.step(.5); expect(run.keeper.x).toBe(k);
    let spawned = 0; const fresh = new PinballRun(); fresh.level = 4; fresh.launch(); fresh.kickOff(); for (let i = 0; i < 60 * 20; i++) { flipBot(fresh); fresh.step(1 / 60); spawned = Math.max(spawned, fresh.tokens.length); } expect(spawned).toBeGreaterThan(0);
    const early = new PinballRun(); early.launch(); early.kickOff(); for (let i = 0; i < 60 * 20; i++) { early.step(1 / 60); expect(early.tokens).toHaveLength(0); }
  });
  it('clears a stage when its match goals are met and restores the cleared result', () => {
    const run = new PinballRun(); run.level = 2; run.launch(); expect(run.stage.goals).toEqual([['goals', 3]]); run.tally.goals = 3; run.step(.01); expect(run.phase).toBe('cleared');
    const restored = new PinballRun(run.checkpoint); restored.launch(); expect(restored.phase).toBe('cleared'); expect(restored.tally.goals).toBe(3);
    expect(pinStage(13).goals[0][1]).toBeGreaterThan(pinStage(1).goals[0][1]); expect(pinStage(13).keeper).toBeGreaterThan(pinStage(1).keeper);
    const hat = new PinballRun(); hat.level = 9; hat.launch(); hat.kickOff();
    for (let n = 0; n < 3; n++) { hat.keeper.x = 250; shoot(hat, 330, 220, 0, -1600); for (let i = 0; i < 30; i++) hat.step(1 / 60); for (let i = 0; i < 150 && hat.phase === 'playing'; i++) hat.step(1 / 60); }
    expect(hat.tally.hattricks).toBe(1); expect(hat.phase).toBe('cleared');
  });
  it('plays the weather: rain skids, snow drags and a storm blows the ball sideways', () => {
    const roll = (weather: string) => { const run = new PinballRun(); run.launch(); run.config.weather = weather; run.kickOff(); const b = run.ball; Object.assign(b, { x: 320, y: 600, vx: 0, vy: -900 }); let top = 999; for (let i = 0; i < 40; i++) { run.step(1 / 60); top = Math.min(top, b.y); } return { top, run }; };
    const clear = roll('clear'), rain = roll('rain'), snow = roll('snow'), storm = roll('storm');
    expect(rain.top).toBeLessThan(clear.top); expect(snow.top).toBeGreaterThan(clear.top); expect(clear.run.wind).toBe(0); expect(Math.abs(storm.run.wind)).toBeGreaterThan(0);
    expect(WEATHER.storm.wind).toBe(true); expect(Object.keys(WEATHER)).toEqual(pinballCatalog.mods.find(m => m.id === 'weather')!.values);
  });
  it('dresses the home side in its stadium colours and switches kits on a clash', () => {
    const dortmund = VENUES.dortmund, yellow = YOUR_KITS.yellow.outfield;
    expect(rivalKit(dortmund.home, dortmund.away, yellow)).toBe(dortmund.away); expect(rivalKit(dortmund.home, dortmund.away, YOUR_KITS.blue.outfield)).toBe(dortmund.home);
    expect(Object.keys(VENUES)).toEqual(pinballCatalog.mods.find(m => m.id === 'worldTheme')!.values); expect(Object.keys(YOUR_KITS)).toEqual(pinballCatalog.mods.find(m => m.id === 'characterStyle')!.values);
  });
  it('invites a fitting mod after a loss, a win, or mid-match trouble', () => {
    const run = new PinballRun(); run.launch(); run.conceded = 2; run.keeper.saves = 5;
    const lose = pinballerzSpec.invites!(run, 'lose'); expect(lose[0].code).toBe('bool superKeeper = true;'); expect(lose.map(i => i.code)).toContain('int kickPower = 1200;');
    run.config.assist = true; expect(pinballerzSpec.invites!(run, 'lose').some(i => i.code.includes('superKeeper'))).toBe(false);
    const win = pinballerzSpec.invites!(run, 'win'); expect(win[0].code).toBe('string difficulty = "pro";'); expect(win.some(i => i.code === 'string worldTheme = "bernabeu";')).toBe(true);
    run.savesSinceGoal = 3; expect(pinballerzSpec.invites!(run, 'struggle')[0].code).toBe('int kickPower = 1200;');
    for (const moment of ['lose', 'win', 'struggle'] as const) for (const invite of pinballerzSpec.invites!(run, moment)) { const program = parseGameScript<ArcadeConfig>(invite.code, 'csharp', pinballCatalog.schema); expect(program.ok, invite.code).toBe(true); }
  });
  it('ramps twelve named matches step by step', () => {
    expect(PIN_STAGES).toHaveLength(12); expect(new Set(PIN_STAGES.map(s => s.name)).size).toBe(12);
    PIN_STAGES.forEach((s, i) => { if (i) { expect(s.keeper).toBeGreaterThan(PIN_STAGES[i - 1].keeper); expect(s.defenders.length).toBeGreaterThanOrEqual(PIN_STAGES[i - 1].defenders.length); expect(s.smart).toBeGreaterThanOrEqual(PIN_STAGES[i - 1].smart); } });
    expect(PIN_STAGES[0].powerups).toBe(0); expect(PIN_STAGES[0].defenders).toHaveLength(1); expect(PIN_STAGES[11].defenders.length).toBeGreaterThanOrEqual(7);
  });
  it('keeps both touch flippers independent and kicks off with a tap', () => {
    const run = new PinballRun(); run.launch(); run.pointer('down', 100, 700, 1); expect(run.waiting).toBe(false); run.pointer('up', 100, 700, 1);
    run.pointer('move', 100, 700, 1); expect(run.input.left).toBe(false);
    run.pointer('down', 100, 700, 1); run.pointer('down', 500, 700, 2); expect(run.input.left).toBe(true); expect(run.input.right).toBe(true);
    run.pointer('up', 100, 700, 1); expect(run.input.left).toBe(false); expect(run.input.right).toBe(true);
    run.pointer('move', 100, 700, 2); expect(run.input.left).toBe(true); expect(run.input.right).toBe(false);
    run.pointer('cancel', 0, 0); expect(run.input.left).toBe(false); expect(run.input.right).toBe(false);
    expect(closestSegment(5, 5, 0, 0, 10, 0)).toEqual({ x: 5, y: 0, t: .5 });
  });
  it('lets a simple flipper bot win the first two matches, so early stages stay easy', () => {
    for (const seed of [0, 101, 202]) { const r = playStage(1, flipBot, 240, seed); expect(r.won, `stage 1 seed ${seed}`).toBe(true); }
    expect(playStage(2, flipBot, 300).won).toBe(true);
  }, 60000);
  it('lets an aiming bot win a mid-campaign match with real flipper play', () => {
    const r = playStage(6, aimBot, 300); expect(r.won).toBe(true); expect(r.ballsLost).toBeLessThan(3);
  }, 120000);
  it.runIf(process.env.PINBALL_CAMPAIGN)('lets an aiming bot win all twelve matches', () => {
    for (let level = 1; level <= PIN_STAGES.length; level++) { const r = playStage(level, aimBot, 400); console.log(`stage ${level}: ${r.won ? 'won' : 'lost'} in ${r.time.toFixed(0)}s, ${r.ballsLost} balls lost`); expect(r.won, `stage ${level}`).toBe(true); }
  }, 3600000);
});

describe('Speed Stack overlap and timing', () => {
  it('calculates overlap on both sides and trims only the overhang', () => {
    expect(overlap1D(0, 100, -20, 100)).toEqual({ start: 0, size: 80 }); expect(overlap1D(0, 100, 20, 100)).toEqual({ start: 20, size: 80 });
    const run = new StackRun(); run.launch(); run.moving.x = -100; expect(run.drop()).toBe(true); expect(run.slabs[1].w).toBe(240); expect(run.slabs[1].x).toBe(-100); expect(run.falling).toHaveLength(1); expect(run.falling[0].slab.w).toBe(40);
  });
  it('chains perfect placements, widens after three, and clears a skyline', () => {
    const run = new StackRun(); run.launch();
    for (let i = 0; i < 12; i++) { const top = run.slabs[run.slabs.length - 1]; run.moving.x = top.x; run.moving.z = top.z; run.dropLock = 0; expect(run.drop()).toBe(true); }
    expect(run.phase).toBe('cleared'); expect(run.placed).toBe(12); expect(run.metrics.perfects).toBe(12); expect(run.slabs[3].w).toBe(292); expect(run.slabs[6].w).toBe(300); expect(run.metrics.clears).toBe(1); expect(run.best).toBe(12);
    const restored = new StackRun(run.checkpoint); restored.launch(); expect(restored.phase).toBe('cleared'); expect(restored.slabs).toHaveLength(13); expect(restored.best).toBe(12);
  });
  it('pays triple for perfect gold slabs, cuts gold away on a miss, and blows gusts on windy stages', () => {
    const run = new StackRun(); run.level = 3; run.launch(); expect(run.stage.gold).toBe(4);
    for (let i = 0; i < 3; i++) { run.moving.x = run.top.x; run.moving.z = run.top.z; run.dropLock = 0; run.drop(); }
    expect(run.moving.gold).toBe(true); run.moving.x = run.top.x; run.moving.z = run.top.z; const before = run.score; run.dropLock = 0; run.drop();
    expect(run.score - before).toBe((25 + run.config.bonus * 4) * 3); expect(run.top.w).toBe(300);
    const windy = new StackRun(); windy.level = 7; windy.launch(); const speeds = new Set<number>(); for (let i = 0; i < 40; i++) { windy.step(.05); speeds.add(Math.round(windy.speed)); }
    expect(speeds.size).toBeGreaterThan(10); expect(STACK_LEVELS.every(l => l.floors >= 12 && l.width >= 200)).toBe(true);
  });
  it('uses magnetic alignment, spends chances on misses, and ends at zero', () => {
    const run = new StackRun(); run.launch(); run.config.assist = true; run.moving.x = -125; run.drop(); expect(run.metrics.assisted).toBe(1); expect(run.slabs[1].w).toBe(280);
    for (let i = 0; i < 2; i++) { run.dropLock = 0; run.moving.x = 1000; run.drop(); } expect(run.lives).toBe(0); expect(run.phase).toBe('gameover'); const score = run.score; run.action('primary'); expect(run.score).toBe(score);
  });
  it('slows moving slabs with focus and bounds falling offcuts', () => {
    const normal = new StackRun(), slow = new StackRun(); normal.launch(); slow.launch(); slow.config.overdrive = true; slow.action('ability'); advance(normal, .5); advance(slow, .5);
    expect(slow.offset + 320).toBeLessThan((normal.offset + 320) * .5); expect(slow.focusCooldown).toBeGreaterThan(11);
    slow.moving.x = 1000; slow.drop(); advance(slow, 3); expect(slow.falling).toHaveLength(0);
  });
});

describe('Speed Stack sites, weather and the foreman', () => {
  it('makes perfects harder in the rain, gusts in the wind and slows the crane in the snow', () => {
    const run = new StackRun(); run.launch(); run.moving.x = run.top.x + run.config.power * .9; run.dropLock = 0; run.config.weather = 'rain'; run.drop(); expect(run.cuts).toBe(1);
    const calm = new StackRun(), windy = new StackRun(); calm.launch(); windy.launch(); windy.config.weather = 'wind'; const speeds = new Set<number>(); for (let i = 0; i < 40; i++) { windy.step(.05); speeds.add(Math.round(windy.speed)); } expect(speeds.size).toBeGreaterThan(8);
    const snow = new StackRun(); snow.launch(); snow.config.weather = 'snow'; expect(snow.speed).toBeLessThan(calm.speed);
    expect(Object.keys(STACK_WORLDS)).toEqual(stackCatalog.mods.find(m => m.id === 'worldTheme')!.values); expect(Object.keys(STACK_WEATHER)).toEqual(stackCatalog.mods.find(m => m.id === 'weather')!.values);
  });
  it('coaches with magnet snap after a collapse and a new site after a skyline', () => {
    const run = new StackRun(); run.launch();
    expect(speedStackSpec.invites!(run, 'lose')[0].code).toBe('bool magnetSnap = true;'); expect(speedStackSpec.invites!(run, 'win')[0].code).toBe('string worldTheme = "tokyo";');
    for (const moment of ['lose', 'win', 'struggle'] as const) for (const invite of speedStackSpec.invites!(run, moment)) expect(parseGameScript<ArcadeConfig>(invite.code, 'csharp', stackCatalog.schema).ok, invite.code).toBe(true);
  });
});

describe('Naja Run gardens, weather and the old cobra', () => {
  it('slides faster in the rain and remembers what ended each life', () => {
    const dry = new NajaRun(), wet = new NajaRun(); dry.launch(); wet.launch(); wet.config.weather = 'rain'; expect(wet.interval).toBeLessThan(dry.interval);
    const run = new NajaRun(); run.launch(); run.body = [{ x: 17, y: 9 }, { x: 16, y: 9 }]; run.direction = 'right'; for (let i = 0; i < 30; i++) run.step(1 / 30); expect(run.bumps.wall).toBe(1);
    expect(najaRunSpec.invites!(run, 'lose')[0].code).toBe('bool wrapWalls = true;'); expect(najaRunSpec.invites!(run, 'win')[0].code).toBe('string worldTheme = "desert";');
    for (const moment of ['lose', 'win', 'struggle'] as const) for (const invite of najaRunSpec.invites!(run, moment)) expect(parseGameScript<ArcadeConfig>(invite.code, 'csharp', najaCatalog.schema).ok, invite.code).toBe(true);
    expect(Object.keys(NAJA_GARDENS)).toEqual(najaCatalog.mods.find(m => m.id === 'worldTheme')!.values); expect(Object.keys(NAJA_WEATHER)).toEqual(najaCatalog.mods.find(m => m.id === 'weather')!.values);
  });
});

describe('Makita Slingers battlegrounds, wind and the crew chief', () => {
  it('bends blades in the wind, floats them on the Moon and shows it in the preview', () => {
    const calm = new SlingersRun(), windy = new SlingersRun(), moon = new SlingersRun(); for (const r of [calm, windy, moon]) r.launch();
    windy.config.weather = 'wind'; moon.config.worldTheme = 'moon';
    expect(windy.preview().at(-1)!.x).toBeGreaterThan(calm.preview().at(-1)!.x); expect(moon.gravity).toBeLessThan(calm.gravity * .5);
    for (const r of [calm, windy]) { r.fire(); for (let i = 0; i < 40; i++) r.step(1 / 60); } expect(windy.flying[0].x).toBeGreaterThan(calm.flying[0].x);
    expect(Object.keys(SLING_WORLDS)).toEqual(slingersCatalog.mods.find(m => m.id === 'worldTheme')!.values); expect(Object.keys(SLING_WEATHER)).toEqual(slingersCatalog.mods.find(m => m.id === 'weather')!.values);
  });
  it('offers the flight preview after misses and the Moon after a win', () => {
    const run = new SlingersRun(); run.launch(); run.fire(); run.shotsSinceKill = 2;
    expect(makitaSlingersSpec.invites!(run, 'struggle')[0].code).toBe('bool aimGuide = true;'); expect(makitaSlingersSpec.invites!(run, 'lose')[0].code).toBe('bool aimGuide = true;');
    expect(makitaSlingersSpec.invites!(run, 'win')[0].code).toBe('string worldTheme = "castle";');
    for (const moment of ['lose', 'win', 'struggle'] as const) for (const invite of makitaSlingersSpec.invites!(run, moment)) expect(parseGameScript<ArcadeConfig>(invite.code, 'csharp', slingersCatalog.schema).ok, invite.code).toBe(true);
  });
});

describe('bounded premium feedback', () => {
  it('bounds particles and text, freezes when not stepped, and respects reduced motion', () => {
    const fx = new ArcadeEffects(), cues = Array.from({ length: 100 }, () => ({ kind: 'perfect' as const, x: 100, y: 100, text: 'PERFECT' }));
    fx.consume(cues, '#bde7d4', false); expect(fx.particles.length).toBeLessThanOrEqual(240); expect(fx.floaters.length).toBeLessThanOrEqual(18); fx.step(2); expect(fx.particles).toHaveLength(0); expect(fx.floaters).toHaveLength(0);
    fx.consume(cues, '#bde7d4', false); expect(fx.particles.length).toBeGreaterThan(0); fx.consume(cues, '#bde7d4', true); expect(fx.particles).toHaveLength(0); expect(fx.shake).toBe(0); expect(fx.floaters).toHaveLength(18);
  });
});
