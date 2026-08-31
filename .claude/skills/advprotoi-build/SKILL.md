---
name: advprotoi-build
description: HktAdvProtoI 의 Cycle 실현·검증 단계를 실행한다 — 입력 검사(01-spec·02-world, UNRESOLVED 0) → 관찰 계약 확정 + 기구/의미 분해(기구=engine 추출·의미=content) → E(기구) ∥ W(World) ∥ V(GameView) ∥ T(검증 시나리오) 병렬 fan-out → 통합·테스트 → 05-verification.md 실측 기입 → 완료 조건 7항 판정. Design 에 없는 의미가 필요해지면 GAP 으로 반환하고 지어내지 않는다. 사용자가 "AdvProtoI 구현 / Cxxx build / Cycle 구현 진행 / build 진행 / 검증 진행" 을 요청하면 사용.
---

# HktAdvProtoI Cycle Build — 실현·검증 (IMPL ∥ GAMEVIEW ∥ 검증)

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) —
어긋나면 원본이 이긴다. 경로 규약·기반/컨텐츠 경계·GAP 형식은 `HktAdvProtoI/CLAUDE.md`.
`engine/` 수정은 아래 **기구 추출** 경로로만 한다 — `npm run boundary:check`
(engine→content import 금지)는 항상 통과해야 한다.

입력은 `cycles/<CycleId>/01-spec.md` · `02-world.md` 두 파일뿐이다. 산출물은
`03-impl.md` · `04-gameview.md`(필요 시) · `05-verification.md` + 코드 커밋이다.
모든 Artifact 머리에 plan 과 같은 Trace 블록(CYCLE/SOURCE/PREV)을 둔다.

## 0. 입력 검사 — 아니면 시작 거부

1. `01-spec.md` · `02-world.md` 가 존재한다.
2. `01-spec.md` 의 UNRESOLVED 가 "없음"이다. 아니면 시작하지 않고 `advprotoi-plan`
   (또는 Human)으로 반환한다.

## 1. 관찰 계약 확정 + 기구/의미 분해 — fan-out 전 단일 작업

**관찰 계약**: `02-world.md` 의 Observable 절을 `content/<active pack>/protocol/` 로
옮긴다. 무엇을 투영할지는 이미 plan 이 닫았다 — 이 작업은 **기계적 변환**이어야 하며,
여기서 투영 대상을 새로 판단하게 되면 그것은 02-world 의 결손이다 (DESIGN GAP 반환).
활성 팩은 `hkt.pack.json` 이 가리킨다.

**기구/의미 분해**: 이번 구현 요구를 둘로 나눈다.

```text
기구 (→ engine)    게임 명사 없이 성립하는 구조 — 그리기·배치·입력·수치 처리·순회.
                   예: "칸 격자에 아이콘과 수량을 그린다"(타일뷰) · "영역이 위치를
                   포함하는지 판정한다". 이후 Cycle 과 다른 팩이 재사용할 자산이 된다.
의미 (→ content)   이 세계의 이름과 규칙을 아는 부분 — "이 칸은 stone 이고 채광으로
                   늘어난다" · "이 영역의 세계압은 spatial-shear 다".
```

분해 판정: 구현할 코드에서 게임 명사를 전부 벗겨도 남는 동작이 있으면 그것이 기구다.
벗기면 아무것도 남지 않는 코드(의미와 얽힌 Rule 로직)는 통째로 content 다.
추출하는 기구의 **기능 범위는 이번 사용처가 실제로 쓰는 만큼**이다 — 확장 축(옵션·
변형)은 그것을 쓰는 다음 사용처가 온 Cycle 에서 넓힌다. 기구가 이미 engine 에 있으면
그대로 재사용한다 (추출 전에 기존 기구 목록을 훑는 이유다).

분해 결과로 **기구의 API(형·함수 시그니처)를 여기서 선언**한다 — W·V 는 이 API 에
맞춰 조립하고, E 는 이 API 를 구현한다. 이것과 관찰 계약이 병렬 Agent 들의 동기화
지점이다.

## 2. 병렬 fan-out (E ∥ W ∥ V ∥ T)

