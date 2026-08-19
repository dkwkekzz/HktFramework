# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. 기본 절차 **NEXT** 단계의 산출물이며,
Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle).

    기준 Overlay   master/overlay.md — C012 닫힘 (2026-08-18) · Q12 정비 반영
    근거 문서      **둘뿐이다** (2026-08-18 Q12 결정)
                       R1  design/Design-Combat-OffenseDefense-R0.md  §14 확장 순서 · §15 층 그림
                       DT  design/Design-Combat-DamageType-R0.md      §15 이후 확장 경계
                   두 문서가 이름조차 대지 않는 층은 후보로도 대기열로도 두지 않는다

## 지금 어디까지 왔는가

전투는 설계 §14 가 정한 순서대로 한 층씩 올린다. 저장소 Cycle 번호는 설계의 층 번호와
다르다 — Critical 층을 건너뛰었기 때문이다. 층은 번호가 아니라 **이름**으로 가리킨다.

```text
설계 §14 층          지금
────────────────────────────────────────────
Basic Damage         섰다
Critical             건너뛰었다 — Q11
Defense Action       섰다
Damage Type          섰다
Penetration          ← 다음 후보 (아래)
Active Defense       대기 — 사유는 "지금 열 수 없는 것"
Aura / Nen           대기 — 사유는 "지금 열 수 없는 것"
```

어느 Cycle 이 어느 층을 닫았는지는 [HISTORY.md](HISTORY.md) 에 있다.

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
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-COMBAT-MATCHUP-SOFT ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST
                         (SHARED-BUDGET 은 이 층이 자원을 쓰지 않으므로 무관하다)
    Constraint Eval      SATISFIED — 관통은 방어를 **확률로 무시**하지 않고 마주한 방어를
                         결정적으로 깎는다 (DC-COMBAT-PLAYER-CAUSALITY). 새 피해 공식을
                         만들지 않고 기존 감쇄식이 읽는 방어 값 하나를 바꿀 뿐이다
                         (DC-COMBAT-ONE-FORMULA · R1 핵심 원칙). 타입 대응이 고른 방어에만
                         작용하고 Damage Type 자체나 능동 방어의 효율은 건드리지 않는다
                         (DC-COMBAT-ONE-LAYER-AT-A-TIME · DamageType §15).
                         깎이기 전후의 방어를 세계가 이름과 함께 관찰에 싣는다
                         (DC-WORLD-OWNS-THE-SURFACE-LIST).
                         DC-COMBAT-MATCHUP-SOFT 는 2026-08-18 Q12 로 APPROVED 가 되어
                         이제 이 층을 실제로 구속한다 — 관통은 타입별 배율표를 만들 수 없고
                         (type_bonus_multiplier_table 금지), 아무리 깎여도 최소 1 은 남으며
                         (positive_damage_always_lands_at_least_one), 깎인 방어값이
                         관찰 가능해야 한다 (weakness_is_observable · DT §7-4 · §10)
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
| Active Defense (완벽한 막기·되받아치기) | 의존성(Guard)은 C011 로 풀렸으나 차례가 아니다 — R1 §15 층 그림에서 Penetration **위**다. 결손은 MC-PERFECT-GUARD · MC-COUNTER 둘. 두 문서는 이 층의 **이름만** 예고한다 (R1 §14 · DT §15 "이 문서는 그 효율을 정하지 않는다") — 세부는 그 층의 설계 문서가 와야 한다 |
| Break (가드 브레이크) | 같은 층(Active Defense)의 일부이며 역시 이름만 있다. 구판의 세부(균형 누적·붕괴)는 2026-08-18 삭제했다 |
| Aura / Nen (집중·조건·제약·서약) | 사다리의 맨 위다. 아래 층이 서야 의미가 생긴다. 결손 MC-COMBAT-FLOW · MC-CONDITION-STACKING · MC-VOW · MC-FORTIFY. R1 §14 가 예시 한 줄(Attack ×1.3 · Defense ×0.7 · CP -5/sec)만 공급한다 |
| Evade (회피) | R1 §13 이 이후 확장으로만 지정하고 §14 확장 순서에는 자리를 주지 않았다 |
| ~~Weak Point · Rear Attack~~ | **노드를 삭제했다** (2026-08-18 Q12) — 두 문서가 이 의미를 이름조차 대지 않는다. 필요해지면 설계 문서가 먼저 온다 |

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

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
Cycle 이 닫히면 그 FR-* 를 이 파일에서 지우고 HISTORY.md 에 결과를 적는다.
대기 사유는 근거 문서의 문장으로 확인되어야 한다 — 지어내지 않는다.
```

이 파일은 **지금 고를 수 있는 것**만 담는다. 닫힌 Cycle 의 선택 기록과 거기서 배운 것은
[HISTORY.md](HISTORY.md) 가 소유한다.
