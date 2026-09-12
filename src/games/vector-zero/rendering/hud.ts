import { HUD, PALETTE } from '../engine/constants';
import type { CommsEntry } from '../engine/types';

/* ============================================================================
   VECTOR ZERO — HUD (drawn in canvas)
   Keeps gameplay at 60 fps with zero React re-renders, and keeps the HUD in
   the same visual language as the world it floats over.
   ========================================================================== */

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'warn' | 'ok';
  life: number;
  maxLife: number;
}

export interface HudView {
  score: number;
  lives: number;
  wave: number;
  health: number;
  shipName: string;
  weaponLabel: string;
  shield: boolean;
  shieldRatio: number;
  power: number;
  rapidFire: boolean;
  comms: CommsEntry[];
  activeRules: string[];
  toasts: Toast[];
  banner: { text: string; sub: string; life: number; maxLife: number } | null;
  shipNamePulse: number;
}

function shipGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5.5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-5, 5.5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function clipText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: HudView,
): void {
  const pad = HUD.pad;

  ctx.save();
  ctx.textBaseline = 'top';

  /* ------------------------------------------------------------------ score */
  ctx.textAlign = 'left';
  ctx.font = `600 ${HUD.label}px ${HUD.font}`;
  ctx.fillStyle = PALETTE.creamDim;
  ctx.fillText('SCORE', pad, pad);

  ctx.font = `700 ${HUD.value}px ${HUD.font}`;
  ctx.fillStyle = PALETTE.cream;
  ctx.fillText(String(view.score).padStart(5, '0'), pad, pad + 14);

  ctx.font = `600 ${HUD.label}px ${HUD.font}`;
  ctx.fillStyle = PALETTE.creamDim;
  ctx.fillText(`WAVE ${view.wave}`, pad, pad + 46);

  /* --------------------------------------------------------------- shipName */
  ctx.globalAlpha = view.shipNamePulse > 0 ? 1 : 0.75;
  ctx.font = `700 ${HUD.small + 1}px ${HUD.font}`;
  ctx.fillStyle = view.shipNamePulse > 0 ? PALETTE.blueBright : PALETTE.cream;
  const nameText = view.shipName.toUpperCase();
  ctx.fillText(nameText, pad, pad + 64);
  ctx.globalAlpha = 1;

  const nameWidth = ctx.measureText(nameText).width;
  ctx.strokeStyle = PALETTE.blue;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 80);
  ctx.lineTo(pad + Math.max(28, nameWidth), pad + 80);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* ------------------------------------------------------------ health bar */
  const barWidth = 116;
  const barY = pad + 88;
  const health = Math.max(0, Math.min(100, view.health)) / 100;
  ctx.strokeStyle = PALETTE.creamFaint;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, barY, barWidth, 6);
  ctx.fillStyle = health > 0.6 ? PALETTE.blueBright : health > 0.3 ? PALETTE.cream : PALETTE.flare;
  ctx.fillRect(pad + 1, barY + 1, (barWidth - 2) * health, 4);

  ctx.font = `500 ${HUD.label}px ${HUD.font}`;
  ctx.fillStyle = PALETTE.creamDim;
  ctx.fillText('INTEGRITY', pad + barWidth + 8, barY - 3);

  /* ------------------------------------------------------------------ lives */
  ctx.textAlign = 'right';
  ctx.font = `600 ${HUD.label}px ${HUD.font}`;
  ctx.fillStyle = PALETTE.creamDim;
  ctx.fillText('LIVES', width - pad, pad);
  for (let i = 0; i < Math.min(view.lives, 9); i += 1) {
    shipGlyph(ctx, width - pad - 8 - i * 18, pad + 26, PALETTE.cream);
  }

  /* ---------------------------------------------------------------- loadout */
  const loadoutY = pad + 48;
  ctx.font = `500 ${HUD.label}px ${HUD.font}`;
  ctx.fillStyle = PALETTE.blueBright;
  ctx.fillText(`PWR ${view.power}  ${view.weaponLabel.toUpperCase()}`, width - pad, loadoutY);

  const flags: string[] = [];
  if (view.rapidFire) flags.push('RAPID');
  if (view.shield) flags.push(view.shieldRatio >= 1 ? 'SHIELD' : 'SHIELD…');
  if (flags.length) {
    ctx.fillStyle = view.shield && view.shieldRatio < 1 ? PALETTE.creamDim : PALETTE.flareBright;
    ctx.fillText(flags.join('  '), width - pad, loadoutY + 15);
  }

  /* ------------------------------------------------------------------ rules */
  if (view.activeRules.length) {
    const text = view.activeRules[0];
    ctx.font = `600 ${HUD.label}px ${HUD.font}`;
    const textWidth = ctx.measureText(text).width;
    ctx.textAlign = 'center';
    const x = width / 2;
    ctx.fillStyle = 'rgba(255,74,24,0.14)';
    ctx.fillRect(x - textWidth / 2 - 12, pad - 2, textWidth + 24, 20);
    ctx.strokeStyle = PALETTE.flare;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - textWidth / 2 - 12, pad - 2, textWidth + 24, 20);
    ctx.fillStyle = PALETTE.flareBright;
    ctx.fillText(text, x, pad + 3);
    if (view.activeRules.length > 1) {
      ctx.fillStyle = PALETTE.creamDim;
      ctx.font = `500 ${HUD.label}px ${HUD.font}`;
      ctx.fillText(`+${view.activeRules.length - 1} MORE`, x, pad + 20);
    }
  }

  /* ------------------------------------------------------------------ comms */
  if (view.comms.length) {
    const visibleLines = Math.max(1, Math.min(HUD.commsLines, Math.floor((height - 140) / 21)));
    const lines = view.comms.slice(-visibleLines);
    const lineHeight = 21;
    const boxHeight = 26 + lines.length * lineHeight;
    const boxWidth = Math.min(width * 0.62, 285);
    const boxY = Math.max(pad, height - boxHeight - pad - 8);
    const boxX = width - pad - boxWidth;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(6,22,11,0.9)';
    ctx.fillRect(boxX - 6, boxY - 4, boxWidth, boxHeight + 8);
    ctx.strokeStyle = 'rgba(195,232,175,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX - 6, boxY - 4, boxWidth, boxHeight + 8);

    ctx.font = `600 ${HUD.label}px ${HUD.font}`;
    ctx.fillStyle = PALETTE.blueBright;
    ctx.fillText('FLIGHT LOG', boxX, boxY + 2);

    ctx.font = `500 ${Math.max(13, HUD.comms)}px ${HUD.font}`;
    lines.forEach((line, index) => {
      ctx.fillStyle = line.tone === 'system' ? PALETTE.flareBright : PALETTE.cream;
      ctx.fillText(clipText(ctx, `› ${line.text}`, boxWidth - 16), boxX, boxY + 24 + index * lineHeight);
    });
  }

  /* ----------------------------------------------------------------- toasts */
  if (view.toasts.length) {
    ctx.textAlign = 'center';
    let y = height * 0.6;
    for (const toast of view.toasts) {
      const alpha = Math.min(1, toast.life / (toast.maxLife * 0.35));
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `700 ${HUD.small}px ${HUD.font}`;
      const color =
        toast.tone === 'ok'
          ? PALETTE.ok
          : toast.tone === 'warn'
            ? PALETTE.flareBright
            : PALETTE.blueBright;
      const textWidth = ctx.measureText(toast.text).width;
      ctx.fillStyle = 'rgba(5,10,32,0.8)';
      ctx.fillRect(width / 2 - textWidth / 2 - 14, y - 4, textWidth + 28, 24);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - textWidth / 2 - 14, y - 4, textWidth + 28, 24);
      ctx.fillStyle = color;
      ctx.fillText(toast.text, width / 2, y + 2);
      y += 30;
      ctx.globalAlpha = 1;
    }
  }

  /* ----------------------------------------------------------------- banner */
  if (view.banner) {
    const progress = 1 - view.banner.life / view.banner.maxLife;
    const fadeIn = progress < 0.15 ? progress / 0.15 : 1;
    const alpha = Math.max(0, Math.min(1, fadeIn * Math.min(1, view.banner.life / 0.45)));
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `900 34px ${HUD.font}`;
    ctx.fillStyle = PALETTE.cream;
    ctx.fillText(view.banner.text, width / 2, height * 0.3);
    if (view.banner.sub) {
      ctx.font = `600 ${HUD.small}px ${HUD.font}`;
      ctx.fillStyle = PALETTE.blueBright;
      ctx.fillText(view.banner.sub, width / 2, height * 0.3 + 42);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
