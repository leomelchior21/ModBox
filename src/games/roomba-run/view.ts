import * as T from 'three';
import { RoombaRun, CELL } from './run';
import { World, material, mesh, label, floorTexture, batchScenery, type Shapes } from '../three-kit/world';
import { unityModel } from '../three-kit/unity-assets';
import type { DebrisKind, Furniture, Room } from './rooms';

const PX = 48; // dirt-map pixels per meter
function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D) => void, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d')!);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4; return t;
}
function floorMap(kind: Room['floor'], room: Room): T.Texture {
  if (kind === 'oak') { const t = floorTexture('wood'); t.repeat.set(room.width / 2.2, room.depth / 2.2); return t; }
  if (kind === 'tile') return canvasTexture(128, ctx => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { ctx.fillStyle = (x + y) % 2 ? '#e9e4da' : '#f6f2ea'; ctx.fillRect(x * 64, y * 64, 64, 64); } ctx.strokeStyle = '#cfc6b5'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 128, 128); ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke(); }, room.width / 1.6);
  if (kind === 'carpet') return canvasTexture(64, ctx => { ctx.fillStyle = '#9fb6d9'; ctx.fillRect(0, 0, 64, 64); for (let i = 0; i < 400; i++) { ctx.fillStyle = i % 2 ? '#93abd1' : '#abc1e2'; ctx.fillRect((i * 37) % 64, (i * 53) % 64, 1, 1); } }, room.width / 1.5);
  return canvasTexture(64, ctx => { ctx.fillStyle = '#b9b6ae'; ctx.fillRect(0, 0, 64, 64); for (let i = 0; i < 300; i++) { ctx.fillStyle = i % 3 ? '#aeaba2' : '#c6c3bb'; ctx.fillRect((i * 29) % 64, (i * 41) % 64, 2, 2); } }, room.width / 2);
}

