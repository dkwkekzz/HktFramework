# Capability Overlay Stage Guide  (M3)

## Role

Master Capability 를 **현재 세계의 구현 상태**와 겹쳐 무엇이 이미 있고 무엇이 없는지 판정한다.
Frontier 는 이 판정에서 나온다.

## Input

- `master/graph/capabilities.yaml` · `possibilities.yaml`
- `master/overlay.md` — 직전 판정
- 관련 Cycle 의 `08-verification.md` (실측 근거)
- 필요한 경우 `world/` `view/` 실제 코드 — **읽기만 한다**

## Do

1. 판정 대상 Capability 를 고른다 — 보통 이번에 확장된 Possibility 가 요구하는 것들.
2. 각 Capability 에 대해 그 의미를 닫은 Cycle 이 있는지 찾는다.
3. 상태를 판정한다.

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
```

4. 근거를 적는다 — Cycle ID 또는 실측. **주장만 적지 않는다.**
5. `PARTIAL` 은 "무엇이 부족한가"를 반드시 함께 적는다. 이것이 Frontier 의 재료다.
6. `graph/capabilities.yaml` 의 `overlay` 필드를 같은 값으로 맞춘다.

## Output

`master/overlay.md` (+ `graph/capabilities.yaml` 의 `overlay` 필드)

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Must

- 판정 근거를 Cycle 기록 또는 실측으로 남긴다.
- `PARTIAL` 은 부족한 부분을 명시한다.
- Possibility 단위로도 읽을 수 있게 한다 — 이 Possibility 가 요구하는 것 중 무엇이 없는가.

## Must Not

- 코드가 존재한다는 이유만으로 `IMPLEMENTED` 로 판정하지 않는다 — 플레이로 닫혔는가가 기준이다.
- Constraint Violation 과 혼동하지 않는다.

```text
MISSING / PARTIAL   유효한 설계지만 세계에 아직 그 의미가 없다
VIOLATED            설계 자체가 Active Constraint 와 양립하지 않는다
```

- Overlay 판정 중 `world/` `view/` 코드를 수정하지 않는다.
- 과거 Cycle Artifact 를 수정하지 않는다.

## Done When

- 이번 확장이 요구하는 모든 Capability 에 상태와 근거가 있다.
- `PARTIAL` 항목마다 부족한 것이 적혀 있다.
- 다음 단계(M4)가 이 표만 보고 Frontier 후보를 만들 수 있다.
