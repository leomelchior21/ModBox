import * as T from 'three';
import { GOAL, HOME, TABLE, CENTRE_SPOT } from './run';
import { KITS, type Kit } from './players';

/** Table units to world meters: 80 units per meter, centred on the pitch. */
export const X = (x: number) => (x - TABLE.centre) / 80, Z = (y: number) => (y - 500) / 80, U = (u: number) => u / 80;

export interface Venue {
  name: string; city: string; outside: string; outside2: string; ground: 'stripes' | 'tiles' | 'asphalt' | 'tropic' | 'concrete';
  grassA: string; grassB: string; mow: 'bands' | 'checker' | 'wide' | 'rings' | 'columns'; line: string; rail: string;
  stand: string; standEdge: string; seats: string[]; topRows: number; sideRows: number; rise: number;
  fans: string[]; boards: string[]; roof?: string; feature: 'none' | 'ribbons' | 'wall' | 'tropics' | 'arch';
  /** The home side's kits: they switch to the away kit when it would clash with yours. */
  home: Kit; away: Kit; sun: string; hemi: string;
}
/** Stylised stadiums for the `worldTheme` mod. Each sets the pitch, the stands, the crowd and the home team's colours. */
export const VENUES: Record<string, Venue> = {
  classic: { name: 'Pinball Park', city: 'PINBALL PARK', outside: '#3c1a78', outside2: '#4a2392', ground: 'stripes', grassA: '#2f9c3a', grassB: '#3aad45', mow: 'bands', line: '#ffffff', rail: '#f4f0e6', stand: '#1f3a5c', standEdge: '#f4f0e6', seats: ['#2a4a70'], topRows: 5, sideRows: 4, rise: .24, fans: ['#ff4fa3', '#ffd23f', '#3fd0ff', '#ffffff', '#7b3fe4', '#ff6a1f', '#4ee08a'], boards: ['#ff4fa3', '#ffd23f', '#3fd0ff', '#7b3fe4'], feature: 'none',
    home: KITS.rival, away: { shirt: '#2b2b35', stripe: '#3a3a46', shorts: '#7b3fe4', socks: '#2b2b35', boots: '#ffd23f' }, sun: '#fff4de', hemi: '#ffffff' },
  bernabeu: { name: 'Bernabéu', city: 'MADRID', outside: '#b9bec6', outside2: '#c9ced5', ground: 'tiles', grassA: '#2c8f36', grassB: '#36a041', mow: 'checker', line: '#ffffff', rail: '#f7f7f4', stand: '#e9ebef', standEdge: '#c9a227', seats: ['#f4f5f7', '#d9dce2'], topRows: 6, sideRows: 5, rise: .27, fans: ['#ffffff', '#ffffff', '#f2f2f2', '#6b3fa0', '#c9a227', '#1c2a5e'], boards: ['#1c2a5e', '#c9a227', '#ffffff', '#6b3fa0'], roof: '#f4f5f7', feature: 'ribbons',
    home: { shirt: '#f7f7f4', stripe: '#ece3c4', shorts: '#f7f7f4', socks: '#f7f7f4', boots: '#1d1d24' }, away: { shirt: '#1c2a5e', stripe: '#26387a', shorts: '#1c2a5e', socks: '#1c2a5e', boots: '#f7f7f4' }, sun: '#f4f7ff', hemi: '#eef3ff' },
  dortmund: { name: 'The Yellow Wall', city: 'DORTMUND', outside: '#2e3036', outside2: '#3a3d44', ground: 'asphalt', grassA: '#2e8a35', grassB: '#389a3f', mow: 'wide', line: '#ffffff', rail: '#f4f0e6', stand: '#1b1b1d', standEdge: '#fde100', seats: ['#fde100', '#1b1b1d'], topRows: 9, sideRows: 4, rise: .34, fans: ['#fde100', '#fde100', '#fde100', '#111111', '#fde100', '#ffffff'], boards: ['#fde100', '#111111', '#fde100', '#ffffff'], roof: '#16161a', feature: 'wall',
    home: { shirt: '#fde100', stripe: '#f0d400', shorts: '#111111', socks: '#fde100', boots: '#111111' }, away: { shirt: '#151515', stripe: '#222222', shorts: '#151515', socks: '#fde100', boots: '#fde100' }, sun: '#fff1d6', hemi: '#e6ecff' },
  maracana: { name: 'Maracanã', city: 'RIO', outside: '#4f9a4a', outside2: '#5aa654', ground: 'tropic', grassA: '#33a23c', grassB: '#3fb547', mow: 'rings', line: '#ffffff', rail: '#ffffff', stand: '#e8eef6', standEdge: '#ffdc02', seats: ['#1d5fc4', '#ffdc02', '#ffffff'], topRows: 5, sideRows: 4, rise: .22, fans: ['#ffdc02', '#1a9e45', '#1d5fc4', '#ffffff', '#ffdc02'], boards: ['#ffdc02', '#1a9e45', '#1d5fc4', '#ffffff'], roof: '#ffffff', feature: 'tropics',
    home: { shirt: '#ffdc02', stripe: '#f5d000', shorts: '#0b4bb3', socks: '#ffffff', boots: '#1a9e45' }, away: { shirt: '#0b4bb3', stripe: '#0a43a0', shorts: '#ffffff', socks: '#0b4bb3', boots: '#ffdc02' }, sun: '#ffe7b8', hemi: '#fff4dc' },
  wembley: { name: 'The Arch', city: 'LONDON', outside: '#a7a39b', outside2: '#b5b1a9', ground: 'concrete', grassA: '#2a8a33', grassB: '#34993c', mow: 'columns', line: '#ffffff', rail: '#f7f7f4', stand: '#5a5d66', standEdge: '#ffffff', seats: ['#c8102e', '#b00d27'], topRows: 6, sideRows: 5, rise: .26, fans: ['#ffffff', '#c8102e', '#13235b', '#ffffff', '#c8102e'], boards: ['#c8102e', '#13235b', '#ffffff', '#c8102e'], roof: '#d7d9de', feature: 'arch',
    home: { shirt: '#ffffff', stripe: '#eeeeee', shorts: '#13235b', socks: '#ffffff', boots: '#c8102e' }, away: { shirt: '#c8102e', stripe: '#b00d27', shorts: '#13235b', socks: '#c8102e', boots: '#ffffff' }, sun: '#fff6e8', hemi: '#f3f6ff' },
};
export const venue = (theme?: string) => VENUES[theme ?? 'classic'] ?? VENUES.classic;

