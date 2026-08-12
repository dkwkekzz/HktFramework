# Architecture Rules — World

근거: [Design-AgentExecution.md](../Design-AgentExecution.md) §2 Rule 1·2·11·12, [Design-CycleWorkflow.md](../Design-CycleWorkflow.md) §9·§39·§44.

## Rule 1 — Design Source of Truth

```
Human Design → Goal / Possibility → Intent → World State / World Rule
```

Goal/Possibility와 Intent가 게임 의미의 최상위 Source of Truth다.
구현 편의를 위해 Intent를 역방향으로 수정하지 않는다.

## Rule 2 — Semantic Closure

Intent의 모든 의미는 World State 또는 World Rule로 표현되어야 한다.
하나라도 State/Rule로 추적되지 않으면 Semantic Closure FAIL이다 (§21).

## Rule 11 — Shared World Semantic

Capability별 별도 World Semantic을 만들지 않는다.
`MiningInventory / CraftingInventory / TradeInventory` 같은 중복은 금지 —
모든 Capability는 하나의 공유 `Inventory` 위에 얹힌다.

새 의미를 정의하기 전에 반드시 `registry/semantics.yaml`을 조회한다 (lookup-first).
존재하면 Reuse, 없을 때만 Semantic Delta로 추가한다.

## Rule 12 — Transport Independence

Local Call / IPC / Network / Serialization / Replication은
World Semantic을 변경하지 않는 Implementation Detail이다.

## World State 원칙

- World State에는 세계의 사실만 둔다.
- cache / index / thread / packet / 렌더 상태 등 구현 내부 상태는 World State가 아니다.

## 검증 (Verifier가 확인할 것)

- 모든 Intent 의미 → State/Rule trace 존재 (`intent_trace.yaml` 완전성)
- Semantic Registry 조회 흔적 (`semantic_dependencies.yaml`) 존재
- 기존 Semantic과 중복되는 신규 정의 없음
- World State에 구현 내부 상태 없음
