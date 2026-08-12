# Contract Design (Authority / Observation / GameView Spec)

## Purpose
World Semantic 위에 Authority·Command Contract(Stage 4), Observable Contract(Stage 5),
GameView Specification(Stage 6)을 설계한다. Stage 별 Artifact 는 분리 유지한다 (§8).

## Required Inputs
- `cycles/<id>/artifacts/world-design/` (world_state / world_rules)
- `cycles/<id>/artifacts/intent/` (goal_possibility / intent)
- `registry/contracts.yaml` (기존 Contract 재사용·버전 확인)

## Procedure
1. **Authority (Stage 4)**: 모든 mutable World State 에 `owner: AuthoritativeWorld` 와
   `mutable_by: [WorldRule]` 를 지정한다. 각 Possibility 에 대한 Command 를 정의한다 —
   input 은 의도 식별자만, 결과 필드는 `prohibited_fields` 로 명시 금지 (Rule 3·4).
2. **Observation (Stage 5)**: Observer 별(최소 Player / Designer) Projection 을 정의한다.
   State 뿐 아니라 `Before → Input → Rule → After` Transition 도 관찰 가능해야 한다.
   Designer 는 §23 의 8항목(Goal/Possibility/Availability/Preconditions/Rule/Before/Input/After/FailureReason)을 본다.
   Observable 은 semantic 단위 — packet/serialization 형식이 아니다 (Rule 5·6).
3. **GameView Spec (Stage 6)**: Observable 의미 → Visual Meaning 매핑만 정의한다.
   Visual Role / Placement / Source 까지. 구체 자산·렌더러는 정의하지 않는다 (Rule 8).
4. Contract id·version 을 부여한다 (CMD-*-V# / OBS-*-V# / VIEW-*-###).

## Never
- renderer implementation / 구체 asset 참조 (§35)
- Client 가 상태 결과를 보내는 Command 설계
- World 내부 객체를 그대로 노출하는 Observable
- Intent / World Rule 수정

## Required Outputs
- `authority.yaml` + `command_contract.yaml` (Stage 4)
- `observable_contract.yaml` (Stage 5)
- `gameview_spec.yaml` (Stage 6)

## Completion
Authority Closure(§22)·Observable Closure(§23) 검사 가능 상태이고,
GameView Spec 의 모든 항목이 Observable Contract 항목을 source 로 갖는다.
(Gate: `contract-verify`)
