import * as T from 'three';
import { material, mesh, type Shapes } from './world';
import type { PickupKind } from './runner';

const capsule = (r: number, h: number) => new T.CapsuleGeometry(r, h, 4, 10);
const limb = (parent: T.Object3D, mat: T.Material, r: number, h: number, y: number) => { const m = mesh(capsule(r, h), mat, parent, 0, y, 0); return m; };

export interface Hero { root: T.Group; figure: T.Group; legs: T.Group[]; arms: T.Group[]; shield: T.Mesh; board: T.Group; jetpack: T.Group; flames: T.Mesh[] }
/** A rounded, readable runner: a hoodie kid with a cap for the city, an explorer with a hat for the jungle. */
export function heroModel(shapes: Shapes, paint: T.Material, urban: boolean): Hero {
  const root = new T.Group(), figure = new T.Group(); root.add(figure);
  const skin = material('#f0bf98', .6), pants = material(urban ? '#2f4a7d' : '#6b5a3e', .7), shoe = material(urban ? '#ffffff' : '#4a3426', .5), sole = material(urban ? '#ff5a3c' : '#2a1e16', .6);
  const top = urban ? paint : material('#c9b27a', .7), hair = material(urban ? '#3b2618' : '#5b3a22', .8);
  const torso = mesh(capsule(.27, .34), top, figure, 0, 1.08, 0); torso.scale.set(1, 1, .78);
  mesh(new T.SphereGeometry(.27, 20, 14), skin, figure, 0, 1.68, 0);
  const hairCap = mesh(new T.SphereGeometry(.285, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hair, figure, 0, 1.7, .02); hairCap.rotation.x = -.15;
  for (const side of [-1, 1]) { const ear = mesh(new T.SphereGeometry(.06, 8, 6), skin, figure, side * .26, 1.68, .02); ear.scale.z = .6; }
  if (urban) {
    const cap = material('#e8423b', .6); const crown = mesh(new T.SphereGeometry(.29, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cap, figure, 0, 1.78, 0); crown.scale.y = .7;
    const brim = shapes.cube(figure, cap, 0, 1.79, .3, .34, .04, .24); brim.rotation.x = -.1;
    const phones = material('#20242c', .4, .3); for (const side of [-1, 1]) shapes.ball(figure, phones, side * .28, 1.69, 0, .09);
    const bag = shapes.cube(figure, material('#ffb238', .7), 0, 1.1, -.28, .42, .48, .2); bag.rotation.x = -.08;
    const hood = mesh(new T.TorusGeometry(.2, .06, 8, 18), top, figure, 0, 1.42, -.1); hood.rotation.x = Math.PI / 2;
  } else {
    const felt = material('#7a5532', .8), band = material('#3d2a1a', .7);
    shapes.tube(figure, felt, 0, 1.94, 0, .44, .04); shapes.tube(figure, felt, 0, 2.03, 0, .25, .2); shapes.tube(figure, band, 0, 1.97, 0, .255, .05);
    const strap = shapes.cube(figure, material('#5c3d24', .7), 0, 1.15, 0, .07, .62, .48); strap.rotation.z = .7;
    shapes.cube(figure, material('#8a5d34', .7), .24, .86, -.12, .26, .24, .14);
  }
  const legs: T.Group[] = [], arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(side * .14, .82, 0); figure.add(leg);
    limb(leg, pants, .1, .42, -.28); const foot = shapes.cube(leg, shoe, 0, -.66, .06, .19, .13, .34); foot.castShadow = true; shapes.cube(leg, sole, 0, -.72, .06, .2, .04, .35, false); legs.push(leg);
    const arm = new T.Group(); arm.position.set(side * .36, 1.36, 0); figure.add(arm); limb(arm, top, .085, .34, -.2); shapes.ball(arm, skin, 0, -.48, 0, .085); arms.push(arm);
  }
  figure.rotation.y = Math.PI;
  const shield = mesh(new T.SphereGeometry(1.2, 24, 16), new T.MeshBasicMaterial({ color: '#8befff', transparent: true, opacity: .14, depthWrite: false }), root, 0, 1, 0, false);
  const board = new T.Group(); root.add(board); const deck = shapes.cube(board, paint, 0, .05, 0, .7, .08, 1.7); deck.material = material('#ff4fb0', .4, .2);
  shapes.cube(board, new T.MeshBasicMaterial({ color: '#7ff9ff' }), 0, -.01, 0, .5, .03, 1.4, false);
  const jetpack = new T.Group(); jetpack.position.set(0, 1.12, .33); root.add(jetpack); const flames: T.Mesh[] = [];
  for (const side of [-1, 1]) {
    shapes.tube(jetpack, material('#d9dee6', .25, .8), side * .14, 0, 0, .11, .55); shapes.ball(jetpack, material('#ff6a3c', .4), side * .14, .3, 0, .11);
    const flame = mesh(new T.ConeGeometry(.1, .5, 10), new T.MeshBasicMaterial({ color: '#ffb23d', transparent: true, opacity: .9 }), jetpack, side * .14, -.5, 0, false); flame.rotation.x = Math.PI; flames.push(flame);
  }
  board.visible = jetpack.visible = shield.visible = false;
  return { root, figure, legs, arms, shield, board, jetpack, flames };
}

export interface Chaser { root: T.Group; runners: { body: T.Group; legs: T.Object3D[]; arms: T.Object3D[] }[] }
/** The pursuers: a ticket inspector and his dog in the city, three temple monkeys in the jungle. */
export function chaserModel(shapes: Shapes, urban: boolean): Chaser {
  const root = new T.Group(), runners: Chaser['runners'] = [];
  if (urban) {
    const coat = material('#1f2f55', .7), skin = material('#e8b48f', .6), body = new T.Group(); root.add(body);
    const torso = mesh(capsule(.33, .45), coat, body, 0, 1.12, 0); torso.scale.z = .8; shapes.ball(body, skin, 0, 1.82, 0, .27);
    shapes.tube(body, coat, 0, 2.05, 0, .26, .14); shapes.cube(body, material('#111827'), 0, 2.0, -.24, .36, .04, .16);
    shapes.cube(body, material('#5a3a26'), 0, 1.73, -.25, .2, .05, .04); shapes.cube(body, material('#ffd34d', .3, .6), .14, 1.3, -.28, .08, .08, .02);
    const legs: T.Object3D[] = [], arms: T.Object3D[] = [];
    for (const side of [-1, 1]) { const leg = new T.Group(); leg.position.set(side * .15, .8, 0); body.add(leg); limb(leg, coat, .11, .45, -.3); shapes.cube(leg, material('#111'), 0, -.66, -.06, .2, .12, .32); legs.push(leg);
      const arm = new T.Group(); arm.position.set(side * .42, 1.42, 0); body.add(arm); limb(arm, coat, .09, .38, -.22); arms.push(arm); }
    runners.push({ body, legs, arms });
    const dog = new T.Group(); dog.position.set(1.1, 0, .6); root.add(dog); const fur = material('#9a6a3a', .8), dlegs: T.Object3D[] = [];
    const trunk = mesh(capsule(.18, .5), fur, dog, 0, .5, 0); trunk.rotation.x = Math.PI / 2; shapes.ball(dog, fur, 0, .68, -.42, .17); shapes.cube(dog, material('#2b1d12'), 0, .66, -.6, .1, .08, .1);
    for (const side of [-1, 1]) { const ear = shapes.cube(dog, material('#6b4526'), side * .1, .82, -.4, .06, .14, .08); ear.rotation.z = side * .3; }
    for (const [x, z] of [[-.1, -.25], [.1, -.25], [-.1, .25], [.1, .25]]) { const leg = new T.Group(); leg.position.set(x, .38, z); dog.add(leg); limb(leg, fur, .05, .22, -.18); dlegs.push(leg); }
    runners.push({ body: dog, legs: dlegs, arms: [] });
  } else {
    const fur = material('#2b2230', .9), face = material('#8a6a5a', .7), eye = new T.MeshBasicMaterial({ color: '#ff3b3b' });
    for (let i = 0; i < 3; i++) {
      const body = new T.Group(); body.position.set((i - 1) * 1.2, 0, i === 1 ? -.5 : .4); body.scale.setScalar(.85 + (i % 2) * .15); root.add(body);
      const trunk = mesh(capsule(.3, .4), fur, body, 0, 1, 0); trunk.rotation.x = -.35; shapes.ball(body, fur, 0, 1.55, -.18, .26); const muzzle = shapes.ball(body, face, 0, 1.5, -.38, .13); muzzle.scale.z = .7;
      for (const side of [-1, 1]) { shapes.ball(body, eye, side * .09, 1.6, -.4, .04, false); shapes.ball(body, face, side * .26, 1.6, -.16, .07); }
      const legs: T.Object3D[] = [], arms: T.Object3D[] = [];
      for (const side of [-1, 1]) { const leg = new T.Group(); leg.position.set(side * .16, .62, 0); body.add(leg); limb(leg, fur, .09, .32, -.24); legs.push(leg);
        const arm = new T.Group(); arm.position.set(side * .38, 1.25, -.1); body.add(arm); limb(arm, fur, .08, .6, -.38); arms.push(arm); }
      runners.push({ body, legs, arms });
    }
  }
  return { root, runners };
}

const PICKUP_COLOR: Record<PickupKind, string> = { magnet: '#ff4d4d', double: '#a55cff', jetpack: '#ff9a2e', sprint: '#ffd54a' };
/** Floating power-up tokens with a soft glow. */
export function pickupModel(shapes: Shapes, kind: PickupKind, halo: T.Texture): T.Group {
  const root = new T.Group(), inner = new T.Group(); inner.position.y = 1.1; root.add(inner); const color = PICKUP_COLOR[kind];
  if (kind === 'magnet') {
    const red = material('#e8383d', .35, .2), steel = material('#e7ecf3', .2, .9), arc = mesh(new T.TorusGeometry(.28, .1, 10, 24, Math.PI), red, inner); arc.rotation.z = Math.PI;
    for (const side of [-1, 1]) { shapes.tube(inner, red, side * .28, .12, 0, .1, .24); shapes.tube(inner, steel, side * .28, .3, 0, .1, .12); }
  } else if (kind === 'double') {
    const disc = shapes.tube(inner, material('#8a3df0', .3, .3), 0, 0, 0, .42, .1); disc.rotation.x = Math.PI / 2;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.font = '900 72px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2×', 64, 68);
    const tex = new T.CanvasTexture(c); for (const z of [-.06, .06]) { const face = mesh(new T.PlaneGeometry(.62, .62), new T.MeshBasicMaterial({ map: tex, transparent: true }), inner, 0, 0, z, false); if (z < 0) face.rotation.y = Math.PI; }
  } else if (kind === 'jetpack') {
    for (const side of [-1, 1]) { shapes.tube(inner, material('#dfe4ec', .2, .85), side * .16, 0, 0, .13, .6); shapes.ball(inner, material('#ff7a2e', .4), side * .16, .34, 0, .13); }
    shapes.cube(inner, material('#3b4a66', .5), 0, 0, .08, .26, .5, .12);
  } else {
    const gold = material('#ffcf3a', .25, .8); for (const side of [-1, 1]) { const wing = shapes.ball(inner, gold, side * .2, 0, 0, .32); wing.scale.set(.6, .25, 1); wing.rotation.z = side * .5; }
    shapes.ball(inner, material('#fff2b0', .2, .6), 0, 0, 0, .14);
  }
  const glow = new T.Sprite(new T.SpriteMaterial({ map: halo, color, blending: T.AdditiveBlending, transparent: true, depthWrite: false })); glow.scale.setScalar(1.8); glow.position.y = 1.1; root.add(glow);
  root.userData.inner = inner; return root;
}

