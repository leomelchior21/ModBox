import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Models exported by the checked-in Unity studio; procedural meshes cover loading/offline errors. */
export function unityModel(parent: T.Group, name: 'vacuum' | 'truck' | 'tire' | 'cobra' | 'robot' | 'turret', scale = 1, y = 0) {
  const fallback = [...parent.children], holder = new T.Group(); holder.name = `unity:${name}`; parent.add(holder);
  holder.position.y = y; holder.scale.setScalar(scale);
  new GLTFLoader().load(`/models/unity/${name}.glb`, gltf => {
    let root: T.Object3D | null = parent; while (root && !(root instanceof T.Scene)) root = root.parent;
    if (!root || root.userData.disposed) { gltf.scene.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); return; }
    gltf.scene.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = o.receiveShadow = true; } });
    fallback.forEach(o => { o.visible = false; o.userData.unityFallback = true; }); holder.add(gltf.scene); parent.userData.unityLoaded = true;
  }, undefined, () => { parent.userData.unityLoaded = false; });
  return holder;
}
