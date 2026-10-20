# Full-viewport 3D arcade

All ten games in this pass render real 3D meshes: Makitas vs Zombies, Makita Slingers, Pinballerz, Speed Stack, Temple Race, Subway Runnerz, Team Counters, Monster Strider, Roomba Run and Naja Run.

The right pane is the game viewport. Scores, objectives, notices and optional challenge navigation float over it. Desktop uses keyboard, pointer and drag input; touch devices get two thumb clusters: steering at the bottom left (a D-pad when a game uses all four directions) and the main action as a large corner button at the bottom right, with secondary actions beside it (`premium-kit/touchPads.ts`). The workshop keeps its tactical tool dock inside the world. Scanlines are removed from these 3D scenes.

## World and character mods

These settings are available immediately in every upgraded game, in Python, Swift and C#:

```python
worldTheme = "alpine"
characterStyle = "astronaut"
weather = "snow"
```

| Setting | Choices | Visible changes |
| --- | --- | --- |
| `worldTheme` | `classic`, `alpine`, `volcanic`, `neon` | Sky, fog, sunlight, terrain and scenery materials, mountain and city geometry; room architecture and lighting in Roomba Run |
| `characterStyle` | `original`, `robot`, `astronaut`, `armored` | New character meshes, helmets, visors, equipment, vehicle bodies, vacuum shells, snake segments; themed pinball bumpers and tower architecture |
| `weather` | `clear`, `snow`, `rain`, `embers` | Bounded particles around the action; respects reduced motion |

Changes apply live without restarting the simulation or replacing saved progress. Existing scripts that omit these settings keep the classic world and original actors. Rules can switch them during play:

```python
worldTheme = "classic"
characterStyle = "original"
weather = "clear"

if score >= 100:
    worldTheme = "volcanic"
    characterStyle = "robot"
    weather = "embers"
```

The existing gameplay mods still drive the actual simulation: jump trajectories, flipper impulses, saw damage and ballistic arcs, crowd arithmetic, truck acceleration and suspension, snake portals, stacking overlap and vacuum coverage. The 3D views read that simulation rather than running a second physics system.

## Unity model studio

The project at `unity/ModboxStudio` was created and executed using the installed Unity 6000.6.6f1 Editor. It contains an editable `Assets/Scenes/ModelGallery.unity` scene and a reproducible mesh exporter at `Assets/Editor/ModboxArt.cs`. Open that project in Unity Hub, open the gallery scene, then choose **MODBOX → Build web model pack** to regenerate the five original models.

The exported vacuum, truck body, cobra, scrap robot, saw turret and rigged footballer are in `public/models/unity`. The footballer is exported by `ModboxArt.ExportParts` as six pivoted glTF nodes (body, head, arms, legs) so Pinballerz can animate runs, kicks, keeper dives and celebrations; its kit uses pure marker colors that the web repaints per team, skin tone and character style. They are loaded by the live Roomba, Monster Strider, Naja, Slingers and workshop scenes. Procedural meshes cover loading and offline errors. The exporter writes glTF 2.0 binary meshes with normals, indices and vertex colors; no paid assets or exporter packages are needed.

To rebuild from PowerShell:

```powershell
& 'C:\Program Files\Unity\Hub\Editor\6000.6.6f1\Editor\Unity.exe' -batchmode -nographics -projectPath "$PWD\unity\ModboxStudio" -executeMethod ModboxArt.Build -quit -logFile "$PWD\artifacts\unity-export.log"
```

Unity is used for model authoring and export. The published game runtime remains WebGL through Three.js, so the language editor, saves and live code changes stay integrated in the same page.

## Design references

The screenshots supplied with the request guide the close cleaning camera, full-height crowd runway, saturated angular islands and suspended truck bridges. Additional references reviewed for composition and gameplay:

- [Count Masters, Freeplay](https://freeplay.io/games/count-masters/): readable arithmetic gates and crowd silhouettes.
- [Monster Tracks, Fancade on Poki](https://poki.com/en/g/monster-tracks): isometric framing, speed and balance across ramps and bridges.
- [Temple Run, Imangi](https://imangistudios.com/thegames/temple-run/): immediate jump/slide/turn readability and environmental depth.
- [Stack, Ketchapp](https://www.ketchappgames.com/game-stack): clean slab edges, isometric depth and a legible silhouette.
- [Unity Web development documentation](https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-gettingstarted.html): authoring and browser build context.

Reference assets are not copied into MODBOX. The models and scene geometry in this change are original.

## Verification

`three-kit/remix.test.ts` exercises live remixes across all languages, progress preservation, invalid theme handling and actual glTF loading of every Unity export. Existing engine tests continue to cover collisions, arithmetic, stage boundaries, flippers, cleaning, portals and stacking. Browser captures and viewport measurements are stored locally in `artifacts/upgrade-*`.
