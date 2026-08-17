# C011 — World Semantic

> 세계에 값 2종(Actor)과 상수 4종이 더해지고, 규칙 3개가 새로 생기고, 기존 규칙 3개가 바뀐다.
> **피해 공식은 손대지 않는다** — RULE-DAMAGE-CALCULATE-001 은 한 줄도 바뀌지 않고,
> 막기는 그 결과값 뒤에 붙는 별도 규칙이다 (DC-COMBAT-ONE-FORMULA).

## RATIONALE — 먼저 정한 네 가지

    1. 막기는 CurrentAction 이 아니다
        Actor.Guarding 이라는 별도 상태다. 행동 자리를 쓰면 걷기와 자리를 다투게 되어
        INTENT-ACTION-STATE-001 ("언제나 정확히 하나의 행동") 을 깨야 한다.
        ActionKind 에 guard 를 더하지 않는다.

    2. 막기는 Final Damage 에 걸린다 — DefenseMultiplier 가 아니다
        R1 핵심 원칙이 `Guard → Final Damage 를 감소시킨다` 이고,
        R1 §14 도 `Guard → Damage Taken × 0.5` 다.
        주의 — `world/rules/damage-calculate.ts` 의 C010 주석은
        "Guard 는 DefenseMultiplier 를 [건드린다]" 고 적어 두었다. 그것은 C010 이 앞을
        내다보며 적은 추측이고 설계 원본과 어긋난다. 원본을 따르고 그 주석을 고친다.
        차이는 실제로 있다 — DefenseMultiplier 에 걸면 방어 능력과 곱해져 방어가 높은
        존재일수록 막기의 절대 효과가 작아지고, 최소 1 하한도 막기 이후에 걸린다.
        Final Damage 에 걸면 막기는 누구에게나 "받는 값의 절반" 으로 일정하다.

    3. 대가는 막지 않았다면 들어왔을 값이 정한다
        INTENT-GUARD-COST-001 의 "그 타격이 얼마나 큰 것이었는지" 는 감쇄 전 값이다.
        감쇄 후 값으로 매기면 잘 막을수록 싸져서 "생명 대신 기력" 이 흐려진다.

    4. 무너짐은 전부 아니면 전무다
        기력이 모자라면 부분적으로 막아 주지 않는다 (INTENT-GUARD-COLLAPSE-001).
        부분 감쇄를 허용하면 기력이 0 에 붙은 채로 영원히 조금씩 막게 되어
        "자원이 마르면 방어가 무너진다" 는 의미가 사라진다.

