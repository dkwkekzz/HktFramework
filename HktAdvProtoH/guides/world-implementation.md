# World Implementation Stage Guide

## Role

`03-world-semantic.md` 를 기준으로 Authoritative World 를 실제로 구현한다.

## Input

- `cycles/<CycleId>/03-world-semantic.md`
- 관련 기존 World 구현 (`world/`)
- `protocol/` 경계 타입

## Do

1. REUSED Semantic 은 기존 구현을 그대로 사용한다.
2. ADDED Semantic 을 State 로 구현한다.
3. CHANGED Rule 을 수정하고, AFFECTED Rule 이 새 Precondition 을 만족하도록 함께 발전시킨다.
4. `03-world-semantic.md` 가 정한 Authority 를 코드로 강제한다 — World Authority State 는
   Rule 을 거치지 않고 바뀔 수 없어야 한다.
5. Action Request 처리 경로를 연결한다.
6. Observer Projection 을 구현해 GameView Specification 을 산출한다.
   Projection 은 **semantic 만** 투영한다 — role/state/관찰 값/사유 코드.
   sprite·크기·라벨 형식·문구 같은 표현 결정은 View 의 Presentation Layer 책임이며
   Projection 에 싣지 않는다.
7. World 단독 테스트를 작성한다 (`Before → Input → Rule → After`).

```text
Action Request
    ↓
World Rule
    ↓
Authoritative State Transition
    ↓
Observer Projection
    ↓
GameView Specification
```

구조 기준:

```text
world/
    kernel/       Cycle Module 계약 — Delta 선언 단위
    cycles/       Cycle 별 Module (setup·actions·laws·project 배선) + 등록부
    semantic/     State 정의 (공유 — Cycle 이 함께 발전시킨다)
    rules/        World Rule
    simulation/   시간 진행 / 자동 법칙
    projection/   Observer Projection 기여분 (Cycle 별 — semantic 만 투영)
    index.ts      커널 — 모듈 조립·dispatch·tick·projection 파이프라인
```

### Cycle Module — World 는 Cycle 별로 모듈화된다

각 Cycle 의 Delta(초기 세팅·Action 핸들러·시간 법칙·Projection 기여분)는
`world/cycles/<cycle-id>.ts` 의 **CycleModule 하나**로 배선하고 등록부
(`world/cycles/index.ts`) 끝에 추가한다. 등록 순서가 곧 게임의 역사다.

```text
createWorld()                          전체 조립 = 최신 게임
createWorld({ upToCycle: 'C012-…' })   그 Cycle 까지만 조립 = 그 시점의 게임 재생
```

별도 World 를 만드는 것이 아니다 — 모든 모듈은 하나의 공유 WorldState 위에
Delta 를 쌓는다. 기존 Semantic 을 바꾸는 Cycle 은 공유 코드(semantic/rules)를
발전시키되, 그 배선은 자기 Module 에 둔다.

## Output

- `world/` 실제 코드
- `cycles/<CycleId>/06-world-implementation.md`

항목: `IMPLEMENTED` · `REUSED` · `AFFECTED UPDATED` · `PROJECTION` · `TESTS` · `NOTES`

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- 이번 Cycle 의 Delta 는 CycleModule 로 배선하고 등록부에 추가한다 —
  `createWorld({ upToCycle })` 재생이 항상 가능해야 한다.
- 모든 의미 있는 상태 변화는 World Rule 을 통해서만 발생한다.
- Rule 구현에는 Intent ID 를 주석/메타로 남긴다 (Traceability).
- World 는 View 없이 테스트 가능해야 한다.
- 코드는 `03-world-semantic.md` 의 이름과 의미를 그대로 따른다.

## Must Not

- View 를 구현하지 않는다.
- `view/` 를 import 하지 않는다 — World 와 View 가 공유하는 것은 `protocol/` 뿐이다.
- Semantic 에 없는 State 나 Rule 을 임의로 추가하지 않는다.
- 이유 없는 직접 상태 변경(`stone++`)을 만들지 않는다.
- 이번 Cycle 과 무관한 기존 코드를 의미까지 바꾸는 리팩터링을 하지 않는다.

## Done When

- 03-world-semantic.md 의 ADDED / CHANGED 가 모두 코드에 존재한다.
- AFFECTED 로 표시된 기존 Rule 이 새 의미와 정합한다.
- World 단독 테스트가 통과한다.
- Projection 결과가 `04-gameview.spec.yaml` 의 계약을 만족한다.

## Gap

Semantic 이 부족해 구현할 수 없으면 임의로 결정하지 않고 반환한다.

```text
WORLD SEMANTIC GAP
Required   Item 마다 차지하는 공간 크기
Missing    Item.Size
Return To  World Semantic
```
