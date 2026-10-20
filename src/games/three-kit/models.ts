import * as T from 'three';
import { material, mesh, Shapes } from './world';

export function tree(shapes: Shapes, parent: T.Object3D, x: number, z: number, scale = 1, palm = false) {
  const root = new T.Group(); root.position.set(x, -.3, z); root.scale.setScalar(scale); parent.add(root);
  shapes.tube(root, material('#6c6850'), 0, 1.8, 0, .23, 3.8);
  const green = material(palm ? '#368b6f' : '#315f4d');
  if (palm) for (let i = 0; i < 6; i++) { const leaf = mesh(shapes.sphere, green, root, Math.sin(i * 1.047) * 1.1, 3.7, Math.cos(i * 1.047) * 1.1); leaf.scale.set(.4, .13, 1.9); leaf.rotation.y = i * 1.047; leaf.rotation.x = .18; }
  else { shapes.ball(root, green, 0, 4.5, 0, 1.35); shapes.ball(root, material('#43866b'), 1, 3.6, -.5, 1.45); shapes.ball(root, green, -.9, 3.5, .5, 1.35); shapes.ball(root, material('#517f4e'), -.5, 4.1, -.8, 1.3); }
  return root;
}
export function coinModel(shapes: Shapes, parent: T.Object3D, x: number, y: number, z: number) {
  const root = new T.Group(); root.position.set(x, y, z); parent.add(root);
  const gold = material('#ffd16a', .26, .6), coin = shapes.tube(root, gold, 0, 0, 0, .3, .09); coin.rotation.x = Math.PI / 2;
  const edge = mesh(shapes.ring, material('#fff0ac', .3, .3), root); edge.scale.setScalar(.25);
  shapes.cube(root, material('#c58122', .45, .3), 0, 0, -.06, .08, .25, .025, false);
  return root;
}
