# C007 — World Semantic

> R1 축소 개정 — 판정 능력치(CombatStats)와 World.Chance 를 제외했다.
> 피해는 SkillDefinition.Damage 하나로 결정되며, 세계는 지금까지대로 완전한 결정론이다.
>
> R2 개정 (Human Review 반영) — ① 모든 Actor 의 모든 속성을 관찰 계약에 싣는다
> ("관찰되지 않는 것" 목록 삭제), ② World.DebugAuthority 와 RULE-ATTRIBUTE-SET-001 로
> 속성 변경 경로를 하나 세운다 (기반만).

## SEMANTIC DELTA
    REUSED
        Actor.Id · Position · CharacterKind · Control       (C001·C002) 존재의 뼈대
        Actor.CurrentAction · ActionDefinition · Progress   (C002) 스킬은 새 행동 종류로 얹힌다
        Actor.MoveSpeed                                      (C001) 이제 능력치로 승격 (CHANGED 참조)
        Actor.AttackRange · Facing · Body · Velocity         (C002·C006) 타격 대상 판정 그대로
        ActionCollider · CurrentAction.StruckActorIds        (C006) 접촉 판정 구조 그대로
        RULE-ACTION-BEGIN-001                                (C002) 모든 행동 시작의 관문
        RULE-HIT-001                                         (C002) 피격 반응 — 그대로
        RULE-SWING-STRIKE-001                                (C006) 접촉 탐지 — 결과만 확장 (CHANGED)
        RULE-WORLD-TICK-001                                  (C003) 모든 흐름이 실릴 시간 진행
        Observer.ActorId · Projection                        (C004) 자기 정보의 수신 대상 판별

    ADDED
        Actor.Name                                           불러 줄 이름 (INTENT-ENTITY-IDENTITY-001)
        Actor.Hp · Actor.HpMax                               생명
        Actor.Cp · Actor.CpMax                               기력
        Actor.Downed (파생)                                  Hp = 0
        Actor.MoveMode                                       walk | run
        Actor.TempoStats                                     MoveSpeed(승격) · RunSpeedMultiplier · ActionSpeed
        Actor.Modifiers (파생)                               CpCharge · CpConsume · MoveSpeed · ActionSpeed 배율
        ActionKind 'heavy-attack'                            고급 스킬
        ActionKind 'downed'                                  쓰러진 상태 (스스로 벗어나지 않는다)
        SkillDefinition                                      스킬별 (고정 피해, 충전량, 소모량, 기본 길이)
        World.StrikeEvents                                   최근 타격 결과들 (관찰용, 시간이 지나면 사라짐)
        World.DebugAuthority (R2)                            세계가 속성 변경을 허용하는가
        MutableAttribute (R2)                                바꿀 수 있는 속성의 목록과 각자의 허용 범위
        RULE-ATTRIBUTE-SET-001 (R2)
        RULE-SKILL-BEGIN-001
        RULE-STRIKE-DAMAGE-001
        RULE-SKILL-BUDGET-001
        RULE-CP-RUN-DRAIN-001
        RULE-MOVE-MODE-001
        RULE-DOWNED-001
        RULE-STRIKE-EVENT-EXPIRE-001

    CHANGED
        RULE-ATTACK-001
            기존  Actor 는 대상 없이 휘두른다. Precondition 은 action-busy 하나
            변경  RULE-SKILL-BEGIN-001 로 일반화된다 — 스킬 종류를 입력으로 받고,
                  Precondition 에 "쓰러지지 않았을 것"과 "기력이 소모량 이상일 것"이 더해진다.
                  기본 스킬은 기존 attack 그대로다 (행동 종류 이름을 바꾸지 않는다)
        RULE-SWING-STRIKE-001
            기존  접촉한 몸마다 RULE-HIT-001 + 충격량
            변경  접촉한 몸마다 RULE-STRIKE-DAMAGE-001 도 함께 일어난다.
                  쓰러진 몸은 대상에서 제외된다
        RULE-MOVE-PROGRESS-001
            기존  MoveSpeed(고정 상수) × dt 만큼 나아간다
            변경  MoveSpeed × Modifiers.MoveSpeed × (MoveMode = run 이면 RunSpeedMultiplier) × dt
        RULE-ACTION-PROGRESS-001 / RULE-ACTION-BEGIN-001
            기존  행동 길이는 ActionDefinition.Duration 고정
            변경  스킬 행동은 시작하는 순간의 ActionSpeed 결과값으로 길이가 정해진다 —
                  길이는 시작 시 확정되며 진행 중에 바뀌지 않는다 (진행도의 기준이 흔들리지 않게)
        RULE-NPC-DECIDE-001
            기존  인지 대상에게 접근하고 사거리 안이면 휘두른다
            변경  쓰러진 자는 아무것도 결정하지 않는다.
                  쓰러진 자는 인지 대상이 되지 않는다.
                  자율 존재는 기본 스킬만 쓴다
        RULE-WORLD-TICK-001
            Transition 에 기력 누수·타격 결과 만료 두 단계가 추가된다 (아래 순서 참조)
        RULE-OBSERVER-JOIN-001
            새로 놓이는 몸은 이름·자원·템포 능력치를 자기 CharacterKind 의 값으로 갖는다

    AFFECTED
        RULE-MINE-001              쓰러진 자는 채굴도 시작하지 못한다 (RULE-ACTION-BEGIN-001 이 막는다)
        RULE-MOVE-001              쓰러진 자는 이동도 시작하지 못한다 (같은 관문)
        RULE-BODY-PUSH-001         쓰러진 몸도 여전히 공간을 차지하고 밀린다 (몸은 사라지지 않는다)
        RULE-BODY-MOMENTUM-001     변경 없음
        RULE-OBSERVER-MARK-001     변경 없음 — 관찰 결과가 커질 뿐이다

