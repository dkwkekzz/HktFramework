# Stage Guides

각 Agent 는 `AGENTS.md` + **자기 단계 Guide 하나** + 현재 Cycle 의 입력 Artifact 만 읽는다.

| Guide | Stage | 입력 | 출력 |
|---|---|---|---|
| [cycle-definition.md](cycle-definition.md) | 1. Cycle Definition | Human Cycle Goal | `01-cycle.md` |
| [intent.md](intent.md) | 2. Intent | `01-cycle.md` | `02-intent.md` |
| [world-semantic.md](world-semantic.md) | 3. World Semantic | `02-intent.md` | `03-world-semantic.md` |
| [gameview-spec.md](gameview-spec.md) | 4. GameView Specification | `03-world-semantic.md` | `04-gameview.spec.yaml` |
| — | 5. Human Semantic Review | 01~04 | `05-review.md` |
| [world-implementation.md](world-implementation.md) | 6. World Implementation | `03-world-semantic.md` | `world/` + `06-world-implementation.md` |
| [view-implementation.md](view-implementation.md) | 7. View Implementation | `04-gameview.spec.yaml` | `view/` + `07-view-implementation.md` |
| [verification.md](verification.md) | 8. Verification | 전체 | `08-verification.md` |

모든 Guide 는 동일한 형식을 따른다.

```text
ROLE
INPUT
DO
OUTPUT
MUST
MUST NOT
DONE WHEN
```

Guide 는 해당 Stage 에 필요한 Design 규칙을 압축해서 제공한다.
Guide 로 판단할 수 없는 경계 사례에 한해 `design/` 원본을 참조한다.
