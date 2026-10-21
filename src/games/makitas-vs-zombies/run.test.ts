import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { YARD_DEFAULTS, YARD_MODS, YARD_TOOLS, yardSchema, type YardConfig } from './mods';
import { YardRun, readYardCheckpoint, UNIT_INFO, ZOMBIE_INFO, type Zombie, type ZombieKind } from './run';
import { YARD_LEVELS } from './levels';
import { YARD_WORLDS, YARD_WEATHER, yardInvites } from './worlds';
import { YARD_MISSIONS, YARD_REMIX, YARD_STARTER, yardMissionPassed } from './missions';

const parse = (s: string) => parseGameScript<YardConfig>(s, 'csharp', yardSchema);
const advance = (run: YardRun, seconds: number) => { for (let i = 0; i < seconds * 60 && run.phase === 'playing'; i++) run.step(1 / 60); };
const zombie = (kind: ZombieKind = 'worker', row = 2, x = 6): Zombie => ({ id: 900 + Math.round(x * 10) + row, kind, row, x, hp: ZOMBIE_INFO[kind].hp, maxHp: ZOMBIE_INFO[kind].hp, slowed: 0, flash: 0, eating: false, smash: 0 });
/** A fixed level with five open lanes and every tool, without scripted waves. */
function sandbox(): YardRun { const run = new YardRun(); run.level = 8; run.launch(); run.power = 5000; run.cooldowns = {}; return run; }

/** A competent student: collect everything, chargers first, saws in every lane, toolboxes and chainsaws for heavies. */
function bot(run: YardRun) {
  run.collectAll();
  const lanes = run.stage.lanes, at = (kind: string, row: number) => run.units.filter(u => u.kind === kind && u.row === row).length;
  const shooters = (row: number) => run.units.filter(u => u.row === row && ['saw', 'twin', 'frost'].includes(u.kind)).length, zs = (row: number) => run.zombies.filter(z => z.row === row);
  const tryPlace = (kind: Parameters<YardRun['place']>[0], row: number, cols: number[]) => { for (const c of cols) if (run.canPlace(kind, row, c)) return run.place(kind, row, c); return false; };
  const shooter = run.available('twin') && run.power >= 200 ? 'twin' : 'saw';
  for (const row of lanes) if (zs(row).length && !shooters(row)) { tryPlace(shooter, row, [1, 2, 3]); return; }
  for (const row of lanes) for (const z of zs(row)) {
    if ((z.kind === 'brute' || z.kind === 'welder') && z.x < 8) { if (run.available('chainsaw')) tryPlace('chainsaw', row, [Math.max(4, Math.floor(z.x) - 2), 4, 5]); if (run.available('mine')) tryPlace('mine', row, [Math.floor(z.x) - 3]); }
    if (z.x < 7 && run.available('wall') && !at('wall', row) && (z.kind !== 'worker' || zs(row).length > 1)) tryPlace('wall', row, [5, 6]);
  }
  const chargers = run.units.filter(u => u.kind === 'charger').length;
  if (run.available('charger') && chargers < lanes.length * 2) { const row = [...lanes].sort((a, b) => at('charger', a) - at('charger', b))[0]; if (tryPlace('charger', row, [0, 1])) return; if (run.power < 150) return; }
  const row = [...lanes].sort((a, b) => (shooters(a) - zs(a).length * .7) - (shooters(b) - zs(b).length * .7))[0];
  if (shooters(row) < 4) tryPlace(run.available('frost') && shooters(row) === 2 && run.power >= 175 ? 'frost' : shooter, row, [2, 3, 1, 4]);
}
const playLevel = (run: YardRun) => { for (let t = 0; t < 60 * 400 && run.phase === 'playing'; t++) { if (t % 15 === 0) bot(run); run.step(1 / 60); } };

