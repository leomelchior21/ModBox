import { HERO_HEIGHT, HERO_WIDTH, LAVA_Y, type DevilFloorRun, type Platform } from './run';
import type { FloorEffects } from './effects';

export const FLOOR_COLORS: Record<string, string> = { amber: '#ffd28a', violet: '#c1a0ff', cyan: '#8cf6ed', lime: '#dcf5a4' };
const TAU = Math.PI * 2;
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function polygon(ctx: CanvasRenderingContext2D, points: readonly number[][]): void {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, color); light.addColorStop(1, '#00000000'); ctx.fillStyle = light;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
export function floorViewport(run: DevilFloorRun, width: number, height: number) {
  const scale = Math.max(0.9, Math.min((height - 80) / 540, width / 430, 1.4));
  const viewWidth = width / scale;
  return { scale, viewWidth, offsetY: Math.max(height - 76 - LAVA_Y * scale, 90 - run.player.y * scale),
    scrollX: Math.max(0, Math.min(run.cavern.width - viewWidth, run.player.x - viewWidth * 0.32)) };
}

function cathedral(ctx: CanvasRenderingContext2D, viewWidth: number, scrollX: number, time: number): void {
  const moonX = viewWidth * 0.7 - scrollX * 0.025;
  glow(ctx, moonX, 235, 200, '#e8682824');
  ctx.strokeStyle = '#b56a4620'; ctx.lineWidth = 1;
  for (const radius of [66, 76, 83]) { ctx.beginPath(); ctx.arc(moonX, 230, radius, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#cc805128'; ctx.beginPath(); ctx.arc(moonX, 230, 57, 0, TAU); ctx.fill();
  ctx.fillStyle = '#121918'; ctx.beginPath(); ctx.arc(moonX - 10, 218, 55, 0, TAU); ctx.fill();
  const drift = scrollX * 0.18, first = Math.floor(drift / 180) - 1;
  for (let i = first; i < first + Math.ceil(viewWidth / 180) + 3; i++) {
    const x = i * 180 - drift, roof = 122 + noise(i + 9) * 40;
    ctx.fillStyle = '#15201c'; ctx.fillRect(x, roof, 34, 410);
    ctx.fillStyle = '#263026'; ctx.fillRect(x, roof, 4, 360); ctx.fillRect(x - 4, roof + 17, 42, 9);
    ctx.fillStyle = '#18221c'; ctx.fillRect(x + 20, roof + 24, 10, 300);
    ctx.lineWidth = 14; ctx.strokeStyle = '#1b261f';
    ctx.beginPath(); ctx.moveTo(x + 34, 368); ctx.lineTo(x + 34, roof + 85);
    ctx.bezierCurveTo(x + 34, roof + 44, x + 89, roof + 20, x + 89, roof - 5);
    ctx.bezierCurveTo(x + 89, roof + 20, x + 144, roof + 44, x + 144, roof + 85); ctx.lineTo(x + 144, 368); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#57604730';
    ctx.beginPath(); ctx.moveTo(x + 42, 342); ctx.lineTo(x + 42, roof + 88); ctx.quadraticCurveTo(x + 43, roof + 61, x + 89, roof + 12);
    ctx.quadraticCurveTo(x + 134, roof + 61, x + 136, roof + 88); ctx.lineTo(x + 136, 342); ctx.stroke();
    for (let j = 0; j < 10; j++) { const y = roof + 30 + j * 27; ctx.strokeStyle = '#41513b23'; ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 31, y); ctx.stroke(); }
    const candleY = 304 + Math.sin(time * 1.2 + i) * 2;
    glow(ctx, x + 17, candleY, 45, '#ff89342b');
    ctx.fillStyle = '#b38457'; ctx.fillRect(x + 13, candleY + 5, 9, 5);
    ctx.fillStyle = '#ffcb7b'; polygon(ctx, [[x + 17, candleY - 8], [x + 21, candleY + 4], [x + 14, candleY + 4]]); ctx.fill();
  }
  const rockDrift = scrollX * 0.38, start = Math.floor(rockDrift / 140) - 1;
  for (let i = start; i < start + Math.ceil(viewWidth / 140) + 3; i++) {
    const x = i * 140 - rockDrift, y = 345 + noise(i) * 45;
    ctx.fillStyle = '#18211d'; polygon(ctx, [[x - 30, 500], [x + 12, y + 36], [x + 46, y], [x + 100, y + 15], [x + 155, 500]]); ctx.fill();
    ctx.strokeStyle = '#9d5a3438'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 46, y + 6); ctx.lineTo(x + 52, y + 56); ctx.lineTo(x + 36, y + 80); ctx.lineTo(x + 48, 490); ctx.stroke();
  }
}

