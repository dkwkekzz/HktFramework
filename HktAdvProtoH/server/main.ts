// 세계 프로세스 진입점 (C003) — `npm run server`
//
// 브라우저와 다른 프로세스에서 세계가 돈다. 정적 빌드(dist/)를 함께 서빙하므로
// 이 하나만 띄우면 빌드된 게임을 플레이할 수 있다.
// 개발 중에는 vite.config.ts 가 같은 Host 를 dev 서버에 붙인다 (npm run dev).

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSPORT_PATH } from '../protocol/transport';
import { attachWorldServer } from './attach';
import { createWorldHost } from './world-host';

const PORT = Number(process.env.PORT ?? 5180);
const DIST = fileURLToPath(new URL('../dist', import.meta.url));

const CONTENT_TYPE: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
};

const httpServer = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0] ?? '/';
  const relative = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, relative);

  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': CONTENT_TYPE[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const host = createWorldHost();
attachWorldServer(httpServer, host);

httpServer.listen(PORT, () => {
  console.log(`[world] 세계가 돌기 시작했다 — http://localhost:${PORT} (ws ${TRANSPORT_PATH})`);
});
