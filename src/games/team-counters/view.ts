import * as T from 'three';
import type { ArcadeCue } from '../premium-kit/core';
import { TeamRun, formation, hazardSpans, isPositive, HALF_WIDTH, STEPS, STEP_LENGTH, STEP_HEIGHT, VISIBLE, SPREAD, type TeamGate, type TeamEnemy, type TeamHazard } from './run';
import { World, material, mesh, label, batchScenery, type Label } from '../three-kit/world';

const BLUE = '#2f6bff', RED = '#ff3a3a', STEP_COLORS = ['#ff4d6d', '#ff8a3d', '#ffc53d', '#9bd447', '#3dd68c', '#3dc9d6', '#3d8bff', '#6f5cff', '#b45cff', '#ff5cb0'];

/** A crowd of instanced stickmen. Runners glide to their formation slot, so a growing crowd blooms out from the middle. */
class Crowd {
  root = new T.Group(); private bodies: T.InstancedMesh; private heads: T.InstancedMesh; private legs: T.InstancedMesh; private arms: T.InstancedMesh;
  private dummy = new T.Object3D(); private style = ''; private px: Float32Array; private pz: Float32Array; private shown = 0;
  constructor(parent: T.Object3D, color: string, readonly capacity = VISIBLE) {
    const skin = new T.MeshStandardMaterial({ color, roughness: .45, emissive: color, emissiveIntensity: .12 });
    this.bodies = new T.InstancedMesh(new T.CapsuleGeometry(.1, .24, 3, 8), skin, capacity);
    this.heads = new T.InstancedMesh(new T.SphereGeometry(.12, 10, 8), skin, capacity);
    this.legs = new T.InstancedMesh(new T.CapsuleGeometry(.042, .2, 2, 5), skin, capacity * 2);
    this.arms = new T.InstancedMesh(new T.CapsuleGeometry(.036, .19, 2, 5), skin, capacity * 2);
    for (const m of [this.bodies, this.heads, this.legs, this.arms]) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = true; m.count = 0; this.root.add(m); }
    this.px = new Float32Array(capacity); this.pz = new Float32Array(capacity); parent.add(this.root); this.root.userData.character = true;
  }
  update(count: number, spread: number, time: number, dt: number, running: boolean, style = 'original') {
    if (style !== this.style) {
      this.style = style; this.heads.geometry.dispose(); this.bodies.geometry.dispose();
      this.heads.geometry = style === 'robot' ? new T.BoxGeometry(.24, .22, .22) : style === 'astronaut' ? new T.SphereGeometry(.16, 10, 8) : new T.SphereGeometry(.12, 10, 8);
      this.bodies.geometry = style === 'armored' ? new T.BoxGeometry(.28, .34, .2) : new T.CapsuleGeometry(.1, .24, 3, 8);
    }
    const n = Math.min(this.capacity, Math.max(0, Math.round(count))), k = Math.min(1, dt * 7);
    for (let i = this.shown; i < n; i++) { this.px[i] = 0; this.pz[i] = 0; } this.shown = n;
    this.bodies.count = this.heads.count = n; this.legs.count = this.arms.count = n * 2;
    for (let i = 0; i < n; i++) {
      const target = formation(i, spread); this.px[i] += (target.x - this.px[i]) * k; this.pz[i] += (-target.z - this.pz[i]) * k;
      const x = this.px[i], z = this.pz[i], phase = time * 15 + i * 1.7, swing = running ? Math.sin(phase) : 0, bob = running ? Math.abs(Math.cos(phase)) * .05 : 0, d = this.dummy;
      d.rotation.set(running ? -.18 : 0, 0, 0); d.scale.setScalar(1); d.position.set(x, .5 + bob, z); d.updateMatrix(); this.bodies.setMatrixAt(i, d.matrix);
      d.rotation.set(0, 0, 0); d.position.set(x, .82 + bob, z - (running ? .05 : 0)); d.updateMatrix(); this.heads.setMatrixAt(i, d.matrix);
      for (let side = 0; side < 2; side++) {
        const s = side ? 1 : -1;
        d.rotation.set(swing * .9 * s, 0, 0); d.position.set(x + s * .06, .2 + bob, z); d.updateMatrix(); this.legs.setMatrixAt(i * 2 + side, d.matrix);
        d.rotation.set(-swing * .9 * s, 0, s * -.35); d.position.set(x + s * .15, .55 + bob, z); d.updateMatrix(); this.arms.setMatrixAt(i * 2 + side, d.matrix);
      }
    }
    for (const m of [this.bodies, this.heads, this.legs, this.arms]) m.instanceMatrix.needsUpdate = true;
  }
  /** Fixed runners facing the camera with both arms up, for the ones left cheering on the stairs. */
  cheer(spots: readonly { x: number; y: number; z: number }[], style = 'original') {
    this.update(0, SPREAD, 0, 1, false, style); const d = this.dummy, n = Math.min(this.capacity, spots.length);
    spots.slice(0, n).forEach(({ x, y, z }, i) => {
      d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.position.set(x, y + .5, z); d.updateMatrix(); this.bodies.setMatrixAt(i, d.matrix); d.position.y = y + .82; d.updateMatrix(); this.heads.setMatrixAt(i, d.matrix);
      for (let side = 0; side < 2; side++) { const s = side ? 1 : -1; d.rotation.set(0, 0, 0); d.position.set(x + s * .06, y + .2, z); d.updateMatrix(); this.legs.setMatrixAt(i * 2 + side, d.matrix); d.rotation.set(0, 0, s * -2.6); d.position.set(x + s * .17, y + .78, z); d.updateMatrix(); this.arms.setMatrixAt(i * 2 + side, d.matrix); }
    });
    this.bodies.count = this.heads.count = n; this.legs.count = this.arms.count = n * 2; for (const m of [this.bodies, this.heads, this.legs, this.arms]) m.instanceMatrix.needsUpdate = true;
  }
}

