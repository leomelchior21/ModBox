import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Bot, BotKind } from './run';
import { THROWERS } from './worlds';

/** Parts of the Unity pack (see ModboxArt.Limpiabots): geometry plus the pivot it turns around. */
interface Part { geometry: T.BufferGeometry; pivot: T.Vector3 }
let pack: Promise<Map<string, Part>> | null = null;
function loadPack(): Promise<Map<string, Part>> {
  pack ??= new Promise((resolve, reject) => {
    new GLTFLoader().load('/models/unity/limpiabots.glb', gltf => {
      const parts = new Map<string, Part>(), c = new T.Color();
      gltf.scene.traverse(o => {
        // three.js drops the dot from glTF node names ("mop.body" arrives as "mopbody"), so match without punctuation.
        const key = String(o.userData?.name ?? o.name).replace(/[^a-z]/gi, '').toLowerCase();
        if (!(o instanceof T.Mesh) || !/^(mop|spray|umbrella|vac|boss|hand)/.test(key)) return;
        // Unity writes linear colours; the two-tone renderer reads plain grey levels, so convert back.
        const colors = o.geometry.getAttribute('color') as T.BufferAttribute | undefined;
        if (colors) for (let i = 0; i < colors.count; i++) { c.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).convertLinearToSRGB(); colors.setXYZ(i, c.r, c.g, c.b); }
        parts.set(key, { geometry: o.geometry, pivot: o.position.clone() });
      });
      parts.size >= 15 ? resolve(parts) : reject(new Error('Incomplete Limpiabots pack'));
    }, undefined, reject);
  });
  return pack;
}

const PARTS: Record<BotKind, string[]> = { mop: ['body', 'arm'], spray: ['body', 'hose'], umbrella: ['body', 'canopy'], vac: ['body', 'brush'], boss: ['body', 'drum', 'door'] };
/** Simple stand-ins with the same pivots, shown until the Unity pack arrives (or if it cannot load). */
function fallback(kind: BotKind, part: string): Part {
  const paint = (g: T.BufferGeometry, v: number) => { const n = g.attributes.position.count; g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(v), 3)); return g; };
  const size = kind === 'boss' ? 2.6 : kind === 'vac' ? .8 : .7, h = kind === 'boss' ? 3 : kind === 'vac' ? .3 : 1.3;
  if (part === 'body') return { geometry: paint(new T.CylinderGeometry(size / 2, size / 2, h, 10).translate(0, h / 2, 0), 1), pivot: new T.Vector3() };
  return { geometry: paint(new T.BoxGeometry(.12, .12, .5).translate(0, 0, .25), .3), pivot: new T.Vector3(.35, h * .7, 0) };
}
const RED = new T.Color(1, .12, .1);

