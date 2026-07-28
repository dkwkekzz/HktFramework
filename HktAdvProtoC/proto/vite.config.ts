import { defineConfig } from "vitest/config";

export default defineConfig({
  // 시뮬레이션 코어는 DOM 비의존 — 테스트는 node 환경에서 headless 실행한다 (Phase 0 §0.4 InlineHost)
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 30일 실행이 들어가는 DoD 테스트가 있다 — 기본 5초로는 모자란다 (Phase 3 판단 교체 이후)
    testTimeout: 60_000,
  },
});
