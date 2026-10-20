import * as T from 'three';
import { material, mesh, type Shapes } from '../three-kit/world';
import type { UnitKind, ZombieKind } from './levels';

/** Makita-style palette: the signature teal with charcoal plastics and brushed steel. */
export const TEAL = '#0aa6a8';
const mats = () => ({
  teal: material(TEAL, .45, .1), tealDark: material('#057c80', .5, .1), black: material('#1d2329', .6, .1), steel: material('#d7dee5', .25, .85),
  red: material('#d8392b', .45, .2), redDark: material('#a52519', .5, .2), yellow: material('#ffc928', .5), ice: material('#bff2ff', .2, .3), iceDark: material('#6fc9e6', .3, .2),
  orange: material('#ff8a1f', .5), led: material('#7dff8e', .3), dirt: material('#7a5434', .95),
});
const glow = (color: string) => { const m = material(color, .3); m.emissive.set(color); m.emissiveIntensity = .9; return m; };

/** A saw blade disc in the XY plane (facing the camera) with steel teeth; spin it around z. */
export function sawBlade(shapes: Shapes, parent: T.Object3D, radius: number, frost = false): T.Group {
  const m = mats(), blade = new T.Group(); parent.add(blade);
  const disc = mesh(new T.CylinderGeometry(radius, radius, .07, 28), frost ? m.ice : m.steel, blade); disc.rotation.x = Math.PI / 2;
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, tooth = shapes.cube(blade, frost ? m.ice : m.steel, Math.cos(a) * radius, Math.sin(a) * radius, 0, radius * .32, radius * .22, .07, false); tooth.rotation.z = a + .5; }
  const hub = mesh(new T.CylinderGeometry(radius * .32, radius * .32, .1, 16), frost ? m.iceDark : m.teal, blade); hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const slot = shapes.cube(blade, m.black, Math.cos(i * 2.09) * radius * .6, Math.sin(i * 2.09) * radius * .6, .045, radius * .3, radius * .08, .01, false); slot.rotation.z = i * 2.09; }
  return blade;
}