/** Furniture in Room coordinates: a cozy low-poly set built from rounded boxes. */
function furniture(s: Shapes, parent: T.Object3D, f: Furniture) {
  const g = new T.Group(); g.position.set(f.x, 0, f.z); g.rotation.y = f.rotation ?? 0; parent.add(g);
  const c = (color: string, x: number, y: number, z: number, w: number, h: number, d: number, rough = .8) => s.cube(g, material(color, rough), x, y, z, w, h, d);
  const { w, d } = f;
  switch (f.type) {
    case 'sofa': case 'armchair': {
      const fabric = f.color ?? (f.type === 'sofa' ? '#c9765d' : '#5d8fa8'), cushion = f.type === 'sofa' ? '#dd8f74' : '#78a8c0';
      c(fabric, 0, .45, 0, w, .5, d); c(fabric, 0, .95, -d / 2 + .2, w, .9, .4); for (const side of [-1, 1]) c(fabric, side * (w / 2 - .14), .8, 0, .28, .6, d);
      const seats = f.type === 'sofa' ? 3 : 1; for (let i = 0; i < seats; i++) c(cushion, (i - (seats - 1) / 2) * (w - .3) / seats, .78, .08, (w - .4) / seats - .05, .18, d - .45);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) c('#4a3a30', sx * (w / 2 - .12), .1, sz * (d / 2 - .12), .1, .2, .1); break;
    }
    case 'coffeeTable': case 'table': case 'desk': {
      const top = f.type === 'desk' ? '#e9e3d6' : f.type === 'table' ? '#b98557' : '#d9b48a', height = f.type === 'coffeeTable' ? .45 : .78;
      c(top, 0, height, 0, w, .08, d, .5); for (const sx of [-1, 1]) for (const sz of [-1, 1]) c('#5b4636', sx * (w / 2 - .12), height / 2, sz * (d / 2 - .12), .08, height, .08);
      if (f.type === 'desk') { c('#2b3340', 0, height + .3, -d / 2 + .25, .9, .5, .06, .3); c('#7ec8f0', 0, height + .3, -d / 2 + .29, .8, .4, .01, .2); } break;
    }
    case 'chair': c('#c39463', 0, .45, 0, w, .06, d); c('#c39463', 0, .8, -d / 2 + .04, w, .64, .06); for (const sx of [-1, 1]) for (const sz of [-1, 1]) c('#7a5638', sx * (w / 2 - .06), .22, sz * (d / 2 - .06), .05, .45, .05); break;
    case 'shelf': {
      c('#9a7350', 0, 1.1, 0, w, 2.2, d); for (const y of [.4, .95, 1.5, 2]) c('#c9a47a', .05, y, 0, w - .05, .05, d - .1);
      const books = ['#5b8db3', '#d9a441', '#b85c5c', '#6f9a6b', '#8a6fb3'];
      for (let i = 0; i < 18; i++) { const row = i % 3, z = -d / 2 + .2 + Math.floor(i / 3) * (d - .4) / 6; c(books[i % 5], .05, .55 + row * .55 + .1, z, w - .2, .32, .12, .9); } break;
    }
    case 'tv': c('#5b4636', 0, .3, 0, w, .6, d); c('#1b1f26', 0, 1.05, 0, .08, .9, d * .85, .3); c('#3b6f9e', -.045, 1.05, 0, .01, .8, d * .8, .2); break;
    case 'counter': c('#f4f1ea', 0, .45, 0, w, .9, d); c('#6f7b85', 0, .92, 0, w + .04, .06, d + .04, .3); for (let i = 0; i < Math.floor(Math.max(w, d) / .9); i++) { const along = (i + .5) * .9 - Math.max(w, d) / 2; c('#d9d3c7', w > d ? along : d / 2 + .01, .5, w > d ? d / 2 + .01 : along, w > d ? .8 : .02, .7, w > d ? .02 : .8); } break;
    case 'fridge': c('#dfe6ec', 0, 1, 0, w, 2, d, .3); c('#b9c3cc', w / 2 + .01, 1.2, 0, .02, .06, d * .7, .3); break;
    case 'bed': c('#8a6a4c', 0, .25, 0, w, .5, d); c('#f4f1ea', 0, .58, .15, w - .1, .2, d - .3); c('#7aa6d9', 0, .7, .45, w - .05, .08, d - .9); c('#ffffff', 0, .72, -d / 2 + .45, w - .5, .14, .5); c('#8a6a4c', 0, .7, -d / 2 + .05, w, 1, .1); break;
    case 'toybox': c('#f0b43c', 0, .35, 0, w, .7, d); c('#e05a47', 0, .72, 0, w + .04, .06, d + .04); break;
    case 'washer': c('#eef1f4', 0, .45, 0, w, .9, d, .4); { const door = mesh(new T.CylinderGeometry(.28, .28, .04, 24), material('#5e7d96', .2, .3), g, 0, .45, d / 2 + .02); door.rotation.x = Math.PI / 2; } break;
    case 'workbench': c('#a97c4f', 0, .85, 0, w, .1, d); for (const sx of [-1, 1]) c('#6b4f33', sx * (w / 2 - .1), .42, 0, .12, .84, d - .1); c('#c94a3a', -w / 4, 1.05, 0, .5, .3, .3); c('#0aa6a8', w / 4, 1.02, 0, .4, .25, .25); break;
    case 'plant': { const pot = s.tube(g, material('#d78f5a'), 0, .25, 0, .25, .5); pot.scale.x = pot.scale.z = .25; for (let i = 0; i < 6; i++) { const leaf = s.ball(g, material(i % 2 ? '#6cc47f' : '#4fae66'), Math.sin(i) * .2, .75 + (i % 3) * .18, Math.cos(i) * .2, .26); leaf.scale.y = 1.6; } break; }
    default: c('#888888', 0, .4, 0, w, .8, d);
  }
}
function debrisModel(s: Shapes, kind: DebrisKind): T.Group {
  const g = new T.Group(), m = (color: string, rough = .7, metal = 0) => material(color, rough, metal);
  if (kind === 'coin') { const coin = mesh(new T.CylinderGeometry(.09, .09, .025, 16), m('#ffcf3a', .3, .7), g, 0, .02, 0); coin.rotation.z = .2; }
  else if (kind === 'popcorn') for (let i = 0; i < 3; i++) s.ball(g, m(i ? '#fff4d1' : '#ffd977'), Math.sin(i * 2) * .05, .04, Math.cos(i * 2) * .05, .045);
  else if (kind === 'crumbs') for (let i = 0; i < 5; i++) s.cube(g, m('#b9874f'), Math.sin(i * 2.4) * .08, .015, Math.cos(i * 2.4) * .08, .04, .03, .04, false);
  else if (kind === 'sock') { const sock = s.cube(g, m('#e2665c'), 0, .03, 0, .3, .05, .12); sock.rotation.y = .6; s.cube(g, m('#ffffff'), -.12, .035, .07, .08, .05, .12); }
  else if (kind === 'brick') { s.cube(g, m(['#e54b3c', '#3c8ce5', '#f4c430'][Math.floor(Math.random() * 3)], .4), 0, .04, 0, .16, .08, .08); }
  else if (kind === 'leaf') { const leaf = s.ball(g, m('#c7832f'), 0, .015, 0, .1); leaf.scale.set(1, .15, .6); }
  else { const bolt = s.tube(g, m('#9aa4ad', .3, .8), 0, .03, 0, .03, .12); bolt.rotation.z = Math.PI / 2; }
  return g;
}

