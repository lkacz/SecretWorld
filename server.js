// Minimal static dev server (ESM). Run: node server.js
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

const server = http.createServer(async (req,res)=>{
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = resolve(__dirname + urlPath);
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type':'text/plain' });
    res.end('Not found');
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, ()=> console.log(`Dev server running: http://localhost:${PORT}`));
