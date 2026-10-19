import * as T from 'three';
import { TeamRun, type TeamGate, type TeamEnemy, type TeamTrap } from './run';
import { World, material, mesh, instances, label, batchScenery, type Label } from '../three-kit/world';

class Crowd {
  root = new T.Group(); private bodies: T.InstancedMesh; private heads: T.InstancedMesh; private legs: T.InstancedMesh; private arms: T.InstancedMesh; private gear: T.InstancedMesh; private dummy = new T.Object3D(); private style = '';
  constructor(parent: T.Object3D, color: T.Material, readonly capacity = 180) {
    this.bodies = new T.InstancedMesh(new T.CapsuleGeometry(.115, .2, 2, 6), color, capacity);
    this.heads = new T.InstancedMesh(new T.SphereGeometry(.135, 8, 6), color, capacity);
    this.legs = new T.InstancedMesh(new T.CylinderGeometry(.042, .045, .22, 5), color, capacity * 2);
    this.arms = new T.InstancedMesh(new T.CylinderGeometry(.04, .04, .23, 5), color, capacity * 2);
    this.gear = new T.InstancedMesh(new T.BoxGeometry(.24, .1, .045), material('#1b3654', .4, .4), capacity);
    for (const m of [this.bodies, this.heads, this.legs, this.arms, this.gear]) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = true; this.root.add(m); } parent.add(this.root); this.root.userData.character = true;
  }
  update(count: number, time: number, marching = true, style = 'original') {
    if (style !== this.style) { this.style = style; this.heads.geometry.dispose(); this.heads.geometry = style === 'robot' ? new T.BoxGeometry(.28, .28, .27) : style === 'astronaut' ? new T.SphereGeometry(.18, 10, 8) : new T.SphereGeometry(.135, 8, 6); this.bodies.geometry.dispose(); this.bodies.geometry = style === 'armored' ? new T.BoxGeometry(.32, .33, .23) : new T.CapsuleGeometry(.115, .2, 2, 6); }
    const n = Math.min(this.capacity, Math.max(0, count)); this.bodies.count = this.heads.count = n; this.legs.count = this.arms.count = n * 2; this.gear.count = style === 'original' ? 0 : n;
    for (let i = 0; i < n; i++) {
      const angle = i * 2.39996, radius = Math.sqrt(i) * .137, x = Math.sin(angle) * radius, z = Math.cos(angle) * radius * 1.3, step = marching ? Math.sin(time * 14 + i * .7) * .055 : 0;
      this.dummy.rotation.set(0, 0, 0); this.dummy.scale.setScalar(1); this.dummy.position.set(x, .39 + Math.abs(step), z); this.dummy.updateMatrix(); this.bodies.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.y = .73 + Math.abs(step); this.dummy.updateMatrix(); this.heads.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(x, .74 + Math.abs(step), z - .14); this.dummy.updateMatrix(); this.gear.setMatrixAt(i, this.dummy.matrix);
      for (let side = 0; side < 2; side++) { this.dummy.position.set(x + (side ? .07 : -.07), .13 + Math.max(0, step * (side ? 1 : -1)), z + step * (side ? 1 : -1)); this.dummy.rotation.x = step * (side ? 4 : -4); this.dummy.updateMatrix(); this.legs.setMatrixAt(i * 2 + side, this.dummy.matrix); }
      for (let side = 0; side < 2; side++) { this.dummy.position.set(x + (side ? .17 : -.17), .4 + Math.abs(step), z); this.dummy.rotation.x = step * (side ? -7 : 7); this.dummy.rotation.z = side ? -.18 : .18; this.dummy.updateMatrix(); this.arms.setMatrixAt(i * 2 + side, this.dummy.matrix); } this.dummy.rotation.set(0,0,0);
    }
    this.bodies.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = this.legs.instanceMatrix.needsUpdate = this.arms.instanceMatrix.needsUpdate = this.gear.instanceMatrix.needsUpdate = true;
  }
}
export class TeamView extends World<TeamRun> {
  private world = new T.Group(); private crew: Crowd; private count: Label; private shield: T.Mesh;
  private gates: { gate: TeamGate; root: T.Group; labels: Label[]; previews: Label[]; panes: T.MeshStandardMaterial[] }[] = [];
  private enemies: { enemy: TeamEnemy; crowd: Crowd; count: Label }[] = [];
  private traps: { trap: TeamTrap; root: T.Group; saw: T.Group }[] = [];
  constructor(canvas: HTMLCanvasElement, run: TeamRun) {
    super(canvas, run, '#f7c9a3'); this.scene.fog = new T.Fog('#f7c9a3', 42, 120); this.scene.add(this.world);
    this.crew = new Crowd(this.scene, this.paint); this.count = label('10', '#e9fbff', '#176286'); this.count.sprite.scale.set(2.3, .72, 1); this.scene.add(this.count.sprite);
    this.shield = mesh(new T.SphereGeometry(2.5, 20, 12), new T.MeshBasicMaterial({ color: '#81f5e9', transparent: true, opacity: .16, depthWrite: false, wireframe: true }), this.scene, 0, 1, 0, false);
  }
  protected rebuild(): void {
    this.scene.remove(this.world); this.disposeStage(this.world); this.world = new T.Group(); this.scene.add(this.world); this.gates = []; this.enemies = []; this.traps = [];
    const s = this.shapes, ivory = material('#f5f5fa'), coral = material('#aebfe0'), stone = material('#e9d4b3');
    s.cube(this.world, ivory, 0, -.4, -91, 8.4, .8, 210, false);
    const stripes = Array.from({ length: 105 }, (_, i) => ({ x: 0, y: .02, z: 10 - i * 2, sx: 7.6, sy: .025, sz: .9 })); instances(s.block, material('#d9e1ee'), stripes, this.world);
    for (const side of [-1, 1]) s.cube(this.world, coral, side * 4.18, -.03, -91, .17, .3, 210, false);
    for (let i = 0; i < 26; i++) { const island = new T.Group(); island.position.set((i % 2 ? -1 : 1) * (10 + i % 4 * 3), -2.5 - i % 3, 15 - i * 9); this.world.add(island); for (let j = 0; j < 3; j++) { const rock = mesh(new T.DodecahedronGeometry(2.5 + j * .5, 0), material(i % 2 ? '#7a48e8' : '#a27ce8'), island, j * .8, j * 1.2, 0, false); rock.scale.y = 1.5; } }
    batchScenery(this.world);
    for (const gate of this.run.gates) {
      const root = new T.Group(); root.position.z = -gate.at; this.world.add(root); const labels: Label[] = [], previews: Label[] = [], panes: T.MeshStandardMaterial[] = [];
      for (let side = 0; side < 2; side++) {
        const x = side ? 2 : -2, option = gate.options[side], positive = option.op === '+' || option.op === '×', tint = positive ? '#63cfbc' : '#ec8b84';
        const pane = new T.MeshStandardMaterial({ color: tint, transparent: true, opacity: .42, roughness: .3, metalness: .12, side: T.DoubleSide }); panes.push(pane);
        s.cube(root, pane, x, 1.4, 0, 3.8, 2.8, .12, false); for (const edge of [-1, 1]) s.cube(root, material(positive ? '#5ca99e' : '#bd767e'), x + edge * 1.9, 1.5, 0, .13, 3.1, .14);
        const text = label(`${option.op}${option.value}`, '#ffffff', positive ? '#168c8588' : '#a9516588'); text.sprite.position.set(x, 1.95, .15); text.sprite.scale.set(3.25, 1.02, 1); root.add(text.sprite); labels.push(text);
        const preview = label('', '#e8ffca', '#193b5299'); preview.sprite.position.set(x, 3.5, 0); preview.sprite.scale.set(3, .94, 1); root.add(preview.sprite); previews.push(preview);
      }
      this.gates.push({ gate, root, labels, previews, panes });
    }
    const red = material('#e96c73', .42);
    for (const enemy of this.run.enemies) {
      const crowd = new Crowd(this.world, red, 70); crowd.root.position.set(0, 0, -enemy.at); const count = label(String(enemy.count), '#fff4e5', '#ad415d'); count.sprite.position.set(0, 2.3, -enemy.at); count.sprite.scale.set(2.3, .72, 1); this.world.add(count.sprite); this.enemies.push({ enemy, crowd, count });
    }
    for (const trap of this.run.traps) {
      const root = new T.Group(), saw = new T.Group(); root.position.z = -trap.at; root.add(saw); this.world.add(root);
      s.tube(saw, material('#9b5770', .3, .4), 0, .35, 0, .65, .17); s.tube(saw, material('#ffe2a1', .25, .5), 0, .47, 0, .18, .15);
      for (let i = 0; i < 12; i++) { const tooth = s.cube(saw, material('#ede4e3', .25, .6), Math.sin(i * Math.PI / 6) * .66, .35, Math.cos(i * Math.PI / 6) * .66, .23, .12, .22); tooth.rotation.y = i * Math.PI / 6; }
      const warning = label('KEEP CLEAR', '#ffe0c0', '#8a4b62'); warning.sprite.position.set(0, 1.9, 0); warning.sprite.scale.set(2.7, .84, 1); root.add(warning.sprite); this.traps.push({ trap, root, saw });
    }
    const castle = new T.Group(); castle.position.z = -181; this.world.add(castle);
    for (const x of [-3.2, 3.2]) { s.tube(castle, stone, x, 2.2, 0, 1.1, 4.6); const roof = mesh(s.cone, coral, castle, x, 5.2, 0); roof.scale.set(1.4, 1.8, 1.4); }
    s.cube(castle, stone, 0, 3.4, -.5, 6.4, 1.5, 1.5); s.cube(castle, material('#785963'), 0, 1.7, .05, 2.2, 3.4, .35);
    for (let i = 0; i < 10; i++) { s.cube(castle, material(i % 2 ? '#f4d99e' : '#debb8e'), 0, i * .18, -4 - i * .8, 5, .35 + i * .36, .78); const step = label(`×${i + 1}`, '#594d5a', '#fff3cf'); step.sprite.scale.set(1.5, .47, 1); step.sprite.position.set(0, i * .36 + .8, -4 - i * .8); castle.add(step.sprite); }
    const banner = label('COUNT ON YOUR CREW', '#fff1bd', '#655876'); banner.sprite.position.set(0, 7, 0); banner.sprite.scale.set(6, 1.88, 1); castle.add(banner.sprite);
  }
  protected update(_dt: number, reduced: boolean): void {
    const run = this.run, y = Math.max(0, Math.min(3.3, (run.distance - 184) * .43)); this.crew.root.position.set(run.x, y, -run.distance); this.crew.update(run.team, reduced ? 0 : run.elapsed, run.phase === 'playing', run.config.characterStyle);
    this.count.set(run.team.toLocaleString()); this.count.sprite.position.set(run.x, y + 2.5, -run.distance); this.origin.set(run.x, y + .5, -run.distance);
    this.shield.visible = run.shield > 0; this.shield.position.set(run.x, y + .8, -run.distance);
    for (const entry of this.gates) {
      entry.root.visible = !entry.gate.used && entry.gate.at - run.distance < 65; const values = run.preview(entry.gate);
      entry.previews.forEach((preview, side) => { preview.sprite.visible = run.config.assist; preview.set(`→ ${values[side]}`, values[side] >= values[1 - side] ? '#eaffaa' : '#ffcab9'); });
      entry.panes.forEach((pane, side) => { pane.emissive.set(run.config.assist && values[side] >= values[1 - side] ? '#22694f' : '#000000'); });
    }
    for (const entry of this.enemies) { entry.crowd.root.visible = entry.count.sprite.visible = !entry.enemy.defeated && entry.enemy.at - run.distance < 70; if (entry.crowd.root.visible) entry.crowd.update(entry.enemy.count, reduced ? 0 : run.elapsed, !reduced); }
    for (const entry of this.traps) { entry.root.visible = !entry.trap.hit && Math.abs(entry.trap.at - run.distance) < 60; entry.root.position.x = run.trapX(entry.trap); entry.saw.rotation.y = reduced ? 0 : run.elapsed * 6; }
    this.camera.position.set(run.x * .15, 11 + y, 11 - run.distance); this.camera.lookAt(0, .4 + y, -run.distance - 5.7); this.followLight(0, -run.distance);
  }
}
