# C006 — World Implementation

## IMPLEMENTED
    Actor.Body.Radius · Body.Mass · Velocity     world/semantic/actor.ts (필드) ·
                                                 world/semantic/collision.ts (상수)
    CurrentAction.StruckActorIds                 world/semantic/action.ts
    ActionCollider (파생)                        world/semantic/collision.ts — actionCollider()
    RULE-BODY-PUSH-001                           world/simulation/body-push.ts
    RULE-BODY-MOMENTUM-001                       world/simulation/body-momentum.ts
    RULE-SWING-STRIKE-001                        world/simulation/swing-strike.ts
    RULE-ATTACK-001 (changed)                    world/rules/attack.ts — StruckActorIds = [] 초기화,
                                                 RULE-ATTACK-COMPLETE-001 폐지
    RULE-WORLD-TICK-001 (changed)                world/simulation/world-tick.ts —
                                                 진행 순서에 SwingStrike → BodyPush → BodyMomentum 추가
    시뮬레이션 상수                              BODY_RADIUS 0.5 · BODY_MASS 1.0 · PUSH_STIFFNESS 60 ·
                                                 FRICTION 6/s · REST_SPEED 0.02 ·
                                                 SWING [0.25, 0.75] · SWING_IMPULSE 8

## REUSED
    Actor.Position · World.Bounds                world/semantic/position.ts · world-state.ts
    Actor.AttackRange                            휘두름 충돌 반경의 크기
    RULE-HIT-001                                 world/rules/attack.ts — 그대로
    RULE-ACTION-PROGRESS-001 시간 진행           충돌 반경 활성 구간의 기반

## AFFECTED UPDATED
    RULE-ACTION-PROGRESS-001                     world/simulation/action-progress.ts —
                                                 attack 완료 효과 호출 제거
    RULE-OBSERVER-JOIN-001                       world/rules/observer-join.ts — 새 몸에 Body 필드
    World 초기 배치 (NPC)                        world/index.ts — NPC 몸에 Body 필드
    RULE-MOVE-PROGRESS-001 · RULE-NPC-DECIDE-001 코드 변경 없음 — Tick 순서상 물리(6~8)가
                                                 이동 결과를 보정하는 것으로 의미 정합 (회귀 통과)

## PROJECTION
    Collision.Bodies          → EntityView.body   protocol/gameview.ts (BodyView) ·
                                                  world/projection/observer-view.ts
    Collision.ActionColliders → EntityView.swing  protocol/gameview.ts (SwingView) — attack 중에만
    Attack.StruckActorIds     → swing.struck
    SPEC_ID                   → VIEW-BASIC-COLLISION-001

## TESTS
    collision.spec.ts    몸 관찰(반경·질량·속도) / 겹침 밀어냄(분리 수렴 · 제3법칙 대칭 ·
                         중심 일치 결정론 · 이동 후 보정) / 관성·마찰 정지 / 경계 고정
    attack.spec.ts       (CHANGED 재작성) 구간 이전 무타격 → 구간 접촉 타격(완료 전) /
                         접촉 거리 밖 무타격 / 다수 타격 / 물러서도 구간 접촉이면 타격 /
                         구간 닫힌 뒤 진입 무타격 / 휘두름당 1회(struck) / 밀쳐냄+마찰 정지 /
                         충돌 반경 관찰(존재·활성·소멸)
    회귀                 npc · mine · move · action · observer · world-tick · server · view
                         전부 통과 — 178/178

## NOTES
    타격·물리 판정은 세계의 Tick 주기(TICK_INTERVAL)로 표본화된다 — 검증도 실제 주기로
    진행하도록 tickFor 를 쓴다 (한 번에 0.6초를 건너뛰면 구간이 표본화되지 않는다).
    발사체는 만들지 않았지만 ActionCollider 파생 구조가 행동 종류별 분기를 담을 수 있다.
