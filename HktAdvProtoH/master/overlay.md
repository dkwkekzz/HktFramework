# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
Frontier 는 여기서 나온다.

기준 시점: **C010-stats-decide-the-damage 닫힘 (2026-08-17)** — 코드는 그 Cycle 완료 시점 상태다.

## 상태

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 `RULE-STRIKE-DAMAGE-001` · C010 이 그 피해 산정을 하나의 공식으로 교체 (R1 §9 CHANGED 완료) | — |
| MC-BODY-FACING | IMPLEMENTED | C006 `RULE-BODY-FACING-001` · `ActorState.facing` (`world/semantic/actor.ts`) | — |
| MC-CP-ECONOMY | PARTIAL | C007 `hp/cp` · `SkillDefinition.cpCharge/cpCost` · `RUN_CP_DRAIN` (`world/semantic/combat.ts`) | 기력이 아직 공격과 달리기에만 쓰인다. 방어·회피·자세 유지가 같은 예산을 나눠 쓰지 않는다 |
| MC-COMBAT-CAUSE-READING | PARTIAL | C007 `World.StrikeEvents` · C007 R2 속성 전체 관찰 · C009 명령 대답 | **M3 재판정 필요** — C010 이 계산 내역(기본 피해 · Attack 기여 · Defense 배율)을 관찰 계약에 실었으나 C010 의 MASTER FEEDBACK 이 이 Capability 를 보고하지 않았다. 보고 없는 승격은 하지 않는다 (MF Guide) |
| MC-ATTACK-POWER | IMPLEMENTED | C010 08-verification — 공격력 40→80 변경이 피해 20→35 로 실측 | — |
| MC-SKILL-SCALING | IMPLEMENTED | C010 08-verification — 계수가 큰 스킬이 같은 공격 증가에 더 크게 자라는 것이 실측 | — |
| MC-DEFENSE-MITIGATION | IMPLEMENTED | C010 08-verification — 방어 0/100/200/300 에서 피해 26/13/9/7, 감소폭 단조 감소, 방어 100000 에서도 최소 1 | — (단 이것은 **수동 감쇄**다. 막는 행동은 MC-GUARD 이며 별개다) |
| MC-GUARD | MISSING | — | 막는 행동이 없다. 줄일 대상인 피해 감쇄는 C010 으로 생겼으므로 이제 이것 하나만 없다 (R1 §14 Defense Action 층) |
| MC-PERFECT-GUARD | MISSING | — | Guard 가 없으므로 그 시작 시각도 없다 (C011 로 닫혔다가 **2026-08-17 롤백** — R1 §14 Active Defense 층) |
| MC-COUNTER | MISSING | — | 노출 상태(Exposed)가 없다 (C011 로 닫혔다가 **2026-08-17 롤백** — R1 §14 Active Defense 층) |
| MC-EVADE | MISSING | — | 회피 행동이 없다 (R1 §13 이연) |
| MC-BREAK | MISSING | — | 균형 누적값·붕괴 상태가 없다 (R1 이연 — 재설계 대기) |
| MC-COMBAT-FLOW | MISSING | — | 공격/방어 배분 상태가 없다 (R1 §14 Aura/Nen 층으로 재설계 예정) |
| MC-FORTIFY | MISSING | — | Flow 가 없으므로 방어 쪽에 몰아 둔 자세도 없다 (R1 §14 Aura/Nen 층) |
| MC-ATTACK-ARMOR-MATCHUP | MISSING | — | 공격 타입도 방어 타입도 없다 (R1 §14 Damage Type 층으로 재편 예정) |
| MC-WEAK-POINT | MISSING | — | 몸이 단일 캡슐이라 부위 구분이 없다 (C006 `bodyRadius/bodyHeight`) (R1 이연) |
| MC-REAR-ATTACK | MISSING | — | facing 은 있으나 타격 판정이 방향을 보지 않는다 (R1 이연) |
| MC-CONDITION-STACKING | MISSING | — | 조건이라는 개념 자체가 없다 (R1 §14 Aura/Nen 층) |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 (R1 §14 Aura/Nen 층) |

