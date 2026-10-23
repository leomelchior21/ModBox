# Current campaigns

All games support Python, Swift and C#. Makitas vs Zombies, Block Forge, Makita Slingers, Naja Run, Pinballerz, Speed Stack, Temple Race, Subway Runnerz, Team Counters, Monster Strider, Roomba Run, Tomatina, Neon Maze and Anominers start in Free Play with complete basic settings and every mod and rule tool available. Their seven teaching missions and final challenge are optional suggestions, with unrestricted navigation back to Free Play. Upgrades start off so enabling one produces a noticeable change. Switching modes seeds unsaved challenge code from the current experiment while preserving existing saved code and checkpoints. The original three games retain progressive unlocks.

| Stage | Vector Zero | Neon Maze (until its rebuild) | Devil Floor | Makitas vs Zombies | Block Forge |
| --- | --- | --- | --- | --- | --- |
| 00 | Change the rock type | Recolor the ball and maze, initially dark and without enemies | Add a backdrop to the starting island | Change sunset scenery to night | Change the block palette |
| 01 | Name the ship and transmit | Create three or more sentinels | Build six or more platforms | Change grass lanes to concrete with props | Give the forge a custom name |
| 02 | Set the rock count | Increase movement speed with arithmetic | Add glowing or crumbling platform effects | Enable and deploy machines | Increase line value with arithmetic |
| 03 | Increase weapon power with arithmetic | Collect a stun gem and catch a sentinel | Increase jump strength and jump | Add a zombie type and defeat one | Enable and rotate a piece |
| 04 | Declare shield and rapid fire as false | Extend and perform a phase jump | Increase running speed with arithmetic | Increase blade damage with arithmetic | Enable and request a placement hint |
| 05 | Use a score rule to enable the shield | Turn on Room Lights to remove darkness | Enable and perform a double jump | Increase power supply and automate collection | Enable and undo a placement |
| 06 | React to low health with weapon power | Use a score rule to enable the shield | Activate a shield with a crystal-score rule | Activate twin blades through a kill rule | Activate combo scoring through a line-clear rule |
| Final | Build and fly a complete sector | Use a live rule and escape the lit maze | Choose lighting and fireball style, then escape the constructed world | Defend the constructed yard through wave three with a live rule | Clear three lines with custom styling, arithmetic and an executed combo rule |

## Gameplay details

The four additional campaigns use the same eight-stage learning arc with independent mods and saves:

| Stage | Makita Slingers | Naja Run | Pinballerz | Speed Stack |
| --- | --- | --- | --- | --- |
| 00 | Change the quarry palette | Recolor the temple | Rebuild the stadium | Choose a skyline palette |
| 01 | Name the slinger crew | Name the temple runner | Name the striker | Name the architect |
| 02 | Increase launch power with arithmetic | Increase fruit value with arithmetic | Raise boot power with arithmetic | Increase the perfect window with arithmetic |
| 03 | Launch with the trajectory preview | Cross a wall portal | Let SUPER KEEPER make a save | Use magnetic alignment |
| 04 | Increase robot bounty and score | Increase growth and gather fruit | Increase goal points and score | Increase perfect bonus and score |
| 05 | Change quarry gravity and launch | Change movement speed and turn | Change the pitch tilt and play | Change slab speed and drop |
| 06 | Activate blast blades with a score rule | Activate Jade Rush with a score rule | Unlock the Power Shot with a score rule | Activate Focus with a score rule |
| Final | Dismantle every robot in a quarry | Collect five fruits and clear a garden | Win a full match | Place fifteen slabs and complete a skyline |

Each optional final challenge also requires the current custom palette, player name, arithmetic and an executed score rule. Challenge completion never gates a mod, a live rule or Free Play.

