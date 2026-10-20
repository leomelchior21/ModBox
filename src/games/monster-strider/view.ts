import * as T from 'three';
import type { ArcadeCue } from '../premium-kit/core';
import { World, material, mesh, label, batchScenery } from '../three-kit/world';
import { coinModel } from '../three-kit/models';
import { unityModel } from '../three-kit/unity-assets';
import { MonsterRun, WHEEL_RADIUS } from './run';
import { TRACK_DEPTH, WATER_Y, landHeight } from './levels';
import { buildTire, buildTruck, courseTextures, pixelMaterial, voxelBox } from './art';

/** Truck body colors per palette; the Unity model marks its paintable panels with pure #ffcc00. */
const TRUCK_PAINT: Record<string, string> = { amber: '#ffc61a', teal: '#25d6c2', violet: '#a48bff' };
const PAINT_KEY = new T.Color('#ffcc00');
const CLIFFS = ['#0f7fec', '#1a8ff5', '#0a6cd8', '#3aa4ff', '#2495fb'];
const up = new T.Vector3(0, 1, 0);

export class MonsterView extends World<MonsterRun> {
  private tex = courseTextures();
  private stage = new T.Group(); private backdrop = new T.Group(); private chassis = new T.Group(); private flame = new T.Group();
  private body = material(TRUCK_PAINT.amber, .55, .05);
  private axles: T.Group[] = []; private shocks: T.Mesh[] = [];
  private planks: { root: T.Group; thickness: number }[] = []; private crates: T.Mesh[] = []; private coins: T.Group[] = [];
  private flags: { cloth: T.MeshStandardMaterial; at: number }[] = []; private foam: T.Mesh[] = [];
  private ring: T.Mesh; private drops: T.InstancedMesh;
  private shot: string | null = null; private shotKey = ''; private crashShot: string | null = null; private crashKey = '';
  private cam = new T.Vector3(); private look = new T.Vector3(); private camReady = false; private lastX = 0;
  private paintSlots: { attribute: T.BufferAttribute; indices: number[] }[] | null = null; private tint = '';

