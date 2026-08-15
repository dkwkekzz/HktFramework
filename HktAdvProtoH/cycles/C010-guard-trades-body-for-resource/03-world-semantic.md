# C010 — World Semantic

> 입력: `02-intent.md` (R1) · 현재 `world/` (C001~C009)
> 막기는 행동 칸을 쓰지 않는 **자세(Stance)** 다 — 02 R1 개정을 그대로 따른다.
> 수치·공식·판정은 이 문서가 소유한다 (CLAUDE.md 원칙 18).

## SEMANTIC DELTA

    REUSED
        Actor.Id · Position · CharacterKind · Control        (C001·C002) 존재의 뼈대
        Actor.Hp/HpMax · Cp/CpMax                            (C007) 자원을 새로 만들지 않는다 —
                                                             막기는 기존 Cp 를 쓴다
                                                             (DC-COMBAT-SHARED-BUDGET)
        Actor.Facing                                         (C006) 막는 방향의 유일한 기준
        Actor.Body(Radius/Height/Mass) · Velocity            (C006) 대상 판정·밀려남 그대로
        Actor.CurrentAction · ActionDefinition               (C002) 자세는 이 구조를 건드리지 않는다
        Actor.Modifiers · clamp 합성 규칙                    (C007) 새 원천을 더하지 않는다
        SkillDefinition.Damage                               (C007) 이제 "본래 피해" 로 읽힌다
        ActionCollider · CurrentAction.StruckActorIds        (C006) 접촉 탐지 그대로
        World.Time · RULE-WORLD-TICK-001                     (C003) 무너짐의 여파가 실릴 시간
        World.StrikeEvents · STRIKE_EVENT_TTL                (C007) 결과 관찰 자리 (내역만 확장)
        World.DebugAuthority · RULE-ATTRIBUTE-SET-001        (C007 R2) 새 속성도 같은 경로로
        Observer.ActorId · Projection                        (C004) 자기 관찰의 수신 대상 판별

    ADDED
        Actor.Stance                                         open | guard (INTENT-GUARD-STANCE-001)
        Actor.GuardBrokenUntil                               무너짐의 여파가 가시는 세계 시각
        Actor.GuardBroken (파생)                             World.Time < GuardBrokenUntil
        Actor.Defense                                        방어력 — 종류가 정하는 고정값
                                                             (INTENT-DEFENSE-MITIGATION-001)
        StrikeEvent.BaseAmount · Mitigated · Guarded ·
                    CpPaid · GuardBroken                     타격 내역 (INTENT-STRIKE-BREAKDOWN-001)
        MutableAttribute 'defense' · 'stance'                (C007 R2 목록에 두 항목 추가)
        RULE-GUARD-SET-001
        RULE-GUARD-ABSORB-001
        RULE-GUARD-BREAK-001
        시뮬레이션 상수 6종 (아래 참조)

    CHANGED
        RULE-ACTION-BEGIN-001
            기존  Precondition 은 "현재 행동이 대체 가능하다" 하나.
                  판정 입력은 Actor 하나였다
            변경  판정 입력에 "시작하려는 행동의 종류" 가 더해지고
                  Precondition 이 하나 늘어난다 —
                  Stance = guard 이면 시작할 수 있는 것은 move 와 idle 뿐이다.
                  Result 에 Failure(guarding) 이 더해진다.
                  세계가 강제하는 행동(hit · downed)은 이 관문을 거치지 않으므로
                  (기존에도 beginAction 을 직접 부른다) 영향을 받지 않는다
        RULE-STRIKE-DAMAGE-001
            기존  Amount = SkillDefinition.Damage. 그 값이 그대로 Hp 에서 나간다
            변경  Amount 는 세 단계를 거쳐 정해진다 —
                  본래 피해 → 방어력 감쇄 → (막았으면) 자원 분배.
                  Hp 에서 나가는 몫과 Cp 에서 나가는 몫이 갈리고,
                  StrikeEvent 에 그 내역 전부가 실린다.
                  우연은 여전히 없다 (DC-COMBAT-PLAYER-CAUSALITY)
        RULE-SWING-STRIKE-001
            기존  닿은 몸마다 RULE-HIT-001 + 충격량 + RULE-STRIKE-DAMAGE-001
            변경  막아 낸 몸에는 RULE-HIT-001 을 부르지 않는다 (자세가 흩어지면 안 된다).
                  충격량과 RULE-STRIKE-DAMAGE-001 은 그대로 부른다.
                  막았는지 여부는 RULE-STRIKE-DAMAGE-001 이 판정해 돌려준다 —
                  같은 판정을 두 곳에서 하지 않는다
        RULE-MOVE-MODE-001
            기존  Cp > 0 이고 쓰러지지 않았으면 MoveMode 를 요청값으로 바꾼다
            변경  run 으로 바뀌는 순간 Stance = open 이 된다 (막기를 놓는다).
                  walk 로 바꾸는 것은 자세를 건드리지 않는다
        RULE-DOWNED-001
            기존  CurrentAction = downed
            변경  Stance = open 도 함께. 쓰러진 몸에는 자세가 남지 않는다
        RULE-OBSERVER-JOIN-001 / Spawn
            새로 놓이는 몸은 Stance = open · GuardBrokenUntil = 0 이며
            Defense 를 자기 CharacterKind 의 값으로 갖는다
        RULE-ATTRIBUTE-SET-001
            MutableAttribute 목록에 defense 와 stance 가 더해진다.
            stance 를 guard 로 바꾸는 것은 RULE-GUARD-SET-001 의 Precondition 을 거치지 않는
            세계 밖의 손이다 — 다만 바뀐 뒤의 세계는 자기 규칙대로 간다 (C007 R2 원칙 그대로)

    AFFECTED
        RULE-SKILL-BEGIN-001       변경 없음 — 관문(RULE-ACTION-BEGIN-001)이 막으므로
                                   막는 중 스킬 시작 불가가 자동으로 성립한다.
                                   실패 사유 목록에 guarding 이 더해진다
        RULE-MINE-001              같은 관문으로 막는 중 채굴 시작 불가
        RULE-MOVE-001              변경 없음 — move 는 관문을 통과한다 (막은 채로 걷는다)
        RULE-HIT-001               변경 없음 — 부르는 쪽(RULE-SWING-STRIKE-001)이 갈린다
        RULE-SKILL-BUDGET-001      변경 없음 — 공격자 쪽 수지다. 막혔어도 때린 자는 정산한다
                                   (맞았으므로 기력이 돈다 — C007 원칙 그대로)
        RULE-CP-RUN-DRAIN-001      변경 없음 — 다만 막느라 마른 Cp 로는 달릴 수도 없다
        RULE-NPC-DECIDE-001        변경 없음 — 자율 존재의 결정 목록에 막기를 넣지 않는다
                                   (01 EXCLUDED). 자율 존재도 Stance 를 갖지만 언제나 open 이다
        RULE-BODY-PUSH-001 /
        RULE-BODY-MOMENTUM-001     변경 없음 — 막아도 몸은 밀린다
        RULE-STRIKE-EVENT-EXPIRE-001  변경 없음 — 실리는 내용만 커진다
        RULE-WORLD-TICK-001        변경 없음 — 새 단계가 없다.
                                   무너짐의 여파는 시각 비교로 스스로 가시므로
                                   만료 Rule 을 만들지 않는다

