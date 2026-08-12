# World Semantic Design

## Purpose
Resolve Cycle Intent into shared World State and World Rules (Stage 3).

## Required Inputs
- Intent Artifact (`cycles/<id>/artifacts/intent/intent.yaml`)
- Semantic Registry (`registry/semantics.yaml`)
- Module Registry (`registry/modules.yaml`)

## Procedure
1. Read the Intent.
2. Extract every semantic statement.
3. Query Semantic Registry for each required semantic (**lookup-first**).
4. Reuse existing semantic whenever possible.
5. Add only missing semantics as Semantic Delta.
6. Define World State only for world facts.
7. Define World Rule as allowed semantic state transitions (id / input / preconditions / transition).
8. Build Intent -> State / Rule trace.

## Never
- create capability-specific duplicates (Rule 11 — MiningInventory 금지, 공유 Inventory 사용)
- place cache/thread/network state into World State
- modify Intent for implementation convenience
- inspect GameView internals

## Required Outputs
- `semantic_dependencies.yaml` — Registry 조회 결과 (existing 재사용 목록)
- `semantic_delta.yaml` — 신규 semantic 만
- `world_state.yaml`
- `world_rules.yaml`
- `intent_trace.yaml` — Intent 의미 → State/Rule 매핑

## Completion
Every Intent semantic must resolve to State or Rule.
(Gate: `semantic-closure-verify` + `verify.mjs closure <cycle>`)