describe('Makitas vs Zombies scripts', () => {
  it.each(['python', 'swift', 'csharp'] as const)('starts with only the world mods and parses every mod, tool and remix in %s', language => {
    const p = (s: string) => parseGameScript<YardConfig>(formatCodeForLanguage(s, language), language, yardSchema);
    const starter = p(YARD_STARTER); expect(starter.ok).toBe(true); expect(Object.keys(starter.config)).toEqual(['worldTheme', 'characterStyle', 'weather']);
    for (const source of [YARD_REMIX, ...YARD_MODS.map(m => m.example), ...YARD_TOOLS.map(t => `${YARD_STARTER}\n${t.example}`)]) { const program = p(source); expect(program.diagnostics.filter(d => d.severity === 'error'), source).toEqual([]); }
    expect(YARD_MODS.some(m => m.id === ('toolColor' as string))).toBe(false);
  });
  it('teaches eight missions whose targets exist and only pass on real play', () => {
    expect(YARD_MISSIONS.filter(m => m.kind !== 'sandbox')).toHaveLength(8);
    const run = new YardRun(); run.setProgram(parse(YARD_REMIX)); run.launch();
    expect(yardMissionPassed(YARD_MISSIONS[0], parse(YARD_REMIX), run.snapshot())).toBe(true);
    expect(yardMissionPassed(YARD_MISSIONS[3], parse(YARD_REMIX), run.snapshot())).toBe(false);
    advance(run, 7); expect(yardMissionPassed(YARD_MISSIONS[3], parse(YARD_REMIX), run.snapshot())).toBe(true);
    expect(yardMissionPassed(YARD_MISSIONS[4], parse(YARD_REMIX), run.snapshot())).toBe(false);
  });
});

describe('Makitas vs Zombies lawn defense', () => {
  it('enforces open lanes, costs, occupied tiles and card recharge, and digs tools up with the shovel', () => {
    const run = new YardRun(); run.launch(); expect(run.stage.lanes).toEqual([2]); expect(run.power).toBe(YARD_DEFAULTS.startingPower);
    expect(run.place('saw', 0, 1)).toBe(false); expect(run.place('charger', 2, 1)).toBe(false);
    expect(run.place('saw', 2, 1)).toBe(true); expect(run.power).toBe(100);
    expect(run.place('saw', 2, 2)).toBe(false); expect(run.notice).toContain('recharging');
    advance(run, 8); expect(run.place('saw', 2, 1)).toBe(false); expect(run.notice).toContain('Tile taken');
    expect(run.shovel(2, 1)).toBe(true); expect(run.units).toHaveLength(0); expect(run.shovel(2, 1)).toBe(false);
    run.power = 10; advance(run, 8); expect(run.place('saw', 2, 1)).toBe(false); expect(run.notice).toContain('Not enough');
  });
  it('fires blades, slows with frost, arms mines, cuts with chainsaws and lets brutes smash tools', () => {
    const run = sandbox();
    run.place('saw', 0, 1); run.zombies = [zombie('worker', 0, 6)]; advance(run, 1.6); expect(run.zombies[0].hp).toBeLessThan(190); expect(run.metrics.shots).toBeGreaterThan(0);
    run.place('frost', 1, 1); run.zombies.push(zombie('worker', 1, 6)); advance(run, 1.6); expect(run.zombies.find(z => z.row === 1)!.slowed).toBeGreaterThan(0);
    run.place('mine', 2, 4); run.zombies.push(zombie('hardhat', 2, 4.6)); advance(run, 2); expect(run.zombies.some(z => z.row === 2)).toBe(true);
    run.units.find(u => u.kind === 'mine')!.armed = 1; advance(run, .2); expect(run.zombies.some(z => z.row === 2)).toBe(false); expect(run.units.some(u => u.kind === 'mine')).toBe(false);
    run.place('chainsaw', 3, 3); run.zombies.push(zombie('welder', 3, 4.2)); advance(run, .2); expect(run.zombies.some(z => z.row === 3)).toBe(false); expect(run.units.find(u => u.kind === 'chainsaw')!.busy).toBeGreaterThan(15);
    run.place('wall', 4, 4); run.zombies.push({ ...zombie('brute', 4, 5.05), id: 7777 }); advance(run, 2.2); expect(run.units.some(u => u.kind === 'wall' && u.row === 4)).toBe(false);
  });
  it('makes power from falling batteries and chargers, with auto collect, and none falls at night', () => {
    const run = new YardRun(); run.level = 2; run.launch(); run.place('charger', 1, 0); const start = run.power;
    advance(run, 7); expect(run.batteries.some(b => b.sky)).toBe(true); expect(run.batteries.some(b => !b.sky)).toBe(true);
    run.collectAll(); expect(run.power).toBeGreaterThan(start); expect(run.metrics.collected).toBeGreaterThan(0);
    run.setProgram(parse('bool autoCollect = true; int chargeRate = 10;')); advance(run, 7); expect(run.batteries).toHaveLength(0);
    const night = new YardRun(); night.level = 7; night.launch(); expect(night.stage.night).toBe(true); advance(night, 15); expect(night.batteries).toHaveLength(0);
  });
  it('launches each lane sweeper once, then lets a zombie that reaches the workshop end the level', () => {
    const run = sandbox(); run.zombies = [zombie('worker', 2, .1), { ...zombie('worker', 2, 3), id: 4 }]; advance(run, 3);
    expect(run.sweepers.find(s => s.row === 2)!.state).not.toBe('ready'); expect(run.zombies).toHaveLength(0); expect(run.metrics.kills).toBe(2);
    run.zombies = [zombie('runner', 2, .3)]; advance(run, 4); expect(run.phase).toBe('gameover');
  });
  it('applies blade, twin, overdrive, quick hands, wall health and zombie speed mods live', () => {
    const run = sandbox(); run.setProgram(parse('int bladeDamage = 45; bool doubleShot = true; bool overdrive = true; bool quickHands = true; int wallHealth = 3000; int zombieSpeed = 1;'));
    run.place('saw', 0, 1); run.zombies = [zombie('welder', 0, 7)]; advance(run, .25); expect(run.blades).toHaveLength(2); expect(run.blades[0].damage).toBe(45);
    run.place('wall', 1, 3); expect(run.units.find(u => u.kind === 'wall')!.maxHp).toBe(3000); expect(run.cooldowns.wall).toBeCloseTo(UNIT_INFO.wall.recharge / 2);
    const x = run.zombies[0].x; advance(run, 1); expect(x - run.zombies[0].x).toBeLessThan(ZOMBIE_INFO.welder.speed / 2);
  });
  it('clears every level with sensible play and opens a new tool after each early level', () => {
    for (let level = 1; level <= YARD_LEVELS.length; level++) {
      const run = new YardRun(); run.level = level; run.launch(); playLevel(run);
      expect(run.phase, `level ${level} ${run.stage.name}`).toBe('cleared');
    }
    expect(YARD_LEVELS.slice(0, 6).map(l => l.reward)).toEqual(['charger', 'wall', 'mine', 'frost', 'chainsaw', 'twin']);
  });
  it('saves level progress, restores it, and replays earlier levels without losing the best level', () => {
    const run = new YardRun(); run.launch(); playLevel(run); expect(run.phase).toBe('cleared');
    const saved = JSON.parse(JSON.stringify(run.checkpoint)); expect(saved).toMatchObject({ version: 2, level: 2, best: 2 });
    const restored = new YardRun(saved); restored.launch(); expect(restored.level).toBe(2); expect(restored.score).toBe(run.score); expect(restored.stage.cards).toContain('charger');
    expect(restored.playLevel(3)).toBe(false); expect(restored.playLevel(1)).toBe(true); expect(restored.level).toBe(1); expect(restored.checkpoint?.best).toBe(2); expect(restored.frontier).toBe(2);
    expect(readYardCheckpoint({ ...saved, version: 1 })).toBeNull(); expect(readYardCheckpoint({ ...saved, level: 0 })).toBeNull(); expect(readYardCheckpoint({ ...saved, metrics: {} })).toBeNull();
  });
});

