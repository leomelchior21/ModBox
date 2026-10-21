import * as T from 'three';
import type { ArcadeCue } from '../premium-kit/core';
import { World, material } from '../three-kit/world';
import { StackRun, type StackSlab } from './run';
import { stackWorld } from './worlds';
import { WorldWeather } from '../three-kit/weather';

/** 50 run units per meter; every floor is half a meter tall. */
const U = 50, FLOOR = .5;
const SKY_VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FRAGMENT = `uniform vec3 top; uniform vec3 bottom; uniform float stars; uniform float time; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 c = mix(bottom, top, smoothstep(0.0, 1.0, vUv.y));
  vec2 cell = floor(vUv * vec2(150.0, 110.0)); float h = hash(cell);
  c += step(0.986, h) * stars * (0.55 + 0.45 * sin(time * 2.0 + h * 60.0)) * smoothstep(0.25, 0.9, vUv.y);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

function cloudTexture(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d')!;
  for (let i = 0; i < 6; i++) { const x = 24 + i * 16, y = 36 - Math.sin(i) * 6, r = g.createRadialGradient(x, y, 0, x, y, 26); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 64); }
  return new T.CanvasTexture(c);
}

export class StackView extends World<StackRun> {
  private tower = new T.Group(); private moving = new T.Group(); private fragments = new T.Group(); private ripples: { root: T.Group; age: number }[] = []; private clouds: T.Sprite[] = [];
  private sky: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>; private pedestal: T.Mesh; private pedestalMaterial = material('#555', .6, .05);
  private built = { count: -1, style: '', revision: -1 }; private lastRipple = 99; private cloudMap = cloudTexture(); private camY = 0;
  private shot: string | null = null; private shotKey = ''; private backdrop = new T.Group(); private worldKey = ''; private weather: WorldWeather;
  constructor(canvas: HTMLCanvasElement, run: StackRun) {
    super(canvas, run, '#9fd3e6', 18); this.scene.fog = null; this.renderer.toneMapping = T.NoToneMapping;
    this.camera = new T.OrthographicCamera(-10, 10, 8, -8, .1, 400); this.scene.add(this.camera, this.tower, this.moving, this.fragments);
    this.sky = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, depthWrite: false, depthTest: false, uniforms: { top: { value: new T.Color() }, bottom: { value: new T.Color() }, stars: { value: 0 }, time: { value: 0 } } }));
    this.sky.renderOrder = -10; this.sky.position.z = -300; this.camera.add(this.sky);
    this.pedestal = new T.Mesh(new T.BoxGeometry(1, 40, 1), this.pedestalMaterial); this.pedestal.receiveShadow = true; this.scene.add(this.pedestal);
    this.sun.intensity = 2.6; this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -8; this.sun.shadow.camera.right = this.sun.shadow.camera.top = 8;
    this.scene.add(this.backdrop); this.remix.ownWorld(true); this.weather = new WorldWeather(this.scene, { w: 20, h: 16, d: 20 });
    for (let i = 0; i < 14; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: this.cloudMap, transparent: true, opacity: .55, depthWrite: false })); s.scale.set(7 + i % 3 * 3, 2.6 + i % 2, 1); this.scene.add(s); this.clouds.push(s); }
  }
  /** Each floor shifts the hue a little, so the tower reads as a rainbow ribbon. */
  private colour(layer: number, gold = false) { const w = stackWorld(this.run.config.worldTheme); return gold ? new T.Color('#ffc93a') : new T.Color().setHSL((((w.hue ?? this.run.stage.hue) + layer * 7) % 360) / 360, w.saturation, w.lightness); }
  private slab(root: T.Group, slab: StackSlab, style: string) {
    const w = slab.w / U, d = slab.d / U, gold = !!slab.gold, color = this.colour(slab.layer, gold);
    // Slab styles: tinted glass, warm wood, candy pastel or dark neon with glowing edges.
    const m = style === 'glass' ? new T.MeshStandardMaterial({ color, roughness: .05, metalness: .1, transparent: true, opacity: .62 }) : style === 'wood' ? material(new T.Color('#b07a45').lerp(color, .25), .85, 0)
      : style === 'candy' ? material(color.clone().offsetHSL(0, .25, .08), .35, 0) : style === 'neon' ? material('#141428', .3, .4) : material(color, gold ? .25 : .55, gold ? .7 : .02);
    if (gold) { m.emissive.set('#a8661a'); m.emissiveIntensity = .35; }
    const box = new T.Mesh(this.shapes.box, m); box.scale.set(w, FLOOR, d); box.position.set(w / 2, 0, d / 2); box.castShadow = box.receiveShadow = true; root.add(box);
    if (style === 'neon' || style === 'glass') { const edge = new T.MeshBasicMaterial({ color: style === 'neon' ? color : '#ffffff', toneMapped: false, transparent: style === 'glass', opacity: .8 }); for (const [x, z, sx, sz] of [[w / 2, .01, w, .03], [w / 2, d - .01, w, .03], [.01, d / 2, .03, d], [w - .01, d / 2, .03, d]]) { const bar = new T.Mesh(this.shapes.block, edge); bar.scale.set(sx, .05, sz); bar.position.set(x, FLOOR / 2, z); root.add(bar); } }
    if (style === 'wood') for (let k = 1; k < 4; k++) this.shapes.cube(root, material('#7a4a24', .9), w * k / 4, .02, d / 2, .02, FLOOR * .9, d * .98, false);
    if (style === 'candy') for (let k = 0; k < 5; k++) this.shapes.cube(root, material('#ffffff', .3), w / 2, -FLOOR / 2 + FLOOR * (k + .5) / 5, d / 2, w * 1.003, .03, d * 1.003, false);
    return box;
  }
  private ripple(slab: StackSlab) {
    const root = new T.Group(), w = slab.w / U, d = slab.d / U, white = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, toneMapped: false });
    for (const [x, z, sx, sz] of [[w / 2, 0, w + .08, .05], [w / 2, d, w + .08, .05], [0, d / 2, .05, d], [w, d / 2, .05, d]]) { const bar = new T.Mesh(this.shapes.block, white); bar.scale.set(sx, .04, sz); bar.position.set(x - w / 2, 0, z - d / 2); root.add(bar); }
    root.position.set(slab.x / U + w / 2, slab.layer * FLOOR + FLOOR / 2 + .01, slab.z / U + d / 2); this.scene.add(root); this.ripples.push({ root, age: 0 });
  }
  /** What stands around the tower: clouds, a neon city, pyramids, coral and kelp, or planets. */
  private dressBackdrop() {
    const w = stackWorld(this.run.config.worldTheme); this.worldKey = this.run.config.worldTheme ?? 'classic'; this.disposeStage(this.backdrop); this.backdrop.clear(); this.built.count = -1;
    const s = this.shapes, ring = (n: number, r: number, make: (i: number, x: number, z: number) => void) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; make(i, Math.cos(a) * r, Math.sin(a) * r); } };
    if (w.skyline === 'tokyo') ring(26, 16, (i, x, z) => { const h = 6 + (i * 7) % 14, b = s.cube(this.backdrop, material('#1d1838', .7), x, h / 2 - 22, z, 2.4, h + 20, 2.4, false); b.rotation.y = i; const sign = new T.Mesh(this.shapes.block, new T.MeshBasicMaterial({ color: ['#ff4fd8', '#38e8ff', '#ffd23f'][i % 3], toneMapped: false })); sign.scale.set(.2, 2 + i % 3, .2); sign.position.set(x * .93, h - 3 - 22 + 18, z * .93); this.backdrop.add(sign); });
    else if (w.skyline === 'desert') ring(9, 22, (i, x, z) => { const p = new T.Mesh(new T.ConeGeometry(5 + i % 3 * 1.5, 7 + i % 3 * 2, 4), material('#d9a866', .9)); p.position.set(x, -14 + (i % 3) * 1, z); p.rotation.y = Math.PI / 4 + i; this.backdrop.add(p); });
    else if (w.skyline === 'ocean') ring(22, 13, (i, x, z) => { const coral = material(['#ff6f61', '#ffb347', '#c27bff', '#4fe0c0'][i % 4], .6); for (let k = 0; k < 3; k++) { const c = s.ball(this.backdrop, coral, x + (k - 1) * .6, -18 + k * 1.2 + (i % 3), z, .7 + (k % 2) * .3); c.scale.y = 1.6; } s.tube(this.backdrop, material('#2f9a6a', .8), x * 1.1, -14, z * 1.1, .12, 10, false); });
    else if (w.skyline === 'space') { for (const [x, y, z, r, c] of [[-14, 8, -18, 4, '#ff8a5c'], [16, 14, -20, 2.5, '#7ab8ff'], [8, -6, -24, 6, '#c27bff']] as const) { const p = s.ball(this.backdrop, material(c, .8), x, y, z, r); if (r > 5) { const rr = new T.Mesh(new T.TorusGeometry(r * 1.6, .2, 4, 48), material('#e8d9b8', .5)); rr.rotation.x = 1.2; p.add(rr); rr.scale.setScalar(1 / r); } } }
    for (const c of this.clouds) { c.material.color.set(w.floater === 'bubble' ? '#bff4ff' : '#ffffff'); c.material.opacity = w.floater === 'bubble' ? .35 : .55; }
  }
  protected rebuild() { this.built.count = -1; for (const r of this.ripples) { r.root.removeFromParent(); this.disposeStage(r.root); } this.ripples = []; this.lastRipple = 99; }
  protected update(dt: number, reduced: boolean) {
    if ((this.run.config.worldTheme ?? 'classic') !== this.worldKey) this.dressBackdrop();
    const r = this.run, style = r.config.characterStyle ?? 'original', stage = r.stage, world = stackWorld(r.config.worldTheme), night = stage.night || r.config.weather === 'night';
    this.weather.update(dt, world.floater === 'petal' ? 'petals' : r.config.weather === 'night' ? 'clear' : r.config.weather ?? 'clear', new T.Vector3(0, r.camera * FLOOR + 2, 0), r.weather.gust ? Math.sin(r.gustPhase) * 2 : 0, reduced); this.scene.fog = null;
    if (!r.slabs.length) return;
    if (this.built.count !== r.slabs.length || this.built.style !== style || this.built.revision !== r.revision) {
      this.disposeStage(this.tower); this.tower.clear();
      for (const slab of r.slabs) { const root = new T.Group(); root.position.set(slab.x / U, slab.layer * FLOOR, slab.z / U); this.slab(root, slab, style); this.tower.add(root); }
      this.built = { count: r.slabs.length, style, revision: r.revision };
      const base = r.slabs[0]; this.pedestal.scale.set(base.w / U, 1, base.d / U); this.pedestal.position.set(base.x / U + base.w / U / 2, -20 - FLOOR / 2, base.z / U + base.d / U / 2);
      this.pedestalMaterial.color.setHSL((r.stage.hue % 360) / 360, .4, .3);
    }
    // A fresh perfect: ripple out from the slab that was just placed.
    if (r.ripple < this.lastRipple && r.ripple < .1 && !reduced) this.ripple(r.top); this.lastRipple = r.ripple;
    for (const p of this.ripples) { p.age += dt; const k = p.age / .7; p.root.scale.set(1 + k * .45, 1, 1 + k * .45); p.root.children.forEach(c => { ((c as T.Mesh).material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - k); }); }
    for (const p of this.ripples.filter(p => p.age > .7)) { p.root.removeFromParent(); this.disposeStage(p.root); } this.ripples = this.ripples.filter(p => p.age <= .7);
    const topBox = this.tower.children.at(-1)?.children[0] as T.Mesh | undefined;
    if (topBox) { const m = topBox.material as T.MeshStandardMaterial; if (!r.top.gold) m.emissive.set(r.grew < .35 ? '#ffffff' : r.ripple < .2 ? '#555555' : '#000000'); }
    const key = `${r.moving.w}|${r.moving.d}|${style}|${r.moving.layer}|${r.moving.gold}`;
    if (this.moving.userData.key !== key) { this.disposeStage(this.moving); this.moving.clear(); this.slab(this.moving, r.moving, style); this.moving.userData.key = key; }
    this.moving.position.set(r.moving.x / U, r.moving.layer * FLOOR, r.moving.z / U); this.moving.visible = r.phase === 'playing' || r.phase === 'paused';
    while (this.fragments.children.length > r.falling.length) { const child = this.fragments.children[this.fragments.children.length - 1]; this.disposeStage(child as T.Group); this.fragments.remove(child); }
    r.falling.forEach((f, i) => {
      let root = this.fragments.children[i] as T.Group | undefined;
      if (!root) { root = new T.Group(); const box = this.slab(root, f.slab, style); box.position.set(0, 0, 0); this.fragments.add(root); }
      const w = f.slab.w / U, d = f.slab.d / U; root.position.set(f.slab.x / U + w / 2, f.slab.layer * FLOOR - f.fall / U, f.slab.z / U + d / 2);
      // Offcuts tip over the edge they were cut from, then tumble away.
      if (f.vx) root.rotation.z = -f.spin * Math.min(2.2, f.age * f.age * 3); else root.rotation.x = f.spin * Math.min(2.2, f.age * f.age * 3);
    });
    // Sky: a gentle gradient that warms with height; night stages add stars.
    const height = r.camera, hue = (stage.hue + height * 2.2) % 360, sky = this.sky.material.uniforms;
    if (world.top && world.bottom) { (sky.top.value as T.Color).set(world.top); (sky.bottom.value as T.Color).set(world.bottom); sky.stars.value = world.stars || (night ? 1 : 0); }
    else if (night) { (sky.top.value as T.Color).setHSL(((hue + 200) % 360) / 360, .55, .1); (sky.bottom.value as T.Color).setHSL(((hue + 260) % 360) / 360, .45, .32); sky.stars.value = 1; }
    else { (sky.top.value as T.Color).setHSL(((hue + 180) % 360) / 360, .55, .62 - Math.min(.2, height * .006)); (sky.bottom.value as T.Color).setHSL(((hue + 150) % 360) / 360, .6, .86); sky.stars.value = Math.min(.6, Math.max(0, (height - 18) * .05)); }
    sky.time.value = reduced ? 0 : r.elapsed;
    const cam = this.camera as T.OrthographicCamera; this.sky.scale.set((cam.right - cam.left) * 1.05, (cam.top - cam.bottom) * 1.05, 1);
    this.clouds.forEach((c, i) => { const y = 3 + i * 3.2, drift = reduced ? 0 : r.elapsed * (.15 + i % 3 * .05); c.position.set(Math.sin(i * 2.1) * 9 + ((drift + i * 3) % 24) - 12, y, Math.cos(i * 1.3) * 9 - 6); c.visible = !night && (world.floater === 'cloud' || world.floater === 'bubble'); if (world.floater === 'bubble' && !reduced) c.position.y = (r.elapsed * 1.5 + i * 3.2) % 45 - 5 + this.camY - 10; });
    this.camY += (height * FLOOR + 2.2 - this.camY) * Math.min(1, dt * 4 || 1);
    this.camera.position.set(20, 20 + this.camY, 20); this.camera.lookAt(0, this.camY, 0); this.origin.set(0, r.placed * FLOOR + 1, 0);
    this.sun.position.set(-6, this.camY + 14, 9); this.sun.target.position.set(0, this.camY - 2, 0);
  }
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    super.render(dt, held, reduced, cues);
    const run = this.run, key = `${run.revision}|${run.phase}|${run.lives}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/jpeg', .84); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number) { this.run.pointer(phase, x, y); }
  dispose(): void { this.cloudMap.dispose(); super.dispose(); }
}
