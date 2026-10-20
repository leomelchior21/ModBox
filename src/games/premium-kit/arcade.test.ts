import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { SlingersRun, pieceOf } from '../makita-slingers/run';
import { World2D } from '../makita-slingers/physics2d';
import { SLING_LEVELS } from '../makita-slingers/levels';
import { slingersCatalog } from '../makita-slingers/catalog';
import { NajaRun, type Tile } from '../naja-run/run';
import { najaCatalog } from '../naja-run/catalog';
import { PinballRun, closestSegment, pinStage } from '../pinballerz/run';
import { pinballCatalog } from '../pinballerz/catalog';
import { StackRun, overlap1D } from '../speed-stack/run';
import { stackCatalog } from '../speed-stack/catalog';
import { readCampaign, type ArcadeConfig, type ArcadeRun } from './core';
import { ArcadeEffects } from './visuals';

const games = [
  { id: 'makita-slingers', catalog: slingersCatalog, create: (save?: unknown) => new SlingersRun(save) },
  { id: 'naja-run', catalog: najaCatalog, create: (save?: unknown) => new NajaRun(save) },
  { id: 'pinballerz', catalog: pinballCatalog, create: (save?: unknown) => new PinballRun(save) },
  { id: 'speed-stack', catalog: stackCatalog, create: (save?: unknown) => new StackRun(save) },
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

describe('Pinballerz table physics', () => {
  const flipBot = (run: PinballRun) => {
    for (const f of run.flippers) { const near = run.balls.some(b => !b.ramp && b.vy > 60 && Math.hypot(b.x - (f.x + (f.left ? 45 : -45)), b.y - (f.y + 10)) < 52); if (f.left) run.input.left = near; else run.input.right = near; }
    if (run.waiting) run.launchBall();
  };
  it('plunges over the arch onto the lanes and keeps physics finite during a long rally', () => {
    const run = new PinballRun(); run.launch(); expect(run.launchBall()).toBe(true); expect(run.launchBall()).toBe(false);
    let top = 999; for (let i = 0; i < 120 * 2; i++) { run.step(1 / 120); top = Math.min(top, run.ball.y); } expect(top).toBeLessThan(160); expect(run.ball.x).toBeLessThan(556);
    for (let i = 0; i < 120 * 30; i++) { flipBot(run); run.step(1 / 120); }
    expect(run.balls.every(b => [b.x, b.y, b.vx, b.vy].every(Number.isFinite))).toBe(true); expect(run.hits).toBeGreaterThan(0); expect(run.ball.trail.length).toBeLessThanOrEqual(14);
  });
  it('scores real bumper contact with a cooldown and applies the jackpot circuit', () => {
    const run = new PinballRun(); run.launch(); run.waiting = false; const bumper = run.bumpers[0], b = run.ball;
    Object.assign(b, { x: bumper.x + 40, y: bumper.y, vx: -100, vy: 0 }); run.step(.01); expect(run.hits).toBe(1); expect(run.score).toBe(100); expect(b.vx).toBeGreaterThan(600); run.step(.01); expect(run.score).toBe(100);
    run.config.overdrive = true; bumper.cooldown = 0; Object.assign(b, { x: bumper.x + 40, y: bumper.y, vx: -100, vy: 0 }); run.step(.01); expect(run.score).toBe(300);
  });
  it('hands a swinging flipper speed to the ball and cradles it on a held flipper', () => {
    const run = new PinballRun(); run.launch(); run.launchBall(); const f = run.flippers[0], b = run.ball;
    Object.assign(b, { x: f.x + 55, y: f.y + 10, vx: 0, vy: 0 }); run.input.left = true; for (let i = 0; i < 12; i++) run.step(1 / 120); expect(b.vy).toBeLessThan(-900);
    const cradle = new PinballRun(); cradle.launch(); cradle.launchBall(); const g = cradle.flippers[1], c = cradle.ball; g.angle = g.up; cradle.input.right = true;
    Object.assign(c, { x: g.x - 50, y: g.y - 40, vx: 0, vy: 0 }); for (let i = 0; i < 240; i++) cradle.step(1 / 120); expect(Math.hypot(c.vx, c.vy)).toBeLessThan(40); expect(c.y).toBeLessThan(g.y);
  });
  it('rides the ramp only with enough speed, then lights multiball and jackpots', () => {
    const run = new PinballRun(); run.level = 9; run.launch(); run.launchBall();
    const shoot = (speed: number, frames = 120) => { const b = run.ball; Object.assign(b, { x: 470, y: 505, vx: -speed * .27, vy: -speed * .96, ramp: null }); for (let i = 0; i < frames && !b.ramp; i++) run.step(1 / 120); return b; };
    expect(shoot(400, 30).ramp).toBeNull(); expect(run.tally.ramps).toBe(0);
    for (let n = 1; n <= 3; n++) { const b = shoot(1400); expect(b.ramp).not.toBeNull(); for (let i = 0; i < 120 * 3 && b.ramp; i++) run.step(1 / 120); expect(run.tally.ramps).toBe(n); expect(b.x).toBeLessThan(120); }
    expect(run.tally.multiball).toBe(1); for (let i = 0; i < 120 * 1.5; i++) run.step(1 / 120); expect(run.balls.length).toBeGreaterThan(1);
    const b = shoot(1400); for (let i = 0; i < 120 * 3 && b.ramp; i++) run.step(1 / 120); expect(run.tally.jackpots).toBe(1);
  });
  it('drops targets, completes lane sets and rotates lit lanes with the flippers', () => {
    const run = new PinballRun(); run.level = 2; run.launch(); run.launchBall(); const b = run.ball;
    for (const d of run.drops) { d.down = false; Object.assign(b, { x: d.x + 20, y: (d.y0 + d.y1) / 2, vx: -500, vy: 0 }); run.step(1 / 60); }
    expect(run.drops.every(d => d.down)).toBe(true); expect(run.tally.drops).toBe(1);
    run.lanes = [true, false, false]; run.input.left = true; run.step(1 / 60); expect(run.lanes).toEqual([false, false, true]); run.input.left = false; run.step(1 / 60);
    run.lanes = [true, true, false]; Object.assign(b, { x: 358, y: 122, vx: 0, vy: 600 }); run.step(1 / 60); expect(run.tally.lanes).toBe(1); expect(run.bonus).toBe(2);
  });
  it('returns one early drain with ball save, then spends a real ball, and keeps multiball drains free', () => {
    const run = new PinballRun(); run.launch(); run.config.assist = true; run.launchBall(); Object.assign(run.ball, { x: 298, y: 950, vy: 300 }); run.step(.01);
    expect(run.metrics.assisted).toBe(1); expect(run.lives).toBe(3); advance(run, .6); expect(run.balls).toHaveLength(1); expect(run.waiting).toBe(false);
    Object.assign(run.ball, { x: 298, y: 950, vy: 300 }); run.step(.01); expect(run.lives).toBe(2); expect(run.waiting).toBe(true);
  });
  it('clears a stage when its mission is complete', () => {
    const run = new PinballRun(); run.level = 2; run.launch(); expect(run.stage.goals).toEqual([['bumpers', 15]]); run.tally.bumpers = 15; run.step(.01); expect(run.phase).toBe('cleared');
    const restored = new PinballRun(run.checkpoint); restored.launch(); expect(restored.phase).toBe('cleared'); expect(pinStage(13).goals[0][1]).toBeGreaterThan(pinStage(1).goals[0][1]);
  });
  it('moves flippers from held input and limits nudge charges', () => {
    const run = new PinballRun(); run.launch(); run.input.left = true; run.step(.1); expect(run.flippers[0].angle).toBeCloseTo(-.45); expect(run.flippers[1].angle).toBeCloseTo(Math.PI - .5);
    run.launchBall(); for (let i = 0; i < 5; i++) { run.nudgeCooldown = 0; run.action('nudge'); } expect(run.nudges).toBe(0); expect(run.metrics.actions).toBe(4);
    expect(closestSegment(5, 5, 0, 0, 10, 0)).toEqual({ x: 5, y: 0, t: .5 });
  });
  it('keeps both touch flippers independent and releases the correct pointer', () => {
    const run = new PinballRun(); run.launch(); run.launchBall();
    run.pointer('move', 100, 700, 1); expect(run.input.left).toBe(false);
    run.pointer('down', 100, 700, 1); run.pointer('down', 500, 700, 2); expect(run.input.left).toBe(true); expect(run.input.right).toBe(true);
    run.pointer('up', 100, 700, 1); expect(run.input.left).toBe(false); expect(run.input.right).toBe(true);
    run.pointer('move', 100, 700, 2); expect(run.input.left).toBe(true); expect(run.input.right).toBe(false);
    run.pointer('cancel', 0, 0); expect(run.input.left).toBe(false); expect(run.input.right).toBe(false);
  });
});

describe('Speed Stack overlap and timing', () => {
  it('calculates overlap on both sides and trims only the overhang', () => {
    expect(overlap1D(0, 100, -20, 100)).toEqual({ start: 0, size: 80 }); expect(overlap1D(0, 100, 20, 100)).toEqual({ start: 20, size: 80 });
    const run = new StackRun(); run.launch(); run.moving.x = -100; expect(run.drop()).toBe(true); expect(run.slabs[1].w).toBe(240); expect(run.slabs[1].x).toBe(-100); expect(run.falling).toHaveLength(1); expect(run.falling[0].slab.w).toBe(40);
  });
  it('chains perfect placements, widens after three, and clears a skyline', () => {
    const run = new StackRun(); run.launch();
    for (let i = 0; i < 15; i++) { const top = run.slabs[run.slabs.length - 1]; run.moving.x = top.x; run.moving.z = top.z; run.dropLock = 0; expect(run.drop()).toBe(true); }
    expect(run.phase).toBe('cleared'); expect(run.placed).toBe(15); expect(run.metrics.perfects).toBe(15); expect(run.slabs[3].w).toBe(290); expect(run.slabs[6].w).toBe(300); expect(run.metrics.clears).toBe(1);
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

describe('bounded premium feedback', () => {
  it('bounds particles and text, freezes when not stepped, and respects reduced motion', () => {
    const fx = new ArcadeEffects(), cues = Array.from({ length: 100 }, () => ({ kind: 'perfect' as const, x: 100, y: 100, text: 'PERFECT' }));
    fx.consume(cues, '#bde7d4', false); expect(fx.particles.length).toBeLessThanOrEqual(240); expect(fx.floaters.length).toBeLessThanOrEqual(18); fx.step(2); expect(fx.particles).toHaveLength(0); expect(fx.floaters).toHaveLength(0);
    fx.consume(cues, '#bde7d4', false); expect(fx.particles.length).toBeGreaterThan(0); fx.consume(cues, '#bde7d4', true); expect(fx.particles).toHaveLength(0); expect(fx.shake).toBe(0); expect(fx.floaters).toHaveLength(18);
  });
});
