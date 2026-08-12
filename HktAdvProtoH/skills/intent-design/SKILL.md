# Intent Design

## Purpose
Cycle Goal 을 Goal / Possibility / Intent 로 구조화한다 (Stage 2). 게임 의미의 최상위 Source of Truth 를 만든다 (Rule 1).

## Required Inputs
- `cycles/<id>/goal.yaml`
- `cycles/<id>/artifacts/scope/cycle_scope.yaml`

## Procedure
1. Goal 에서 플레이어가 달성하려는 것(Goal)과 그것을 가능하게 하는 행동(Possibility)을 분리한다.
2. 각 Possibility 에 대해 Intent 를 작성한다 — 어떤 조건의 Actor 가 무엇을 할 수 있고 결과가 무엇인지, **세계 의미의 언어로만** 기술한다.
3. Intent 의 모든 문장이 이후 World State/Rule 로 표현 가능한 형태인지 점검한다 (Rule 2 대비).
4. Goal → Possibility → Intent 연결을 design_trace 로 남긴다.

## Never
- implementation detail (자료구조·네트워크·엔진 용어) 사용 (§35)
- Scope 를 벗어난 의미 추가
- 렌더링/UI 표현 정의

## Required Outputs
- `goal_possibility.yaml`
- `intent.yaml` — `intent.id` / `intent.meaning` / `intent.result`
- `design_trace.yaml` — Goal→Possibility→Intent 연결

## Completion
Scope included 의 모든 요소가 최소 하나의 Intent 로 연결되고, Intent 에 구현 세부가 없다.
