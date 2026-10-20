import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ArcadeCue, ArcadeRun } from '../premium-kit/core';
import { palette } from '../premium-kit/visuals';
import type { WorldView } from './types';
import { SceneRemix } from './remix';

const unitBox = () => new RoundedBoxGeometry(1, 1, 1, 1, .045);
export function material(color: T.ColorRepresentation, roughness = .7, metalness = 0) { return new T.MeshStandardMaterial({ color, roughness, metalness }); }
export function mesh(geometry: T.BufferGeometry, mat: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0, shadow = true) {
  const object = new T.Mesh(geometry, mat); object.position.set(x, y, z); object.castShadow = shadow; object.receiveShadow = true; parent.add(object); return object;
}
export class Shapes {
  box = unitBox(); block = new T.BoxGeometry(1, 1, 1); sphere = new T.SphereGeometry(1, 12, 8); cylinder = new T.CylinderGeometry(1, 1, 1, 12); cone = new T.ConeGeometry(1, 1, 7); ring = new T.TorusGeometry(1, .11, 6, 20);
  cube(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = true) { const m = mesh(shadow ? this.box : this.block, mat, parent, x, y, z, shadow); m.scale.set(w, h, d); return m; }
  ball(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, r: number, shadow = true) { const m = mesh(this.sphere, mat, parent, x, y, z, shadow); m.scale.setScalar(r); return m; }
  tube(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, r: number, h: number, shadow = true) { const m = mesh(this.cylinder, mat, parent, x, y, z, shadow); m.scale.set(r, h, r); return m; }
  dispose() { for (const geometry of [this.box, this.block, this.sphere, this.cylinder, this.cone, this.ring]) geometry.dispose(); }
}
export interface Label { sprite: T.Sprite; set(text: string, color?: string, background?: string): void }
export function label(text: string, color = '#ffffff', background = '#102a37dd', width = 512, height = 160): Label {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!, texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const mat = new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new T.Sprite(mat); let previous = '';
  const set = (next: string, ink = color, bg = background) => {
    const key = `${next}|${ink}|${bg}`; if (key === previous) return; previous = key;
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(5, 5, width - 10, height - 10, 30); ctx.fill();
    ctx.strokeStyle = `${ink}77`; ctx.lineWidth = 3; ctx.stroke(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = Math.min(height * .58, width / Math.max(4, next.length) * 1.45); ctx.font = `900 ${size}px "Arial Black",Arial,sans-serif`; ctx.fillStyle = ink; ctx.fillText(next, width / 2, height * .51, width - 30); texture.needsUpdate = true;
  };
  set(text); return { sprite, set };
}
export function disposeObject(root: T.Object3D, retainedGeometry: ReadonlySet<T.BufferGeometry> = new Set(), retainedMaterial: ReadonlySet<T.Material> = new Set()): void {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse(object => {
    if (object instanceof T.Mesh) { geometries.add(object.geometry); if (object instanceof T.InstancedMesh) object.dispose(); }
    if (object instanceof T.Mesh || object instanceof T.Sprite) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
  });
  for (const mat of materials) if (!retainedMaterial.has(mat)) { for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.add(value); mat.dispose(); }
  geometries.forEach(g => { if (!retainedGeometry.has(g)) g.dispose(); }); textures.forEach(t => t.dispose());
}
/** Bake repeated scenery into instanced draws without changing animated actors. */
export function batchScenery(root: T.Object3D): void {
  root.updateMatrixWorld(true); const inverse = root.matrixWorld.clone().invert(), groups = new Map<string, T.Mesh[]>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh || object.userData.dynamic || Array.isArray(object.material) || !(object.material instanceof T.MeshStandardMaterial)) return;
    const mat = object.material, key = [object.geometry.uuid, mat.color.getHex(), mat.roughness, mat.metalness, mat.opacity, mat.transparent, mat.map?.uuid, object.castShadow].join('|');
    const entries = groups.get(key) ?? []; entries.push(object); groups.set(key, entries);
  });
  for (const entries of groups.values()) if (entries.length >= 3) {
    const first = entries[0], combined = new T.InstancedMesh(first.geometry, first.material, entries.length);
    entries.forEach((entry, i) => { combined.setMatrixAt(i, entry.matrixWorld.clone().premultiply(inverse)); entry.removeFromParent(); });
    combined.castShadow = first.castShadow; combined.receiveShadow = true; combined.computeBoundingSphere(); root.add(combined);
  }
}
export function floorTexture(kind: 'stone' | 'wood' | 'metro'): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!;
  ctx.fillStyle = kind === 'wood' ? '#c59869' : kind === 'metro' ? '#74808a' : '#bbb9a4'; ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += kind === 'wood' ? 32 : 64) for (let x = 0; x < 256; x += 128) {
    const ox = x + (y % 128 ? -40 : 0); ctx.fillStyle = `rgba(${kind === 'wood' ? '90,45,15' : '20,40,30'},${.04 + ((x + y) % 7) * .015})`; ctx.fillRect(ox, y, 127, (kind === 'wood' ? 32 : 64) - 1);
    ctx.strokeStyle = kind === 'wood' ? '#6a4c3433' : '#1c332f66'; ctx.lineWidth = 2; ctx.strokeRect(ox, y, 128, kind === 'wood' ? 32 : 64);
  }
  if (kind === 'wood') for (let i = 0; i < 60; i++) { ctx.strokeStyle = '#6a4c3418'; ctx.beginPath(); ctx.moveTo((i * 31) % 256, (i * 13) % 256); ctx.lineTo((i * 31) % 256 + 50, (i * 13) % 256 + 2); ctx.stroke(); }
  const texture = new T.CanvasTexture(c); texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 4; return texture;
}
interface Spark { position: T.Vector3; velocity: T.Vector3; life: number; age: number }
interface FloatText { object: T.Sprite; age: number; start: number }

