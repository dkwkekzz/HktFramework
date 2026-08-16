# C011 — World Semantic

> 입력: `02-intent.md` (R1) · 현재 `world/` (C001~C010)
> 수치·공식·판정은 이 문서가 소유한다 (CLAUDE.md 원칙 18).
>
> C010 의 자세(Stance)에 **언제 세웠는가** 하나를 더한다. 새 자세도 새 행동도 없다.
> 타격 규칙은 네 갈래에서 다섯 갈래가 되고, 그 앞에 증폭 단계 하나가 붙는다.

## SEMANTIC DELTA

    REUSED
        Actor.Id · Position · CharacterKind · Control        (C001·C002) 존재의 뼈대
        Actor.Hp/HpMax · Cp/CpMax · clamp                    (C007) 얻는 기력도 CpMax 를 넘지 않는다.
                                                             새 자원을 만들지 않는다
                                                             (DC-COMBAT-SHARED-BUDGET)
        Actor.Stance                                         (C010) 자세를 그대로 쓴다 —
                                                             'perfect' 같은 세 번째 자세는 없다
        Actor.GuardBrokenUntil · GuardBroken (파생)          (C010) 무너짐은 손대지 않는다
        Actor.Defense                                        (C010) 감쇄는 그대로 작동한다
        Actor.Facing                                         (C006) 완벽 판정의 방향 기준도 같다
        Actor.Body · Velocity · SWING_IMPULSE                (C006) 완벽하게 막아도 몸은 밀린다
        Actor.CurrentAction · ActionDefinition               (C002) 자세는 이 구조를 건드리지 않는다
        SkillDefinition.Damage                               (C007) 이제 "증폭 전 본래 피해" 로 읽힌다
        ActionCollider · StruckActorIds                      (C006) 접촉 탐지 그대로
        World.Time · RULE-WORLD-TICK-001                     (C003) 두 시각의 비교가 일어나는 자리
        World.StrikeEvents · STRIKE_EVENT_TTL                (C007·C010) 내역만 확장
        World.DebugAuthority · RULE-ATTRIBUTE-SET-001        (C007 R2) 새 값도 같은 경로로
        Observer.ActorId · Projection                        (C004) 자기 관찰의 수신 대상 판별
        MIN_DAMAGE_RATIO · GUARD_FRONT_COS ·
        GUARD_DAMAGE_RATIO · GUARD_CP_PER_DAMAGE ·
        GUARD_BREAK_LOCK · CENTER_EPSILON                    (C010) 상수 6종 그대로. 값을 바꾸지 않는다

    ADDED
        Actor.GuardStartedAt                                 마지막으로 자세를 세운 세계 시각
                                                             (INTENT-GUARD-ONSET-001)
        Actor.ExposedUntil                                   열림이 가시는 세계 시각
                                                             (INTENT-EXPOSED-001)
        Actor.Exposed (파생)                                 World.Time < ExposedUntil
        StrikeEvent.PerfectGuard · GuardElapsed ·
                    Counter · CounterBonus · CpGained        시점 내역 (INTENT-TIMING-BREAKDOWN-001)
        MutableAttribute 'exposedFor'                        (C007 R2 목록에 한 항목 추가)
        RULE-PERFECT-GUARD-001
        RULE-EXPOSE-001
        RULE-COUNTER-001
        시뮬레이션 상수 5종 (아래 참조)

    CHANGED
        RULE-GUARD-SET-001
            기존  guard Precondition 4종 (downed · action-busy · insufficient-cp · guard-broken).
                  Transition 은 Stance = 요청값 + MoveMode = walk
            변경  Precondition 이 하나 늘어난다 (R1) —
                  5. World.Time >= GuardStartedAt + GUARD_REARM_LOCK
                     (직전에 세운 뒤 한 호흡이 지났다)
                  Transition 에 GuardStartedAt = World.Time 이 더해진다.
                  **이미 guard 인 몸에 guard 를 다시 요청해도 GuardStartedAt 은 바뀌지 않는다** —
                  C010 의 멱등성("같은 요청이 두 번 와도 결과가 같다")이 여기서 창의
                  재발행을 막는 자리가 된다. 새 창은 open 을 거쳐야만 열린다.
                  open 으로 놓는 것에는 여전히 Precondition 이 없고 GuardStartedAt 도 건드리지 않는다 —
                  그래야 "직전에 세운 시각" 이 남아 재세움 간격을 잴 수 있다.
                  Result 에 Failure(guard-rearming) 이 더해진다
        RULE-STRIKE-DAMAGE-001
            기존  본래 피해 → 방어력 감쇄 → 막힘 판정 → 세 갈래(받아냄 · 무너짐 · 못 막음)
            변경  맨 앞에 증폭 단계가 붙고(맞은 자가 열려 있으면 본래 피해가 커진다),
                  막힘 갈래가 넷이 된다 — 완벽 · 받아냄 · 무너짐 · 못 막음.
                  완벽 갈래에서는 생명이 줄지 않고 기력이 **늘어난다**.
                  우연은 여전히 없다 (DC-COMBAT-PLAYER-CAUSALITY)
        RULE-DOWNED-001
            기존  CurrentAction = downed + Stance = open (C010)
            변경  ExposedUntil = 0 도 함께. 쓰러진 몸에는 열림이 남지 않는다
        RULE-ATTRIBUTE-SET-001
            기존  MutableAttribute 목록의 값을 밖에서 넣는다.
                  stance 를 guard 로 바꾸는 것은 세계 밖의 손이다 (C010)
            변경  1. stance 를 guard 로 넣으면 GuardStartedAt = World.Time 도 함께 찍는다 —
                     찍지 않으면 지난 시각이 남아 창이 이미 닫힌 채로 자세만 서게 되고,
                     세계 밖의 손이 만든 상태가 세계의 규칙과 어긋난다
                  2. 목록에 exposedFor 가 더해진다 — ExposedUntil = World.Time + 값.
                     ExposedUntil 을 직접 넣게 하지 않는 이유는 그것이 세계 시각이어서
                     밖에서 의미 있는 값을 고를 수 없기 때문이다 (C010 이 guardBrokenUntil 에
                     대해 내린 판단과 같다). 0 을 넣으면 그 자리에서 닫힌다
        RULE-OBSERVER-JOIN-001 / Spawn
            새로 놓이는 몸은 GuardStartedAt = -GUARD_REARM_LOCK · ExposedUntil = 0 이다.
            음수 시작값은 "세계가 시작하자마자도 막을 수 있다" 를 위한 것이다 —
            0 으로 두면 World.Time 이 GUARD_REARM_LOCK 을 지나기 전까지 아무도 막지 못한다
        RULE-SWING-STRIKE-001
            변경 없음(코드) — 그러나 의미가 넓어진다.
            `guarded = false 일 때만 RULE-HIT-001` 이라는 기존 판단이
            완벽하게 막아 낸 타격에도 그대로 적용된다 (완벽도 guarded = true 다).
            AFFECTED 가 아니라 CHANGED 에 두는 이유는 그 조건의 뜻이 넓어졌기 때문이다

    AFFECTED
        RULE-GUARD-BREAK-001       변경 없음 — 완벽한 막기는 기력을 치르지 않으므로
                                   무너짐 조건에 닿지 않는다. 새 갈래를 만들지 않는다
        RULE-GUARD-ABSORB-001      변경 없음 — 다만 이제 "창이 닫힌 뒤" 의 막기다
        RULE-ACTION-BEGIN-001      변경 없음 — 막는 동안 스킬 시작 불가 그대로.
                                   완벽하게 막은 뒤 되받아치려면 자세를 놓아야 하고,
                                   놓는 것에는 조건이 없으므로 새 규칙이 필요 없다
        RULE-MOVE-MODE-001         변경 없음 — run 이 자세를 푸는 것도 그대로.
                                   푼 뒤 다시 세우려면 GUARD_REARM_LOCK 을 기다린다
        RULE-SKILL-BUDGET-001      변경 없음 — 완벽하게 막혔어도 때린 자는 정산한다.
                                   맞긴 맞았기 때문이다 (C007·C010 원칙 그대로)
        RULE-HIT-001               변경 없음 — 부르는 쪽의 조건이 넓어질 뿐이다
        RULE-NPC-DECIDE-001        변경 없음 — 자율 존재는 여전히 막지 않는다.
                                   그러나 **열리고 되받아침을 당한다**
        RULE-BODY-PUSH-001 /
        RULE-BODY-MOMENTUM-001     변경 없음 — 완벽하게 막아도 몸은 밀린다
        RULE-STRIKE-EVENT-EXPIRE-001  변경 없음 — 실리는 내용만 커진다
        RULE-WORLD-TICK-001        변경 없음 — 새 단계가 없다.
                                   열림도 무너짐과 같이 시각 비교로 스스로 가신다
        RULE-CP-RUN-DRAIN-001      변경 없음 — 완벽하게 막아 번 기력도 달리면 흘러나간다

