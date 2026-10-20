import * as T from 'three';
import type { ArcadeCue } from '../premium-kit/core';
import { RunnerRun, runnerFrame, LANE, type RunnerObstacle, type RunnerPickup } from './runner';
import { World, instances, material, mesh, label, batchScenery } from './world';
import { heroModel, chaserModel, pickupModel, haloTexture, runnerTextures, type Hero, type Chaser } from './runner-models';
import { WorldWeather } from './weather';
import { applyLook, weatherLight } from './looks';
import { subwayWorld, templeWorld, type SubwayWorld, type TempleWorld } from './runner-worlds';

type Transform = { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number };
export class RunnerView extends World<RunnerRun> {
  private course = new T.Group(); private hero: Hero; private chaser: Chaser; private cameraYaw = 0; private camPos = new T.Vector3(); private camReady = false;
  private hazards: { model: T.Group; obstacle: RunnerObstacle; flames: T.Mesh[] }[] = []; private pickups: { model: T.Group; pickup: RunnerPickup }[] = [];
  private turnSigns: { model: T.Object3D; at: number }[] = []; private torches: T.Mesh[] = [];
  private coins: T.InstancedMesh | null = null; private coinCount = 0; private dummy = new T.Object3D();
  private halo = haloTexture(); private tex = runnerTextures(false); private mood = ''; private sky: T.CanvasTexture | null = null;
  private shot: string | null = null; private shotKey = ''; private weather: WorldWeather; private worldKey = ''; private moons: T.Mesh[] = [];
  constructor(canvas: HTMLCanvasElement, run: RunnerRun) {
    super(canvas, run, run.theme === 'temple' ? '#a8ccb7' : '#cfe9f7');
    this.hero = heroModel(this.shapes, this.paint, run.theme === 'subway'); this.chaser = chaserModel(this.shapes, run.theme === 'subway');
    this.scene.add(this.hero.root, this.chaser.root, this.course); this.remix.character(this.hero.figure); this.remix.ownWorld(true); this.weather = new WorldWeather(this.scene);
    (this.camera as T.PerspectiveCamera).far = 260; this.camera.updateProjectionMatrix(); this.floaterScale = .5;
  }
  private frame(distance: number, lateral = 0) { const p = runnerFrame(distance, this.run.theme, this.run.level); return { x: p.x + Math.cos(p.yaw) * lateral, z: p.z - Math.sin(p.yaw) * lateral, yaw: p.yaw }; }
  private place(root: T.Object3D, distance: number, lateral = 0, height = 0) { const p = this.frame(distance, lateral); root.position.set(p.x, height, p.z); root.rotation.y = p.yaw; }
  private get subway(): SubwayWorld { return subwayWorld(this.run.config.worldTheme); }
  private get temple(): TempleWorld { return templeWorld(this.run.config.worldTheme); }
  /** Sky, fog and light for the world and the stage mood. */
  private setMood() {
    const run = this.run, mood = run.mood, world = run.theme === 'temple' ? this.temple : this.subway, key = `${run.theme}|${mood}|${run.config.worldTheme}`; if (key === this.mood) return; this.mood = key;
    this.sky?.dispose(); this.sky = applyLook(this.scene, this.sun, world.look[mood], this.weather);
    this.tex.dispose(); this.tex = runnerTextures(mood === 'night' || (run.theme === 'subway' && this.subway.glowWindows));
  }
  protected rebuild(): void {
    this.setMood(); this.worldKey = this.run.config.worldTheme ?? 'classic';
    this.scene.remove(this.course); this.disposeStage(this.course); this.course = new T.Group(); this.scene.add(this.course);
    this.hazards = []; this.pickups = []; this.turnSigns = []; this.torches = []; this.moons = []; this.coins = null; this.cameraYaw = 0; this.camReady = false;
    if (this.run.theme === 'subway') this.buildSubway(); else this.buildTemple();
    for (const o of this.run.obstacles) this.buildObstacle(o);
    batchScenery(this.course);
    for (const p of this.run.pickups) { const model = pickupModel(this.shapes, p.kind, this.halo); this.place(model, p.at, p.lane * LANE); this.course.add(model); this.pickups.push({ model, pickup: p }); }
    this.buildCoins();
  }
  private buildCoins() {
    this.coinCount = this.run.tokens.length; const gold = material('#ffcf3a', .25, .75); gold.emissive.set('#a8661a'); gold.emissiveIntensity = .35;
    const geometry = new T.CylinderGeometry(.3, .3, .08, 20); geometry.rotateX(Math.PI / 2);
    this.coins = new T.InstancedMesh(geometry, gold, this.coinCount + 4); this.coins.instanceMatrix.setUsage(T.DynamicDrawUsage); this.coins.frustumCulled = false; this.coins.castShadow = true; this.coins.userData.dynamic = true; this.course.add(this.coins);
  }
  private buildSubway() {
    const run = this.run, s = this.shapes, end = run.goal + 70, start = -30, length = end - start, mid = -(start + end) / 2, night = run.mood === 'night';
    const ballast: Transform[] = [], ties: Transform[] = [], rails: Transform[] = [];
    for (let at = start; at < end; at += 2) for (let lane = -1; lane <= 1; lane++) {
      const x = lane * LANE; ballast.push({ x, y: -.12, z: -at, sx: 1.9, sy: .2, sz: 2.02, yaw: 0 }); ties.push({ x, y: .03, z: -at, sx: 1.6, sy: .1, sz: .26, yaw: 0 });
      for (const side of [-1, 1]) rails.push({ x: x + side * .5, y: .13, z: -at, sx: .07, sy: .12, sz: 2.02, yaw: 0 });
    }
    const w = this.subway, gravel = material(w.ballast, .95); gravel.map = this.tex.ballast; this.tex.ballast.repeat.set(2, 2);
    instances(s.block, gravel, ballast, this.course); instances(s.block, material(w.ties, .9), ties, this.course); instances(s.block, material('#c9d3dc', .25, .85), rails, this.course);
    s.cube(this.course, material('#5c524a', .95), 0, -.3, mid, 7.2, .3, length, false);
    this.subwaySides(start, end, length, mid, night);
    // Overhead line gantries, a footbridge now and then, and stations at both ends.
    const steel = material('#59626e', .5, .6), wire = material('#2a2e35', .6);
    for (let at = 10; at < end; at += 24) { for (const side of [-1, 1]) s.cube(this.course, steel, side * 4.9, 3.2, -at, .25, 6.4, .25, false); s.cube(this.course, steel, 0, 6.3, -at, 10, .22, .22, false); }
    for (let lane = -1; lane <= 1; lane++) s.cube(this.course, wire, lane * LANE, 5.7, mid, .04, .04, length, false);
    for (let at = 140; at < end - 40; at += 160) {
      const bridge = new T.Group(); bridge.position.set(0, 0, -at); this.course.add(bridge); const deck = material('#d0c6b8', .8), rail = material('#e2574c', .5);
      s.cube(bridge, deck, 0, 7.4, 0, 26, .6, 4, false); for (const side of [-1, 1]) { s.cube(bridge, deck, side * 7.2, 3.6, 0, 1, 7.6, 1.2, false); s.cube(bridge, rail, 0, 8.1, side * 1.9, 26, .5, .12, false); }
    }
    for (const [at, text] of [[-6, 'MODBOX METRO'], [run.goal + 4, 'STATION']] as const) {
      const station = new T.Group(); station.position.set(0, 0, -at); this.course.add(station); const roof = material('#2f3a4f', .6, .3);
      for (const side of [-1, 1]) { s.cube(station, material('#d9d2c6', .8), side * 4.25, .55, 0, 1.3, .3, 16, false); for (const z of [-6, 0, 6]) s.cube(station, steel, side * 4.6, 2.6, z, .2, 4.4, .2, false); }
      s.cube(station, roof, 0, 4.9, 0, 10.4, .3, 16, false); const sign = label(text, '#ffffff', '#2f6fd6ee'); sign.sprite.scale.set(5, 1.56, 1); sign.sprite.position.set(0, 4.1, 7.9); station.add(sign.sprite);
    }
  }
  /** Walkways, walls and the world beyond the tracks, built for the chosen subway world. */
  private subwaySides(start: number, end: number, length: number, mid: number, night: boolean) {
    const s = this.shapes, w = this.subway, c = this.course;
    const concrete = material(w.walls === 'ice' ? '#e8f4fc' : w.walls === 'rock' ? '#8a4a30' : w.walls === 'fence' ? '#efe2c0' : '#b9b4ac', .9);
    for (const side of [-1, 1]) s.cube(c, concrete, side * 4.25, .15, mid, 1.2, .6, length, false);
    if (w.walls === 'graffiti' || w.walls === 'neon') {
      const wall = material(w.wall, .85); if (w.walls === 'graffiti') { const graffiti = this.tex.graffiti.clone(); graffiti.needsUpdate = true; graffiti.repeat.set(length / 14, 1); wall.map = graffiti; }
      for (const side of [-1, 1]) { s.cube(c, wall, side * 5.2, 1.4, mid, .5, 3.4, length, false); s.cube(c, material(w.trim, .9), side * 5.2, 3.16, mid, .7, .14, length, false); }
      if (w.walls === 'neon') for (const [y, color] of [[2.5, '#ff4fd8'], [.9, '#38e8ff']] as const) for (const side of [-1, 1]) { const strip = mesh(s.block, new T.MeshBasicMaterial({ color, toneMapped: false }), c, side * 4.93, y, mid, false); strip.scale.set(.04, .07, length); }
    } else if (w.walls === 'fence') {
      const posts: Transform[] = [], rails: Transform[] = [];
      for (let at = start; at < end; at += 2.5) for (const side of [-1, 1]) posts.push({ x: side * 4.85, y: .6, z: -at, sx: .1, sy: 1.2, sz: .1, yaw: 0 });
      instances(s.block, material('#ffffff', .6), posts, c); for (const side of [-1, 1]) for (const y of [.75, 1.15]) rails.push({ x: side * 4.85, y, z: mid, sx: .06, sy: .06, sz: length, yaw: 0 }); instances(s.block, material(w.trim, .5), rails, c);
    } else if (w.walls === 'ice') {
      const ice = new T.MeshStandardMaterial({ color: w.wall, roughness: .08, metalness: .1, transparent: true, opacity: .78 });
      for (const side of [-1, 1]) s.cube(c, ice, side * 5.2, 1.2, mid, .6, 2.6, length, false);
      const icicles: Transform[] = []; for (let at = start; at < end; at += 1.3) for (const side of [-1, 1]) icicles.push({ x: side * 4.88, y: 2.2, z: -at, sx: .12, sy: .5 + (Math.abs(at * 7) % 5) * .1, sz: .12, yaw: 0 });
      instances(new T.ConeGeometry(1, 1, 5).rotateX(Math.PI), material('#e8f8ff', .1), icicles, c);
    } else {
      const rocks: Transform[] = []; for (let at = start; at < end; at += 2.2) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) rocks.push({ x: side * (5.4 + k * .4), y: .6 + k * 1.3, z: -at - k * .7, sx: 1.4 - k * .2, sy: 1.3, sz: 1.5, yaw: at + k });
      instances(new T.DodecahedronGeometry(1, 0), material(w.wall, .95), rocks, c);
    }
    const ground = (color: string, x: number) => s.cube(c, material(color, .95), x, -.32, mid, 40, .3, length + 40, false);
    if (w.skyline === 'city' || w.skyline === 'tokyo') {
      const classes = w.buildings.map((color, i) => {
        const m = material(color, .8); const facade = this.tex.facade.clone(); facade.needsUpdate = true; facade.repeat.set(2 + i % 2, 3 + i % 3); m.map = facade;
        if (night || w.glowWindows) { m.emissiveMap = facade; m.emissive.set(w.skyline === 'tokyo' ? '#ffd0f4' : '#ffffff'); m.emissiveIntensity = .55; } return { m, w: 7 + i % 2 * 3, h: (w.skyline === 'tokyo' ? 16 : 10) + (i % 3) * 7 };
      });
      const neon = ['#ff4fd8', '#38e8ff', '#ffd23f', '#7dff9a'];
      for (let at = start; at < end; at += 9) for (const side of [-1, 1]) {
        const k = classes[Math.abs(Math.floor(at / 9) * 7 + side * 3) % classes.length], x = side * (9.5 + (Math.abs(at) % 3)); s.cube(c, k.m, x, k.h / 2 - .3, -at, k.w, k.h, 8.6, false);
        if (w.skyline === 'tokyo') { const sign = mesh(s.block, new T.MeshBasicMaterial({ color: neon[Math.abs(Math.floor(at)) % 4], toneMapped: false }), c, x - side * (k.w / 2 + .1), 4 + Math.abs(at) % 5, -at + 2, false); sign.scale.set(.15, 3 + Math.abs(at) % 3, 1); }
        else if (Math.abs(at) % 27 < 9) s.cube(c, material('#7b8794', .6, .4), x, k.h + .6, -at, 1.6, 1.2, 1.6, false);
      }
      if (w.skyline === 'tokyo') {
        // Cherry blossoms along the walkways and paper lanterns strung over the tracks.
        const trunks: Transform[] = [], blossoms: Transform[] = [], lanterns: Transform[] = [];
        for (let at = start + 4; at < end; at += 11) for (const side of [-1, 1]) { trunks.push({ x: side * 6.6, y: 1.4, z: -at, sx: .16, sy: 2.8, sz: .16, yaw: 0 }); for (let k = 0; k < 3; k++) blossoms.push({ x: side * 6.6 + (k - 1) * .6, y: 3.1 + (k % 2) * .4, z: -at + (k - 1) * .4, sx: 1, sy: .8, sz: 1, yaw: 0 }); }
        for (let at = start + 10; at < end; at += 24) for (let i = 0; i < 7; i++) lanterns.push({ x: -3.6 + i * 1.2, y: 5.5 - Math.sin(i / 6 * Math.PI) * .5, z: -at, sx: .22, sy: .3, sz: .22, yaw: 0 });
        instances(s.cylinder, material('#5a3a3a', .9), trunks, c); instances(new T.IcosahedronGeometry(1, 1), material('#ffb7d5', .8), blossoms, c); instances(new T.SphereGeometry(1, 10, 8), new T.MeshBasicMaterial({ color: '#ff5a4a', toneMapped: false }), lanterns, c);
      }
    } else if (w.skyline === 'beach') {
      const sea = new T.Mesh(new T.PlaneGeometry(120, length + 60), new T.MeshStandardMaterial({ color: '#1fb3d6', roughness: .15, metalness: .3 })); sea.rotation.x = -Math.PI / 2; sea.position.set(-66, -.4, mid); c.add(sea);
      const sand = ground('#f2dfae', 24); sand.receiveShadow = true; s.cube(c, material('#f2dfae', .95), -9, -.35, mid, 9, .3, length + 40, false);
      const trunks: Transform[] = [], fronds: Transform[] = [], houses: Transform[] = [];
      for (let at = start; at < end; at += 7) { const side = Math.floor(at / 7) % 2 ? 1 : -1, x = side * (7.5 + Math.abs(at) % 3); trunks.push({ x, y: 2.2, z: -at, sx: .2, sy: 4.4, sz: .2, yaw: 0 }); for (let k = 0; k < 6; k++) fronds.push({ x: x + Math.cos(k * 1.05) * .9, y: 4.4, z: -at + Math.sin(k * 1.05) * .9, sx: .9, sy: .08, sz: .3, yaw: -k * 1.05 }); }
      for (let at = start; at < end; at += 10) houses.push({ x: 14 + Math.abs(at) % 4, y: 1.8, z: -at, sx: 5, sy: 3.6, sz: 6, yaw: 0 });
      instances(s.cylinder, material('#9a7a52', .9), trunks, c); instances(s.block, material('#3aa860', .8), fronds, c);
      w.buildings.forEach((color, i) => instances(s.block, material(color, .85), houses.filter((_, k) => k % w.buildings.length === i), c));
    } else if (w.skyline === 'arctic') {
      for (const side of [-1, 1]) ground('#f4f8fc', side * 25);
      const pines: Transform[] = [], caps: Transform[] = [], peaks: Transform[] = [];
      for (let at = start; at < end; at += 5) for (const side of [-1, 1]) { const x = side * (8 + Math.abs(at * 3) % 7); pines.push({ x, y: 1.8, z: -at, sx: 1.4, sy: 3.6, sz: 1.4, yaw: 0 }); caps.push({ x, y: 3.3, z: -at, sx: .7, sy: 1, sz: .7, yaw: 0 }); }
      for (let at = start; at < end; at += 30) for (const side of [-1, 1]) peaks.push({ x: side * (40 + Math.abs(at) % 20), y: 8, z: -at, sx: 18, sy: 22, sz: 18, yaw: at });
      instances(new T.ConeGeometry(1, 1, 7), material('#2f6b55', .85), pines, c); instances(new T.ConeGeometry(1, 1, 7), material('#ffffff', .7), caps, c); instances(new T.ConeGeometry(1, 1, 6), material('#e8f2fa', .6), peaks, c);
    } else {
      for (const side of [-1, 1]) ground('#c2683f', side * 25);
      const domes: Transform[] = [], rocks: Transform[] = [];
      for (let at = start; at < end; at += 16) for (const side of [-1, 1]) domes.push({ x: side * (12 + Math.abs(at) % 6), y: 0, z: -at, sx: 4, sy: 4, sz: 4, yaw: 0 });
      for (let at = start; at < end; at += 4) for (const side of [-1, 1]) rocks.push({ x: side * (8 + Math.abs(at * 5) % 14), y: .2, z: -at, sx: .7 + Math.abs(at) % 3 * .4, sy: .6, sz: .9, yaw: at });
      instances(new T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: '#cfe8ff', roughness: .05, metalness: .2, transparent: true, opacity: .55 }), domes, c);
      instances(new T.DodecahedronGeometry(1, 0), material('#8a3a24', .95), rocks, c);
      const moons = new T.MeshBasicMaterial({ color: '#f1d6c0', fog: false }); for (const [x, y, r] of [[-60, 55, 6], [40, 70, 3.5]]) { const moon = mesh(new T.SphereGeometry(r, 16, 12), moons, c, x, y, -this.run.distance - 160, false); this.moons.push(moon); }
    }
  }
  private buildTemple() {
    const run = this.run, s = this.shapes, night = run.mood === 'night', tiles: Transform[] = [], curbs: Transform[] = [], walls: Transform[] = [], piers: Transform[] = [];
    const pit = (lane: number, at: number) => run.obstacles.some(o => o.kind === 'gap' && o.lane === lane && at >= o.at - 1 && at <= o.at + o.length);
    for (let at = -20; at < run.goal + 40; at += 2) {
      const f = this.frame(at);
      for (let lane = -1; lane <= 1; lane++) { if (pit(lane, at)) continue; const p = this.frame(at, lane * LANE); tiles.push({ x: p.x, y: -.18, z: p.z, sx: 2.17, sy: .34, sz: 2.03, yaw: f.yaw }); }
      for (const side of [-1, 1]) { const p = this.frame(at, side * 3.7); curbs.push({ x: p.x, y: .05, z: p.z, sx: .55, sy: .7, sz: 2.04, yaw: f.yaw }); }
      walls.push({ x: f.x, y: -1, z: f.z, sx: 8, sy: 1.6, sz: 2.04, yaw: f.yaw });
      // Tall piers every few metres hold the causeway up over the abyss.
      if (Math.round(at) % 10 === 0) for (const side of [-1, 1]) { const q = this.frame(at, side * 2.6); piers.push({ x: q.x, y: -16, z: q.z, sx: 1.8, sy: 30, sz: 1.8, yaw: f.yaw }); }
    }
    // Corners get a square landing so the causeway turns cleanly.
    for (const t of run.turns) { const f = this.frame(t.at); tiles.push({ x: f.x, y: -.18, z: f.z, sx: 7.4, sy: .34, sz: 7.4, yaw: f.yaw }); walls.push({ x: f.x, y: -1, z: f.z, sx: 8, sy: 1.6, sz: 8, yaw: f.yaw }); piers.push({ x: f.x, y: -16, z: f.z, sx: 3, sy: 30, sz: 3, yaw: f.yaw }); }
    const w = this.temple, floor = material(w.floor, .85); floor.map = this.tex.stone; const curb = material(w.curb, .85); curb.map = this.tex.stone;
    const wallGeometry = new T.BoxGeometry(1, 1, 1), uv = wallGeometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 14);
    const wallMat = material(new T.Color(w.wall).multiplyScalar(night ? .65 : 1).getHexString().replace(/^/, '#'), .95); wallMat.map = this.tex.wall;
    instances(s.block, floor, tiles, this.course); instances(s.block, curb, curbs, this.course, true); instances(s.block, wallMat, walls, this.course); instances(wallGeometry, wallMat, piers, this.course);
    this.templeAbyss(night);
    // Pillars with fire bowls, vines over the edge, and stepped temples on the horizon.
    const stone = material(w.pillar, .85), flame = new T.MeshBasicMaterial({ color: w.flame });
    for (let at = 6; at < run.goal + 20; at += 18) {
      if (run.turns.some(t => Math.abs(t.at - at) < 6)) continue;
      for (const side of [-1, 1]) {
        const p = this.frame(at, side * 4.3), pillar = new T.Group(); pillar.position.set(p.x, 0, p.z); pillar.rotation.y = p.yaw; this.course.add(pillar);
        s.cube(pillar, stone, 0, 1.4, 0, .7, 2.8, .7); s.cube(pillar, material(w.cap, .8), 0, 2.9, 0, .95, .25, .95); s.tube(pillar, material('#5a4636', .7, .3), 0, 3.15, 0, .3, .25);
        const fire = mesh(new T.ConeGeometry(.24, .7, 8), flame, pillar, 0, 3.6, 0, false); fire.userData.dynamic = true; this.torches.push(fire);
        const glow = new T.Sprite(new T.SpriteMaterial({ map: this.halo, color: w.flame, blending: T.AdditiveBlending, transparent: true, depthWrite: false })); glow.scale.setScalar(night ? 3.2 : 1.8); glow.position.y = 3.6; pillar.add(glow);
        if (w.abyss === 'canopy') for (let v = 0; v < 3; v++) { const vine = s.tube(pillar, material('#3f7a3a', .8), (v - 1) * .5, -1.4 - v * .5, side * .1, .05, 3 + v, false); vine.position.x += side * .1; }
      }
    }
    this.templeHorizon(night);
    // Corners: a glowing arrow, an arch and the direction.
    for (const t of run.turns) {
      const f = this.frame(t.at), gate = new T.Group(); gate.position.set(f.x, 0, f.z); gate.rotation.y = f.yaw; this.course.add(gate);
      for (const side of [-1, 1]) s.cube(gate, stone, side * 3.9, 2.4, 3.6, 1, 4.8, 1); s.cube(gate, material(w.cap, .8), 0, 5, 3.6, 8.8, .9, 1.2);
      const sign = label(t.direction > 0 ? 'TURN →' : '← TURN', '#fff2b0', '#7a4a1ccc'); sign.sprite.scale.set(4.6, 1.44, 1); sign.sprite.position.set(0, 6.3, 3.6); gate.add(sign.sprite); this.turnSigns.push({ model: sign.sprite, at: t.at });
      const arrow = new T.Shape([new T.Vector2(-.5, -1.6), new T.Vector2(.5, -1.6), new T.Vector2(.5, .2), new T.Vector2(1.2, .2), new T.Vector2(0, 1.6), new T.Vector2(-1.2, .2), new T.Vector2(-.5, .2)]);
      const glyph = mesh(new T.ShapeGeometry(arrow), new T.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: .85 }), gate, 0, .02, 0, false); glyph.rotation.x = -Math.PI / 2; glyph.rotation.z = -t.direction * Math.PI / 2; glyph.userData.dynamic = true;
    }
    const finish = new T.Group(); this.place(finish, run.goal + 3); this.course.add(finish); const gold = material('#ffcf3a', .25, .8);
    for (const side of [-1, 1]) s.cube(finish, stone, side * 3.6, 3.5, 0, 1.4, 7, 1.6); s.cube(finish, material('#d8c9a4', .8), 0, 7.4, 0, 9, 1.2, 2);
    const idol = s.ball(finish, gold, 0, 9, 0, .7); idol.scale.y = 1.3; const banner = label('TEMPLE REACHED', '#fff2ae', '#5a3a14dd'); banner.sprite.position.set(0, 5.2, .9); banner.sprite.scale.set(5, 1.56, 1); finish.add(banner.sprite);
    const entry = new T.Group(); this.place(entry, 12); this.course.add(entry); for (const side of [-1, 1]) s.cube(entry, stone, side * 3.9, 2.4, 0, 1, 4.8, 1); s.cube(entry, material('#d8c9a4', .8), 0, 5, 0, 8.8, .9, 1.2);
  }
  /** What lies far below the causeway: jungle, dunes, glacier, a lava sea or clouds. */
  private templeAbyss(night: boolean) {
    const run = this.run, w = this.temple, c = this.course, shapes: Transform[] = [];
    for (let at = -30; at < run.goal + 60; at += 7) for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      const p = this.frame(at, side * (14 + k * 14 + (at * 7 % 9))), r = 5 + (at * 3 % 4); shapes.push({ x: p.x, y: -26 + k * 3, z: p.z, sx: r, sy: w.abyss === 'dunes' ? r * .35 : w.abyss === 'glacier' ? r * 1.6 : r * .7, sz: r, yaw: at });
    }
    const color = new T.Color(w.abyssColor).multiplyScalar(night ? .55 : 1);
    if (w.abyss === 'glacier') instances(new T.ConeGeometry(1, 1, 6), material(`#${color.getHexString()}`, .5), shapes.map(t => ({ ...t, y: t.y + 4 })), c);
    else if (w.abyss === 'lava') {
      instances(new T.DodecahedronGeometry(1, 0), material('#2a1a18', .95), shapes.map(t => ({ ...t, sy: t.sy * .5, y: t.y + 2 })), c);
      const centre = this.frame(run.goal / 2), sea = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshBasicMaterial({ color: '#ff5a1c', toneMapped: false })); sea.rotation.x = -Math.PI / 2; sea.position.set(centre.x, -24, centre.z); c.add(sea);
    } else if (w.abyss === 'clouds') instances(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial({ color, roughness: 1, emissive: '#ffffff', emissiveIntensity: night ? .05 : .25 }), shapes, c);
    else instances(new T.SphereGeometry(1, 10, 8), material(`#${color.getHexString()}`, .9), shapes, c);
    for (let i = 0; i < 26; i++) { const p = this.frame(i * (run.goal / 26), (i % 2 ? -1 : 1) * (9 + i % 4 * 4)), mist = new T.Sprite(new T.SpriteMaterial({ map: this.halo, color: night ? new T.Color(w.mist).multiplyScalar(.45) : w.mist, transparent: true, opacity: w.abyss === 'lava' ? .25 : .35, depthWrite: false, ...(w.abyss === 'lava' ? { blending: T.AdditiveBlending } : {}) })); mist.scale.set(26, 9, 1); mist.position.set(p.x, -8 - i % 3 * 4, p.z); c.add(mist); }
  }
  /** Far silhouettes in the haze: stepped temples, pyramids, ice peaks, volcanoes or floating islands. */
  private templeHorizon(night: boolean) {
    const run = this.run, w = this.temple, s = this.shapes, haze = new T.Color(w.look[run.mood].fog[0]).multiplyScalar(night ? .7 : .78), silhouette = new T.MeshBasicMaterial({ color: haze, fog: false }), centre = this.frame(run.goal / 2);
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2 + .3, r = 190 + (i % 3) * 30, g = new T.Group(); g.position.set(centre.x + Math.cos(angle) * r, -30, centre.z + Math.sin(angle) * r); g.scale.setScalar(1.6 + i % 3 * .4); this.course.add(g);
      if (w.horizon === 'temples') { for (let k = 0; k < 6; k++) mesh(s.block, silhouette, g, 0, k * 3, 0, false).scale.set(24 - k * 3.6, 3, 24 - k * 3.6); mesh(s.block, silhouette, g, 0, 19.5, 0, false).scale.set(4, 4, 4); }
      else if (w.horizon === 'pyramids') { const pyramid = mesh(new T.ConeGeometry(18, 26, 4), silhouette, g, 0, 13, 0, false); pyramid.rotation.y = Math.PI / 4; }
      else if (w.horizon === 'peaks') mesh(new T.ConeGeometry(16, 40, 6), silhouette, g, 0, 20, 0, false);
      else if (w.horizon === 'volcanoes') { mesh(new T.CylinderGeometry(5, 18, 28, 8), silhouette, g, 0, 14, 0, false); const glow = new T.Sprite(new T.SpriteMaterial({ map: this.halo, color: '#ff6a24', blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); glow.scale.setScalar(26); glow.position.y = 30; g.add(glow); }
      else { const rock = mesh(new T.ConeGeometry(12, 18, 7), silhouette, g, 0, 30, 0, false); rock.rotation.x = Math.PI; mesh(new T.CylinderGeometry(12, 12, 2, 7), new T.MeshBasicMaterial({ color: new T.Color('#7ec86a').lerp(haze, .5), fog: false }), g, 0, 40, 0, false); }
    }
  }
  private buildObstacle(o: RunnerObstacle) {
    const s = this.shapes, model = new T.Group(), flames: T.Mesh[] = []; this.place(model, o.at, o.lane * LANE); this.course.add(model);
    const red = material('#e8473c', .5), white = material('#f4f4f4', .5), dark = material('#2a2e35', .6, .3);
    switch (o.variant) {
      case 'barrier': {
        for (let i = 0; i < 5; i++) s.cube(model, i % 2 ? white : red, -.72 + i * .36, .62, 0, .36, .34, .1);
        for (const x of [-.7, .7]) { s.cube(model, dark, x, .32, .02, .08, .64, .08); s.cube(model, dark, x, .02, .02, .1, .04, .5); }
        s.ball(model, material('#ffb23d', .3), -.7, .86, 0, .07, false); break;
      }
      case 'cone': for (const x of [-.6, 0, .6]) { const cone = mesh(new T.ConeGeometry(.24, .78, 12), material('#ff7a1a', .5), model, x, .39, 0); cone.castShadow = true; s.tube(model, white, x, .45, 0, .16, .1, false); } break;
      case 'bar': case 'sign': {
        for (const x of [-.95, .95]) s.cube(model, dark, x, 1.15, 0, .14, 2.3, .14);
        if (o.variant === 'bar') for (let i = 0; i < 5; i++) s.cube(model, i % 2 ? white : red, -.76 + i * .38, 1.45, 0, .38, .45, .12);
        else { s.cube(model, material('#2f6fd6', .5), 0, 1.6, 0, 2, .8, .12); const t = label('DUCK!', '#ffffff', '#00000000', 256, 96); t.sprite.position.set(0, 1.6, -.1); t.sprite.scale.set(1.6, .6, 1); model.add(t.sprite); }
        s.ball(model, material('#ff3b30', .3), 0, 2.35, 0, .1, false); break;
      }
      case 'parked': case 'oncoming': this.train(model, o); break;
      case 'root': {
        const brown = material('#6b4a2c', .9), curve = new T.CatmullRomCurve3([new T.Vector3(-1.2, -.1, .2), new T.Vector3(-.6, .55, 0), new T.Vector3(.1, .62, -.1), new T.Vector3(.7, .45, .1), new T.Vector3(1.2, -.1, 0)]);
        mesh(new T.TubeGeometry(curve, 24, .2, 8), brown, model); mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.5, .4, 0), new T.Vector3(-.2, .7, .3), new T.Vector3(.3, .2, .5)]), 12, .08, 6), brown, model); break;
      }
      case 'log': { const log = s.tube(model, material('#7a5534', .9), 0, .38, 0, .34, 2.1); log.rotation.z = Math.PI / 2; const moss = s.tube(model, material('#4f8a3c', .9), 0, .62, 0, .2, 1.6, false); moss.rotation.z = Math.PI / 2; break; }
      case 'fire': {
        s.cube(model, material('#4d4238', .8), 0, .06, 0, 1.8, .12, 1.2); for (let i = 0; i < 4; i++) s.cube(model, dark, -.6 + i * .4, .14, 0, .08, .06, 1.1, false);
        for (let i = 0; i < 3; i++) { const f = mesh(new T.ConeGeometry(.28, 1.1, 8), new T.MeshBasicMaterial({ color: i === 1 ? '#ffd24a' : '#ff7a1a', transparent: true, opacity: .9 }), model, -.55 + i * .55, .65, 0, false); f.userData.dynamic = true; flames.push(f); }
        const glow = new T.Sprite(new T.SpriteMaterial({ map: this.halo, color: '#ff8a2a', blending: T.AdditiveBlending, transparent: true, depthWrite: false })); glow.scale.set(3, 2.4, 1); glow.position.y = .8; model.add(glow); break;
      }
      case 'vine': {
        const stone = material('#bfb194', .85); for (const x of [-1, 1]) s.cube(model, stone, x, 1.2, 0, .3, 2.4, .5); s.cube(model, material('#d8c9a4', .85), 0, 2.2, 0, 2.4, .5, .6);
        for (let i = 0; i < 7; i++) s.tube(model, material(i % 2 ? '#3f7a3a' : '#4f9a45', .8), -.75 + i * .25, 1.6 - (i % 3) * .1, 0, .04, 1 + (i % 3) * .2, false); break;
      }
      case 'pit': for (let i = 0; i < 4; i++) s.cube(model, material('#8e8370', .9), (i - 1.5) * .5, -.05, -.2 - (i % 2) * .3, .3, .16, .3, false); break;
    }
    if (o.moving) model.traverse(m => { m.userData.dynamic = true; });
    this.hazards.push({ model, obstacle: o, flames });
  }
  private train(model: T.Group, o: RunnerObstacle) {
    const s = this.shapes, liveries = this.subway.liveries, [body, stripe] = liveries[o.id % liveries.length], paint = material(body, .45, .2), glass = material('#1d2b3c', .15, .5), roofMat = material('#c9ced6', .5, .4);
    const L = o.length, z = (v: number) => -v, front = 0;
    s.cube(model, paint, 0, 1.45, z(L / 2), 1.9, 2.4, L); s.cube(model, material(stripe, .5), 0, .78, z(L / 2), 1.92, .22, L - .1);
    const roof = s.tube(model, roofMat, 0, 2.62, z(L / 2), .95, L - .2); roof.rotation.x = Math.PI / 2; roof.scale.z = .95 * .28;
    for (let d = 2.5; d < L - 2; d += 5) s.cube(model, material('#8f98a4', .5, .4), 0, 2.95, z(d), .9, .3, 1.4);
    for (const side of [-1, 1]) s.cube(model, glass, side * .955, 1.75, z(L / 2), .03, .7, L - 1.2, false);
    for (let d = 2; d < L - 1; d += 3) for (const side of [-1, 1]) s.cube(model, material('#000000', .6), side * .96, 1.25, z(d), .02, 1.6, .05, false);
    // The cab faces the runner: windscreen, lights and a destination board.
    s.cube(model, glass, 0, 1.85, z(front) + .02, 1.5, .8, .06, false); s.cube(model, material('#111', .5), 0, 2.4, z(front) + .02, 1.2, .25, .05, false);
    const lamp = o.variant === 'oncoming' ? new T.MeshBasicMaterial({ color: '#fff6c8' }) : material('#fff2b0', .3);
    for (const x of [-.62, .62]) s.ball(model, lamp, x, .95, z(front) + .02, .13, false);
    if (o.variant === 'oncoming') { const beam = new T.Sprite(new T.SpriteMaterial({ map: this.halo, color: '#fff2b0', blending: T.AdditiveBlending, transparent: true, depthWrite: false })); beam.scale.set(3.6, 1.6, 1); beam.position.set(0, 1, .2); model.add(beam); }
    for (const d of [1.2, L - 1.2]) for (const side of [-1, 1]) { const wheel = s.tube(model, material('#22262c', .6, .5), side * .62, .26, z(d), .26, .2); wheel.rotation.z = Math.PI / 2; }
    if (o.ramp) {
      const ramp = new T.Group(); model.add(ramp); const run = Math.hypot(5, 2.6), angle = Math.atan2(2.6, 5);
      for (let i = 0; i < 6; i++) { const strip = s.cube(ramp, i % 2 ? material('#ffd23d', .5) : material('#2a2e35', .6), 0, 1.3, 2.5, 1.8, .12, run / 6); strip.position.set(0, 1.3 - Math.sin(angle) * (i - 2.5) * run / 6, 2.5 + Math.cos(angle) * (i - 2.5) * run / 6); strip.rotation.x = angle; }
      for (const side of [-1, 1]) s.cube(ramp, material('#59626e', .5, .5), side * .85, .6, 1.2, .08, 1.2, .08);
    }
  }
  protected update(dt: number, reduced: boolean): void {
    // A new world theme rebuilds the course around the runner without touching the run itself.
    if ((this.run.config.worldTheme ?? 'classic') !== this.worldKey) { this.mood = ''; this.rebuild(); }
    this.weather.update(dt, this.run.config.weather ?? 'clear', this.origin, this.run.config.weather === 'storm' ? 1.5 : 0, reduced); weatherLight(this.scene, this.sun, this.weather); for (const moon of this.moons) moon.position.z = this.origin.z - 160;
    const run = this.run, f = runnerFrame(run.distance, run.theme, run.level), lateral = run.x, time = reduced ? 0 : run.elapsed;
    const p = new T.Vector3(f.x + Math.cos(f.yaw) * lateral, run.y, f.z - Math.sin(f.yaw) * lateral);
    const h = this.hero; h.root.position.copy(p); h.root.rotation.y = f.yaw; this.origin.copy(p).y += 1;
    const stride = run.phase === 'playing' ? run.distance * 2.4 : 0, air = run.y > run.roof + .1, sliding = run.slide > 0, flying = run.powers.jetpack > 0;
    h.figure.position.y = sliding ? -.62 : reduced || air ? 0 : Math.abs(Math.sin(stride)) * .08; h.figure.rotation.x = sliding ? 1.15 : air ? .2 : -.12;
    h.legs.forEach((leg, i) => { leg.rotation.x = flying ? .3 : air ? (i ? .9 : -.5) : sliding ? -1.2 : Math.sin(stride + i * Math.PI) * .9; });
    h.arms.forEach((arm, i) => { arm.rotation.x = flying ? -.4 : air ? -2.4 : sliding ? .8 : -Math.sin(stride + i * Math.PI) * .8; arm.rotation.z = air ? (i ? -.4 : .4) : 0; });
    h.shield.visible = run.shield > 0; h.board.visible = run.theme === 'subway' && run.shield > 0 && !flying; h.board.position.y = h.board.visible ? .05 : 0;
    h.jetpack.visible = flying; h.flames.forEach((fl, i) => { fl.scale.y = .8 + Math.abs(Math.sin(time * 30 + i)) * .6; });
    h.figure.visible = !(run.invulnerable > 0 && run.phase === 'playing' && !reduced && Math.floor(run.elapsed * 12) % 2 === 0 && run.chase > .5);
    // Pursuers close in after a crash and fall back while you run clean.
    const behind = 2.4 + (1 - run.chase) * 16, cf = this.frame(Math.max(-8, run.distance - behind), lateral * .5);
    this.chaser.root.visible = run.chase > .02 && run.phase !== 'cleared'; this.chaser.root.position.set(cf.x, 0, cf.z); this.chaser.root.rotation.y = cf.yaw;
    for (const [i, r] of this.chaser.runners.entries()) { const step = time * 13 + i; r.legs.forEach((l, k) => { l.rotation.x = Math.sin(step + k * Math.PI) * .9; }); r.arms.forEach((a, k) => { a.rotation.x = -Math.sin(step + k * Math.PI) * .9; }); r.body.position.y = reduced ? 0 : Math.abs(Math.sin(step)) * .08; }
    // Coins: one instanced draw, spinning.
    // Jetpack sky coins can outgrow the buffer; rebuild it with room for them.
    if (this.coins && run.tokens.length > this.coinCount) { this.coins.removeFromParent(); this.coins.geometry.dispose(); (this.coins.material as T.Material).dispose(); this.buildCoins(); }
    if (this.coins) {
      let n = 0; const d = this.dummy;
      for (const c of run.tokens) {
        if (c.taken || c.at < run.distance - 4 || c.at > run.distance + 90) continue; const q = this.frame(c.at, c.lane * LANE);
        d.position.set(q.x, c.y, q.z); d.rotation.set(0, q.yaw + time * 3 + c.at, 0); d.scale.setScalar(1); d.updateMatrix(); this.coins.setMatrixAt(n++, d.matrix); if (n >= this.coins.count) break;
      }
      this.coins.count = n; this.coins.instanceMatrix.needsUpdate = true;
    }
    for (const e of this.pickups) { e.model.visible = !e.pickup.taken && Math.abs(e.pickup.at - run.distance) < 90; const inner = e.model.userData.inner as T.Group; inner.rotation.y = time * 2; inner.position.y = 1.1 + Math.sin(time * 3) * .12; }
    for (const e of this.hazards) {
      if (e.obstacle.moving) { this.place(e.model, e.obstacle.at, e.obstacle.lane * LANE); e.model.visible = e.obstacle.at > run.distance - 30; }
      e.flames.forEach((fl, i) => { fl.scale.set(1, .8 + Math.abs(Math.sin(time * 14 + i * 2)) * .5, 1); });
    }
    this.torches.forEach((fl, i) => { fl.scale.y = .8 + Math.abs(Math.sin(time * 11 + i)) * .4; });
    for (const sign of this.turnSigns) sign.model.visible = sign.at > run.distance - 2 && sign.at - run.distance < 60;
    // Chase camera: low behind the runner, easing around corners and rising for roofs and flight.
    const diff = Math.atan2(Math.sin(f.yaw - this.cameraYaw), Math.cos(f.yaw - this.cameraYaw)); this.cameraYaw += diff * (reduced ? 1 : Math.min(1, dt * 5));
    const forward = new T.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw)), lift = Math.min(6.5, run.y) * .75;
    const target = new T.Vector3(f.x, 4.3 + lift, f.z).addScaledVector(forward, -7.6).add(new T.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw)).multiplyScalar(lateral * .35));
    if (!this.camReady || reduced) { this.camPos.copy(target); this.camReady = true; } else this.camPos.lerp(target, Math.min(1, dt * 8));
    this.camera.position.copy(this.camPos); this.camera.lookAt(new T.Vector3(f.x + Math.cos(f.yaw) * lateral * .4, 1.1 + lift * .9, f.z - Math.sin(f.yaw) * lateral * .4).addScaledVector(forward, 6.5)); this.followLight(f.x, f.z);
  }
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    super.render(dt, held, reduced, cues);
    const run = this.run, key = `${run.revision}|${run.phase}|${run.lives}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/jpeg', .84); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }
  dispose(): void { this.weather.dispose(); this.halo.dispose(); this.tex.dispose(); this.sky?.dispose(); super.dispose(); }
}
