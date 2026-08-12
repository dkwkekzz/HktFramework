# world/ — Authoritative World (Server)

하나의 **공유 World** 다. Capability 별로 분리된 World 를 만들지 않는다.
모든 Cycle 이 이 디렉터리를 함께 발전시킨다.

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

## 구조

| 디렉터리 | 내용 |
|---|---|
| `semantic/` | World State 정의 |
| `rules/` | World Rule — 허용되는 상태 전이 |
| `simulation/` | 시간 진행 · 자동/자연 법칙 |
| `projection/` | Observer Projection → GameView Specification |
| `actions/` | Client Action Request 수용 |
| `capabilities/` | Cycle 이 추가한 가능성의 조립 |

## 규칙

- 의미 있는 상태 변화는 World Rule 을 통해서만 발생한다.
- Rule 은 자신이 구현하는 Intent ID 를 남긴다.
- `view/` 를 import 하지 않는다. `protocol/` 만 공유한다.
- View 없이 테스트 가능해야 한다.

작업 기준: [guides/world-implementation.md](../guides/world-implementation.md)

> 런타임 스택(TypeScript Server)은 첫 Cycle 의 World Implementation 단계에서 실제 코드와 함께 확정한다.
