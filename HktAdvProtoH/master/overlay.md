# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
Frontier 는 여기서 나온다.

기준 시점: **C009 완료 시점** (전투 관련 최신 Cycle 은 C007 — Basic Combat Policy)

## 상태

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 `RULE-STRIKE-DAMAGE-001` (`world/rules/strike-damage.ts`) · 08-verification | — |
| MC-BODY-FACING | IMPLEMENTED | C006 `RULE-BODY-FACING-001` · `ActorState.facing` (`world/semantic/actor.ts`) | — |
| MC-CP-ECONOMY | PARTIAL | C007 `hp/cp` · `SkillDefinition.cpCharge/cpCost` · `RUN_CP_DRAIN` (`world/semantic/combat.ts`) | 기력이 아직 공격과 달리기에만 쓰인다. 방어·회피·자세 유지가 같은 예산을 나눠 쓰지 않는다 |
| MC-COMBAT-CAUSE-READING | PARTIAL | C007 `World.StrikeEvents` (누가·누구를·얼마나) · C007 R2 속성 전체 관찰 · C009 명령 대답 | 결과를 만든 **배율과 조건**이 없다. 지금은 최종 수치 하나만 보이므로 "왜 커졌는가" 를 재구성할 수 없다 |
| MC-DEFENSE-MITIGATION | MISSING | — | 방어력이라는 값 자체가 Actor 에 없다 (`world/semantic/actor.ts`) |
| MC-GUARD | MISSING | — | 막는 행동이 없다. `ActionKind` 에 attack / heavy-attack / hit / downed / mine / move 만 있다 |
| MC-PERFECT-GUARD | MISSING | — | Guard 가 없으므로 그 시작 시각도 없다 |
| MC-EVADE | MISSING | — | 회피 행동이 없다. 이동은 있으나 공격 회피의 의미를 갖지 않는다 |
| MC-COUNTER | MISSING | — | 노출 상태(Exposed)가 없어 되받아칠 순간이 세계에 존재하지 않는다 |
| MC-BREAK | MISSING | — | 균형 누적값·붕괴 상태가 없다 |
| MC-COMBAT-FLOW | MISSING | — | 공격/방어 배분 상태가 없다. 스킬은 구간(STARTUP/ACTIVE/RECOVERY) 구분도 갖지 않는다 |
| MC-FORTIFY | MISSING | — | Flow 가 없으므로 방어 쪽에 몰아 둔 자세도 없다 |
| MC-ATTACK-ARMOR-MATCHUP | MISSING | — | 공격 타입도 방어 타입도 없다. 피해가 `SkillDefinition.damage` 고정값 하나다 |
| MC-WEAK-POINT | MISSING | — | 몸이 단일 캡슐이라 부위 구분이 없다 (C006 `bodyRadius/bodyHeight`) |
| MC-REAR-ATTACK | MISSING | — | facing 은 있으나 타격 판정이 방향을 보지 않는다 |
| MC-CONDITION-STACKING | MISSING | — | 조건이라는 개념 자체가 없다 |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 |

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

| Possibility | 요구 Capability 중 없는 것 | 가장 가까운가 |
|---|---|---|
| MP-TRADE-BODY-FOR-RESOURCE | MC-GUARD | **가장 가깝다** — 없는 것 1종, 나머지는 이미 있다 |
| MP-READ-AND-COUNTER | MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER | Guard 가 먼저 있어야 성립한다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | 없는 것 1종이나 위치 이동 의미의 재해석이 필요하다 |
| MP-BREAK-THE-GUARD | MC-BREAK | 없는 것 1종. 다만 압박의 대상인 방어가 없으면 의미가 얇다 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW (+ MC-COMBAT-CAUSE-READING 보강) | Flow 는 스킬 구간 개념을 함께 요구한다 |
| MP-MATCH-WEAPON-TO-ARMOR | MC-ATTACK-ARMOR-MATCHUP | 공격·방어 타입 2종을 함께 들여야 한다 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW | Flow 이후 |
| MP-STRIKE-THE-VULNERABLE-SPOT | MC-WEAK-POINT · MC-REAR-ATTACK | 몸의 부위 구분이 선행한다 |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | 가장 멀다 — 조건들이 먼저 존재해야 겹칠 수 있다 |

## 이번 갱신

    design/Design-Combat-OffenseDefense-R0.md 주입에 따른 최초 판정 (17종).
    IMPLEMENTED 2 · PARTIAL 2 · MISSING 13.

    PARTIAL 2종은 "있지만 이 문서가 요구하는 형태에 못 미치는" 경우다 —
    기력은 존재하나 방어를 사지 못하고, 관찰은 존재하나 원인을 설명하지 못한다.

## 갱신 경로

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (MF Stage)
        ↓
이 파일 + graph/capabilities.yaml 의 overlay 필드
```

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
