import { defineConfig } from "vitest/config";

export default defineConfig({
  // 시뮬레이션 코어는 DOM 비의존 — 테스트는 node 환경에서 headless 실행한다 (Phase 0 §0.4 InlineHost)
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
