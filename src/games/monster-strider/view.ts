import * as T from 'three';
import { MONSTER_TRACK, MonsterRun, trackHeight } from './run';
import { World, material, mesh, label, instances, floorTexture, batchScenery } from '../three-kit/world';
import { coinModel, tree } from '../three-kit/models';
import { unityModel } from '../three-kit/unity-assets';

export class MonsterView extends World<MonsterRun> {
  private truck = new T.Group(); private chassis = new T.Group(); private wheels: T.Group[] = []; private coins: T.Group[] = [];
  private bridge: { object: T.Mesh; at: number }[] = []; private trail = new T.Group(); private flag: T.Group; private flame = new T.Group();
  constructor(canvas: HTMLCanvasElement, run: MonsterRun) {
    super(canvas, run, '#93d9e8', 19); this.camera = new T.OrthographicCamera(-14, 14, 9, -9, .1, 220); this.scene.fog = new T.Fog('#93d9e8', 60, 140); this.scene.add(this.truck, this.trail); this.truck.add(this.chassis);
    this.flag = new T.Group(); this.scene.add(this.flag); this.buildTruck(); this.buildTrack(); unityModel(this.chassis, 'truck'); this.remix.character(this.chassis, 'vehicle');
  }
  private buildTruck() {
    const s = this.shapes, dark = material('#273646', .55, .25), chrome = material('#d4e4e4', .25, .7), glass = material('#7bd3db', .18, .25), amber = material('#f5af46', .4, .15);
    s.cube(this.chassis, dark, 0, -.1, 0, 3.05, .25, 1.55); s.cube(this.chassis, this.paint, -.15, .33, 0, 3.1, .65, 1.7);
    s.cube(this.chassis, this.paint, -.43, .91, 0, 1.4, .8, 1.6); s.cube(this.chassis, glass, -.05, 1.03, 0, .64, .45, 1.64);
    s.cube(this.chassis, amber, -.45, 1.39, 0, 1.6, .15, 1.76); s.cube(this.chassis, chrome, 1.58, .22, 0, .12, .3, 1.9);
    for (const z of [-.58, .58]) s.cube(this.chassis, material('#fff1b4'), 1.58, .51, z, .09, .26, .38, false);
    for (const x of [-1.02, 1.02]) for (const z of [-1, 1]) {
      const wheel = new T.Group(); wheel.position.set(x, -.44, z); this.truck.add(wheel); this.wheels.push(wheel);
      const tire = mesh(new T.CylinderGeometry(.63, .63, .48, 16), material('#1d2634', .9), wheel); tire.rotation.x = Math.PI / 2;
      const hub = mesh(new T.CylinderGeometry(.28, .28, .5, 12), chrome, wheel); hub.rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) { const tread = s.cube(wheel, dark, Math.cos(i * Math.PI / 6) * .62, Math.sin(i * Math.PI / 6) * .62, 0, .24, .15, .56); tread.rotation.z = i * Math.PI / 6; }
      const spring = mesh(new T.TorusGeometry(.1, .035, 5, 8), amber, this.chassis, x, -.15, z * .65); spring.rotation.x = Math.PI / 2;
      batchScenery(wheel);
    }
    for (const z of [-.7, .7]) { s.tube(this.chassis, dark, -.9, 1.65, z, .07, .65); s.ball(this.chassis, material('#ffe2a1'), -.9, 2, z, .1, false); }
    batchScenery(this.chassis);
    this.chassis.add(this.flame); const fire = mesh(new T.ConeGeometry(.28, 1.6, 10), new T.MeshBasicMaterial({ color: '#79e8ff' }), this.flame, -2.1, .1, 0, false); fire.rotation.z = Math.PI / 2;
  }
  private buildTrack() {
    const s = this.shapes, wood = material('#b77d5f'), texture = floorTexture('wood'); wood.map = texture;
    const planks: { x: number; y: number; z: number; sx: number; sy: number; sz: number }[] = [];
    for (const section of MONSTER_TRACK) {
      const grass = section.kind === 'grass' || section.kind === 'rock';
      if (grass) {
        const length = section.end - section.start, middle = (section.start + section.end) / 2, height = (section.from + section.to) / 2;
        s.cube(this.trail, material('#dba18e'), middle, height / 2 - 2.2, 0, length, height + 4, 4.8, false);
        s.cube(this.trail, material('#68bd46'), middle, height - .25, 0, length + .05, .35, 4.9, false);
        tree(s, this.trail, middle, -4.3, .9, true);
        for (const z of [-2.2, 2.2]) for (let x = section.start + 1; x < section.end; x += 3.5) { const h = trackHeight(x, 0, 1) ?? height; s.cube(this.trail, material('#f5d8b6'), x, h + .3, z, .15, .75, .15); }
      }
      for (let x = section.start; x < section.end; x += .55) {
        const y = trackHeight(x + .27, 0, 1) ?? section.from;
        if (section.kind === 'bridge') { const plank = s.cube(this.trail, wood, x + .27, y - .04, 0, .53, .18, 3.4); plank.userData.dynamic = true; this.bridge.push({ object: plank, at: x + .27 }); }
        else planks.push({ x: x + .27, y: y - .03, z: 0, sx: .55, sy: .16, sz: 3.4 });
      }
      if (!grass) for (let x = section.start + 1; x < section.end; x += 4) for (const z of [-1.35, 1.35]) { const y = trackHeight(x, 0, 1) ?? 0; s.cube(this.trail, material('#b17668'), x, (y - 2) / 2, z, .25, y + 4, .3, false); }
    }
    instances(s.block, wood, planks, this.trail);
    const sea = material('#08b9f3', .2, .2); s.cube(this.trail, sea, 55, -3.3, 0, 220, .15, 150, false);
    for (let i = 0; i < 48; i++) { const wave = s.cube(this.trail, material('#a1f2ff', .3), (i * 17) % 160 - 15, -3.19, Math.sin(i * 2.4) * 35, 3 + i % 4, .018, .06, false); wave.rotation.y = -.15; }
    for (let i = 0; i < 10; i++) { const island = s.cube(this.trail, material(i % 2 ? '#77b39f' : '#8fc1af'), i * 17 - 15, -1.5, -22 - i % 3 * 13, 9, 5 + i % 4 * 3, 7, false); island.rotation.y = i * .4; }
    for (let i = 0; i < 12; i++) { const mountain = mesh(new T.ConeGeometry(13 + i % 3 * 3, 22 + i % 4 * 4, 4), material(i % 2 ? '#147fe4' : '#2c9cec'), this.trail, i * 16 - 15, 4, -25 - i % 3 * 8, false); mountain.rotation.y = Math.PI / 4 + i * .2; }
    batchScenery(this.trail);
    this.coins = this.run.coins.map(c => coinModel(s, this.trail, c.x, (trackHeight(c.x) ?? 0) + 1.7, 0));
    for (const z of [-2, 2]) s.cube(this.flag, material('#faf0c5'), 133, 7, z, .15, 4, .15);
    const finish = label('FINISH', '#fff6da', '#294d67'); finish.sprite.position.set(133, 9.4, 0); finish.sprite.scale.set(4.5, 1.4, 1); this.flag.add(finish.sprite);
    const checks = Array.from({ length: 10 }, (_, i) => ({ x: 133, y: 8.7, z: -2 + i * .4, sx: .17, sy: .55, sz: .4 })); instances(s.block, material('#203e55'), checks.filter((_, i) => i % 2 === 0), this.flag); instances(s.block, material('#fff4d1'), checks.filter((_, i) => i % 2 !== 0), this.flag);
    for (const [at, text] of [[15, 'BUILD SPEED'], [39, 'EASY ON THE BRIDGE'], [78, 'NEXT JUMP'], [106, 'CLIMB TO THE FINISH']] as const) { const sign = label(text, '#fff0c1', '#4f6f66'); sign.sprite.position.set(at, (trackHeight(at) ?? 0) + 3, -2.5); sign.sprite.scale.set(4, 1.25, 1); this.trail.add(sign.sprite); }
  }
  protected rebuild(): void { this.coins.forEach(c => { c.visible = true; }); }
  protected update(dt: number, reduced: boolean): void {
    const run = this.run; this.truck.position.set(run.x, run.y, 0); this.truck.rotation.z = run.pitch; this.chassis.position.y = -run.suspension; this.origin.set(run.x, run.y + .7, 0); this.flame.visible = run.turbo > 0; this.flame.scale.setScalar(reduced ? 1 : 1 + Math.sin(run.elapsed * 25) * .14);
    this.wheels.forEach((wheel, i) => { wheel.rotation.z = -run.wheelSpin; const x = i < 2 ? -1.02 : 1.02, floor = trackHeight(run.x + x, run.elapsed, run.level); wheel.position.y = -.44 + (run.grounded && floor !== null ? Math.max(-.2, Math.min(.2, floor + 1 - run.y)) : -.12); });
    for (let i = 0; i < this.coins.length; i++) { this.coins[i].visible = !run.coins[i].taken; if (!reduced) this.coins[i].rotation.y += dt * 2; }
    for (const plank of this.bridge) { plank.object.position.y = (trackHeight(plank.at, run.elapsed, run.level) ?? 0) - .04; }
    this.camera.position.set(run.x - 10, 10 + run.y, 14); this.camera.lookAt(run.x + 4, Math.max(0, run.y - .2), 0); this.followLight(run.x, 0);
  }
}
