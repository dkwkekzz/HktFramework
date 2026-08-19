# World Implementation Stage Guide

## Role

`03-world-semantic.md` 를 기준으로 Authoritative World 를 실제로 구현한다.

## Input

- `cycles/<CycleId>/03-world-semantic.md`
- 관련 기존 World 구현 (`world/`)
- `protocol/` 경계 타입

## Do

0. **주 도메인을 먼저 판정한다** — 이 Delta 는 기존 도메인의 확장인가, 새 도메인의 신설인가.
   판정 결과가 이 Stage 에서 여는 폴더를 정한다 (아래 `Domain` 절).
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

구조 기준 — 팩 내부는 **base(세계 골격) + 도메인 모듈(기능 영역)** 의 조합이다
(`design/Design-Pack-Domain-Modules.md`).

```text
world/
    domain.ts     WorldDomain 규약 (팩 내부 convention)
    base/         어느 도메인도 없이 성립하는 세계 골격
                    actor · world-state · character-catalog · position   State 한 벌
                    action · action-begin · action-progress              행동 상태 기계
                    physics-constants · body-push · body-momentum        몸의 물리
                    observer-body · interaction · projection             참여 · 수용 · 투영 조립기
    domains/      기능 영역 — 폴더 하나가 Cycle 하나가 주로 여는 자리다
                    movement/  이동 · 이동 모드 · 이동 진행
                    mining/    광맥 · 소지품 · 물건 · 채굴
                    combat/    스킬 · 휘두름 · 피해 공식 · 막기 · 관통 · 타격 이벤트
                    autonomy/  자율 결정 (인지 → 접근 → 휘두름 · 순회)
                    debug/     속성 변경 · 명령 카탈로그 · DebugAuthority
    index.ts      조립 — State 초기화 + 배열 셋 (DOMAINS · SYSTEMS · POST_TIME_SYSTEMS)
    tests/        World 단독 테스트
```

## Domain

**Agent 컨텍스트 경제** — 이 Stage 는 `base/` + **주 도메인 폴더**만 로드하는 것을 기본으로 한다.
다른 도메인은 실제로 그 의미를 함께 바꿀 때만 연다. 이것이 이 구조의 주 이득이다.

도메인 하나는 **부품을 내놓는 파츠 상자**다. 순서·State 한 벌·계약 전체는 base/조립이 소유한다.

```text
사실 1  Tick 순서는 결정론상 한 곳에 적혀야 한다
        → 도메인은 이름 붙은 시스템만 내놓는다. 순서는 world/index.ts 의 SYSTEMS 배열이 소유한다.
사실 2  Actor 는 하나의 몸이다
        → 도메인은 자기 State 타입을 소유하지 않는다. State 는 base/actor.ts 가 한 벌로
          소유하고 필드마다 [도메인] 을 표기한다. 그 필드를 *바꾸는 함수* 만 소유 도메인에 둔다.
사실 3  관찰(04 spec)은 전체가 하나의 계약이다
        → 도메인은 자기 Snapshot 을 만들지 않는다. base/projection.ts 의 조립기가
          DOMAINS 순서로 기여 함수를 불러 하나의 Snapshot 을 만든다.
```

도메인이 내놓는 부품은 넷이다 (`world/domain.ts`).

```text
interactions        몸이 세계 안에서 하는 일 — 조립이 DOMAINS 순서로 잇는다
systems             이름 붙은 Tick 부품 — 순서는 조립의 SYSTEMS 배열이 정한다
actionCompletions   자기 행동이 Duration 을 채웠을 때 하는 일 (표 항목)
projection          decorateActor · entities · interactions · hud · snapshotFields
```

소유권 규칙 (리뷰 기준이지 컴파일 장벽이 아니다 — `boundary:check` 는 도메인 간을 막지 않는다):

