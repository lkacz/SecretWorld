import { geoTimeSeed, regionSeed } from './rng.js';
import { generateStablePOIs, generateEphemeralMobs, projectToLocal, computeDistance } from './worldgen.js';

const canvas = document.getElementById('world');
const mapDiv = document.getElementById('map');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const latEl = document.getElementById('lat');
const lonEl = document.getElementById('lon');
const accEl = document.getElementById('accuracy');
const seedEl = document.getElementById('seed');
const regenReasonEl = document.getElementById('regen-reason');
// Debug elements
const dbgGeoSupport = document.getElementById('dbg-geo-support');
const dbgPerm = document.getElementById('dbg-perm');
const dbgError = document.getElementById('dbg-error');
const dbgLastUpdate = document.getElementById('dbg-last-update');
const dbgUpdateCount = document.getElementById('dbg-update-count');
const dbgApprox = document.getElementById('dbg-approx');
const dbgWatchId = document.getElementById('dbg-watch-id');
const toggleDebugBtn = document.getElementById('toggle-debug');
const debugPanel = document.getElementById('debug');
const ipFallbackBtn = document.getElementById('ip-fallback');
const nearbyListEl = document.getElementById('nearby-list');
const interactionPanel = document.getElementById('interaction');
const interactTitle = document.getElementById('interact-title');
const interactDetails = document.getElementById('interact-details');
const closeInteractionBtn = document.getElementById('close-interaction');

let lastPos = null;
let lastGenPos = null;
let stablePOIs = [];
let mobs = [];
let entities = [];
let map, playerMarker;
let entityLayerGroup; // Leaflet layer group for entities
let seed = 0; // time-based seed (for mobs)
let regionStableSeed = 0; // region seed for POIs
let selectedEntityId = null;
let updateCount = 0;
let usedApprox = false;
let watchId = null;

function log(msg) {
  const line = document.createElement('div');
  line.textContent = msg;
  logEl.prepend(line);
  while (logEl.children.length > 120) logEl.removeChild(logEl.lastChild);
}

function requestLocation() {
  dbgGeoSupport && (dbgGeoSupport.textContent = ('geolocation' in navigator) ? 'yes' : 'no');
  if (!('geolocation' in navigator)) {
    statusEl.textContent = 'Geolocation not supported';
    statusEl.className = 'bad';
    if (ipFallbackBtn) ipFallbackBtn.hidden = false;
    return;
  }
  statusEl.textContent = 'Requesting location...';
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(p => {
      if (dbgPerm) dbgPerm.textContent = p.state;
      p.onchange = () => { if (dbgPerm) dbgPerm.textContent = p.state; if (p.state === 'denied' && ipFallbackBtn) ipFallbackBtn.hidden = false; };
      if (p.state === 'denied' && ipFallbackBtn) ipFallbackBtn.hidden = false;
    }).catch(()=>{});
  } else if (dbgPerm) { dbgPerm.textContent = 'unknown'; }
  try {
    watchId = navigator.geolocation.watchPosition(onLocation, onLocationError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    });
    if (dbgWatchId) dbgWatchId.textContent = watchId;
  } catch(e) {
    if (dbgError) dbgError.textContent = e.message;
    if (ipFallbackBtn) ipFallbackBtn.hidden = false;
  }
  initMap();
}

function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true, worldCopyJump: true });
  // Temp center until we get real location
  map.setView([0,0], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  entityLayerGroup = L.layerGroup().addTo(map);
}

function onLocationError(err) {
  statusEl.textContent = 'Location error: ' + err.message;
  statusEl.className = 'bad';
  if (dbgError) dbgError.textContent = err.message + ' code=' + err.code;
  log('Geo error: ' + err.message + ' code=' + err.code);
  if (err.code === 1 && ipFallbackBtn) { // permission denied
    ipFallbackBtn.hidden = false;
  }
}

