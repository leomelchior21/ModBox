# Current campaigns

All games have seven teaching missions, a final challenge and Free Mod Mode. Mods are cumulative and work in Python, Swift and C#.

| Stage | Vector Zero | Neon Maze | Devil Floor | Makitas vs Zombies |
| --- | --- | --- | --- | --- |
| 00 | Change the rock type | Recolor the ball and maze, initially dark and without enemies | Add a backdrop to the starting island | Add sunset or night scenery |
| 01 | Name the ship and transmit | Create three or more sentinels | Build six or more platforms | Add grass or concrete lanes and props |
| 02 | Set the rock count | Increase movement speed with arithmetic | Add glowing or crumbling platform effects | Enable and deploy machines |
| 03 | Increase weapon power with arithmetic | Collect a stun gem and catch a sentinel | Increase jump strength and jump | Add a zombie type and defeat one |
| 04 | Declare shield and rapid fire as false | Extend and perform a phase jump | Increase running speed with arithmetic | Increase blade damage with arithmetic |
| 05 | Use a score rule to enable the shield | Turn on Room Lights to remove darkness | Enable and perform a double jump | Increase power supply and automate collection |
| 06 | React to low health with weapon power | Use a score rule to enable the shield | Activate a shield with a crystal-score rule | Activate twin blades through a kill rule |
| Final | Build and fly a complete sector | Use a live rule and escape the lit maze | Choose lighting and fireball style, then escape the constructed world | Defend the constructed yard through wave three with a live rule |

## Gameplay details

- Maze gems stun the squad. Touching a stunned sentinel awards 100 points once per capture; it returns away from the player after the stun expires. Phase jumps show a raised arc, a path and expanding rings. Pickups, catches and impacts emit bounded effects, with reduced-motion support.
- Devil Floor starts with zero additional platforms. `platforms` builds or shortens the route live. Removing the player's platform returns them safely to an available platform. `platformEffect` chooses plain, glowing or crumbling platforms; `background`, `timeOfDay` and `fireballStyle` control the world presentation. Fireball styles also enable or disable their hazards.
- Makitas starts in build mode. `ground` enables the board, `toolbox` enables machine choices and `zombieType` enables the invasion. A mixed invasion introduces tougher variants by wave; individual types can also be selected.
- Makitas automatically saves the defense at each wave boundary, including machines, upgrades, health, power, score, sweepers and cumulative run metrics. Retry and reload restore that boundary, so an interrupted wave is replayed without resetting earlier waves. Build changes between waves also update the checkpoint. Resetting the game's progress clears it. Code edits continue to apply to the restored defense.
- The new [machine and zombie atlas](makitas-sprites-v2.md) provides four frames for each of eight actors. The game preserves sprite proportions and displays still frames with reduced motion enabled.
