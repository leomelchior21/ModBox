import * as T from 'three';
import { material, mesh, Shapes } from './world';

export function runnerModel(shapes: Shapes, paint: T.Material, urban: boolean) {
  const root = new T.Group(), figure = new T.Group(); root.add(figure);
  const skin = material('#e4b18a'), trousers = material(urban ? '#27304f' : '#455448'), boots = material(urban ? '#ff9f63' : '#483b32'), hair = material('#2c252b'), dark = material('#142b3b'), accent = material('#ffca73');
  shapes.cube(figure, paint, 0, 1.05, 0, .62, .65, .36); shapes.ball(figure, skin, 0, 1.67, 0, .26);
  shapes.cube(figure, hair, 0, 1.88, .02, .48, .16, .4);
  shapes.cube(figure, dark, -.1, 1.7, -.236, .07, .055, .025, false); shapes.cube(figure, dark, .1, 1.7, -.236, .07, .055, .025, false);
  shapes.cube(figure, accent, 0, 1.43, -.2, .6, .12, .08);
  shapes.cube(figure, urban ? paint : material('#b68a58'), 0, 1.04, .26, .44, .49, .23);
  if (urban) { shapes.ball(figure, paint, -.29, 1.74, 0, .11); shapes.ball(figure, paint, .29, 1.74, 0, .11); }
  else { const brim = shapes.tube(figure, material('#bf9b68'), 0, 1.9, 0, .38, .06); brim.scale.z *= .9; shapes.tube(figure, accent, 0, 2.0, 0, .25, .19); }
  const legs: T.Group[] = [], arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(side * .18, .76, 0); figure.add(leg); shapes.cube(leg, trousers, 0, -.25, 0, .23, .55, .25); shapes.cube(leg, boots, 0, -.55, -.08, .26, .17, .4); legs.push(leg);
    const arm = new T.Group(); arm.position.set(side * .4, 1.34, 0); figure.add(arm); shapes.cube(arm, paint, 0, -.2, 0, .2, .4, .2); shapes.ball(arm, skin, 0, -.47, 0, .13); arms.push(arm);
  }
  const shield = mesh(new T.SphereGeometry(1.18, 20, 14), new T.MeshBasicMaterial({ color: '#8befff', transparent: true, opacity: .16, depthWrite: false, wireframe: true }), root, 0, 1, 0, false);
  const board = shapes.cube(root, paint, 0, -.02, -.08, .85, .12, 1.8); board.visible = false; shield.visible = false;
  return { root, figure, legs, arms, shield, board };
}
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
