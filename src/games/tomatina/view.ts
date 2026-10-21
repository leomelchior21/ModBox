import * as T from 'three';
import type { ArcadeCue } from '../premium-kit/core';
import type { WorldView } from '../three-kit/types';
import { Footballer } from '../pinballerz/players';
import { TomatinaRun, CELL, EYE, WALL_H, TOMATO_R, type Pickup } from './run';
import { TOWNS } from './worlds';
import { RobotModel, HandModel } from './models';
import { wallAtlas, targetTexture, floorTexture, skylineTexture, splatTexture, gateTexture, exitTexture, crateTexture, WALL_KINDS, ATLAS_H, PX } from './textures';

/**
 * The two-tone renderer. The scene is drawn small (about 200 lines, like an old PC game) into a colour and depth
 * buffer; a single full-screen pass then turns grey levels into ordered dither between the town's paper and ink,
 * draws outlines where depth jumps, keeps pure red as tomato red, dissolves the distance into fog and adds the
 * drips when you are soaked. The canvas is shown with crisp, square pixels.
 */
const POST_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAGMENT = `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float near; uniform float far;
uniform vec3 paper; uniform vec3 ink; uniform vec3 tomato; uniform vec3 tomatoDark;
uniform float fogNear; uniform float fogFar; uniform float wet; uniform float time; uniform float flash;
varying vec2 vUv;
float viewZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0); float i = q.x + q.y * 4.0;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for (int k = 0; k < 16; k++) if (float(k) == i) return (m[k] + .5) / 16.0;
  return .5;
}
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 px = gl_FragCoord.xy, e = 1.0 / res;
  vec4 c = texture2D(tColor, vUv);
  float d = texture2D(tDepth, vUv).x, z = viewZ(d), sky = step(.99999, d);
  // Outlines: this pixel is in front of a neighbour that is much farther away (one-sided, so lines stay one pixel).
  float iz = 1.0 / z, edge = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = k == 0 ? vec2(e.x, 0.) : k == 1 ? vec2(-e.x, 0.) : k == 2 ? vec2(0., e.y) : vec2(0., -e.y);
    float n = 1.0 / viewZ(texture2D(tDepth, vUv + o).x); if (n < iz * .82) edge = 1.0;
  }
  edge *= 1.0 - sky;
  // A tone curve: faint lines and light shading clean up to paper, real shadows keep their dither.
  float lum = clamp((dot(c.rgb, vec3(.3, .59, .11)) - .1) / .72, 0.0, 1.0), b = bayer(px);
  bool red = c.r > .42 && c.g < .3 && c.b < .3 && c.r - max(c.g, c.b) > .3;
  float fog = fogFar > 0.0 ? clamp((z - fogNear) / max(.01, fogFar - fogNear), 0.0, 1.0) * (1.0 - sky) : 0.0;
  bool gone = fog > bayer(px + vec2(2.0, 1.0));
  vec3 outc;
  if (red) outc = c.r < .62 && b > .35 ? tomatoDark : tomato;
  else outc = lum < b ? ink : paper;
  if (edge > .5) outc = ink;
  if (gone) outc = paper;
  // Soaked: drips run down the screen.
  if (wet > 0.0) {
    float col = floor(px.x / 3.0), h = hash(col), speed = .4 + h * .8, y = fract(time * speed + h * 7.0), top = 1.0 - y;
    if (h > 1.0 - wet * .55 && abs(vUv.y - top) < .06 + h * .08 && mod(px.y + col, 2.0) < 1.0) outc = ink;
  }
  if (flash > 0.0 && b < flash * .6) outc = tomato;
  gl_FragColor = vec4(outc, 1.0);
}`;

const raw = (hex: string) => { const c = new T.Color(); c.setHex(parseInt(hex.slice(1), 16), T.LinearSRGBColorSpace); return c; };
const H_FOV = 78 * Math.PI / 180;

interface Flake { p: T.Vector3; v: T.Vector3; spin: number; age: number; life: number; red: boolean }

