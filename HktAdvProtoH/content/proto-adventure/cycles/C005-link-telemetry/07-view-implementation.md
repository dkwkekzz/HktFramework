# CYCLE C005 — View Implementation

계약은 `04-gameview.spec.yaml` (VIEW-LINK-TELEMETRY-001) 하나다.
`world/` 도 `03-world-semantic.md` 도 읽지 않았다.

이번 Cycle 은 View 쪽이 무겁다 — 세계에서 오는 값은 하나뿐이고
수치 5종은 전부 여기서 관찰자 자신의 시계로 만들어진다.

## SPEC CONSUMED
    marking                               view/net/world-link.ts               [ADDED]
        value: monotonic                  nextMark 를 1 부터 올린다. 되돌리지 않는다.
        resetOn: never                    다시 이어도 이어서 매긴다 (세계도 되돌리지 않는다)
        sentWith: after-action            send() 가 요청을 보낸 직후 표식을 붙인다
        sentWith: on-interval             poll() 이 MARK_INTERVAL_MS(500ms)마다 보낸다 —
                                          게임 요청이 없어도 잴 수 있어야 한다
        notAGameRequest                   {type:'mark'} 봉투로 나간다. ActionRequest 가 아니다.
        끊긴 동안에는 표식도 나가지 않는다 (요청과 같은 규율)

    observer.acknowledgedMark             view/net/link-telemetry.ts           [ADDED]
        관찰 결과가 올 때마다 recordObservation 으로 왕복을 닫는다.

    telemetry (5종)                       view/net/link-telemetry.ts           [ADDED]
        roundTripMs                       보낸 시각 ↔ 받아들여져 돌아온 시각.
                                          여러 표식이 한 번에 답해지면 가장 나중 것으로 닫는다.
        arrivalRatePerSecond              2초 창(ARRIVAL_WINDOW_MS)의 도착 수 / 창 길이.
                                          끊기면 창이 비어 0 으로 내려간다.
        sinceLastObservationMs            마지막 도착 이후 흐른 시간
        sentCount                         join · 요청 · 표식 전부 센다
        reconnectCount                    처음 붙는 것은 세지 않는다 (everConnected)

    binding                               view/presentation/link-presentation.ts [ADDED]
        observerId · characterId          관찰 결과에서 온다 (C004 가 이미 주던 값)
        worldAddress                      createWorldLink 에 주소를 넘겨 link.address() 로

    session.visibility: always            view/presentation/session-presentation.ts [CHANGED]
                                          view/hud/hud.ts · index.html
        SessionPresentation 에 telemetry · binding 줄이 실린다.
        이어짐 패널은 connected 일 때도 그려진다 — 이전에는 정상이면 아무것도 없었다.

    session.whileDisconnected.telemetry: frozen-with-age
        왕복 값은 마지막으로 잰 값 그대로 남고, 도착률은 0 으로 내려가며,
        마지막 도착 이후 시간은 계속 는다. 패널 배경이 붉어진다.

## ASSET MAPPING
    없음. 새 sprite 도 모션도 추가하지 않았다.
    이어짐 패널은 HUD 요소이며 index.html 의 CSS 로만 표현된다.

## INPUT → ACTION REQUEST
    변경 없음. WASD → move · 클릭 → move/mine · E → mine · F → attack.
    달라진 것은 요청이 나간 직후 표식이 한 개 따라 나간다는 것뿐이고,
    표식은 게임을 아무것도 바꾸지 않는다.

## FIXTURE TESTS (World 미기동)
    view/tests/link-telemetry.spec.ts     16건 [ADDED]
        왕복      아직 없으면 null / 돌아오면 그 시간 / 아직 안 받아들여졌으면 null /
                  여러 개면 가장 나중 것으로 / 다음 표식으로 갱신
        흐름      도착 없으면 0 / 창 안의 수로 초당 건수 / 끊기면 0 으로 /
                  마지막 이후 시간이 는다
        내 이력   보낸 수 / 다시 이은 수
        표현      값이 없어도 줄은 있다(언제나 보인다) / 왕복 등급 3단 /
                  도착률 등급 / 재연결 강조 / 신원 세 줄

    view/tests/world-link.spec.ts         18건 (C005 7건 추가)
        조용해도 간격마다 표식이 나간다 / 표식은 커지기만 한다 /
        받아들여진 표식이 돌아오면 왕복이 잡힌다 / 아직이면 비어 있다 /
        다시 이은 횟수(처음은 세지 않는다) / 끊긴 동안 표식도 안 나간다 /
        세계 주소를 알려준다
        기존 C003·C004 11건은 "요청 뒤에 표식이 따라붙는다"만 반영하고 그대로 통과

    view/tests/fixtures/*.json            [CHANGED] observer.acknowledgedMark 추가 (5종)

    실행 결과   view 65건 통과. 전체 167건 통과.
    타입 검사   npx tsc --noEmit 통과
    빌드        vite build 성공

## NOTES
    Capability Layer 를 이번에는 한 곳 건드렸다 — view/hud/hud.ts.
    이어짐 패널이라는 새 표시 자리를 만들어야 했기 때문이며, Guide 가 허용하는
    "표현이 고도화될 때의 capability 추가" 에 해당한다. 그 코드는 여전히 의미를 모른다 —
    결정 Layer(link-presentation.ts)가 만든 {label, value, grade} 줄을 그대로 그릴 뿐이다.
    기존 위젯(counter/flag/label)·프롬프트·토스트·라벨 코드는 수정하지 않았다.

    판단한 것 하나 — 왕복 측정을 world-link 안에 두었다.
    보내는 쪽과 받는 쪽을 동시에 보는 자리가 거기뿐이기 때문이다. 다만 재는 일 자체는
    순수 누산기(link-telemetry.ts)로 떼어 내 시계를 주입받게 했다 —
    덕분에 소켓 없이 16건을 검증할 수 있다.

    등급 경계(왕복 120/350ms · 도착률 20/8 per second)는 표현 결정이므로
    link-presentation.ts 에 두었다. 세계의 값이 아니다.
