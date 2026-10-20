import * as T from 'three';
import { World, material, mesh, type Shapes } from '../three-kit/world';
import { SlingersRun, SLING, pieceOf, type PieceKind } from './run';
import type { BladeKind } from './levels';
import type { Body } from './physics2d';

const BLADE_COLOR: Record<BladeKind, string> = { saw: '#e5392f', split: '#2f8fe5', turbo: '#ffc928', bomb: '#26282e' };
const MATERIAL_COLOR: Record<string, string> = { wood: '#d79a55', glass: '#a8e6ff', steel: '#9aa6b2', tnt: '#d8392b', robot: '#8fd34a', helmet: '#8fd34a', boss: '#7cc23c' };
function canvasMap(size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d')!, size);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
const textures = () => ({
  wood: canvasMap(64, (ctx, s) => { ctx.fillStyle = '#d99c57'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#c4843f' : '#e8b06b'; ctx.fillRect(0, i * 7 + 2, s, 2); } ctx.strokeStyle = '#8a5524'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, s - 4, s - 4); }),
  steel: canvasMap(64, (ctx, s) => { ctx.fillStyle = '#9aa6b2'; ctx.fillRect(0, 0, s, s); ctx.strokeStyle = '#5f6a76'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, s - 4, s - 4); ctx.fillStyle = '#6d7884'; for (const [x, y] of [[9, 9], [55, 9], [9, 55], [55, 55]]) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); } }),
  tnt: canvasMap(64, (ctx, s) => { ctx.fillStyle = '#d8392b'; ctx.fillRect(0, 0, s, s); ctx.strokeStyle = '#7d1a12'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, s - 6, s - 6); ctx.fillStyle = '#fff'; ctx.font = '900 17px Arial'; ctx.textAlign = 'center'; ctx.fillText('BOOM', s / 2, s / 2 + 6); }),
  dirt: canvasMap(64, (ctx, s) => { ctx.fillStyle = '#6f4426'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 70; i++) { ctx.fillStyle = i % 3 ? '#5c371e' : '#865334'; ctx.beginPath(); ctx.ellipse((i * 37) % s, (i * 23) % s, 3 + i % 3, 2, 0, 0, Math.PI * 2); ctx.fill(); } }),
  pebbles: canvasMap(64, (ctx, s) => { ctx.fillStyle = '#1d2c63'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 60; i++) { ctx.fillStyle = i % 2 ? '#26397c' : '#16224f'; ctx.beginPath(); ctx.ellipse((i * 41) % s, (i * 29) % s, 4, 3, i, 0, Math.PI * 2); ctx.fill(); } }),
});

/** Saw disc in the XY plane (facing the camera), spun around z. */
function bladeModel(s: Shapes, parent: T.Object3D, kind: BladeKind, r: number): T.Group {
  const g = new T.Group(); parent.add(g);
  const steel = material('#e9eef2', .25, .8), disc = mesh(new T.CylinderGeometry(r * .82, r * .82, .12, 28), steel, g); disc.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, tooth = s.cube(g, steel, Math.cos(a) * r * .85, Math.sin(a) * r * .85, 0, r * .36, r * .24, .12, false); tooth.rotation.z = a + .55; }
  const hub = mesh(new T.CylinderGeometry(r * .5, r * .5, .16, 20), material(BLADE_COLOR[kind], .4, .2), g); hub.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) s.ball(g, material('#ffffff'), side * r * .18, r * .08, .1, r * .12, false);
  for (const side of [-1, 1]) s.ball(g, material('#111111'), side * r * .18, r * .06, .14, r * .06, false);
  if (kind === 'bomb') { s.tube(g, material('#5a4a3a'), r * .2, r * .62, 0, .03, .25); s.ball(g, material('#ffcf5a'), r * .25, r * .8, 0, .06, false); }
  return g;
}
function robotModel(s: Shapes, parent: T.Object3D, kind: PieceKind, size: number): T.Group {
  const g = new T.Group(); parent.add(g); const green = material(MATERIAL_COLOR[kind], .6), dark = material('#21402a', .5), glow = material('#ffe14a', .3); glow.emissive.set('#ffd23a'); glow.emissiveIntensity = .8;
  s.cube(g, green, 0, 0, 0, size, size * .95, size * .9);
  s.cube(g, dark, 0, size * .12, size * .46, size * .74, size * .3, .04);
  for (const side of [-1, 1]) s.ball(g, glow, side * size * .2, size * .12, size * .48, size * .09, false);
  s.cube(g, material('#5b7f2d'), 0, -size * .22, size * .46, size * .3, size * .06, .03, false);
  s.tube(g, dark, size * .2, size * .62, 0, .03, size * .3); s.ball(g, material('#ff5a4a'), size * .2, size * .78, 0, .06, false);
  if (kind === 'helmet') { s.cube(g, material('#aab6c2', .3, .7), 0, size * .48, 0, size * 1.05, size * .2, size * 1); s.cube(g, material('#aab6c2', .3, .7), 0, size * .38, size * .5, size * 1.05, size * .08, .05); }
  if (kind === 'boss') for (let i = 0; i < 5; i++) { const spike = mesh(new T.ConeGeometry(size * .08, size * .3, 4), material('#ffcf3a', .3, .7), g, (i - 2) * size * .18, size * .62, 0); spike.castShadow = false; }
  return g;
}

