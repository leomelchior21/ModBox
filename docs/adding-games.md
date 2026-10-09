# Adding a game to MODBOX

Each game owns its simulation, art, controls, mods, missions and co-pilot instructions. `GameWorkspace` owns the common screen: editor, co-pilot and mods on the left; game on the right. Its responsive layout, library scrolling and popup behavior are shared.

Vector Zero uses it in `src/games/vector-zero/VectorZeroScreen.tsx`. NEON MAZE uses it in `src/games/neon-maze/NeonMazeScreen.tsx`, with its own pure maze simulation, rendering, mods, eight missions and touch controls. Its touch joystick sits at the bottom right of the game view, with PHASE at the bottom left. The registered cabinet keeps the original `maze` game ID. A smaller independent example is `src/games/__tests__/fixtures/gardenGame.tsx`: a DOM garden with unrelated mods, exercised by the integration tests. This example is not listed as a public game.

NEON MAZE follows a rolling orb through tall, connected sectors drawn with continuous neon lines. The camera shows more than 20 columns on typical game views; braided corridors remove dead ends and create frequent junctions and alternate routes. Each dot scores 5 points; each amber gem freezes all sentinels for `gemDuration` seconds (6 by default) and awards `coreValue` points. Three gems open the gate, which immediately starts the next sector while preserving score, lives and remaining stun. The existing `cores` runtime variable and mission metrics count gems so saved code keeps working. `dots` and `stun` expose the sector’s collected dots and remaining stun time to live rules. `revealMap` also shows an overview on larger game views.

## Define your controls

Create `src/games/<game-id>/mods.ts`. Import `ModDefinition` from `src/mods/types.ts`; keep your catalog separate from Vector Zero's.

```ts
import type { ModDefinition } from '../../mods/types';
import { createModSchema } from '../../interpreter/core/schema';

export interface MyConfig {
  jumpHeight: number;
  doubleJump: boolean;
}

export const mods: readonly ModDefinition<keyof MyConfig>[] = [
  {
    id: 'jumpHeight', name: 'jumpHeight', type: 'int',
    label: 'JUMP HEIGHT', blurb: 'How high the player jumps.',
    example: 'int jumpHeight = 8;', limits: { min: 1, max: 20 },
    defaultValue: 4, glyph: '↑', unlockAt: 0,
  },
  {
    id: 'doubleJump', name: 'doubleJump', type: 'bool',
    label: 'DOUBLE JUMP', blurb: 'Jump once more while airborne.',
    example: 'bool doubleJump = true;', defaultValue: false,
    glyph: '⇈', unlockAt: 1,
  },
];

export const schema = createModSchema(mods, ['score', 'height']);
```

`id` is your engine's configuration key; `name` is the player's variable. Names and IDs must be unique within the game; other games may reuse them. Use `values` for string choices, `limits` for integer bounds and `maxLength` for free text. Examples use the educational C# subset; `localizeMod` translates library examples to Python or Swift.

## Build your screen

Export a React screen taking `GameScreenProps`. Render `GameWorkspace` with:

- `header`: title, mission progress and runtime buttons. `TopBar` is reusable.
- `editor`: source, change handler, language, your catalog and `runtimeLabels`. Optional `coachTargets` supplies patterns for custom code tools.
- `editorToolbar`: filename and editor actions.
- `feedback`: diagnostics and your game's co-pilot guidance.
- `modStrip`: unlocked mods, custom tools, insertion handler and discovery state.
- `library`: open/close state and insertion handler.
- `stage`: your game view, engine lifecycle and input controls. Canvas, SVG and DOM are supported. Use `.stage` inside the provided frame, or size your view to fill it.
- Optional `stageExtras` and `overlays`: unlock effects, mission navigation, settings or debug UI.
- Optional `modAreaExtras`: an accessory in the mod area. On tablets, the shared layout puts this slot on the left and the scrollable mod library on the right. Vector Zero uses it for the joystick.

Your controller owns animation timers, listeners and input, and cleans them up on unmount. Suspend keyboard gameplay while editing or using dialogs/libraries. Put mobile controls inside your game view and account for its available size and safe areas.

NEON MAZE demonstrates continuous movement: directional input queues a turn while the runner keeps cruising. Walls stop the runner until a valid turn is requested; corners and dead ends never choose a direction for the player. Reversing mid-corridor preserves the orb's visual position. Its separate `sentinels.ts` planner assigns pursuit, interception, flanking and core-guard targets, alternates chase/scatter periods, and routes hunters through corridors without unnecessary reversals or crowding. Rendering and swept contact checks share interpolated actor positions, and each movement segment retains its duration through live speed edits.

DEVIL FLOOR uses `src/games/devil-floor/DevilFloorScreen.tsx` and preserves the original `platform` cabinet ID. Its pure simulation uses physics substeps for responsive running, buffered jumps, a short ledge grace period, and an optional double jump. The camera follows the explorer across lava, collapsing platforms, spikes, fireballs, crystals and checkpoints. All generated gaps are reachable with the default physics. A/D or Left/Right runs; Space, W or Up jumps; P pauses. Touch players have two movement buttons on the left and JUMP on the right. Release JUMP before a second airborne jump.

