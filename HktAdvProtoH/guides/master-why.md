# Master WHY Step Guide

## Role

Goal 의 이유를 만든다 — **누가 무엇을 왜 원하는가**.
World Cause(MW-*) / Actor(MA-*) / 필요할 때만 Knowledge·Belief(MK-*/MB-*) /
Actor-owned Goal(MG-*) 을 Typed Graph 로 세운다.

**시스템 목록에서 출발하지 않는다.** 누가 왜 무엇을 원하는지에서 출발한다.

## Input

- `master/root.md`
- `master/constraints/` — Active Constraint (Filter)
- `master/graph/` — 기존 Node (중복 검사용)
- 확장 대상 (Human 이 지정한 Root Goal · Content Region · 기존 MG-*)

## Do

1. Active Constraint 를 확인한다 — 이 영역에 걸리는 GLOBAL / Domain DC.
   Constraint 는 별도 단계가 아니라 아래 모든 선택에 적용하는 Filter 다.
2. Goal Owner 를 확인한다 — 누가 원하는가 (MA-*). 없으면 Actor 를 세운다.
3. 왜 원하는가 — `motivation`. 원인이 되는 세계 상태가 실제로 있으면 MW-* 로 세우고
   `caused_by` 로 연결한다.
4. 무엇이 달라지기를 원하는가 — `desired_state`.
5. Knowledge / Belief 는 Goal 을 설명하는 데 **실제로 필요할 때만** 만든다 (정책 §5.3).
6. 새 Node 를 만들기 전에 기존 Graph 를 검색한다 — 같은 Goal 을 이름만 바꿔 복제하지 않는다.

Goal 은 최소한 셋에 답한다. 나머지는 필요한 경우에만 추가한다 (정책 §5.4).

```text
누가 원하는가? / 왜 원하는가? / 무엇이 달라지기를 원하는가?
```

## Output

`master/graph/` — world-state.yaml · actors.yaml · knowledge.yaml · goals.yaml
(노드 안에서 표현되지 않는 관계는 `edges.yaml`)

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Must

- 상위 Goal 은 Actor-owned Desired State 로 표현한다.
- Context(WorldState / Knowledge / Belief)는 Goal 을 이해하거나 선택을 바꾸는 것만 만든다.
- Active Constraint 가 Goal 의 형태에 영향을 주면 `constraints` 에 기록한다.

## Must Not

- 모든 Goal 에 WorldState / Knowledge / Belief 를 기계적으로 강제 생성하지 않는다.
- 사실상 Capability 인 것을 Goal 로 표현하지 않는다 — 재사용 가능한 플레이 의미는 NEED 의 몫이다.
- Cycle 의 수치·공식·State 이름을 Graph 에 복사하지 않는다.
- 같은 Goal 을 Branch·Content 마다 복제하지 않는다.

## Done When

- 정책 §15 WHY Quality Gate 가 참이다 —
  Owner 명확 / 왜 원하는지 설명 가능 / Desired State 명확 / Capability 를 Goal 로 표현하지 않음.
- 다음 단계(OPTIONS)가 이 Goal 만 보고 대안 탐색을 시작할 수 있다.
