import * as T from 'three';
import { createModSchema } from '../../interpreter/core/schema';
import { ArcadeRun, type ArcadeAction, type ArcadeCue } from '../premium-kit/core';
import { World, material, mesh, label, batchScenery } from '../three-kit/world';
import { YardRun, COLS, ROWS, type Defender, type Zombie, type YardCue, type UnitKind } from './run';
import { TEAL, batteryModel, sawBlade, sweeperModel, unitModel, zombieModel, type UnitModel, type ZombieModel } from './models';

const TILE = 1.4;
export const tileX = (col: number) => (col - COLS / 2) * TILE;
export const tileZ = (row: number) => (row - ROWS / 2) * TILE;

/** Adapts the lane defense to the shared 3D world runtime (remixes, effects, lighting). */
class Presentation extends ArcadeRun {
  constructor(readonly yard: YardRun) { super('makitas-vs-zombies', { palette: 'teal', playerName: '', power: 0, speed: 0, gravity: 0, assist: false, overdrive: false, lives: 3, bonus: 0 }, createModSchema([])); }
  sync() { const y = this.yard; this.config = { ...this.config, worldTheme: y.config.worldTheme, characterStyle: y.config.characterStyle, weather: y.config.weather }; this.revision = y.revision; this.phase = y.phase === 'launch' ? 'ready' : y.phase; this.score = y.score; this.elapsed = y.elapsed; }
  protected setup() {} protected tick() {} action(_action: ArcadeAction) {} stats() { return []; }
}
interface Actor<M> { model: M; seen: boolean; death: number }