/** Runners flung off by blades and fights. */
class Debris {
  mesh: T.InstancedMesh; private parts: { p: T.Vector3; v: T.Vector3; spin: number; age: number; color: T.Color }[] = []; private dummy = new T.Object3D();
  constructor(parent: T.Object3D) {
    this.mesh = new T.InstancedMesh(new T.CapsuleGeometry(.09, .3, 2, 6), new T.MeshStandardMaterial({ roughness: .5 }), 160); this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; parent.add(this.mesh);
  }
  burst(x: number, z: number, n: number, color: string) {
    for (let i = 0; i < n; i++) this.parts.push({ p: new T.Vector3(x + Math.sin(i * 2.3) * .5, .5, z + Math.cos(i * 1.7) * .4), v: new T.Vector3(Math.sin(i * 2.9 + x) * 3, 3 + (i % 4), Math.cos(i * 1.3) * 2), spin: (i % 5 - 2) * 5, age: 0, color: new T.Color(color) });
    this.parts = this.parts.slice(-160);
  }
  update(dt: number) {
    for (const p of this.parts) { p.age += dt; p.v.y -= 16 * dt; p.p.addScaledVector(p.v, dt); }
    this.parts = this.parts.filter(p => p.age < 1.4); this.mesh.count = this.parts.length;
    this.parts.forEach((p, i) => { this.dummy.position.copy(p.p); this.dummy.rotation.set(p.age * p.spin, 0, p.age * p.spin * .7); this.dummy.scale.setScalar(Math.max(0, 1 - p.age / 1.4)); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, p.color); });
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class TeamView extends World<TeamRun> {
  private world = new T.Group(); private crew: Crowd; private count: Label; private shield: T.Mesh; private debris: Debris; private y = 0;
  private gates: { gate: TeamGate; root: T.Group; panes: T.MeshStandardMaterial[]; labels: Label[]; previews: Label[] }[] = [];
  private enemies: { enemy: TeamEnemy; crowd: Crowd; count: Label }[] = [];
  private hazards: { hazard: TeamHazard; root: T.Group; spinner?: T.Object3D; arm?: T.Object3D }[] = [];
  private stairCrowd: Crowd | null = null; private stairKey = -1;
  constructor(canvas: HTMLCanvasElement, run: TeamRun) {
    super(canvas, run, '#cdeaf8'); this.scene.fog = new T.Fog('#cdeaf8', 40, 130); this.scene.add(this.world);
    this.crew = new Crowd(this.scene, BLUE); this.count = label('1', '#ffffff', '#2f6bffee', 320, 160); this.scene.add(this.count.sprite);
    this.shield = mesh(new T.SphereGeometry(1, 24, 14), new T.MeshBasicMaterial({ color: '#81f5e9', transparent: true, opacity: .18, depthWrite: false }), this.scene, 0, 1, 0, false);
    this.debris = new Debris(this.scene);
  }
  private shot: string | null = null; private shotKey = '';
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    super.render(dt, held, reduced, cues);
    // Freeze the final frame for the result polaroid while it is still in the drawing buffer.
    const run = this.run, key = `${run.revision}|${run.phase}|${run.lives}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/jpeg', .84); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }
  protected rebuild(): void {
    this.scene.remove(this.world); this.disposeStage(this.world); this.world = new T.Group(); this.scene.add(this.world);
    this.gates = []; this.enemies = []; this.hazards = []; this.stairCrowd = null; this.stairKey = -1;
    const s = this.shapes, run = this.run, goal = run.goal, length = goal + 12;
    // A white runway floating over an icy canyon.
    s.cube(this.world, material('#f6f9fd', .55), 0, -.5, -length / 2 + 6, HALF_WIDTH * 2 + .2, 1, length, false);
    for (const side of [-1, 1]) s.cube(this.world, material('#5fb3ee', .4), side * (HALF_WIDTH + .16), -.38, -length / 2 + 6, .14, 1.04, length, false);
    s.cube(this.world, material('#d4e6f5', .8), 0, -1.6, -length / 2 + 6, HALF_WIDTH * 2 - .6, 1.2, length, false);
    s.cube(this.world, material('#6fd3ff', .4), 0, .005, 4, HALF_WIDTH * 2, .02, 3, false);
    mesh(new T.PlaneGeometry(400, 600), new T.MeshStandardMaterial({ color: '#4aaee6', roughness: .25, metalness: .1 }), this.world, 0, -9, -length / 2, false).rotation.x = -Math.PI / 2;
    const ice = ['#8fd0f5', '#5fb4ea', '#b8e4fa', '#4a9fd8'].map(c => new T.MeshStandardMaterial({ color: c, roughness: .35, flatShading: true }));
    for (let i = 0; i < 90; i++) {
      // Ice cliffs drop away below the runway and rise further out.
      const side = i % 2 ? -1 : 1, out = 8 + (i * 13 % 15), r = 2.2 + (i * 7 % 4), z = 10 - i * (length + 40) / 90;
      const rock = mesh(new T.DodecahedronGeometry(r, 0), ice[i % 4], this.world, side * out, -7.5 - r * .5 + (out - 8) * .3, z, false);
      rock.scale.set(1, 1.4, 1.2); rock.rotation.set(i, i * 2, 0);
    }
    batchScenery(this.world);
    for (const gate of run.gates) {
      const root = new T.Group(); root.position.z = -gate.at; this.world.add(root); const panes: T.MeshStandardMaterial[] = [], labels: Label[] = [], previews: Label[] = [];
      gate.options.forEach((option, side) => {
        const x = side ? HALF_WIDTH / 2 : -HALF_WIDTH / 2;
        if (!option) { panes.push(new T.MeshStandardMaterial()); labels.push(label('')); previews.push(label('')); return; }
        const good = isPositive(option), tint = good ? '#38a3ff' : '#ff4545';
        const pane = new T.MeshStandardMaterial({ color: tint, transparent: true, opacity: .5, roughness: .2, emissive: tint, emissiveIntensity: .25, side: T.DoubleSide, depthWrite: false }); panes.push(pane);
        s.cube(root, pane, x, 1.25, 0, HALF_WIDTH - .2, 2.5, .08, false);
        for (const edge of [-1, 1]) { s.tube(root, material('#ffffff', .3), x + edge * (HALF_WIDTH / 2 - .08), 1.35, 0, .09, 2.7); s.ball(root, material(tint, .3), x + edge * (HALF_WIDTH / 2 - .08), 2.75, 0, .14); }
        const text = label(`${option.op}${option.value}`, '#ffffff', '#00000000', 512, 200); text.sprite.position.set(x, 1.35, .1); text.sprite.scale.set(3.2, 1.25, 1); root.add(text.sprite); labels.push(text);
        const preview = label('', '#ffffff', '#15324ccc', 320, 120); preview.sprite.position.set(x, 3.35, 0); preview.sprite.scale.set(1.9, .72, 1); root.add(preview.sprite); previews.push(preview);
      });
      this.gates.push({ gate, root, panes, labels, previews });
    }
    for (const enemy of run.enemies) {
      const crowd = new Crowd(this.world, RED, Math.min(VISIBLE, enemy.count)); crowd.root.rotation.y = Math.PI;
      const count = label(String(enemy.count), '#ffffff', '#e5302fee', 320, 160); this.world.add(count.sprite); this.enemies.push({ enemy, crowd, count });
      if (enemy.boss) { // A red fortress gate behind the last army.
        const fort = new T.Group(); fort.position.z = -enemy.at - 5; this.world.add(fort); const red = material('#e04848', .5), dark = material('#a72f39', .5);
        for (const x of [-3.2, 3.2]) { s.cube(fort, red, x, 1.6, 0, 1.2, 3.2, 1.2); s.cube(fort, dark, x, 3.4, 0, 1.5, .4, 1.5); }
        s.cube(fort, red, 0, 3.1, 0, 5.2, .7, .9);
      }
    }
    const steel = material('#d7dfe8', .25, .8), hub = material('#ff4d4d', .4), stripe = material('#ffffff', .5), redRoller = material('#ff4747', .45);
    for (const hazard of run.hazards) {
      const root = new T.Group(); root.position.z = -hazard.at; this.world.add(root); const entry: (typeof this.hazards)[number] = { hazard, root };
      if (hazard.kind === 'saw') {
        s.cube(root, material('#33415a', .6), 0, .012, 0, HALF_WIDTH * 2, .02, .28, false);
        const spinner = new T.Group(); root.add(spinner); const disc = mesh(new T.CylinderGeometry(.85, .85, .1, 32), steel, spinner); disc.rotation.x = Math.PI / 2;
        mesh(new T.CylinderGeometry(.24, .24, .14, 16), hub, spinner).rotation.x = Math.PI / 2;
        for (let i = 0; i < 16; i++) { const tooth = mesh(new T.ConeGeometry(.1, .24, 4), steel, spinner, Math.cos(i * Math.PI / 8) * .92, Math.sin(i * Math.PI / 8) * .92, 0); tooth.rotation.z = i * Math.PI / 8 - Math.PI / 2; }
        spinner.position.y = .45; entry.spinner = spinner;
      } else if (hazard.kind === 'axe') {
        for (const x of [-1, 1]) s.cube(root, material('#41506b', .5), x * (HALF_WIDTH + .3), 2.5, 0, .3, 5, .3);
        s.cube(root, material('#41506b', .5), 0, 4.9, 0, HALF_WIDTH * 2 + .9, .3, .3);
        const arm = new T.Group(); arm.position.y = 4.8; root.add(arm); s.cube(arm, material('#6b7a94', .4, .5), 0, -1.9, 0, .1, 3.8, .1);
        const blade = mesh(new T.CylinderGeometry(.75, .75, .08, 24, 1, false, 0, Math.PI), steel, arm, 0, -3.95, 0); blade.rotation.set(Math.PI / 2, 0, Math.PI);
        entry.arm = arm;
      } else {
        const spans = hazardSpans(hazard, 0).map(([a, b]) => [Math.max(-HALF_WIDTH, a), Math.min(HALF_WIDTH, b)]).filter(([a, b]) => b - a > .1), spinner = new T.Group(); root.add(spinner); spinner.position.y = .5;
        for (const [a, b] of spans) {
          const w = b - a, roll = mesh(new T.CylinderGeometry(.42, .42, w, 20), redRoller, spinner, (a + b) / 2, 0, 0); roll.rotation.z = Math.PI / 2;
          for (let i = 0; i < Math.floor(w / .45); i++) for (let j = 0; j < 6; j++) { const spike = mesh(s.cone, stripe, spinner, a + .25 + i * .45, Math.cos(j * Math.PI / 3) * .48, Math.sin(j * Math.PI / 3) * .48, false); spike.scale.set(.09, .2, .09); spike.rotation.x = j * Math.PI / 3 - Math.PI / 2; }
          for (const end of [a, b]) s.cube(root, material('#41506b', .5), end, .5, 0, .14, 1, .9);
        }
        entry.spinner = spinner;
      }
      this.hazards.push(entry);
    }
    // Victory stairs: each step a multiplier, coloured like a rainbow.
    for (let i = 1; i <= STEPS; i++) {
      const z = -(goal + (i - .5) * STEP_LENGTH), h = i * STEP_HEIGHT;
      s.cube(this.world, material(STEP_COLORS[i - 1], .45), 0, h / 2 - .02, z, HALF_WIDTH * 2, h, STEP_LENGTH, false);
      const tag = label(`×${i}`, '#ffffff', '#00000000', 256, 128); tag.sprite.position.set(0, h - STEP_HEIGHT / 2, z + STEP_LENGTH / 2 + .05); tag.sprite.scale.set(1.3, .65, 1); this.world.add(tag.sprite);
    }
    const top = STEPS * STEP_HEIGHT, chest = new T.Group(); chest.position.set(0, top, -(goal + STEPS * STEP_LENGTH + 1.4)); this.world.add(chest);
    s.cube(chest, material('#f6f9fd', .5), 0, -top / 2, 0, HALF_WIDTH * 2, top, 3, false); s.cube(chest, material('#c98a2c', .5), 0, .45, 0, 1.6, .9, 1); s.cube(chest, material('#ffd34d', .3, .6), 0, .95, 0, 1.7, .25, 1.05);
  }
  protected update(dt: number, reduced: boolean): void {
    const run = this.run, time = reduced ? 0 : run.elapsed, running = run.phase === 'playing' && run.state !== 'clash' && !reduced, style = run.config.characterStyle;
    const stepAt = run.state === 'finale' ? Math.min(run.climbed, Math.floor((run.distance - run.goal) / STEP_LENGTH) + 1) : 0;
    this.y += (stepAt * STEP_HEIGHT - this.y) * Math.min(1, dt * 10);
    const z = -run.distance; this.crew.root.position.set(run.x, this.y, z);
    this.crew.update(run.team, run.spread, time, reduced ? 1 : dt, running || run.state === 'clash' && !reduced, style);
    this.count.set(run.team.toLocaleString()); this.count.sprite.position.set(run.x, this.y + 1.75 + run.radius * .35, z); this.count.sprite.scale.set(1.5, .75, 1);
    this.origin.set(run.x, this.y + .8, z);
    this.shield.visible = run.shield > 0; this.shield.position.set(run.x, this.y + .6, z); this.shield.scale.setScalar(run.radius + .7);
    for (const entry of this.gates) {
      const near = entry.gate.at - run.distance; entry.root.visible = near > -6 && near < 70; if (!entry.root.visible) continue;
      const values = run.preview(entry.gate);
      entry.panes.forEach((pane, side) => { pane.opacity = entry.gate.used ? .12 : .5; entry.labels[side].sprite.visible = !entry.gate.used; });
      entry.previews.forEach((preview, side) => { preview.sprite.visible = run.config.assist && !entry.gate.used && !!entry.gate.options[side]; preview.set(`= ${values[side]}`, '#ffffff', values[side] >= values[1 - side] ? '#1f9d63ee' : '#9d3b3bee'); });
    }
    for (const entry of this.enemies) {
      const e = entry.enemy, near = e.at - run.distance, visible = !e.defeated && near < 75; entry.crowd.root.visible = entry.count.sprite.visible = visible; if (!visible) continue;
      const charge = Math.max(0, Math.min(1, (10 - near) / 8)), ez = -(e.at - charge * 1.2);
      entry.crowd.root.position.set(run.state === 'clash' && run.clash === e ? run.x * .6 : 0, 0, ez);
      entry.crowd.update(e.left, SPREAD, time, reduced ? 1 : dt, charge > 0 && !reduced, style);
      entry.count.set(e.left.toLocaleString()); entry.count.sprite.position.set(entry.crowd.root.position.x, 1.75 + Math.sqrt(Math.min(VISIBLE, e.left)) * SPREAD * .35, ez); entry.count.sprite.scale.set(1.5, .75, 1);
    }
    for (const entry of this.hazards) {
      const h = entry.hazard, near = h.at - run.distance; entry.root.visible = near > -8 && near < 70; if (!entry.root.visible) continue;
      if (h.kind === 'saw' && entry.spinner) { const [[a, b]] = run.hazardSpans(h); entry.spinner.position.x = (a + b) / 2; entry.spinner.rotation.z = -time * 9; }
      else if (h.kind === 'axe' && entry.arm) { const [[a, b]] = run.hazardSpans(h); entry.arm.rotation.z = Math.asin(Math.max(-1, Math.min(1, (a + b) / 2 / 3.95))); }
      else if (entry.spinner) entry.spinner.rotation.x = -time * 5;
    }
    // Runners who stayed behind on each stair.
    if (this.stairKey !== run.climbed + run.revision * 100) {
      this.stairKey = run.climbed + run.revision * 100; const per = Math.min(9, run.course.stepCost), total = per * run.climbed;
      if (total && !this.stairCrowd) { this.stairCrowd = new Crowd(this.world, BLUE, per * STEPS); }
      if (this.stairCrowd) {
        const spots: { x: number; y: number; z: number }[] = [];
        for (let step = 1; step <= run.climbed; step++) for (let k = 0; k < per; k++) spots.push({ x: (k - (per - 1) / 2) * .62, y: step * STEP_HEIGHT, z: -(run.goal + (step - .5) * STEP_LENGTH) });
        this.stairCrowd.cheer(spots, style);
      }
    }
    for (const b of run.bursts.splice(0)) if (!reduced) this.debris.burst(b.x, -b.z, b.n, b.team === 'blue' ? BLUE : RED);
    this.debris.update(dt);
    const finale = run.state === 'finale' ? 1 : 0;
    this.camera.position.set(run.x * .35, 8.6 + this.y + finale * 1.5, z + 9.5 + finale * 2); this.camera.lookAt(run.x * .5, this.y + .2, z - 7); this.followLight(run.x, z);
  }
}
