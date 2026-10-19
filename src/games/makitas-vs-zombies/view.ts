import * as T from 'three';
import { createModSchema } from '../../interpreter/core/schema';
import { ArcadeRun, type ArcadeAction, type ArcadeCue } from '../premium-kit/core';
import { World, material, mesh, batchScenery } from '../three-kit/world';
import { tree } from '../three-kit/models';
import { unityModel } from '../three-kit/unity-assets';
import { YardRun, COLS, ROWS, type Defender, type Zombie, type YardCue } from './run';

class Presentation extends ArcadeRun {
  constructor(readonly yard: YardRun) { super('makitas-vs-zombies', { palette: 'teal', playerName: '', power: 0, speed: 0, gravity: 0, assist: false, overdrive: false, lives: 3, bonus: 0 }, createModSchema([])); }
  sync() { const y = this.yard; this.config = { ...this.config, palette: y.config.toolColor, worldTheme: y.config.worldTheme, characterStyle: y.config.characterStyle, weather: y.config.weather }; this.revision = y.revision; this.phase = y.phase === 'launch' ? 'ready' : y.phase; this.score = y.score; this.elapsed = y.elapsed; }
  protected setup() {} protected tick() {} action(_action: ArcadeAction) {} stats() { return []; }
}
export class YardView extends World<Presentation> {
  private terrain = new T.Group(); private defenders = new Map<number, T.Group>(); private zombies = new Map<number, T.Group>(); private blades = new Map<number, T.Group>(); private themeKey = '';
  private hover: T.Mesh; private style = ''; private floor = new T.Plane(new T.Vector3(0, 1, 0), 0); private ray = new T.Raycaster();
  constructor(canvas: HTMLCanvasElement, readonly yard: YardRun) {
    super(canvas, new Presentation(yard), '#b2cad6', 13.5); this.camera = new T.OrthographicCamera(-10, 10, 6.75, -6.75, .1, 150); this.scene.add(this.terrain);
    this.hover = mesh(new T.PlaneGeometry(1.3, 1.3), new T.MeshBasicMaterial({ color: '#b3ffe9', transparent: true, opacity: .35, side: T.DoubleSide, depthWrite: false }), this.scene); this.hover.rotation.x = -Math.PI / 2; this.hover.visible = false;
  }
  protected rebuild() { for (const [map] of [[this.defenders], [this.zombies], [this.blades]]) { for (const root of map.values()) { root.removeFromParent(); this.disposeStage(root); } map.clear(); } }
  private buildYard() {
    this.disposeStage(this.terrain); this.terrain.clear(); const s = this.shapes, y = this.yard, concrete = y.config.ground === 'concrete';
    const colors = concrete ? ['#a8b6bd', '#bcc6c8'] : ['#89b977', '#9dc985'];
    s.cube(this.terrain, material('#b58b66'), 0, -.55, 0, 17.8, 1, 10.6); s.cube(this.terrain, material('#dbbf8e'), 0, -.06, 0, 18, .2, 10.8);
    if (y.config.ground !== 'none') for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) s.cube(this.terrain, material(colors[(row + col) % 2]), (col - 4) * 1.4, .035, (row - 2) * 1.4, 1.36, .12, 1.36, false);
    const wall = material('#e5c191'), roof = material('#537b79'), wood = material('#987a57');
    s.cube(this.terrain, wall, -8, 1.8, 0, 1.8, 3.6, 8); s.cube(this.terrain, roof, -8, 3.7, 0, 2.5, .4, 8.7);
    for (const z of [-2.5, 0, 2.5]) { s.cube(this.terrain, material('#456777'), -7.07, 1.6, z, .04, 1.6, 1.65); s.cube(this.terrain, material('#ffe6a4'), -7.02, 2.9, z, .15, .15, .4); }
    if (y.config.decorations) { for (let i = 0; i < 14; i++) { const x = -8 + i * 1.2; s.cube(this.terrain, wood, x, .7, -4.9, .13, 1.5, .15); s.cube(this.terrain, wood, x, .9, -4.9, 1.2, .14, .13); } for (let i = 0; i < 8; i++) { tree(s, this.terrain, i * 3 - 10, -8 - i % 2 * 2, 1); } for (const x of [-5, -2, 2, 5]) { s.cube(this.terrain, material('#b08455'), x, .4, 4.7, .8, .8, .8); s.cube(this.terrain, material('#f2d69e'), x, .75, 4.7, .9, .1, .85); } }
    s.cube(this.terrain, material('#699f8a'), 0, -1.2, 0, 100, .2, 100, false); batchScenery(this.terrain);
    this.sun.intensity = y.config.background === 'night' ? 1.1 : 2.7;
  }
  private defender(unit: Defender) {
    const root = new T.Group(), s = this.shapes, dark = material('#334956', .55, .3), chrome = material('#d1dde0', .25, .7); this.scene.add(root);
    if (unit.kind === 'wall') { s.cube(root, material('#ae855a'), 0, .55, 0, 1.1, 1.1, .6); for (const x of [-.4, .4]) s.cube(root, chrome, x, .55, .32, .12, 1.2, .08); }
    else if (unit.kind === 'charger') { s.cube(root, dark, 0, .2, 0, 1, .35, .85); s.cube(root, this.paint, 0, .6, 0, .75, .65, .62); for (const x of [-.2, 0, .2]) s.cube(root, material('#ebed9e'), x, .68, .33, .1, .3, .04); s.cube(root, dark, 0, 1.02, 0, .4, .2, .3); }
    else { s.tube(root, dark, 0, .13, 0, .48, .25); s.cube(root, this.paint, 0, .57, 0, .75, .65, .65); const blade = mesh(new T.CylinderGeometry(.43, .43, .1, 24), unit.kind === 'frost' ? material('#bcefff', .3, .5) : chrome, root, .48, .8); blade.rotation.z = Math.PI / 2; blade.userData.spin = true; for (let i = 0; i < 12; i++) { const tooth = s.cube(root, chrome, .48, .8 + Math.sin(i * Math.PI / 6) * .43, Math.cos(i * Math.PI / 6) * .43, .13, .16, .15); tooth.rotation.x = i * Math.PI / 6; } s.cube(root, dark, 0, 1.01, 0, .5, .1, .2); }
    if (unit.kind === 'saw') unityModel(root, 'turret'); this.remix.character(root, 'machine'); return root;
  }
  private zombie(z: Zombie) {
    const root = new T.Group(), s = this.shapes, green = material(z.kind === 'brute' ? '#8f9f65' : '#91b783'), cloth = material(z.kind === 'sprinter' ? '#c57d6a' : '#8a9ba2'), boots = material('#3e4a50'); this.scene.add(root);
    s.cube(root, cloth, 0, .8, 0, .6, .65, .42); s.ball(root, green, 0, 1.38, 0, .29); for (const side of [-1, 1]) { const leg = s.cube(root, boots, side * .18, .25, 0, .22, .5, .26); leg.userData.leg = side; const arm = s.cube(root, green, -.35, .89, side * .27, .6, .18, .18); arm.rotation.z = -.2; s.ball(root, material('#f9e7ad'), -.25, 1.45, side * .13, .065); } if (z.kind === 'hardhat' || z.kind === 'brute') { s.tube(root, material('#edb748'), 0, 1.65, 0, .38, .15); s.ball(root, material('#edb748'), 0, 1.69, 0, .27); }
    if (z.kind === 'brute') root.scale.setScalar(1.35); return root;
  }
  protected update(_dt: number, reduced: boolean) {
    const y = this.yard, key = `${y.config.background}|${y.config.ground}|${y.config.decorations}`;
    if (key !== this.themeKey) { this.themeKey = key; this.buildYard(); }
    if (this.style !== y.config.characterStyle) { this.style = y.config.characterStyle; }
    for (const u of y.units) { let root = this.defenders.get(u.id); if (!root) { root = this.defender(u); this.defenders.set(u.id, root); } root.position.set((u.col - 4) * 1.4, .12, (u.row - 2) * 1.4); root.scale.setScalar(1 + (u.level - 1) * .12); root.rotation.z = u.flash > 0 && !reduced ? -.04 : 0; }
    for (const z of y.zombies) { let root = this.zombies.get(z.id); if (!root) { root = this.zombie(z); this.zombies.set(z.id, root); } root.position.set((z.x - 4.5) * 1.4, .12 + (reduced ? 0 : Math.abs(Math.sin(y.elapsed * 5 + z.id)) * .05), (z.row - 2) * 1.4); root.rotation.z = z.chewing && !reduced ? Math.sin(y.elapsed * 8) * .12 : 0; root.traverse(o => { if (o.userData.leg) o.rotation.z = reduced ? 0 : Math.sin(y.elapsed * 5 + o.userData.leg) * .25; }); }
    for (const b of y.blades) { let root = this.blades.get(b.id); if (!root) { root = new T.Group(); this.scene.add(root); const disc = mesh(new T.CylinderGeometry(.3, .3, .08, 20), material(b.frost ? '#a8edff' : '#e5e9d4', .25, .7), root); disc.rotation.z = Math.PI / 2; this.blades.set(b.id, root); } root.position.set((b.x - 4.5) * 1.4, .9, (b.row - 2) * 1.4); root.rotation.x = reduced ? 0 : y.elapsed * 20; }
    for (const [map, ids] of [[this.defenders, new Set(y.units.map(u => u.id))], [this.zombies, new Set(y.zombies.map(z => z.id))], [this.blades, new Set(y.blades.map(b => b.id))]] as const) for (const [id, root] of map) if (!ids.has(id)) { root.removeFromParent(); this.disposeStage(root); map.delete(id); }
    this.camera.position.set(3, 14, 12.5); this.camera.lookAt(.4, 0, -.3); this.followLight(0, 0);
  }
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[] = []) { this.run.sync(); super.render(dt, held, reduced, cues); }
  feedback(cues: YardCue[]): ArcadeCue[] { return cues.filter(c => !!c.text).slice(-4).map(c => ({ kind: c.kind === 'kill' ? 'score' : c.kind === 'breach' ? 'lose' : c.kind === 'clear' ? 'clear' : 'hit', x: c.x, y: c.row, text: c.text })); }
  point(x: number, row: number) { const p = new T.Vector3((x - 4.5) * 1.4, .13, (row - 2.5) * 1.4).project(this.camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; }
  cell(row: number, col: number) { const corners = [[col, row], [col + 1, row], [col + 1, row + 1], [col, row + 1]].map(([x, z]) => this.point(x, z)), left = Math.min(...corners.map(p => p.x)), top = Math.min(...corners.map(p => p.y)), w = Math.max(...corners.map(p => p.x)) - left, h = Math.max(...corners.map(p => p.y)) - top; return { left: `${left * 100}%`, top: `${top * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, clipPath: `polygon(${corners.map(p => `${(p.x - left) / w * 100}% ${(p.y - top) / h * 100}%`).join(',')})` }; }
  highlight(row: number, col: number) { this.hover.visible = row >= 0; this.hover.position.set((col - 4) * 1.4, .18, (row - 2) * 1.4); }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number): void { this.ray.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), this.camera); const p = new T.Vector3(); if (phase !== 'cancel' && this.ray.ray.intersectPlane(this.floor, p)) this.hover.position.set(p.x, .18, p.z); }
}
