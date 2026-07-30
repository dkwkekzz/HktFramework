import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: appRoot,
  // 저장소의 MODULE.yaml 을 raw 로 읽으려면 워크스페이스 루트가 허용 범위에 있어야 한다.
  server: { fs: { allow: [workspaceRoot] } },
  build: { outDir: 'dist', emptyOutDir: true },
});
