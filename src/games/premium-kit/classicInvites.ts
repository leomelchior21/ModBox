import type { InviteMoment } from './invites';
import type { GameInvite } from './InviteList';

type Config = Record<string, unknown>;
const pick = (list: (GameInvite | false)[]) => list.filter((i): i is GameInvite => Boolean(i));

/** Devil Floor: an ember guide who has seen many explorers fall. */
export function floorInvites(c: Config, moment: InviteMoment): GameInvite[] {
  if (moment === 'lose') return pick([
    !c.doubleJump && { id: 'floor-double', target: 'doubleJump', icon: '🦘', title: 'The fire caught you mid-air', reason: 'A double jump gives you a second leap.', code: 'bool doubleJump = true;', tone: 'help' },
    Number(c.meltDelay) < 6 && { id: 'floor-melt', target: 'meltDelay', icon: '⏳', title: 'Platforms melt too fast', reason: 'Stand longer before they collapse.', code: 'int meltDelay = 6;', tone: 'help' },
    !c.checkpoints && { id: 'floor-flags', target: 'checkpoints', icon: '⚑', title: 'Save your route', reason: 'Checkpoints bring you back near where you fell.', code: 'bool checkpoints = true;', tone: 'help' },
    Number(c.lavaSpeed) > 1 && { id: 'floor-lava', target: 'lavaSpeed', icon: '🔥', title: 'Calm the fireballs', reason: 'Fireballs rise from the lava more slowly.', code: 'int lavaSpeed = 1;', tone: 'help' },
    !c.shield && { id: 'floor-shield', target: 'shield', icon: '🛡', title: 'An ember shield', reason: 'One hit is forgiven.', code: 'bool shield = true;', tone: 'help' },
  ]);
  return pick([
    Number(c.lavaSpeed) < 4 && { id: 'floor-fast', target: 'lavaSpeed', icon: '🌋', title: 'Wake the volcano', reason: 'Faster fireballs for a real escape.', code: 'int lavaSpeed = 4;', tone: 'challenge' },
    Number(c.meltDelay) > 2 && { id: 'floor-quick', target: 'meltDelay', icon: '💨', title: 'Quick feet only', reason: 'Platforms melt in two seconds.', code: 'int meltDelay = 2;', tone: 'challenge' },
    c.timeOfDay !== 'night' && { id: 'floor-night', target: 'timeOfDay', icon: '🌙', title: 'Descend at night', reason: 'The caverns glow in the dark.', code: 'string timeOfDay = "night";', tone: 'style' },
  ]);
}
/** Block Forge: a patient blacksmith. */
export function forgeInvites(c: Config, moment: InviteMoment): GameInvite[] {
  if (moment === 'lose') return pick([
    !c.showHints && { id: 'forge-hints', target: 'showHints', icon: '💡', title: 'The board filled up', reason: 'Hints show where each piece fits best.', code: 'bool showHints = true;', tone: 'help' },
    !c.rotations && { id: 'forge-rotate', target: 'rotations', icon: '🔄', title: 'Turn the pieces', reason: 'Rotate pieces to fit tight gaps.', code: 'bool rotations = true;', tone: 'help' },
    !c.allowUndo && { id: 'forge-undo', target: 'allowUndo', icon: '↩', title: 'Allow one undo', reason: 'Take back a move that went wrong.', code: 'bool allowUndo = true;', tone: 'help' },
  ]);
  return pick([
    !c.comboBoost && { id: 'forge-combo', target: 'comboBoost', icon: '✨', title: 'Combo boost', reason: 'Chain clears for bigger points.', code: 'bool comboBoost = true;', tone: 'challenge' },
    { id: 'forge-glass', target: 'blockStyle', icon: '💎', title: 'Glass blocks', reason: 'A shiny new finish for every block.', code: `string blockStyle = "${c.blockStyle === 'glass' ? 'bevel' : 'glass'}";`, tone: 'style' },
  ]);
}
