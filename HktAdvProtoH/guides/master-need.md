# Master NEED Step Guide

## Role

각 유효한 Possibility 가 실제로 요구하는 **Requirement** 를 찾고(AND),
재사용 가능한 플레이 의미를 **Capability(MC-*)** 로 세운 뒤,
그것이 **Existing World 에 이미 있는지** Overlay 로 판정한다.

Capability 의 필요성은 Possibility 에서 나온다 — Constraint 에서 나오지 않는다.
Frontier(NEXT)는 이 판정에서 나온다.

## Input

- 대상 MP-* (OPTIONS 의 산출)
- `master/graph/capabilities.yaml` — 기존 Capability (중복 검사용)
- `master/overlay.md` — 직전 판정
- `master/constraints/` — Active Constraint (Filter)
- 관련 Cycle 의 `08-verification.md` (실측 근거)
- 필요한 경우 `world/` `view/` 실제 코드 — **읽기만 한다**

## Do

1. Possibility 별 Requirement 를 도출한다 (AND) — 필요한 것만 기록한다.

```text
Capability / Knowledge·Belief / WorldState / Actor Relationship /
Resource·Ownership / 다른 Goal
```

2. 재사용 가능한 플레이 의미는 MC-* Capability 로 세운다.
   `semantic` 은 플레이 의미 한 문단 — 왜 필요한지는 쓰지 않는다.
   그 이유는 상위 Goal / Possibility 경로가 설명한다 (정책 §7.1).
3. 새 Node 를 만들기 전에 기존 Registry 를 검색한다 — 같은 의미를 새 이름으로 만들지 않는다.
4. Constraint Filter 를 적용한다 — Active DC 가 Capability 의 최종 형태를 제한하면
   `constraint_evaluation` 에 기록한다.
5. 각 Capability 의 Overlay 를 판정한다.

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
```

6. 근거를 적는다 — Cycle ID 또는 실측. **주장만 적지 않는다.**
7. `PARTIAL` 은 "무엇이 부족한가"를 반드시 함께 적는다. 이것이 Frontier 의 재료다.
8. `graph/capabilities.yaml` 의 `overlay` 필드를 `overlay.md` 와 같은 값으로 맞춘다.
9. Possibility 단위로도 읽을 수 있게 한다 — 이 Possibility 가 요구하는 것 중 무엇이 없는가.

## Output

`master/graph/capabilities.yaml` · `master/overlay.md` (+ `edges.yaml`)

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Must

- 각 Possibility 의 Requirements 를 명시한다 (AND).
- 각 Capability 가 왜 필요한지 Goal / Possibility 경로로 역추적된다.
- Overlay 판정 근거를 Cycle 기록 또는 실측으로 남긴다.
- `PARTIAL` 은 부족한 부분을 명시한다.

## Must Not

- Constraint 에서 Capability 목록을 도출하지 않는다 — 필요성은 Possibility 에서 온다.
- 코드가 존재한다는 이유만으로 `IMPLEMENTED` 로 판정하지 않는다 — 플레이로 닫혔는가가 기준이다.
- Overlay(있는가/없는가)와 Constraint Violation(허용되는가)을 혼동하지 않는다.

```text
MISSING / PARTIAL   유효한 설계지만 세계에 아직 그 의미가 없다
VIOLATED            설계 자체가 Active Constraint 와 양립하지 않는다
```

- Capability 의 `semantic` 에 구현 모듈명을 쓰지 않는다.
- 수치·공식(Master 는 의미, Cycle 은 수치)을 올리지 않는다 (정책 §7.2).
- Overlay 판정 중 `world/` `view/` 코드를 수정하지 않는다.
- 과거 Cycle Artifact 를 수정하지 않는다.
- 같은 Capability 를 Branch·Content 마다 복제하지 않는다.

## Done When

- 정책 §15 NEED Quality Gate 가 참이다 —
  실제 Requirement 명확 / 재사용 가능한 플레이 의미는 Capability /
  기존 Goal·Capability 중복 없음 / Overlay 근거가 Verification.
- 이번 확장이 요구하는 모든 Capability 에 상태와 근거가 있다.
- `PARTIAL` 항목마다 부족한 것이 적혀 있다.
- 다음 단계(NEXT)가 이 표만 보고 Frontier 후보를 만들 수 있다.
