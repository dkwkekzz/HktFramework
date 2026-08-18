# C009 — World Implementation

## IMPLEMENTED

    World.CommandCatalog (성질)          world/semantic/command-catalog.ts
        COMMAND_CATALOG                  걸 수 있는 명령의 정의 목록. 지금 항목은 하나다.
                                         State 가 아니라 모듈 상수 — 03 RATIONALE 1 을 코드로
                                         강제한다. Rule 을 거쳐야 바뀌는 값이 아니라
                                         애초에 바뀌지 않는 값이다.
        attributeDomain()                set-attribute 의 attribute 자리 Domain 을
                                         MUTABLE_ATTRIBUTES 에서 유도한다. 목록도 범위도
                                         여기서 다시 적지 않는다 — 두 곳에 적히면 어긋난다.
        projectCommandCatalog()          정의(성질)에 지금의 가용성(State 판정)을 얹어
                                         관찰되는 목록을 만든다.

    RULE-REQUEST-REPLY-001               world/rules/request-reply.ts
        Implements                       INTENT-REQUEST-REPLY-001 ·
                                         INTENT-REPLY-CORRESPONDENCE-001
        ruleRequestReply()               하나의 요청과 그 판정 결과를 대답으로 만든다.
                                         Transition 없음 — 상태를 건드리는 줄이 없다.
        groupOutcomesByObserver()        한 Tick 의 대답들을 요청한 이별로 모은다.
                                         순서는 판정 순서 그대로다.

    Request.Mark                         protocol/actions.ts (ActionRequest.mark)
        세계는 해석하지도 저장하지도 않는다 — 받은 그대로 대답에 되돌린다.

    Request.Outcome                      protocol/gameview.ts (RequestOutcomeView)
        accepted · rule · reason · mark. 03 OBSERVABLE SEMANTIC 그대로.

    Command 계약 타입                     protocol/gameview.ts
        CommandView · CommandParameterView · CommandDomainView ·
        CommandDomainOptionView · CommandDomainKind
        04 commandCatalog 를 그대로 옮긴다. 새 명령이 생겨도 이 구조는 바뀌지 않는다.

    대답 전송 봉투                        protocol/transport.ts (OutcomeMessage)
        세계 → 관찰자 방향에 관찰 결과 말고 다른 것이 처음 실린다.
        parseServerMessage 가 두 종류를 가른다.

## REUSED

    RULE-ATTRIBUTE-SET-001               world/rules/attribute-set.ts       한 줄도 바뀌지 않음
    evaluateAttributeSetAvailability     world/rules/attribute-set.ts       Command.Availability 판정
    MUTABLE_ATTRIBUTES                   world/semantic/combat.ts           허용 목록 단일 출처
    World.DebugAuthority                 world/semantic/world-state.ts      세계의 허용 여부
    Actor.Id                             world/semantic/actor.ts            지목 수단
    RULE-OBSERVER-* / 요청 귀속            world/rules/observer-*.ts          대답의 수신자 판정
    Collision / Attribute 관찰            C006 · C007 R2 그대로               건드리지 않음

## AFFECTED UPDATED

    RULE-WORLD-TICK-001                  world/simulation/world-tick.ts
        판정 순서도 판정 내용도 바뀌지 않았다. 이미 계산되어 `results` 에 담기던 것을
        요청한 이의 주소에 붙여 `outcomes` 로 함께 내보낸다.
        지금까지 `results` 는 "관찰자에게는 보내지 않는다 (진단·검증용)" 였다 —
        그 주석이 이번 Cycle 이 메우는 구멍의 정확한 위치였다.

    world/clock.ts                       ObservationSink 가 대답도 함께 받는다
    server/world-host.ts                 Link 에 onOutcomes 를 더한다. 대답이 관찰 결과보다
                                         먼저 나간다 — "그 요청이 어떻게 되었는가" 다음에
                                         "그래서 세계가 어떠한가" 가 와야 인과가 읽힌다.
                                         onOutcomes 는 선택이다 — 두지 않아도 세계는 돈다.
    server/attach.ts                     소켓으로 나가는 것이 둘이 된다

## PROJECTION

    world/projection/observer-view.ts
        debug.open                       그대로 (C007 R2)
        debug.mutableAttributes          제거 — 없어진 것이 아니라 자리를 옮겼다.
                                         이제 commands[set-attribute].parameters.attribute.domain
                                         이며 값도 뜻도 그대로다 (03 CHANGED).
        commands                         ADDED — 늘 실린다. available 이 거짓이어도 실린다.

    투영하지 않는 것: 없음. 이번 Cycle 의 Observable 은 밝히는 것 자체가 목적이다.

