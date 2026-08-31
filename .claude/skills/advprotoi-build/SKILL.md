---
name: advprotoi-build
description: HktAdvProtoI 의 Cycle 실현·검증 단계를 실행한다 — 입력 검사(01-spec·02-world, UNRESOLVED 0) → 관찰 계약 확정 → World 구현 ∥ GameView 구현 ∥ 검증 시나리오 3-Agent 병렬 fan-out → 통합·테스트 → 05-verification.md 실측 기입 → 완료 조건 7항 판정. Design 에 없는 의미가 필요해지면 GAP 으로 반환하고 지어내지 않는다. 사용자가 "AdvProtoI 구현 / Cxxx build / Cycle 구현 진행 / build 진행 / 검증 진행" 을 요청하면 사용.
---

# HktAdvProtoI Cycle Build — 실현·검증 (IMPL ∥ GAMEVIEW ∥ 검증)

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) —
어긋나면 원본이 이긴다. 경로 규약·기반/컨텐츠 경계·GAP 형식은 `HktAdvProtoI/CLAUDE.md`.
**`engine/` 은 편집하지 않는다** — `npm run boundary:check` 가 강제한다.

입력은 `cycles/<CycleId>/01-spec.md` · `02-world.md` 두 파일뿐이다. 산출물은
`03-impl.md` · `04-gameview.md`(필요 시) · `05-verification.md` + 코드 커밋이다.
모든 Artifact 머리에 plan 과 같은 Trace 블록(CYCLE/SOURCE/PREV)을 둔다.

## 0. 입력 검사 — 아니면 시작 거부

1. `01-spec.md` · `02-world.md` 가 존재한다.
2. `01-spec.md` 의 UNRESOLVED 가 "없음"이다. 아니면 시작하지 않고 `advprotoi-plan`
   (또는 Human)으로 반환한다.

## 1. 관찰 계약 확정 — fan-out 전 단일 작업

`02-world.md` 의 Observable 절을 `content/<active pack>/protocol/` 로 옮긴다.
무엇을 투영할지는 이미 plan 이 닫았다 — 이 작업은 **기계적 변환**이어야 하며, 여기서
투영 대상을 새로 판단하게 되면 그것은 02-world 의 결손이다 (DESIGN GAP 으로 반환).
이것이 병렬 Agent 들의 **유일한 동기화 지점**이다 — W·V 가 계약을 서로 다르게 만들지
못하게 여기서 하나로 고정한다. 활성 팩은 `hkt.pack.json` 이 가리킨다.

## 2. 3-Agent 병렬 fan-out

Agent tool 로 **한 메시지에 동시 발사**한다. 각 프롬프트에 반드시 담는 것:
담당 파일 경계 · `01-spec.md`/`02-world.md` 전문(또는 경로) · 확정된 관찰 계약 ·
아래 공통 금지 규칙.

```text
Agent W  World 구현        content/<pack>/world/ (+ 1 에서 확정된 protocol/ 소비)
Agent V  GameView 구현     content/<pack>/view/ — World State 를 표현만 한다
Agent T  검증 시나리오 작성  cycles/<CycleId>/05-verification.md 의 Given/When/Then
```

공통 금지 규칙 (각 Agent 프롬프트에 그대로):

- **코드 배치** — 새 코드는 전부 `content/<pack>/` 에 쓴다. 판정 기준은 게임의
  명사다: stone·wolf·worldPressure 같은 이 세계의 이름을 아는 코드는 content 의
  것이고, 기반은 게임 명사 없이 동작하는 것만 갖는다. 범용해 보이는 개념도 처음엔
  content 에 두고, 두 번째 실제 사용처가 나타났을 때 기반 트랙이 별도 커밋으로
  올린다 (승격 시 게임 명사를 벗기고, 기존 관찰 가능 행동을 유지한다).
- **의미 생성 금지 + GAP 삼분법** — 막히면 종류를 먼저 판정한다.
  - `IMPLEMENTATION GAP`: Semantic/Rule 은 충분한데 content 쪽 코드에 필요한 기술
    기능이 없다 (예: 02-world 가 요구하는 Attack.impactTime 을 담을 상태가 팩에
    아직 없다) → **Agent 가 그 자리에서 최소 범위로 구현한다.** Human 반환 불필요.
  - `ENGINE GAP`: 결손이 기반(engine) 쪽이다 → 먼저 기존 physics 솔버 조합 등
    content 쪽 표현으로 풀 수 있는지 시도한다. content 만으로 성립하지 않으면
    자기 산출물에 `ENGINE GAP` 블록(필요한 기반 능력 · 시도한 우회 · 성립하지 않는
    이유)을 남기고 그 부분만 미완으로 종료한다 → 기반 트랙이 Human 승인 후 별도
    커밋으로 최소 구현하고, Cycle 이 재개한다. 기반은 이 발주로만 자란다.
  - `DESIGN GAP`: 02-world 로는 게임 의미를 결정할 수 없다 → 지어내지 말고 자기
    산출물에 CLAUDE.md `GAP` 블록을 남기고 그 부분만 미완으로 종료한다 (plan/Human
    반환 대상). 기술 결손은 위 두 GAP 으로 보내 공정을 계속 굴린다.
