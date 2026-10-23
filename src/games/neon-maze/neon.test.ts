import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { ArcadeConfig } from '../premium-kit/core';
import { mazeCatalog } from './catalog';
import { NeonMazeRun, SECTORS } from './run';
import { carve, distances, distAt, isOpen, DIRS, type Dir } from './grid';
import { neonMazeSpec } from './NeonMazeScreen';
import { playSector } from './testBots';
import { GRIDS, SIGNALS } from './worlds';

const parse = (source: string, language: 'csharp' | 'python' | 'swift' = 'csharp') => parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, mazeCatalog.schema);
const fresh = (level = 1, code?: string) => { const run = new NeonMazeRun(); if (code) run.setProgram(parse(code)); run.launch(true); if (level > 1) { run.level = level; (run as unknown as { setup(): void }).setup(); } run.briefing = 0; return run; };
const advance = (run: NeonMazeRun, seconds: number, fps = 120) => { for (let t = 0; t < seconds - 1e-9; t += 1 / fps) run.step(1 / fps); };
const calm = (run: NeonMazeRun) => { run.sentinels = []; return run; };

describe('NEON MAZE sectors', () => {
  it('carves connected, braided labyrinths with the exit far away and gems reachable (or one dash away)', () => {
    for (let level = 1; level <= SECTORS.length; level++) {
      const run = fresh(level), g = run.grid, dist = distances(g, g.start);
      expect(distAt(g, dist, g.exit), SECTORS[level - 1].name).toBeGreaterThan(8);
      for (const gem of g.gems) {
        const walk = distAt(g, dist, gem) >= 0, dash = (Object.keys(DIRS) as Dir[]).some(d => isOpen(g, gem.x - DIRS[d].x * 2, gem.y - DIRS[d].y * 2) && distAt(g, dist, { x: gem.x - DIRS[d].x * 2, y: gem.y - DIRS[d].y * 2 }) >= 0);
        expect(walk || dash, `${SECTORS[level - 1].name} gem`).toBe(true);
      }
      for (let y = 1; y < g.h - 1; y += 2) for (let x = 1; x < g.w - 1; x += 2) if (g.open[y][x] && !g.gems.some(t => Math.abs(t.x - x) + Math.abs(t.y - y) <= 2)) expect(Object.values(DIRS).filter(d => g.open[y + d.y][x + d.x]).length, 'no dead ends').toBeGreaterThan(1);
    }
    expect(carve(7, 9, 5)).toEqual(carve(7, 9, 5));
  });
  it('can be cleared sector by sector by a player who only steers and dashes', () => {
    for (let level = 1; level <= SECTORS.length; level++) {
      const result = playSector(level);
      expect(result.won, `${level} ${SECTORS[level - 1].name}`).toBe(true);
      if (level <= 3) expect(result.time, 'early sectors stay quick').toBeLessThan(30);
    }
  }, 120000);
});

describe('NEON MAZE movement', () => {
  it('rolls the same distance at any frame rate, remembers turns and reverses at once', () => {
    const tiles = (fps: number) => { const run = calm(fresh()); run.steer('up'); advance(run, 1, fps); return run.steps; };
    expect(Math.abs(tiles(30) - tiles(144))).toBeLessThanOrEqual(1);
    const run = calm(fresh()); run.steer('up'); advance(run, .3); const before = { ...run.position };
    run.steer('down'); expect(run.runner.dir).toBe('down'); advance(run, .1); expect(run.position.y).toBeGreaterThan(before.y);
    expect(run.metrics.actions).toBeGreaterThan(0);
  });
  it('phase-dashes through a wall into the room behind it', () => {
    const run = calm(fresh()), g = run.grid;
    const spot = (() => { for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) for (const d of Object.keys(DIRS) as Dir[]) if (g.open[y][x] && !isOpen(g, x + DIRS[d].x, y + DIRS[d].y) && isOpen(g, x + DIRS[d].x * 2, y + DIRS[d].y * 2)) return { x, y, d }; return null; })()!;
    run.runner = { from: { x: spot.x, y: spot.y }, at: { x: spot.x, y: spot.y }, t: 1, dir: spot.d, moving: false }; run.want = spot.d;
    expect(run.phaseDash()).toBe(true); advance(run, .4); expect(run.tile).toEqual({ x: spot.x + DIRS[spot.d].x * 2, y: spot.y + DIRS[spot.d].y * 2 }); expect(run.phaseDash()).toBe(false);
  });
  it('builds FLOW from a chain of dots and lets it fade when you stop', () => {
    const run = calm(fresh()), g = run.grid, arrive = (run as unknown as { arrive(t: { x: number; y: number }): void }).arrive.bind(run);
    const dots: { x: number; y: number }[] = []; for (let y = 0; y < g.h && dots.length < 20; y++) for (let x = 0; x < g.w && dots.length < 20; x++) if (run.dots[y * g.w + x]) dots.push({ x, y });
    const score = run.score; for (const t of dots) arrive(t);
    expect(run.flow).toBeGreaterThan(3); expect(run.dotsEaten).toBe(20); expect(run.score - score).toBeGreaterThan(20 * 10);
    run.dots.fill(0); advance(run, 3); expect(run.flow).toBe(1);
  });
});

