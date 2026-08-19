# Design — 팩 내부 구성: Base + 도메인 모듈

status: PROPOSAL — Human 승인 대기 (승인 시 M1 부터 기반 트랙으로 실행)

## 목적

컨텐츠 팩 내부 구현을 **base(세계 골격) + 도메인 모듈(기능 영역)의 조합**으로 재구성한다.
Cycle 하나가 주로 한 도메인 폴더를 열게 하여(지역성), Agent 공정의 컨텍스트를 줄이고,
도메인 단위 재활용의 길을 연다.

전제가 되는 결정 — **모듈의 축은 시간(Cycle)이 아니라 공간(도메인)이다.**
실측: C013 하나가 새 파일 2개를 만들고 기존 파일 11개(C002·C004·C007·C010·C012 의 것)를
고쳤다. 이 게임의 Cycle 은 본질이 CHANGED 라서 Cycle 을 모듈 경계로 삼으면 매 Cycle 이
경계를 부수거나 override 층을 쌓게 된다 (CLAUDE.md 원칙 6 "Cycle 은 기능 Module 이 아니라
Game Delta" 와 일치). 시간축 기록은 `cycles/` Artifact 와 git 이 소유한다.

## 모듈의 형태 — 강한 모듈이 아니라 부드러운 모듈

이 세계의 구조적 사실 셋이 모듈의 형태를 정한다. 셋 다 금지가 아니라 **형태 결정**이다.

```text
사실 1  Tick 순서는 결정론상 한 곳에 적혀야 한다
        → 모듈은 자기 순서를 소유하지 않는다. 이름 붙은 시스템 부품을 내놓고,
          순서는 조립(index)의 단일 배열이 소유한다 — WorldContent 와 같은 구도다.

사실 2  Actor 는 하나의 몸이다 (hp·위치·소지품이 한 존재에 산다)
        → 모듈은 자기 State 타입을 소유하지 않는다. State 는 base 가 한 벌로 소유하되
          필드마다 소유 도메인을 표기하고, 그 필드를 *바꾸는 함수* 는 소유 도메인에만 둔다.
          (ECS 재작성 없이 소유권만 세운다 — 읽기는 자유, 쓰기는 소유 도메인의 함수로.)

사실 3  관찰(04 spec)은 전체가 하나의 계약이다
        → 모듈은 자기 Snapshot 을 만들지 않는다. base 의 투영 조립기가 정해진 순서로
          도메인 기여 함수를 불러 하나의 Snapshot 을 만든다. 계약은 그대로다 —
          구현만 조합이 된다.

한 줄 요약   모듈은 부품(interaction·시스템·투영 기여·표 항목)을 내놓는 파츠 상자다.
             순서·State 한 벌·계약 전체는 base/조립이 소유한다.
```

또 하나의 성질: **도메인 경계는 팩 경계와 달리 부드럽다.** 팩 간에는 import 금지
(boundary 규칙 2)지만, 도메인 간에는 읽기 import 를 허용한다 — C013 처럼 한 Cycle 이
여러 도메인의 의미를 함께 바꾸는 일은 이 게임의 정상 동작이며, 막으면 안 된다.
경계의 뜻은 격리가 아니라 **소유 표시**다: 어디를 열면 그 의미가 있는지, 누가 그 필드를
바꾸는지.

## 도메인 지도 (proto-adventure 기준)

```text
world/
  base/                          ← 어느 도메인도 없이 성립하는 세계 골격
    actor.ts                     Actor 한 벌 — 필드 구획 주석: [base][movement][combat][mining]
    world-state.ts               WorldState·경계·스폰 지점·TICK_INTERVAL
    character-catalog.ts         종류 정적 데이터 한 벌 — 필드 구획은 actor 와 같은 규칙
    action.ts                    행동 상태 기계 (Kind 목록·Duration 표 — 항목마다 도메인 표기)
    action-begin.ts              행동 시작 관문
    observer-body.ts             관찰자 몸 생성
    physics-constants.ts         밀어내기·마찰 상수 (engine/physics 솔버의 이 세계 값)
    projection.ts                투영 조립기 — 아래 도메인 기여를 정해진 순서로 합친다
  domains/
    movement/                    move · move-mode · 이동 진행 · 달리기
    mining/                      deposit · inventory · item · mine · 채굴 완료
    combat/                      스킬 · 휘두름 · 피해 공식 · 막기 · 관통 · 타격 이벤트
    autonomy/                    자율 결정 (인지 → 접근 → 휘두름 · 순회)
    debug/                       속성 변경 · 명령 카탈로그 · DebugAuthority
  index.ts                       조립 — State 초기화 + 배열 세 개 (아래)
```

기존 파일의 행선지 (전부 git mv + 경로 보정, 의미 무변경):

| 현재 | 행선지 |
|---|---|
| semantic/actor·world-state·spawn·position | base/ |
| semantic/action + rules/action-begin | base/ (행동 기계) |
| semantic/character-catalog | base/ (kind 3원소 규율 유지 — catalog 도구 경로 갱신) |
| semantic/collision 의 PUSH·FRICTION | base/physics-constants |
| semantic/collision 의 SWING_* · 칼끝 | domains/combat/ |
| rules/move·move-mode + simulation/move-progress | domains/movement/ |
| simulation/body-push·body-momentum | base/ (물리 — 모든 몸의 성질) |
| semantic/deposit·inventory·item + rules/mine | domains/mining/ |
| rules/skill·attack·guard·damage-calculate·strike-damage + semantic/combat + simulation/swing-strike·strike-event-expire·cp-run-drain | domains/combat/ |
| simulation/npc-decide | domains/autonomy/ |
| rules/attribute-set + semantic/command-catalog | domains/debug/ |
| actions/interactions.ts | 해체 — 각 도메인이 자기 항목을 내놓고 index 가 잇는다 |
| projection/observer-view.ts | 해체 — base/projection 조립기 + 도메인 기여 함수 |

## 도메인 모듈 규약 (팩 내부 — 엔진에 올리지 않는다)

승격 규칙(rule of two)에 따라 이 규약은 **팩 내부 convention** 으로 시작한다.
두 번째 팩이 같은 규약을 원할 때 엔진 계약으로 승격을 검토한다.

```ts
// content/<pack>/world/domain.ts — 팩 내부 규약
export interface WorldDomain {
  /** 이 도메인의 interaction 항목들 — index 가 도메인 순서대로 잇는다 */
  interactions: readonly InteractionHandler<WorldState>[];
  /** 이름 붙은 시스템 부품 — 순서는 index 의 배열이 소유한다 (사실 1) */
  systems: Readonly<Record<string, WorldSystem<WorldState>>>;
  /** 투영 기여 (사실 3) — base/projection 조립기가 정해진 순서로 부른다 */
  projection?: {
    /** Actor 관찰에 자기 도메인 필드를 더한다 (예: combat → vitality·combatStats) */
    decorateActor?(view: EntityView, actor: ActorState, ctx: ProjectionContext): void;
    /** 자기 도메인의 비-Actor 존재 (예: mining → 광맥) */
    entities?(state: WorldState, ctx: ProjectionContext): EntityView[];
    /** 가용성 목록 기여 (예: combat → 스킬 3종 + 막기) */
    interactions?(state: WorldState, ctx: ProjectionContext): InteractionView[];
    /** HUD 기여 (예: mining → inventory.stone) */
    hud?(state: WorldState, ctx: ProjectionContext): HudItemView[];
  };
}
// ProjectionContext = { observerId, self } — 조립기가 만들어 넘긴다
```

index.ts 조립 — 순서 소유는 지금과 완전히 같다. 부품의 출처만 도메인이 된다:

```ts
const DOMAINS = [movement, mining, combat, autonomy, debug];  // 투영·interaction 기여 순서

const content: WorldContent<WorldState> = {
  interactions: DOMAINS.flatMap((d) => d.interactions),
  systems: [                       // ← 결정론의 단일 출처, 지금 그대로 (사실 1)
    autonomy.systems.decide,
    movement.systems.progress,
    base.systems.actionProgress,
    combat.systems.swingStrike,
    base.systems.bodyPush,
    base.systems.bodyMomentum,
    combat.systems.cpRunDrain,
  ],
  postTimeSystems: [combat.systems.strikeEventExpire],
  projectObserver: composeProjection(DOMAINS),   // base/projection 조립기
  ...
};
```

소유권 규칙 (soft rule — 리뷰 기준이지 컴파일 장벽이 아니다):

```text
읽기   어느 도메인이든 State 전체를 읽을 수 있다 (combat 이 이동 모드를 읽는다 — 정상)
쓰기   도메인 필드는 소유 도메인의 함수를 통해서만 바꾼다
       (다른 도메인이 hp 를 깎고 싶으면 combat 의 함수를 부른다)
표기   actor.ts · character-catalog.ts · action.ts 의 항목마다 [도메인] 구획 주석
```

## View 는 2단계로

View 표(role/kind/interaction/hud)는 이미 **항목 단위 데이터**라 지역성 문제가 작다 —
1단계에서는 표를 그대로 두고 항목에 도메인 주석만 단다. `combat-presentation.ts` 는
이름이 이미 소속을 말하므로 그대로다. 도메인별 view 폴더는 표가 실제로 커져서
항목 충돌·검색 비용이 생길 때(2단계) 같은 파츠 상자 형태로 나눈다.

## 공정 정합

- **Cycle Stage 6 첫 판정에 한 줄 추가**: "이 Delta 의 주 도메인은 무엇인가 —
  기존 도메인 확장인가, 새 도메인 신설인가." 새 도메인 신설 = 폴더 하나 + DOMAINS 등록.
- **CHANGED 는 여전히 자유다**: C013 처럼 여러 도메인을 함께 바꾸는 Cycle 은 정상이며,
  03-world-semantic 의 REUSED/ADDED/CHANGED/AFFECTED 가 그 기록을 계속 소유한다.
  도메인은 "어디를 열면 되는가" 를 줄여줄 뿐 "어디를 바꿔도 되는가" 를 제한하지 않는다.
- **Agent 컨텍스트 경제**: Stage 6/7 Agent 는 base/ + 해당 도메인 폴더만 로드하는 것을
  기본으로 한다 (guides/world-implementation.md 에 명기). 이것이 이 재편의 주 이득이다.

## 검증 계획과 효율 계측

```text
M1  폴더 재편 (git mv + 경로 보정)                DONE WHEN 테스트 556 무수정 녹색
M2  투영 조립기 (observer-view 해체 → 기여 함수)    DONE WHEN Snapshot 출력 필드 단위 동일
M3  interactions/systems 도메인 export + 조합       DONE WHEN 판정 순서·결과 동일
M4  guides/스킬에 도메인 판정·로드 규칙 반영          DONE WHEN 다음 Cycle 이 규칙대로 돈다
```

- blank 팩은 base 만으로 성립하므로 무영향이어야 한다 (사실상 blank = base 의 최소형).
- 효율은 주장하지 않고 **잰다**: 재편 후 첫 Cycle 에서 "연 파일 수 / 주 도메인 밖 파일 수 /
  Stage 6 로드 토큰"을 이전 Cycle(C013) 실측과 비교해 08-verification 에 기록한다.

## 하지 않는 것

- Cycle 을 모듈로 만들지 않는다 (위 전제 — 실측 근거 포함).
- 도메인 간 import 를 boundary:check 로 막지 않는다 (부드러운 경계).
- ActorState 를 도메인별 중첩 구조(`actor.combat.hp`)로 바꾸지 않는다 — 기존 테스트
  556·픽스처 13벌 전면 churn 대비 이득이 없다. 소유는 구획 주석 + 쓰기 함수 소속으로 세운다.
- WorldDomain 규약을 엔진에 올리지 않는다 — 두 번째 팩이 원할 때 승격 검토 (rule of two).