- Maze gems stun the squad. Touching a stunned sentinel awards 100 points once per capture; it returns away from the player after the stun expires. Phase jumps show a raised arc, a path and expanding rings. Pickups, catches and impacts emit bounded effects, with reduced-motion support.
- Devil Floor starts with zero additional platforms. `platforms` builds or shortens the route live. Removing the player's platform returns them safely to an available platform. `platformEffect` chooses plain, glowing or crumbling platforms; `background`, `timeOfDay` and `fireballStyle` control the world presentation. Fireball styles also enable or disable their hazards.
- Makitas starts with sunset scenery, grass lanes, props, the full toolbox and a worker invasion. Damage, power supply and speed use basic settings; auto collection, twin blades and overdrive start off. Deploying defenders and collecting batteries are normal gameplay. `ground`, `toolbox` and `zombieType` can still be set to `none` to experiment with construction. A mixed invasion introduces tougher variants by wave; individual types can also be selected.
- Makitas automatically saves the defense at each wave boundary, including machines, upgrades, health, power, score, sweepers and cumulative run metrics. Retry and reload restore that boundary, so an interrupted wave is replayed without resetting earlier waves. Build changes between waves also update the checkpoint. Resetting the game's progress clears it. Code edits continue to apply to the restored defense.
- The new [machine and zombie atlas](makitas-sprites-v2.md) provides four frames for each of eight actors. The game preserves sprite proportions and displays still frames with reduced motion enabled.
- Makitas has a 75-power surge: 45 damage and three seconds of slowdown against all live zombies, recharging over 24 simulation seconds. Use S or the surge button. A speed toggle accelerates the simulation and its feedback together. HUD labels no longer shrink with the battlefield; tool cards, collection and tactical buttons have larger touch targets.
- Block Forge has no timer. Place three-piece trays on an 8×8 board and fill rows or columns. Crossing lines clear together, consecutive clearing moves build combos, and non-clearing moves reset the combo. Every game has three reshuffles. Rotation-aware move checks prevent a false game over when a rotated piece fits. The board and resources save between actions and missions; undo restores the previous placement within the current session. Reduced motion keeps line-clear and score messages without animated bursts.
- Makita Slingers uses deterministic, substepped gravity, circle/rectangle blade contact and mass-weighted rectangle contacts for destructible timber, steel, crates and robots. Ground impacts and falling supports can finish weakened robots. Crates chain into nearby actors; each destroyed actor awards points once. Dragging sets launch velocity and the aim guide uses the same gravity equation. Up/Down adjusts keyboard aim, Space fires and E triggers an unlocked blast in flight. Five blades start each stage by default. Clear all robots to unlock tougher quarries.
- Naja Run moves on an 18×18 board with a two-turn queue. Opposite turns are rejected, and entering a tail cell is legal when that tail vacates on the same move. Wall portals wrap the board; collisions otherwise consume a charm and respawn the snake. Every third collectible is a crystal worth triple points. Jade Rush doubles fruit scoring and unlocks a four-second shield with a twelve-second recharge. Stones and occupied cells are excluded from food placement. Garden goals rise from five fruits, capped at twelve.
- Pinballerz is soccer pinball. Two flippers guard your goal at the bottom of a striped pitch; the white rail funnels the ball onto them, and a 600 Hz sub-stepped engine hands each swinging flipper's surface speed to the ball. Purple defenders clear the ball out wide (some patrol or shadow it), the rival keeper reads each shot with stage-dependent speed and accuracy, and your own keeper tracks drains and boots saves back up the pitch. Goals score `goalPoints` times the combo streak, with VOLLEY, BANK SHOT, REBOUND, TEAM GOAL and POWER SHOT bonuses and a hat-trick prize. Tokens give a fireball, extra balls, a goal-line wall, a frozen keeper or double points. Twelve named matches (Kick-Off to Cup Final) add defenders, movers, markers, a sharper keeper, dusk and night floodlights. Extra mods: `teammates`, `extraDefenders`, `ballsInPlay`, `difficulty`, `celebration` and `crowdSize`. Tap either half of the pitch to swing that flipper; Space or a tap kicks off; E fires an unlocked Power Shot. `PINBALL_CAMPAIGN=1 npm test` runs a look-ahead bot through all twelve matches.
- Speed Stack alternates movement along two isometric axes. Intersections determine the surviving slab; overhangs become bounded falling offcuts. Three consecutive perfects widen the tower, up to its maximum size. Magnetic alignment adds a small tolerance. Focus slows movement for three seconds with a twelve-second recharge. A full miss consumes a chance. Stage goals rise from fifteen slabs, capped at twenty-five.
- These four games save stage starts and clears. Retrying restores that boundary, including score and mission metrics; it replays an interrupted stage. Finishing a stage and leaving restores its cleared screen. Editing, menus, tab hiding and pausing hold the simulation and effects, and release held input. Expand Game gives the stage the full workspace; Show Code restores the desk. Original artwork, measured sprite cells and wordmarks are documented in [the art manifest](premium-arcade-art.json).

