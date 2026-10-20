import * as T from 'three';
import { X, Z, U, PITCH } from './stadium';

/**
 * Live match weather. Everything eases in and out, so changing `weather` in code visibly rolls the new weather
 * across the stadium: rain streaks and splashes, a wet sheen, snow settling on the grass, fog banks and lightning.
 */
export class PitchWeather {
  /** 0 to 1 levels the view reads to tint the pitch and the lights. */
  wet = 0; cover = 0; fog = 0; gloom = 0; flash = 0;
  private rain: T.InstancedMesh; private splashes: T.InstancedMesh; private snow: T.InstancedMesh; private banks: T.Sprite[] = []; private blanket: T.Mesh;
  private mist = new T.Fog('#cdd5db', 20, 80); private rainLevel = 0; private snowLevel = 0; private seeds: Float32Array; private dummy = new T.Object3D(); private nextBolt = 6; private time = 0;
  constructor(private scene: T.Scene, glow: T.Texture) {
    const add = (g: T.BufferGeometry, m: T.Material, n: number) => { const i = new T.InstancedMesh(g, m, n); i.instanceMatrix.setUsage(T.DynamicDrawUsage); i.frustumCulled = false; i.count = 0; scene.add(i); return i; };
    this.rain = add(new T.BoxGeometry(.012, .34, .012), new T.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: .55, depthWrite: false }), 1000);
    const ring = new T.RingGeometry(.03, .055, 12); ring.rotateX(-Math.PI / 2);
    this.splashes = add(ring, new T.MeshBasicMaterial({ color: '#e6f4ff', transparent: true, opacity: .55, depthWrite: false }), 80);
    this.snow = add(new T.IcosahedronGeometry(.035, 0), new T.MeshBasicMaterial({ color: '#ffffff' }), 800);
    this.seeds = Float32Array.from({ length: 4000 }, (_, i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1);
    // Snow settles as a speckled blanket that lets the mown stripes show through.
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${.25 + (i % 5) * .12})`; g.beginPath(); g.arc((i * 73.13) % 256, (i * 41.71) % 256, 2 + (i % 7), 0, Math.PI * 2); g.fill(); }
    const map = new T.CanvasTexture(c); map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(4, 6);
    this.blanket = new T.Mesh(new T.PlaneGeometry(U(PITCH.right - PITCH.left) + 6, U(PITCH.bottom - PITCH.top) + 8), new T.MeshStandardMaterial({ map, transparent: true, opacity: 0, depthWrite: false, roughness: .9, color: '#ffffff' }));
    this.blanket.rotation.x = -Math.PI / 2; this.blanket.position.set(X(320), .003, Z(500)); this.blanket.renderOrder = 1; scene.add(this.blanket);
    for (let i = 0; i < 12; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: glow, color: '#e9eef2', transparent: true, opacity: 0, depthWrite: false })); s.scale.set(9, 3.5, 1); scene.add(s); this.banks.push(s); }
  }
  update(dt: number, kind: string, wind: number, reduced: boolean) {
    this.time += dt; const t = this.time, ease = (v: number, target: number, rate: number) => v + (target - v) * Math.min(1, dt * rate);
    const raining = kind === 'rain' || kind === 'storm', snowing = kind === 'snow';
    this.rainLevel = ease(this.rainLevel, raining ? (kind === 'storm' ? 1 : .65) : 0, 1.2); this.snowLevel = ease(this.snowLevel, snowing ? 1 : 0, 1);
    this.wet = ease(this.wet, raining ? 1 : 0, .25); this.cover = ease(this.cover, snowing ? .78 : 0, snowing ? .16 : .3);
    this.fog = ease(this.fog, kind === 'fog' ? 1 : kind === 'storm' ? .35 : 0, .5); this.gloom = ease(this.gloom, kind === 'storm' ? 1 : kind === 'rain' ? .55 : kind === 'fog' ? .35 : kind === 'snow' ? .2 : 0, .6);
    // Lightning in a storm: a double flash every few seconds.
    this.flash = Math.max(0, this.flash - dt * 4);
    if (kind === 'storm' && !reduced) { this.nextBolt -= dt; if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = 4 + this.seeds[Math.floor(t * 7) % 4000] * 6; } if (this.nextBolt > 3.6 && this.nextBolt < 3.75) this.flash = Math.max(this.flash, .6); }
    const d = this.dummy, slant = wind * .0016, shown = reduced ? 0 : 1;
    const rainCount = Math.round(1000 * this.rainLevel * shown); this.rain.count = rainCount;
    for (let i = 0; i < rainCount; i++) {
      const x = (this.seeds[i] - .5) * 16, z = (this.seeds[i + 1000] - .5) * 20 - 1, y = 7 - ((this.seeds[i + 2000] * 7 + t * (13 + this.seeds[i + 3000] * 4)) % 7);
      d.position.set(x + slant * (7 - y) * 6, y, z); d.rotation.set(0, 0, -slant * 6); d.scale.setScalar(1); d.updateMatrix(); this.rain.setMatrixAt(i, d.matrix);
    }
    this.rain.instanceMatrix.needsUpdate = true;
    const splashCount = Math.round(80 * this.rainLevel * shown); this.splashes.count = splashCount;
    for (let i = 0; i < splashCount; i++) { const phase = (t * 2.2 + this.seeds[i + 500]) % 1, k = Math.floor(t * 2.2 + this.seeds[i + 500]) + i * 31; d.position.set((this.seeds[k % 4000] - .5) * 9, .01, (this.seeds[(k * 7) % 4000] - .5) * 13); d.rotation.set(0, 0, 0); d.scale.setScalar(.4 + phase * 2.2); d.updateMatrix(); this.splashes.setMatrixAt(i, d.matrix); }
    this.splashes.instanceMatrix.needsUpdate = true; (this.splashes.material as T.MeshBasicMaterial).opacity = .5;
    const snowCount = Math.round(800 * this.snowLevel * shown); this.snow.count = snowCount;
    for (let i = 0; i < snowCount; i++) {
      const y = 7 - ((this.seeds[i + 1500] * 7 + t * (.9 + this.seeds[i + 2500] * .6)) % 7);
      d.position.set((this.seeds[i + 200] - .5) * 16 + Math.sin(t * .8 + i) * .3 + slant * (7 - y) * 4, y, (this.seeds[i + 1200] - .5) * 20 - 1); d.rotation.set(0, 0, 0); d.scale.setScalar(.7 + this.seeds[i + 3200] * .8); d.updateMatrix(); this.snow.setMatrixAt(i, d.matrix);
    }
    this.snow.instanceMatrix.needsUpdate = true;
    (this.blanket.material as T.MeshStandardMaterial).opacity = this.cover;
    // Fog banks drift slowly across the far half of the pitch.
    this.banks.forEach((s, i) => { s.material.opacity = this.fog * .55; s.position.set(((i * 3.1 + t * .25 * (i % 2 ? 1 : -1)) % 18) - 9, .7 + (i % 3) * .5, Z(80 + (i % 6) * 90)); });
    if (this.fog > .02) { this.mist.near = 10 + (1 - this.fog) * 30; this.mist.far = 22 + (1 - this.fog) * 80; this.scene.fog = this.mist; } else if (this.scene.fog === this.mist) this.scene.fog = null;
  }
  dispose() { for (const m of [this.rain, this.splashes, this.snow]) { m.removeFromParent(); m.geometry.dispose(); (m.material as T.Material).dispose(); } this.blanket.removeFromParent(); this.blanket.geometry.dispose(); const bm = this.blanket.material as T.MeshStandardMaterial; bm.map?.dispose(); bm.dispose(); for (const s of this.banks) { s.removeFromParent(); s.material.dispose(); } }
}
