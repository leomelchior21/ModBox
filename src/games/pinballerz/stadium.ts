import * as T from 'three';
import { GOAL, HOME, TABLE, CENTRE_SPOT } from './run';

/** Table units to world meters: 80 units per meter, centred on the pitch. */
export const X = (x: number) => (x - TABLE.centre) / 80, Z = (y: number) => (y - 500) / 80, U = (u: number) => u / 80;

export interface Venue {
  outside: string; outside2: string; grassA: string; grassB: string; line: string; rail: string; railGlow?: string; stand: string; standEdge: string; seat: string;
  fans: string[]; boards: string[]; lineGlow?: string; extras: 'none' | 'pines' | 'lava' | 'grid';
}
export const VENUES: Record<string, Venue> = {
  classic: { outside: '#3c1a78', outside2: '#4a2392', grassA: '#2f9c3a', grassB: '#3aad45', line: '#ffffff', rail: '#f4f0e6', stand: '#1f3a5c', standEdge: '#f4f0e6', seat: '#2a4a70', fans: ['#ff4fa3', '#ffd23f', '#3fd0ff', '#ffffff', '#7b3fe4', '#ff6a1f', '#4ee08a'], boards: ['#ff4fa3', '#ffd23f', '#3fd0ff', '#7b3fe4'], extras: 'none' },
  alpine: { outside: '#e8f1f9', outside2: '#d4e4f1', grassA: '#58ab5f', grassB: '#66b96c', line: '#ffffff', rail: '#ffffff', stand: '#6b4630', standEdge: '#f7fbff', seat: '#8a5c3b', fans: ['#e2363d', '#ffffff', '#2f6fd8', '#ffcf3a', '#2b9d5e'], boards: ['#e2363d', '#2f6fd8', '#ffffff', '#2b9d5e'], extras: 'pines' },
  volcanic: { outside: '#1e0d0c', outside2: '#2e1410', grassA: '#3b5a26', grassB: '#45672d', line: '#ffe0bd', rail: '#3a3030', railGlow: '#ff6a24', stand: '#191313', standEdge: '#ff6a24', seat: '#2a1d1b', fans: ['#ff6a24', '#ffb02e', '#ff3b2f', '#3a2a28', '#ffd8a0'], boards: ['#ff6a24', '#ff3b2f', '#ffb02e', '#3a2a28'], lineGlow: '#ff9a4a', extras: 'lava' },
  neon: { outside: '#08081f', outside2: '#111046', grassA: '#0b3236', grassB: '#0e3d42', line: '#8ff9ff', rail: '#eafcff', railGlow: '#38e8ff', stand: '#12123a', standEdge: '#ff4fd8', seat: '#1c1c55', fans: ['#38e8ff', '#ff4fd8', '#b06bff', '#7dff9a', '#ffffff'], boards: ['#38e8ff', '#ff4fd8', '#b06bff', '#7dff9a'], lineGlow: '#38e8ff', extras: 'grid' },
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
  for (let i = 0; i * 70 < PITCH.bottom - PITCH.top; i++) { g.fillStyle = i % 2 ? v.grassA : v.grassB; g.fillRect(0, i * 70 * PX, w, 70 * PX + 1); }
  // Mown-grass grain.
  for (let i = 0; i < 2600; i++) { const x = (i * 97.3) % w, y = (i * 53.7 * 1.618) % h; g.fillStyle = i % 2 ? '#ffffff0c' : '#0000000c'; g.fillRect(x, y, 2, 5); }
  if (v.extras === 'pines') { for (let i = 0; i < 90; i++) { const left = i % 2 === 0, x = left ? (i * 7) % 60 : w - (i * 7) % 60, y = (i * 113) % h; g.fillStyle = '#ffffffaa'; g.beginPath(); g.ellipse(x, y, 12 + i % 9, 6 + i % 5, 0, 0, Math.PI * 2); g.fill(); } }
  if (v.extras === 'lava') { g.strokeStyle = '#00000033'; g.lineWidth = 3; for (let i = 0; i < 26; i++) { g.beginPath(); let x = (i * 151) % w, y = (i * 263) % h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (k % 2 ? 1 : -1) * 22; y += 18; g.lineTo(x, y); } g.stroke(); } }
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

