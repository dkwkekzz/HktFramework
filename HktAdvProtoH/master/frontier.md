# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다.

출처: `design/Design-Combat-OffenseDefense-R0.md` **R1 (2026-08-17 전면 개정)** §14 확장 순서
+ `overlay.md`

> **번호 주의** — 원본 문서는 자신을 "C008" 로 부르고 §14 에 C008~C014 단계 번호를 쓰지만,
> 전부 **문서 내부 번호**다. 이 저장소의 Cycle 번호는 C011 까지 쓰였다(C010·C011 은
> 롤백되었지만 번호는 재사용하지 않는다). 다음 Cycle 은 **C012** 다.

> **R1 개정 + 롤백 반영 (2026-08-17)** — Human 이 전투 기획을 "가장 단순한 공격/방어
> 공식 먼저" 로 재정의하고, 층 순서와 어긋나게 먼저 올라갔던 C010·C011(막기 계열) 구현을
> 롤백하기로 결정했다. Constraint 는 R1 기준으로 재작성되었다 (`constraints/` —
> Active 4종 · 보류 3종). C009(Critical) 층은 DC-COMBAT-PLAYER-CAUSALITY 와 충돌하므로
> 후보로 올리지 않았다 → `open-questions.md` Q11.

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

## 후보

### FR-STATS-DECIDE-THE-DAMAGE
    Playable Result      공격 능력치가 높은 캐릭터는 같은 스킬로 더 아프게 때리고,
                         방어 능력치가 높은 캐릭터는 같은 공격을 덜 아프게 맞는다.
                         그 차이를 장비·성장으로 플레이어가 직접 만들 수 있다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-OUTGROW-THE-OPPONENT
    Missing / Partial    MC-ATTACK-POWER (MISSING) · MC-SKILL-SCALING (MISSING) ·
                         MC-DEFENSE-MITIGATION (MISSING)
    원본 근거            R1 §1~§5 공식 · §10 신규 INTENT 4종 · §11 밸런스 기준 · §16 성공 조건
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-COMBAT-SHARED-BUDGET
    Constraint Eval      SATISFIED — 난수 없음(R1 §6), 피해 공식이 하나로 통합되고(R1 §5),
                         한 층(기본 공식)만 올리며(R1 §13), 기본/고급 공격의 CP 루프를
                         그대로 유지한다(R1 §11 · §16-3)
    Observable Result    같은 스킬의 피해 숫자가 공격 능력치에 따라 달라지는 것이 보이고,
                         같은 공격의 피해가 상대 방어 능력치에 따라 줄어드는 것이 계산 내역
                         (기본 피해 + 공격 기여 → 방어 배율)으로 보인다
    Why one Cycle        새 값 3종(공격 능력치 · 방어 능력치 · 스킬 기본 피해/계수) +
                         기존 타격 규칙 1개의 CHANGED (고정 피해 → 하나의 피해 공식).
                         새 행동·새 상태 없음 — C007 의 행동·자원 위에 계산 층만 확장한다
    Status               SELECTED — 2026-08-17 Human 지시 ("새 기획으로 다시 Cycle 진행")

### FR-GUARD-TRADES-BODY-FOR-RESOURCE (재구축 대기)
    Playable Result      플레이어가 앞을 향해 막아 들어온 공격을 생명 대신 기력으로 받아내고,
                         막을 기력이 다하면 방어가 무너져 그대로 얻어맞는다
    Source Goal          MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility   MP-TRADE-BODY-FOR-RESOURCE
    Missing / Partial    MC-GUARD (MISSING) · MC-DEFENSE-MITIGATION 위 확장
    원본 근거            구판 §8.1 · R1 §14 C010 층 (Guard → Damage Taken × 0.5 수준에서 재시작)
    Status               DEFERRED — R1 §14 순서상 기본 공식 검증 뒤.
                         C010 으로 한 번 닫혔다가 롤백 — 재구축 시 git history 의
                         cycles/C010-guard-trades-body-for-resource 산출물을 참조할 수 있다

