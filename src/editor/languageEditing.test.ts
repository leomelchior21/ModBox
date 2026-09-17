import { describe, expect, it } from 'vitest';
import { normalizeVariableSpacing, placeLanguageSnippet } from './languageEditing';

describe('Python and Swift code placement', () => {
  it('packs Python variables together but separates updates, print, and rules', () => {
    const source = [
      'enemy = "big-rock"', '',
      'shipName = "Brian\'s ship"', '',
      'print(shipName)', '',
      'if score >= 300:',
      '    shield = True',
    ].join('\n');
    const withVariable = placeLanguageSnippet(source, 'enemies = 5', 'python');
    expect(withVariable).toContain('enemy = "big-rock"\nshipName = "Brian\'s ship"\nenemies = 5\n\nprint(shipName)');
    const withUpdate = placeLanguageSnippet(withVariable, 'laserPower = laserPower + 2', 'python');
    expect(withUpdate).toContain('enemies = 5\n\nlaserPower = laserPower + 2\n\nprint(shipName)');
    const withPrint = placeLanguageSnippet(withUpdate, 'print("READY")', 'python');
    expect(withPrint).toContain('print(shipName)\n\nprint("READY")\n\nif score');
  });

  it('packs Swift declarations while preserving section gaps', () => {
    const source = 'var enemy: String = "big-rock"\n\nprint(enemy)';
    expect(placeLanguageSnippet(source, 'var enemies: Int = 5', 'swift'))
      .toBe('var enemy: String = "big-rock"\nvar enemies: Int = 5\n\nprint(enemy)');
  });

  it('normalizes saved C# variable gaps without touching later sections', () => {
    const source = 'string enemy = "big-rock";\n\nint enemies = 5;\n\nConsole.WriteLine(enemy);\n\nif (score > 5)\n{\n    enemies = 6;\n}';
    expect(normalizeVariableSpacing(source, 'csharp'))
      .toContain('string enemy = "big-rock";\nint enemies = 5;\n\nConsole.WriteLine(enemy);\n\nif');
  });
});