function onLocation(pos) {
  lastPos = pos;
  const { latitude, longitude, accuracy } = pos.coords;
  latEl.textContent = latitude.toFixed(5);
  lonEl.textContent = longitude.toFixed(5);
  accEl.textContent = accuracy.toFixed(1);
  statusEl.textContent = 'Tracking';
  statusEl.className = 'good';
  updateWorld();
  updateMapPlayer(latitude, longitude);
  updateCount++;
  if (dbgUpdateCount) dbgUpdateCount.textContent = updateCount;
  if (dbgLastUpdate) dbgLastUpdate.textContent = new Date().toLocaleTimeString();
}

function updateMapPlayer(lat, lon) {
  if (!map) return;
  if (!playerMarker) {
    playerMarker = L.marker([lat, lon], { title: 'You' }).addTo(map);
    map.setView([lat, lon], 16);
  } else {
    playerMarker.setLatLng([lat, lon]);
  }
}

function shouldRegenerate(newTimeSeed, latitude, longitude, newRegionSeed) {
  if (!lastGenPos) return { regenMobs: true, regenPOI: true, reason: 'initial' };
  const reasons = [];
  let regenMobs = false, regenPOI = false;
  if (newTimeSeed !== seed) { regenMobs = true; reasons.push('time-bucket'); }
  if (newRegionSeed !== regionStableSeed) { regenPOI = true; reasons.push('region-shift'); }
  const moved = computeDistance(lastGenPos.lat, lastGenPos.lon, latitude, longitude);
  if (moved > 120) { regenMobs = true; reasons.push('moved-'+Math.round(moved)+'m'); }
  if (!regenMobs && !regenPOI) return { regenMobs:false, regenPOI:false };
  return { regenMobs, regenPOI, reason: reasons.join('+') };
}

function updateWorld() {
  if (!lastPos) return;
  const { latitude, longitude } = lastPos.coords;
  const newTimeSeed = geoTimeSeed(latitude, longitude, 15);
  const newRegionSeed = regionSeed(latitude, longitude, 0.01);
  const regenCheck = shouldRegenerate(newTimeSeed, latitude, longitude, newRegionSeed);
  if (regenCheck.regenMobs || regenCheck.regenPOI || entities.length === 0) {
    if (regenCheck.regenPOI || stablePOIs.length === 0) {
      regionStableSeed = newRegionSeed;
      stablePOIs = generateStablePOIs(regionStableSeed, latitude, longitude);
    }
    if (regenCheck.regenMobs || mobs.length === 0) {
      seed = newTimeSeed;
      mobs = generateEphemeralMobs(seed, latitude, longitude);
    }
    seedEl.textContent = seed.toString(16);
    lastGenPos = { lat: latitude, lon: longitude };
  entities = [...stablePOIs, ...mobs];
    regenReasonEl.textContent = regenCheck.reason || '-';
    log(`Generated P:${stablePOIs.length} M:${mobs.length} timeSeed ${seed.toString(16)} regionSeed ${regionStableSeed.toString(16)} (${regenCheck.reason||'no-reason'})`);
    persistState();
    rebuildNearbyList();
  refreshMapEntities();
  }
  draw();
}

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  draw();
}
window.addEventListener('resize', resize);

