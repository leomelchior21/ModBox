# Adding a game to MODBOX

Each game owns its simulation, art, controls, mods, missions and co-pilot instructions. `GameWorkspace` owns the common screen: editor, co-pilot and mods on the left; game on the right. Its responsive layout, library scrolling and popup behavior are shared.

Vector Zero uses it in `src/games/vector-zero/VectorZeroScreen.tsx`. NEON MAZE now runs on the premium arcade kit (see `src/games/neon-maze` and [Current campaigns](current-campaigns.md)); the registered cabinet keeps the original `maze` game ID. A smaller independent example is `src/games/__tests__/fixtures/gardenGame.tsx`: a DOM garden with unrelated mods, exercised by the integration tests. This example is not listed as a public game.


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


DEVIL FLOOR uses `src/games/devil-floor/DevilFloorScreen.tsx` and preserves the original `platform` cabinet ID. Its pure simulation uses physics substeps for responsive running, buffered jumps, a short ledge grace period, and an optional double jump. The camera follows the explorer across lava, collapsing platforms, spikes, fireballs, crystals and checkpoints. All generated gaps are reachable with the default physics. A/D or Left/Right runs; Space, W or Up jumps; P pauses. Touch players have two movement buttons on the left and JUMP on the right. Release JUMP before a second airborne jump.

The Devil Floor catalog controls suit color, name, movement, jump height, gravity, double jump, shield, stable floors, melt delay, crystal value, fireball speed and checkpoints. Standing on a platform accumulates heat until it collapses; the starting ledge is always safe. A shield absorbs spikes and fireballs, while lava always costs a life. Respawning restores platforms and returns to the most recent enabled checkpoint, preserving collected crystals and score. The exit awards 250 points and offers the next cavern with score and lives intact. Eight learning missions introduce strings, arithmetic, booleans and live rules before the sandbox; `score`, `lives`, `gems`, `height`, `stage` and `jumps` expose runtime values in all three languages.

Its volcanic temple is drawn directly on canvas: parallax arches, basalt ledges, molten seams, relics, checkpoint obelisks and a sanctuary portal. The simulation emits position-aware `feedback` cues separately from sound events. `FloorEffects` consumes them into bounded particles, landing squash, impact rings, debris, score popups and status announcements without changing physics. Its clock holds while paused, editing or using menus; `visualRevision` clears old effects on restart and stage changes. Reduced motion retains readable notifications and score feedback while removing particles, trails, shake and animated squash. The HUD exposes route progress, hearts, air-jump availability, shield recharge and ground stability.

MAKITAS VS ZOMBIES demonstrates pointer and keyboard lane defense. `YardRun` owns a deterministic five-by-nine lawn, four defenders, four enemy variants, collectible batteries, upgrades, recycling, three waves and harder nights. Zombies stop at defenders to bite, frost changes actual movement speed, and a one-use sweeper protects each lane. `YardEffects` and `YardSound` consume bounded simulation cues; the screen coalesces audio, freezes the simulation and effect clock while editing or using menus, and cleans up animation, resize and visibility listeners on unmount. A roving-tabindex lawn lets arrow keys choose a tile and Enter deploy the selected tool. Runtime `score`, `power`, `wave`, `kills`, `lives` and `placed` support the game's independent Python, Swift and C# missions. Its generated cover, yard and transparent atlas are documented in [makitas-artwork.md](makitas-artwork.md).

`applyModToEditor(view, snippet, mode, language)` handles tap replacement and drag insertion. The shared libraries supply the insertion mode. Pass the same catalog to the editor for matching autocomplete and co-pilot targets.

BLOCK FORGE is a turn-based DOM game in `src/games/block-forge`. Its deterministic `ForgeRun` owns the 8×8 board, three-piece trays, simultaneous row/column clears, consecutive-clear combos, rotation-aware move detection, hints, undo and three limited reshuffles. Preview and placement share the same legality and scoring logic. New trays contain pieces that individually fit the current board, without guaranteeing that every ordering works. The opening board offers an immediate two-block line clear. `score`, `lines`, `moves` and `combo` drive independent Python, Swift and C# missions. Validated checkpoints save the board, tray, score, random state, remaining reshuffles and metrics after actions; undo history lasts for the mounted session. Code, missions and best scores use the shared per-game store. The original cover and block styling are SVG and CSS.

Block Forge supports select-and-tap, pointer dragging, a roving keyboard grid and shortcuts: 1–3 select pieces, R rotates, H hints, U undoes, P pauses while the game has focus. Rotation, hints, undo and bonus scoring start off and can be enabled through code immediately, without completing a challenge. Timed CSS effects and optional synthesized sound celebrate clears; reduced motion removes animation. No animation loop or timer advances the puzzle. The shared tablet stylesheet gives portrait iPads a wide game above the editor and mission desk; phones scroll these two board-game workspaces so tiles remain usable.

Makitas now lays out its HUD and tool dock separately from the canvas, with fixed readable labels and touch targets. Its canvas coordinate system belongs only to the battlefield. The 75-power surge deals 45 damage and slows every live zombie for three seconds, with a 24-second simulation cooldown. S activates it; the on-screen speed button switches between normal and double speed. Bounded hit rings, blade trails, lane danger tints and wave banners add feedback without changing placement geometry or checkpoint rules.

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

