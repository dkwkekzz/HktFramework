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
    // 분해 원칙 5: 화면은 ViewModel + 프로토콜만 소비한다 — 시뮬레이션·생성 접근은 린트로 차단
    files: ["src/app/**"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/core/**", "**/persistence/**", "**/generation/**", "**/content/**"],
              message:
                "app 은 ViewModel(+shared 프로토콜·rendering)만 소비한다 — 세계 생성도 Worker 뒤에서 돈다 (분해 원칙 5, §38)",
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * Phase-8 DoD — 렌더러는 **SceneViewModel 이외의 타입을 import 하지 않는다.**
     * app/shared/core/generation 전부 금지. 남는 것은 `../viewmodel/SceneViewModel` 과 rendering 내부뿐이므로,
     * 표현 방식을 바꾸는 변경이 이 디렉터리 밖으로 새는 경로가 아예 없다(§8.0 격리 증명).
     */
    files: ["src/rendering/**"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/core/**",
                "**/persistence/**",
                "**/generation/**",
                "**/content/**",
                "**/app/**",
                "**/shared/**",
                "**/presentation/**",
                "../viewmodel/!(SceneViewModel)",
              ],
              message:
                "rendering 은 SceneViewModel 만 import 한다 (Phase-8 DoD — 표현 방식 교체 시 rendering/ 밖 diff 0)",
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * Event Interpreter 는 세계를 만질 수 없다 (§33 마지막 문단, Phase-8 §8.2).
     * core/persistence 를 import 하지 못하므로 **타입 수준에서 읽기 전용**이다 —
     * 들어오는 것은 shared/narration 의 순수 데이터뿐이다.
     */
    files: ["src/presentation/**"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/core/**", "**/persistence/**", "**/content/**", "**/viewmodel/**", "**/app/**"],
              message:
                "presentation 은 순수 데이터(shared/narration)만 받는다 — 세계에 쓰기 권한이 없다 (§33.3)",
            },
          ],
        },
      ],
    },
  },
];
