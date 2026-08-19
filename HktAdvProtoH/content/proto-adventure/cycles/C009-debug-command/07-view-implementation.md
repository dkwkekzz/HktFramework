# C009 — View Implementation

표면의 형태는 `05-review.md` 의 검토자 지시를 따랐다 — **목록 우선 + 타이핑**.
열면 걸 수 있는 것 전부가 먼저 보이고, 그 상태에서 타이핑하면 후보가 좁혀진다.
아무것도 모르는 사람은 읽고 고르며, 아는 사람은 바로 친다.

## SPEC CONSUMED

    commandCatalog                          view/presentation/command-presentation.ts
        command.id / effect                 commandEntries() — effect 는 코드이며 문구는 여기서
        command.available / reason          걸 수 없어도 목록에서 사라지지 않는다
        parameters (ordered)                usageOf() — 필수는 <>, 선택은 []
        parameter.required / omittedMeaning slotOf()
        domain.kind entity                  지목할 수 있는 존재의 Id 를 실제로 보여 준다
        domain.kind choice + thenDomain     effectiveDomain() — 앞의 선택이 뒤 자리를 정한다
        domain.kind number (min/max)        domainHint() — "0 … 100"
        domain.kind from-previous-choice    value 자리는 자기 범위를 갖지 않는다

    requestOutcome                          view/net/world-link.ts · app/main.ts
        accepted / rule / reason            drainOutcomes() → 기록 줄에 붙는다
        mark                                sendMarked() 가 붙인 표식으로 짚는다
        scope: observer-own                 세계가 내 것만 보낸다 — View 는 거르지 않는다

    observerCommands                        view/presentation/command-presentation.ts
        collider-observe → debugObserve     C006 그대로. 성질은 변하지 않는다
        attribute-inspect → inspect         C007 R2 그대로
        worldKnows: false                   app/main.ts setObserverCommand() 은 link 를 부르지 않는다

    commandSurface                          view/hud/command-console.ts (capability)
        presents / origin                   세계=파랑, 내 화면=노랑 배지로 갈린다
        browse                              열면 목록이 먼저다 (list → guide → input 순서)
        guide.whileComposing                다음 자리 · 남은 자리의 범위 · 좁혀진 후보
        guide.onMistake                     걸기 전에 문제를 말한다. 자리에 든 값을 먼저 본다
        history                             관찰자가 쥔다 (app/main.ts commandHistory)
        inputCapture                        이동·시점·행동·화면 클릭이 모두 멈춘다
        designation                         entities.character.id 가 자리의 hint 로 보인다

    debugAuthority.open                     C007 R2 그대로 (지금은 Command.Availability 로 읽힌다)
    debugObserve / inspect                  C006 · C007 R2 그대로 — 다시 만들지 않았다

## ASSET MAPPING

    없음 — 이번 Cycle 은 새 존재도 새 상태도 더하지 않았다.
    그림·모션·스프라이트 등록에 변화가 없다.

    문구 등록만 늘었다 (view/presentation/code-text.ts):
        사유 코드 6종      unknown-interaction · unknown-observer · missing-* 4종
                           세계가 이제 이 사유들도 되돌려 주므로 문구가 필요해졌다
        명령 effect 3종    set-attribute · collider-observe · attribute-inspect
        자리 이름 3종      param:target · param:attribute · param:value
        비움 뜻 1종        omitted:self

