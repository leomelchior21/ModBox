import * as T from 'three';
import { Shapes, material, mesh } from '../three-kit/world';

/** Tiny seeded generator so every pixel texture is identical on every load. */
function random(seed: number) { let s = seed >>> 0; return () => { s = s * 1664525 + 1013904223 >>> 0; return s / 4294967296; }; }
type Painter = (ctx: CanvasRenderingContext2D, px: (x: number, y: number, color: string) => void, rnd: () => number) => void;
function pixels(width: number, height: number, seed: number, paint: Painter): T.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!, rnd = random(seed);
  paint(ctx, (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }, rnd);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.magFilter = T.NearestFilter; texture.minFilter = T.NearestMipmapLinearFilter;
  texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 4; return texture;
}
const speckle = (base: string, accents: readonly string[], amount: number): Painter => (ctx, px, rnd) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < ctx.canvas.height; y++) for (let x = 0; x < ctx.canvas.width; x++) if (rnd() < amount) px(x, y, accents[Math.floor(rnd() * accents.length)]);
};

/** Drive-Mad-inspired voxel materials. Eight texels per meter keeps the chunky look at any distance. */
export function courseTextures() {
  return {
    grass: pixels(8, 8, 3, speckle('#58d14a', ['#4cc13f', '#6be05a', '#41b337'], .22)),
    // Side of the turf cap: bright grass with a ragged darker fringe hanging over the cliff face.
    fringe: pixels(8, 8, 5, (_ctx, px, rnd) => {
      for (let x = 0; x < 8; x++) {
        const drop = 3 + Math.floor(rnd() * 4);
        for (let y = 0; y < 8; y++) if (y < drop) px(x, y, y === drop - 1 ? '#2f9a33' : rnd() < .2 ? '#6be05a' : '#4cc63f');
      }
    }),
    face: pixels(8, 8, 7, speckle('#f8cdb0', ['#f2bf9f', '#fbd8bf', '#f5c6a7'], .18)),
    brick: pixels(8, 8, 9, (ctx, px, rnd) => {
      ctx.fillStyle = '#c97680'; ctx.fillRect(0, 0, 8, 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { if (y % 4 === 3 || (x + (y < 4 ? 0 : 4)) % 8 === 7) px(x, y, '#ac5d68'); else if (rnd() < .15) px(x, y, '#d88a92'); }
    }),
    ornament: pixels(8, 8, 11, (_ctx, px) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const ring = Math.min(x, y, 7 - x, 7 - y); px(x, y, ['#a9545f', '#e9a8a4', '#bb6470', '#f4c4b6'][ring]); }
    }),
    plank: pixels(8, 4, 13, (_ctx, px, rnd) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) px(x, y, y === 0 ? '#e2a1a6' : y === 3 ? '#9c5462' : rnd() < .2 ? '#b96874' : '#c87a85');
    }),
    crumble: pixels(8, 4, 17, (_ctx, px, rnd) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) px(x, y, y === 0 ? '#f0cc8a' : y === 3 ? '#9c6a3c' : rnd() < .25 ? '#b5813f' : '#d19b52');
      px(2, 1, '#6d4524'); px(3, 2, '#6d4524'); px(6, 1, '#6d4524');
    }),
    crate: pixels(8, 8, 19, (_ctx, px, rnd) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const edge = x === 0 || y === 0 || x === 7 || y === 7, diagonal = x === y || x === y + 1;
        px(x, y, edge ? '#8a4f22' : diagonal ? '#a8652d' : rnd() < .2 ? '#e3a35a' : '#d9924b');
      }
    }),
    metal: pixels(4, 4, 23, speckle('#aeb6c2', ['#8f98a6', '#c6ccd6'], .3)),
    checker: pixels(2, 2, 29, (_ctx, px) => { px(0, 0, '#202533'); px(1, 1, '#202533'); px(1, 0, '#f6f7fb'); px(0, 1, '#f6f7fb'); }),
  };
}
export type CourseTextures = ReturnType<typeof courseTextures>;

