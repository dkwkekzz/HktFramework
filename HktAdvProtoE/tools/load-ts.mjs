/**
 * 워크스페이스의 TypeScript 모듈을 Node 스크립트에서 그대로 불러온다.
 *
 * Node 는 `./foo.js` 로 적힌 TypeScript 상대 경로를 해석하지 못하고 워크스페이스 별칭도 모른다.
 * 새 의존을 들이는 대신, 이미 있는 Vite 의 SSR 로더를 쓴다 — `apps/lab` 이 같은 패키지들을
 * 같은 규칙으로 번들하므로, 도구가 보는 코드와 Lab 이 보는 코드가 갈라지지 않는다.
 */
import { createServer } from 'vite';

let server = null;

export async function loadTs(absolutePath) {
  if (!server) {
    server = await createServer({
      configFile: false,
      logLevel: 'error',
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }
  return server.ssrLoadModule(absolutePath);
}

export async function closeLoader() {
  if (server) {
    await server.close();
    server = null;
  }
}
