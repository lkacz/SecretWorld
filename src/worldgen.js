import { mulberry32 } from './rng.js';

// Stable POIs derived from a region seed (do not change with time buckets)
export function generateStablePOIs(regionSeedValue, centerLat, centerLon) {
  const rand = mulberry32(regionSeedValue);
  const list = [];
  const poiCount = 10; // fewer, more meaningful
  const radiusMeters = 1500;
  for (let i=0; i<poiCount; i++) {
    const r = Math.sqrt(rand()) * radiusMeters;
    const theta = rand() * Math.PI * 2;
    const offsetLat = (r * Math.cos(theta)) / 111320;
    const offsetLon = (r * Math.sin(theta)) / (111320 * Math.cos(centerLat * Math.PI / 180));
    const lat = centerLat + offsetLat;
    const lon = centerLon + offsetLon;
    const kindRoll = rand();
    let type;
    if (kindRoll < 0.20) type = 'tower';
    else if (kindRoll < 0.38) type = 'stronghold';
    else if (kindRoll < 0.60) type = 'castle';
    else if (kindRoll < 0.78) type = 'portal';
    else type = 'lair';
    list.push({ id:`poi-${i}`, type, lat, lon, stable:true });
  }
  return list;
}

// Ephemeral mobs that rotate with time-based seed
export function generateEphemeralMobs(timeSeed, centerLat, centerLon) {
  const rand = mulberry32(timeSeed);
  const list = [];
  const mobCount = 28;
  const mobRadius = 500;
  for (let m=0; m<mobCount; m++) {
    const r = Math.sqrt(rand()) * mobRadius;
    const angle = rand()*Math.PI*2;
    const offsetLat = (r * Math.cos(angle)) / 111320;
    const offsetLon = (r * Math.sin(angle)) / (111320 * Math.cos(centerLat * Math.PI / 180));
    const lat = centerLat + offsetLat;
    const lon = centerLon + offsetLon;
    const tierRoll = rand();
    const tier = tierRoll < 0.6 ? 1 : tierRoll < 0.85 ? 2 : 3;
    const hp = tier * 25 + Math.floor(rand()*15);
    list.push({ id:`mob-${m}`, type:'mob', tier, hp, maxHp: hp, lat, lon, stable:false });
  }
  return list;
}

// Convert lat/lon to local flat coordinates relative to origin (player) using equirectangular approximation.
export function projectToLocal(lat, lon, originLat, originLon) {
  const x = (lon - originLon) * 111320 * Math.cos(originLat * Math.PI/180);
  const y = (lat - originLat) * 111320;
  return { x, y };
}

export function computeDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
