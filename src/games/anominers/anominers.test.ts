import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { ArcadeConfig } from '../premium-kit/core';
import { anominersCatalog } from './catalog';
import { AnominersRun, ASTEROIDS, EMPTY, COPPER, TECH, VOID } from './run';
import { anominersSpec } from './AnominersScreen';
import { playAsteroid } from './testBots';
import { SECTORS, WEATHER } from './worlds';

const parse = (source: string, language: 'csharp' | 'python' | 'swift' = 'csharp') => parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, anominersCatalog.schema);
const fresh = (level = 1, code?: string) => { const run = new AnominersRun(); if (code) run.setProgram(parse(code)); run.launch(true); if (level > 1) { run.level = level; (run as unknown as { setup(): void }).setup(); } run.briefing = 0; return run; };
const advance = (run: AnominersRun, seconds: number, fps = 120) => { for (let t = 0; t < seconds - 1e-9; t += 1 / fps) run.step(1 / fps); };
const count = (run: AnominersRun, kind: number) => run.grid.filter(k => k === kind).length;

describe('ANOMINERS asteroids', () => {
  it('grows twelve different asteroids from seeds, with minerals, lost tech and a clear landing pad', () => {
    expect(ASTEROIDS).toHaveLength(12);
    ASTEROIDS.forEach((a, i) => {
      const run = fresh(i + 1); expect(count(run, COPPER), a.name).toBeGreaterThan(5); expect(count(run, TECH)).toBe(a.tech ?? 0);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) expect(run.at(run.baseX + dx, run.baseY + dy)).toBe(EMPTY);
      expect(Boolean(run.rift)).toBe(Boolean(a.core));
    });
    expect([...fresh(4).grid]).toEqual([...fresh(4).grid]);
  });
  it('can be mined, banked and warped out of, asteroid by asteroid, by a pilot using only the arrows and BLAST', () => {
    for (let level = 1; level <= ASTEROIDS.length; level++) {
      const result = playAsteroid(level);
      expect(result.won, `${level} ${ASTEROIDS[level - 1].name}: bank ${result.run.bank}/${result.run.ast.quota}`).toBe(true);
      if (level <= 3) expect(result.time, 'early asteroids stay short').toBeLessThan(100);
    }
  }, 180000);
});

describe('ANOMINERS flying and mining', () => {
  it('flies the same way at any frame rate and stops at the rock', () => {
    const far = (fps: number) => { const run = fresh(); run.input.up = true; advance(run, .8, fps); return run.y; };
    expect(Math.abs(far(30) - far(144))).toBeLessThan(.2);
    const run = fresh(); run.input.right = true; advance(run, 6); expect(run.solid(run.x + 1.2, run.y) || run.beam !== null).toBe(true);
  });
  it('drills the rock in front, frees minerals and pulls them in with the magnet', () => {
    const run = fresh(1, 'bool magnet = true;\nint drillPower = 10;');
    let cell = -1; for (let i = 0; i < run.grid.length; i++) if (run.grid[i] === COPPER) { cell = i; break; }
    const cx = cell % run.w + .5, cy = Math.floor(cell / run.w) + .5;
    run.chip(Math.floor(cx), Math.floor(cy), 99); expect(run.grid[cell]).toBe(EMPTY); expect(run.chunks).toHaveLength(1);
    run.x = cx - 6; run.y = cy; for (let k = 0; k < 600 && run.cargo === 0; k++) run.step(1 / 120);
    expect(run.cargo).toBe(1); expect(run.metrics.assisted).toBe(1);
  });
  it('fills the hold, banks at the base for points and warps once the quota is in', () => {
    const run = fresh(1, 'int oreValue = 40;'); run.cargo = run.hold + 5; expect(run.cargo).toBeGreaterThan(run.hold - 1);
    run.cargo = 12; run.x = run.baseX + 2; run.y = run.baseY; const score = run.score; run.step(1 / 60);
    expect(run.bank).toBe(12); expect(run.cargo).toBe(0); expect(run.score - score).toBe(12 * 40); expect(run.ready).toBe(true);
    advance(run, 2.6); expect(run.phase).toBe('cleared');
  });
});

describe('ANOMINERS anomaly', () => {
  it('wakes on time, sends anomalites that hurt, and can be contained with the blaster', () => {
    const run = fresh(2); run.anomalyClock = .01; run.x = run.baseX + 3; advance(run, .1); expect(run.rift).not.toBeNull();
    advance(run, 8); expect(run.glitches.length).toBeGreaterThan(0);
    const g = run.glitches[0]; g.x = run.x + 1; g.y = run.y; g.cool = 0; run.invuln = 0; const hull = run.hull; run.step(1 / 120); expect(run.hull).toBeLessThan(hull);
    run.rift!.hp = 1; run.x = run.rift!.x - 5; run.y = run.rift!.y; run.glitches = []; run.fireCool = 0; run.blast(); advance(run, 1);
    expect(run.rift).toBeNull(); expect(run.contained).toBe(true); expect(run.metrics.perfects).toBe(1);
  });
  it('spreads corruption around the rift', () => {
    const run = fresh(8); run.anomalyClock = .01; advance(run, 20); expect(count(run, VOID)).toBeGreaterThan(0);
  });
  it('wrecks the ship at zero hull: half the cargo spills and a spare hull launches', () => {
    const run = fresh(2); run.cargo = 20; run.invuln = 0; const lives = run.lives; run.damage(200, 'test');
    expect(run.lives).toBe(lives - 1); expect(run.cargo).toBe(0); expect(run.chunks.length).toBe(10); expect(run.hull).toBe(100); expect(run.x).toBeCloseTo(run.baseX + 2.5);
  });
  it('makes the final asteroid about destroying the anomaly core', () => {
    const run = fresh(12); expect(run.rift?.core).toBe(true); expect(run.goalProgress().map(g => g.kind)).toEqual(['core']);
    run.rift!.hp = 1; run.glitches = []; run.x = run.rift!.x - 6; run.y = run.rift!.y; run.fireCool = 0; run.blast(); advance(run, 1); expect(run.coreDown).toBe(true); expect(run.goalsMet).toBe(true);
  });
});