export interface UnitModel { root: T.Group; body: T.Group; blades: T.Group[]; lights: T.MeshStandardMaterial[] }
/** Tools stand on their tile centred at the origin, facing +x (towards the zombies). */
export function unitModel(shapes: Shapes, kind: UnitKind): UnitModel {
  const m = mats(), root = new T.Group(), body = new T.Group(); root.add(body);
  const c = (mat: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => shapes.cube(body, mat, x, y, z, w, h, d);
  const blades: T.Group[] = [], lights: T.MeshStandardMaterial[] = [];
  if (kind === 'saw' || kind === 'twin' || kind === 'frost') {
    const shell = kind === 'frost' ? m.ice : m.teal, trim = kind === 'frost' ? m.iceDark : m.tealDark;
    c(m.black, 0, .08, 0, .78, .16, .62); c(m.black, -.05, .3, 0, .18, .3, .18);
    c(shell, -.08, .62, 0, .62, .44, .5); c(trim, -.08, .62, .26, .5, .28, .04);
    c(m.black, -.08, .9, 0, .56, .1, .2); c(m.black, -.4, .64, 0, .2, .34, .44); c(shell, -.47, .64, 0, .08, .2, .34);
    for (const [i, y] of (kind === 'twin' ? [.72, .38] : [.62]).entries()) {
      const guard = mesh(new T.CylinderGeometry(.34, .34, .1, 20, 1, false, 0, Math.PI), m.steel, body, .38, y + .02, -.02); guard.rotation.x = Math.PI / 2; guard.rotation.y = Math.PI;
      const blade = sawBlade(shapes, body, .3, kind === 'frost'); blade.position.set(.38, y, .06 + i * .02); blades.push(blade);
    }
    if (kind === 'frost') for (let i = 0; i < 4; i++) shapes.ball(body, glow('#e9fbff'), -.1 + i * .12, 1.0 + (i % 2) * .08, .1, .05, false);
  } else if (kind === 'charger') {
    c(m.black, 0, .12, 0, .8, .24, .66); c(m.teal, 0, .3, 0, .7, .14, .56);
    c(m.black, 0, .58, 0, .5, .42, .38); c(m.teal, 0, .58, .2, .46, .3, .02); c(m.black, 0, .84, 0, .3, .1, .26);
    for (let i = 0; i < 3; i++) { const led = glow('#7dff8e'); lights.push(led); shapes.cube(body, led, .24, .3, -.12 + i * .12, .05, .06, .06); }
    const bolt = glow('#ffe066'); lights.push(bolt); c(bolt, 0, .6, .215, .1, .18, .01);
  } else if (kind === 'wall') {
    c(m.red, 0, .48, 0, 1.02, .9, .78); c(m.redDark, 0, .95, 0, 1.06, .08, .82); c(m.redDark, 0, .48, .4, .98, .06, .02);
    for (const x of [-.32, .32]) { c(m.steel, x, .82, .41, .14, .14, .04); c(m.steel, x, .3, .41, .2, .05, .03); }
    c(m.steel, 0, 1.08, 0, .5, .06, .08); for (const x of [-.25, .25]) c(m.steel, x, 1.02, 0, .06, .12, .08);
    c(m.black, 0, .55, .405, .3, .1, .01);
  } else if (kind === 'mine') {
    const mound = shapes.ball(body, m.dirt, 0, -.02, 0, .42); mound.scale.y = .32;
    c(m.black, 0, .14, 0, .34, .22, .34); c(m.steel, 0, .27, 0, .38, .05, .38);
    for (let i = 0; i < 8; i++) { const nail = shapes.cube(body, m.steel, Math.cos(i * .78) * .18, .33, Math.sin(i * .78) * .18, .03, .14, .03, false); nail.rotation.z = Math.cos(i * .78) * .5; }
    const lamp = glow('#ff3b2e'); lights.push(lamp); shapes.ball(body, lamp, 0, .34, 0, .06, false);
  } else {
    c(m.orange, -.12, .34, 0, .5, .38, .42); c(m.teal, -.12, .34, .22, .44, .26, .02); c(m.black, -.32, .62, 0, .34, .1, .12); c(m.black, -.4, .44, 0, .06, .3, .12);
    c(m.steel, .42, .34, 0, .7, .14, .05); c(m.black, .42, .34, .03, .74, .2, .02);
    const chain = new T.Group(); body.add(chain); for (let i = 0; i < 9; i++) shapes.cube(chain, m.black, .1 + i * .085, .43, .04, .05, .04, .05, false); blades.push(chain);
  }
  root.userData.kind = kind; return { root, body, blades, lights };
}

export interface ZombieModel { root: T.Group; body: T.Group; head: T.Group; legs: T.Group[]; arms: T.Group[]; skin: T.MeshStandardMaterial; hat: T.Object3D | null; flash: T.MeshStandardMaterial[] }
/** Construction-site zombies built from separate limbs so they can shamble, chew and fall apart. Faces -x. */
export function zombieModel(shapes: Shapes, kind: ZombieKind): ZombieModel {
  const root = new T.Group(), body = new T.Group(); root.add(body);
  const skin = material(kind === 'brute' ? '#8d9f6a' : '#97b585', .8), shirt = material(kind === 'runner' ? '#d43b3b' : kind === 'welder' ? '#5a4232' : '#f07d1e', .7);
  const pants = material(kind === 'runner' ? '#262c3a' : '#3d5a85', .8), boot = material('#3b2a20', .8), stripe = material('#fff27a', .5), eye = material('#f4f1d8', .4), pupil = material('#1b1b1b');
  const flash = [skin, shirt, pants];
  const legs: T.Group[] = [], arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(0, .62, side * .14); body.add(leg); legs.push(leg);
    shapes.cube(leg, pants, 0, -.28, 0, .2, .56, .2); shapes.cube(leg, boot, -.05, -.58, 0, .3, .12, .22);
  }
  shapes.cube(body, shirt, 0, .95, 0, .32, .56, .5); if (kind !== 'welder' && kind !== 'runner') for (const y of [.86, 1.06]) shapes.cube(body, stripe, -.165, y, 0, .02, .06, .5);
  if (kind === 'welder') shapes.cube(body, material('#8a6a4c', .9), -.17, .85, 0, .03, .6, .42);
  for (const side of [-1, 1]) {
    const arm = new T.Group(); arm.position.set(0, 1.16, side * .31); body.add(arm); arms.push(arm);
    const sleeve = shapes.cube(arm, shirt, -.12, 0, 0, .28, .15, .15); sleeve.rotation.z = 0;
    shapes.cube(arm, skin, -.38, -.02, 0, .26, .12, .12); shapes.ball(arm, skin, -.52, -.03, 0, .08);
  }
  const head = new T.Group(); head.position.set(-.02, 1.42, 0); body.add(head);
  shapes.cube(head, skin, 0, 0, 0, .36, .36, .34); shapes.cube(head, material('#4b3a2b'), .05, .19, 0, .3, .07, .32);
  for (const z of [-.08, .08]) { shapes.ball(head, eye, -.18, .04, z, .065, false); shapes.ball(head, pupil, -.225, .03 + (z > 0 ? .01 : -.01), z, .028, false); }
  shapes.cube(head, material('#3d2b25'), -.18, -.1, 0, .02, .05, .16, false);
  let hat: T.Object3D | null = null;
  if (kind === 'hardhat') { const h = new T.Group(); head.add(h); shapes.cube(h, material('#ffcf1f', .4), 0, .22, 0, .42, .14, .4); shapes.cube(h, material('#ffcf1f', .4), -.08, .16, 0, .56, .04, .46); hat = h; }
  if (kind === 'welder') { const h = new T.Group(); head.add(h); shapes.cube(h, material('#2b2f36', .4, .3), -.1, -.01, 0, .2, .42, .4); shapes.cube(h, material('#56d8ff', .2, .2), -.205, .05, 0, .02, .1, .26); hat = h; }
  if (kind === 'flag') { const pole = new T.Group(); arms[1].add(pole); shapes.tube(pole, material('#8a6b45'), -.5, .6, 0, .03, 1.5); shapes.cube(pole, material('#c73428', .7), -.25, 1.15, 0, .5, .34, .03); }
  if (kind === 'brute') { const hammer = new T.Group(); arms[1].add(hammer); shapes.tube(hammer, material('#8a6b45'), -.55, .3, 0, .05, .9); shapes.cube(hammer, material('#5c6670', .4, .6), -.55, .78, 0, .34, .2, .22); body.scale.set(1.35, 1.55, 1.45); }
  if (kind === 'runner') { shapes.cube(head, material('#f2f2f2'), .02, .15, 0, .38, .05, .36); }
  root.userData.kind = kind; return { root, body, head, legs, arms, skin, hat, flash };
}

