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
DO NOT double‑click `index.html` (file://) — many browsers block geolocation, SRI, and fetches there. Serve it over HTTP.

Quick options (PowerShell):
```
python -m http.server 8080
# or if you have Node.js
npx serve .
```
Then open: http://localhost:8080/

If you prefer a minimal embedded server, create `server.js`:
```js
import http from 'node:http'; import { readFileSync } from 'node:fs'; import { extname } from 'node:path';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
http.createServer((req,res)=>{ let p=req.url==='/'?'/index.html':req.url; try { const data=readFileSync('.'+p); res.writeHead(200,{ 'Content-Type': types[extname(p)]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(data);} catch(e){ res.writeHead(404); res.end('404'); }}).listen(8080,()=>console.log('Dev server http://localhost:8080')); 
```
Run with:
```
node server.js
```

Chrome location simulation: DevTools > More Tools > Sensors.

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
