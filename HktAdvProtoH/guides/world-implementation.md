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

구조 기준 — 이번 Cycle 의 구현은 **자기 모듈 디렉터리 안에서** 끝난다.

```text
world/kernel/                       합성 기반 — 손대지 않는다 (게임 규칙을 모른다)
world/cycles/<CycleId>-<name>/
    index.ts      CycleModule — seed · rules · laws · project 등록
    semantic/     이 Cycle 이 도입한 State 조각 (커널 WorldState 에 선언 병합)
    rules/        World Rule
    simulation/   시간 진행 / 자동 법칙
    projection/   Observer Projection 에서 이 Cycle 이 채우는 몫
world/registry.ts                   진행 순서 목록 — 이번 Cycle 모듈을 맨 뒤에 추가한다
```

기존 것을 재사용할 때는 앞 Cycle 모듈에서 import 한다 (의존은 과거 방향으로만).

## Output

- `world/` 실제 코드
- `cycles/<CycleId>/06-world-implementation.md`

항목: `IMPLEMENTED` · `REUSED` · `AFFECTED UPDATED` · `PROJECTION` · `TESTS` · `NOTES`

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- 모든 의미 있는 상태 변화는 World Rule 을 통해서만 발생한다.
- Rule 구현에는 Intent ID 를 주석/메타로 남긴다 (Traceability).
- 이번 Cycle 의 구현은 `world/cycles/<CycleId>-<name>/` 안에 두고 `world/registry.ts` 맨 뒤에 등록한다 —
  등록되지 않은 모듈은 합성되지 않으므로 게임에 존재하지 않는다.
- CHANGED Rule 은 과거 Cycle 파일을 고쳐서가 아니라, **이번 모듈에서 같은 `actionType` / `lawId` 로
  다시 등록해서** 바꾼다. 그래야 `./run.sh <과거 CycleId>` 가 그 시점의 게임을 그대로 재현한다.
- Snapshot 에 필드를 더할 때는 optional 로 더한다 — 과거 Scope 에는 그 필드가 없다.
- World 는 View 없이 테스트 가능해야 한다.
- 코드는 `03-world-semantic.md` 의 이름과 의미를 그대로 따른다.

## Must Not

- View 를 구현하지 않는다.
- `view/` 를 import 하지 않는다 — World 와 View 가 공유하는 것은 `protocol/` 뿐이다.
- Semantic 에 없는 State 나 Rule 을 임의로 추가하지 않는다.
- 이유 없는 직접 상태 변경(`stone++`)을 만들지 않는다.
- 이번 Cycle 과 무관한 기존 코드를 의미까지 바꾸는 리팩터링을 하지 않는다.
- **과거 Cycle 모듈 디렉터리를 수정하지 않는다** — 바꿔야 할 의미는 이번 모듈의 재등록(CHANGED)으로 표현한다.
- `world/kernel/` 에 게임 규칙을 넣지 않는다 — 커널은 어떤 Cycle 도 알지 못한다.

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
