import { defineConfig } from 'vite';

// core/scenarios/contracts 를 소스 그대로 import 한다 — 빌드 산출물이 아니라 같은 코드를 실행한다.
export default defineConfig({
  server: { port: 5173, strictPort: false },
  build: { target: 'es2023', outDir: 'dist' },
});
