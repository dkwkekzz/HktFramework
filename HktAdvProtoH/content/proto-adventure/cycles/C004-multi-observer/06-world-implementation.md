# CYCLE C004 — World Implementation

## IMPLEMENTED
    Observer (Id · ActorId · Present)         world/semantic/observer.ts            [ADDED]
    World.Observers                           world/semantic/world-state.ts         [ADDED]
    World.SpawnPoints                         world/semantic/world-state.ts         [ADDED]
    Observer.Id 한계 길이                     world/semantic/observer.ts            [ADDED]
        MAX_OBSERVER_ID_LENGTH = 64

    RULE-OBSERVER-JOIN-001                    world/rules/observer-join.ts          [ADDED]
        Precondition   evaluateObserverIdentity — 비어 있지 않고 한계 이내
        재참여          Present = true, 몸을 만들지 않는다
        첫 참여          새 몸 생성 → World.Actors, Observer → World.Observers
        Actor.Id        `player-${순번}` — 세계가 정한다.
                        관찰자가 밝힌 Id 를 몸의 이름에 섞지 않는다.
        Spawn 자리      SPAWN_POINTS[순번 % 개수] — 같은 순서면 같은 배치 (결정론)

    RULE-OBSERVER-LEAVE-001                   world/rules/observer-leave.ts         [ADDED]
        Present = false. 몸도 진행 중인 행동도 건드리지 않는다.

    Observer 조회 · 판정 helper                world/semantic/world-state.ts         [ADDED]
        findObserver · actorOfObserver · isAttended · presentObserverCount

## CHANGED
    RULE-WORLD-TICK-001                       world/simulation/world-tick.ts
        Transition 0 (참여/이탈) 추가 — 요청 처리보다 앞선다
        요청은 PendingRequest{observerId, action} 로 도착한다
        Result: snapshot 하나 → observations: Map<observerId, GameViewSnapshot>
        떠난 관찰자에게는 투영을 만들지 않는다

    Observer Projection                       world/projection/observer-view.ts
        (파일 이름 변경: player-view.ts → observer-view.ts — git mv 로 이력 보존)
        projectPlayerView(state) → projectObserverView(state, observerId)
        관찰자를 모르면 null — 세계는 모르는 이에게 자신을 보여주지 않는다
        SPEC_ID: VIEW-WORLD-SERVER-001 → VIEW-MULTI-OBSERVER-001

    Action Request 주체 결정                   world/actions/dispatch.ts
        playerActor(state) → actorOfObserver(state, observerId)
        모르는 관찰자 → failure(unknown-observer). 어떤 Rule 에도 위임하지 않는다.

    World 경계                                 world/index.ts
        join(observerId) · leave(observerId) 추가
        request(action) → request(observerId, action)
        latestObservation() → latestObservation(observerId): Snapshot | null
        세계 생성 시 조종되는 몸을 만들지 않는다 — Actors 는 자율 존재들뿐이다
        WorldSetup.actorPosition/actorItems/actorCharacterKind 는
        "관찰자의 몸이 처음 만들어질 때의 기본값"(BodyDefaults)이 되었다.
        actorPosition 은 SPAWN_POINTS[0] 를 대신한다 (검증용 초기 배치).

    World Clock                                world/clock.ts
        ObservationSink — 한 Tick 이 내보내는 것이 관찰 결과 하나에서
        관찰자마다의 관찰 결과로 바뀌었다

    World Host                                 server/world-host.ts
        attach(observerId, observer, onEvicted?) — 밝히지 않으면 붙을 수 없다
        붙는 즉시 관찰 결과를 주지 않는다 — 세계가 참여를 판정한 다음 Tick 에 간다
        같은 Id 로 다시 붙으면 먼저 있던 이어짐에 onEvicted 를 알리고 교체한다
        detach 는 자신이 아직 그 Id 의 이어짐일 때만 world.leave 를 부른다
        receive(observerId, action)

    WebSocket 부착                             server/attach.ts
        소켓이 열려도 관찰자가 아니다 — join 메시지로 밝힌 뒤부터 요청이 도착한다
        밝히기 전의 요청은 버려진다. 이어짐당 한 번만 밝힌다.
        밀려난 이어짐(onEvicted)은 소켓을 닫는다

    protocol/gameview.ts
        GameViewSnapshot.observer: ObserverView{id, characterId}   [ADDED]
        EntityView.attended?: boolean                              [ADDED]

    protocol/transport.ts
        JoinMessage{type:'join', observerId}                       [ADDED]
        ClientMessage = ActionMessage | JoinMessage
        parseClientMessage 가 join 을 받는다
        ActionRequest 는 그대로다 — 주체를 적는 자리를 만들지 않았다

    protocol/semantic-id.ts
        RULE_OBSERVER_JOIN · RULE_OBSERVER_LEAVE · RULE_WORLD_TICK
        INTENT_* 7종 (C003 의 INTENT_WORLD_CLOCK 포함)

## REUSED
    Actor 의 모든 State                        world/semantic/actor.ts (변경 없음)
    RULE-MOVE-001 · RULE-MINE-001 · RULE-ATTACK-001 · RULE-ACTION-BEGIN-001 ·
    RULE-MOVE-PROGRESS-001 · RULE-ACTION-PROGRESS-001 · RULE-NPC-DECIDE-001
        판정 코드는 한 줄도 바뀌지 않았다.