## 판정 기준

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
```

근거 칸에는 Cycle ID 또는 실측을 적는다. 주장만 적지 않는다.
Constraint Violation 과 혼동하지 않는다 — 여기는 **있는가/없는가**이지 **허용되는가**가 아니다.

## Possibility 별로 본 상태

어느 경로가 지금 얼마나 닫혀 있는가 — Frontier 는 이 표에서 고른다.

| Possibility | 요구 Capability 중 없는 것 | 비고 |
|---|---|---|
| MP-OUTGROW-THE-OPPONENT | **없음** | **C010 으로 닫혔다** — 요구 Capability 3종이 모두 IMPLEMENTED. 이 경로는 지금 플레이 가능하다 |
| MP-TRADE-BODY-FOR-RESOURCE | MC-GUARD | **하나만 남았다** — C010 이 MC-DEFENSE-MITIGATION 을 채웠다. R1 §14 Defense Action 층이며 지금 가장 가까운 경로다 |
| MP-READ-AND-COUNTER | MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER | R1 §14 Active Defense 층 — Guard 가 먼저다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | R1 §13 이연 |
| MP-BREAK-THE-GUARD | MC-BREAK | R1 이연 — 재설계 대기 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 |
| MP-MATCH-WEAPON-TO-ARMOR | MC-ATTACK-ARMOR-MATCHUP | R1 §14 Damage Type 층으로 재편 예정 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 (MC-DEFENSE-MITIGATION 은 C010 으로 채워졌다) |
| MP-STRIKE-THE-VULNERABLE-SPOT | MC-WEAK-POINT · MC-REAR-ATTACK | R1 이연 |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층 — 가장 멀다 |

## 이번 갱신

    2026-08-17 (MF) — C010-stats-decide-the-damage 의 MASTER FEEDBACK 을 반영했다.

    승격 3종 (근거: 그 Cycle 의 08-verification 실측)
        MC-ATTACK-POWER        MISSING → IMPLEMENTED
        MC-SKILL-SCALING       MISSING → IMPLEMENTED
        MC-DEFENSE-MITIGATION  MISSING → IMPLEMENTED  (수동 감쇄에 한한다)

    이로써 **MP-OUTGROW-THE-OPPONENT 가 완전히 닫혔다** — 요구 Capability 가 하나도
    비어 있지 않은 첫 Possibility 다. MP-TRADE-BODY-FOR-RESOURCE 는 MC-GUARD 하나만
    남았고, MP-HOLD-FORTIFIED 도 요구 3종 중 하나가 채워졌다.

    승격하지 않은 것
        MC-COMBAT-CAUSE-READING 은 PARTIAL 로 둔다. C010 이 계산 내역을 관찰 계약에
        실었으므로 이 행의 "부족한 것" 은 실질적으로 해소된 것으로 보이나,
        C010 의 MASTER FEEDBACK 이 이 Capability 를 보고하지 않았다.
        보고 없이 코드를 근거로 승격하지 않는다 (MF Guide MUST NOT) — M3 재판정 대상이다.

    Constraint Candidate 접수 1건 → **승격**
        CC-WORLD-OWNS-THE-SURFACE-LIST 를 접수하고, 같은 날 Human 이 승인했다.
        constraints/DC-WORLD-OWNS-THE-SURFACE-LIST.yaml (GLOBAL · APPROVED).
        Active Constraint 가 4종에서 5종이 되었고, 이 중 처음으로 COMBAT 이 아닌
        경계(World → View) 에 대한 것이다.

    ── 이전 갱신 ────────────────────────────────────────────────────

    2026-08-17 — Human 결정 두 건을 반영했다.

    1. 전투 기획서 R1 전면 개정 ("가장 단순한 공격/방어 공식 먼저").
       신규 MC-ATTACK-POWER · MC-SKILL-SCALING 판정 (둘 다 MISSING).
       구판 유래 MISSING 노드들에 R1 §13·§14 이연 표기.

    2. C010(막기·방어력) · C011(완벽한 막기·되받아침) 구현 롤백.
       두 Cycle 은 검사를 통과했으나 R1 의 층 순서(기본 공식이 먼저, 능동 방어는
       그 위)와 어긋나 Human 지시로 되돌렸다. 코드·Cycle 산출물은 git history 에 있다.
       MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER · MC-DEFENSE-MITIGATION → MISSING,
       MC-CP-ECONOMY · MC-COMBAT-CAUSE-READING 은 C007 시점 PARTIAL 로 복귀.
       재구축 시 이전 산출물(cycles/C010-*, C011-* — git history)을 참조할 수 있다.

    현재 IMPLEMENTED 5 · PARTIAL 2 · MISSING 12 (전체 19종).

## 갱신 경로

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (MF Stage)
        ↓
이 파일 + graph/capabilities.yaml 의 overlay 필드
```

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
