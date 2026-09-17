import type { ConfigKey } from '../interpreter/core/types';
import type { Mission, ValidationContext } from './missions/types';
import type { MissionValidation } from './validation';
import { scoreTarget } from './validation/scoreTarget';
import type { LanguageId } from '../interpreter/core/adapter';

export type CodeToolId = 'writeline' | 'power-math' | 'score-rule' | 'health-rule';
export type CopilotTargetId = ConfigKey | CodeToolId;
export type CodeToolTone = 'int' | 'write' | 'condition';

export interface CodeToolDefinition {
  id: CodeToolId;
  name: string;
  label: string;
  type: CodeToolTone;
  blurb: string;
  example: string;
  glyph: string;
  unlockAt: number;
}

export interface CopilotStep {
  message: string;
  hint?: string;
  targetId?: CopilotTargetId;
}

const POPUP_TARGET_LABELS: Partial<Record<CopilotTargetId, string>> = {
  enemyType: 'ENEMY TYPE',
  shipName: 'SHIP NAME',
  shipType: 'SHIP TYPE',
  backgroundColor: 'SPACE COLOR',
  rockShape: 'ROCK SHAPE',
  enemyCount: 'ENEMY COUNT',
  laserPower: 'WEAPON POWER',
  shieldEnabled: 'SHIELD',
  rapidFireEnabled: 'RAPID FIRE',
  writeline: 'WRITELINE',
  'power-math': 'POWER MATH',
  'score-rule': 'SCORE RULE',
  'health-rule': 'HEALTH RULE',
};

/** Short, playful copy used only by the floating coach pill. */
export function coachPopupMessage(step: CopilotStep, language: LanguageId = 'csharp'): string {
  const targetLabel = step.targetId === 'writeline' && language !== 'csharp'
    ? 'PRINT'
    : step.targetId ? POPUP_TARGET_LABELS[step.targetId] : undefined;
  if (targetLabel && /^(Add|Build)\b/i.test(step.message)) {
    return `Drag ${targetLabel} into the code.`;
  }
  if (step.message.startsWith('Mission ready')) return 'Great work! Go to the next mission.';
  if (step.message.startsWith('Change the enemy type')) return 'Change small-rock to big-rock.';
  if (step.message.startsWith('Change shipName')) return "Give Brian's ship a new name.";
  if (step.message.startsWith('Change the number of enemies')) return 'Set enemies to 5 or more.';
  const falseValue = language === 'python' ? 'False' : 'false';
  const trueValue = language === 'python' ? 'True' : 'true';
  if (step.message.startsWith('Switch shield')) return `Change shield from ${falseValue} to ${trueValue}.`;
  if (step.message.startsWith('Switch rapidFire')) return `Change rapidFire from ${falseValue} to ${trueValue}.`;
  if (step.message.startsWith('Launch the game and reach')) {
    const score = step.message.match(/reach (\d+) points/)?.[1] ?? 'the target';
    return `Launch and reach ${score} points.`;
  }
  if (step.message.startsWith('Launch and let your integrity')) return 'Launch and let health fall below 30.';
  if (step.message.startsWith('Free build')) return 'Drag in a Mod and make the game yours.';
  return step.message;
}

export const CODE_TOOLS: CodeToolDefinition[] = [
  {
    id: 'writeline',
    name: 'WriteLine',
    label: 'TRANSMISSION',
    type: 'write',
    blurb: 'Sends a message to the Flight Log.',
    example: 'Console.WriteLine("Pilot: " + shipName);',
    glyph: '⌁',
    unlockAt: 1,
  },
  {
    id: 'power-math',
    name: 'powerMath',
    label: 'POWER MATH',
    type: 'int',
    blurb: 'Builds a stronger laserPower value with maths.',
    example: 'laserPower = laserPower + 2;',
    glyph: '+',
    unlockAt: 3,
  },
  {
    id: 'score-rule',
    name: 'scoreRule',
    label: 'SCORE RULE',
    type: 'condition',
    blurb: 'Switches the shield on when the score reaches 300.',
    example: 'if (score >= 300)\n{\n    shield = true;\n}',
    glyph: '?',
    unlockAt: 5,
  },
  {
    id: 'health-rule',
    name: 'healthRule',
    label: 'HEALTH RULE',
    type: 'condition',
    blurb: 'Raises weapon power when integrity falls to 30.',
    example: 'if (health <= 30)\n{\n    laserPower = 5;\n}',
    glyph: '≤',
    unlockAt: 6,
  },
];

export function codeToolsForMission(mission: Mission): CodeToolDefinition[] {
  if (mission.kind === 'sandbox' || mission.kind === 'final') return CODE_TOOLS;
  return CODE_TOOLS.filter((tool) => tool.unlockAt <= mission.order);
}

const hasDeclaration = (
  ctx: ValidationContext,
  type: 'string' | 'int' | 'bool',
  name: string,
) => ctx.summary.declares[type].includes(name);

