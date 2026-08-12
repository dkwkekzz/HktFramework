# Architecture Rules — GameView

근거: [Design-AgentExecution.md](../Design-AgentExecution.md) §2 Rule 7·8, §28·§29, [Design-CycleWorkflow.md](../Design-CycleWorkflow.md) §25~§33.

## Rule 7 — GameView Isolation

GameView가 소비할 수 있는 World 정보는 오직 다음 둘이다.

- Observable Contract
- GameView Specification

GameView는 Goal Graph 내부 / Intent 구현 / World Rule 구현 /
Server State / Database / Planner / Simulation 내부 객체를 보지 않는다.

## Rule 8 — Presentation Independence

GameView Specification은 다음을 정의하지 않는다.

- Mesh / Animation Clip / Shader / Material
- Widget Framework / UI Pixel Position
- Asset Path / Renderer

Specification은 **의미**(Visual Meaning)만 정의하고,
구체 자산·렌더러 선택은 GameView Workflow 내부(Asset Resolution 이후)의 일이다.

## Binding 형태

GameView Binding은 반드시 `Observable Semantic → Rendering State` 형태여야 한다.

```
금지:
GameView -> MiningSystem.CurrentTarget
GameView -> WorldState.InternalInventory
GameView -> Planner.CurrentNode
```

## Contract Gap Protocol (§29)

필요한 Observable이 없으면 World 내부를 읽어 우회하지 않는다.

1. 작업을 `BLOCKED`로 종료한다.
2. `contract_gap` Proposal을 생성한다 (schema: `orchestration/schemas/contract_gap.schema.yaml`).
3. Contract Review가 유효한 World Semantic인지 판단한다.
4. YES → Observable 확장 → Version Contract → Verify → Re-Freeze → GameView 재개.
5. NO → Reject / Presentation 재설계.

## 검증 (Verifier가 확인할 것)

- 모든 Rendering State의 source가 Observable Contract 항목임
- Frozen Contract 외부 참조 없음 (forbidden import/read 검사)
- Spec 단계 산출물에 구체 자산 경로/렌더러 지정 없음
- Contract Gap 발생 시 BLOCKED + Proposal 형식 준수
