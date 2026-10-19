import * as T from 'three';
import { RunnerRun, runnerFrame, type RunnerObstacle } from './runner';
import { World, instances, material, mesh, label, floorTexture, batchScenery } from './world';
import { coinModel, runnerModel, tree } from './models';

export class RunnerView extends World<RunnerRun> {
  private course = new T.Group(); private hero; private tokenModels: T.Group[] = []; private hazards: { model: T.Group; obstacle: RunnerObstacle }[] = [];
  private turnLabels: { model: T.Sprite; at: number }[] = []; private cameraYaw = 0;
  constructor(canvas: HTMLCanvasElement, run: RunnerRun) {
    super(canvas, run, run.theme === 'temple' ? '#9ac9b9' : '#7eb8d2'); this.hero = runnerModel(this.shapes, this.paint, run.theme === 'subway'); this.scene.add(this.hero.root, this.course);
  }
  private place(root: T.Object3D, distance: number, lane = 0, height = 0) {
    const p = runnerFrame(distance, this.run.theme, this.run.level); root.position.set(p.x + Math.cos(p.yaw) * lane, height, p.z - Math.sin(p.yaw) * lane); root.rotation.y = p.yaw;
  }
  protected rebuild(): void {
    this.scene.remove(this.course); this.disposeStage(this.course); this.course = new T.Group(); this.scene.add(this.course); this.hazards = []; this.tokenModels = []; this.turnLabels = []; this.cameraYaw = 0;
    const run = this.run, urban = run.theme === 'subway', shapes = this.shapes, floor = material(urban ? '#a2aabb' : '#d1c29a'), stones = floorTexture(urban ? 'metro' : 'stone');
    floor.map = stones;
    const tiles: { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number }[] = [], edging: typeof tiles = [], rails: typeof tiles = [], ties: typeof tiles = [];
    for (let at = -20; at < run.goal + 35; at += 2) {
      const frame = runnerFrame(at, run.theme, run.level);
      for (let lane = -1; lane <= 1; lane++) {
        const gap = run.obstacles.some(o => o.kind === 'gap' && o.lane === lane && at >= o.at - 1 && at <= o.at + o.length);
        const x = frame.x + Math.cos(frame.yaw) * lane * 2.15, z = frame.z - Math.sin(frame.yaw) * lane * 2.15;
        if (!gap) tiles.push({ x, y: -.18, z, sx: 2.17, sy: .34, sz: 2.03, yaw: frame.yaw });
        if (urban) { ties.push({ x, y: .02, z, sx: 1.55, sy: .12, sz: .25, yaw: 0 }); for (const side of [-1, 1]) rails.push({ x: x + side * .54, y: .12, z, sx: .08, sy: .14, sz: 2.02, yaw: 0 }); }
      }
      for (const side of [-1, 1]) edging.push({ x: frame.x + Math.cos(frame.yaw) * side * 3.65, y: -.18, z: frame.z - Math.sin(frame.yaw) * side * 3.65, sx: .37, sy: .65, sz: 2.04, yaw: frame.yaw });
    }
    instances(shapes.box, floor, tiles, this.course); instances(shapes.box, material(urban ? '#f1cba9' : '#708d71'), edging, this.course);
    if (urban) { instances(shapes.box, material('#424653'), ties, this.course); instances(shapes.box, material('#b6d4da', .3, .65), rails, this.course); }
    const bottom = material(urban ? '#677d96' : '#4d978f'); shapes.cube(this.course, bottom, urban ? 0 : 75, -5.2, -120, 450, .5, 500, false);
    if (urban) this.metroScenery(); else this.templeScenery();
    batchScenery(this.course);
    for (const o of run.obstacles) {
      const model = new T.Group(); this.place(model, o.at, o.lane * 2.15); this.course.add(model);
      if (o.kind === 'hurdle') {
        shapes.cube(model, material(urban ? '#e9726a' : '#946344'), 0, .48, 0, 1.7, .9, .7);
        shapes.cube(model, material('#ffe0a3'), 0, .9, -.04, 1.82, .12, .8);
        if (urban) for (const x of [-.5, 0, .5]) { const stripe = shapes.cube(model, material('#fff4cf'), x, .52, .365, .18, .65, .02, false); stripe.rotation.z = -.4; }
      } else if (o.kind === 'arch') {
        const posts = material(urban ? '#506b87' : '#766a4c'); shapes.cube(model, posts, -.93, 1.35, 0, .16, 2.7, .25); shapes.cube(model, posts, .93, 1.35, 0, .16, 2.7, .25);
        shapes.cube(model, material(urban ? '#467da3' : '#758854'), 0, 1.6, 0, 2.1, 1.05, .5);
        const sign = label('SLIDE', '#fff0b7', urban ? '#25516c' : '#4e6141'); sign.sprite.position.set(0, 2.5, 0); sign.sprite.scale.set(2, .63, 1); model.add(sign.sprite);
      } else if (o.kind === 'train') {
        const body = material(o.id % 2 ? '#e67967' : '#6288a9', .42, .15), glass = material('#203e57', .22, .35);
        shapes.cube(model, body, 0, 1.5, -o.length / 2, 1.85, 2.5, o.length); shapes.cube(model, material('#d7e5dc'), 0, 2.72, -o.length / 2, 1.9, .18, o.length + .1);
        shapes.cube(model, glass, 0, 1.9, .035, 1.44, .86, .08);
        for (const x of [-.7, .7]) shapes.ball(model, material('#ffedac'), x, .9, .08, .12, false);
        for (let z = -1; z > -o.length; z -= 1.8) for (const x of [-1, 1]) shapes.cube(model, glass, x * .94, 1.95, z, .04, .75, 1.1, false);
        if (o.ramp) {
          const ramp = shapes.cube(model, material('#e9ba75'), 0, 1.1, 2.5, 1.8, .15, 5.6); ramp.rotation.x = Math.atan2(2.6, 5);
          const sign = label('ROOF ROUTE', '#fff5c2'); sign.sprite.scale.set(2.5, .78, 1); sign.sprite.position.set(0, 3.7, 1); model.add(sign.sprite);
        }
      } else {
        shapes.cube(model, material('#153f40'), 0, -1.4, -1.4, 2.13, .08, 3.8, false);
        const sign = label('JUMP', '#ffedaf', '#4b3d30'); sign.sprite.scale.set(1.8, .56, 1); sign.sprite.position.set(0, .8, 1); model.add(sign.sprite);
      }
      this.hazards.push({ model, obstacle: o });
    }
    for (const c of run.tokens) { const token = coinModel(shapes, this.course, 0, 0, 0); this.place(token, c.at, c.lane * 2.15, c.y); this.tokenModels.push(token); }
    for (const turn of run.turns) {
      const sign = label(turn.direction === 1 ? 'TURN RIGHT →' : '← TURN LEFT', '#fff0a6', '#6a4a24'); sign.sprite.scale.set(5.2, 1.63, 1); this.place(sign.sprite, turn.at - 7, 0, 4.3); this.course.add(sign.sprite); this.turnLabels.push({ model: sign.sprite, at: turn.at });
      const beacon = new T.Group(); this.place(beacon, turn.at); this.course.add(beacon); shapes.tube(beacon, material('#e8c082'), -3.5, 1.6, 0, .3, 3.5); shapes.tube(beacon, material('#e8c082'), 3.5, 1.6, 0, .3, 3.5);
    }
    const finish = new T.Group(); this.place(finish, run.goal); this.course.add(finish); const stone = material(urban ? '#53779c' : '#b5a77f');
    for (const x of [-3.5, 3.5]) shapes.cube(finish, stone, x, 3, 0, .8, 6, 1.4);
    shapes.cube(finish, stone, 0, 5.8, 0, 7.7, .9, 1.7); const banner = label(urban ? 'STATION REACHED' : 'TEMPLE BEACON', '#fff2ae'); banner.sprite.position.set(0, 4.4, .1); banner.sprite.scale.set(5.5, 1.72, 1); finish.add(banner.sprite);
  }
  private templeScenery() {
    const shapes = this.shapes, cliff = material('#a78c72'), moss = material('#719357'), rock = material('#a5ac8d');
    for (let at = 0; at < this.run.goal + 30; at += 12) {
      const p = runnerFrame(at, 'temple', this.run.level);
      for (const side of [-1, 1]) {
        const x = p.x + Math.cos(p.yaw) * side * (7.5 + at % 5), z = p.z - Math.sin(p.yaw) * side * (7.5 + at % 5);
        shapes.cube(this.course, cliff, x, -3.1, z, 9.5, 5.8, 12, false); shapes.cube(this.course, moss, x, -.24, z, 9.7, .28, 12.1, false);
        for (let band = 0; band < 3; band++) shapes.cube(this.course, rock, x, -1.4 - band * 1.3, z, 9.6 - band * .1, .16, 12.05, false);
        tree(shapes, this.course, x, z, 1 + at % 4 * .18, at % 24 === 0);
        for (let fern = 0; fern < 3; fern++) for (let leaf = 0; leaf < 4; leaf++) { const blade = mesh(shapes.sphere, moss, this.course, x + Math.sin(fern * 2) * 2, .17 + leaf * .07, z + Math.cos(fern * 2) * 2, false); blade.scale.set(.13, .12, .7); blade.rotation.y = leaf * 1.57 + fern; blade.rotation.x = -.35; }
        if (at % 24 === 0) { const ruin = new T.Group(); ruin.position.set(x + side * 2, -.5, z - 3); this.course.add(ruin); const mat = material('#8b9d82'); shapes.cube(ruin, mat, 0, 1.2, 0, 2.4, 3.4, 2.4); shapes.cube(ruin, material('#c1b68a'), 0, 3.1, 0, 3.3, .55, 3.3); }
      }
      for (const side of [-1, 1]) shapes.tube(this.course, rock, p.x + Math.cos(p.yaw) * side * 2.5, -2.55, p.z - Math.sin(p.yaw) * side * 2.5, .48, 5.2, false);
    }
    // An open entry arch and a substantial side sanctuary establish the setting immediately.
    const entry = new T.Group(); this.place(entry, 20); this.course.add(entry);
    const warmStone = material('#c4b28a'), gold = material('#e6b65c', .35, .35), flame = material('#ffd777', .3); flame.emissive.set('#ee9b3e');
    for (const side of [-1, 1]) {
      shapes.cube(entry, warmStone, side * 3.9, 2.2, 0, 1.15, 4.7, 1.4); shapes.cube(entry, moss, side * 3.9, 4.55, 0, 1.4, .3, 1.65);
      for (let i = 0; i < 3; i++) shapes.cube(entry, gold, side * 3.9, 1.4 + i * .8, .73, .45, .16, .06, false);
      shapes.tube(entry, material('#685847'), side * 3.1, 2, .8, .09, 1.4); const fire = shapes.ball(entry, flame, side * 3.1, 2.9, .8, .2, false); fire.scale.y = .4;
    }
    shapes.cube(entry, warmStone, 0, 5, 0, 9, 1.05, 1.7); shapes.cube(entry, moss, 0, 5.65, 0, 9.5, .28, 2);
    const sanctuary = new T.Group(); this.place(sanctuary, 43, -12); sanctuary.rotation.y += .2; this.course.add(sanctuary);
    for (let i = 0; i < 5; i++) shapes.cube(sanctuary, warmStone, 0, i * .8, 0, 11 - i * 1.6, .9, 10 - i * 1.4, false);
    for (const x of [-2.1, 2.1]) shapes.cube(sanctuary, rock, x, 5.2, 0, 1.2, 4, 2);
    shapes.cube(sanctuary, warmStone, 0, 7.2, 0, 6.2, .9, 3.8); shapes.cube(sanctuary, moss, 0, 7.8, 0, 6.6, .4, 4.2);
    const relic = mesh(shapes.ring, gold, sanctuary, 0, 5.5, 1.15); relic.scale.setScalar(1.25); shapes.ball(sanctuary, gold, 0, 5.5, 1.2, .65);
    for (let i = 0; i < 12; i++) { const mountain = new T.Mesh(new T.ConeGeometry(20 + i % 3 * 8, 28 + i % 4 * 9, 5), material(i % 2 ? '#658c82' : '#80aaa0')); mountain.position.set(60 + i * 18, 8, -120 - i * 32); this.course.add(mountain); }
  }
  private metroScenery() {
    const shapes = this.shapes, windowMat = material('#c4eaf1', .25, .15), colors = ['#bf8d91', '#6d859f', '#d2b08d', '#9d94b5'];
    for (let at = -15; at < this.run.goal + 45; at += 12) for (const side of [-1, 1]) {
      const height = 8 + Math.abs(at * 7) % 16, x = side * (9 + Math.abs(at) % 3); shapes.cube(this.course, material(colors[Math.abs(Math.floor(at / 12)) % 4]), x, height / 2 - .8, -at, 7, height, 10, false);
      for (let floor = 2; floor < height; floor += 2.4) for (let z = -3; z <= 3; z += 2) shapes.cube(this.course, windowMat, x - side * 3.53, floor, -at + z, .05, 1.2, 1.1, false);
      shapes.cube(this.course, material('#ce998d'), side * 4.7, 1, -at, .28, 2.2, 12, false);
      if (at % 24 === 9) { const board = label(['STAY CURIOUS', 'NEXT STOP: YOU', 'KEEP MOVING'][Math.abs(at) % 3], '#ffe5ac', '#5b436e'); board.sprite.position.set(side * 4.8, 3.5, -at); board.sprite.scale.set(4.4, 1.38, 1); this.course.add(board.sprite); }
    }
  }
  protected update(dt: number, reduced: boolean): void {
    const run = this.run, frame = runnerFrame(run.distance, run.theme, run.level), p = new T.Vector3(frame.x + Math.cos(frame.yaw) * run.x, run.y, frame.z - Math.sin(frame.yaw) * run.x);
    this.hero.root.position.copy(p); this.hero.root.rotation.y = frame.yaw; this.origin.copy(p).y += 1;
    const stride = run.phase === 'playing' ? run.distance * 2.7 : 0, bob = reduced || run.y > .1 || run.slide > 0 ? 0 : Math.sin(stride * 2) * .045;
    this.hero.figure.position.y = bob + (run.slide > 0 ? -.55 : 0); this.hero.figure.rotation.x = run.slide > 0 ? -.9 : run.y > .1 ? -.14 : .08;
    this.hero.legs.forEach((leg, i) => { leg.rotation.x = run.y > .1 ? (i ? -.65 : .5) : Math.sin(stride + i * Math.PI) * .7; });
    this.hero.arms.forEach((arm, i) => { arm.rotation.x = run.y > .1 ? -1.2 : -Math.sin(stride + i * Math.PI) * .6; });
    this.hero.shield.visible = run.shield > 0; this.hero.board.visible = run.theme === 'subway' && run.shield > 0;
    this.hero.root.visible = run.invulnerable <= 0 || reduced || Math.floor(run.elapsed * 12) % 2 === 0;
    for (let i = 0; i < this.tokenModels.length; i++) { const token = this.tokenModels[i], c = run.tokens[i]; token.visible = !c.taken && Math.abs(c.at - run.distance) < 75; if (token.visible) token.rotation.y += dt * 2.5; }
    for (const h of this.hazards) { h.model.visible = h.obstacle.at > run.distance - 16 && h.obstacle.at < run.distance + 85; if (h.obstacle.moving) this.place(h.model, h.obstacle.at, h.obstacle.lane * 2.15); }
    for (const sign of this.turnLabels) sign.model.visible = sign.at > run.distance && sign.at - run.distance < 43;
    const diff = Math.atan2(Math.sin(frame.yaw - this.cameraYaw), Math.cos(frame.yaw - this.cameraYaw)); this.cameraYaw += diff * (reduced ? 1 : Math.min(1, dt * 5));
    const forward = new T.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw)), cameraPos = new T.Vector3(frame.x, 5.4 + Math.min(1, run.y * .2), frame.z).addScaledVector(forward, -9.4);
    this.camera.position.copy(cameraPos); this.camera.lookAt(new T.Vector3(frame.x, 1.1, frame.z).addScaledVector(forward, 12)); this.followLight(frame.x, frame.z);
  }
}
