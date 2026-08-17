# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다.

출처: `design/Design-Combat-OffenseDefense-R0.md` **R1 (2026-08-17 전면 개정)** §14 확장 순서
+ `overlay.md`

> **번호 주의** — R1 문서는 저장소 Cycle 번호에 맞춰 재번호되었다: 기본 공식 = **C010**
> (2026-08-17 `C010-stats-decide-the-damage` 로 닫힘), §14 확장 사다리 = C011~C016.
> 롤백으로 무효가 된 C010·C011 번호는 Human 결정(2026-08-17)으로 재사용한다 —
> C010 은 이미 재사용되었고 C011 이 다음 재사용 대상이다. 구분은 전체 ID(번호+이름)로
> 하며 구 `C010-guard-trades-body-for-resource` · `C011-perfect-guard-turns-the-table` 은
> git history 에만 존재한다. §14 의 C011 이후 번호는 **계획 번호**라 다른 트랙의 Cycle 이
> 끼어들면 밀릴 수 있다 — 그래서 이 파일과 Master 는 확장 층을 번호가 아니라 **이름**
> (Critical · Defense Action · Damage Type · Penetration · Active Defense · Aura/Nen)으로
> 가리킨다.

> **R1 개정 + 롤백 반영 (2026-08-17)** — Human 이 전투 기획을 "가장 단순한 공격/방어
> 공식 먼저" 로 재정의하고, 층 순서와 어긋나게 먼저 올라갔던 C010·C011(막기 계열) 구현을
> 롤백하기로 결정했다. Constraint 는 R1 기준으로 재작성되었다 (`constraints/` —
> Active 4종 · 보류 3종). Critical 층(계획 C011)은 DC-COMBAT-PLAYER-CAUSALITY 와 충돌하므로
> 후보로 올리지 않았다 → `open-questions.md` Q11.

> **C010 닫힘 반영 (2026-08-17, MF)** — 기본 공식 층이 닫혔다
> (`cycles/C010-stats-decide-the-damage`). R1 §14 가 요구한 "기본 공식이 플레이로
> 검증된 다음" 조건이 충족되었으므로 **Defense Action(Guard) 층의 이연이 풀린다.**
> MC-DEFENSE-MITIGATION 이 IMPLEMENTED 가 되면서 막기 후보가 요구하는 것은
> MC-GUARD 하나로 줄었다.

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

