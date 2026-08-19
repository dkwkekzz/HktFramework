# C011 — View Implementation

> 새 capability 를 만들지 않았다. 결정 Layer 에 항목을 더하고, 이미 있는 표시 자리
> 세 곳(자기 표시 · 타격 숫자 · 속성 펼침)에 실리는 것을 늘렸다.
> 손가락 버튼은 코드를 한 줄도 건드리지 않았는데 생겼다 — 아래 NOTES 참조.

## SPEC CONSUMED

    interactions.guardBegin              view/presentation/interaction-presentation.ts
        role guard-begin → 키 Q · 문구 "막기"
    interactions.guardRelease            view/presentation/interaction-presentation.ts
        role guard-release → 키 없음 (조립 루트가 한 키로 오간다 — INPUT 참조)
    interactions.*.unavailableReason     view/presentation/code-text.ts
        guarding → "막는 중에는 휘두를 수 없다"
        guard-broken → "방어가 무너져 아직 다시 들 수 없다"
    hud.self.guard                       view/presentation/combat-presentation.ts  selfPanel
        → SceneSelf.guard { guarding · broken · text }
    entities.character.attributes.guard  view/presentation/combat-presentation.ts  inspectLines
        → "막기 막는 중 | 무너짐 | 없음"
    strikeEvents.breakdown.guard         view/presentation/combat-presentation.ts  strikeMark
        → SceneStrike.detail + SceneStrike.guard ('blocked' | 'broken')
    strikeEvents.breakdown.appliedDamage  같은 자리 — 타격 숫자의 기준이 이 값이다

    Scene 타입 확장                      view/scene/scene-state.ts
        SceneSelf.guard · SceneStrike.guard · SceneStrike.detail 주석 갱신
    capability 표시                      view/hud/hud.ts
        data-guard 속성과 self-stance 자리를 낸다 (문구·의미는 모른다)
    스타일                               index.html
        막힘은 푸르게 · 무너짐은 붉고 크게 · 자기 표시의 막기 자리

## ASSET MAPPING

    없음 — 새 role 도 새 kind 도 생기지 않았다.
    막기는 몸의 상태이지 새로운 존재가 아니므로 그림이 필요하지 않다.
    막는 자세의 그림(모션)은 이 Cycle 의 범위가 아니다 — 세계는 이미
    state 와 별개로 막는지를 보내고 있으므로, 모션이 붙는 날 그 값을 읽으면 된다.

## INPUT → ACTION REQUEST

    Q 누름 → 지금 막고 있으면  { interactionId: 'guard-release' }
             막고 있지 않으면  { interactionId: 'guard-begin' }

    세계에는 걸기와 놓기가 **따로** 있다 (명시값 — 같은 요청이 두 번 와도 결과가 같다).
    화면에서는 한 키로 오간다. 어떤 손짓으로 그 둘을 부를지는 View 의 결정이며,
    이동 모드(Shift)가 이미 같은 모양이다 — 세계가 지금 무엇이라고 알려 주었는지를 보고
    반대를 요청한다.

    View 는 걸 수 있는지를 스스로 판정하지 않는다.
    무너진 동안에도 요청은 그대로 나가고, 세계가 사유(guard-broken)와 함께 거절한다.
    그 사유가 화면에 뜬다.

    손가락 버튼 — view/hud/touch-pad.ts 를 수정하지 않았다 (아래 NOTES).

## FIXTURE TESTS

    view/tests/guard.spec.ts             15 tests — 전부 통과 (World 미기동)
        hud.self.guard        3  막는 중 · 무너짐 · 아무것도 아닐 때는 빈 자리를 만들지 않는다
        interactions          4  키·문구 · 놓기엔 키 없음 · 무너짐 사유 · 스킬 거절 사유
        strikeEvents.guard    5  막힘(관찰 꺼져 있어도 보임) · 17→9 · 무너짐 · 막지 않은 타격 ·
                                 관찰 켜면 경위가 뒤에 붙는다
        entities.attributes   3  막는 중 · 없음 · 행동 표시로 대신할 수 없다

    view/tests/fixtures/guard.fixture.json         막고 있고 막힌·무너진 타격이 함께 떠 있다
    view/tests/fixtures/guard-broken.fixture.json  무너져 아직 다시 들지 못하는 순간

    기존 fixture 갱신 (계약이 늘어난 만큼)
        combat.fixture.json · command.fixture.json
            entities[].attributes.guard · strikes[].breakdown.appliedDamage ·
            hud[self.guard.*] 추가

    전체                                 452 / 453 통과
        실패 1건 — view/tests/motion-atlas.spec.ts 의 sprite 여백 검출.
        이 Cycle 의 변경과 무관하며 작업 전 상태(origin/main)에서도 같은 항목이 실패한다.
        스프라이트 격자 판정 문제이므로 여기서 손대지 않았다.

    npx tsc --noEmit                     오류 없음
    npx vite build                       성공

## NOTES

    손가락 버튼이 저절로 생겼다
        touch-pad 는 "키와 문구가 붙은 interaction" 을 그대로 버튼으로 편다.
        세계가 guard-begin 을 목록에 실었고 결정 Layer 가 키와 문구를 붙였으므로
        버튼이 코드 변경 없이 나타났다.
        DC-WORLD-OWNS-THE-SURFACE-LIST 가 이번에도 값을 했다 —
        C010 이 명령 목록에서 보여준 것과 같은 일이 이번에는 interaction 쪽에서 일어났다.

    놓기에 키를 두지 않은 이유
        guard-begin 과 guard-release 양쪽에 같은 키를 두면 keyed 필터에 둘 다 걸려
        어느 쪽이 나갈지 available 순서가 정하게 된다. 그것은 표현이 아니라 우연이다.
        키는 걸기 쪽에만 두고, 오가는 판단은 조립 루트가 명시적으로 한다.

    막기 줄을 관찰 토글에 걸지 않은 이유
        C010 의 계산 경위는 관찰을 켰을 때만 붙는다 — 늘 띄우면 피해 숫자를 가린다.
        막기는 그렇게 두지 않았다. 막았다는 사실과 치른 기력이 그 자리에서 읽히지 않으면
        화면에는 그냥 작아진 숫자만 남고, 맞바꿨다는 것이 플레이어에게 일어나지 않는다
        (04 strikeEvents.meaning). 두 줄은 함께 붙을 수 있고 막기 줄이 앞에 온다.

    막기 상태를 행동 표시로 대신하지 않았다
        막으며 걷는 존재는 state 가 move 이면서 막고 있다.
        state 를 읽어서 막기를 그리면 걸을 때마다 막기가 사라진 것처럼 보인다.
        그래서 자기 표시와 속성 펼침 모두 attributes.guard 를 읽는다.
