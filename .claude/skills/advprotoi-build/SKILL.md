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

`02-world.md` 의 "관찰 State" 절로부터 World 가 투영할 관찰 계약을
`content/<active pack>/protocol/` 에 확정한다. 이것이 병렬 Agent 들의 **유일한
동기화 지점**이다 — W·V 가 계약을 서로 다르게 만들지 못하게 여기서 하나로 고정한다.
활성 팩은 `hkt.pack.json` 이 가리킨다.

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

- **의미 생성 금지** — Design/Spec/World 에 없는 게임 의미가 필요해지면 지어내지
  말고 자기 산출물에 CLAUDE.md `GAP` 블록을 남기고 그 부분만 미완으로 종료한다.
- **선행 추상화 금지** (원본 §10) — 현재 Rule 실행에 필요한 최소 구조만 만든다.
  미래 요구를 예상한 Provider/Strategy/Pipeline/Registry 를 만들지 않는다.
  추상화는 실제 Cycle 반복에서 중복이 발견됐을 때만, 그때도 기존 관찰 가능 행동을
  유지하는 리팩터링으로만 (원본 §11, §18).
- 담당 경계 밖 파일을 만지지 않는다.

Agent 별 추가 규칙:

- **W**: 세계 State 변경은 World Rule 의 Transition 에서만 (CLAUDE.md 원칙 4).
  팩 시스템은 `engine/physics` 솔버를 조합한다 — 재구현하지 않는다.
  구현하며 **Rule ↔ 코드 매핑 표**(R# → 파일·함수)를 기록해 결과로 반환한다.
- **V**: GameView 는 새 의미를 만들지 않는다 — 관찰 계약의 State 를 표현만 한다
  (원본 §12). `view/resolve.ts` · `code-text.ts` 등 팩 계약 자리를 따른다.
  State → 표현 매핑 표를 결과로 반환한다.
- **T**: **구현을 보지 않는다.** `01-spec.md` 의 검증 절만으로 Given/When/Then 을
  쓴다 (원본 §13 — 검증 기준은 코드 구조가 아니라 플레이 결과·World State 다).
  Human 이 추가 추론 없이 성공/실패를 판단할 수 있는 형태로.
- GameView 가 불필요한 Cycle 이면 V 를 생략한다 — 형식적으로 채우지 않는다.

## 3. 통합·검증

1. Agent 산출을 모아 GAP 이 있으면 먼저 처리한다: 모아서 plan 또는 Human 으로
   반환하고, 해소 전에는 해당 부분을 완료로 표시하지 않는다.
2. `npm test` (경계 검사 + vitest) · `npm run build` 실행.
3. T 의 시나리오를 실제로 실행(테스트 코드 또는 실주행 관찰)하고
   `05-verification.md` 에 **실측 결과**(PASS/FAIL + 관찰된 World State)를 기입한다
   — 약속이 아니라 실행한 값만 적는다.
4. **확장 Cycle** 이면 기존 관찰 가능 행동의 회귀 검증을 포함한다 (원본 §18,
   CLAUDE.md 원칙 8 — REUSED Rule 의 기존 Scenario 재실행).

## 4. Artifact 마감

| 파일 | 내용 |
|---|---|
| `03-impl.md` | 변경 파일 목록 + Rule ↔ 코드 매핑 표 (W 결과 검수 — 모든 R# 이 매핑되어야 한다. 코드 자체는 커밋이 소유) |
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

## Cycle 간 병렬

다른 Cycle 과 동시 진행은 두 Cycle 의 `02-world.md` REUSED+ADDED 목록의 교집합이
비었을 때만 허용한다. 겹치면 순차로 한다.
