import { geoTimeSeed } from './rng.js';
import { generateEntities, projectToLocal } from './worldgen.js';

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const latEl = document.getElementById('lat');
const lonEl = document.getElementById('lon');
const accEl = document.getElementById('accuracy');
const seedEl = document.getElementById('seed');

let lastPos = null;
let entities = [];
let seed = 0;

function log(msg) {
  const line = document.createElement('div');
  line.textContent = msg;
  logEl.prepend(line);
  while (logEl.children.length > 80) logEl.removeChild(logEl.lastChild);
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

function updateWorld() {
  if (!lastPos) return;
  const { latitude, longitude } = lastPos.coords;
  // Recompute seed every 15min bucket
  const newSeed = geoTimeSeed(latitude, longitude, 15);
  if (newSeed !== seed || entities.length === 0) {
    seed = newSeed;
    seedEl.textContent = seed.toString(16);
    entities = generateEntities(seed, latitude, longitude);
    log('Generated entities ('+entities.length+') with seed ' + seed.toString(16));
  }
  draw();
}

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
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
  ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui';
  ctx.fillText('You', 10, -10);

  // Draw entities
  for (const e of entities) {
    const p = projectToLocal(e.lat, e.lon, lastPos.coords.latitude, lastPos.coords.longitude);
    const dist = Math.hypot(p.x, p.y);
    const scale = 1;
    if (e.type === 'mob') {
      ctx.fillStyle = e.tier === 1 ? '#5f5' : e.tier === 2 ? '#fc5' : '#f55';
      ctx.beginPath(); ctx.arc(p.x/2, -p.y/2, 4 + e.tier*2, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle = '#ccc';
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

// Periodic refresh for new time bucket or movement
setInterval(updateWorld, 10000);

resize();
requestLocation();
