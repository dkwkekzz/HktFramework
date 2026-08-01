# app — HktAdvProtoF 구현 루트

npm workspaces 모노레포. 전부 TypeScript. 배치·규칙은 [../modules/WORKFLOW.md](../modules/WORKFLOW.md) §1.

```
packages/
  core/        순수 결정적 시뮬레이션 — V1 + O·S·D·P·Q·W·R·E·G·C 계층
  contracts/   V0 모듈 계약 레지스트리 + V4 완료 증거 (예정)
  scenarios/   V2 시나리오 (예정)
  lab/         V3 브라우저 검증 Lab (예정)
  server/      Node.js 권위 서버 (예정)
  client/      Three.js 3D 뷰어 (예정)
  studio/      A 계층 AI 제작 자동화 (예정)
```

## 실행

Node ≥ 22.18 의 네이티브 TypeScript 타입 스트리핑을 그대로 쓴다 — `.ts` 를 빌드 없이 실행한다.
따라서 런타임 의존성은 0개이며, `typescript` 는 타입 검사 전용 devDependency 다.

```bash
npm install          # 타입 검사기만 설치 (런타임 의존성 없음)
npm test             # 워크스페이스 전체 테스트 (node --test)
npm run typecheck    # tsc --build (타입 검사 전용, 산출물 없음)
npm run verify       # 모듈별 수동 눈 검증 스크립트 (V3 Lab 이전의 임시 확인 경로)
```

`erasableSyntaxOnly` 를 켜 두었으므로 `enum`·매개변수 프로퍼티 등 타입 스트리핑이 불가능한
문법은 컴파일 단계에서 거부된다 — 빌드 없이 실행 가능한 상태를 강제한다.

## core 불변 규칙

- I/O·네트워크·DOM·`Date.now()`·`Math.random()` 금지.
- 난수는 V1 SeededRandom, 시간은 V1 TickClock 만 사용.
- 모든 함수는 `(상태, 입력) → (새 상태, 사건[])` 형태를 지향한다.
