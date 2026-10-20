import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Kit colors for one team. Stripe B gives referees (and striped kits) their bands. */
export interface Kit { shirt: string; stripe: string; shorts: string; socks: string; boots: string; gloves?: string }
export const KITS = {
  rival: { shirt: '#7b3fe4', stripe: '#6b31d6', shorts: '#ef4a2c', socks: '#7b3fe4', boots: '#ffd23f' },
  rivalKeeper: { shirt: '#ff6a1f', stripe: '#ff8540', shorts: '#1d1d24', socks: '#ff6a1f', boots: '#1d1d24', gloves: '#d8f45a' },
  home: { shirt: '#ff4fa3', stripe: '#ff6fb6', shorts: '#ffffff', socks: '#ff4fa3', boots: '#2a2140' },
  homeKeeper: { shirt: '#ff4fa3', stripe: '#ff74b8', shorts: '#2a2140', socks: '#ff4fa3', boots: '#ffffff', gloves: '#ffffff' },
  referee: { shirt: '#17171c', stripe: '#f4f4f4', shorts: '#17171c', socks: '#17171c', boots: '#17171c' },
} satisfies Record<string, Kit>;
const SKINS = ['#f2c7a5', '#c98f68', '#9a6141', '#6e4129', '#e8b38f', '#f6d7bf'], HAIRS = ['#2b1b10', '#5a3a1e', '#d9a648', '#121212', '#8b3a1e', '#3a2a22'];
/** Pure marker colors authored in the Unity studio (see ModboxArt.Footballer). */
const MARKERS: [keyof Kit | 'skin' | 'hair', string][] = [['shirt', '#ff00ff'], ['stripe', '#8000ff'], ['shorts', '#00ffff'], ['skin', '#ffff00'], ['hair', '#00ff00'], ['socks', '#ff0000'], ['boots', '#0000ff'], ['gloves', '#ff8000']];
const PARTS = ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const;
type Part = typeof PARTS[number];
/** Pivot of each part on the one-unit-tall rig (matches the Unity export). */
const PIVOTS: Record<Part, [number, number, number]> = { body: [0, .4, 0], head: [0, .73, 0], armL: [-.2, .69, 0], armR: [.2, .69, 0], legL: [-.085, .36, 0], legR: [.085, .36, 0] };

let rig: Promise<Map<Part, T.BufferGeometry>> | null = null;
/** Loads the Unity footballer once; every player clones its geometry. Rejects when the model is unavailable. */
function loadRig(): Promise<Map<Part, T.BufferGeometry>> {
  rig ??= new Promise((resolve, reject) => {
    new GLTFLoader().load('/models/unity/footballer.glb', gltf => {
      const parts = new Map<Part, T.BufferGeometry>();
      gltf.scene.traverse(o => { if (o instanceof T.Mesh && (PARTS as readonly string[]).includes(o.name)) parts.set(o.name as Part, o.geometry); });
      if (parts.size === PARTS.length) resolve(parts); else reject(new Error('Incomplete footballer model'));
    }, undefined, reject);
  });
  return rig;
}

