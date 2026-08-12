# view/ — Client View

GameView Specification 만으로 화면을 구성하는 독립 Client 다.

```text
GameView Specification
    ↓
Presentation Resolver
    ↓
Scene State
    ↓
Renderer
```

## 구조

| 디렉터리 | 내용 |
|---|---|
| `gameview/` | GameView Specification 수신 · 해석 |
| `scene/` | Scene State |
| `renderer/` | 렌더링 |
| `terrain/` | 3D Terrain |
| `sprites/` | Sprite Billboard |
| `camera/` | Camera (View 의 책임) |
| `input/` | 조작 → Action Request |
| `hud/` | Web HUD |
| `assets/` | Semantic Role → Asset Registry |

## 규칙

- 입력은 GameView Specification 하나뿐이다. `world/` 를 import 하지 않는다.
- Sprite / Mesh / Texture / 레이아웃 / Camera 선택은 View 의 자유이자 책임이다.
- Client 는 World State 를 직접 바꾸지 않는다 — Action Request 만 보낸다.
- GameView Fixture 만으로 World 없이 테스트 가능해야 한다.
- 정보가 부족하면 World 를 뒤지지 않고 GameView Gap 으로 반환한다.

## 초기 표현 기준

```text
Platform  Web / TypeScript
Terrain   3D Terrain
Entity    Sprite Billboard
UI        Web HUD
```

작업 기준: [guides/view-implementation.md](../guides/view-implementation.md)
