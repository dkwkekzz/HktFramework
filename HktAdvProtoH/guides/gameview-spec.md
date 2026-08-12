# GameView Specification Stage Guide

## Role

World Semantic 을 Observer(Player / Designer)에게 필요한 **표현 계약**으로 투영한다.
이것이 World → View 의 유일한 공개 계약이다.

## Input

- `cycles/<CycleId>/03-world-semantic.md`
- 기존 GameView Specification (`protocol/gameview/`, 과거 Cycle 의 `04-gameview.spec.yaml`)

## Do

```text
Authoritative World
        ↓
Observer Projection
        ↓
Presentation Semantic
        ↓
GameView Specification
```

1. Observer 를 정한다 — `player` (기본), 필요하면 `designer`.
2. Entity 를 Semantic Role 로 기술한다 (`player-character`, `resource-deposit`, …).
3. 각 표현 값의 `source` 를 World Semantic 경로로 연결한다.
4. State 는 조건으로 표현한다 (`available when ResourceAmount > 0`).
5. Interaction 과 그 가용성(+실패 Reason)을 노출한다.
6. HUD 에 필요한 값을 노출한다.
7. Designer Observer 에는 Goal / Possibility / Availability / Precondition / Before·After / Reason 을 포함한다.
8. Delta 를 REUSED / ADDED / CHANGED 로 표기한다. 변화가 없으면 `GAMEVIEW CHANGE: NONE`.

## Output

`cycles/<CycleId>/04-gameview.spec.yaml`

```yaml
id: VIEW-INVENTORY-CAPACITY-001
observer: player
delta:
  reused: [inventory.items]
  added: [inventory.capacity]
  changed: []
entities:
  player:
    role: player-character
    position: { source: Actor.Position }
    state: { source: Actor.CurrentAction }
interactions:
  pickup:
    role: acquire-item
    target: ItemDrop
    available: { source: AddItem.Availability }
    unavailableReason: { source: AddItem.FailureReason }
hud:
  inventory:
    items: { source: Actor.Inventory.Items }
    capacity:
      used:    { source: Actor.Inventory.UsedCapacity }
      maximum: { source: Actor.Inventory.Capacity }
```

## Must

- View 가 이 문서 **하나만으로** 화면을 구성할 수 있어야 한다.
- Rule 판단에 영향을 준 조건과 실패 Reason 이 표현 가능해야 한다.
- 모든 `source` 는 `03-world-semantic.md` 의 실제 Semantic 을 가리킨다.
- Designer 관찰도 이 계약을 사용한다 — 별도의 World 직접 접근 경로를 만들지 않는다.

## Must Not

다음은 절대 포함하지 않는다.

```text
Sprite filename    Texture path    Three.js object
CSS                React component Shader
Mesh               Renderer 구현    좌표 변환 / 카메라 설정
```

World 내부 자료구조를 그대로 덤프하지 않는다. 필요한 의미만 투영한다.

## Done When

- Player 가 이 Specification 만 받고 Cycle Goal 을 이해하고 플레이할 수 있다.
- 03-world-semantic.md 의 Observable Semantic 이 모두 투영되었거나, 투영하지 않은 이유가 적혀 있다.
- Presentation 기술 용어가 하나도 들어 있지 않다.
