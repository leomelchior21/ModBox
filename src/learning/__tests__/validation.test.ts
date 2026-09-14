import { describe, expect, it } from 'vitest';
import {
  MISSION_FINAL,
  MISSION_M00,
  MISSION_M01,
  MISSION_M02,
  MISSION_M03,
  MISSION_M04,
  MISSION_M05,
  MISSION_M06,
} from '../missions/missions';
import type { Mission, ValidationContext } from '../missions/types';
import { getMission, mergeMissionCode, previousMission, seedMissionCode, unlockedMods } from '../missions';
import { copilotStep } from '../copilot';
import { filterConfigToUnlocked, resolveLiveConfig, validateMission } from '../validation';
import { parseCSharp } from '../../interpreter/csharp';
import { chipById } from '../../interpreter/csharp';
import { summarize } from '../../interpreter/core/summarize';
import { MOD_BY_ID, MODS } from '../../interpreter/core/mods';
import { MISSIONS } from '../missions';
import type { RuntimeMetrics } from '../../games/vector-zero/engine/types';

/* Mission validation is tested without any UI: the same contexts the Lab
   produces are handed straight to validateMission. */

const emptyMetrics = (patch: Partial<RuntimeMetrics> = {}): RuntimeMetrics => ({
  maxScore: 0,
  minHealth: 100,
  kills: 0,
  hitsTaken: 0,
  deaths: 0,
  wavesReached: 1,
  playTimeMs: 0,
  ruleTraces: [],
  ruleActivations: 0,
  ...patch,
});

function contextFor(mission: Mission, code: string, metricsPatch: Partial<RuntimeMetrics> = {}) {
  const program = parseCSharp(code);
  const summary = summarize(program);
  const unlocked = unlockedMods([], mission.id, false);
  const filtered = filterConfigToUnlocked(program.config, unlocked);
  const config = resolveLiveConfig(mission.scenario, program.config, unlocked);
  const ctx: ValidationContext = {
    code,
    program,
    summary,
    config,
    metrics: emptyMetrics(metricsPatch),
    unlocked,
    ignored: filtered.ignored,
  };
  return ctx;
}

const check = (mission: Mission, code: string, metrics: Partial<RuntimeMetrics> = {}) =>
  validateMission(mission, contextFor(mission, code, metrics));

describe('mission 00 — FIRST CONTACT', () => {
  it('is not passed by the starter code', () => {
    expect(check(MISSION_M00, 'string enemy = "small-rock";').passed).toBe(false);
  });

  it('passes as soon as the rock type changes', () => {
    expect(check(MISSION_M00, 'string enemy = "big-rock";').passed).toBe(true);
  });

  it('does not crash on broken code', () => {
    expect(check(MISSION_M00, 'string enemy = "big-').passed).toBe(false);
  });
});

describe('mission 01 — NAME YOUR MACHINE', () => {
  it('needs both a custom name and a transmission', () => {
    expect(check(MISSION_M01, 'string shipName = "Nova";').passed).toBe(false);
    expect(check(MISSION_M01, 'string shipName = "Eclipse";').passed).toBe(false);
    const full = [
      'string shipName = "Eclipse";',
      'Console.WriteLine("Pilot: " + shipName);',
    ].join('\n');
    expect(check(MISSION_M01, full).passed).toBe(true);
  });

  it('accepts any name the student chooses', () => {
    const code = ['string shipName = "ThunderCat";', 'Console.WriteLine(shipName);'].join('\n');
    expect(check(MISSION_M01, code).passed).toBe(true);
  });
});

describe('mission 02 — MAKE SOME TROUBLE', () => {
  it('requires an int declaration and at least 5 rocks', () => {
    expect(check(MISSION_M02, 'int enemies = 3;').passed).toBe(false);
    expect(check(MISSION_M02, 'int enemies = 8;').passed).toBe(true);
    expect(check(MISSION_M02, 'int enemies = 20;').passed).toBe(true);
  });

  it('clamps a crazy number instead of failing the student', () => {
    const result = check(MISSION_M02, 'int enemies = 999999;');
    expect(result.passed).toBe(true);
    expect(contextFor(MISSION_M02, 'int enemies = 999999;').config.enemyCount).toBe(20);
  });
});

