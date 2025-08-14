import { geoTimeSeed } from './rng.js';
import { generateEntities, projectToLocal, computeDistance } from './worldgen.js';

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const latEl = document.getElementById('lat');
const lonEl = document.getElementById('lon');
const accEl = document.getElementById('accuracy');
const seedEl = document.getElementById('seed');
const regenReasonEl = document.getElementById('regen-reason');
const nearbyListEl = document.getElementById('nearby-list');
const interactionPanel = document.getElementById('interaction');
const interactTitle = document.getElementById('interact-title');
const interactDetails = document.getElementById('interact-details');
const closeInteractionBtn = document.getElementById('close-interaction');

let lastPos = null;
let lastGenPos = null;
let entities = [];
let seed = 0;
let selectedEntityId = null;

function log(msg) {
  const line = document.createElement('div');
  line.textContent = msg;
  logEl.prepend(line);
  while (logEl.children.length > 120) logEl.removeChild(logEl.lastChild);
}

function requestLocation() {
  if (!('geolocation' in navigator)) {
    statusEl.textContent = 'Geolocation not supported';
    statusEl.className = 'bad';
    return;
  }
  statusEl.textContent = 'Requesting location...';
  navigator.geolocation.watchPosition(onLocation, onLocationError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000
  });
}

function onLocationError(err) {
  statusEl.textContent = 'Location error: ' + err.message;
  statusEl.className = 'bad';
  log('Geo error: ' + err.message);
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
}

function shouldRegenerate(newSeed, latitude, longitude) {
  if (!lastGenPos) return { regen: true, reason: 'initial' };
  if (newSeed !== seed) return { regen: true, reason: 'time-bucket' };
  const moved = computeDistance(lastGenPos.lat, lastGenPos.lon, latitude, longitude);
  if (moved > 120) return { regen: true, reason: 'moved-'+Math.round(moved)+'m' };
  return { regen:false };
}

function updateWorld() {
  if (!lastPos) return;
  const { latitude, longitude } = lastPos.coords;
  const newSeed = geoTimeSeed(latitude, longitude, 15);
  const regenCheck = shouldRegenerate(newSeed, latitude, longitude);
  if (regenCheck.regen || entities.length === 0) {
    seed = newSeed;
    seedEl.textContent = seed.toString(16);
    entities = generateEntities(seed, latitude, longitude);
    lastGenPos = { lat: latitude, lon: longitude };
    regenReasonEl.textContent = regenCheck.reason;
    log('Generated entities '+entities.length+' seed '+seed.toString(16)+' ('+regenCheck.reason+')');
    rebuildNearbyList();
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
    const scale = 1;
    if (e.type === 'mob') {
      ctx.fillStyle = e.id === selectedEntityId ? '#fff' : (e.tier === 1 ? '#5f5' : e.tier === 2 ? '#fc5' : '#f55');
      ctx.beginPath();
      ctx.arc(p.x/2, -p.y/2, 4 + e.tier*2, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.strokeStyle = e.id === selectedEntityId ? '#5ab0ff' : '#ccc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const size = 14 + (e.type.length*0.7);
      ctx.rect(p.x/2 - size/2, -p.y/2 - size/2, size, size);
      ctx.stroke();
      ctx.fillStyle = '#eee';
      ctx.font = '11px system-ui';
      ctx.fillText(e.type, p.x/2 - size/2, -p.y/2 - size/2 - 4);
    }

    // Distance label for close objects
    if (dist < 600) {
      ctx.fillStyle = '#89c';
      ctx.font = '10px system-ui';
      ctx.fillText(Math.round(dist) + 'm', p.x/2 + 6, -p.y/2 + 4);
    }
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
    (ent.tier?`Tier: ${ent.tier}<br>`:'')+
    `Seed: ${seed.toString(16)}`;
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

resize();
requestLocation();
