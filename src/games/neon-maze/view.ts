import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { ArcadeCue } from '../premium-kit/core';
import type { WorldView } from '../three-kit/types';
import { NeonMazeRun, type Sentinel } from './run';
import { isOpen, type Dir } from './grid';
import { GRIDS, WALL_COLORS } from './worlds';
import { SentinelModel } from './models';

/**
 * NEON MAZE in 3D: dark glass walls with glowing neon edges, bloom, a camera that rides behind the runner,
 * sentinels from the Unity pack and a burst of light for every catch. Tiles are 1 unit; tile (x, y) sits at (x, 0, y).
 */
const WALL_H = .55, FROZEN = new T.Color('#2340ff'), FLASH = new T.Color('#ffffff');
interface Spark { p: T.Vector3; v: T.Vector3; age: number; life: number; color: T.Color; size: number }
interface Float { sprite: T.Sprite; age: number; y: number }

function gridTexture(floor: string, line: string, kind: string): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = floor; g.fillRect(0, 0, 128, 128);
  if (kind === 'matrix') { g.fillStyle = line; g.font = '20px monospace'; for (let i = 0; i < 18; i++) g.fillText(String.fromCharCode(0x30a0 + (i * 37) % 96), (i * 29) % 120, (i * 53) % 128); }
  else if (kind === 'ocean') { g.strokeStyle = line; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); for (let x = 0; x <= 128; x += 8) g.lineTo(x, i * 22 + Math.sin(x / 14 + i) * 6); g.stroke(); } }
  else { g.strokeStyle = line; g.lineWidth = kind === 'arcade' ? 1 : 2; g.strokeRect(1, 1, 126, 126); if (kind === 'classic' || kind === 'sunset') { g.globalAlpha = .45; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke(); g.globalAlpha = 1; } }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
