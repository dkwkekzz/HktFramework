# 공통 불변 규칙 (상세)

`HktAdvProtoH/CLAUDE.md` 는 원칙과 인덱스만 담는다. 이 문서는 그 원칙들이 실제 작업에서
무엇을 뜻하는지 풀어 쓴 것으로, Cycle Stage 를 실행할 때만 로드된다.

## Development Model

이 프로젝트는 작은 플레이 가능한 게임 단위인 Cycle 을 반복하여
하나의 MMORPG World 와 View 를 계속 발전시킨다.

모든 Agent 작업은 현재 Cycle 의 일부다.

## Artifact Handoff

각 단계는 이전 단계 Artifact 를 입력으로 사용하고
자신의 결과를 다음 단계가 사용할 Artifact 로 남긴다.

```text
이전 단계 Artifact
        ↓
현재 단계 Agent 작업
        ↓
현재 단계 Artifact
        ↓
다음 단계 Agent
```

대화 History 를 Source of Truth 로 사용하지 않는다.
"아까 정한 대로" 같은 근거는 무효다 — Artifact 에 없으면 결정되지 않은 것이다.

## Follow Stage Guide

모든 Agent 는 다음을 기준으로 작업한다.

1. `CLAUDE.md`
2. 현재 Stage Guide
3. 현재 Cycle 의 입력 Artifact

전체 Design 문서는 특별히 필요한 경우에만 참조한다.

## Preserve Design Meaning

이전 단계에서 확정된 의미를 구현 편의를 위해 임의로 변경하지 않는다.

* Intent 변경이 필요하면 Intent 단계로 반환한다.
* World Semantic 변경이 필요하면 World Semantic 단계로 반환한다.
* GameView Specification 에 정보가 부족하면
  View 가 World 내부를 직접 읽지 않고 Specification 변경을 요청한다.

## Cycle Is a Game Delta

Cycle 은 현재 게임에 하나의 플레이 가능한 변화 Delta 를 추가한다.

Cycle 은:

* 새로운 Capability 를 추가할 수 있다.
* 기존 Capability 를 확장할 수 있다.
* 기존 Capability 를 고도화할 수 있다.
* 필요하면 기존 Semantic 이나 Rule 을 변경할 수 있다.

무엇이 기존이고 무엇이 변경되었는지는 Artifact 에 명확히 기록한다.

두 종류 모두 동일한 Workflow 를 쓴다.

```text
New Capability            Capability Enhancement
    Mining                    Inventory → Capacity
    Crafting                  Inventory → Stacking
    Trade                     Combat    → Blocking
```

## Shared World

각 Cycle 은 별도의 World 를 만들지 않는다.
모든 Cycle 은 동일한 공유 World 를 발전시킨다.

기존 Actor, Inventory, Item, Position 등의 Semantic 이 있다면
중복 생성하지 않고 재사용한다.

```text
잘못된 구조                      올바른 구조
    MiningWorld                     WORLD
    CraftingWorld                     ├── Mining
    CombatWorld                       ├── Crafting
    TradeWorld                        └── Combat
                                    공통: Actor · Item · Inventory · Position
```

## World / View Boundary

World 는 Authoritative Server 다.
View 는 Client 다.

World 와 View 는 서로의 내부 구현을 직접 참조하지 않는다.

World → View 의 공개 계약은 GameView Specification 이다.
View 는 GameView Specification 만으로 화면을 구성할 수 있어야 한다.

```text
world  may import  protocol
view   may import  protocol

world  MUST NOT import  view
view   MUST NOT import  world
```

`protocol/` 에는 경계 타입만 둔다 — GameViewSpecification, ActionRequest, SemanticIdentifier.
World 의 Domain Type 도, View 의 Rendering Type 도 넣지 않는다.

## World Authority

Client 는 World State 를 직접 변경하지 않는다.
Client 는 Action 을 요청한다.
World 가 World Rule 을 통해 상태 변화를 결정한다.

World State 의 의미 있는 변화는 반드시 어떤 World Rule 에 귀속되어야 한다.
이유 없는 직접 변경(`stoneCount++`)은 허용되지 않는다.

## Traceability

다음 연결은 추적 가능해야 한다.

```text
Cycle Goal
→ Goal / Possibility
→ Intent
→ World State / Rule
→ GameView Specification
→ Implementation
→ Verification
```

