# Five original 3D arcade games

Research and implementation brief, 18 October 2026. This document separates the mechanics described by the original developers from the design choices made for MODBOX. The implementations, characters, worlds, logos, scoring and artwork are original.

## Reference mechanics

| Reference and primary source | What the source establishes | MODBOX adaptation |
| --- | --- | --- |
| [Temple Run, Imangi’s App Store description](https://apps.apple.com/us/app/temple-run/id420009108) and [Temple Run+, developer description](https://apps.apple.com/ca/app/temple-run/id1633285841) | A constantly moving 3D character, turns, jumping, sliding, dangerous paths, coins and power-ups. | **TEMPLE RACE** uses real right-angle jungle causeways, signed corner windows, jumps, slides, coin chains and a rechargeable aegis. |
| [Subway Surfers controls, SYBO](https://sybo.helpshift.com/hc/en/10-subway-surfers-1754912401/faq/285-basics/) and [board powers, SYBO](https://sybo.helpshift.com/hc/en/5-subway-surfers/faq/208-hoverboards-their-powers/) | Horizontal swipes change lanes, upward swipes jump, downward swipes roll and cancel jumps. Boards can protect a run and change movement abilities. | **SUBWAY RUNNERZ** separates three rail lanes, moving oncoming trains, stationary ramp-and-roof routes, barriers and low signs. Its editable hoverboard enables a timed crash save. |
| [Count Masters, Freeplay’s App Store description](https://apps.apple.com/us/app/count-masters-crowd-runner-3d/id1568245971) and [publisher page](https://freeplay.io/games/count-masters/) | Gate selection grows a crowd; rival crowds and obstacles consume it; the end goal is a castle battle. | **TEAM COUNTERS** offers addition, multiplication, subtraction and division, with exact integer results, a rally action, moving saws, visible rivals and victory multipliers. |
| [Monster Tracks, Fancade’s game documentation](https://www.fancade.com/wiki/Monster_Tracks) and [Drive Mad controls](https://www.fancade.com/wiki/Drive_Mad) | Throttle and reverse/braking, vehicle balance, deforming bridges, uneven terrain, gaps and ramps make speed control matter. | **MONSTER STRIDER** uses a fixed isometric camera, four articulated wheels, air rotation, suspension, two gap jumps and local recovery checkpoints. |
| [Robot Vacuum Simulator, developer’s Steam description](https://store.steampowered.com/app/4981700/Robot_Vacuum_Simulator/) | Cleaning coverage, visible dirt removal, furniture navigation, equipment upgrades and returning to a dock provide the simulation loop. The listing describes a planned November 2026 release; it is a design reference, not a claim of hands-on testing. | **ROOMBA RUN** has a playable furnished apartment, persistent clean trails during a job, reachable-floor coverage, battery use, recharging, tap-to-route movement and an optional autonomous cleaning mod. |

## Design decisions

These decisions are our interpretation of the genre patterns, rather than claims made by the cited developers.

### A complete game first

All five games enter Free Play with every supported setting declared in the code. Basic settings keep assistance and special abilities off. The full world, regular controls and win/loss loop work immediately. All mods and runtime recipes are available in Python, Swift and C#. Optional challenges suggest experiments without restricting access.

Each game has a compact stage with a visible destination and an immediate next-stage loop. Stage-start and stage-clear saves retain score and learning progress. Interrupted stages replay from their start, which keeps restoration deterministic. Vehicle falls recover at a local safe island; failed crowd choices rewind to before the last gate and roll back the corresponding score. Cleaning progress remains intact when a spare battery rescues the robot during the current job.

### Read the danger before reacting

The runners begin with a coin-only lead-in, then introduce barriers before denser combinations. Obstacles leave alternative lanes, and Temple Race keeps obstacle rows out of its corner windows. Turns are marked ahead and accept a buffered direction. The two runner games share reliable collision and movement code but have different route structures, scenes and special abilities.

Subway ramps are continuous physical surfaces leading to elevated train roofs. Moving trains approach along their track; roof routes stay stationary so their entrance remains readable. Sliding cancels an upward jump. Higher jump-power settings change actual airborne trajectories, including which routes can be cleared.

Team Counters places its first arithmetic choice well before the first opponent. A gate’s printed operation determines the actual crowd count, with division rounding down. The gate-preview mod shows projected counts and highlights the better result without steering for the player. Moving saws offer a separate positioning challenge. Crowd meshes are bounded while the large count label preserves the exact simulated population.

Monster Strider’s first safe island provides room to accelerate and brake. A rising ramp visibly leads into each gap. Throttle affects acceleration and air rotation; releasing or braking changes the landing. The bridge deck and the simulation share the same sag function. The basic truck can cross the entire route; extra torque and nitro require more control rather than making them mandatory.

Roomba Run counts only accessible floor cells connected to its dock. Furniture footprints are inflated by the robot’s radius for path planning, while elevated tables allow travel underneath. Both manual tap targets and smart cleaning use the same path finder. There is no clock forcing a quick clean: battery use and a convenient return-to-dock action provide the route-planning decision.

### Make improvement visible

The short feedback cycle is input → visible world change → readable result → another decision. Each game includes score feedback, particles, synthesized sound and a clear progress bar. Coin chains, clean turns, successful landings, better arithmetic choices and completed patches provide intermediate rewards. Stage completion gives a saved boundary and a clear next target.

Mods affect real simulation state rather than merely changing labels. Examples:

| Game | Immediate experiments | Reactive recipe |
| --- | --- | --- |
| Temple Race | Jump height, running speed, cross-lane coin collection, colors, coin value, shield availability | Enable `relicShield` after `distance >= 100`. |
| Subway Runnerz | Jump height, coin magnet, pace, token value, hoverboard availability | Enable `hoverboard` after `coins >= 10`. |
| Team Counters | Extra recruits through positive gates, projected gate results, pace, battle rewards | Increase `recruitBonus` while `team < 20`. |
| Monster Strider | Torque, gravity, stabilizing assistance, nitro and coin rewards | Turn on `autoBalance` while `airborne > 0`. |
| Roomba Run | Suction radius/strength, driving speed, smart routing, turbo brush and patch rewards | Enable `smartRoute` when `battery <= 25`; enable turbo availability when `cleaned >= 50`. |

Changes to starting chances apply on retry. Abilities have explicit buttons, durations and cooldowns. Invalid code retains the last valid configuration. Editing, menus, tab hiding and pausing hold the simulation and release input so experimentation does not cost a life.

### Controls and comfort

Keyboard, on-screen buttons and pointer/touch controls enter the same simulation actions. Runners use swipes and taps; Team Counters uses continuous lateral dragging; Monster Strider supports independent left/right touch holds; Roomba Run raycasts floor taps into world positions and plans around furniture. A game-expansion button provides a larger scene while retaining the mounted code editor for the return trip.

The shared iPad layout keeps readable game stats separate from the canvas and places the wide game above the editing desk in portrait. Phones scroll the game and desk without squeezing either into an unusable height. Reduced motion removes particle movement and unnecessary camera smoothing, and sound is optional.

## Rendering and assets

The new scenes use Three.js WebGL2, perspective cameras for the runners, crowd and cleaner, and an orthographic isometric camera for the truck. Geometry, world coordinates, depth testing, lighting and camera projection are real 3D. Character rigs, the instanced crowds, truck and vacuum are authored as meshes. Original generated covers and transparent UI atlases complement native SVG wordmarks and code-authored surface textures. Asset prompts and saved paths are recorded in [3d-arcade-art.json](3d-arcade-art.json).

The renderer uses pooled/instanced geometry for repeated road tiles, rails, crowd parts and dirt. One directional shadow light, a capped pixel ratio, distance visibility and bounded particles limit rendering work. Every renderer releases geometries, materials, textures, shadow maps, frame callbacks and its WebGL context when unmounted. The 3D dependency loads with these game screens rather than the home page or older games.

Technical references: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [PerspectiveCamera](https://threejs.org/docs/pages/PerspectiveCamera.html), and [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html).

## Validation approach

Simulation tests cover all three language adapters, every mod and recipe, invalid-code retention, pauses, isolated saves, collisions, ramps, turns, crowd arithmetic, safe retries, vehicle gaps, reachable floor coverage and autonomous recharge/finish behavior. Automated basic-control playthroughs verify that both runners, the crowd course and the stunt trail are completable. Browser checks exercise real WebGL rendering, inputs, live editing, resizing, iPad/phone layouts, asset loading and transitions between games. Browser emulation checks layout and interaction; physical iPad GPU performance remains device-dependent.
