# C014 — View Implementation

> View 가 이번에 배운 것은 새 값이 아니라 **없음**이다. C007 R2 이래 이 계약의 성질은
> "모든 것이 언제나 실린다" 였고, 그래서 이 결정 Layer 에는 자리가 비어 있을 수 있다는
> 개념이 없었다. 이번에 더한 것은 그 하나다 —
> **비어 있으면 비어 있다고 그리고, 없는 값을 만들어 넣지 않는다.**
>
> 가장 조심한 지점은 표시의 기본값이다. 겨루는 힘은 속성 관찰(`attribute-inspect`)을
> 켜야 보이므로, 모름을 그 안에만 두면 **켜지 않은 플레이어는 자기가 무엇을 모르는지
> 모른다.** 그래서 몸 위 이름에 물음표를 붙였다 — 켜지 않아도 읽힌다.

## SPEC CONSUMED

    entities.character.attributes.acquainted
        → view/combat-presentation.ts  nameplate()
          모르는 존재의 이름 뒤에 ` ?` 를 붙인다. 어떤 표시로 그릴지는 View 의 결정이며
          세계가 보낸 것은 acquainted 뿐이다
    entities.character.attributes.concealed
        → view/combat-presentation.ts  contestedLines()
          가려진 항목의 **이름 목록**을 그대로 읽어 한 줄로 옮긴다.
          "가려질 수 있는 것은 이 셋" 을 이 코드에 적지 않는다
    entities.character.attributes.unacquaintedReason
        → 같은 줄의 뒷부분. `not-observed` → "아직 살펴보지 않았다"
    entities.character.attributes.combatStats · versusObserver · defenseShape
        → contestedLines() 의 아는 존재 분기. **C012·C013 의 줄 그대로다** —
          문구도 자리도 바꾸지 않았다 (아래 LINE ORDER NOTE)
    interactions.observe (존재마다)
        → view/interaction-presentation.ts  'observe-character'
          prompt "살펴보기" · 키 없음. 대상 지목은 계약의 targetEntityId 가 나른다
        → 사유 넷의 문구: view/code-text.ts
    interactions.forgetAcquaintance
        → view/interaction-presentation.ts  'debug-forget-acquaintance' (표시 없음)
        → view/command-request.ts  'forget-acquaintance' 요청 조립
    commands[forget-acquaintance]
        → 명령 목록·안내·기록 표면은 그대로다. 항목이 하나 늘 뿐이다
    hud.playerAction
        → 무변경. `observe` 행동 코드의 문구만 code-text 에 더했다
    strikeEvents · hud.self · vitality
        → 무변경 (가려지지 않는다)

## ASSET MAPPING

    새 자산이 없다. 살펴봄 전용 모션 시트를 만들지 않았다 (01 EXCLUDED) —
    `motions/<kind>/observe.*.png` 가 없으므로 기존 fallback 으로 그려진다
    (motion-source.ts: "파일을 지우면 그 모션은 사라지고 fallback 으로 관찰된다").
    살펴봄이 진행 중인지는 hud.playerAction 의 진행도가 읽어 준다.

## INPUT → ACTION REQUEST

    그 몸을 클릭      → Observe(targetEntityId)
        엔진 입력은 클릭한 존재의 id 와 같은 targetEntityId 를 지닌 interaction 을
        찾아 보낸다 (engine/view-kernel/input/input.ts — 무변경).
        C014 이전에는 존재를 눌러도 맞는 interaction 이 없어 그대로 지나갔고
        땅 클릭(이동)으로 떨어졌다. 이제 존재를 누르면 살펴봄이 나간다.
        **이 변화는 의도한 것이다** — 캐릭터 스프라이트 위를 눌러 그 자리로 걸어가는
        조작은 사라진다. 몸을 누르는 손짓의 뜻이 "저것을 알아본다" 가 되는 쪽이
        이 Cycle 의 플레이에 맞고, 이동은 땅을 누르는 손짓으로 이미 충분하다.
        이미 아는 존재를 눌러도 요청은 나가고 세계가 `already-known` 으로 대답한다 —
        View 가 미리 걸러내지 않는다 (판정은 세계의 것이다).

    명령 한 줄        → ForgetAcquaintance(targetEntityId?)
        `forget-acquaintance npc-1` 또는 `forget-acquaintance` (알고 있는 전부).
        무엇을 쓸 수 있는지는 세계가 실은 목록이 안내한다 (C009 표면 그대로).

    키를 두지 않은 이유
        살펴봄은 대상이 있는 행동이고, 키에는 대상을 고를 수단이 없다.
        "가장 가까운 하나" 같은 규칙을 여기서 만들면 **세계가 정하지 않은 선택 규칙을
        화면이 발명**하게 된다 (Must Not — Spec 에 없는 게임 의미를 만들지 않는다).
        대상 선택이라는 의미가 필요해지면 그것은 계약이 열어야 한다.