export class RoombaView extends World<RoombaRun> {
  private room = new T.Group(); private robot = new T.Group(); private brushes: T.Group[] = []; private ring: T.MeshStandardMaterial; private suction: T.Mesh;
  private dirtCanvas = document.createElement('canvas'); private dirtTexture: T.CanvasTexture; private dirt: T.Mesh | null = null;
  private debris: T.Group[] = []; private toys: T.Group[] = []; private dock: T.MeshStandardMaterial | null = null; private builtFor = -1; private route: T.Line;
  private cam = new T.Vector3(); private look = new T.Vector3(); private camReady = false;
  constructor(canvas: HTMLCanvasElement, run: RoombaRun) {
    super(canvas, run, '#2b2420', 15);
    this.camera = new T.PerspectiveCamera(58, 1, .05, 80); this.scene.fog = null;
    this.dirtTexture = new T.CanvasTexture(this.dirtCanvas); this.dirtTexture.colorSpace = T.SRGBColorSpace;
    this.scene.add(this.room, this.robot);
    this.ring = material('#ff9d2e', .3, .2); this.ring.emissive.set('#ff8a1f'); this.ring.emissiveIntensity = .8;
    this.buildRobot(); unityModel(this.robot, 'vacuum'); this.remix.character(this.robot, 'vacuum');
    this.suction = mesh(new T.RingGeometry(.93, 1, 44), new T.MeshBasicMaterial({ color: '#bff6ff', transparent: true, opacity: .25, side: T.DoubleSide, depthWrite: false }), this.scene, 0, .03, 0, false); this.suction.rotation.x = -Math.PI / 2;
    this.route = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({ color: '#ffffff', dashSize: .15, gapSize: .12, transparent: true, opacity: .7 })); this.scene.add(this.route);
  }
  resize(width: number, height: number, pixelRatio: number): void { super.resize(width, height, pixelRatio); const c = this.camera as T.PerspectiveCamera; c.fov = width / height < .8 ? 72 : 58; c.updateProjectionMatrix(); }
  private buildRobot() {
    const s = this.shapes, white = material('#f7f7f4', .25, .2), rubber = material('#2e3338', .8), dark = material('#1c2024', .4, .3);
    s.tube(this.robot, rubber, 0, .05, 0, .37, .08); s.tube(this.robot, white, 0, .15, 0, .36, .18); s.tube(this.robot, white, 0, .25, 0, .33, .04);
    const arc = mesh(new T.TorusGeometry(.31, .018, 6, 40, Math.PI * 1.1), this.ring, this.robot, 0, .265, 0, false); arc.rotation.x = Math.PI / 2; arc.rotation.z = Math.PI * .95;
    s.tube(this.robot, dark, 0, .32, -.02, .09, .1); s.tube(this.robot, white, 0, .38, -.02, .095, .03); s.cube(this.robot, dark, 0, .15, .35, .3, .08, .05, false);
    for (const side of [-1, 1]) { const brush = new T.Group(); brush.position.set(side * .27, .03, .2); this.robot.add(brush); for (let i = 0; i < 3; i++) { const bristle = s.cube(brush, material('#ff9d2e'), 0, 0, .12, .025, .02, .26, false); bristle.rotation.y = i * Math.PI * 2 / 3; } this.brushes.push(brush); }
  }
  private build() {
    const run = this.run, room = run.room, s = this.shapes;
    this.disposeStage(this.room); this.room.clear(); this.debris = []; this.toys = []; this.camReady = false;
    const floor = material('#ffffff', .75); floor.map = floorMap(room.floor, room);
    s.cube(this.room, floor, 0, -.05, 0, room.width, .1, room.depth, false);
    // Walls face inwards only: when the chase camera passes behind one, it simply disappears.
    const wallMat = new T.MeshStandardMaterial({ color: room.wall, roughness: .9, side: T.FrontSide }), base = material('#f7efe2', .7);
    const wall = (x: number, z: number, length: number, rotation: number) => { const w = mesh(new T.PlaneGeometry(length, 2.6), wallMat, this.room, x, 1.3, z, false); w.rotation.y = rotation; const b = mesh(new T.PlaneGeometry(length, .14), base, this.room, x + Math.sin(rotation) * .01, .07, z + Math.cos(rotation) * .01, false); b.rotation.y = rotation; };
    wall(0, -room.depth / 2, room.width, 0); wall(0, room.depth / 2, room.width, Math.PI); wall(-room.width / 2, 0, room.depth, Math.PI / 2); wall(room.width / 2, 0, room.depth, -Math.PI / 2);
    const glass = material('#a9d8f0', .15, .2); glass.emissive.set('#bfe6ff'); glass.emissiveIntensity = .35;
    for (const x of [-room.width / 4, room.width / 4]) { const win = mesh(new T.PlaneGeometry(1.8, 1.3), glass, this.room, x, 1.55, -room.depth / 2 + .02, false); win.receiveShadow = false; }
    const rug = s.cube(this.room, material(room.floor === 'concrete' ? '#6f7e66' : '#b4c9a8', .95), room.width * .12, .006, room.depth * .1, room.width * .32, .012, room.depth * .3, false); rug.receiveShadow = true;
    for (const f of room.furniture) furniture(s, this.room, f);
    // Dock: a glowing charging base against the wall.
    this.dock = material('#62e0b4', .3, .2); this.dock.emissive.set('#2fbf8f');
    const dock = new T.Group(); dock.position.set(room.dock.x, 0, room.dock.z); dock.rotation.y = Math.atan2(-room.dock.x, -room.dock.z) * 0; this.room.add(dock);
    s.cube(dock, material('#2c3339', .5), 0, .02, .35, .9, .04, .5); s.cube(dock, material('#1c2024', .4), 0, .22, .58, .9, .44, .16); s.cube(dock, this.dock, 0, .3, .5, .5, .06, .02, false);
    const sign = label('DOCK', '#ffffff', '#1f8f6bdd'); sign.sprite.position.set(0, .75, .58); sign.sprite.scale.set(.6, .19, 1); dock.add(sign.sprite);
    batchScenery(this.room);
    // The dust layer: a canvas over the floor that the brush erases into clean trails.
    this.dirtCanvas.width = Math.ceil(room.width * PX); this.dirtCanvas.height = Math.ceil(room.depth * PX); this.paintDirt();
    this.dirt = mesh(new T.PlaneGeometry(room.width, room.depth), new T.MeshStandardMaterial({ map: this.dirtTexture, transparent: true, depthWrite: false, roughness: 1 }), this.room, 0, .012, 0, false); this.dirt.rotation.x = -Math.PI / 2; this.dirt.receiveShadow = true;
    this.dirt.userData.dynamic = true;
    for (const d of run.debris) { const g = debrisModel(s, d.kind); g.position.set(d.x, 0, d.z); g.rotation.y = d.x * 3.1; this.room.add(g); this.debris.push(g); }
    for (const toy of run.toys) {
      const g = new T.Group(); this.room.add(g); this.toys.push(g);
      if (toy.kind === 'ball') { s.ball(g, material('#ffffff', .5), 0, 0, 0, toy.r); for (let i = 0; i < 6; i++) { const patch = s.ball(g, material('#1b1b1b', .5), Math.sin(i * 1.05) * toy.r * .82, Math.cos(i * 2.1) * toy.r * .5, Math.cos(i * 1.05) * toy.r * .82, toy.r * .28); patch.scale.y = .6; } }
      else s.cube(g, material('#4aa3df', .5), 0, 0, 0, toy.r * 1.5, toy.r * 1.5, toy.r * 1.5);
    }
  }
  private paintDirt() {
    const run = this.run, g = run.grid, ctx = this.dirtCanvas.getContext('2d')!, w = this.dirtCanvas.width, h = this.dirtCanvas.height, cell = CELL * PX;
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < g.dirt.length; i++) {
      if (!g.cleanable[i] || g.dirt[i] <= 0) continue;
      // Soft overlapping smudges read as organic grime rather than a grid.
      const x = (i % g.cols + .5) * cell + Math.sin(i * 12.7) * cell * .3, y = (Math.floor(i / g.cols) + .5) * cell + Math.cos(i * 7.9) * cell * .3, a = Math.min(.5, .2 + g.initial[i] * .22);
      ctx.fillStyle = `rgba(88,62,38,${a})`; ctx.beginPath(); ctx.arc(x, y, cell * (.85 + (i % 5) * .08), 0, Math.PI * 2); ctx.fill();
    }
    // Specks, smudges and footprints so the dust reads as real grime.
    for (let i = 0; i < w * h / 90; i++) { const x = (i * 97.13) % w, y = (i * 53.71 + (i % 13) * 7) % h; ctx.fillStyle = i % 4 ? 'rgba(60,42,25,.45)' : 'rgba(170,140,100,.4)'; ctx.globalCompositeOperation = 'source-atop'; ctx.fillRect(x, y, 2 + (i % 3), 2); }
    for (let i = 0; i < 40; i++) { const x = (i * 211.7) % w, y = (i * 137.3) % h; ctx.fillStyle = 'rgba(55,38,22,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 7, 11, i, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; run.freshlyCleaned = []; this.dirtTexture.needsUpdate = true;
  }
  private eraseFresh() {
    const run = this.run; if (!run.freshlyCleaned.length) return;
    const g = run.grid, ctx = this.dirtCanvas.getContext('2d')!, cell = CELL * PX;
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
    for (const i of run.freshlyCleaned) { ctx.beginPath(); ctx.arc((i % g.cols + .5) * cell, (Math.floor(i / g.cols) + .5) * cell, cell * .95, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; run.freshlyCleaned = []; this.dirtTexture.needsUpdate = true;
  }
  protected rebuild(): void { this.builtFor = -1; }
  protected update(dt: number, reduced: boolean): void {
    const run = this.run;
    if (this.builtFor !== run.revision) { this.builtFor = run.revision; this.build(); }
    this.eraseFresh();
    this.robot.position.set(run.x, 0, run.z); this.robot.rotation.y = run.heading; this.robot.scale.setScalar(.74);
    this.brushes.forEach((b, i) => { b.rotation.y = reduced ? 0 : run.brushAngle * (i ? 1 : -1); });
    this.ring.emissiveIntensity = run.charging ? 1.4 + Math.sin(run.elapsed * 6) * .4 : run.turbo > 0 ? 1.6 : .8; this.ring.color.set(run.battery < 22 ? '#ff4a3a' : '#ff9d2e'); this.ring.emissive.set(run.battery < 22 ? '#ff2a1a' : '#ff8a1f');
    this.suction.position.set(run.x, .03, run.z); this.suction.scale.setScalar(run.radius); (this.suction.material as T.MeshBasicMaterial).opacity = run.turbo > 0 ? .5 : .22;
    if (this.dock) this.dock.emissiveIntensity = run.charging ? 1.6 : run.coverage >= run.target ? .9 + Math.sin(run.elapsed * 5) * .6 : .4;
    run.debris.forEach((d, i) => { const g = this.debris[i]; if (!g) return; g.visible = !d.taken; if (!reduced && d.kind === 'coin') g.rotation.y += dt * 3; });
    run.toys.forEach((t, i) => { const g = this.toys[i]; if (!g) return; g.position.set(t.x, t.r, t.z); g.rotation.x = reduced ? 0 : t.spin; });
    this.route.visible = run.path.length > 0;
    if (this.route.visible) { this.route.geometry.dispose(); this.route.geometry = new T.BufferGeometry().setFromPoints([new T.Vector3(run.x, .05, run.z), ...run.path.map(p => new T.Vector3(p.x, .05, p.z))]); this.route.computeLineDistances(); }
    // Third-person chase camera, held inside the room; N switches to an overview.
    const room = run.room, fx = Math.sin(run.heading), fz = Math.cos(run.heading);
    const desired = run.cameraClose ? new T.Vector3(run.x - fx * 3.4, 2.9, run.z - fz * 3.4) : new T.Vector3(run.x * .4, Math.max(room.width, room.depth) * .9, run.z * .4 + room.depth * .55);
    const target = run.cameraClose ? new T.Vector3(run.x + fx * 1.9, 0, run.z + fz * 1.9) : new T.Vector3(run.x * .5, 0, run.z * .5);
    if (run.cameraClose) { desired.x = T.MathUtils.clamp(desired.x, -room.width / 2 + .25, room.width / 2 - .25); desired.z = T.MathUtils.clamp(desired.z, -room.depth / 2 + .25, room.depth / 2 - .25); }
    if (!this.camReady || reduced) { this.cam.copy(desired); this.look.copy(target); this.camReady = true; }
    else { const k = 1 - Math.exp(-dt * 5); this.cam.lerp(desired, k); this.look.lerp(target, k); }
    this.camera.position.copy(this.cam); this.camera.lookAt(this.look); this.origin.set(run.x, .4, run.z); this.followLight(run.x, run.z);
  }
}