/** Small bounded renderer: native meshes, one shadow light, instanced effects, explicit GPU cleanup. */
export abstract class World<R extends ArcadeRun> implements WorldView {
  readonly renderer: T.WebGLRenderer; readonly scene = new T.Scene(); readonly shapes = new Shapes();
  camera: T.PerspectiveCamera | T.OrthographicCamera = new T.PerspectiveCamera(52, 1, .1, 220);
  readonly paint: T.MeshStandardMaterial; readonly sun: T.DirectionalLight;
  readonly remix: SceneRemix;
  readonly origin = new T.Vector3(); readonly scratch = new T.Object3D();
  private sparks: Spark[] = []; private floaters: FloatText[] = []; private particleMesh: T.InstancedMesh;
  private lastPalette = ''; protected revision = -1; protected time = 0;
  private dirty = true; private signature = ''; private environmentMap: T.Texture;
  width = 1; height = 1;
  constructor(readonly canvas: HTMLCanvasElement, readonly run: R, background: string, readonly isoSize = 17) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    const studio = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer); this.environmentMap = pmrem.fromScene(studio, .04).texture; this.scene.environment = this.environmentMap; this.scene.environmentIntensity = .45; studio.dispose(); pmrem.dispose();
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene.background = new T.Color(background); this.scene.fog = new T.Fog(background, 45, 145);
    if (run.game !== 'roomba-run') {
      const sky = document.createElement('canvas'); sky.width = 256; sky.height = 512; const ctx = sky.getContext('2d')!, gradient = ctx.createLinearGradient(0, 0, 0, 512);
      const colors = run.game === 'temple-race' ? ['#518f9c', '#b8d4be', '#e5ddb4'] : run.game === 'team-counters' ? ['#2f8fe0', '#8fd0f5', '#e2f5ff'] : run.game === 'monster-strider' ? ['#1f9df5', '#5cc8ff', '#b9ecff'] : run.game === 'makitas-vs-zombies' ? ['#3b9be6', '#9bd8ff', '#e6f7ff'] : run.game === 'makita-slingers' ? ['#2a86d8', '#6fc0f2', '#c6ecff'] : ['#5ba9d5', background, '#e2f0dc'];
      gradient.addColorStop(0, colors[0]); gradient.addColorStop(.62, colors[1]); gradient.addColorStop(1, colors[2]); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 512);
      for (let i = 0; i < (run.game === 'monster-strider' || run.game === 'makitas-vs-zombies' || run.game === 'makita-slingers' ? 0 : 5); i++) { ctx.fillStyle = '#fff7e62b'; ctx.beginPath(); ctx.ellipse((i * 83 + 27) % 256, 90 + i * 23, 37 + i * 5, 7 + i, 0, 0, Math.PI * 2); ctx.fill(); }
      const skyMap = new T.CanvasTexture(sky); skyMap.colorSpace = T.SRGBColorSpace; this.scene.background = skyMap;
    }
    this.scene.add(new T.HemisphereLight('#e7f7ff', '#617c64', 1.15)); this.sun = new T.DirectionalLight('#fff0ce', 2.4); this.sun.position.set(-18, 30, 16);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -24; this.sun.shadow.camera.right = this.sun.shadow.camera.top = 24;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 90; this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .04; this.scene.add(this.sun, this.sun.target);
    this.paint = material(palette(run.config.palette).accent, .4, .12);
    this.particleMesh = new T.InstancedMesh(new T.IcosahedronGeometry(.07, 0), new T.MeshBasicMaterial({ color: '#ffe3a0' }), 120);
    this.particleMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.particleMesh.frustumCulled = false; this.particleMesh.count = 0; this.scene.add(this.particleMesh);
    this.remix = new SceneRemix(this.scene, this.sun, run.game === 'roomba-run');
  }
  resize(width: number, height: number, pixelRatio: number): void {
    this.dirty = true;
    this.width = width; this.height = height; this.renderer.setPixelRatio(Math.min(pixelRatio, 1.65)); this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    if (this.camera instanceof T.PerspectiveCamera) { this.camera.aspect = aspect; this.camera.fov = aspect < .75 ? 62 : 52; }
    else { this.camera.left = -this.isoSize * aspect / 2; this.camera.right = this.isoSize * aspect / 2; this.camera.top = this.isoSize / 2; this.camera.bottom = -this.isoSize / 2; }
    this.camera.updateProjectionMatrix();
  }
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    const signature = `${this.run.revision}|${this.run.phase}|${this.run.elapsed}|${this.run.score}|${this.run.metrics.actions}|${reduced}|${JSON.stringify(this.run.config)}`;
    if ((held || this.run.phase !== 'playing' && !this.sparks.length && !this.floaters.length) && !this.dirty && !cues.length && signature === this.signature) return;
    this.signature = signature; this.dirty = false;
    const step = held ? 0 : dt; this.time += step;
    if (this.lastPalette !== this.run.config.palette) { this.lastPalette = this.run.config.palette; this.paint.color.set(palette(this.lastPalette).accent); }
    if (this.revision !== this.run.revision) { this.revision = this.run.revision; this.resetEffects(); this.rebuild(); }
    this.update(step, reduced); this.remix.update(this.run.config, this.origin, step, reduced, this.revision); this.effects(step, reduced, cues); this.renderer.render(this.scene, this.camera);
  }
  protected abstract rebuild(): void;
  protected abstract update(dt: number, reduced: boolean): void;
  protected disposeStage(root: T.Object3D): void { disposeObject(root, new Set([this.shapes.box, this.shapes.block, this.shapes.sphere, this.shapes.cylinder, this.shapes.cone, this.shapes.ring]), new Set([this.paint])); }
  protected followLight(x: number, z: number) { this.sun.position.set(x - 18, 30, z + 16); this.sun.target.position.set(x, 0, z); }
  private effects(dt: number, reduced: boolean, cues: readonly ArcadeCue[]) {
    for (const cue of cues.slice(-4)) {
      if (!reduced) for (let i = 0; i < (cue.kind === 'clear' ? 32 : 8); i++) this.sparks.push({ position: this.origin.clone(), velocity: new T.Vector3(Math.sin(i * 2.4 + this.time) * 3, 2 + i % 4, Math.cos(i * 2.4 + this.time) * 3), life: .6 + i % 4 * .12, age: 0 });
      if (cue.text && (cue.kind !== 'score' || /[×→!]|LANDED|CLEAR|CLEAN|CHOICE/.test(cue.text))) {
        const text = label(cue.text, cue.kind === 'lose' ? '#ffb0a4' : '#fff0b7', '#152b40bb'); text.sprite.scale.set(3.6, 1.12, 1); text.sprite.position.copy(this.origin).add(new T.Vector3(0, 2.8, 0)); this.scene.add(text.sprite); this.floaters.push({ object: text.sprite, age: 0, start: text.sprite.position.y });
      }
    }
    this.sparks = reduced ? [] : this.sparks.filter(s => s.age < s.life).slice(-120);
    this.particleMesh.count = this.sparks.length;
    this.sparks.forEach((s, i) => { s.age += dt; s.position.addScaledVector(s.velocity, dt); s.velocity.y -= dt * 7; this.scratch.position.copy(s.position); this.scratch.scale.setScalar(Math.max(0, 1 - s.age / s.life)); this.scratch.updateMatrix(); this.particleMesh.setMatrixAt(i, this.scratch.matrix); });
    this.particleMesh.instanceMatrix.needsUpdate = true;
    for (const f of this.floaters) { f.age += dt; f.object.position.y = f.start + (reduced ? 0 : f.age * 1.2); (f.object.material as T.SpriteMaterial).opacity = Math.max(0, 1 - f.age / 1.2); }
    while (this.floaters.length > 8 || this.floaters[0]?.age > 1.2) { const f = this.floaters.shift()!; this.scene.remove(f.object); disposeObject(f.object); }
  }
  private resetEffects() { for (const f of this.floaters) { this.scene.remove(f.object); disposeObject(f.object); } this.floaters = []; this.sparks = []; }
  diagnostics(): Record<string, number> { const info = this.renderer.info; return { drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 }; }
  dispose(): void { this.scene.userData.disposed = true; this.resetEffects(); this.remix.dispose(); this.sun.shadow.dispose(); disposeObject(this.scene); this.environmentMap.dispose(); if (this.scene.background instanceof T.Texture) this.scene.background.dispose(); this.shapes.dispose(); this.renderer.resetState(); this.renderer.dispose(); if (!this.canvas.isConnected) this.renderer.forceContextLoss(); }
}

export function instances(geometry: T.BufferGeometry, mat: T.Material, transforms: readonly { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number }[], parent: T.Object3D, shadow = false) {
  const instanced = new T.InstancedMesh(geometry, mat, transforms.length), dummy = new T.Object3D();
  transforms.forEach((t, i) => { dummy.position.set(t.x, t.y, t.z); dummy.scale.set(t.sx, t.sy, t.sz); dummy.rotation.set(0, t.yaw ?? 0, 0); dummy.updateMatrix(); instanced.setMatrixAt(i, dummy.matrix); });
  instanced.castShadow = shadow; instanced.receiveShadow = true; parent.add(instanced); return instanced;
}
