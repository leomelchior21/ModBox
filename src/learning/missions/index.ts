import type { ConfigKey } from '../../interpreter/core/types';
import { MODS } from '../../interpreter/core/mods';
import { requireAdapter } from '../../interpreter/adapters';
import type { LanguageId } from '../../interpreter/core/adapter';
import { summarize } from '../../interpreter/core/summarize';
import { MISSIONS, FREE_MODE_MISSION } from './missions';
import type { Mission } from './types';

/* ============================================================================
   MODBOX — MISSION LOOKUP, MERGE + UNLOCKS
   ========================================================================== */

export const MISSION_INDEX: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((mission) => [mission.id, mission]),
);

export function getMission(id: string): Mission {
  return MISSION_INDEX[id] ?? MISSIONS[0];
}

export function missionIndex(id: string): number {
  return MISSIONS.findIndex((mission) => mission.id === id);
}

export function nextMission(id: string): Mission | null {
  const index = missionIndex(id);
  if (index < 0 || index >= MISSIONS.length - 1) return null;
  return MISSIONS[index + 1];
}

export function previousMission(id: string): Mission | null {
  const index = missionIndex(id);
  if (index <= 0) return null;
  return MISSIONS[index - 1];
}

/**
 * Entering a mission preserves the student's program without completing the
 * new task for them. Only the opening mission and sandbox need templates.
 */
export function seedMissionCode(previousCode: string, mission: Mission): string {
  if (mission.kind === 'sandbox') return mission.starter.trimEnd();
  const existing = previousCode.trimEnd();
  if (existing) return existing;
  return mission.id === MISSIONS[0]?.id ? mission.starter.trimEnd() : '';
}

/** Every Mod a student may currently touch, given what they finished. */
export function unlockedMods(
  completed: string[],
  currentMissionId: string,
  freeModeUnlocked: boolean,
): ConfigKey[] {
  if (freeModeUnlocked) return MODS.map((mod) => mod.id);

  const current = getMission(currentMissionId);
  const unlocked = new Set<ConfigKey>();

  // everything up to and including the current mission is live, so a student
  // who jumps ahead still sees their own code work
  for (const mission of MISSIONS) {
    if (mission.order <= current.order) mission.unlocks.forEach((mod) => unlocked.add(mod));
  }
  for (const id of completed) {
    const mission = MISSION_INDEX[id];
    mission?.unlocks.forEach((mod) => unlocked.add(mod));
  }

  return [...unlocked];
}

/** Mods discovered by finishing a mission, for the unlock animation. */
export function modsDiscoveredBy(mission: Mission): ConfigKey[] {
  return mission.unlocks;
}

function presentKeys(code: string, language: LanguageId): Set<string> {
  if (!code.trim()) return new Set();
  return new Set(summarize(requireAdapter(language).parse(code)).keys);
}

/**
 * Missions grow the student's program instead of replacing it (spec §33):
 * only lines that do not already exist are added, and their values are never
 * overwritten.
 */
export function mergeMissionCode(previousCode: string, mission: Mission, language: LanguageId = 'csharp'): string {
  const base = (previousCode.trim().length ? previousCode : mission.starter).replace(/\s+$/, '');
  const hasContent = base.trim().length > 0;

  if (!mission.additions.length) return hasContent ? base : mission.starter.trimEnd();

  const present = presentKeys(base, language);
  const missing = mission.additions.filter((addition) => !present.has(addition.key));
  if (!missing.length) return base;

  const block = missing.map((addition) => addition.code).join('\n');
  return hasContent ? `${base}\n\n${block}` : block;
}

export function missionLabel(mission: Mission): string {
  return mission.code;
}

export { MISSIONS };

/** Which mission discovers a given Mod — used for "not wired up yet" hints. */
export function unlockMissionLabelFor(modId: ConfigKey): string {
  const mission = MISSIONS.find((entry) => entry.unlocks.includes(modId));
  return mission ? mission.code : 'FINAL MOD';
}

export const FREE_MISSION = FREE_MODE_MISSION;
