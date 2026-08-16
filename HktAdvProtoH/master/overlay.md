# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
Frontier 는 여기서 나온다.

기준 시점: **C011 완료 시점** (전투 Cycle — C007 Basic Combat Policy · C010 Guard · C011 Perfect Guard)

> C011 의 08-verification 은 STATUS 가 `IN PROGRESS` 다 (Human Play 확인 대기).
> 그럼에도 아래에서 IMPLEMENTED 로 올린 것은 Overlay 의 판정 기준이 "그 의미를 닫은 Cycle 이
> 있고 08-verification 이 **실측으로** 통과했다" 이기 때문이다 — 7종 검사와 Server + Client
> 실측이 모두 기록되어 있다. Human Play 에서 되돌아오면 그때 이 표도 함께 되돌린다.

## 상태

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 `RULE-STRIKE-DAMAGE-001` (`world/rules/strike-damage.ts`) · 08-verification | — |
| MC-BODY-FACING | IMPLEMENTED | C006 `RULE-BODY-FACING-001` · `ActorState.facing` (`world/semantic/actor.ts`) | — |
| MC-DEFENSE-MITIGATION | IMPLEMENTED | **C010** `Actor.Defense` · `RULE-STRIKE-DAMAGE-001` 감쇄 단계 · 08-verification "방어력의 바닥" (걷어내되 0 이 되지 않음을 실측) | — (방어력의 원천이 존재 종류 하나뿐인 것은 이 Capability 의 공백이 아니다 — 장비·자세는 다른 Capability 다) |
| MC-GUARD | IMPLEMENTED | **C010** `Actor.Stance` · `RULE-GUARD-SET/ABSORB/BREAK-001` · 08-verification WORLD SCENARIO(막아 냄 · 무너짐) · PLAYABLE | semantic 의 "균형 부담" 은 아직 없다 — 막기가 치르는 것은 자원 하나뿐이고 무너짐도 자원 고갈로만 온다 (MC-BREAK 이 채운다) |
| MC-PERFECT-GUARD | IMPLEMENTED | **C011** `Actor.GuardStartedAt` · `RULE-GUARD-SET-001`(CHANGED) · `RULE-PERFECT-GUARD-001` · 08-verification WORLD SCENARIO(완벽하게 막아 냄) · PLAYABLE 실측 | — |
| MC-COUNTER | IMPLEMENTED | **C011** `Actor.ExposedUntil` · `RULE-EXPOSE-001` · `RULE-COUNTER-001` · 08-verification WORLD SCENARIO(되받아침 · 열림의 성질) · PLAYABLE 실측 | semantic 의 "더 큰 균형 부담" 은 아직 없다 — 피해 증폭만 닫혔다 (MC-BREAK 이 채운다) |
| MC-CP-ECONOMY | PARTIAL | C007 `hp/cp` · `cpCharge/cpCost` · `RUN_CP_DRAIN` · **C010** 막기 소비 · **C011** 완벽한 막기 획득 | 회피(MC-EVADE) · 자세 유지(MC-FORTIFY) · 서약(MC-VOW)이 아직 같은 예산을 쓰지 않는다 |
| MC-COMBAT-CAUSE-READING | PARTIAL | C007 `World.StrikeEvents` · C007 R2 속성 전체 관찰 · C009 명령 대답 · **C010** 방어 내역 · **C011** 시점·조건 내역 (StrikeEvent 11값) | **배율**이 아직 없다 — Flow · Matchup · Vow 가 들어와야 "왜 커졌는가" 가 완전히 재구성된다. 지금 재구성되는 것은 방어 쪽 경로와 조건 1종(Counter)뿐이다 |
| MC-EVADE | MISSING | — | 회피 행동이 없다. 이동은 있으나 공격 회피의 의미를 갖지 않는다 |
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
| MP-TRADE-BODY-FOR-RESOURCE | **없음** | **닫혔다 (C010)** — 요구 Capability 전부가 IMPLEMENTED 다 |
| MP-READ-AND-COUNTER | **Capability 는 없음** · Knowledge `MK-OPPONENT-FLOW-PATTERN` 이 남는다 | **거의 닫혔다 (C011)** — MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER 가 IMPLEMENTED 이고 MC-CP-ECONOMY 는 이 경로가 쓰는 몫이 채워졌다. 다만 지금 읽을 수 있는 것은 "칼이 나왔다" 하나뿐이라, 스킬마다 다른 패턴을 읽는 일은 MC-COMBAT-FLOW 가 가져온다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | 없는 것 1종이나 위치 이동 의미의 재해석이 필요하다. **Frontier 후보가 아직 없다** |
| MP-BREAK-THE-GUARD | MC-BREAK | 없는 것 1종. 압박의 대상인 방어가 이제 실제로 있으므로 의미가 얇지 않다 (C010·C011) — **다음으로 가장 가깝다** |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW (+ MC-COMBAT-CAUSE-READING 보강) | Flow 는 스킬 구간 개념을 함께 요구한다 |
| MP-MATCH-WEAPON-TO-ARMOR | MC-ATTACK-ARMOR-MATCHUP | 공격·방어 타입 2종을 함께 들여야 한다 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW | MC-DEFENSE-MITIGATION 이 채워졌다 (C010). Flow 이후. **Frontier 후보가 아직 없다** |
| MP-STRIKE-THE-VULNERABLE-SPOT | MC-WEAK-POINT · MC-REAR-ATTACK | 몸의 부위 구분이 선행한다. **Frontier 후보가 아직 없다** |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | 가장 멀다 — 조건들이 먼저 존재해야 겹칠 수 있다 |

