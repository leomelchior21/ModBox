import * as T from 'three';
import { World, material, mesh, batchScenery } from './world';
import { tree } from './models';
import { NajaRun, NAJA_SIZE } from '../naja-run/run';
import { unityModel } from './unity-assets';

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