Intent 는 Source Goal / Possibility 를, Rule 은 자신이 구현하는 Intent ID 를 명시한다.
Runtime 전이에서 설계까지 역추적할 수 없으면 그 코드는 설계에서 유래했는지 판단할 수 없다.

## Existing Capability Changes

기존 Capability 수정은 허용된다.
단, 모든 Semantic 변경은 현재 Cycle Goal 에서 유래해야 한다.

기존 코드의 단순 리팩터링과 게임 의미의 변경을 구분한다.

Semantic 변경 시 4분류를 명시한다.

```text
REUSED     기존에서 그대로 사용하는 Semantic
ADDED      이번 Cycle 에서 새로 추가되는 Semantic
CHANGED    기존 Semantic / Rule 중 변경되는 것
AFFECTED   이번 변경으로 영향을 받는 기존 기능
```

예 — Inventory Capacity 를 추가하면 기존 획득 경로가 모두 영향을 받는다.

```text
ADDED     Inventory.Capacity · Inventory.UsedCapacity
CHANGED   RULE-ADD-ITEM (new precondition: sufficient capacity)
AFFECTED  RULE-MINE-001 · RULE-PICKUP-001 · RULE-TRADE-RECEIVE-001
```

새 Cycle 은 새 코드를 옆에 붙이는 것이 아니라, 새 Semantic 을 공유 World 에 적용하고
그 의미의 영향을 받는 기존 Rule 도 함께 발전시킨다.

## Gap Handling

현재 단계의 입력으로 올바른 결과를 만들 수 없다면
필요한 의미를 임의로 만들어내지 않는다.

부족한 내용을 명시하고 그 의미를 책임지는 이전 단계로 반환한다.

```text
GAMEVIEW GAP
Required   현재 Mining 대상 방향을 표현해야 함
Missing    CurrentActionTarget
Reason     CurrentAction 은 있지만 대상 정보를 알 수 없음
Return To  GameView Specification
```

```text
WORLD DESIGN GAP
Intent            INTENT-MINING-001
Missing Semantic  ToolCapability
Reason            Mining 가능 여부를 표현할 World State 가 없음
Return To         Intent
```

Agent 는 설계 변경을 수행하는 것이 아니라 설계 변경 후보를 제출한다.

## History vs Current

```text
Cycle Artifact History     과거 기록      변경하지 않는다
Current World / View       현재 게임      후속 Cycle 로 계속 변경된다
```

```text
C005 Basic Inventory → C012 Inventory Capacity → C018 Equipment → C024 Weight
```

과거 Cycle 디렉터리는 그대로 유지되지만 실제 구현은 하나(`world/inventory/`)이며 계속 발전한다.

## Regression

후속 Cycle 에서 기존 Rule 을 변경하면 영향받는 기존 기능도 검증해야 한다.

```text
NEW BEHAVIOR
    Inventory has room  → Item acquisition succeeds
    Inventory full      → Item acquisition fails

REGRESSION
    Mining with available capacity  → still succeeds
    Pickup with available capacity  → still succeeds
    Trade receive with capacity     → still succeeds
```

과거 Cycle 의 Verification Scenario 를 Regression Scenario 의 기반으로 사용한다.

## View 변경이 없는 Cycle

모든 Cycle 이 View 코드를 바꿔야 하는 것은 아니다.
GameView Specification 에 변화가 없으면 `GAMEVIEW CHANGE: NONE` 으로 명시한다.

```text
World  changed
View   unchanged
```

도 정상적인 Cycle 결과다. 중요한 것은 현재 Cycle Goal 이 실제 플레이에서 검증되는 것이다.

## Completion

코드가 실행되는 것만으로 Cycle 은 완료되지 않는다.

Cycle Goal 이:

* World Semantic 으로 존재하고
* World Rule 로 실행되며
* GameView Specification 으로 표현되고
* View 에서 확인되고
* 실제 플레이로 검증되어야 한다.

전체 판정 항목 15개는 `HktAdvProtoH/guides/verification.md` 의 DONE WHEN 이 단일 출처다.
여기에 복제하지 않는다.

## 한 문장

각 AI Agent 는 공통 규칙인 CLAUDE.md 와 자기 단계의 짧은 Guide, 이전 단계 Artifact 만을 읽고
현재 Cycle 의 Game Delta 를 설계·구현한 뒤 다음 단계가 사용할 Artifact 를 남기며,
이러한 Cycle 을 반복하여 하나의 공유 World 와 독립적인 View 를 지속적으로 발전시킨다.
