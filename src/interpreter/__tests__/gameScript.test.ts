import { describe, expect, it } from 'vitest';
import { gardenSchema, type GardenConfig } from '../../games/__tests__/fixtures/gardenGame';
import { createModSchema } from '../core/schema';
import { parseGameScript, evaluateGameScript } from '../gameScript';
import { formatCodeForLanguage } from '../languageSyntax';
import type { LanguageId } from '../core/adapter';

const base: GardenConfig = { tileCount: 3, palette: 'spring', rainEnabled: false };

describe('game-specific script bindings', () => {
  it.each<LanguageId>(['csharp', 'python', 'swift'])('binds custom mods and evaluates custom runtime rules in %s', language => {
    const code = formatCodeForLanguage('int tiles = 5;\nstring palette = "sunset";\nbool rain = false;\nif (harvests >= 3) {\n  tiles = tiles + 100;\n  rain = true;\n}', language);
    const program = parseGameScript<GardenConfig>(code, language, gardenSchema);
    expect(program.diagnostics).toEqual([]);
    expect(program.config).toEqual({ tileCount: 5, palette: 'sunset', rainEnabled: false });
    const initial = { ...base, ...program.config };
    expect(evaluateGameScript(program, initial, { harvests: 2 }, gardenSchema).config).toEqual(initial);
    const live = evaluateGameScript(program, initial, { harvests: 3 }, gardenSchema);
    expect(live.config).toEqual({ tileCount: 12, palette: 'sunset', rainEnabled: true });
    expect(live.frame.activeRuleIds).toHaveLength(1);
  });

  it('uses catalog limits and does not bind another game’s controls', () => {
    const program = parseGameScript<GardenConfig>('int tiles = 999;\nint enemies = 7;', 'csharp', gardenSchema);
    expect(program.config).toEqual({ tileCount: 12 });
    expect(program.symbols.find(symbol => symbol.name === 'enemies')?.userOnly).toBe(true);
    expect(program.notices[0]?.message).toContain('tiles');
  });

  it.each<LanguageId>(['csharp', 'python', 'swift'])('uses text and boolean runtime values in %s', language => {
    const schema = createModSchema(gardenSchema.mods, ['season', 'isRaining']);
    const code = formatCodeForLanguage('string palette = "spring";\nbool rain = false;\nif (season == "sunset" && isRaining) {\n  palette = season;\n  rain = isRaining;\n}', language);
    const program = parseGameScript<GardenConfig>(code, language, schema);
    expect(program.diagnostics).toEqual([]);
    expect(evaluateGameScript(program, base, { season: 'sunset', isRaining: true }, schema).config).toEqual({ ...base, palette: 'sunset', rainEnabled: true });
    expect(evaluateGameScript(program, base, { season: 'spring', isRaining: true }, schema).config).toEqual(base);
  });

  it('rejects wrong types and unsupported choices without applying bad rules', () => {
    const program = parseGameScript<GardenConfig>('string tiles = "six";\nstring palette = "purple";\nbool rain = false;\nif (harvests >= 3) { rain = true; }', 'csharp', gardenSchema);
    expect(program.ok).toBe(false);
    expect(evaluateGameScript(program, base, { harvests: 10 }, gardenSchema).config).toEqual(base);
  });

  it('rejects duplicate controls and names reserved by the game runtime', () => {
    expect(() => createModSchema([...gardenSchema.mods, gardenSchema.mods[0]])).toThrow('duplicate');
    expect(() => createModSchema(gardenSchema.mods, ['tiles'])).toThrow('duplicate');
  });
});
