# Stage 6 — Evolution Compatibility

> 현재 Cycle 에서 만든 구조가 최종 Open World MMORPG 방향을 **불필요하게 제한하는가?**

미래 기능이 구현되어 있는지를 검사하는 것이 **아니다.**

## 입력

```text
context/TARGET-HORIZON.md
context/EVOLUTION-BACKLOG.md
cycles/<cycle-id>/00-CYCLE-CONTRACT.md      (Evolution Questions)
cycles/<cycle-id>/02-WORLD-DEFINITION-PACKAGE.md
cycles/<cycle-id>/05-VERIFICATION-REPORT.md (PASS 여야 함)
Repository (읽기)
```

## 출력

```text
cycles/<cycle-id>/06-EVOLUTION-COMPATIBILITY-RESULT.md
```

템플릿: [../templates/EVOLUTION-COMPATIBILITY-RESULT.md](../templates/EVOLUTION-COMPATIBILITY-RESULT.md)

## 검사 1 — Contract 의 Evolution Questions

Contract 에 적힌 질문에 하나씩 답한다. 각 답은 셋 중 하나다.

```text
OPEN        구조적으로 가능하다. 어떤 의미를 추가하면 되는지 한 줄로 설명한다.
COSTLY      가능하지만 기존 Semantic 일부를 재정의해야 한다. 무엇을 재정의해야 하는지 적는다.
BLOCKED     기존 Semantic 을 폐기해야 한다. → Cycle 미완료.
```

`BLOCKED` 가 하나라도 있으면 이 Cycle 은 완료되지 않는다.
답을 **구현할 필요는 없다.**

## 검사 2 — Entity 단위 의미 감사

Permanent Semantic Foundation 이 단일 Actor / 단일 자원 가정에 묶여 있는지 검사한다.

```text
위반 패턴                        올바른 패턴
world.playerInventory            actors[id].inventory
world.playerPosition             actors[id].position
world.playerStoneCount           deposits[id].resourceAmount
mineStone()                      mine(actor, deposit, tool)
if (actor === "Arin")            (특정 instance 분기 없음)
STONE_AMOUNT 전역 상수           deposit.resourceType / resourceAmount
```

Runtime instance 가 하나뿐인 것은 **문제가 아니다.**
Semantic Model 이 하나뿐이라고 **가정하는 것**이 문제다.

구체적으로 확인한다.

```text
[ ] Actor02 를 같은 의미 모델로 추가할 수 있는가 (코드 구조 변경 없이 데이터만으로)
[ ] 다른 ResourceType 을 같은 모델로 표현할 수 있는가
[ ] 다른 Entity 가 같은 Rule 의 Input 이 될 수 있는가
[ ] Rule 이 특정 instance 이름에 의존하지 않는가
```

## 검사 3 — 과잉 추상화 감사 (RULE 8)

반대 방향의 위반도 검사한다. 현재 Cycle 에 필요 없는데 미래를 예측해 만든 구조.

```text
현재 구현체가 하나뿐인 Factory / Strategy / Registry
사용처가 없는 확장 지점 (hook, plugin slot)
Backlog 항목을 위한 placeholder / dummy field
```

**일반화해야 하는 것은 World Semantic 이고, Implementation Mechanism 이 아니다.**
발견되면 `WARN` 으로 기록하고 Stage 4 로 되돌려 제거한다.

## 검사 4 — Semantic Overlap (RULE 9)

첫 Cycle 이 아니라면: 기존 Baseline Semantic 을 **실제로 재사용**했는가.
이름만 다른 중복 Semantic 을 만들지 않았는가.

```text
재사용한 Baseline 항목:
새로 만든 항목:
중복 의심 쌍:
```

## 검사 5 — Backlog 갱신

`context/EVOLUTION-BACKLOG.md` 의 `현재 설계가 막고 있는가` 열을 이번 검사 결과로 갱신한다.
새로 드러난 미래 의미가 있으면 항목을 추가한다 (placeholder 는 만들지 않는다).

## 판정

```text
PASS   BLOCKED 없음, Entity 단위 의미 위반 없음, 과잉 추상화 없음
WARN   제거 가능한 과잉 추상화나 COSTLY 항목 존재 — 기록 후 인간 판단
FAIL   BLOCKED 또는 Entity 단위 의미 위반 존재 → Cycle 미완료
```

## 종료

`06-EVOLUTION-COMPATIBILITY-RESULT.md` 작성 → `context/CURRENT-CYCLE.md` 갱신 → **STOP.**
Baseline 병합을 겸하지 않는다. Stage 7 은 별도 invocation 이다.
