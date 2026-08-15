# C010 — World Implementation

> 입력: `03-world-semantic.md` (R1) · 현재 `world/` · `protocol/`
> 05-review.md APPROVED 이후 착수.

## IMPLEMENTED

    ── ADDED State ───────────────────────────────────────────────────
    Actor.Stance                     world/semantic/actor.ts · combat.ts (type Stance)
    Actor.GuardBrokenUntil           world/semantic/actor.ts
    Actor.GuardBroken (파생)         world/semantic/combat.ts  isGuardBroken(actor, time)
    Actor.Defense                    world/semantic/actor.ts
    Defense (종류가 정하는 값)       world/semantic/character-catalog.ts  DefenseSpec
                                     rabbit-swordsman 5 · wanderer 3 · DEFAULT 3
    스폰 초기값                      world/semantic/spawn.ts (stance open · brokenUntil 0)

    ── ADDED Rule ────────────────────────────────────────────────────
    RULE-GUARD-SET-001               world/rules/guard.ts  ruleGuardSet · evaluateGuardSet
    RULE-GUARD-ABSORB-001            world/rules/guard.ts  isGuardBlocking · guardCost
                                     (03 이 정한 대로 독립 실행 순서를 갖지 않는다 —
                                      RULE-STRIKE-DAMAGE-001 이 이 판정과 계산을 불러 쓴다)
    RULE-GUARD-BREAK-001             world/rules/guard.ts  ruleGuardBreak

    ── ADDED 상수 ────────────────────────────────────────────────────
    MIN_DAMAGE_RATIO 0.1 · GUARD_FRONT_COS 0.5 · GUARD_DAMAGE_RATIO 0.15 ·
    GUARD_CP_PER_DAMAGE 0.8 · GUARD_BREAK_LOCK 1.5      world/semantic/combat.ts
    CENTER_EPSILON 은 C006 것을 그대로 쓴다 (collision.ts) — 새로 만들지 않았다

    ── ADDED 경계 타입 ───────────────────────────────────────────────
    ActionRequest.stance             protocol/actions.ts
    StanceView · StrikeBreakdownView protocol/gameview.ts
    AttributesView.defense           protocol/gameview.ts
    Semantic Identifier 14종         protocol/semantic-id.ts (RULE 3 · INTENT 11)

## CHANGED

    RULE-STRIKE-DAMAGE-001           world/rules/strike-damage.ts
        03 의 다섯 단계를 그대로 코드 순서로 옮겼다 —
        본래 피해 → 방어력 감쇄 → 막힘 판정 → 네 갈래(4-A/4-B/4-C) → 기록.
        반환값이 number|null 에서 StrikeOutcome|null 로 바뀐다 (부르는 쪽이 guarded 를 본다).

    RULE-ACTION-BEGIN-001            world/rules/action-begin.ts
        evaluateActionBegin(actor) → evaluateActionBegin(actor, kind).
        Stance = guard 이면 move/idle 외에는 'guarding'. 관문이 한 곳이므로
        스킬·채굴이 자동으로 막히고 걸음은 통과한다.
        ActionBusyReason 에 'guarding' 이 더해져 호출자 3곳의 사유 타입이 함께 넓어진다.

    RULE-SWING-STRIKE-001            world/simulation/swing-strike.ts
        순서를 바꿨다 — RULE-STRIKE-DAMAGE-001 이 먼저, 그 결과 guarded 가 거짓일 때만
        RULE-HIT-001. 충격량은 막힘과 무관하게 그대로 적용된다 (막아도 몸은 밀린다).

    RULE-MOVE-MODE-001               world/rules/move-mode.ts
        run 요청이 받아들여지면 Stance = open. walk 는 자세를 건드리지 않는다.

    RULE-DOWNED-001                  world/rules/strike-damage.ts  ruleDowned
        Stance = open 을 함께 한다. 쓰러진 몸에는 자세가 남지 않는다.

    RULE-ATTRIBUTE-SET-001           world/rules/attribute-set.ts
        MutableAttribute 에 defense(수치) · stance(open|guard) 추가.
        목록의 단일 출처는 여전히 MUTABLE_ATTRIBUTES 하나이므로
        command-catalog 의 set-attribute Domain 도 저절로 두 항목 늘어난다 — 손대지 않았다.

## REUSED

    Actor.Cp / CpMax                 (C007) 방어 전용 게이지를 만들지 않았다
                                     — DC-COMBAT-SHARED-BUDGET 이 코드에서 지켜진 자리
    Actor.Facing                     (C006) 막힘 판정이 이것만 쓴다. 새 방향 개념 없음
    CENTER_EPSILON                   (C006) 겹친 몸의 방향 판정 한계
    ActionCollider / StruckActorIds  (C006) 접촉 탐지 그대로
    RULE-SKILL-BUDGET-001            (C007) 막혔어도 때린 자는 정산한다 — 손대지 않았다
    Actor.Modifiers                  (C007) 새 배율 원천을 더하지 않았다
    RULE-WORLD-TICK-001              (C003) 새 Tick 단계가 없다 —
                                     무너짐의 여파는 시각 비교로 스스로 가신다

