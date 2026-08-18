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

## 반영 이력

첫 반영(DC 4종)은 Agent 의 해석이 원본보다 강한 곳이 있어 Human 지시로 제거됐다 —
원본은 "피해 상성 폭을 작게 유지" 라고 하지 금지라고 하지 않았고, "플레이어가 상대의
Flow 를 읽는다" 고 하지 "모든 위험이 상대에게 읽혀야 한다" 고 하지 않았다.
2026-08-15 반영(5종)은 원본이 명시적으로 금지한 것만 `prohibits` 에, 정도 조절은
`prefers` 에 뒀다.

2026-08-17 — 기획서 R1 전면 개정 + C010·C011 구현 롤백에 따라 Human 지시로 재작성.
CAUSALITY·SHARED-BUDGET 은 R1 기준 재정합(APPROVED 유지), ONE-FORMULA ·
ONE-LAYER-AT-A-TIME 신설, 이연 층 근거의 3종은 DRAFT 보류.

2026-08-18 (Q12 결정) — **보류를 없애고 근거 문서를 둘로 못 박았다.**

```text
삭제  DC-COMBAT-DEFENSE-IS-ACTIVE   근거가 구판 §1.1 · §3.2 · §8 뿐이다.
                                    현행 R1 §8 은 오히려 "이번 단계의 방어는 버튼을 누르는
                                    행동이 아니다" 라고 하고, §14 Active Defense 층은
                                    이름만 예고하며, DT §15 는 "이 문서는 그 효율을 정하지
                                    않는다" 고 명시한다 → 남길 근거가 없다.
삭제  DC-COMBAT-POWER-HAS-COST      근거가 구판 §3.3 · §7 · §12 · §21 뿐이다.
                                    현행 R1 §14 Aura/Nen 은 예시 한 줄(Attack ×1.3 ·
                                    Defense ×0.7 · CP -5/sec)만 두고 제약·서약의 원칙을
                                    규정하지 않는다 → 남길 근거가 없다.
재승인 DC-COMBAT-MATCHUP-SOFT       DT §7 이 문안을 직접 제시한다. break_efficiency 는
                                    DT §7 이 "채택하지 않는다" 고 명시하므로 삭제.
                                    보류 사유(근거 층 부재)는 C012 로 사라졌다 → APPROVED.
정리  나머지 4종                     구판 § 인용을 전부 제거하고 R1 / DT 로 재근거했다.
```

두 DC 를 참조하던 Graph 노드의 `constraints` · `constraint_evaluation` 항목도 함께
제거했다. 이 DC 들이 필요해지면 해당 층(Active Defense · Aura/Nen)의 설계 문서가 나온 뒤
그 문서를 근거로 새로 만든다 — 근거 없는 문안을 보존해 두지 않는다.

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
근거 문서에 없는 의미를 남겨 두지 않는다 — 보류가 아니라 삭제한다 (2026-08-18)
원본 문서보다 세게 쓰지 않는다 — 정도 조절을 금지로 바꾸지 않는다
충돌을 임의로 해결하지 않는다 — conflicts_with 로 노출하고 Human 이 결정한다
```
