import { describe, expect, it } from 'vitest';
import { parseCSharp } from '../csharp';
import { summarize } from '../core/summarize';
import { DEFAULT_CONFIG } from '../core/limits';
import { evaluateRules } from '../core/rules';
import type { RuntimeValues } from '../core/types';

const runtime = (overrides: Partial<RuntimeValues> = {}): RuntimeValues => ({
  score: 0,
  health: 100,
  wave: 1,
  enemiesRemaining: 0,
  ...overrides,
});

const baseConfig = (config: Partial<typeof DEFAULT_CONFIG>) => ({ ...DEFAULT_CONFIG, ...config });

describe('C# subset — declarations', () => {
  it('parses a string declaration into config', () => {
    const result = parseCSharp('string enemy = "big-rock";');
    expect(result.ok).toBe(true);
    expect(result.config.enemyType).toBe('big-rock');
    expect(result.symbols[0]).toMatchObject({ name: 'enemy', type: 'string', mod: 'enemyType' });
  });

  it('parses int declarations', () => {
    const result = parseCSharp('int enemies = 6;\nint enemySpeed = 4;');
    expect(result.config.enemyCount).toBe(6);
    expect(result.config.enemySpeed).toBe(4);
  });

  it('parses bool declarations', () => {
    const result = parseCSharp('bool shield = true;\nbool rapidFire = false;');
    expect(result.config.shieldEnabled).toBe(true);
    expect(result.config.rapidFireEnabled).toBe(false);
  });

  it('treats unknown names as student variables, not game values', () => {
    const result = parseCSharp('int booster = 2;');
    expect(result.ok).toBe(true);
    expect(result.config).toEqual({});
    expect(result.symbols[0].userOnly).toBe(true);
  });

  it('reports a type mismatch when the declared type fights the value', () => {
    const result = parseCSharp('int enemies = "lots";');
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toMatch(/whole number/);
    expect(result.diagnostics[0].technical).toMatch(/CS0029/);
  });
});

describe('C# subset — clamping', () => {
  it('caps a huge count instead of crashing, with personality', () => {
    const result = parseCSharp('int enemies = 9999999;');
    expect(result.config.enemyCount).toBe(20);
    expect(result.notices[0].message).toMatch(/capped this at 20/);
  });

  it('raises values below the minimum', () => {
    const result = parseCSharp('int lives = 0;');
    expect(result.config.lives).toBe(1);
    expect(result.notices[0].message).toMatch(/cannot go below 1/);
  });

  it('falls back to small-rock for an unknown rock', () => {
    const result = parseCSharp('string enemy = "dragon";');
    expect(result.config.enemyType).toBe('small-rock');
    expect(result.notices[0].message).toMatch(/small-rock/);
  });

  it('shortens an over-long ship name', () => {
    const result = parseCSharp('string shipName = "SuperNovaDestroyerMk2";');
    expect((result.config.shipName as string).length).toBeLessThanOrEqual(18);
  });
});

describe('C# subset — arithmetic and assignment', () => {
  it('lets dragged built-in Mods repeat and uses the last value', () => {
    const result = parseCSharp('bool shield = false;\nbool shield = true;');
    expect(result.ok).toBe(true);
    expect(result.config.shieldEnabled).toBe(true);
  });

  it('computes arithmetic and reassigns', () => {
    const result = parseCSharp('int laserPower = 1;\nlaserPower = laserPower + 3;');
    expect(result.config.laserPower).toBe(4);
  });

  it('handles multiply and divide', () => {
    const result = parseCSharp('int scoreMultiplier = 1;\nscoreMultiplier = scoreMultiplier * 2;');
    expect(result.config.scoreMultiplier).toBe(2);
    const divide = parseCSharp('int enemySpeed = 8;\nenemySpeed = enemySpeed / 2;');
    expect(divide.config.enemySpeed).toBe(4);
  });

  it('suggests the right name for a typo', () => {
    const result = parseCSharp('int enemies = 3;\nenemees = 5;');
    const diagnostic = result.diagnostics.find((entry) => entry.code === 'MOD1007');
    expect(diagnostic?.hint).toMatch(/Did you mean enemies/);
  });

  it('explains shorthand is not installed yet', () => {
    const result = parseCSharp('int lives = 3;\nlives += 1;');
    expect(result.diagnostics[0].message).toMatch(/not installed/);
    expect(result.diagnostics[0].hint).toMatch(/lives = lives \+ 1;/);
  });
});

