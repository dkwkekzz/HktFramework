# GameView Implement

## Purpose
GameView 설계 산출물(composition / asset_bindings / observable_bindings)을 렌더러로 구현한다 (Stage 13).

## Required Inputs
- `cycles/<id>/gameview/` 설계 산출물 4종
- Observable Contract (`contracts/observable/`)
- Asset Catalog / GameView Conventions

## Procedure
1. observable_bindings 의 각 항목을 `Observable → Rendering State` 코드로 구현한다.
2. composition 대로 화면을 구성하고 asset_bindings 의 자산을 연결한다.
3. Observable fixture(가짜 Observable 데이터)로 렌더 상태를 구동하는 테스트를 만든다 —
   World 실행 없이 GameView 단독 검증이 가능해야 한다.
4. build → test → fix → re-test.

## Never
- World 내부 접근 (World source / Server State / Simulation 객체)
- Observable Contract 에 없는 데이터 소비
- Contract Gap 을 코드로 우회 (필요 시 BLOCKED + contract_gap, §29)
- 설계 산출물(binding 등) 임의 변경

## Required Outputs
- `source/gameview/` 구현 코드 (write_scope 내)
- `implementation_result.yaml` (handoff_result schema)

## Completion
모든 binding 이 구현되고 Observable fixture 기반 테스트가 green 이다.
최종 판정은 `gameview-verify` 의 몫이다.
