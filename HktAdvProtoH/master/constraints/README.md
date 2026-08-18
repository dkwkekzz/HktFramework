# constraints/ — 승인된 Design Constraint

파일 하나 = Constraint 하나. 이름은 `DC-<NAME>.yaml`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **Active(APPROVED) 4종 + 보류(DRAFT) 3종** — 2026-08-17 Human 지시로
`design/Design-Combat-OffenseDefense-R0.md` **R1 전면 개정**("기본 공격/방어 공식 먼저")에
맞춰 재작성했다. 인용 표기: R1 §x 는 현행 문서, 구판 §x 는 git history 의 R0.

### Active — APPROVED

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-COMBAT-PLAYER-CAUSALITY | 중요한 결과는 관찰 가능한 원인과 플레이어의 선택에서 — 난수 명중·회피·피해·크리티컬 금지 | R1 §0 · §6 · §9 |
| DC-COMBAT-ONE-FORMULA | 기반 피해 공식은 하나 — 새 시스템은 공식의 입력/결과에 한 가지 의미만 더한다 | R1 핵심 원칙 · §15 |
| DC-COMBAT-ONE-LAYER-AT-A-TIME | 한 번에 한 층 — 현재 층이 플레이로 검증되기 전에 다음 층을 올리지 않는다 | R1 §0 · §13 · §14 · §16 |
| DC-COMBAT-SHARED-BUDGET | 전투 행동은 하나의 기력 예산을 나눈다 — 행동별 전용 게이지 신설 금지 | R1 §11 · §16-3 (금지는 구판 §11 유래) |

### 보류 — DRAFT (R1 이연 층의 재설계 문서가 나올 때 재검토·재승인)

| Constraint | 한 줄 | 대상 층 |
|---|---|---|
| DC-COMBAT-DEFENSE-IS-ACTIVE | 방어는 수치로 끝나지 않는 능동 행동 | R1 §14 Defense Action(Guard) · Active Defense 층 |
| DC-COMBAT-MATCHUP-SOFT | 상성은 선택을 만들되 지배하지 않는다 | R1 §14 Damage Type 층 |
| DC-COMBAT-POWER-HAS-COST | 집중은 반대쪽을 비우고 위력은 제약·위험과 교환된다 | R1 §14 Aura/Nen 층 |

보류는 삭제가 아니다 — 문안과 이력을 보존하고, Active Constraint 판정(Frontier 조건 6 ·
Graph 평가)에서만 제외한다. 노드들의 기존 constraint_evaluation 기록도 지우지 않는다.

## 반영 이력

첫 반영(DC 4종)은 Agent 의 해석이 원본보다 강한 곳이 있어 Human 지시로 제거됐다 —
원본은 "피해 상성 폭을 작게 유지" 라고 하지 금지라고 하지 않았고, "플레이어가 상대의
Flow 를 읽는다" 고 하지 "모든 위험이 상대에게 읽혀야 한다" 고 하지 않았다.
2026-08-15 반영(5종)은 원본이 명시적으로 금지한 것만 `prohibits` 에, 정도 조절은
`prefers` 에 뒀다.

2026-08-17 — 기획서 R1 전면 개정 + C010·C011 구현 롤백에 따라 Human 지시로 재작성.
CAUSALITY·SHARED-BUDGET 은 R1 기준 재정합(APPROVED 유지), ONE-FORMULA ·
ONE-LAYER-AT-A-TIME 신설, 이연 층 근거의 3종은 DRAFT 보류. R1 §14 Critical 층(Critical Chance)과
CAUSALITY 의 random_critical 금지 충돌은 미해결 → ../open-questions.md Q11.

## 이것이 무엇인가

게임의 Goal/Possibility/Capability/World Rule 이 **어떤 형태로 존재할 수 있는지** 제한하거나
방향짓는 Human-owned Design Intent. Actor 의 Goal 이 아니다.

Constraint 는 Master 기본 절차(WHY → OPTIONS → NEED → NEXT)의 **단계가 아니다** —
각 선택 지점에서 적용되는 Filter 다 (정책 §2.3 · §10). Constraint 작업(신설·재작성·승인)은
Human 이 요청할 때만 별도로 수행한다.

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
