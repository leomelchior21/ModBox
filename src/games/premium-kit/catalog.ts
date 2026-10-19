import { createModSchema } from '../../interpreter/core/schema';
import type { Expr, ProgramResult } from '../../interpreter/core/types';
import type { CodeToolDefinition, ModDefinition } from '../../mods/types';
import type { ArcadeConfig, ArcadeRun } from './core';

export interface ArcadeMission { id: string; order: number; kind: 'mission' | 'final' | 'sandbox'; title: string; message: string; targetId?: string }
export const ARCADE_RUNTIME_LABELS = { score: 'points this run', level: 'current stage', lives: 'remaining chances', actions: 'launches or placements', collected: 'successful scoring events', perfects: 'perfect placements or skill hits' };
export interface CatalogOptions {
  title: string; palettes: readonly string[]; defaults: ArcadeConfig;
  power: { name: string; label: string; blurb: string; min: number; max: number; goal: number };
  assist: { name: string; label: string; blurb: string; instruction: string };
  bonus: { name: string; label: string; blurb: string; min: number; max: number; goal: number };
  physics: { key: 'speed' | 'gravity'; name: string; label: string; blurb: string; min: number; max: number; goal: number };
  overdrive: { name: string; label: string; blurb: string };
  lives: { name: string; label: string; min: number; max: number };
  final: string;
  runtime?: Record<string, string>;
  extraTools?: readonly CodeToolDefinition[];
}
export function createArcadeCatalog(o: CatalogOptions) {
  const d: ArcadeConfig = { worldTheme: 'classic', characterStyle: 'original', weather: 'clear', ...o.defaults };
  const mods: readonly ModDefinition<keyof ArcadeConfig>[] = [
    { id: 'worldTheme', name: 'worldTheme', type: 'string', label: 'WORLD BUILDER', blurb: 'Rebuild the scenery: alpine peaks, a volcanic world or a neon city. Changes terrain materials, props, sky and lighting live.', example: 'string worldTheme = "alpine";', values: ['classic', 'alpine', 'volcanic', 'neon'], defaultValue: d.worldTheme, glyph: '◈', unlockAt: 0 },
    { id: 'characterStyle', name: 'characterStyle', type: 'string', label: 'CHARACTER LAB', blurb: 'Replace your character or vehicle with a robot, astronaut or armored champion. New geometry, equipment and materials.', example: 'string characterStyle = "robot";', values: ['original', 'robot', 'astronaut', 'armored'], defaultValue: d.characterStyle, glyph: '♟', unlockAt: 0 },
    { id: 'weather', name: 'weather', type: 'string', label: 'ATMOSPHERE', blurb: 'Fill the world with falling snow, rain or drifting embers. Clear removes the particles.', example: 'string weather = "snow";', values: ['clear', 'snow', 'rain', 'embers'], defaultValue: d.weather, glyph: '☁', unlockAt: 0 },
    { id: 'palette', name: 'palette', type: 'string', label: 'COLOR STUDIO', blurb: 'Change your game’s accent and lighting.', example: `string palette = "${o.palettes[1]}";`, values: o.palettes, defaultValue: d.palette, glyph: '◈', unlockAt: 0 },
    { id: 'playerName', name: 'playerName', type: 'string', label: 'YOUR SIGNATURE', blurb: 'Put your name on the game.', example: 'string playerName = "Pixel Pilot";', maxLength: 22, defaultValue: d.playerName, glyph: 'Aa', unlockAt: 1 },
    { id: 'power', name: o.power.name, type: 'int', label: o.power.label, blurb: o.power.blurb, example: `int ${o.power.name} = ${o.power.goal - 5} + 5;`, limits: { min: o.power.min, max: o.power.max }, defaultValue: d.power, glyph: '+', unlockAt: 2 },
    { id: 'assist', name: o.assist.name, type: 'bool', label: o.assist.label, blurb: o.assist.blurb, example: `bool ${o.assist.name} = true;`, defaultValue: d.assist, glyph: '✧', unlockAt: 3 },
    { id: 'bonus', name: o.bonus.name, type: 'int', label: o.bonus.label, blurb: o.bonus.blurb, example: `int ${o.bonus.name} = ${o.bonus.goal};`, limits: { min: o.bonus.min, max: o.bonus.max }, defaultValue: d.bonus, glyph: '★', unlockAt: 4 },
    { id: o.physics.key, name: o.physics.name, type: 'int', label: o.physics.label, blurb: o.physics.blurb, example: `int ${o.physics.name} = ${o.physics.goal};`, limits: { min: o.physics.min, max: o.physics.max }, defaultValue: d[o.physics.key], glyph: '↗', unlockAt: 5 },
    { id: 'overdrive', name: o.overdrive.name, type: 'bool', label: o.overdrive.label, blurb: o.overdrive.blurb, example: `bool ${o.overdrive.name} = false;`, defaultValue: d.overdrive, glyph: 'ϟ', unlockAt: 6 },
    { id: 'lives', name: o.lives.name, type: 'int', label: o.lives.label, blurb: 'Starting chances when retrying a stage.', example: `int ${o.lives.name} = ${Math.min(o.lives.max, d.lives + 1)};`, limits: { min: o.lives.min, max: o.lives.max }, defaultValue: d.lives, glyph: '♥', unlockAt: 7 },
  ];
  const tools: readonly CodeToolDefinition[] = [{ id: 'arcade-rule', name: 'scoreRule', label: 'THE GAME CAN THINK', type: 'condition', blurb: `Switch on ${o.overdrive.label.toLowerCase()} after your first score.`, example: `if (score >= 1)\n{\n    ${o.overdrive.name} = true;\n}`, glyph: '?', unlockAt: 6 }];
  const runtimeLabels = { ...ARCADE_RUNTIME_LABELS, ...o.runtime };
  const allTools = [...tools, ...o.extraTools ?? []];
  const schema = createModSchema(mods, Object.keys(runtimeLabels));
  const missions: readonly ArcadeMission[] = [
    { id: 'm00', order: 0, kind: 'mission', title: 'SET THE MOOD', targetId: 'palette', message: `Welcome to ${o.title}. Start playing, then use COLOR STUDIO to change palette to ${o.palettes[1]}.` },
    { id: 'm01', order: 1, kind: 'mission', title: 'MAKE YOUR MARK', targetId: 'playerName', message: 'Add YOUR SIGNATURE and give your player a name of your own.' },
    { id: 'm02', order: 2, kind: 'mission', title: 'POWER OF ARITHMETIC', targetId: 'power', message: `Use arithmetic to set ${o.power.name} to ${o.power.goal} or more. Try ${o.power.goal - 5} + 5.` },
    { id: 'm03', order: 3, kind: 'mission', title: 'A HELPING HAND', targetId: 'assist', message: `Set ${o.assist.name} to true. ${o.assist.instruction}` },
    { id: 'm04', order: 4, kind: 'mission', title: 'MAKE IT COUNT', targetId: 'bonus', message: `Set ${o.bonus.name} to ${o.bonus.goal} or more and score in the game.` },
    { id: 'm05', order: 5, kind: 'mission', title: 'CHANGE THE FEEL', targetId: o.physics.key, message: `Change ${o.physics.name} to ${o.physics.goal}, then make a move to feel the difference.` },
    { id: 'm06', order: 6, kind: 'mission', title: 'REACTIVE PLAY', targetId: 'arcade-rule', message: `Add ${o.overdrive.label} set to false, then THE GAME CAN THINK. Score once to activate the rule.` },
    { id: 'final', order: 7, kind: 'final', title: 'THE COMPLETE GAME', message: `${o.final} Keep your custom palette, name, arithmetic and activated live rule.` },
    { id: 'free', order: 8, kind: 'sandbox', title: 'FREE PLAY', message: 'Your basic game is ready. Try any mod or change a value in the code, then play to feel the difference. Challenges are optional.' },
  ];
  const starter = mods.map(m => `${m.type} ${m.name} = ${JSON.stringify(m.defaultValue)};`).join('\n');
  const remix = mods.map(m => m.id === 'palette' ? `string palette = "${o.palettes[1]}";` : m.id === 'playerName' ? 'string playerName = "Pixel Pilot";' : m.example).join('\n') + `\n${tools[0].example}`;
  const reads = (e: Expr, name: string): boolean => e.kind === 'identifier' ? e.name === name : e.kind === 'literal' ? false : e.kind === 'unary' ? reads(e.operand, name) : reads(e.left, name) || reads(e.right, name);
  function passed(mission: ArcadeMission, program: ProgramResult<ArcadeConfig>, run: ArcadeRun): boolean {
    if (!program.ok || mission.kind === 'sandbox') return false;
    const math = program.ast.statements.some(s => s.kind === 'varDecl' && s.name === o.power.name && s.init.kind === 'binary' || s.kind === 'assign' && s.name === o.power.name && s.value.kind === 'binary');
    const rule = program.rules.some(r => reads(r.condition, 'score') && r.actions.some(a => a.target === 'overdrive') && run.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes(o.overdrive.name))) && run.config.overdrive;
    switch (mission.id) {
      case 'm00': return run.config.palette !== d.palette;
      case 'm01': return run.config.playerName.trim().length > 0 && run.config.playerName !== d.playerName;
      case 'm02': return run.config.power >= o.power.goal && math;
      case 'm03': return run.config.assist && run.metrics.assisted > 0;
      case 'm04': return run.config.bonus >= o.bonus.goal && run.metrics.scored > 0;
      case 'm05': return run.config[o.physics.key] === o.physics.goal && run.metrics.actions > 0;
      case 'm06': return rule;
      case 'final': return run.config.palette !== d.palette && run.config.playerName !== d.playerName && run.config.power >= o.power.goal && math && rule && run.metrics.clears > 0;
      default: return false;
    }
  }
  return { mods, tools: allTools, runtimeLabels, schema, missions, starter, sandbox: starter, remix, passed, defaults: d };
}
export type ArcadeCatalog = ReturnType<typeof createArcadeCatalog>;