## Reusing the premium arcade workspace

`src/games/premium-kit` is the common canvas workspace used by Makita Slingers, Naja Run, Pinballerz and Speed Stack. Each game still owns its `catalog.ts`, pure `run.ts`, `render.ts`, screen specification and lazy definition. `PremiumScreen` handles code, the mission dock, typed script filtering, persistence, animation lifecycle, aspect-correct canvas/input transforms, keyboard and pointer controls, pause/visibility/menu holds, bounded audiovisual feedback and the optional expanded game view. `ArcadeRun` handles only scripts and campaign boundaries; every game's mechanics remain in its own subclass.

The common configuration keys bind to game-specific variable names: `power` is `launchPower`, `fruitValue`, `flipperPower` or `perfectWindow`, for example. `createArcadeCatalog` creates an independent schema, eight missions, localized starter/sandbox scripts and explicit completion checks from each game's catalog options. Live `score`, `level`, `lives`, `actions`, `collected` and `perfects` are read-only runtime names. These four games, Block Forge and Makitas vs Zombies declare `playFirst: true` and use `free` as their starter mission. Their starter scripts declare every exposed setting at its basic default; sandbox starters use those same defaults. Their screens pass every mod and rule directly to the engine, independent of mission progress. `PlayModeNav` offers optional challenges and a return to Free Play; entering an unsaved challenge carries the current experiment. Catalog `remix` examples exercise advanced settings and live rules in tests. Invalid source keeps the last valid program running. Final missions require real arithmetic, a current score rule that has executed, custom styling and a completed stage.

Each of the four art folders contains `cover.webp`, `background.webp`, `sprites.webp` and `logo.svg`. Covers belong to the library and intro; quiet backgrounds belong to gameplay. The transparent atlases have eight actors each, with four columns and two rows. Cell padding is measured from alpha once on load, and sprites retain their proportions. Measured lower-row column boundaries keep neighboring sprites out of nonuniform generated cells. Makita Slingers uses a measured 45% row boundary because the generated beam sprites extend higher than an exact half-sheet split. Naja's up-facing head uses the down-facing sprite rotated by π because the generated atlas repeats that pose. Generated raster art uses the built-in image tool, with final prompt text and file locations in [premium-arcade-art.json](premium-arcade-art.json). Original SVG wordmarks stay scalable. WebP encoding reduces transfer size and preserves sprite alpha.

New games should provide deterministic rule tests, language/catalog checks and lifecycle integration coverage. `premium-kit/arcade.test.ts` covers campaign save validation, script gates, non-accumulating live rules, physics, Snake tail/turn rules, flipper drains, slab intersections and feedback budgets. The app smoke suite launches every new game through its actual card and language screen, edits code, advances a mission and verifies isolated progress. Browser checks cover desktop, portrait/landscape iPad sizes, phones, game expansion and WebKit.

## Native 3D worlds

A `PremiumGameSpec` can provide `createView(canvas, run)` instead of a 2D `draw`. Its `WorldView` implements resize, render and disposal, plus an optional normalized pointer handler. `PremiumScreen` then leaves the canvas exclusively to WebGL, maps full-canvas input, holds simulation while editing and owns renderer cleanup. The shared runtime names come from `catalog.runtimeLabels`. A run can override `runtime()` and its catalog can add `runtime` labels and `extraTools` for game-specific conditions.

`src/games/three-kit/world.ts` owns shaded native geometry, the perspective/orthographic camera interface, a directional shadow light, native surface textures, labels, scenery batching and bounded instanced effects. Stage rebuilds retain geometry shared with animated heroes; unmounting disposes all resources. Cleanup resets WebGL state, permits same-canvas React development remounts, and releases the context once its canvas is detached. Reduced-motion changes use a ref and never reconstruct the renderer. Still scenes stop drawing until input, code, an effect or a resize changes them.

The runner engine and view are shared by Temple Race and Subway Runnerz, with distinct corner paths, train ramps and moving hazards. Team Counters, Monster Strider and Roomba Run own their engines and views. Camera floor raycasts feed the cleaner's obstacle-aware route planner. Monster Strider samples the same bridge sag in physics and rendering. Crowds and dirt use bounded instanced meshes; crowd labels retain exact simulated totals. All five games support the same basic-first starter, code editing, optional challenges and isolated stage saves.

Each new art folder contains `cover.webp`, a transparent four-cell `sprites.webp`, and `logo.svg`. The atlas cells are used by the intro feature illustrations; the moving characters, vehicles, pickups and furniture are real geometry. The full prompts and asset paths are in [3d-arcade-art.json](3d-arcade-art.json). The design rationale and primary reference sources are in [3d-arcade-research.md](3d-arcade-research.md). `three-kit/three-games.test.ts` exercises complete basic playthroughs, all language adapters, all mods/recipes, physical collisions, arithmetic, retry boundaries, coverage and autonomous cleaning.
