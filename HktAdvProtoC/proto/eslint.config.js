import tsParser from "@typescript-eslint/parser";

// Phase 0 §0.6 — 경계는 규범이 아니라 빌드 오류로 강제한다.
export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" },
  },
  {
    // 결정론 보호: 시뮬레이션 쪽 코드는 벽시계·전역 난수 금지 (RandomContext + tick 만 사용)
    files: ["src/core/**", "src/shared/**", "src/persistence/**", "src/viewmodel/**", "src/generation/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "결정론 위반 — shared/random 의 RandomContext RNG 를 사용할 것" },
        { object: "Date", property: "now", message: "결정론 위반 — 시뮬레이션 시간은 tick(simulationTime)을 사용할 것" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "결정론 위반 — 시뮬레이션 시간은 tick(simulationTime)을 사용할 것",
        },
      ],
    },
  },
  {
    // 분해 원칙 5: 렌더·UI 는 SceneViewModel 만 소비한다 — core/persistence 접근은 컴파일 단계에서 차단
    files: ["src/app/**", "src/rendering/**"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/core/**", "**/persistence/**"],
              message: "app/rendering 은 SceneViewModel(+shared 프로토콜)만 소비한다 (분해 원칙 5)",
            },
          ],
        },
      ],
    },
  },
];
