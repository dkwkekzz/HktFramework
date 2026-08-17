# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
Frontier 는 여기서 나온다.

기준 시점: **C011 완료 + 전투 기획서 R1 개정(2026-08-17) 반영**

## 상태

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 `RULE-STRIKE-DAMAGE-001` (`world/rules/strike-damage.ts`) · 08-verification | — (단 R1 §9 가 이 규칙의 피해 산정을 CHANGED 로 지정 — 아래 MC-ATTACK-POWER · MC-SKILL-SCALING) |
| MC-BODY-FACING | IMPLEMENTED | C006 `RULE-BODY-FACING-001` · `ActorState.facing` (`world/semantic/actor.ts`) | — |
| MC-GUARD | IMPLEMENTED | C010 08-verification MASTER FEEDBACK — `Actor.Stance` · `RULE-GUARD-SET/ABSORB/BREAK-001` (Human Play 확인 대기) | — |
| MC-PERFECT-GUARD | IMPLEMENTED | C011 08-verification MASTER FEEDBACK — `Actor.GuardStartedAt` · `RULE-PERFECT-GUARD-001` (Human Play 확인 대기) | — |
| MC-COUNTER | IMPLEMENTED | C011 08-verification MASTER FEEDBACK — `Actor.ExposedUntil` · `RULE-EXPOSE-001` · `RULE-COUNTER-001` (Human Play 확인 대기) | — |
| MC-DEFENSE-MITIGATION | PARTIAL | C010 — `Actor.Defense` + 감산식 감쇄 (`strike-damage.ts`: `max(base × MIN_RATIO, base - defense)`) | R1 §4 · INTENT-DEFENSE-001 이 요구하는 **체감(diminishing return) 구조**가 아니다 — 지금은 선형 감산이라 추가 방어의 효율이 완만해지지 않는다 |
| MC-CP-ECONOMY | PARTIAL | C007 공격 · C010 방어 소비 · C011 방어 획득 (cpGained) | 기동(회피)·자세 유지가 아직 같은 예산을 쓰지 않는다 |
| MC-COMBAT-CAUSE-READING | PARTIAL | C007 StrikeEvents · C010 타격 내역 · C011 시점 내역 | R1 §5 의 계산 내역(기본 피해 + Attack 기여 · Defense 배율)이 아직 없다 — 그 값 자체가 세계에 없기 때문이다 |
| MC-ATTACK-POWER | MISSING | — | 공격 능력치가 Actor 에 없다. 피해가 `SkillDefinition.damage` 고정값 하나다 (`world/semantic/combat.ts`) |
| MC-SKILL-SCALING | MISSING | — | 스킬에 기본 피해량/공격 계수 구분이 없다 — `damage` 단일 필드뿐이다 |
| MC-EVADE | MISSING | — | 회피 행동이 없다. 이동은 있으나 공격 회피의 의미를 갖지 않는다 (R1 §13 이연) |
| MC-BREAK | MISSING | — | 균형 누적값·붕괴 상태가 없다 (R1 이연 — 기력 고갈 `GuardBrokenUntil` 은 별개 의미다) |
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
| MP-OUTGROW-THE-OPPONENT | MC-ATTACK-POWER · MC-SKILL-SCALING (+ MC-DEFENSE-MITIGATION 체감 형태 보강) | **가장 가깝다 — R1 이 지정한 다음 층.** 새 값 2종 + 기존 피해 규칙 1개의 CHANGED |
| MP-TRADE-BODY-FOR-RESOURCE | 없음 | C010 으로 닫혔다 |
| MP-READ-AND-COUNTER | 없음 | C011 로 닫혔다 (MK-OPPONENT-FLOW-PATTERN 은 Flow 부재로 시점 읽기로 성립) |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | R1 §13 이연 |
| MP-BREAK-THE-GUARD | MC-BREAK | R1 이연 — 세부 재설계 대기 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW | R1 §14 C014 로 이연 |
| MP-MATCH-WEAPON-TO-ARMOR | MC-ATTACK-ARMOR-MATCHUP | R1 §14 C011 Damage Type 으로 재편 예정 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW (+ MC-DEFENSE-MITIGATION 보강) | R1 §14 C014 로 이연 |
| MP-STRIKE-THE-VULNERABLE-SPOT | MC-WEAK-POINT · MC-REAR-ATTACK | R1 이연 |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | R1 §14 C014 — 가장 멀다 |

## 이번 갱신

    1. C010 · C011 의 08-verification MASTER FEEDBACK 반영 (MF).
       MC-GUARD · MC-DEFENSE-MITIGATION(C010) · MC-PERFECT-GUARD · MC-COUNTER(C011)
       MISSING → IMPLEMENTED. MC-CP-ECONOMY · MC-COMBAT-CAUSE-READING PARTIAL 전진.
       두 Cycle 모두 검사 통과·Human Play 확인 대기 상태다.

    2. 전투 기획서 R1 전면 개정(2026-08-17) 반영.
       신규 MC-ATTACK-POWER · MC-SKILL-SCALING 판정 (둘 다 MISSING).
       MC-DEFENSE-MITIGATION 은 R1 §4 의 체감 구조 요구로 IMPLEMENTED → PARTIAL —
       "닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다" 의 경우다.
       구판 유래 MISSING 13종 중 9종은 R1 §13·§14 이연으로 표시.

    현재 IMPLEMENTED 5 · PARTIAL 3 · MISSING 11 (전체 19종).

## 갱신 경로

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (MF Stage)
        ↓
이 파일 + graph/capabilities.yaml 의 overlay 필드
```

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
