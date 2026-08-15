# constraints/ — 승인된 Design Constraint

파일 하나 = Constraint 하나. 이름은 `DC-<NAME>.yaml`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **5종** — 2026-08-15 Human 지시로 `design/Design-Combat-OffenseDefense-R0.md` 의
명시 원칙을 반영했다. 문안은 Agent 가 추출했으므로 검토 대상이다 (../open-questions.md Q9).

| Constraint | 한 줄 | 원본 근거 |
|---|---|---|
| DC-COMBAT-PLAYER-CAUSALITY | 중요한 결과는 관찰 가능한 원인과 플레이어의 선택에서 — 난수 명중·회피·피해·크리티컬 금지 | §1 · §2 · §23 |
| DC-COMBAT-DEFENSE-IS-ACTIVE | 방어는 수치로 끝나지 않는 능동 행동 — 성공이 공격 기회로 전환될 수 있다 | §1.1 · §3.2 |
| DC-COMBAT-POWER-HAS-COST | 집중은 반대쪽을 비우고, 위력은 검증 가능한 제약·위험과 교환되며, 실패 대가는 즉시 적용 | §3.3 · §12 |
| DC-COMBAT-SHARED-BUDGET | 전투 행동은 하나의 기력 예산을 나눈다 — 행동별 전용 게이지 신설 금지 | §11 |
| DC-COMBAT-MATCHUP-SOFT | 상성은 선택을 만들되 지배하지 않는다 (prefers 만 — 원본이 정도 조절이므로) | §3.1 · §6.2 |

## 반영 이력

첫 반영(DC 4종)은 Agent 의 해석이 원본보다 강한 곳이 있어 Human 지시로 제거됐다 —
원본은 "피해 상성 폭을 작게 유지" 라고 하지 금지라고 하지 않았고, "플레이어가 상대의
Flow 를 읽는다" 고 하지 "모든 위험이 상대에게 읽혀야 한다" 고 하지 않았다.
이번 반영은 원본이 명시적으로 금지한 것만 `prohibits` 에, 정도 조절은 `prefers` 에 뒀다.

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
