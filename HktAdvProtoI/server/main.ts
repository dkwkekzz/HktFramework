// 세계 프로세스 진입점 — `npm run server`
//
// 브라우저와 다른 프로세스에서 세계가 돈다. 정적 빌드(dist/)를 함께 서빙하므로
// 이 하나만 띄우면 빌드된 게임을 플레이할 수 있다.
// 개발 중에는 vite.config.ts 가 같은 Host 를 dev 서버에 붙인다 (npm run dev).

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSPORT_PATH } from '../engine/protocol-core/transport';
import { restoreWorld } from '../content/active';
import { attachWorldServer } from './attach';
import { createWorldHost } from './world-host';
import { createFileWorldStore } from './world-store';

const PORT = Number(process.env.PORT ?? 5180);
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
// 영속 (design/Design-World-Persistence.md) — 주기 저장 + 정상 종료 시 저장.
// 자리·주기는 세계를 띄우는 쪽의 결정이므로 환경 변수로 조정한다. 0 이하 주기 = 저장 끔.
const SAVE_PATH =
  process.env.HKT_WORLD_SAVE ?? fileURLToPath(new URL('../.world/snapshot.json', import.meta.url));
const SAVE_INTERVAL_MS = Number(process.env.HKT_WORLD_SAVE_INTERVAL_MS ?? 5000);

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

// 스냅샷이 있으면 세계는 그 순간부터 이어진다. 버전이 다르면 버렸다는 사실을 숨기지
// 않고 새 세계로 시작한다 (마이그레이션 없음 — 형태를 바꾼 쪽이 버전을 올린다).
const store = createFileWorldStore(SAVE_PATH);
const stored = store.load();
const restored = stored ? restoreWorld(stored) : null;
if (stored && !restored) {
  console.log(`[world] 스냅샷 버전이 달라 복구하지 않는다 (${stored.version}) — 새 세계로 시작`);
}

const host = createWorldHost({}, restored ?? undefined);
attachWorldServer(httpServer, host);

if (SAVE_INTERVAL_MS > 0) {
  // 단일 스레드이므로 이 콜백은 언제나 Tick 사이에 돈다 — 스냅샷의 원자성 경계다.
  setInterval(() => store.save(host.world.snapshot()), SAVE_INTERVAL_MS).unref();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (SAVE_INTERVAL_MS > 0) store.save(host.world.snapshot());
    host.stop();
    process.exit(0);
  });
}

httpServer.listen(PORT, () => {
  const from = restored ? `스냅샷에서 이어진다 (time=${restored.time.toFixed(1)})` : '새 세계';
  console.log(
    `[world] 세계가 돌기 시작했다 — http://localhost:${PORT} (ws ${TRANSPORT_PATH}) · ${from}`,
  );
});