## INPUT → ACTION REQUEST

    /                              명령 표면을 연다/닫는다 (관찰자 쪽 — 세계로 나가지 않는다)
    타이핑                         commandText — 매 글자마다 후보와 안내가 다시 계산된다
    Enter                          submitCommand()
        목록에 없는 것 · 덜 적음   걸지 않고 기록에 문제를 남긴다 (세계로 나가지 않는다)
        관찰자 쪽 명령             토글하고 "켰다/껐다" 를 기록에 남긴다
        세계 명령                  commandActionRequest() → link.sendMarked()
                                   기록 줄은 대답이 올 때까지 비어 있다
    Escape                         닫고 쓰던 것을 지운다

    set-attribute [target] <attribute> <value>
        → { interactionId: 'set-attribute', targetEntityId?, attribute: { id, value }, mark }
        값은 수치로 읽히면 수치로, 아니면 낱말 그대로 보낸다 (moveMode 는 낱말).
        허용 범위 판정은 세계가 한다 — View 는 먼저 알려 줄 뿐 막지 않는다.

    쓰는 동안 멈추는 것 (04 commandSurface.inputCapture)
        WASD / 방향키              몸이 움직이지 않는다
        Z X R T / 마우스 드래그     시점이 돌아가지 않는다
        화면 클릭                   이동·채굴 요청이 나가지 않는다
        E F G Shift C V            행동·토글 키가 먹지 않는다
        이미 진행 중인 행동         지금까지대로 끝까지 간다 — 세계는 내가 무엇을 쓰는지 모른다

## FIXTURE TESTS

    view/tests/fixtures/command.fixture.json   신규 — 세계가 밝힌 목록이 담긴 관찰 결과
    view/tests/command.spec.ts                 31항목 신규 (World 미기동)

        목록          두 출처가 한 목록 · origin 구분 · 뜻 문구 · usage 한 줄 ·
                      자리마다 범위 · 토글의 현재 상태 · 권한이 닫혀도 사라지지 않음 ·
                      세계가 밝히지 않은 것은 없음
        안내          빈 입력=전부 후보 · 이름 좁힘 · 없는 이름 · 다음 자리 ·
                      선택이 값 범위를 정함 · 자리 안 후보 좁힘 · 범위 밖 미리 알림 ·
                      없는 이름과 범위 밖의 구분 · 남은 낱말 · 토글은 이름만
        지목          비우면 내 몸 · Id 로 지목 · 없는 Id 는 대상으로 읽히지 않음
        요청 만들기   수치/낱말/대상 · 모르는 명령도 이름만 실어 보냄
        표면 전체     늘 만들어지되 기본 닫힘 · 열고 쓴 것이 반영 · 토글 상태 일치 ·
                      기록 · C006·C007 R2 관찰이 그대로

    전체            365 passed / 25 files (npx vitest run)
    타입·빌드        tsc --noEmit 통과 · npm run build 통과

## NOTES

    새 명령이 늘 때 View 에서 손댈 곳 — 정확히 한 곳이다.

        목록·안내·기록·입력 차단·표면   손댈 것 없음. 세계가 밝힌 것을 그대로 돈다
        문구                            code-text.ts 에 등록하면 한국어로, 안 하면 코드 그대로
        요청 형태                       command-request.ts 의 BUILDERS 에 한 줄

    마지막 하나가 남는 이유는 04 가 interaction 마다 요청 형태를 고정했기 때문이다
    (SetAttribute(TargetActorId?, AttributeId, Value)). 세계 쪽 dispatch 의 분기와
    짝을 이루는 자리이며, 등록되지 않은 명령도 이름만 실어 보내 세계가 "그런 명령이 없다"
    고 대답하게 두었으므로 게임이 멈추지는 않는다.
    ActionRequest 가 이름-값 묶음을 그대로 실어 나르면 이 한 줄도 사라진다 —
    다음 Cycle 의 후보로 08 에 남긴다.

    관찰 토글의 키(C · V)를 없애지 않았다. 04 는 "같은 것을 명령으로도 걸 수 있다" 를
    요구했지 "키를 없앤다" 를 요구하지 않았다. 키는 아는 사람의 지름길이고,
    목록은 처음 보는 사람의 길이다. 둘이 같은 상태를 가리키는지는 테스트가 지킨다
    (토글 상태가 목록에 실린다).

    조작 안내(우상단)의 첫 줄을 "명령: /" 로 두었다. 디버깅 요소가 늘어날 때마다
    외울 키가 늘던 것이 01 SURVEY 가 짚은 구멍이었다 — 이제 입구가 하나다.

    표면이 열려 있어도 세계는 계속 돈다. 명령을 쓰는 동안 화면 뒤의 세계가 멈추지
    않는 것은 C003 그대로이며, 이번 Cycle 이 시간 조작을 EXCLUDED 로 둔 이유이기도 하다.
