# Master OPTIONS Step Guide

## Role

하나의 Goal 을 달성하거나 의미 있게 진전시키는 **여러 Possibility(MP-*)** 를 찾는다.
Goal → Possibility 는 **OR 관계**다. 하나의 해결법으로 바로 수렴하지 않는다.

## Input

- 대상 MG-* (WHY 의 산출)
- `master/constraints/` — Active Constraint (Filter)
- `master/graph/possibilities.yaml` — 기존 Possibility (중복 검사용)

## Do

1. 같은 Goal 을 다르게 달성하는 후보를 폭으로 탐색한다. 검토할 Dimension:

```text
Direct action  Combat  Exploration  Economy  Craft  Social cooperation
Faction / diplomacy  Knowledge / investigation  World manipulation
Alternative supply / substitution
```

2. 별도 Possibility 로 세우는 기준 — 다음 중 하나 이상이 **실질적으로** 다르다.

```text
Gameplay / Cost / Risk / Relationship / Consequence
```

   답할 수 없으면 동의어이지 대안이 아니다. `meaningful_difference` 에 그 답을 적는다.

3. Constraint Filter 를 적용한다 — Active DC 로 각 후보를 평가하고
   (`SATISFIED / VIOLATED / NOT_APPLICABLE / UNRESOLVED`) 명백히 `VIOLATED` 인 후보는
   정상 경로에서 제거한다. 이것은 별도 Stage 가 아니라 이 단계 안의 Filter 다 (정책 §6).

4. **필요할 때만** 보조 규칙을 기록한다 (정책 §11) —
   Actor Conflict(`supports`/`opposes`) · Consequence(`changes`) ·
   Reveal / Reframe / New Goal. 실제 설계 결정을 바꾸지 않으면 생략한다.

5. 여러 곳에서 같은 설계 원칙이 반복될 때만 `candidates/CC-*.md` 를 제안한다.

## Output

`master/graph/possibilities.yaml` (+ `edges.yaml` · 있으면 `candidates/CC-*.md`)

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Must

- 하나의 Goal 아래 **의미 있게 다른** Possibility 를 탐색한다 (OR).
- 각 Possibility 에 Constraint Evaluation 을 기록한다 — 실제 형태에 영향을 준 DC 만.
- 새 Node 를 만들기 전에 기존 Graph 를 검색한다.

## Must Not

- 숫자를 맞추려 억지 Possibility 를 만들지 않는다 — 후보 수보다 의미 차이가 중요하다.
- `VIOLATED` 후보를 정상 경로로 흘려보내지 않는다 (Design Conflict 로 제시할 수는 있다).
- `UNRESOLVED` 를 임의로 `SATISFIED` 로 간주하지 않는다.
- 모든 Possibility 에 Conflict / Consequence / Reveal / Reframe 를 기계적으로 채우지 않는다.
- Cycle 의 수치·공식·State 이름을 Graph 에 복사하지 않는다.

## Done When

- 정책 §15 OPTIONS Quality Gate 가 참이다 —
  의미 있게 다른 방법 탐색 / 동의어·Action 이름 중복 없음 / 명백한 위반 후보 제거.
- 각 Possibility 의 `meaningful_difference` 가 읽힌다.
- Constraint 가 실제로 어떤 후보를 걸러냈는지 기록에서 보인다.
- 다음 단계(NEED)가 각 Possibility 의 Requirement 도출을 시작할 수 있다.
