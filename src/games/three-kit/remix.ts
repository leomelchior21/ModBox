import * as T from 'three';
import type { ArcadeConfig } from '../premium-kit/core';

export const WORLD_THEMES = ['classic', 'alpine', 'volcanic', 'neon'] as const;
export const CHARACTER_STYLES = ['original', 'robot', 'astronaut', 'armored'] as const;
const THEMES = {
  alpine: { sky: '#8bcbed', horizon: '#e7f7ff', ground: '#dbeaf4', rock: '#7387ae', accent: '#c2edff', light: '#f4faff' },
  volcanic: { sky: '#351e4c', horizon: '#ff9d65', ground: '#443247', rock: '#654459', accent: '#ff763d', light: '#ffc29b' },
  neon: { sky: '#100d32', horizon: '#493d8c', ground: '#25305b', rock: '#333874', accent: '#62f6ef', light: '#c5c0ff' },
};
type ActorKind = 'person' | 'vehicle' | 'vacuum' | 'snake' | 'machine';
interface Actor { root: T.Group; originals: T.Object3D[]; variant: T.Group; kind: ActorKind; style: string }
const mat = (color: string, metalness = 0, emissive?: string) => new T.MeshStandardMaterial({ color, roughness: .42, metalness, ...(emissive ? { emissive, emissiveIntensity: .7 } : {}) });
function box(parent: T.Object3D, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function ball(parent: T.Object3D, material: T.Material, x: number, y: number, z: number, r: number) {
  const m = new T.Mesh(new T.SphereGeometry(r, 16, 10), material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function free(root: T.Object3D) { const g = new Set<T.BufferGeometry>(), m = new Set<T.Material>(); root.traverse(o => { if (o instanceof T.Mesh || o instanceof T.Points) { g.add(o.geometry); for (const a of Array.isArray(o.material) ? o.material : [o.material]) m.add(a); } }); g.forEach(a => a.dispose()); m.forEach(a => a.dispose()); root.clear(); }

/** Live scene remixes own actual meshes and materials; simulation and saves stay intact. */
export class SceneRemix {
  readonly scenery = new T.Group(); private actors: Actor[] = []; private theme = ''; private weather = ''; private stageRevision = -1;
  private originalBackground: T.Scene['background']; private sky: T.CanvasTexture | null = null; private particles: T.Points | null = null;
  private pointPositions = new Float32Array(480 * 3); private elapsed = 0; private baseFog: T.Fog | null = null;
  constructor(private scene: T.Scene, private sun: T.DirectionalLight, private indoor = false) { this.originalBackground = scene.background; scene.add(this.scenery); this.scenery.userData.remix = true; }
  /** Lets a game supply its own sky and fog for the default theme, for example a stage that runs at night. */
  setBase(background: T.Scene['background'], fog: T.Fog | null) { this.originalBackground = background; this.baseFog = fog; this.theme = ''; }
  /** For games that build their own themed worlds: the remix keeps characters and weather but leaves scenery, sky and materials alone. */
  ownWorld(weather = false) { this.custom = true; this.customWeather = weather; }
  private custom = false; private customWeather = false;
  character(root: T.Group, kind: ActorKind = 'person') { const variant = new T.Group(); variant.userData.remix = true; const originals = [...root.children]; root.userData.character = true; root.add(variant); this.actors.push({ root, originals, variant, kind, style: '' }); }
  update(config: Pick<ArcadeConfig, 'worldTheme' | 'characterStyle' | 'weather'>, origin: T.Vector3, dt: number, reduced: boolean, revision: number) {
    this.elapsed += dt; const theme = config.worldTheme ?? 'classic', style = config.characterStyle ?? 'original';
    this.actors = this.actors.filter(a => a.root.parent !== null);
    if (!this.custom && (theme !== this.theme || revision !== this.stageRevision)) { this.theme = theme; this.stageRevision = revision; this.buildWorld(theme); this.recolor(theme); }
    for (const actor of this.actors) {
      if (actor.style !== style) { actor.style = style; free(actor.variant); actor.originals.forEach(o => { o.visible = style === 'original' && !o.userData.unityFallback; }); if (style !== 'original') this.buildActor(actor, style); }
      actor.variant.position.y = reduced || actor.kind !== 'person' ? 0 : Math.sin(this.elapsed * 12) * .035;
      actor.variant.traverse(o => { if (o.userData.limb) o.rotation.x = reduced ? 0 : Math.sin(this.elapsed * 12 + o.userData.limb) * .45; });
    }
    if (!this.indoor) this.scenery.position.set(origin.x, 0, origin.z);
    const weather = this.customWeather ? 'clear' : config.weather ?? 'clear'; if (weather !== this.weather) { this.weather = weather; this.buildWeather(weather); }
    if (this.particles) {
      this.particles.visible = !reduced;
      const speed = weather === 'rain' ? 18 : weather === 'embers' ? -1.3 : 1.8;
      for (let i = 0; i < 480; i++) { const k = i * 3; this.pointPositions[k] = Math.sin(i * 127.13) * 22 + Math.sin(this.elapsed * .5 + i) * .6; this.pointPositions[k + 1] = ((i * .73 - this.elapsed * speed) % 17 + 17) % 17; this.pointPositions[k + 2] = Math.cos(i * 73.27) * 22; }
      this.particles.position.set(origin.x, 0, origin.z); this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }
  private buildWorld(theme: string) {
    free(this.scenery); if (this.sky) { this.sky.dispose(); this.sky = null; }
    if (!(theme in THEMES)) { this.scene.background = this.originalBackground; this.scene.fog = this.baseFog ?? new T.Fog(this.indoor ? '#c9d9d5' : '#c1e4ef', 55, 160); if (!this.baseFog) this.sun.color.set('#fff1db'); return; }
    const t = THEMES[theme as keyof typeof THEMES], c = document.createElement('canvas'); c.width = 16; c.height = 256; const ctx = c.getContext('2d')!, g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, t.sky); g.addColorStop(1, t.horizon); ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
    this.sky = new T.CanvasTexture(c); this.sky.colorSpace = T.SRGBColorSpace; this.scene.background = this.sky; this.scene.fog = new T.Fog(t.horizon, 40, 125); this.sun.color.set(t.light);
    if (this.indoor) {
      for (const x of [-5.5, 5.5]) for (const z of [-3, 0, 3]) { box(this.scenery, mat(t.rock), x, 1.5, z, .12, 3, .12); box(this.scenery, mat(t.accent, .25, t.accent), x, 3, z, .6, .08, .6); }
      if (theme === 'alpine') { for (const x of [-4, 4]) { box(this.scenery, mat('#725344'), x, 2, -5, .22, 4, .3); for (let i = 0; i < 3; i++) { const pine = new T.Mesh(new T.ConeGeometry(1.3 - i * .25, 1.8, 6), mat(i === 2 ? '#effaff' : '#4f8e81')); pine.position.set(x, 1 + i * .8, -6.7); this.scenery.add(pine); } } box(this.scenery, mat('#b88d69'), 0, 3.45, -4.7, 12, .3, .35); }
      else if (theme === 'neon') { for (let i = 0; i < 12; i++) box(this.scenery, mat(i % 2 ? '#8d75ff' : t.accent, .3, i % 2 ? '#8252ff' : t.accent), i - 5.5, .055, 0, .025, .012, 9.6); for (const x of [-3.3, 3.3]) { const portal = new T.Mesh(new T.TorusGeometry(.7, .035, 6, 40), mat(t.accent, .2, t.accent)); portal.position.set(x, 2.4, -4.98); this.scenery.add(portal); } }
      else { for (const x of [-4.5, -3, 3, 4.5]) { box(this.scenery, mat(t.rock), x, 1.8, -4.9, .5, 3.6, .5); box(this.scenery, mat(t.accent, .3, t.accent), x, 2, -4.61, .12, 2.8, .04); } }
      return;
    }
    const stone = mat(t.rock), accent = mat(t.accent, .25, theme === 'neon' || theme === 'volcanic' ? t.accent : undefined);
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1, x = side * (12 + i % 4 * 5), z = 20 - Math.floor(i / 2) * 12, h = 7 + i % 5 * 3;
      if (theme === 'neon') {
        box(this.scenery, stone, x, h / 2 - 3, z, 4 + i % 3, h, 4);
        for (let y = 0; y < h - 1; y += 1.7) box(this.scenery, accent, x, y - 2, z + 2.02, 3.4, .09, .05);
        box(this.scenery, accent, x + 2.1, h / 2 - 3, z + 2.02, .09, h, .09);
      } else {
        const mountain = new T.Mesh(new T.ConeGeometry(5 + i % 3, h, 5), stone); mountain.position.set(x, h / 2 - 4, z); mountain.rotation.y = i; mountain.castShadow = true; this.scenery.add(mountain);
        const cap = new T.Mesh(new T.ConeGeometry(2.2, h * .4, 5), accent); cap.position.set(x, h * .8 - 4, z); cap.rotation.y = i; this.scenery.add(cap);
        if (theme === 'alpine') for (let p = 0; p < 3; p++) { const tree = new T.Mesh(new T.ConeGeometry(1.5 - p * .3, 2.1, 6), mat(p === 2 ? '#eefaff' : '#407d78')); tree.position.set(x - side * 3.5, p * .9, z + 3); this.scenery.add(tree); }
        else box(this.scenery, accent, x, -2.5, z + 3, 9, .15, .7);
      }
    }
  }
  private recolor(theme: string) {
    const done = new Set<T.Material>(); this.scene.traverse(o => {
      if (!(o instanceof T.Mesh) || o instanceof T.InstancedMesh && o.userData.preserveColor) return;
      let p: T.Object3D | null = o; while (p) { if (p.userData.character || p.userData.remix) return; p = p.parent; }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(m instanceof T.MeshStandardMaterial) || done.has(m)) continue; done.add(m);
        m.userData.originalColor ??= m.color.clone(); const original = m.userData.originalColor as T.Color; m.color.copy(original);
        if (!(theme in THEMES)) continue;
        const t = THEMES[theme as keyof typeof THEMES], hsl = { h: 0, s: 0, l: 0 }; original.getHSL(hsl);
        if (hsl.l < .11 || m.transparent) continue;
        const target = new T.Color(hsl.l > .55 ? t.ground : t.rock); m.color.lerp(target, theme === 'alpine' ? .82 : .76);
        if (theme === 'neon' && hsl.s > .45) { m.emissive.set(t.accent); m.emissiveIntensity = .12; } else { m.emissiveIntensity = 0; }
      }
    });
  }
  private buildActor(a: Actor, style: string) {
    const root = a.variant, chrome = mat(style === 'armored' ? '#35384e' : '#e4ecf2', .6), dark = mat('#19273e', .35), glow = mat(style === 'armored' ? '#ffb654' : '#52e5ed', .2, style === 'armored' ? '#ff8a37' : '#22cbd9');
    if (a.kind === 'person') {
      // One rig, many outfits: body colours plus a headpiece and accessories per style.
      const outfits: Record<string, { body: string; trim: string; skin: string; head: 'helmet' | 'bubble' | 'box' | 'hood' | 'visor' | 'wraps' }> = {
        robot: { body: '#e4ecf2', trim: '#52e5ed', skin: '#e4ecf2', head: 'box' }, astronaut: { body: '#f3f5fa', trim: '#ff8a3d', skin: '#f3f5fa', head: 'bubble' },
        armored: { body: '#35384e', trim: '#ffb654', skin: '#35384e', head: 'box' }, skater: { body: '#ff5a8a', trim: '#2fe0c8', skin: '#f2c7a5', head: 'helmet' },
        ninja: { body: '#1b1d29', trim: '#e3202f', skin: '#1b1d29', head: 'hood' }, knight: { body: '#b9c2cf', trim: '#2d6be0', skin: '#b9c2cf', head: 'visor' },
        mummy: { body: '#e8dcc0', trim: '#c8b48e', skin: '#e8dcc0', head: 'wraps' },
      };
      const o = outfits[style] ?? outfits.robot, suit = mat(o.body, style === 'robot' || style === 'knight' || style === 'armored' ? .6 : 0), trimMat = mat(o.trim, .2, style === 'robot' || style === 'armored' ? o.trim : undefined), skinMat = mat(o.skin);
      box(root, suit, 0, 1.08, 0, .74, .7, .43); box(root, trimMat, 0, 1.15, -.24, .35, .16, .05);
      if (o.head === 'bubble') { ball(root, suit, 0, 1.76, 0, .39); const visor = ball(root, mat('#203453', .7), 0, 1.77, -.2, .3); visor.scale.set(1, .7, .6); box(root, dark, 0, 1.09, .32, .55, .67, .32); }
      else if (o.head === 'helmet') { ball(root, skinMat, 0, 1.74, 0, .3); const shell = ball(root, trimMat, 0, 1.84, .02, .33); shell.scale.set(1, .7, 1.05); box(root, dark, 0, 1.36, .28, .5, .55, .14); }
      else if (o.head === 'hood') { ball(root, suit, 0, 1.76, 0, .33); box(root, skinMat, 0, 1.78, -.27, .42, .1, .06); box(root, mat('#f2c7a5'), 0, 1.78, -.29, .36, .07, .03); const tail = box(root, trimMat, .1, 1.72, .38, .1, .08, .55); tail.rotation.x = -.5; box(root, trimMat, 0, 1.92, 0, .7, .08, .7); }
      else if (o.head === 'visor') { box(root, suit, 0, 1.78, 0, .55, .55, .5); box(root, dark, 0, 1.8, -.26, .45, .07, .03); const plume = box(root, trimMat, 0, 2.15, .05, .08, .3, .45); plume.rotation.x = .2; box(root, trimMat, 0, 1.1, -.24, .5, .5, .04); }
      else if (o.head === 'wraps') { ball(root, suit, 0, 1.76, 0, .33); for (let k = 0; k < 4; k++) { const band = box(root, trimMat, 0, 1.6 + k * .1, 0, .67, .035, .67); band.rotation.y = k * .3; } for (const side of [-1, 1]) ball(root, mat('#ffd23f', .2, '#ff9a1f'), side * .12, 1.78, -.3, .05); }
      else { box(root, suit, 0, 1.78, 0, .6, .5, .47); box(root, dark, 0, 1.8, -.25, .52, .18, .06); box(root, trimMat, 0, 1.8, -.29, .4, .05, .02); if (style === 'robot') box(root, trimMat, .19, 2.18, 0, .05, .4, .05); else for (const x of [-.36, .36]) { const horn = new T.Mesh(new T.ConeGeometry(.12, .45, 5), trimMat); horn.position.set(x, 2, 0); root.add(horn); } }
      if (style === 'skater') { const board = box(root, mat('#2a2a35'), 0, .05, 0, .3, .05, 1.1); board.position.y = .03; for (const z of [-.38, .38]) for (const x of [-.12, .12]) ball(root, trimMat, x, .0, z, .05); }
      for (const side of [-1, 1]) { const leg = new T.Group(); leg.position.set(side * .21, .72, 0); root.add(leg); leg.userData.limb = side; box(leg, style === 'skater' ? dark : suit, 0, -.24, 0, .26, .55, .28); box(leg, style === 'ninja' ? suit : trimMat, 0, -.58, -.07, .3, .18, .42); const arm = new T.Group(); arm.position.set(side * .5, 1.35, 0); root.add(arm); arm.userData.limb = -side; ball(arm, suit, 0, -.05, 0, .2); box(arm, style === 'mummy' ? trimMat : suit, 0, -.32, 0, .24, .48, .25); }
    } else if (a.kind === 'vehicle') {
      box(root, dark, 0, -.05, 0, 3.4, .3, 1.85); box(root, chrome, -.1, .45, 0, 3.25, .75, 1.9); box(root, dark, -.35, 1.07, 0, 1.7, .65, 1.75); box(root, glow, .4, 1.07, 0, .08, .39, 1.79); for (const z of [-.78, .78]) { box(root, glow, 1.59, .55, z, .08, .2, .22); box(root, chrome, -.4, 1.5, z, 1.3, .16, .17); } if (style === 'robot') for (const z of [-.5, .5]) box(root, glow, -1.8, .25, z, .5, .3, .3);
    } else if (a.kind === 'vacuum') {
      const body = new T.Mesh(new T.CylinderGeometry(.39, .41, .25, style === 'robot' ? 8 : 32), chrome); body.position.y = .2; root.add(body); const ring = new T.Mesh(new T.TorusGeometry(.39, .035, 6, 40), glow); ring.rotation.x = Math.PI / 2; ring.position.y = .29; root.add(ring); box(root, dark, 0, .38, -.02, .23, .14, .19); box(root, glow, 0, .4, .085, .15, .04, .025); if (style === 'armored') for (const side of [-1, 1]) box(root, dark, side * .39, .15, 0, .18, .27, .56);
    } else if (a.kind === 'snake') {
      const hood = ball(root, chrome, 0, .55, 0, .52); hood.scale.set(.9, 1.1, .7); for (const side of [-1, 1]) { ball(root, glow, side * .2, .74, -.29, .085); if (style === 'robot') box(root, glow, side * .4, .5, 0, .13, .62, .15); } box(root, dark, 0, .4, -.38, .32, .09, .2);
    } else { box(root, dark, 0, .25, 0, .85, .4, .8); box(root, chrome, 0, .7, 0, .7, .55, .65); box(root, glow, .4, .8, 0, .2, .22, .4); }
  }
  private buildWeather(weather: string) {
    if (this.particles) { this.scene.remove(this.particles); free(this.particles); this.particles = null; }
    if (weather === 'clear') return;
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(this.pointPositions, 3));
    this.particles = new T.Points(geometry, new T.PointsMaterial({ color: weather === 'embers' ? '#ffad55' : weather === 'rain' ? '#a1dcff' : '#ffffff', size: weather === 'rain' ? .055 : .09, transparent: true, opacity: .8, depthWrite: false, sizeAttenuation: true })); this.particles.frustumCulled = false; this.scene.add(this.particles);
  }
  dispose() { free(this.scenery); for (const a of this.actors) free(a.variant); if (this.sky) this.sky.dispose(); if (this.originalBackground instanceof T.Texture && this.scene.background !== this.originalBackground) this.originalBackground.dispose(); if (this.particles) { this.scene.remove(this.particles); free(this.particles); } }
}