/** Procedural stand-in with the same pivots, used until the Unity model arrives (or if it cannot load). */
function fallbackPart(part: Part): T.BufferGeometry {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => { const g = new T.BoxGeometry(w, h, d).translate(x, y, z); paintAll(g, color); return g; };
  const ball = (r: number, x: number, y: number, z: number, color: string) => { const g = new T.SphereGeometry(r, 12, 8).translate(x, y, z); paintAll(g, color); return g; };
  const join = (list: T.BufferGeometry[]) => { const merged = mergeSimple(list); list.forEach(g => g.dispose()); return merged; };
  switch (part) {
    case 'body': return join([box(.33, .15, .21, 0, .01, 0, '#00ffff'), box(.36, .29, .22, 0, .19, 0, '#ff00ff')]);
    case 'head': return join([ball(.145, 0, .14, 0, '#ffff00'), ball(.15, 0, .19, .03, '#00ff00')]);
    case 'armL': case 'armR': return join([box(.085, .1, .1, 0, -.05, 0, '#ff00ff'), box(.07, .2, .07, 0, -.17, 0, '#ffff00'), ball(.045, 0, -.27, 0, '#ff8000')]);
    default: return join([box(.085, .15, .085, 0, -.08, 0, '#ffff00'), box(.086, .15, .086, 0, -.22, 0, '#ff0000'), box(.085, .07, .17, 0, -.32, .04, '#0000ff')]);
  }
}
function paintAll(g: T.BufferGeometry, hex: string) { const c = new T.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 4); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b, 1], i * 4); g.setAttribute('color', new T.BufferAttribute(a, 4)); }
function mergeSimple(list: T.BufferGeometry[]): T.BufferGeometry {
  const out = new T.BufferGeometry(), pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = []; let base = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.getX(i), c.getY(i), c.getZ(i), 1); }
    const index = g.index!; for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + base); base += p.count;
  }
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 4)); out.setIndex(idx); return out;
}
/** Swaps marker colors for a team's kit, skin and hair. Works on a private copy of the geometry. */
function repaint(source: T.BufferGeometry, colors: Record<string, string>): T.BufferGeometry {
  const g = source.clone(), attr = g.getAttribute('color') as T.BufferAttribute, keys = MARKERS.map(([k, hex]) => [k, new T.Color(hex)] as const), c = new T.Color();
  const targets = Object.fromEntries(Object.entries(colors).map(([k, hex]) => [k, new T.Color(hex)]));
  for (let i = 0; i < attr.count; i++) {
    c.setRGB(attr.getX(i), attr.getY(i), attr.getZ(i));
    for (const [k, marker] of keys) if (Math.abs(c.r - marker.r) + Math.abs(c.g - marker.g) + Math.abs(c.b - marker.b) < .06) { const t = targets[k] ?? targets.skin; attr.setXYZ(i, t.r, t.g, t.b); break; }
  }
  attr.needsUpdate = true; return g;
}

export type Pose = 'idle' | 'run' | 'keeper' | 'celebrate' | 'dejected' | 'point' | 'kick';
const SKIN_MATERIAL = new T.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .04 });
const ROBOT_MATERIAL = new T.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .55 });

/**
 * One animated footballer. Limbs are pivot groups, so the same animation drives the Unity model and the fallback.
 * Styles (robot, astronaut, armored) repaint the rig and add gear; the kit keeps its team colors so sides stay readable.
 */
