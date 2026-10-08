import { HERO_HEIGHT, HERO_WIDTH, LAVA_Y, type DevilFloorRun } from './run';

export const FLOOR_COLORS: Record<string, string> = { amber: '#ffce72', violet: '#b899ff', cyan: '#73f6ff', lime: '#caff70' };
export function floorViewport(run: DevilFloorRun, width: number, height: number) {
  // Crop the tall cavern on short screens so the hero and hazards stay legible.
  const scale = Math.max(0.65, Math.min((height - 80) / 540, width / 430, 1.4));
  const viewWidth = width / scale;
  return { scale, viewWidth, offsetY: Math.max(height - 76 - LAVA_Y * scale, 90 - run.player.y * scale),
    scrollX: Math.max(0, Math.min(run.cavern.width - viewWidth, run.player.x - viewWidth * 0.32)) };
}

export function drawFloor(ctx: CanvasRenderingContext2D, run: DevilFloorRun, width: number, height: number, time: number, reducedMotion: boolean): void {
  const color = FLOOR_COLORS[run.config.suitColor] ?? FLOOR_COLORS.amber;
  const { scale, offsetY, scrollX, viewWidth } = floorViewport(run, width, height);
  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  backdrop.addColorStop(0, '#100c22'); backdrop.addColorStop(0.65, '#211326'); backdrop.addColorStop(1, '#5b211f');
  ctx.fillStyle = backdrop; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(0, offsetY); ctx.scale(scale, scale);
  // Layered basalt silhouettes move more slowly than the playable foreground.
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#28192e' : '#1c1329';
    for (let i = -1; i < viewWidth / 120 + 2; i++) {
      const x = i * 120 - (scrollX * (layer ? 0.22 : 0.1)) % 120;
      const peak = 150 + Math.sin(i * 4.1 + layer) * 75;
      ctx.beginPath(); ctx.moveTo(x - 40, 500); ctx.lineTo(x + 20, peak); ctx.lineTo(x + 85, peak + 50); ctx.lineTo(x + 170, 500); ctx.closePath(); ctx.fill();
    }
  }
  ctx.translate(-scrollX, 0);
  const lava = ctx.createLinearGradient(0, LAVA_Y, 0, 550);
  lava.addColorStop(0, '#ffcc65'); lava.addColorStop(0.15, '#ff713b'); lava.addColorStop(1, '#b52646');
  ctx.fillStyle = lava; ctx.fillRect(scrollX, LAVA_Y, viewWidth, 120);
  ctx.strokeStyle = '#ffdd86'; ctx.lineWidth = 3; ctx.shadowColor = '#ff793e'; ctx.shadowBlur = reducedMotion ? 0 : 18;
  ctx.beginPath();
  for (let x = scrollX; x <= scrollX + viewWidth + 12; x += 12) {
    const y = LAVA_Y + (reducedMotion ? 0 : Math.sin(x * 0.045 + time * 2) * 3);
    if (x === scrollX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.shadowBlur = 0;
  for (const p of run.cavern.platforms) {
    if (p.x + p.width < scrollX || p.x > scrollX + viewWidth || run.collapsed.has(p.id)) continue;
    const heat = run.config.safeFloor ? 0 : (run.platformHeat.get(p.id) ?? 0) / run.config.meltDelay;
    ctx.fillStyle = '#382736'; ctx.fillRect(p.x, p.y, p.width, 25);
    ctx.fillStyle = '#251c2d'; ctx.beginPath(); ctx.moveTo(p.x, p.y + 25); ctx.lineTo(p.x + p.width * 0.2, p.y + 48);
    ctx.lineTo(p.x + p.width * 0.7, p.y + 39); ctx.lineTo(p.x + p.width, p.y + 25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = heat > 0.65 ? '#ff7960' : run.config.safeFloor ? '#a9e8b0' : '#ac7e75';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = heat > 0.65 && !reducedMotion ? 8 : 0; ctx.fillRect(p.x, p.y, p.width, 3); ctx.shadowBlur = 0;
    if (heat > 0.2) {
      ctx.strokeStyle = '#f77d54'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) { const x = p.x + p.width * i / 5; ctx.beginPath(); ctx.moveTo(x, p.y + 3); ctx.lineTo(x - 7, p.y + heat * 18); ctx.lineTo(x + 3, p.y + heat * 25); ctx.stroke(); }
    }
    if (p.spike) {
      ctx.fillStyle = '#f59b97'; ctx.beginPath(); ctx.moveTo(p.x + 65, p.y); ctx.lineTo(p.x + 79, p.y - 18); ctx.lineTo(p.x + 93, p.y); ctx.closePath(); ctx.fill();
    }
    if (p.checkpoint && p.id > 0 && run.config.checkpoints) {
      ctx.strokeStyle = p.id <= run.checkpoint ? '#b8ffb0' : '#8c748e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x + 20, p.y); ctx.lineTo(p.x + 20, p.y - 48); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(p.x + 20, p.y - 48, 20, 12);
    }
  }
  for (const crystal of run.cavern.crystals) {
    if (run.collected.has(crystal.id) || crystal.x < scrollX - 15 || crystal.x > scrollX + viewWidth + 15) continue;
    const bob = reducedMotion ? 0 : Math.sin(time * 3 + crystal.id) * 3;
    ctx.fillStyle = '#b9f9ff'; ctx.shadowColor = '#64e9ff'; ctx.shadowBlur = reducedMotion ? 0 : 12;
    ctx.beginPath(); ctx.moveTo(crystal.x, crystal.y - 11 + bob); ctx.lineTo(crystal.x + 8, crystal.y + bob);
    ctx.lineTo(crystal.x, crystal.y + 11 + bob); ctx.lineTo(crystal.x - 8, crystal.y + bob); ctx.closePath(); ctx.fill();
  }
  for (const fire of run.fireballs()) {
    if (fire.x < scrollX - 20 || fire.x > scrollX + viewWidth + 20) continue;
    ctx.fillStyle = '#ffd080'; ctx.shadowColor = '#ff673b'; ctx.shadowBlur = reducedMotion ? 0 : 20;
    ctx.beginPath(); ctx.arc(fire.x, fire.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff7e55'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fire.x, fire.y + 10); ctx.lineTo(fire.x + 4, fire.y + 30); ctx.stroke();
  }
  const exit = run.cavern.exit;
  ctx.strokeStyle = '#c7ffad'; ctx.lineWidth = 3; ctx.shadowColor = '#b7ff91'; ctx.shadowBlur = reducedMotion ? 0 : 18;
  ctx.strokeRect(exit.x - 22, exit.y - 65, 44, 65); ctx.fillStyle = '#b7ff911c'; ctx.fillRect(exit.x - 20, exit.y - 63, 40, 61);
  ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#d1ffb3'; ctx.fillText('EXIT', exit.x, exit.y - 75); ctx.shadowBlur = 0;
  const { x, y } = run.player;
  ctx.globalAlpha = run.invulnerable > 0 && !reducedMotion && Math.sin(time * 20) < 0 ? 0.5 : 1;
  if (run.player.vy < 0 && !reducedMotion) {
    ctx.strokeStyle = color; ctx.globalAlpha *= 0.35; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 5, y + HERO_HEIGHT + 3); ctx.lineTo(x + 3, y + HERO_HEIGHT + 18); ctx.stroke(); ctx.globalAlpha *= 1 / 0.35;
  }
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = reducedMotion ? 0 : 9;
  ctx.fillRect(x + 3, y + 11, HERO_WIDTH - 6, 14); ctx.fillRect(x + 1, y + 1, HERO_WIDTH - 2, 12); ctx.shadowBlur = 0;
  ctx.fillStyle = '#261f38'; ctx.fillRect(x + (run.facing > 0 ? 9 : 3), y + 4, 10, 5);
  ctx.fillStyle = '#eef9ff'; ctx.fillRect(x + (run.facing > 0 ? 15 : 3), y + 5, 4, 3);
  const stride = run.grounded !== null && run.player.vx && !reducedMotion ? Math.sin(time * 18) * 3 : 0;
  ctx.fillStyle = color; ctx.fillRect(x + 3 - stride, y + 25, 6, 5); ctx.fillRect(x + 13 + stride, y + 25, 6, 5);
  if (run.config.shield && run.shieldCooldown <= 0) { ctx.strokeStyle = '#bdffc8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + 11, y + 15, 21, 25, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.restore();
  // This strip keeps the end of the route visible without obscuring the jumps.
  ctx.fillStyle = '#ffffff15'; ctx.fillRect(18, 63, Math.max(0, width - 36), 2);
  ctx.fillStyle = color; ctx.fillRect(18, 63, Math.max(0, width - 36) * Math.min(1, run.player.x / run.cavern.exit.x), 2);
}