Agent tool 로 **한 메시지에 동시 발사**한다. 각 프롬프트에 반드시 담는 것:
담당 파일 경계 · `01-spec.md`/`02-world.md` 전문(또는 경로) · 확정된 관찰 계약 ·
선언된 기구 API · 아래 공통 금지 규칙.

```text
Agent E  기구 추출·구현     engine/ — 1 에서 선언한 API 를 게임 명사 없이 구현한다.
                           분해 결과 새 기구가 없으면 생략. 커밋은 content 와 분리한다
Agent W  World 구현        content/<pack>/world/ — 기구 API 에 명사·데이터를 공급해 조립
Agent V  GameView 구현     content/<pack>/view/ — World State 를 표현만 한다. 기구 API 로 그린다
Agent T  검증 시나리오 작성  cycles/<CycleId>/05-verification.md 의 Given/When/Then
```

공통 금지 규칙 (각 Agent 프롬프트에 그대로):

- **코드 배치** — 1 의 분해 결과를 따른다: 기구는 engine (E 의 담당, 게임 명사
  없이), 의미는 content. 게임 명사를 아는 코드는 전부 content 다.
- **의미 생성 금지 + GAP 삼분법** — 막히면 종류를 먼저 판정한다.
  - `IMPLEMENTATION GAP`: Semantic/Rule 은 충분한데 content 쪽 코드에 필요한 기술
    기능이 없다 (예: 02-world 가 요구하는 Attack.impactTime 을 담을 상태가 팩에
    아직 없다) → **Agent 가 그 자리에서 최소 범위로 구현한다.** Human 반환 불필요.
  - `ENGINE GAP`: 성립하려면 **기존 engine 계약을 바꿔야 한다** (기존 export 의
    시그니처·의미 변경, 스냅샷 형태 변경 등 다른 사용처에 영향이 가는 것) →
    자기 산출물에 `ENGINE GAP` 블록(필요한 변경 · 영향 범위)을 남기고 그 부분만
    미완으로 종료한다 → Human 승인 후 별도 커밋으로 반영하고 Cycle 이 재개한다.
    새 기구를 **더하는** 것은 E 의 정상 작업이다 — 이 GAP 은 기존 것을 **바꿀 때**만.
  - `DESIGN GAP`: 02-world 로는 게임 의미를 결정할 수 없다 → 지어내지 말고 자기
    산출물에 CLAUDE.md `GAP` 블록을 남기고 그 부분만 미완으로 종료한다 (plan/Human
    반환 대상). 기술 결손은 위 두 GAP 으로 보내 공정을 계속 굴린다.
- **선행 추상화 금지** (원본 §10) — 현재 Rule 실행에 필요한 최소 구조만 만든다.
  미래 요구를 예상한 Provider/Strategy/Pipeline/Registry 를 만들지 않는다.
  추상화는 실제 Cycle 반복에서 중복이 발견됐을 때만, 그때도 기존 관찰 가능 행동을
  유지하는 리팩터링으로만 (원본 §11, §18).
- 담당 경계 밖 파일을 만지지 않는다.

Agent 별 추가 규칙:

- **E**: 게임 명사 없이 구현한다 — 이름·데이터는 매개변수와 제네릭으로 받는다.
  기능 범위는 선언된 API 그대로 (확장 축은 다음 사용처의 Cycle 이 넓힌다).
  구현한 기구 목록(무엇을 · 어떤 요구에서 추출했는지)을 결과로 반환한다.
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
   최소 범위로 구현해 해소하고, ENGINE GAP(기존 engine 계약 변경)은 모아 Human 에게
   승인을 받아 별도 커밋으로 반영하며, DESIGN GAP 은 모아서 plan 또는 Human 으로 반환한다.
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
| `03-impl.md` | **통합 후 build 본체가 최종 작성** — 변경 파일 목록 + Rule ↔ 코드 매핑 표 (W 의 후보를 통합 결과로 갱신, 모든 R# 매핑 필수) + **기구 추출 절** (E 가 engine 에 더한 기구 목록 — 무엇을 어떤 요구에서 추출했고 어디서 재사용 가능한지; 없으면 "없음") + Architecture 변화 절 (없으면 "없음". 코드 자체는 커밋이 소유) |
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