export function haloTexture(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.4, 'rgba(255,255,255,.3)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
}
const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
};
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
/** Procedural textures shared by the runner scenery. */
export function runnerTextures(night: boolean) {
  seed = 7;
  const facade = canvas(128, 128, g => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    for (let y = 8; y < 128; y += 32) for (let x = 8; x < 128; x += 30) { const lit = night && rnd() < .55; g.fillStyle = lit ? '#ffe7a3' : night ? '#2a3550' : '#7fb3d9'; g.fillRect(x, y, 18, 20); g.fillStyle = '#00000022'; g.fillRect(x, y + 17, 18, 3); }
  });
  const graffiti = canvas(512, 128, g => {
    g.fillStyle = '#c8c2b8'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#00000014'; for (let x = 0; x < 512; x += 64) g.fillRect(x, 0, 2, 128);
    const colors = ['#ff4fb0', '#3fd2ff', '#ffd23d', '#7cff6b', '#ff7a2e', '#a55cff'];
    for (let i = 0; i < 10; i++) { g.fillStyle = colors[i % colors.length]; g.globalAlpha = .85; g.beginPath(); g.ellipse(rnd() * 512, 40 + rnd() * 60, 30 + rnd() * 50, 14 + rnd() * 22, rnd(), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1; g.font = '900 46px Arial Black, Arial'; g.lineWidth = 6;
    for (const [t, x] of [['RUN!', 30], ['MODBOX', 170], ['GO GO', 380]] as const) { g.strokeStyle = '#1c1c28'; g.strokeText(t, x, 90); g.fillStyle = colors[(x / 10) % colors.length | 0]; g.fillText(t, x, 90); }
  });
  const ballast = canvas(64, 64, g => { g.fillStyle = '#7d6e62'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 260; i++) { g.fillStyle = ['#5f5248', '#968779', '#6f645c', '#a99a8b'][i % 4]; g.fillRect(rnd() * 64, rnd() * 64, 2 + rnd() * 3, 2 + rnd() * 3); } });
  const stone = canvas(128, 128, g => {
    g.fillStyle = '#9b8f78'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 * 32; x < 160; x += 64) { g.fillStyle = ['#a89b82', '#93876f', '#b0a48a'][(x + y) / 32 % 3 | 0]; g.fillRect(x - 32 + 2, y + 2, 60, 28); }
    for (let i = 0; i < 40; i++) { g.fillStyle = '#5f8a4a66'; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, 2 + rnd() * 5, 0, Math.PI * 2); g.fill(); }
  });
  const wall = canvas(128, 128, g => {
    g.fillStyle = '#6f6656'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 21) for (let x = (y / 21) % 2 * 20; x < 148; x += 40) { g.fillStyle = ['#7a705e', '#685f50', '#82775f'][(x + y) % 3]; g.fillRect(x - 20 + 1, y + 1, 38, 19); }
    for (let i = 0; i < 60; i++) { g.fillStyle = '#4f7a3c88'; g.beginPath(); g.arc(rnd() * 128, rnd() * 50, 2 + rnd() * 6, 0, Math.PI * 2); g.fill(); }
  });
  return { facade, graffiti, ballast, stone, wall, dispose() { for (const t of [facade, graffiti, ballast, stone, wall]) t.dispose(); } };
}
