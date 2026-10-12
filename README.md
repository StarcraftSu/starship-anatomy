# Starship V3, taken apart

> Inspired by and built with **[wheresryan22/anatomy](https://github.com/wheresryan22/anatomy)**, a Claude Code skill that explains an idea by building it as a working isometric object. The drawing kit in `source/kit/` comes from that repository (MIT).

An interactive isometric figure of the SpaceX Starship V3 full stack. Point at it and it comes apart into the six sections it is stacked from, then all 39 Raptor engines slide out of their skirts. Cutaway windows show how the tanks are arranged inside and what rides in the payload bay (Starlink satellites or a crew cabin), a side panel shows each section close up with its numbers, and the drawing zooms so you can look at any part.

English and 中文: the page follows your browser's language; switch with the button at the top right of the page, or add `?lang=zh` or `?lang=en` to the link.

![Starship V3 assembled on its stacking jig, with the overview panel](preview-assembled.png)

![Taken apart, with the ship section open in the side panel](preview-apart.png)

![Zoomed in on the 33 booster engines after they slide out of the skirt](preview-engines.png)

![The payload bay set up for Starlink: the satellite stack on the PEZ dispenser, one satellite sliding out of the slot door](preview-payload.png)

A second figure below it takes one Raptor 3 apart and walks through how its propellants flow:

![Raptor 3 taken apart on its stand, step 3 of the flow: the two preburners](preview-raptor.png)

## View it

**Live: https://starcraftsu.github.io/starship-anatomy/** — follows your system's light or dark setting. Or go straight to the [light](https://starcraftsu.github.io/starship-anatomy/starship-light.html) or [dark](https://starcraftsu.github.io/starship-anatomy/starship.html) page.

To view it offline, download `starship-light.html` or `starship.html` and open it in a browser. Each page is a single self-contained file that makes no network requests.

| To | Mouse | Touch | Keyboard (figure focused) |
|---|---|---|---|
| Pick a section | point at it, or use the list in the panel | tap it | arrow keys, Home, End |
| Take it apart / put it together | moves apart while you point at it; **Take apart** keeps it apart | tap empty space | Space |
| Zoom | scroll wheel, double-click, **+** / **−** | pinch | + and − |
| Pan | drag | drag with one finger | — |
| Frame the picked section | **Zoom the drawing here** in the panel | same | — |
| Reset | **Reset** | **Reset** | 0, or Escape for everything |
| Change the payload | pick 06, then **Starlink** or **Crew** in the panel | same | — |
| Change language | **中文** / **English** at the top right of the page | same | — |

Left alone, it runs a slow tour through the sections, and the panel follows. Under reduced motion it stays still.

## Fig 2: inside one Raptor 3

Assembled, the engine looks the way Raptor 3 really does: almost no pipes, because SpaceX moved Raptor 2's plumbing and sensors into the engine's main structure. Point at it and it comes apart on its stand. The oxygen turbopump and its preburner move left, the methane pair moves right, and coloured paths show the routes the housings hide. Five steps walk through the full-flow staged combustion cycle:

| Step | What lights up |
|---|---|
| 1 Two pumps | liquid oxygen and methane from the standpipes into the two turbopumps |
| 2 Methane cools the engine | methane down to the nozzle manifold and up through the wall channels |
| 3 Two preburners | all the oxygen (plus a little methane) to one preburner, all the methane (plus a little oxygen) to the other |
| 4 Turbines, then the injector | oxygen-rich gas spins the oxygen pump, methane-rich gas the methane pump; both gases go on to the injector |
| 5 Main chamber | gas meets gas at 330 bar and leaves through the nozzle |

Pick a step in the panel, use the arrow keys, or press **Play the flow**. Left alone it runs the steps as a tour. The paths are a diagram of the cycle, not the engine's real internal passages, and the parts are simplified.

## What Fig 1 shows

The stack lies on a long stacking jig: a base plate with two rails, a metre ruler (zero at the booster's engine plane) and cradles that slide along the rails.

Colour marks what things are: blue for liquid-oxygen spaces, amber for methane (so the methane tube running through the blue oxygen tank stands out), black for the heat-shield tiles, bronze for the regeneratively cooled Raptor nozzles and pale grey for the Raptor Vacuum nozzle extensions.

| # | Section | What to look for |
|---|---|---|
| 01 | 33 Raptors and aft skirt | 3 + 10 + 20 engine rings; apart, the engines slide out and leave the thrust puck and their mounts |
| 02 | Booster oxygen tank | Cutaway with the methane transfer tube running through it; aft dome with V3's metallic tiles |
| 03 | Booster methane tank, grid fins, interstage | Cutaway, common dome, three V3 grid fins, vented interstage kept on the booster |
| 04 | Ship oxygen tank and six Raptors | 3 sea-level + 3 vacuum engines that slide out into the staging gap, aft flaps, cutaway with four downcomers |
| 05 | Ship methane tank | Cutaway, common dome with downcomer inlets |
| 06 | Payload bay and nose | Cutaway of the bay and the header tanks. **Starlink**: 26 satellites stacked on the PEZ dispenser; the bottom one slides out through the slot door when you pick the section. **Crew**: three levels (quarters, a cabin with windows, two airlocks) with two people for scale. Forward flaps on both |

For sections 01 and 04 the panel links down to Fig 2, which takes one Raptor 3 apart. The engines in Fig 1 are simplified: nozzle, chamber, powerhead, two turbopumps and gimbal block.

The ship lies belly up so the heat-shield tiles and flaps face the viewer.

## Numbers and sources

| Quantity | Value | Source |
|---|---|---|
| Stack / booster / ship height | 124.4 m / 72.3 m / 52.1 m | [Super Heavy](https://en.wikipedia.org/wiki/SpaceX_Super_Heavy) and [Starship](https://en.wikipedia.org/wiki/SpaceX_Starship) on Wikipedia; ship height is the difference |
| Diameter, ring height | 9 m, 1.83 m | [Starship, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Starship) |
| Raptor 3 thrust | 250 tf sea level, 275 tf vacuum | SpaceX's May 2026 figures as given on [Raptor, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Raptor) |
| Booster propellant | 3,650 t | [Super Heavy, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Super_Heavy) |
| Ship propellant | about 1,600 t | [Starship, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Starship) (no official V3 figure found) |
| LOX / methane split | 3.6 : 1 by mass | Raptor's mixture ratio, applied to the totals above |
| Raptor 3 mass | 1,525 kg | [Raptor, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Raptor) |
| Raptor 3 chamber pressure, specific impulse | 330 bar (350 bar reached in testing); 350 s sea level, 380 s vacuum version | [Raptor, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Raptor) |
| Heat shield | about 18,000 tiles, rated to 1,400 °C | [Starship spacecraft, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Starship_(spacecraft)) |
| Grid fins, interstage | 3 fins about 1.5× earlier ones; interstage built into the methane tank and kept | [Super Heavy, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Super_Heavy) |
| PEZ dispenser | mounted on the forward dome; satellites pushed out one at a time from the base, the stack lowered for the next | [Starship spacecraft, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Starship_(spacecraft)) |
| Starlink V3 | 26 deployed on Flight 14 (September 2026); about 2 t each; up to 60 per flight planned | [TelecomTV](https://www.telecomtv.com/content/next-gen-telco-infra/spacex-deploys-v3-starlink-satellites-as-starship-reaches-orbit-56354/), [Tesla Oracle](https://www.teslaoracle.com/?p=66693) |
| Crew layout | lunar lander (HLS): two airlocks, an elevator, crew area at the top; up to 100 crew planned for Starship | [Starship spacecraft, Wikipedia](https://en.wikipedia.org/wiki/SpaceX_Starship_(spacecraft)) and SpaceX's HLS renders |

Caveats:

- Sources disagree on some V3 numbers. An April 2026 review gives about 3,400 t of booster propellant and 280 t per Raptor 3; this figure uses the later May 2026 values.
- The header tanks are drawn in the nose, where they have been since Ship 24; their V3 placement is not confirmed.
- The PEZ slot and the satellites are drawn from press descriptions (folded V3 satellites about 7 × 3.5 m); their exact sizes and the rack's layout are not published.
- No crewed Starship has flown. The crew cabin is illustrative, after SpaceX's lunar-lander renders; the real lander also has no flaps or heat shield and has landing legs.
- Proportions inside the tanks (dome depths, tube diameters, engine spacing) and the engine shapes are approximate. Chines are left off because it is unclear whether V3 boosters keep them.

## Rebuild

Needs Node.js 20.10 or later and nothing else (no `npm install`).

```sh
node source/build.mjs --light   # writes starship-light.html
node source/build.mjs           # writes starship.html
```

- `source/build.mjs` holds the model for Fig 1 (every number above), all its geometry, and every word on the page in English and Chinese.
- `source/live.js` is Fig 1's interaction: springs, the tour, zoom and pan, the side panel, the payload switch, pointer, touch and keyboard, and the language switch shared by both figures.
- `source/raptor.mjs` and `source/raptor-live.js` are Fig 2: the engine, its flow paths and text, and its steps, play mode and tour.
- `source/starship.css` holds the page styles and the colour tokens for every material, light and dark.
- `source/kit/` is a copy of the drawing kit the build uses.

## Credits

Made with Claude Code using the [anatomy](https://github.com/wheresryan22/anatomy) skill. `source/kit/iso-kit.mjs` and `source/kit/lathe.mjs` are copied unchanged from that project and are under its MIT license (`source/kit/LICENSE`).

Not affiliated with SpaceX.