export function copilotStep(
  mission: Mission,
  ctx: ValidationContext,
  validation: MissionValidation,
): CopilotStep {
  if (validation.passed) {
    return {
      message: 'Mission ready. Everything is correct—continue with NEXT MISSION.',
    };
  }

  switch (mission.id) {
    case 'm00':
      return {
        message: 'Change the enemy type to "big-rock".',
        hint: 'Drag the blinking ENEMY TYPE Mod into the highlighted line, or edit the text inside the quotes.',
        targetId: 'enemyType',
      };

    case 'm01':
      if (!hasDeclaration(ctx, 'string', 'shipName')) {
        return {
          message: 'Add the "shipName" Mod to the code.',
          hint: 'Drag the blinking SHIP NAME Mod into the highlighted declarations area.',
          targetId: 'shipName',
        };
      }
      if (ctx.config.shipName.trim().length <= 1 || ctx.config.shipName === "Brian's ship") {
        return {
          message: 'Change shipName from "Brian\'s ship" to a name you choose.',
          hint: 'Keep the quotation marks around the new name.',
          targetId: 'shipName',
        };
      }
      if (ctx.summary.writesCount < 1) {
        return {
          message: 'Add a Console.WriteLine transmission below the declarations.',
          hint: 'Drag the blinking TRANSMISSION tool into the highlighted output area.',
          targetId: 'writeline',
        };
      }
      break;

    case 'm02':
      if (!hasDeclaration(ctx, 'int', 'enemies')) {
        return {
          message: 'Add the "enemyCount" Mod to the code.',
          hint: 'Drag the blinking ENEMY COUNT Mod into the highlighted declarations area.',
          targetId: 'enemyCount',
        };
      }
      if (ctx.config.enemyCount < 5) {
        return {
          message: 'Change the number of enemies to 5 or more.',
          hint: 'Edit the number after int enemies =. Numbers do not use quotation marks.',
          targetId: 'enemyCount',
        };
      }
      break;

    case 'm03':
      if (!hasDeclaration(ctx, 'int', 'laserPower')) {
        return {
          message: 'Add the "laserPower" Mod to the code.',
          hint: 'Drag the blinking WEAPON POWER Mod into the declarations area.',
          targetId: 'laserPower',
        };
      }
      if (!ctx.summary.arithmeticOps.some((operator) => ['+', '-', '*'].includes(operator))) {
        return {
          message: 'Build laserPower with maths: laserPower = laserPower + 2;',
          hint: 'Drag the blinking POWER MATH tool below the declarations.',
          targetId: 'power-math',
        };
      }
      if (ctx.config.laserPower < 3) {
        return {
          message: 'Raise laserPower to 3 or more.',
          hint: 'Increase the number used in your POWER MATH line.',
          targetId: 'power-math',
        };
      }
      break;

    case 'm04':
      if (!hasDeclaration(ctx, 'bool', 'shield')) {
        return {
          message: 'Add the "shield" Mod to the code.',
          hint: 'Drag the blinking SHIELD Mod into the declarations area.',
          targetId: 'shieldEnabled',
        };
      }
      if (!ctx.config.shieldEnabled) {
        return {
          message: 'Switch shield on by changing false to true.',
          hint: 'Boolean values are true or false and never use quotation marks.',
          targetId: 'shieldEnabled',
        };
      }
      if (!hasDeclaration(ctx, 'bool', 'rapidFire')) {
        return {
          message: 'Add the "rapidFire" Mod to the code.',
          hint: 'Drag the blinking RAPID FIRE Mod beside the other declarations.',
          targetId: 'rapidFireEnabled',
        };
      }
      if (!ctx.config.rapidFireEnabled) {
        return {
          message: 'Switch rapidFire on by changing false to true.',
          targetId: 'rapidFireEnabled',
        };
      }
      break;

    case 'm05': {
      const hasScoreRule =
        ctx.summary.rulesCount >= 1 &&
        ctx.summary.runtimeRefs.includes('score') &&
        ctx.summary.comparisons.some((operator) => ['>', '>='].includes(operator));
      if (!hasScoreRule) {
        return {
          message: 'Add a live rule that reads score and switches shield on.',
          hint: 'Drag the blinking SCORE RULE tool to the highlighted rules area.',
          targetId: 'score-rule',
        };
      }
      const target = scoreTarget(ctx.program);
      if (ctx.metrics.ruleActivations < 1 || ctx.metrics.maxScore < target) {
        return {
          message: `Launch the game and reach ${target} points so your score rule fires.`,
          hint: 'The co-pilot is watching the live run. Keep flying until the shield switches on.',
        };
      }
      break;
    }

    case 'm06':
      if (!(ctx.summary.rulesCount >= 1 && ctx.summary.runtimeRefs.includes('health'))) {
        return {
          message: 'Add a health rule that increases laserPower when integrity is low.',
          hint: 'Drag the blinking HEALTH RULE tool to the highlighted rules area.',
          targetId: 'health-rule',
        };
      }
      if (ctx.metrics.minHealth > 30) {
        return {
          message: 'Launch and let your integrity fall to 30 or lower.',
          hint: 'When the health condition becomes true, your weapon power will surge.',
        };
      }
      if (!ctx.metrics.ruleTraces.some((trace) => trace.includes('health'))) {
        return {
          message: 'Keep flying until the health rule activates.',
        };
      }
      break;

    case 'final': {
      const missing = validation.results.find((result) => !result.done)?.id;
      const finalSteps: Record<string, CopilotStep> = {
        string: { message: 'Add a custom shipName string.', targetId: 'shipName' },
        int: { message: 'Add and tune an int Mod.', targetId: 'enemyCount' },
        bool: { message: 'Add at least one bool switch.', targetId: 'shieldEnabled' },
        enemies: { message: 'Set the enemy count to 5 or more.', targetId: 'enemyCount' },
        weapon: { message: 'Add a weapon setting such as laserPower.', targetId: 'laserPower' },
        rule: { message: 'Add one live rule that reacts while you play.', targetId: 'score-rule' },
        comms: { message: 'Add a Console.WriteLine transmission.', targetId: 'writeline' },
        played: { message: 'Launch your level and destroy at least one rock.' },
      };
      if (missing) return finalSteps[missing] ?? { message: mission.action };
      break;
    }

    case 'free':
      return { message: 'Free build: drag Mods into the editor and change anything you want.' };
  }

  return {
    message: validation.results.find((result) => !result.done)?.label ?? mission.action,
    hint: mission.hint,
  };
}
