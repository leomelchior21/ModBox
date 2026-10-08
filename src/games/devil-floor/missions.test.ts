import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { LanguageId } from '../../interpreter/core/adapter';
import { FLOOR_MODS, FLOOR_TOOLS, floorSchema, type FloorConfig } from './mods';
import { FLOOR_MISSIONS, FLOOR_SANDBOX, getFloorMission, floorUnlocked, playableFloorProgram, floorMissionPassed } from './missions';
import { DevilFloorRun } from './run';
describe('Devil Floor missions', () => {
  it('offers eight learning missions, a sandbox, and scoped unlocks', () => {
    expect(FLOOR_MISSIONS.filter(m => m.kind !== 'sandbox')).toHaveLength(8);
    expect(floorUnlocked(getFloorMission('m00'), [], false).map(mod => mod.id)).toEqual(['suitColor']);
    expect(floorUnlocked(getFloorMission('free'), [], false)).toEqual(FLOOR_MODS);
    const program = parseGameScript<FloorConfig>('bool shield = true; if (score >= 100) { safeFloor = true; }', 'csharp', floorSchema);
    const held = playableFloorProgram(program, ['suitColor']); expect(held.config).toEqual({}); expect(held.rules).toHaveLength(0);
  });
  it('requires actual jumping, double jumping, rule activation and escape', () => {
    const program = parseGameScript<FloorConfig>(FLOOR_SANDBOX, 'csharp', floorSchema), snapshot = new DevilFloorRun().snapshot();
    for (const id of ['m03', 'm04', 'm05', 'm06', 'final']) expect(floorMissionPassed(getFloorMission(id), program, snapshot)).toBe(false);
    snapshot.metrics.jumps = 2; snapshot.metrics.doubleJumps = 1; snapshot.metrics.exits = 1; snapshot.metrics.minLives = 1;
    snapshot.metrics.ruleTraces = ['score >= 100 → shield = true', 'lives <= 1 → safeFloor = true'];
    for (const id of ['m03', 'm04', 'm05', 'm06', 'final']) expect(floorMissionPassed(getFloorMission(id), program, snapshot)).toBe(true);
  });
});
describe.each<LanguageId>(['csharp', 'python', 'swift'])('%s floor learning content', language => {
  it('parses every mod, code tool and sandbox', () => {
    const parse = (code: string) => parseGameScript<FloorConfig>(formatCodeForLanguage(code, language), language, floorSchema);
    for (const mod of FLOOR_MODS) expect(parse(mod.example).ok, mod.id).toBe(true);
    expect(parse(FLOOR_SANDBOX).ok).toBe(true);
    for (const tool of FLOOR_TOOLS) expect(parse(`${FLOOR_SANDBOX}\n${tool.example}`).ok, tool.id).toBe(true);
  });
  it('validates string, log and arithmetic lessons', () => {
    const source = ['string suitColor = "cyan";', 'string heroName = "Phoenix";', 'Console.WriteLine(heroName);', 'int moveSpeed = 4;', 'moveSpeed = moveSpeed + 2;'].join('\n');
    const program = parseGameScript<FloorConfig>(formatCodeForLanguage(source, language), language, floorSchema);
    expect(program.ok, JSON.stringify(program.diagnostics)).toBe(true);
    for (const id of ['m00', 'm01', 'm02']) expect(floorMissionPassed(getFloorMission(id), program, new DevilFloorRun().snapshot())).toBe(true);
  });
});
