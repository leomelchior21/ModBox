import * as T from 'three';
import { World, material, mesh, label, floorTexture, batchScenery } from './world';
import { tree } from './models';
import { SlingersRun, SLING, FLOOR } from '../makita-slingers/run';
import { PinballRun, PIN_RAILS } from '../pinballerz/run';
import { StackRun, type StackSlab } from '../speed-stack/run';
import { NajaRun, NAJA_SIZE } from '../naja-run/run';
import { unityModel } from './unity-assets';

/** The original deterministic engines now drive real, shadow-casting 3D scenes. */
export class SlingersView extends World<SlingersRun> {
  private stage = new T.Group(); private actors = new T.Group(); private bodies = new Map<number, T.Group>(); private saw = new T.Group(); private guide = new T.Line();
  private ray = new T.Raycaster(); private plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  constructor(canvas: HTMLCanvasElement, run: SlingersRun) {
    super(canvas, run, '#e4b883', 15); this.camera = new T.OrthographicCamera(-12, 12, 7.5, -7.5, .1, 180); this.scene.add(this.stage, this.actors, this.saw); const s = this.shapes;
    const earth = material('#b57454'), grass = material('#839450'); s.cube(this.stage, earth, 10, -1.4, 0, 42, 2.6, 12); s.cube(this.stage, grass, 10, -.03, 0, 42, .25, 12);
    const wood = material('#a66b3e'); wood.map = floorTexture('wood');
    for (const x of [2.75, 3.65]) { const arm = s.cube(this.stage, wood, x, 1.8, 0, .3, 3.5, .35); arm.rotation.z = x < 3 ? -.15 : .15; s.tube(this.stage, material('#d8a35a'), x, 3.5, 0, .2, .3); }
    s.cube(this.stage, wood, 3.2, .32, 0, 1.8, .5, .8);
    for (let i = 0; i < 15; i++) { const x = -7 + i * 3; s.cube(this.stage, material('#725d56'), x, .7, -5, .18, 1.8, .2); s.cube(this.stage, material('#a38968'), x, 1, -5, 3, .2, .18); if (i % 3 === 0) tree(s, this.stage, x, -8, 1.3); }
    for (let i = 0; i < 8; i++) { const hut = new T.Group(); hut.position.set(i * 5 - 8, 0, -16 - i % 2 * 5); this.stage.add(hut); s.cube(hut, material(i % 2 ? '#819990' : '#a99b82'), 0, 2, 0, 4, 4, 3); const roof = mesh(new T.ConeGeometry(3.2, 1.6, 4), material('#6f7369'), hut, 0, 4.7); roof.rotation.y = Math.PI / 4; }
    const chrome = material('#dce7ec', .24, .8); s.tube(this.saw, chrome, 0, 0, 0, .42, .12).rotation.x = Math.PI / 2;
    for (let i = 0; i < 16; i++) { const tooth = s.cube(this.saw, chrome, Math.sin(i * Math.PI / 8) * .44, Math.cos(i * Math.PI / 8) * .44, 0, .15, .19, .15); tooth.rotation.z = -i * Math.PI / 8; } s.ball(this.saw, this.paint, 0, 0, .09, .14);
    this.guide = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({ color: '#fff5bd', dashSize: .2, gapSize: .18, transparent: true, opacity: .8 })); this.scene.add(this.guide); batchScenery(this.stage);
  }
  resize(w: number, h: number, d: number) { super.resize(w, h, d); const c = this.camera as T.OrthographicCamera, size = Math.max(12, 20.5 / (w / h)); c.left = -size * w / h / 2; c.right = -c.left; c.top = size / 2; c.bottom = -size / 2; c.updateProjectionMatrix(); }
  protected rebuild() { for (const b of this.bodies.values()) { this.actors.remove(b); this.disposeStage(b); } this.bodies.clear(); }
  protected update(_dt: number, reduced: boolean) {
    const run = this.run, s = this.shapes;
    for (const b of run.bodies) {
      let root = this.bodies.get(b.id);
      if (!root) {
        root = new T.Group(); this.actors.add(root); this.bodies.set(b.id, root);
        if (b.kind === 'robot' || b.kind === 'helmet') {
          const metal = material(b.kind === 'helmet' ? '#ddb15b' : '#7e9d9a', .45, .4); s.cube(root, metal, 0, 0, 0, b.w / 50, b.h / 50, .8); s.cube(root, material('#182d3c'), 0, .14, .43, b.w / 60, .22, .06); for (const x of [-.2, .2]) s.ball(root, material('#ff954f'), x, .15, .48, .07); for (const side of [-1, 1]) { s.cube(root, metal, side * .53, -.1, 0, .2, .5, .25); s.cube(root, material('#3d4757'), side * .22, -.56, 0, .2, .22, .4); } unityModel(root, 'robot', .8, -.6); this.remix.character(root, 'machine');
        } else { const m = material(b.kind === 'steel' ? '#6d7c89' : b.kind === 'crate' ? '#dc7853' : '#c39b68', .6, b.kind === 'steel' ? .5 : 0); if (b.kind === 'wood') m.map = floorTexture('wood'); s.cube(root, m, 0, 0, 0, b.w / 50, b.h / 50, .75); if (b.kind === 'crate') { const cross = s.cube(root, material('#ffe4a5'), 0, 0, .4, .12, b.h / 40, .05); cross.rotation.z = .65; } }
      }
      root.position.set(b.x / 50, (FLOOR - b.y) / 50, 0); root.rotation.z = -b.angle; root.scale.setScalar(b.flash > 0 && !reduced ? 1.035 : 1);
    }
    for (const [id, root] of this.bodies) if (!run.bodies.some(b => b.id === id)) { this.actors.remove(root); this.disposeStage(root); this.bodies.delete(id); }
    const p = run.blade ?? { x: SLING.x + (run.dragging ? run.aim.x : 0), y: SLING.y + (run.dragging ? run.aim.y : 0) }; this.saw.position.set(p.x / 50, (FLOOR - p.y) / 50, 0); this.saw.rotation.z = reduced ? 0 : -run.elapsed * 18;
    const points: T.Vector3[] = [], v = run.velocity(); if (!run.blade && run.config.assist) for (let i = 0; i < 30; i++) { const t = i * .045; points.push(new T.Vector3((SLING.x + v.x * t) / 50, (FLOOR - SLING.y - v.y * t - .5 * run.config.gravity * t * t) / 50, .1)); } this.guide.geometry.dispose(); this.guide.geometry = new T.BufferGeometry().setFromPoints(points); this.guide.computeLineDistances();
    this.camera.position.set(10, 7, 25); this.camera.lookAt(10, 3.2, 0); this.origin.copy(this.saw.position); this.followLight(10, 0);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number) { this.ray.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), this.camera); const p = new T.Vector3(); if (this.ray.ray.intersectPlane(this.plane, p)) this.run.pointer(phase, p.x * 50, FLOOR - p.y * 50); }
}

