import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { ArcadeConfig } from '../premium-kit/core';
import { tomatinaCatalog } from './catalog';
import { TomatinaRun, LEVELS, BOT_INFO } from './run';
import { tomatinaSpec } from './TomatinaScreen';
import { playStage } from './testBots';
import { TOWNS, WEATHER } from './worlds';

const parse = (source: string, language: 'csharp' | 'python' | 'swift' = 'csharp') => parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, tomatinaCatalog.schema);
const fresh = (level = 1, code?: string) => { const run = new TomatinaRun(); if (code) run.setProgram(parse(code)); run.launch(true); if (level > 1) { run.level = level; (run as unknown as { setup(): void }).setup(); } return run; };
const advance = (run: TomatinaRun, seconds: number, fps = 60) => { for (let t = 0; t < seconds; t += 1 / fps) run.step(1 / fps); };

describe('TOMATINA streets', () => {
  it('draws twelve playable maps: one start, everything reachable, every goal possible', () => {
    expect(LEVELS).toHaveLength(12);
    LEVELS.forEach((level, i) => {
      const run = fresh(i + 1), flat = level.map.join(''), count = (c: string) => flat.split(c).length - 1;
      expect(count('P'), level.name).toBe(1);
      run.gatesOpen = true;
      const reach = (x: number, z: number) => run.walkCells(run.startX, run.startZ, x, z) >= 0;
      for (const b of run.bots) expect(reach(b.x, b.z), `${level.name} ${b.kind}`).toBe(true);
      for (const p of run.pickups) expect(reach(p.x, p.z), `${level.name} ${p.kind}`).toBe(true);
      for (const [kind, n] of level.goals) {
        if (kind === 'robots') expect(run.bots.length).toBeGreaterThanOrEqual(n);
        if (kind === 'targets') expect(run.targets.length).toBeGreaterThanOrEqual(n);
        if (kind === 'golden') expect(count('g')).toBeGreaterThanOrEqual(n);
        if (kind === 'zone') expect(run.zoneTiles).toBeGreaterThan(40);
        if (kind === 'boss') expect(run.bots.some(b => b.kind === 'boss')).toBe(true);
        if (kind === 'exit') { expect(count('X')).toBe(1); for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) if (run.at(c, r) === 'X') expect(reach(run.center(c, r).x, run.center(c, r).z)).toBe(true); }
      }
      if (count('G')) expect(run.targets.length, `${level.name} gates need bullseyes`).toBeGreaterThan(0);
    });
  });
  it('can be finished street by street by a player using only walking, turning and taps', () => {
    for (let level = 1; level <= LEVELS.length; level++) {
      const result = playStage(level);
      expect(result.won, `${level} ${LEVELS[level - 1].name}: ${JSON.stringify(result.run.goalProgress())}`).toBe(true);
      if (level <= 3) expect(result.time, 'early streets stay quick').toBeLessThan(40);
    }
  }, 120000);
  it('stays winnable with sleepy robots, and with a robot invasion on the first streets', () => {
    for (let level = 1; level <= 4; level++) expect(playStage(level, undefined, 420, run => run.setProgram(parse('string robotLevel = "easy";'))).won).toBe(true);
    for (let level = 1; level <= 3; level++) expect(playStage(level, undefined, 420, run => run.setProgram(parse('int extraRobots = 3;'))).won).toBe(true);
  }, 120000);
});

