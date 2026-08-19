# C014 — World Semantic

> 이 Cycle 은 새 능력치도 새 공식도 만들지 않는다. 세계에 더해지는 것은 셋이다 —
> **행동 하나**(살펴봄), **장부 하나**(누가 무엇을 아는가), 그리고 **투영의 관문 하나**
> (아는 것만 실린다). 피해 계산은 한 글자도 바뀌지 않는다.
> 가장 조심할 지점은 장부의 성질이다: 장부는 **값을 베껴 두지 않고 자리를 열 뿐이다.**

## SEMANTIC DELTA

    REUSED
        Actor.CurrentAction                 행동 자리 — 살펴봄이 그 하나가 된다
        Actor.Position · Body.Radius        거리 판정의 입력
        World.Observers (Engine)            보는 이의 장부 — 앎이 이 Id 에 매달린다
        World.DebugAuthority                되돌림의 관문 (C007 R2)
        Actor.PhysicalAttack · AuraAttack · Armor · Resistance ·
        ArmorPenetration · ResistancePenetration
                                            가려지는 값들. 값 자체는 그대로다
        RULE-ACTION-BEGIN-001               행동 시작 관문
        RULE-ACTION-PROGRESS-001            행동 진행
        RULE-HIT-001                        피격이 하던 행동을 중단시킨다 —
                                            살펴봄의 중단이 여기서 저절로 온다
        RULE-DAMAGE-CALCULATE-001           계산 무변경
        DefenseShape · EffectiveDefense · DefenseMultiplier
                                            파생 판정 무변경 — 관문만 얹힌다

    ADDED
        ActionKind.observe                  살펴보는 행동
        CurrentAction.targetActorId         (재사용) 살펴봄의 대상. attack 이 쓰던 자리다
        World.Acquaintances                 누가 어떤 존재를 알고 있는가 — 관찰자별 장부
        OBSERVE_RANGE                       살펴봄이 성립하는 거리 (헤더 상수)
        RULE-OBSERVE-BEGIN-001              살펴봄을 시작한다
        RULE-OBSERVE-COMPLETE-001           끝까지 간 살펴봄이 앎을 남긴다
        RULE-OBSERVE-FORGET-001             알게 된 것을 되돌린다

    CHANGED
        Observer Projection — entities[].attributes
            남의 `combatStats` · `versusObserver` · `defenseShape` 가
            그 존재를 아는 경우에만 실린다. 모르면 자리가 없고 사유가 실린다.
            자기 몸과 그 밖의 모든 속성은 무변경
        Observer Projection — interactions
            `observe` 가 존재마다 하나씩 실린다 (mine 이 광맥마다 실리는 것과 같은 형태)
        명령 카탈로그 (RULE-ATTRIBUTE-SET-001 의 이웃)
            `forget-acquaintance` 가 요청 목록에 더해진다

    AFFECTED
        RULE-OBSERVER-JOIN-001              바꾸지 않는다. 장부에 항목이 없다는 것이
                                            곧 "아무것도 모른다" 다
        RULE-OBSERVER-LEAVE-001             바꾸지 않는다. 몸이 남듯 앎도 남는다 —
                                            재참여하면 알던 것을 그대로 안다
        RULE-ATTRIBUTE-SET-001              바꾸지 않는다. 다만 남의 값을 바꿔도
                                            모르는 이에게는 그 변화가 보이지 않는다
        RULE-NPC-DECIDE-001                 바꾸지 않는다. 자율 존재는 관찰 계약이 아니라
                                            세계 상태를 직접 읽으므로 관문 밖이다
        RULE-SWING-STRIKE-001 · RULE-GUARD-BLOCK-001 · RULE-STRIKE-DAMAGE-001
                                            무변경. 타격 경위(StrikeEvent)는 가려지지 않는다

