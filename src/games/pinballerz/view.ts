import * as T from 'three';
import type { ArcadeCue } from '../premium-kit/core';
import { World } from '../three-kit/world';
import { PinballRun, PIN_RAILS, GOAL, HOME, KEEPER_Y, HOME_KEEPER_Y, BALL_R, TOKEN_R, CENTRE_SPOT, type Pinball, type PowerKind, type Player } from './run';
import { Footballer, KITS } from './players';
import { yourKit, rivalKit } from './kits';
import { PitchWeather } from './weather';
import { X, Z, U, venue, buildVenue, buildRails, Crowd, CentreNumber, GoalFrame, netTexture, type VenueParts } from './stadium';

const LIGHT = {
  day: { hemi: ['#ffffff', '#4f6a45', 1.25], sun: ['#fff4de', 2.3], lamps: false, exposure: 1.05 },
  dusk: { hemi: ['#ffd9bd', '#4a3a55', 1.0], sun: ['#ffb36e', 2.0], lamps: true, exposure: 1.0 },
  night: { hemi: ['#9fb6ff', '#1c2440', .75], sun: ['#e6eeff', 1.9], lamps: true, exposure: 1.08 },
} as const;
const POWER_COLOR: Record<PowerKind, string> = { fire: '#ff6a1f', multi: '#3fd0ff', wall: '#ff4fa3', freeze: '#9fe8ff', double: '#ffd23f' };

function soccerTexture(): T.CanvasTexture {
  // An equirectangular patchwork: white panels with black pentagons at the classic positions.
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#16161c';
  const pent = (x: number, y: number, r: number, sx = 1) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.lineTo(x + Math.cos(a) * r * sx, y + Math.sin(a) * r); } g.closePath(); g.fill(); };
  for (let i = 0; i < 5; i++) { pent(i * 51.2 + 10, 40, 13, 1.1); pent(i * 51.2 + 36, 88, 13, 1.1); }
  pent(128, 4, 10, 6); pent(128, 124, 10, 6);
  g.strokeStyle = '#c9c9c4'; g.lineWidth = 1.2; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(i * 25.6, 0); g.lineTo(i * 25.6 + 12, 128); g.stroke(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function glowTexture(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
/** Power-up token art: a coloured disc with a simple white icon. */
function tokenTexture(kind: PowerKind): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = POWER_COLOR[kind]; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill(); g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'fire') { g.beginPath(); g.moveTo(64, 22); g.bezierCurveTo(98, 56, 92, 104, 64, 104); g.bezierCurveTo(36, 104, 30, 70, 50, 52); g.bezierCurveTo(52, 66, 60, 70, 64, 66); g.bezierCurveTo(58, 50, 60, 36, 64, 22); g.fill(); }
  else if (kind === 'multi') for (const [x, y] of [[44, 78], [84, 78], [64, 44]]) { g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'wall') { for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) g.fillRect(28 + k * 25 + (r % 2) * 10 - 5, 38 + r * 20, 21, 15); }
  else if (kind === 'freeze') { g.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.moveTo(64 - Math.cos(a) * 38, 64 - Math.sin(a) * 38); g.lineTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38); } g.stroke(); }
  else { g.font = '900 56px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2×', 64, 68); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