describe('TOMATINA throws', () => {
  it('lobs a tomato onto the spot you tap, the same at any frame rate', () => {
    const land = (fps: number) => {
      const run = fresh(); run.bots = []; const x = run.px, z = run.pz - 8;
      run.throwAt(x, 0, z); let last = { x: 0, z: 0 };
      for (let t = 0; t < 3 && run.tomatoes.length; t += 1 / fps) { last = { x: run.tomatoes[0].x, z: run.tomatoes[0].z }; run.step(1 / fps); }
      return { last, splat: run.splats.at(-1)! };
    };
    const slow = land(30), fast = land(144);
    expect(Math.abs(slow.splat.z - fast.splat.z)).toBeLessThan(.15); expect(Math.abs(slow.splat.z - (fresh().pz - 8))).toBeLessThan(.4);
  });
  it('turns a tap on screen into a throw at whatever is under it, and spends one tomato', () => {
    const run = fresh(); const bot = run.bots[0]; run.yaw = Math.atan2(bot.z - run.pz, bot.x - run.px);
    expect(run.aimAt(0, Math.atan2(.7 - 1.5, Math.hypot(bot.x - run.px, bot.z - run.pz)))).toBe(true);
    expect(run.ammo).toBe(19); expect(run.metrics.actions).toBe(1); expect(run.aimAt(0, 0)).toBe(false);
    advance(run, 3); expect(run.tally.robots).toBe(1); expect(run.score).toBeGreaterThan(0);
  });
  it('lets the mods change the throw: arm strength, gravity, bounces, size and bag', () => {
    const flight = (code: string) => { const run = fresh(1, code); run.bots = []; run.throwDirection(run.yaw, .5); let t = 0; while (run.tomatoes.length && t < 5) { run.step(1 / 60); t += 1 / 60; } return { t, run }; };
    expect(flight('int tomatoGravity = 4;').t).toBeGreaterThan(flight('int tomatoGravity = 16;').t * 1.5);
    const strong = fresh(1, 'int throwPower = 30;'), weak = fresh(1, 'int throwPower = 10;'); expect(strong.config.power).toBe(30); expect(weak.config.power).toBe(10);
    const bouncy = fresh(1, 'int bounces = 3;'); bouncy.bots = []; bouncy.yaw = 0; bouncy.throwDirection(0, .05); advance(bouncy, 2); expect(bouncy.splats.length).toBeGreaterThan(0);
    const banked = fresh(1, 'int bounces = 3;'); banked.bots = []; banked.throwDirection(0, .05); let wasBanked = false; for (let i = 0; i < 240; i++) { banked.step(1 / 120); if (banked.tomatoes.some(t => t.banked)) wasBanked = true; } expect(wasBanked).toBe(true);
    const paintWith = (size: number) => { const run = fresh(1, `int tomatoSize = ${size};`); run.paintFloor(run.px, run.pz - 6, .5 + .3 * size); return run.paintedTiles; };
    expect(paintWith(5)).toBeGreaterThan(paintWith(1) * 2);
    expect(fresh(1, 'int bagSize = 40;').ammo).toBe(40);
  });
  it('curves radar tomatoes into robots and counts the assist', () => {
    // Aim 1.3 m to the side of a robot: a plain tomato misses, a radar tomato bends into it.
    const shot = (code: string) => { const run = fresh(1, code), bot = run.bots[2]; for (const b of run.bots) b.stun = 999; const a = Math.atan2(bot.z - run.pz, bot.x - run.px); run.throwAt(bot.x - Math.sin(a) * 1.3, .6, bot.z + Math.cos(a) * 1.3); advance(run, 3); return run; };
    expect(shot('').tally.robots).toBe(0); const radar = shot('bool autoAim = true;'); expect(radar.tally.robots).toBe(1); expect(radar.metrics.assisted).toBeGreaterThan(0);
  });
  it('pours TOMATO RAIN only when unlocked, onto every robot nearby', () => {
    const locked = fresh(); locked.tomatoRain(); expect(locked.tomatoes).toHaveLength(0);
    const run = fresh(1, 'bool tomatoRain = true;'); for (const b of run.bots) { b.x = run.px + 2; b.z = run.pz - 4 - run.bots.indexOf(b) * 1.5; b.stun = 99; }
    run.action('ability'); expect(run.tomatoes.length).toBeGreaterThan(10); advance(run, 4); expect(run.tally.robots).toBe(3); run.action('ability'); expect(run.rainCool).toBeGreaterThan(8);
  });
});