## WORLD STATE

    Actor.Stance                World Authority   open | guard
        RULE-GUARD-SET-001 이 세우고,
        RULE-GUARD-BREAK-001 · RULE-MOVE-MODE-001(run) · RULE-DOWNED-001 이 푼다.
        그 밖의 어떤 경로도 이 값을 바꾸지 않는다 (RULE-ATTRIBUTE-SET-001 제외 — 세계 밖의 손).

    Actor.GuardBrokenUntil      World Authority   세계 시각. 0 이면 여파가 없다
        RULE-GUARD-BREAK-001 만이 World.Time + GUARD_BREAK_LOCK 으로 세운다.
        지우는 Rule 은 없다 — 시간이 그 값을 지나가면 저절로 의미를 잃는다.

    Actor.GuardBroken (파생 상태 — 저장하지 않는다)
        GuardBroken ⇔ World.Time < GuardBrokenUntil
        이 동안 RULE-GUARD-SET-001 이 guard 를 받아들이지 않는다.

    Actor.Defense               World Authority   0 이상의 값. CharacterKind 가 정하는 고정값
        막고 있든 아니든 언제나 작동한다 (INTENT-DEFENSE-MITIGATION-001).
        RULE-ATTRIBUTE-SET-001 외에는 바뀌지 않는다 — 장비도 버프도 없다 (01 EXCLUDED).

    World.StrikeEvents (CHANGED — 내역 확장)
        AttackerId · TargetId · SkillKind · Position · Time      (C007 그대로)
        BaseAmount     그 스킬의 본래 피해                        (SkillDefinition.Damage)
        Mitigated      방어력이 걷어낸 뒤 남은 피해
        Guarded        막아 낸 타격인가
        CpPaid         막느라 치른 기력 (막지 않았으면 0)
        Amount         실제로 생명에서 나간 몫                     (C007 의 Amount 와 같은 자리)
        GuardBroken    이 타격으로 방어가 무너졌는가
        여섯 값의 관계가 곧 계산 순서다 — 보는 이가 이 줄을 읽고 결과를 재구성할 수 있다.

    시뮬레이션 상수 (결정론 — 헤더 상수 고정)
        MIN_DAMAGE_RATIO      0.1    방어력이 아무리 커도 본래 피해의 이만큼은 반드시 통과한다
        GUARD_FRONT_COS       0.5    막히는 정면 범위 — 몸이 향한 쪽 기준 좌우 60도 (합 120도)
        GUARD_DAMAGE_RATIO    0.15   막아 냈을 때 그래도 생명으로 새어 드는 몫의 비율
        GUARD_CP_PER_DAMAGE   0.8    기력으로 대신 받는 몫에 걸리는 환율
                                     (피해 1 을 기력 0.8 로 산다)
        GUARD_BREAK_LOCK      1.5    무너진 뒤 다시 막지 못하는 시간 (초)
        CENTER_EPSILON        (C006 재사용) 방향을 정할 수 없을 만큼 두 몸이 겹친 경우의 한계

    Defense (CharacterKind 가 정하는 값 — character-catalog 에 더해진다)
        rabbit-swordsman (관찰자의 몸)   5
        wanderer         (자율 존재)     3

    이 값들로 실제 싸움이 어떻게 굴러가는가 — 관찰자의 몸(Hp 200 · Cp 100 · 시작 30 · 방어 5)이
    자율 존재의 기본 스킬(본래 20)을 받을 때:

        막지 않음   Mitigated 15        → Hp -15        Cp 그대로
        막아 냄     Mitigated 15        → Hp -2.25      Cp -10.2
        고급 스킬을 막아 냄 (본래 55)   → Hp -7.5       Cp -34

        시작 기력 30 으로는 기본 스킬 3대를 막고 4대째에 무너진다 (30 → 19.8 → 9.6 → 부족).
        가득 찬 기력 100 으로는 9대를 막는다.
        막지 않으면 같은 4대에 Hp 60 이 나간다 — 막는 것이 분명히 이득이되,
        기력이 마르면 그 이득이 끊기고 그때부터는 그냥 얻어맞는다.
        기력을 되찾는 길은 여전히 때리는 것뿐이므로(C007), 막기만 하는 선택은 반드시 끝난다.