## SEMANTIC DELTA

    REUSED
        Actor.Hp / Actor.HpMax           생명 그대로 — 덜어내는 값만 달라진다
        Actor.Cp / Actor.CpMax           기력 그대로. 새 자원도 새 게이지도 없다
        Actor.Facing                     몸이 향한 방향 그대로 (C006 R1).
                                         막기 때문에 Facing 을 바꾸는 규칙이 생기지 않는다
        Actor.CurrentAction              행동 구조 그대로. ActionKind 가 늘지 않는다
        Actor.Defense                    방어 능력 그대로 — 막기와 곱해지지 않는다
        Actor.Modifiers                  배율 네 값 그대로. 막기는 배율 원천이 아니다
        World.Time                       세계 시각 그대로 — 무너진 뒤 회복 시점의 기준
        World.StrikeEvents               타격 기록 구조 그대로 (실리는 내용이 늘어난다)
        RULE-DAMAGE-CALCULATE-001        **한 줄도 바뀌지 않는다** — 세계의 유일한 피해 공식
        RULE-SWING-STRIKE-001            누가 맞았는지 정하는 판정 그대로.
                                         막기는 맞은 뒤에 작용하며 맞고 안 맞고를 가르지 않는다
        RULE-HIT-001                     피격 반응 그대로 — 막아도 행동은 끊긴다
        RULE-BODY-PUSH-001               밀어냄 그대로 — 막아도 몸은 밀린다
        RULE-SKILL-BUDGET-001            때린 쪽의 기력 수지 그대로.
                                         막혔다고 공격자의 충전·소모가 달라지지 않는다
        RULE-DOWNED-001                  쓰러짐 그대로
        RULE-CP-RUN-DRAIN-001            달리기 기력 소모 그대로

    ADDED
        Actor.Guarding                   지금 막고 있는가 (INTENT-GUARD-STANCE-001)
        Actor.GuardBrokenUntil           이 세계 시각까지는 다시 막을 수 없다
                                         (INTENT-GUARD-COLLAPSE-001)
        World.GuardDamageFactor          막힌 타격에 곱해지는 값 (결정론 상수)
        World.GuardArcCos                정면으로 치는 각도 범위 (결정론 상수)
        World.GuardCpPerDamage           막은 피해 1 당 치르는 기력 (결정론 상수)
        World.GuardBreakRecovery         무너진 뒤 다시 막기까지의 시간 (결정론 상수)
        GuardOutcome                     한 번의 막기 판정 결과 (파생 — 저장하지 않는다)
        DamageBreakdown.Guard            계산 경위에 더해지는 막기 단계
        DamageBreakdown.AppliedDamage    실제로 생명에서 빠진 값
        RULE-GUARD-BEGIN-001             막기를 시작한다
        RULE-GUARD-RELEASE-001           막기를 놓는다
        RULE-GUARD-BLOCK-001             막힌 타격을 판정하고 대가를 치른다

    CHANGED
        RULE-STRIKE-DAMAGE-001
            기존  Amount = RULE-DAMAGE-CALCULATE-001(...).FinalDamage
                  대상.Hp = max(0, Hp - Amount)
            변경  FinalDamage 를 RULE-GUARD-BLOCK-001 에 통과시켜 AppliedDamage 를 얻고
                  그 값을 덜어낸다. 막지 않았으면 AppliedDamage = FinalDamage 로
                  지금까지와 완전히 같다. 생명 하한·StrikeEvent 기록·쓰러짐 연쇄는 그대로다

        RULE-SKILL-BEGIN-001
            기존  Preconditions  쓰러지지 않았다 · 행동 대체 가능 · Cp >= 소모량
            변경  거기에 "막고 있지 않다" 가 더해진다.
                  거절 사유 코드 guarding 이 하나 늘어난다 (INTENT-GUARD-RESTRICT-001)

        RULE-MOVE-MODE-001
            기존  run 으로 바꾸려면 Cp > 0 이고 쓰러지지 않았다
            변경  판정은 그대로다. 다만 run 이 성립하면 Guarding 이 풀린다 —
                  거절이 아니라 막기를 놓는 것으로 본다 (INTENT-GUARD-RESTRICT-001).
                  같은 기력을 두 곳에 걸 수 없기 때문이다

        DamageBreakdown
            기존  { baseDamage, attackContribution, rawDamage,
                    targetDefense, defenseMultiplier, finalDamage }
            변경  위에 appliedDamage 와 guard 가 더해진다.
                  finalDamage 의 의미는 바뀌지 않는다 — 여전히 공식이 내놓은 값,
                  곧 "막지 않았다면 들어왔을 값" 이다.
                  StrikeEvent.Amount 는 이제 appliedDamage 와 같다
                  (막지 않은 타격에서는 finalDamage 와도 같으므로 C010 의 관계가 유지된다)

    AFFECTED
        RULE-NPC-DECIDE-001          자율 존재는 막기를 요청하지 않는다 — 결정 방식 무변경.
                                     다만 자율 존재의 타격이 막히는 쪽이 되는 일이 새로 생긴다
        RULE-ATTRIBUTE-SET-001       변경 가능 속성 목록은 늘어나지 않는다.
                                     막고 있음은 규칙으로 드는 상태이지 값으로 세울 상태가 아니다
        Observer Projection          entities[].attributes 에 막는 상태가,
                                     interactions 에 막기 두 항목이,
                                     strikeEvents[].breakdown 에 막기 단계가 더해진다
        world-tick                   새 Tick 단계를 만들지 않는다 — 막기는 타격 순간에만 판정된다

