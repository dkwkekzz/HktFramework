# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다.

현재 후보: **없음 — Graph 미도착**

## 후보 조건

```text
1. Existing World 에서 아직 완전히 제공되지 않는다
2. 하나 이상의 상위 Goal/Possibility 를 실제로 전진시킨다
3. Client 에서 직접 플레이하고 결과를 확인할 수 있다
4. 하나의 Cycle 안에서 의미적으로 폐쇄 가능하다
5. 단순 코드 Task 가 아니라 새로운 World/Game Capability 다
6. 적용되는 Active Constraint 와 양립한다
7. 완료 후 공유 World 에 재사용 가능한 Capability 로 누적할 수 있다
```

```text
BAD    Perfect Guard 시스템 구현
GOOD   Player 가 적의 공격 직전에 Guard 하여 피해를 받지 않고 상대를 노출시킬 수 있다
```

## 후보

<!--
### FR-<NAME>
    Playable Result      <플레이어가 무엇을 할 수 있게 되는가 — 한 문장>
    Source Goal          MG-...
    Source Possibility   MP-...
    Missing / Partial    MC-... (MISSING | PARTIAL)
    Active Constraints   DC-...
    Constraint Eval      SATISFIED | UNRESOLVED  — 판정 근거
    Observable Result    무엇을 보고 성공/실패를 아는가
    Why one Cycle        왜 한 Cycle 안에서 닫히는가
    Status               PROPOSED | SELECTED | DEFERRED | DROPPED
-->

    없음

## 선택 기록

| Frontier | 결정 | Cycle | 비고 |
|---|---|---|---|
| — | — | — | — |

## 규칙

```text
VIOLATED 후보를 여기에 올리지 않는다 — Design Conflict 로 Human 에게 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
```
