# Design — 기반 시스템 / 컨텐츠 완전 분리

status: PROPOSAL — Human 승인 대기

## 목적

다른 Master Graph Root 를 제시하면, **기반은 한 줄도 바꾸지 않고** 컨텐츠만 확장하거나
완전히 교체할 수 있어야 한다. 지금은 기반(Engine)과 컨텐츠(게임 의미)가 같은 디렉터리와
같은 파일 안에 섞여 있어, Root 를 갈아 끼우는 순간 world/·view/·protocol/ 전반을 손대야 한다.

분리 기준은 하나다.

```text
기반(Engine)    Root 가 바뀌어도 참인 것 — 시계·관찰자·요청 경로·투영 프레임·그리기 장치
컨텐츠(Content) Root 에서 파생되는 것 — Rule·능력치·종류·표현 결정·모션·Master Graph·Cycle
```

## 현재 구조 진단

### 이미 잘 되어 있는 것 (분리의 씨앗)

이 프로젝트는 이미 "항목 하나 추가" 패턴을 곳곳에 갖고 있다. 데이터 표는 존재한다 —
없는 것은 그 표들의 **물리적 자리**와, 표를 소비하는 쪽의 **등록 역전**뿐이다.

| 씨앗 | 위치 |
|---|---|
| CharacterKind 카탈로그 (시뮬레이션 정적 데이터) | `world/semantic/character-catalog.ts` |
| ActionKind / SkillDefinition 표 | `world/semantic/action.ts` · `combat.ts` |
| Command Catalog (구조 불변, 항목만 추가) | `world/semantic/command-catalog.ts` |
| Role / Kind / Interaction / Hud Presentation 표 | `view/presentation/*-presentation.ts` |
| Snapshot 봉투 (entities/interactions/hud/commands — 구조 불변 선언) | `protocol/gameview.ts` |
| kind 정적 데이터 3원소 규율 + `npm run catalog` 정합 검사 | CLAUDE.md · `tools/catalog` |

### 섞여 있는 지점 (교체를 막는 결합)

| # | 지점 | 증상 |
|---|---|---|
| 1 | `world/actions/dispatch.ts` | interactionId switch 에 컨텐츠 분기가 직접 나열된다 — mine·guard·skill-aura… 파일 머리말부터 "Cycle 이 늘면 분기가 늘어난다" |
| 2 | `world/simulation/world-tick.ts` | Tick 파이프라인(npc-decide → move → action → swing → push → momentum → cp-drain → expire)이 컨텐츠 Rule 을 이름으로 직접 부른다 |
| 3 | `world/semantic/world-state.ts` · `actor.ts` | WorldState 봉투에 deposits·strikeEvents, Actor 에 hp·cp·combat 여섯 값·guarding 등 컨텐츠 필드가 박혀 있다 |
| 4 | `world/projection/observer-view.ts` | 390줄 단일 함수가 투영 프레임(관찰자 해석·엔티티 순회)과 컨텐츠(attributes 블록·interaction 7종 나열·HUD 30여 항목·`scene: 'mining-field'`)를 한 몸으로 갖는다 |
| 5 | `world/index.ts` | DEFAULT_NPCS·돌 광맥·spawn 배치 등 시나리오 조립이 Engine 진입점에 하드코딩 |
| 6 | `protocol/gameview.ts` | 봉투(불변)와 컨텐츠 타입(AttributesView.combatStats·guard·DamageBreakdownView·StrikeEventView)이 한 파일 — Root 가 바뀌면 "봉투"까지 수정하게 된다 |
| 7 | `protocol/actions.ts` | ActionRequest 에 `mode: 'walk'|'run'`·`attribute` 등 컨텐츠 파라미터가 직접 필드로 있다 |
| 8 | `view/presentation/resolve.ts` | 결정 프레임이 combat-presentation(컨텐츠)을 직접 import — "Cycle 이 늘어도 수정되지 않는다"는 선언과 달리 컨텐츠 교체 시 수정 대상 |
| 9 | `app/main.ts` | GUARD_KEY·MOVE_MODE_KEYS·'move-mode' 반대값 로직 등 컨텐츠 입력 규칙이 조립 루트에 하드코딩 |
| 10 | `master/` · `cycles/` · `motions/` · fixtures | 전부 Root 파생물(컨텐츠)인데 프로젝트 최상위에 있어, 다른 Root 와 공존·교체가 불가능 |

문서/공정 층은 이미 대체로 분리되어 있다 — CLAUDE.md·guides/·design/·advprotoh-* 스킬은
Root 를 모르는 **공정(기반)** 이고, master/·cycles/ 만이 Root 파생 **컨텐츠**다.
단, guides/스킬이 `world/` `view/` `master/` 고정 경로를 참조하므로 이사 시 함께 갱신해야 한다.

## 목표 구조