## WORLD STATE

    Actor.CurrentAction.Kind = observe          World Authority
        살펴보는 중인 행동. 대상은 CurrentAction.TargetActorId 에 담는다 (attack 과 같은 자리).
        길이는 고정이다 — 스킬이 아니므로 ActionSpeed 가 관여하지 않는다.

    World.Acquaintances                          World Authority
        항목마다  ObserverId       그 앎의 주인 (World.Observers 의 Id)
                  KnownActorIds    그 관찰자가 알게 된 존재들의 Id 집합

        항목이 없는 관찰자는 아무것도 모른다 — "모름" 을 따로 저장하지 않는다.
        같은 존재를 두 번 알게 되는 일은 없다 (집합이다).
        이 장부는 **능력치를 베껴 담지 않는다.** 담는 것은 Id 뿐이며,
        값은 언제나 그 순간의 Actor 에서 읽는다 (INTENT-OBSERVE-KNOWLEDGE-001).
        자기 몸은 장부에 담지 않는다 — 자기 것을 아는 것은 장부의 일이 아니다.

    OBSERVE_RANGE = 5.0                          헤더 상수 (결정론)
    ACTION_DEFINITIONS.observe                   헤더 상수 (결정론)
        duration 1.0 · replaceable false

## WORLD RULE

    RULE-OBSERVE-BEGIN-001
        Implements     INTENT-OBSERVE-001
        Input          요청한 ObserverId, 대상 ActorId
        Preconditions  1 그 관찰자의 몸이 세계에 있다                        (no-body)
                       2 대상 Id 의 존재가 세계에 있다                       (no-such-target)
                       3 대상이 자기 몸이 아니다                             (target-is-self)
                       4 두 몸 중심 거리 ≤ OBSERVE_RANGE                     (out-of-range)
                       5 아직 그 존재를 알지 못한다                          (already-known)
                       6 RULE-ACTION-BEGIN-001 관문 통과                     (action-busy)
        Transition     CurrentAction = { kind: observe, targetActorId, duration: 1.0 }
        Result         Success | Failure(reason)

        쓰러진 대상도 살펴볼 수 있다 — 겨루는 힘은 쓰러져도 그 존재의 것이다.
        살펴봄은 대상의 어떤 State 도 바꾸지 않는다. 대상은 자기가 살펴봐졌음을 모른다.

    RULE-OBSERVE-COMPLETE-001
        Implements     INTENT-OBSERVE-001 · INTENT-OBSERVE-KNOWLEDGE-001
        Input          CurrentAction 이 observe 이고 그 길이를 다 채운 Actor
        Preconditions  1 CurrentAction.Kind = observe
                       2 진행 시간이 duration 에 이르렀다
        Transition     그 몸을 조종하는 관찰자의 Acquaintances 에 TargetActorId 를 더한다
                       CurrentAction = idle
        Result         Learned(targetActorId) | NoObserver (그 몸에 조종자가 없으면 앎이 갈 곳이 없다)

        완료 조건은 시간뿐이다 — 거리는 시작 관문이 본다.
        중간에 멈추는 일은 이 Rule 이 아니라 RULE-HIT-001 이 만든다:
        맞으면 CurrentAction 이 hit 으로 갈리고 살펴봄은 앎을 남기지 않는다.
        스스로 다른 행동을 요청해 그만두는 길은 없다 — observe 는 replaceable false 다.

    RULE-OBSERVE-FORGET-001
        Implements     INTENT-OBSERVE-FORGET-001
        Input          요청한 ObserverId, (선택) 대상 ActorId
        Preconditions  1 World.DebugAuthority.Open 이 참이다                 (authority-closed)
                       2 그 관찰자를 세계가 안다                             (no-observer)
        Transition     대상이 주어지면 그 Id 하나를 Acquaintances 에서 지운다
                       주어지지 않으면 그 관찰자의 KnownActorIds 를 비운다
        Result         Success(forgotten) | Failure(reason)

        시간으로 잊는 길은 없다 — 이 요청만이 되돌린다.