describe('TOMATINA touch play and supplies', () => {
  it('sidesteps on touch screens instead of turning, and aims up and down by dragging', () => {
    const run = fresh(); run.briefing = 0; run.strafe = true; const yaw = run.yaw, x = run.px;
    run.input.right = true; advance(run, .5); run.input.right = false;
    expect(run.yaw).toBe(yaw); expect(run.px).toBeGreaterThan(x + 1);
    run.look(.2, -.5); expect(run.pitch).toBeCloseTo(-.5); run.look(0, -2); expect(run.pitch).toBeGreaterThanOrEqual(-1.05);
    const keys = fresh(); keys.input.right = true; advance(keys, .5); expect(keys.yaw).not.toBe(keys.startYaw);
  });
  it('throws along the crosshair when you look down: the tomato lands at your feet, not far away', () => {
    const run = fresh(); run.bots = []; run.pitch = -.8; run.aimAt(0, 0); advance(run, 2);
    const splat = run.splats.at(-1)!; expect(Math.hypot(splat.x - run.px, splat.z - run.pz)).toBeLessThan(2.5);
  });
  it('refills the whole bag at a crate, and never leaves you stuck without tomatoes', () => {
    const run = fresh(1, 'int bagSize = 40;'), crate = run.pickups.find(p => p.kind === 'crate')!; run.ammo = 2; run.px = crate.x; run.pz = crate.z; run.step(.02);
    expect(run.ammo).toBe(40); expect(crate.away).toBeGreaterThan(0);
    const empty = fresh(); empty.ammo = 0; empty.bots = []; advance(empty, 6); expect(empty.ammo).toBeGreaterThanOrEqual(2);
  });
  it('points the compass at the next goal, or at a crate when the bag is empty, and holds robots during the briefing', () => {
    const run = fresh(); expect(run.nextObjective()?.label).toBe('ROBOT'); run.ammo = 0; expect(run.nextObjective()?.label).toBe('TOMATO CRATE');
    const plaza = fresh(2); expect(plaza.nextObjective()?.label).toBe('PLAZA'); const gate = fresh(3); expect(gate.nextObjective()?.label).toBe('BULLSEYE');
    const waiting = fresh(); const mop = waiting.bots[2]; waiting.px = mop.x; waiting.pz = mop.z + 1.2; const at = { x: mop.x, z: mop.z }; advance(waiting, 1); expect({ x: mop.x, z: mop.z }).toEqual(at);
  });
});

describe('TOMATINA robots', () => {
  it('blocks front throws with the umbrella until it droops, but a lob over the top gets through', () => {
    const run = fresh(5), u = run.bots.find(b => b.kind === 'umbrella')!; for (const b of run.bots) b.stun = 999; run.px = u.x; run.pz = u.z + 6; u.yaw = Math.PI / 2;
    for (let i = 0; i < 2; i++) { run.cool = 0; run.throwAt(u.x, .8, u.z); advance(run, 1.2); }
    expect(u.hp).toBe(u.max); expect(run.blockedThrows).toBe(2);
    run.cool = 0; run.throwAt(u.x, .8, u.z); advance(run, 1.2); expect(u.droop).toBeGreaterThan(0);
    const lob = fresh(5), v = lob.bots.find(b => b.kind === 'umbrella')!; for (const b of lob.bots) b.stun = 999; lob.px = v.x; lob.pz = v.z + 6; v.yaw = Math.PI / 2;
    const hand = lob.hand(), shot = lob.ballistic(hand.x, hand.y, hand.z, v.x, 1.2, v.z, lob.config.power, lob.config.gravity, true);
    lob.tomatoes.push({ id: 999, x: hand.x, y: hand.y, z: hand.z, vx: shot.vx, vy: shot.vy, vz: shot.vz, t: 0, bounces: 0, banked: false, size: 2, damage: 1, homing: false, from: 'you', ox: hand.x, oz: hand.z });
    advance(lob, 4); expect(v.hp).toBeLessThan(v.max);
  });
  it('mops scrub your paint, hoses soak you and a soaking costs a spare shirt', () => {
    const run = fresh(2); for (const b of run.bots) b.alert = 0; run.paintFloor(run.bots[0].x + 1, run.bots[0].z, 1.2); const painted = run.paintedTiles;
    run.px = 3; run.pz = 27; advance(run, 6); expect(run.paintedTiles).toBeLessThan(painted);
    const hose = fresh(4); const lives = hose.lives; hose.invuln = 0; for (let i = 0; i < 9; i++) { hose.invuln = 0; hose.soak(12, hose.px, hose.pz); }
    expect(hose.lives).toBe(lives - 1); expect(hose.dry).toBe(100); expect(hose.px).toBe(hose.startX);
  });
  it('slams the washer door after five tomatoes and only takes hits while it is open', () => {
    const run = fresh(12), boss = run.bots.find(b => b.kind === 'boss')!; for (const b of run.bots) b.stun = 999;
    const hit = () => { const t = { id: 1, x: boss.x, y: 1.5, z: boss.z + BOT_INFO.boss.r, vx: 0, vy: 0, vz: -10, t: 0, bounces: 0, banked: false, size: 2, damage: 1, homing: false, from: 'you' as const, ox: boss.x, oz: boss.z + 8 }; (run as unknown as { hitBot(b: typeof boss, t: unknown): void }).hitBot(boss, t); };
    boss.yaw = Math.PI / 2; boss.open = false; hit(); expect(boss.hp).toBe(boss.max);
    boss.open = true; for (let i = 0; i < 6; i++) if (boss.open) hit(); expect(boss.hp).toBe(boss.max - 5); expect(boss.open).toBe(false);
  });
  it('adds invasion robots and fiesta friends, and makes robots quicker on harder brains', () => {
    const run = fresh(1, 'int extraRobots = 4;\nint amigos = 2;'); expect(run.bots).toHaveLength(7); expect(run.amigos).toHaveLength(2);
    for (const b of run.bots.slice(3)) expect(Math.hypot(b.x - run.startX, b.z - run.startZ)).toBeGreaterThan(12);
    const easy = fresh(1, 'string robotLevel = "easy";'), loco = fresh(1, 'string robotLevel = "loco";'); expect(loco.brains.speed).toBeGreaterThan(easy.brains.speed * 1.8);
  });
});