The Devil Floor catalog controls suit color, name, movement, jump height, gravity, double jump, shield, stable floors, melt delay, crystal value, fireball speed and checkpoints. Standing on a platform accumulates heat until it collapses; the starting ledge is always safe. A shield absorbs spikes and fireballs, while lava always costs a life. Respawning restores platforms and returns to the most recent enabled checkpoint, preserving collected crystals and score. The exit awards 250 points and offers the next cavern with score and lives intact. Eight learning missions introduce strings, arithmetic, booleans and live rules before the sandbox; `score`, `lives`, `gems`, `height`, `stage` and `jumps` expose runtime values in all three languages.

Its volcanic temple is drawn directly on canvas: parallax arches, basalt ledges, molten seams, relics, checkpoint obelisks and a sanctuary portal. The simulation emits position-aware `feedback` cues separately from sound events. `FloorEffects` consumes them into bounded particles, landing squash, impact rings, debris, score popups and status announcements without changing physics. Its clock holds while paused, editing or using menus; `visualRevision` clears old effects on restart and stage changes. Reduced motion retains readable notifications and score feedback while removing particles, trails, shake and animated squash. The HUD exposes route progress, hearts, air-jump availability, shield recharge and ground stability.

`applyModToEditor(view, snippet, mode, language)` handles tap replacement and drag insertion. The shared libraries supply the insertion mode. Pass the same catalog to the editor for matching autocomplete and co-pilot targets.

If a tool needs to change other starting values when inserted, supply an optional `prepareModInsert(source, snippet, language)` callback to `editor` and as the fifth argument of `applyModToEditor`. Both tap and drop then apply the preparation and snippet together in one undoable edit. Keep these game-specific changes in your game's directory; Vector Zero uses this hook to reset the starting shield and laser power when inserting its rule tools.

Import `parseGameScript` and `evaluateGameScript` from `src/interpreter/gameScript.ts`:

```ts
const program = parseGameScript<MyConfig>(code, language, schema);
```

All three languages share the AST; the schema binds only your game's mods and runtime names. Keep the last valid program running when `program.ok` is false. Merge a valid `program.config` into your defaults/scenario before supplying it to your simulation.

At each simulation tick, `evaluateGameScript(program, baseConfig, runtimeValues, schema)` returns the live config and rule traces with catalog limits applied. Runtime values may be numbers, text or booleans. Rules evaluate against the base config rather than accumulating changes each frame. Your game can display startup messages from `program.comms` and evaluate rule log expressions from `frame.traces[].writes` against its runtime scope.

## Save progress

The app selects a game's saved progress before mounting it. `useProgress()` exposes the selected game's missions, language, code, unlocks and best score; its existing setters affect that game. Profile name and sound/debug settings are shared.

`useGameCode(gameId, missionId, language, starter)` provides saved source and an `onChange` handler. For delayed writes, use `setGameCode(gameId, codeKey(language, missionId), source)` so an edit stays attached to its game after navigation. `getGameProgress(gameId, starterMissionId)` reads another game's progress. `resetCurrentGame()` clears only the selected game; `resetProgress()` clears the whole library.

Existing saves migrate into `vector-zero`. Games can reuse mission IDs without sharing completion, code or scores.

## Register the game

Create `src/games/<game-id>/definition.ts` exporting a `PlayableGame`:

```ts
import type { PlayableGame } from '../types';
import { MyCover } from './MyCover';

export const myGame: PlayableGame = {
  id: 'my-game', title: 'MY GAME', genre: 'platformer', status: 'play',
  Cover: MyCover,
  hero: { src: '/art/my-game.png', alt: 'My game cover art' },
  languages: ['python', 'swift', 'csharp'],
  starterMissionId: 'm00',
  missions: [{ id: 'm00', kind: 'mission' }],
  loadScreen: () => import('./MyGameScreen').then(module => ({ default: module.MyGameScreen })),
};
```

Add it to `src/games/registry.tsx`. Both libraries automatically show its cover and hero art, offer its languages and resume its progress. Its runtime loads only when selected. New games require no edits to `App`, the router, shared workspace, editor or mod library.

The libraries list games with `status: 'play'` first and label them “Available now”; upcoming games follow with “Coming soon” and cannot be launched. Registration order is preserved within each group. `hero.src` supplies the full-frame library artwork and selected-game language preview, with `Cover` as the fallback if the image fails to load. Keep the main subject within the central part of the image so it fits the shared landscape thumbnail and mobile crops.

URLs include the game ID: `#/lab?game=my-game&mission=m00`. Older URLs still open Vector Zero. Unknown and unfinished games show an unavailable screen. List only supported languages, and use a `coming-soon` definition until the game is playable.

Run `npm test` and `npm run build`, then check desktop and portrait/landscape phones. Add tests for your game rules, missions and cleanup. Existing tests cover custom bindings, tap/drop insertion, registration, language filtering, game switching, scoped progress and save migration.