/** One Limpiabot on screen: rigged parts, splat marks and its own little animations. */
export class RobotModel {
  readonly root = new T.Group(); private readonly parts = new Map<string, T.Group>(); private readonly material = new T.MeshLambertMaterial({ vertexColors: true });
  private marks = new T.Group(); private markMesh: T.SphereGeometry; private markMat: T.MeshBasicMaterial; private disposed = false; private clock = Math.random() * 9;
  constructor(readonly kind: BotKind, markGeometry: T.SphereGeometry, markMaterial: T.MeshBasicMaterial) {
    this.markMesh = markGeometry; this.markMat = markMaterial; this.root.add(this.marks);
    this.build(new Map(PARTS[kind].map(p => [`${kind}${p}`, fallback(kind, p)])), true);
    loadPack().then(parts => { if (!this.disposed) this.build(parts, false); }).catch(() => undefined);
  }
  private build(parts: Map<string, Part>, owned: boolean) {
    for (const g of this.parts.values()) { g.removeFromParent(); g.traverse(o => { if (o instanceof T.Mesh && o.userData.owned) o.geometry.dispose(); }); }
    this.parts.clear();
    for (const name of PARTS[this.kind]) {
      const part = parts.get(`${this.kind}${name}`); if (!part) continue;
      const pivot = new T.Group(), mesh = new T.Mesh(part.geometry, this.material); mesh.userData.owned = owned;
      pivot.position.copy(part.pivot); pivot.add(mesh); this.root.add(pivot); this.parts.set(name, pivot);
    }
  }
  update(bot: Bot, dt: number, party: string, reduced: boolean) {
    const t = (this.clock += dt), s = reduced ? 0 : 1, p = this.parts, theta = Math.PI / 2 - bot.yaw;
    this.root.position.set(bot.x, 0, bot.z); this.root.rotation.set(0, theta, 0);
    const shake = bot.hit < .15 && bot.alive ? Math.sin(bot.hit * 90) * .06 * s : 0; this.root.position.x += shake;
    const body = p.get('body');
    if (bot.alive) {
      this.material.color.setRGB(1, 1, 1);
      if (body) body.position.y = (this.kind === 'vac' ? 0 : Math.abs(Math.sin(t * 7)) * .025) * s;
      if (this.kind === 'mop') p.get('arm')!.rotation.x = bot.act > 0 ? Math.sin(t * 24) * .4 * s : Math.sin(t * 1.8) * .06 * s;
      if (this.kind === 'spray') p.get('hose')!.rotation.x = bot.act > 0 ? -.35 * bot.act / .45 : Math.sin(t * 1.5) * .05 * s;
      if (this.kind === 'umbrella') { const c = p.get('canopy')!; c.rotation.x = bot.droop > 0 ? .95 : bot.hit < .25 ? Math.sin(bot.hit * 60) * .12 : 0; c.rotation.z = bot.load * .08; }
      if (this.kind === 'vac') p.get('brush')!.rotation.y += dt * 22 * (s || .2);
      if (this.kind === 'boss') { p.get('door')!.rotation.y = -bot.door * 1.9; p.get('drum')!.rotation.z += dt * (bot.open ? 1.2 : 11) * (s || .3); if (body) body.position.x = bot.open ? 0 : Math.sin(t * 40) * .03 * s; }
    } else {
      // Splatted: dripping tomato red, then the chosen splat party.
      this.material.color.copy(RED); const since = Math.min(1, bot.hit * 1.5);
      if (party === 'flamenco' && !reduced) { this.root.rotation.y = theta + bot.hit * 7; this.root.position.y = Math.abs(Math.sin(bot.hit * 9)) * .18; const arm = p.get('arm') ?? p.get('hose') ?? p.get('canopy'); if (arm) arm.rotation.x = -1.2 + Math.sin(bot.hit * 12) * .3; }
      else if (this.kind === 'vac') { this.root.rotation.z = Math.PI * since; this.root.position.y = .35 * since; }
      else { this.root.rotation.z = .3 * since; this.root.rotation.x = .12 * since; if (this.kind === 'boss') { p.get('door')!.rotation.y = -1.9 * since; } }
    }
    // Tomato marks stuck where it was hit.
    while (this.marks.children.length < bot.marks.length) { const m = new T.Mesh(this.markMesh, this.markMat); m.scale.setScalar(this.kind === 'boss' ? 2.4 : 1); this.marks.add(m); }
    const r = this.kind === 'boss' ? 1.35 : this.kind === 'vac' ? .42 : .3;
    bot.marks.forEach((mark, i) => { const m = this.marks.children[i]; m.position.set(Math.sin(mark.a + Math.PI / 2) * r, mark.y, Math.cos(mark.a + Math.PI / 2) * r); m.visible = bot.alive; });
  }
  dispose() { this.disposed = true; this.root.removeFromParent(); for (const g of this.parts.values()) g.traverse(o => { if (o instanceof T.Mesh && o.userData.owned) o.geometry.dispose(); }); this.material.dispose(); }
}

