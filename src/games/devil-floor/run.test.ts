import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { LanguageId } from '../../interpreter/core/adapter';
import { floorSchema, type FloorConfig } from './mods';
import { DevilFloorRun, generateCavern, HERO_HEIGHT, HERO_WIDTH, LAVA_Y, type FloorInput } from './run';
const idle: FloorInput = { left: false, right: false, jump: false };
const parse = (source: string, language: LanguageId = 'csharp') => parseGameScript<FloorConfig>(formatCodeForLanguage(source, language), language, floorSchema);
function runWith(source = '') { const run = new DevilFloorRun(); run.setProgram(parse(source)); run.launch(); return run; }
function ticks(run: DevilFloorRun, count: number, input = idle, dt = 1 / 60) { for (let i = 0; i < count; i++) run.step(dt, input); }

describe('Devil Floor physics and expedition', () => {
  it('responds immediately to running, reversal and releasing the controls', () => {
    const run = runWith(), x = run.player.x;
    run.step(1 / 60, { ...idle, right: true }); expect(run.player.x).toBeGreaterThan(x);
    run.step(1 / 60, { ...idle, left: true }); expect(run.player.x).toBeCloseTo(x);
    run.step(1 / 60, idle); expect(run.player.x).toBeCloseTo(x); expect(run.player.vx).toBe(0);
  });
  it('lands consistently at different frame rates and never jumps repeatedly from a held button', () => {
    for (const dt of [1 / 120, 1 / 60, 0.1]) {
      const run = runWith(); ticks(run, Math.round(1.3 / dt), { ...idle, jump: true }, dt);
      expect(run.grounded).toBe(0); expect(run.player.y).toBe(430 - HERO_HEIGHT); expect(run.metrics.jumps).toBe(1);
    }
  });
  it('allows an airborne second jump only when enabled and after release', () => {
    for (const enabled of [false, true]) {
      const run = runWith(`bool doubleJump = ${enabled};`);
      ticks(run, 10, { ...idle, jump: true }); run.step(1 / 60, idle); run.step(1 / 60, { ...idle, jump: true });
      expect(run.metrics.doubleJumps).toBe(enabled ? 1 : 0);
      if (enabled) expect(run.player.vy).toBeLessThan(-450);
      run.step(1 / 60, idle); run.step(1 / 60, { ...idle, jump: true }); expect(run.metrics.jumps).toBe(enabled ? 2 : 1);
    }
  });
  it('offers a short grace period after running off a ledge', () => {
    const run = runWith(); run.player.x = 330; run.grounded = null;
    run.step(0.04, idle); run.step(0.01, { ...idle, jump: true });
    expect(run.metrics.jumps).toBe(1); expect(run.player.vy).toBeLessThan(0);
  });
  it('buffers a jump pressed just before landing', () => {
    const run = runWith(); run.player.y = 430 - HERO_HEIGHT - 2; run.player.vy = 120; run.grounded = null;
    ticks(run, 20, idle); // Expire coyote time with a real jump instead of teleporting it.
    run.step(1 / 60, { ...idle, jump: true }); ticks(run, 15, idle);
    run.player.y = 430 - HERO_HEIGHT - 2; run.player.vy = 120; run.grounded = null;
    run.step(1 / 60, { ...idle, jump: true }); run.step(1 / 60, { ...idle, jump: true });
    expect(run.metrics.jumps).toBe(2); expect(run.player.vy).toBeLessThan(0);
  });
  it('can clear every generated gap with the default physics', () => {
    for (const level of [1, 2, 3, 4]) {
      const run = runWith('bool safeFloor = true;'); run.cavern = generateCavern(level);
      for (let i = 0; i < run.cavern.platforms.length - 1; i++) {
        const from = run.cavern.platforms[i], next = run.cavern.platforms[i + 1];
        run.player = { x: from.x + from.width - HERO_WIDTH - 2, y: from.y - HERO_HEIGHT, vx: 0, vy: 0 };
        run.grounded = from.id; run.invulnerable = 100; run.releaseInput();
        run.step(1 / 60, { ...idle, right: true, jump: true });
        for (let tick = 0; tick < 100 && run.grounded === null; tick++) run.step(1 / 60, { ...idle, right: true });
        expect(run.grounded, `level ${level}, platform ${from.id}`).toBe(next.id);
      }
    }
  });
  it('collapses heated platforms and leaves safe platforms stable', () => {
    for (const safe of [false, true]) {
      const run = runWith(`bool safeFloor = ${safe}; int meltDelay = 1;`), p = run.cavern.platforms[1];
      run.player.x = p.x + 10; run.player.y = p.y - HERO_HEIGHT; run.grounded = p.id;
      ticks(run, 61);
      expect(run.collapsed.has(p.id)).toBe(!safe);
      expect(run.snapshot().floorRemaining).toBeNull();
    }
  });
  it('collects each crystal once and preserves score after a lava death', () => {
    const run = runWith('int crystalValue = 75;'), crystal = run.cavern.crystals[0];
    run.player.x = crystal.x - HERO_WIDTH / 2; run.player.y = crystal.y - HERO_HEIGHT / 2;
    run.step(0.01, idle); expect(run.score).toBe(75); expect(run.metrics.crystals).toBe(1);
    run.step(0.01, idle); expect(run.score).toBe(75);
    run.player.y = LAVA_Y; run.step(0.01, idle);
    expect(run.lives).toBe(2); expect(run.score).toBe(75); expect(run.collected.has(crystal.id)).toBe(true);
  });
  it('saves a checkpoint and respawns there with rebuilt platforms', () => {
    const run = runWith(), p = run.cavern.platforms[4];
    run.player.x = p.x + 35; run.player.y = p.y - HERO_HEIGHT; run.step(0.01, idle);
    expect(run.checkpoint).toBe(4); run.collapsed.add(1); run.player.y = LAVA_Y; run.step(0.01, idle);
    expect(run.player.x).toBe(p.x + 35); expect(run.grounded).toBe(4); expect(run.collapsed.size).toBe(0);
    run.setProgram(parse('bool checkpoints = false;')); run.player.y = LAVA_Y; run.step(0.01, idle);
    expect(run.player.x).toBe(35); expect(run.grounded).toBe(0);
  });
  it('makes spikes cost a life, lets the shield absorb one hit, and keeps lava lethal', () => {
    const run = runWith('bool shield = true;'), p = run.cavern.platforms[3];
    const onSpike = () => { run.player.x = p.x + 72; run.player.y = p.y - HERO_HEIGHT; run.invulnerable = 0; run.step(0.01, idle); };
    onSpike(); expect(run.lives).toBe(3); expect(run.shieldCooldown).toBeGreaterThan(7);
    onSpike(); expect(run.lives).toBe(2); expect(run.metrics.hits).toBe(1);
    run.player.y = LAVA_Y; run.step(0.01, idle); expect(run.lives).toBe(1);
    run.player.y = LAVA_Y; run.step(0.01, idle); expect(run.phase).toBe('gameover');
    const state = run.snapshot(); run.step(0.1, idle); expect(run.snapshot()).toEqual(state);
  });
  it('makes fireballs damage the player', () => {
    const run = runWith(), fire = run.fireballs()[0];
    run.player.x = fire.x - HERO_WIDTH / 2; run.player.y = fire.y - HERO_HEIGHT / 2; run.invulnerable = 0;
    run.step(0.001, idle); expect(run.lives).toBe(2); expect(run.metrics.hits).toBe(1);
  });
  it('holds all gameplay while paused and retains the last valid program', () => {
    const run = runWith('int moveSpeed = 8;'); run.setProgram(parse('int moveSpeed = ;'));
    expect(run.config.moveSpeed).toBe(8); run.pause(); const snapshot = run.snapshot(), player = { ...run.player };
    ticks(run, 10, { ...idle, right: true, jump: true }); expect(run.snapshot()).toEqual(snapshot); expect(run.player).toEqual(player);
    run.resume(); run.step(0.1, { ...idle, right: true }); expect(run.player.x).toBeGreaterThan(player.x);
  });
  it('clears at the exit, advances with score and lives intact, and fully resets on restart', () => {
    const run = runWith(); run.score = 100; run.lives = 2;
    run.player.x = run.cavern.exit.x; run.player.y = run.cavern.exit.y - HERO_HEIGHT; run.step(0.01, idle);
    expect(run.phase).toBe('cleared'); expect(run.metrics.exits).toBe(1); expect(run.score).toBe(350);
    run.advance(); expect(run.phase).toBe('playing'); expect(run.level).toBe(2); expect(run.lives).toBe(2); expect(run.score).toBe(350);
    run.restart(); expect(run.score).toBe(0); expect(run.lives).toBe(3); expect(run.metrics.exits).toBe(0);
  });
});
describe.each<LanguageId>(['csharp', 'python', 'swift'])('%s platformer rules', language => {
  it('applies live score and life rules and writes their messages once', () => {
    const run = runWith();
    const program = parse(['bool shield = false;', 'bool safeFloor = false;', 'if (score >= 100)', '{', '    shield = true;', '    Console.WriteLine("Shield online");', '}', 'if (lives <= 1)', '{', '    safeFloor = true;', '}'].join('\n'), language);
    expect(program.ok, JSON.stringify(program.diagnostics)).toBe(true); run.setProgram(program);
    run.score = 100; run.lives = 1; run.step(0, idle);
    expect(run.config.shield).toBe(true); expect(run.config.safeFloor).toBe(true); expect(run.messages).toContain('Shield online'); expect(run.metrics.ruleTraces).toHaveLength(2);
    run.score = 0; run.lives = 3; run.step(0, idle); expect(run.config.shield).toBe(false); expect(run.config.safeFloor).toBe(false);
  });
});