export class PinballView extends World<PinballRun> {
  private table = new T.Group(); private ball: T.Mesh; private bumpers: T.Group[] = []; private flippers: T.Group[] = []; private targets: T.Mesh[] = []; private rings: T.Mesh[] = [];
  private styleProps = new T.Group(); private style = '';
  constructor(canvas: HTMLCanvasElement, run: PinballRun) {
    super(canvas, run, '#17172e', 16); this.scene.add(this.table); this.table.add(this.styleProps); const s = this.shapes;
    this.scene.fog = new T.Fog('#17172e', 26, 70); const black = material('#24213c'), chrome = material('#b6cce3', .18, .85), board = material('#211f44', .34, .2);
    s.cube(this.table, black, 0, -.5, 0, 8.2, 1, 12.3); s.cube(this.table, board, 0, .01, 0, 7.7, .15, 11.8);
    for (const x of [-3.95, 3.95]) { s.cube(this.table, chrome, x, .3, 0, .15, .65, 12); s.cube(this.table, this.paint, x, .66, 0, .08, .08, 12); }
    for (const z of [-5.9, 5.9]) s.cube(this.table, chrome, 0, .3, z, 8, .65, .15);
    for (const [ax, ay, bx, by] of PIN_RAILS) { const x = ((ax + bx) / 2 - 320) / 80, z = ((ay + by) / 2 - 460) / 80, length = Math.hypot(bx - ax, by - ay) / 80, rail = s.cube(this.table, chrome, x, .24, z, .16, .35, length); rail.rotation.y = Math.atan2(bx - ax, by - ay); }
    for (const [x, y] of [[220, 270], [390, 270], [305, 410]]) {
      const root = new T.Group(); root.position.set((x - 320) / 80, .1, (y - 460) / 80); this.table.add(root); this.bumpers.push(root);
      s.tube(root, chrome, 0, .2, 0, .53, .4); s.tube(root, this.paint, 0, .48, 0, .46, .15); const ring = mesh(new T.TorusGeometry(.5, .055, 8, 32), new T.MeshBasicMaterial({ color: '#7df6ff' }), root, 0, .58); ring.rotation.x = Math.PI / 2; this.rings.push(ring);
      const cap = s.tube(root, material('#f6e9b9', .3, .4), 0, .6, 0, .23, .08); cap.rotation.y = .4;
    }
    for (const [x, y] of [[145, 180], [305, 125], [465, 180]]) { const star = mesh(new T.OctahedronGeometry(.28), material('#ffd75e', .2, .5), this.table, (x - 320) / 80, .4, (y - 460) / 80); this.targets.push(star); }
    for (const x of [160, 460]) { const root = new T.Group(); root.position.set((x - 320) / 80, .25, (773 - 460) / 80); this.table.add(root); s.cube(root, chrome, .8, 0, 0, 1.6, .25, .27); s.cube(root, this.paint, .8, .15, 0, 1.4, .07, .2); s.tube(root, chrome, 0, 0, 0, .2, .3); this.flippers.push(root); }
    const title = label('PINBALLERZ', '#aef9ff', '#17172e'); title.sprite.scale.set(4.3, 1.35, 1); title.sprite.position.set(0, .35, .7); this.table.add(title.sprite);
    for (const z of [-3.5, -.4, 2.7]) for (const x of [-2.7, 2.7]) { const glow = mesh(new T.RingGeometry(.23, .28, 24), new T.MeshBasicMaterial({ color: '#f49aff', side: T.DoubleSide }), this.table, x, .11, z); glow.rotation.x = -Math.PI / 2; }
    this.ball = s.ball(this.table, material('#e2f4ff', .08, .95), 0, .3, 0, .165);
    const floor = material('#211e35'); s.cube(this.scene, floor, 0, -3.2, 0, 80, .2, 80, false);
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) { const cabinet = new T.Group(); cabinet.position.set(side * 10, -3, -12 + i * 6); cabinet.rotation.y = -side * .4; this.scene.add(cabinet); s.cube(cabinet, black, 0, 2.1, 0, 3, 4.5, 2.8); s.cube(cabinet, material(i % 2 ? '#b16bf2' : '#54cbd4', .3, .1), 0, 3, 1.43, 2.4, 1.7, .06); s.cube(cabinet, chrome, 0, 1.9, 1.7, 3, .2, 1); }
    batchScenery(this.table); this.table.userData.character = true;
  }
  protected rebuild() {}
  protected update(_dt: number, reduced: boolean) {
    const r = this.run; this.ball.position.set((r.ball.x - 320) / 80, .31, (r.ball.y - 460) / 80); this.ball.rotation.x = r.ball.y / 20; this.origin.copy(this.ball.position);
    this.bumpers.forEach((b, i) => { b.scale.y = r.bumpers[i]?.flash > 0 && !reduced ? .75 : 1; this.rings[i].scale.setScalar(r.bumpers[i]?.flash > 0 ? 1.2 : 1); });
    this.flippers.forEach((f, i) => { f.rotation.y = -(r.flippers[i]?.angle ?? 0); }); this.targets.forEach((t, i) => { (t.material as T.MeshStandardMaterial).emissive.set(r.targets[i] ? '#ffca39' : '#000000'); t.rotation.y = reduced ? 0 : r.elapsed; });
    const style = r.config.characterStyle ?? 'original'; (this.ball.material as T.MeshStandardMaterial).color.set(style === 'robot' ? '#65efff' : style === 'armored' ? '#ffbd62' : '#e2f4ff');
    if (this.style !== style) {
      this.style = style; this.disposeStage(this.styleProps); this.styleProps.clear(); const s = this.shapes;
      this.bumpers.forEach((bumper, i) => {
        if (style === 'original') return;
        const root = new T.Group(); root.position.copy(bumper.position); this.styleProps.add(root);
        if (style === 'astronaut') { const planet = s.ball(root, material(['#e8a168', '#8ac9e9', '#c79ce2'][i], .45), 0, .85, 0, .38); planet.rotation.z = .3; const orbit = mesh(new T.TorusGeometry(.62, .045, 6, 32), material('#ecd7a8', .3, .5), root, 0, .85); orbit.rotation.x = 1.1; orbit.rotation.y = .3; }
        else if (style === 'robot') { for (let j = 0; j < 12; j++) { const tooth = s.cube(root, material('#63e4ed', .25, .65), Math.cos(j * Math.PI / 6) * .52, .7, Math.sin(j * Math.PI / 6) * .52, .16, .22, .19); tooth.rotation.y = -j * Math.PI / 6; } s.tube(root, material('#36465e', .3, .6), 0, .76, 0, .32, .3); }
        else { s.tube(root, material('#aaa9bb'), 0, .8, 0, .4, .7); for (let j = 0; j < 6; j++) s.cube(root, material('#d8c9a6'), Math.cos(j * Math.PI / 3) * .32, 1.2, Math.sin(j * Math.PI / 3) * .32, .19, .25, .19); }
      });
    }
    this.camera.position.set(0, 13.9, 10.8); this.camera.lookAt(0, 0, -.5); this.followLight(0, 0);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, id: number) { this.run.pointer(phase, x * 640, y * 920, id); }
}

