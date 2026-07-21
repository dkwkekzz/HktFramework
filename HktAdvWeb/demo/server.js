// =====================================================================
// 데모 서버 — node:http 정적 서버 + /api/demo + /api/play/* (외부 프레임워크 없음)
// ---------------------------------------------------------------------
// startServer() 는 테스트가 기동/종료를 제어할 수 있도록 서버 객체를 돌려준다.
// 직접 실행(node demo/server.js)하면 포트를 열고 대기한다.
//
// /api/play/* — 플레이어블 게임(P0, src/play/game.js)의 입력/상태 통로.
// 서버가 권위: 첫 접속 시 게임을 만들고 실시간 구동기(tick_ms)로 시계를 민다.
// 클라이언트(play.html)는 상태 payload 만 그린다 — 불변 원칙 ⑥의 플레이 버전.
// =====================================================================
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { buildDemo } from './scenario.js';
import { PlayGame } from '../src/play/game.js';

const here = dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 65536) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

export function createDemoServer() {
  let game = null;
  let timer = null;
  const ensureGame = () => {
    if (!game) {
      game = new PlayGame();
      // 촘촘한 박자(200ms)로 존(이동·전투·채집)을 밀고, 5박자마다 세계 틱(주기·소멸) 1.
      const fineMs = 200;
      const perTick = Math.max(1, Math.round((game.fixture.tick_ms ?? 1000) / fineMs));
      let n = 0;
      timer = setInterval(() => {
        game.zoneStep(fineMs / 1000);
        if (++n % perTick === 0) game.tick();
      }, fineMs);
      timer.unref(); // 테스트/종료 시 프로세스를 붙들지 않는다
    }
    return game;
  };

  const server = createServer(async (req, res) => {
    const json = (code, obj) => {
      res.writeHead(code, { 'content-type': MIME['.json'] });
      res.end(JSON.stringify(obj));
    };
    try {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/api/demo') {
        return json(200, buildDemo());
      }

      // ── 플레이 API — 상태 변경은 전부 게임(법칙 apply) 경유 ──
      if (url.pathname.startsWith('/api/play/')) {
        const g = ensureGame();
        try {
          if (req.method === 'GET' && url.pathname === '/api/play/state') {
            return json(200, g.state(url.searchParams.get('id')));
          }
          const body = req.method === 'POST' ? await readBody(req) : {};
          if (url.pathname === '/api/play/join') {
            const who = g.join(body.name);
            return json(200, { ...who, state: g.state(who.id) });
          }
          if (url.pathname === '/api/play/move') {
            const r = g.move(body.id, body.to);
            return json(200, { ...r, state: g.state(body.id) });
          }
          if (url.pathname === '/api/play/act') {
            const r = g.act(body.id, body);
            return json(200, { ...r, state: g.state(body.id) });
          }
          if (url.pathname === '/api/play/goal') {
            g.setActiveGoal(body.id, body.goal);
            return json(200, { ok: true, state: g.state(body.id) });
          }
          if (url.pathname === '/api/play/cmd') {
            // 존 명령(이동·공격·채집 의도)은 상태를 되돌려주지 않는다 — 폴링이 곧 따라온다.
            return json(200, g.cmd(body.id, body));
          }
          return json(404, { error: '없는 플레이 API' });
        } catch (e) {
          // 게임 규칙 거부(창 밖·에너지 부족·경로 없음)는 오류가 아니라 피드백이다.
          return json(200, { ok: false, error: String(e?.message ?? e) });
        }
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

  server.on('close', () => { if (timer) clearInterval(timer); });
  return server;
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
    console.log(`[HktAdvWeb demo] ${url} — 플레이: ${url}/play.html (Ctrl+C 로 종료)`);
  });
}
