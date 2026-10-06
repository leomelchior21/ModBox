import type { ComponentType } from 'react';
import type { LanguageId } from '../interpreter/core/adapter';

export const DEFAULT_GAME_ID = 'vector-zero';

export interface GameScreenProps {
  gameId: string;
  missionId?: string;
  debugFlag: boolean;
}

export interface GameMissionMeta {
  id: string;
  kind: 'mission' | 'final' | 'sandbox';
}

interface GameMetadata {
  id: string;
  title: string;
  genre: string;
  /** Optional existing card theme; new games default to their own id. */
  cardStyle?: string;
  Cover: ComponentType;
  hero: { src: string; alt: string };
}

export interface PlayableGame extends GameMetadata {
  status: 'play';
  languages: readonly LanguageId[];
  starterMissionId: string;
  sandboxMissionId?: string;
  missions: readonly GameMissionMeta[];
  loadScreen: () => Promise<{ default: ComponentType<GameScreenProps> }>;
}

export interface UpcomingGame extends GameMetadata {
  status: 'coming-soon';
}

export type GameDefinition = PlayableGame | UpcomingGame;
