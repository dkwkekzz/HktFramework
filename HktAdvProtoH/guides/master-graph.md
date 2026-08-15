# Master Graph Expansion Stage Guide  (M2)

## Role

World Cause → Actor / Knowledge·Belief → Actor-owned Goal → 대안 Possibility →
필요한 Capability 를 Typed Graph 로 확장한다.

**시스템 목록에서 출발하지 않는다.** 누가 왜 무엇을 원하는지에서 출발한다.

## Input

- `master/root.md`
- `master/constraints/` — Active Constraint
- `master/graph/` — 기존 Node (중복 검사용)
- 확장 대상 (Human 이 지정한 Root Goal · Content Region · 기존 MG-*)

## Do

`design/Master-Intent-Graph-Policy.md` §24 의 12 Step 을 순서대로 수행한다.

```text
Step 0   Active Constraint 확인          GLOBAL / Domain / Content-specific
Step 1   Goal Owner / Motivation 확인    누가·왜·어떤 World State·어떤 Belief
Step 2   Possibility 를 폭으로 확장       의미가 다른 여러 방법
Step 3   Constraint Evaluation           SATISFIED / VIOLATED / NOT_APPLICABLE / UNRESOLVED
Step 4   Requirements 도출                Goal · Capability · Knowledge · WorldState ·
                                         Relationship · Resource  (AND)
Step 5   Existing Registry 중복 검사      같은 의미를 새 이름으로 만들지 않는다
Step 6   Actor Conflict 검사              누구를 돕고 누구를 방해하는가
Step 7   Consequence 정의                 성공하면 무엇이 실제로 바뀌는가
Step 8   Reveal / Reframe / New Goal 검사
Step 9   Constraint Discovery             반복 패턴 → candidates/CC-*.md
```

Step 10~12 (Overlay · Frontier · Human Selection) 는 M3 · M4 가 담당한다.

Possibility 확장 시 검토할 Dimension:

```text
Direct action  Combat  Exploration  Economy  Craft  Social cooperation
Faction / diplomacy  Knowledge / investigation  World manipulation
Alternative supply / substitution
```

## Output

`master/graph/*.yaml` — 해당하는 Node 파일에 추가/갱신.
노드 안에서 표현되지 않는 관계는 `edges.yaml`.

Constraint Candidate 를 발견하면 `master/candidates/CC-*.md`.

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Must

- 상위 Goal 은 Actor-owned 로 표현한다 — 누가 왜 원하는지에 답할 수 있어야 한다.
- 하나의 Goal 아래 **의미 있게 다른** Possibility 를 탐색한다 (OR).
- 각 Possibility 의 Requirements 를 명시한다 (AND).
- 새 Node 를 만들기 전에 기존 Graph 를 검색한다.
- 각 Possibility/Capability 에 Constraint Evaluation 을 기록한다.
- 재사용 가능한 저수준 플레이 의미는 Goal 이 아니라 Capability 로 둔다.

## Must Not

- 숫자를 맞추려 억지 Possibility 를 만들지 않는다 — 동의어는 대안이 아니다.
- `VIOLATED` 후보를 정상 경로로 흘려보내지 않는다 (Design Conflict 로 제시할 수는 있다).
- `UNRESOLVED` 를 임의로 `SATISFIED` 로 간주하지 않는다.
- Cycle 의 수치·공식·State 이름을 Graph 에 복사하지 않는다.
- Capability 의 `semantic` 에 구현 모듈명을 쓰지 않는다.
- 같은 Goal/Capability 를 Branch·Content 마다 복제하지 않는다.

## Done When

- `Master-Intent-Graph-Policy.md` §25.2 Goal · §25.3 Possibility · §25.4 Narrative ·
  §25.5 DAG/Reuse Quality Gate 가 모두 참이다.
- 각 Possibility 가 어떤 Capability 를 요구하는지 읽힌다.
- 각 Capability 가 왜 필요한지 Goal/Possibility 경로로 역추적된다.
- Constraint 가 실제로 어떤 후보를 걸러냈는지 기록에서 보인다.