export class TomatinaView implements WorldView {
  readonly renderer: T.WebGLRenderer; readonly scene = new T.Scene(); readonly camera = new T.PerspectiveCamera(60, 1, .05, 90);
  private target: T.WebGLRenderTarget; private post: T.ShaderMaterial; private postScene = new T.Scene(); private postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private level = new T.Group(); private town = ''; private revision = -1; private time = 0; private shot: string | null = null; private shotKey = '';
  private robots = new Map<number, RobotModel>(); private pickups = new Map<number, T.Object3D>(); private amigos = new Map<number, Footballer>();
  private hand = new HandModel(); private handStyle = '';
  private splats: T.InstancedMesh; private tomatoes: T.InstancedMesh; private water: T.InstancedMesh; private flakes: T.InstancedMesh; private rain: T.InstancedMesh;
  private markGeometry = new T.SphereGeometry(.09, 8, 6); private markMaterial = new T.MeshBasicMaterial({ color: new T.Color(1, 0, 0) });
  private gates: T.Mesh[] = []; private targetFaces = new Map<number, T.Mesh[]>(); private exitSign: T.Mesh | null = null; private bunting: T.Mesh | null = null;
  private wallMaterials = new Map<string, T.MeshBasicMaterial>(); private floorMaterial = new T.MeshBasicMaterial(); private zoneMaterial = new T.MeshBasicMaterial(); private skyMaterial = new T.MeshBasicMaterial({ side: T.BackSide });
  private particles: Flake[] = []; private shake = 0; private flash = 0; private scratch = new T.Object3D();
  private press: { id: number; x: number; y: number; lastX: number; t: number; moved: boolean } | null = null;
  width = 1; height = 1;
  constructor(readonly canvas: HTMLCanvasElement, readonly run: TomatinaRun) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.LinearSRGBColorSpace; this.renderer.setPixelRatio(1);
    canvas.style.imageRendering = 'pixelated';
    this.target = new T.WebGLRenderTarget(4, 4, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthTexture: new T.DepthTexture(4, 4, T.UnsignedIntType) });
    this.post = new T.ShaderMaterial({ vertexShader: POST_VERTEX, fragmentShader: POST_FRAGMENT, depthTest: false, depthWrite: false, uniforms: {
      tColor: { value: this.target.texture }, tDepth: { value: this.target.depthTexture }, res: { value: new T.Vector2(4, 4) }, near: { value: this.camera.near }, far: { value: this.camera.far },
      paper: { value: new T.Color() }, ink: { value: new T.Color() }, tomato: { value: new T.Color() }, tomatoDark: { value: new T.Color() },
      fogNear: { value: 0 }, fogFar: { value: 0 }, wet: { value: 0 }, time: { value: 0 }, flash: { value: 0 },
    } });
    this.postScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.post));
    this.scene.background = new T.Color(1, 1, 1);
    this.scene.add(new T.HemisphereLight(0xffffff, 0xb0b0b0, 2.2)); const sun = new T.DirectionalLight(0xffffff, 1.1); sun.position.set(-.5, 1, .35); this.scene.add(sun);
    this.scene.add(this.level, this.camera); this.camera.add(this.hand.root);
    const splatGeometry = new T.PlaneGeometry(1, 1);
    this.splats = new T.InstancedMesh(splatGeometry, new T.MeshBasicMaterial({ map: splatTexture(), alphaTest: .5, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 380);
    this.tomatoes = new T.InstancedMesh(new T.SphereGeometry(TOMATO_R, 10, 7), new T.MeshBasicMaterial({ color: new T.Color(1, 0, 0) }), 80);
    this.water = new T.InstancedMesh(new T.SphereGeometry(.13, 8, 6), new T.MeshLambertMaterial({ color: new T.Color(.92, .92, .92) }), 80);
    this.flakes = new T.InstancedMesh(new T.PlaneGeometry(.1, .07), new T.MeshBasicMaterial({ side: T.DoubleSide }), 300);
    this.rain = new T.InstancedMesh(new T.BoxGeometry(.035, .7, .035), new T.MeshBasicMaterial({ color: new T.Color(0, 0, 0) }), 320);
    for (const m of [this.splats, this.tomatoes, this.water, this.flakes, this.rain]) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; this.scene.add(m); }
    this.flakes.setColorAt(0, new T.Color(1, 1, 1));
  }

  resize(width: number, height: number): void {
    this.width = width; this.height = height;
    // Chunky pixels: about 210 lines tall, whatever the screen.
    const scale = Math.max(1.6, Math.min(4, height / 210)), w = Math.max(64, Math.round(width / scale)), h = Math.max(48, Math.round(height / scale));
    this.renderer.setSize(w, h, false); this.target.setSize(w, h); (this.post.uniforms.res.value as T.Vector2).set(w, h);
    const aspect = width / Math.max(1, height); this.camera.aspect = aspect;
    this.camera.fov = Math.min(100, Math.max(48, 2 * Math.atan(Math.tan(H_FOV / 2) / aspect) * 180 / Math.PI)); this.camera.updateProjectionMatrix();
  }
  private get hfov() { return 2 * Math.atan(Math.tan(this.camera.fov * Math.PI / 360) * this.camera.aspect); }

  /** Tap to throw at that spot; drag sideways to look around. */
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId: number): void {
    if (phase === 'down') { this.press = { id: pointerId, x, y, lastX: x, t: performance.now(), moved: false }; return; }
    const p = this.press; if (!p || p.id !== pointerId) return;
    if (phase === 'move') { if (Math.abs(x - p.x) > .025 || Math.abs(y - p.y) > .04) p.moved = true; if (p.moved) this.run.look((x - p.lastX) * this.hfov * 1.15); p.lastX = x; return; }
    if (phase === 'up' && !p.moved && performance.now() - p.t < 500) {
      const tanH = Math.tan(this.hfov / 2), tanV = Math.tan(this.camera.fov * Math.PI / 360), nx = (x * 2 - 1) * tanH, ny = (1 - y * 2) * tanV;
      this.run.aimAt(Math.atan(nx), Math.atan2(ny, Math.hypot(1, nx)));
    }
    this.press = null;
  }

  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    const run = this.run, step = held ? 0 : dt; this.time += step;
    const town = run.config.worldTheme && TOWNS[run.config.worldTheme] ? run.config.worldTheme : 'classic';
    if (this.revision !== run.revision || !this.level.children.length) { this.revision = run.revision; this.town = ''; this.buildLevel(); this.particles = []; }
    if (this.town !== town) { this.town = town; this.applyTown(town); }
    if (this.handStyle !== (run.config.characterStyle ?? 'original')) { this.handStyle = run.config.characterStyle ?? 'original'; this.hand.setStyle(this.handStyle); }
    for (const cue of cues) this.onCue(cue, reduced);
    // Camera: eye height, a little walking bob, a shake on impacts.
    const bob = reduced ? 0 : Math.sin(run.bob * 2) * .04 * Math.min(1, Math.abs(run.speed) / 3);
    this.shake = Math.max(0, this.shake - step * 3); const sx = reduced ? 0 : Math.sin(this.time * 70) * this.shake * .02;
    this.camera.position.set(run.px, EYE + bob + (run.hurt > 0 && !reduced ? Math.sin(this.time * 40) * .02 : 0), run.pz);
    this.camera.lookAt(run.px + Math.cos(run.yaw + sx), EYE + bob, run.pz + Math.sin(run.yaw + sx));
    this.hand.update(run.bob, run.speed, run.throwAnim, run.cool <= 0 && run.ammo > 0, run.hurt, reduced);
    this.updateActors(step, reduced); this.updateEffects(step, reduced);
    // Palette, fog and drips.
    const pal = TOWNS[town], night = run.night, u = this.post.uniforms, fog = run.weather.fog ?? (run.stage.night ? [7, 22] as const : null);
    (u.paper.value as T.Color).copy(raw(night ? pal.ink : pal.paper)).multiplyScalar(night ? .55 : 1); (u.ink.value as T.Color).copy(raw(night ? pal.paper : pal.ink));
    (u.tomato.value as T.Color).copy(raw(pal.tomato)); (u.tomatoDark.value as T.Color).copy(raw(pal.tomatoDark));
    u.fogNear.value = fog ? fog[0] : 0; u.fogFar.value = fog ? fog[1] : 0; u.wet.value = reduced ? 0 : Math.min(1, run.hurt * 1.6); u.time.value = this.time; this.flash = Math.max(0, this.flash - step * 2.5); u.flash.value = reduced ? 0 : this.flash;
    this.renderer.setRenderTarget(this.target); this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.postScene, this.postCamera);
    const key = `${run.revision}|${run.phase}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/png'); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }

  private onCue(cue: ArcadeCue, reduced: boolean) {
    if (cue.kind === 'hit' && Math.hypot(cue.x - this.run.px, cue.y - this.run.pz) < 2.5) this.shake = .6;
    if (cue.kind === 'lose') this.shake = 1;
    if (cue.kind === 'ability') this.flash = .8;
    if (cue.kind === 'clear' && !reduced) this.burst(this.run.px + Math.cos(this.run.yaw) * 3, 2, this.run.pz + Math.sin(this.run.yaw) * 3, 120, 5);
  }
  /** Confetti and tomato bits: paper and red flakes that tumble down. */
  private burst(x: number, y: number, z: number, n: number, up: number) {
    for (let i = 0; i < n; i++) { const a = i * 2.39996, s = .5 + (i % 7) / 7; this.particles.push({ p: new T.Vector3(x, y, z), v: new T.Vector3(Math.cos(a) * 3 * s, up * (.5 + (i % 5) / 5), Math.sin(a) * 3 * s), spin: (i % 9) - 4, age: 0, life: 2 + (i % 4) * .4, red: i % 2 === 0 }); }
    this.particles = this.particles.slice(-300);
  }

  // ------------------------------------------------------------------ level geometry
  private buildLevel() {
    for (const r of this.robots.values()) r.dispose(); this.robots.clear();
    for (const a of this.amigos.values()) a.dispose(); this.amigos.clear(); this.pickups.clear();
    this.level.traverse(o => { if (o instanceof T.Mesh && o.userData.owned) { o.geometry.dispose(); if (o.userData.ownMaterial) (o.material as T.Material).dispose(); } });
    this.level.clear(); this.gates = []; this.targetFaces.clear(); this.exitSign = null; this.bunting = null;
    const run = this.run, own = (m: T.Mesh, material = false) => { m.userData.owned = true; m.userData.ownMaterial = material; this.level.add(m); return m; };
    const faces = new Map<string, number[][]>();
    const quad = (key: string, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, variant: number) => {
      const list = faces.get(key) ?? []; faces.set(key, list); const u0 = variant * .25, u1 = u0 + .25, v0 = y0 * PX / ATLAS_H, v1 = y1 * PX / ATLAS_H;
      list.push([x0, y0, z0, u0, v0, x1, y0, z1, u1, v0, x1, y1, z1, u1, v1, x0, y1, z0, u0, v1]);
    };
    const floor: number[][] = [], zone: number[][] = [];
    for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) {
      const ch = run.at(c, r), x0 = c * CELL, z0 = r * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      const tall = '#%|=O'.includes(ch);
      if (!tall) (ch === ',' ? zone : floor).push([x0, 0, z0, 0, 0, x0, 0, z1, 0, 1, x1, 0, z1, 1, 1, x1, 0, z0, 1, 0]);
      if (!tall) continue;
      const h = WALL_H[ch];
      // Each side faces the cell next to it; only the part above a lower neighbour is drawn.
      const sides: [number, number, number, number, number, number][] = [[0, -1, x1, z0, x0, z0], [0, 1, x0, z1, x1, z1], [-1, 0, x0, z0, x0, z1], [1, 0, x1, z1, x1, z0]];
      for (const [dc, dr, ax, az, bx, bz] of sides) {
        const n = run.at(c + dc, r + dr), nh = '#%|=O'.includes(n) ? WALL_H[n] : 0; if (nh >= h || c + dc < 0 || r + dr < 0 || c + dc >= run.cols || r + dr >= run.rows) continue;
        const variant = Math.abs((c * 73856093) ^ (r * 19349663) ^ ((dc + 2) * 83492791) ^ (dr * 5)) % 4;
        if (ch === 'O') { const m = own(new T.Mesh(this.faceGeometry([[ax, nh, az, 0, nh / 5, bx, nh, bz, 1, nh / 5, bx, h, bz, 1, h / 5, ax, h, az, 0, h / 5]]), new T.MeshBasicMaterial()), true); const list = this.targetFaces.get(r * run.cols + c) ?? []; list.push(m); this.targetFaces.set(r * run.cols + c, list); }
        else quad(ch, ax, az, bx, bz, nh, h, variant);
      }
    }
    for (const kind of WALL_KINDS) { const list = faces.get(kind); if (!list) continue; const mat = this.wallMaterials.get(kind) ?? new T.MeshBasicMaterial({ side: T.DoubleSide }); this.wallMaterials.set(kind, mat); own(new T.Mesh(this.faceGeometry(list), mat)); }
    own(new T.Mesh(this.faceGeometry(floor), this.floorMaterial)); if (zone.length) own(new T.Mesh(this.faceGeometry(zone), this.zoneMaterial));
    this.buildZoneBorder(); this.buildProps(); this.buildBunting();
    // The skyline wraps the whole town.
    const cx = run.cols * CELL / 2, cz = run.rows * CELL / 2, radius = Math.hypot(cx, cz) + 22;
    const sky = own(new T.Mesh(new T.CylinderGeometry(radius, radius, 24, 40, 1, true), this.skyMaterial)); sky.position.set(cx, 9, cz);
  }
  private faceGeometry(list: number[][]) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    list.forEach((q, i) => { for (let k = 0; k < 4; k++) { pos.push(q[k * 5], q[k * 5 + 1], q[k * 5 + 2]); uv.push(q[k * 5 + 3], q[k * 5 + 4]); } const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /** Ink border around the plaza to paint. */
  private buildZoneBorder() {
    const run = this.run, pos: number[] = [], w = .09;
    const seg = (x0: number, z0: number, x1: number, z1: number) => { const nx = z1 - z0 ? w : 0, nz = x1 - x0 ? w : 0; pos.push(x0 - nx, .012, z0 - nz, x1 + nx, .012, z1 + nz, x1 - nx, .012, z1 - nz, x0 - nx, .012, z0 - nz, x1 - nx, .012, z1 - nz, x0 + nx, .012, z0 + nz); };
    for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) {
      if (run.at(c, r) !== ',') continue; const x0 = c * CELL, z0 = r * CELL;
      if (run.at(c, r - 1) !== ',' && run.at(c, r - 1) !== 'f') seg(x0, z0, x0 + CELL, z0); if (run.at(c, r + 1) !== ',' && run.at(c, r + 1) !== 'f') seg(x0, z0 + CELL, x0 + CELL, z0 + CELL);
      if (run.at(c - 1, r) !== ',' && run.at(c - 1, r) !== 'f') seg(x0, z0, x0, z0 + CELL); if (run.at(c + 1, r) !== ',' && run.at(c + 1, r) !== 'f') seg(x0 + CELL, z0, x0 + CELL, z0 + CELL);
    }
    if (!pos.length) return; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x000000, side: T.DoubleSide })); m.userData.owned = m.userData.ownMaterial = true; this.level.add(m);
  }
  private buildProps() {
    const run = this.run, white = new T.MeshLambertMaterial({ color: 0xffffff }), mid = new T.MeshLambertMaterial({ color: new T.Color(.55, .55, .55) }), red = new T.MeshBasicMaterial({ color: new T.Color(1, 0, 0) }), black = new T.MeshBasicMaterial({ color: 0x000000 });
    const add = (g: T.BufferGeometry, m: T.Material, x: number, y: number, z: number) => { const mesh = new T.Mesh(g, m); mesh.position.set(x, y, z); mesh.userData.owned = true; this.level.add(mesh); return mesh; };
    for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) {
      const ch = run.at(c, r), { x, z } = run.center(c, r);
      if (ch === 'o') { add(new T.CylinderGeometry(.62, .5, 1, 12), mid, x, .5, z); add(new T.CylinderGeometry(.66, .66, .08, 12), white, x, 1, z); for (let k = 0; k < 5; k++) add(new T.SphereGeometry(.16, 8, 6), k % 2 ? red : white, x + Math.cos(k * 1.26) * .32, 1.12, z + Math.sin(k * 1.26) * .32); }
      if (ch === 'f') { add(new T.CylinderGeometry(.95, 1, .55, 16), white, x, .28, z); add(new T.CylinderGeometry(.85, .85, .06, 16), mid, x, .56, z); add(new T.CylinderGeometry(.14, .2, 1.1, 8), white, x, 1.05, z); add(new T.CylinderGeometry(.42, .2, .18, 12), white, x, 1.6, z); add(new T.SphereGeometry(.14, 8, 6), black, x, 1.74, z); }
      if (ch === 'G') {
        const ns = run.blocks(c, r - 1) && !run.blocks(c - 1, r) ? false : run.blocks(c - 1, r) || run.blocks(c + 1, r);
        const bars = add(new T.PlaneGeometry(CELL, 3), new T.MeshBasicMaterial({ map: gateTexture(), alphaTest: .5, side: T.DoubleSide }), x, 1.5, z); bars.userData.ownMaterial = true;
        if (!ns) bars.rotation.y = Math.PI / 2; this.gates.push(bars);
      }
      if (ch === 'X') {
        const along = run.blocks(c - 1, r) && run.blocks(c + 1, r), sign = add(new T.PlaneGeometry(CELL * .95, .48), new T.MeshBasicMaterial({ map: exitTexture(false), side: T.DoubleSide }), x, 2.9, z); sign.userData.ownMaterial = true;
        if (!along) sign.rotation.y = Math.PI / 2; this.exitSign = sign;
        for (const s of [-1, 1]) add(new T.BoxGeometry(.16, 3.1, .16), white, x + (along ? s * .9 : 0), 1.55, z + (along ? 0 : s * .9));
      }
    }
    for (const m of [white, mid, red, black]) { const keep = new T.Mesh(new T.BufferGeometry(), m); keep.visible = false; keep.userData.owned = keep.userData.ownMaterial = true; this.level.add(keep); }
  }
  /** Strings of little flags across the streets: the fiesta is on. */
  private buildBunting() {
    const run = this.run, pos: number[] = [], col: number[] = [];
    const flagLine = (ax: number, az: number, bx: number, bz: number, h: number, seed: number) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(3, Math.floor(len / .45)), dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + .8) / n, sag = (t: number) => h - Math.sin(t * Math.PI) * .45, red = (i + seed) % 2 === 0;
        const p0 = [ax + (bx - ax) * t0, sag(t0), az + (bz - az) * t0], p1 = [ax + (bx - ax) * t1, sag(t1), az + (bz - az) * t1], mid = [(p0[0] + p1[0]) / 2 + dz * .02, (p0[1] + p1[1]) / 2 - .32, (p0[2] + p1[2]) / 2 - dx * .02];
        pos.push(...p0, ...p1, ...mid); const v = red ? [1, 0, 0] : [1, 1, 1]; col.push(...v, ...v, ...v);
        const q0 = [ax + (bx - ax) * (i / n), sag(i / n), az + (bz - az) * (i / n)], q1 = [ax + (bx - ax) * ((i + 1) / n), sag((i + 1) / n), az + (bz - az) * ((i + 1) / n)];
        pos.push(...q0, ...q1, q1[0], q1[1] + .025, q1[2]); col.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
      }
    };
    const tall = (c: number, r: number) => '#%|='.includes(run.at(c, r));
    for (let r = 1; r < run.rows - 1; r += 3) { let c = 0; while (c < run.cols) { if (!tall(c, r) && tall(c - 1, r)) { let e = c; while (e < run.cols && !tall(e, r)) e++; if (tall(e, r) && e - c >= 2 && e - c <= 7) flagLine(c * CELL, (r + .5) * CELL, e * CELL, (r + .5) * CELL, 3.6, r); c = e; } else c++; } }
    for (let c = 2; c < run.cols - 1; c += 4) { let r = 0; while (r < run.rows) { if (!tall(c, r) && tall(c, r - 1)) { let e = r; while (e < run.rows && !tall(c, e)) e++; if (tall(c, e) && e - r >= 2 && e - r <= 5) flagLine((c + .5) * CELL, r * CELL, (c + .5) * CELL, e * CELL, 3.4, c); r = e; } else r++; } }
    if (!pos.length) return;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    this.bunting = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })); this.bunting.userData.owned = this.bunting.userData.ownMaterial = true; this.level.add(this.bunting);
  }
  private applyTown(town: string) {
    for (const kind of WALL_KINDS) { const m = this.wallMaterials.get(kind) ?? new T.MeshBasicMaterial({ side: T.DoubleSide }); m.map = wallAtlas(town, kind); m.needsUpdate = true; this.wallMaterials.set(kind, m); }
    this.floorMaterial.map = floorTexture(town, false); this.floorMaterial.needsUpdate = true; this.zoneMaterial.map = floorTexture(town, true); this.zoneMaterial.needsUpdate = true;
    const sky = skylineTexture(town); sky.repeat.set(3, 1); this.skyMaterial.map = sky; this.skyMaterial.needsUpdate = true;
    for (const [cell, faces] of this.targetFaces) for (const f of faces) { const m = f.material as T.MeshBasicMaterial; m.map = targetTexture(town, this.run.targetsHit.has(cell)); m.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ actors and effects
  private updateActors(dt: number, reduced: boolean) {
    const run = this.run, party = run.config.celebration ?? 'drip';
    for (const bot of run.bots) {
      let model = this.robots.get(bot.id);
      if (!model) { model = new RobotModel(bot.kind, this.markGeometry, this.markMaterial); this.robots.set(bot.id, model); this.level.add(model.root); }
      const wasAlive = model.root.userData.alive !== false; model.root.userData.alive = bot.alive;
      if (wasAlive && !bot.alive && !reduced) { if (party === 'confetti') this.burst(bot.x, 1, bot.z, 90, 5); if (party === 'fireworks') for (let k = 0; k < 3; k++) this.burst(bot.x + (k - 1) * .6, 3 + k * .8, bot.z, 40, 2); if (party === 'drip') this.burst(bot.x, .8, bot.z, 14, 2); }
      model.update(bot, dt, party, reduced);
    }
    for (const [id, model] of this.robots) if (!run.bots.some(b => b.id === id)) { model.dispose(); this.robots.delete(id); }
    // Pickups bob and spin; they hide while a crate refills.
    for (const p of run.pickups) {
      let o = this.pickups.get(p.id); if (!o) { o = this.pickup(p); this.pickups.set(p.id, o); this.level.add(o); }
      o.visible = !p.gone && p.away === 0; o.position.set(p.x, p.kind === 'crate' || p.kind === 'drop' ? 0 : .55 + (reduced ? 0 : Math.sin(this.time * 2.5 + p.id) * .1), p.z); if (p.kind !== 'crate' && p.kind !== 'drop' && !reduced) o.rotation.y = this.time * 1.6 + p.id;
    }
    for (const [id, o] of this.pickups) if (!run.pickups.some(p => p.id === id)) { o.removeFromParent(); o.traverse(m => { if (m instanceof T.Mesh) m.geometry.dispose(); }); this.pickups.delete(id); }
    // Fiesta friends: townsfolk in white with red stripes.
    for (const a of run.amigos) {
      let f = this.amigos.get(a.id); if (!f) { f = new Footballer({ shirt: '#ffffff', stripe: '#ff0000', shorts: '#ffffff', socks: '#ffffff', boots: '#000000' }, a.id * 3, 1.75); this.amigos.set(a.id, f); this.level.add(f.root); }
      f.root.position.set(a.x, 0, a.z); f.root.rotation.y = Math.PI / 2 - a.yaw; f.pose = a.stun > 0 ? 'dejected' : a.throwing > .5 ? 'point' : Math.abs(a.walk % 1) > 0 ? 'run' : 'idle'; f.speed = .8; f.update(dt, reduced);
    }
    // Gates sink once every bullseye is hit; targets turn red as they are hit; the exit sign lights up.
    for (const g of this.gates) g.position.y = run.gatesOpen ? Math.max(-1.6, g.position.y - dt * 2.5) : 1.5;
    for (const [cell, faces] of this.targetFaces) { const hit = run.targetsHit.has(cell); for (const f of faces) { const m = f.material as T.MeshBasicMaterial; if (m.userData.hit !== hit) { m.userData.hit = hit; m.map = targetTexture(this.town || 'classic', hit); m.needsUpdate = true; } } }
    if (this.exitSign) { const m = this.exitSign.material as T.MeshBasicMaterial, open = run.exitOpen || !run.stage.goals.some(([k]) => k === 'exit'); if (m.userData.open !== open) { m.userData.open = open; m.map = exitTexture(open); m.needsUpdate = true; } }
    if (this.bunting && !reduced) this.bunting.position.y = Math.sin(this.time * 1.7) * .03;
  }
  private pickup(p: Pickup): T.Object3D {
    const g = new T.Group(), red = new T.MeshBasicMaterial({ color: new T.Color(1, 0, 0) }), white = new T.MeshLambertMaterial({ color: 0xffffff }), ink = new T.MeshBasicMaterial({ color: 0x000000 });
    const add = (geo: T.BufferGeometry, m: T.Material, x: number, y: number, z: number) => { const mesh = new T.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
    switch (p.kind) {
      case 'crate': add(new T.BoxGeometry(.8, .5, .6), new T.MeshBasicMaterial({ map: crateTexture() }), 0, .25, 0); for (let k = 0; k < 5; k++) add(new T.SphereGeometry(.13, 8, 6), red, -.25 + k * .125, .58, (k % 2) * .1 - .05); break;
      case 'drop': for (let k = 0; k < 3; k++) add(new T.SphereGeometry(.12, 8, 6), red, (k - 1) * .2, .12, (k % 2) * .12); break;
      case 'churros': add(new T.ConeGeometry(.22, .45, 8), white, 0, 0, 0).rotation.x = Math.PI; for (let k = 0; k < 4; k++) add(new T.CylinderGeometry(.04, .04, .55, 6), new T.MeshLambertMaterial({ color: new T.Color(.6, .6, .6) }), (k - 1.5) * .07, .3, 0).rotation.z = (k - 1.5) * .15; break;
      case 'cherry': for (let k = 0; k < 3; k++) { add(new T.SphereGeometry(.11, 8, 6), red, Math.cos(k * 2.1) * .13, 0, Math.sin(k * 2.1) * .13); add(new T.CylinderGeometry(.012, .012, .3, 4), ink, Math.cos(k * 2.1) * .07, .16, Math.sin(k * 2.1) * .07); } break;
      case 'mega': add(new T.SphereGeometry(.3, 14, 10), red, 0, 0, 0); add(new T.ConeGeometry(.08, .12, 5), ink, 0, .32, 0); break;
      case 'bounce': add(new T.SphereGeometry(.2, 12, 8), red, 0, 0, 0); add(new T.TorusGeometry(.27, .03, 6, 20), ink, 0, 0, 0); add(new T.TorusGeometry(.27, .03, 6, 20), ink, 0, 0, 0).rotation.x = Math.PI / 2; break;
      case 'golden': add(new T.SphereGeometry(.24, 14, 10), new T.MeshLambertMaterial({ color: new T.Color(.72, .72, .72) }), 0, 0, 0); for (let k = 0; k < 5; k++) add(new T.ConeGeometry(.05, .16, 4), ink, Math.cos(k * 1.26) * .12, .28, Math.sin(k * 1.26) * .12); for (let k = 0; k < 4; k++) add(new T.BoxGeometry(.02, .5, .02), ink, 0, 0, 0).rotation.z = k * Math.PI / 4; break;
    }
    return g;
  }
  private updateEffects(dt: number, reduced: boolean) {
    const run = this.run, d = this.scratch;
    // Splats on walls and streets.
    const splats = run.splats.slice(-380); this.splats.count = splats.length;
    splats.forEach((s, i) => {
      d.position.set(s.x + s.nx * .015, s.ny ? .015 + (s.y || 0) : s.y, s.z + s.nz * .015);
      if (s.ny) d.rotation.set(-Math.PI / 2, 0, s.seed * 6.28); else d.rotation.set(0, Math.atan2(s.nx, s.nz), s.seed * 6.28);
      d.scale.setScalar(s.r * 2 * Math.max(.15, Math.min(1, s.life))); d.updateMatrix(); this.splats.setMatrixAt(i, d.matrix);
    });
    this.splats.instanceMatrix.needsUpdate = true;
    this.tomatoes.count = Math.min(80, run.tomatoes.length);
    run.tomatoes.slice(0, 80).forEach((t, i) => { d.position.set(t.x, t.y, t.z); d.rotation.set(t.t * 9, t.t * 7, 0); d.scale.setScalar(.6 + t.size * .2); d.updateMatrix(); this.tomatoes.setMatrixAt(i, d.matrix); });
    this.tomatoes.instanceMatrix.needsUpdate = true;
    this.water.count = Math.min(80, run.water.length);
    run.water.slice(0, 80).forEach((w, i) => { d.position.set(w.x, w.y, w.z); d.rotation.set(0, 0, 0); d.scale.set(w.foam ? 2.4 : 1, w.foam ? 1.6 : 1, w.foam ? 2.4 : 1); d.updateMatrix(); this.water.setMatrixAt(i, d.matrix); });
    this.water.instanceMatrix.needsUpdate = true;
    // Weather you can see: rain streaks near you, leaves and paper blowing in the wind.
    const weather = run.config.weather ?? 'clear', drops = weather === 'rain' && !reduced ? 320 : 0; this.rain.count = drops;
    for (let i = 0; i < drops; i++) { const h = (i * 0.618034) % 1, k = (i * 0.414214) % 1, x = run.px + (h - .5) * 16, z = run.pz + (k - .5) * 16, y = 6 - ((this.time * 9 + i * .37) % 6); d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); this.rain.setMatrixAt(i, d.matrix); }
    this.rain.instanceMatrix.needsUpdate = true;
    if (weather === 'wind' && !reduced && this.particles.length < 60 && Math.random() < dt * 20) { const a = Math.random() * 6.28; this.particles.push({ p: new T.Vector3(run.px + Math.cos(a) * 6, 1 + Math.random() * 3, run.pz + Math.sin(a) * 6), v: new T.Vector3(run.windX * .8, -.2, run.windZ * .8), spin: 6, age: 0, life: 3, red: Math.random() < .3 }); }
    const live = this.particles.filter(p => (p.age += dt) < p.life); this.particles = live;
    this.flakes.count = live.length;
    live.forEach((p, i) => { p.v.y -= 3 * dt; p.v.multiplyScalar(1 - dt * 1.2); p.v.x += run.windX * dt * .5; p.v.z += run.windZ * dt * .5; p.p.addScaledVector(p.v, dt); if (p.p.y < .02) { p.p.y = .02; p.v.set(0, 0, 0); } d.position.copy(p.p); d.rotation.set(p.age * p.spin, p.age * p.spin * .7, 0); d.scale.setScalar(1); d.updateMatrix(); this.flakes.setMatrixAt(i, d.matrix); this.flakes.setColorAt(i, p.red ? new T.Color(1, 0, 0) : new T.Color(1, 1, 1)); });
    this.flakes.instanceMatrix.needsUpdate = true; if (this.flakes.instanceColor) this.flakes.instanceColor.needsUpdate = true;
  }
  diagnostics(): Record<string, number> { const info = this.renderer.info; return { drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures }; }
  dispose(): void {
    for (const r of this.robots.values()) r.dispose(); for (const a of this.amigos.values()) a.dispose(); this.hand.dispose();
    this.scene.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    this.target.dispose(); this.post.dispose(); this.renderer.dispose();
  }
}