## AFFECTED UPDATED

    RULE-HIT-001                     world/rules/attack.ts
        쓰러진 몸은 피격 상태로 가지 않는다는 조건을 명시했다.
        C007 까지는 호출 순서(HIT → STRIKE-DAMAGE)가 이것을 보장했으나 C010 이 순서를
        뒤집었으므로 순서에 기대던 보장을 조건으로 옮겼다.
        새 게임 의미가 아니라 INTENT-DOWNED-001 의 유지다 —
        고치지 않으면 쓰러진 몸이 곧바로 hit 으로 덮여 downed 가 사라진다
        (기존 테스트 3개가 실제로 이것을 잡았다).

    RULE-NPC-DECIDE-001              world/simulation/npc-decide.ts
        관문 호출에 종류를 넘긴다. 자율 존재는 막지 않으므로(01 EXCLUDED)
        자세가 결정을 좁히는 일은 없다.

    RULE-MOVE-001 / RULE-MINE-001 / RULE-SKILL-BEGIN-001
        관문 호출에 종류를 넘기고 사유 타입이 넓어진 것뿐 — 판정 자체는 그대로다.

## PROJECTION

    world/projection/observer-view.ts — SPEC_ID 를
    VIEW-GUARD-TRADES-BODY-FOR-RESOURCE-001 로 올렸다.

    entities[].stance                 guarding · broken · brokenUntil · facing
    entities[].attributes.defense     모든 Actor 에 대해 (C007 R2 원칙 그대로)
    interactions[guard]               available + reason (4종)
    hud self.defense / self.stance / self.guardBroken / self.guardBrokenUntil
    strikes[].breakdown               base · mitigated · guarded · energyPaid · guardBroken

    04 계약과의 대응은 04 의 OBSERVABLE PROJECTION NOTE 그대로다.
    관찰 판정은 Rule 과 같은 함수를 쓴다 (evaluateGuardSet) — 사유가 어긋날 수 없다.

## ACTION REQUEST

    world/actions/dispatch.ts — interactionId 'guard' 분기 하나가 늘었다.
    stance 가 없으면 missing-stance 로 거절한다 (기존 missing-mode 와 같은 형태).

## TESTS

    world/tests/guard.spec.ts (신규 34) — 전부 통과
        GUARD-STANCE          세우기/놓기 명시값 · 스스로 끝나지 않음 · 막은 채로 걷기
        GUARD-BEGIN-GATE      action-busy · insufficient-cp · downed · 놓기는 무조건
        GUARD-EXCLUSIVE       스킬 차단(guarding) · 채굴 차단 · run 이 놓음 · guard 가 walk 로
        DEFENSE-MITIGATION    막지 않아도 걷어냄 · 방어력 9999 에도 최소 몫 통과
        GUARD-ABSORB          생명↓기력↓ 실측 · hpLoss+absorbed = mitigated · 큰 것이 더 비쌈
        GUARD-DIRECTION       뒤에서는 안 막힘 · 앞에서는 막힘 (같은 자세, 다른 방향)
        GUARD-KEEPS-STANCE    막으면 hit 아님 · 못 막으면 hit (C007 회귀) · 막아도 밀림
        GUARD-BREAK           본래 피해로 전환 · Cp 0 · 자세 풀림 · 2대 뒤 3대째 무너짐
        BREAK-AFTERMATH       여파 중 재-막기 불가 · 스스로 가심 · 남은 시간 관찰
        DOWNED (CHANGED)      쓰러지면 자세가 풀린다
        관찰                  남의 자세 · 자기 가용성/사유 · 내역 6종
        DC-PLAYER-CAUSALITY   같은 상태 두 번 → 같은 내역 (toEqual)
        DC-SHARED-BUDGET      막느라 쓴 기력은 고급 스킬에 못 쓴다

    world/tests/combat.spec.ts (C007) — 방어력 감쇄를 반영해 갱신, 전부 통과
        피해 기대값을 mitigated(base) 로 바꿨다 (본래 피해가 아니라 걷어낸 뒤의 값이다)
        strikes 기대값에 breakdown 을 더했다
        attributes 기대값에 defense 를 더했다
        MutableAttribute 목록 기대값에 defense · stance 를 더했다
    world/tests/command.spec.ts (C009) — 같은 목록 갱신, 통과

    실행 결과   world 12 파일 196 테스트 전부 통과 (기존 162 + 신규 34)

## NOTES

    ① 03 의 수치 설명에 대수 오류가 있었다 (R1 로 정정).
       "시작 기력 30 으로 3대를 막고 4대째 무너진다" → 실제는 2대를 막고 3대째다.
       상수는 바꾸지 않았다 — 틀린 것은 설명이었고, 실제 값은 테스트가 실행으로 보인다.
       회전이 짧다고 판단되면 고칠 자리는 GUARD_CP_PER_DAMAGE 하나다.

    ② Hp 가 정수가 아니게 된다 (막아 내면 2.25 가 나간다).
       세계는 결정론을 위해 실수를 그대로 두고, 반올림은 View 의 표현 결정으로 남긴다.
       C007 이 배율에서 이미 택한 것과 같은 자세다.

    ③ 새 Tick 단계를 만들지 않았다. 무너짐의 여파는 GuardBrokenUntil 과 World.Time 의
       비교로만 존재하므로 만료 Rule 도 저장도 없다 (03 WORLD STATE 의 판단 그대로).

    ④ WORLD SEMANTIC GAP 없음. 03 의 ADDED / CHANGED 가 모두 코드에 있다.