## The five 3D campaigns

Temple Race, Subway Runnerz, Team Counters, Monster Strider and Roomba Run also use eight optional challenges: palette, name, arithmetic, assistance, scoring, physics, a live rule and a completed stage. They enter a complete basic game in Free Play with all mods and tools available.

| Game | Complete stage | Distinctive mods | Extra runtime names |
| --- | --- | --- | --- |
| Temple Race | Reach the beacon along the turning causeway | jumpPower, coinMagnet, runSpeed, relicShield | distance, coins, streak |
| Subway Runnerz | Reach the station using tracks and train roofs | jumpPower, coinMagnet, runSpeed, hoverboard | distance, coins, streak |
| Team Counters | Win the castle clash and reach the victory steps | recruitBonus, gatePreview, runSpeed, teamShield | distance, team, gates |
| Monster Strider | Cross the bridges and both gaps to the finish | enginePower, autoBalance, gravity, nitro | distance, velocity, airborne |
| Roomba Run | Clean 90% of accessible floor and return to dock | suction, smartRoute, driveSpeed, turboBrush | battery, cleaned, patches |
| Tomatina | Finish the street's goals: robots, plaza paint, bullseyes, golden tomatoes, the exit or the washer | throwPower, autoAim, tomatoGravity, tomatoRain, tomatoSize, bounces, bagSize, runSpeed, extraRobots, robotLevel, amigos, splatParty | splats, paint, tomatoes, dry, combo |

Stage boundaries save score and learning metrics. Truck recovery uses safe islands within a stage. Failed crowd choices rewind the choice and score together. Vacuum recharging preserves dirt progress during the current job. Original art and reference research are documented in [3d-arcade-research.md](3d-arcade-research.md).

## Tomatina

Tomatina is a first-person tomato fight through twelve hand-drawn streets: La Calle, Paint the Plaza, Bullseye, Hose Alley, Umbrella Square, The Market, Bank Shot, Plaza Mayor, The Labyrinth, Midnight, The Storm and The Great Washer. The Limpiabots (cleaning robots) took the town's tomatoes; splatting one makes it drip red and drop the tomatoes it confiscated. Nobody is hurt: getting soaked by a hose costs a dry shirt and sends you back to the start of the street.

- Each street is a grid of 2 m cells (`src/games/tomatina/levels.ts`). Goals combine splatting robots, painting a dotted plaza to a percentage, hitting bullseye targets (which lift the gate to the exit), finding golden tomatoes, reaching the fiesta arch and beating La Gran Lavadora, a washing machine whose door only opens between spin cycles and slams after five tomatoes.
- Aim like a mobile shooter: drag anywhere to turn and tilt the view, then tap anywhere (or press THROW or Space) to throw at the crosshair. The run casts a ray along the crosshair through the grid and lobs the tomato on the arc that lands exactly there; aiming at open sky throws high, which is how you lob over an umbrella. On tablets the pad walks and sidesteps; on keyboards the arrows walk and turn.
- Crates refill the whole bag and come back after ten seconds, splatted robots drop tomatoes, and when the bag is nearly empty the neighbours toss you one every few seconds. The goals checklist, the street briefing and a compass that points at the next goal (or the nearest crate when you run dry) keep the aim of each street clear.
- Robots have personalities: mop bots scrub your paint away, hose bots keep their distance and spray arcs of water, umbrella bots block tomatoes from the front until the canopy droops under three tomatoes, and robot vacuums zoom around eating paint.
- Mods change how it plays: arm strength and tomato gravity reshape every arc, `bounces` turns throws into bank shots, `tomatoSize` paints wider and splashes nearby robots from size 4, `bagSize` and `runSpeed` change the pace, `extraRobots` and `robotLevel` change the fight, `amigos` brings townsfolk who throw with you, and `splatParty` changes what a splatted robot does.
- `worldTheme` tours real places in their own inks and wall art (Buñol, La Boqueria, the Alhambra, Metro Sol and Park Güell); `characterStyle` changes the arm on screen and the face on the status bar; `weather` is live and changes play: rain rinses paint off the street, wind pushes tomatoes sideways, fog and night shorten everyone's sight.
- The renderer draws the scene at about 210 lines into colour and depth buffers, then one pass turns grey levels into ordered dither between the town's paper and ink, outlines depth edges, keeps pure red as tomato red, dissolves the distance into fog and adds drips when you are soaked.
- The test bot in `testBots.ts` plays with the same inputs as a student (turn, walk, tap) and clears all twelve streets; the first three take it under 40 seconds.