const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; };
const texture = (c: HTMLCanvasElement, srgb = true) => { const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };

/** Pitch extent in table units: a little wider than the rails, from behind the rival net to behind your goal. */
export const PITCH = { left: -10, right: 650, top: -14, bottom: 1036 };
const PX = 1.25;
/** Striped grass with the white markings, drawn once per venue. `lines` is a mask of the markings alone, for glowing venues. */
function pitchArt(v: Venue) {
  const w = (PITCH.right - PITCH.left) * PX, h = (PITCH.bottom - PITCH.top) * PX, [c, g] = canvas(w, h), [lc, lg] = canvas(w, h);
  const P = (x: number, y: number) => [(x - PITCH.left) * PX, (y - PITCH.top) * PX] as const;
  // Each stadium mows its own pattern into the grass.
  g.fillStyle = v.grassA; g.fillRect(0, 0, w, h); g.fillStyle = v.grassB;
  if (v.mow === 'checker') { for (let y = 0; y * 70 < h / PX; y++) for (let x = 0; x * 70 < w / PX; x++) if ((x + y) % 2) g.fillRect(x * 70 * PX, y * 70 * PX, 70 * PX + 1, 70 * PX + 1); }
  else if (v.mow === 'columns') { for (let i = 0; i * 60 < w / PX; i += 2) g.fillRect(i * 60 * PX, 0, 60 * PX + 1, h); }
  else if (v.mow === 'rings') { const [cx, cy] = P(CENTRE_SPOT.x, CENTRE_SPOT.y); for (let r = 1320; r > 0; r -= 120) { g.fillStyle = Math.round(r / 120) % 2 ? v.grassA : v.grassB; g.beginPath(); g.arc(cx, cy, r * PX, 0, Math.PI * 2); g.fill(); } }
  else { const band = v.mow === 'wide' ? 105 : 70; for (let i = 1; i * band < h / PX; i += 2) g.fillRect(0, i * band * PX, w, band * PX + 1); }
  // Mown-grass grain.
  for (let i = 0; i < 2600; i++) { const x = (i * 97.3) % w, y = (i * 53.7 * 1.618) % h; g.fillStyle = i % 2 ? '#ffffff0c' : '#0000000c'; g.fillRect(x, y, 2, 5); }
  for (const ctx of [g, lg]) {
    ctx.strokeStyle = ctx === g ? v.line : '#ffffff'; ctx.lineWidth = 5 * PX; ctx.lineCap = 'round';
    const rect = (x0: number, y0: number, x1: number, y1: number) => { const [a, b] = P(x0, y0), [c2, d] = P(x1, y1); ctx.strokeRect(a, b, c2 - a, d - b); };
    const line = (x0: number, y0: number, x1: number, y1: number) => { ctx.beginPath(); ctx.moveTo(...P(x0, y0)); ctx.lineTo(...P(x1, y1)); ctx.stroke(); };
    const arc = (x: number, y: number, r: number, a0: number, a1: number) => { ctx.beginPath(); ctx.arc(...P(x, y), r * PX, a0, a1); ctx.stroke(); };
    rect(14, GOAL.y, 626, HOME.y); line(14, CENTRE_SPOT.y, 626, CENTRE_SPOT.y); arc(CENTRE_SPOT.x, CENTRE_SPOT.y, 80, 0, Math.PI * 2);
    rect(150, GOAL.y, 490, 268); rect(242, GOAL.y, 398, 160); arc(320, 216, 70, Math.PI * .2, Math.PI * .8);
    rect(232, 930, 408, HOME.y);
    for (const [x, y, a] of [[14, GOAL.y, 0], [626, GOAL.y, Math.PI / 2], [14, HOME.y, -Math.PI / 2], [626, HOME.y, Math.PI]] as const) arc(x, y, 16, a, a + Math.PI / 2);
    ctx.fillStyle = ctx.strokeStyle; for (const [x, y] of [[320, 216], [CENTRE_SPOT.x, CENTRE_SPOT.y]]) { ctx.beginPath(); ctx.arc(...P(x, y), 5 * PX, 0, Math.PI * 2); ctx.fill(); }
  }
  return { map: texture(c), lines: texture(lc, false) };
}
/** The giant number painted inside the centre circle, as in the reference broadcast look. */
export class CentreNumber {
  readonly mesh: T.Mesh; private ctx: CanvasRenderingContext2D; private tex: T.CanvasTexture; private last = '';
  constructor(parent: T.Object3D) {
    const [c, g] = canvas(512, 256); this.ctx = g; this.tex = texture(c);
    this.mesh = new T.Mesh(new T.PlaneGeometry(U(200), U(100)), new T.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.set(X(CENTRE_SPOT.x), .006, Z(CENTRE_SPOT.y)); this.mesh.renderOrder = 1; parent.add(this.mesh);
  }
  /** Eases the number's opacity, so it steps aside while the ball sits on the centre spot. */
  fade(target: number, dt: number) { const m = this.mesh.material as T.MeshBasicMaterial; m.opacity += (target - m.opacity) * Math.min(1, dt * 6); }
  set(text: string, color = '#ffffff') {
    const key = `${text}|${color}`; if (key === this.last) return; this.last = key; const g = this.ctx;
    g.clearRect(0, 0, 512, 256); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 190px "Arial Black", Arial, sans-serif';
    g.globalAlpha = .62; g.fillStyle = color; g.fillText(text, 256, 140, 470); this.tex.needsUpdate = true;
  }
}

/** A flat net panel between four corners, with texture repeats proportional to its size. */
function quad(points: T.Vector3[], material: T.Material) {
  const g = new T.BufferGeometry(), width = points[0].distanceTo(points[3]), height = points[0].distanceTo(points[1]);
  g.setAttribute('position', new T.Float32BufferAttribute(points.flatMap(p => p.toArray()), 3));
  g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 0, height, width, height, width, 0].map(v => v * 2.2), 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  return new T.Mesh(g, material);
}
/** A goal frame with a grid net; the back net bulges where the ball hits it. */
export class GoalFrame {
  readonly root = new T.Group(); private back: T.Mesh; private base: Float32Array; private bulge = 0; private hitX = 0; private dir: number;
  constructor(parent: T.Object3D, x0: number, x1: number, line: number, back: number, height: number, net: T.Texture) {
    parent.add(this.root); const post = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .35 }), r = U(5), zl = Z(line), zb = Z(back), xl = X(x0), xr = X(x1), low = height * .78;
    this.dir = Math.sign(zb - zl);
    const bar = (a: T.Vector3, b: T.Vector3, radius = r) => { const m = new T.Mesh(new T.CylinderGeometry(radius, radius, a.distanceTo(b) + radius, 12), post); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; this.root.add(m); };
    const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
    bar(V(xl, 0, zl), V(xl, height, zl)); bar(V(xr, 0, zl), V(xr, height, zl)); bar(V(xl, height, zl), V(xr, height, zl));
    for (const x of [xl, xr]) { bar(V(x, height, zl), V(x, low, zb), r * .7); bar(V(x, low, zb), V(x, 0, zb), r * .7); }
    bar(V(xl, low, zb), V(xr, low, zb), r * .7);
    const netMat = new T.MeshStandardMaterial({ map: net, transparent: true, side: T.DoubleSide, depthWrite: false, roughness: .9, alphaTest: .05 });
    for (const x of [xl, xr]) this.root.add(quad([V(x, 0, zl), V(x, height, zl), V(x, low, zb), V(x, 0, zb)], netMat));
    this.root.add(quad([V(xl, height, zl), V(xl, low, zb), V(xr, low, zb), V(xr, height, zl)], netMat));
    const backGeometry = new T.PlaneGeometry(xr - xl, low, 18, 6); backGeometry.translate((xl + xr) / 2, low / 2, zb);
    const uv = backGeometry.attributes.uv as T.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (xr - xl) * 2.2, uv.getY(i) * low * 2.2);
    this.back = new T.Mesh(backGeometry, netMat); this.root.add(this.back); this.base = Float32Array.from(backGeometry.attributes.position.array as Float32Array);
  }
  hit(x: number) { this.bulge = 1; this.hitX = X(x); }
  update(dt: number, reduced: boolean) {
    if (this.bulge <= 0) return; this.bulge = Math.max(0, this.bulge - dt * 1.4);
    const p = this.back.geometry.attributes.position as T.BufferAttribute, amount = this.bulge * (reduced ? .6 : .65 + .35 * Math.sin(this.bulge * 20));
    for (let i = 0; i < p.count; i++) { const x = this.base[i * 3], y = this.base[i * 3 + 1], fall = Math.exp(-((x - this.hitX) ** 2) * 1.4 - (y - .3) ** 2 * 5); p.setZ(i, this.base[i * 3 + 2] + this.dir * fall * .4 * amount); }
    p.needsUpdate = true;
  }
}
export function netTexture(): T.CanvasTexture {
  const [c, g] = canvas(128, 128); g.strokeStyle = '#ffffffd0'; g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const t = texture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(6, 3); return t;
}

