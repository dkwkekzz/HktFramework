# Skill Library

재사용 가능한 HOW 의 저장소. [Design-AgentExecution.md](../design/Design-AgentExecution.md) §4·§13·§14.

```
Skill = HOW   (이 종류의 작업을 어떻게 수행하는가)
Task  = WHAT  (Task Envelope, cycles/<id>/tasks/)
State = WHERE (cycle_state.yaml)
```

Skill 은 stateless 다 — 현재 Cycle 상태를 기억하지 않으며, 어떤 Cycle 에서든 반복 사용된다.

## Minimum Skill Set (Bootstrap Step 6)

| Skill | 담당 Stage | Gate |
|---|---|---|
| [cycle-scope](cycle-scope/SKILL.md) | 1 Cycle Scope | Scope Gate |
| [intent-design](intent-design/SKILL.md) | 2 Intent Design | Intent Gate |
| [world-semantic-design](world-semantic-design/SKILL.md) | 3 World Semantic Design | Semantic Closure |
| [semantic-closure-verify](semantic-closure-verify/SKILL.md) | 3 검증 | Semantic Closure |
| [contract-design](contract-design/SKILL.md) | 4·5·6 Authority / Observation / GV Spec | Authority·Observable·Contract |
| [contract-verify](contract-verify/SKILL.md) | 6 검증 + Freeze 준비 | Contract Gate |
| [world-implement](world-implement/SKILL.md) | 7 World Implementation | Build/Test |
| [world-verify](world-verify/SKILL.md) | 8 World Verification | World Complete |
| [gameview-design](gameview-design/SKILL.md) | 9~12 Spec Resolve / Composition / Asset / Binding | Spec~Binding Gates |
| [gameview-implement](gameview-implement/SKILL.md) | 13 GameView Implementation | Build/Test |
| [gameview-verify](gameview-verify/SKILL.md) | 14 GameView Verification | GameView Complete |
| [integration](integration/SKILL.md) | 15 Integration | Integration Gate |
| [playable-verify](playable-verify/SKILL.md) | 16 Playable Verification | Playable Complete |
| [module-package](module-package/SKILL.md) | 17 Module Packaging | Cycle Commit |

여러 Stage 를 하나의 Skill 이 담당하더라도 **Stage 별 Artifact 와 Gate 는 유지한다** (§8).
Workflow 가 안정되면 §11 의 Stage 단위 Skill 로 세분화한다.