## Neon Maze

Neon Maze was rebuilt as a premium 3D game in the arcade kit (cabinet ID `maze`, so links and saves keep working). It opens in Free Play like the other premium games and keeps almost every variable name of the original: `moveSpeed`, `sentinels`, `sentinelSpeed`, `shield`, `coreValue`, `gemDuration`, `phaseLength`, `mazeSize`, `revealMap`, `trail`, `wallColor` and `runnerName`, plus the `energy`, `cores`, `dots` and `steps` runtime names, so old code still parses.

- Twelve seeded sectors (`src/games/neon-maze/levels.ts`): Boot Sequence, First Contact, Ghost Train, Amber Rush, Phase Walls, Blackout, Wraparound, Hunter Pack, Overclock, The Long Train, Static Storm and The Warden. Mazes are carved on a tile grid and braided so there are no dead ends; three gems open the exit portal.
- The runner moves tile to tile with remembered turns and instant reversing, and waits for your first input. Dots build FLOW (×1 to ×8) while you keep collecting; a gem freezes every sentinel, and catches pay double, then double again.
- Hunters have roles (chase, cut off, flank, guard the gems). Sleeping drones wake as you pass and follow you in a ghost train: grab a gem, turn around and devour the whole train. Bumping into your own train only scatters it and resets FLOW. The Warden must be caught three times while frozen; its gems come back.
- SPACE (or a tap) phase-dashes through walls; some sectors seal a gem behind walls. TIME WARP (E) slows the sentinels when unlocked.
- `worldTheme` rebuilds the grid (synthwave, 1980 arcade, code rain, abyss, vapor sunset); `characterStyle` swaps the runner (orb, comet, saucer, pixel cube, chomper); `weather` is live interference (static, blackout, storm, data snow).
- Sentinels and the saucer are modelled in the Unity studio (`sentinels.glb`). The view renders neon edges with bloom, a follow camera and a light trail. The test bot in `testBots.ts` only steers and dashes, and clears all twelve sectors.

## Anominers

A cozy asteroid-mining roguelike drawn like an old home computer: about 220 lines in two inks, scaled up with crisp pixels.

- Twelve asteroids grown from seeds (`src/games/anominers/levels.ts`), from First Rock to The Anomaly. Each has its own size, caves, minerals (copper 1, ice 1, crystal 3, gold 5), a mineral quota, an anomaly timer and threat; some hide lost technology, magma pockets burn your hull, and the last one is the anomaly core itself.
- Your drill beam cuts whatever is in front of the ship; loose minerals drift to you and fill the cargo hold. Fly home to bank them (and repair). When the quota (and any lost tech) is in, dock at the base for 2.5 seconds to warp.
- When the timer runs out the anomaly opens a rift, corrupts the rock around it and sends anomalites through the stone after you and your drones. Blast them (Space or a tap), destroy the rift for a big bonus, or bank fast and run. A wreck spills half the cargo and launches a spare hull.
- Mods change the run: drill power, thrusters, cargo hold, beam range, ore magnet, drone crew and drone bay (E builds a drone for 10 minerals), blaster level, swarm size and the anomaly's mood. `worldTheme` changes sector (the ice fields make the ship drift), `characterStyle` the ship, and `weather` brings meteors that crater the rock, solar wind, a nebula that hides everyone, or an ion storm.
- On tablets, hold a finger where you want to fly and tap to blast; the square pads work too. The test bot in `testBots.ts` uses only the arrows and BLAST and clears all twelve asteroids.