## WORLD RULE

    RULE-GUARD-SET-001
        Implements     INTENT-GUARD-STANCE-001 · INTENT-GUARD-BEGIN-GATE-001
        Input          Actor, 요청한 Stance (open | guard)
        Preconditions  guard 로 세우려면 —
                       1. Actor 가 쓰러지지 않았다
                       2. 현재 행동이 대체 가능하다 (휘두르는 중에 자세를 갈아탈 수 없다)
                       3. Cp > 0 (치를 것이 없으면 애초에 막을 수 없다)
                       4. GuardBroken 이 아니다 (무너진 여파가 아직 가시지 않았다)
                       open 으로 놓는 것에는 Precondition 이 없다 — 언제나 놓을 수 있다
        Transition     Stance = 요청값. CurrentAction 은 건드리지 않는다 —
                       걷던 몸은 걷던 채로, 서 있던 몸은 선 채로 자세만 바뀐다.
                       guard 로 세울 때 MoveMode = walk 로 돌린다 (달리며 막지 않는다)
        Result         Success | Failure(downed | action-busy | insufficient-cp | guard-broken)
        Note           요청은 토글이 아니라 명시값이다 —
                       같은 요청이 두 번 와도 결과가 같다 (RULE-MOVE-MODE-001 과 같은 형태)

    RULE-STRIKE-DAMAGE-001 (CHANGED — 결과가 세 단계로 갈린다)
        Implements     INTENT-STRIKE-DAMAGE-001(CHANGED) · INTENT-DAMAGE-APPLY-001(CHANGED) ·
                       INTENT-DEFENSE-MITIGATION-001 · INTENT-GUARD-DIRECTION-001 ·
                       INTENT-GUARD-ABSORB-001 · INTENT-STRIKE-BREAKDOWN-001
        Input          공격자 Actor, 대상 Actor, SkillKind, World
        Preconditions  대상이 쓰러지지 않았다 (C007 그대로)
        Transition
                       1  본래 피해
                          Base = SkillDefinition(SkillKind).Damage

                       2  방어력 감쇄 (막든 안 막든 언제나)
                          Mitigated = max(Base × MIN_DAMAGE_RATIO, Base - 대상.Defense)
                          → 방어력이 아무리 커도 0 이 되지 않는다

                       3  막힘 판정 (INTENT-GUARD-DIRECTION-001)
                          u = normalize(공격자.Position - 대상.Position)
                          Blocked = 대상.Stance = guard
                                    AND |공격자.Position - 대상.Position| > CENTER_EPSILON
                                    AND dot(대상.Facing, u) >= GUARD_FRONT_COS
                          → 두 몸이 겹쳐 방향을 정할 수 없으면 막지 못한 것으로 본다
                            (없는 방향을 지어내지 않는다 — 결정론)

                       4-A  Blocked 이고 치를 기력이 있는 경우
                          HpLoss  = Mitigated × GUARD_DAMAGE_RATIO
                          Absorbed = Mitigated - HpLoss
                          CpPaid  = Absorbed × GUARD_CP_PER_DAMAGE
                          Cp >= CpPaid 이면
                              대상.Cp -= CpPaid
                              대상.Hp = max(0, Hp - HpLoss)
                              Guarded = true · GuardBroken = false

                       4-B  Blocked 이지만 Cp < CpPaid 인 경우 → RULE-GUARD-BREAK-001
                          대상.Cp = 0 (남은 것을 마지막 대가로 다 쓴다)
                          HpLoss = Mitigated (막지 못한 것으로 처리한다)
                          대상.Stance = open · GuardBrokenUntil = World.Time + GUARD_BREAK_LOCK
                          Guarded = false · GuardBroken = true

                       4-C  Blocked 이 아닌 경우 (C007 그대로)
                          HpLoss = Mitigated · CpPaid = 0
                          Guarded = false · GuardBroken = false

                       5  기록과 이어지는 규칙
                          World.StrikeEvents += { 공격자, 대상, SkillKind,
                                                  BaseAmount = Base, Mitigated,
                                                  Guarded, CpPaid, Amount = HpLoss,
                                                  GuardBroken, 대상.Position, World.Time }
                          대상.Hp = 0 이면 RULE-DOWNED-001
        Result         Struck { Amount, Guarded, CpPaid, GuardBroken }
                       (부르는 쪽이 Guarded 를 보고 피격 반응 여부를 정한다)
        Note           네 갈래 어디에도 우연이 없다 — 같은 위치·같은 방향·같은 자세·같은 기력이면
                       언제나 같은 내역이 나온다 (DC-COMBAT-PLAYER-CAUSALITY).
                       무너지는 타격이 본래 피해를 그대로 받는 이유는
                       "막을 기력이 다하면 그대로 얻어맞는다" 가 이 Cycle 의 Goal 이기 때문이다

    RULE-GUARD-ABSORB-001
        Implements     INTENT-GUARD-ABSORB-001
        Note           별도의 실행 순서를 갖지 않는다 —
                       RULE-STRIKE-DAMAGE-001 Transition 4-A 가 이 Rule 의 본문이다.
                       독립 Rule 로 이름을 두는 이유는 "생명 대신 기력" 이라는 의미가
                       타격 규칙의 곁가지가 아니라 이 Cycle 의 중심이기 때문이다.
                       Intent 추적은 이 이름으로 한다

    RULE-GUARD-BREAK-001
        Implements     INTENT-GUARD-BREAK-001 · INTENT-GUARD-BREAK-AFTERMATH-001
        Input          막고 있으나 CpPaid 를 치를 수 없는 대상 Actor, World.Time
        Preconditions  Stance = guard 이고 Cp < CpPaid
        Transition     Cp = 0
                       Stance = open
                       GuardBrokenUntil = World.Time + GUARD_BREAK_LOCK
        Result         Broken(GuardBrokenUntil)
        Note           여파를 거두는 Rule 은 없다 — World.Time 이 그 값을 지나가면 끝난다.
                       새 Tick 단계를 만들지 않기 위한 선택이며,
                       파생 상태(GuardBroken)로 관찰된다

    RULE-SWING-STRIKE-001 (CHANGED)
        Implements     INTENT-SWING-IMPACT-001(CHANGED) · INTENT-GUARD-KEEPS-THE-STANCE-001
        Input          ActionCollider 가 Active 인 모든 Actor (Tick 마다)
        Preconditions  C007 그대로 (자신이 아니고, 쓰러지지 않았고, 닿았고, 아직 안 맞은 몸)
        Transition     대상마다 StruckActorIds += 대상,
                       SWING_IMPULSE 충격량 (막아도 밀린다 — C006 그대로),
                       RULE-STRIKE-DAMAGE-001,
                       그 결과 Guarded = false 인 경우에만 RULE-HIT-001,
                       이 휘두름의 첫 타격이면 RULE-SKILL-BUDGET-001
        Result         Struck(대상 수)
        Note           순서가 바뀐다 — C007 은 RULE-HIT-001 을 먼저 불렀으나,
                       이제는 막았는지를 알아야 부를지가 정해지므로
                       RULE-STRIKE-DAMAGE-001 이 먼저다.
                       무너진 타격(4-B)은 Guarded = false 이므로 피격 반응이 일어난다 —
                       무너짐은 그대로 얻어맞는 것이다

    RULE-ACTION-BEGIN-001 (CHANGED)
        Implements     INTENT-ACTION-STATE-001(CHANGED) · INTENT-ACTION-EXCLUSIVE-001 ·
                       INTENT-GUARD-EXCLUSIVE-001
        Input          Actor, 시작하려는 ActionKind
        Preconditions  1. 현재 행동이 대체 가능하다 (기존)
                       2. Stance = guard 이면 ActionKind ∈ { move, idle } (ADDED)
        Transition     기존 그대로
        Result         Success | Failure(action-busy | guarding)
        Note           세계가 강제하는 행동(hit · downed)은 기존에도 이 관문을 거치지 않는다.
                       따라서 막는 몸도 무너지면 얻어맞고, 생명이 다하면 쓰러진다

    RULE-MOVE-MODE-001 (CHANGED)
        Implements     INTENT-RUN-001(CHANGED)
        Input          Actor, 요청한 MoveMode
        Preconditions  C007 그대로 (run 이면 Cp > 0 이고 쓰러지지 않았다)
        Transition     MoveMode = 요청값.
                       요청값이 run 이면 Stance = open (달리기는 막기를 놓는 것이다)
        Result         Success | Failure(downed | insufficient-cp)

    RULE-DOWNED-001 (CHANGED)
        Implements     INTENT-DOWNED-001 · INTENT-GUARD-EXCLUSIVE-001
        Transition     CurrentAction = downed (C007 그대로) + Stance = open
        Result         Downed

