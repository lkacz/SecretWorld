# Secret World (Prototype)

A minimal browser-based location + time seeded procedural world overlay (inspired by AR games like Pokemon Go) that works in a normal browser (desktop or mobile) without native apps.

## Core Concepts

- Uses `navigator.geolocation.watchPosition` for continuous player location.
- Derives a deterministic seed from (lat, lon, time bucket) using a fast hash.
- Procedurally generates Points of Interest (POIs) (towers, strongholds, castles, portals, lairs) and nearby mobs.
- Regenerates the world every 15-minute time bucket or when the player changes location sufficiently.
- Projects lat/lon to a simple local flat coordinate system for quick 2D rendering on a canvas.

## File Layout

- `index.html` – Basic UI shell & canvas.
- `src/styles.css` – UI styling.
- `src/rng.js` – Deterministic seed + PRNG utilities.
- `src/worldgen.js` – Procedural entity generation & projection helpers.
- `src/main.js` – App glue: geolocation, rendering, periodic updates.

## Running
Just open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge). On first load you'll be asked for geolocation permission.
If testing on desktop without movement, you can use DevTools > Sensors (Chrome) to spoof location.

## Extensibility Roadmap

Future improvements (suggested hooks already present):
1. Movement-based regeneration thresholds (currently only time bucket + initial). Add distance delta check.
2. Persistence layer: store discovered POIs locally (IndexedDB) so they remain visible after regeneration.
3. Combat / interaction: click or tap on an entity to open an interaction panel.
4. Server authority: send seed & discovered interactions to a backend for anti-cheat & shared world state.
5. Multi-scale world: hierarchical region seeds (e.g., 1km cells) for stable placement irrespective of time.
6. Visual polish: animate entities, add minimap, daylight cycle tinting.
7. AR overlay: integrate WebXR / device orientation for pointing towards entities.
8. Accessibility: textual list of nearby entities and distances.
9. Security: throttle geolocation errors, handle denied permission gracefully.
10. Energy / progression systems.

## License
Prototype code – you may adapt freely.
