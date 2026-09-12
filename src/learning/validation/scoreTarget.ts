import type { ProgramResult } from '../../interpreter/core/types';

/**
 * Reads the student's OWN score threshold out of their rules, so a mission can
 * ask them to reach the goal they wrote instead of a hardcoded number.
 */
export function scoreTarget(program: ProgramResult, fallback = 300): number {
  let target = Number.POSITIVE_INFINITY;

  const inspect = (condition: ProgramResult['rules'][number]['condition']): void => {
    if (condition.kind !== 'compare') return;
    if (condition.op !== '>' && condition.op !== '>=') return;
    const { left, right } = condition;
    if (
      left.kind === 'identifier' &&
      left.name === 'score' &&
      right.kind === 'literal' &&
      typeof right.value === 'number'
    ) {
      target = Math.min(target, right.value);
    }
    if (
      right.kind === 'identifier' &&
      right.name === 'score' &&
      left.kind === 'literal' &&
      typeof left.value === 'number'
    ) {
      target = Math.min(target, left.value);
    }
  };

  for (const rule of program.rules) {
    inspect(rule.condition);
    if (rule.condition.kind === 'logical') {
      inspect(rule.condition.left);
      inspect(rule.condition.right);
    }
  }

  return Number.isFinite(target) ? target : fallback;
}
