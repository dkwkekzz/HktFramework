# WORLD-BASELINE

> 현재까지 **실제 구현 및 검증된** World Semantic만 포함한다. Cycle 종료(Evolution Compatibility 통과 + Baseline Merge)마다 갱신한다.
> 검증되지 않은 Semantic은 여기에 추가할 수 없다 (RULE 11).
> Backlog에 있다는 이유로 placeholder / dummy field를 만들지 않는다.

## WORLD BASELINE v0

아직 어떤 Cycle도 완료되지 않았다. 세계는 비어 있다.

```text
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

## Baseline 갱신 규칙

1. Cycle의 Verification Report와 Evolution Compatibility Result가 모두 통과한 뒤에만 병합한다.
2. 병합 시 버전을 올린다 (v0 → v1 → …) 하고, 아래 History에 어떤 Cycle이 무엇을 추가했는지 기록한다.
3. Supported State / Rules / Goals / Possibilities / Observable 항목만 기재한다 — 구현 세부(클래스, 파일 구조)는 기재하지 않는다.

## History

| Baseline | Cycle | Capability Added | 병합일 |
|---|---|---|---|
| v0 | — | 초기 상태 (빈 세계) | 2026-08-11 |
