# Library artwork

The home, arcade, and language screens use each game's `hero` image through `GameArtwork`, with the same image frame and availability badge. Existing artwork is reused for Vector Zero, Runner, and Devil Floor. The registered `Cover` component remains a fallback if the image cannot load.

## NEON MAZE cover

- Final asset: `public/art/neon-maze-lines.webp`.
- Created and then edited with the built-in imagegen tool; both original generated PNGs are retained in the Codex generated-images directory.
- WebP compression preserves the generated composition while reducing download size.
- Initial generation prompt (the block-wall concept was replaced by the neon-line edit below):

```text
Use case: stylized-concept. Asset type: wide landscape game cover illustration for MODBOX's NEON MAZE, also used in a selected-game language screen. Create a cinematic low-poly neon labyrinth chase illustration. An elevated three-quarter top-down view of a clearly connected maze of dark faceted teal-black walls edged with bright violet and cyan light. A small luminous ivory-white spherical runner with a thin lime aura and a flowing trail navigates a corridor, chased by four distinct faceted diamond sentinels, pink, cyan, violet and amber. Three small golden energy cores glow in other corridors and a lime exit gate glows in the distance. Crisp angular geometries, dark emerald atmospheric background, cyan rim lighting, restrained purple and gold accents, beautiful arcade key art, energetic but readable at thumbnail size. Wide 3:2 composition, fill the frame with the labyrinth, main runner centered slightly right; keep the entire chase group inside the middle 70% so a 16:9 crop remains clear. No spacecraft, no humans, no text, no logos, no lettering, no watermark, no UI.
```

- Final edit prompt, using that generated cover as the edit target:

```text
Edit this NEON MAZE game cover to reflect a scrolling neon-line labyrinth. Preserve the dark teal arcade palette, white glowing orb runner with lime trail, four colored diamond sentinels, three amber gems and green exit gate. Replace every chunky solid block wall with delicate continuous cyan and violet laser-light lines tracing the maze corridors, a nearly flat holographic labyrinth extending into the distance on a deep black teal background. No thick walls, no solid block obstacles, no raised faceted architecture. Add neat trails of small luminous dots along the navigable corridors, with the orb collecting them. Near an amber gem, one sentinel is temporarily stunned, pale cyan with a subtle halo. Three-quarter top-down wide view, cinematic crisp futuristic key art, energetic yet readable, no Pac-Man mouth, no text, no UI, no logos. Keep the runner and main chase group inside the central 70% for landscape thumbnail cropping.
```
