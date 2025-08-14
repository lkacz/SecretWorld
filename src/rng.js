// Simple deterministic PRNG (Mulberry32) based on a 32-bit seed
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Hash lat/lon/time slice into a 32-bit seed
export function geoTimeSeed(lat, lon, timeBucketMinutes = 15) {
  const bucket = Math.floor(Date.now() / 60000 / timeBucketMinutes);
  // Scale & round coordinates to ~1e-5 precision (~1 meter)
  const la = Math.round((lat + 90) * 1e5);
  const lo = Math.round((lon + 180) * 1e5);
  let h = 2166136261 >>> 0;
  function mix(v){
    h ^= v; h = Math.imul(h, 16777619);
  }
  mix(la); mix(lo); mix(bucket);
  return h >>> 0;
}

// Stable region seed (independent of time). Quantize coordinates to a grid cell size (degrees).
// cellSizeDeg default 0.01 ~= 1.1km latitude.
export function regionSeed(lat, lon, cellSizeDeg = 0.01) {
  const cellLat = Math.floor((lat + 90) / cellSizeDeg);
  const cellLon = Math.floor((lon + 180) / cellSizeDeg);
  let h = 2166136261 >>> 0;
  function mix(v){ h ^= v; h = Math.imul(h, 16777619); }
  mix(cellLat); mix(cellLon);
  return h >>> 0;
}

// Utility to hash multiple numbers into a deterministic 32-bit id string (hex)
export function hashId(...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) { h ^= (n|0); h = Math.imul(h,16777619); }
  return (h>>>0).toString(16);
}