## WORLD STATE

    Actor
        Name             World Authority   몸이 놓일 때 세계가 순번으로 정하고 변하지 않는다.
                                           (R2 정정 — 관찰자가 밝힌 Id 를 이름에 섞지 않는다.
                                            세계 밖에서 온 문자열은 세계 안 존재의 이름이 될 수
                                            없다는 C004 RULE-OBSERVER-JOIN-001 의 원칙 그대로다)
        Hp               World Authority   0 <= Hp <= HpMax. RULE-STRIKE-DAMAGE-001 만이 줄인다
        HpMax            World Authority   CharacterKind 가 정하는 고정값
        Cp               World Authority   0 <= Cp <= CpMax.
                                           RULE-SKILL-BUDGET-001 · RULE-CP-RUN-DRAIN-001 만이 바꾼다
        CpMax            World Authority   CharacterKind 가 정하는 고정값
        MoveMode         World Authority   walk | run — RULE-MOVE-MODE-001 만이 바꾼다
        TempoStats       World Authority   CharacterKind 가 정하는 고정값 3종
            MoveSpeed            보통 걸음의 빠르기 (C001 상수의 승격)
            RunSpeedMultiplier   달릴 때 곱해지는 값
            ActionSpeed          스킬 행동 길이에 걸리는 배율 (클수록 빠르다)

    Actor.Downed (파생 상태 — 저장하지 않는다)
        Downed ⇔ Hp = 0
        쓰러짐이 상태로 드러나는 자리는 CurrentAction.kind = 'downed' 다 —
        행동 시작 관문(RULE-ACTION-BEGIN-001)이 이미 "대체 불가능한 행동"을 막으므로
        쓰러진 자의 행동 금지에 새 관문을 만들지 않는다.

    Actor.Modifiers (파생 상태 — 저장하지 않고 세계 상태에서 유도, INTENT-MODIFIER-COMPOSE-001)
        CpCharge     ∏(걸린 원천들)     원천: MoveMode = run → RUN_CHARGE_FACTOR
                                              CurrentAction.kind = 'hit' → HIT_CHARGE_FACTOR
        CpConsume    ∏(걸린 원천들)     이번 Cycle 의 원천 없음 → 1
        MoveSpeed    ∏(걸린 원천들)     이번 Cycle 의 원천 없음 → 1
        ActionSpeed  ∏(걸린 원천들)     이번 Cycle 의 원천 없음 → 1
        네 값 모두 [MODIFIER_MIN, MODIFIER_MAX] 로 묶인다.
        원천이 하나도 없으면 1 이다. 원천이 늘어도 이 합성 규칙은 바뀌지 않는다.

    World.StrikeEvents  World Authority   최근 타격 결과들. RULE-STRIKE-DAMAGE-001 이 쌓고
                                          RULE-STRIKE-EVENT-EXPIRE-001 이 치운다
        AttackerId · TargetId · SkillKind
        Amount           덜어낸 생명
        Position         결과가 드러나는 자리 (맞은 몸의 중심)
        Time             일어난 세계 시각

    World.DebugAuthority (R2)
        Open             World Authority   세계가 시작될 때 정해진다.
                                           열려 있으면 속성 변경 요청을 받아들인다.
                                           이 값 자체는 요청으로 바꿀 수 없다 —
                                           세계 밖(세계를 띄우는 쪽)이 정한다

    MutableAttribute (R2 — 바꿀 수 있는 속성의 목록. 세계가 아는 고정 표)
        Id               Hp · HpMax · Cp · CpMax ·
                         MoveSpeed · RunSpeedMultiplier · ActionSpeed · MoveMode
        Range            각 속성의 허용 범위 (수치는 [최소, 최대], MoveMode 는 walk | run)
        제외             파생 상태(Downed · Modifiers)와 정체성(Id · Name · CharacterKind ·
                         Control) 은 바꿀 수 없다 — 유도되는 값이거나 존재를 존재이게 하는 값이다.
                         세계 상수(스킬 피해·기력 수지)도 이번 Cycle 의 대상이 아니다 (01 EXCLUDED)

    SkillDefinition (스킬 종류별 고정값 — 결정론 시뮬레이션 값)
        Kind             attack (기본) | heavy-attack (고급)
        BaseDuration     ActionSpeed 가 걸리기 전의 행동 길이
        Damage           한 번의 타격이 덜어내는 생명 (고정 — R1)
        CpCharge         한 번의 타격이 채우는 기력
        CpCost           한 번의 타격이 소모하는 기력

    시뮬레이션 상수 (결정론 — 헤더 상수 고정)
        COMBAT_PROFILES        CharacterKind → 자원·템포 능력치 묶음
        SKILL_DEFINITIONS      attack        BaseDuration 0.6 · Damage 20 · Charge 12 · Cost 0
                               heavy-attack  BaseDuration 0.9 · Damage 55 · Charge 8  · Cost 30
        RUN_CP_DRAIN 6.0       달리는 동안 초당 흘러나가는 기력
        RUN_CHARGE_FACTOR 0.5  달리는 중 기력 충전 배율
        HIT_CHARGE_FACTOR 0.2  피격 반응 중 기력 충전 배율
        MODIFIER_MIN 0.1 / MODIFIER_MAX 3.0
        ACTION_SPEED_MIN 0.5 / ACTION_SPEED_MAX 2.0   행동 길이 배율의 한계
        STRIKE_EVENT_TTL 1.2   타격 결과가 관찰되는 시간

    COMBAT_PROFILES (초기값 — 존재 종류가 정한다)
                             rabbit-swordsman (관찰자의 몸)   wanderer (자율 존재)
        HpMax                200                              120
        CpMax / 시작 Cp      100 / 30                         60 / 20
        MoveSpeed            6.0 (기존 MOVE_SPEED)            2.5 (기존 NPC_MOVE_SPEED)
        RunSpeedMultiplier   1.8                              1.4
        ActionSpeed          1.0                              0.85

        기본 스킬 20 · 고급 스킬 55 이므로 —
        자율 존재(120)는 기본 6대 또는 고급 2대 + 기본 1대에 쓰러진다.
        관찰자의 몸(200)은 자율 존재의 기본 스킬 10대를 견딘다.
        고급 스킬(소모 30, 충전 8)은 기본 스킬 3대(충전 36)를 모아야 한 번 나간다.

