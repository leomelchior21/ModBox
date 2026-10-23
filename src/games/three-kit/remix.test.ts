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
import { TomatinaRun } from '../tomatina/run';
import { NeonMazeRun } from '../neon-maze/run';
import { YardRun } from '../makitas-vs-zombies/run';
import { yardSchema, type YardConfig } from '../makitas-vs-zombies/mods';
import type { ArcadeConfig, ArcadeRun } from '../premium-kit/core';

const games: (() => ArcadeRun)[] = [() => new SlingersRun(), () => new NajaRun(), () => new PinballRun(), () => new StackRun(), () => new RunnerRun('temple'), () => new RunnerRun('subway'), () => new TeamRun(), () => new MonsterRun(), () => new RoombaRun(), () => new TomatinaRun(), () => new NeonMazeRun()];

describe('live world remixes', () => {
  it.each(['python', 'swift', 'csharp'] as const)('changes scenery, actors and weather without resetting any game in %s', language => {
    for (const create of games) {
      const run = create(); run.launch(); run.score = 250; run.elapsed = 12; const revision = run.revision, checkpoint = run.checkpointRevision;
      // Every game has its own worlds, characters and weather; read them from its catalog.
      const values = (id: string) => run.schema.mods.find(m => m.id === id)!.values!, worlds = values('worldTheme'), styles = values('characterStyle'), skies = values('weather');
      expect(worlds.length).toBeGreaterThanOrEqual(4); expect(styles.length).toBeGreaterThanOrEqual(4); expect(skies.length).toBeGreaterThanOrEqual(4);
      for (const worldTheme of worlds) {
        const source = `string worldTheme = "${worldTheme}";\nstring characterStyle = "${styles[2]}";\nstring weather = "${skies[1]}";`;
        const program = parseGameScript<ArcadeConfig>(formatCodeForLanguage(source, language), language, run.schema);
        expect(program.ok).toBe(true); run.setProgram(program);
        expect(run.config).toMatchObject({ worldTheme, characterStyle: styles[2], weather: skies[1] });
        expect([run.score, run.elapsed, run.revision, run.checkpointRevision, run.phase]).toEqual([250, 12, revision, checkpoint, 'playing']);
      }
      const rule = parseGameScript<ArcadeConfig>(formatCodeForLanguage(`string worldTheme = "${worlds[0]}";\nstring characterStyle = "${styles[0]}";\nstring weather = "${skies[0]}";\nif (score >= 100)\n{\n    worldTheme = "${worlds[2]}";\n    characterStyle = "${styles[1]}";\n    weather = "${skies[2]}";\n}`, language), language, run.schema);
      expect(rule.ok).toBe(true); run.setProgram(rule); expect(run.config).toMatchObject({ worldTheme: worlds[2], characterStyle: styles[1], weather: skies[2] });
      const previous = { ...run.config }; run.setProgram(parseGameScript<ArcadeConfig>(formatCodeForLanguage('string worldTheme = "invalid";', language), language, run.schema)); expect(run.config).toEqual(previous);
    }
  });
  it('remixes an active workshop without losing placed machines or power', () => {
    const run = new YardRun(); run.launch(); run.place('saw', 2, 1); const power = run.power, unit = run.units[0], revision = run.revision;
    run.setProgram(parseGameScript<YardConfig>('string worldTheme = "graveyard"; string characterStyle = "steampunk"; string weather = "rain";', 'csharp', yardSchema));
    expect(run.config).toMatchObject({ worldTheme: 'graveyard', characterStyle: 'steampunk', weather: 'rain' }); expect(run.power).toBe(power); expect(run.units[0]).toBe(unit); expect(run.revision).toBe(revision);
  });
});

describe('Unity model exports', () => {
  it.each(['vacuum', 'truck', 'tire', 'cobra', 'robot', 'turret', 'footballer'])('loads %s as a complete glTF mesh with finite bounds', async name => {
    const file = readFileSync(`public/models/unity/${name}.glb`), buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const result = await new GLTFLoader().parseAsync(buffer, ''); let vertices = 0;
    result.scene.traverse(o => { if (o instanceof T.Mesh) { vertices += o.geometry.attributes.position.count; o.geometry.computeBoundingBox(); expect(o.geometry.boundingBox?.isEmpty()).toBe(false); expect(o.geometry.getAttribute('color').count).toBe(o.geometry.attributes.position.count); o.geometry.dispose(); for (const mat of Array.isArray(o.material) ? o.material : [o.material]) mat.dispose(); } });
    expect(vertices).toBeGreaterThan(100); const bounds = new T.Box3().setFromObject(result.scene); expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
  });
});

describe('Unity footballer rig', () => {
  it('exports six pivoted limbs with outward-facing triangles and kit marker colors', async () => {
    const file = readFileSync('public/models/unity/footballer.glb'), result = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
    const parts: Record<string, T.Vector3> = {}, markers = new Set<string>(); let inward = 0;
    result.scene.traverse(o => {
      if (!(o instanceof T.Mesh)) return; parts[o.name] = o.position.clone();
      const p = o.geometry.attributes.position, n = o.geometry.attributes.normal, c = o.geometry.attributes.color, index = o.geometry.index!, a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3(), normal = new T.Vector3();
      for (let i = 0; i < index.count; i += 3) { a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); d.fromBufferAttribute(p, index.getX(i + 2)); normal.fromBufferAttribute(n, index.getX(i)); const face = b.sub(a).cross(d.sub(a)); if (face.lengthSq() > 1e-12 && face.dot(normal) < 0) inward++; }
      for (let i = 0; i < c.count; i++) markers.add(new T.Color(c.getX(i), c.getY(i), c.getZ(i)).getHexString());
    });
    expect(Object.keys(parts).sort()).toEqual(['armL', 'armR', 'body', 'head', 'legL', 'legR']); expect(parts.head.y).toBeGreaterThan(parts.body.y); expect(parts.armL.x).toBeLessThan(0);
    expect(inward).toBe(0); for (const hex of ['ff00ff', '00ffff', 'ffff00', '00ff00', 'ff0000', '0000ff']) expect(markers.has(hex), hex).toBe(true);
  });
});
