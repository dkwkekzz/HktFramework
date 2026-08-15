# constraints/ — 승인된 Design Constraint

파일 하나 = Constraint 하나. 이름은 `DC-<NAME>.yaml`.

현재: **없음** — 첫 Constraint 는 Human 이 `root.md` 의 World Premise 에서 도출하거나,
`../candidates/` 의 후보를 승인하며 생긴다.

## 이것이 무엇인가

게임의 Goal/Possibility/Capability/World Rule 이 **어떤 형태로 존재할 수 있는지** 제한하거나
방향짓는 Human-owned Design Intent. Actor 의 Goal 이 아니다.

```text
Goal        Actor 가 어떤 이유로 원하는 Desired State
Constraint  그 Goal 과 해결 방법이 어떤 설계 원칙 안에서 만들어져야 하는지
```

## 형식

[../SCHEMA.md](../SCHEMA.md) 의 `constraints/DC-*.yaml` 절이 단일 출처다.

## 금지

```text
수치·상수·판정 공식을 넣지 않는다      "Perfect Guard 는 0.20초여야 한다"  → Cycle 소유
시스템 목록을 만들지 않는다            Constraint → Combat System → Guard/Break/…  → BAD
특정 구현 모듈을 이유 없이 강제하지 않는다
Agent 가 임의로 추가·삭제·완화하지 않는다 — 승인은 Human 이다
충돌을 임의로 해결하지 않는다 — conflicts_with 로 노출하고 Human 이 결정한다
```