```text
HktAdvProtoH/
  engine/                      ← 기반. Root 가 바뀌어도 불변. content/ 를 import 하지 않는다
    world-kernel/              시계·참여/이탈/표식·요청 큐·request-reply·Tick 프레임·투영 호출
    protocol-core/             Snapshot 봉투 · ActionRequest 코어 · transport · semantic-id
    view-kernel/               renderer·hud 프레임·input 장치·net·motion 재생기·command console·결정 프레임(resolve)
    server-kernel/             world-host · attach (현재 코드가 이미 거의 순수하다)

  content/<packId>/            ← 컨텐츠 팩 = 교체 단위. 예: content/proto-adventure/
    manifest.ts                팩 등록 루트 — 아래 전부를 engine 에 등록하는 유일한 문
    world/                     rules · semantic(팩 State 타입 포함) · simulation systems · projection · 카탈로그
    protocol/                  팩 전용 GameView 확장 타입 (팩의 world 와 view 가 공유)
    view/                      presentation 표 · 전투 표현 · 키 바인딩 · 문구(code-text)
    motions/                   그림
    master/                    Master Graph — root.md 가 곧 팩의 정체성
    cycles/                    그 팩의 Cycle History
    fixtures/                  view 검증 fixture

  app/ · server/               ← 조립. "어느 팩을 띄우는가" 만 정한다 (active pack 포인터)
  guides/ · design/ · tools/   ← 공정(기반). 팩을 경로 변수로만 안다
```

**다른 Root 로 작업한다** = `content/<newPack>/master/root.md` 를 새로 쓰고 그 팩에서
Master → Cycle 공정을 도는 것이다. 기존 팩은 그대로 남는다 — 확장이면 기존 팩에
Cycle 을 계속 쌓고, 교체면 새 팩을 만든다.

## 다섯 가지 반전 (결합 → 등록)

진단 표의 결합 지점을 닫는 메커니즘. 모두 "Engine 이 컨텐츠를 부른다"를
"컨텐츠가 자신을 등록한다"로 뒤집는다.

### ① Interaction Registry — dispatch switch 제거

```ts
// content 쪽 — manifest 가 등록
interactions: [
  { id: 'mine', handle: (state, actor, action) => ruleMine(state, actor, action.targetEntityId) },
  ...
]
// engine 쪽 — 모르는 id 는 unknown-interaction 거절만 담당
```

파라미터 검증(missing-target 등)은 각 핸들러 안으로 들어간다 — 지금도 의미상 그 Rule 의 것이다.

### ② Tick Pipeline — 명시적 순서 배열

컨텐츠 manifest 가 시스템을 **하나의 배열**로 선언한다 (우선순위 숫자 분산 금지 —
결정론은 한 곳에 적힌 순서가 지킨다).

```ts
systems: [ruleNpcDecideAll, ruleMoveProgress, ruleActionProgress, ruleSwingStrike,
          ruleBodyPush, ruleBodyMomentum, ruleCpRunDrain]        // dt 이전
postTime: [ruleStrikeEventExpire]                                 // time += dt 이후
```

Engine 프레임은 불변 순서만 소유한다: 관찰자 이벤트 → 요청 판정(①) → systems →
time += dt → postTime → 투영(④). "참여가 요청보다 앞서는" 인과 규칙은 Engine 의 것이다.

### ③ WorldState 제네릭 — Engine 은 코어 형태만 요구

ECS 재작성이 아니다. Engine 을 State 타입에 대해 제네릭으로 만들고,
구조적 최소 요건만 건다.

```ts
interface CoreWorldState { time: number; observers: ObserverState[]; }
function createWorldKernel<S extends CoreWorldState>(content: ContentPack<S>): World
```

deposits·strikeEvents·Actor 의 combat 필드는 팩의 `world/semantic/` 이 소유한 팩 State
타입에 남는다 — 지금의 타입 안전성과 결정론(헤더 상수 고정)을 그대로 유지한다.
관찰자의 몸을 만드는 `ruleObserverJoin`(Actor 생성 = 컨텐츠)은 팩이 `spawnObserverBody`
훅으로 제공하고, join/leave/mark 의 판정 시점·인과는 Engine 이 소유한다.

### ④ 투영과 Protocol — 봉투는 Engine, 내용은 팩

- `protocol-core`: `GameViewSnapshot` 봉투(specId·scene·observer·entities·interactions·
  hud·commands·outcomes)와 `EntityView` 코어(id·role·state·position·kind·progress…),
  `ActionRequest` 코어(interactionId·targetEntityId·position·mark·`params?`). 구조 불변.
- `content/<pack>/protocol/`: AttributesView·DamageBreakdownView·StrikeEventView 등
  팩 타입. `EntityView.attributes` 는 코어에서 `unknown`(팩이 좁힌다) — 팩의 world 가
  채우고 팩의 view 가 읽으므로 타입 안전은 팩 안에서 완결된다.
- `observer-view.ts` 본문은 통째로 팩의 `world/projection/` 으로 간다. Engine 은
  "매 Tick, present 관찰자마다, 모르는 이에게는 null" — 시점과 인과만 소유하고
  `content.projectObserver(state, observerId)` 를 부른다.
- `mode`·`attribute` 필드는 `params` 로 이관한다 (컨텐츠 파라미터가 코어 타입을 오염시키지 않게).