```text
읽기   어느 도메인이든 State 전체를 읽을 수 있다 (combat 이 이동 모드를 읽는다 — 정상)
쓰기   도메인 필드는 소유 도메인의 함수를 통해서만 바꾼다
       (다른 도메인이 hp 를 깎고 싶으면 combat 의 함수를 부른다)
표기   base/actor.ts · base/character-catalog.ts · base/action.ts 의 항목마다 [도메인] 구획 주석
```

새 도메인 신설 = `domains/<이름>/` 폴더 하나 + `world/index.ts` 의 `DOMAINS` 배열에 항목 하나.
CHANGED 는 여전히 자유다 — 한 Cycle 이 여러 도메인의 의미를 함께 바꾸는 것은 이 게임의
정상 동작이며, 그 기록은 `03-world-semantic.md` 의 REUSED/ADDED/CHANGED/AFFECTED 가 소유한다.
도메인은 "어디를 열면 되는가" 를 줄여줄 뿐 "어디를 바꿔도 되는가" 를 제한하지 않는다.

## Output

- `world/` 실제 코드
- `cycles/<CycleId>/06-world-implementation.md`

항목: `IMPLEMENTED` · `REUSED` · `AFFECTED UPDATED` · `PROJECTION` · `TESTS` · `NOTES`

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- 모든 의미 있는 상태 변화는 World Rule 을 통해서만 발생한다.
- CharacterKind 가 정하는 정적 값(몸·자원·템포·사거리·인지·기본 방향)은
  `world/base/character-catalog.ts` 의 항목으로만 추가·변경한다 — Rule 코드에
  kind 별 분기·상수를 두지 않고, Actor 생성은 `world/base/spawn.ts` 를 거친다.
  미등록 종류도 `DEFAULT_CHARACTER` 로 스폰된다 — 기본값 폴백을 깨지 않는다.
  현재 등록 전체는 `npm run catalog` 로 관찰한다.
- Rule 구현에는 Intent ID 를 주석/메타로 남긴다 (Traceability).
- World 는 View 없이 테스트 가능해야 한다.
- 코드는 `03-world-semantic.md` 의 이름과 의미를 그대로 따른다.
- 새 interaction · 시스템 · 투영 기여는 **소유 도메인의 `index.ts`** 가 내놓고,
  Tick 순서와 도메인 순서는 `world/index.ts` 의 배열에만 적는다.

## Must Not

- View 를 구현하지 않는다.
- `view/` 를 import 하지 않는다 — World 와 View 가 공유하는 것은 `protocol/` 뿐이다.
- Semantic 에 없는 State 나 Rule 을 임의로 추가하지 않는다.
- 이유 없는 직접 상태 변경(`stone++`)을 만들지 않는다.
- 이번 Cycle 과 무관한 기존 코드를 의미까지 바꾸는 리팩터링을 하지 않는다.
- 도메인 안에 Tick 순서(우선순위 숫자·자체 실행)를 두지 않는다 — 결정론의 단일 출처를 깬다.
- 도메인이 자기 Snapshot 을 따로 만들지 않는다 — 계약은 04 spec 하나다.
- ActorState 를 도메인별 중첩 구조(`actor.combat.hp`)로 바꾸지 않는다.

## Done When

- 03-world-semantic.md 의 ADDED / CHANGED 가 모두 코드에 존재한다.
- AFFECTED 로 표시된 기존 Rule 이 새 의미와 정합한다.
- World 단독 테스트가 통과한다.
- Projection 결과가 `04-gameview.spec.yaml` 의 계약을 만족한다.
- 06-world-implementation.md 가 이 Delta 의 **주 도메인**과 그 판정(확장 / 신설)을 밝힌다.

## Gap

Semantic 이 부족해 구현할 수 없으면 임의로 결정하지 않고 반환한다.

```text
WORLD SEMANTIC GAP
Required   Item 마다 차지하는 공간 크기
Missing    Item.Size
Return To  World Semantic
```
