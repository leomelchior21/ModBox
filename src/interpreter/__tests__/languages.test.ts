import { describe, expect, it } from 'vitest';
import { parsePython } from '../python';
import { parseSwift } from '../swift';
import { formatCodeForLanguage, localizeMission } from '../languageSyntax';
import { getMission } from '../../learning/missions';
import { coachPopupMessage } from '../../learning/copilot';

describe('Python adapter', () => {
  it('parses idiomatic assignments, booleans, print, and indented rules', () => {
    const result = parsePython([
      'enemy = "big-rock"',
      'enemies = 7',
      'shield = False',
      'print("Pilot ready")',
      'if score >= 300:',
      '    shield = True',
    ].join('\n'));

    expect(result.ok).toBe(true);
    expect(result.config).toMatchObject({ enemyType: 'big-rock', enemyCount: 7, shieldEnabled: false });
    expect(result.comms).toHaveLength(1);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].actions[0].target).toBe('shieldEnabled');
  });

  it('requires Python colon syntax for rules', () => {
    const result = parsePython('if score >= 300\n    shield = True');
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].hint).toContain('if score >= 300:');
  });

  it('accepts Python single-quoted strings and rejects an unindented rule body', () => {
    expect(parsePython("enemy = 'big-rock'").config.enemyType).toBe('big-rock');
    const result = parsePython('if score >= 300:\nshield = True');
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toContain('must be indented');
  });
});

describe('Swift adapter', () => {
  it('parses typed and inferred variables, print, and brace rules', () => {
    const result = parseSwift([
      'var enemy: String = "big-rock"',
      'var enemies = 7',
      'var shield = false',
      'print("Pilot ready")',
      'if score >= 300 {',
      '    shield = true',
      '}',
    ].join('\n'));

    expect(result.ok).toBe(true);
    expect(result.config).toMatchObject({ enemyType: 'big-rock', enemyCount: 7, shieldEnabled: false });
    expect(result.comms).toHaveLength(1);
    expect(result.rules).toHaveLength(1);
  });

  it('reports values whose type cannot be inferred', () => {
    const result = parseSwift('var laserPower = score');
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toContain('infer the type');
  });
});

describe('language-specific teaching code', () => {
  it('uses language-correct text in every language popup', () => {
    const printStep = { message: 'Add a transmission.', targetId: 'writeline' as const };
    expect(coachPopupMessage(printStep, 'csharp')).toBe('Drag WRITELINE into the code.');
    expect(coachPopupMessage(printStep, 'python')).toBe('Drag PRINT into the code.');
    expect(coachPopupMessage(printStep, 'swift')).toBe('Drag PRINT into the code.');

    const boolStep = { message: 'Switch shield on.', targetId: 'shieldEnabled' as const };
    expect(coachPopupMessage(boolStep, 'python')).toBe('Change shield from False to True.');
    expect(coachPopupMessage(boolStep, 'swift')).toBe('Change shield from false to true.');
    expect(coachPopupMessage(boolStep, 'csharp')).toBe('Change shield from false to true.');
  });

  it('formats mission code with each language grammar', () => {
    const csharp = getMission('m05').concept?.example ?? '';
    const python = formatCodeForLanguage(csharp, 'python');
    const swift = formatCodeForLanguage(csharp, 'swift');
    expect(python).toBe('if score >= 300:\n    shield = True');
    expect(swift).toBe('if score >= 300 {\n    shield = true\n}');
    expect(parsePython(`shield = False\n${python}`).ok).toBe(true);
    expect(parseSwift(`var shield = false\n${swift}`).ok).toBe(true);
  });

  it('localizes every campaign starter and addition into parseable code', () => {
    for (const language of ['python', 'swift'] as const) {
      let campaign = '';
      const present = new Set<string>();
      for (const id of ['m00', 'm01', 'm02', 'm03', 'm04', 'm05', 'm06', 'final']) {
        const mission = localizeMission(getMission(id), language);
        for (const addition of mission.additions) {
          if (present.has(addition.key)) continue;
          present.add(addition.key);
          campaign += `${campaign ? '\n\n' : ''}${addition.code}`;
        }
        const parsed = language === 'python' ? parsePython(campaign) : parseSwift(campaign);
        expect(parsed.ok, `${language} ${id}: ${campaign}\n${parsed.diagnostics.map((item) => item.message).join('\n')}`).toBe(true);
      }
      const sandbox = localizeMission(getMission('free'), language).starter;
      const sandboxResult = language === 'python' ? parsePython(sandbox) : parseSwift(sandbox);
      expect(sandboxResult.ok, `${language} sandbox: ${sandboxResult.diagnostics.map((item) => item.message).join('\n')}`).toBe(true);
    }
  });
});
