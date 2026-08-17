# C011 — World Implementation

> 피해 공식(`world/rules/damage-calculate.ts`)의 계산식은 **한 줄도 바뀌지 않았다**.
> 바뀐 것은 그 함수가 채우는 경위에 항목 하나가 늘어난 것뿐이고,
> 막기는 `world/rules/guard.ts` 라는 별도 규칙으로 그 결과값 뒤에 붙는다.

## IMPLEMENTED

    Actor.Guarding                  world/semantic/actor.ts
    Actor.GuardBrokenUntil          world/semantic/actor.ts
    World.GuardDamageFactor  0.5    world/semantic/combat.ts   (결정론 상수)
    World.GuardArcCos        0.5    world/semantic/combat.ts   (정면 ±60°)
    World.GuardCpPerDamage   0.6    world/semantic/combat.ts
    World.GuardBreakRecovery 1.0    world/semantic/combat.ts
    GuardOutcome                    world/semantic/combat.ts   (파생 — 저장하지 않는다)
    Actor.Guard.Broken (파생)       world/semantic/combat.ts   isGuardBroken()
    DamageBreakdown.AppliedDamage   world/semantic/combat.ts
    DamageBreakdown.Guard           world/semantic/combat.ts

    RULE-GUARD-BEGIN-001            world/rules/guard.ts       ruleGuardBegin
    RULE-GUARD-RELEASE-001          world/rules/guard.ts       ruleGuardRelease
    RULE-GUARD-BLOCK-001            world/rules/guard.ts       ruleGuardBlock
    Guard.BeginAvailability         world/rules/guard.ts       evaluateGuardBegin
                                    — Rule 과 Observable 이 같은 함수를 쓴다.
                                      판정이 한 곳에만 있어야 "왜 안 되는가" 와
                                      실제 거절 사유가 어긋나지 않는다 (C007 의 규율 그대로)

    Action Request 경로             world/actions/dispatch.ts  guard-begin · guard-release
    RULE_GUARD_* / INTENT_GUARD_*   protocol/semantic-id.ts    (Traceability)

## REUSED

    RULE-DAMAGE-CALCULATE-001       world/rules/damage-calculate.ts
                                    계산식 무변경. 막기를 모르는 채로 돈다
    RULE-SWING-STRIKE-001           world/simulation/swing-strike.ts  무변경
    RULE-HIT-001 / RULE-BODY-PUSH   무변경 — 막아도 행동은 끊기고 몸은 밀린다
    RULE-SKILL-BUDGET-001           무변경 — 때린 쪽의 기력 수지는 막혔든 아니든 같다
    RULE-DOWNED-001                 무변경
    Actor.Cp / Actor.Facing         무변경 — 새 자원도 새 방향 개념도 만들지 않았다
    ActionKind                      무변경 — guard 를 행동 종류로 더하지 않았다

## CHANGED

    RULE-STRIKE-DAMAGE-001          world/rules/strike-damage.ts
        공식 결과를 RULE-GUARD-BLOCK-001 에 통과시켜 AppliedDamage 를 얻고 그것을 덜어낸다.
        막지 않았으면 AppliedDamage = FinalDamage 로 C010 과 완전히 같다.

    RULE-SKILL-BEGIN-001            world/rules/skill.ts
        Precondition 에 "막고 있지 않다" 가 더해졌다. 사유 코드 guarding 추가.
        이 판정을 행동 관문보다 **앞에** 두었다 — 막는 동안의 현재 행동은 대체 가능한
        idle/move 인 경우가 대부분이라 뒤에 두면 action-busy 도 아니고 아무 사유도
        나오지 않아 "왜 안 나가는지" 를 알 수 없게 된다.

    RULE-MOVE-MODE-001              world/rules/move-mode.ts
        run 이 성립하면 Guarding = false. 거절이 아니라 막기를 놓는 것으로 본다 —
        요청한 것이 달리기이므로 요청한 쪽이 이긴다.
        RULE-GUARD-BEGIN-001 의 반대 방향(막기를 들면 걷기로 내려온다)과 짝을 이룬다.

    RULE-DAMAGE-CALCULATE-001 의 산출물만 (계산식 아님)
        appliedDamage 를 finalDamage 와 같은 값으로 미리 채운다.
        막힌 타격이면 RULE-STRIKE-DAMAGE-001 이 덮는다.