interface Piece { p: T.Vector3; v: T.Vector3; spin: T.Vector3; r: T.Euler; age: number; life: number; color: T.Color; kind: 'paper' | 'rocket' | 'spark'; size: number }
/** Goal celebrations: confetti, fireworks and smoke flares from one instanced mesh and a small sprite pool. */
class Party {
  private mesh: T.InstancedMesh; private pieces: Piece[] = []; private dummy = new T.Object3D(); private smoke: { sprite: T.Sprite; v: T.Vector3; age: number }[] = [];
  constructor(private parent: T.Object3D, private glow: T.Texture) {
    this.mesh = new T.InstancedMesh(new T.PlaneGeometry(.09, .055), new T.MeshBasicMaterial({ side: T.DoubleSide, toneMapped: false }), 420);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0; parent.add(this.mesh);
  }
  burst(kind: string, x: number, z: number, colors: string[], reduced: boolean) {
    if (reduced) return; const rnd = (i: number, k: number) => Math.sin(i * 12.9898 + k * 78.233) * .5 + .5;
    const paper = (n: number, ox: number, oz: number, up: number) => { for (let i = 0; i < n; i++) this.pieces.push({ p: new T.Vector3(ox, .9, oz), v: new T.Vector3((rnd(i, 1) - .5) * 5, up + rnd(i, 2) * 3, (rnd(i, 3) - .2) * 4), spin: new T.Vector3(rnd(i, 4) * 12, rnd(i, 5) * 9, rnd(i, 6) * 7), r: new T.Euler(), age: 0, life: 2.6 + rnd(i, 7), color: new T.Color(colors[i % colors.length]), kind: 'paper', size: 1 }); };
    if (kind === 'fireworks') for (let k = 0; k < 6; k++) this.pieces.push({ p: new T.Vector3(x + (k - 2.5) * 1.6, .5, z - 2.2 - (k % 2) * .8), v: new T.Vector3((k - 2.5) * .3, 8 + (k % 3), 0), spin: new T.Vector3(), r: new T.Euler(), age: -k * .22, life: .75, color: new T.Color(colors[k % colors.length]), kind: 'rocket', size: 1.6 });
    else if (kind === 'flares') for (let k = 0; k < 18; k++) { const sprite = new T.Sprite(new T.SpriteMaterial({ map: this.glow, color: colors[k % 2], transparent: true, opacity: .6, depthWrite: false })); sprite.position.set(x + (k % 6 - 2.5) * 1.5, .6, z - 2.4 - Math.floor(k / 6) * .5); sprite.scale.setScalar(.6); this.parent.add(sprite); this.smoke.push({ sprite, v: new T.Vector3((k % 3 - 1) * .25, 1 + (k % 4) * .25, -.2), age: -(k % 6) * .15 }); }
    paper(kind === 'confetti' ? 220 : kind === 'backflip' ? 90 : 50, x, z, kind === 'confetti' ? 4 : 3);
    if (kind === 'confetti') { paper(60, x - 3, z + .4, 5); paper(60, x + 3, z + .4, 5); }
    this.pieces = this.pieces.slice(-420); this.smoke = this.smoke.slice(-24);
  }
  update(dt: number) {
    const born: Piece[] = [];
    for (const p of this.pieces) {
      p.age += dt; if (p.age < 0) continue;
      if (p.kind === 'paper') { p.v.y -= 4 * dt; p.v.multiplyScalar(1 - dt * 1.6); p.r.x += p.spin.x * dt; p.r.y += p.spin.y * dt; p.r.z += p.spin.z * dt; }
      else { p.v.y -= (p.kind === 'rocket' ? 2 : 3.5) * dt; p.v.multiplyScalar(1 - dt * (p.kind === 'spark' ? 1.2 : 0)); }
      p.p.addScaledVector(p.v, dt);
      if (p.kind === 'rocket' && p.age >= p.life) for (let i = 0; i < 48; i++) { const a = i * 2.399, b = Math.acos(1 - 2 * ((i + .5) / 48)); born.push({ p: p.p.clone(), v: new T.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).multiplyScalar(3.2), spin: new T.Vector3(), r: new T.Euler(), age: 0, life: 1.3, color: p.color.clone().offsetHSL((i % 3) * .05, 0, .1), kind: 'spark', size: 1.1 }); }
    }
    this.pieces = [...this.pieces.filter(p => p.age < p.life), ...born].slice(-420);
    this.mesh.count = this.pieces.length; const d = this.dummy;
    this.pieces.forEach((p, i) => { const fade = p.kind === 'paper' ? 1 : Math.max(0, 1 - p.age / p.life); d.position.copy(p.p); d.rotation.copy(p.r); d.scale.setScalar(p.age < 0 ? 0 : p.size * (p.kind === 'paper' ? 1 : fade)); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); this.mesh.setColorAt(i, p.color); });
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const s of this.smoke) { s.age += dt; if (s.age < 0) continue; s.sprite.position.addScaledVector(s.v, dt); s.sprite.scale.setScalar(.6 + s.age * 1.4); (s.sprite.material as T.SpriteMaterial).opacity = Math.max(0, .55 * (1 - s.age / 3)); }
    for (const s of this.smoke.filter(s => s.age >= 3)) { s.sprite.removeFromParent(); s.sprite.material.dispose(); }
    this.smoke = this.smoke.filter(s => s.age < 3);
  }
  clear() { this.pieces = []; for (const s of this.smoke) { s.sprite.removeFromParent(); s.sprite.material.dispose(); } this.smoke = []; this.mesh.count = 0; }
}