## WORLD STATE

    Actor.GuardStartedAt        World Authority   세계 시각. 마지막으로 자세를 세운 때
        RULE-GUARD-SET-001 이 open → guard 로 세울 때만 찍는다.
        guard → guard 재요청은 찍지 않는다 (창의 재발행 금지).
        open 으로 놓아도 지우지 않는다 — 재세움 간격을 재는 기준이기 때문이다.
        RULE-ATTRIBUTE-SET-001 이 stance = guard 를 넣을 때도 함께 찍는다.
        스폰 초기값 -GUARD_REARM_LOCK.

    Actor.ExposedUntil          World Authority   세계 시각. 0 이면 열려 있지 않다
        RULE-EXPOSE-001 만이 max(현재값, World.Time + EXPOSED_DURATION) 으로 세운다.
        max 로 두는 이유는 겹침이 쌓이지 않고 **끝나는 시각만 뒤로 밀리기** 때문이다
        (INTENT-EXPOSED-EXPIRES-001). 지우는 것은 RULE-DOWNED-001 뿐이다.
        그 밖에는 시간이 지나가면 저절로 의미를 잃는다 — 만료 Rule 을 만들지 않는다
        (C010 GuardBrokenUntil 과 같은 형태).

    Actor.Exposed (파생 상태 — 저장하지 않는다)
        Exposed ⇔ World.Time < ExposedUntil
        이 동안 이 몸에 닿는 모든 타격이 되받아침이 된다.

    World.StrikeEvents (CHANGED — 내역 확장 6 → 11)
        AttackerId · TargetId · SkillKind · Position · Time      (C007 그대로)
        BaseAmount     증폭까지 끝난 본래 피해                    (되받아침이면 커져 있다)
        CounterBonus   되받아침이 키운 몫                         (아니면 0)
                       → 증폭 전 값 = BaseAmount - CounterBonus 로 되짚을 수 있다
        Counter        되받아친 타격인가
        Mitigated      방어력이 걷어낸 뒤 남은 피해                (C010)
        Guarded        막아 낸 타격인가                           (C010 — 완벽도 참이다)
        PerfectGuard   완벽하게 막아 낸 타격인가
        GuardElapsed   막힌 타격이면 자세를 세운 뒤 닿기까지 걸린 시간.
                       막히지 않았으면 없음(null) — 잴 대상이 없기 때문이다.
                       이 값과 PERFECT_GUARD_WINDOW 의 비교가 곧 완벽 판정의 전부다
        CpPaid         막느라 치른 기력                           (C010 — 완벽이면 0)
        CpGained       완벽하게 막아 얻은 기력                    (아니면 0)
        Amount         실제로 생명에서 나간 몫                    (C010 과 같은 자리)
        GuardBroken    이 타격으로 방어가 무너졌는가              (C010)
        열한 값의 관계가 곧 계산 순서다 — 보는 이가 이 줄만으로 결과를 재구성할 수 있다.

    시뮬레이션 상수 (결정론 — 헤더 상수 고정)
        PERFECT_GUARD_WINDOW   0.20   자세를 세운 뒤 이 시간 안에 닿은 타격이 완벽하게 막힌다
                                      (원본 §8.2 PERFECT_GUARD_WINDOW 그대로)
        PERFECT_GUARD_CP_GAIN  10     완벽하게 막아 낸 자가 얻는 기력
                                      (원본 §8.2 "Defender CP += 10" 그대로)
        EXPOSED_DURATION       0.8    완벽하게 막힌 자가 열려 있는 시간 (초)
                                      (원본 §8.2 "Attacker → EXPOSED 0.8 sec" 그대로)
        COUNTER_DAMAGE_BONUS   0.25   되받아침이 본래 피해에 더하는 비율
                                      (원본 §8.4 COUNTER_DAMAGE_BONUS 그대로)
        GUARD_REARM_LOCK       0.6    자세를 세운 뒤 다시 세울 수 있게 되기까지의 시간 (초).
                                      **원본에 없는 값이며 이 Cycle 이 소유한다** — 02 R1 이
                                      요구한 "한 호흡" 이다. 기본 스킬 한 번의 길이(0.6)와 같게
                                      두어 "한 번의 공격을 읽는 주기" 가 그대로 재세움 주기가 된다.
                                      자율 존재의 기본 스킬 실제 길이는 0.6 / 0.85 ≈ 0.706 초이므로
                                      매 공격마다 다시 읽을 수는 있되 연타로 창을 유지할 수는 없다

    이 값들로 실제 싸움이 어떻게 굴러가는가 — 관찰자의 몸(Hp 200 · Cp 100 · 시작 30 ·
    방어 5)이 자율 존재(Hp 120 · 방어 3)의 기본 스킬(본래 20)을 정면에서 받을 때:

        막지 않음       Mitigated 15   → Hp -15        Cp 그대로
        늦게 막음       Mitigated 15   → Hp -2.25      Cp -10.2      (C010 그대로)
        완벽하게 막음   Mitigated 15   → Hp -0         Cp +10        상대가 0.8초 열린다

    그리고 열린 자율 존재를 되받아칠 때:

        기본 스킬  본래 20 → 25 (+5)    Mitigated 22      (열려 있지 않으면 17)
        고급 스킬  본래 55 → 68.75      Mitigated 65.75   (열려 있지 않으면 52)

    한 바퀴가 이렇게 돈다 — 시작 기력 30 으로 한 번 완벽하게 막으면 40 이 되고,
    자세를 놓고 기본 스킬을 되받아치면(충전 12) 52 가 되어 고급 스킬(소모 30)이 열린다.
    C010 에서 막기는 기력을 태우기만 했다. 여기서 처음으로 **막기가 공격을 여는 자리**가 된다.

    반대로 읽지 못하면 그대로 C010 이다 — 늦게 세운 자세는 여전히 10.2 씩 태우고,
    시작 기력 30 으로 2대를 막고 3대째에 무너진다. 두 길의 차이가 이 Cycle 의 플레이다.

    되받아침의 몫(+25%)이 충분한지, 열림 0.8초가 되받아치기에 충분한지,
    재세움 0.6초가 답답한지는 Human Play 확인의 판단 대상이다 —
    고치는 자리는 COUNTER_DAMAGE_BONUS · EXPOSED_DURATION · GUARD_REARM_LOCK 셋뿐이며
    다른 의미는 건드리지 않는다.

