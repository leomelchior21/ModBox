import { describe, expect, it } from 'vitest';
import { prepareVectorModInsert } from './modInsertion';
import { CODE_TOOLS } from '../../learning/copilot';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { requireAdapter } from '../../interpreter/adapters';
import { placeMod } from '../../editor/modEditing';
import { placeLanguageSnippet } from '../../editor/languageEditing';
import type { LanguageId } from '../../interpreter/core/adapter';

describe.each<LanguageId>(['csharp', 'python', 'swift'])('%s rule insertion', language => {
  function insert(source: string, toolId: string) {
    const snippet = formatCodeForLanguage(CODE_TOOLS.find(tool => tool.id === toolId)!.example, language);
    const prepared = prepareVectorModInsert(source, snippet, language);
    return language === 'csharp' ? placeMod(prepared, snippet, 'duplicate')
      : placeLanguageSnippet(prepared, snippet, language, 'duplicate');
  }

  it('starts Score Rule with the shield off and preserves unrelated code and live actions', () => {
    const source = formatCodeForLanguage([
      'bool shield = true;', 'int laserPower = 3;', 'shield = true;',
      'Console.WriteLine("Pilot ready");',
      'if (health <= 30)', '{', '    shield = true;', '}',
    ].join('\n'), language);
    const result = requireAdapter(language).parse(insert(source, 'score-rule'));
    expect(result.ok).toBe(true);
    expect(result.config).toMatchObject({ shieldEnabled: false, laserPower: 3 });
    expect(result.rules).toHaveLength(2);
    expect(result.rules.every(rule => rule.actions[0].target === 'shieldEnabled')).toBe(true);
    expect(result.comms[0].text).toBe('Pilot ready');
  });

  it('resets Health Rule to power 1 even after the earlier arithmetic mod', () => {
    const source = formatCodeForLanguage([
      'int laserPower = 4;', 'bool shield = false;', 'laserPower = laserPower + 2;',
      'if (score >= 300)', '{', '    laserPower = 3;', '}',
    ].join('\n'), language);
    const result = requireAdapter(language).parse(insert(source, 'health-rule'));
    expect(result.ok).toBe(true);
    expect(result.config.laserPower).toBe(1);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].actions[0].value).toMatchObject({ kind: 'literal', value: 3 });
    expect(result.rules[1].actions[0].value).toMatchObject({ kind: 'literal', value: 5 });
  });

  it('adds missing defaults and keeps them neutral on repeated insertion', () => {
    let source = formatCodeForLanguage('int enemies = 5;', language);
    source = insert(insert(source, 'score-rule'), 'health-rule');
    source = insert(insert(source, 'score-rule'), 'health-rule');
    const result = requireAdapter(language).parse(source);
    expect(result.ok).toBe(true);
    expect(result.config).toMatchObject({ shieldEnabled: false, laserPower: 1, enemyCount: 5 });
    expect(result.rules).toHaveLength(4);
  });

  it('leaves other mod insertions untouched', () => {
    const source = formatCodeForLanguage('int laserPower = 4;', language);
    expect(prepareVectorModInsert(source, formatCodeForLanguage('int enemies = 5;', language), language)).toBe(source);
  });
});

it('resets duplicate declarations and updates together in C#', () => {
  const source = 'int laserPower = 2;\nint laserPower = 4;\nlaserPower = laserPower + 2;';
  const snippet = CODE_TOOLS.find(tool => tool.id === 'health-rule')!.example;
  const next = prepareVectorModInsert(source, snippet, 'csharp');
  expect(requireAdapter('csharp').parse(next).config.laserPower).toBe(1);
  expect(next.match(/int laserPower/g)).toHaveLength(1);
  expect(next).not.toContain('laserPower + 2');
});

it('resets indented Swift declarations while preserving indented rule actions', () => {
  const source = '    var laserPower: Int = 4\n    laserPower = laserPower + 2\nif score >= 300 {\n    laserPower = 3\n}';
  const snippet = formatCodeForLanguage(CODE_TOOLS.find(tool => tool.id === 'health-rule')!.example, 'swift');
  const next = prepareVectorModInsert(source, snippet, 'swift');
  const result = requireAdapter('swift').parse(next);
  expect(result.ok).toBe(true);
  expect(result.config.laserPower).toBe(1);
  expect(result.rules[0].actions[0].value).toMatchObject({ kind: 'literal', value: 3 });
});
