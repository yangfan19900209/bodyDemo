// Serve the real production build under the same subpath used by GitHub Pages.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const prefix = '/bodyDemo/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:4174');
    if (url.pathname === '/bodyDemo') { response.writeHead(301, { Location: prefix }); response.end(); return; }
    if (!url.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Outside the Pages project path'); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const target = path.resolve(root, relative);
    if (!target.startsWith(root)) { response.writeHead(403); response.end(); return; }
    const info = await stat(target);
    if (!info.isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404); response.end('Missing build asset; run npm run build before npm test');
  }
}).listen(4174, '127.0.0.1', () => console.log('Production Pages fixture: http://127.0.0.1:4174/bodyDemo/'));