## AFFECTED UPDATED
    RULE-NPC-DECIDE-001                        world/simulation/npc-decide.ts
        코드 변경 없음. perceivedTarget 이 이미 "다른 모든 Actor" 중에서 고르므로
        조종되는 몸이 여럿이면 그 중 가장 가까운 것을 고른다.
        보는 이가 없는 몸도 세계에 있는 몸이므로 인지 대상이 된다.
        (테스트로 확인: 무인 몸이 스스로 행동을 시작하지 않는다 —
         Control 이 player 그대로라 ruleNpcDecideAll 의 대상이 아니다)

## PROJECTION
    observer.self                    world/projection/observer-view.ts
    role 3종 (내 몸 / 다른 관찰자의 몸 / 자율 존재)
    attended (other-player-character 에만)
    hud observers.present
    hud inventory·tool·player.action  → 관찰자 자신의 몸 기준
    interactions move·attack·mine     → 관찰자 자신의 몸 기준

    04-gameview.spec.yaml 대비 누락 없음. 투영하지 않기로 한 것(다른 관찰자의 Id ·
    참여 실패 사유 · World.TickInterval)은 Snapshot 어디에도 없다.

## TESTS
    world/tests/observer.spec.ts      26건 [ADDED]
        JOIN     관찰자 없는 세계에 조종되는 몸이 없다 / 들어오면 몸이 생긴다 /
                 참여는 다음 Tick 이 판정한다 / 둘이면 몸도 둘 · 다른 자리 /
                 두 번 들어와도 몸이 늘지 않는다
        IDENTITY 밝힐 수 있으면 인정된다 / 빈 밝힘·너무 긴 밝힘 거부 /
                 다른 밝힘은 다른 관찰자
        PROJECTION 같은 몸이 보는 이에 따라 내 몸이거나 남의 몸 /
                 세계의 사실은 모두에게 같다 / 소지품은 내 것만 /
                 가용성도 내 몸 기준 / 함께 보는 수
        ATTRIBUTION 내 요청은 내 몸을 / 남의 몸을 적어도 안 움직인다 /
                 모르는 관찰자의 요청은 무효
        LEAVE    몸이 그 자리에 남는다 / attended 로 관찰된다 /
                 내 몸·자율 존재에는 attended 없음 / 하던 행동은 끝까지 진행 /
                 스스로 새 행동을 시작하지 않는다 / 떠난 이에게 투영 없음 /
                 모르는 이의 이탈은 실패
        REJOIN   같은 몸·가진 것·자리를 되찾는다 / 몸이 늘지 않는다 /
                 끊긴 동안 흐른 세계가 한 번에 보인다

    world/tests/world-tick.spec.ts     9건 [CHANGED] — 관찰자 하나를 들여보낸 뒤 시작.
                                       "모르는 관찰자에게는 관찰 결과가 없다" 1건 추가.
    world/tests/drive.ts               [CHANGED] 관찰자 하나를 들여보내고 시작.
                                       OBSERVER · PLAYER · OBSERVER_2 · PLAYER_2 를 노출.
    action/attack/mine/move/npc.spec   [CHANGED] 몸의 이름 'player' → PLAYER('player-1').
                                       판정 내용은 그대로.
    server/tests/world-host.spec.ts   13건 [CHANGED] 밝히고 붙기 · 관찰자별 관찰 결과 ·
                                       다른 관찰자의 몸 · 재참여 · 이어짐 교체 · 무인 몸 ·
                                       join 봉투

    실행 결과   world 72건 + server 13건 통과 (View 없이 실측)

## NOTES
    Regression 중 드러난 의미 변화 2건 — 지어낸 것이 아니라 C004 의 결과다.
        (1) "세계가 시작되면 모든 Actor 는 대기 행동이다" (C002)
            관찰 결과는 관찰자가 들어온 Tick 에 만들어지고, 그 Tick 에서 이미
            RULE-NPC-DECIDE-001 이 돈다. 이전에는 Tick 없이 만들어진 초기 Snapshot 이
            있었지만 이제 그런 것이 없다 — 볼 사람이 없으면 관찰 결과도 없기 때문이다.
            시험은 스스로 갈 곳도 인지할 대상도 없는 자율 존재로 같은 의미를 확인한다.
        (2) npc.spec "플레이어 입력 없이 행동이 시작된다"
            첫 관찰 결과부터 NPC 가 자기 행동 안에 있다. 의미는 오히려 더 직접적으로
            드러나므로 단언을 그렇게 바꿨다.

    구현 중 판단한 것 하나 — 이어짐 교체의 경계.
        같은 관찰자로 다시 붙으면 먼저 있던 이어짐이 떨어져야 한다
        (INTENT-OBSERVER-REJOIN-001). 이것은 세계의 판정이 아니라 이어짐을 쥔 쪽의
        일이므로 World Rule 이 아니라 WorldHost 가 수행한다. Rule 은 Present = true 만
        한다. 밀려난 이어짐이 뒤늦게 detach 해도 새 이어짐을 끊지 않도록
        "자신이 아직 그 Id 의 이어짐일 때만 leave" 하게 했다 (테스트로 확인).

    View 는 아직 새 계약을 소비하지 않는다 — Stage 7 의 일이다.
    현재 `npx tsc --noEmit` 은 view/tests 의 fixture 2건에서 observer 누락으로 실패한다.
