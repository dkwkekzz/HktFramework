// Vitest 설정 — vite.config.ts 대신 이 파일을 읽는다.
//
// 여기 있는 이유는 하나다. 모션 아틀라스 생성물은 커밋하지 않으므로(.gitignore),
// 테스트가 그것을 import 하기 전에 만들어져 있어야 한다. 개발 서버·빌드에서는
// vite plugin 이 같은 일을 한다.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tools/motion-atlas/vitest-setup.ts'],
  },
});