describe('ANOMINERS mods', () => {
  it('changes the run: drill, thrusters, hold, beam, drones, blaster, swarm and mood', () => {
    const drillTime = (code: string) => { const run = fresh(1, code); run.chip(run.w / 2 | 0, run.h / 2 | 0, 0); let i = -1; for (let k = 0; k < run.grid.length; k++) if (run.grid[k] === 1) { i = k; break; } run.x = i % run.w - 1.5; run.y = Math.floor(i / run.w) + .5; run.angle = 0; let t = 0; while (run.grid[i] && t < 10) { run.step(1 / 60); t += 1 / 60; } return t; };
    expect(drillTime('int drillPower = 10;')).toBeLessThan(drillTime('int drillPower = 1;') / 2);
    const fast = fresh(1, 'int thrust = 12;'), slow = fresh(1, 'int thrust = 2;'); fast.input.up = slow.input.up = true; advance(fast, 1); advance(slow, 1); expect(Math.abs(fast.y - fast.baseY)).toBeGreaterThan(Math.abs(slow.y - slow.baseY) * 1.5);
    expect(fresh(1, 'int cargoHold = 80;').hold).toBe(80);
    expect(fresh(1, 'int droneCrew = 3;').drones).toHaveLength(3);
    const bay = fresh(); bay.cargo = 20; expect(bay.buildDrone()).toBe(false); const on = fresh(1, 'bool droneBay = true;'); on.cargo = 20; on.action('ability'); expect(on.drones).toHaveLength(1); expect(on.cargo).toBe(10);
    const spread = fresh(1, 'int blasterLevel = 3;'); spread.blast(); expect(spread.bolts).toHaveLength(3);
    expect(fresh(2, 'string anomalyMood = "sleepy";').anomalyClock).toBeGreaterThan(fresh(2, 'string anomalyMood = "furious";').anomalyClock * 2);
    const swarm = fresh(8, 'int anomalies = 6;'); swarm.anomalyClock = .01; advance(swarm, 30); const calm = fresh(8); calm.anomalyClock = .01; advance(calm, 30); expect(swarm.glitches.length + swarm.score).toBeGreaterThan(0); expect(swarm.glitches.length).toBeGreaterThanOrEqual(calm.glitches.length);
  });
  it('lets drones mine and bring minerals to the ship', () => {
    const run = fresh(1, 'int droneCrew = 2;'); run.x = run.baseX + 6; advance(run, 25); expect(run.cargo + run.drones.reduce((s, d) => s + d.carry, 0)).toBeGreaterThan(0);
  });
  it('has its own sectors, ships and weather that change the play live', () => {
    const values = (id: string) => anominersCatalog.mods.find(m => m.id === id)!.values!;
    expect(values('worldTheme')).toEqual(Object.keys(SECTORS)); expect(values('weather')).toEqual(Object.keys(WEATHER)); expect(values('characterStyle')).toContain('whale');
    const drift = (code: string) => { const run = fresh(1, code); run.input.up = true; advance(run, .5); run.input.up = false; const y = run.y; advance(run, 1); return Math.abs(run.y - y); };
    expect(drift('string worldTheme = "ice";')).toBeGreaterThan(drift('string worldTheme = "classic";') * 1.5);
    const wind = fresh(1, 'string weather = "solar";'), still = fresh(1); advance(wind, 2); advance(still, 2); expect(Math.hypot(wind.x - still.x, wind.y - still.y)).toBeGreaterThan(.5);
    const rocks = fresh(4, 'string weather = "meteors";'); const before = rocks.grid.filter(k => k).length; advance(rocks, 40); expect(rocks.grid.filter(k => k).length).toBeLessThan(before);
    expect(fresh(2, 'string weather = "nebula";').anomalyClock).toBeGreaterThan(fresh(2).anomalyClock);
    const run = fresh(); run.score = 50; const rev = run.revision; run.setProgram(parse('string worldTheme = "ember";\nstring characterStyle = "saucer";')); run.step(.01); expect(run.revision).toBe(rev); expect(run.config.worldTheme).toBe('ember');
  });
});

describe('ANOMINERS coaching', () => {
  it.each(['csharp', 'python', 'swift'] as const)('offers parseable mods after wrecks, warps and struggles in %s', language => {
    const run = fresh(8); run.cargo = run.hold; run.x = 70; run.hull = 30; run.elapsed = 60; run.anomalyClock = 0; (run as unknown as { openRift(x: number, y: number, c: boolean): void }).openRift(60, 30, false);
    for (let i = 0; i < 4; i++) run.glitches.push({ id: 99 + i, x: 1, y: 1, vx: 0, vy: 0, hp: 1, cool: 0, seed: i });
    for (const moment of ['lose', 'win', 'struggle'] as const) { const list = anominersSpec.invites!(run, moment); expect(list.length, moment).toBeGreaterThan(1); for (const invite of list) expect(parse(invite.code, language).ok, invite.code).toBe(true); }
    expect(anominersSpec.invites!(run, 'struggle')[0].code).toBe('int cargoHold = 60;');
  });
});
