# Master Overlay Guide (NEED — Existing World 확인)

## Role

NEED 단계의 후반 — Capability 를 현재 세계 구현 상태와 겹쳐
이미 있는지 판정한다. Frontier(NEXT)는 이 판정에서 나온다.

## Input

`graph/capabilities.yaml` · `possibilities.yaml` · `overlay.md`(직전 판정) ·
관련 Cycle 의 `08-verification.md`(실측 근거) · 필요시 `world/` `view/` 코드 — **읽기만**

## Do

1. 판정 대상 Capability 를 고른다 — 보통 이번에 확장된 Possibility 가 요구하는 것들.
2. 상태를 판정하고 근거(Cycle ID 또는 실측)를 적는다. **주장만 적지 않는다.**

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나 이번 Possibility 가 요구하는 형태에 못 미친다 — 부족한 것을 함께 적는다
MISSING       세계에 그 의미가 없다
```

3. `graph/capabilities.yaml` 의 `overlay` 필드를 같은 값으로 맞춘다.
4. Possibility 단위로도 읽을 수 있게 한다 — 이 경로가 요구하는 것 중 무엇이 없는가.

## Output

`master/overlay.md` (+ `capabilities.yaml` 의 `overlay` 필드) — 형식은 `master/SCHEMA.md`

## Must Not

- 코드가 존재한다는 이유만으로 `IMPLEMENTED` 판정하지 않는다 — 플레이로 닫혔는가가 기준이다.
- Overlay(있는가)와 Constraint Violation(허용되는가)을 혼동하지 않는다.
- `world/` `view/` 코드를 수정하지 않는다. 과거 Cycle Artifact 를 수정하지 않는다.

## Done When

- 이번 확장이 요구하는 모든 Capability 에 상태와 근거가 있고, `PARTIAL` 마다 부족한 것이 있다.
- NEXT 가 이 표만 보고 Frontier 후보를 만들 수 있다.