## OBSERVABLE SEMANTIC

    존재마다 (entities[].attributes)
        acquainted            이 존재를 지금 알고 있는가                   (모든 존재에 실린다)
        unacquaintedReason    모를 때 왜 비어 있는가 — `not-observed`
        combatStats           알 때만 실린다 (여섯 값 + 두 배율)
        versusObserver        알 때만 실린다 (두 존재 사이의 값)
        defenseShape          알 때만 실린다 (세계가 계산한 판정)
        그 밖의 모든 속성      무변경 — 언제나 실린다

        자기 몸은 언제나 acquainted 이며 세 항목이 모두 실린다.
        "지금은 아무도 안 막는다" 와 "세계가 안 알려준다" 를 가르는 C011 의 원칙과 같은
        이유로, acquainted 는 알든 모르든 언제나 실린다 — 비어 있음이 관찰이어야 한다.

    가려질 수 있는 항목의 목록 (관찰 계약에 실린다)
        `combatStats` · `versusObserver` · `defenseShape` 셋.
        보는 이가 이 목록을 자기 코드에 적지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
        목록이 늘거나 줄면 관찰이 저절로 따라온다.

    할 수 있는 일 (interactions)
        observe               존재마다 하나 — targetEntityId 와 available 과 reason.
                              사유는 위 Precondition 의 코드 그대로:
                              out-of-range · already-known · action-busy · target-is-self
        forget-acquaintance   되돌림 요청 — available 은 DebugAuthority 가 정한다

    Before → Input → Rule → After (RULE-OBSERVE-COMPLETE-001)
        Before  wanderer 에 대해 acquainted=false · combatStats 없음 ·
                interactions.observe(wanderer) available=true
        Input   Observe(player-1 → npc-1)
        Rule    RULE-OBSERVE-BEGIN-001 → (1.0 초) → RULE-OBSERVE-COMPLETE-001
        After   acquainted=true · combatStats 여섯 값과 두 배율 · versusObserver ·
                defenseShape=`aura-tougher` · interactions.observe(wanderer)
                available=false reason=already-known

## BALANCE

    이 Cycle 이 정하는 수는 둘뿐이다. 능력치도 피해도 건드리지 않는다.

    OBSERVE_RANGE = 5.0
        사거리(2.0)보다 멀고 인지 거리(9.0)보다 가깝다.
        살펴봄은 칼이 아니라 눈으로 하는 일이므로 사거리 안까지 붙을 필요는 없다.
        그러나 인지 거리 안이므로 **자율 존재는 반드시 다가온다** —
        살펴보려면 상대가 나를 알아채는 거리까지 들어가야 한다는 것이 대가다.

    ACTION_DEFINITIONS.observe.duration = 1.0
        기본 스킬(0.6)보다 길고 채굴(1.2)보다 짧다.
        한 번 휘두를 기회를 버리고 얻는 앎이다.
        ActionSpeed 를 적용하지 않는다 — 스킬 행동이 아니고, 적용하면
        빠른 종류가 정보까지 빠르게 얻어 이 Cycle 의 의미에 세기가 섞인다.

    두 수가 함께 만드는 국면 (검증 기준)
        관찰자(rabbit-swordsman)가 5.0 거리에서 wanderer 를 살펴보기 시작하면,
        wanderer 는 2.5/초로 붙어 3.0 을 좁히는 데 1.2 초가 걸린다.
        살펴봄은 1.0 초에 끝난다 — **아슬아슬하게 먼저 끝난다.**
        더 가까이서 시작하면 맞아서 중단되고, 5.0 에서 시작하면 알아낸다.
        이것이 "시간과 다가감의 대가" 가 수로 나타난 자리다.

    관통 초기값도 능력치도 바꾸지 않는다 — C013 의 실측값이 그대로 유지되어야 한다
    (관찰한 뒤에 같은 숫자가 나오는 것이 이 Cycle 의 Regression 기준이다).

