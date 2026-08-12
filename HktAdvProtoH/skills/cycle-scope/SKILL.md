# Cycle Scope

## Purpose
Cycle Goal 을 한 Cycle 로 완주 가능한 최소 플레이 범위로 확정한다 (Stage 1).

## Required Inputs
- `cycles/<id>/goal.yaml`
- `registry/modules.yaml` (기존 Capability 재사용 판단)

## Procedure
1. Goal 을 읽고 플레이 가능한 경험인지 확인한다 (기술 작업 목록이면 BLOCKED).
2. Module Registry 를 조회해 이미 provides 되는 부분을 분리한다 — 재구현 금지 (Rule 10).
3. 이번 Cycle 에 포함할 최소 요소를 `included` 로, 의도적으로 미룰 것을 `excluded` 로 나눈다.
4. included 만으로 Goal 이 플레이 가능한지 자문한다 — 불가능하면 included 를 조정한다.
5. excluded 각 항목에 한 줄 사유를 남긴다.

## Never
- source code 열람 (§35 — Scope Agent 는 capability summary 까지만)
- Goal 자체 수정
- 한 Cycle 에 여러 플레이 목표를 담기 (SCOPE_TOO_LARGE)

## Required Outputs
- `cycle_scope.yaml` — `scope.included` / `scope.excluded` / `scope.reused_modules`

## Completion
included 집합만으로 Cycle Goal 이 플레이 가능하고, 기존 Module 과 중복 구현이 없다.
