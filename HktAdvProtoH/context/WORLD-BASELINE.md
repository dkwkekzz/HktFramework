# WORLD-BASELINE

> **v0 — 비어 있음.**
>
> 이 문서에는 **실제로 구현되고 검증(Verification + Evolution Compatibility 통과)된
> World Semantic 만** 들어간다. 설계 중이거나 계획 중인 의미는 여기 쓰지 않는다.
>
> 갱신은 Stage 7 (Baseline Merge) 에서만 한다 — [../stages/S7-BASELINE-MERGE.md](../stages/S7-BASELINE-MERGE.md).

## 현재 Baseline

```text
WORLD BASELINE v0

Supported State:
    (없음)

Supported Rules:
    (없음)

Supported Goals:
    (없음)

Supported Possibilities:
    (없음)

Observable:
    (없음)
```

검증된 Cycle 이 아직 없다. CYCLE-001 이 병합되면 v1 이 된다.

## 병합 이력

| Baseline | 병합한 Cycle | 추가된 Semantic | 날짜 |
|---|---|---|---|
| v0 | — | — | — |

## 기록 규칙

1. Verification Report 와 Evolution Compatibility Result 가 모두 PASS 인 Cycle 만 병합한다.
2. 병합 시 **추가된 항목마다 근거 Cycle ID 를 남긴다** — 이후 Cycle 이 재사용할 때
   원본 Intent 까지 역추적할 수 있어야 한다.
3. 구현되었지만 Observable 하지 않은 State 는 Baseline 에 넣지 않는다 (P8).
4. Baseline 항목은 Entity 단위 의미로만 기술한다 (`Actor.Inventory`, `Deposit.ResourceAmount`).
