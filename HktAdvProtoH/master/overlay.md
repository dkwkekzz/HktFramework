# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
Frontier 는 여기서 나온다.

기준 시점: **C010·C011 롤백 + 전투 기획서 R1 개정 반영 (2026-08-17)** — 코드는 C009 완료
시점 상태다.

## 상태

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 `RULE-STRIKE-DAMAGE-001` (`world/rules/strike-damage.ts`) · 08-verification | — (단 R1 §9 가 이 규칙의 피해 산정을 CHANGED 로 지정 — 아래 MISSING 3종이 그 확장이다) |
| MC-BODY-FACING | IMPLEMENTED | C006 `RULE-BODY-FACING-001` · `ActorState.facing` (`world/semantic/actor.ts`) | — |
| MC-CP-ECONOMY | PARTIAL | C007 `hp/cp` · `SkillDefinition.cpCharge/cpCost` · `RUN_CP_DRAIN` (`world/semantic/combat.ts`) | 기력이 아직 공격과 달리기에만 쓰인다. 방어·회피·자세 유지가 같은 예산을 나눠 쓰지 않는다 |
| MC-COMBAT-CAUSE-READING | PARTIAL | C007 `World.StrikeEvents` · C007 R2 속성 전체 관찰 · C009 명령 대답 | 결과를 만든 계산 내역이 없다 — R1 §5 기준으로는 기본 피해 · Attack 기여 · Defense 배율이 읽혀야 한다 |
| MC-ATTACK-POWER | MISSING | — | 공격 능력치가 Actor 에 없다. 피해가 `SkillDefinition.damage` 고정값 하나다 (`world/semantic/combat.ts`) |
| MC-SKILL-SCALING | MISSING | — | 스킬에 기본 피해량/공격 계수 구분이 없다 — `damage` 단일 필드뿐이다 |
| MC-DEFENSE-MITIGATION | MISSING | — | 방어력이라는 값 자체가 Actor 에 없다 (C010 이 감산식으로 닫았다가 **2026-08-17 롤백** — R1 §4 의 체감 형태로 새로 만든다) |
| MC-GUARD | MISSING | — | 막는 행동이 없다 (C010 으로 닫혔다가 **2026-08-17 롤백** — R1 §14 C010 층에서 재구축) |
| MC-PERFECT-GUARD | MISSING | — | Guard 가 없으므로 그 시작 시각도 없다 (C011 로 닫혔다가 **2026-08-17 롤백** — R1 §14 C013 층) |
| MC-COUNTER | MISSING | — | 노출 상태(Exposed)가 없다 (C011 로 닫혔다가 **2026-08-17 롤백** — R1 §14 C013 층) |
| MC-EVADE | MISSING | — | 회피 행동이 없다 (R1 §13 이연) |
| MC-BREAK | MISSING | — | 균형 누적값·붕괴 상태가 없다 (R1 이연 — 재설계 대기) |
| MC-COMBAT-FLOW | MISSING | — | 공격/방어 배분 상태가 없다 (R1 §14 C014 로 재설계 예정) |
| MC-FORTIFY | MISSING | — | Flow 가 없으므로 방어 쪽에 몰아 둔 자세도 없다 (R1 §14 C014) |
| MC-ATTACK-ARMOR-MATCHUP | MISSING | — | 공격 타입도 방어 타입도 없다 (R1 §14 C011 Damage Type 으로 재편 예정) |
| MC-WEAK-POINT | MISSING | — | 몸이 단일 캡슐이라 부위 구분이 없다 (C006 `bodyRadius/bodyHeight`) (R1 이연) |
| MC-REAR-ATTACK | MISSING | — | facing 은 있으나 타격 판정이 방향을 보지 않는다 (R1 이연) |
| MC-CONDITION-STACKING | MISSING | — | 조건이라는 개념 자체가 없다 (R1 §14 C014) |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 (R1 §14 C014) |

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
| MP-OUTGROW-THE-OPPONENT | MC-ATTACK-POWER · MC-SKILL-SCALING · MC-DEFENSE-MITIGATION | **R1 이 지정한 다음 층** — 새 값 3종이 한 덩어리다 (하나의 피해 공식) |
| MP-TRADE-BODY-FOR-RESOURCE | MC-GUARD · MC-DEFENSE-MITIGATION | C010 으로 닫혔다가 롤백 — R1 §14 C010 층에서 재구축 |
| MP-READ-AND-COUNTER | MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER | C011 로 닫혔다가 롤백 — R1 §14 C013 층에서 재구축 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | R1 §13 이연 |
| MP-BREAK-THE-GUARD | MC-BREAK | R1 이연 — 재설계 대기 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW | R1 §14 C014 로 이연 |
| MP-MATCH-WEAPON-TO-ARMOR | MC-ATTACK-ARMOR-MATCHUP | R1 §14 C011 Damage Type 으로 재편 예정 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW · MC-DEFENSE-MITIGATION | R1 §14 C014 로 이연 |
| MP-STRIKE-THE-VULNERABLE-SPOT | MC-WEAK-POINT · MC-REAR-ATTACK | R1 이연 |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | R1 §14 C014 — 가장 멀다 |

## 이번 갱신

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

    현재 IMPLEMENTED 2 · PARTIAL 2 · MISSING 15 (전체 19종).

## 갱신 경로

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (MF Stage)
        ↓
이 파일 + graph/capabilities.yaml 의 overlay 필드
```

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
