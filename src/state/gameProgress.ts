import type { LanguageId } from '../interpreter/core/adapter';

export interface GameProgress {
  starterMissionId: string;
  currentMissionId: string;
  activeLanguage: LanguageId;
  completed: string[];
  freeModeUnlocked: boolean;
  bestScore: number;
  codes: Record<string, string>;
}

export function emptyGameProgress(starterMissionId = 'm00', activeLanguage: LanguageId = 'csharp'): GameProgress {
  return { starterMissionId, currentMissionId: starterMissionId, activeLanguage, completed: [], freeModeUnlocked: false, bestScore: 0, codes: {} };
}
