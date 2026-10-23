import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Sentinel } from './run';

/** The Unity sentinel pack (ModboxArt.NeonSentinels): geometry and pivot per "<model>.<part>" node. */
interface Part { geometry: T.BufferGeometry; pivot: T.Vector3 }
let pack: Promise<Map<string, Part>> | null = null;
export function loadSentinels(): Promise<Map<string, Part>> {
  pack ??= new Promise((resolve, reject) => {
    new GLTFLoader().load('/models/unity/sentinels.glb', gltf => {
      const parts = new Map<string, Part>(), c = new T.Color();
      gltf.scene.traverse(o => {
        // three.js drops the dot from node names ("hunter.body" arrives as "hunterbody").
        const name = String(o.userData?.name ?? o.name).replace(/[^a-z]/gi, '').toLowerCase();
        if (!(o instanceof T.Mesh) || !/^(hunter|drone|warden|ufo)/.test(name)) return;
        const colors = o.geometry.getAttribute('color') as T.BufferAttribute | undefined;
        // Pure magenta marks the glowing body: paint it white so each sentinel can tint it with its own colour.
        if (colors) for (let i = 0; i < colors.count; i++) { c.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).convertLinearToSRGB(); if (c.r > .9 && c.g < .1 && c.b > .9) c.setRGB(1, 1, 1); colors.setXYZ(i, c.r, c.g, c.b); }
        parts.set(name, { geometry: o.geometry, pivot: o.position.clone() });
      });
      parts.size >= 7 ? resolve(parts) : reject(new Error('Incomplete sentinel pack'));
    }, undefined, reject);
  });
  return pack;
}

const NODES: Record<Sentinel['kind'] | 'ufo', string[]> = { hunter: ['body', 'eyes'], drone: ['body', 'eyes'], warden: ['body', 'ring'], ufo: ['body'] };
function fallback(kind: string, part: string): Part {
  const paint = (g: T.BufferGeometry) => { g.setAttribute('color', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; };
  const big = kind === 'warden' ? 1.6 : kind === 'drone' ? .6 : 1;
  if (part === 'body') return { geometry: paint(new T.SphereGeometry(.38 * big, 16, 12).translate(0, .45 * big, 0)), pivot: new T.Vector3() };
  return { geometry: paint(new T.TorusGeometry(.5 * big, .04, 6, 24).rotateX(Math.PI / 2).translate(0, .45 * big, 0)), pivot: new T.Vector3() };
}

/** A sentinel or the saucer on screen: a glowing body tinted per sentinel, eyes that look at you. */
export class SentinelModel {
  readonly root = new T.Group(); readonly hover = new T.Group(); readonly parts = new Map<string, T.Group>();
  readonly body = new T.MeshLambertMaterial({ vertexColors: true }); readonly eyes = new T.MeshBasicMaterial({ vertexColors: true, color: new T.Color(.62, .62, .66) });
  private disposed = false;
  constructor(readonly kind: Sentinel['kind'] | 'ufo', scale = 1) {
    this.root.add(this.hover); this.hover.scale.setScalar(scale);
    this.build(new Map(NODES[kind].map(p => [`${kind}${p}`, fallback(kind, p)])), true);
    loadSentinels().then(parts => { if (!this.disposed) this.build(parts, false); }).catch(() => undefined);
  }
  private build(parts: Map<string, Part>, owned: boolean) {
    for (const g of this.parts.values()) { g.removeFromParent(); g.traverse(o => { if (o instanceof T.Mesh && o.userData.owned) o.geometry.dispose(); }); }
    this.parts.clear();
    for (const name of NODES[this.kind]) {
      const part = parts.get(`${this.kind}${name}`); if (!part) continue;
      const pivot = new T.Group(), mesh = new T.Mesh(part.geometry, name === 'eyes' ? this.eyes : this.body); mesh.userData.owned = owned;
      pivot.position.copy(part.pivot); pivot.add(mesh); this.hover.add(pivot); this.parts.set(name, pivot);
      // Seen from a high camera, eyes need to be big and tilted up to read.
      if (name === 'eyes') { pivot.scale.setScalar(this.kind === 'drone' ? 1.5 : 1.45); pivot.rotation.order = 'YXZ'; pivot.rotation.x = -.55; pivot.position.y += this.kind === 'drone' ? .06 : .14; }
    }
  }
  /** Tints the glowing body: lit like a solid object, glowing from inside. */
  tint(color: T.ColorRepresentation, glow = .5) { this.body.color.set(color); this.body.emissive.set(color).multiplyScalar(glow); }
  dispose() { this.disposed = true; this.root.removeFromParent(); for (const g of this.parts.values()) g.traverse(o => { if (o instanceof T.Mesh && o.userData.owned) o.geometry.dispose(); }); this.body.dispose(); this.eyes.dispose(); }
}
