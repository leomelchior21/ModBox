# Current campaigns

All games have seven teaching missions, a final challenge and Free Mod Mode. Mods are cumulative and work in Python, Swift and C#.

| Stage | Vector Zero | Neon Maze | Devil Floor | Makitas vs Zombies | Block Forge |
| --- | --- | --- | --- | --- | --- |
| 00 | Change the rock type | Recolor the ball and maze, initially dark and without enemies | Add a backdrop to the starting island | Add sunset or night scenery | Change the block palette |
| 01 | Name the ship and transmit | Create three or more sentinels | Build six or more platforms | Add grass or concrete lanes and props | Give the forge a custom name |
| 02 | Set the rock count | Increase movement speed with arithmetic | Add glowing or crumbling platform effects | Enable and deploy machines | Increase line value with arithmetic |
| 03 | Increase weapon power with arithmetic | Collect a stun gem and catch a sentinel | Increase jump strength and jump | Add a zombie type and defeat one | Enable and rotate a piece |
| 04 | Declare shield and rapid fire as false | Extend and perform a phase jump | Increase running speed with arithmetic | Increase blade damage with arithmetic | Enable and request a placement hint |
| 05 | Use a score rule to enable the shield | Turn on Room Lights to remove darkness | Enable and perform a double jump | Increase power supply and automate collection | Enable and undo a placement |
| 06 | React to low health with weapon power | Use a score rule to enable the shield | Activate a shield with a crystal-score rule | Activate twin blades through a kill rule | Activate combo scoring through a line-clear rule |
| Final | Build and fly a complete sector | Use a live rule and escape the lit maze | Choose lighting and fireball style, then escape the constructed world | Defend the constructed yard through wave three with a live rule | Clear three lines with custom styling, arithmetic and an executed combo rule |

## Gameplay details

- Maze gems stun the squad. Touching a stunned sentinel awards 100 points once per capture; it returns away from the player after the stun expires. Phase jumps show a raised arc, a path and expanding rings. Pickups, catches and impacts emit bounded effects, with reduced-motion support.
- Devil Floor starts with zero additional platforms. `platforms` builds or shortens the route live. Removing the player's platform returns them safely to an available platform. `platformEffect` chooses plain, glowing or crumbling platforms; `background`, `timeOfDay` and `fireballStyle` control the world presentation. Fireball styles also enable or disable their hazards.
- Makitas starts in build mode. `ground` enables the board, `toolbox` enables machine choices and `zombieType` enables the invasion. A mixed invasion introduces tougher variants by wave; individual types can also be selected.
- Makitas automatically saves the defense at each wave boundary, including machines, upgrades, health, power, score, sweepers and cumulative run metrics. Retry and reload restore that boundary, so an interrupted wave is replayed without resetting earlier waves. Build changes between waves also update the checkpoint. Resetting the game's progress clears it. Code edits continue to apply to the restored defense.
- The new [machine and zombie atlas](makitas-sprites-v2.md) provides four frames for each of eight actors. The game preserves sprite proportions and displays still frames with reduced motion enabled.
- Makitas has a 75-power surge: 45 damage and three seconds of slowdown against all live zombies, recharging over 24 simulation seconds. Use S or the surge button. A speed toggle accelerates the simulation and its feedback together. HUD labels no longer shrink with the battlefield; tool cards, collection and tactical buttons have larger touch targets.
- Block Forge has no timer. Place three-piece trays on an 8×8 board and fill rows or columns. Crossing lines clear together, consecutive clearing moves build combos, and non-clearing moves reset the combo. Every game has three reshuffles. Rotation-aware move checks prevent a false game over when a rotated piece fits. The board and resources save between actions and missions; undo restores the previous placement within the current session. Reduced motion keeps line-clear and score messages without animated bursts.
