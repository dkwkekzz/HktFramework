# constraints/ — 승인된 Design Constraint

파일 하나 = Constraint 하나. 이름은 `DC-<NAME>.yaml`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **없음**

전투 기획서에서 산출했던 DC 4종은 Human 지시로 제거했다 (Agent 의 해석이 원본보다
강한 곳이 있었다 — 원본은 "피해 상성 폭을 작게 유지" 라고 하지 금지라고 하지 않았고,
"플레이어가 상대의 Flow 를 읽는다" 고 하지 "모든 위험이 상대에게 읽혀야 한다" 고 하지 않았다).

Constraint 는 Human 이 세운다. 그때까지 Graph 의 `constraints` · `constraint_evaluation`
필드는 비어 있고, Frontier 의 후보 조건 6번은 판정되지 않는다.

## 이것이 무엇인가

게임의 Goal/Possibility/Capability/World Rule 이 **어떤 형태로 존재할 수 있는지** 제한하거나
방향짓는 Human-owned Design Intent. Actor 의 Goal 이 아니다.

```text
Goal        Actor 가 어떤 이유로 원하는 Desired State
Constraint  그 Goal 과 해결 방법이 어떤 설계 원칙 안에서 만들어져야 하는지
```

## 금지

```text
수치·상수·판정 공식을 넣지 않는다      "Perfect Guard 는 0.20초여야 한다"  → Cycle 소유
시스템 목록을 만들지 않는다            Constraint → Combat System → Guard/Break/…  → BAD
특정 구현 모듈을 이유 없이 강제하지 않는다
Agent 가 임의로 추가·삭제·완화하지 않는다 — 승인은 Human 이다
원본 문서보다 세게 쓰지 않는다 — 정도 조절을 금지로 바꾸지 않는다
충돌을 임의로 해결하지 않는다 — conflicts_with 로 노출하고 Human 이 결정한다
```