## WORLD STATE

    Actor
        Guarding           bool     World Authority
                                    RULE-GUARD-BEGIN / RELEASE / BLOCK 과
                                    RULE-MOVE-MODE-001(run) 만이 바꾼다
        GuardBrokenUntil   number   World Authority
                                    RULE-GUARD-BLOCK-001 의 무너짐만이 세운다.
                                    세계 시각과 비교되는 값이다 (초기값 0)

    World (결정론 상수 — 헤더 고정, CVar 아님)
        GuardDamageFactor   0.5   막힌 타격이 남기는 비율 (R1 §14 그대로)
        GuardArcCos         0.5   Facing 과 이루는 각의 코사인 하한 → 정면 ±60°
        GuardCpPerDamage    0.6   막지 않았다면 들어왔을 피해 1 당 치르는 기력
        GuardBreakRecovery  1.0   무너진 뒤 다시 막을 수 없는 시간(초)

    GuardOutcome (파생 — 저장하지 않는다)
        Blocked      bool     막혔는가
        Broken       bool     이 타격에 방어가 무너졌는가
        CpPaid       number   실제로 치른 기력 (무너졌으면 0)
        Prevented    number   막아서 덜 들어간 값 = FinalDamage - AppliedDamage

## WORLD RULE

    RULE-GUARD-BEGIN-001
        Implements     INTENT-GUARD-STANCE-001 · INTENT-GUARD-GATE-001
        Input          Actor
        Preconditions  1. 쓰러지지 않았다
                       2. Cp > 0                        (치를 것이 하나도 없으면 못 든다)
                       3. World.Time >= GuardBrokenUntil (무너진 직후가 아니다)
        Transition     Guarding = true
                       MoveMode = walk                  (달리는 중이었으면 걷기로 내린다)
        Result         Success | Failure(downed | insufficient-cp | guard-broken)

        이미 막고 있는 Actor 가 다시 요청하면 Success 이고 아무것도 달라지지 않는다 —
        요청은 토글이 아니라 명시값이다 (RULE-MOVE-MODE-001 과 같은 판단).

    RULE-GUARD-RELEASE-001
        Implements     INTENT-GUARD-STANCE-001
        Input          Actor
        Preconditions  없음 — 놓는 것은 언제나 가능하다.
                       힘이 빠져 손을 내리는 것을 막을 이유가 없다 (RULE-MOVE-MODE-001 의 walk 와 같다)
        Transition     Guarding = false
        Result         Success

    RULE-GUARD-BLOCK-001
        Implements     INTENT-GUARD-DIRECTION-001 · INTENT-GUARD-MITIGATE-001 ·
                       INTENT-GUARD-COST-001 · INTENT-GUARD-COLLAPSE-001
        Input          대상 Actor, 공격자 Actor, FinalDamage (RULE-DAMAGE-CALCULATE-001 의 결과)
        Preconditions  없음 — 이 규칙은 언제나 돌고 스스로 막혔는지 아닌지를 정한다
        Transition
            정면 판정   Incoming = normalize(공격자.Position - 대상.Position)
                       Frontal  = dot(대상.Facing, Incoming) >= GuardArcCos

            막지 않음   Guarding 이 거짓이거나 Frontal 이 거짓이면
                       → { Blocked: false, Broken: false, CpPaid: 0,
                           AppliedDamage: FinalDamage }
                       상태를 아무것도 바꾸지 않는다

            대가 산정   Cost = ceil(FinalDamage × GuardCpPerDamage)

            무너짐      대상.Cp < Cost 이면
                       → 대상.Guarding = false
                         대상.GuardBrokenUntil = World.Time + GuardBreakRecovery
                       → { Blocked: false, Broken: true, CpPaid: 0,
                           AppliedDamage: FinalDamage }
                       무너진 타격은 막지 못한 것으로 온전히 들어간다

            막힘        그 외
                       → 대상.Cp = 대상.Cp - Cost
                       → AppliedDamage = FinalDamage > 0
                                         ? max(1, round(FinalDamage × GuardDamageFactor))
                                         : 0
                       → { Blocked: true, Broken: false, CpPaid: Cost, AppliedDamage }
        Result         GuardOutcome + AppliedDamage

        하한 1 은 "막기는 아프지 않게 할 뿐 없던 일로 만들지 못한다" 를 반올림이
        깨뜨리지 못하게 하는 것이다 (INTENT-GUARD-MITIGATE-001).
        C010 의 방어 하한과 같은 판단이며 같은 이유다.
        입력에 세계 시각도 난수원도 없다 — 무너짐 판정에 쓰는 World.Time 은 결과가 아니라
        무너진 뒤의 회복 시점을 세우는 데만 쓰인다 (DC-COMBAT-PLAYER-CAUSALITY).

    RULE-STRIKE-DAMAGE-001 (CHANGED)
        Implements     INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001 ·
                       INTENT-GUARD-BREAKDOWN-001
        Input          공격자 Actor, 대상 Actor, SkillKind, World
        Preconditions  대상이 쓰러지지 않았다 (그대로)
        Transition     Breakdown = RULE-DAMAGE-CALCULATE-001(공격자, 대상, 스킬)
                       Guard     = RULE-GUARD-BLOCK-001(대상, 공격자, Breakdown.FinalDamage)
                       Breakdown.Guard = Guard
                       Breakdown.AppliedDamage = Guard.AppliedDamage
                       대상.Hp = max(0, Hp - Breakdown.AppliedDamage)
                       World.StrikeEvents += { …, Amount: AppliedDamage, Breakdown, 위치, 시각 }
                       Hp 가 0 이면 RULE-DOWNED-001
        Result         Damaged(AppliedDamage)

        한 번의 휘두름이 여럿에게 닿으면 맞은 몸마다 따로 돈다 —
        각자의 방향과 각자의 기력으로 각자 막거나 무너진다.

    RULE-SKILL-BEGIN-001 (CHANGED)
        Preconditions  1. 쓰러지지 않았다
                       2. 막고 있지 않다                    ← ADDED
                       3. 현재 행동이 대체 가능하다
                       4. Cp >= CpCost × Modifiers.CpConsume
        Result         Success | Failure(downed | guarding | action-busy | insufficient-cp)

        막기 판정을 행동 관문보다 앞에 둔다 — 막고 있는 동안은 행동이 대체 가능한
        idle 이나 move 인 경우가 대부분이라, 뒤에 두면 실제 사유가 드러나지 않는다.

    RULE-MOVE-MODE-001 (CHANGED)
        Transition     MoveMode = 요청값
                       요청값이 run 이고 판정을 통과했으면 Guarding = false   ← ADDED
        Result         Success | Failure(downed | insufficient-cp | unknown-move-mode)

