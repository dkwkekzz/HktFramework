# CYCLE C001 — World Implementation

## IMPLEMENTED
    World.Bounds · InteractionRange · MoveSpeed   world/semantic/world-state.ts
    Actor (Position/MoveTarget/Inventory)         world/semantic/actor.ts
    Inventory.Items                               world/semantic/inventory.ts
    Item.Kind · Tool.Capability                   world/semantic/item.ts
    Deposit (Position/ResourceAmount)             world/semantic/deposit.ts
    Position · distance · inBounds                world/semantic/position.ts
    RULE-MOVE-001                                 world/rules/move.ts
    RULE-MOVE-PROGRESS-001                        world/simulation/move-progress.ts
    RULE-MINE-001                                 world/rules/mine.ts
    Action Request 수용 경로                       world/actions/dispatch.ts
    World 조립 · Authority 캡슐화                  world/index.ts

## REUSED
    없음 — 첫 Cycle

## AFFECTED UPDATED
    없음

## PROJECTION
    VIEW-STONE-MINING-001 전체                    world/projection/player-view.ts
        entities.player / entities.deposit / interactions.move / interactions.mine /
        hud.inventory / hud.tool / hud.mineHint
    Mine.Availability 는 RULE-MINE-001 과 동일한 Precondition 평가 함수
    (evaluateMinePreconditions) 를 공유한다 — 판정 이중화 없음.

## AUTHORITY
    WorldState 는 world/index.ts 내부에만 존재. 외부 접근은
    dispatch(ActionRequest) / tick(dt) / projectPlayerView() 3개 경로 뿐이다.
    Projection 은 매번 새 Snapshot 을 생성해 반환한다.

## TESTS
    world/tests/mine.spec.ts    성공 / no-mining-tool / out-of-range / deposit-depleted /
                                available→depleted 전이 — 5 tests
    world/tests/move.spec.ts    MoveTarget 설정 / out-of-bounds / tick 도달·해제 /
                                이동으로 out-of-range→available 전이 — 4 tests
    실행: `npx vitest run` → 9 passed (2026-08-12)

## NOTES
    [Cycle Module 구조 — Human 피드백 반영]
    World 는 Cycle 별로 모듈화된다 — C001 의 Delta(광맥·곡괭이 setup,
    move/mine 핸들러, 이동 법칙, Projection 기여분)는 world/cycles/c001-stone-mining.ts
    의 CycleModule 하나로 배선되고 등록부(world/cycles/index.ts)에 등재된다.
    커널(world/index.ts)은 등록 순서대로 모듈을 조립하며,
    createWorld({ upToCycle }) 로 특정 Cycle 까지의 게임을 재생할 수 있다.
    실행 화면 우하단 Cycle 선택 UI · URL ?cycle=<CycleId> 로도 선택 가능.
    검증: world/tests/cycles.spec.ts (조립·재생·미조립 interaction 거부) — 18 passed.

    프로젝트 스캐폴드(package.json · tsconfig.json)는 이번 Cycle 에서 최초 도입.
    protocol/ 에 GameViewSnapshot · ActionRequest · SemanticIdentifier 경계 타입 추가.
    world/capabilities/ 는 이번 Cycle 에서 별도 파일이 필요 없어 만들지 않았다 —
    Mining Capability 는 Item.Kind 파생 의미로 world/semantic/item.ts 에 있다.