## OBSERVABLE SEMANTIC

    모든 Actor 에 대해 — 누구의 것이든 예외 없이 (C007 R2 원칙 그대로)
        Actor.Stance              open | guard          지금 막고 있는가
        Actor.Facing              (재사용)              어느 쪽을 막고 있는가
        Actor.Defense                                   방어력
        Actor.GuardBroken (파생)                        지금 무너진 여파 안인가
        Actor.GuardBrokenUntil                          그 여파가 언제 가시는가
        (재사용) Name · Hp/HpMax · Cp/CpMax · Downed · MoveMode ·
                 TempoStats · Modifiers · Position · CharacterKind · Control ·
                 CurrentActionKind · ActionProgress · Body · Swing

    관찰자 자신에 대해 추가로
        Guard.Availability + Guard.FailureReason
            downed | action-busy | insufficient-cp | guard-broken
            — 지금 막을 수 있는가, 없다면 왜인가
        Skill.FailureReason 에 guarding 이 더해진다
            (막고 있어서 스킬이 시작되지 않는다는 것을 사유로 안다)
        Mine.FailureReason 에도 같은 guarding 이 더해진다

    세계에 대해
        World.StrikeEvents
            { AttackerId, TargetId, SkillKind,
              BaseAmount, Mitigated, Guarded, CpPaid, Amount, GuardBroken,
              Position, Time }
            — 한 줄로 "본래 얼마짜리였고 / 방어력이 얼마를 걷었고 / 막았는지 /
              기력을 얼마 치렀고 / 그래서 생명에서 얼마가 나갔고 / 무너졌는지" 가 다 읽힌다
        MutableAttribute 목록에 defense · stance 가 더해진다 (Range 포함)
        시뮬레이션 상수 6종은 세계의 고정값이므로 관찰 대상이 아니다 —
            대신 그 상수들이 만든 결과가 StrikeEvent 내역으로 전부 드러난다

    관찰되지 않는 것
        없다. C007 R2 의 원칙을 이 Cycle 도 그대로 지킨다.

    Rule 판단에 쓰인 모든 조건이 위에서 관찰 가능하다 —
    막기 실패 사유 네 가지, 스킬·채굴이 막힌 사유(guarding),
    막힘을 가른 방향과 자세, 무너짐을 가른 기력, 그리고 결과를 만든 여섯 수치.