## AFFECTED UPDATED

    world/semantic/spawn.ts         guarding: false · guardBrokenUntil: 0 로 태어난다.
                                    막기는 종류가 정하는 값이 아니므로 카탈로그에 넣지 않았다
    world/rules/damage-calculate.ts C010 주석 정정 — "Guard 는 DefenseMultiplier 를" 은
                                    설계 원본과 어긋난다 (R1 핵심 원칙 `Guard → Final Damage`,
                                    §14 `Guard → Damage Taken × 0.5`). Final Damage 로 고쳤다
    world/tests/damage.spec.ts      breakdown 전체 형태 검사에 appliedDamage 추가.
                                    amount 의 기준을 finalDamage → appliedDamage 로 옮기고,
                                    막지 않은 타격에서는 둘이 같다는 것을 함께 확인한다
    world/tests/combat.spec.ts      attributes 전체 형태 검사에 guard 추가
    RULE-NPC-DECIDE-001             코드 무변경 — 자율 존재는 막기를 요청하지 않는다.
                                    다만 자율 존재의 타격이 막히는 쪽이 되는 일이 새로 생긴다
    world-tick                      새 Tick 단계 없음 — 막기는 타격 순간에만 판정된다

## PROJECTION

    entities[].attributes.guard         world/projection/observer-view.ts  (모든 character)
    interactions[guard-begin]           world/projection/observer-view.ts  available + reason
    interactions[guard-release]         world/projection/observer-view.ts  언제나 available
    interactions[attack|skill-heavy]    reason 에 guarding 이 실린다 (기존 자리)
    strikes[].breakdown.appliedDamage   기존 breakdown 전달 경로 그대로 (spread)
    strikes[].breakdown.guard           위와 같음 — 막지 않은 타격에는 실리지 않는다
    hud[self.guard.guarding|broken]     world/projection/observer-view.ts

    protocol/gameview.ts                AttributesView.guard · GuardOutcomeView ·
                                        DamageBreakdownView.appliedDamage / guard

    투영하지 않은 것 — 세계 상수 4종과 Actor.GuardBrokenUntil.
    상수는 관찰되는 것이 아니라 그 결과가 관찰된다(prevented · cpPaid · broken).
    GuardBrokenUntil 은 절대 시각이라 보는 이에게 필요한 형태가 아니다 —
    필요한 것은 "지금 못 든다" 이고 그것은 broken 이 싣는다. (C010 이 DefenseConstant 에
    내린 판단과 같다.)

## TESTS

    world/tests/guard.spec.ts       34 tests — 전부 통과
        RULE-GUARD-BEGIN-001        7  기력 없음 · 쓰러짐 · 무너진 직후 · 재요청 · 달리기 해제 · 놓기
        RULE-GUARD-BLOCK-001 산술   5  절반 감쇄 · 대가 비례 · 하한 1 · 피해 0 · 결정론
        RULE-GUARD-BLOCK-001 방향   5  정면 · ±60° 경계 · 옆 · 뒤 · 안 막는 중
        RULE-GUARD-BLOCK-001 무너짐 4  온전히 들어감 · 회복 시간 · 전부 아니면 전무 ·
                                       두 번 막고 세 번째 무너짐
        INTENT-GUARD-RESTRICT-001   4  스킬 거절 · 놓으면 재개 · 막으며 걷기 · 달리기가 푼다
        관찰                        4  모든 존재 · interaction 목록 · 사유 · hud
        실제 타격 (2 관찰자 대치)   4  막지 않음 · 막음(생명·기력·경위) · 밀려남 · 행동 중단
        REGRESSION                  1  아무도 안 막으면 C010 값 그대로

    world 전체                      254 tests — 전부 통과 (기존 220 + 신규 34)
    npx tsc --noEmit                world/ protocol/ 오류 없음
                                    view/tests/ 3곳은 스냅샷 fixture 가 새 필드를 모른다 —
                                    Stage 7 에서 함께 고친다

## NOTES

    막기를 상태로 둔 대가
        Guarding 을 바꾸는 자리가 네 곳(begin · release · block 의 무너짐 · move-mode 의 run)
        으로 흩어진다. 행동이었다면 행동 전이 한 곳으로 모였을 것이다.
        대신 "막으며 걷기" 가 특례 없이 성립하고 ActionKind 가 늘지 않았다.
        네 곳 모두 rules/ 안에 있고 Rule 을 거치지 않는 변경 경로는 없다.

    정면 판정의 기준을 몸 중심으로 둔 이유
        칼끝(Collider.Center)이 아니라 공격자의 몸 중심을 쓴다.
        밀어냄(RULE-SWING-STRIKE-001)이 이미 몸 중심 기준이므로 두 곳이 다른 방향을 쓰면
        "막았는데 엉뚱한 쪽으로 밀린다" 가 된다.

    정확히 겹쳐 선 경우
        방향을 정할 수 없다. 막아 주는 쪽으로 판정했다 —
        겹친 것은 파고든 것이고, 그때 등 뒤로 친 것과 구분할 근거가 없다.
        `CENTER_EPSILON` 을 C006 에서 그대로 가져다 쓴다.

    수치의 근거
        GuardCpPerDamage 0.6 은 기준 배치에서 "두 번 막고 세 번째에 무너진다" 가 되도록
        역산한 값이다 (cp 30, 한 방 17 → cost 11 → 30·19·8).
        무너짐이 한 판 안에서 실제로 일어나야 이 Cycle 의 의미가 플레이에 닿는다.