describe('NEON MAZE sentinels', () => {
  it('freezes sentinels with a gem, pays doubling points for catches, and wakes a ghost train you can devour', () => {
    const run = fresh(3), g = run.grid;
    for (const s of run.sentinels.filter(s => s.kind === 'drone')) { s.state = 'active'; s.car = run.train; }
    expect(run.train).toBeGreaterThan(3);
    const gem = g.gems[0]; run.runner = { from: { ...gem }, at: { ...gem }, t: .99, dir: 'up', moving: true }; run.parked = false; run.step(1 / 60);
    expect(run.cores).toBe(1); expect(run.stun).toBeGreaterThan(5); expect(run.sentinels.filter(s => s.state === 'active').every(s => s.scared)).toBe(true);
    const score = run.score; for (const s of run.sentinels.filter(s => s.kind === 'drone').slice(0, 3)) { s.from = { ...run.tile }; s.at = { ...run.tile }; s.t = 1; run.step(1 / 120); }
    expect(run.chain).toBe(3); expect(run.score - score).toBe(run.config.bonus * (2 + 4 + 8)); expect(run.metrics.perfects).toBeGreaterThan(0);
  });
  it('costs an orb when a hunter catches you, unless the shield is up; bumping your own train only scatters it', () => {
    const run = fresh(2), hunter = run.sentinels.find(s => s.kind === 'hunter')!; run.invuln = 0; const lives = run.lives;
    hunter.from = { ...run.tile }; hunter.at = { ...run.tile }; hunter.t = 1; hunter.wait = 0; run.step(1 / 120);
    expect(run.lives).toBe(lives - 1); expect(run.tile).toEqual(run.grid.start);
    const shielded = fresh(2, 'bool shield = true;'), h = shielded.sentinels.find(s => s.kind === 'hunter')!; shielded.invuln = 0; h.from = { ...shielded.tile }; h.at = { ...shielded.tile }; h.t = 1; shielded.step(1 / 120);
    expect(shielded.lives).toBe(lives); expect(shielded.metrics.assisted).toBe(1); expect(shielded.shieldCool).toBeGreaterThan(7);
    const train = fresh(3), drone = train.sentinels.find(s => s.kind === 'drone')!; train.invuln = 0; drone.state = 'active'; drone.from = { ...train.tile }; drone.at = { ...train.tile }; drone.t = 1; train.flow = 5; train.step(1 / 120);
    expect(train.lives).toBe(train.config.lives); expect(drone.state).toBe('asleep'); expect(train.flow).toBe(1);
  });
  it('makes the Warden take three frozen catches before the exit opens', () => {
    const run = fresh(12), warden = run.sentinels.find(s => s.kind === 'warden')!;
    for (let i = 0; i < 3; i++) { run.stun = 5; warden.state = 'active'; warden.scared = true; warden.from = { ...run.tile }; warden.at = { ...run.tile }; warden.t = 1; run.step(1 / 120); }
    expect(run.wardenCaught).toBe(3); expect(run.exitOpen).toBe(true);
  });
});