function platform(ctx: CanvasRenderingContext2D, p: Platform, run: DevilFloorRun, time: number, reducedMotion: boolean): void {
  const heat = run.config.safeFloor ? 0 : Math.min(1, (run.platformHeat.get(p.id) ?? 0) / run.config.meltDelay);
  const jitter = heat > 0.72 && !reducedMotion ? Math.sin(time * 38 + p.id) * heat * 0.75 : 0;
  ctx.save(); ctx.translate(p.x + jitter, p.y);
  if (p.id > 0) {
    ctx.strokeStyle = '#78827336'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
    for (const x of [14, p.width - 14]) { ctx.beginPath(); ctx.moveTo(x, -180); ctx.lineTo(x, 8); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  const stone = ctx.createLinearGradient(0, 0, 0, 45);
  stone.addColorStop(0, '#4a5140'); stone.addColorStop(0.3, '#303b30'); stone.addColorStop(1, '#121c18');
  ctx.fillStyle = stone; polygon(ctx, [[0, 0], [p.width, 0], [p.width - 7, 30], [p.width - 29, 43], [p.width * 0.6, 34], [22, 44], [5, 27]]); ctx.fill();
  ctx.fillStyle = '#212c23'; polygon(ctx, [[9, 13], [p.width * 0.25, 8], [p.width * 0.32, 28], [20, 36]]); ctx.fill();
  ctx.fillStyle = '#18251e'; polygon(ctx, [[p.width * 0.52, 14], [p.width - 13, 7], [p.width - 24, 31], [p.width * 0.61, 30]]); ctx.fill();
  ctx.strokeStyle = '#76806750'; ctx.lineWidth = 1; ctx.strokeRect(6, 5, p.width - 12, 16);
  ctx.fillStyle = heat > 0.65 ? '#ff9b60' : run.config.safeFloor ? '#d2e3a9' : '#b3b08b'; ctx.fillRect(0, 0, p.width, 3);
  ctx.fillStyle = '#7d7354'; ctx.fillRect(4, 3, p.width - 8, 2);
  for (let i = 0; i < p.width / 18; i++) {
    const x = 10 + i * 18, y = 9 + noise(i + p.id * 19) * 13;
    ctx.strokeStyle = '#07130a60'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y + 2); ctx.lineTo(x + 6, y + 10); ctx.stroke();
  }
  for (const x of [9, p.width - 12]) { ctx.fillStyle = '#b2a878'; ctx.fillRect(x, 7, 3, 3); }
  if (p.id > 0) {
    ctx.fillStyle = '#b8b08450'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText(`0${p.id}`.slice(-2), p.width / 2, 17);
    ctx.fillStyle = heat > 0.6 ? '#ff8652' : '#878d69'; ctx.fillRect(23, 26, (p.width - 46) * (1 - heat), 2);
  }
  if (heat > 0.12) {
    ctx.strokeStyle = `rgba(255,117,54,${heat * 0.9})`; ctx.shadowColor = '#ff692d'; ctx.shadowBlur = heat * 8; ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { const x = p.width * i / 6; ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x - 7, heat * 18); ctx.lineTo(x + 2, heat * 33); ctx.stroke(); }
    ctx.shadowBlur = 0; glow(ctx, p.width / 2, 0, p.width * 0.6, `rgba(255,103,37,${heat * 0.12})`);
  }
  if (p.spike) {
    ctx.fillStyle = '#7d6454'; polygon(ctx, [[65, 0], [79, -18], [93, 0]]); ctx.fill();
    ctx.fillStyle = '#e7a58a'; polygon(ctx, [[65, 0], [79, -18], [76, 0]]); ctx.fill();
    ctx.strokeStyle = '#ff7756'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(79, -16); ctx.lineTo(91, -1); ctx.stroke();
    ctx.fillStyle = '#e69b75'; ctx.font = '7px monospace'; ctx.fillText('!', 80, 18);
  }
  if (p.checkpoint && p.id > 0 && run.config.checkpoints) {
    const active = p.id <= run.checkpoint, light = active ? '#e5efab' : '#a19475';
    ctx.fillStyle = '#505b46'; polygon(ctx, [[11, 0], [13, -39], [20, -52], [27, -39], [29, 0]]); ctx.fill();
    ctx.fillStyle = '#202c22'; polygon(ctx, [[20, -47], [26, -37], [26, -3], [20, -3]]); ctx.fill();
    ctx.strokeStyle = light; ctx.lineWidth = 1.5; polygon(ctx, [[20, -36], [25, -28], [20, -20], [15, -28]]); ctx.stroke();
    ctx.fillStyle = light; ctx.fillRect(19, -17, 2, 9);
    if (active) { glow(ctx, 20, -28, 48, '#ddec982a'); ctx.fillStyle = '#e5efab'; ctx.beginPath(); ctx.arc(20, -28, 3, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function hero(ctx: CanvasRenderingContext2D, run: DevilFloorRun, color: string, time: number, reducedMotion: boolean, effects?: FloorEffects): void {
  const { x, y, vx, vy } = run.player, grounded = run.grounded !== null;
  const stride = grounded && vx && !reducedMotion ? Math.sin(time * 18) : 0;
  const squash = effects?.squash ?? 0;
  const stretch = reducedMotion ? 0 : !grounded ? Math.min(0.09, Math.abs(vy) / 5500) : -squash * 0.15;
  ctx.save(); ctx.translate(x + HERO_WIDTH / 2, y + HERO_HEIGHT); ctx.scale(1 - stretch, 1 + stretch); ctx.translate(-HERO_WIDTH / 2, -HERO_HEIGHT);
  if (run.invulnerable > 0) { ctx.strokeStyle = '#fff7d066'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(11, 15, 17, 22, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#aa4a37';
  const flutter = reducedMotion ? 0 : Math.sin(time * 10) * 2, back = run.facing > 0 ? 3 : 19;
  polygon(ctx, [[back, 10], [back - run.facing * 16, 12 + flutter], [back - run.facing * 21, 7 + flutter], [back, 7]]); ctx.fill();
  ctx.fillStyle = '#433b2b'; ctx.fillRect(run.facing > 0 ? 0 : 17, 12, 5, 12);
  ctx.fillStyle = '#ebaf61'; ctx.fillRect(run.facing > 0 ? 1 : 18, 14, 3, 6);
  ctx.fillStyle = '#17251e'; ctx.fillRect(4 - stride * 2, 23, 6, 7); ctx.fillRect(12 + stride * 2, 23, 6, 7);
  ctx.fillStyle = '#afa17c'; ctx.fillRect(3 - stride * 2, 27, 7, 3); ctx.fillRect(12 + stride * 2, 27, 7, 3);
  const armor = ctx.createLinearGradient(3, 9, 19, 24); armor.addColorStop(0, color); armor.addColorStop(1, '#6b6647');
  ctx.fillStyle = armor; polygon(ctx, [[4, 10], [18, 10], [20, 16], [16, 25], [6, 25], [2, 16]]); ctx.fill();
  ctx.fillStyle = '#26392a'; ctx.fillRect(8, 13, 6, 9); ctx.fillStyle = '#edcb7d'; ctx.fillRect(10, 15, 2, 4);
  ctx.fillStyle = color; ctx.fillRect(0, 12, 5, 6); ctx.fillRect(17, 12, 5, 6);
  ctx.fillStyle = '#263426'; ctx.fillRect(2, 18, 3, 4); ctx.fillRect(18, 18, 3, 4);
  ctx.fillStyle = '#99805b'; polygon(ctx, [[2, 3], [7, -1], [17, -1], [21, 4], [20, 11], [3, 11]]); ctx.fill();
  ctx.fillStyle = color; polygon(ctx, [[3, 2], [8, 0], [17, 0], [20, 4], [3, 5]]); ctx.fill();
  ctx.fillStyle = '#071c17'; ctx.fillRect(run.facing > 0 ? 7 : 3, 5, 12, 5);
  ctx.fillStyle = '#d9fff0'; ctx.shadowColor = '#9ff3cd'; ctx.shadowBlur = 5; ctx.fillRect(run.facing > 0 ? 11 : 4, 6, 7, 2); ctx.shadowBlur = 0;
  ctx.fillStyle = '#5c4e35'; polygon(ctx, [[2, 4], [0, -5], [6, 2]]); ctx.fill(); polygon(ctx, [[16, 2], [22, -5], [21, 5]]); ctx.fill();
  ctx.strokeStyle = '#f3daa1'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(4, 1); ctx.moveTo(21, -3); ctx.lineTo(18, 1); ctx.stroke();
  ctx.restore();
  if (run.config.shield && run.shieldCooldown <= 0) {
    glow(ctx, x + 11, y + 15, 37, '#dcf5a418'); ctx.strokeStyle = '#ddec9eaa'; ctx.lineWidth = 1.2;
    polygon(ctx, [[x + 11, y - 9], [x + 32, y + 3], [x + 32, y + 27], [x + 11, y + 39], [x - 10, y + 27], [x - 10, y + 3]]); ctx.stroke();
  }
}

function feedback(ctx: CanvasRenderingContext2D, effects: FloorEffects, reducedMotion: boolean): void {
  for (const ring of effects.rings) {
    const progress = ring.age / ring.life, radius = reducedMotion ? 18 : 7 + progress * (ring.kind === 'clear' ? 100 : 38);
    ctx.globalAlpha = (1 - progress) * 0.7; ctx.strokeStyle = ring.color; ctx.lineWidth = ring.kind === 'shield' ? 3 : 1.5;
    ctx.beginPath(); ctx.ellipse(ring.x, ring.y, radius, ring.kind === 'land' || ring.kind === 'jump' ? radius * 0.24 : radius, 0, 0, TAU); ctx.stroke();
  }
  for (const p of reducedMotion ? [] : effects.particles) {
    ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.color;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.age * 3); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
  }
  for (const f of effects.floaters) {
    ctx.globalAlpha = Math.min(1, (f.life - f.age) * 3); ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    const y = f.y - (reducedMotion ? 0 : f.age * 24);
    ctx.lineWidth = 3; ctx.strokeStyle = '#101d17'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
}

export function drawFloor(ctx: CanvasRenderingContext2D, run: DevilFloorRun, width: number, height: number, time: number, reducedMotion: boolean, effects?: FloorEffects): void {
  const color = FLOOR_COLORS[run.config.suitColor] ?? FLOOR_COLORS.amber;
  const { scale, offsetY, scrollX, viewWidth } = floorViewport(run, width, height);
  const clock = reducedMotion ? 0 : time;
  const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, '#0b1815'); sky.addColorStop(0.55, '#18211b'); sky.addColorStop(1, '#522b20');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  const shake = reducedMotion ? 0 : effects?.shake ?? 0;
  ctx.save(); ctx.translate(Math.sin(clock * 93) * shake, offsetY + Math.cos(clock * 77) * shake * 0.55); ctx.scale(scale, scale);
  cathedral(ctx, viewWidth, scrollX, clock);
  ctx.fillStyle = '#0a1713';
  for (let i = -1; i < viewWidth / 70 + 2; i++) {
    const x = i * 70 - scrollX * 0.08 % 70, length = 15 + noise(i + 5) * 50;
    polygon(ctx, [[x - 20, -offsetY / scale], [x + 70, -offsetY / scale], [x + 55, 68 + length], [x + 31, 40], [x + 12, 62 + length]]); ctx.fill();
  }
  ctx.translate(-scrollX, 0);
  glow(ctx, scrollX + viewWidth * 0.5, 520, viewWidth * 0.8, '#ff793023');
  const lava = ctx.createLinearGradient(0, LAVA_Y, 0, 570); lava.addColorStop(0, '#ffdb7e'); lava.addColorStop(0.08, '#f9a54e'); lava.addColorStop(0.35, '#d9632d'); lava.addColorStop(1, '#582e23');
  ctx.fillStyle = lava; ctx.fillRect(scrollX, LAVA_Y, viewWidth, Math.max(160, height / scale));
  for (let j = 0; j < 4; j++) {
    ctx.strokeStyle = j ? '#ffc66c30' : '#fff2b2'; ctx.lineWidth = j ? 1 : 2.5; ctx.beginPath();
    for (let x = scrollX - 5; x < scrollX + viewWidth + 10; x += 8) {
      const y = LAVA_Y + j * 13 + Math.sin(x * 0.04 + clock * (j ? 0.8 : 1.6)) * (j ? 3 : 2);
      if (x === scrollX - 5) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = Math.floor(scrollX / 48) - 1; i < (scrollX + viewWidth) / 48 + 1; i++) {
    const x = i * 48 + noise(i) * 24, y = LAVA_Y + 9 + noise(i + 4) * 58;
    ctx.fillStyle = '#472b24'; polygon(ctx, [[x - 12, y], [x - 7, y - 3], [x + 13, y - 2], [x + 21, y + 4], [x + 5, y + 9], [x - 11, y + 6]]); ctx.fill();
    ctx.strokeStyle = '#ffb65b8c'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  for (const p of run.cavern.platforms) if (p.x + p.width >= scrollX - 30 && p.x <= scrollX + viewWidth + 30 && !run.collapsed.has(p.id)) platform(ctx, p, run, clock, reducedMotion);
  for (const crystal of run.cavern.crystals) {
    if (run.collected.has(crystal.id) || crystal.x < scrollX - 30 || crystal.x > scrollX + viewWidth + 30) continue;
    const y = crystal.y + Math.sin(clock * 2.5 + crystal.id) * (reducedMotion ? 0 : 3), w = reducedMotion ? 8 : 6 + Math.cos(clock * 2 + crystal.id) * 2;
    glow(ctx, crystal.x, y, 34, '#7ee6cd22'); ctx.strokeStyle = '#85cfb24a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(crystal.x, y + 20, 15, 4, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#84dac3'; polygon(ctx, [[crystal.x, y - 13], [crystal.x + w, y], [crystal.x, y + 13], [crystal.x - w, y]]); ctx.fill();
    ctx.fillStyle = '#e0ffdf'; polygon(ctx, [[crystal.x, y - 13], [crystal.x, y + 4], [crystal.x - w, y]]); ctx.fill();
    ctx.strokeStyle = '#bffff1'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#e7ffda'; ctx.fillRect(crystal.x + 12, y - 7, 1, 4); ctx.fillRect(crystal.x + 10.5, y - 5.5, 4, 1);
  }
  for (const fire of run.fireballs()) {
    if (fire.x < scrollX - 35 || fire.x > scrollX + viewWidth + 35) continue;
    glow(ctx, fire.x, fire.y, 52, '#ff87303b');
    for (let i = 4; i > 0; i--) { ctx.fillStyle = `rgba(247,118,46,${0.15 + (4 - i) * 0.08})`; ctx.beginPath(); ctx.arc(fire.x + Math.sin(clock * 6 + i) * 3, fire.y + i * 7, 12 - i * 1.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ed6c33'; ctx.beginPath(); ctx.arc(fire.x, fire.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffbd68'; ctx.beginPath(); ctx.arc(fire.x - 2, fire.y - 3, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff0ae'; ctx.beginPath(); ctx.arc(fire.x - 3, fire.y - 5, 3, 0, TAU); ctx.fill();
  }
  const exit = run.cavern.exit;
  if (exit.x >= scrollX - 80 && exit.x < scrollX + viewWidth + 80) {
    glow(ctx, exit.x, exit.y - 43, 100, '#dceb8b25');
    ctx.fillStyle = '#505a3e'; ctx.fillRect(exit.x - 40, exit.y - 83, 10, 83); ctx.fillRect(exit.x + 30, exit.y - 83, 10, 83);
    ctx.strokeStyle = '#808b5b'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(exit.x, exit.y - 40, 37, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = '#ddeb9d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(exit.x, exit.y - 38, 28, 36, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#bfd98925'; ctx.beginPath(); ctx.ellipse(exit.x, exit.y - 38, 25, 33, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) { const angle = i * TAU / 7 + clock * 0.25; ctx.fillStyle = '#e6f0ae'; ctx.fillRect(exit.x + Math.cos(angle) * 25 - 1, exit.y - 38 + Math.sin(angle) * 32 - 1, 2, 2); }
    ctx.fillStyle = '#e5efb2'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('SANCTUARY', exit.x, exit.y - 93);
  }
  if (effects && !reducedMotion) for (const point of effects.trail) {
    ctx.globalAlpha = (1 - point.age / 0.22) * 0.18; ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(point.x, point.y, 5, 10, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const ground = run.grounded === null ? null : run.cavern.platforms[run.grounded];
  if (ground) { ctx.fillStyle = '#07120ba0'; ctx.beginPath(); ctx.ellipse(run.player.x + 11, ground.y + 1, 13, 2.5, 0, 0, TAU); ctx.fill(); }
  hero(ctx, run, color, clock, reducedMotion, effects);
  if (effects) feedback(ctx, effects, reducedMotion);
  if (!reducedMotion) for (let i = 0; i < 20; i++) {
    const x = scrollX + (noise(i * 3) * viewWidth + Math.sin(clock * 0.4 + i) * 10 + viewWidth) % viewWidth;
    const y = LAVA_Y - (clock * (8 + noise(i) * 12) + noise(i + 7) * 280) % 300;
    ctx.globalAlpha = (1 - (LAVA_Y - y) / 300) * 0.65; ctx.fillStyle = i % 4 ? '#dfa166' : '#ffdf9a'; ctx.fillRect(x, y, i % 3 ? 1 : 2, 2);
  }
  ctx.globalAlpha = 1; ctx.restore();
  const vignette = ctx.createRadialGradient(width / 2, height * 0.5, width * 0.15, width / 2, height / 2, Math.max(width, height) * 0.75);
  vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#07110e8c'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  if (effects && effects.damage > 0) {
    ctx.strokeStyle = `rgba(255,106,64,${effects.damage * 0.45})`; ctx.lineWidth = 6; ctx.strokeRect(3, 3, width - 6, height - 6);
    ctx.fillStyle = `rgba(192,55,32,${effects.damage * 0.08})`; ctx.fillRect(0, 0, width, height);
  }
}