export function pixelMaterial(map: T.Texture, color: T.ColorRepresentation = '#ffffff', alphaTest = 0) {
  const m = material(color, .95, 0); m.map = map; if (alphaTest) { m.alphaTest = alphaTest; m.side = T.DoubleSide; } return m;
}

/** Box whose UVs are in meters so pixel textures tile at a constant voxel size. `sideBand` maps side faces 0..1 vertically. */
export function voxelBox(w: number, h: number, d: number, sideBand = false): T.BoxGeometry {
  const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv as T.BufferAttribute;
  const scale: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face++) for (let v = 0; v < 4; v++) {
    const i = face * 4 + v, [su, sv] = scale[face], band = sideBand && face !== 2 && face !== 3;
    uv.setXY(i, uv.getX(i) * su, band ? uv.getY(i) : uv.getY(i) * sv);
  }
  uv.needsUpdate = true; return g;
}

/** Procedural monster truck in the axle frame (x forward, y up, axle mounts at y = 0). Unity's model replaces it once loaded. */
export function buildTruck(shapes: Shapes, chassis: T.Group, paint: T.Material) {
  const grey = material('#a3abb7', .7, .15), dark = material('#2a2f3b', .8), glass = material('#29313f', .25, .3), red = material('#ff4b4b', .55), chrome = material('#dfe5ec', .3, .7), lamp = material('#fff3b8', .4);
  lamp.emissive.set('#ffe68a'); lamp.emissiveIntensity = .4;
  const c = (m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => shapes.cube(chassis, m, x, y, z, w, h, d);
  c(dark, 0, -.12, 0, 3.1, .22, 1.15);
  c(grey, .05, .28, 0, 3.55, .56, 1.86); c(red, .05, .3, 0, 3.58, .12, 1.9);
  c(paint, 1.12, .7, 0, 1.36, .32, 1.8); c(paint, -.25, .92, 0, 1.36, .76, 1.72); c(paint, -.25, 1.33, 0, 1.5, .12, 1.82);
  c(glass, .29, .98, 0, .2, .5, 1.6); for (const z of [-.87, .87]) c(glass, -.3, .98, z, .9, .46, .04);
  for (const z of [-.86, .86]) c(paint, -1.38, .7, z, .82, .3, .14); c(paint, -1.75, .7, 0, .1, .3, 1.86);
  c(chrome, 1.88, .12, 0, .2, .22, 2.02); for (const z of [-.62, .62]) c(lamp, 1.81, .58, z, .06, .18, .3); for (const z of [-.7, .7]) c(red, -1.82, .45, z, .06, .16, .25);
  for (const z of [-.48, .48]) { shapes.tube(chassis, chrome, -1.02, 1.42, z, .07, .6); shapes.ball(chassis, dark, -1.02, 1.74, z, .08); }
  c(dark, -.25, 1.52, 0, .9, .16, .12);
}
/** Voxel tire around the z axis: chunky lugs, a dark sidewall and a light hub. */
export function buildTire(shapes: Shapes, parent: T.Object3D, radius: number) {
  const rubber = material('#1d2029', .95), lug = material('#2c3140', .9), hub = material('#c3cad4', .35, .6), bolt = material('#7b8494', .4, .5);
  const tire = mesh(new T.CylinderGeometry(radius * .9, radius * .9, .62, 16), rubber, parent); tire.rotation.x = Math.PI / 2;
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, block = shapes.cube(parent, i % 2 ? lug : rubber, Math.cos(a) * radius * .9, Math.sin(a) * radius * .9, 0, .3, .2, .68); block.rotation.z = a;
  }
  for (const z of [-.33, .33]) {
    const disc = mesh(new T.CylinderGeometry(radius * .45, radius * .45, .04, 8), hub, parent, 0, 0, z); disc.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) shapes.cube(parent, bolt, Math.cos(i * Math.PI / 2) * radius * .26, Math.sin(i * Math.PI / 2) * radius * .26, z * 1.08, .09, .09, .04);
  }
}