## WORLD RULE

    RULE-GUARD-SET-001 (CHANGED — 세운 시각을 남기고, 다시 세우는 데 간격이 든다)
        Implements     INTENT-GUARD-STANCE-001 · INTENT-GUARD-BEGIN-GATE-001(CHANGED) ·
                       INTENT-GUARD-ONSET-001 · INTENT-PERFECT-GUARD-ONCE-001
        Input          Actor, 요청한 Stance (open | guard), World.Time
        Preconditions  guard 로 세우려면 —
                       1. Actor 가 쓰러지지 않았다                      (C010)
                       2. 현재 행동이 대체 가능하다                     (C010)
                       3. Cp > 0                                        (C010)
                       4. GuardBroken 이 아니다                         (C010)
                       5. World.Time >= GuardStartedAt + GUARD_REARM_LOCK   (ADDED)
                       open 으로 놓는 것에는 Precondition 이 없다       (C010)
        Transition     이미 guard 이면 아무것도 하지 않는다 — 멱등.
                       open → guard 이면 Stance = guard · MoveMode = walk ·
                       **GuardStartedAt = World.Time**.
                       open 으로 놓으면 Stance = open 만 바꾼다 (GuardStartedAt 은 남는다)
        Result         Success | Failure(downed | action-busy | insufficient-cp |
                                         guard-broken | guard-rearming)
        Note           Precondition 5 가 없으면 자세를 여닫는 것만으로 완벽 창이 끊임없이
                       새로 열려 INTENT-PERFECT-GUARD-ONCE-001 이 세계에서 성립하지 않는다.
                       읽는다는 것은 한 번의 결정이지 계속 누르는 일이 아니다 (02 R1).
                       멱등 유지가 여기서 두 번째 역할을 한다 — 세워 둔 자세에 같은 요청을
                       반복해도 창이 다시 열리지 않는다

    RULE-STRIKE-DAMAGE-001 (CHANGED — 앞에 증폭 한 단계, 막힘이 네 갈래)
        Implements     INTENT-STRIKE-DAMAGE-001(CHANGED) · INTENT-DAMAGE-APPLY-001(CHANGED) ·
                       INTENT-COUNTER-001 · INTENT-PERFECT-GUARD-001 ·
                       INTENT-DEFENSE-MITIGATION-001 · INTENT-GUARD-DIRECTION-001 ·
                       INTENT-GUARD-ABSORB-001 · INTENT-TIMING-BREAKDOWN-001
        Input          공격자 Actor, 대상 Actor, SkillKind, World
        Preconditions  대상이 쓰러지지 않았다 (C007 그대로)
        Transition
                       1  증폭 전 본래 피해
                          Raw = SkillDefinition(SkillKind).Damage

                       2  되받아침 판정 (RULE-COUNTER-001 · INTENT-COUNTER-001)
                          Counter = Exposed(대상, World.Time)
                          Base = Counter ? Raw × (1 + COUNTER_DAMAGE_BONUS) : Raw
                          CounterBonus = Base - Raw
                          → 조건은 "맞은 자가 열려 있는가" 하나다. 때린 자가 누구인지,
                            어느 방향인지, 열림을 누가 만들었는지는 따지지 않는다
                          → 방어력 감쇄보다 **먼저** 온다. 본래 피해가 커지는 것이므로
                            열린 상대가 막고 있어도 커진 몫이 그대로 계산에 실린다

                       3  방어력 감쇄 (C010 그대로)
                          Mitigated = max(Base × MIN_DAMAGE_RATIO, Base - 대상.Defense)

                       4  막힘 판정 (C010 그대로)
                          Blocked = 대상.Stance = guard
                                    AND |공격자.Position - 대상.Position| > CENTER_EPSILON
                                    AND dot(대상.Facing, u) >= GUARD_FRONT_COS
                          GuardElapsed = Blocked ? World.Time - 대상.GuardStartedAt : 없음

                       5  완벽 판정 (INTENT-PERFECT-GUARD-001)
                          Perfect = Blocked AND GuardElapsed <= PERFECT_GUARD_WINDOW
                          → 시각 하나로 갈린다. 확률도, 스킬 종류도, 거리도 개입하지 않는다

                       6-A  Perfect → RULE-PERFECT-GUARD-001 · RULE-EXPOSE-001
                          HpLoss = 0 · CpPaid = 0
                          CpGained = min(PERFECT_GUARD_CP_GAIN, 대상.CpMax - 대상.Cp)
                          대상.Cp = min(대상.CpMax, 대상.Cp + PERFECT_GUARD_CP_GAIN)
                          공격자.ExposedUntil = max(공격자.ExposedUntil,
                                                   World.Time + EXPOSED_DURATION)
                          Guarded = true · PerfectGuard = true · GuardBroken = false
                          → 자세는 그대로 유지된다. 다만 창은 이미 지나가고 있다

                       6-B  Blocked · Perfect 아님 · 치를 기력 있음 (C010 4-A 그대로)
                          HpLoss = Mitigated × GUARD_DAMAGE_RATIO
                          CpPaid = (Mitigated - HpLoss) × GUARD_CP_PER_DAMAGE
                          대상.Cp -= CpPaid · Guarded = true

                       6-C  Blocked · Perfect 아님 · 기력 모자람 (C010 4-B 그대로)
                          → RULE-GUARD-BREAK-001. HpLoss = Mitigated · GuardBroken = true

                       6-D  Blocked 아님 (C010 4-C 그대로)
                          HpLoss = Mitigated · CpPaid = 0

                       7  기록과 이어지는 규칙
                          대상.Hp = max(0, Hp - HpLoss)
                          World.StrikeEvents += { …, BaseAmount = Base, CounterBonus, Counter,
                                                  Mitigated, Guarded, PerfectGuard, GuardElapsed,
                                                  CpPaid, CpGained, Amount = HpLoss, GuardBroken }
                          대상.Hp = 0 이면 RULE-DOWNED-001
        Result         Struck { Amount, Guarded, CpPaid, GuardBroken, PerfectGuard }
        Note           다섯 갈래 어디에도 우연이 없다. 같은 위치·방향·자세·기력·**두 시각**이면
                       언제나 같은 내역이다 (DC-COMBAT-PLAYER-CAUSALITY).
                       하나의 창 안에 둘 이상의 타격이 닿으면 둘 다 완벽하다 —
                       그것은 되풀이가 아니라 같은 한 번의 창이며, 창을 다시 여는 것만이
                       금지된다 (RULE-GUARD-SET-001 Precondition 5)

    RULE-PERFECT-GUARD-001 (ADDED)
        Implements     INTENT-PERFECT-GUARD-001 · INTENT-PERFECT-GUARD-REWARD-001 ·
                       INTENT-PERFECT-GUARD-ONCE-001
        Note           별도의 실행 순서를 갖지 않는다 —
                       RULE-STRIKE-DAMAGE-001 Transition 5 · 6-A 가 이 Rule 의 본문이다.
                       독립 이름을 두는 이유는 "읽어 낸 방어는 자원을 번다" 가 타격 규칙의
                       곁가지가 아니라 이 Cycle 의 중심이기 때문이다 (C010 의
                       RULE-GUARD-ABSORB-001 과 같은 형태). Intent 추적은 이 이름으로 한다

    RULE-EXPOSE-001 (ADDED)
        Implements     INTENT-EXPOSED-001 · INTENT-EXPOSED-EXPIRES-001
        Input          완벽하게 막힌 타격을 낸 공격자 Actor, World.Time
        Preconditions  그 타격이 완벽하게 막혔다 (RULE-STRIKE-DAMAGE-001 6-A)
        Transition     ExposedUntil = max(ExposedUntil, World.Time + EXPOSED_DURATION)
        Result         Exposed(ExposedUntil)
        Note           행동을 끊지 않고 움직임도 막지 않는다 — 받는 결과만 바뀐다 (01 EXCLUDED).
                       겹쳐도 깊어지지 않는다. 거두는 Rule 은 RULE-DOWNED-001 뿐이고
                       그 밖에는 World.Time 이 지나가면 끝난다 (새 Tick 단계 없음)

    RULE-COUNTER-001 (ADDED)
        Implements     INTENT-COUNTER-001
        Input          대상 Actor, 증폭 전 본래 피해 Raw, World.Time
        Preconditions  Exposed(대상, World.Time)
        Transition     상태를 바꾸지 않는다 — 값만 정한다.
                       Base = Raw × (1 + COUNTER_DAMAGE_BONUS)
        Result         { Base, CounterBonus = Base - Raw, Counter }
        Note           RULE-STRIKE-DAMAGE-001 Transition 2 가 이 Rule 의 본문이다.
                       열림을 만든 자만의 것이 아니다 — 열린 몸은 그 자리의 누구에게든 열려 있다.
                       열림 자체는 이 Rule 이 소비하지 않는다. 시간이 다할 때까지 남는다

    RULE-DOWNED-001 (CHANGED)
        Implements     INTENT-DOWNED-001 · INTENT-GUARD-EXCLUSIVE-001 · INTENT-EXPOSED-EXPIRES-001
        Transition     CurrentAction = downed · Stance = open (C010) + ExposedUntil = 0
        Result         Downed

    RULE-ATTRIBUTE-SET-001 (CHANGED)
        Implements     INTENT-ATTRIBUTE-MUTATE-001 (C007 R2)
        변경           1. stance = guard 를 넣으면 GuardStartedAt = World.Time 도 찍는다
                       2. exposedFor 를 넣으면 ExposedUntil = World.Time + 값 (0 이면 닫힌다)
        Note           혼자서도 되받아침을 확인할 수 있어야 한다 (01 RELATED EXISTING CAPABILITY).
                       세계 밖의 손이지만 바뀐 뒤의 세계는 자기 규칙대로 간다 —
                       그래서 시각을 함께 찍는다. 찍지 않으면 밖의 손이 세계를
                       규칙으로 도달할 수 없는 상태에 놓게 된다