### FR-GUARD-TRADES-BODY-FOR-RESOURCE
    Playable Result      플레이어가 앞을 향해 막아 들어온 공격을 생명 대신 기력으로 받아내고,
                         막을 기력이 다하면 방어가 무너져 그대로 얻어맞는다
    Source Goal          MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility   MP-TRADE-BODY-FOR-RESOURCE
    Missing / Partial    MC-GUARD (MISSING) — **이것 하나뿐이다**.
                         MP-TRADE-BODY-FOR-RESOURCE 가 요구하는 나머지 3종
                         (MC-DEFENSE-MITIGATION · MC-CP-ECONOMY · MC-BODY-FACING)은
                         이미 세계에 있다 (MC-DEFENSE-MITIGATION 은 C010 이 채웠다)
    원본 근거            구판 §8.1 · R1 §14 Defense Action 층
                         (Guard → Damage Taken × 0.5 수준에서 재시작)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-COMBAT-SHARED-BUDGET ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST (2026-08-17 승격 — GLOBAL)
    Constraint Eval      SATISFIED — 막기는 확률이 아니라 선택한 행동의 결과이고(난수 없음),
                         새 피해 공식을 만들지 않고 C010 의 결과값에 한 가지 의미만 더하며
                         (DC-COMBAT-ONE-FORMULA — 핵심 원칙의 "Guard → Final Damage 를
                         감소시킨다"), 한 층만 올리고, 전용 게이지 없이 기존 기력을 쓴다
                         (DC-COMBAT-SHARED-BUDGET)
                         주의 — DC-COMBAT-DEFENSE-IS-ACTIVE 는 현재 보류(DRAFT)다.
                         이 Cycle 이 그 DC 의 근거 층이므로, 닫은 뒤 재승인 여부를
                         Human 이 판단할 자리가 생긴다
    Observable Result    막는 동안 들어온 공격의 피해가 줄어든 값으로 들어가는 것이
                         계산 내역으로 보이고, 그만큼 기력이 줄어드는 것이 보이며,
                         기력이 바닥나 방어가 무너지는 순간이 드러난다
    Why one Cycle        새 행동 1종(막기) + C010 공식의 결과값에 배율 하나.
                         새 자원도 새 공식도 없다 — 기력·피해 계산·행동 구조가 모두 이미 있다.
                         한 번 구현되었던 이력이 있어 재구축 비용도 낮다
                         (git history 의 cycles/C010-guard-trades-body-for-resource)
    Status               SELECTED — 2026-08-17 Human 선택. 다음 Cycle = C011 (번호 재사용).
                         2026-08-17 MF 에서 이연 해제되었고, R1 §14 가 요구한
                         "기본 공식이 플레이로 검증된 뒤" 조건이 C010 으로 충족되었다

### FR-PERFECT-GUARD-TURNS-THE-TABLE (Guard 다음)
    Playable Result      플레이어가 공격이 닿기 직전에 막아 피해를 전혀 받지 않고,
                         상대를 잠시 열린 상태로 만들어 되받아친다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-READ-AND-COUNTER
    Missing / Partial    MC-PERFECT-GUARD (MISSING) · MC-COUNTER (MISSING)
    원본 근거            구판 §8.2 · §8.4 · R1 §14 Active Defense 층 (Guard 검증 뒤)
    Depends On           FR-GUARD-TRADES-BODY-FOR-RESOURCE
    Status               DEFERRED — R1 §14 Active Defense 층. Guard 가 닫힌 뒤에 열린다
                         (막기가 없으면 "막기 시작 시각" 도 없다).
                         C011 로 한 번 닫혔다가 롤백 — 재구축 시 git history 의
                         cycles/C011-perfect-guard-turns-the-table 산출물을 참조할 수 있다

### FR-MATCHUP-MAKES-THE-CHOICE
    Playable Result      플레이어가 상대의 방어 형태에 맞는 공격 형태를 골라
                         같은 스킬로 다른 결과를 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-MATCH-WEAPON-TO-ARMOR
    Missing / Partial    MC-ATTACK-ARMOR-MATCHUP (MISSING)
    원본 근거            구판 §6 (R1 §14 Damage Type 층으로 재편 예정)
    Status               DEFERRED — R1 §14 Damage Type 층 재설계 대기

### FR-BREAK-OPENS-THE-BURST-WINDOW
    Playable Result      플레이어가 압박을 이어 상대의 균형을 무너뜨리고,
                         무너져 있는 짧은 동안 모아 둔 기력을 쏟아붓는다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BREAK-THE-GUARD
    Missing / Partial    MC-BREAK (MISSING)
    원본 근거            구판 §9 (R1 에서 세부 삭제 — 확장 시점에 재설계)
    Status               DEFERRED — 기본 공식 검증 조건은 C010 으로 충족되었으나,
                         R1 이 이 층의 세부(균형 누적·붕괴)를 삭제했다.
                         재설계 문서가 나온 뒤 후보로 세운다

### FR-FLOW-OPENS-THE-BODY
    Playable Result      플레이어가 힘을 공격에 몰면 그동안 몸이 실제로 열리고,
                         상대가 힘을 몬 순간을 읽어 그 틈을 때릴 수 있다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-EXPLOIT-OPEN-BODY
    Missing / Partial    MC-COMBAT-FLOW (MISSING) · MC-COMBAT-CAUSE-READING (PARTIAL)
    원본 근거            구판 §7 (R1 §14 Aura/Nen 층 집중으로 재설계 예정)
    Status               DEFERRED — R1 §14 Aura/Nen 층

### FR-VOW-BUYS-POWER-WITH-RISK
    Playable Result      플레이어가 스스로 제약을 건 스킬로 규칙 위의 한 방을 내고,
                         제약을 지키지 못하면 정의된 대가를 그 자리에서 치른다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-STAKE-EVERYTHING-ON-ONE-BLOW
    Missing / Partial    MC-VOW (MISSING) · MC-CONDITION-STACKING (MISSING)
    원본 근거            구판 §10 · §12 (R1 §14 Aura/Nen 층 조건·제약·서약으로 유지)
    Depends On           선행 층들 (R1 §14 — Aura 는 마지막 층이다)
    Status               DEFERRED — R1 §14 Aura/Nen 층

## 추천 순서와 근거

```text
1  FR-GUARD-TRADES-BODY-FOR-RESOURCE   SELECTED — R1 §14 가 기본 공식 바로 위에 둔 층이고,
                                       C010 이 그 조건(기본 공식의 플레이 검증)을 채웠다.
                                       요구 Capability 가 MC-GUARD 하나로 줄어 지금 가장 가까운
                                       후보다. 한 번 구현된 이력이 있어 재구축 비용도 낮다.

지금 세울 수 있는 후보는 이것 하나다. 나머지가 막혀 있는 이유는 각각 다르다.

  Critical 층        DC-COMBAT-PLAYER-CAUSALITY 와 충돌 — Human 결정 대기 (Q11).
                     결정 전에는 후보로 올리지 않는다.
  Damage Type 층     R1 §14 로 재편 예정이나 세부 설계가 아직 없다.
                     문서 개정이 나온 뒤 후보로 세운다.
  Active Defense 층  Guard 가 먼저다 — 막기가 없으면 완벽한 막기의 시점도 없다.
  Aura/Nen 층        가장 위다. 아래 층들이 서야 의미가 생긴다.

이후 순서는 R1 §14 를 따른다 — 각 층은 그 시점의 문서 개정이 나온 뒤 후보로 세운다.
```

## 선택 기록

| Frontier | 결정 | Cycle | 비고 |
|---|---|---|---|
| FR-GUARD-TRADES-BODY-FOR-RESOURCE | SELECTED | C010-guard-trades-body-for-resource | 검사 통과 후 **2026-08-17 Human 결정으로 롤백** — R1 층 순서와 어긋남. 산출물은 git history |
| FR-PERFECT-GUARD-TURNS-THE-TABLE | SELECTED | C011-perfect-guard-turns-the-table | 검사 통과 후 **2026-08-17 Human 결정으로 롤백** — 위와 같음 |
| FR-STATS-DECIDE-THE-DAMAGE | **CLOSED** | C010-stats-decide-the-damage | 2026-08-17 **COMPLETE** — Human Play 확인. MC-ATTACK-POWER · MC-SKILL-SCALING · MC-DEFENSE-MITIGATION 승격. 후보 목록에서 소진 처리 |
| FR-GUARD-TRADES-BODY-FOR-RESOURCE | SELECTED | C011 (예정 — 번호 재사용) | 2026-08-17 Human 선택. R1 §14 Defense Action 층. 구 C011(완벽한 막기)과는 전체 ID 로 구분하며, 롤백된 구 C010(막기)의 산출물이 git history 에 있어 참조 가능하다 |

### 소진된 후보에서 배운 것

    FR-STATS-DECIDE-THE-DAMAGE 의 Playable Result 는 능력치 차이를 "장비·성장으로"
    만든다고 적었으나, 그 층(장비·성장)은 R1 §13 이 제외한 범위였다. Cycle 은
    C009 디버그 명령을 수단으로 삼아 닫았고 Human 이 승인했다 (C010 05-review.md).

    교훈 — Playable Result 에는 **이번 층에서 실제로 제공되는 수단**을 적는다.
    아직 없는 층의 수단을 적으면 Cycle Definition 이 해석으로 메워야 한다.

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
```
