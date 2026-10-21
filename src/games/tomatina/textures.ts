import * as T from 'three';

/**
 * Line-art textures for every town. Everything is drawn in greys: white is paper, black is ink, and greys become
 * dither in the two-tone renderer (see view.ts). Pure red (#ff0000) becomes tomato red.
 * Wall atlases hold four 2 m wide facades side by side; 64 px per metre, 5 m tall, drawn from the ground up.
 */
export const PX = 64, ATLAS_W = 512, ATLAS_H = 320;
type G = CanvasRenderingContext2D;
const Y = (h: number) => ATLAS_H - h * PX;
const tone = (v: number) => { const c = Math.round(v * 255); return `rgb(${c},${c},${c})`; };

function canvas(w: number, h: number, background = '#ffffff'): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = background; g.fillRect(0, 0, w, h); g.strokeStyle = '#000'; g.fillStyle = '#000'; g.lineWidth = 2; g.lineCap = 'square'; g.lineJoin = 'miter'; return [c, g];
}
function texture(c: HTMLCanvasElement, repeat = true, mip = true): T.CanvasTexture {
  const t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; t.magFilter = T.NearestFilter; t.minFilter = mip ? T.LinearMipmapLinearFilter : T.NearestFilter; t.generateMipmaps = mip;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
const rnd = (seed: number) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

// ------------------------------------------------------------------ drawing primitives (x/w in px, heights in metres)
function line(g: G, x1: number, y1: number, x2: number, y2: number, w = 2) { g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
function box(g: G, x: number, h0: number, w: number, h: number, lw = 2) { g.lineWidth = lw; g.strokeRect(x + .5, Y(h0 + h) + .5, w - 1, h * PX - 1); }
function shade(g: G, x: number, h0: number, w: number, h: number, v: number) { g.fillStyle = tone(v); g.fillRect(x, Y(h0 + h), w, h * PX); g.fillStyle = '#000'; }
/** Cell edges, ground line and cornice: the outline every facade shares so corners read as corners. */
function frame(g: G, x: number, height: number) { line(g, x + 1, Y(height), x + 1, Y(0), 2); line(g, x + 127, Y(height), x + 127, Y(0), 2); line(g, x, Y(0) - 1, x + 128, Y(0) - 1, 3); line(g, x, Y(height) + 1, x + 128, Y(height) + 1, 3); }
function plinth(g: G, x: number, h: number, v = .78) { shade(g, x, 0, 128, h, v); line(g, x, Y(h), x + 128, Y(h), 2); }
function shutters(g: G, x: number, h0: number, w: number, h: number) {
  shade(g, x, h0, w, h, .45); box(g, x, h0, w, h); line(g, x + w / 2, Y(h0 + h), x + w / 2, Y(h0), 2);
  for (let k = 1; k < h * 10; k++) { const y = Y(h0) - k * 6.4; if (y > Y(h0 + h) + 2) line(g, x + 3, y, x + w - 3, y, 1); }
  line(g, x - 4, Y(h0) + 2, x + w + 4, Y(h0) + 2, 3);
}
function windowPane(g: G, x: number, h0: number, w: number, h: number, dark = .32) { shade(g, x, h0, w, h, dark); box(g, x, h0, w, h, 3); line(g, x + w / 2, Y(h0 + h), x + w / 2, Y(h0), 2); line(g, x, Y(h0 + h * .62), x + w, Y(h0 + h * .62), 2); }
function railing(g: G, x: number, h0: number, w: number) { box(g, x, h0, w, .12, 2); line(g, x - 4, Y(h0 + .85), x + w + 4, Y(h0 + .85), 3); for (let k = 6; k < w; k += 8) line(g, x + k, Y(h0 + .85), x + k, Y(h0 + .12), 1); }
function pot(g: G, x: number, h0: number) { g.beginPath(); g.moveTo(x - 7, Y(h0 + .25)); g.lineTo(x + 7, Y(h0 + .25)); g.lineTo(x + 5, Y(h0)); g.lineTo(x - 5, Y(h0)); g.closePath(); g.fillStyle = tone(.6); g.fill(); g.stroke(); g.fillStyle = '#000'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(x + k * 6, Y(h0 + .34), 4, 0, Math.PI * 2); g.fillStyle = '#ff0000'; g.fill(); g.stroke(); } g.fillStyle = '#000'; }
function door(g: G, x: number, w: number, h: number, arch = true) {
  g.lineWidth = 3; g.beginPath(); g.moveTo(x, Y(0)); g.lineTo(x, Y(h - (arch ? w / 2 / PX : 0)));
  if (arch) g.arc(x + w / 2, Y(h - w / 2 / PX), w / 2, Math.PI, 0); else g.lineTo(x + w, Y(h));
  g.lineTo(x + w, Y(0)); g.stroke(); g.save(); g.clip(); shade(g, x, 0, w, h, .55); g.restore();
  for (let k = 1; k < 4; k++) line(g, x + w * k / 4, Y(h - .5), x + w * k / 4, Y(0), 1);
  g.beginPath(); g.arc(x + w * .78, Y(h * .45), 2.5, 0, Math.PI * 2); g.fill();
}
function sign(g: G, x: number, h0: number, w: number, h: number, text: string, invert = false) {
  shade(g, x, h0, w, h, invert ? 0 : 1); box(g, x, h0, w, h, 3);
  g.fillStyle = invert ? '#fff' : '#000'; g.font = `bold ${Math.round(h * PX * .62)}px "Courier New", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, Y(h0 + h / 2) + 1, w - 6); g.fillStyle = '#000';
}
function lattice(g: G, x: number, h0: number, w: number, h: number, step = 12, back = .3) {
  g.save(); g.beginPath(); g.rect(x, Y(h0 + h), w, h * PX); g.clip(); shade(g, x, h0, w, h, back); g.strokeStyle = '#fff'; g.lineWidth = 2;
  for (let k = -h * PX; k < w + h * PX; k += step) { line(g, x + k, Y(h0), x + k + h * PX, Y(h0 + h)); line(g, x + k, Y(h0 + h), x + k + h * PX, Y(h0)); }
  g.restore(); g.strokeStyle = '#000'; box(g, x, h0, w, h, 3);
}
function stones(g: G, x: number, h0: number, h: number, seed: number) {
  const r = rnd(seed); for (let row = 0; row * .4 < h; row++) { const y0 = h0 + row * .4; line(g, x, Y(y0), x + 128, Y(y0), 1); let cx = x + (row % 2) * 22 - 22; while (cx < x + 128) { cx += 28 + r() * 26; if (cx < x + 126) line(g, cx, Y(y0), cx, Y(Math.min(h0 + h, y0 + .4)), 1); } }
}
function tiles(g: G, x: number, h0: number, w: number, h: number, size = 16, bevel = true) {
  for (let ty = 0; ty * size < h * PX; ty++) for (let tx = 0; tx * size < w; tx++) { const px = x + tx * size, py = Y(h0) - (ty + 1) * size; g.lineWidth = 1; g.strokeRect(px + .5, py + .5, size, size); if (bevel) { g.fillStyle = tone(.82); g.fillRect(px + 2, py + size - 3, size - 3, 2); g.fillStyle = '#000'; } }
}
function roofTiles(g: G, x: number, h0: number) { shade(g, x, h0, 128, .28, .62); for (let k = 0; k < 128; k += 10) { g.beginPath(); g.arc(x + k + 5, Y(h0), 5, Math.PI, 0); g.stroke(); } line(g, x, Y(h0 + .28), x + 128, Y(h0 + .28), 2); }
function arch(g: G, x: number, w: number, h: number, horseshoe = false, back = .25) {
  const r = w / 2, cx = x + r, cy = Y(h) + r; g.lineWidth = 3; g.beginPath(); g.moveTo(x, Y(0)); g.lineTo(x, cy);
  if (horseshoe) g.arc(cx, cy, r, Math.PI * .9, Math.PI * .1, false); else g.arc(cx, cy, r, Math.PI, 0); g.lineTo(x + w, Y(0)); g.closePath();
  g.save(); g.clip(); shade(g, x, 0, w, h, back); g.restore(); g.stroke();
}
function star8(g: G, cx: number, cy: number, r: number) { g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * .55 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.stroke(); }
function mosaic(g: G, x: number, h0: number, w: number, h: number, seed: number, dark = .7) {
  const r = rnd(seed); g.save(); g.beginPath(); g.rect(x, Y(h0 + h), w, h * PX); g.clip();
  for (let i = 0; i < w * h * PX / 90; i++) { const cx = x + r() * w, cy = Y(h0) - r() * h * PX, s = 5 + r() * 7; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r(); g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s * .8); } g.closePath(); g.fillStyle = tone(r() < .3 ? dark : r() < .08 ? 0 : .97); g.fill(); g.lineWidth = 1; g.stroke(); }
  g.restore(); g.fillStyle = '#000';
}

// ------------------------------------------------------------------ facades
type Painter = (g: G, x: number, v: number) => void;
const FACADES: Record<string, Record<string, Painter>> = {
  classic: {
    '#': (g, x, v) => { // whitewashed house: plinth, door or windows with shutters, balcony, tiled roof
      plinth(g, x, .55); roofTiles(g, x, 4.32);
      if (v === 0) { door(g, x + 40, 48, 2.3); shutters(g, x + 38, 3.05, 52, 1.05); railing(g, x + 30, 2.85, 68); }
      if (v === 1) { shutters(g, x + 18, 1.2, 34, 1.15); shutters(g, x + 76, 1.2, 34, 1.15); shutters(g, x + 18, 3.05, 34, 1.05); shutters(g, x + 76, 3.05, 34, 1.05); pot(g, x + 35, 2.42); pot(g, x + 93, 2.42); line(g, x + 12, Y(2.42), x + 58, Y(2.42), 3); line(g, x + 70, Y(2.42), x + 116, Y(2.42), 3); }
      if (v === 2) { windowPane(g, x + 44, 1.5, 40, 1); line(g, x + 118, Y(4.3), x + 118, Y(.55), 3); for (let k = 1; k < 6; k++) line(g, x + 114, Y(k * .75), x + 122, Y(k * .75), 2); sign(g, x + 30, 3.2, 68, .42, 'BUÑOL'); }
      if (v === 3) { shutters(g, x + 40, 1.1, 48, 1.3); railing(g, x + 24, 2.85, 80); shutters(g, x + 40, 3.05, 48, 1.05); for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x + 18 + k * 22, Y(4.1)); g.lineTo(x + 26 + k * 22, Y(3.75)); g.lineTo(x + 34 + k * 22, Y(4.1)); g.fillStyle = k % 2 ? '#ff0000' : '#fff'; g.fill(); g.stroke(); } g.fillStyle = '#000'; line(g, x, Y(4.1), x + 128, Y(4.1), 1); }
      frame(g, x, 4.6);
    },
    '%': (g, x, v) => { plinth(g, x, .3, .7); lattice(g, x + 14, .6, 100, 2.1, v % 2 ? 14 : 11, .28); line(g, x + 8, Y(2.9), x + 120, Y(2.9), 3); frame(g, x, 3.2); },
    '|': (g, x, v) => { // shop fronts with awnings and signs
      const name = ['TOMATES', 'BAR', 'PAN', 'FRUTA'][v]; plinth(g, x, .3, .7); sign(g, x + 10, 2.75, 108, .5, name, v === 1);
      for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(x + 6 + k * 15, Y(2.6)); g.lineTo(x + 21 + k * 15, Y(2.6)); g.lineTo(x + 21 + k * 15 + 2, Y(2.2)); g.lineTo(x + 4 + k * 15, Y(2.2)); g.closePath(); g.fillStyle = k % 2 ? tone(.35) : '#fff'; g.fill(); g.stroke(); }
      g.fillStyle = '#000'; if (v % 2) windowPane(g, x + 16, .5, 96, 1.5, .4); else { shade(g, x + 14, .35, 100, 1.8, .7); box(g, x + 14, .35, 100, 1.8, 3); for (let k = 1; k < 18; k++) line(g, x + 14, Y(.35) - k * 6.4, x + 114, Y(.35) - k * 6.4, 1); }
      frame(g, x, 3.6);
    },
    '=': (g, x, v) => { stones(g, x, 0, 4, 11 + v); if (v % 2) { shade(g, x + 50, 1.6, 28, .9, .2); box(g, x + 50, 1.6, 28, .9, 3); for (let k = 1; k < 4; k++) line(g, x + 50 + k * 7, Y(2.5), x + 50 + k * 7, Y(1.6), 2); } else { g.beginPath(); g.arc(x + 64, Y(2.6), 16, 0, Math.PI * 2); g.stroke(); line(g, x + 64, Y(2.6), x + 64, Y(2.6) - 11, 2); line(g, x + 64, Y(2.6), x + 72, Y(2.6), 2); } frame(g, x, 4); },
  },
  boqueria: {
    '#': (g, x, v) => { // market stall: crates of fruit, striped awning and a hanging sign
      const name = ['FRUTAS', 'VERDURAS', 'PESCADO', 'JAMÓN'][v]; shade(g, x, 0, 128, .9, .55); box(g, x + 4, 0, 120, .9, 2);
      for (let k = 0; k < 3; k++) { box(g, x + 8 + k * 39, .9, 36, .45, 2); for (let f = 0; f < 4; f++) { g.beginPath(); g.arc(x + 14 + k * 39 + f * 8, Y(1.4), 5, 0, Math.PI * 2); g.fillStyle = k === 1 ? '#ff0000' : f % 2 ? '#fff' : tone(.4); g.fill(); g.stroke(); } }
      g.fillStyle = '#000'; for (let k = 0; k < 8; k++) { shade(g, x + k * 16, 2.45, 16, .55, k % 2 ? .3 : 1); g.beginPath(); g.arc(x + k * 16 + 8, Y(2.45), 8, 0, Math.PI); g.fillStyle = k % 2 ? tone(.3) : '#fff'; g.fill(); g.stroke(); }
      g.fillStyle = '#000'; line(g, x, Y(3), x + 128, Y(3), 3); sign(g, x + 14, 3.3, 100, .5, name); line(g, x + 30, Y(3.8), x + 30, Y(4.5), 2); line(g, x + 98, Y(3.8), x + 98, Y(4.5), 2);
      frame(g, x, 4.6);
    },
    '%': (g, x) => { shade(g, x, 0, 128, .5, .5); for (let k = 0; k < 4; k++) { box(g, x + k * 32, .5, 32, 2.4, 2); line(g, x + k * 32 + 16, Y(2.9), x + k * 32 + 16, Y(.5), 1); } g.beginPath(); g.arc(x + 64, Y(2.9), 60, Math.PI, 0); g.stroke(); frame(g, x, 3.2); },
    '|': (g, x, v) => { tiles(g, x, 0, 128, 3.6, 16); sign(g, x + 24, 1.8, 80, .5, v % 2 ? 'MERCAT' : 'OLIVAS'); frame(g, x, 3.6); },
    '=': (g, x, v) => { for (let r = 0; r * .25 < 4; r++) { line(g, x, Y(r * .25), x + 128, Y(r * .25), 1); for (let c = (r % 2) * 16; c < 128; c += 32) line(g, x + c, Y(r * .25), x + c, Y(r * .25 + .25), 1); } sign(g, x + 18, 2.4, 92, .55, v % 2 ? 'BOQUERIA' : 'MERCAT', true); frame(g, x, 4); },
  },
  alhambra: {
    '#': (g, x, v) => { // arcade of horseshoe arches over slender columns
      shade(g, x, 3.9, 128, .7, .82); lattice(g, x + 6, 3.95, 116, .55, 8, .5);
      arch(g, x + 18, 92, 3.2, true, v % 2 ? .22 : .3); for (const cx of [x + 14, x + 114]) { box(g, cx - 4, 0, 8, 2.6, 2); box(g, cx - 7, 2.6, 14, .14, 2); }
      tiles(g, x, 0, 128, .45, 14, false); frame(g, x, 4.6);
    },
    '%': (g, x, v) => { shade(g, x, 0, 128, 1.3, .9); for (let k = 0; k < 4; k++) for (let r = 0; r < 2; r++) star8(g, x + 16 + k * 32, Y(.33 + r * .65), 13); line(g, x, Y(1.35), x + 128, Y(1.35), 3); lattice(g, x + 8, 1.6, 112, 1.3, v % 2 ? 9 : 7, .72); frame(g, x, 3.2); },
    '|': (g, x) => { lattice(g, x + 24, .9, 80, 2.2, 8, .2); arch(g, x + 20, 88, 3.3, true, 1); box(g, x + 18, .8, 92, .1, 2); frame(g, x, 3.6); },
    '=': (g, x, v) => { stones(g, x, 0, 3.5, 30 + v); for (let k = 0; k < 4; k++) { box(g, x + 4 + k * 32, 3.5, 22, .5, 2); } shade(g, x + 56, 1.4, 14, 1, .1); frame(g, x, 4); },
  },
  metro: {
    '#': (g, x, v) => { tiles(g, x, 0, 128, 4.6, 16); shade(g, x, 1.7, 128, .3, .15); if (v % 2) sign(g, x + 24, 2.5, 80, .55, 'SOL', true); else sign(g, x + 14, 2.6, 100, .4, 'SALIDA →'); frame(g, x, 4.6); },
    '%': (g, x, v) => { tiles(g, x, 0, 128, 3.2, 16); box(g, x + 14, .9, 100, 1.7, 4); shade(g, x + 16, .92, 96, 1.66, 1);
      if (v % 2) { g.beginPath(); g.arc(x + 64, Y(1.8), 26, 0, Math.PI * 2); g.fillStyle = '#ff0000'; g.fill(); g.stroke(); g.fillStyle = '#000'; line(g, x + 64, Y(2.25), x + 64, Y(2.45), 4); sign(g, x + 20, .95, 88, .3, 'TOMATINA'); }
      else { for (let k = 0; k < 5; k++) line(g, x + 26, Y(2.3 - k * .2), x + 100 - k * 9, Y(2.3 - k * .2), 3); sign(g, x + 20, .95, 88, .3, 'FIESTA 26 AGO'); }
      frame(g, x, 3.2);
    },
    '|': (g, x) => { tiles(g, x, 0, 128, 3.6, 16); arch(g, x + 8, 112, 3.2, false, .08); line(g, x + 8, Y(.3), x + 120, Y(.3), 3); frame(g, x, 3.6); },
    '=': (g, x, v) => { tiles(g, x, 0, 128, 4, 16); box(g, x + 12, 1.1, 104, 1.6, 3); shade(g, x + 14, 1.12, 100, 1.56, .9); for (let k = 0; k < 4; k++) { line(g, x + 20, Y(1.4 + k * .35), x + 108, Y(1.4 + k * .35 + (v % 2 ? .1 : -.1)), 3); g.beginPath(); g.arc(x + 30 + k * 22, Y(1.4 + k * .35), 4, 0, Math.PI * 2); g.fill(); } frame(g, x, 4); },
  },
  guell: {
    '#': (g, x, v) => { mosaic(g, x, 0, 128, 4.6, 40 + v); shade(g, x, 1.6, 128, .5, 1); g.beginPath(); for (let k = 0; k <= 128; k += 4) g.lineTo(x + k, Y(1.85 + Math.sin(k / 18 + v) * .2)); g.stroke(); frame(g, x, 4.6); },
    '%': (g, x, v) => { mosaic(g, x, 0, 128, 1.1, 50 + v, .5); g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= 128; k += 4) g.lineTo(x + k, Y(1.1 + Math.sin(k / 20 + v * 2) * .25)); g.stroke(); stones(g, x, 1.4, 1.8, 60 + v); frame(g, x, 3.2); },
    '|': (g, x, v) => { for (let k = 0; k < 3; k++) { const cx = x + 20 + k * 44 + (v % 2) * 6; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, Y(0)); g.lineTo(cx - 12 + k * 4, Y(3.6)); g.moveTo(cx + 8, Y(0)); g.lineTo(cx + 4 + k * 4, Y(3.6)); g.stroke(); for (let r = 0; r < 9; r++) line(g, cx - 8, Y(r * .4), cx + 8, Y(r * .4 + .1), 1); } frame(g, x, 3.6); },
    '=': (g, x, v) => { shade(g, x, 3.1, 128, .9, .45); g.beginPath(); for (let k = 0; k <= 128; k += 4) g.lineTo(x + k, Y(3.1 + Math.abs(Math.sin(k / 16 + v)) * .3)); g.stroke(); windowPane(g, x + 44, 1.6, 40, .9); door(g, x + 48, 32, 1.3, true); mosaic(g, x, 0, 128, .4, 70 + v, .6); frame(g, x, 4); },
  },
};
export const WALL_KINDS = ['#', '%', '|', '='] as const;

const cache = new Map<string, T.CanvasTexture>();
function cached(key: string, make: () => T.CanvasTexture) { let t = cache.get(key); if (!t) { t = make(); cache.set(key, t); } return t; }
/** A town's atlas for one wall kind: four facades, chosen per wall face. */
export function wallAtlas(town: string, kind: string): T.CanvasTexture {
  return cached(`wall:${town}:${kind}`, () => { const [c, g] = canvas(ATLAS_W, ATLAS_H); const paint = (FACADES[town] ?? FACADES.classic)[kind]; for (let v = 0; v < 4; v++) paint(g, v * 128, v); return texture(c); });
}
/** A plain wall with a bullseye at chest height: tomato red once it has been hit. */
export function targetTexture(town: string, hit: boolean): T.CanvasTexture {
  return cached(`target:${town}:${hit}`, () => {
    const [c, g] = canvas(128, ATLAS_H); FACADES[town]?.['=']?.(g, 0, 1); shade(g, 8, .5, 112, 2.6, 1);
    for (let r = 5; r >= 1; r--) { g.beginPath(); g.arc(64, Y(1.7), r * 10, 0, Math.PI * 2); g.fillStyle = r % 2 ? (hit ? '#ff0000' : '#000') : '#fff'; g.fill(); g.lineWidth = 2; g.stroke(); }
    g.fillStyle = '#000'; sign(g, 24, 2.6, 80, .35, hit ? '¡OLÉ!' : 'DIANA', hit); frame(g, 0, 3.6); return texture(c, true);
  });
}
/** Floor tiles for one 2 m street cell. The plaza variant is dotted so you can see where to paint. */
export function floorTexture(town: string, zone: boolean): T.CanvasTexture {
  return cached(`floor:${town}:${zone}`, () => {
    const [c, g] = canvas(128, 128), r = rnd(town.length * 7 + (zone ? 3 : 0));
    if (town === 'boqueria') { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) { g.fillStyle = tone(.84); g.fillRect(x * 32, y * 32, 32, 32); } g.fillStyle = '#000'; }
    else if (town === 'alhambra') { g.lineWidth = 2; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) star8(g, 32 + x * 64, 32 + y * 64, 22); g.lineWidth = 3; g.strokeRect(1.5, 1.5, 125, 125); }
    else if (town === 'metro') { for (let k = 0; k <= 128; k += 32) { line(g, k, 0, k, 128, 2); line(g, 0, k, 128, k, 2); } }
    else if (town === 'guell') { const [cc, gg] = [c, g]; void cc; for (let i = 0; i < 22; i++) { const cx = r() * 128, cy = r() * 128, s = 6 + r() * 8; gg.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r(); gg.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); } gg.closePath(); gg.fillStyle = tone(r() < .25 ? .82 : .98); gg.fill(); gg.lineWidth = 1; gg.stroke(); } }
    else { g.lineWidth = 3; line(g, 0, 1, 128, 1, 3); line(g, 1, 0, 1, 128, 3); line(g, 0, 64, 128, 64, 2); line(g, 64 + (r() < .5 ? -20 : 20), 0, 64 + (r() < .5 ? -20 : 20), 64, 2); line(g, 64, 64, 64, 128, 2); g.lineWidth = 2; g.beginPath(); g.arc(30 + r() * 60, 30 + r() * 60, 5, 0, Math.PI * 1.2); g.stroke(); }
    if (zone) { g.fillStyle = '#000'; for (let y = 4; y < 128; y += 8) for (let x = (y / 8 % 2) * 4 + 4; x < 128; x += 8) g.fillRect(x, y, 2, 2); }
    return texture(c);
  });
}
/** Skyline painted around the town above the rooftops. */
export function skylineTexture(town: string): T.CanvasTexture {
  return cached(`sky:${town}`, () => {
    const [c, g] = canvas(1024, 256), base = 230, r = rnd(town.length * 31);
    g.fillStyle = '#000'; g.lineWidth = 2;
    const hills = (amp: number, y: number, f: number) => { g.beginPath(); g.moveTo(0, 256); for (let x = 0; x <= 1024; x += 8) g.lineTo(x, y - Math.abs(Math.sin(x / f)) * amp - Math.sin(x / (f * .37)) * amp * .3); g.lineTo(1024, 256); g.closePath(); g.fillStyle = tone(.9); g.fill(); g.stroke(); };
    const tower = (x: number, w: number, h: number, top: 'bell' | 'spire' | 'dome' | 'flat') => {
      g.fillStyle = '#fff'; g.fillRect(x, base - h, w, h); g.strokeRect(x + .5, base - h + .5, w, h);
      if (top === 'spire') { g.beginPath(); g.moveTo(x - 2, base - h); g.lineTo(x + w / 2, base - h - w * 2.2); g.lineTo(x + w + 2, base - h); g.closePath(); g.fillStyle = tone(.4); g.fill(); g.stroke(); }
      if (top === 'dome') { g.beginPath(); g.arc(x + w / 2, base - h, w / 2, Math.PI, 0); g.fillStyle = tone(.75); g.fill(); g.stroke(); }
      if (top === 'bell') { g.fillStyle = tone(.2); g.fillRect(x + w * .3, base - h + 8, w * .4, 14); g.beginPath(); g.moveTo(x - 3, base - h); g.lineTo(x + w / 2, base - h - 16); g.lineTo(x + w + 3, base - h); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.stroke(); }
      g.fillStyle = '#000';
    };
    if (town === 'alhambra') { hills(70, 150, 90); for (let k = 0; k < 9; k++) tower(40 + k * 110 + r() * 20, 30 + r() * 20, 40 + r() * 50, 'flat'); for (let k = 0; k < 14; k++) { const x = r() * 1024; g.beginPath(); g.ellipse(x, base - 30, 6, 32, 0, 0, Math.PI * 2); g.fillStyle = tone(.3); g.fill(); g.stroke(); } }
    else if (town === 'guell') { hills(30, 190, 70); for (let k = 0; k < 4; k++) tower(120 + k * 22, 14, 120 + (k % 2) * 30, 'spire'); for (let k = 0; k < 6; k++) { const x = 400 + k * 100; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - 50); g.quadraticCurveTo(x + 25, base - 95, x + 50, base - 50); g.lineTo(x + 50, base); g.fillStyle = tone(.92); g.fill(); g.stroke(); } }
    else if (town === 'metro') { for (let k = 0; k < 26; k++) { const w = 26 + r() * 30, h = 40 + r() * 110; g.fillStyle = '#fff'; g.fillRect(k * 40, base - h, w, h); g.strokeRect(k * 40 + .5, base - h + .5, w, h); for (let wy = base - h + 8; wy < base - 6; wy += 12) for (let wx = k * 40 + 5; wx < k * 40 + w - 5; wx += 9) { g.fillStyle = tone(r() < .5 ? .3 : .8); g.fillRect(wx, wy, 4, 6); } } g.fillStyle = '#000'; sign(g, 600, 2.6, 160, .6, 'TÍO PEPE', true); }
    else if (town === 'boqueria') { hills(20, 200, 60); for (let k = 0; k < 12; k++) { const x = k * 90; g.beginPath(); g.moveTo(x, base); g.lineTo(x + 45, base - 70 - r() * 30); g.lineTo(x + 90, base); g.fillStyle = tone(.85); g.fill(); g.stroke(); } tower(480, 40, 140, 'dome'); }
    else { hills(90, 130, 120); tower(300, 36, 110, 'bell'); tower(720, 28, 80, 'bell'); for (let k = 0; k < 30; k++) { const x = k * 36 + r() * 10, h = 30 + r() * 40; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h); g.lineTo(x + 18, base - h - 12); g.lineTo(x + 36, base - h); g.lineTo(x + 36, base); g.fillStyle = '#fff'; g.fill(); g.stroke(); } }
    line(g, 0, base, 1024, base, 3);
    const t = texture(c); t.wrapT = T.ClampToEdgeWrapping; return t;
  });
}
/** A juicy splat with droplets, in pure red on transparent. */
export function splatTexture(): T.CanvasTexture {
  return cached('splat', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, r = rnd(5); g.fillStyle = '#ff0000';
    g.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, d = 17 + r() * 9; g.lineTo(32 + Math.cos(a) * d, 32 + Math.sin(a) * d); } g.closePath(); g.fill();
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = 26 + r() * 4; g.beginPath(); g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 2 + r() * 2.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c40000'; g.beginPath(); g.arc(27, 28, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#000'; g.fillRect(30, 30, 2, 2); g.fillRect(36, 26, 2, 2);
    const t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; return t;
  });
}
/** Iron bars for gates, with a little fiesta sign. */
export function gateTexture(): T.CanvasTexture {
  return cached('gate', () => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d')!; g.fillStyle = '#000';
    for (let k = 4; k < 128; k += 14) { g.fillRect(k, 10, 5, 182); g.beginPath(); g.moveTo(k - 2, 12); g.lineTo(k + 2.5, 0); g.lineTo(k + 7, 12); g.fill(); }
    g.fillRect(0, 40, 128, 6); g.fillRect(0, 150, 128, 6); g.fillStyle = '#fff'; g.fillRect(30, 80, 68, 30); g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(30, 80, 68, 30); g.fillStyle = '#000'; g.font = 'bold 16px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('CERRADO', 64, 101);
    const t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; return t;
  });
}
/** The fiesta arch sign: open (¡FIESTA!) or still closed. */
export function exitTexture(open: boolean): T.CanvasTexture {
  return cached(`exit:${open}`, () => {
    const [c, g] = canvas(256, 64, open ? '#ff0000' : '#ffffff'); g.lineWidth = 4; g.strokeRect(2, 2, 252, 60); g.fillStyle = open ? '#fff' : '#000'; g.font = 'bold 34px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(open ? '¡FIESTA!' : 'CERRADO', 128, 34);
    return texture(c, false, false);
  });
}
/** The tomato crate label. */
export function crateTexture(): T.CanvasTexture {
  return cached('crate', () => { const [c, g] = canvas(64, 64, tone(.86)); for (let k = 0; k < 4; k++) line(g, 0, k * 16 + 1, 64, k * 16 + 1, 2); box(g, 0, 0, 64, 1, 3); g.fillStyle = '#fff'; g.fillRect(8, 22, 48, 20); g.strokeRect(8, 22, 48, 20); g.fillStyle = '#ff0000'; g.font = 'bold 11px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('TOMATES', 32, 36); return texture(c, false, false); });
}
export function disposeTextures() { cache.forEach(t => t.dispose()); cache.clear(); }
