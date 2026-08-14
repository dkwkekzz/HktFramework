# C006 — World Semantic

## SEMANTIC DELTA
    REUSED
        Actor.Position · World.Bounds            (C001) 몸의 중심과 세계 경계
        Actor.CurrentAction · ActionProgress      (C002) 충돌 반경의 활성 구간이 이 위에 정의된다
        Actor.AttackRange                         (C002) 휘두름 충돌 반경의 크기
        RULE-HIT-001                              (C002) 타격 반응 — 그대로 재사용
        World.Tick (RULE-WORLD-TICK-001)          (C003) 물리 규칙이 실릴 시간 진행
    ADDED
        Actor.Body.Radius                         몸이 차지하는 원의 반경
        Actor.Body.Mass                           몸의 질량
        Actor.Velocity                            물리 속도 (의도한 이동과 별개인, 힘이 만든 움직임)
        CurrentAction.StruckActorIds              이 휘두름이 이미 타격한 몸들 (attack 전용)
        ActionCollider (파생)                     행동이 만든 충돌 반경 — Owner·Center·Radius·Active
        RULE-BODY-PUSH-001
        RULE-BODY-MOMENTUM-001
        RULE-SWING-STRIKE-001
    CHANGED
        RULE-ATTACK-COMPLETE-001                  폐지 — 완료 순간 일괄 판정을 하지 않는다.
                                                  판정은 RULE-SWING-STRIKE-001 이 접촉 시점에 한다
        RULE-WORLD-TICK-001                       Transition 에 물리 단계 3개가 추가된다 (아래)
    AFFECTED
        RULE-MOVE-PROGRESS-001                    이동이 정한 위치가 이후 밀어냄·경계로 보정된다
        RULE-ACTION-PROGRESS-001                  attack 완료 효과 호출이 사라진다
        RULE-NPC-DECIDE-001                       배회 이동 결과도 같은 물리 아래 놓인다
        RULE-OBSERVER-JOIN-001                    새로 놓이는 몸도 Radius·Mass·Velocity 를 갖는다

## WORLD STATE
    Actor
        Body.Radius        World Authority    고정 상수 BODY_RADIUS
        Body.Mass          World Authority    고정 상수 BODY_MASS
        Velocity           World Authority    힘(밀어냄·충격량)만이 바꾼다
        CurrentAction.StruckActorIds
                           World Authority    attack 시작 시 비어 있고, 타격마다 쌓이고, 행동과 함께 사라진다

    ActionCollider (파생 상태 — 저장하지 않고 CurrentAction 에서 유도)
        Owner              충돌 반경을 만든 Actor
        Center             Owner.Position (휘두르는 몸을 따라다닌다)
        Radius             Owner.AttackRange
        Active             CurrentAction.kind = attack 이고
                           ActionProgress ∈ [SWING_BEGIN, SWING_END] 인 동안

    시뮬레이션 상수 (결정론 — 헤더 상수 고정)
        BODY_RADIUS        몸 반경
        BODY_MASS          몸 질량
        PUSH_STIFFNESS     겹침 깊이 → 밀어내는 힘의 비례 계수
        FRICTION           초당 속도 감쇠 계수
        SWING_BEGIN/END    휘두름 구간 (ActionProgress 비율)
        SWING_IMPULSE      휘두름 타격이 전달하는 충격량