- **선행 추상화 금지** (원본 §10) — 현재 Rule 실행에 필요한 최소 구조만 만든다.
  미래 요구를 예상한 Provider/Strategy/Pipeline/Registry 를 만들지 않는다.
  추상화는 실제 Cycle 반복에서 중복이 발견됐을 때만, 그때도 기존 관찰 가능 행동을
  유지하는 리팩터링으로만 (원본 §11, §18).
- 담당 경계 밖 파일을 만지지 않는다.

Agent 별 추가 규칙:

- **W**: 세계 State 변경은 World Rule 의 Transition 에서만 (CLAUDE.md 원칙 4).
  팩 시스템은 `engine/physics` 솔버를 조합한다 — 재구현하지 않는다.
  구현하며 **Rule ↔ 코드 매핑 표 후보**(R# → 파일·함수)를 결과로 반환한다 —
  최종 `03-impl.md` 는 통합 후 build 본체가 쓴다 (통합에서 코드가 바뀔 수 있다).
- **V**: GameView 는 새 의미를 만들지 않는다 — 관찰 계약의 State 를 표현만 한다
  (원본 §12). `view/resolve.ts` · `code-text.ts` 등 팩 계약 자리를 따른다.
  State → 표현 매핑 표를 결과로 반환한다.
- **T**: **Black-box Verification 원칙** — 읽는 것은 `01-spec.md`(무엇을 검증할지)
  와 `02-world.md`(어떤 State 를 조작·관측할지) 둘뿐이다. 구현 코드·W/V 산출물은
  보지 않는다 — 구현에 맞춰 테스트를 왜곡하는 것을 막는다 (원본 §13 — 검증 기준은
  코드 구조가 아니라 플레이 결과·World State 다). Given/When/Then 은 02-world 의
  실제 State 이름(점 경로)으로 쓰고, Human 이 추가 추론 없이 판단 가능한 형태로.
- GameView 가 불필요한 Cycle 이면 V 를 생략한다 — 형식적으로 채우지 않는다.

## 3. 통합·검증

1. Agent 산출을 모아 GAP 을 먼저 처리한다: IMPLEMENTATION GAP 은 build 본체가
   최소 범위로 구현해 해소하고, ENGINE GAP 은 기반 트랙 발주 목록으로 모아 Human 에게
   보고하며, DESIGN GAP 은 모아서 plan 또는 Human 으로 반환한다.
   해소 전에는 해당 부분을 완료로 표시하지 않는다.
2. `npm test` (경계 검사 + vitest) · `npm run build` 실행.
3. T 의 시나리오를 실제로 실행(테스트 코드 또는 실주행 관찰)하고
   `05-verification.md` 에 **실측 결과**(PASS/FAIL + 관찰된 World State)를 기입한다
   — 약속이 아니라 실행한 값만 적는다.
4. **확장 Cycle** 이면 기존 관찰 가능 행동의 회귀 검증을 포함한다 (원본 §18,
   CLAUDE.md 원칙 8 — REUSED Rule 의 기존 Scenario 재실행).

## 4. Artifact 마감

| 파일 | 내용 |
|---|---|
| `03-impl.md` | **통합 후 build 본체가 최종 작성** — 변경 파일 목록 + Rule ↔ 코드 매핑 표 (W 의 후보를 통합 결과로 갱신, 모든 R# 매핑 필수) + Architecture 변화 절 (없으면 "없음"; 실제 반복에서 공통화가 생겼으면 무엇을 왜 통합했는지. 코드 자체는 커밋이 소유) |
| `04-gameview.md` | State → 표현 매핑 표 (V 를 돌린 Cycle 만) |
| `05-verification.md` | Given/When/Then + 실측 + 완료 조건 체크 |

`05-verification.md` 끝에 완료 조건 7항 (원본 §19) 을 체크한다:

```text
[ ] Design Trace   어떤 Design 에서 나왔는지 설명 가능
[ ] Scope          무엇을 만들었는지 한두 문장
[ ] Semantic       필요한 World State 명확
[ ] Rule           조건→상태 변화 명확
[ ] Implementation Semantic·Rule 이 Runtime 에서 실행됨
[ ] Observable     World State 또는 GameView 에서 직접 확인 가능
[ ] Verification   Human 이 추가 추론 없이 판단 가능
```

7항 전부 + 시나리오 전부 PASS 여야 Cycle 완료다. 하나라도 미달이면 미완 항목과
반환 대상(W/V/plan/Human)을 보고하고 완료 선언하지 않는다.

Cycle 간 병렬 규칙은 아직 두지 않는다 — 한 번에 한 Cycle 이 기본이다. 실제로
동시 진행 필요가 생기면 그때 규칙을 세운다 (선행 추상화 금지를 공정 자신에게도 적용).