/** Builds the venue around the pitch: surroundings, stands, boards and floodlights. Rebuilt when the theme changes. */
export function buildVenue(root: T.Group, v: Venue, crowd: Crowd): { boards: T.Texture[]; lamps: T.Object3D[]; pitch: T.MeshStandardMaterial } {
  const mat = (color: string, roughness = .7, emissive?: string, intensity = .8) => new T.MeshStandardMaterial({ color, roughness, ...(emissive ? { emissive, emissiveIntensity: intensity } : {}) });
  const box = (m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = false) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = shadow; root.add(b); return b; };
  // Surroundings.
  const [gc, gg] = canvas(256, 256); gg.fillStyle = v.outside; gg.fillRect(0, 0, 256, 256);
  if (v.extras === 'grid') { gg.strokeStyle = '#ff4fd855'; gg.lineWidth = 2; for (let i = 0; i <= 256; i += 32) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 256); gg.moveTo(0, i); gg.lineTo(256, i); gg.stroke(); } }
  else if (v.extras === 'lava') { gg.strokeStyle = '#ff5a1c'; gg.lineWidth = 3; gg.shadowColor = '#ff8a2a'; gg.shadowBlur = 8; for (let i = 0; i < 9; i++) { gg.beginPath(); let x = (i * 61) % 256, y = (i * 97) % 256; gg.moveTo(x, y); for (let k = 0; k < 5; k++) { x += ((i + k) % 3 - 1) * 30; y += 24; gg.lineTo(x, y); } gg.stroke(); } }
  else for (let i = 0; i < 8; i++) { gg.fillStyle = v.outside2; gg.fillRect(0, i * 32, 256, 16); }
  const groundMap = texture(gc); groundMap.wrapS = groundMap.wrapT = T.RepeatWrapping; groundMap.repeat.set(14, 14);
  const ground = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshStandardMaterial({ map: groundMap, roughness: .9, ...(v.extras === 'lava' || v.extras === 'grid' ? { emissive: '#ffffff', emissiveMap: groundMap, emissiveIntensity: v.extras === 'grid' ? .35 : .5 } : {}) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.03; ground.receiveShadow = true; root.add(ground);
  // The pitch itself.
  const art = pitchArt(v), pitch = new T.MeshStandardMaterial({ map: art.map, roughness: .85, ...(v.lineGlow ? { emissive: v.lineGlow, emissiveMap: art.lines, emissiveIntensity: .9 } : {}) });
  const field = new T.Mesh(new T.PlaneGeometry(U(PITCH.right - PITCH.left), U(PITCH.bottom - PITCH.top)), pitch); field.rotation.x = -Math.PI / 2;
  field.position.set(X((PITCH.left + PITCH.right) / 2), 0, Z((PITCH.top + PITCH.bottom) / 2)); field.receiveShadow = true; root.add(field);
  // Advertising boards around the pitch with scrolling LED art.
  const [bc, bg] = canvas(1024, 64); const segment = 1024 / 8;
  for (let i = 0; i < 8; i++) { bg.fillStyle = v.boards[i % v.boards.length]; bg.fillRect(i * segment, 0, segment, 64); bg.fillStyle = i % 4 === 2 ? '#1a1a2a' : '#ffffff'; bg.font = '900 30px "Arial Black", Arial, sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.fillText(['MODBOX', 'PINBALLERZ', 'GOAL!', 'CODE IT', 'MODBOX', '⚽ PLAY', 'PINBALLERZ', 'KICK OFF'][i], i * segment + segment / 2, 34, segment - 10); }
  const boards = texture(bc);
  const board = (x: number, z: number, w: number, yaw: number, repeat: number) => { const t = boards.clone(); t.repeat.set(repeat, 1); t.wrapS = T.RepeatWrapping; t.needsUpdate = true; const m = new T.Mesh(new T.BoxGeometry(w, .32, .06), [mat('#111'), mat('#111'), mat('#111'), mat('#111'), new T.MeshBasicMaterial({ map: t, toneMapped: false }), mat('#111')]); m.position.set(x, .16, z); m.rotation.y = yaw; root.add(m); return t; };
  const boardTextures = [board(X(320), Z(PITCH.top - 6), U(PITCH.right - PITCH.left + 40), 0, 1.6), board(X(PITCH.left - 6), Z(500), U(PITCH.bottom - PITCH.top), Math.PI / 2, 2), board(X(PITCH.right + 6), Z(500), U(PITCH.bottom - PITCH.top), -Math.PI / 2, 2)];
  // Stands: tiered terraces behind the rival goal and along both touchlines, each packed with fans.
  const stand = mat(v.stand, .8), edge = mat(v.standEdge, .5, v.railGlow ? v.standEdge : undefined, .6), seats: { x: number; y: number; z: number; facing: number }[] = [];
  for (let row = 0; row < 5; row++) {
    const z = Z(PITCH.top - 40 - row * 34), h = .22 + row * .24; box(stand, X(320), h / 2, z, U(PITCH.right - PITCH.left + 420), h, U(34)); box(edge, X(320), h + .01, z + U(17), U(PITCH.right - PITCH.left + 420), .025, .03);
    for (let x = -190; x <= 830; x += 22) seats.push({ x: X(x + (row % 2) * 11), y: h, z, facing: 0 });
  }
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const x = side < 0 ? X(PITCH.left - 40 - row * 34) : X(PITCH.right + 40 + row * 34), h = .22 + row * .24; box(stand, x, h / 2, Z(500), U(34), h, U(PITCH.bottom - PITCH.top + 40));
    for (let y = PITCH.top + 10; y <= PITCH.bottom - 10; y += 24) seats.push({ x, y: h, z: Z(y + (row % 2) * 12), facing: -side * Math.PI / 2 });
  }
  crowd.seat(seats);
  // Floodlight towers in the far corners and beside your goal.
  const lamps: T.Object3D[] = [], pole = mat('#cfd6df', .4), lampMat = new T.MeshBasicMaterial({ color: '#fff6d6', toneMapped: false });
  for (const [x, y] of [[-260, -260], [900, -260]]) {
    const p = new T.Mesh(new T.CylinderGeometry(.08, .12, 6, 8), pole); p.position.set(X(x), 3, Z(y)); root.add(p);
    const panel = new T.Mesh(new T.BoxGeometry(1.4, .9, .15), lampMat); panel.position.set(X(x), 6.2, Z(y)); panel.lookAt(0, 0, 0); root.add(panel); lamps.push(panel);
  }
  // Venue dressing.
  if (v.extras === 'pines') for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, r = 13 + (i % 4) * 1.6, tree = new T.Group(); tree.position.set(Math.cos(a) * r * .9, 0, Math.sin(a) * r * 1.1); root.add(tree);
    for (let k = 0; k < 3; k++) { const cone = new T.Mesh(new T.ConeGeometry(1 - k * .25, 1.4, 7), mat(k === 2 ? '#f4f9ff' : '#2f6b4f')); cone.position.y = .8 + k * .65; cone.castShadow = false; tree.add(cone); }
  }
  if (v.extras === 'lava') for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rock = new T.Mesh(new T.DodecahedronGeometry(.8 + i % 3 * .4, 0), mat('#2b1714', .9)); rock.position.set(Math.cos(a) * 13, .2, Math.sin(a) * 14); rock.rotation.set(i, i * 2, 0); root.add(rock); }
  if (v.extras === 'grid') for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, tower = new T.Mesh(new T.BoxGeometry(.6, 3 + i % 4, .6), mat('#121240', .4, i % 2 ? '#38e8ff' : '#ff4fd8', .5)); tower.position.set(Math.cos(a) * 14, 1.5, Math.sin(a) * 15); root.add(tower); }
  boards.dispose();
  return { boards: boardTextures, lamps, pitch };
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