function draw() {
  if (!lastPos) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillText('Awaiting location permission...', 20, 40);
    return;
  }
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(w/2, h/2);

  // Player origin
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.arc(0,0,8,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui';
  ctx.fillText('You', 10, -10);

  // Draw entities
  for (const e of entities) {
    const p = projectToLocal(e.lat, e.lon, lastPos.coords.latitude, lastPos.coords.longitude);
    const dist = Math.hypot(p.x, p.y);
    if (e.type === 'mob') {
      const hpFrac = e.hp / e.maxHp;
      ctx.fillStyle = e.id === selectedEntityId ? '#fff' : (hpFrac > 0.66 ? '#5f5' : hpFrac > 0.33 ? '#fc5' : '#f55');
      ctx.beginPath(); ctx.arc(p.x/2, -p.y/2, 4 + e.tier*2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x/2, -p.y/2, 5 + e.tier*2, 0, Math.PI*2*hpFrac); ctx.stroke();
    } else {
      ctx.strokeStyle = e.id === selectedEntityId ? '#5ab0ff' : '#ccc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const size = 14 + (e.type.length*0.7);
      ctx.rect(p.x/2 - size/2, -p.y/2 - size/2, size, size);
      ctx.stroke();
      ctx.fillStyle = '#eee';
      ctx.font = '11px system-ui';
      ctx.fillText(e.type + (e.stable?'':'*'), p.x/2 - size/2, -p.y/2 - size/2 - 4);
    }

    // Distance label for close objects
    if (dist < 600) {
      ctx.fillStyle = '#89c';
      ctx.font = '10px system-ui';
      ctx.fillText(Math.round(dist) + 'm', p.x/2 + 6, -p.y/2 + 4);
    }
  }
}

function refreshMapEntities() {
  if (!entityLayerGroup || !lastPos) return;
  entityLayerGroup.clearLayers();
  for (const e of entities) {
    const color = e.type === 'mob' ? (e.tier===1?'#55ff55': e.tier===2?'#ffcc55':'#ff5555') : '#66aaff';
    const html = `<div style="transform:translate(-50%,-50%);background:${e.type==='mob'?'#111b28':'#0d2238'};color:${color};border:1px solid ${color};padding:2px 4px;border-radius:4px;font-size:11px;white-space:nowrap;">${e.type}${e.tier?(' T'+e.tier):''}</div>`;
    const icon = L.divIcon({ html, className:'', iconSize:[0,0] });
    const marker = L.marker([e.lat, e.lon], { icon });
    marker.on('click', ()=> selectEntity(e.id));
    entityLayerGroup.addLayer(marker);
  }
}

function rebuildNearbyList() {
  if (!lastPos) return;
  nearbyListEl.innerHTML = '';
  const { latitude, longitude } = lastPos.coords;
  const annotated = entities.map(e => ({
    e,
    d: computeDistance(latitude, longitude, e.lat, e.lon)
  })).sort((a,b)=>a.d-b.d).slice(0,20);
  for (const { e, d } of annotated) {
    const li = document.createElement('li');
    li.textContent = `${e.type}${e.tier?` T${e.tier}`:''} · ${Math.round(d)}m`;
    li.dataset.id = e.id;
    if (e.id === selectedEntityId) li.classList.add('active');
    li.addEventListener('click', ()=> selectEntity(e.id));
    nearbyListEl.appendChild(li);
  }
}

function selectEntity(id) {
  selectedEntityId = id;
  const ent = entities.find(x=>x.id===id);
  if (!ent) return;
  interactionPanel.hidden = false;
  interactTitle.textContent = ent.type.toUpperCase();
  interactDetails.innerHTML = `ID: ${ent.id}<br>`+
    `Lat: ${ent.lat.toFixed(5)} Lon: ${ent.lon.toFixed(5)}<br>`+
    (ent.tier?`Tier: ${ent.tier} HP: ${ent.hp}/${ent.maxHp}<br>`:'')+
    `Stable: ${ent.stable?'yes':'no'}<br>`+
    `Time Seed: ${seed.toString(16)}<br>`+
    `<button id="engage-btn" ${ent.type!=='mob'?'disabled':''}>Engage</button>`;
  const engage = document.getElementById('engage-btn');
  if (engage && ent.type==='mob') engage.addEventListener('click', ()=> engageCombat(ent.id));
  rebuildNearbyList();
  draw();
}

closeInteractionBtn.addEventListener('click', ()=>{
  interactionPanel.hidden = true;
  selectedEntityId = null;
  rebuildNearbyList();
  draw();
});