## WORLD RULE

    RULE-SKILL-BEGIN-001 (RULE-ATTACK-001 의 일반화)
        Implements     INTENT-ATTACK-001(CHANGED) · INTENT-SKILL-COST-GATE-001 ·
                       INTENT-DOWNED-001 · INTENT-TEMPO-ACTION-001
        Input          Actor, SkillKind
        Preconditions  1. Actor 가 쓰러지지 않았다
                       2. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001 의 관문)
                       3. Cp >= SkillDefinition.CpCost × Modifiers.CpConsume
        Transition     CurrentAction = SkillKind (대상을 담지 않는다),
                       StruckActorIds = [],
                       Duration = clamp(BaseDuration / (ActionSpeed × Modifiers.ActionSpeed),
                                        BaseDuration / ACTION_SPEED_MAX, BaseDuration / ACTION_SPEED_MIN)
        Result         Success | Failure(downed | action-busy | insufficient-cp)

    RULE-STRIKE-DAMAGE-001 (R1 — 판정 없는 고정 피해)
        Implements     INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001
        Input          공격자 Actor, 대상 Actor, SkillKind
        Preconditions  대상이 쓰러지지 않았다 (쓰러진 몸은 더 이상 타격 대상이 아니다)
        Transition     Amount = SkillDefinition(SkillKind).Damage
                       대상.Hp = max(0, 대상.Hp - Amount)
                       World.StrikeEvents += { 공격자, 대상, SkillKind, Amount,
                                               대상.Position, World.Time }
                       대상.Hp = 0 이면 RULE-DOWNED-001
        Result         Damaged(Amount)
        Note           피해에 흔들림이 없으므로 우연을 소비하지 않는다 —
                       같은 입력이면 언제나 같은 결과다 (기존 결정론 그대로)

    RULE-SKILL-BUDGET-001
        Implements     INTENT-SKILL-BUDGET-001
        Input          공격자 Actor, SkillKind, 이 휘두름의 첫 타격인가
        Preconditions  이 휘두름에서 아직 정산하지 않았다 —
                       한 휘두름은 여러 몸을 때려도 기력 수지를 한 번만 낸다
        Transition     Cp = clamp(Cp
                                  + Skill.CpCharge × Modifiers.CpCharge
                                  - Skill.CpCost   × Modifiers.CpConsume, 0, CpMax)
                       충전과 소모는 각자의 배율을 받아 같은 순간에 함께 적용된다
        Result         Settled(charged, consumed)
        Note           허공을 가른 휘두름은 정산하지 않는다 — 맞아야 기력이 돈다

    RULE-CP-RUN-DRAIN-001
        Implements     INTENT-RUN-001
        Input          모든 Actor, dt
        Preconditions  MoveMode = run 이고 실제로 이동 중이다 (CurrentAction.kind = move)
        Transition     Cp = max(0, Cp - RUN_CP_DRAIN × Modifiers.CpConsume × dt)
                       Cp 가 0 이 되면 MoveMode = walk (더 달릴 수 없다)
        Result         Drained(amount) | Exhausted

    RULE-MOVE-MODE-001
        Implements     INTENT-RUN-001
        Input          Actor, 요청한 MoveMode (walk | run)
        Preconditions  run 으로 바꾸려면 Cp > 0 이고 쓰러지지 않았다
        Transition     MoveMode = 요청값
        Result         Success | Failure(downed | insufficient-cp)
        Note           요청은 토글이 아니라 명시값이다 — 같은 요청이 두 번 와도 결과가 같다

    RULE-DOWNED-001
        Implements     INTENT-DOWNED-001
        Input          Hp 가 0 이 된 Actor
        Preconditions  없음 — 생명이 다하면 반드시 일어난다
        Transition     CurrentAction = downed (Duration 없음, 대체 불가능).
                       Velocity 는 그대로 둔다 — 쓰러진 몸도 물리 아래 있다
        Result         Downed
        Note           downed 가 대체 불가능하므로 모든 행동 시작이 자동으로 막힌다.
                       RULE-ACTION-BEGIN-001 에 예외를 추가하지 않는다

    RULE-ATTRIBUTE-SET-001 (R2 — 디버그 조작의 기반)
        Implements     INTENT-ATTRIBUTE-MUTATE-001
        Input          요청한 관찰자, 대상 ActorId, AttributeId, 새 값
        Preconditions  1. World.DebugAuthority.Open 이 참이다
                       2. 대상 ActorId 가 세계에 있다
                       3. AttributeId 가 MutableAttribute 목록에 있다
                       4. 새 값이 그 속성의 Range 안에 있다
        Transition     그 속성에 새 값을 넣는다.
                       Hp 가 0 이 되면 RULE-DOWNED-001 이 이어서 일어난다 —
                       속성 변경도 세계의 다른 규칙을 건너뛰지 않는다.
                       HpMax/CpMax 를 낮추면 현재값도 함께 그 안으로 들어온다.
                       쓰러진 몸의 Hp 를 0 보다 크게 만들면 다시 일어난다
                       (downed → idle) — 이번 Cycle 에서 쓰러짐을 되돌리는 유일한 길이며,
                       세계의 규칙이 아니라 세계 밖에서 손을 댄 결과다
        Result         Success | Failure(debug-closed | unknown-target |
                                         unknown-attribute | out-of-range)
        Note           이 Rule 은 값을 바꿀 뿐 새로운 게임 의미를 만들지 않는다.
                       무엇을 위해 바꾸는지(치트·시험·연출)는 이번 Cycle 의 의미가 아니다 —
                       경로 하나만 세운다 (01 EXCLUDED 의 "치트 명령 체계")

    RULE-STRIKE-EVENT-EXPIRE-001
        Implements     INTENT-STRIKE-OBSERVE-001
        Input          World.StrikeEvents, World.Time
        Preconditions  World.Time - Event.Time > STRIKE_EVENT_TTL
        Transition     해당 Event 를 World.StrikeEvents 에서 제거한다
        Result         Expired(count)

    RULE-SWING-STRIKE-001 (CHANGED)
        Implements     INTENT-SWING-IMPACT-001(CHANGED)
        Input          ActionCollider 가 Active 인 모든 Actor (Tick 마다)
        Preconditions  대상 = 자신이 아니고, 쓰러지지 않았고,
                       Collider 에 닿았고, StruckActorIds 에 아직 없는 몸
        Transition     대상마다 StruckActorIds += 대상,
                       RULE-HIT-001 (행동 중단) + SWING_IMPULSE 충격량 (C006 그대로),
                       RULE-STRIKE-DAMAGE-001 (그 스킬의 고정 피해),
                       이 휘두름의 첫 타격이면 RULE-SKILL-BUDGET-001
        Result         Struck(대상 수)

    RULE-WORLD-TICK-001 (CHANGED — Transition 순서)
        0. 참여/이탈/표식        1. 도착한 요청 (스킬 시작·이동·이동 모드 전환·속성 변경 포함)
        2. RULE-NPC-DECIDE-001   3. RULE-MOVE-PROGRESS-001
        4. RULE-ACTION-PROGRESS-001
        5. RULE-SWING-STRIKE-001 (→ STRIKE-DAMAGE → SKILL-BUDGET → DOWNED)
        6. RULE-BODY-PUSH-001    7. RULE-BODY-MOMENTUM-001
        8. RULE-CP-RUN-DRAIN-001 9. World.Time += dt
        10. RULE-STRIKE-EVENT-EXPIRE-001
        기력 누수가 물리 뒤에 오는 이유: 이 Tick 에 실제로 달려 움직인 결과에 대해 값을 치른다.
        만료가 시간 진행 뒤에 오는 이유: 방금 일어난 결과가 최소 한 번은 관찰되어야 한다.