## SEMANTIC CLOSURE

    ── 막는 행동 (INTENT-GUARD-STANCE-001 · BEGIN-GATE · EXCLUSIVE · DIRECTION) ──
    "앞을 향해 막는 자세를 취한다"          → Actor.Stance = guard
    "행동과 나란히 존재한다"                → Stance 는 CurrentAction 과 별개 State
    "하던 일을 밀어내지 않는다"             → RULE-GUARD-SET-001 은 CurrentAction 을 안 바꾼다
    "놓기 전까지 이어진다"                  → Stance 를 바꾸는 Rule 이 넷뿐이다
    "쓰러지지 않았을 것"                    → RULE-GUARD-SET-001 Precondition 1
    "하던 일을 그만둘 수 있을 것"           → Precondition 2 (ActionDefinition.Replaceable)
    "치를 기력이 남아 있을 것"              → Precondition 3 (Cp > 0)
    "무너진 여파가 가셨을 것"               → Precondition 4 (GuardBroken 아님)
    "시작 못 하면 이유를 안다"              → Guard.FailureReason 4종
    "막는 동안 스킬·채굴을 시작 못 한다"    → RULE-ACTION-BEGIN-001 Precondition 2
    "걸음은 된다"                           → 같은 Precondition 이 move 를 허용한다
    "달리기는 막기를 놓는 것이다"           → RULE-MOVE-MODE-001 Transition
    "쓰러진 몸에 자세가 남지 않는다"        → RULE-DOWNED-001 Transition
    "강제되는 행동은 좁힘의 대상이 아니다"  → hit · downed 는 관문을 거치지 않는다
    "앞쪽만 막는다"                         → dot(Facing, u) >= GUARD_FRONT_COS
    "옆·뒤는 막지 않은 것과 같다"           → Blocked = false → 4-C

    ── 받아내기 (INTENT-DEFENSE-MITIGATION-001 · ABSORB · KEEPS-THE-STANCE) ──
    "맞은 피해를 줄이는 값을 지닌다"        → Actor.Defense
    "빗나가게 하지 않는다"                  → 감쇄는 맞은 뒤 단계 2 에서만 일어난다
    "0 이 되지 않는다"                      → max(Base × MIN_DAMAGE_RATIO, …)
    "종류가 정한다"                         → character-catalog 의 Defense
    "막든 안 막든 언제나 작동한다"          → 단계 2 는 Blocked 판정 이전이다
    "본래 덜어낼 생명을 기력으로 대신 낸다" → 4-A 의 Absorbed → CpPaid
    "컸을수록 비싸다"                       → CpPaid 가 Mitigated 에 비례한다
    "생명은 여전히 줄되 훨씬 적게 준다"     → HpLoss = Mitigated × GUARD_DAMAGE_RATIO
    "피해가 사라지지 않고 자원이 바뀐다"    → HpLoss + Absorbed = Mitigated
    "막아 낸 타격은 자세를 흩뜨리지 않는다" → RULE-SWING-STRIKE-001 이 Guarded 면 HIT 를 안 부른다
    "그래서 기력 충전도 억눌리지 않는다"    → hit 상태가 아니므로 HIT_CHARGE_FACTOR 가 안 걸린다
                                              (C007 Modifiers 정의 그대로 — 새 원천 없음)
    "막아도 몸은 밀린다"                    → SWING_IMPULSE 는 Guarded 와 무관하게 적용된다

    ── 무너짐 (INTENT-GUARD-BREAK-001 · BREAK-AFTERMATH) ──
    "치를 기력이 없으면 무너진다"           → 4-B 의 조건 Cp < CpPaid
    "자세가 풀린다"                         → RULE-GUARD-BREAK-001 Stance = open
    "그 타격은 막지 못한 것이 된다"         → HpLoss = Mitigated · Guarded = false
    "남은 기력을 마지막 대가로 다 쓴다"     → Cp = 0
    "여파 동안 다시 막지 못한다"            → GuardBrokenUntil + RULE-GUARD-SET-001 Precondition 4
    "그동안 타격을 그대로 받는다"           → Stance = open 이므로 4-C 로 간다
    "여파는 스스로 가신다"                  → World.Time 이 GuardBrokenUntil 을 지나면 끝
    "막기만 하는 선택은 스스로 끝난다"      → 기력을 되찾는 길이 타격뿐인데(C007)
                                              막는 동안은 때릴 수 없다 (RULE-ACTION-BEGIN-001)

    ── 관찰 (INTENT-GUARD-OBSERVE-001 · STRIKE-BREAKDOWN-001) ──
    "누가 막고 있는지 보인다"               → Observable Actor.Stance
    "어느 쪽을 막는지 보인다"               → Observable Actor.Facing (재사용)
    "방금 무너졌는지 보인다"                → Observable Actor.GuardBroken
    "막을 수 있는지와 이유를 안다"          → Guard.Availability / FailureReason
    "본래 얼마짜리였는지"                   → StrikeEvent.BaseAmount
    "막혔는지"                              → StrikeEvent.Guarded
    "방어력이 얼마를 걷었는지"              → BaseAmount - Mitigated
    "기력을 얼마 치렀는지"                  → StrikeEvent.CpPaid
    "생명에서 얼마가 나갔는지"              → StrikeEvent.Amount
    "무너뜨린 타격인지"                     → StrikeEvent.GuardBroken
    "같은 상태면 같은 내역"                 → 네 갈래 전부에 우연이 없다

    ── 상위 (MASTER TRACE) ──
    MC-GUARD                → Actor.Stance + RULE-GUARD-SET-001 + RULE-GUARD-ABSORB-001 +
                              RULE-GUARD-BREAK-001
    MC-DEFENSE-MITIGATION   → Actor.Defense + RULE-STRIKE-DAMAGE-001 단계 2
    MC-CP-ECONOMY (PARTIAL→) → 방어가 같은 Cp 를 쓰기 시작한다. 전용 게이지 없음
                              (DC-COMBAT-SHARED-BUDGET)
    MC-BODY-FACING (재사용) → 막힘 판정이 기존 Facing 만으로 이루어진다

    닫히지 않은 Intent 문장: 없음.
