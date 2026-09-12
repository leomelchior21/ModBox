import { describe, expect, it } from 'vitest';
import { codeBlocks, moveCodeBlock, placeMod } from './modEditing';
import { csharpAdapter } from '../interpreter/csharp';

describe('library code placement', () => {
  it('inserts a new switch after declarations and before output or rules', () => {
    const source = 'string shipName = "Nova";\nint enemies = 3;\nConsole.WriteLine(shipName);\nif (score > 30) { enemies = 4; }';
    const next = placeMod(source, 'bool shield = false;');
    expect(next.indexOf('bool shield')).toBeGreaterThan(next.indexOf('int enemies'));
    expect(next.indexOf('bool shield')).toBeLessThan(next.indexOf('Console.WriteLine'));
    expect(csharpAdapter.parse(next).ok).toBe(true);
  });
  it('replaces a mod without touching assignments inside rules or user comments', () => {
    const source = '// shield setup\nbool shield = false;\nif (score > 10) { shield = true; }';
    expect(placeMod(source, 'bool shield = true;')).toBe('// shield setup\nbool shield = true;\nif (score > 10) { shield = true; }');
  });
  it('collapses repeated declarations when replacing a mod', () => {
    const next = placeMod('string enemy = "big-rock";\nstring enemy = "big-rock";', 'string enemy = "small-rock";');
    expect(next.match(/string enemy/g)).toHaveLength(1);
    expect(csharpAdapter.parse(next).config.enemyType).toBe('small-rock');
  });
  it('appends output to output and keeps complete rules at the end', () => {
    const source = 'int enemies = 3;\nConsole.WriteLine("first");\nif (score > 10) { Console.WriteLine("rule"); }';
    const next = placeMod(source, 'Console.WriteLine("next");');
    expect(next.indexOf('"next"')).toBeGreaterThan(next.indexOf('"first"'));
    expect(next.indexOf('"next"')).toBeLessThan(next.indexOf('if ('));
  });
  it('handles multiline expressions, comment braces and semicolons in strings', () => {
    const source = '// { comment\nstring shipName = "a; }";\nint enemies =\n  3 + 1;\nif (score > 10) { enemies = 5; }';
    expect(codeBlocks(source)).toHaveLength(3);
    const next = placeMod(source, 'bool shield = true;');
    expect(csharpAdapter.parse(next).ok).toBe(true);
    expect(next).toContain('int enemies =\n  3 + 1;\nbool shield = true;');
  });
  it('moves entire output blocks without splitting strings or crossing sections', () => {
    const source = 'string shipName = "Nova";\nConsole.WriteLine("first");\nConsole.WriteLine(shipName);';
    expect(moveCodeBlock(source, 1, -1)).toBe(source);
    expect(moveCodeBlock(source, 1, 1)).toBe('string shipName = "Nova";\nConsole.WriteLine(shipName);\nConsole.WriteLine("first");');
  });
  it('preserves incomplete student code when inserting a new declaration', () => {
    const source = 'if (score >';
    expect(placeMod(source, 'bool shield = false;')).toBe('bool shield = false;\n' + source);
    expect(moveCodeBlock(source, 0, 1)).toBe(source);
  });
});

describe('repeated enemy mods', () => {
  it('allows the same enemy twice and preserves the configured count', () => {
    const result = csharpAdapter.parse('string enemy = "big-rock";\nstring enemy = "big-rock";\nint enemies = 6;');
    expect(result.ok).toBe(true);
    expect(result.config).toMatchObject({ enemyType: 'big-rock', enemyCount: 6 });
    expect(result.symbols.filter(s => s.name === 'enemy')).toHaveLength(1);
  });
  it('uses the latest enemy value for later output', () => {
    const result = csharpAdapter.parse('string enemy = "big-rock";\nstring enemy = "small-rock";\nConsole.WriteLine(enemy);');
    expect(result.ok).toBe(true);
    expect(result.config.enemyType).toBe('small-rock');
    expect(result.comms[0].text).toBe('small-rock');
  });
  it('still rejects invalid types and accidental ordinary variable redeclarations', () => {
    expect(csharpAdapter.parse('string enemy = "big-rock";\nint enemy = 2;').ok).toBe(false);
    expect(csharpAdapter.parse('int count = 1;\nint count = 2;').ok).toBe(false);
  });
});