## OBSERVABLE SEMANTIC

    Actor.Guard (모든 character 에 실린다 — 세계는 숨기지 않는다)
        guarding        지금 막고 있는가
        broken          지금 무너져서 다시 막을 수 없는 상태인가
                        (World.Time < GuardBrokenUntil)

    Guard Interaction (관찰자 자신의 몸에 대해)
        guard-begin     available + reason(downed | insufficient-cp | guard-broken)
                        판정은 RULE-GUARD-BEGIN-001 의 Precondition 과 같은 함수를 쓴다
        guard-release   available 은 언제나 참 — 놓는 데에는 조건이 없다

    Skill Interaction (기존)
        reason 에 guarding 이 더해진다 — 막고 있어서 못 쓴다는 것이 드러난다

    StrikeEvent.Breakdown (기존 경위에 더해진다)
        finalDamage     막지 않았다면 들어왔을 값 (의미 무변경)
        guard.blocked   막혔는가
        guard.broken    이 타격에 무너졌는가
        guard.cpPaid    치른 기력
        guard.prevented 막아서 덜 들어간 값
        appliedDamage   실제로 생명에서 빠진 값 (= StrikeEvent.Amount)

    막지 않은 타격에는 guard 가 실리지 않는다 — 기존 관찰이 그대로 성립한다.