## SEMANTIC CLOSURE

    INTENT-OBSERVE-001
        "자기 몸이 아닌 존재 하나를 정해"      → RULE-OBSERVE-BEGIN-001 Precondition 2·3 ·
                                               CurrentAction.TargetActorId
        "가까이서 살필 수 있을 만큼 다가가"     → Precondition 4 · OBSERVE_RANGE
        "다른 행동에 붙잡혀 있지 않아야"        → Precondition 6 (RULE-ACTION-BEGIN-001)
        "시간이 걸리는 행동 · 그동안 다른 것을 못 한다"
                                               → ACTION_DEFINITIONS.observe
                                                 (duration 1.0 · replaceable false)
        "끝까지 가지 못하면 아무것도 알게 되지 않는다"
                                               → RULE-OBSERVE-COMPLETE-001 이 완료에서만
                                                 장부를 건드린다 · RULE-HIT-001 이 중단시킨다
        "마치면 그 존재의 능력을 알게 된다"     → RULE-OBSERVE-COMPLETE-001 Transition
        "대상에게 아무 일도 하지 않는다"        → 두 Rule 의 Transition 에 대상 State 가 없다
        "얻는 것은 오직 앎이다"                 → 계산 Rule 무변경 (SEMANTIC DELTA REUSED)

    INTENT-OBSERVE-KNOWLEDGE-001
        "세계가 지니는 사실"                    → World.Acquaintances (World Authority)
        "보는 이마다 다르다"                    → 장부의 열이 ObserverId 다
        "다시 살펴볼 필요가 없다"               → Precondition 5 (already-known)
        "다른 사람이 함께 알게 되지는 않는다"    → 장부가 ObserverId 로 갈린다
        "값을 베끼지 않고 자리가 열린다"        → 장부는 ActorId 만 담는다 ·
                                                 투영이 그 순간의 Actor 를 읽는다
        "보는 이의 수명에 매달린다"             → 장부의 열이 World.Observers 의 Id 이고
                                                 그 수명 규칙은 무변경 (AFFECTED)

    INTENT-UNSEEN-CAPABILITY-001
        "겨루는 힘을 알려주지 않는다"           → 투영의 관문 (CHANGED — combatStats ·
                                                 versusObserver · defenseShape)
        "가려지는 것은 그것뿐"                  → 나머지 속성 투영 무변경
        "자기 몸은 가려지지 않는다"             → 자기는 언제나 acquainted
        "타격 경위는 가려지지 않는다"           → StrikeEvent 투영 무변경
        "앎으로 바뀌지는 않는다"                → 장부를 바꾸는 Rule 은 OBSERVE-COMPLETE 와
                                                 OBSERVE-FORGET 둘뿐이다

    INTENT-UNSEEN-IS-OBSERVABLE-001
        "왜 비어 있는지를 함께 밝힌다"          → acquainted · unacquaintedReason
        "가려질 수 있는 항목의 목록"            → 관찰 계약이 그 목록을 싣는다
        "지금 가능한가 · 무엇이 막고 있는가"     → interactions.observe 의 available · reason

    INTENT-ATTRIBUTE-OBSERVE-001 (CHANGED)
        "무엇이 언제 실리는지를 세계가 정한다"   → 투영의 관문이 세계 쪽에 있다
        "가린 것이 있으면 밝힌다"               → acquainted 가 언제나 실린다

    INTENT-DAMAGE-TYPE-OBSERVE-001 (CHANGED)
        "그 자리가 살펴본 뒤에 열린다"          → defenseShape 관문
        "열린 뒤의 읽기는 같다"                 → DefenseShape 판정 무변경

    INTENT-PENETRATION-OBSERVE-001 (CHANGED)
        "내 통함은 언제나 보인다"               → 자기 combatStats 무변경
        "관계의 값은 살펴본 뒤에 열린다"        → versusObserver 관문

    INTENT-OBSERVE-FORGET-001
        "되돌리는 요청을 허용한다"              → RULE-OBSERVE-FORGET-001
        "저절로 잊는 일은 없다"                 → 시간을 읽는 Rule 이 없다
        "요청 목록에 실려 발견된다"             → interactions.forget-acquaintance ·
                                                 명령 카탈로그

    닫히지 않은 문장 없음. GAP 없음.

## NOTE — 두 가지 설계 판단의 근거

    ① 왜 장부를 팩의 World State 에 두는가
       앎은 관찰자별 사실이지만 **세계가 지녀야 한다** — 보는 이가 자기 쪽에 적어 두면
       Client 가 세계 상태를 소유하게 되고(World Authority 위반), 세계가 값을 바꿔도
       화면이 따라오지 않는다. 관찰자 장부 자체는 Engine 의 것이지만 앎은 이 팩의
       게임 의미이므로 팩의 WorldState 확장에 둔다 — Engine 을 건드리지 않는다.

    ② 왜 완료 시점에 거리를 다시 보지 않는가
       Intent 가 요구한 중단 사유는 하나다 — "끝까지 가지 못하면". 그 중단은 피격이 이미
       만든다 (RULE-HIT-001). 완료에 거리를 더 걸면 Intent 에 없는 의미("상대가 달아나면
       알아내지 못한다")를 세계에 심는 것이 된다. 필요해지면 그때 Intent 로 올린다.