describe('mission 03 — POWER CONTROL', () => {
  it('needs power 3 or more, built with an operator', () => {
    expect(check(MISSION_M03, 'int laserPower = 1;').passed).toBe(false);
    const code = ['int laserPower = 1;', 'laserPower = laserPower + 2;'].join('\n');
    expect(check(MISSION_M03, code).passed).toBe(true);
  });

  it('accepts a different arithmetic solution', () => {
    const code = ['int laserPower = 2;', 'laserPower = laserPower * 3;'].join('\n');
    expect(check(MISSION_M03, code).passed).toBe(true);
  });

  it('rejects a flat value with no operator', () => {
    const code = ['int laserPower = 1;', 'laserPower = 9;'].join('\n');
    expect(check(MISSION_M03, code).passed).toBe(false);
  });
});

describe('mission 04 — SWITCHES', () => {
  it('needs both booleans on', () => {
    const half = ['bool shield = true;', 'bool rapidFire = false;'].join('\n');
    expect(check(MISSION_M04, half).passed).toBe(false);
    const both = ['bool shield = true;', 'bool rapidFire = true;'].join('\n');
    expect(check(MISSION_M04, both).passed).toBe(true);
  });
});

describe('mission 05 — THE GAME CAN THINK', () => {
  const code = [
    'bool shield = false;',
    'if (score >= 300)',
    '{',
    '    shield = true;',
    '}',
  ].join('\n');

  it('fails until the rule actually fires and the score is reached', () => {
    expect(check(MISSION_M05, code).passed).toBe(false);
  });

  it('passes once the student lives through it', () => {
    expect(check(MISSION_M05, code, { maxScore: 340, ruleActivations: 1 }).passed).toBe(true);
  });

  it('accepts a different threshold as long as it is reached', () => {
    const custom = [
      'bool shield = false;',
      'if (score > 150)',
      '{',
      '    shield = true;',
      '}',
    ].join('\n');
    expect(check(MISSION_M05, custom, { maxScore: 200, ruleActivations: 2 }).passed).toBe(true);
  });
});

describe('mission 06 — DANGER MODE', () => {
  const code = [
    'int laserPower = 1;',
    'if (health <= 30)',
    '{',
    '    laserPower = 5;',
    '}',
  ].join('\n');

  it('needs a health rule that fires', () => {
    expect(check(MISSION_M06, code).passed).toBe(false);
    const result = check(MISSION_M06, code, {
      minHealth: 18,
      ruleTraces: ['health <= 30 → laserPower = 5'],
    });
    expect(result.passed).toBe(true);
  });
});

describe('final mod — BUILD THE LEVEL', () => {
  const completeCode = [
    'string shipName = "Comet";',
    'string enemy = "medium-rock";',
    'int enemies = 7;',
    'int enemySpeed = 2;',
    'int laserPower = 4;',
    'bool shield = true;',
    'Console.WriteLine("READY: " + shipName);',
    'if (score >= 250)',
    '{',
    '    enemySpeed = 5;',
    '}',
  ].join('\n');

  it('accepts a complete student-built level', () => {
    const result = check(MISSION_FINAL, completeCode, { kills: 3 });
    expect(result.total).toBe(8);
    expect(result.passed).toBe(true);
  });

  it('reports exactly which requirement is missing', () => {
    const code = ['string shipName = "Comet";', 'int enemies = 7;'].join('\n');
    const result = check(MISSION_FINAL, code);
    expect(result.passed).toBe(false);
    const missing = result.results.filter((entry) => !entry.done).map((entry) => entry.id);
    expect(missing).toContain('bool');
    expect(missing).toContain('rule');
    expect(missing).toContain('comms');
    expect(missing).not.toContain('enemies');
  });

  it('accepts a different solution shape', () => {
    const code = [
      'string shipName = "Rook";',
      'string weapon = "spread";',
      'int enemies = 12;',
      'int enemySpeed = 3;',
      'bool homing = true;',
      'bool rapidFire = false;',
      'Console.WriteLine(shipName);',
      'if (wave >= 3)',
      '{',
      '    rapidFire = true;',
      '}',
    ].join('\n');
    const ctx = contextFor(MISSION_FINAL, code, { kills: 1 });
    const unlocked = unlockedMods(
      ['m00', 'm01', 'm02', 'm03', 'm04', 'm05', 'm06'],
      MISSION_FINAL.id,
      false,
    );
    const program = parseCSharp(code);
    const config = resolveLiveConfig(MISSION_FINAL.scenario, program.config, unlocked);
    const result = validateMission(MISSION_FINAL, { ...ctx, config, unlocked });
    expect(result.passed).toBe(true);
  });
});