## 이번 갱신

### MF (C010 · C011) — 2026-08-16

    승격 4종 (근거는 각 Cycle 의 08-verification 실측)
        MC-DEFENSE-MITIGATION   MISSING → IMPLEMENTED   C010
        MC-GUARD                MISSING → IMPLEMENTED   C010
        MC-PERFECT-GUARD        MISSING → IMPLEMENTED   C011
        MC-COUNTER              MISSING → IMPLEMENTED   C011

    전진 2종 (상태는 그대로)
        MC-CP-ECONOMY           PARTIAL — 방어가 예산을 쓰기 시작했고(C010),
                                이제 방어로 예산을 벌기도 한다(C011).
                                남은 공백: 회피 · 자세 유지 · 서약
        MC-COMBAT-CAUSE-READING PARTIAL — 방어 쪽 내역(C010)과 시점·조건 내역(C011)이 열렸다.
                                남은 공백: 배율 일반 (Flow · Matchup · Vow)

    Possibility
        MP-TRADE-BODY-FOR-RESOURCE  닫힘 (C010)
        MP-READ-AND-COUNTER         Capability 는 전부 채워졌고 Knowledge 하나가 남는다 (C011)

    집계   IMPLEMENTED 6 · PARTIAL 2 · MISSING 9   (이전 2 / 2 / 13)

    Constraint 판정 변화 (Cycle 실측 근거)
        DC-COMBAT-DEFENSE-IS-ACTIVE   PARTIALLY SATISFIED → SATISFIED
            C010 이 requires[defense_as_player_action] 를 닫고,
            C011 이 requires[defense_success_creates_offense_opportunity] 를 닫았다.
            C010 이 "다음 Cycle 이 FR-PERFECT-GUARD-TURNS-THE-TABLE 이 아니면 계속 반쪽"
            이라고 남긴 관찰은 그대로 다음 Cycle 이 그것이 되면서 해소됐다
        DC-COMBAT-PLAYER-CAUSALITY    SATISFIED 유지 (C010 · C011 모두 결정론 실측)
        DC-COMBAT-SHARED-BUDGET       SATISFIED 유지 (전용 게이지 신설 없음 — 두 Cycle 모두)

    Constraint Candidate 접수 4건 (전부 PENDING — candidates/README.md)
        CC-RESULT-CARRIES-ITS-BREAKDOWN    4/4    C007 · C010 · C011 세 번 반복
        CC-TIMED-STATE-EXPIRES-BY-CLOCK    3.5/4  C010 · C011
        CC-STANCE-IS-NOT-AN-ACTION         3/4    C010 (C011 은 재사용이라 2회로 세지 않았다)
        CC-OUTSIDE-HAND-STAYS-REACHABLE    1.5/4  C011 — 지금 승격하기에는 이르다
        Agent 는 승격하지 않는다. 4항 검사 결과와 "아직 이르다" 는 판단까지 함께 적어 두었다.

    Master Gap
        없음 — 두 Cycle 모두 상위 의미와 어긋난 지점을 보고하지 않았다.
        C011 이 남긴 것은 Gap 이 아니라 인계다 (MK-OPPONENT-FLOW-PATTERN → FR-FLOW).

    Graph 에 없던 Capability
        없음 — C010·C011 이 닫은 넷은 전부 이미 Graph 에 있던 노드다.
        새로 추가하거나 Possibility 에 연결할 것이 없었다.

    관찰 — Frontier 가 덮지 않는 영역 3곳
        MP-EVADE-BY-MOVING-THE-BODY · MP-HOLD-FORTIFIED · MP-STRIKE-THE-VULNERABLE-SPOT
        세 경로는 Graph 에 있으나 frontier.md 에 후보가 없다.
        frontier.md 의 후보 6종이 원본 §21 Roadmap 의 Phase 표를 그대로 옮긴 것인데,
        원본은 Evade(§8.3) · Fortify(§7) · Weak Point/Rear(§13) 를 Phase 에 넣지 않았다.
        후보를 만들지 말지는 M4 의 일이며 이 MF 는 사실만 남긴다.

### 최초 판정

    design/Design-Combat-OffenseDefense-R0.md 주입에 따른 최초 판정 (17종).
    IMPLEMENTED 2 · PARTIAL 2 · MISSING 13.

    PARTIAL 2종은 "있지만 이 문서가 요구하는 형태에 못 미치는" 경우다 —
    기력은 존재하나 방어를 사지 못하고, 관찰은 존재하나 원인을 설명하지 못한다.

    Quality Gate 자가 점검 후 보정 — MC-DEFENSE-MITIGATION 이 어떤 Possibility 에도
    요구되지 않던 상태를 고쳤다. 막기와 자세가 그것을 딛는다는 관계를 세워
    MP-TRADE-BODY-FOR-RESOURCE 의 첫 Cycle 크기가 1종에서 2종으로 늘었다.

## 갱신 경로

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (MF Stage)
        ↓
이 파일 + graph/capabilities.yaml 의 overlay 필드
```

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
