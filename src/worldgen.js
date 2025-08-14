import { mulberry32 } from './rng.js';

// Basic procedural generation logic using a seed
export function generateEntities(seed, centerLat, centerLon) {
  const rand = mulberry32(seed);
  const entities = [];
  // Generate a deterministic set of POIs around player within a radius (meters)
  const poiCount = 12; // adjustable density
  const radiusMeters = 1200; // 1.2km ring
  for (let i = 0; i < poiCount; i++) {
    const r = Math.sqrt(rand()) * radiusMeters; // bias outward evenly
    const theta = rand() * Math.PI * 2;
    const offsetLat = (r * Math.cos(theta)) / 111320; // meters to degrees
    const offsetLon = (r * Math.sin(theta)) / (111320 * Math.cos(centerLat * Math.PI / 180));
    const lat = centerLat + offsetLat;
    const lon = centerLon + offsetLon;
    const kindRoll = rand();
    let type;
    if (kindRoll < 0.25) type = 'tower';
    else if (kindRoll < 0.45) type = 'stronghold';
    else if (kindRoll < 0.70) type = 'castle';
    else if (kindRoll < 0.85) type = 'portal';
    else type = 'lair';

    entities.push({ id:`poi-${i}`, type, lat, lon });
  }

  // Generate some mobs closer to the player
  const mobCount = 24;
  const mobRadius = 400; // meters
  for (let m=0; m<mobCount; m++) {
    const r = Math.sqrt(rand()) * mobRadius;
    const angle = rand()*Math.PI*2;
    const offsetLat = (r * Math.cos(angle)) / 111320;
    const offsetLon = (r * Math.sin(angle)) / (111320 * Math.cos(centerLat * Math.PI / 180));
    const lat = centerLat + offsetLat;
    const lon = centerLon + offsetLon;
    const tierRoll = rand();
    let tier = tierRoll < 0.6 ? 1 : tierRoll < 0.85 ? 2 : 3;
    entities.push({ id:`mob-${m}`, type:'mob', tier, lat, lon });
  }

  return entities;
}

// Convert lat/lon to local flat coordinates relative to origin (player) using equirectangular approximation.
export function projectToLocal(lat, lon, originLat, originLon) {
  const x = (lon - originLon) * 111320 * Math.cos(originLat * Math.PI/180);
  const y = (lat - originLat) * 111320;
  return { x, y };
}