export class SlingersView extends World<SlingersRun> {
  private tex = textures(); private stageGroup = new T.Group(); private actors = new Map<number, T.Group>(); private sling = new T.Group(); private bands: T.Mesh[] = [];
  private rack = new T.Group(); private pocket = new T.Group(); private dots: T.InstancedMesh; private chunks: { mesh: T.Mesh; vx: number; vy: number; spin: number; age: number }[] = [];
  private seen = new Map<number, { x: number; y: number; kind: PieceKind }>(); private built = -1; private rackKey = '';
  private frame = { x: 8, y: 4, half: 7 }; private aspect = 1.6; private ray = new T.Raycaster();
  constructor(canvas: HTMLCanvasElement, run: SlingersRun) {
    super(canvas, run, '#bfe6f7', 15);
    this.camera = new T.OrthographicCamera(-10, 10, 6, -6, .1, 200); this.renderer.toneMapping = T.NoToneMapping; this.scene.fog = null; this.sun.intensity = 2.3;
    this.scene.add(this.stageGroup, this.sling, this.rack, this.pocket);
    this.dots = new T.InstancedMesh(new T.CircleGeometry(.07, 10), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9 }), 140); this.dots.frustumCulled = false; this.dots.count = 0; this.scene.add(this.dots);
    this.buildSling();
  }
  resize(width: number, height: number, pixelRatio: number): void { super.resize(width, height, pixelRatio); this.aspect = width / Math.max(1, height); }
  private buildSling() {
    const s = this.shapes, wood = material('#8a5a2b', .8), dark = material('#5c3a1b', .8);
    s.cube(this.sling, wood, SLING.x, 1.4, -.05, .34, 2, .3);
    for (const [side, z] of [[-1, -.3], [1, .3]] as const) { const prong = s.cube(this.sling, side < 0 ? dark : wood, SLING.x + side * .28, 2.65, z, .2, .9, .2); prong.rotation.z = -side * .32; }
    for (let i = 0; i < 2; i++) { const band = mesh(new T.BoxGeometry(1, .09, .06), material('#5a1f12', .7), this.scene, 0, 0, i ? .32 : -.32, false); this.bands.push(band); }
  }
  private buildStage() {
    this.disposeStage(this.stageGroup); this.stageGroup.clear(); const s = this.shapes, run = this.run, end = run.structureEnd + 30;
    const dirt = material('#ffffff', .95); dirt.map = this.tex.dirt; this.tex.dirt.repeat.set(30, 2);
    const pebbles = material('#ffffff', .95); pebbles.map = this.tex.pebbles; this.tex.pebbles.repeat.set(40, 2);
    s.cube(this.stageGroup, dirt, end / 2 - 20, -1.1, 0, end + 40, 2.2, 3, false); s.cube(this.stageGroup, pebbles, end / 2 - 20, -3.2, 0, end + 40, 2.2, 3.2, false);
    const grass = material('#5fbf3a', .8), grassDark = material('#3f9a2a', .8);
    s.cube(this.stageGroup, grass, end / 2 - 20, -.06, .1, end + 40, .16, 3.2, false);
    for (let i = 0; i < 160; i++) { const tuft = mesh(new T.ConeGeometry(.08, .32 + (i % 3) * .1, 4), i % 2 ? grass : grassDark, this.stageGroup, -20 + i * .45 + Math.sin(i) * .1, .1, 1.55, false); tuft.rotation.z = Math.sin(i * 3) * .3; }
    // Slingshot mound and the hills the structures stand on.
    for (const h of [{ x: -1.2, w: 4, h: .9 }, ...run.stage.hills]) { s.cube(this.stageGroup, dirt, h.x, h.h / 2, 0, h.w, h.h, 3, false); s.cube(this.stageGroup, grass, h.x, h.h - .06, .1, h.w + .06, .14, 3.2, false); }
    // Backdrop: cloud band and layered hills, like a sunny cartoon quarry.
    const cloud = new T.MeshBasicMaterial({ color: '#ffffff', fog: false }), farHill = new T.MeshBasicMaterial({ color: '#8fc9a8', fog: false }), midHill = new T.MeshBasicMaterial({ color: '#6fb86a', fog: false });
    for (let i = 0; i < 26; i++) { const puff = mesh(new T.CircleGeometry(1.1 + (i % 4) * .45, 32), cloud, this.stageGroup, -16 + i * 3.6 + Math.sin(i * 2.3), 6.4 + Math.sin(i * 1.7) * .9 + (i % 3) * .5, -45, false); puff.scale.y = .62; }
    for (let i = 0; i < 9; i++) mesh(new T.CircleGeometry(8 + (i % 3) * 2.5, 72), farHill, this.stageGroup, -16 + i * 8, -6.4 - (i % 2), -40, false);
    for (let i = 0; i < 12; i++) mesh(new T.CircleGeometry(5 + (i % 3) * 2, 64), midHill, this.stageGroup, -14 + i * 6.5, -5.2, -25, false);
  }
  private actor(b: Body): T.Group {
    const s = this.shapes, p = pieceOf(b), root = new T.Group(); this.scene.add(root);
    if (p.kind === 'blade') bladeModel(s, root, p.blade!, b.r);
    else if (p.kind === 'robot' || p.kind === 'helmet' || p.kind === 'boss') robotModel(s, root, p.kind, b.w);
    else {
      const m = p.kind === 'glass' ? new T.MeshStandardMaterial({ color: '#b6ecff', roughness: .1, metalness: .1, transparent: true, opacity: .62 }) : material('#ffffff', p.kind === 'steel' ? .4 : .85, p.kind === 'steel' ? .5 : 0);
      if (p.kind === 'wood' || p.kind === 'steel' || p.kind === 'tnt') { const t = this.tex[p.kind].clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(b.w / .9)), Math.max(1, Math.round(b.h / .9))); m.map = t; }
      const block = mesh(new T.BoxGeometry(b.w, b.h, p.kind === 'glass' ? .9 : 1), m, root); block.userData.material = m;
      if (p.kind === 'glass') { const edge = new T.LineSegments(new T.EdgesGeometry(block.geometry), new T.LineBasicMaterial({ color: '#ffffff' })); root.add(edge); }
    }
    return root;
  }
  protected rebuild(): void { for (const g of this.actors.values()) { g.removeFromParent(); this.disposeStage(g); } this.actors.clear(); this.seen.clear(); this.built = -1; this.rackKey = ''; }
  protected update(dt: number, reduced: boolean): void {
    const run = this.run;
    if (this.built !== run.revision) { this.built = run.revision; this.buildStage(); }
    const live = new Set<number>();
    for (const b of run.world.bodies) {
      const p = pieceOf(b); if (p.kind === 'ground') continue; live.add(b.id);
      let root = this.actors.get(b.id); if (!root) { root = this.actor(b); this.actors.set(b.id, root); }
      root.position.set(b.x, b.y, 0); root.rotation.z = b.angle;
      if (p.kind === 'blade') root.children[0].rotation.z = reduced ? 0 : root.children[0].rotation.z - dt * 18;
      else { const block = root.children[0] as T.Mesh, m = block.userData.material as T.MeshStandardMaterial | undefined; if (m && p.hp < p.maxHp * .5) m.color.set(p.kind === 'glass' ? '#d6f3ff' : '#b9b0a4'); }
      this.seen.set(b.id, { x: b.x, y: b.y, kind: p.kind });
    }
    for (const [id, root] of this.actors) if (!live.has(id)) {
      // Broken pieces burst into chunks of their own material.
      const last = this.seen.get(id); root.removeFromParent(); this.disposeStage(root); this.actors.delete(id); this.seen.delete(id);
      if (last && last.kind !== 'blade' && !reduced) for (let i = 0; i < 7; i++) {
        const chunk = mesh(new T.BoxGeometry(.18, .14, .14), material(MATERIAL_COLOR[last.kind] ?? '#cccccc', .7), this.scene, last.x, last.y, .3, false);
        this.chunks.push({ mesh: chunk, vx: Math.cos(i * .9 + id) * 4, vy: 3 + (i % 3) * 1.5, spin: (i - 3) * 4, age: 0 });
      }
    }
    for (const c of this.chunks) { c.age += dt; c.vy -= 14 * dt; c.mesh.position.x += c.vx * dt; c.mesh.position.y += c.vy * dt; c.mesh.rotation.z += c.spin * dt; c.mesh.scale.setScalar(Math.max(0, 1 - c.age / 1.1)); }
    for (const c of this.chunks.filter(c => c.age > 1.1)) { c.mesh.removeFromParent(); c.mesh.geometry.dispose(); (c.mesh.material as T.Material).dispose(); }
    this.chunks = this.chunks.filter(c => c.age <= 1.1);
    // Sling pocket and rubber bands follow the pull.
    const loaded = run.loaded, power = run.aimPower, pull = loaded ? { x: -Math.cos(run.aimAngle) * power * 1.5, y: -Math.sin(run.aimAngle) * power * 1.5 } : { x: 0, y: 0 };
    const pocket = { x: SLING.x + pull.x, y: SLING.y + pull.y };
    const key = `${run.revision}|${run.queue.join(',')}|${run.state}`;
    if (key !== this.rackKey) {
      this.rackKey = key; this.disposeStage(this.rack); this.rack.clear(); this.disposeStage(this.pocket); this.pocket.clear();
      run.queue.slice(loaded ? 1 : 0).forEach((kind, i) => { const g = bladeModel(this.shapes, this.rack, kind, .3); g.position.set(-1.2 - i * .75, 1.2, .2); });
      if (loaded) bladeModel(this.shapes, this.pocket, loaded, .32);
    }
    this.pocket.position.set(pocket.x, pocket.y, .1); this.pocket.visible = Boolean(loaded);
    for (const [i, band] of this.bands.entries()) {
      const fx = SLING.x + (i ? .38 : -.38), fy = 2.95, tx = loaded ? pocket.x : SLING.x, ty = loaded ? pocket.y : SLING.y + .25, len = Math.hypot(tx - fx, ty - fy);
      band.position.set((fx + tx) / 2, (fy + ty) / 2, i ? .32 : -.32); band.scale.x = Math.max(.05, len); band.rotation.z = Math.atan2(ty - fy, tx - fx);
    }
    // Dotted paths: the last shot, and the live preview when the guide is on.
    const points = [...run.lastPath, ...run.path, ...(loaded && run.config.assist ? run.preview() : [])].slice(-140);
    this.dots.count = points.length; points.forEach((p, i) => { this.scratch.position.set(p.x, p.y, .5); this.scratch.rotation.set(0, 0, 0); this.scratch.scale.setScalar(i >= points.length - (loaded && run.config.assist ? run.preview().length : 0) ? .8 : 1); this.scratch.updateMatrix(); this.dots.setMatrixAt(i, this.scratch.matrix); }); this.dots.instanceMatrix.needsUpdate = true;
    // Camera: frame the whole quarry while aiming; follow the blade in flight.
    const end = run.structureEnd + 2, top = Math.max(7, ...run.stage.blocks.map(b => b.y + b.h), ...run.stage.robots.map(r => r.y + 2));
    const wide = { x: (end - 5) / 2, y: top / 2 - .2, half: Math.max((end + 5) / 2 / this.aspect, top / 2 + 1.2) };
    const lead = run.flying[0], target = run.state === 'flight' && lead ? { x: Math.max(wide.x, Math.min(lead.x + 2, end - wide.half * this.aspect + 2)), y: Math.max(wide.y, lead.y - wide.half * .4), half: wide.half } : wide;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3); this.frame.x += (target.x - this.frame.x) * k; this.frame.y += (target.y - this.frame.y) * k; this.frame.half += (target.half - this.frame.half) * k;
    const cam = this.camera as T.OrthographicCamera; cam.left = -this.frame.half * this.aspect; cam.right = this.frame.half * this.aspect; cam.top = this.frame.half; cam.bottom = -this.frame.half; cam.updateProjectionMatrix();
    cam.position.set(this.frame.x, this.frame.y, 40); cam.lookAt(this.frame.x, this.frame.y, 0);
    this.origin.set(lead?.x ?? SLING.x, lead?.y ?? SLING.y, 0); this.sun.position.set(this.frame.x - 10, 30, 20); this.sun.target.position.set(this.frame.x, 0, 0);
  }
  /** Normalised screen point to world meters, so dragging works anywhere on the playfield. */
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number): void {
    this.ray.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), this.camera); const p = this.ray.ray.origin;
    this.run.pointer(phase, p.x, p.y);
  }
}