export class StackView extends World<StackRun> {
  private tower = new T.Group(); private moving = new T.Group(); private fragments = new T.Group(); private count = -1; private style = ''; private slabMaterials: T.MeshStandardMaterial[];
  constructor(canvas: HTMLCanvasElement, run: StackRun) {
    super(canvas, run, '#d2bcdc', 16); this.camera = new T.OrthographicCamera(-10, 10, 8, -8, .1, 180); this.scene.add(this.tower, this.moving, this.fragments);
    this.slabMaterials = ['#5ed4c2', '#69b8e2', '#ad91de', '#f4a5bd'].map(c => material(c, .4, .08)); const s = this.shapes;
    s.cube(this.scene, material('#8d8baa'), 0, -1, 0, 6.6, 1.7, 6.6); s.cube(this.scene, material('#eee4d9'), 0, -.15, 0, 6.9, .22, 6.9);
    for (let i = 0; i < 28; i++) { const a = i * 2.4, radius = 15 + i % 5 * 5, h = 2 + i % 7 * 1.2; const building = s.cube(this.scene, material(i % 2 ? '#b8b5cc' : '#9daec7'), Math.cos(a) * radius, -4 + h / 2, Math.sin(a) * radius, 2.5 + i % 2, h, 2.5, false); if (i % 3 === 0) s.cube(this.scene, material('#edd8be'), building.position.x, h - 3.8, building.position.z, 2.8, .18, 2.8, false); }
    s.cube(this.scene, material('#c0becf'), 0, -4.3, 0, 150, .2, 150, false);
  }
  private slab(root: T.Group, slab: StackSlab, style: string) {
    const s = this.shapes, w = slab.w / 50, d = slab.d / 50, m = style === 'robot' ? material('#36425b', .27, .6) : style === 'armored' ? material('#b0a1b1') : this.slabMaterials[slab.color % 4];
    s.cube(root, m, w / 2, 0, d / 2, w, .5, d);
    if (style !== 'original') { const accent = material(style === 'robot' ? '#63eff6' : style === 'astronaut' ? '#eafaff' : '#e9c581', .25, .2); if (style === 'robot') { accent.emissive.set('#35c6e1'); accent.emissiveIntensity = .5; } for (const z of [.02, d - .02]) s.cube(root, accent, w / 2, .13, z, w * .94, .07, .04); if (style === 'astronaut') for (let x = .3; x < w - .2; x += .6) s.cube(root, material('#283c5c'), x, 0, d + .025, .25, .18, .05); if (style === 'armored') for (const x of [.15, w - .15]) s.cube(root, accent, x, .4, d / 2, .25, .4, d); }
  }
  protected rebuild() { this.count = -1; }
  protected update(_dt: number, _reduced: boolean) {
    const r = this.run, style = r.config.characterStyle ?? 'original';
    if (this.count !== r.slabs.length || this.style !== style) { this.disposeStage(this.tower); this.tower.clear(); for (const slab of r.slabs) { const root = new T.Group(); root.position.set(slab.x / 50, slab.layer * .52, slab.z / 50); this.slab(root, slab, style); this.tower.add(root); } this.count = r.slabs.length; this.style = style; }
    if (this.moving.userData.key !== `${r.moving.w}|${r.moving.d}|${style}|${r.moving.color}`) { this.disposeStage(this.moving); this.moving.clear(); this.slab(this.moving, r.moving, style); this.moving.userData.key = `${r.moving.w}|${r.moving.d}|${style}|${r.moving.color}`; } this.moving.position.set(r.moving.x / 50, r.moving.layer * .52, r.moving.z / 50); this.moving.visible = r.phase !== 'cleared';
    while (this.fragments.children.length > r.falling.length) { const child = this.fragments.children[this.fragments.children.length - 1]; this.disposeStage(child as T.Group); this.fragments.remove(child); }
    r.falling.forEach((f, i) => { let root = this.fragments.children[i] as T.Group | undefined; if (!root) { root = new T.Group(); this.slab(root, f.slab, style); this.fragments.add(root); } root.position.set(f.slab.x / 50, f.slab.layer * .52 - f.fall / 50, f.slab.z / 50); root.rotation.z = f.age * .5; root.rotation.x = f.age * .4; });
    const y = Math.max(0, r.placed - 5) * .52; this.camera.position.set(13, 13 + y, 17); this.camera.lookAt(0, y + 2, 0); this.origin.set(0, r.placed * .52, 0); this.followLight(0, 0);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number) { this.run.pointer(phase, x, y); }
}