describe('yards, weather and the foreman', () => {
  it('slows zombies in the snow and offers fixes after a breach', () => {
    const pace = (weather: string) => { const run = new YardRun(); run.setProgram(parseGameScript<YardConfig>(`string weather = "${weather}";`, 'csharp', yardSchema)); run.launch(); for (let i = 0; i < 60 * 40; i++) run.step(1 / 60); return run.zombies.length ? Math.min(...run.zombies.map(z => z.x)) : 99; };
    expect(pace('snow')).toBeGreaterThan(pace('clear'));
    const state = { config: { ...YARD_DEFAULTS }, power: 20, wave: 2, kills: 3, lost: true };
    expect(yardInvites(state, 'lose')[0].code).toBe('int bladeDamage = 30;'); expect(yardInvites(state, 'struggle')[0].code).toBe('bool autoCollect = true;'); expect(yardInvites(state, 'win')[0].code).toBe('string worldTheme = "graveyard";');
    for (const moment of ['lose', 'win', 'struggle'] as const) for (const invite of yardInvites(state, moment)) expect(parseGameScript<YardConfig>(invite.code, 'csharp', yardSchema).ok, invite.code).toBe(true);
    expect(Object.keys(YARD_WORLDS)).toEqual(YARD_MODS.find(m => m.id === 'worldTheme')!.values); expect(Object.keys(YARD_WEATHER)).toEqual(YARD_MODS.find(m => m.id === 'weather')!.values);
  });
});