## TESTS

    world/tests/command.spec.ts          24항목 — 새로 작성
        INTENT-COMMAND-CATALOG-001       목록이 늘 실린다 · 뜻과 받는 것이 함께 온다 ·
                                         고른 속성이 값 범위를 정한다 · 허용 목록 단일 출처 ·
                                         권한이 닫혀도 목록은 보인다
        INTENT-REQUEST-REPLY-001         받아들임 · 거절+사유 · 범위 밖과 모르는 속성 구분 ·
                                         없는 대상 · 목록에 없는 명령 · 모르는 관찰자 ·
                                         세계 안의 행동도 같은 길 · 쌓아 두지 않는다 ·
                                         내 것만 온다
        INTENT-REPLY-CORRESPONDENCE-001  표식이 그대로 돌아온다 · 한 Tick 에 여럿이어도
                                         섞이지 않는다 · 붙이지 않으면 붙지 않는다
        INTENT-ENTITY-ADDRESSABLE-001    지목 없으면 자기 몸 · Actor.Id 로 지목 ·
                                         다른 관찰자의 몸도 지목된다
        회귀                             이동 속도를 올리면 실제로 더 멀리 간다 ·
                                         생명 0 → 쓰러지고 되돌리면 일어난다

    server/tests/world-host.spec.ts      +6항목
        대답이 그 이어짐으로 돌아온다 · 대답이 관찰 결과보다 먼저 나간다 ·
        남의 대답은 오지 않는다 · 요청 없던 Tick 에는 나가지 않는다 ·
        받을 자리를 두지 않아도 세계는 돈다 · 대답 봉투 왕복

    world/tests/combat.spec.ts           1항목 갱신 (C007 R2 의 mutableAttributes 검사를
                                         새 자리에서 같은 것을 확인하도록)

    world/tests/drive.ts                 dispatchForOutcome() 추가 —
                                         "세계 안의 판정" 이 아니라 "요청한 이에게 실제로 간 것" 을 본다

    전체                                 334 passed / 24 files (npx vitest run)
    타입                                 tsc --noEmit 통과

## NOTES

    이 Cycle 은 World State 를 하나도 더하지 않았다. 03 의 판정이 코드에서 그대로 성립한다 —
    world/semantic/world-state.ts 의 WorldState 인터페이스는 변경되지 않았다.

    없던 판정을 만들지 않았다. 각 Rule 은 지금까지도 사유를 담은 Result 를 내고 있었고
    받아 갈 곳이 없어 버려졌을 뿐이다. C007 R2 가 적은 "받아들여지지 않은 요청은 그 이유를
    남긴다" 와 "그 이유가 요청한 이에게 닿는다" 사이에 없던 길을 냈다.

    사유 코드 이름 하나 — 04 는 목록에 없는 명령의 사유를 `unknown-command` 로 적었으나
    실제로 나가는 코드는 기존 DISPATCH 의 `unknown-interaction` 이다. 뜻은 같다:
    "그런 것을 걸 수 없다". 명령과 세계 안의 행동이 같은 수용 경로를 지나므로 코드도 하나여야
    한다 — 두 이름을 두면 같은 판정이 어디로 왔느냐에 따라 다르게 불린다.
    새 코드를 만들지 않고 기존 것을 쓴다. 의미 변경이 아니라 이름 정합이며,
    07 의 문구 사전과 08 의 검증이 이 코드를 기준으로 한다.

    Command 와 Interaction 을 코드에서도 갈라 두었다. dispatch 는 둘을 같은 경로로 받지만
    (요청 형태가 하나이므로) 관찰되는 목록은 다르다 — interactions 는 몸이 세계 안에서
    하는 일이고 commands 는 세계 밖에서 손대는 일이다. 그래서 set-attribute 는 두 곳에
    모두 실린다: interactions 에는 가용성이, commands 에는 무엇을 받는지가 있다.

    새 명령을 더하는 일이 실제로 항목 하나인지 확인했다 — COMMAND_CATALOG 에 항목을
    더하는 것 말고 손댈 곳이 없다. projectCommandCatalog 의 availabilityOf 만
    그 명령의 가용성 판정을 알면 된다.