export class NajaView extends World<NajaRun> {
  private garden = new T.Group(); private snake = new T.Group(); private head = new T.Group(); private segments: T.Mesh[] = []; private stones = new Map<string, T.Group>(); private fruit = new T.Group(); private portals: T.Mesh[] = []; private segmentStyle = '';
  constructor(canvas: HTMLCanvasElement, run: NajaRun) {
    super(canvas, run, '#b6d7c4', 16.5); this.camera = new T.OrthographicCamera(-10, 10, 8.25, -8.25, .1, 180); this.scene.add(this.garden, this.snake, this.fruit); const s = this.shapes, stone = material('#c7b98c');
    s.cube(this.garden, material('#7d9380'), 0, -.6, 0, 12.8, 1, 12.8); const tiles = [material('#c5cead'), material('#d7d6b6')];
    for (let x = 0; x < NAJA_SIZE; x++) for (let z = 0; z < NAJA_SIZE; z++) s.cube(this.garden, tiles[(x + z) % 2], (x - 8.5) * .65, -.03, (z - 8.5) * .65, .63, .15, .63, false);
    for (const side of [-1, 1]) { s.cube(this.garden, stone, side * 6.15, .22, 0, .3, .5, 12.6); s.cube(this.garden, stone, 0, .22, side * 6.15, 12.6, .5, .3); for (const z of [-5.9, 5.9]) { s.cube(this.garden, stone, side * 6.1, 1.2, z, .65, 2.5, .65); s.cube(this.garden, material('#dec588'), side * 6.1, 2.5, z, .95, .25, .95); } }
    for (let i = 0; i < 12; i++) tree(s, this.garden, Math.sin(i * 2.4) * 10, Math.cos(i * 2.4) * 10, .8 + i % 3 * .15, true);
    s.ball(this.head, this.paint, 0, .46, 0, .34); const hood = s.ball(this.head, this.paint, 0, .47, .17, .4); hood.scale.set(1.2, 1.25, .4); const belly = s.ball(this.head, material('#f8dfa2'), 0, .34, -.12, .27); belly.scale.z = .6;
    for (const side of [-1, 1]) { s.ball(this.head, material('#ffe89a', .25, .3), side * .19, .64, -.17, .085); s.ball(this.head, material('#172c38'), side * .19, .65, -.23, .04); const fang = mesh(new T.ConeGeometry(.03, .13, 6), material('#fff5d7'), this.head, side * .1, .25, -.3); fang.rotation.z = Math.PI; }
    this.snake.add(this.head); unityModel(this.head, 'cobra'); this.remix.character(this.head, 'snake');
    s.ball(this.fruit, material('#ffad53', .36), 0, .35, 0, .24); const leaf = s.ball(this.fruit, material('#3b9674'), .12, .59, 0, .11); leaf.scale.set(.4, .4, 1.3);
    const glow = mesh(new T.TorusGeometry(.35, .035, 6, 24), material('#ffe58b', .25, .3), this.fruit, 0, .07); glow.rotation.x = Math.PI / 2;
    for (const [x, z] of [[-5.9, 0], [5.9, 0], [0, -5.9], [0, 5.9]]) { const portal = mesh(new T.TorusGeometry(.65, .085, 8, 32), new T.MeshBasicMaterial({ color: '#62eaf4' }), this.garden, x, .7, z); if (x) portal.rotation.y = Math.PI / 2; this.portals.push(portal); }
    batchScenery(this.garden);
  }
  protected rebuild() {}
  protected update(_dt: number, reduced: boolean) {
    const r = this.run, mix = Math.min(1, r.timer / r.interval), s = this.shapes;
    while (this.segments.length < r.body.length) { const segment = s.ball(this.snake, this.paint, 0, .25, 0, .28); segment.scale.y = .8; this.segments.push(segment); }
    const style = r.config.characterStyle ?? 'original';
    if (this.segmentStyle !== style || this.snake.userData.length !== this.segments.length) { this.segmentStyle = style; this.snake.userData.length = this.segments.length; for (const segment of this.segments) { segment.geometry = style === 'robot' || style === 'armored' ? s.box : s.sphere; segment.material = this.paint; segment.userData.robot = style !== 'original'; } }
    this.segments.forEach((segment, i) => { const p = r.body[i], prev = r.previousBody[i] ?? p; segment.visible = !!p && i > 0; if (!p) return; const interpolate = prev && Math.abs(prev.x - p.x) + Math.abs(prev.y - p.y) < 3; segment.position.set(((interpolate ? prev.x + (p.x - prev.x) * mix : p.x) - 8.5) * .65, .24 + (reduced ? 0 : Math.sin(i * .8 + r.elapsed * 8) * .025), ((interpolate ? prev.y + (p.y - prev.y) * mix : p.y) - 8.5) * .65); const size = Math.max(.45, 1 - i / (r.body.length * 1.5)); segment.scale.setScalar(size * (style === 'robot' || style === 'armored' ? .5 : .28)); segment.scale.y *= .8; });
    if (this.segments[0]) this.head.position.copy(this.segments[0].position).y = 0; this.head.rotation.y = ({ up: 0, right: -Math.PI / 2, down: Math.PI, left: Math.PI / 2 })[r.direction];
    this.fruit.position.set((r.food.x - 8.5) * .65, reduced ? 0 : Math.sin(r.elapsed * 3) * .06, (r.food.y - 8.5) * .65); this.fruit.rotation.y = reduced ? 0 : r.elapsed;
    for (const p of r.obstacles) { const key = `${p.x}:${p.y}`; if (!this.stones.has(key)) { const root = new T.Group(); root.position.set((p.x - 8.5) * .65, 0, (p.y - 8.5) * .65); this.garden.add(root); const rock = mesh(new T.DodecahedronGeometry(.37, 0), material('#849286'), root, 0, .26); rock.scale.y = .8; s.cube(root, material('#adc48a'), 0, .42, 0, .4, .08, .35); this.stones.set(key, root); } }
    for (const [key, root] of this.stones) root.visible = r.obstacles.some(p => `${p.x}:${p.y}` === key); this.portals.forEach(p => { p.visible = r.config.assist; });
    this.camera.position.set(0, 15.5, 9.5); this.camera.lookAt(0, 0, 0); this.origin.copy(this.head.position); this.followLight(0, 0);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number) { this.run.pointer(phase, x * 720, y * 720); }
}
