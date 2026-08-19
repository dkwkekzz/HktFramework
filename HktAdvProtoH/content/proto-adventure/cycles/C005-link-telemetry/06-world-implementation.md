# CYCLE C005 — World Implementation

세계가 이번 Cycle 에서 새로 갖는 것은 State 하나와 Rule 하나뿐이다.
나머지 5개 Intent 는 관찰자 쪽 의미이므로 여기 없다 (Stage 7 의 일이다).

## IMPLEMENTED
    Observer.AcknowledgedMark                 world/semantic/observer.ts        [ADDED]
        이 관찰자에게서 받아들인 마지막 표식. 참여 시 0 에서 시작한다.

    RULE-OBSERVER-MARK-001                    world/rules/observer-mark.ts      [ADDED]
        Preconditions  아는 관찰자 · 유한한 수 · 지금까지보다 큰 값
        Transition     Observer.AcknowledgedMark = 표식
        Result         Success | Failure(unknown-observer) | Failure(stale-mark)
        게임 상태를 바꾸지 않고 어떤 행동 Rule 에도 위임하지 않는다.

## CHANGED
    RULE-WORLD-TICK-001                       world/simulation/world-tick.ts
        PendingObserverEvent 에 kind = 'mark' + mark 값이 추가되고,
        Transition 0 이 join · leave · mark 를 도착 순서대로 처리한다.
        표식이 요청보다 앞서 처리되어도 되는 이유를 주석으로 남겼다 —
        관찰자가 언제나 요청을 보낸 뒤 표식을 붙이므로 같은 Tick 안에서
        그 요청도 함께 판정된다.

    RULE-OBSERVER-JOIN-001                    world/rules/observer-join.ts
        첫 참여    acknowledgedMark: 0 으로 Observer 를 만든다
        재참여     acknowledgedMark 를 되돌리지 않는다 (Present 만 true 로)

    Observer Projection                       world/projection/observer-view.ts
        observer 절에 acknowledgedMark 가 실린다. 그 관찰자의 것만 실린다.
        SPEC_ID: VIEW-MULTI-OBSERVER-001 → VIEW-LINK-TELEMETRY-001

    World 경계                                 world/index.ts
        mark(observerId, mark) 추가. 요청 큐가 아니라 참여/이탈과 같은 줄에 들어간다 —
        표식은 Action Request 가 아니기 때문이다.

    World Host                                 server/world-host.ts
        receiveMark(observerId, mark) 추가

    WebSocket 부착                             server/attach.ts
        mark 봉투를 받으면 host.receiveMark 로 보낸다.
        밝히기 전(join 이전)의 표식은 세계에 도착하지 않는다 — 요청과 같은 규율이다.

    protocol/gameview.ts
        ObserverView.acknowledgedMark: number                          [ADDED]

    protocol/transport.ts
        MarkMessage{type:'mark', mark}                                 [ADDED]
        ClientMessage = ActionMessage | JoinMessage | MarkMessage
        parseClientMessage 가 mark 를 받는다 (유한한 수가 아니면 무시)

    protocol/semantic-id.ts
        RULE_OBSERVER_MARK · INTENT_OBSERVER_MARK · INTENT_LINK_* 5종

## REUSED
    Observer.Id · ActorId · Present            world/semantic/observer.ts (변경 없음)
    모든 게임 Rule                              판정 코드는 한 줄도 바뀌지 않았다
    Observer 조회 helper                       findObserver (C004)

## AFFECTED UPDATED
    없음.
    03-world-semantic.md 이 AFFECTED 를 "없음" 으로 판정했고 구현에서도 그대로였다 —
    표식은 어떤 Rule 의 Precondition 도 Transition 도 건드리지 않는다.
    테스트로 확인했다 (아래 "표식은 게임을 바꾸지 않는다").

## PROJECTION
    observer.acknowledgedMark                  world/projection/observer-view.ts
    04-gameview.spec.yaml 의 observer 절과 일치한다.
    투영하지 않기로 한 것은 Snapshot 어디에도 없다 —
    다른 관찰자의 표식 · 표식 실패 사유 · 세계가 표식을 받은 시각.

## TESTS
    world/tests/observer-mark.spec.ts   14건 [ADDED]
        받아들인 자리   참여 직후 0 / 보내면 되돌아온다 / 표식은 다음 Tick 에 받아들여진다
        뒤로 가지 않음  옛 표식 stale-mark / 같은 표식 재전송도 stale-mark /
                        NaN·Infinity 거부
        귀속            모르는 관찰자의 표식은 무효 / 한 Tick 에 여러 개면 마지막까지
        게임 불변       몸·광맥·세계 시간이 표식 20회에도 그대로 /
                        요청 판정 목록이 비어 있다 (dispatch 미호출)
        관찰자별        내 표식만 내 관찰 결과에 / 남의 것을 건드리지 않는다
        인과의 왕복     요청 뒤 붙인 표식은 그 요청의 결과와 같은 관찰 결과로 돌아온다
        재참여          떠났다 돌아와도 받아들인 자리가 이어진다 / 이어서 매긴다

    server/tests/world-host.spec.ts     16건 (C005 3건 추가)
        표식이 WorldHost 를 거쳐 관찰 결과로 돌아온다
        표식이 다른 관찰자의 관찰 결과를 건드리지 않는다
        표식 봉투 파싱 + 망가진 표식 봉투 거부

    world/tests/drive.ts                [CHANGED] mark(value, observerId?) 추가

    실행 결과   world 86건 + server 16건 = 102건 통과 (View 없이 실측)

## NOTES
    설계대로 구현이 작았다. World 쪽 변경 총량은 State 1줄 · Rule 1개 ·
    Tick 분기 1줄 · Projection 1필드다.

    구현 중 판단한 것 하나 — 표식을 요청 큐(pending)가 아니라 참여/이탈 큐
    (pendingObservers)에 넣었다. 03-world-semantic.md 가 표식을 Transition 0 에
    두었기 때문이며, 그래야 "요청을 보낸 뒤 붙인 표식"이 같은 Tick 에서
    함께 처리된다. 요청 큐에 넣었다면 표식이 Action Request 인 척하게 되어
    "표식은 게임 요청이 아니다"(INTENT-OBSERVER-MARK-001)와 어긋난다.

    View 는 아직 표식을 보내지 않는다 — Stage 7 의 일이다.