describe('unlocks and discovery', () => {
  it('only exposes Mods the mission progression has reached', () => {
    expect(unlockedMods([], 'm00', false)).toEqual(['enemyType']);
    expect(unlockedMods(['m00'], 'm01', false)).toEqual(['enemyType', 'shipName']);
    expect(unlockedMods([], 'm04', false)).toEqual([
      'enemyType',
      'shipName',
      'enemyCount',
      'laserPower',
      'enemySpeed',
      'shieldEnabled',
      'rapidFireEnabled',
    ]);
  });

  it('unlocks every Mod once free mode is open', () => {
    expect(unlockedMods([], 'free', true).length).toBeGreaterThanOrEqual(12);
  });

  it('holds back an undiscovered Mod and explains it instead of breaking', () => {
    const program = parseCSharp('int lives = 9;');
    const filtered = filterConfigToUnlocked(program.config, unlockedMods([], 'm00', false));
    expect(filtered.config).toEqual({});
    expect(filtered.ignored[0]).toMatchObject({ mod: 'lives', name: 'lives' });
  });

  it('keeps a discovered Mod live', () => {
    const program = parseCSharp('string enemy = "big-rock";');
    const filtered = filterConfigToUnlocked(program.config, unlockedMods([], 'm00', false));
    expect(filtered.config.enemyType).toBe('big-rock');
    expect(filtered.ignored).toHaveLength(0);
  });
});

describe('code merging keeps the student program growing', () => {
  it('uses the mission starter when the editor is empty', () => {
    expect(mergeMissionCode('', getMission('m00')).trim()).toBe('string enemy = "small-rock";');
  });

  it('adds only the lines that are missing', () => {
    const merged = mergeMissionCode('string enemy = "big-rock";', getMission('m01'));
    expect(merged).toContain('string enemy = "big-rock";');
    expect(merged).toContain('string shipName = "Nova";');
    expect(merged).toContain('Console.WriteLine("Pilot: " + shipName);');
  });

  it('never overwrites a value the student already set', () => {
    const student = ['string enemy = "big-rock";', 'string shipName = "Eclipse";'].join('\n');
    const merged = mergeMissionCode(student, getMission('m01'));
    expect(merged).toContain('shipName = "Eclipse"');
    expect(merged).not.toContain('"Nova"');
  });

  it('is idempotent: running it twice changes nothing', () => {
    const first = mergeMissionCode('string enemy = "big-rock";', getMission('m01'));
    const second = mergeMissionCode(first, getMission('m01'));
    expect(second).toBe(first);
  });

  it('does not duplicate a rule the student already wrote', () => {
    const student = [
      'bool shield = false;',
      'if (score >= 300)',
      '{',
      '    shield = true;',
      '}',
    ].join('\n');
    const merged = mergeMissionCode(student, getMission('m05'));
    expect(merged.match(/if \(score >= 300\)/g)?.length).toBe(1);
  });

  it('produces code that parses cleanly at every step of the campaign', () => {
    let code = '';
    for (const id of ['m00', 'm01', 'm02', 'm03', 'm04', 'm05', 'm06']) {
      code = mergeMissionCode(code, getMission(id));
      const program = parseCSharp(code);
      expect(program.ok, `${id} produced invalid code:\n${code}`).toBe(true);
    }
    expect(code).toContain('if (health <= 30)');
  });
});

