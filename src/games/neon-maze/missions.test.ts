import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import type { LanguageId } from '../../interpreter/core/adapter';
import { MAZE_MODS, MAZE_TOOLS, mazeSchema, type MazeConfig } from './mods';
import { getMazeMission, MAZE_MISSIONS, MAZE_SANDBOX, mazeMissionPassed, mazeUnlocked, playableMazeProgram } from './missions';
import { NeonMazeRun } from './run';
describe('Neon Maze mission gates', () => {
  it('has eight learning missions and a fully unlocked sandbox', () => {
    expect(MAZE_MISSIONS.filter(m => m.kind !== 'sandbox')).toHaveLength(8);
    expect(mazeUnlocked(getMazeMission('m00'), [], false).map(mod => mod.id)).toEqual(['wallColor']);
    expect(mazeUnlocked(getMazeMission('free'), [], true)).toEqual(MAZE_MODS);
  });
  it('holds locked controls and rule actions behind discovery', () => {
    const program = parseGameScript<MazeConfig>('int sentinels = 5;\nbool shield = true;\nif (score >= 100) { shield = false; }', 'csharp', mazeSchema);
    const held = playableMazeProgram(program, ['wallColor']);
    expect(held.config).toEqual({}); expect(held.rules).toHaveLength(0);
    expect(program.config.sentinelCount).toBe(5);
  });
  it('requires live play before completing chase, phase, rule and final missions', () => {
    const program = parseGameScript<MazeConfig>(MAZE_SANDBOX.replace('int sentinels = 2;', 'int sentinels = 3;').replace('bool shield = false;', 'bool shield = true;'), 'csharp', mazeSchema);
    const snapshot = new NeonMazeRun(1).snapshot();
    for (const id of ['m03', 'm04', 'm05', 'm06', 'final']) expect(mazeMissionPassed(getMazeMission(id), program, snapshot)).toBe(false);
    snapshot.metrics.cores = 1; snapshot.metrics.phases = 1; snapshot.metrics.exits = 1;
    snapshot.metrics.minEnergy = 25; snapshot.metrics.ruleTraces = ['score >= 100 → shield = true', 'energy <= 40 → phaseLength = 4'];
    for (const id of ['m03', 'm04', 'm05', 'm06', 'final']) expect(mazeMissionPassed(getMazeMission(id), program, snapshot)).toBe(true);
  });
});
describe.each<LanguageId>(['csharp', 'python', 'swift'])('%s maze learning content', language => {
  it('parses every mod, tool and full-game template', () => {
    for (const mod of MAZE_MODS) expect(parseGameScript<MazeConfig>(formatCodeForLanguage(mod.example, language), language, mazeSchema).ok, mod.name).toBe(true);
    const source = formatCodeForLanguage(MAZE_SANDBOX, language);
    expect(parseGameScript<MazeConfig>(source, language, mazeSchema).ok).toBe(true);
    for (const tool of MAZE_TOOLS) expect(parseGameScript<MazeConfig>(source + '\n' + formatCodeForLanguage(tool.example, language), language, mazeSchema).ok, tool.id).toBe(true);
  });
  it('accepts the string and arithmetic teaching steps', () => {
    const source = ['string wallColor = "violet";', 'string runnerName = "Aurora";', 'Console.WriteLine(runnerName);', 'int moveSpeed = 4;', 'moveSpeed = moveSpeed + 2;'].join('\n');
    const program = parseGameScript<MazeConfig>(formatCodeForLanguage(source, language), language, mazeSchema);
    const snapshot = new NeonMazeRun(2).snapshot();
    for (const id of ['m00', 'm01', 'm02']) expect(mazeMissionPassed(getMazeMission(id), program, snapshot)).toBe(true);
  });
});