## SEMANTIC CLOSURE

    "막고 있음이라는 상태를 가질 수 있다"     → Actor.Guarding
    "스스로 끝나지 않고 놓을 때까지 유지된다" → Guarding 을 바꾸는 규칙이 4개뿐이고
                                              시간으로 푸는 규칙이 없다
    "여전히 하나의 현재 행동 안에 있다"       → ActionKind 무변경 · CurrentAction 무변경
    "쓰러진 몸은 막을 수 없다"                → RULE-GUARD-BEGIN-001 Precondition 1
    "치를 기력이 없으면 시작할 수 없다"       → RULE-GUARD-BEGIN-001 Precondition 2
    "무너진 직후 잠시 다시 시작할 수 없다"    → Precondition 3 + Actor.GuardBrokenUntil
    "시작되지 못하면 사유를 알 수 있다"       → Result.Failure + guard-begin.reason
    "막는 동안 스킬은 시작되지 않는다"        → RULE-SKILL-BEGIN-001 Precondition 2 (ADDED)
    "걷는 것은 된다"                          → move 는 Guarding 을 보지 않는다 (무변경)
    "달리기를 시작하면 막기가 풀린다"         → RULE-MOVE-MODE-001 Transition (CHANGED)
    "앞쪽만 막는다"                           → RULE-GUARD-BLOCK-001 정면 판정 · GuardArcCos
    "옆·뒤는 막지 않은 것과 같다"             → Frontal 거짓 → Blocked 거짓 → 상태 무변경
    "막힌 타격은 덜 덜어낸다"                 → AppliedDamage = round(Final × GuardDamageFactor)
    "새 계산이 생기지 않는다"                 → RULE-DAMAGE-CALCULATE-001 REUSED (무변경)
    "최소한의 피해는 통과한다"                → AppliedDamage 하한 1
    "같은 조건이면 언제나 같은 값"            → 난수원 없음 · 입력이 위치·Facing·Cp 뿐
    "막힌 타격마다 기력을 치른다"             → RULE-GUARD-BLOCK-001 Cost 차감
    "큰 것을 막을수록 크게 치른다"            → Cost = ceil(FinalDamage × GuardCpPerDamage)
    "새 자원이 아니라 그 기력이다"            → Actor.Cp REUSED — 새 State 없음
    "막아도 몸은 밀린다"                      → RULE-SWING-STRIKE-001 의 충격량 REUSED,
                                              RULE-GUARD-BLOCK-001 은 Velocity 를 건드리지 않는다
    "기력이 모자라면 방어가 무너진다"         → RULE-GUARD-BLOCK-001 무너짐 분기
    "무너지면 막기가 풀린다"                  → Guarding = false
    "그 타격은 온전히 들어간다"               → AppliedDamage = FinalDamage
    "부분적으로 막아 주지 않는다"             → 분기가 둘뿐 — 중간 값이 없다
    "누가 막고 있는지 관찰된다"               → Actor.Guard.guarding (모든 character)
    "무너지는 순간이 드러난다"                → StrikeEvent.Breakdown.guard.broken
    "막기의 몫이 경위에 남는다"               → guard.prevented · guard.cpPaid · appliedDamage
    "막지 않았다면 얼마였는지"                → breakdown.finalDamage (의미 무변경)
    "걸 수 있다는 사실을 세계가 밝힌다"       → interactions[guard-begin | guard-release]

## NOTE — 01-cycle.md 의 표현 하나를 좁힌다

    01-cycle.md 는 "막기를 걸 수 있다는 것이 **세계가 밝히는 명령 목록**(C009 Command Catalog)에
    오른다" 고 적었다. 여기서는 그것을 **interactions** 로 좁힌다.

    C009 가 세운 구분이 그렇기 때문이다 — Command 는 세계의 규칙 **밖에서** 세계에 손대는 것이고
    (`world/semantic/command-catalog.ts` 주석), Interaction 은 몸이 세계 **안에서** 하는 일이다.
    막기는 몸이 하는 일이므로 스킬·이동과 같은 자리에 있어야 한다.
    Command Catalog 에 넣으면 막기가 디버그 조작과 같은 층으로 내려간다.

    "목록과 그 조건을 세계가 소유하고 관찰 결과에 실어 보낸다" 는
    DC-WORLD-OWNS-THE-SURFACE-LIST 의 요구는 interactions 쪽에서 그대로 지켜진다 —
    available 과 reason 이 세계 판정 함수에서 나오고 View 는 그것을 읽기만 한다.