describe('NEON MAZE mods', () => {
  it('lets every mod change the labyrinth or the chase', () => {
    expect(fresh(1, 'int mazeSize = 9;').grid.w).toBeGreaterThan(fresh(1, 'int mazeSize = 5;').grid.w);
    expect(fresh(1, 'int sentinels = 3;').sentinels.filter(s => s.kind === 'hunter')).toHaveLength(SECTORS[0].hunters + 3);
    expect(fresh(1, 'int sleepers = 5;').sentinels.filter(s => s.kind === 'drone')).toHaveLength(5);
    expect(fresh(1, 'int moveSpeed = 9;').runnerSpeed).toBeGreaterThan(fresh(1, 'int moveSpeed = 2;').runnerSpeed * 1.5);
    const long = fresh(1, 'int gemDuration = 11;'), gem = long.grid.gems[0]; calm(long).runner = { from: { ...gem }, at: { ...gem }, t: .99, dir: 'up', moving: true }; long.parked = false; long.step(1 / 60); expect(long.stun).toBeGreaterThan(10);
    expect(fresh(6).dark).toBe(true); expect(fresh(6, 'bool revealMap = true;').dark).toBe(false);
    const warp = fresh(); warp.timeWarp(); expect(warp.warp).toBe(0); const on = fresh(1, 'bool timeWarp = true;'); on.action('ability'); expect(on.warp).toBe(4);
    const far = fresh(1, 'int phaseLength = 4;'); expect(far.config.phaseLength).toBe(4);
  });
  it('keeps the original game’s variable names, so old saved code still runs', () => {
    const old = ['string wallColor = "violet";', 'string runnerName = "Aurora";', 'int moveSpeed = 6;', 'int sentinels = 2;', 'int sentinelSpeed = 1;', 'int phaseLength = 3;', 'int coreValue = 50;', 'int gemDuration = 6;', 'int mazeSize = 7;', 'bool shield = false;', 'bool trail = true;', 'bool revealMap = true;', 'Console.WriteLine(runnerName);', 'if (score >= 100)', '{', '    shield = true;', '}', 'if (energy <= 40)', '{', '    phaseLength = 4;', '}'].join('\n');
    for (const language of ['csharp', 'python', 'swift'] as const) { const program = parse(old, language); expect(program.diagnostics.filter(d => d.severity === 'error'), language).toEqual([]); }
    const run = fresh(1, old); expect(run.config.playerName).toBe('Aurora'); expect(run.config.wallColor).toBe('violet');
  });
  it('has its own grid styles, runners and live signal weather', () => {
    const values = (id: string) => mazeCatalog.mods.find(m => m.id === id)!.values!;
    expect(values('worldTheme')).toEqual(Object.keys(GRIDS)); expect(values('weather')).toEqual(Object.keys(SIGNALS)); expect(values('characterStyle')).toContain('chomper');
    const run = fresh(); run.score = 300; const revision = run.revision; run.setProgram(parse('string worldTheme = "matrix";\nstring weather = "snow";')); run.step(.01);
    expect(run.config.worldTheme).toBe('matrix'); expect(run.revision).toBe(revision); expect(run.runnerSpeed).toBeLessThan(fresh().runnerSpeed);
  });
});

describe('NEON MAZE coaching', () => {
  it.each(['csharp', 'python', 'swift'] as const)('offers parseable mods after losses, wins and struggles in %s', language => {
    const run = fresh(6); run.lives = 1; run.elapsed = 60; for (const s of run.sentinels.filter(s => s.kind === 'drone')) s.state = 'active';
    for (const moment of ['lose', 'win', 'struggle'] as const) {
      const list = neonMazeSpec.invites!(run, moment); expect(list.length, moment).toBeGreaterThan(0);
      for (const invite of list) expect(parse(invite.code, language).ok, invite.code).toBe(true);
    }
    expect(neonMazeSpec.invites!(run, 'lose')[0].code).toBe('bool shield = true;');
  });
});