describe('C# subset — Console.WriteLine', () => {
  it('turns a literal into a COMMS line', () => {
    const result = parseCSharp('Console.WriteLine("READY");');
    expect(result.comms[0].text).toBe('READY');
  });

  it('reads a variable value', () => {
    const result = parseCSharp('string shipName = "Eclipse";\nConsole.WriteLine(shipName);');
    expect(result.comms[0].text).toBe('Eclipse');
  });

  it('concatenates text and numbers', () => {
    const result = parseCSharp(
      'string shipName = "Nova";\nConsole.WriteLine("Pilot: " + shipName);',
    );
    expect(result.comms[0].text).toBe('Pilot: Nova');
  });

  it('explains ReadLine is not a thing here', () => {
    const result = parseCSharp('Console.ReadLine();');
    expect(result.diagnostics[0].message).toMatch(/no keyboard/);
  });
});

describe('C# subset — rules', () => {
  it('compiles an if into a live rule', () => {
    const result = parseCSharp(
      ['bool shield = false;', 'if (score >= 300)', '{', '    shield = true;', '}'].join('\n'),
    );
    expect(result.ok).toBe(true);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].conditionText).toBe('score >= 300');
    expect(result.config.shieldEnabled).toBe(false);
  });

  it('fires a rule when the runtime value crosses the threshold', () => {
    const result = parseCSharp(
      ['int enemySpeed = 2;', 'if (score >= 300)', '{', '    enemySpeed = 5;', '}'].join('\n'),
    );
    const config = baseConfig(result.config);
    expect(evaluateRules(result.rules, config, runtime({ score: 120 })).activeRuleIds).toHaveLength(0);
    const after = evaluateRules(result.rules, config, runtime({ score: 320 }));
    expect(after.activeRuleIds).toHaveLength(1);
    expect(after.overrides.enemySpeed).toBe(5);
  });

  it('supports <= conditions on health', () => {
    const result = parseCSharp(
      ['int laserPower = 1;', 'if (health <= 30)', '{', '    laserPower = 5;', '}'].join('\n'),
    );
    const config = baseConfig(result.config);
    expect(evaluateRules(result.rules, config, runtime({ health: 22 })).overrides.laserPower).toBe(5);
    expect(
      evaluateRules(result.rules, config, runtime({ health: 80 })).overrides.laserPower,
    ).toBeUndefined();
  });

  it('supports == comparisons inside rules', () => {
    const result = parseCSharp(
      ['bool shield = false;', 'if (wave == 3)', '{', '    shield = true;', '}'].join('\n'),
    );
    const frame = evaluateRules(result.rules, baseConfig(result.config), runtime({ wave: 3 }));
    expect(frame.overrides.shieldEnabled).toBe(true);
  });

  it('keeps Console.WriteLine inside a rule as a live transmission', () => {
    const result = parseCSharp(
      [
        'bool shield = false;',
        'if (score >= 100)',
        '{',
        '    shield = true;',
        '    Console.WriteLine("SHIELD ONLINE");',
        '}',
      ].join('\n'),
    );
    expect(result.comms).toHaveLength(0);
    expect(result.rules[0].writes[0].text).toBe('"SHIELD ONLINE"');
    const frame = evaluateRules(result.rules, baseConfig(result.config), runtime({ score: 150 }));
    expect(frame.traces[0].writes).toHaveLength(1);
  });

  it('joins two checks with &&', () => {
    const result = parseCSharp(
      [
        'bool homing = false;',
        'if (score >= 300 && health > 20)',
        '{',
        '    homing = true;',
        '}',
      ].join('\n'),
    );
    const config = baseConfig(result.config);
    expect(result.rules[0].conditionText).toBe('score >= 300 && health > 20');
    expect(
      evaluateRules(result.rules, config, runtime({ score: 400, health: 90 })).overrides.homingEnabled,
    ).toBe(true);
    expect(
      evaluateRules(result.rules, config, runtime({ score: 400, health: 10 })).overrides.homingEnabled,
    ).toBeUndefined();
  });

  it('rejects a condition that is not a question', () => {
    const result = parseCSharp('int enemies = 3;\nif (enemies)\n{\n    enemies = 4;\n}');
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toMatch(/true or false/);
  });

  it('explains that runtime values only exist during play', () => {
    const result = parseCSharp('int enemies = score;');
    expect(result.diagnostics[0].message).toMatch(/only exists while the game is running/);
  });
});

