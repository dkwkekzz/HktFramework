# CURRENT-CYCLE

> 현재 Cycle 의 Scope 와 진행 위치만 담는다.
> Cycle 종료 후 새로운 Cycle 로 교체한다.

## 현재 Cycle

| 항목 | 값 |
|---|---|
| Cycle ID | `CYCLE-001` |
| 이름 | Mining — Resource Extraction |
| Contract | [../cycles/CYCLE-001-mining/00-CYCLE-CONTRACT.md](../cycles/CYCLE-001-mining/00-CYCLE-CONTRACT.md) |
| Contract 상태 | **DRAFT** — 인간 확정 대기 |
| 기준 Baseline | `v0` (비어 있음) |

## Stage 진행 위치

```text
▶ Stage 0  Cycle Scope            DRAFT — 인간 확정 대기
  Stage 1  Intent                 대기
  Stage 2  World Model            대기
  Stage 3  Human Semantic Review  대기
  Stage 4  Implementation         대기
  Stage 5  Verification           대기
  Stage 6  Evolution Compatibility 대기
  Stage 7  Baseline Merge         대기
```

**다음 행동**: 인간이 `00-CYCLE-CONTRACT.md` 를 확정(또는 수정)한다.
확정되면 별도 invocation 에서 Stage 1 (Intent) 을 시작한다.

## 갱신 규칙

- 각 Stage 는 자신이 끝난 직후 이 표의 자기 줄만 갱신하고 STOP 한다.
- 다음 Stage 를 이어서 실행하지 않는다 (RULE 1 / RULE 2).
- Cycle 이 Baseline 에 병합되면 이 문서를 새 Cycle 로 통째로 교체한다.
