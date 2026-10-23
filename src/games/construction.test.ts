import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../interpreter/gameScript';
import { DevilFloorRun, HERO_HEIGHT } from './devil-floor/run';
import { FLOOR_MODS, FLOOR_TOOLS, floorSchema, type FloorConfig } from './devil-floor/mods';
import { FLOOR_MISSIONS } from './devil-floor/missions';
import { YARD_MODS, YARD_TOOLS } from './makitas-vs-zombies/mods';
import { YARD_MISSIONS } from './makitas-vs-zombies/missions';

const floorIdle = { left: false, right: false, jump: false };

describe('world construction and discovery', () => {
  it('makes every mission target available when it is taught', () => {
    for (const [missions, controls] of [[FLOOR_MISSIONS, [...FLOOR_MODS, ...FLOOR_TOOLS]], [YARD_MISSIONS, [...YARD_MODS, ...YARD_TOOLS]]] as const) {
      for (const mission of missions) if (mission.targetId) {
        const control = controls.find(c => c.id === mission.targetId);
        expect(control, `${mission.title}: ${mission.targetId}`).toBeDefined();
        expect(control!.unlockAt, mission.title).toBeLessThanOrEqual(mission.order);
      }
    }
  });
  it('starts with one platform and builds or shortens the route without restarting', () => {
    const run = new DevilFloorRun(); run.launch();
    expect(run.cavern.platforms).toHaveLength(1); expect(run.cavern.crystals).toHaveLength(0); expect(run.fireballs()).toHaveLength(0);
    const before = { ...run.player };
    run.setProgram(parseGameScript<FloorConfig>('int platforms = 6;', 'csharp', floorSchema));
    expect(run.cavern.platforms).toHaveLength(7); expect(run.player).toEqual(before);
    const p = run.cavern.platforms[4]; run.player = { x: p.x + 35, y: p.y - HERO_HEIGHT, vx: 0, vy: 0 }; run.grounded = 4; run.checkpoint = 4;
    run.setProgram(parseGameScript<FloorConfig>('int platforms = 0;', 'csharp', floorSchema));
    expect(run.grounded).toBe(0); expect(run.checkpoint).toBe(0);
    run.player.x = run.cavern.exit.x; run.step(0.01, floorIdle);
    expect(run.metrics.exits).toBe(0);
  });

  it('only crumbles platforms when the player adds that effect', () => {
    const run = new DevilFloorRun();
    run.setProgram(parseGameScript<FloorConfig>('int platforms = 6; int meltDelay = 1;', 'csharp', floorSchema)); run.launch();
    const p = run.cavern.platforms[1]; run.player.x = p.x + 20; run.player.y = p.y - HERO_HEIGHT; run.grounded = 1;
    for (let i = 0; i < 20; i++) run.step(0.1, floorIdle);
    expect(run.collapsed.size).toBe(0);
    run.setProgram(parseGameScript<FloorConfig>('int platforms = 6; int meltDelay = 1; string platformEffect = "crumble";', 'csharp', floorSchema));
    for (let i = 0; i < 11; i++) run.step(0.1, floorIdle);
    expect(run.collapsed.has(1)).toBe(true);
  });
});