describe('TOMATINA weather and towns', () => {
  it('lets the rain wash paint away and the wind push tomatoes sideways', () => {
    const rain = fresh(1, 'string weather = "rain";'); rain.bots = []; rain.paintFloor(rain.px, rain.pz - 4, 2); const before = rain.paintedTiles; advance(rain, 8); expect(rain.paintedTiles).toBeLessThan(before);
    const flight = (code: string) => { const run = fresh(1, code); run.bots = []; run.throwDirection(run.yaw, .4); advance(run, .6); return run.tomatoes[0]; };
    const calm = flight('string weather = "clear";'), windy = flight('string weather = "wind";');
    expect(Math.hypot(windy.x - calm.x, windy.z - calm.z)).toBeGreaterThan(.3);
  });
  it('has its own towns, throwers and weather, and remixes them live without restarting', () => {
    const values = (id: string) => tomatinaCatalog.mods.find(m => m.id === id)!.values!;
    expect(values('worldTheme')).toEqual(Object.keys(TOWNS)); expect(values('weather')).toEqual(Object.keys(WEATHER)); expect(values('characterStyle')).toContain('abuela');
    const run = fresh(); run.score = 400; const revision = run.revision;
    run.setProgram(parse('string worldTheme = "alhambra";\nstring characterStyle = "luchador";\nstring weather = "fog";')); run.step(.01);
    expect(run.config).toMatchObject({ worldTheme: 'alhambra', characterStyle: 'luchador', weather: 'fog' }); expect(run.revision).toBe(revision); expect(run.score).toBe(400);
    expect(run.weather.sight).toBeLessThan(1); expect(fresh(10).night).toBe(true);
  });
  it('restores a cleared street from the save', () => {
    const run = fresh(); run.tally.robots = 3; run.best = 2; (run as unknown as { checkGoals(): void }).checkGoals(); expect(run.phase).toBe('cleared');
    const restored = new TomatinaRun(run.checkpoint); restored.launch(); expect(restored.phase).toBe('cleared'); expect(restored.tally.robots).toBe(3); expect(restored.best).toBe(2);
  });
});

describe('TOMATINA coaching', () => {
  it.each(['csharp', 'python', 'swift'] as const)('suggests real, parseable mods for losses, wins and struggles in %s', language => {
    const run = fresh(5); run.blockedThrows = 5; run.metrics.actions = 20; run.dry = 30; run.ammo = 0; run.elapsed = 60;
    for (const moment of ['lose', 'win', 'struggle'] as const) {
      const list = tomatinaSpec.invites!(run, moment); expect(list.length, moment).toBeGreaterThan(1);
      for (const invite of list) { const program = parse(invite.code, language); expect(program.ok, invite.code).toBe(true); }
      if (moment === 'lose') expect(list.every(i => i.tone === 'help')).toBe(true);
      if (moment === 'win') expect(list.some(i => i.tone === 'challenge')).toBe(true);
    }
    expect(tomatinaSpec.invites!(run, 'struggle')[0].code).toBe('int bounces = 2;');
    run.setProgram(parse('bool autoAim = true;\nint dryShirts = 5;')); expect(tomatinaSpec.invites!(run, 'lose').some(i => /autoAim|dryShirts/.test(i.code))).toBe(false);
  });
});

