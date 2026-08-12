# AGENTS.md

HktAdvProtoH 의 모든 Agent 가 **모든 작업에서** 지켜야 하는 불변 규칙.

Workflow 전체 설명은 여기 두지 않는다. 단계별 작업 방법은 `guides/<stage>.md` 에 있다.

## Development Model

이 프로젝트는 작은 플레이 가능한 게임 단위인 Cycle 을 반복하여
하나의 MMORPG World 와 View 를 계속 발전시킨다.

모든 Agent 작업은 현재 Cycle 의 일부다.

## Artifact Handoff

각 단계는 이전 단계 Artifact 를 입력으로 사용하고
자신의 결과를 다음 단계가 사용할 Artifact 로 남긴다.

대화 History 를 Source of Truth 로 사용하지 않는다.

```text
이전 단계 Artifact
        ↓
현재 단계 Agent 작업
        ↓
현재 단계 Artifact
        ↓
다음 단계 Agent
```

## Follow Stage Guide

모든 Agent 는 다음을 기준으로 작업한다.

1. `AGENTS.md`
2. 현재 Stage Guide (`guides/<stage>.md`)
3. 현재 Cycle 의 입력 Artifact (`cycles/<CycleId>/<NN>-*.md`)

전체 Design 문서(`design/`)는 특별히 필요한 경우에만 참조한다.
필요하면 관련 기존 Capability Artifact 나 기존 코드를 추가로 확인한다.

## Preserve Design Meaning

이전 단계에서 확정된 의미를 구현 편의를 위해 임의로 변경하지 않는다.

- Intent 변경이 필요하면 Intent 단계로 반환한다.
- World Semantic 변경이 필요하면 World Semantic 단계로 반환한다.
- GameView Specification 에 정보가 부족하면
  View 가 World 내부를 직접 읽지 않고 Specification 변경을 요청한다.

## Cycle Is a Game Delta

Cycle 은 현재 게임에 하나의 플레이 가능한 변화 Delta 를 추가한다.

Cycle 은:

- 새로운 Capability 를 추가할 수 있다.
- 기존 Capability 를 확장할 수 있다.
- 기존 Capability 를 고도화할 수 있다.
- 필요하면 기존 Semantic 이나 Rule 을 변경할 수 있다.

무엇이 기존이고 무엇이 변경되었는지는 Artifact 에 명확히 기록한다.

## Shared World

각 Cycle 은 별도의 World 를 만들지 않는다.
모든 Cycle 은 동일한 공유 World 를 발전시킨다.

기존 Actor, Inventory, Item, Position 등의 Semantic 이 있다면
중복 생성하지 않고 재사용한다.

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

## World Authority

Client 는 World State 를 직접 변경하지 않는다.
Client 는 Action 을 요청한다.
World 가 World Rule 을 통해 상태 변화를 결정한다.

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

Rule 은 자신이 구현하는 Intent 를, Intent 는 자신의 Source Goal / Possibility 를 명시한다.

## Existing Capability Changes

기존 Capability 수정은 허용된다.
단, 모든 Semantic 변경은 현재 Cycle Goal 에서 유래해야 한다.

기존 코드의 단순 리팩터링과 게임 의미의 변경을 구분한다.

## Gap Handling

현재 단계의 입력으로 올바른 결과를 만들 수 없다면
필요한 의미를 임의로 만들어내지 않는다.

부족한 내용을 명시하고 그 의미를 책임지는 이전 단계로 반환한다.

```text
GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  어느 단계가 이 의미를 책임지는가
```

## Completion

코드가 실행되는 것만으로 Cycle 은 완료되지 않는다.

Cycle Goal 이:

- World Semantic 으로 존재하고
- World Rule 로 실행되며
- GameView Specification 으로 표현되고
- View 에서 확인되고
- 실제 플레이로 검증되어야 한다.

## Stage / Guide / Artifact

| Stage | Guide | Artifact |
|---|---|---|
| 1. Cycle Definition | [guides/cycle-definition.md](guides/cycle-definition.md) | `01-cycle.md` |
| 2. Intent | [guides/intent.md](guides/intent.md) | `02-intent.md` |
| 3. World Semantic | [guides/world-semantic.md](guides/world-semantic.md) | `03-world-semantic.md` |
| 4. GameView Specification | [guides/gameview-spec.md](guides/gameview-spec.md) | `04-gameview.spec.yaml` |
| 5. Human Semantic Review | — (Human) | `05-review.md` |
| 6. World Implementation | [guides/world-implementation.md](guides/world-implementation.md) | `world/` + `06-world-implementation.md` |
| 7. View Implementation | [guides/view-implementation.md](guides/view-implementation.md) | `view/` + `07-view-implementation.md` |
| 8. Verification | [guides/verification.md](guides/verification.md) | `08-verification.md` |

## Directory Map

```text
HktAdvProtoH/
├── AGENTS.md        공통 불변 규칙 (이 문서)
├── design/          전체 원본 설계 — 기본 작업 Context 아님
├── guides/          Stage Guide — 단계별 작업 방법
├── cycles/          Cycle Artifact — 진행 기록 (과거 Cycle 은 수정 금지)
├── world/           Authoritative World 구현 (공유, 계속 발전)
├── view/            Client View 구현 (공유, 계속 발전)
└── protocol/        World ↔ View 경계 타입만
```

`cycles/` 는 History 다. `world/` `view/` `protocol/` 은 현재 게임이며 후속 Cycle 로 계속 변한다.
