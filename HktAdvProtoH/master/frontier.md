# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다.

    기준 Overlay   master/overlay.md — C012 닫힘 (2026-08-18) 시점
    사다리 원본    design/Design-Combat-OffenseDefense-R0.md **R1** §14 확장 순서 · §15 층 그림
    층 세부 원본   각 층이 자기 문서를 가진다 (아래 "층별 원본" 참조)

## 지금 어디까지 왔는가

전투는 설계 §14 가 정한 순서대로 한 층씩 올린다. 저장소 Cycle 번호는 설계의 층 번호와
다르다 — Critical 층을 건너뛰었기 때문이다. 층은 번호가 아니라 **이름**으로 가리킨다.

```text
설계 §14 층          저장소 Cycle                            상태
──────────────────────────────────────────────────────────────────────────────
Basic Damage         C010-stats-decide-the-damage            CLOSED  2026-08-17
Critical             —                                       SKIPPED  Q11 (아래)
Defense Action       C011-guard-trades-body-for-resource     CLOSED  2026-08-17
Damage Type          C012-damage-type-chooses-the-defense    CLOSED  2026-08-18
Penetration          (다음 Cycle 후보)                        ← 여기
Active Defense       —                                       대기
Aura / Nen           —                                       대기
```

세 층이 닫히면서 **Possibility 세 개가 실제로 플레이 가능해졌다** —
MP-OUTGROW-THE-OPPONENT · MP-TRADE-BODY-FOR-RESOURCE · MP-MATCH-WEAPON-TO-ARMOR.

## 후보

### FR-PENETRATION-DEVALUES-THE-WALL
    Playable Result      플레이어가 방어를 두껍게 굳혀 벽처럼 버티는 상대 앞에서,
                         그 방어를 얼마간 통하지 않게 만들어 제 피해를 넣는다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-PIERCE-THE-HARD-DEFENSE
    Missing / Partial    MC-PENETRATION (MISSING) — **이것 하나뿐이다**.
                         MP-PIERCE-THE-HARD-DEFENSE 가 요구하는 나머지 3종
                         (MC-ATTACK-ARMOR-MATCHUP · MC-DEFENSE-MITIGATION ·
                         MC-COMBAT-STRIKE)과 지식 MK-OPPONENT-DEFENSE-SHAPE 는
                         이미 세계에 있다 — 마지막 둘을 C012 가 채웠다
    원본 근거            R1 §14 Penetration (무엇을 더하는가) ·
                         design/Design-Combat-DamageType-R0.md §15 (어디에 붙는가 ·
                         무엇을 하면 안 되는가) · R1 핵심 원칙 (새 공식을 만들지 않는다)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 관통은 방어를 **확률로 무시**하지 않고 마주한 방어를
                         결정적으로 깎는다 (DC-COMBAT-PLAYER-CAUSALITY). 새 피해 공식을
                         만들지 않고 기존 감쇄식이 읽는 방어 값 하나를 바꿀 뿐이다
                         (DC-COMBAT-ONE-FORMULA · R1 핵심 원칙). 타입 대응이 고른 방어에만
                         작용하고 Damage Type 자체나 능동 방어의 효율은 건드리지 않는다
                         (DC-COMBAT-ONE-LAYER-AT-A-TIME · DamageType §15).
                         깎이기 전후의 방어를 세계가 이름과 함께 관찰에 싣는다
                         (DC-WORLD-OWNS-THE-SURFACE-LIST).
                         참고 — DC-COMBAT-MATCHUP-SOFT 는 DRAFT(보류)다. 이 층은 그 DC 가
                         정한 "상성은 별도 배율표가 아니다" 를 유지해야 하지만, 현재
                         Active 가 아니므로 판정 근거로 세지 않는다 → Q12
    Observable Result    같은 상대·같은 스킬인데 관통을 지닌 쪽이 더 큰 피해를 넣고,
                         그 차이가 "상대 방어가 얼마나 통하지 않았는가" 로 계산 내역에
                         설명되며, 방어가 두꺼운 상대일수록 그 몫이 커지고 무른 상대에게는
                         거의 달라지지 않는 것이 보인다
    Why one Cycle        새 공식이 없다. 계산 앞에 고르는 단계를 하나 더 세우는 것도 아니다 —
                         C012 가 이미 고른 방어 값에, 그 값을 깎는 의미 하나가 붙는다.
                         새 행동도 새 모션 자산도 필요 없다
    7 조건               1 아직 없다 (MC-PENETRATION MISSING) ·
                         2 MG-OVERCOME-SUPERIOR-OPPONENT 의 네 번째 경로를 연다 ·
                         3 두 존재의 관통·방어를 바꿔 보며 Client 에서 확인된다 ·
                         4 한 Cycle 에 닫힌다 (위 Why one Cycle) ·
                         5 코드 Task 가 아니라 "방어를 올리는 것만으로는 안전하지 않다" 는
                           새 World 규칙이다 · 6 Active 4종과 양립 (위 Constraint Eval) ·
                         7 Active Defense 층이 그대로 얹힌다
    Status               PROPOSED — Human 선택 대기