## OBSERVABLE SEMANTIC

    모든 Actor 에 대해 — 누구의 것이든 예외 없이 (C007 R2 원칙 그대로)
        Actor.Exposed (파생)                            지금 열려 있는가
        Actor.ExposedUntil                              그 열림이 언제 가시는가
        Actor.GuardStartedAt                            마지막으로 자세를 세운 시각
        (재사용) Stance · GuardBroken · GuardBrokenUntil · Facing · Defense ·
                 Name · Hp/HpMax · Cp/CpMax · Downed · MoveMode · TempoStats ·
                 Modifiers · Position · CharacterKind · Control ·
                 CurrentActionKind · ActionProgress · Body · Swing

    관찰자 자신에 대해 추가로
        Guard.Availability + Guard.FailureReason
            downed | action-busy | insufficient-cp | guard-broken | guard-rearming
            — 다섯 번째 사유가 더해진다. "왜 지금 막기가 안 되지" 로 남지 않게 한다
        Self.PerfectWindowOpen (파생)
            Stance = guard AND World.Time - GuardStartedAt <= PERFECT_GUARD_WINDOW
            — 지금 내 자세가 아직 완벽한 창 안인가.
              읽어야 할 것은 상대의 공격이지 자기 세계의 규칙이 아니다
              (INTENT-PERFECT-GUARD-OBSERVE-001)
        Self.GuardRearmAt
            GuardStartedAt + GUARD_REARM_LOCK — 다시 세울 수 있게 되는 시각
        Self.Exposed · Self.ExposedUntil                 나도 열릴 수 있다

    세계에 대해
        World.StrikeEvents
            { AttackerId, TargetId, SkillKind,
              BaseAmount, CounterBonus, Counter,
              Mitigated, Guarded, PerfectGuard, GuardElapsed,
              CpPaid, CpGained, Amount, GuardBroken,
              Position, Time }
            — 한 줄로 "본래 얼마짜리였고 / 되받아침이 얼마를 키웠고 / 방어력이 얼마를 걷었고 /
              막혔는지 / 완벽했는지 / 자세를 세운 지 얼마 만에 닿았는지 /
              기력을 얼마 치렀고 얼마 벌었고 / 그래서 생명에서 얼마가 나갔는지" 가 다 읽힌다
        MutableAttribute 목록에 exposedFor 가 더해진다 (Range 포함)
        시뮬레이션 상수 5종은 세계의 고정값이므로 관찰 대상이 아니다 —
            대신 그 상수들이 만든 결과가 StrikeEvent 내역으로 전부 드러난다.
            특히 GuardElapsed 가 실리므로 보는 이는 PERFECT_GUARD_WINDOW 를 몰라도
            "이번엔 얼마였고 저번엔 얼마였다" 를 비교해 창의 크기를 스스로 안다

    관찰되지 않는 것
        없다. C007 R2 의 원칙을 이 Cycle 도 그대로 지킨다.

    Rule 판단에 쓰인 모든 조건이 위에서 관찰 가능하다 —
    완벽을 가른 두 시각과 그 차이, 되받아침을 가른 열림과 그 만료 시각,
    막기 실패 사유 다섯 가지, 그리고 결과를 만든 열한 수치.

