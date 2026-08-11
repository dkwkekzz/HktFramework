# STAGE-6-EVOLUTION-REVIEW — Evolution Compatibility Review

## 역할

현재 Cycle에서 만든 구조가 최종 Open World MMORPG 방향을 **불필요하게 제한하는지** 검사한다.
미래 기능이 구현되어 있는지를 검사하는 것이 아니다.

## 입력

- `state/cycles/cycle-XXX/00-cycle-contract.md` (Evolution Questions)
- `state/cycles/cycle-XXX/02-world-definition.md`
- `state/cycles/cycle-XXX/05-verification-report.md`
- `design/Design-TargetHorizon.md`

## 출력

- `state/cycles/cycle-XXX/06-evolution-review.md` — [../templates/EVOLUTION-COMPATIBILITY-RESULT.md](../templates/EVOLUTION-COMPATIBILITY-RESULT.md) 형식
- 필요 시 `state/EVOLUTION-BACKLOG.md` 항목 추가

## 검사 방법

Contract에 정의된 Evolution Questions 각각에 대해, **답이 구조적으로 막혀 있는지**를 코드/World Definition 근거와 함께 판정한다.

판정 기준 예:

```text
문제 있음:  World.playerInventory  (단일 Player를 의미적으로 가정)
문제 없음:  Actor01.Inventory      (Actor02를 같은 모델에 추가 가능)
```

- 답을 실제로 구현할 필요는 없다 — 같은 의미 모델 안에서 추가가 가능하면 통과다.
- 현재 Runtime instance가 하나뿐인 것은 문제가 아니다. 의미 모델이 하나만 허용하는 것이 문제다.
- 반대 방향도 검사한다: 확장성을 이유로 만든 **과도한 구현 추상화**(RULE 8 위반)도 지적한다.

## 판정

- 모든 질문이 통과 → `PASS` — Baseline Merge Stage로 넘길 수 있는 상태.
- 하나라도 구조적으로 막혀 있음 → `FAIL` — 막힌 지점과 필요한 재설계 방향을 기록. Cycle은 완료되지 않은 것이다. 수정은 별도 invocation (World Model 또는 Implementation Stage 재진입).

## STOP 조건

Evolution Compatibility Result 저장 + 진행 표 갱신 후 STOP. Baseline Merge를 이어서 실행하지 않는다.
