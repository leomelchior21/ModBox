import * as T from 'three';
import type { ArcadeCue } from '../premium-kit/core';
import { World, material, mesh } from '../three-kit/world';
import { PinballRun, PIN_RAILS, POSTS, GATE, RAMP_PATH, LANES, SPINNER, BALL_R, TABLE, rampPoint, type Pinball } from './run';

const PINK = '#ff2bd6', CYAN = '#19e3ff', VIOLET = '#9b5cff', ORANGE = '#ff8a1f';
/** Table units to world: 80 table units per meter, centred on the playfield. */
const X = (x: number) => (x - 320) / 80, Z = (y: number) => (y - 460) / 80, H = (h: number) => h / 80;

function carbon(): T.CanvasTexture {
  // Carbon-fibre twill with faint neon art printed on the playfield.
  const c = document.createElement('canvas'); c.width = 640; c.height = 920; const g = c.getContext('2d')!;
  g.fillStyle = '#0b0c11'; g.fillRect(0, 0, 640, 920);
  for (let y = 0; y < 920; y += 8) for (let x = 0; x < 640; x += 8) { const odd = ((x + y) / 8) % 2; g.fillStyle = odd ? '#14161d' : '#0e1015'; g.fillRect(x, y, 8, 4); g.fillStyle = odd ? '#0e1015' : '#171a22'; g.fillRect(x + (odd ? 0 : 4), y + 4, 4, 4); }
  const glow = (color: string, width: number, path: () => void) => { g.save(); g.strokeStyle = color; g.lineWidth = width; g.shadowColor = color; g.shadowBlur = 18; g.globalAlpha = .55; g.beginPath(); path(); g.stroke(); g.restore(); };
  glow(PINK, 3, () => { g.moveTo(60, 860); g.quadraticCurveTo(80, 520, 210, 420); });
  glow(CYAN, 3, () => { g.moveTo(540, 860); g.quadraticCurveTo(520, 560, 420, 440); });
  glow(VIOLET, 2, () => { g.arc(298, 560, 120, Math.PI * 1.1, Math.PI * 1.9); });
  // Arrow inserts point at the shots.
  const arrow = (x: number, y: number, angle: number, color: string) => { g.save(); g.translate(x, y); g.rotate(angle); g.fillStyle = color; g.globalAlpha = .35; g.beginPath(); g.moveTo(0, -22); g.lineTo(14, 8); g.lineTo(0, 2); g.lineTo(-14, 8); g.closePath(); g.fill(); g.restore(); };
  arrow(452, 590, .35, PINK); arrow(222, 600, -.1, CYAN); arrow(110, 470, -1.4, ORANGE);
  g.save(); g.font = '900 40px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.translate(298, 590); g.strokeStyle = '#ff2bd633'; g.lineWidth = 1.5; g.strokeText('PINBALLERZ', 0, 0); g.restore();
  g.save(); g.font = '900 14px Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#19e3ff55'; g.fillText('SHOOT AGAIN', 298, 905); g.restore();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
function haloTexture(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
const neon = (color: string) => new T.MeshBasicMaterial({ color, toneMapped: false });

/** A dot-matrix display: text is rasterised small, then every pixel becomes a round LED. */
class DotMatrix {
  texture: T.CanvasTexture; private canvas = document.createElement('canvas'); private small = document.createElement('canvas'); private last = '';
  constructor() { this.canvas.width = 768; this.canvas.height = 192; this.small.width = 128; this.small.height = 32; this.texture = new T.CanvasTexture(this.canvas); this.texture.colorSpace = T.SRGBColorSpace; }
  draw(big: string, small: string, lit = '#ff5ad1') {
    const key = `${big}|${small}|${lit}`; if (key === this.last) return; this.last = key;
    const s = this.small.getContext('2d', { willReadFrequently: true })!; s.fillStyle = '#000'; s.fillRect(0, 0, 128, 32); s.fillStyle = '#fff'; s.textAlign = 'center'; s.textBaseline = 'middle';
    s.font = '7px monospace'; s.fillText(small, 64, 5); const size = Math.min(22, 128 / Math.max(4, big.length) * 1.6); s.font = `bold ${size}px "Arial Black", Arial, sans-serif`; s.fillText(big, 64, 20, 124);
    const data = s.getImageData(0, 0, 128, 32).data, g = this.canvas.getContext('2d')!; g.fillStyle = '#050304'; g.fillRect(0, 0, 768, 192);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 128; x++) { const on = data[(y * 128 + x) * 4] > 90; g.fillStyle = on ? lit : '#2a0f22'; g.beginPath(); g.arc(x * 6 + 3, y * 6 + 3, on ? 2.6 : 2, 0, Math.PI * 2); g.fill(); }
    this.texture.needsUpdate = true;
  }
}

export class PinballView extends World<PinballRun> {
  private table = new T.Group(); private balls = new Map<number, { ball: T.Mesh; halo: T.Sprite }>(); private ballMaterial: T.MeshStandardMaterial; private ballLight: T.PointLight;
  private bumpers: { cap: T.Mesh; ring: T.MeshBasicMaterial; halo: T.Sprite; base: string }[] = []; private flippers: { root: T.Group; rubber: T.MeshBasicMaterial }[] = [];
  private slings: T.MeshBasicMaterial[] = []; private drops: T.Mesh[] = []; private lanes: T.MeshBasicMaterial[] = []; private bonus: T.MeshBasicMaterial[] = []; private locks: T.MeshBasicMaterial[] = [];
  private spinner = new T.Group(); private rampGlow: T.MeshBasicMaterial[] = []; private buttons: T.MeshBasicMaterial[] = []; private save: T.MeshBasicMaterial;
  private dmd = new DotMatrix(); private halo = haloTexture(); private fit = { aspect: 1, done: '' };
  private shot: string | null = null; private shotKey = '';
  constructor(canvas: HTMLCanvasElement, run: PinballRun) {
    super(canvas, run, '#05060a', 16); this.renderer.toneMappingExposure = 1;
    this.scene.environmentIntensity = .9; this.sun.intensity = 1.1; this.sun.color.set('#cfd8ff'); this.scene.add(this.table);
    this.camera = new T.PerspectiveCamera(38, 1, .1, 100);
    this.ballMaterial = material('#e9f1ff', .06, 1); this.ballLight = new T.PointLight('#bfe9ff', 6, 3.2, 2); this.scene.add(this.ballLight);
    this.save = neon('#ffffff'); this.build();
  }
  private sprite(color: string, size: number, parent: T.Object3D, x: number, y: number, z: number) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: this.halo, color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); s.scale.setScalar(size); s.position.set(x, y, z); parent.add(s); return s;
  }
  private rail(parent: T.Object3D, ax: number, ay: number, bx: number, by: number, height: number, mat: T.Material, thick = .09) {
    const len = Math.hypot(bx - ax, by - ay) / 80; if (len < .01) return; const m = mesh(this.shapes.block, mat, parent, X((ax + bx) / 2), height / 2, Z((ay + by) / 2)); m.scale.set(thick, height, len + thick); m.rotation.y = Math.atan2(bx - ax, by - ay); return m;
  }
  private build() {
    const s = this.shapes, t = this.table, metal = material('#1a1d26', .35, .7), dark = material('#0d0f15', .6, .2);
    // Cabinet body, playfield and glass rails.
    s.cube(t, material('#090a0f', .5, .3), -.25, -.42, .3, 8.3, .8, 12.6); const field = new T.MeshStandardMaterial({ map: carbon(), roughness: .45, metalness: .25 });
    const playfield = mesh(new T.PlaneGeometry(8, 11.5), field, t, 0, .001, 0, false); playfield.rotation.x = -Math.PI / 2; playfield.receiveShadow = true;
    for (const side of [-1, 1]) { s.cube(t, dark, side * 4.18, .25, .3, .3, .9, 12.6); const strip = mesh(this.shapes.block, neon(side < 0 ? PINK : CYAN), t, side * 4.05, .71, .3, false); strip.scale.set(.06, .04, 12.4); }
    s.cube(t, dark, -.25, .25, 6.55, 8.6, .9, .4); s.cube(t, metal, -.25, .73, 6.6, 8.4, .08, .5);
    // Walls: low dark rails topped with neon, pink on the left, cyan on the right.
    PIN_RAILS.forEach(([ax, ay, bx, by]) => { this.rail(t, ax, ay, bx, by, .32, metal, .07); const top = this.rail(t, ax, ay, bx, by, .02, neon((ax + bx) / 2 < 320 ? PINK : CYAN), .05); if (top) top.position.y = .33; });
    this.rail(t, ...GATE, .18, material('#c9d4e8', .2, .9), .04);
    for (const [x, y, r] of POSTS) { s.tube(t, material('#20232c', .3, .6), X(x), .17, Z(y), r / 80, .34); s.tube(t, neon(VIOLET), X(x), .3, Z(y), r / 80 + .015, .06, false); }
    // The spinner lane, lane inserts and lights.
    this.spinner.position.set(X((SPINNER.x0 + SPINNER.x1) / 2), .3, Z(SPINNER.y)); t.add(this.spinner);
    for (const side of [-1, 1]) s.tube(t, metal, X((SPINNER.x0 + SPINNER.x1) / 2) + side * .36, .2, Z(SPINNER.y), .025, .4);
    s.cube(this.spinner, material('#dfe6f5', .2, .9), 0, 0, 0, .62, .2, .03); s.cube(this.spinner, neon(CYAN), 0, -.07, .02, .6, .04, .01);
    LANES.forEach((x, i) => { const m = neon('#331a2e'); this.lanes.push(m); const disc = mesh(new T.CircleGeometry(.17, 20), m, t, X(x), .004, Z(105), false); disc.rotation.x = -Math.PI / 2; this.letter(['N', 'E', 'O'][i], X(x), Z(150)); });
    for (let i = 0; i < 4; i++) { const m = neon('#2a1630'); this.bonus.push(m); const disc = mesh(new T.CircleGeometry(.12, 16), m, t, X(250 + i * 32), .004, Z(450), false); disc.rotation.x = -Math.PI / 2; }
    for (let i = 0; i < 3; i++) { const m = neon('#2a1630'); this.locks.push(m); const disc = mesh(new T.CircleGeometry(.1, 16), m, t, X(452 + i * 20), .004, Z(560 - i * 22), false); disc.rotation.x = -Math.PI / 2; }
    const saveDisc = mesh(new T.CircleGeometry(.2, 20), this.save, t, X(TABLE.centre), .004, Z(880), false); saveDisc.rotation.x = -Math.PI / 2;
    // The ramp: a glassy lane on neon rails, lifted over the bumpers.
    const pts = RAMP_PATH.map(([x, y, h]) => new T.Vector3(X(x), H(h) + .05, Z(y))), curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', .2);
    const floor: number[] = [], rails: [T.Vector3[], T.Vector3[]] = [[], []];
    for (let i = 0; i <= 80; i++) {
      const p = curve.getPointAt(i / 80), tangent = curve.getTangentAt(i / 80), side = new T.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(.19);
      rails[0].push(p.clone().add(side).setY(p.y + .14)); rails[1].push(p.clone().sub(side).setY(p.y + .14)); floor.push(...p.clone().add(side).toArray(), ...p.clone().sub(side).toArray());
    }
    const index: number[] = []; for (let i = 0; i < 80; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const floorGeometry = new T.BufferGeometry(); floorGeometry.setAttribute('position', new T.Float32BufferAttribute(floor, 3)); floorGeometry.setIndex(index); floorGeometry.computeVertexNormals();
    mesh(floorGeometry, new T.MeshStandardMaterial({ color: '#7fdcff', transparent: true, opacity: .12, roughness: .1, metalness: .3, side: T.DoubleSide, depthWrite: false }), t, 0, 0, 0, false);
    for (const r of rails) { const m = neon(CYAN); this.rampGlow.push(m); mesh(new T.TubeGeometry(new T.CatmullRomCurve3(r), 80, .022, 6), m, t, 0, 0, 0, false); }
    for (const k of [2, 4, 6, 8]) { const p = pts[k]; s.tube(t, metal, p.x, p.y / 2, p.z, .03, p.y); }
    // Backbox with the dot-matrix display, and the glowing cabinet buttons.
    const box = new T.Group(); box.position.set(-.25, 0, -6.35); box.rotation.x = -.62; t.add(box); s.cube(box, material('#07080c', .8, .05), 0, 1.5, 0, 8.3, 3, .5);
    const screen = mesh(new T.PlaneGeometry(7.2, 1.8), new T.MeshBasicMaterial({ map: this.dmd.texture, toneMapped: false }), box, 0, 1.6, .26, false); screen.rotation.x = -.05;
    for (const [x, c] of [[-4, PINK], [3.5, CYAN]] as const) { const strip = mesh(this.shapes.block, neon(c), box, x, 1.5, .27, false); strip.scale.set(.06, 2.8, .02); }
    // Arcade glow spilling onto the floor around the cabinet.
    for (const [x, c] of [[-6.5, PINK], [6, CYAN]] as const) { const glow = this.sprite(c, 9, t, x, -1, 1); (glow.material as T.SpriteMaterial).opacity = .22; }
    for (const [x, c] of [[-4.42, PINK], [3.92, CYAN]] as const) { const m = neon(c); this.buttons.push(m); const b = s.tube(t, m, x, .3, 5.6, .16, .16, false); b.rotation.z = Math.PI / 2; this.sprite(c, .9, t, x, .3, 5.6); }
  }
  /** Bumpers, slingshots and drop targets come from the run, which lays them out when a stage starts. */
  private buildPieces() {
    const s = this.shapes, t = this.table;
    // Pop bumpers: black skirts, neon caps and halos.
    this.run.bumpers.forEach((b, i) => {
      const color = [CYAN, PINK, VIOLET][i], root = new T.Group(); root.position.set(X(b.x), 0, Z(b.y)); t.add(root);
      s.tube(root, material('#111319', .4, .5), 0, .14, 0, b.radius / 80, .28); const ring = neon(color); const r = mesh(new T.TorusGeometry(b.radius / 80 - .02, .03, 8, 32), ring, root, 0, .3, 0, false); r.rotation.x = Math.PI / 2;
      const cap = s.tube(root, material('#f4f6ff', .25, .2), 0, .38, 0, b.radius / 80 * .62, .1); this.bumpers.push({ cap, ring, halo: this.sprite(color, 1.3, root, 0, .4, 0), base: color });
    });
    // Slingshots with neon rubber on the kicking face.
    for (const sl of this.run.slings) {
      const shape = new T.Shape([sl.a, sl.b, sl.d].map(([x, y]) => new T.Vector2(X(x), -Z(y)))), body = mesh(new T.ExtrudeGeometry(shape, { depth: .28, bevelEnabled: false }), material('#14161e', .4, .5), t, 0, 0, 0);
      body.rotation.x = -Math.PI / 2; const rubber = neon(PINK); this.slings.push(rubber); this.rail(t, sl.a[0], sl.a[1], sl.d[0], sl.d[1], .3, rubber, .06);
    }
    for (const d of this.run.drops) { const m = s.cube(t, material(ORANGE, .4, .1), X(d.x), .2, Z((d.y0 + d.y1) / 2), .07, .4, (d.y1 - d.y0) / 80 - .04); (m.material as T.MeshStandardMaterial).emissive.set(ORANGE); this.drops.push(m); }
  }
  private letter(text: string, x: number, z: number) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.font = '900 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 32, 34);
    const tex = new T.CanvasTexture(c), m = mesh(new T.PlaneGeometry(.32, .32), new T.MeshBasicMaterial({ map: tex, transparent: true, color: '#ff9be8', toneMapped: false, depthWrite: false }), this.table, x, .006, z, false); m.rotation.x = -Math.PI / 2;
  }
  resize(width: number, height: number, pixelRatio: number): void { super.resize(width, height, pixelRatio); this.fit = { aspect: width / Math.max(1, height), done: '' }; }
  /** Pulls the camera back until the whole cabinet, display included, fits the screen. */
  private frame() {
    const cam = this.camera as T.PerspectiveCamera, key = `${this.fit.aspect.toFixed(3)}`; if (this.fit.done === key) return; this.fit.done = key;
    cam.aspect = this.fit.aspect; cam.fov = this.fit.aspect < .8 ? 44 : 36; cam.updateProjectionMatrix();
    const target = new T.Vector3(-.25, 0, -.2), dir = new T.Vector3(0, Math.sin(1.08), Math.cos(1.08)), corners = [[-4.4, 0, 6.8], [3.95, 0, 6.8], [-4.4, 3.1, -6.4], [3.95, 3.1, -6.4], [-4.4, .7, 0], [3.95, .7, 0]].map(([x, y, z]) => new T.Vector3(x, y, z));
    let dist = 16;
    for (let k = 0; k < 6; k++) {
      cam.position.copy(target).addScaledVector(dir, dist); cam.lookAt(target); cam.updateMatrixWorld();
      const worst = Math.max(...corners.map(c => { const p = c.clone().project(cam); return Math.max(Math.abs(p.x), Math.abs(p.y)); })); dist *= Math.max(.7, Math.min(1.4, worst / .95));
    }
    cam.position.copy(target).addScaledVector(dir, dist); cam.lookAt(target);
  }
  protected rebuild(): void { if (!this.bumpers.length && this.run.bumpers.length) this.buildPieces(); for (const { ball, halo } of this.balls.values()) { ball.removeFromParent(); halo.removeFromParent(); halo.material.dispose(); } this.balls.clear(); }
  private ballMesh(b: Pinball) {
    let entry = this.balls.get(b.id);
    if (!entry) { const ball = mesh(new T.SphereGeometry(BALL_R / 80, 24, 16), this.ballMaterial, this.table, 0, 0, 0); entry = { ball, halo: this.sprite('#9fe9ff', .55, this.table, 0, 0, 0) }; this.balls.set(b.id, entry); }
    return entry;
  }
  protected update(dt: number, reduced: boolean): void {
    this.frame(); const run = this.run, time = reduced ? 0 : run.elapsed, live = new Set<number>();
    const style = run.config.characterStyle ?? 'original'; this.ballMaterial.color.set(style === 'robot' ? '#65efff' : style === 'armored' ? '#ffbd62' : style === 'astronaut' ? '#d9c8ff' : '#e9f1ff');
    for (const b of run.balls) {
      live.add(b.id); const { ball, halo } = this.ballMesh(b), h = b.ramp ? H(rampPoint(b.ramp.s).z) + .05 : 0;
      ball.position.set(X(b.x), BALL_R / 80 + h, Z(b.y)); ball.rotation.x += (b.vy / 80) * dt / (BALL_R / 80); ball.rotation.z -= (b.vx / 80) * dt / (BALL_R / 80);
      halo.position.copy(ball.position); halo.visible = !reduced;
    }
    for (const [id, { ball, halo }] of this.balls) if (!live.has(id)) { ball.removeFromParent(); halo.removeFromParent(); halo.material.dispose(); this.balls.delete(id); }
    const lead = run.balls[0]; if (lead) { this.origin.set(X(lead.x), .3, Z(lead.y)); this.ballLight.position.set(X(lead.x), .6, Z(lead.y)); }
    run.bumpers.forEach((b, i) => { const e = this.bumpers[i], on = b.flash > 0; e.ring.color.set(on ? '#ffffff' : e.base); e.halo.scale.setScalar(on && !reduced ? 1.9 : 1.2); e.cap.position.y = on ? .33 : .38; });
    run.flippers.forEach((f, i) => {
      let e = this.flippers[i];
      if (!e) {
        const root = new T.Group(); root.position.set(X(f.x), .14, Z(f.y)); this.table.add(root); const len = f.length / 80, r0 = .15, r1 = .088;
        const shape = new T.Shape(); shape.absarc(0, 0, r0, Math.PI / 2, Math.PI * 1.5, false); shape.lineTo(len, -r1); shape.absarc(len, 0, r1, -Math.PI / 2, Math.PI / 2, false); shape.lineTo(0, r0);
        const bat = mesh(new T.ExtrudeGeometry(shape, { depth: .2, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2 }), material('#f3f5ff', .3, .2), root, 0, -.1, 0); bat.rotation.x = Math.PI / 2;
        const rubber = neon(f.left ? PINK : CYAN);
        const stripe = mesh(this.shapes.block, rubber, root, len / 2, .02, 0, false); stripe.scale.set(len, .03, .05);
        castShadows(root); e = { root, rubber }; this.flippers[i] = e;
      }
      e.root.rotation.y = -f.angle; e.rubber.color.set(run.held(f) ? '#ffffff' : f.left ? PINK : CYAN);
    });
    run.slings.forEach((s, i) => this.slings[i].color.set(s.flash > 0 ? '#ffffff' : PINK));
    run.drops.forEach((d, i) => { const m = this.drops[i]; m.position.y += ((d.down ? -.22 : .2) - m.position.y) * Math.min(1, dt * 18); });
    this.spinner.rotation.x = -run.spinner.angle;
    run.lanes.forEach((on, i) => this.lanes[i].color.set(on || run.laneFlash[i] > 0 ? PINK : '#331a2e'));
    this.bonus.forEach((m, i) => m.color.set(run.bonus >= i + 2 ? VIOLET : '#2a1630'));
    this.locks.forEach((m, i) => m.color.set(run.multiball ? (Math.floor(time * 6) % 2 ? '#ffffff' : PINK) : run.locks > i ? PINK : '#2a1630'));
    this.rampGlow.forEach(m => m.color.set(run.rampFlash > 0 && Math.floor(time * 14) % 2 ? '#ffffff' : run.multiball ? PINK : CYAN));
    this.save.color.set(run.config.assist && run.saveTimer > 0 && !run.saveUsed ? (Math.floor(time * 4) % 2 ? CYAN : '#0b3540') : '#0b2027');
    this.buttons[0].color.set(run.input.left ? '#ffffff' : PINK); this.buttons[1].color.set(run.input.right ? '#ffffff' : CYAN);
    const goals = run.goalProgress().map(g => `${g.value}/${g.count}`).join(' ');
    if (run.display.timer > 0) this.dmd.draw(run.display.text, `BALL ${Math.max(1, run.config.lives - run.lives + 1)}   ${goals}`, Math.floor(time * 5) % 2 ? '#ffffff' : '#ff5ad1');
    else this.dmd.draw(run.score.toLocaleString('en-US'), `${run.levelName.toUpperCase()}   ${goals}`);
    this.followLight(0, 0);
  }
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    super.render(dt, held, reduced, cues);
    const run = this.run, key = `${run.revision}|${run.phase}|${run.lives}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/jpeg', .84); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }
  dispose(): void { this.halo.dispose(); this.dmd.texture.dispose(); super.dispose(); }
}
function castShadows(root: T.Object3D) { root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = true; }); }