export class Footballer {
  readonly root = new T.Group(); readonly pivot = new T.Group(); readonly limbs = {} as Record<Part, T.Group>;
  private meshes = new Map<Part, T.Mesh>(); private style = ''; private unity = false; private disposed = false;
  pose: Pose = 'idle'; speed = 0; private clock = Math.random() * 10; private kickTimer = 0; private flip = 0;
  /** Dive tilt (-1 to 1, sideways) and how far the body is knocked back (0 to 1). */
  dive = 0; knocked = 0;
  constructor(public kit: Kit, readonly seed: number, scale = .74) {
    this.root.add(this.pivot); this.pivot.scale.setScalar(scale);
    // Head and arms ride on the body, so a lean carries them; legs hang from the hips.
    for (const part of PARTS) { const g = new T.Group(); this.limbs[part] = g; }
    for (const part of PARTS) { const upper = part === 'head' || part === 'armL' || part === 'armR', [x, y, z] = PIVOTS[part], [bx, by, bz] = PIVOTS.body; this.limbs[part].position.set(upper ? x - bx : x, upper ? y - by : y, upper ? z - bz : z); (upper ? this.limbs.body : this.pivot).add(this.limbs[part]); }
    this.build(new Map(PARTS.map(p => [p, fallbackPart(p)])), false);
    loadRig().then(parts => { if (!this.disposed) { this.unity = true; this.build(parts, true); this.root.userData.unityLoaded = true; } }).catch(() => { this.root.userData.unityLoaded = false; });
  }
  private colors(style: string): Record<string, string> {
    const k = this.kit, skin = SKINS[this.seed % SKINS.length], hair = HAIRS[(this.seed * 7 + 3) % HAIRS.length];
    const base = { shirt: k.shirt, stripe: k.stripe, shorts: k.shorts, socks: k.socks, boots: k.boots, gloves: k.gloves ?? skin, skin, hair };
    if (style === 'robot') return { ...base, skin: '#b9c6d3', hair: '#47525f', gloves: k.gloves ?? '#8e9aa8' };
    if (style === 'astronaut') return { ...base, shirt: '#f2f4f8', stripe: k.shirt, shorts: k.shirt, socks: k.shirt, gloves: '#f2f4f8', boots: '#d5dae3' };
    if (style === 'armored') return { ...base, shirt: '#3b4058', stripe: k.shirt, shorts: '#2a2e40', gloves: '#3b4058', boots: '#2a2e40', socks: k.shirt };
    return base;
  }
  private build(source: Map<Part, T.BufferGeometry>, owned: boolean) {
    const style = this.style || 'original', colors = this.colors(style), material = style === 'robot' || style === 'armored' ? ROBOT_MATERIAL : SKIN_MATERIAL;
    for (const part of PARTS) {
      const old = this.meshes.get(part); if (old) { old.removeFromParent(); old.geometry.dispose(); }
      const mesh = new T.Mesh(repaint(source.get(part)!, colors), material); mesh.castShadow = true; mesh.receiveShadow = false; this.limbs[part].add(mesh); this.meshes.set(part, mesh);
    }
    if (!owned) source.forEach(g => g.dispose());
    this.sourceParts = owned ? source : null;
  }
  private sourceParts: Map<Part, T.BufferGeometry> | null = null;
  private lookKey = '';
  /** Dresses the player in a kit and a character style; repaints only when something changed. */
  setLook(kit: Kit, style: string) { const key = JSON.stringify(kit) + style; if (key === this.lookKey) return; this.lookKey = key; this.kit = kit; this.style = ''; this.setStyle(style); }
  /** Applies a character style: repaints the kit and swaps the gear. */
  setStyle(style: string) {
    if (style === this.style) return; this.style = style;
    this.build(this.sourceParts ?? new Map(PARTS.map(p => [p, fallbackPart(p)])), Boolean(this.sourceParts));
    for (const part of PARTS) for (const child of [...this.limbs[part].children]) if (child.userData.gear && child instanceof T.Mesh) { child.removeFromParent(); child.geometry.dispose(); (child.material as T.Material).dispose(); }
    const team = new T.MeshStandardMaterial({ color: this.kit.shirt, roughness: .35, metalness: .3 }), glow = new T.MeshBasicMaterial({ color: '#5ff3ff' });
    const add = (part: Part, geometry: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number) => { const m = new T.Mesh(geometry, mat); m.position.set(x, y, z); m.userData.gear = true; m.castShadow = true; this.limbs[part].add(m); return m; };
    if (style === 'robot') { add('head', new T.BoxGeometry(.26, .05, .03), glow, 0, .15, .14); add('head', new T.CylinderGeometry(.012, .012, .14, 6), team, .07, .33, 0); add('head', new T.SphereGeometry(.03, 8, 6), glow, .07, .41, 0); }
    if (style === 'astronaut') { add('head', new T.SphereGeometry(.22, 18, 12), new T.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: .32, roughness: .05, metalness: .2, depthWrite: false }), 0, .15, 0).castShadow = false; add('body', new T.BoxGeometry(.26, .24, .1), new T.MeshStandardMaterial({ color: '#dfe4ec', roughness: .5 }), 0, .2, -.16); }
    if (style === 'armored') { for (const side of [-1, 1]) { add(side < 0 ? 'armL' : 'armR', new T.BoxGeometry(.15, .07, .16), team, 0, .02, 0); add('head', new T.ConeGeometry(.04, .14, 6), new T.MeshStandardMaterial({ color: '#f0d27a', metalness: .6, roughness: .3 }), side * .12, .32, 0).rotation.z = -side * .5; } }
  }
  /** Starts a quick kick with the right foot (or a header-style lunge for keepers). */
  kick() { this.kickTimer = .35; }
  backflip() { this.flip = 1; }
  update(dt: number, reduced: boolean) {
    const t = (this.clock += dt), L = this.limbs, s = reduced ? 0 : 1;
    this.kickTimer = Math.max(0, this.kickTimer - dt); this.flip = Math.max(0, this.flip - dt * .9);
    const reset = () => { for (const part of PARTS) L[part].rotation.set(0, 0, 0); this.pivot.position.set(0, 0, 0); this.pivot.rotation.set(0, 0, 0); };
    reset();
    const breathe = Math.sin(t * 2.4) * .015 * s;
    switch (this.pose) {
      case 'run': {
        const phase = t * (8 + this.speed * 4), swing = Math.sin(phase) * .8 * Math.min(1, .3 + this.speed) * s;
        L.legL.rotation.x = swing; L.legR.rotation.x = -swing; L.armL.rotation.x = -swing * .8; L.armR.rotation.x = swing * .8; L.armL.rotation.z = -.15; L.armR.rotation.z = .15;
        this.pivot.position.y = Math.abs(Math.cos(phase)) * .03 * s; L.body.rotation.x = .12; break;
      }
      case 'keeper': {
        // Ready crouch: knees bent, gloves out. A dive throws the whole body sideways.
        const shuffle = Math.min(1, Math.abs(this.speed)) * Math.sin(t * 14) * .25 * s;
        L.legL.rotation.z = -.22 + shuffle; L.legR.rotation.z = .22 + shuffle; L.legL.rotation.x = L.legR.rotation.x = -.35; this.pivot.position.y = -.035;
        L.body.rotation.x = .25; L.armL.rotation.z = -.9; L.armR.rotation.z = .9; L.armL.rotation.x = L.armR.rotation.x = -.6; L.head.rotation.x = -.2;
        if (this.dive) { const d = this.dive; this.pivot.rotation.z = -d * 1.25; this.pivot.position.x = d * .22; this.pivot.position.y = .05; L.armL.rotation.z = -2.7; L.armR.rotation.z = 2.7; L.legL.rotation.z = -.3; L.legR.rotation.z = .3; }
        break;
      }
      case 'celebrate': {
        const hop = Math.abs(Math.sin(t * 7)) * s;
        this.pivot.position.y = hop * .16; L.armL.rotation.z = -2.6 - Math.sin(t * 14) * .25 * s; L.armR.rotation.z = 2.6 + Math.sin(t * 14) * .25 * s; L.legL.rotation.x = -hop * .5; L.legR.rotation.x = hop * .3; break;
      }
      case 'dejected': L.body.rotation.x = .35; L.head.rotation.x = .45; L.armL.rotation.set(-2.4, 0, -.35); L.armR.rotation.set(-2.4, 0, .35); break;
      case 'point': L.armR.rotation.set(-1.45, 0, .1); L.armL.rotation.z = -.1; L.head.rotation.x = -.1; break;
      default: { L.armL.rotation.z = -.12 - breathe * 3; L.armR.rotation.z = .12 + breathe * 3; L.legL.rotation.z = -.04; L.legR.rotation.z = .04; this.pivot.position.y = breathe * .5; L.body.rotation.y = Math.sin(t * .8) * .08 * s; }
    }
    if (this.kickTimer > 0) { const k = Math.sin((1 - this.kickTimer / .35) * Math.PI); L.legR.rotation.x = -1.3 * k; L.armL.rotation.x = -.8 * k; L.armR.rotation.x = .6 * k; L.body.rotation.x = -.15 * k; }
    if (this.flip > 0) { const p = 1 - this.flip; this.pivot.rotation.x = -p * Math.PI * 2; this.pivot.position.y = Math.sin(p * Math.PI) * .55; L.legL.rotation.x = L.legR.rotation.x = -Math.sin(p * Math.PI) * 1.2; }
    if (this.knocked > 0) { this.pivot.rotation.x = this.knocked * 1.35; this.pivot.position.z = -this.knocked * .25; this.pivot.position.y = this.knocked * .05; }
  }
  get loadedFromUnity() { return this.unity; }
  dispose() { this.disposed = true; this.root.removeFromParent(); this.root.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); if (o.material !== SKIN_MATERIAL && o.material !== ROBOT_MATERIAL) (o.material as T.Material).dispose(); } }); }
}
