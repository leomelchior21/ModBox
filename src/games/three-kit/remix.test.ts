import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { SlingersRun } from '../makita-slingers/run';
import { NajaRun } from '../naja-run/run';
import { PinballRun } from '../pinballerz/run';
import { StackRun } from '../speed-stack/run';
import { RunnerRun } from './runner';
import { TeamRun } from '../team-counters/run';
import { MonsterRun } from '../monster-strider/run';
import { RoombaRun } from '../roomba-run/run';
import { YardRun } from '../makitas-vs-zombies/run';
import { yardSchema, type YardConfig } from '../makitas-vs-zombies/mods';
import type { ArcadeConfig, ArcadeRun } from '../premium-kit/core';

const games: (() => ArcadeRun)[] = [() => new SlingersRun(), () => new NajaRun(), () => new PinballRun(), () => new StackRun(), () => new RunnerRun('temple'), () => new RunnerRun('subway'), () => new TeamRun(), () => new MonsterRun(), () => new RoombaRun()];

describe('live world remixes', () => {
  it.each(['python', 'swift', 'csharp'] as const)('changes scenery, actors and weather without resetting any game in %s', language => {
    for (const create of games) {
      const run = create(); run.launch(); run.score = 250; run.elapsed = 12; const revision = run.revision, checkpoint = run.checkpointRevision;
      for (const worldTheme of ['classic', 'alpine', 'volcanic', 'neon']) {
        const source = `string worldTheme = "${worldTheme}";\nstring characterStyle = "astronaut";\nstring weather = "snow";`;
        const program = parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, run.schema);
        expect(program.ok).toBe(true); run.setProgram(program);
        expect(run.config).toMatchObject({ worldTheme, characterStyle: 'astronaut', weather: 'snow' });
        expect([run.score, run.elapsed, run.revision, run.checkpointRevision, run.phase]).toEqual([250, 12, revision, checkpoint, 'playing']);
      }
      const rule = parseGameScript<ArcadeConfig>(formatCodeForLanguage('string worldTheme = "classic";\nstring characterStyle = "original";\nstring weather = "clear";\nif (score >= 100)\n{\n    worldTheme = "volcanic";\n    characterStyle = "robot";\n    weather = "embers";\n}', language), language, run.schema);
      expect(rule.ok).toBe(true); run.setProgram(rule); expect(run.config).toMatchObject({ worldTheme: 'volcanic', characterStyle: 'robot', weather: 'embers' });
      const previous = { ...run.config }; run.setProgram(parseGameScript<ArcadeConfig>(formatCodeForLanguage('string worldTheme = "invalid";', language), language, run.schema)); expect(run.config).toEqual(previous);
    }
  });
  it('remixes an active workshop without losing placed machines or power', () => {
    const run = new YardRun(); run.launch(); run.interact('saw', 2, 0); const power = run.power, unit = run.units[0], revision = run.revision;
    run.setProgram(parseGameScript<YardConfig>('string worldTheme = "neon"; string characterStyle = "armored"; string weather = "rain";', 'csharp', yardSchema));
    expect(run.config).toMatchObject({ worldTheme: 'neon', characterStyle: 'armored', weather: 'rain' }); expect(run.power).toBe(power); expect(run.units[0]).toBe(unit); expect(run.revision).toBe(revision);
  });
});

describe('Unity model exports', () => {
  it.each(['vacuum', 'truck', 'cobra', 'robot', 'turret'])('loads %s as a complete glTF mesh with finite bounds', async name => {
    const file = readFileSync(`public/models/unity/${name}.glb`), buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const result = await new GLTFLoader().parseAsync(buffer, ''); let vertices = 0;
    result.scene.traverse(o => { if (o instanceof T.Mesh) { vertices += o.geometry.attributes.position.count; o.geometry.computeBoundingBox(); expect(o.geometry.boundingBox?.isEmpty()).toBe(false); expect(o.geometry.getAttribute('color').count).toBe(o.geometry.attributes.position.count); o.geometry.dispose(); for (const mat of Array.isArray(o.material) ? o.material : [o.material]) mat.dispose(); } });
    expect(vertices).toBeGreaterThan(100); const bounds = new T.Box3().setFromObject(result.scene); expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
  });
});