## WORLD RULE
    RULE-BODY-PUSH-001
        Implements     INTENT-BODY-OCCUPY-001 · INTENT-BODY-PUSH-001
        Input          모든 Actor 쌍 (Tick 마다)
        Preconditions  두 몸의 중심 거리 < Radius 합 (겹침 깊이 > 0)
        Transition     겹침 깊이 × PUSH_STIFFNESS 의 힘을 중심선 방향으로 서로 반대로 가한다.
                       힘의 크기는 양쪽이 같다 (제3법칙).
                       각자의 Velocity 변화 = 힘 / 자신의 Mass × dt (제2법칙).
                       중심이 완전히 일치하면 Actors 순서가 앞선 쪽을 -x 로 미는 고정 방향을 쓴다 (결정론).
        Result         Pushed(쌍 수) — 상태 변화는 Velocity 에만 생긴다

    RULE-BODY-MOMENTUM-001
        Implements     INTENT-BODY-MOMENTUM-001
        Input          모든 Actor, dt
        Preconditions  없음 — 몸은 언제나 물리 아래 있다
        Transition     Position += Velocity × dt (관성).
                       Velocity 는 FRICTION 으로 감쇠하고, 충분히 작아지면 0 이 된다.
                       Position 이 World.Bounds 를 벗어나면 경계에 고정하고
                       그 축의 Velocity 를 0 으로 한다 (경계 너머로는 밀리지 않는다).
        Result         Moved | Rested

    RULE-SWING-STRIKE-001
        Implements     INTENT-ACTION-COLLIDER-001 · INTENT-SWING-IMPACT-001 ·
                       INTENT-ATTACK-HIT-001(CHANGED)
        Input          ActionCollider 가 Active 인 모든 Actor (Tick 마다)
        Preconditions  대상 = 자신이 아닌 Actor 중
                       중심 거리 <= Collider.Radius + 대상.Body.Radius 이고
                       StruckActorIds 에 아직 없는 몸
        Transition     대상마다: RULE-HIT-001 적용 (행동 중단 → hit),
                       Owner 중심 → 대상 중심 방향으로 SWING_IMPULSE 충격량 —
                       대상.Velocity += 충격량 / 대상.Mass,
                       StruckActorIds += 대상
        Result         Struck(대상 수)

    RULE-WORLD-TICK-001 (CHANGED — Transition 순서)
        1. 참여/이탈/표식   2. 도착한 요청   3. RULE-NPC-DECIDE-001
        4. RULE-MOVE-PROGRESS-001            5. RULE-ACTION-PROGRESS-001
        6. RULE-SWING-STRIKE-001             7. RULE-BODY-PUSH-001
        8. RULE-BODY-MOMENTUM-001            9. World.Time += dt
        의도한 이동(4)이 먼저 자리를 정하고, 물리(6~8)가 그 자리를 세계 규칙으로 보정한다.

## OBSERVABLE SEMANTIC
    Collision.Bodies             모든 Actor 의 { Id, Center, Radius, Mass, Velocity }
    Collision.ActionColliders    모든 활성/비활성 판단 가능한 { OwnerId, Center, Radius, Active }
                                 — attack 진행 중인 Actor 마다 하나
    Attack.StruckActorIds        이 휘두름이 지금까지 타격한 몸들
    (재사용) Actor.CurrentAction — 타격당한 몸이 hit 에 들어간 것이 보인다
    관찰은 항상 제공된다. 보일지 말지는 관찰자(View)의 선택이다 — INTENT-COLLISION-OBSERVE-001.

## SEMANTIC CLOSURE
    "반경과 질량을 가진 몸으로 공간을 차지한다"      → Actor.Body.Radius · Body.Mass
    "행동과 무관하게 사라지지 않는다"                → Body 는 Actor 의 상시 State
    "겹치면 반대 방향으로 밀어낸다"                  → RULE-BODY-PUSH-001 Transition
    "힘의 크기는 같고 방향은 반대"                   → RULE-BODY-PUSH-001 (제3법칙 명시)
    "밀려나는 정도는 질량에 반비례"                  → Velocity 변화 = 힘 / Mass
    "속도를 얻고 관성으로 움직인다"                  → Actor.Velocity + RULE-BODY-MOMENTUM-001
    "마찰로 잦아든다"                                → FRICTION 감쇠
    "세계 경계를 넘어 밀려나지 않는다"               → RULE-BODY-MOMENTUM-001 경계 고정
    "행동 종류에 따라 충돌 반경을 만든다"            → ActionCollider (kind 별 유도 — 이번엔 attack)
    "휘두름 구간 동안 몸 주위 타격 반경"             → Active 조건 · Center · Radius 정의
    "행동이 끝나면 함께 사라진다"                    → CurrentAction 에서 유도되므로 자동 소멸
    "닿으면 행동 중단"                               → RULE-SWING-STRIKE-001 → RULE-HIT-001
    "밀려나는 방향으로 충격량"                       → SWING_IMPULSE / Mass → Velocity
    "같은 몸은 한 번만"                              → CurrentAction.StruckActorIds
    "모든 충돌체를 관찰"                             → Collision.Bodies · Collision.ActionColliders
    "켜고 끄는 것은 관찰자의 선택"                   → Observable 상시 제공 + View 토글 (04 로 전달)