  constructor(canvas: HTMLCanvasElement, run: MonsterRun) {
    super(canvas, run, '#7fd8ff', 19);
    this.camera = new T.PerspectiveCamera(32, 1, .5, 420);
    // Flat, saturated toy colors: no filmic curve, slightly brighter sky fill.
    this.renderer.toneMapping = T.NoToneMapping; this.scene.environmentIntensity = .3; this.sun.intensity = 2.7;
    this.scene.add(this.backdrop, this.stage, this.chassis);
    this.ring = mesh(new T.TorusGeometry(1, .07, 6, 40), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }), this.scene, 0, WATER_Y + .05, 0, false);
    this.ring.rotation.x = Math.PI / 2; this.ring.visible = false;
    this.drops = new T.InstancedMesh(new T.BoxGeometry(.16, .16, .16), new T.MeshBasicMaterial({ color: '#e9fbff' }), 28); this.drops.frustumCulled = false; this.drops.count = 0; this.scene.add(this.drops);
    this.buildBackdrop(); this.buildTruck();
  }
  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    const camera = this.camera as T.PerspectiveCamera; camera.fov = width / height < .8 ? 46 : 32; camera.updateProjectionMatrix();
  }
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    super.render(dt, held, reduced, cues);
    // Freeze the moment for the result polaroid while the frame is still in the drawing buffer:
    // the finish line for a win, the instant of impact (not the aftermath) for a wreck.
    const run = this.run, phase = run.phase, key = `${run.revision}|${phase}|${run.lives}`;
    if (run.crash && run.crash.timer < .85 && this.crashKey !== `${key}|${run.crash.message}`) { this.crashKey = `${key}|${run.crash.message}`; this.crashShot = this.capture(); }
    if ((phase === 'cleared' || phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; this.shot = phase === 'gameover' && this.crashShot ? this.crashShot : this.capture(); }
  }
  private capture(): string | null { try { return this.canvas.toDataURL('image/jpeg', .84); } catch { return null; } }
  snapshot(): string | null { return this.shot; }

  private buildBackdrop() {
    const s = this.shapes, water = material('#14c3f6', .25, 0); water.emissive.set('#0796d6'); water.emissiveIntensity = .22;
    const sea = mesh(new T.PlaneGeometry(700, 340), water, this.backdrop, 60, WATER_Y, -80, false); sea.rotation.x = -Math.PI / 2;
    const facets = CLIFFS.map(color => { const m = material(color, .85, 0); m.flatShading = true; return m; });
    const rock = new T.IcosahedronGeometry(1, 0);
    let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const x = -60 + i * 5.4 + rnd() * 4, back = i % 3, sy = 9 + rnd() * 13 + back * 5, cliff = mesh(rock, facets[i % facets.length], this.backdrop, x, WATER_Y + sy * .32, -26 - back * 11 - rnd() * 7, false);
      cliff.scale.set(5 + rnd() * 5, sy, 4 + rnd() * 4); cliff.rotation.set(rnd() * .3, rnd() * Math.PI, rnd() * .2);
    }
    const far = material('#7fcfff', .9, 0); far.flatShading = true;
    for (let i = 0; i < 18; i++) { const peak = mesh(rock, far, this.backdrop, -80 + i * 16, WATER_Y + 8, -95 - (i % 2) * 15, false); peak.scale.set(12, 26 + (i * 7) % 14, 9); peak.rotation.y = i * 1.3; }
    for (let i = 0; i < 6; i++) { const islet = s.cube(this.backdrop, material(i % 2 ? '#f6c8ab' : '#c97680'), -20 + i * 33, WATER_Y + .5, -16 - (i % 2) * 6, 3 + i % 3, 1.6, 3, false); islet.rotation.y = i; s.cube(this.backdrop, pixelMaterial(this.tex.grass), islet.position.x, WATER_Y + 1.4, islet.position.z, 3.1 + i % 3, .25, 3.1, false).rotation.y = i; }
    batchScenery(this.backdrop);
  }
  private buildTruck() {
    const s = this.shapes;
    buildTruck(s, this.chassis, this.body); unityModel(this.chassis, 'truck'); this.remix.character(this.chassis, 'vehicle');
    const axleMat = material('#3a4050', .6, .3);
    for (let i = 0; i < 2; i++) {
      const axle = new T.Group(); this.scene.add(axle); this.axles.push(axle);
      const bar = s.tube(axle, axleMat, 0, 0, 0, .1, 2.1); bar.rotation.x = Math.PI / 2;
      for (const z of [-1.02, 1.02]) { const tire = new T.Group(); tire.position.z = z; axle.add(tire); buildTire(s, tire, WHEEL_RADIUS); unityModel(tire, 'tire'); }
    }
    const spring = material('#ff4b4b', .5, .2), unit = new T.CylinderGeometry(1, 1, 1, 8);
    for (let i = 0; i < 4; i++) this.shocks.push(mesh(unit, i % 2 ? spring : material('#d9dee6', .3, .7), this.scene, 0, 0, 0));
    this.chassis.add(this.flame);
    for (const z of [-.45, .45]) { const fire = mesh(new T.ConeGeometry(.22, 1.3, 8), new T.MeshBasicMaterial({ color: '#7ff0ff' }), this.flame, -2.45, .35, z, false); fire.rotation.z = Math.PI / 2; }
  }

  protected rebuild(): void {
    this.disposeStage(this.stage); this.stage.clear(); this.planks = []; this.crates = []; this.coins = []; this.flags = []; this.foam = [];
    this.shot = null; this.shotKey = ''; this.crashShot = null; this.camReady = false;
    const run = this.run, level = run.stage, t = this.tex, s = this.shapes, half = TRACK_DEPTH / 2;
    const grass = pixelMaterial(t.grass), fringe = pixelMaterial(t.fringe, '#ffffff', .5), face = pixelMaterial(t.face), brick = pixelMaterial(t.brick), ornament = pixelMaterial(t.ornament);
    const foam = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9 });
    const post = (x: number, top: number, z: number, width = .7) => {
      const height = top - WATER_Y + .3; mesh(voxelBox(width, height, width), brick, this.stage, x, WATER_Y - .3 + height / 2, z);
      mesh(voxelBox(width * .8, width * .8, .05), ornament, this.stage, x, top - width * .55, z + width / 2 + .03, false);
    };
    const foamRing = (x0: number, x1: number, z0: number, z1: number, pad: number) => {
      for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 - pad, x1 - x0 + pad * 2, .16], [(x0 + x1) / 2, z1 + pad, x1 - x0 + pad * 2, .16], [x0 - pad, (z0 + z1) / 2, .16, z1 - z0 + pad * 2], [x1 + pad, (z0 + z1) / 2, .16, z1 - z0 + pad * 2]] as const) {
        this.foam.push(mesh(new T.BoxGeometry(w, .03, d), foam, this.stage, x, WATER_Y + .02, z, false));
      }
    };
    for (const piece of level.pieces) {
      if (piece.kind !== 'land') continue;
      const top = piece.top, x0 = top[0][0], x1 = top[top.length - 1][0], shape = new T.Shape();
      shape.moveTo(x0, WATER_Y - 1.2); for (const [x, y] of top) shape.lineTo(x, y); shape.lineTo(x1, WATER_Y - 1.2);
      const solid = new T.ExtrudeGeometry(shape, { depth: TRACK_DEPTH, bevelEnabled: false }); solid.translate(0, 0, -half); mesh(solid, face, this.stage);
      mesh(voxelBox(x1 - x0 + .1, .45, TRACK_DEPTH + .14), brick, this.stage, (x0 + x1) / 2, WATER_Y + .12, 0, false);
      for (let i = 0; i < top.length - 1; i++) {
        const [ax, ay] = top[i], [bx, by] = top[i + 1], length = Math.hypot(bx - ax, by - ay); if (length < .05 || Math.abs(by - ay) > Math.abs(bx - ax) * 2) continue;
        const angle = Math.atan2(by - ay, bx - ax), cap = new T.Mesh(voxelBox(length + .06, .42, TRACK_DEPTH + .12, true), [fringe, fringe, grass, grass, fringe, fringe]);
        cap.position.set((ax + bx) / 2 + Math.sin(angle) * .18, (ay + by) / 2 - Math.cos(angle) * .18, 0); cap.rotation.z = angle; cap.receiveShadow = true; this.stage.add(cap);
      }
      if (x0 > level.start - 7) post(x0 + .35, top[0][1] - .12, half - .3);
      if (x1 < level.finish + 4) post(x1 - .35, top[top.length - 1][1] - .12, half - .3);
      if (piece.gate) { const gx = level.start - 4.4, gy = landHeight(level, gx) ?? 0; for (const x of [gx - .9, gx + .9]) mesh(voxelBox(.42, 2.3, .42), brick, this.stage, x, gy + 1.15, -half + .5); mesh(voxelBox(2.3, .42, .42), brick, this.stage, gx, gy + 2.3, -half + .5); }
      foamRing(x0, x1, -half, half, .45);
    }
    const plankMat = { rope: pixelMaterial(t.plank), crumble: pixelMaterial(t.crumble), seesaw: pixelMaterial(t.plank, '#ffe2b0') }, metal = pixelMaterial(t.metal);
    const p = run.course.sim.p;
    for (const plank of run.course.planks) {
      const a = p[plank.a], b = p[plank.b], length = Math.hypot(b.x - a.x, b.y - a.y) + (plank.kind === 'rope' ? .02 : 0), thickness = plank.kind === 'seesaw' ? .38 : .26, depth = plank.kind === 'seesaw' ? 3.8 : 3.5;
      const root = new T.Group(); this.stage.add(root); mesh(voxelBox(length - (plank.kind === 'rope' ? .1 : 0), thickness, depth), plankMat[plank.kind], root);
      if (plank.kind !== 'seesaw') for (const x of [-length / 2 + .08, length / 2 - .08]) for (const z of [-depth / 2 - .04, depth / 2 + .04]) mesh(voxelBox(.22, .34, .08), metal, root, x, 0, z, false);
      else for (const x of [-length / 2 + .3, length / 2 - .3]) mesh(voxelBox(.35, .1, depth + .02), pixelMaterial(t.checker), root, x, thickness / 2 + .01, 0, false);
      root.userData.dynamic = true; this.planks.push({ root, thickness });
    }
    for (const seesaw of run.course.seesaws) {
      const pivot = p[seesaw.pivot], height = pivot.y - WATER_Y + .2, base = mesh(new T.ConeGeometry(1.3, height, 4), brick, this.stage, pivot.x, WATER_Y + height / 2 - .2, 0); base.rotation.y = Math.PI / 4;
      const axle = s.tube(this.stage, metal, pivot.x, pivot.y, 0, .16, 4.2); axle.rotation.x = Math.PI / 2;
      foamRing(pivot.x - .9, pivot.x + .9, -.9, .9, .3);
    }
    const crateMat = pixelMaterial(t.crate);
    for (const crate of run.course.crates) { const box = mesh(voxelBox(crate.size, crate.size, crate.size * 1.4), crateMat, this.stage); box.userData.dynamic = true; this.crates.push(box); }
    this.coins = run.coins.map(c => coinModel(s, this.stage, c.x, c.y, 0));
    for (const coin of this.coins) { coin.scale.setScalar(1.5); coin.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial) { o.material.emissive.set('#ffb21a'); o.material.emissiveIntensity = .45; o.material.metalness = .2; } }); }
    for (const at of level.checkpoints) {
      const y = landHeight(level, at) ?? 0, cloth = material('#1e8bff', .7); s.tube(this.stage, material('#f4f6fb'), at, y + 1.4, -half + .4, .06, 2.8);
      mesh(voxelBox(.9, .55, .05), cloth, this.stage, at + .48, y + 2.5, -half + .4); this.flags.push({ cloth, at });
    }
    const fy = landHeight(level, level.finish) ?? 0, checker = pixelMaterial(t.checker);
    mesh(voxelBox(1.5, .06, TRACK_DEPTH + .1), checker, this.stage, level.finish + .75, fy + .03, 0, false);
    for (const z of [-half + .2, half - .2]) { s.tube(this.stage, material('#f4f6fb'), level.finish, fy + 1.7, z, .08, 3.4); mesh(voxelBox(1.1, .7, .06), checker, this.stage, level.finish + .6, fy + 3, z); }
    for (const [at, text] of level.signs) {
      const sign = label(text, '#ffffff', '#1d6fe0e6'), y = landHeight(level, at) ?? 0; sign.sprite.position.set(at, y + 3.1, -half - .4); sign.sprite.scale.set(3.4, 1.06, 1); this.stage.add(sign.sprite);
      s.tube(this.stage, material('#f4f6fb'), at, y + 1.1, -half - .4, .07, 2.2);
    }
  }

  protected update(dt: number, reduced: boolean): void {
    const run = this.run, course = run.course, p = course.sim.p, truck = course.truck;
    this.chassis.position.set(run.x, run.y, 0); this.chassis.rotation.z = run.angle;
    this.flame.visible = run.turbo > 0; this.flame.scale.setScalar(reduced ? 1 : 1 + Math.sin(run.elapsed * 31) * .15);
    const cos = Math.cos(run.angle), sin = Math.sin(run.angle);
    for (let i = 0; i < 2; i++) {
      const w = p[truck.wheels[i]], axle = this.axles[i]; axle.position.set(w.x, w.y, 0); axle.rotation.z = truck.turn[i];
      const mx = run.x + (i ? 1.1 : -1.1) * cos - .1 * -sin, my = run.y + (i ? 1.1 : -1.1) * sin - .1 * cos;
      for (let side = 0; side < 2; side++) {
        const shock = this.shocks[i * 2 + side], z = side ? .7 : -.7, from = new T.Vector3(mx, my, z), to = new T.Vector3(w.x, w.y, z * 1.12), dir = to.clone().sub(from), length = dir.length();
        shock.position.copy(from).addScaledVector(dir, .5); shock.quaternion.setFromUnitVectors(up, dir.normalize()); shock.scale.set(side ? .11 : .07, length, side ? .11 : .07);
      }
    }
    this.paintTruck();
    for (let i = 0; i < this.planks.length; i++) {
      const plank = course.planks[i], view = this.planks[i], a = p[plank.a], b = p[plank.b], angle = Math.atan2(b.y - a.y, b.x - a.x);
      const shaking = plank.kind === 'crumble' && plank.touched > 0 && !plank.fallen && !reduced ? Math.sin(run.elapsed * 70 + i) * .045 * Math.min(1, (run.elapsed - plank.touched) / plank.delay) : 0;
      view.root.position.set((a.x + b.x) / 2 + Math.sin(angle) * view.thickness / 2 + shaking, (a.y + b.y) / 2 - Math.cos(angle) * view.thickness / 2, 0);
      view.root.rotation.z = angle + shaking * .6; view.root.visible = !(plank.fallen && a.y < WATER_Y - 2.5);
    }
    for (let i = 0; i < this.crates.length; i++) {
      const c = course.crates[i].corners, a = p[c[0]], b = p[c[1]], x = (a.x + b.x + p[c[2]].x + p[c[3]].x) / 4, y = (a.y + b.y + p[c[2]].y + p[c[3]].y) / 4;
      this.crates[i].position.set(x, y, 0); this.crates[i].rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    }
    for (let i = 0; i < this.coins.length; i++) { this.coins[i].visible = !run.coins[i]?.taken; if (!reduced) this.coins[i].rotation.y += dt * 2.4; }
    for (const flag of this.flags) flag.cloth.color.set(run.safeX >= flag.at ? '#ffcf2e' : '#1e8bff');
    const pulse = reduced ? 1 : 1 + Math.sin(this.time * 1.7) * .012; for (const f of this.foam) f.scale.set(pulse, 1, pulse);
    this.updateSplash(reduced);
    // Side-on chase camera, a touch above and in front, leading the truck in its direction of travel.
    const aspect = this.width / Math.max(1, this.height), distance = aspect < .8 ? 27 : 22, lead = Math.max(-2, Math.min(5, run.velocity * .35));
    const target = new T.Vector3(run.x + 2.5 + lead, Math.max(WATER_Y + 2.6, run.y * .75 + .7), 0), desired = target.clone().add(new T.Vector3(-3.6, 5.8, distance));
    if (!this.camReady || Math.abs(run.x - this.lastX) > 6) { this.cam.copy(desired); this.look.copy(target); this.camReady = true; }
    else { const k = 1 - Math.exp(-dt * 3.2); this.cam.lerp(desired, k); this.look.lerp(target, k); }
    this.lastX = run.x; this.camera.position.copy(this.cam); this.camera.lookAt(this.look);
    this.origin.set(run.x, run.y + 1, 0); this.followLight(run.x + 4, 0);
  }
  private updateSplash(reduced: boolean) {
    const splash = this.run.splash, age = splash ? this.run.elapsed - splash.at : 99;
    this.ring.visible = age < 1.3 && !reduced; this.drops.count = age < 1.1 && !reduced ? 28 : 0;
    if (!splash || age >= 1.3 || reduced) return;
    this.ring.position.set(splash.x, WATER_Y + .05, 0); this.ring.scale.setScalar(.6 + age * 3.2); (this.ring.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 1.3);
    for (let i = 0; i < 28; i++) {
      const a = i * 2.39, speed = 1.6 + (i % 5) * .7, rise = 6 + (i % 4) * 1.6;
      this.scratch.position.set(splash.x + Math.cos(a) * speed * age, WATER_Y + Math.max(-.5, rise * age - 9 * age * age), Math.sin(a) * speed * age);
      this.scratch.scale.setScalar(Math.max(.1, 1 - age)); this.scratch.rotation.set(age * 5 + i, i, 0); this.scratch.updateMatrix(); this.drops.setMatrixAt(i, this.scratch.matrix);
    }
    this.drops.instanceMatrix.needsUpdate = true;
  }
  /** Palette mod: recolors the procedural body and the Unity model's marked paint panels. */
  private paintTruck() {
    const color = TRUCK_PAINT[this.run.config.palette] ?? this.paint.color.getStyle();
    if (!this.paintSlots && this.chassis.userData.unityLoaded) {
      this.paintSlots = []; this.tint = '';
      this.chassis.traverse(o => {
        if (!(o instanceof T.Mesh) || !o.geometry.attributes.color) return;
        const attribute = o.geometry.attributes.color as T.BufferAttribute, indices: number[] = [];
        for (let i = 0; i < attribute.count; i++) if (Math.abs(attribute.getX(i) - PAINT_KEY.r) + Math.abs(attribute.getY(i) - PAINT_KEY.g) + Math.abs(attribute.getZ(i) - PAINT_KEY.b) < .03) indices.push(i);
        if (indices.length) this.paintSlots!.push({ attribute, indices });
      });
    }
    if (color === this.tint) return;
    this.tint = color; this.body.color.set(color); const c = new T.Color(color);
    for (const slot of this.paintSlots ?? []) { for (const i of slot.indices) slot.attribute.setXYZ(i, c.r, c.g, c.b); slot.attribute.needsUpdate = true; }
  }
}