export class YardView extends World<Presentation> {
  private yardGroup = new T.Group(); private units = new Map<number, Actor<UnitModel>>(); private zombies = new Map<number, Actor<ZombieModel> & { last: Zombie }>();
  private blades = new Map<number, T.Group>(); private drops = new Map<number, T.Group>(); private sweepers: T.Group[] = [];
  private ghost = new T.Group(); private ghostKind = ''; private marker: T.Mesh; private sign = label('THE LAST WORKSHOP', '#ffffff', '#0a7f82ee', 640, 120);
  private stageKey = ''; private iconCache: Partial<Record<UnitKind, string>> = {};
  constructor(canvas: HTMLCanvasElement, readonly yard: YardRun) {
    super(canvas, new Presentation(yard), '#8fd3ff', 15);
    this.camera = new T.PerspectiveCamera(34, 1, .5, 300);
    this.renderer.toneMapping = T.NoToneMapping; this.scene.environmentIntensity = .35; this.sun.intensity = 2.6;
    this.scene.add(this.yardGroup, this.ghost);
    this.marker = mesh(new T.PlaneGeometry(TILE * .96, TILE * .96), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .35, depthWrite: false }), this.scene, 0, .1, 0, false);
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false;
  }
  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    const camera = this.camera as T.PerspectiveCamera; camera.fov = 32;
    // Pull in as close as possible while the lawn, the workshop wall and the hedge stay on screen,
    // with room for the card bar above and the level meter below, on any aspect ratio.
    const target = new T.Vector3(-.7, 0, .35), direction = new T.Vector3(0, Math.sin(1.0), Math.cos(1.0));
    const lawn = [[tileX(0) - .9, 0, tileZ(0)], [tileX(COLS) + .6, 0, tileZ(0)], [tileX(0) - .9, 0, tileZ(ROWS)], [tileX(COLS) + .6, 0, tileZ(ROWS)]].map(([x, y, z]) => new T.Vector3(x, y, z));
    let distance = 12;
    for (let i = 0; i < 80; i++) {
      camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const fits = lawn.every(p => { const q = p.clone().project(camera); return Math.abs(q.x) <= .98 && q.y <= .7 && q.y >= -.78; });
      if (fits) break; distance += .5;
    }
  }
  protected rebuild(): void {
    for (const map of [this.units, this.zombies]) { for (const actor of map.values()) { actor.model.root.removeFromParent(); this.disposeStage(actor.model.root); } map.clear(); }
    for (const map of [this.blades, this.drops]) { for (const root of map.values()) { root.removeFromParent(); this.disposeStage(root); } map.clear(); }
    this.stageKey = '';
  }
  private buildYard() {
    this.disposeStage(this.yardGroup); this.yardGroup.clear(); this.sweepers = [];
    const s = this.shapes, y = this.yard, night = y.stage.night, lanes = y.stage.lanes;
    const grassA = material(night ? '#5f9a6a' : '#ffffff', .9), grassB = material(night ? '#4f8a5c' : '#e3f0d8', .9), dirt = material(night ? '#8a7a66' : '#ffffff', .95), dirtDark = material(night ? '#4a3a2a' : '#9c7246', .95);
    grassA.map = grassB.map = turf(); dirt.map = soil();
    // Lawn tiles: classic alternating stripes for open lanes, bare soil for closed ones.
    s.cube(this.yardGroup, dirtDark, -.3, -.5, 0, 15.6, 1, 8.6, false);
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const open = lanes.includes(row), x = tileX(col + .5), z = tileZ(row + .5);
      s.cube(this.yardGroup, open ? (row + col) % 2 ? grassA : grassB : dirt, x, open ? .02 : -.06, z, TILE * 1.001, .12, TILE * 1.001, false);
    }
    s.cube(this.yardGroup, dirt, -.3, -.02, tileZ(0) - 1.1, 15.6, .1, .9, false); s.cube(this.yardGroup, material('#d9d1c2', .9), -.3, 0, tileZ(ROWS) + .8, 15.6, .14, .9, false);
    for (let i = 0; i < 16; i++) s.cube(this.yardGroup, material('#c8bfae', .9), -7.6 + i * 1.02, .075, tileZ(ROWS) + .8, .04, .02, .9, false);
    // Picket fence along the back.
    const wood = material(night ? '#a9a49a' : '#efe9dc', .85), woodShade = material(night ? '#8d887f' : '#d6cfc0', .85);
    for (let i = 0; i < 26; i++) { const x = -7.4 + i * .6, picket = s.cube(this.yardGroup, i % 3 ? wood : woodShade, x, .75, tileZ(0) - 1.55, .34, 1.5 + (i % 2) * .12, .08); picket.rotation.z = Math.sin(i * 1.7) * .05; }
    for (const yv of [.5, 1.15]) s.cube(this.yardGroup, woodShade, -.4, yv, tileZ(0) - 1.6, 15.8, .12, .06);
    // The workshop on the left: walls, tiled roof, door, windows and a Makita-teal sign.
    const wall = material(night ? '#b9b2a2' : '#f4e9d4', .85), roof = material(night ? '#7a3a2c' : '#d0573b', .8), trim = material('#8b5a3c', .8);
    const house = new T.Group(); house.position.set(tileX(0) - 2.15, 0, 0); this.yardGroup.add(house);
    s.cube(house, wall, 0, 1.9, 0, 2.6, 3.8, 9.4); s.cube(house, material('#c9bba0', .9), 0, .18, 0, 2.7, .36, 9.5);
    for (let i = 0; i < 9; i++) { const tile = s.cube(house, roof, -.2, 4.1 + i * .01, -4.4 + i * 1.1, 3.3, .3, 1.16); tile.rotation.x = (i % 2 ? .03 : -.03); }
    s.cube(house, material('#a8432e', .8), -.2, 4.3, 0, 3.4, .14, 9.6);
    for (const z of [-2.8, 2.8]) { s.cube(house, trim, 1.31, 2.1, z, .06, 1.3, 1.1); s.cube(house, material(night ? '#ffd27a' : '#9ad3ef', .2, .3), 1.33, 2.1, z, .04, 1.1, .9); }
    s.cube(house, trim, 1.31, 1.1, 0, .08, 2.2, 1.3); s.cube(house, material('#6b412a', .8), 1.34, 1.1, 0, .04, 2, 1.1); s.ball(house, material('#ffd36a', .3, .6), 1.38, 1.1, .4, .07);
    this.sign.set(y.config.workshopName.toUpperCase(), '#ffffff', '#0a8f92f0'); this.sign.sprite.position.set(tileX(0) - 2.2, 4.9, 1.2); this.sign.sprite.scale.set(3.4, .64, 1); this.yardGroup.add(this.sign.sprite);
    // Hedge on the right, where the zombies push through.
    const leaf = [material(night ? '#1f4d2a' : '#3f9a3c', .9), material(night ? '#26592f' : '#4caf45', .9), material(night ? '#1a4425' : '#358a33', .9)];
    for (let i = 0; i < 34; i++) { const bush = s.ball(this.yardGroup, leaf[i % 3], tileX(COLS) + 1.4 + (i % 3) * .9 + Math.sin(i * 2.1) * .3, .7 + (i % 4) * .35, -4.6 + i * .3, .95 + (i % 3) * .2); bush.scale.y = .9; }
    // Garden props and the open world behind the fence.
    for (let i = 0; i < 7; i++) { const tree = new T.Group(); tree.position.set(-5 + i * 2.4, 0, tileZ(0) - 4 - (i % 2) * 1.6); this.yardGroup.add(tree); s.tube(tree, material('#6e4b33'), 0, 1.2, 0, .18, 2.4); s.ball(tree, leaf[i % 3], 0, 3, 0, 1.3); s.ball(tree, leaf[(i + 1) % 3], .7, 2.6, .3, .95); }
    s.cube(this.yardGroup, material(night ? '#23452c' : '#5aa848', .95), 0, -.3, tileZ(0) - 10, 60, .4, 14, false);
    s.cube(this.yardGroup, material(night ? '#2a2d33' : '#545b63', .9), 0, -.3, tileZ(ROWS) + 6, 60, .3, 9, false);
    s.cube(this.yardGroup, material('#b9b3a6', .9), 0, -.05, tileZ(ROWS) + 1.35, 60, .2, .22, false);
    for (let i = 0; i < 14; i++) s.cube(this.yardGroup, material('#f4d35e', .7), -14 + i * 2.2, -.13, tileZ(ROWS) + 3.4, 1.1, .02, .14, false);
    for (const [x, color] of [[-4.5, '#d8392b'], [2.2, TEAL], [5.4, '#d8392b']] as const) { const crate = s.cube(this.yardGroup, material(color, .5), x, .25, tileZ(ROWS) + .95, .7, .5, .5); crate.rotation.y = x * .3; }
    if (night) for (const x of [-3, 3]) { s.tube(this.yardGroup, material('#2d3238'), x, 1.5, tileZ(0) - 1.9, .06, 3); const lamp = material('#ffe9a8'); lamp.emissive.set('#ffd77a'); lamp.emissiveIntensity = 1.2; s.ball(this.yardGroup, lamp, x, 3.05, tileZ(0) - 1.9, .18); }
    batchScenery(this.yardGroup);
    for (const row of lanes) { const sweeper = sweeperModel(s); sweeper.position.set(tileX(0) - .55, .05, tileZ(row + .5)); this.yardGroup.add(sweeper); sweeper.userData.row = row; this.sweepers.push(sweeper); }
    this.sun.intensity = night ? 1 : 2.6; this.sun.color.set(night ? '#a9c0ff' : '#fff2d8');
    if (night) {
      const sky = mesh(new T.PlaneGeometry(90, 40), new T.MeshBasicMaterial({ color: '#101a33', fog: false }), this.yardGroup, 0, 8, tileZ(0) - 16, false);
      for (let i = 0; i < 40; i++) mesh(new T.PlaneGeometry(.12, .12), new T.MeshBasicMaterial({ color: '#fff7d6', fog: false }), sky, Math.sin(i * 12.9) * 40, Math.cos(i * 7.3) * 16, .1, false);
      mesh(new T.CircleGeometry(1.6, 32), new T.MeshBasicMaterial({ color: '#f6f0c8', fog: false }), sky, 14, 10, .1, false);
    }
  }
  protected update(dt: number, reduced: boolean) {
    const y = this.yard, key = `${y.revision}|${y.level}|${y.config.workshopName}`, t = y.elapsed;
    if (key !== this.stageKey) { this.stageKey = key; this.buildYard(); }
    const s = this.shapes;
    for (const a of this.units.values()) a.seen = false;
    for (const u of y.units) {
      let actor = this.units.get(u.id);
      if (!actor) { const model = unitModel(s, u.kind); this.scene.add(model.root); this.remix.character(model.root, 'machine'); actor = { model, seen: true, death: 0 }; this.units.set(u.id, actor); }
      actor.seen = true; this.pose(actor.model, u, t, dt, reduced);
    }
    for (const [id, actor] of this.units) if (!actor.seen) { actor.model.root.removeFromParent(); this.disposeStage(actor.model.root); this.units.delete(id); }
    for (const a of this.zombies.values()) a.seen = false;
    for (const z of y.zombies) {
      let actor = this.zombies.get(z.id);
      if (!actor) { const model = zombieModel(s, z.kind); this.scene.add(model.root); actor = { model, seen: true, death: 0, last: z }; this.zombies.set(z.id, actor); }
      actor.seen = true; actor.last = { ...z }; this.walk(actor.model, z, t, reduced);
    }
    for (const [id, actor] of this.zombies) if (!actor.seen) {
      // Defeated zombies topple backwards and sink into the lawn.
      actor.death += dt; const root = actor.model.root; root.rotation.z = Math.min(1.45, actor.death * 4); root.position.y = -Math.max(0, actor.death - .5) * 1.4;
      if (actor.death > 1.2 || reduced) { root.removeFromParent(); this.disposeStage(root); this.zombies.delete(id); }
    }
    this.sync(this.blades, y.blades.map(b => b.id), id => { const g = new T.Group(); const blade = sawBlade(s, g, .2, y.blades.find(b => b.id === id)?.frost); blade.userData.spin = true; this.scene.add(g); return g; });
    for (const b of y.blades) { const g = this.blades.get(b.id)!; g.position.set(tileX(b.x), .72, tileZ(b.row + .5) + .1); g.children[0].rotation.z = reduced ? 0 : -t * 22; }
    this.sync(this.drops, y.batteries.map(b => b.id), () => { const g = batteryModel(s); this.scene.add(g); return g; });
    for (const b of y.batteries) {
      const g = this.drops.get(b.id)!, bob = reduced ? 0 : Math.sin(t * 3 + b.id) * .08;
      g.position.set(tileX(b.x), .45 + b.y * 1.4 + bob, tileZ(b.row + .5) + .2); g.rotation.y = reduced ? 0 : t * 1.5 + b.id;
      g.visible = b.age < 7 || Math.floor(t * 8) % 2 === 0;
    }
    for (const sweeper of this.sweepers) {
      const state = y.sweepers.find(w => w.row === sweeper.userData.row);
      sweeper.visible = state?.state !== 'used'; if (!state) continue;
      sweeper.position.x = state.state === 'running' ? tileX(state.x) : tileX(0) - .55; (sweeper.userData.blade as T.Group).rotation.z = reduced ? 0 : -t * (state.state === 'running' ? 30 : 3);
    }
    this.origin.set(0, 1, 0); this.followLight(0, 0);
  }
  private sync(map: Map<number, T.Group>, ids: number[], create: (id: number) => T.Group) {
    const live = new Set(ids);
    for (const id of ids) if (!map.has(id)) map.set(id, create(id));
    for (const [id, root] of map) if (!live.has(id)) { root.removeFromParent(); this.disposeStage(root); map.delete(id); }
  }
  private pose(model: UnitModel, u: Defender, t: number, dt: number, reduced: boolean) {
    const root = model.root; root.position.set(tileX(u.col + .5), .08, tileZ(u.row + .5)); root.scale.setScalar(1.18);
    const recoil = u.flash > 0 && !reduced ? -u.flash * .9 : 0; model.body.position.x = recoil;
    const hurt = u.hp < u.maxHp * .35; model.body.rotation.z = u.kind === 'wall' && hurt ? -.06 : 0;
    if (u.kind === 'wall') model.body.scale.set(1, u.hp < u.maxHp * .66 ? .92 : 1, 1);
    for (const blade of model.blades) {
      if (u.kind === 'chainsaw') { blade.position.x = reduced || u.busy > 0 ? 0 : (t * 3) % .085; continue; }
      blade.rotation.z -= reduced ? 0 : dt * (u.flash > 0 ? 40 : 14);
    }
    if (u.kind === 'chainsaw') model.body.rotation.z = u.busy > 0 ? Math.min(.35, u.busy * .05) : 0;
    if (u.kind === 'mine') { model.body.position.y = u.armed < 1 ? -.32 * (1 - u.armed) : 0; for (const light of model.lights) light.emissiveIntensity = u.armed >= 1 ? (Math.floor(t * 4) % 2 ? 1.6 : .2) : .1; }
    if (u.kind === 'charger') for (const [i, light] of model.lights.entries()) light.emissiveIntensity = reduced ? .8 : .4 + Math.max(0, Math.sin(t * 4 - i)) * .9 + (u.timer < 1 ? 1 : 0);
  }
  private walk(model: ZombieModel, z: Zombie, t: number, reduced: boolean) {
    model.root.position.set(tileX(z.x), .08, tileZ(z.row + .5) - .05); model.root.rotation.z = 0; model.root.scale.setScalar(1.22);
    const pace = (z.kind === 'runner' ? 9 : 5) * (z.slowed > 0 ? .5 : 1), phase = t * pace + z.id;
    model.legs.forEach((leg, i) => { leg.rotation.z = reduced || z.eating ? 0 : Math.sin(phase + i * Math.PI) * .5; });
    model.arms.forEach((arm, i) => { arm.rotation.z = reduced ? 0 : z.eating ? -.3 + Math.sin(t * 14 + i) * .35 : Math.sin(phase * .5 + i) * .12; });
    model.head.rotation.x = reduced ? 0 : Math.sin(phase * .5) * .12; model.head.position.x = z.eating && !reduced ? -.02 - Math.max(0, Math.sin(t * 14)) * .08 : -.02;
    model.body.rotation.z = reduced ? 0 : z.eating ? .12 : Math.sin(phase) * .05;
    if (model.hat) model.hat.visible = z.hp > ZOMBIE_ARMOR;
    for (const m of model.flash) { m.emissive.set(z.flash > 0 ? '#ffffff' : z.slowed > 0 ? '#2fa8ff' : '#000000'); m.emissiveIntensity = z.flash > 0 ? .7 : z.slowed > 0 ? .35 : 0; }
  }
  /** Ghost preview of the selected tool on the hovered tile, tinted by validity. */
  preview(kind: UnitKind | 'shovel' | null, row: number, col: number, valid: boolean) {
    const show = kind !== null && row >= 0;
    this.marker.visible = show; if (!show) { this.ghost.visible = false; return; }
    this.marker.position.set(tileX(col + .5), .11, tileZ(row + .5)); (this.marker.material as T.MeshBasicMaterial).color.set(valid ? '#ffffff' : '#ff5a4a');
    if (kind === 'shovel') { this.ghost.visible = false; return; }
    if (this.ghostKind !== kind) {
      this.disposeStage(this.ghost); this.ghost.clear(); this.ghostKind = kind!;
      const model = unitModel(this.shapes, kind!); this.ghost.add(model.root);
      model.root.traverse(o => { if (o instanceof T.Mesh) { const m = (o.material as T.MeshStandardMaterial).clone(); m.transparent = true; m.opacity = .55; m.depthWrite = false; o.material = m; o.castShadow = false; } });
    }
    this.ghost.visible = valid; this.ghost.position.set(tileX(col + .5), .08, tileZ(row + .5));
  }
  private shot: string | null = null; private shotKey = '';
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[] = []) {
    this.run.sync(); super.render(dt, held, reduced, cues);
    const phase = this.yard.phase, key = `${this.yard.revision}|${phase}`;
    if ((phase === 'cleared' || phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/jpeg', .84); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }
  feedback(cues: YardCue[]): ArcadeCue[] {
    return cues.filter(c => c.text || c.kind === 'boom' || c.kind === 'kill').slice(-5).map(c => ({ kind: c.kind === 'kill' ? 'score' : c.kind === 'breach' ? 'lose' : c.kind === 'clear' ? 'clear' : c.kind === 'boom' ? 'perfect' : 'hit', x: c.x, y: c.row, text: c.text }));
  }
  /** Screen position (0..1) of a lane point, for DOM tap targets. */
  point(x: number, row: number, height = 0) { const p = new T.Vector3(tileX(x), height, tileZ(row)).project(this.camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; }
  cell(row: number, col: number) {
    const corners = [[col, row], [col + 1, row], [col + 1, row + 1], [col, row + 1]].map(([x, z]) => this.point(x, z)), left = Math.min(...corners.map(p => p.x)), top = Math.min(...corners.map(p => p.y)), w = Math.max(...corners.map(p => p.x)) - left, h = Math.max(...corners.map(p => p.y)) - top;
    return { left: `${left * 100}%`, top: `${top * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, clipPath: `polygon(${corners.map(p => `${(p.x - left) / w * 100}% ${(p.y - top) / h * 100}%`).join(',')})` };
  }
  batteryPoint(id: number) { const b = this.yard.batteries.find(d => d.id === id); return b ? this.point(b.x, b.row + .5, .45 + b.y * 1.4) : null; }
  /** Card art rendered from the actual 3D tools, so cards always match the battlefield. */
  icon(kind: UnitKind): string {
    if (this.iconCache[kind]) return this.iconCache[kind]!;
    const size = 128, target = new T.WebGLRenderTarget(size, size, { colorSpace: T.SRGBColorSpace }), scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, .1, 20);
    scene.add(new T.HemisphereLight('#ffffff', '#6b7c8f', 2.2)); const key = new T.DirectionalLight('#ffffff', 2.4); key.position.set(-2, 4, 5); scene.add(key);
    const model = unitModel(this.shapes, kind); scene.add(model.root); model.root.rotation.y = -.35;
    camera.position.set(.2, 1.5, 3.1); camera.lookAt(0, .5, 0);
    const previous = this.renderer.getRenderTarget(), color = this.renderer.getClearColor(new T.Color()), alpha = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(target); this.renderer.setClearColor('#000000', 0); this.renderer.clear(); this.renderer.render(scene, camera);
    const pixels = new Uint8Array(size * size * 4); this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    this.renderer.setRenderTarget(previous); this.renderer.setClearColor(color, alpha);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size);
    for (let row = 0; row < size; row++) image.data.set(pixels.subarray((size - 1 - row) * size * 4, (size - row) * size * 4), row * size * 4);
    ctx.putImageData(image, 0, 0); this.iconCache[kind] = canvas.toDataURL('image/png');
    this.disposeStage(model.root); target.dispose(); return this.iconCache[kind]!;
  }
}
const ZOMBIE_ARMOR = 190;
/** Painted grass: two-tone lawn with short blade strokes; colors come from the tile material. */
function turf(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#62bf3f'; ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 220; i++) { const x = (i * 37) % 64, y = (i * 23 + (i % 7) * 5) % 64; ctx.fillStyle = i % 3 ? '#4fa833' : '#7fd456'; ctx.fillRect(x, y, 1, 2 + (i % 3)); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; return t;
}
function soil(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b88a57'; ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 160; i++) { ctx.fillStyle = i % 2 ? '#a3774a' : '#c99a64'; ctx.fillRect((i * 29) % 64, (i * 17) % 64, 2 + (i % 2), 2); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; return t;
}