canvas.addEventListener('click', evt => {
  if (!lastPos) return;
  const rect = canvas.getBoundingClientRect();
  const cx = (evt.clientX - rect.left) * (canvas.width / rect.width);
  const cy = (evt.clientY - rect.top) * (canvas.height / rect.height);
  const w = canvas.clientWidth * devicePixelRatio;
  const h = canvas.clientHeight * devicePixelRatio;
  const localX = (cx - w/2) / devicePixelRatio;
  const localY = (cy - h/2) / devicePixelRatio;
  let nearest = null;
  let nearestDist = 32; // pixel threshold
  for (const e of entities) {
    const p = projectToLocal(e.lat, e.lon, lastPos.coords.latitude, lastPos.coords.longitude);
    const ex = p.x/2;
    const ey = -p.y/2;
    const d = Math.hypot(ex - localX, ey - localY);
    if (d < nearestDist) { nearest = e; nearestDist = d; }
  }
  if (nearest) selectEntity(nearest.id);
});

setInterval(()=>{ updateWorld(); rebuildNearbyList(); }, 10000);
setInterval(()=>{ if(lastPos && dbgLastUpdate) dbgLastUpdate.textContent = new Date().toLocaleTimeString(); }, 60000);

toggleDebugBtn?.addEventListener('click', ()=> {
  const showing = !debugPanel.hidden;
  debugPanel.hidden = showing;
  toggleDebugBtn.textContent = showing ? 'Show Debug' : 'Hide Debug';
});

ipFallbackBtn?.addEventListener('click', ()=> {
  fetchApproxIPLocation();
});

async function fetchApproxIPLocation() {
  try {
    statusEl.textContent = 'Fetching approximate IP location...';
    const resp = await fetch('https://ipapi.co/json/');
    if (!resp.ok) throw new Error('ip lookup failed');
    const data = await resp.json();
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      usedApprox = true;
      if (dbgApprox) dbgApprox.textContent = 'yes';
      const fauxPos = { coords: { latitude: data.latitude, longitude: data.longitude, accuracy: 50000 }, timestamp: Date.now() };
      onLocation(fauxPos);
      statusEl.textContent = 'Approx IP location used';
      statusEl.className = 'warn';
    } else {
      throw new Error('No coords');
    }
  } catch(e) {
    log('IP fallback failed: ' + e.message);
    statusEl.textContent = 'IP fallback failed';
    statusEl.className = 'bad';
  }
}

function engageCombat(id) {
  const ent = mobs.find(m=>m.id===id);
  if (!ent) return;
  const dmg = 5 + ((Date.now() % 5000)/1000 | 0); // 5-9
  ent.hp = Math.max(0, ent.hp - dmg);
  log(`Engaged ${ent.id} for ${dmg} dmg (HP ${ent.hp}/${ent.maxHp})`);
  if (ent.hp === 0) {
    log(`${ent.id} defeated.`);
    mobs = mobs.filter(m=>m.id!==id);
    entities = [...stablePOIs, ...mobs];
    selectedEntityId = null;
    interactionPanel.hidden = true;
  } else if (selectedEntityId === id) {
    selectEntity(id);
  }
  persistState();
  rebuildNearbyList();
  draw();
  refreshMapEntities();
}

// Persistence
const STORAGE_KEY = 'secretworld_v1_state';
function persistState() {
  const payload = {
    timeSeed: seed,
    regionSeed: regionStableSeed,
    mobs: mobs.map(m=>({ id:m.id, tier:m.tier, hp:m.hp, maxHp:m.maxHp, lat:m.lat, lon:m.lon })),
    stablePOIs: stablePOIs.map(p=>({ id:p.id, type:p.type, lat:p.lat, lon:p.lon }))
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch(e) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    seed = data.timeSeed || seed;
    regionStableSeed = data.regionSeed || regionStableSeed;
    stablePOIs = (data.stablePOIs||[]).map(p=>({ ...p, stable:true }));
    mobs = (data.mobs||[]).map(m=>({ ...m, type:'mob', stable:false }));
    entities = [...stablePOIs, ...mobs];
    log('Loaded persisted state.');
  } catch(e) {}
}
loadState();

resize();
requestLocation();
