// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VectorZeroEngine } from './gameEngine';
import { parseCSharp } from '../../../interpreter/adapters';
import { DEFAULT_CONFIG } from '../../../interpreter/core/limits';
import type { ProgramInput, Rock } from './types';

const healthCode = 'int laserPower = 1; if (health <= 30) { laserPower = 5; }';
function program(code = healthCode): ProgramInput {
  const parsed = parseCSharp(code);
  expect(parsed.ok).toBe(true);
  return { config: { ...DEFAULT_CONFIG, ...parsed.config }, rules: parsed.rules,
    constants: {}, comms: [], missionLabel: 'HEALTH RULE' };
}
type Simulation = {
  rocks: Rock[]; health: number; healthRegenDelay: number;
  step: (dt: number) => void; damageShip: (amount: number) => void;
};
let engine: VectorZeroEngine;
let simulation: Simulation;
beforeEach(() => {
  const ctx = new Proxy({}, { get: () => () => undefined });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as CanvasRenderingContext2D);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  engine = new VectorZeroEngine(document.createElement('canvas'), { reducedMotion: true });
  engine.setSound(false);
  engine.setProgram(program());
  engine.launch();
  simulation = engine as unknown as Simulation;
});
afterEach(() => { engine.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('health-rule rock reinforcements', () => {
  it('replenishes zero or two rocks to three without reducing larger fields', () => {
    for (const count of [2, 0, 1]) {
      simulation.rocks = simulation.rocks.slice(0, count);
      simulation.step(1 / 60);
      expect(simulation.rocks).toHaveLength(3);
      expect(new Set(simulation.rocks.map(rock => rock.id)).size).toBe(3);
      expect(simulation.rocks.every(rock => Number.isFinite(rock.pos.x + rock.vel.y))).toBe(true);
    }
    engine.restart();
    const count = simulation.rocks.length;
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(count);
    expect(engine.getSnapshot().wave).toBe(1);
  });

  it('stops at the integrity trigger, activates power 5 and stays stopped after healing or code edits', () => {
    simulation.rocks = [];
    simulation.damageShip(72);
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(0);
    expect(engine.getConfig().laserPower).toBe(5);
    expect(engine.getMetrics().minHealth).toBe(28);
    simulation.health = 100;
    engine.setProgram(program());
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(0);
    engine.restart();
    simulation.rocks = [];
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(3);
  });

  it('does not replenish when paused or after a death', () => {
    engine.pause();
    simulation.rocks = [];
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(0);
    engine.resume();
    simulation.damageShip(100);
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(0);
  });

  it('leaves normal wave progression alone when the health rule is absent or removed', () => {
    engine.setProgram(program('bool shield = false; if (score >= 300) { shield = true; }'));
    simulation.rocks = [];
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(0);
    engine.setProgram(program());
    simulation.step(1 / 60);
    expect(simulation.rocks).toHaveLength(3);
  });
});
