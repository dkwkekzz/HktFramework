# GameView Design (Spec Resolve / Composition / Asset / Binding)

## Purpose
Frozen Contract 만으로 GameView 를 설계한다 — Stage 9 Specification Resolution,
Stage 10 Visual Composition, Stage 11 Asset Resolution, Stage 12 Observable Binding.
Stage 별 Artifact 는 분리 유지한다 (§8).

## Required Inputs (§28 — 이것이 전부다)
- Observable Contract (`contracts/observable/`)
- GameView Specification (`contracts/gameview-spec/`)
- Existing GameView Modules (`registry/modules.yaml` 의 GAMEVIEW 항목)
- Asset Catalog
- GameView Conventions

## Procedure
1. **Spec Resolve (9)**: GV Spec 의 각 Visual Meaning 을 구체 Visual Requirement 로 전개한다.
2. **Composition (10)**: Visual Requirement 를 화면 구성 요소로 조직한다.
3. **Asset Resolve (11)**: 각 구성 요소에 Asset Catalog 의 자산을 바인딩한다.
4. **Binding (12)**: 모든 Rendering State 의 source 를 Observable Contract 항목으로 명시한다.
   형태는 반드시 `Observable Semantic → Rendering State`.
5. 필요한 Observable 이 Contract 에 없으면 **우회하지 말고** contract_gap Proposal 을 만들고
   BLOCKED 로 종료한다 (§29).

## Never (§28)
- World 내부 열람: Goal Graph / Intent 구현 / World Rule 구현 / Server State / Planner / Simulation 내부
- `GameView -> WorldState.X` 형태의 직접 참조 설계
- Frozen Contract 임의 확장
- Contract 에 없는 Observable 을 가정한 Binding

## Required Outputs
- `visual_requirements.yaml` (Stage 9)
- `composition.yaml` (Stage 10)
- `asset_bindings.yaml` (Stage 11)
- `observable_bindings.yaml` (Stage 12)

## Completion
GV Spec 의 모든 Visual Meaning 이 Requirement→Composition→Asset→Binding 으로 연결되고,
모든 Binding source 가 Observable Contract 항목이다.
