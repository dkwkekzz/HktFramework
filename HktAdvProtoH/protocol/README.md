# protocol/ — World ↔ View 경계

World 와 View 가 **공유해도 되는 경계 타입만** 둔다.

```text
world  may import  protocol
view   may import  protocol

world  MUST NOT import  view
view   MUST NOT import  world
```

## 포함

| 디렉터리 | 내용 |
|---|---|
| `gameview/` | GameView Specification 타입 |
| `action/` | Action Request 타입 |
| `semantic/` | Semantic Identifier (Role · ID) |

## 포함하지 않음

- World 의 Domain Type (State 내부 구조, Rule 구현)
- View 의 Rendering Type (Sprite, Mesh, Scene 객체)
- Transport 세부 (Transport 는 Semantic 에 영향을 주지 않는다)

GameView Specification 의 **의미**는 각 Cycle 의 `04-gameview.spec.yaml` 이 정하고,
여기에는 그 계약을 표현하는 타입만 존재한다.