## OBSERVABLE SEMANTIC

    모든 Actor 에 대해 — 누구의 것이든 예외 없이 (R2, INTENT-ATTRIBUTE-OBSERVE-001)
        Actor.Name
        Actor.Hp / Actor.HpMax
        Actor.Cp / Actor.CpMax
        Actor.Downed
        Actor.MoveMode
        Actor.TempoStats 3종 전부 (MoveSpeed · RunSpeedMultiplier · ActionSpeed)
        Actor.Modifiers 4종 전부 (CpCharge · CpConsume · MoveSpeed · ActionSpeed)
        (재사용) Position · CharacterKind · Control · CurrentActionKind · ActionProgress ·
                 Body · Swing

    관찰자 자신에 대해 추가로 (INTENT-SELF-OBSERVE-001)
        Skill.Availability + Skill.FailureReason (스킬 종류마다)
            downed | action-busy | insufficient-cp
        Skill.Damage + Skill.CpCharge + Skill.CpCost (스킬 종류마다)
            무엇이 얼마나 깎고 기력을 얼마나 쓰는지 알아야
            "지금 고급 스킬을 쓸 것인가"를 판단할 수 있다
        MoveMode.Availability + FailureReason (run 으로 바꿀 수 있는가)
        이것들은 "그 몸이 지금 무엇을 할 수 있는가"이지 속성이 아니다 —
        요청의 주체는 자기 몸이므로 자기 것만 의미가 있다

    세계에 대해
        World.StrikeEvents  { AttackerId, TargetId, SkillKind, Amount, Position, Time }
                            — 남의 타격 결과도 보인다 (INTENT-STRIKE-OBSERVE-001)
        World.DebugAuthority.Open (R2)   지금 속성을 바꿔 볼 수 있는 세계인가
        MutableAttribute 목록 + Range (R2)
                            무엇을 어디까지 바꿀 수 있는지 (INTENT-ATTRIBUTE-MUTATE-001)
        AttributeSet.FailureReason (R2)
                            debug-closed | unknown-target | unknown-attribute | out-of-range

    관찰되지 않는 것
        없다 (R2). 세계는 어떤 속성도 숨기지 않는다.
        무엇을 언제나 화면에 띄워 둘지는 View 의 선택이며 — 그 기본값(몸 위에는 이름과 체력)은
        04 GameView Specification 이 정한다. 세계의 제한이 아니다.

    Rule 판단에 쓰인 모든 조건은 위에서 관찰 가능하다 —
    스킬 실패 사유(세 가지), 달릴 수 없는 사유, 지금 걸린 배율, 타격의 결과,
    그리고 속성 변경이 거절된 사유(네 가지).

