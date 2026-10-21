import * as T from 'three';
import type { WorldWeather } from './weather';

/** The light and air of a world theme: sky gradient, fog, sun and fill light. */
export interface WorldLook { sky: readonly [string, string, string]; fog: readonly [string, number, number]; sun: readonly [string, number]; hemi: readonly [string, string, number]; stars?: boolean }

export function skyTexture(look: WorldLook): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d')!, gradient = g.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, look.sky[0]); gradient.addColorStop(.6, look.sky[1]); gradient.addColorStop(1, look.sky[2]); g.fillStyle = gradient; g.fillRect(0, 0, 64, 512);
  if (look.stars) for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(255,255,255,${.3 + (i % 5) * .14})`; g.fillRect((i * 37) % 64, (i * 53) % 300, 1, 1); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
/** Applies a look to the scene and hands its fog to the weather. Returns the sky texture so the caller can dispose it later. */
export function applyLook(scene: T.Scene, sun: T.DirectionalLight, look: WorldLook, weather: WorldWeather): T.CanvasTexture {
  const sky = skyTexture(look); scene.background = sky;
  const hemi = scene.children.find((o): o is T.HemisphereLight => o instanceof T.HemisphereLight);
  if (hemi) { hemi.color.set(look.hemi[0]); hemi.groundColor.set(look.hemi[1]); hemi.intensity = look.hemi[2]; hemi.userData.base = look.hemi[2]; }
  sun.color.set(look.sun[0]); sun.intensity = look.sun[1]; sun.userData.base = look.sun[1];
  weather.setBaseFog(look.fog[0], look.fog[1], look.fog[2]); return sky;
}
/** Dims the lights for gloomy weather and adds lightning flashes; call every frame after `weather.update`. */
export function weatherLight(scene: T.Scene, sun: T.DirectionalLight, weather: WorldWeather) {
  const hemi = scene.children.find((o): o is T.HemisphereLight => o instanceof T.HemisphereLight);
  if (hemi) hemi.intensity = (hemi.userData.base ?? hemi.intensity) * (1 - weather.gloom * .35) + weather.flash * 1.5;
  sun.intensity = (sun.userData.base ?? sun.intensity) * (1 - weather.gloom * .5) + weather.flash * 2;
}
/**
 * Repaints a game's own materials for a theme. Each pair maps an original colour to a new one; materials remember
 * their original colour, so switching themes (or back to classic) is lossless.
 */
export function recolor(root: T.Object3D, pairs: readonly (readonly [string, string])[]) {
  const from = pairs.map(([a, b]) => [new T.Color(a), new T.Color(b)] as const), seen = new Set<T.Material>();
  root.traverse(o => {
    if (!(o instanceof T.Mesh) || o.userData.keepColor) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!(m instanceof T.MeshStandardMaterial) || seen.has(m)) continue; seen.add(m);
      const original = (m.userData.original ??= m.color.clone()) as T.Color; m.color.copy(original);
      let best = .045, to: T.Color | null = null;
      for (const [a, b] of from) { const d = Math.abs(a.r - original.r) + Math.abs(a.g - original.g) + Math.abs(a.b - original.b); if (d < best) { best = d; to = b; } }
      if (to) m.color.copy(to);
    }
  });
}
/**
 * Repaints a canvas texture by brightness: every pixel keeps its light and shade but takes the new colour.
 * Turns green pixel grass into sand, snow or ash while keeping the pattern. Non-canvas textures are returned as is.
 */
export function tintTexture(texture: T.Texture, color: string): T.Texture {
  const image = texture.image as HTMLCanvasElement | undefined; if (!image || !('getContext' in image)) return texture;
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; const g = c.getContext('2d', { willReadFrequently: true }); if (!g) return texture;
  g.drawImage(image, 0, 0); const data = g.getImageData(0, 0, c.width, c.height), px = data.data, [r, gr, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  for (let i = 0; i < px.length; i += 4) { const l = Math.min(1.25, (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) / 150); px[i] = Math.min(255, r * l); px[i + 1] = Math.min(255, gr * l); px[i + 2] = Math.min(255, b * l); }
  g.putImageData(data, 0, 0); const out = new T.CanvasTexture(c); out.colorSpace = texture.colorSpace; out.magFilter = texture.magFilter; out.minFilter = texture.minFilter; out.wrapS = texture.wrapS; out.wrapT = texture.wrapT; out.repeat.copy(texture.repeat); out.generateMipmaps = texture.generateMipmaps; return out;
}
