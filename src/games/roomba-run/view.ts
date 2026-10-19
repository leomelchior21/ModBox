import * as T from 'three';
import { RoombaRun, ROOM, ROOM_FURNITURE, cellPoint } from './run';
import { World, material, mesh, label, floorTexture } from '../three-kit/world';

export class RoombaView extends World<RoombaRun> {
  private robot = new T.Group(); private brushes: T.Group[] = []; private dirt: T.InstancedMesh;
  private suction: T.Mesh; private charge: T.MeshStandardMaterial; private route: T.Line; private routeKey = '';
  private target: T.Mesh; private raycaster = new T.Raycaster(); private floorPlane = new T.Plane(new T.Vector3(0, 1, 0), 0); private drag: number | null = null;
  constructor(canvas: HTMLCanvasElement, run: RoombaRun) {
    super(canvas, run, '#c9d9d5'); this.scene.fog = new T.Fog('#c9d9d5', 25, 80); this.scene.add(this.robot);
    const s = this.shapes, wood = material('#f4d3ab', .7); wood.map = floorTexture('wood'); wood.map.repeat.set(6, 5);
    s.cube(this.scene, wood, 0, -.16, 0, 12.3, .3, 10.3, false);
    const wall = material('#e8e5d5'); s.cube(this.scene, wall, 0, 1.7, -5.15, 12.5, 3.7, .24, false);
    for (const x of [-6.15, 6.15]) { s.cube(this.scene, material('#d8e0d2'), x, 1.7, -2.2, .24, 3.7, 6.1, false); s.cube(this.scene, material('#f4d7b5'), x, .13, -2.2, .3, .25, 6.2, false); }
    s.cube(this.scene, material('#f6d8b7'), 0, .13, -5, 12, .25, .12, false);
    // A broad luminous window, with real sunlight and a soft pool on the floor.
    s.cube(this.scene, material('#8abac5', .2, .1), .3, 2.2, -4.99, 3.9, 2.3, .05, false);
    for (const x of [-1.7, .3, 2.3]) s.cube(this.scene, material('#f9f0d6'), x, 2.2, -4.9, .1, 2.45, .1, false);
    s.cube(this.scene, material('#fff4d8'), .3, 2.2, -4.9, 4.2, .08, .1, false);
    const rug = s.cube(this.scene, material('#719e93'), .1, .005, -.4, 4.9, .04, 3.5, false); rug.rotation.y = .07;
    for (const f of ROOM_FURNITURE) {
      if (f.type === 'sofa') {
        const fabric = material('#cb8c76'), cushions = material('#dea28a'), legs = material('#51423c');
        s.cube(this.scene, fabric, f.x, .61, f.z, f.w, .6, f.d); s.cube(this.scene, fabric, f.x, 1.15, f.z - .57, f.w, 1.1, .38);
        for (const x of [-1, 0, 1]) s.cube(this.scene, cushions, f.x + x * 1.12, .98, f.z + .05, 1.04, .2, 1.06);
        for (const side of [-1, 1]) { s.cube(this.scene, fabric, f.x + side * (f.w / 2 - .13), 1.03, f.z, .32, .72, f.d); s.cube(this.scene, legs, f.x + side * 1.5, .18, f.z + .45, .16, .35, .16); }
      } else if (f.type === 'cabinet') {
        s.cube(this.scene, material('#bb9676'), f.x, .8, f.z, f.w, 1.6, f.d);
        for (const z of [-.8, 0, .8]) s.cube(this.scene, material('#f4ddb4'), f.x - f.w / 2 - .03, .82, f.z + z, .04, 1.4, .76, false);
        s.cube(this.scene, material('#48667d'), f.x, 1.8, f.z, .55, .4, .6);
      } else if (f.type === 'plant') {
        s.tube(this.scene, material('#dfaa7c'), f.x, .29, f.z, .35, .6);
        for (let i = 0; i < 5; i++) { const leaf = s.ball(this.scene, material(i % 2 ? '#638f6b' : '#438268'), f.x + Math.sin(i * 1.25) * .25, .9 + i % 2 * .25, f.z + Math.cos(i * 1.25) * .25, .35); leaf.scale.y *= 1.7; }
      } else s.tube(this.scene, material('#5b554b'), f.x, .52, f.z, .08, 1.05);
    }
    const top = s.tube(this.scene, material('#e2b990'), 1.7, 1.12, -.3, .96, .13); top.scale.z *= .82;
    s.cube(this.scene, material('#f2cea3'), -2.5, 1.15, 1.4, 2.4, .15, 1.45);
    s.tube(this.scene, material('#f3e9d0'), 1.8, 1.29, -.3, .14, .22); s.cube(this.scene, material('#8e6e69'), -2.5, 1.29, 1.6, .5, .1, .38);
    for (const [x, z, color] of [[-3.8, -.2, '#ebbb6d'], [3.4, 2.4, '#93c5c7'], [-.9, 2.7, '#d9a3a2']] as const) s.ball(this.scene, material(color), x, .14, z, .14);
    this.charge = material('#74d7bc', .3, .25); this.charge.emissive.set('#215944');
    s.cube(this.scene, material('#36575c'), ROOM.dockX, .12, ROOM.dockZ + .25, 1.35, .2, 1.1); s.cube(this.scene, this.charge, ROOM.dockX, .35, ROOM.dockZ + .65, 1.2, .5, .19);
    const dock = label('CHARGE / FINISH', '#e0ffe1', '#33655b'); dock.sprite.position.set(ROOM.dockX, 1.55, ROOM.dockZ + .3); dock.sprite.scale.set(2.6, .81, 1); this.scene.add(dock.sprite);
    this.buildRobot();
    this.suction = mesh(new T.RingGeometry(.93, 1, 44), new T.MeshBasicMaterial({ color: '#aff5df', transparent: true, opacity: .3, side: T.DoubleSide, depthWrite: false }), this.scene, 0, .055, 0, false); this.suction.rotation.x = -Math.PI / 2;
    const dirtCanvas = document.createElement('canvas'); dirtCanvas.width = dirtCanvas.height = 128; const ctx = dirtCanvas.getContext('2d')!;
    const dust = ctx.createRadialGradient(64, 64, 10, 64, 64, 64); dust.addColorStop(0, '#856b43a0'); dust.addColorStop(.6, '#8d734a90'); dust.addColorStop(1, '#987b4e00'); ctx.fillStyle = dust; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = i % 2 ? '#a88b5b88' : '#65513788'; ctx.fillRect((i * 41 + 13) % 128, (i * 17 + 7) % 128, 2 + i % 4, 2 + i % 3); }
    const dustMap = new T.CanvasTexture(dirtCanvas); dustMap.colorSpace = T.SRGBColorSpace;
    this.dirt = new T.InstancedMesh(new T.PlaneGeometry(.54, .54), new T.MeshBasicMaterial({ map: dustMap, transparent: true, depthWrite: false, alphaTest: .025 }), ROOM.columns * ROOM.rows); this.dirt.instanceMatrix.setUsage(T.DynamicDrawUsage); this.dirt.frustumCulled = false; this.scene.add(this.dirt);
    this.route = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: '#d3ffb6', transparent: true, opacity: .85 })); this.scene.add(this.route);
    this.target = mesh(new T.RingGeometry(.2, .27, 24), new T.MeshBasicMaterial({ color: '#eaffad', side: T.DoubleSide, depthWrite: false }), this.scene, 0, .06, 0, false); this.target.rotation.x = -Math.PI / 2; this.target.visible = false;
  }
  private buildRobot() {
    const s = this.shapes, white = material('#fff3df', .3, .2), rubber = material('#354b51', .8);
    s.tube(this.robot, rubber, 0, .08, 0, .37, .14); s.tube(this.robot, white, 0, .19, 0, .36, .22); s.tube(this.robot, this.paint, 0, .31, 0, .33, .025);
    s.tube(this.robot, white, 0, .32, 0, .31, .035); s.tube(this.robot, rubber, .06, .43, -.02, .095, .15); s.tube(this.robot, this.paint, .06, .51, -.02, .1, .025);
    s.cube(this.robot, material('#ffe8a1'), -.11, .35, .1, .07, .025, .05, false);
    s.cube(this.robot, rubber, 0, .19, .35, .23, .09, .04, false);
    for (const side of [-1, 1]) { const brush = new T.Group(); brush.position.set(side * .28, .07, .17); this.robot.add(brush); for (let i = 0; i < 3; i++) { const blade = s.cube(brush, this.paint, 0, 0, .13, .035, .035, .3, false); blade.rotation.y = i * Math.PI * 2 / 3; } this.brushes.push(brush); }
  }
  protected rebuild(): void { this.routeKey = ''; }
  protected update(_dt: number, reduced: boolean): void {
    const run = this.run; this.robot.position.set(run.x, .035, run.z); this.robot.rotation.y = run.heading; this.origin.set(run.x, .3, run.z);
    this.brushes.forEach((brush, i) => { brush.rotation.y = reduced ? 0 : run.brushAngle * (i ? 1 : -1); });
    this.suction.position.set(run.x, .06, run.z); this.suction.scale.setScalar(run.radius); (this.suction.material as T.MeshBasicMaterial).color.set(run.turbo > 0 ? '#ffe9aa' : '#aff5df');
    this.charge.emissiveIntensity = run.charging ? 1.4 : .5;
    this.dirt.count = run.cells.length;
    run.cells.forEach((cell, i) => { const remaining = cell.dirt / cell.initial; this.scratch.position.set(cell.x + Math.sin(cell.index * 2.4) * .065, .048, cell.z + Math.cos(cell.index * 1.7) * .065); this.scratch.rotation.set(-Math.PI / 2, 0, cell.index * .77); this.scratch.scale.setScalar(remaining <= 0 ? 0 : .48 + remaining * .52); this.scratch.updateMatrix(); this.dirt.setMatrixAt(i, this.scratch.matrix); }); this.dirt.instanceMatrix.needsUpdate = true;
    const pathKey = run.path.join(',');
    if (pathKey !== this.routeKey) { this.routeKey = pathKey; this.route.geometry.dispose(); this.route.geometry = new T.BufferGeometry().setFromPoints([new T.Vector3(run.x, .08, run.z), ...run.path.map(i => { const p = cellPoint(i); return new T.Vector3(p.x, .08, p.z); })]); }
    this.route.visible = run.path.length > 0;
    if (run.cameraClose) { this.camera.position.set(run.x + 1.4, 2.8, run.z + 4.7); this.camera.lookAt(run.x, .25, run.z - .8); }
    else { this.camera.position.set(6, 10, 10); this.camera.lookAt(0, .25, 0); }
    this.followLight(0, 0);
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId: number): void {
    if (phase === 'cancel') { this.drag = null; this.target.visible = false; return; }
    if (phase === 'down' && this.drag === null) this.drag = pointerId;
    if (this.drag !== pointerId) return;
    this.raycaster.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), this.camera); const point = new T.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, point)) { this.target.position.set(point.x, .06, point.z); this.target.visible = phase !== 'up'; if (phase === 'up') this.run.targetFloor(point.x, point.z); }
    if (phase === 'up') this.drag = null;
  }
}
