# World Implementation Stage Guide

## Role

`03-world-semantic.md` 를 기준으로 Authoritative World 를 실제로 구현한다.

## Input

- `cycles/<CycleId>/03-world-semantic.md`
- 관련 기존 World 구현 (`world/`)
- `protocol/` 경계 타입
- `engine/world-kernel/content.ts` — 팩이 세계를 등록하는 계약 (읽기 전용)

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
    semantic/   State 정의 — 팩 State · 상수 · 카탈로그
    rules/      World Rule — 한 번의 판정과 상태 전이 (Precondition → Transition → Result)
    simulation/ Tick 마다 도는 자동 법칙 — 시간 진행 · 물리 보정 · 자율 결정
    projection/ Observer Projection → GameView Specification
    actions/    Interaction Registry — Action Request 수용 (검증 → 주체 해석 → rules 호출)
    index.ts    조립 — 초기 배치 + interaction 목록 + 시스템 순서 배열 + 투영을 등록한다
```

World 가 상태를 바꾸는 원천은 둘이고, 폴더가 그 둘을 가른다.

```text
밖에서 온 요청   actions/     요청 1회마다   → rules/ 를 부른다
안에서 도는 시계 simulation/  Tick 마다 dt 로 → rules/ 를 부른다
```

`rules/` 는 둘이 공유하는 판정의 본체다. 자율 존재도 요청 경로가 아니라
`simulation/npc-decide` 를 지나 **같은 `rules/`** 를 부른다 — 조종 여부가 규칙을 가르지 않는다.

세계의 껍데기는 팩의 것이 아니다. 요청 큐 · 참여/이탈/표식의 인과 · Tick 프레임 ·
요청 회신은 `engine/world-kernel/` 이 소유하고, 팩은 `WorldContent` 계약으로
**무엇이 있는 세계인지**만 등록한다 (`index.ts`). 밀어내기 · 관성 · 추적 이동 · 호 스윕
접촉은 `engine/physics/` 솔버를 조합해 쓰고 재구현하지 않는다 — 팩이 소유하는 것은
상수와 대상 선택과 접촉의 **의미**다. 경계의 단일 출처는
[design/Design-System-Content-Separation.md](../design/Design-System-Content-Separation.md).

## Output

- `world/` 실제 코드
- `cycles/<CycleId>/06-world-implementation.md`

항목: `IMPLEMENTED` · `REUSED` · `AFFECTED UPDATED` · `PROJECTION` · `TESTS` · `NOTES`

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- 모든 의미 있는 상태 변화는 World Rule 을 통해서만 발생한다.
- CharacterKind 가 정하는 정적 값(몸·자원·템포·사거리·인지·기본 방향)은
  `world/semantic/character-catalog.ts` 의 항목으로만 추가·변경한다 — Rule 코드에
  kind 별 분기·상수를 두지 않고, Actor 생성은 `semantic/spawn.ts` 를 거친다.
  미등록 종류도 `DEFAULT_CHARACTER` 로 스폰된다 — 기본값 폴백을 깨지 않는다.
  현재 등록 전체는 `npm run catalog` 로 관찰한다.
- Tick 진행 순서는 `index.ts` 의 **한 배열**이 소유한다 — 시스템 파일에 우선순위를 흩지 않는다.
- Rule 구현에는 Intent ID 를 주석/메타로 남긴다 (Traceability).
- World 는 View 없이 테스트 가능해야 한다.
- 코드는 `03-world-semantic.md` 의 이름과 의미를 그대로 따른다.

## Must Not

- View 를 구현하지 않는다.
- `view/` 를 import 하지 않는다 — World 와 View 가 공유하는 것은 `protocol/` 뿐이다.
- Semantic 에 없는 State 나 Rule 을 임의로 추가하지 않는다.
- 이유 없는 직접 상태 변경(`stone++`)을 만들지 않는다.
- `engine/` 을 편집하지 않는다 — 기반이 부족하면 그 사유를 적고 기반 트랙으로 반환한다.
- `actions/` 에서 상태를 직접 바꾸지 않는다 — 수용층은 검증하고 `rules/` 를 부를 뿐이다.
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