## FIXTURE TESTS

    view/tests/fixtures/observe.fixture.json   신설
        실제 세계가 내보낸 관찰 결과를 그대로 받아 적었다 (손으로 쓰지 않았다).
        npc-1 은 살펴본 존재 · npc-2 는 모르는 존재 · player-1 은 내 몸 —
        한 화면에 세 상태가 함께 있다.

    view/tests/observe.spec.ts                 15 tests 신설

        몸 위 표시
            모르는 존재는 `Wanderer 2 ?` · 아는 존재와 내 몸은 이름 그대로
            생명은 가려지지 않는다 (120/120 이 그대로 읽힌다)
        속성 관찰
            아는 존재는 C012·C013 그대로 — `물리 공격 40 · 물리 방어 30 (받는 피해 77%)` ·
            `오라 … → 나에게 56.25 (64%)` · `약점 물리에 약하다`
            모르는 존재는 그 자리에
            `겨루는 힘 · 나에게 읽히는 방어 · 약점 — 아직 살펴보지 않았다`
            **없는 값을 만들어 넣지 않는다** — 값이 한 개도 나오지 않는 것을 확인한다
            모르는 존재도 기력·이동·막기는 그대로 펼쳐진다
            concealed 를 `['defenseShape']` 하나로 바꾸면 문구도 그 하나만 된다 —
            목록이 세계의 것이라는 증거다 (View 를 고치지 않았다)
        interactions.observe
            모르는 존재는 available · prompt "살펴보기"
            아는 존재는 "이미 알고 있다" · 내 몸은 "자기 자신은 살펴볼 대상이 아니다"
            키가 없고 targetEntityId 로 대상이 지목된다
        되돌림
            세계가 싣는 목록에 있고 무엇을 하는지 읽힌다 (origin: world)
            지목하면 그 존재만 · 비우면 알고 있는 전부 (요청 조립 2종)
        살펴봄은 관문이 아니다
            모르는 상대가 있어도 세 스킬과 막기가 그대로 뜬다

    갱신한 기존 검증 — **표시를 바꾸지 않고 fixture 의 앎 상태만 채웠다**
        fixtures 6개 (combat · command · damage-type · guard · guard-broken · penetration)
            각 존재의 attributes 에 `acquainted: true` · `concealed: []` 를 더했다.
            기존 fixture 는 겨루는 힘이 보이는 순간이고, C014 이후로 그것은
            "살펴본 뒤" 의 순간이다 — 값은 한 개도 바꾸지 않았다
        view/tests/command.spec.ts
            명령 수 3 → 4 (되돌림이 더해졌다). 표면의 모양·안내·기록은 그대로다
        view/tests/penetration.spec.ts
            versusObserver 를 손으로 덮어쓰는 대목의 옵셔널 접근 정리 (의미 무변경)

    실행 결과
        전체 38 파일 608 tests 통과 (`npx vitest run`)
        `npx tsc --noEmit` 오류 0 · `npm run build` 성공
        `npm run boundary:check` 위반 0 · `npm run catalog:check` 정합

## NOTES

    ① LINE ORDER NOTE — 겨루는 힘의 줄 자리를 옮기지 않았다
       처음 구현에서 아는 존재의 겨루는 힘 줄들을 배열 끝(막기 뒤)으로 옮겼더니
       C012·C013 의 검증 4건이 깨졌다. 그 테스트들은 줄 번호로 값을 읽는다.
       고치는 방법이 둘이었다 — 테스트의 번호를 옮기거나, 자리를 되돌리거나.
       **자리를 되돌렸다.** 읽는 순서(자원 → 이동 → 겨루는 힘 → 배율 → 막기)는
       C010 부터 쌓인 표시 결정이고, 이 Cycle 의 의미는 순서가 아니라 유무다.
       테스트가 깨진 것이 곧 "표시가 바뀌었다" 는 신호였고, 그 신호를 지우지 않았다.
       그래서 아는 존재의 화면은 C013 과 **한 글자도 다르지 않다.**

    ② 왜 물음표를 이름에 붙였는가
       모름을 속성 관찰 안에만 두면 켜지 않은 플레이어에게는 아무 일도 일어나지 않는다.
       04 EMPTY-SLOT NOTE 는 "무엇을 모르는지가 화면에서 읽혀야 한다" 고 요구했고,
       늘 보이는 자리는 몸 위 표지뿐이다. 표지의 형식은 결정 Layer 의 것이므로
       (engine 의 SceneNameplate 를 건드리지 않고) 이름 문자열에 표시를 얹었다 —
       엔진에 새 능력을 더하지 않고 요구를 만족한 것이다.

    ③ 가려진 항목의 이름을 문구로 옮기기만 했다
       `combatStats → 겨루는 힘` · `versusObserver → 나에게 읽히는 방어` ·
       `defenseShape → 약점`. 목록을 만들지 않고 받은 이름을 번역한다.
       세계가 가리는 항목을 늘리면 그 이름의 문구만 code-text 에 더하면 되고,
       미등록 이름은 코드 그대로 나온다 — 표현 누락이 게임을 멈추지 않는다.

    ④ 값 하나도 짐작하지 않았음을 검증으로 못 박았다
       04 EMPTY-SLOT NOTE 가 금지한 다섯 가지 중 View 가 실수할 수 있는 셋
       (0 으로 채우기 · 종류 이름으로 짐작 · 타격 경위에서 끌어오기)은
       "모르는 존재의 줄에 값이 한 개도 없다" 로 한 번에 확인된다.
       versusObserver 를 곱해 만들지 않는다는 C013 의 금지는 그 검증이 이어받는다 —
       곱하려면 상대의 combatStats 가 있어야 하고, 그것이 없다.

    ⑤ GAMEVIEW GAP 없음
       04 의 항목 중 화면에 이르지 못한 것이 없다. World 내부를 읽지 않았고
       `engine/` 도 한 줄 열지 않았다.