DC-WORLD-OWNS-THE-SURFACE-LIST 는 그대로 산다 — 표면 목록의 소유가 World(팩의 world)라는
원칙이지, 그 타입이 공용 봉투에 있어야 한다는 뜻이 아니다.

### ⑤ View 표현·입력 — 팩 View 모듈

- presentation 표 5종 + combat-presentation + code-text 문구 → `content/<pack>/view/`.
  `resolve.ts` 는 표를 import 하지 않고 **주입받는** 프레임으로 남아 engine 에 간다.
- `app/main.ts` 의 컨텐츠 키 로직(GUARD_KEY 토글·move-mode 반대값)은 팩이
  `keyBindings: [{ key, invoke(scene, send) }]` 로 등록한다. 조립 루트는 범용 루프만 남는다.
  콘솔 열기·시점 조작·터치 등 장치 입력은 Engine 에 남는다.

## Master 층과 공정의 분리

- `master/` `cycles/` `motions/` fixtures → 팩 안으로. **새 Root = 새 팩** 이 물리적으로 성립한다.
- active pack 포인터 하나를 둔다 — `hkt.pack.json` `{ "active": "proto-adventure" }`.
  app·server·tools(catalog·motion-atlas)·advprotoh-* 스킬·guides 의 경로가 전부 이것을 읽는다.
- 두 층 규율은 그대로다: Cycle Agent 는 자기 팩의 master/ 를 편집하지 않고,
  Master Agent 는 자기 팩의 world/·view/ 를 읽기만 한다. 여기에 한 줄이 추가된다 —
  **어떤 Agent 도 engine/ 을 컨텐츠 작업 중에 편집하지 않는다.** Engine 변경은 별도
  트랙(공정 변경과 같은 급)으로만 한다.

## 경계의 기계적 강제

선언만으로는 지켜지지 않는다 — dispatch switch 도 "구조는 안 바뀐다"는 주석과 함께 자랐다.

```text
규칙 1  engine/**  은 content/** 를 import 하지 않는다
규칙 2  content/A/** 은 content/B/** 를 import 하지 않는다 (팩 간 격리)
규칙 3  app/·server/ 조립 루트만이 active pack 을 해석한다
```

`npm run boundary:check` (import 그래프 검사 스크립트, `tools/boundary/`) 를 만들어
`npm test` 와 CI 에 묶는다. catalog:check·motions:check 와 같은 결의 정합 검사다.

## 진행 단계

이 재구조화는 플레이 Delta 가 아니므로 Cycle 공정이 아니라 **기반 트랙**으로 진행한다.
각 단계는 독립적으로 닫히며, 매 단계에서 `npm run build && npm test` 녹색을 유지한다.

| 단계 | 내용 | DONE WHEN |
|---|---|---|
| P0 경계 선언 | 이 문서 승인 + `boundary:check` 스크립트(현재 위반 목록을 보고만 한다) | Human 이 경계 지도를 승인 |
| P1 World 반전 | ①②③ + `world/` 컨텐츠를 `content/<pack>/world/` 로 이동, 시나리오 조립(NPCs·광맥) 을 팩 manifest 로 | world 테스트 전부 녹색, engine/world-kernel 이 팩 무지 |
| P2 Protocol 분리 | ④ 의 타입 분리 — protocol-core vs 팩 protocol, `params` 이관 | build 녹색, 봉투에 컨텐츠 타입 0 |
| P3 View 반전 | ⑤ — 표·바인딩을 팩으로, resolve/main 을 프레임으로 | view 테스트 전부 녹색 |
| P4 Master 이사 | master/·cycles/·motions/·fixtures → 팩, active pack 포인터, guides/스킬/CLAUDE.md 경로 갱신 | catalog·motions 도구가 팩 경로에서 동작 |
| P5 증명 | 최소 팩 `content/blank/` (종류 1·move 만·빈 master + root 템플릿) 신설 | **engine 무수정으로 blank 팩이 뜨고 움직인다** + boundary:check 위반 0 이 CI 에서 강제 |

P5 가 이 설계의 수용 기준이다 — "분리했다"의 증거는 문서가 아니라
두 번째 팩이 실제로 뜨는 것이다.

## 열린 결정 (Human)

| # | 질문 | 제안 |
|---|---|---|
| 1 | 현재 게임의 팩 이름 | `proto-adventure` (C001~C013 의 세계를 담는 이름이면 무엇이든) |
| 2 | Snapshot 컨텐츠 타입의 위치 | 팩 소유(타입 안전 유지)를 제안 — 봉투를 제네릭 가방으로 만들면 DC-WORLD-OWNS-THE-SURFACE-LIST 의 타입 검증력이 죽는다 |
| 3 | guides/스킬 경로 갱신 시점 | P4 에서 일괄 (그 전까지 기존 경로 유효) |
| 4 | `ActionRequest.params` 이관 범위 | mode·attribute 둘 다 (position·targetEntityId 는 코어 유지 — 지형/존재 지목은 Root 무관한 보편 형태) |