### FR-PERFECT-GUARD-TURNS-THE-TABLE (재구축 대기)
    Playable Result      플레이어가 공격이 닿기 직전에 막아 피해를 전혀 받지 않고,
                         상대를 잠시 열린 상태로 만들어 되받아친다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-READ-AND-COUNTER
    Missing / Partial    MC-PERFECT-GUARD (MISSING) · MC-COUNTER (MISSING)
    원본 근거            구판 §8.2 · §8.4 · R1 §14 C013 층 (Guard 검증 뒤)
    Depends On           FR-GUARD-TRADES-BODY-FOR-RESOURCE
    Status               DEFERRED — R1 §14 C013 층.
                         C011 로 한 번 닫혔다가 롤백 — 재구축 시 git history 의
                         cycles/C011-perfect-guard-turns-the-table 산출물을 참조할 수 있다

### FR-MATCHUP-MAKES-THE-CHOICE
    Playable Result      플레이어가 상대의 방어 형태에 맞는 공격 형태를 골라
                         같은 스킬로 다른 결과를 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-MATCH-WEAPON-TO-ARMOR
    Missing / Partial    MC-ATTACK-ARMOR-MATCHUP (MISSING)
    원본 근거            구판 §6 (R1 §14 C011 Damage Type 으로 재편 예정)
    Status               DEFERRED — R1 §14 C011 층 재설계 대기

### FR-BREAK-OPENS-THE-BURST-WINDOW
    Playable Result      플레이어가 압박을 이어 상대의 균형을 무너뜨리고,
                         무너져 있는 짧은 동안 모아 둔 기력을 쏟아붓는다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BREAK-THE-GUARD
    Missing / Partial    MC-BREAK (MISSING)
    원본 근거            구판 §9 (R1 에서 세부 삭제 — 확장 시점에 재설계)
    Status               DEFERRED — R1 §13·§14: 기본 공식 검증 전에는 추가하지 않는다

### FR-FLOW-OPENS-THE-BODY
    Playable Result      플레이어가 힘을 공격에 몰면 그동안 몸이 실제로 열리고,
                         상대가 힘을 몬 순간을 읽어 그 틈을 때릴 수 있다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-EXPLOIT-OPEN-BODY
    Missing / Partial    MC-COMBAT-FLOW (MISSING) · MC-COMBAT-CAUSE-READING (PARTIAL)
    원본 근거            구판 §7 (R1 §14 C014 Aura/Nen 집중으로 재설계 예정)
    Status               DEFERRED — R1 §14 C014 층

### FR-VOW-BUYS-POWER-WITH-RISK
    Playable Result      플레이어가 스스로 제약을 건 스킬로 규칙 위의 한 방을 내고,
                         제약을 지키지 못하면 정의된 대가를 그 자리에서 치른다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-STAKE-EVERYTHING-ON-ONE-BLOW
    Missing / Partial    MC-VOW (MISSING) · MC-CONDITION-STACKING (MISSING)
    원본 근거            구판 §10 · §12 (R1 §14 C014 조건·제약·서약으로 유지)
    Depends On           선행 층들 (R1 §14 — Aura 는 마지막 층이다)
    Status               DEFERRED — R1 §14 C014 층

## 추천 순서와 근거

```text
1  FR-STATS-DECIDE-THE-DAMAGE     SELECTED — R1 §0 이 "이후 모든 공격/방어 시스템의
                                  공통 계산 기반" 으로 지정한 층. 다음 Cycle = C012.

이후 순서는 R1 §14 를 따른다 — 각 층은 그 시점의 문서 개정(세부 재설계)이 나온 뒤
후보로 다시 세운다. C009(Critical) 층은 DC 충돌 미해결 (Q11).
막기 계열 두 후보는 한 번 구현된 이력이 있어 재구축 비용이 낮다.
```

## 선택 기록

| Frontier | 결정 | Cycle | 비고 |
|---|---|---|---|
| FR-GUARD-TRADES-BODY-FOR-RESOURCE | SELECTED | C010-guard-trades-body-for-resource | 검사 통과 후 **2026-08-17 Human 결정으로 롤백** — R1 층 순서와 어긋남. 산출물은 git history |
| FR-PERFECT-GUARD-TURNS-THE-TABLE | SELECTED | C011-perfect-guard-turns-the-table | 검사 통과 후 **2026-08-17 Human 결정으로 롤백** — 위와 같음 |
| FR-STATS-DECIDE-THE-DAMAGE | SELECTED | C012 (예정) | 2026-08-17 Human 지시 — R1 기본 공식 층 |

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
```