describe('player-led mission setup', () => {
  it('keeps the previous program without inserting the next answer', () => {
    const previous = 'string enemy = "big-rock";';
    const seeded = seedMissionCode(previous, MISSION_M01);
    expect(seeded).toBe(previous);
    expect(seeded).not.toContain('shipName');
    expect(seeded).not.toContain('Console.WriteLine');
  });

  it('only supplies templates for the opening mission and sandbox', () => {
    expect(seedMissionCode('', MISSION_M00)).toBe(MISSION_M00.starter);
    expect(seedMissionCode('', MISSION_M02)).toBe('');
    expect(seedMissionCode('student work', getMission('free'))).toBe(getMission('free').starter);
  });

  it('finds the mission immediately before the current one', () => {
    expect(previousMission('m00')).toBeNull();
    expect(previousMission('m02')?.id).toBe('m01');
  });
});

describe('co-pilot staged directions', () => {
  const guidanceFor = (mission: Mission, code: string) => {
    const context = contextFor(mission, code);
    return copilotStep(mission, context, validateMission(mission, context));
  };

  it('points at shipName before asking the player to rename it', () => {
    expect(guidanceFor(MISSION_M01, 'string enemy = "big-rock";')).toMatchObject({
      targetId: 'shipName',
      message: 'Add the "shipName" Mod to the code.',
    });
    expect(guidanceFor(MISSION_M01, 'string shipName = "Nova";').message).toContain('Change shipName');
  });

  it('points at WriteLine after the custom name is ready', () => {
    expect(guidanceFor(MISSION_M01, 'string shipName = "Comet";')).toMatchObject({
      targetId: 'writeline',
    });
  });

  it('points at enemyCount before asking for five enemies', () => {
    expect(guidanceFor(MISSION_M02, '').targetId).toBe('enemyCount');
    expect(guidanceFor(MISSION_M02, 'int enemies = 3;').message).toContain('5 or more');
  });
});

describe('mission content integrity', () => {
  it('every quick-insert chip a mission lists actually exists', () => {
    for (const mission of MISSIONS) {
      for (const id of mission.quickInsert) {
        expect(chipById(id), `${mission.id} lists unknown chip "${id}"`).toBeDefined();
      }
    }
  });

  it('every addition is recognised as present after merging (no duplicate inserts)', () => {
    for (const mission of MISSIONS) {
      const merged = mergeMissionCode('', mission);
      const present = new Set(summarize(parseCSharp(merged)).keys);
      for (const addition of mission.additions) {
        expect(
          present.has(addition.key),
          `${mission.id} addition key not detected: ${addition.key}`,
        ).toBe(true);
      }
    }
  });

  it('unlocks and requires only known Mods', () => {
    for (const mission of MISSIONS) {
      for (const mod of mission.unlocks) {
        expect(MOD_BY_ID[mod], `${mission.id} unlocks unknown Mod ${mod}`).toBeDefined();
      }
    }
  });

  it('every learning mission has a concept, an action and at least one check', () => {
    for (const mission of MISSIONS) {
      if (mission.kind === 'sandbox') continue;
      expect(mission.concept, `${mission.id} has no microlearning concept`).toBeDefined();
      expect(mission.action.length).toBeGreaterThan(8);
      expect(mission.requirements.length).toBeGreaterThan(0);
      expect(mission.playPrompt.length).toBeGreaterThan(2);
    }
  });

  it('every Mod definition is reachable through the campaign or free mode', () => {
    const reachable = new Set(MISSIONS.flatMap((mission) => mission.unlocks));
    const orphans = MODS.filter((mod) => !reachable.has(mod.id)).map((mod) => mod.id);
    expect(orphans).toEqual([]);
  });
});