## 지금 열 수 없는 것

각각 막힌 이유가 다르다. 이유가 사라지면 후보로 올린다.

| 층 / 후보 | 무엇이 막고 있는가 |
|---|---|
| Critical | DC-COMBAT-PLAYER-CAUSALITY 와 충돌 — Human 결정 대기 (Q11). R1 자신이 건너뛰기를 허용한다 ("Basic Damage 는 Critical 없이도 완전히 동작해야 한다") |
| Active Defense (완벽한 막기·되받아치기) | 의존성(Guard)은 C011 로 풀렸으나 차례가 아니다 — R1 §15 층 그림에서 Penetration **위**다. 결손은 MC-PERFECT-GUARD · MC-COUNTER 둘 |
| Aura / Nen (집중·조건·제약·서약) | 사다리의 맨 위다. 아래 층이 서야 의미가 생긴다. 결손 MC-COMBAT-FLOW · MC-CONDITION-STACKING · MC-VOW · MC-FORTIFY |
| Break (균형 붕괴) | R1 이 이 층의 세부(균형 누적·붕괴)를 삭제했다. 재설계 문서 대기 |
| Evade (회피) · Weak Point · Rear Attack | R1 §13 이 이번 사다리의 범위에서 제외했다 |

### 층을 후보로 세우는 조건

한 층은 원본이 다음 셋을 지정할 때 후보가 된다. 셋 중 하나라도 없으면 Cycle 이
없는 설계를 지어내 메우게 된다.

```text
1. 무엇을 더하는가        그 층이 세계에 세우는 의미
2. 어디에 붙는가          기존 공식·구조의 어느 지점에 작용하는가
3. 무엇을 하면 안 되는가   아래 층을 어떻게 침범하지 않는가
```

Penetration 은 셋을 모두 갖추었다 — R1 §14 가 1, DamageType R0 §15 가 2 와 3 이다.
(2026-08-18 명확화 — 이전 문안은 "층마다 자기 문서가 도착해야 한다" 였고, 그래서
§14 + 다른 층 문서의 경계 규정으로 이미 셋이 채워진 Penetration 이 근거 없이 막혀 있었다.)

## 선택 기록

| Frontier | Cycle | 결과 |
|---|---|---|
| FR-STATS-DECIDE-THE-DAMAGE | C010-stats-decide-the-damage | **CLOSED** 2026-08-17 — MC-ATTACK-POWER · MC-SKILL-SCALING · MC-DEFENSE-MITIGATION 승격 |
| FR-GUARD-TRADES-BODY-FOR-RESOURCE | C011-guard-trades-body-for-resource | **CLOSED** 2026-08-17 — MC-GUARD 승격 (overlay 반영 2026-08-18) |
| FR-MATCHUP-MAKES-THE-CHOICE | C012-damage-type-chooses-the-defense | **CLOSED** 2026-08-18 — MC-ATTACK-ARMOR-MATCHUP 승격 · MK-OPPONENT-DEFENSE-SHAPE 확립 |

    롤백된 것 (2026-08-17 Human 결정 — R1 층 순서와 어긋나 되돌렸다. 산출물은 git history)
        구 C010-guard-trades-body-for-resource · 구 C011-perfect-guard-turns-the-table
        Active Defense 층을 재구축할 때 그 산출물을 참조할 수 있다.

### 배운 것

    Playable Result 에는 **이번 층에서 실제로 제공되는 수단**을 적는다.
    FR-STATS-DECIDE-THE-DAMAGE 는 능력치 차이를 "장비·성장으로" 만든다고 적었으나 그 층은
    R1 §13 이 제외한 범위였고, Cycle 이 C009 디버그 명령으로 메워야 했다 (C010 05-review.md).

    Overlay 를 미루면 Frontier 가 거짓말을 한다.
    C011·C012 가 닫히는 동안 MF 가 밀려 이미 채워진 Capability 가 결손으로 남아 있었고,
    그 상태의 Frontier 는 "다음에 할 것이 없다" 로 읽혔다. Cycle 이 닫히면 MF 를 먼저 돌린다.

    Graph 에 노드가 없으면 그 층은 Frontier 에 나타나지 못한다.
    Penetration 이 그랬다 — 설계가 다음 층으로 지정하고 있는데도 MC-*/MP-* 가 없어
    Overlay 의 MISSING 목록에 들어가지 못했고, 결과적으로 후보가 될 길이 없었다.
    설계가 예고한 층은 닫히기 전에 **노드로 먼저 세워 둔다** (M2).

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
```