/** Spectators as three instanced meshes (bodies, heads, scarves), filled seat by seat as `crowdSize` grows. */
export class Crowd {
  readonly root = new T.Group(); private bodies: T.InstancedMesh; private heads: T.InstancedMesh; private scarves: T.InstancedMesh;
  private seats: { x: number; y: number; z: number; facing: number; phase: number; order: number }[] = []; private dummy = new T.Object3D(); private shown = -1; private palette = '';
  excitement = 0;
  constructor(parent: T.Object3D) {
    parent.add(this.root); const add = (g: T.BufferGeometry, m: T.Material) => { const i = new T.InstancedMesh(g, m, 900); i.instanceMatrix.setUsage(T.DynamicDrawUsage); i.frustumCulled = false; i.count = 0; this.root.add(i); return i; };
    this.bodies = add(new T.CapsuleGeometry(.085, .1, 3, 8), new T.MeshStandardMaterial({ roughness: .7 }));
    this.heads = add(new T.SphereGeometry(.075, 10, 8), new T.MeshStandardMaterial({ roughness: .6 }));
    this.scarves = add(new T.BoxGeometry(.26, .07, .02), new T.MeshStandardMaterial({ roughness: .6 }));
  }
  /** Rebuilds the seat map when the stands change. */
  seat(spots: readonly { x: number; y: number; z: number; facing: number }[]) {
    this.seats = spots.map((s, i) => ({ ...s, phase: (i * 2.399) % (Math.PI * 2), order: (i * 7919) % spots.length })); this.shown = -1; this.palette = '';
  }
  update(dt: number, time: number, percent: number, fans: string[], reduced: boolean) {
    const visible = this.seats.filter(s => s.order < Math.round(this.seats.length * percent / 100)), key = fans.join();
    if (visible.length !== this.shown || key !== this.palette) {
      this.shown = visible.length; this.palette = key; const skin = ['#f2c7a5', '#c98f68', '#9a6141', '#6e4129', '#e8b38f'], c = new T.Color();
      visible.forEach((s, i) => { this.bodies.setColorAt(i, c.set(fans[s.order % fans.length])); this.heads.setColorAt(i, c.set(skin[s.order % skin.length])); this.scarves.setColorAt(i, c.set(fans[(s.order + 2) % fans.length])); });
      for (const m of [this.bodies, this.heads, this.scarves]) { m.count = visible.length; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    this.excitement = Math.max(0, this.excitement - dt * .35); const e = reduced ? 0 : this.excitement, d = this.dummy;
    visible.forEach((s, i) => {
      const jump = Math.max(0, Math.sin(time * 9 + s.phase)) * .16 * e + (reduced ? 0 : Math.sin(time * 2 + s.phase) * .01);
      d.position.set(s.x, s.y + .12 + jump, s.z); d.rotation.set(0, s.facing, 0); d.scale.setScalar(1); d.updateMatrix(); this.bodies.setMatrixAt(i, d.matrix);
      d.position.y = s.y + .28 + jump; d.updateMatrix(); this.heads.setMatrixAt(i, d.matrix);
      const up = e > .2 && s.order % 3 === 0; d.position.y = s.y + (up ? .45 : .2) + jump; d.rotation.z = up ? Math.sin(time * 8 + s.phase) * .4 : 0; d.scale.setScalar(up ? 1 : .7); d.updateMatrix(); this.scarves.setMatrixAt(i, d.matrix);
    });
    for (const m of [this.bodies, this.heads, this.scarves]) m.instanceMatrix.needsUpdate = true;
  }
}

export interface VenueParts { boards: T.Texture[]; lamps: T.Object3D[]; pitch: T.MeshStandardMaterial; animate(time: number, excitement: number, reduced: boolean): void }
/** Builds the stadium around the pitch: surroundings, stands, roof, boards, floodlights and its signature feature. */
export function buildVenue(root: T.Group, v: Venue, crowd: Crowd): VenueParts {
  const mat = (color: string, roughness = .7, emissive?: string, intensity = .8) => new T.MeshStandardMaterial({ color, roughness, ...(emissive ? { emissive, emissiveIntensity: intensity } : {}) });
  const box = (m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = false) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = shadow; root.add(b); return b; };
  const movers: ((time: number, excitement: number, reduced: boolean) => void)[] = [];
  // Surroundings: each city has its own ground outside the stadium.
  const [gc, gg] = canvas(256, 256); gg.fillStyle = v.outside; gg.fillRect(0, 0, 256, 256);
  if (v.ground === 'stripes') for (let i = 0; i < 8; i++) { gg.fillStyle = v.outside2; gg.fillRect(0, i * 32, 256, 16); }
  else if (v.ground === 'tiles') { gg.strokeStyle = '#ffffff55'; gg.lineWidth = 2; for (let i = 0; i <= 256; i += 32) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 256); gg.moveTo(0, i); gg.lineTo(256, i); gg.stroke(); } gg.fillStyle = v.outside2; for (let i = 0; i < 16; i++) gg.fillRect((i * 5 % 8) * 32 + 2, Math.floor(i / 2) * 32 + 2, 28, 28); }
  else if (v.ground === 'asphalt') { for (let i = 0; i < 900; i++) { gg.fillStyle = i % 2 ? '#ffffff08' : '#00000014'; gg.fillRect((i * 37) % 256, (i * 91) % 256, 2, 2); } gg.fillStyle = '#fde10088'; for (let i = 0; i < 8; i++) gg.fillRect(i * 32 + 4, 8, 2, 36); }
  else if (v.ground === 'tropic') { gg.fillStyle = '#e7d6a4'; gg.beginPath(); gg.moveTo(0, 150); gg.bezierCurveTo(80, 120, 170, 190, 256, 150); gg.lineTo(256, 175); gg.bezierCurveTo(170, 215, 80, 145, 0, 175); gg.fill(); for (let i = 0; i < 60; i++) { gg.fillStyle = i % 2 ? '#3f8a3b' : '#62b25a'; gg.beginPath(); gg.arc((i * 53) % 256, (i * 29) % 256, 4 + i % 5, 0, Math.PI * 2); gg.fill(); } }
  else { gg.strokeStyle = '#00000022'; gg.lineWidth = 2; for (let i = 0; i <= 256; i += 64) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 256); gg.moveTo(0, i); gg.lineTo(256, i); gg.stroke(); } gg.fillStyle = '#c8102e88'; gg.fillRect(112, 0, 32, 256); }
  const groundMap = texture(gc); groundMap.wrapS = groundMap.wrapT = T.RepeatWrapping; groundMap.repeat.set(14, 14);
  const ground = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshStandardMaterial({ map: groundMap, roughness: .9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.03; ground.receiveShadow = true; root.add(ground);
  // The pitch, mown in the stadium's own pattern.
  const art = pitchArt(v), pitch = new T.MeshStandardMaterial({ map: art.map, roughness: .85 }); art.lines.dispose();
  const field = new T.Mesh(new T.PlaneGeometry(U(PITCH.right - PITCH.left), U(PITCH.bottom - PITCH.top)), pitch); field.rotation.x = -Math.PI / 2;
  field.position.set(X((PITCH.left + PITCH.right) / 2), 0, Z((PITCH.top + PITCH.bottom) / 2)); field.receiveShadow = true; root.add(field);
  // Advertising boards with scrolling LED art and the city's name.
  const [bc, bg] = canvas(1024, 64); const segment = 1024 / 8, words = ['MODBOX', 'PINBALLERZ', 'GOAL!', v.city, 'CODE IT', '⚽ PLAY', v.city, 'KICK OFF'];
  for (let i = 0; i < 8; i++) { const fill = v.boards[i % v.boards.length]; bg.fillStyle = fill; bg.fillRect(i * segment, 0, segment, 64); bg.fillStyle = ['#ffffff', '#f6f6f2', '#fde100', '#ffdc02'].includes(fill) ? '#1a1a2a' : '#ffffff'; bg.font = '900 28px "Arial Black", Arial, sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.fillText(words[i], i * segment + segment / 2, 34, segment - 12); }
  const boards = texture(bc);
  const board = (x: number, z: number, w: number, yaw: number, repeat: number) => { const t = boards.clone(); t.repeat.set(repeat, 1); t.wrapS = T.RepeatWrapping; t.needsUpdate = true; const dark = mat('#111'); const m = new T.Mesh(new T.BoxGeometry(w, .32, .06), [dark, dark, dark, dark, new T.MeshBasicMaterial({ map: t, toneMapped: false }), dark]); m.position.set(x, .16, z); m.rotation.y = yaw; root.add(m); return t; };
  const boardTextures = [board(X(320), Z(PITCH.top - 6), U(PITCH.right - PITCH.left + 40), 0, 1.6), board(X(PITCH.left - 6), Z(500), U(PITCH.bottom - PITCH.top), Math.PI / 2, 2), board(X(PITCH.right + 6), Z(500), U(PITCH.bottom - PITCH.top), -Math.PI / 2, 2)];
  // Terraces behind the rival goal and along both touchlines. Row colours show through wherever seats are empty.
  const edge = mat(v.standEdge, .5), seats: { x: number; y: number; z: number; facing: number }[] = [], rowMats = v.seats.map(c => mat(c, .8)), stand = mat(v.stand, .8);
  const width = U(PITCH.right - PITCH.left + 420), depth = U(34);
  let topBack = 0, sideOut = 0;
  for (let row = 0; row < v.topRows; row++) {
    const z = Z(PITCH.top - 40 - row * 34), h = .22 + row * v.rise; topBack = z - depth / 2;
    box(stand, X(320), h / 2 - .02, z, width, h - .04, depth); box(rowMats[row % rowMats.length], X(320), h - .01, z, width, .04, depth * .96); box(edge, X(320), h + .01, z + depth / 2, width, .025, .03);
    for (let x = -190; x <= 830; x += 22) seats.push({ x: X(x + (row % 2) * 11), y: h, z, facing: 0 });
  }
  for (const side of [-1, 1]) for (let row = 0; row < v.sideRows; row++) {
    const x = side < 0 ? X(PITCH.left - 40 - row * 34) : X(PITCH.right + 40 + row * 34), h = .22 + row * v.rise * .9; sideOut = Math.abs(x) + depth / 2;
    box(stand, x, h / 2 - .02, Z(500), depth, h - .04, U(PITCH.bottom - PITCH.top + 40)); box(rowMats[(row + 1) % rowMats.length], x, h - .01, Z(500), depth * .96, .04, U(PITCH.bottom - PITCH.top + 40));
    for (let y = PITCH.top + 10; y <= PITCH.bottom - 10; y += 24) seats.push({ x, y: h, z: Z(y + (row % 2) * 12), facing: -side * Math.PI / 2 });
  }
  crowd.seat(seats);
  const topHeight = .22 + (v.topRows - 1) * v.rise, sideHeight = .22 + (v.sideRows - 1) * v.rise * .9, zPitchTop = Z(PITCH.top), zPitchBottom = Z(PITCH.bottom);
  // A cantilever roof over the back of the stands.
  if (v.roof) {
    const roof = mat(v.roof, .45);
    box(roof, X(320), topHeight + 1.1, topBack + 1.1, width + 2, .08, 2.6, true);
  }
  // Floodlight towers in the far corners.
  const lamps: T.Object3D[] = [], pole = mat(v.feature === 'wall' ? '#fde100' : '#cfd6df', .4), lampMat = new T.MeshBasicMaterial({ color: '#fff6d6', toneMapped: false });
  for (const [x, y] of [[-260, -280], [900, -280]]) {
    const p = new T.Mesh(new T.CylinderGeometry(.08, .12, 6, 8), pole); p.position.set(X(x), 3, Z(y)); root.add(p);
    const panel = new T.Mesh(new T.BoxGeometry(1.4, .9, .15), lampMat); panel.position.set(X(x), 6.2, Z(y)); panel.lookAt(0, 0, 0); root.add(panel); lamps.push(panel);
  }
  // Signature features.
  if (v.feature === 'ribbons') {
    // Steel ribbons wrapped around the outside, with a 360-degree LED band under the roof edge.
    const steel = new T.MeshStandardMaterial({ color: '#d8dde4', roughness: .2, metalness: .85 });
    for (let k = 0; k < 6; k++) { const y = topHeight + .25 + k * .18, z = topBack - .2 - k * .05; box(steel, X(320), y, z, width + 1, .07, .07); for (const side of [-1, 1]) box(steel, side * (sideOut + .2 + k * .05), sideHeight + .25 + k * .15, (zPitchTop + zPitchBottom) / 2, .07, .07, zPitchBottom - zPitchTop + 4); }
    const [lc, lg] = canvas(1024, 32); for (let i = 0; i < 16; i++) { lg.fillStyle = i % 2 ? '#1c2a5e' : '#ffffff'; lg.fillRect(i * 64, 0, 64, 32); lg.fillStyle = i % 2 ? '#ffffff' : '#c9a227'; lg.font = '900 18px Arial'; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillText(i % 2 ? 'MADRID' : '★', i * 64 + 32, 17); }
    const led = texture(lc); led.wrapS = T.RepeatWrapping; led.repeat.set(3, 1);
    const band = new T.Mesh(new T.BoxGeometry(width + 2, .22, .04), new T.MeshBasicMaterial({ map: led, toneMapped: false })); band.position.set(X(320), topHeight + .95, topBack + 2.35); root.add(band);
    const sideLed = led.clone(); sideLed.repeat.set(4, 1); sideLed.needsUpdate = true;
    for (const side of [-1, 1]) { const strip = new T.Mesh(new T.BoxGeometry(.04, .2, zPitchBottom - zPitchTop + 2), new T.MeshBasicMaterial({ map: sideLed, toneMapped: false })); strip.position.set(side * (sideOut + .05), sideHeight + .35, (zPitchTop + zPitchBottom) / 2); root.add(strip); }
    movers.push((t, e, reduced) => { led.offset.x = sideLed.offset.x = reduced ? 0 : -(t * (.05 + e * .3)) % 1; });
  }
  if (v.feature === 'wall') {
    // Giant banners waved over the steep south stand, and the famous yellow pylons.
    const flagColors = ['#fde100', '#111111', '#fde100'];
    for (let k = 0; k < 3; k++) {
      const g = new T.PlaneGeometry(3.2, 1.3, 16, 4), base = Float32Array.from(g.attributes.position.array as Float32Array), flag = new T.Mesh(g, new T.MeshStandardMaterial({ color: flagColors[k], side: T.DoubleSide, roughness: .7 }));
      flag.position.set(X(320) + (k - 1) * 3.6, topHeight * .6 + .5, Z(PITCH.top - 40 - 4 * 34)); flag.rotation.x = -.95; root.add(flag);
      movers.push((t, e, reduced) => { const p = g.attributes.position as T.BufferAttribute, amp = reduced ? 0 : .08 + e * .25; for (let i = 0; i < p.count; i++) p.setZ(i, base[i * 3 + 2] + Math.sin(base[i * 3] * 2.2 + t * (4 + e * 5) + k) * amp); p.needsUpdate = true; flag.position.y = topHeight * .6 + .5 + (reduced ? 0 : Math.max(0, Math.sin(t * 7 + k)) * e * .4); });
    }
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const g = new T.PlaneGeometry(2.4, .9, 12, 3), base = Float32Array.from(g.attributes.position.array as Float32Array), flag = new T.Mesh(g, new T.MeshStandardMaterial({ color: k === 1 ? '#111111' : '#fde100', side: T.DoubleSide, roughness: .7 }));
      flag.rotation.set(-Math.PI / 2 + .55, side * Math.PI / 2, 0); flag.position.set(side * (sideOut - .9), sideHeight + .25, Z(220 + k * 300)); root.add(flag);
      movers.push((t, e, reduced) => { const p = g.attributes.position as T.BufferAttribute, amp = reduced ? 0 : .06 + e * .22; for (let i = 0; i < p.count; i++) p.setZ(i, base[i * 3 + 2] + Math.sin(base[i * 3] * 2.6 + t * (4 + e * 5) + k + side) * amp); p.needsUpdate = true; });
    }
    for (const [x, y] of [[-200, -150], [840, -150], [-200, 1150], [840, 1150]]) {
      const tower = new T.Group(); tower.position.set(X(x), 0, Z(y)); root.add(tower);
      for (const [dx, dz] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) { const leg = new T.Mesh(new T.CylinderGeometry(.06, .06, 7, 6), pole); leg.position.set(dx, 3.5, dz); tower.add(leg); }
      for (let k = 0; k < 6; k++) { const brace = new T.Mesh(new T.BoxGeometry(.8, .05, .05), pole); brace.position.set(0, .8 + k * 1.1, k % 2 ? .35 : -.35); brace.rotation.z = k % 2 ? .6 : -.6; tower.add(brace); }
    }
  }
  if (v.feature === 'tropics') {
    // A white ring roof over the bowl, palm trees and the green hills of the city behind.
    const ring = mat('#ffffff', .4); box(ring, X(320), topHeight + 1.6, topBack + .6, width + 1, .12, 1.4, true);
    const trunk = mat('#8a6a43', .9), leaf = new T.MeshStandardMaterial({ color: '#2f9a4a', roughness: .7, side: T.DoubleSide });
    for (let i = 0; i < 20; i++) {
      const side = i % 2 ? 1 : -1, tree = new T.Group(); tree.position.set(side * (sideOut + 1 + (i % 3) * 1.3), 0, Z(-120 + Math.floor(i / 2) * 125)); tree.scale.setScalar(.9 + (i % 4) * .12); root.add(tree);
      const t = new T.Mesh(new T.CylinderGeometry(.08, .13, 2.6, 6), trunk); t.position.y = 1.3; t.rotation.z = .15 * Math.sin(i); tree.add(t);
      for (let k = 0; k < 6; k++) { const l = new T.Mesh(new T.PlaneGeometry(1.4, .35), leaf); l.position.set(Math.cos(k * 1.05) * .6, 2.55, Math.sin(k * 1.05) * .6); l.rotation.set(-.5, -k * 1.05, 0); tree.add(l); movers.push((time, _e, reduced) => { l.rotation.x = -.5 + (reduced ? 0 : Math.sin(time * 1.6 + i + k) * .08); }); }
    }
    const hill = mat('#3c7d3f', .95), rock = mat('#7b7f74', .9);
    for (let i = 0; i < 7; i++) { const h = new T.Mesh(new T.SphereGeometry(4 + i % 3, 12, 8), hill); h.scale.y = .45; h.position.set(-24 + i * 8, -.5, -22 - (i % 2) * 3); root.add(h); }
    const sugarloaf = new T.Mesh(new T.SphereGeometry(2.6, 14, 10), rock); sugarloaf.scale.set(1, 2.3, 1); sugarloaf.position.set(14, 1.5, -26); root.add(sugarloaf);
  }
  if (v.feature === 'arch') {
    // The giant white arch, leaning back over the north stand.
    const pts = Array.from({ length: 33 }, (_, i) => { const a = Math.PI * i / 32; return new T.Vector3(Math.cos(a) * -13, Math.sin(a) * 9, 0); });
    const curve = new T.CatmullRomCurve3(pts), steel = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .3, metalness: .4 });
    const arch = new T.Group(); arch.position.set(X(320), topHeight, topBack - .5); arch.rotation.x = -.45; root.add(arch);
    arch.add(new T.Mesh(new T.TubeGeometry(curve, 96, .13, 8, false), steel));
    for (let i = 1; i < 32; i += 2) { const p = curve.getPoint(i / 32), tie = new T.Mesh(new T.TorusGeometry(.2, .03, 4, 10), steel); tie.position.copy(p); tie.lookAt(curve.getPoint(Math.min(1, i / 32 + .01)).add(arch.position)); arch.add(tie); }
  }
  boards.dispose();
  return { boards: boardTextures, lamps, pitch, animate: (t, e, reduced) => movers.forEach(m => m(t, e, reduced)) };
}

/** The white boundary rail as one smooth tube per side, with rounded end caps. */
export function buildRails(root: T.Group, rails: readonly (readonly [number, number, number, number])[], color: string, glow?: string) {
  const radius = U(9), material = new T.MeshStandardMaterial({ color, roughness: .45, ...(glow ? { emissive: glow, emissiveIntensity: .45 } : {}) });
  const half = rails.length / 2;
  for (const side of [rails.slice(0, half), rails.slice(half)]) {
    const path = new T.CurvePath<T.Vector3>(); for (const [ax, ay, bx, by] of side) path.add(new T.LineCurve3(new T.Vector3(X(ax), radius, Z(ay)), new T.Vector3(X(bx), radius, Z(by))));
    const tube = new T.Mesh(new T.TubeGeometry(path, 160, radius, 10, false), material); tube.castShadow = true; tube.receiveShadow = true; root.add(tube);
    for (const [x, y] of [[side[0][0], side[0][1]], [side.at(-1)![2], side.at(-1)![3]]]) { const cap = new T.Mesh(new T.SphereGeometry(radius, 12, 8), material); cap.position.set(X(x), radius, Z(y)); cap.castShadow = true; root.add(cap); }
  }
  return material;
}
