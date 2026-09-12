# MODBOX

**A programmable arcade.** Students play original arcade games, then open the variables and rules
behind them and rebuild the world while they fly it.

> CODE IS THE GAME MODIFIER.

Version 1 ships **VECTOR ZERO** — an original minimalist vector asteroid survival shooter — with a
guided C# campaign, a final "build your own level" challenge, and a free sandbox where every
discovered Mod is unlocked.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other useful commands:

```bash
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm test           # vitest: interpreter, mission validation, app smoke tests
npm run typecheck  # tsc --noEmit
```

No backend, no accounts. Progress (missions, unlocks, best score, code, settings) lives in
`localStorage` under `modbox:v1`.

## CRT interface

Every screen fits inside a fixed, rounded CRT cabinet. Games and language shortcuts open
the horizontal arcade carousel, with arrow buttons, a visible scrollbar and touch swiping.
The orange controller mark and mint pixel wordmark are the current MODBOX identity.

The Lab always shows code and the running game together: side by side on larger screens,
stacked on portrait phones. Desktop uses a thin mission strip; touch devices add a draggable
joystick and a separate fire button. Editing code does not automatically pause flight.
`Console.WriteLine` appears in the **Flight Log** at the bottom right of the game.

Drag a Mod Library tile into the editor, or open its branching options to choose a value.
New declarations join the declaration section; existing mods are replaced in place. Tablet
dragging includes a release preview. **Arrange** moves complete statements within their
sections using drag handles or arrows, and editor undo can reverse these changes.

MODBOX's teaching subset permits repeated `string enemy` declarations: the last value sets
the enemy type, while `enemies` controls how many rocks spawn. This is a MODBOX convenience,
not standard C# redeclaration behavior. Other duplicate variable declarations remain errors.

Dev tools: append `?debug=1` to the Lab URL (`#/lab?mission=m03&debug=1`) or toggle **Dev debug panel**
in Settings → FPS, GameConfig, live state, active rules, parsed AST, diagnostics, Flight Log queue.

---

## The learning loop

```
LEARN → CHANGE CODE → SEE CONSEQUENCE → TEST → PLAY → DISCOVER MORE
```

Every concept unlocks a new form of control over the game:

| Mission | Concept | What the student controls |
| --- | --- | --- |
| 00 FIRST CONTACT | `string` | which rock the field spawns |
| 01 NAME YOUR MACHINE | `string` + `Console.WriteLine` | ship name on the HUD + Flight Log |
| 02 MAKE SOME TROUBLE | `int` | how many rocks are in the field |
| 03 POWER CONTROL | operators (`+ - * /`) | weapon power |
| 04 SWITCHES | `bool` | shield + rapid fire |
| 05 THE GAME CAN THINK | `if` + comparisons | the shield switches itself on at a score |
| 06 DANGER MODE | comparisons on live state | the weapon surges when integrity drops |
| FINAL MOD | everything | a whole level with rules inside it |
| FREE MOD MODE | sandbox | every Mod you discovered |

Code feedback is live: parse + apply is debounced ~380 ms, so editing a value changes the world
without a compile step. Changes that would disrupt an active run are applied at the right moment
(harmless changes immediately, rock types at wave boundaries, extra lives as a gift, lost lives next run).

---

## Architecture

The one boundary that matters: **the game never knows the language.**

```
Student code
   ↓  Language adapter        (src/interpreter/csharp)
Educational AST
   ↓  Binder                  (src/interpreter/core)
GameConfig + GameRules
   ↓  Rule engine             (src/interpreter/core/rules.ts)
VECTOR ZERO engine            (src/games/vector-zero)
```

```
src/
  app/            hash router, app shell, screens (landing, languages, arcade, lab)
  brand/          MODBOX logo + tokens
  components/     top bar, mission panel, feedback strip, quick insert, mod library,
                  game stage, unlock burst, settings, debug panel, landing demo
  editor/         CodeMirror 6 (C# highlighting, theme, error-line decorations)
  interpreter/
    core/         AST + GameConfig + limits/clamping + rule engine + program summary
    csharp/       tokenizer → parser → binder → CSharpAdapter
  games/vector-zero/
    engine/       fixed-timestep loop, entities, physics, spawn, live config bridging
    rendering/    canvas vector renderer + HUD + starfield
    audio/        runtime-synthesised sound (no audio assets)
  learning/
    missions/     mission content + code merging + unlock rules
    validation/   language-agnostic mission checks (structure + behaviour)
  state/          zustand progress store + localStorage persistence
  styles/         design tokens + component CSS
```

### Visual language

Neon blue on blue-black. Surfaces are deliberately dark (`--ink #050a20`) so the electric blue
(`--blue #2c5cff`) can actually glow, and one lime accent (`--neon #c9ff3d`) carries reward — the
`LIVE` badge, cleared pips, the "MOD APPLIED" beat, and the single hero CTA. Marketing screens get
the graph-paper blue field and the bright card; the Lab stays quiet navy so code and canvas stay
readable. Every colour lives in `src/styles/tokens.css` — nothing else hard-codes a hex.

### Adding Python or Swift

1. Write one adapter (`src/interpreter/python/`) that turns source into the same
   `ProgramResult` — AST, `GameConfig`, `GameRule[]`, diagnostics, Flight Log lines.
2. Register it in `src/interpreter/adapters.ts`.
3. Add the language to `LANGUAGES` (`src/interpreter/core/adapter.ts`) — it flips from
   `COMING SOON` to `PLAY` automatically.

Missions, validation, game config, rules, HUD and the engine are untouched: they only ever see the
educational AST and `GameConfig`.

### C# subset (v1)

Supported: `string` / `int` / `bool` declarations, assignment, `+ - * /`, comparisons
(`> < >= <= == !=`), `&&`/`||`/`!`, `if { }` (nested `if`s become joined rules), `Console.WriteLine`
with concatenation. Unsupported constructs (`while`, `class`, `var`, `+=`, …) produce a short
friendly explanation, with the real C# code tucked behind "show technical details". Values are
clamped to safe ranges with a personality line instead of an error.

Top-level `if` statements do not run once: they become **live rules** evaluated against
`score`, `health`, `wave`, `enemiesRemaining` every frame (`WHILE score >= 300 → enemySpeed = 5`).

---

## Quality gates

* `npm run typecheck` — strict TypeScript, no unused locals, clean.
* `npm test` — 72 tests: interpreter (types, arithmetic, conditions, clamping, unsupported syntax,
  recovery), mission validation (structure + behaviour, alternative solutions), code merging,
  and app smoke tests that mount the real screens in jsdom.
* Layout: the Lab locks to one viewport and never scrolls the page; marketing screens scroll freely.
  Safe-area insets respected, flex/grid children carry `min-width: 0`, and no asset is allowed to
  poke past a screen edge (verified from 320 px phones to iPad landscape and up).
* Controls: editor focus disables gameplay keys; the canvas ignores keys while the editor is focused.
* Performance: 60 fps canvas, fixed timestep, entity caps, no React re-renders during play,
  devicePixelRatio-aware rendering, tab-visibility pausing, `prefers-reduced-motion` respected.
* Accessibility: semantic landmarks, labelled controls, focus-visible states, 16 px minimum body
  text, colour never used as the only signal.
