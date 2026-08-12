# World Implement

## Purpose
Frozen Contract 기준으로 World Runtime(State / Rule / Observable Projection)을 구현한다 (Stage 7).

## Required Inputs
- World Implementation Package (`cycles/<id>/world/implementation_package.yaml`) — §26 의 11항목.
  전체 설계 History 는 받지 않는다.
- 허용된 dependency module 의 public contract

## Procedure
1. Implementation Package 만 읽는다 (Scope/Goal/Intent/Deps/Delta/State/Rules/Authority/Observable/Trace/Completion).
2. Semantic Delta 를 구현한다.
3. World Rules 를 구현한다 — 모든 State 변경은 Rule 을 통해서만 (Rule 3).
4. Command 처리부를 구현한다 — Client 입력은 의도만, 결과 필드 거부 (Rule 4).
5. Observable Projection 을 구현한다 — Contract 의 semantic 단위 그대로 (Rule 5·6).
6. Rule 단위 테스트를 추가한다 (preconditions 별 성공/실패 케이스 포함).
7. build → test → fix → re-test (한 Session 내 반복 허용, §6.2).

## Never (DO NOT, §26)
- change Intent
- invent undocumented World Semantic
- change Frozen Contract
- implement GameView / GameView source 열람
- rewrite Frozen Module

## Required Outputs
- `source/world/` 구현 코드 (write_scope 내)
- `implementation_result.yaml` (handoff_result schema — changed_files / implemented_rules / implemented_observables / tests)

## Completion
모든 Rule·Observable 이 Contract id 로 구현·테스트되고 build/test 가 green 이다.
최종 판정은 `world-verify` 의 몫이다.