export function batteryModel(shapes: Shapes): T.Group {
  const m = mats(), root = new T.Group();
  shapes.cube(root, m.black, 0, 0, 0, .46, .26, .3); shapes.cube(root, m.teal, 0, .17, 0, .4, .08, .26); shapes.cube(root, m.black, 0, .25, 0, .22, .07, .12);
  const bolt = glow('#ffe066'); shapes.cube(root, bolt, 0, .02, .155, .08, .16, .01, false);
  const halo = mesh(new T.TorusGeometry(.42, .03, 6, 32), new T.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: .75, depthWrite: false }), root, 0, 0, 0, false); halo.rotation.x = Math.PI / 2;
  return root;
}
export function sweeperModel(shapes: Shapes): T.Group {
  const m = mats(), root = new T.Group();
  shapes.cube(root, m.teal, 0, .28, 0, .7, .3, .66); shapes.cube(root, m.black, 0, .48, 0, .5, .12, .5); shapes.cube(root, m.black, -.3, .7, 0, .06, .4, .5); shapes.cube(root, m.steel, -.3, .9, 0, .06, .06, .56);
  for (const x of [-.22, .22]) for (const z of [-.3, .3]) { const wheel = mesh(new T.CylinderGeometry(.12, .12, .08, 12), m.black, root, x, .12, z); wheel.rotation.x = Math.PI / 2; }
  const blade = sawBlade(shapes, root, .24); blade.position.set(.4, .26, .36); root.userData.blade = blade;
  return root;
}