/** Glove and sleeve paint for each thrower (pure #ff00ff and #00ffff markers in the Unity arms). */
const ARM_PAINT: Record<string, { glove: string; sleeve: string }> = {
  original: { glove: '#e2c3a3', sleeve: '#ffffff' }, chef: { glove: '#ffffff', sleeve: '#ffffff' }, robot: { glove: '#9a9a9a', sleeve: '#cfcfcf' },
  knight: { glove: '#cfcfcf', sleeve: '#9a9a9a' }, abuela: { glove: '#b8b8b8', sleeve: '#5c5c5c' }, luchador: { glove: '#151515', sleeve: '#e2c3a3' },
};
function repaint(source: T.BufferGeometry, glove: string, sleeve: string) {
  const g = source.clone(), attr = g.getAttribute('color') as T.BufferAttribute, a = new T.Color(glove), b = new T.Color(sleeve);
  // Colours here are plain grey levels for the two-tone renderer: read the hex values directly.
  const raw = (c: T.Color) => c.clone().convertLinearToSRGB();
  const ga = raw(a), gb = raw(b);
  for (let i = 0; i < attr.count; i++) { const r = attr.getX(i), gr = attr.getY(i), bl = attr.getZ(i); if (r > .9 && gr < .1 && bl > .9) attr.setXYZ(i, ga.r, ga.g, ga.b); else if (r < .1 && gr > .9 && bl > .9) attr.setXYZ(i, gb.r, gb.g, gb.b); }
  attr.needsUpdate = true; return g;
}

/** The thrower's arm in front of the camera, with a tomato ready in the hand. */
export class HandModel {
  readonly root = new T.Group(); private arm = new T.Group(); private mesh: T.Mesh | null = null; private style = ''; private parts: Map<string, Part> | null = null; private disposed = false;
  readonly tomato: T.Mesh; private material = new T.MeshLambertMaterial({ vertexColors: true });
  constructor() {
    this.root.add(this.arm); this.root.position.set(.3, -.34, -.62);
    this.tomato = new T.Mesh(new T.SphereGeometry(.085, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(1, 0, 0) })); this.tomato.position.set(0, .1, -.12); this.arm.add(this.tomato);
    const stem = new T.Mesh(new T.ConeGeometry(.03, .04, 5), new T.MeshBasicMaterial({ color: 0x000000 })); stem.position.set(0, .085, 0); this.tomato.add(stem);
    const shine = new T.Mesh(new T.SphereGeometry(.022, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(-.035, .04, .06); this.tomato.add(shine);
    loadPack().then(parts => { if (!this.disposed) { this.parts = parts; const s = this.style; this.style = ''; this.setStyle(s || 'original'); } }).catch(() => undefined);
  }
  setStyle(style: string) {
    if (style === this.style) return; this.style = style;
    if (this.mesh) { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh = null; }
    const kind = THROWERS[style]?.hand ?? 'glove', source = this.parts?.get(`hand${kind}`), paint = ARM_PAINT[style] ?? ARM_PAINT.original;
    const geometry = source ? repaint(source.geometry, paint.glove, paint.sleeve) : new T.BoxGeometry(.16, .1, .5).translate(0, 0, .1).setAttribute('color', new T.BufferAttribute(new Float32Array(24 * 3).fill(.85), 3));
    this.mesh = new T.Mesh(geometry, this.material); this.mesh.rotation.y = Math.PI; this.arm.add(this.mesh);
  }
  /** `throwing` runs 1 → 0 over a throw; `ready` shows the next tomato. */
  update(bob: number, speed: number, throwing: number, ready: boolean, hurt: number, reduced: boolean) {
    const s = reduced ? 0 : 1, walk = Math.min(1, Math.abs(speed) / 4) * s;
    this.root.position.set(.3 + Math.sin(bob * 2) * .02 * walk, -.34 - Math.abs(Math.cos(bob * 2)) * .025 * walk - hurt * .08, -.62);
    // Wind back, then snap forward.
    const p = 1 - throwing, swing = throwing > 0 ? (p < .3 ? -p / .3 : -1 + (p - .3) / .7 * 2.2) : 0;
    this.arm.position.set(0, swing < 0 ? -swing * .05 : swing * .06, swing < 0 ? -swing * .12 : -swing * .22);
    this.arm.rotation.set(swing < 0 ? swing * .5 : swing * .35, 0, swing * .1);
    this.tomato.visible = ready && throwing < .25;
  }
  dispose() { this.disposed = true; this.root.removeFromParent(); this.mesh?.geometry.dispose(); this.material.dispose(); this.tomato.geometry.dispose(); (this.tomato.material as T.Material).dispose(); }
}