function glowTexture(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
function textSprite(text: string, color: string): T.Sprite {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d')!;
  g.font = '900 64px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(text, 128, 50); g.fillStyle = color; g.fillText(text, 128, 50);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(2, .75, 1); s.renderOrder = 20; return s;
}

export class NeonMazeView implements WorldView {
  readonly renderer: T.WebGLRenderer; readonly scene = new T.Scene(); readonly camera = new T.PerspectiveCamera(46, 1, .1, 200);
  private composer: EffectComposer; private bloom: UnrealBloomPass;
  private level = new T.Group(); private revision = -1; private style = ''; private time = 0; private shot: string | null = null; private shotKey = '';
  private wallMat = new T.MeshLambertMaterial(); private edgeMat = new T.MeshBasicMaterial(); private baseMat = new T.MeshBasicMaterial({ transparent: true, opacity: .22 });
  private floorMat = new T.MeshBasicMaterial(); private dotMat = new T.MeshBasicMaterial(); private gemMat = new T.MeshBasicMaterial({ color: '#ffb43d' });
  private dots: T.InstancedMesh | null = null; private gems: T.Mesh[] = []; private halos: T.Sprite[] = []; private exitRing: T.Mesh | null = null; private exitBeam: T.Mesh | null = null; private prism: T.Mesh;
  private glow = glowTexture(); private runner = new T.Group(); private runnerKind = ''; private runnerGlow: T.Sprite; private ufo: SentinelModel | null = null; private jaws: T.Mesh[] = [];
  private sentinels = new Map<number, SentinelModel>(); private trail: T.Mesh; private trailPoints: T.Vector3[] = [];
  private sparks: Spark[] = []; private sparkMesh: T.InstancedMesh; private floats: Float[] = []; private dark: T.Mesh; private snow: T.Points;
  private look = new T.Vector3(); private camPos = new T.Vector3(); private scratch = new T.Object3D(); private press: { id: number; x: number; y: number; ax: number; ay: number; t: number; turned: boolean } | null = null;
  width = 1; height = 1;
  constructor(readonly canvas: HTMLCanvasElement, readonly run: NeonMazeRun) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.NoToneMapping;
    this.scene.add(new T.HemisphereLight('#8aa0ff', '#100820', 1.6)); const key = new T.DirectionalLight('#ffffff', 1.2); key.position.set(-4, 10, 6); this.scene.add(key);
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(256, 256), .8, .35, .66); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.scene.add(this.level);
    this.runnerGlow = new T.Sprite(new T.SpriteMaterial({ map: this.glow, color: '#ffffff', transparent: true, blending: T.AdditiveBlending, depthWrite: false })); this.runnerGlow.scale.setScalar(1.6);
    this.scene.add(this.runner);
    this.prism = new T.Mesh(new T.IcosahedronGeometry(.3, 0), new T.MeshBasicMaterial({ color: '#ffffff', wireframe: false })); this.scene.add(this.prism);
    const prismColors = new Float32Array(this.prism.geometry.attributes.position.count * 3); for (let i = 0; i < prismColors.length / 3; i++) new T.Color().setHSL((i * .07) % 1, 1, .6).toArray(prismColors, i * 3);
    this.prism.geometry.setAttribute('color', new T.BufferAttribute(prismColors, 3)); (this.prism.material as T.MeshBasicMaterial).vertexColors = true;
    this.trail = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); this.trail.frustumCulled = false; this.scene.add(this.trail);
    this.sparkMesh = new T.InstancedMesh(new T.OctahedronGeometry(.06, 0), new T.MeshBasicMaterial({ toneMapped: false }), 320); this.sparkMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.sparkMesh.count = 0; this.sparkMesh.frustumCulled = false; this.scene.add(this.sparkMesh);
    // Darkness: a sheet over the maze with a soft hole of light around the runner.
    this.dark = new T.Mesh(new T.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false,
      uniforms: { center: { value: new T.Vector2() }, radius: { value: 3 }, flash: { value: 0 }, color: { value: new T.Color('#000') } },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec2 center; uniform float radius; uniform float flash; uniform vec3 color; varying vec3 vWorld; void main(){ float d = distance(vWorld.xz, center); float a = smoothstep(radius * .55, radius * 1.15, d) * .94 * (1. - flash); gl_FragColor = vec4(color, a); }' }));
    this.dark.position.y = WALL_H + .35; this.dark.renderOrder = 10; this.scene.add(this.dark);
    const flakes = new Float32Array(600 * 3); for (let i = 0; i < 600; i++) flakes.set([(i * 0.618) % 1 * 40, (i * 0.37) % 1 * 6, (i * 0.414) % 1 * 40], i * 3);
    this.snow = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(flakes, 3)), new T.PointsMaterial({ size: .07, color: '#e8f4ff', transparent: true, opacity: .8 })); this.scene.add(this.snow);
  }
  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width; this.height = height; const dpr = Math.min(pixelRatio, 1.5);
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(width, height, false); this.composer.setPixelRatio(dpr); this.composer.setSize(width, height);
    this.bloom.resolution.set(width / 2, height / 2); this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix();
  }
  /** Swipe to steer (several turns in one drag), tap to dash. */
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId: number): void {
    if (phase === 'down') { this.press = { id: pointerId, x, y, ax: x, ay: y, t: performance.now(), turned: false }; return; }
    const p = this.press; if (!p || p.id !== pointerId) return;
    if (phase === 'move' || phase === 'up') {
      const dx = (x - p.ax) * this.width, dy = (y - p.ay) * this.height;
      if (Math.hypot(dx, dy) > 26) { const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); this.run.steer(dir); p.ax = x; p.ay = y; p.turned = true; }
    }
    if (phase === 'up' && !p.turned && performance.now() - p.t < 350) this.run.phaseDash();
    if (phase === 'up' || phase === 'cancel') this.press = null;
  }

  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    const run = this.run, step = held ? 0 : dt; this.time += step;
    const style = GRIDS[run.config.worldTheme ?? 'classic'] ? run.config.worldTheme ?? 'classic' : 'classic', theme = GRIDS[style];
    if (this.revision !== run.revision) { this.revision = run.revision; this.build(); this.style = ''; this.trailPoints = []; this.sparks = []; }
    if (this.style !== style) { this.style = style; this.applyStyle(style); }
    const edge = run.config.wallColor && WALL_COLORS[run.config.wallColor] ? WALL_COLORS[run.config.wallColor] : theme.edge;
    this.edgeMat.color.set(edge); this.baseMat.color.set(edge);
    // Static: the neon flickers out for a moment.
    const flicker = run.signal.flicker && !reduced && Math.sin(this.time * 23) * Math.sin(this.time * 7.3) > .55; this.edgeMat.opacity = flicker ? .08 : 1; this.edgeMat.transparent = flicker;
    for (const cue of cues) this.onCue(cue, reduced);
    this.updateRunner(step, reduced, edge); this.updateSentinels(step, reduced, theme.hunters); this.updatePickups(step, reduced, edge); this.updateEffects(step);
    // Camera rides above and behind, leaning toward where you are heading.
    const p = run.position, d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[run.runner.dir], portrait = this.camera.aspect < 1;
    const target = new T.Vector3(p.x + d[0] * 1.2, 0, p.y + d[1] * 1.2 - .4), height = portrait ? 13.5 : 10.5, back = portrait ? 7 : 6.2;
    const ease = held ? 0 : Math.min(1, dt * 4); if (this.look.lengthSq() === 0) { this.look.copy(target); this.camPos.set(target.x, height, target.z + back); }
    this.look.lerp(target, ease); this.camPos.lerp(new T.Vector3(target.x, height, target.z + back), ease);
    const shake = !reduced && run.elapsed - run.hitAt < .4 ? Math.sin(this.time * 80) * .15 : 0;
    this.camera.position.copy(this.camPos).add(new T.Vector3(shake, 0, 0)); this.camera.lookAt(this.look);
    // Darkness for dark sectors, blackouts and storms (lightning flashes it away).
    const sight = run.signal.sight ?? (run.sector?.dark ? 3.6 : null), darkOn = run.dark && sight !== null;
    this.dark.visible = darkOn; if (darkOn) { const u = (this.dark.material as T.ShaderMaterial).uniforms; u.center.value.set(p.x, p.y); u.radius.value = sight!; u.flash.value = run.flash > 0 ? 1 : 0; u.color.value.set(theme.fog); }
    this.snow.visible = (run.config.weather ?? 'clear') === 'snow' && !reduced;
    if (this.snow.visible) { const pos = this.snow.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) - step * 1.2; if (y < 0) y += 6; pos.setY(i, y); } pos.needsUpdate = true; this.snow.position.set(p.x - 20, 0, p.y - 20); }
    this.bloom.strength = .75 + Math.min(.45, (run.flow - 1) * .06) + (run.stun > 0 ? .12 : 0);
    this.composer.render();
    const key = `${run.revision}|${run.phase}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/jpeg', .85); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }

  private build() {
    this.level.traverse(o => { if (o instanceof T.Mesh && o.userData.owned) o.geometry.dispose(); }); this.level.clear();
    for (const m of this.sentinels.values()) m.dispose(); this.sentinels.clear(); this.gems = []; this.halos = [];
    const g = this.run.grid, own = <M extends T.Object3D>(o: M) => { o.userData.owned = true; this.level.add(o); return o; };
    // Floor reaching past the maze, wall blocks and the neon edges along every corridor.
    const floor = own(new T.Mesh(new T.PlaneGeometry(g.w + 40, g.h + 40).rotateX(-Math.PI / 2), this.floorMat)); floor.position.set(g.w / 2 - .5, -.01, g.h / 2 - .5);
    const walls: [number, number][] = []; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (!g.open[y][x]) walls.push([x, y]);
    const block = new T.InstancedMesh(new T.BoxGeometry(1, WALL_H, 1), this.wallMat, walls.length); walls.forEach(([x, y], i) => { this.scratch.position.set(x, WALL_H / 2, y); this.scratch.rotation.set(0, 0, 0); this.scratch.scale.setScalar(1); this.scratch.updateMatrix(); block.setMatrixAt(i, this.scratch.matrix); }); own(block);
    const segs: [number, number, number, number][] = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!g.open[y][x]) continue;
      if (!isOpen(g, x, y - 1) && y > 0) segs.push([x - .5, y - .5, x + .5, y - .5]); if (!isOpen(g, x, y + 1) && y < g.h - 1) segs.push([x - .5, y + .5, x + .5, y + .5]);
      if (!isOpen(g, x - 1, y) && x > 0) segs.push([x - .5, y - .5, x - .5, y + .5]); if (!isOpen(g, x + 1, y) && x < g.w - 1) segs.push([x + .5, y - .5, x + .5, y + .5]);
    }
    const tube = new T.BoxGeometry(1, 1, 1), top = new T.InstancedMesh(tube, this.edgeMat, segs.length), base = new T.InstancedMesh(tube.clone(), this.baseMat, segs.length);
    segs.forEach(([x0, y0, x1, y1], i) => {
      const len = Math.hypot(x1 - x0, y1 - y0) + .06, horiz = y0 === y1;
      this.scratch.position.set((x0 + x1) / 2, WALL_H + .015, (y0 + y1) / 2); this.scratch.rotation.set(0, 0, 0); this.scratch.scale.set(horiz ? len : .07, .05, horiz ? .07 : len); this.scratch.updateMatrix(); top.setMatrixAt(i, this.scratch.matrix);
      this.scratch.position.y = .02; this.scratch.scale.set(horiz ? len : .14, .02, horiz ? .14 : len); this.scratch.updateMatrix(); base.setMatrixAt(i, this.scratch.matrix);
    });
    own(top); own(base);
    // Dots, gems, the exit portal.
    const dots: [number, number][] = []; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (this.run.dots[y * g.w + x]) dots.push([x, y]);
    this.dots = new T.InstancedMesh(new T.SphereGeometry(.075, 8, 6), this.dotMat, dots.length); this.dots.userData.tiles = dots;
    dots.forEach(([x, y], i) => { this.scratch.position.set(x, .3, y); this.scratch.scale.setScalar(1); this.scratch.updateMatrix(); this.dots!.setMatrixAt(i, this.scratch.matrix); }); own(this.dots);
    for (const t of g.gems) {
      const gem = own(new T.Mesh(new T.OctahedronGeometry(.27, 0), this.gemMat)); gem.position.set(t.x, .45, t.y); this.gems.push(gem);
      const halo = new T.Sprite(new T.SpriteMaterial({ map: this.glow, color: '#ffb43d', transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false })); halo.position.set(t.x, .45, t.y); halo.scale.setScalar(1.5); halo.renderOrder = 11; this.level.add(halo); this.halos.push(halo);
    }
    this.exitRing = own(new T.Mesh(new T.TorusGeometry(.4, .06, 8, 32).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: '#555' }))); this.exitRing.position.set(g.exit.x, .1, g.exit.y); this.exitRing.userData.ownMaterial = true;
    this.exitBeam = own(new T.Mesh(new T.CylinderGeometry(.38, .38, 3, 20, 1, true), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }))); this.exitBeam.position.set(g.exit.x, 1.5, g.exit.y);
    if (g.portals) for (const t of g.portals) { const ring = own(new T.Mesh(new T.TorusGeometry(.42, .05, 8, 28).rotateY(Math.PI / 2), this.edgeMat)); ring.position.set(t.x, .45, t.y); }
  }
  private applyStyle(style: string) {
    const t = GRIDS[style]; this.scene.background = new T.Color(t.sky[1]); this.scene.fog = new T.Fog(t.fog, 18, 38);
    this.wallMat.color.set(t.wall); this.wallMat.emissive.set(t.wall).multiplyScalar(.25);
    this.floorMat.map?.dispose(); const map = gridTexture(t.floor, t.line, style); const g = this.run.grid; map.repeat.set(g.w + 40, g.h + 40); map.offset.set(.5, .5); this.floorMat.map = map; this.floorMat.needsUpdate = true;
    this.dotMat.color.set(t.dot);
  }
  private onCue(cue: ArcadeCue, reduced: boolean) {
    if (reduced) return;
    const at = new T.Vector3(cue.x, .5, cue.y), n = cue.kind === 'perfect' ? 46 : cue.kind === 'clear' ? 90 : cue.kind === 'hit' ? 18 : cue.kind === 'ability' ? 30 : cue.kind === 'launch' ? 12 : 0;
    const color = cue.kind === 'perfect' || cue.kind === 'clear' ? '#ffb43d' : cue.kind === 'ability' ? '#7df9ff' : cue.kind === 'lose' ? '#ff3d6e' : '#ffffff';
    for (let i = 0; i < n; i++) { const a = i * 2.39996, up = .6 + (i % 5) * .5; this.sparks.push({ p: at.clone(), v: new T.Vector3(Math.cos(a) * (1.5 + i % 4), up * 2, Math.sin(a) * (1.5 + i % 4)), age: 0, life: .6 + (i % 4) * .15, color: new T.Color(color), size: 1 + (i % 3) * .5 }); }
    if (cue.text && /^\+\d/.test(cue.text)) { const s = textSprite(cue.text, '#ffe27a'); s.position.set(cue.x, 1.4, cue.y); this.scene.add(s); this.floats.push({ sprite: s, age: 0, y: 1.4 }); }
    this.sparks = this.sparks.slice(-300);
  }
  private updateRunner(dt: number, reduced: boolean, edge: string) {
    const run = this.run, style = run.config.characterStyle ?? 'original', p = run.position, hop = run.dash ? Math.sin(run.dash.t * Math.PI) * .9 : 0;
    if (style !== this.runnerKind) {
      this.runnerKind = style; for (const c of [...this.runner.children]) { c.removeFromParent(); if (c instanceof T.Mesh) c.geometry.dispose(); } this.ufo?.dispose(); this.ufo = null; this.jaws = [];
      const core = (color: string, r = .3) => new T.Mesh(new T.SphereGeometry(r, 24, 16), new T.MeshBasicMaterial({ color }));
      // Shaped runners are lit like solid toys (with a soft inner glow) so their shapes read under the bloom.
      const solid = (color: string, glow = .3) => new T.MeshLambertMaterial({ color, emissive: new T.Color(color).multiplyScalar(glow), side: T.DoubleSide });
      if (style === 'ufo') { this.ufo = new SentinelModel('ufo', 1); this.ufo.tint('#9fe8ff', .45); this.runner.add(this.ufo.root); }
      else if (style === 'cube') { const m = new T.Mesh(new T.BoxGeometry(.56, .56, .56), solid('#d8f6ff', .25)); const e = new T.LineSegments(new T.EdgesGeometry(m.geometry), new T.LineBasicMaterial({ color: '#00141c' })); m.add(e); for (const x of [-.12, .12]) { const eye = new T.Mesh(new T.BoxGeometry(.08, .12, .02), new T.MeshBasicMaterial({ color: '#00141c' })); eye.position.set(x, .06, .29); m.add(eye); } this.runner.add(m); }
      else if (style === 'chomper') { for (const s of [1, -1]) { const jaw = new T.Mesh(new T.SphereGeometry(.38, 28, 14, 0, Math.PI * 2, s > 0 ? 0 : Math.PI / 2, Math.PI / 2), solid('#ffcf1f', .35)); this.jaws.push(jaw); this.runner.add(jaw); } const eye = new T.Mesh(new T.SphereGeometry(.05, 8, 6), new T.MeshBasicMaterial({ color: '#1a1200' })); eye.position.set(.13, .2, .22); this.jaws[0].add(eye); }
      else this.runner.add(core(style === 'comet' ? '#ffb070' : '#ffffff'));
      this.runner.add(this.runnerGlow);
    }
    this.runner.position.set(p.x, .32 + hop + (reduced ? 0 : Math.sin(this.time * 6) * .03), p.y);
    const yaw = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 }[run.runner.dir];
    if (style === 'cube') { const m = this.runner.children[0]; m.rotation.y = yaw; if (run.runner.moving && !reduced) m.rotation.x += dt * run.runnerSpeed * 2; }
    if (style === 'chomper') { const open = reduced ? .3 : Math.abs(Math.sin(this.time * 14)) * .55; this.jaws[0].rotation.set(-open, yaw, 0, 'YXZ'); this.jaws[1].rotation.set(open, yaw, 0, 'YXZ'); }
    if (this.ufo) { this.ufo.root.rotation.y += dt * 4; this.ufo.root.position.y = -.25; }
    const blink = run.invuln > 0 && !reduced && Math.sin(this.time * 30) > 0;
    this.runner.visible = !blink || run.phase !== 'playing';
    (this.runnerGlow.material as T.SpriteMaterial).color.set(style === 'comet' ? '#ff8a3d' : style === 'chomper' ? '#ffe14d' : edge); this.runnerGlow.scale.setScalar((style === 'original' || style === 'comet' ? 1.4 : .9) + (run.flow - 1) * .1); (this.runnerGlow.material as T.SpriteMaterial).opacity = style === 'original' || style === 'comet' ? 1 : .45;
    // Light trail ribbon.
    const showTrail = run.config.trail !== false && !reduced;
    this.trail.visible = showTrail;
    if (showTrail) {
      const last = this.trailPoints[0]; if (!last || last.distanceTo(this.runner.position) > .12) { this.trailPoints.unshift(new T.Vector3(p.x, .3, p.y)); this.trailPoints.length = Math.min(this.trailPoints.length, style === 'comet' ? 36 : 24); }
      const pos: number[] = [], col: number[] = [], c = new T.Color(style === 'comet' ? '#ff6a1f' : edge);
      for (let i = 0; i < this.trailPoints.length - 1; i++) {
        const a = this.trailPoints[i], b = this.trailPoints[i + 1], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, w0 = .22 * (1 - i / this.trailPoints.length), w1 = .22 * (1 - (i + 1) / this.trailPoints.length), f0 = 1 - i / this.trailPoints.length, f1 = 1 - (i + 1) / this.trailPoints.length;
        if (l > 2) continue;
        pos.push(a.x + nx * w0, a.y, a.z + nz * w0, a.x - nx * w0, a.y, a.z - nz * w0, b.x + nx * w1, b.y, b.z + nz * w1, a.x - nx * w0, a.y, a.z - nz * w0, b.x - nx * w1, b.y, b.z - nz * w1, b.x + nx * w1, b.y, b.z + nz * w1);
        for (const f of [f0, f0, f1, f0, f1, f1]) col.push(c.r * f, c.g * f, c.b * f);
      }
      this.trail.geometry.dispose(); this.trail.geometry = new T.BufferGeometry(); this.trail.geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); this.trail.geometry.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    }
  }
  private updateSentinels(dt: number, reduced: boolean, hunters: readonly string[]) {
    const run = this.run, p = run.position, ending = run.stun > 0 && run.stun < 2 && Math.sin(this.time * 18) > 0;
    for (const s of run.sentinels) {
      let m = this.sentinels.get(s.id); if (!m) { m = new SentinelModel(s.kind, s.kind === 'warden' ? 1.45 : s.kind === 'drone' ? 1 : 1.12); this.sentinels.set(s.id, m); this.level.add(m.root); }
      m.root.visible = s.state !== 'gone';
      if (s.state === 'gone') continue;
      const q = this.position(s); m.root.position.set(q.x, 0, q.y);
      // Like arcade ghosts, sentinels face the camera and lean the way they move; the eyes do the looking.
      const lean = { up: [-.18, 0], down: [.18, 0], left: [0, .18], right: [0, -.18] }[s.dir], moving = s.state === 'active' && s.wait <= 0 && !reduced ? 1 : 0;
      m.root.rotation.set(m.root.rotation.x + (lean[0] * moving - m.root.rotation.x) * Math.min(1, dt * 8), 0, m.root.rotation.z + (lean[1] * moving - m.root.rotation.z) * Math.min(1, dt * 8));
      m.hover.position.y = s.state === 'asleep' ? .02 : (reduced ? 0 : Math.sin(this.time * 4 + s.id) * .07) + .05;
      const own = s.kind === 'warden' ? '#ff2a6d' : s.kind === 'drone' ? '#c9b8ff' : hunters[s.role % hunters.length];
      const body = m.parts.get('body'); if (body) body.visible = s.state !== 'eyes';
      if (s.scared) m.tint(ending ? FLASH : FROZEN, .7); else m.tint(new T.Color(own).multiplyScalar(s.state === 'asleep' ? .35 : 1), s.state === 'asleep' ? .2 : .55);
      const eyes = m.parts.get('eyes'); if (eyes) { eyes.visible = s.state !== 'asleep'; const look = Math.atan2(p.x - q.x, p.y - q.y); eyes.rotation.y = Math.max(-.7, Math.min(.7, Math.atan2(Math.sin(look), Math.cos(look)))); }
      const ring = m.parts.get('ring'); if (ring && !reduced) ring.rotation.y += dt * 2;
    }
  }
  private position(s: Sentinel) { const dx = s.at.x - s.from.x, dy = s.at.y - s.from.y; return Math.abs(dx) + Math.abs(dy) > 1 ? s.at : { x: s.from.x + dx * s.t, y: s.from.y + dy * s.t }; }
  private updatePickups(dt: number, reduced: boolean, edge: string) {
    const run = this.run, g = run.grid;
    if (this.dots) { const tiles = this.dots.userData.tiles as [number, number][]; let changed = false; tiles.forEach(([x, y], i) => { const on = run.dots[y * g.w + x] === 1; const s = on ? 1 + (reduced ? 0 : Math.sin(this.time * 4 + x + y) * .15) : 0; this.scratch.position.set(x, .3, y); this.scratch.rotation.set(0, 0, 0); this.scratch.scale.setScalar(s); this.scratch.updateMatrix(); this.dots!.setMatrixAt(i, this.scratch.matrix); changed = true; }); if (changed) this.dots.instanceMatrix.needsUpdate = true; }
    this.gems.forEach((gem, i) => { gem.visible = !run.gemsTaken[i]; this.halos[i].visible = gem.visible; if (!reduced) { gem.rotation.y += dt * 2; gem.position.y = .45 + Math.sin(this.time * 3 + i) * .08; } this.halos[i].scale.setScalar(1.3 + Math.sin(this.time * 4 + i) * .2); });
    if (this.exitRing && this.exitBeam) { const open = run.exitOpen; (this.exitRing.material as T.MeshBasicMaterial).color.set(open ? edge : '#333344'); this.exitBeam.visible = open; if (!reduced) this.exitRing.rotation.y += dt * (open ? 3 : .5); this.exitRing.scale.setScalar(open ? 1 + Math.sin(this.time * 6) * .08 : 1); }
    this.prism.visible = Boolean(run.prism); if (run.prism) { this.prism.position.set(run.prism.tile.x, .5 + Math.sin(this.time * 3) * .1, run.prism.tile.y); if (!reduced) { this.prism.rotation.x += dt * 2; this.prism.rotation.y += dt * 3; } }
  }
  private updateEffects(dt: number) {
    const d = this.scratch, live = this.sparks.filter(s => (s.age += dt) < s.life); this.sparks = live; this.sparkMesh.count = live.length;
    live.forEach((s, i) => { s.v.y -= 6 * dt; s.p.addScaledVector(s.v, dt); if (s.p.y < .05) { s.p.y = .05; s.v.y *= -.4; } d.position.copy(s.p); d.rotation.set(s.age * 9, s.age * 7, 0); d.scale.setScalar(s.size * (1 - s.age / s.life)); d.updateMatrix(); this.sparkMesh.setMatrixAt(i, d.matrix); this.sparkMesh.setColorAt(i, s.color); });
    this.sparkMesh.instanceMatrix.needsUpdate = true; if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    for (const f of this.floats) { f.age += dt; f.sprite.position.y = f.y + f.age * 1.2; (f.sprite.material as T.SpriteMaterial).opacity = Math.max(0, 1 - f.age); }
    for (const f of this.floats.filter(f => f.age >= 1)) { f.sprite.removeFromParent(); f.sprite.material.map?.dispose(); f.sprite.material.dispose(); }
    this.floats = this.floats.filter(f => f.age < 1);
  }
  diagnostics(): Record<string, number> { const info = this.renderer.info; return { drawCalls: info.render.calls, triangles: info.render.triangles }; }
  dispose(): void {
    for (const m of this.sentinels.values()) m.dispose(); this.ufo?.dispose();
    this.scene.traverse(o => { if (o instanceof T.Mesh || o instanceof T.Points) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    this.glow.dispose(); this.floorMat.map?.dispose(); this.composer.dispose(); this.renderer.dispose();
  }
}
