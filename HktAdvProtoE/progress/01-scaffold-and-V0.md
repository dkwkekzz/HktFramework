# 01. 모노레포 스캐폴드 + V0 module-contract

> 현재 상태 요약은 [../STATE.md](../STATE.md). 이 문서는 완료된 작업의 상세 기록이다.

## 한 일

### 모노레포 스캐폴드

원문 「25. 프로젝트 디렉터리 구조」의 경로 규약대로 최소 골격만 세웠다. 아직 필요 없는 앱·패키지는 만들지 않았다.

```text
package.json          pnpm workspace 루트 (test / lab / verify / typecheck)
pnpm-workspace.yaml   apps/* · packages/*/*
tsconfig.base.json    strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess
vitest.config.ts      packages/*/*/tests/**/*.test.ts
apps/lab/             브라우저 Lab (Vite)
packages/verification/V0-module-contract/
tools/verify.mjs      증거 발급기 (V4 가 생기면 대체)
tools/lab-shot.mjs    Lab 헤드리스 실행 + 스크린샷
```

기술 선택은 [Design-MMO.md](../design/Design-MMO.md) 27장(TypeScript 모노레포 · Vite)을 따랐다.
Three.js/Rapier/Colyseus 는 해당 페이즈(X·N)에서 도입한다.

### V0 module-contract

원문 「22」의 1~11 단계를 순서대로 수행했다.

| 단계 | 결과 |
|---|---|
| 1 선행 모듈 확인 | V0 은 선행 없음 (`depends_on: [none]`) |
| 2 MODULE.yaml 작성 | [packages/verification/V0-module-contract/MODULE.yaml](../packages/verification/V0-module-contract/MODULE.yaml) |
| 3 실패하는 시나리오 | 대표 장면 6개 (`scenarios/index.ts`) |
| 4 최소 구현 | `src/{parse,registry,module,sha256,contract}.ts` |
| 5 타입·단위 테스트 | `pnpm run typecheck` · 단위 55건 |
| 6 속성 테스트 | fast-check 7속성 × numRuns 1000, 시드 20260730 고정 |
| 7 대표 Lab 실행 | `pnpm lab` — 원문 「24」 공통 화면 8구획 |
| 8 인과 추적 확인 | 모든 거부가 `<문서>#/<필드>` 경로와 코드로 지목된다 |
| 9 통합 시나리오 | VS0 은 K0~K3 필요 → 실행 불가 (`it.todo`) |
| 10 증거 파일 | `evidence/latest.json` (원문 「21」 형식) |
| 11 VERIFIED 등록 | **하지 않음** — G6 미충족, 상태는 `LAB_PASS` |

## 설계 판단

- **부분 등록 + 연쇄 거부.** 결함 문서만 거부하고 나머지는 등록한다. 거부된 모듈을 선행으로 삼은 모듈은
  고정점까지 연쇄로 거부한다(`E_DEPENDENCY_REJECTED`). 원문 「4」의 `BLOCKED`(선행이 검증되지 않음)와 같은 방향이다.
- **상태값은 V0 이 다루지 않는다.** 원문 「8」의 V4 가 "검증 상태 관리"를 담당하므로, V0 은 계약·의존 그래프와
  무효화 대상 계산(`dependentClosure`)만 제공한다. `MODULE.yaml` 에도 상태 필드를 두지 않았다.
- **`none` 은 명시적 선언.** 필드 누락과 "없음"을 구분한다. 누락은 거부, `- none` 은 빈 배열로 정규화.
- **자체 SHA-256.** 같은 해시 계산이 Node 테스트와 브라우저 Lab 양쪽에서 돌아야 해서 `node:crypto` 를 쓰지 않았다.
  대신 단위 테스트에서 `node:crypto` 와 교차 검증한다 — 이 테스트가 실제로 55바이트 경계의 패딩 버그를 잡아냈다.
- **id 중복은 양쪽 모두 거부.** 하나를 골라 등록하면 결정적이긴 하지만 충돌을 은폐한다.

## 게이트 판정 (원문 「5」)

| 게이트 | 상태 | 근거 |
|---|---|---|
| G0 목적 | 통과 | MODULE.yaml `purpose` 한 문장 |
| G1 계약 | 통과 | 입력·출력·소유 상태·오류 형식(`VerificationIssue`) 명시 |
| G2 단위 | 통과 | 정상·결손·형식 오류·경계값 55건 |
| G3 속성 | 통과 | 무작위 DAG·결손·순환에서 불변조건 유지 (7속성 × 1000) |
| G4 직관 | 통과 | `pnpm lab` 6장면 전부 통과 · 헤드리스 확인(패널 6, 체크 26, 콘솔 오류 0) |
| G5 결정성 | 통과 | 문서 순서 100순열 → 해시 1개 |
| G6 통합 | **미충족** | VS0 이 K0~K3 을 요구 |
| G7 회귀 | 해당 없음 | 첫 모듈 |
| G8 증거 | 통과 | `evidence/latest.json` (sourceHash · contractHash · 테스트 수 · Lab 판정) |

## 다음 작업에 넘기는 것

- **V1 schema** 는 `schemas/module-contract.schema.json` 을 런타임 검증기로 소비한다. 지금 V0 의 구조 검증은
  손으로 쓴 것이며, V1 이 생기면 스키마 기반 검증으로 대체하고 V0 의 파서는 스키마 통과 후의 정규화만 남긴다.
- **V2 determinism** 이 `ModuleContext` 의 `seed`/`tick` 을 실제 Seed RNG · Tick Clock 으로 대체한다.
  현재 시나리오의 시드 순열 유도는 임시 구현이다.
- **V3 scenario-runner** 가 `runScenario` 를 대체한다. `src/contract.ts` 의 `runScenario` 는 V3 이 없는 동안의 최소 실행기다.
- **V4 evidence-gate** 가 `tools/verify.mjs` 와 Lab 의 상태 보드를 대체한다. 그때 V0 의 `dependentClosure` 로
  무효화 연쇄를 계산한다.
- V0 의 `VERIFIED` 승격은 K0~K3 완료 후 VS0 통과 시점에 한다.
