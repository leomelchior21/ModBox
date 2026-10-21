import * as T from 'three';
import { World, material, mesh, batchScenery } from './world';
import { tree } from './models';
import { NajaRun, NAJA_SIZE } from '../naja-run/run';
import { unityModel } from './unity-assets';
import { WorldWeather } from './weather';
import { applyLook, weatherLight, recolor } from './looks';
import { najaGarden, NAJA_GARDENS } from '../naja-run/worlds';

export class NajaView extends World<NajaRun> {
  private weather: WorldWeather; private sky: T.Texture | null = null; private gardenKey = ''; private props = new T.Group(); private skins = new Map<string, T.MeshStandardMaterial>();
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
    batchScenery(this.garden); this.scene.add(this.props); this.remix.ownWorld(true); this.weather = new WorldWeather(this.scene, { w: 16, h: 8, d: 16 });
  }
  /** Dresses the garden: tiles, walls, canopy and props, from sand dunes to ice crystals, neon grid lines or lollipops. */
  private dress() {
    const g = najaGarden(this.run.config.worldTheme), base = NAJA_GARDENS.classic; this.gardenKey = this.run.config.worldTheme ?? 'classic';
    this.sky?.dispose(); this.sky = applyLook(this.scene, this.sun, g.look, this.weather);
    recolor(this.garden, [[base.tiles[0], g.tiles[0]], [base.tiles[1], g.tiles[1]], [base.stone, g.stone], [base.cap, g.cap], [base.leaves, g.leaves], ['#43866b', g.leaves], ['#517f4e', g.leaves], [base.trunk, g.trunk], ['#7d9380', g.stone]]);
    for (const stone of this.stones.values()) { stone.removeFromParent(); this.disposeStage(stone); } this.stones.clear();
    this.disposeStage(this.props); this.props.clear(); const s = this.shapes;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, x = Math.cos(a) * 8.6, z = Math.sin(a) * 8.6;
      if (g.props === 'dunes') { const d = s.ball(this.props, material('#e8c88a', .95), x, -.6, z, 1.6 + i % 3 * .4); d.scale.y = .35; }
      else if (g.props === 'crystals') { const c = mesh(new T.OctahedronGeometry(.5 + i % 3 * .2, 0), new T.MeshStandardMaterial({ color: '#bfe8ff', roughness: .05, metalness: .2, transparent: true, opacity: .8 }), this.props, x, .6, z); c.scale.y = 2; c.rotation.y = i; }
      else if (g.props === 'lollipops') { s.tube(this.props, material('#ffffff', .4), x, .8, z, .07, 1.6); const pop = mesh(new T.CylinderGeometry(.55, .55, .14, 20), material(['#ff4f7a', '#ffd23f', '#38c8ff', '#7dff9a'][i % 4], .35), this.props, x, 1.7, z); pop.rotation.x = Math.PI / 2; }
    }
    if (g.props === 'grid') for (let k = 0; k <= 18; k++) for (const along of [0, 1]) { const line = mesh(s.block, new T.MeshBasicMaterial({ color: k % 6 ? '#3a2a8a' : '#ff4fd8', toneMapped: false }), this.props, along ? (k - 9) * .65 : 0, .03, along ? 0 : (k - 9) * .65, false); line.scale.set(along ? .02 : 11.7, .01, along ? 11.7 : .02); }
  }
  /** Snake skins: gold, rainbow and dragon scales; the robot keeps its box segments. */
  private skin(style: string, i: number): T.Material {
    if (style === 'gold') return this.skinMaterial('gold', '#ffcf3a', .25, .8);
    if (style === 'dragon') return this.skinMaterial(`dragon${i % 2}`, i % 2 ? '#c8202f' : '#e8402f', .5, .1);
    if (style === 'rainbow') { const hue = (i * 25) % 360; return this.skinMaterial(`rainbow${hue}`, `hsl(${hue}, 85%, 58%)`, .45, 0); }
    return this.paint;
  }
  private skinMaterial(key: string, color: string, roughness: number, metalness: number) { let m = this.skins.get(key); if (!m) { m = material(new T.Color(color), roughness, metalness); this.skins.set(key, m); } return m; }
  protected rebuild() {}
  protected update(dt: number, reduced: boolean) {
    if ((this.run.config.worldTheme ?? 'classic') !== this.gardenKey) this.dress();
    this.weather.update(dt, this.run.config.weather ?? 'clear', new T.Vector3(0, 0, 0), 0, reduced); weatherLight(this.scene, this.sun, this.weather); this.scene.fog = null;
    const r = this.run, mix = Math.min(1, r.timer / r.interval), s = this.shapes;
    while (this.segments.length < r.body.length) { const segment = s.ball(this.snake, this.paint, 0, .25, 0, .28); segment.scale.y = .8; this.segments.push(segment); }
    const style = r.config.characterStyle ?? 'original';
    if (this.segmentStyle !== style || this.snake.userData.length !== this.segments.length) { this.segmentStyle = style; this.snake.userData.length = this.segments.length; this.segments.forEach((segment, i) => { segment.geometry = style === 'robot' ? s.box : s.sphere; segment.material = this.skin(style, i); segment.userData.robot = style !== 'original'; }); }
    this.segments.forEach((segment, i) => { const p = r.body[i], prev = r.previousBody[i] ?? p; segment.visible = !!p && i > 0; if (!p) return; const interpolate = prev && Math.abs(prev.x - p.x) + Math.abs(prev.y - p.y) < 3; segment.position.set(((interpolate ? prev.x + (p.x - prev.x) * mix : p.x) - 8.5) * .65, .24 + (reduced ? 0 : Math.sin(i * .8 + r.elapsed * 8) * .025), ((interpolate ? prev.y + (p.y - prev.y) * mix : p.y) - 8.5) * .65); const size = Math.max(.45, 1 - i / (r.body.length * 1.5)); segment.scale.setScalar(size * (style === 'robot' ? .5 : .28)); segment.scale.y *= .8; });
    if (this.segments[0]) this.head.position.copy(this.segments[0].position).y = 0; this.head.rotation.y = ({ up: 0, right: -Math.PI / 2, down: Math.PI, left: Math.PI / 2 })[r.direction];
    this.fruit.position.set((r.food.x - 8.5) * .65, reduced ? 0 : Math.sin(r.elapsed * 3) * .06, (r.food.y - 8.5) * .65); this.fruit.rotation.y = reduced ? 0 : r.elapsed;
    // Fog hides the fruit until Naja's head is close.
    const sight = r.weather.sight, head = r.body[0]; this.fruit.visible = !sight || !head || Math.abs(head.x - r.food.x) + Math.abs(head.y - r.food.y) <= sight;
    for (const p of r.obstacles) { const key = `${p.x}:${p.y}`; if (!this.stones.has(key)) { const root = new T.Group(); root.position.set((p.x - 8.5) * .65, 0, (p.y - 8.5) * .65); this.garden.add(root); const garden = najaGarden(r.config.worldTheme), rock = mesh(new T.DodecahedronGeometry(.37, 0), material(garden.stone), root, 0, .26); rock.scale.y = .8; s.cube(root, material(garden.leaves), 0, .42, 0, .4, .08, .35); this.stones.set(key, root); } }
    for (const [key, root] of this.stones) root.visible = r.obstacles.some(p => `${p.x}:${p.y}` === key); this.portals.forEach(p => { p.visible = r.config.assist; });
    this.camera.position.set(0, 15.5, 9.5); this.camera.lookAt(0, 0, 0); this.origin.copy(this.head.position); this.followLight(0, 0);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number) { this.run.pointer(phase, x * 720, y * 720); }
}
