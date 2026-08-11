# STAGE-7-BASELINE-MERGE — World Baseline Merge

## 역할

검증 완료된 Cycle의 Semantic을 `context/WORLD-BASELINE.md`에 병합하고 Cycle을 닫는다.

## 입력 (Gate — 모두 충족해야 진행 가능)

- `cycles/cycle-XXX/05-verification-report.md` — 4개 Closure 모두 통과
- `cycles/cycle-XXX/06-evolution-review.md` — PASS

## 출력

- `context/WORLD-BASELINE.md` — 버전 증가 (vN → vN+1), Supported State / Rules / Goals / Possibilities / Observable 갱신, History 행 추가
- `context/CURRENT-CYCLE.md` — "활성 Cycle 없음" 상태로 초기화 (다음 Contract 대기)
- `STATE.md` — Cycle 완료 기록

## 병합 원칙

1. **검증된 Semantic만** 추가한다 (RULE 11) — Verification Report에서 실제 확인된 항목만.
2. Baseline에는 세계 의미만 기재한다 — 구현 세부(클래스/파일)는 기재하지 않는다.
3. 병합 전 Cycle 완료 체크리스트(워크플로 원문 §26의 11개 항목)를 모두 확인하고, 하나라도 실패면 병합하지 않는다.

## Cycle 완료 체크리스트

```text
[ ] Cycle Scope가 명확하다.
[ ] Goal / Possibility Trace가 존재한다.
[ ] Intent가 명확하다.
[ ] Intent의 모든 의미가 World State / Rule에 존재한다.
[ ] World Rule에 의한 실제 Transition이 발생한다.
[ ] Transition이 Observable하다.
[ ] 인간이 설계 언어로 결과를 확인할 수 있다.
[ ] Runtime에서 Design까지 역추적할 수 있다.
[ ] 새로운 Semantic이 기존 Baseline과 연결된다.
[ ] 현재 구현이 Target Horizon을 구조적으로 막지 않는다.
[ ] 검증된 결과가 World Baseline에 병합되었다.
```

## STOP 조건

Baseline 병합 + CURRENT-CYCLE 초기화 + STATE.md 기록 후 STOP. 다음 Cycle의 Scope Definition을 이어서 실행하지 않는다.
