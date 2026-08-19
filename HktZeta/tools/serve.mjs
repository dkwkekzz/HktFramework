// 최소 정적 서버 — render/ 를 서빙하고 /three.module.js 를 node_modules 에서 매핑한다.
// 사용: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_BUILD = join(root, 'node_modules', 'three', 'build');
const port = Number(process.argv[2] ?? 8123);

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/render/index.html';
    if (url.endsWith('/')) url += 'index.html';
    // three 빌드(three.module.js 는 three.core.js 를 재수출한다)는 build 디렉터리에서 매핑
    let file = /^\/three[\w.]*\.js$/.test(url)
      ? join(THREE_BUILD, url.slice(1))
      : join(root, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end('404: ' + e.message);
  }
});

server.listen(port, () => console.log(`HktZeta serve → http://localhost:${port}/render/ (three @ /three.module.js)`));
