import { describe, expect, it } from 'vitest';
import { FloorEffects, type FloorCue } from './effects';
import { DevilFloorRun, HERO_HEIGHT, LAVA_Y } from './run';
import { parseGameScript } from '../../interpreter/gameScript';
import { floorSchema, type FloorConfig } from './mods';
const idle = { left: false, right: false, jump: false };
describe('Devil Floor action feedback', () => {
  it('emits a jump once, then a landing impact at the contact surface', () => {
    const run = new DevilFloorRun(); run.launch(); run.feedback = [];
    run.step(0.1, { ...idle, jump: true }); run.step(0.1, { ...idle, jump: true });
    expect(run.feedback.filter(c => c.kind === 'jump')).toHaveLength(1);
    for (let i = 0; i < 20; i++) run.step(0.1, idle);
    const landings = run.feedback.filter(c => c.kind === 'land');
    expect(landings).toHaveLength(1); expect(landings[0].y).toBe(430); expect(landings[0].power).toBeGreaterThan(100);
  });
  it('uses the pickup location and actual score for crystal feedback', () => {
    const run = new DevilFloorRun(); run.launch(); run.feedback = [];
    const crystal = run.cavern.crystals[0]; run.player.x = crystal.x - 11; run.player.y = crystal.y - 15;
    run.step(0.01, idle); run.step(0.01, idle);
    expect(run.feedback.filter(c => c.kind === 'crystal')).toEqual([{ kind: 'crystal', x: crystal.x, y: crystal.y, text: '+50', power: undefined }]);
  });
  it('keeps damage feedback at the lava impact and respawn feedback at the saved route', () => {
    const run = new DevilFloorRun(); run.launch(); run.feedback = []; run.player.x = 500; run.player.y = LAVA_Y;
    run.step(0.01, idle);
    expect(run.feedback.find(c => c.kind === 'hit')).toMatchObject({ x: 511, y: LAVA_Y, text: 'LAVA · −1 LIFE' });
    expect(run.feedback.find(c => c.kind === 'respawn')?.x).toBe(run.player.x + 11);
    run.restart(); expect(run.feedback.some(c => c.kind === 'hit')).toBe(false);
  });
  it('signals a collapse once and saves checkpoints with their beacon position', () => {
    const run = new DevilFloorRun(); run.launch(); run.feedback = [];
    const p = run.cavern.platforms[4]; run.player.x = p.x + 35; run.player.y = p.y - HERO_HEIGHT; run.grounded = 4;
    run.step(0.01, idle);
    expect(run.feedback.find(c => c.kind === 'checkpoint')).toMatchObject({ x: p.x + 20, y: p.y - 38 });
    run.platformHeat.set(4, run.config.meltDelay - 0.01); run.step(0.03, idle);
    expect(run.feedback.filter(c => c.kind === 'crumble')).toHaveLength(1);
  });
  it('leaves simulation and feedback untouched while paused', () => {
    const run = new DevilFloorRun(); run.launch(); run.step(0.1, { ...idle, jump: true }); run.pause();
    const cues = [...run.feedback], before = run.snapshot(); run.step(0.1, idle);
    expect(run.feedback).toEqual(cues); expect(run.snapshot()).toEqual(before);
  });
  it('distinguishes an air jump, a blocked shield impact and the sanctuary reward', () => {
    const run = new DevilFloorRun();
    run.setProgram(parseGameScript<FloorConfig>('bool doubleJump = true;\nbool shield = true;', 'csharp', floorSchema));
    run.launch(); run.feedback = [];
    run.step(0.1, { ...idle, jump: true }); run.step(0.01, idle); run.step(0.01, { ...idle, jump: true });
    expect(run.feedback.find(c => c.kind === 'doubleJump')?.text).toBe('AIR JUMP'); expect(run.snapshot().airJumpReady).toBe(false);
    const p = run.cavern.platforms[3]; run.player.x = p.x + 72; run.player.y = p.y - HERO_HEIGHT; run.player.vy = 0; run.invulnerable = 0;
    run.step(0.01, idle); expect(run.feedback.find(c => c.kind === 'shield')?.text).toBe('SHIELD BLOCKED');
    expect(run.lives).toBe(3); expect(run.snapshot().shieldReady).toBe(false);
    run.player.x = run.cavern.exit.x; run.player.y = run.cavern.exit.y - HERO_HEIGHT; run.player.vy = 0;
    run.step(0.01, idle); expect(run.feedback.find(c => c.kind === 'clear')?.text).toBe('CAVERN CLEARED +250');
  });
});
describe('Devil Floor presentation lifecycle', () => {
  const cue: FloorCue = { kind: 'hit', x: 100, y: 400, text: 'LAVA · −1 LIFE' };
  it('creates impact effects, expires them, and clears them on restart', () => {
    const effects = new FloorEffects(); effects.consume([cue], '#ffd28a', false);
    expect(effects.shake).toBeGreaterThan(0); expect(effects.notice?.text).toBe(cue.text); expect(effects.particles.length).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) effects.step(0.1);
    expect(effects.particles).toHaveLength(0); expect(effects.rings).toHaveLength(0); expect(effects.notice).toBeNull(); expect(effects.damage).toBe(0);
    effects.consume([cue], '#ffd28a', false); effects.reset(); expect(effects.particles).toHaveLength(0); expect(effects.notice).toBeNull();
  });
  it('retains readable feedback while removing particles, trails and shake for reduced motion', () => {
    const effects = new FloorEffects(); effects.consume([cue, { kind: 'land', x: 100, y: 430, power: 500 }], '#ffd28a', true);
    effects.follow(100, 400, true, true);
    expect(effects.shake).toBe(0); expect(effects.squash).toBe(0); expect(effects.particles).toHaveLength(0); expect(effects.trail).toHaveLength(0);
    expect(effects.notice?.text).toBe(cue.text); expect(effects.floaters[0].text).toBe(cue.text);
  });
  it('bounds effects during bursts and gives repeated notifications new identities', () => {
    const effects = new FloorEffects(); effects.consume(Array.from({ length: 100 }, () => cue), '#ffd28a', false);
    expect(effects.particles.length).toBeLessThanOrEqual(180); expect(effects.rings.length).toBeLessThanOrEqual(16); expect(effects.floaters.length).toBeLessThanOrEqual(12);
    const id = effects.notice?.id; effects.consume([cue], '#ffd28a', false); expect(effects.notice?.id).not.toBe(id);
  });
});