## SEMANTIC CLOSURE

    ── 시점이 가르는 막기 (INTENT-GUARD-ONSET-001 · PERFECT-GUARD-001 · ONCE · REWARD) ──
    "언제 세웠는가를 함께 지닌다"        → Actor.GuardStartedAt
    "세우는 그 순간에 정해진다"          → RULE-GUARD-SET-001 Transition (open → guard)
    "이어지는 동안 바뀌지 않는다"        → guard → guard 재요청은 찍지 않는다 (멱등)
    "놓았다 세우면 새 시각이 된다"       → 다음 open → guard 가 다시 찍는다
    "아주 짧은 창 안이면 완벽하다"       → GuardElapsed <= PERFECT_GUARD_WINDOW
    "창을 벗어나면 보통 막기 그대로"     → 6-B 가 C010 4-A 와 같다
    "두 시각의 관계만이 가른다"          → 5 의 조건에 다른 항이 없다
    "방향 조건은 똑같다"                 → Perfect 는 Blocked 를 전제로만 참이 된다
    "되풀이되지 않는다"                  → RULE-GUARD-SET-001 Precondition 5 (GUARD_REARM_LOCK)
    "다시 세우는 데 한 호흡이 든다"      → 같은 Precondition + Failure(guard-rearming)
    "놓는 것은 언제나 된다"              → open 에는 Precondition 이 없다
    "생명을 전혀 덜어내지 않는다"        → 6-A 의 HpLoss = 0
    "치르는 기력도 없다"                 → 6-A 의 CpPaid = 0
    "정해진 만큼의 기력을 얻는다"        → 6-A 의 PERFECT_GUARD_CP_GAIN
    "한계를 넘지 않는다"                 → min(CpMax, …) — 기존 clamp 재사용
    "새 자원이 아니다"                   → 늘어나는 것이 Actor.Cp 하나뿐이다

    ── 열림 (INTENT-EXPOSED-001 · EXPIRES) ──
    "그 순간 열린 상태가 된다"           → RULE-EXPOSE-001 (6-A 가 부른다)
    "정해진 시각까지 이어진다"           → ExposedUntil = Time + EXPOSED_DURATION
    "아프지도 굳히지도 않는다"           → RULE-EXPOSE-001 이 다른 State 를 건드리지 않는다
    "받는 타격의 결과만 달라진다"        → 단계 2 만이 Exposed 를 읽는다
    "막힌 자가 지불한다"                 → 세우는 대상이 공격자다
    "스스로 가신다"                      → 파생 Exposed 는 World.Time 비교뿐이다
    "겹쳐 쌓이지 않고 시각만 밀린다"     → max(ExposedUntil, Time + EXPOSED_DURATION)
    "열린 몸도 막을 수 있다"             → RULE-GUARD-SET-001 이 Exposed 를 보지 않는다
    "막아도 열림은 닫히지 않는다"        → 열림을 지우는 것은 RULE-DOWNED-001 뿐이다
    "쓰러진 몸에는 남지 않는다"          → RULE-DOWNED-001 의 ExposedUntil = 0

    ── 되받아침 (INTENT-COUNTER-001) ──
    "열려 있는 자에게 닿으면 되받아침"   → 단계 2 의 Counter = Exposed(대상)
    "본래 피해를 정해진 만큼 키운다"     → Base = Raw × (1 + COUNTER_DAMAGE_BONUS)
    "가장 앞에서 커진다"                 → 단계 2 가 단계 3(감쇄)·4(막힘)보다 앞이다
    "막고 있어도 커진 몫이 실린다"       → Mitigated 가 커진 Base 에서 계산된다
    "조건은 하나뿐이다"                  → 단계 2 의 조건에 다른 항이 없다
    "누가 때리든 걸린다"                 → 공격자 Id 를 보지 않는다
    "만든 자만의 것이 아니다"            → 같은 이유
    "관찰자와 자율 존재 모두에게"        → Exposed 는 Actor 의 State 다. Control 을 보지 않는다

    ── 관찰 (INTENT-PERFECT-GUARD-OBSERVE-001 · TIMING-BREAKDOWN-001) ──
    "누가 열려 있는지 보인다"            → Observable Actor.Exposed
    "언제 가시는지 보인다"               → Observable Actor.ExposedUntil
    "내 창이 아직 남았는지 안다"         → Self.PerfectWindowOpen
    "완벽하게 막혔는지"                  → StrikeEvent.PerfectGuard
    "얼마 만에 닿았는지"                 → StrikeEvent.GuardElapsed
    "되받아침이었는지"                   → StrikeEvent.Counter
    "얼마나 키웠는지"                    → StrikeEvent.CounterBonus
    "기력을 얼마나 얻었는지"             → StrikeEvent.CpGained
    "같은 두 시각이면 같은 내역"         → 다섯 갈래 전부에 우연이 없다

    ── 상위 (MASTER TRACE) ──
    MC-PERFECT-GUARD   → Actor.GuardStartedAt + RULE-GUARD-SET-001(CHANGED) +
                         RULE-PERFECT-GUARD-001 + PERFECT_GUARD_WINDOW
    MC-COUNTER         → Actor.ExposedUntil + RULE-EXPOSE-001 + RULE-COUNTER-001
    MC-GUARD (재사용)  → C010 의 자세·방향·받아냄·무너짐을 그대로 딛는다
    MC-CP-ECONOMY      → 기력이 처음으로 방어로 늘어난다. 전용 자원 없음
                         (DC-COMBAT-SHARED-BUDGET)
    DC-COMBAT-DEFENSE-IS-ACTIVE 의 두 번째 requires
                       (defense_success_creates_offense_opportunity)
                       → RULE-EXPOSE-001 + RULE-COUNTER-001 + 6-A 의 CpGained.
                         막아 낸 것이 (1) 때릴 자원과 (2) 때릴 대상의 틈을 함께 만든다

    닫히지 않은 Intent 문장: 없음.
