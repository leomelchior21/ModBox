import * as T from 'three';

/** Weather kinds any 3D game can roll in. Games decide which ones they offer and how each changes play. */
export type WeatherKind = 'clear' | 'rain' | 'storm' | 'snow' | 'fog' | 'sandstorm' | 'embers' | 'fireflies' | 'petals' | 'aurora' | 'wind';
interface Layer { mesh: T.InstancedMesh; level: number; max: number }
const seedTable = Float32Array.from({ length: 6000 }, (_, i) => Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1);

/**
 * Live weather around the action. Particles live in a box that follows `center`, every layer eases in and out,
 * and the scene fog blends from the world's own fog toward the weather's. Views read `gloom`, `flash`, `wet`
 * and `cover` to darken lights, flash lightning, wet the ground or settle snow.
 */
export class WorldWeather {
  wet = 0; cover = 0; gloom = 0; flash = 0; fogLevel = 0;
  private layers: Record<'rain' | 'snow' | 'dust' | 'embers' | 'flies' | 'petals', Layer>;
  private fog = new T.Fog('#cfd6dc', 30, 120); private base = { color: new T.Color('#cfd6dc'), near: 30, far: 120 }; private tint = new T.Color('#cfd6dc');
  private dummy = new T.Object3D(); private time = 0; private nextBolt = 5; private aurora: T.Mesh;
  constructor(private scene: T.Scene, readonly box = { w: 26, h: 12, d: 34 }) {
    const make = (g: T.BufferGeometry, m: T.Material, max: number): Layer => { const mesh = new T.InstancedMesh(g, m, max); mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 2; scene.add(mesh); return { mesh, level: 0, max }; };
    const basic = (color: string, opacity = 1, additive = false) => new T.MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, depthWrite: false, toneMapped: false, ...(additive ? { blending: T.AdditiveBlending } : {}) });
    this.layers = {
      rain: make(new T.BoxGeometry(.014, .42, .014), basic('#cfe8ff', .5), 900),
      snow: make(new T.IcosahedronGeometry(.045, 0), basic('#ffffff'), 700),
      dust: make(new T.BoxGeometry(.5, .02, .02), basic('#d9b77a', .55), 700),
      embers: make(new T.IcosahedronGeometry(.04, 0), basic('#ff9a3c', .9, true), 300),
      flies: make(new T.IcosahedronGeometry(.05, 0), basic('#e6ff7a', .9, true), 160),
      petals: make(new T.PlaneGeometry(.1, .07), new T.MeshBasicMaterial({ color: '#ffb7d5', side: T.DoubleSide, transparent: true, opacity: .95, depthWrite: false }), 260),
    };
    // Aurora: a wide glowing ribbon high in the sky, only shown for that weather.
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d')!, gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(120,255,200,0)'); gr.addColorStop(.5, 'rgba(120,255,200,.75)'); gr.addColorStop(.75, 'rgba(160,120,255,.45)'); gr.addColorStop(1, 'rgba(160,120,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
    const map = new T.CanvasTexture(c); this.aurora = new T.Mesh(new T.PlaneGeometry(80, 14, 32, 1), new T.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false, fog: false }));
    this.aurora.visible = false; scene.add(this.aurora);
  }
  /** The world's own fog for the current theme; weather fog blends toward and away from it. */
  setBaseFog(color: T.ColorRepresentation, near: number, far: number) { this.base.color.set(color); this.base.near = near; this.base.far = far; }
  update(dt: number, kind: string, center: T.Vector3, wind: number, reduced: boolean) {
    this.time += dt; const t = this.time, ease = (v: number, to: number, rate: number) => v + (to - v) * Math.min(1, dt * rate);
    const k = kind as WeatherKind, raining = k === 'rain' || k === 'storm';
    const target = { rain: raining ? (k === 'storm' ? 1 : .65) : 0, snow: k === 'snow' ? 1 : 0, dust: k === 'sandstorm' ? 1 : k === 'wind' ? .35 : 0, embers: k === 'embers' ? 1 : 0, flies: k === 'fireflies' ? 1 : 0, petals: k === 'petals' ? 1 : k === 'wind' ? .4 : 0 };
    for (const [name, layer] of Object.entries(this.layers) as [keyof typeof target, Layer][]) layer.level = ease(layer.level, target[name], 1.1);
    this.wet = ease(this.wet, raining ? 1 : 0, .3); this.cover = ease(this.cover, k === 'snow' ? 1 : 0, k === 'snow' ? .15 : .35);
    this.gloom = ease(this.gloom, k === 'storm' ? 1 : k === 'rain' ? .5 : k === 'sandstorm' ? .45 : k === 'fog' ? .3 : k === 'fireflies' || k === 'aurora' ? .6 : 0, .6);
    this.fogLevel = ease(this.fogLevel, k === 'fog' ? 1 : k === 'sandstorm' ? .8 : k === 'storm' ? .4 : k === 'snow' ? .3 : k === 'rain' ? .2 : 0, .5);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (k === 'storm' && !reduced) { this.nextBolt -= dt; if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = 4 + seedTable[Math.floor(t * 13) % 6000] * 6; } }
    const { w, h, d } = this.box, slant = wind * .02, show = reduced ? 0 : 1, m = this.dummy;
    const place = (layer: Layer, fill: (i: number) => void) => { const n = Math.round(layer.max * layer.level * show); layer.mesh.count = n; for (let i = 0; i < n; i++) fill(i); if (n) layer.mesh.instanceMatrix.needsUpdate = true; };
    const at = (i: number, o: number) => seedTable[(i + o) % 6000];
    place(this.layers.rain, i => { const y = h - ((at(i, 0) * h + t * (16 + at(i, 900) * 5)) % h); m.position.set(center.x + (at(i, 1800) - .5) * w + slant * (h - y), center.y + y - 1, center.z + (at(i, 2700) - .5) * d); m.rotation.set(0, 0, -slant); m.scale.setScalar(1); m.updateMatrix(); this.layers.rain.mesh.setMatrixAt(i, m.matrix); });
    place(this.layers.snow, i => { const y = h - ((at(i, 100) * h + t * (1 + at(i, 1000) * .7)) % h); m.position.set(center.x + (at(i, 1900) - .5) * w + Math.sin(t * .8 + i) * .4 + slant * (h - y) * .5, center.y + y - 1, center.z + (at(i, 2800) - .5) * d); m.rotation.set(0, 0, 0); m.scale.setScalar(.7 + at(i, 3700) * .8); m.updateMatrix(); this.layers.snow.mesh.setMatrixAt(i, m.matrix); });
    place(this.layers.dust, i => { const x = ((at(i, 200) * w + t * (14 + at(i, 1100) * 8) * (wind >= 0 ? 1 : -1)) % w + w) % w - w / 2; m.position.set(center.x + x, center.y + at(i, 2000) * h * .6 - .5, center.z + (at(i, 2900) - .5) * d); m.rotation.set(0, 0, Math.sin(i) * .1); m.scale.set(.6 + at(i, 3800) * 1.4, 1, 1); m.updateMatrix(); this.layers.dust.mesh.setMatrixAt(i, m.matrix); });
    place(this.layers.embers, i => { const y = (at(i, 300) * h + t * (1.2 + at(i, 1200))) % h; m.position.set(center.x + (at(i, 2100) - .5) * w + Math.sin(t * 1.4 + i) * .5, center.y + y - 1, center.z + (at(i, 3000) - .5) * d); m.rotation.set(0, 0, 0); m.scale.setScalar(.6 + at(i, 3900) * .9); m.updateMatrix(); this.layers.embers.mesh.setMatrixAt(i, m.matrix); });
    place(this.layers.flies, i => { const blink = .4 + .6 * Math.max(0, Math.sin(t * (2 + at(i, 400) * 3) + i)); m.position.set(center.x + (at(i, 2200) - .5) * w * .8 + Math.sin(t * .5 + i * 1.7) * 1.2, center.y + .4 + at(i, 1300) * 4 + Math.sin(t * .9 + i) * .4, center.z + (at(i, 3100) - .5) * d * .8 + Math.cos(t * .4 + i) * 1.2); m.rotation.set(0, 0, 0); m.scale.setScalar(blink); m.updateMatrix(); this.layers.flies.mesh.setMatrixAt(i, m.matrix); });
    place(this.layers.petals, i => { const y = h - ((at(i, 500) * h + t * (.9 + at(i, 1400) * .6)) % h); m.position.set(center.x + (at(i, 2300) - .5) * w + Math.sin(t * .7 + i) * .8 + slant * (h - y) * 2, center.y + y - 1, center.z + (at(i, 3200) - .5) * d); m.rotation.set(t * 2 + i, t * 1.3 + i, 0); m.scale.setScalar(1); m.updateMatrix(); this.layers.petals.mesh.setMatrixAt(i, m.matrix); });
    const auroraMat = this.aurora.material as T.MeshBasicMaterial; auroraMat.opacity = ease(auroraMat.opacity, k === 'aurora' && !reduced ? .75 : 0, .8); this.aurora.visible = auroraMat.opacity > .01;
    if (this.aurora.visible) { this.aurora.position.set(center.x, center.y + 22, center.z - 40); this.aurora.rotation.x = .35; const p = this.aurora.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * .12 + t * .6) * 3); p.needsUpdate = true; }
    // Fog: blend from the world's own fog toward the weather's thicker, tinted fog.
    const fogTint = k === 'sandstorm' ? '#c9a46a' : k === 'snow' ? '#e8f0f6' : k === 'storm' || k === 'rain' ? '#8b98a6' : '#cfd6dc';
    this.tint.lerp(new T.Color(fogTint), Math.min(1, dt * 2)); const f = this.fogLevel;
    this.fog.color.copy(this.base.color).lerp(this.tint, f); this.fog.near = this.base.near * (1 - f * .85); this.fog.far = Math.max(this.fog.near + 6, this.base.far * (1 - f * .8));
    this.scene.fog = this.fog;
  }
  dispose() {
    for (const layer of Object.values(this.layers)) { layer.mesh.removeFromParent(); layer.mesh.geometry.dispose(); (layer.mesh.material as T.Material).dispose(); }
    this.aurora.removeFromParent(); this.aurora.geometry.dispose(); const m = this.aurora.material as T.MeshBasicMaterial; m.map?.dispose(); m.dispose();
  }
}
