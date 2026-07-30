import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/*/tests/**/*.test.ts'],
    environment: 'node',
    // 시나리오·속성 테스트는 시드를 고정해 돌린다 — 병렬 여부가 결과를 바꾸지 않아야 한다.
    sequence: { shuffle: false },
    reporters: process.env['CI'] === 'true' ? ['default'] : ['default'],
  },
});