describe('C# subset — unsupported and broken input', () => {
  it('never throws on a wall of nonsense', () => {
    expect(() => parseCSharp('}}} >>> while (true) { class Foo }')).not.toThrow();
  });

  it('explains while loops without compiler text', () => {
    const result = parseCSharp('while (true) { }');
    expect(result.diagnostics[0].message).toMatch(/[Ll]oops/);
    expect(result.diagnostics[0].title).toMatch(/LINE 1/);
  });

  it('explains an unclosed quote', () => {
    const result = parseCSharp('string enemy = "big-rock;');
    expect(result.diagnostics[0].message).toMatch(/didn't close it/);
  });

  it('explains a missing semicolon', () => {
    const result = parseCSharp('int enemies = 3');
    expect(result.diagnostics[0].message).toMatch(/ends with ;/);
    expect(result.diagnostics[0].technical).toMatch(/CS1002/);
  });

  it('keeps the headline short and technical details separate', () => {
    const result = parseCSharp('int enemySpeed = ?');
    const diagnostic = result.diagnostics[0];
    expect(diagnostic.title.length).toBeLessThan(40);
    expect(diagnostic.technical).toMatch(/CS/);
  });

  it('recovers and still binds later lines', () => {
    const result = parseCSharp('bad line here;\nint enemies = 7;');
    expect(result.config.enemyCount).toBe(7);
  });

  it('refuses a variable created inside an if', () => {
    const result = parseCSharp('bool shield = false;\nif (score > 10)\n{\n    int bonus = 2;\n}');
    expect(result.diagnostics[0].message).toMatch(/top of the file/);
  });
});

describe('C# subset — empty and comment-only files', () => {
  it('accepts an empty program', () => {
    const result = parseCSharp('');
    expect(result.ok).toBe(true);
    expect(result.symbols).toHaveLength(0);
  });

  it('ignores comments', () => {
    const result = parseCSharp('// nothing to see\n/* or here */\nint lives = 4;');
    expect(result.config.lives).toBe(4);
  });
});

describe('program summary (language-agnostic mission validation input)', () => {
  it('reports declarations, writes, rules and comparison operators', () => {
    const source = [
      'string shipName = "Eclipse";',
      'int enemies = 6;',
      'bool shield = false;',
      'int enemySpeed = 2;',
      'Console.WriteLine("Pilot: " + shipName);',
      'if (score >= 300)',
      '{',
      '    enemySpeed = 4;',
      '}',
    ].join('\n');
    const summary = summarize(parseCSharp(source));
    expect(summary.declares.string).toContain('shipName');
    expect(summary.declares.int).toContain('enemies');
    expect(summary.declares.bool).toContain('shield');
    expect(summary.writesCount).toBe(1);
    expect(summary.rulesCount).toBe(1);
    expect(summary.hasCondition).toBe(true);
    expect(summary.comparisons).toContain('>=');
    expect(summary.runtimeRefs).toContain('score');
  });
});
