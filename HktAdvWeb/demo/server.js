// =====================================================================
// 데모 서버 — node:http 정적 서버 + /api/demo (외부 프레임워크 없음, step A1)
// ---------------------------------------------------------------------
// startServer() 는 테스트가 기동/종료를 제어할 수 있도록 서버 객체를 돌려준다.
// 직접 실행(node demo/server.js)하면 포트를 열고 대기한다.
// =====================================================================
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { buildDemo } from './scenario.js';

const here = dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

export function createDemoServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/demo') {
        const body = JSON.stringify(buildDemo(), null, 2);
        res.writeHead(200, { 'content-type': MIME['.json'] });
        res.end(body);
        return;
      }
      // 정적 파일 (경로 이탈 방지)
      let rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
      const filePath = join(here, rel);
      if (!filePath.startsWith(here)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    } catch (err) {
      res.writeHead(err?.code === 'ENOENT' ? 404 : 500);
      res.end(String(err?.message ?? err));
    }
  });
}

// 테스트용: 서버를 임의/지정 포트로 띄우고 {server, port, close} 반환.
export function startServer(port = 0) {
  const server = createDemoServer();
  return new Promise((resolve) => {
    server.listen(port, () => {
      const { port: actual } = server.address();
      resolve({
        server,
        port: actual,
        url: `http://localhost:${actual}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

// 직접 실행 시 데모 서버 기동.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8173;
  startServer(port).then(({ url }) => {
    console.log(`[HktAdvWeb demo] ${url} (Ctrl+C 로 종료)`);
  });
}