interface BallView { ball: T.Mesh; trail: T.Sprite[]; flame: T.Sprite }
export class PinballView extends World<PinballRun> {
  private venueRoot = new T.Group(); private railRoot = new T.Group(); private table = new T.Group();
  private hemi: T.HemisphereLight; private crowd: Crowd; private number: CentreNumber; private goals: GoalFrame[] = []; private party: Party;
  private lamps: T.Object3D[] = []; private boards: T.Texture[] = []; private pitchMaterial: T.MeshStandardMaterial | null = null; private venueKey = ''; private parts: VenueParts | null = null;
  private weather: PitchWeather; private baseLight = { hemi: 1, sun: 1 };
  private balls = new Map<number, BallView>(); private ballMaterial: T.MeshStandardMaterial; private glow = glowTexture(); private ballGeometry = new T.SphereGeometry(U(BALL_R), 24, 16);
  private flippers: { root: T.Group; stripe: T.MeshStandardMaterial }[] = []; private players = new Map<number, Footballer>(); private keeper: Footballer; private homeKeeper: Footballer; private referee: Footballer; private wall: Footballer[] = [];
  private ice: T.Mesh; private tokens = new Map<number, { sprite: T.Sprite; ring: T.Mesh }>(); private tokenTextures = new Map<PowerKind, T.CanvasTexture>();
  private fit = { width: 1, height: 1, key: '' }; private shake = 0; private lastGoal = -1; private celebrate = 0; private celebrateWin = true; private touch = false;
  private shot: string | null = null; private shotKey = '';
  constructor(canvas: HTMLCanvasElement, run: PinballRun) {
    super(canvas, run, '#3c1a78', 16); this.remix.ownWorld(true); this.floaterScale = .42;
    this.camera = new T.PerspectiveCamera(36, 1, .1, 160);
    this.hemi = this.scene.children.find((o): o is T.HemisphereLight => o instanceof T.HemisphereLight)!;
    this.sun.shadow.camera.left = -7.5; this.sun.shadow.camera.right = 7.5; this.sun.shadow.camera.top = 9; this.sun.shadow.camera.bottom = -9; this.sun.shadow.camera.updateProjectionMatrix(); this.sun.shadow.mapSize.set(2048, 2048);
    this.scene.fog = null; this.scene.add(this.venueRoot, this.railRoot, this.table);
    this.crowd = new Crowd(this.scene); this.weather = new PitchWeather(this.scene, this.glow); this.number = new CentreNumber(this.table); this.party = new Party(this.scene, this.glow);
    const net = netTexture(); this.goals = [new GoalFrame(this.table, GOAL.left, GOAL.right, GOAL.y, GOAL.back, .92, net), new GoalFrame(this.table, HOME.left, HOME.right, HOME.y + 6, HOME.back + 8, .7, net)];
    this.ballMaterial = new T.MeshStandardMaterial({ map: soccerTexture(), roughness: .45 });
    this.keeper = this.footballer(KITS.rivalKeeper, 101); this.homeKeeper = this.footballer(KITS.homeKeeper, 202); this.referee = this.footballer(KITS.referee, 303);
    for (let i = 0; i < 3; i++) this.wall.push(this.footballer(KITS.home, 400 + i));
    this.ice = new T.Mesh(new T.BoxGeometry(.75, .85, .5), new T.MeshStandardMaterial({ color: '#bdf2ff', transparent: true, opacity: .45, roughness: .1, metalness: .1, depthWrite: false })); this.ice.visible = false; this.table.add(this.ice);
    try { this.touch = window.matchMedia('(any-pointer: coarse)').matches; } catch { this.touch = false; }
  }
  private footballer(kit: typeof KITS[keyof typeof KITS], seed: number) { const f = new Footballer(kit, seed); this.table.add(f.root); return f; }
  /** Flippers and their pivot posts. */
  private buildPitchPieces() {
    const post = new T.MeshStandardMaterial({ color: '#f4f0e6', roughness: .4 }), cap = new T.MeshStandardMaterial({ color: '#b9bcc4', roughness: .3, metalness: .4 });
    for (const f of this.run.flippers) {
      const root = new T.Group(); root.position.set(X(f.x), 0, Z(f.y)); this.table.add(root); const len = U(f.length), r0 = U(13), r1 = U(8);
      const shape = new T.Shape(); shape.absarc(0, 0, r0, Math.PI / 2, Math.PI * 1.5, false); shape.lineTo(len, -r1); shape.absarc(len, 0, r1, -Math.PI / 2, Math.PI / 2, false); shape.lineTo(0, r0);
      const bat = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .16, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 3 }), post); bat.rotation.x = Math.PI / 2; bat.position.y = .18; bat.castShadow = true; root.add(bat);
      const stripe = new T.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: .2, roughness: .4 }), band = new T.Mesh(new T.BoxGeometry(len * .78, .012, U(5)), stripe); band.position.set(len * .48, .2, 0); root.add(band);
      const p = new T.Mesh(new T.CylinderGeometry(U(12), U(13), .3, 18), post); p.position.set(X(f.x), .15, Z(f.y)); p.castShadow = true; this.table.add(p);
      const top = new T.Mesh(new T.CylinderGeometry(U(8), U(8), .02, 18), cap); top.position.set(X(f.x), .31, Z(f.y)); this.table.add(top);
      this.flippers.push({ root, stripe });
    }
  }
  /** Rebuilds the stadium for a new theme or stage lighting, keeping the run untouched. */
  private dressVenue() {
    const theme = this.run.config.worldTheme ?? 'classic', light = this.run.stage.light, key = `${theme}|${light}`; if (key === this.venueKey) return; this.venueKey = key;
    for (const root of [this.venueRoot, this.railRoot]) { this.disposeStage(root); root.clear(); }
    const v = venue(theme), built = buildVenue(this.venueRoot, v, this.crowd); this.parts = built; this.lamps = built.lamps; this.boards = built.boards; this.pitchMaterial = built.pitch;
    buildRails(this.railRoot, PIN_RAILS, v.rail);
    this.scene.background = new T.Color(v.outside);
    const l = LIGHT[light];
    this.hemi.color.set(light === 'day' ? v.hemi : l.hemi[0]); this.hemi.groundColor.set(l.hemi[1]); this.baseLight.hemi = l.hemi[2];
    this.sun.color.set(light === 'day' ? v.sun : l.sun[0]); this.baseLight.sun = l.sun[1];
    this.renderer.toneMappingExposure = l.exposure; this.scene.environmentIntensity = light === 'night' ? .35 : .55;
    for (const lamp of this.lamps) { const m = (lamp as T.Mesh).material as T.MeshBasicMaterial; m.color.set(l.lamps ? '#fff6d6' : '#8b8f99'); if (l.lamps) { const s = new T.Sprite(new T.SpriteMaterial({ map: this.glow, color: '#fff2c8', blending: T.AdditiveBlending, transparent: true, opacity: light === 'night' ? .9 : .5, depthWrite: false })); s.scale.setScalar(4); s.position.copy(lamp.position); this.venueRoot.add(s); } }
  }
  resize(width: number, height: number, pixelRatio: number): void { super.resize(width, height, pixelRatio); this.fit = { width, height, key: '' }; }
  /**
   * Frames the whole pitch from behind your goal, leaving a band at the top for the score panel and at the bottom
   * for touch controls. Works for portrait and landscape panes alike.
   */
  private frame() {
    const cam = this.camera as T.PerspectiveCamera, { width, height } = this.fit, key = `${width}x${height}`; if (this.fit.key === key) return; this.fit.key = key;
    const aspect = width / Math.max(1, height), top = Math.min(.2, Math.max(.08, 96 / height)), bottom = this.touch ? Math.min(.22, 132 / height) : Math.min(.12, 62 / height);
    cam.aspect = aspect; cam.fov = aspect < .7 ? 40 : 32; cam.clearViewOffset(); cam.updateProjectionMatrix();
    const tilt = aspect < .7 ? 1.24 : 1.17, dir = new T.Vector3(0, Math.sin(tilt), Math.cos(tilt)), target = new T.Vector3(0, 0, Z(520));
    const corners = [[76, 96, 0], [564, 96, 0], [76, 985, 0], [564, 985, 0], [GOAL.left, GOAL.back + 10, .95], [GOAL.right, GOAL.back + 10, .95], [320, 1000, 0]].map(([x, y, h]) => new T.Vector3(X(x), h, Z(y)));
    const yMax = 1 - top * 2, yMin = -1 + bottom * 2; let dist = 16;
    for (let k = 0; k < 14; k++) {
      cam.position.copy(target).addScaledVector(dir, dist); cam.lookAt(target); cam.updateMatrixWorld();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const c of corners) { const p = c.clone().project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const scale = Math.max((y1 - y0) / (yMax - yMin), (x1 - x0) / 1.9); dist *= Math.max(.8, Math.min(1.25, scale));
      // Slide the view so the pitch sits centred in the free band.
      const off = (y0 + y1) / 2 - (yMax + yMin) / 2; target.z -= off * dist * .38;
    }
    cam.position.copy(target).addScaledVector(dir, dist); cam.lookAt(target); this.cameraBase = { position: cam.position.clone(), target: target.clone() };
  }
  private cameraBase = { position: new T.Vector3(), target: new T.Vector3() };
  protected rebuild(): void {
    for (const view of this.balls.values()) this.dropBall(view); this.balls.clear();
    for (const p of this.players.values()) p.dispose(); this.players.clear();
    for (const t of this.tokens.values()) { t.sprite.removeFromParent(); t.sprite.material.dispose(); t.ring.removeFromParent(); t.ring.geometry.dispose(); } this.tokens.clear();
    this.party.clear(); this.lastGoal = this.run.goal?.id ?? -1; this.celebrate = 0; this.venueKey = '';
  }
  private dropBall(view: BallView) { view.ball.removeFromParent(); view.flame.removeFromParent(); view.flame.material.dispose(); for (const s of view.trail) { s.removeFromParent(); s.material.dispose(); } }
  private ballView(b: Pinball): BallView {
    let view = this.balls.get(b.id);
    if (!view) {
      const ball = new T.Mesh(this.ballGeometry, this.ballMaterial); ball.castShadow = true; this.table.add(ball);
      const sprite = (color: string, opacity: number) => { const s = new T.Sprite(new T.SpriteMaterial({ map: this.glow, color, blending: T.AdditiveBlending, transparent: true, opacity, depthWrite: false })); this.table.add(s); return s; };
      view = { ball, trail: Array.from({ length: 7 }, () => sprite('#ffffff', .25)), flame: sprite('#ff7a1f', .9) }; this.balls.set(b.id, view);
    }
    return view;
  }
  protected update(dt: number, reduced: boolean): void {
    this.dressVenue(); this.frame();
    const run = this.run, time = this.time, v = venue(run.config.worldTheme), mine = yourKit(run.config.characterStyle), theirs = rivalKit(v.home, v.away, mine.outfield), style = mine.robot ? 'robot' : 'original';
    // Balls roll on the grass: rotation follows the distance travelled.
    const live = new Set<number>();
    for (const b of run.balls) {
      live.add(b.id); const view = this.ballView(b), { ball } = view, lift = b.state === 'net' ? .08 : 0;
      const nx = X(b.x), nz = Z(b.y), dx = nx - ball.position.x, dz = nz - ball.position.z, dist = Math.hypot(dx, dz);
      if (dist > 1e-5 && dist < 1) ball.rotateOnWorldAxis(new T.Vector3(dz, 0, -dx).normalize(), dist / U(BALL_R));
      ball.position.set(nx, U(BALL_R) + lift, nz);
      const fast = Math.hypot(b.vx, b.vy) > 900 && !reduced && b.state === 'play';
      view.trail.forEach((s, i) => { const p = b.trail[b.trail.length - 1 - i * 2]; s.visible = fast && Boolean(p); if (p) { s.position.set(X(p.x), U(BALL_R), Z(p.y)); s.scale.setScalar(U(BALL_R) * (2.6 - i * .28)); s.material.color.set(b.fire > 0 ? '#ff8a2a' : '#ffffff'); } });
      view.flame.visible = b.fire > 0 && !reduced; view.flame.position.copy(ball.position); view.flame.scale.setScalar(.75 + Math.sin(time * 30) * .08);
    }
    for (const [id, view] of this.balls) if (!live.has(id)) { this.dropBall(view); this.balls.delete(id); }
    const lead = run.live[0] ?? run.balls[0];
    if (lead) { this.origin.set(X(lead.x), .4, Z(lead.y)); } else this.origin.set(0, .4, Z(GOAL.y + 40));
    // Flippers.
    if (!this.flippers.length && run.flippers.length) this.buildPitchPieces();
    run.flippers.forEach((f, i) => { const e = this.flippers[i]; e.root.rotation.y = -f.angle; const armed = run.powerArmed > 0; e.stripe.color.set(armed ? '#ff8a1f' : run.held(f) ? '#ffffff' : '#ff4fa3'); e.stripe.emissive.set(armed ? '#ff6a1f' : '#ff4fa3'); e.stripe.emissiveIntensity = run.held(f) || armed ? 1.2 : .2; });
    // Outfield players: rivals face the ball and run when they move; teammates face the rival goal.
    const seen = new Set<number>();
    for (const p of run.players) {
      seen.add(p.id); let f = this.players.get(p.id);
      if (!f) { f = this.footballer(p.mate ? mine.outfield : theirs, p.id * 13); this.players.set(p.id, f); }
      f.setLook(p.mate ? mine.outfield : theirs, p.mate ? style : 'original'); this.place(f, p, lead, dt);
    }
    for (const [id, f] of this.players) if (!seen.has(id)) { f.dispose(); this.players.delete(id); }
    // Keepers, referee and the goal-line wall.
    const k = run.keeper, kf = this.keeper; kf.setLook(KITS.rivalKeeper, 'original'); kf.root.position.set(X(k.x), 0, Z(KEEPER_Y)); kf.root.rotation.y = lead ? Math.atan2(X(lead.x) - X(k.x), Z(lead.y) - Z(KEEPER_Y)) * .5 : 0;
    kf.pose = this.celebrate > 0 && !this.celebrateWin ? 'celebrate' : this.celebrate > 0 ? 'dejected' : 'keeper'; kf.speed = k.vx / 120; kf.dive = k.dive; kf.knocked = k.knocked; kf.update(dt, reduced);
    this.ice.visible = run.power.freeze > 0; this.ice.position.set(X(k.x), .42, Z(KEEPER_Y));
    const h = run.home, hf = this.homeKeeper; hf.setLook(mine.keeper, style); hf.root.position.set(X(h.x), 0, Z(HOME_KEEPER_Y)); hf.root.rotation.y = Math.PI;
    if (this.celebrate <= 0) hf.pose = 'keeper'; hf.speed = h.vx / 120; hf.dive = h.dive; hf.update(dt, reduced);
    const ref = this.referee, refX = 34 + Math.max(0, Math.min(1, ((lead?.x ?? 320) - 100) / 440)) * 40, refY = 66; ref.setStyle('original');
    const rx = X(refX), moving = Math.abs(ref.root.position.x - rx) > .02; ref.root.position.x += (rx - ref.root.position.x) * Math.min(1, dt * 3); ref.root.position.z = Z(refY);
    ref.root.rotation.y = lead ? Math.atan2(X(lead.x) - ref.root.position.x, Z(lead.y) - ref.root.position.z) : 0; ref.pose = this.celebrate > 0 ? 'point' : moving ? 'run' : 'idle'; ref.speed = .3; ref.update(dt, reduced);
    this.wall.forEach((w, i) => { w.setLook(mine.outfield, style); const on = run.power.wall > 0; w.root.visible = on; w.root.position.set(X(282 + i * 38), 0, Z(918)); w.root.rotation.y = Math.PI; w.root.scale.setScalar(on ? Math.min(1, run.power.wall * 3, 1) : .01); w.pose = 'keeper'; w.dive = 0; w.update(dt, reduced); });
    // Power-up tokens bob and spin above glowing rings.
    const tokenIds = new Set<number>();
    for (const t of run.tokens) {
      tokenIds.add(t.id); let e = this.tokens.get(t.id);
      if (!e) {
        let map = this.tokenTextures.get(t.kind); if (!map) { map = tokenTexture(t.kind); this.tokenTextures.set(t.kind, map); }
        const sprite = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false })); sprite.scale.setScalar(U(TOKEN_R) * 2.6); this.table.add(sprite);
        const ring = new T.Mesh(new T.RingGeometry(U(TOKEN_R) * .9, U(TOKEN_R) * 1.25, 32), new T.MeshBasicMaterial({ color: POWER_COLOR[t.kind], transparent: true, opacity: .8, toneMapped: false, depthWrite: false })); ring.rotation.x = -Math.PI / 2; this.table.add(ring);
        e = { sprite, ring }; this.tokens.set(t.id, e);
      }
      const blink = t.life < 2 && Math.floor(time * 8) % 2 === 0;
      e.sprite.position.set(X(t.x), .32 + (reduced ? 0 : Math.sin(time * 3 + t.id) * .06), Z(t.y)); e.sprite.material.opacity = blink ? .35 : 1;
      e.ring.position.set(X(t.x), .01, Z(t.y)); e.ring.scale.setScalar(1 + (reduced ? 0 : Math.sin(time * 5) * .12));
    }
    for (const [id, e] of this.tokens) if (!tokenIds.has(id)) { e.sprite.removeFromParent(); e.sprite.material.dispose(); e.ring.removeFromParent(); e.ring.geometry.dispose(); (e.ring.material as T.Material).dispose(); this.tokens.delete(id); }
    // Goals: net ripple, crowd eruption, celebration, camera punch.
    if (run.goal && run.goal.id !== this.lastGoal) {
      this.lastGoal = run.goal.id; const won = !run.goal.conceded; this.celebrate = won ? 2.4 : 1.4; this.celebrateWin = won;
      this.goals[won ? 0 : 1].hit(run.goal.x); this.shake = won ? .5 : .3;
      if (won) {
        this.crowd.excitement = 1; const kind = run.config.celebration ?? 'confetti';
        this.party.burst(kind, X(320), Z(GOAL.y), kind === 'flares' ? ['#ff4fa3', '#b06bff'] : [...v.fans.slice(0, 4), '#ffffff'], reduced);
        hf.pose = 'celebrate'; if (kind === 'backflip') hf.backflip();
        for (const f of this.players.values()) f.kick();
      }
    }
    this.celebrate = Math.max(0, this.celebrate - dt); this.party.update(dt); for (const g of this.goals) g.update(dt, reduced);
    if (this.celebrate <= 0 && hf.pose === 'celebrate') hf.pose = 'keeper';
    this.crowd.update(dt, time, run.config.crowd ?? 70, v.fans, reduced); this.parts?.animate(time, this.crowd.excitement, reduced);
    // Weather rolls in live: wet grass darkens and shines, snow settles, storms dim the lights and flash.
    const w = this.weather; w.update(dt, run.config.weather ?? 'clear', run.wind, reduced);
    if (this.pitchMaterial) { this.pitchMaterial.roughness = .85 - w.wet * .5; this.pitchMaterial.color.setScalar(1 - w.wet * .22); }
    this.hemi.intensity = this.baseLight.hemi * (1 - w.gloom * .4) + w.flash * 1.6; this.sun.intensity = this.baseLight.sun * (1 - w.gloom * .55) + w.flash * 2;
    this.ballMaterial.color.set(w.cover > .3 ? '#ffb15c' : '#ffffff');
    this.number.set(String(run.tally.goals), run.streak >= 3 ? '#ffd23f' : '#ffffff');
    const crowded = run.balls.some(b => Math.hypot(b.x - CENTRE_SPOT.x, b.y - CENTRE_SPOT.y) < 70); this.number.fade(crowded ? .25 : 1, dt);
    for (const b of this.boards) b.offset.x = reduced ? 0 : (time * .04) % 1;
    // Camera: a gentle punch-in on goals and a short shake.
    this.shake = Math.max(0, this.shake - dt); const cam = this.camera, base = this.cameraBase, s = reduced ? 0 : this.shake;
    cam.position.copy(base.position).add(new T.Vector3(Math.sin(time * 57) * s * .08, Math.cos(time * 49) * s * .06, 0)); cam.lookAt(base.target);
    // Sun from the upper right, so shadows fall toward the lower left as in a broadcast.
    this.sun.position.set(9, 18, -10); this.sun.target.position.set(0, 0, 0); this.sun.target.updateMatrixWorld();
  }
  private place(f: Footballer, p: Player, lead: Pinball | undefined, dt: number) {
    f.root.position.set(X(p.x), 0, Z(p.y));
    const toward = p.mate ? Math.PI : lead ? Math.atan2(X(lead.x) - X(p.x), Z(lead.y) - Z(p.y)) : 0;
    let diff = toward - f.root.rotation.y; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2; f.root.rotation.y += diff * Math.min(1, dt * 6);
    const speed = Math.hypot(p.vx, p.vy) / 120;
    if (p.flash > .25) f.kick();
    f.pose = this.celebrate > 0 ? (this.celebrateWin === p.mate ? 'celebrate' : 'dejected') : speed > .15 ? 'run' : 'idle'; f.speed = speed; f.update(dt, false);
  }
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    super.render(dt, held, reduced, cues);
    // Freeze the final frame for the result photo while it is still in the drawing buffer.
    const run = this.run, key = `${run.revision}|${run.phase}|${run.lives}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/jpeg', .84); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }
  diagnostics(): Record<string, number> { return { ...super.diagnostics(), players: this.players.size + 4, unityPlayers: [...this.players.values(), this.keeper].filter(p => p.loadedFromUnity).length }; }
  dispose(): void { this.weather.dispose(); this.glow.dispose(); this.ballGeometry.dispose(); for (const t of this.tokenTextures.values()) t.dispose(); this.party.clear(); super.dispose(); }
}
