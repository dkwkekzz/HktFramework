# constraints/ — 승인된 Design Constraint

파일 하나 = Constraint 하나. 이름은 `DC-<NAME>.yaml`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **Active(APPROVED) 5종** — 보류(DRAFT)는 없다.

근거 문서는 **둘뿐이다** (2026-08-18 Human 결정).

```text
R1 §x   design/Design-Combat-OffenseDefense-R0.md   2026-08-17 R1 전면 개정판
DT §x   design/Design-Combat-DamageType-R0.md
```

삭제된 구판(R0)은 더 이상 근거가 아니다. 구판에만 근거가 있던 Constraint 는 보류가 아니라
**삭제**한다 — 필요해지면 그 층의 설계 문서가 나온 뒤 새로 만든다.

### Active — APPROVED

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-COMBAT-PLAYER-CAUSALITY | 중요한 결과는 관찰 가능한 원인과 플레이어의 선택에서 — 난수 명중·회피·피해·크리티컬 금지 | R1 §0 · §6 · §9 · DT §8 · §10 |
| DC-COMBAT-ONE-FORMULA | 기반 피해 공식은 하나 — 새 시스템은 공식의 입력/결과에 한 가지 의미만 더한다 | R1 핵심 원칙 · §15 · DT §5 · §17 |
| DC-COMBAT-ONE-LAYER-AT-A-TIME | 한 번에 한 층 — 현재 층이 플레이로 검증되기 전에 다음 층을 올리지 않는다 | R1 §0 · §13 · §14 · §16 · DT §13 · §15 |
| DC-COMBAT-SHARED-BUDGET | 전투 행동은 하나의 기력 예산을 나눈다 — 행동별 전용 게이지 신설 금지 | R1 §1 · §11 · §14 Aura/Nen · 핵심 원칙 |
| DC-COMBAT-MATCHUP-SOFT | 상성은 선택을 만들되 지배하지 않는다 — 배율표가 아니라 대응 능력치 차이로만 | DT §4 · §5 · §7 · §14-7 · §14-10 |

`DC-WORLD-OWNS-THE-SURFACE-LIST` 는 위 표와 성격이 다르다 — 전투 기획서가 아니라
Cycle 관찰(C007 → C009 → C010)에서 승격된 GLOBAL Constraint 다. 근거는
`candidates/CC-WORLD-OWNS-THE-SURFACE-LIST.md` 이며 DT §10 · §16.3-6 이 같은 방향을
독립적으로 지지한다 (세계가 보낸 값이 권위이고 View 가 추측하지 않는다).

반영·삭제 이력은 [../HISTORY.md](../HISTORY.md) 가 소유한다 — 이 파일에는 지금 살아 있는
Constraint 만 남긴다.

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
Agent 가 임의로 추가·삭제·완화하지 않는다 — 승인도 삭제도 Human 이다
근거 문서에 없는 의미를 남겨 두지 않는다 — 보류가 아니라 삭제한다
삭제한 것을 이 파일에 남겨 두지 않는다 — 이력은 ../HISTORY.md 로
원본 문서보다 세게 쓰지 않는다 — 정도 조절을 금지로 바꾸지 않는다
충돌을 임의로 해결하지 않는다 — conflicts_with 로 노출하고 Human 이 결정한다
```
