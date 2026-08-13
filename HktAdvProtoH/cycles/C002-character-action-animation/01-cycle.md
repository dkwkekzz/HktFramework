# CYCLE C002 — Character Action & Animation

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[PASS] World Implementation
[PASS] View Implementation
[PASS] Verification (Human Play 확인 대기)

STATUS  IN PROGRESS

## TYPE
    New Capability                     Character Action · NPC Autonomy · Action Animation
    Existing Capability Enhancement    Actor / Movement / Mining → Action 체계로 편입

## TARGET CAPABILITY
    Character Action

## GOAL
    플레이어가 자기 캐릭터를 조작하고 같은 세계의 NPC 가 스스로 움직일 때,
    각 캐릭터가 지금 무슨 행동(대기 · 이동 · 공격 · 채굴 · 피격)을 하고 있는지가
    그 행동에 대응하는 애니메이션 재생으로 화면에서 구분되어 관찰된다.

## INCLUDED
    Actor.CurrentAction              지금 하는 행동이 World State 다
                                     (idle | move | attack | mine | hit)
    Action Duration                  행동은 시간 위에서 시작·진행·종료한다
    Attack Action                    휘두르는 공격 — 대상을 고르지 않는다
    Hit Resolution                   휘두름이 끝나는 순간 타격 범위 안의 캐릭터가 맞는다
    Hit Reaction                     맞은 캐릭터는 잠시 피격 상태가 된다
    NPC Actor                        플레이어가 조종하지 않는 Actor 가 세계에 존재한다
    NPC Basic Autonomy               NPC 가 스스로 행동을 선택한다 (관찰 가능한 최소 규칙)
    Character Kind                   캐릭터 종류가 구분된다 (종류마다 다른 모션 집합)
    Action Animation Playback        행동에 대응하는 모션이 프레임 단위로 재생된다
    Motion Data Injection            정해진 포맷·위치에 넣어둔 모션 데이터가 자동으로 로드된다
    Placeholder Motion Set           실제 데이터 도착 전 검증용 4프레임 임시 시트

## EXCLUDED
    Damage / Health / Death          피해량 · 체력 · 사망 (맞았다는 사실까지만 다룬다)
    Targeted Action                  특정 대상을 목표로 하는 행동 (조준 · 락온) — 이후 Cycle
    공격의 방향성                    전방 부채꼴 등 방향 규칙 (지금은 원형 범위)
    타격 시점 세분화                 휘두르는 도중의 순간 판정 (지금은 끝나는 시점 하나)
    Animation Blending               모션 간 보간 · 전환 블렌딩
    Directional Motion               방향별(8방향/좌우) 모션 분기
    Animation Event                  프레임에 판정·효과를 붙이는 것
    NPC Pathfinding / Aggro          장애물 회피 · 어그로 · 협동 등 고급 AI
    Action Queue                     행동 예약 · 콤보 · 취소 규칙
    Multiplayer                      다른 플레이어와의 상호작용

## RELATED EXISTING CAPABILITY
    Actor (C001)                     재사용 · 확장 — 세계에 Actor 가 하나가 아니게 된다
    Actor.Position / Movement (C001) 재사용 — 이동은 Action 의 한 종류가 된다
    Mining (C001)                    변경 — Mine 도 즉시 처리가 아니라 CurrentAction 의 한 종류가 된다
    GameView Entity.state (C001)     확장 — idle/moving 2종이 Action 기반 상태로 일반화된다
    View Asset Registry (C001)       변경 — 코드 내장 단일 스프라이트에서 데이터 기반 모션 집합으로

    → C001 의 Stone Mining 플레이는 이번 Cycle 이후에도 그대로 성립해야 한다 (Regression).
