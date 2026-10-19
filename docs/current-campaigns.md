# Current campaigns

All games support Python, Swift and C#. Makitas vs Zombies, Block Forge, Makita Slingers, Naja Run, Pinballerz, Speed Stack, Temple Race, Subway Runnerz, Team Counters, Monster Strider and Roomba Run start in Free Play with complete basic settings and every mod and rule tool available. Their seven teaching missions and final challenge are optional suggestions, with unrestricted navigation back to Free Play. Upgrades start off so enabling one produces a noticeable change. Switching modes seeds unsaved challenge code from the current experiment while preserving existing saved code and checkpoints. The original three games retain progressive unlocks.

| Stage | Vector Zero | Neon Maze | Devil Floor | Makitas vs Zombies | Block Forge |
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
| 00 | Change the quarry palette | Recolor the temple | Change the table lighting | Choose a skyline palette |
| 01 | Name the slinger crew | Name the temple runner | Name the pinball player | Name the architect |
| 02 | Increase launch power with arithmetic | Increase fruit value with arithmetic | Tune flipper power with arithmetic | Increase the perfect window with arithmetic |
| 03 | Launch with the trajectory preview | Cross a wall portal | Trigger an early ball save | Use magnetic alignment |
| 04 | Increase robot bounty and score | Increase growth and gather fruit | Increase bumper value and score | Increase perfect bonus and score |
| 05 | Change quarry gravity and launch | Change movement speed and turn | Change table pitch and launch | Change slab speed and drop |
| 06 | Activate blast blades with a score rule | Activate Jade Rush with a score rule | Activate jackpot scoring with a score rule | Activate Focus with a score rule |
| Final | Dismantle every robot in a quarry | Collect five fruits and clear a garden | Reach the table target | Place fifteen slabs and complete a skyline |

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
- Pinballerz simulates a ball against table rails, three jet bumpers, three star targets and two moving flipper capsules. The launch-lane deflector feeds the bumper cluster. A newly pressed flipper adds a stronger upward impulse than a resting flipper. Space launches or pulses both flippers; Left/Right or A/D holds them separately. Touch controls support both hands. N gives one of three stage nudges. An enabled ball save rescues one drain during the first seven seconds after launch. Three stars award a jackpot, while the score target advances the table.
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

Stage boundaries save score and learning metrics. Truck recovery uses safe islands within a stage. Failed crowd choices rewind the choice and score together. Vacuum recharging preserves dirt progress during the current job. Original art and reference research are documented in [3d-arcade-research.md](3d-arcade-research.md).