## SEMANTIC CLOSURE

    ── 자원 ──
    "생명과 기력 두 자원을 지닌다"              → Actor.Hp/HpMax · Actor.Cp/CpMax
    "최대치 사이에서만 값을 가진다"             → 모든 변경 Rule 의 clamp
    "종류가 최대치와 시작값을 정한다"           → COMBAT_PROFILES
    "생명은 타격으로만 준다"                    → RULE-STRIKE-DAMAGE-001 만이 Hp 를 줄인다
    "스킬마다 고유한 충전량·소모량"             → SkillDefinition.CpCharge/CpCost
    "같은 순간에 함께, 각자 배율을 받는다"      → RULE-SKILL-BUDGET-001 Transition 한 식
    "기본은 충전만, 고급은 더 크게 소모"        → SKILL_DEFINITIONS 값
    "맞혀야 기력이 돈다"                        → RULE-SKILL-BUDGET-001 은 타격에서만 불린다
    "모자라면 시작할 수 없다"                   → RULE-SKILL-BEGIN-001 Precondition 3
    "왜 시작되지 못했는지 알 수 있다"           → Skill.FailureReason(insufficient-cp)
    "걷기와 달리기 중 하나로 움직인다"          → Actor.MoveMode + RULE-MOVE-MODE-001
    "달리면 배율이 곱해진 빠르기"               → RULE-MOVE-PROGRESS-001 (CHANGED)
    "달리는 내내 기력을 흘린다"                 → RULE-CP-RUN-DRAIN-001
    "바닥나면 걸음으로 돌아온다"                → RULE-CP-RUN-DRAIN-001 Exhausted
    "멈춰 있으면 흘러나가지 않는다"             → Precondition (이동 중일 것)

    ── 배율 ──
    "네 값은 원천들을 곱한 값"                  → Actor.Modifiers 합성 정의
    "상·하한을 넘지 않는다"                     → MODIFIER_MIN/MAX
    "달리는 중이면 충전이 억눌린다"             → RUN_CHARGE_FACTOR 원천
    "타격당한 직후 잠시 더 억눌린다"            → HIT_CHARGE_FACTOR 원천
                                                  ("직후 잠시" = 피격 반응(hit) 행동이 이어지는 동안 —
                                                   기존 상태를 재사용하고 새 타이머를 만들지 않는다)
    "원천이 없으면 본래 값"                     → 빈 곱 = 1

    ── 한 번의 타격 ──
    "스킬마다 정해진 피해량"                    → SkillDefinition.Damage
    "언제나 똑같이 잃는다"                      → RULE-STRIKE-DAMAGE-001 (우연 없음)
    "고급이 기본보다 크다"                      → 55 > 20
    "생명을 덜어낸다 / 0 아래로 안 간다"        → Transition 의 max(0, …)
    "피격 반응·밀려남과 함께 일어난다"          → RULE-SWING-STRIKE-001 이 셋을 함께 부른다
    "0 이 되면 쓰러진다"                        → RULE-DOWNED-001
    "쓰러지면 아무 행동도 시작 못 한다"         → CurrentAction = downed (대체 불가능)
    "스스로 결정하지 않는다"                    → RULE-NPC-DECIDE-001 (CHANGED)
    "타격 대상이 되지 않는다"                   → RULE-SWING-STRIKE-001 Precondition
    "되돌아오지 않는다"                         → downed 를 벗어나는 Rule 이 없다

    ── 템포 ──
    "이동 속도는 종류마다 다른 능력치"          → TempoStats.MoveSpeed (COMBAT_PROFILES)
    "배율이 걸릴 수 있다"                       → Modifiers.MoveSpeed
    "한 순간에 나아가는 거리"                   → RULE-MOVE-PROGRESS-001 (CHANGED)
    "공격 속도가 행동 길이를 정한다"            → RULE-SKILL-BEGIN-001 Duration 식
    "빠를수록 더 자주 휘두르고 수지도 빨리 돈다"→ 짧아진 Duration → 더 잦은 RULE-SKILL-BUDGET-001
    "진행도와 충돌체 구간도 함께 줄어든다"      → 둘 다 ActionProgress(비율) 기반 — 자동으로 따라온다

    ── 관찰 ──
    "모든 Actor 는 이름을 가진다"               → Actor.Name
    "이름·생명·쓰러짐을 관찰한다"               → Observable (모두)
    "세계는 어떤 속성도 숨기지 않는다" (R2)     → Observable "모든 Actor 에 대해" 전체 목록
    "누구의 것이든 관찰될 수 있다" (R2)         → 관찰되지 않는 것: 없다
    "늘 띄워 둘지는 보는 이의 선택" (R2)        → 표시 기본값은 04 가 정한다 (세계의 제한이 아님)
    "자기 자원·능력치·배율을 본다"              → Observable (자신 + 모두)
    "쓸 수 있는지와 이유를 안다"                → Skill.Availability/FailureReason
    "얼마나 깎고 기력을 얼마나 쓰는지 안다"     → Skill.Damage/CpCharge/CpCost
    "결과가 맞은 자리에서 잠시 드러난다"        → World.StrikeEvents + STRIKE_EVENT_TTL
    "누가 누구를 쳤는지 함께 실린다"            → AttackerId · TargetId

    ── 디버그 조작 (R2) ──
    "권한을 열어 줄 수 있다"                    → World.DebugAuthority.Open
    "어떤 존재의 어떤 속성이든 요청한다"        → RULE-ATTRIBUTE-SET-001 Input (대상 + 속성 + 값)
    "바꾸는 것은 언제나 세계다"                 → 요청은 Rule 을 거친다 (World Authority 그대로)
    "무엇을 바꿀 수 있고 어디까지 허용되는가"   → MutableAttribute 목록 + Range (관찰 가능)
    "받아들여지지 않으면 이유를 남긴다"         → Result Failure 4종
    "권한이 닫히면 아무것도 바꾸지 못한다"      → Precondition 1
    "규칙이 되돌리지 않는 것도 되돌아온다"      → 쓰러진 몸의 Hp 를 올리면 downed 를 벗어난다
    "바뀐 뒤에도 세계는 자기 규칙대로 간다"     → Hp = 0 이면 RULE-DOWNED-001 이 그대로 이어진다,
                                                  최대치 clamp 도 그대로 적용된다
    "파생값과 정체성은 바꿀 수 없다"            → MutableAttribute 제외 목록
