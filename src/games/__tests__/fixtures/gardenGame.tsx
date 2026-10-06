import { useMemo, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { GameWorkspace } from '../../../components/GameWorkspace';
import { applyModToEditor } from '../../../editor/CodeEditor';
import type { ModInsertMode } from '../../../editor/modEditing';
import { formatCodeForLanguage, localizeMod, fileNameForLanguage } from '../../../interpreter/languageSyntax';
import { createModSchema } from '../../../interpreter/core/schema';
import { parseGameScript } from '../../../interpreter/gameScript';
import type { ModDefinition } from '../../../mods/types';
import { useProgress } from '../../../state/progressStore';
import { useMediaQuery } from '../../../utils/hooks';
import { useGameCode } from '../../useGameCode';
import type { GameScreenProps, PlayableGame } from '../../types';

export interface GardenConfig { tileCount: number; palette: string; rainEnabled: boolean }
export const gardenMods: readonly ModDefinition<keyof GardenConfig>[] = [
  { id: 'tileCount', name: 'tiles', type: 'int', label: 'GARDEN SIZE', blurb: 'How many garden tiles grow.', example: 'int tiles = 6;', limits: { min: 1, max: 12 }, range: '1–12', defaultValue: 3, glyph: '▦', unlockAt: 0 },
  { id: 'palette', name: 'palette', type: 'string', label: 'GARDEN PALETTE', blurb: 'Colors used to draw the garden.', example: 'string palette = "sunset";', values: ['spring', 'sunset'], defaultValue: 'spring', glyph: '❀', unlockAt: 0 },
  { id: 'rainEnabled', name: 'rain', type: 'bool', label: 'RAIN', blurb: 'Water the garden.', example: 'bool rain = true;', defaultValue: false, glyph: '☂', unlockAt: 0 },
];
export const gardenSchema = createModSchema(gardenMods, ['harvests']);
const runtimeLabels = { harvests: 'tiles harvested' };

/** A DOM game proves the workspace does not require a ship, canvas or flight input. */
export function GardenScreen({ gameId, missionId = 'm00' }: GameScreenProps): JSX.Element {
  const progress = useProgress();
  const language = progress.activeLanguage;
  const { code, onChange } = useGameCode(gameId, missionId, language, formatCodeForLanguage('int tiles = 3;\nstring palette = "spring";\nbool rain = false;', language));
  const [focused, setFocused] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const view = useRef<EditorView | null>(null);
  const program = useMemo(() => parseGameScript<GardenConfig>(code, language, gardenSchema), [code, language]);
  const mods = useMemo(() => gardenMods.map(mod => localizeMod(mod, language)), [language]);
  const config: GardenConfig = { tileCount: 3, palette: 'spring', rainEnabled: false, ...(program.ok ? program.config : {}) };
  const insert = (snippet: string, mode?: ModInsertMode) => applyModToEditor(view.current, snippet, mode, language);
  return <GameWorkspace gameId={gameId} gameTitle="GARDEN TEST" touch={useMediaQuery('(any-pointer: coarse)')} coding={focused}
    header={<header className="topbar"><strong>GARDEN TEST</strong></header>}
    editor={{ value: code, onChange, mods: gardenMods, runtimeLabels, language, onFocusChange: setFocused, onViewReady: editor => { view.current = editor; } }}
    editorToolbar={<span className="lab__filename">{fileNameForLanguage(language)}</span>}
    feedback={{ status: program.ok ? 'ready' : 'error', diagnostic: program.diagnostics[0], ruleCount: program.rules.length, guidance: { message: 'Choose the garden size, colors, and rain.' } }}
    modStrip={{ mods, tools: [], totalMods: mods.length, collapsed, onToggleCollapsed: () => setCollapsed(value => !value), onInsert: insert, onOpenLibrary: () => setLibraryOpen(true), language }}
    library={{ open: libraryOpen, onClose: () => setLibraryOpen(false), onInsert: insert }}
    stage={<div className="stage garden-stage" data-palette={config.palette} data-rain={config.rainEnabled}>
      <p>GARDEN TILES: {config.tileCount}</p>
      <div>{Array.from({ length: config.tileCount }, (_, index) => <span key={index} className="garden-tile">❀</span>)}</div>
    </div>}
  />;
}

export const gardenGame: PlayableGame = {
  id: 'garden-test', title: 'GARDEN TEST', genre: 'garden builder', status: 'play',
  Cover: () => <svg viewBox="0 0 400 260" aria-label="Garden cover"><circle cx="200" cy="130" r="60" fill="currentColor" /></svg>,
  hero: { src: '/art/neon-maze-hero.png', alt: 'Garden test cover' },
  languages: ['python', 'csharp'], starterMissionId: 'm00', missions: [{ id: 'm00', kind: 'sandbox' }],
  loadScreen: async () => ({ default: GardenScreen }),
};
