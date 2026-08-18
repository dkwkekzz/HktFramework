# C010 — View Implementation

이번 Cycle 은 새 화면도 새 표면도 만들지 않았다. 이미 있는 세 자리에 줄이 늘어났다.
`view/` 의 capability 코드(renderer · input · terrain · sprites)는 손대지 않았다.

## SPEC CONSUMED

    hud.self.combatStats
        → view/presentation/combat-presentation.ts  selfPanel()
        자기 정보 패널의 첫 줄이 되었다 —
        `공격력 40 · 방어력 50 (받는 피해 67%)`
        값을 바꾼 직후 여기서 바로 확인된다 (04 hud.self.combatStats.meaning)

    entities.character.attributes.combatStats
    entities.character.attributes.defenseMitigation
        → view/presentation/combat-presentation.ts  inspectLines()
        속성 관찰을 켜면 그 존재의 줄로 나온다 —
        `공격 40 · 방어 30 (받는 피해 77%)`
        C007 R2 의 "세계는 숨기지 않고, 늘 띄울지는 보는 이가 정한다" 를 그대로 따른다

    strikeEvents.breakdown
        → view/presentation/combat-presentation.ts  strikeMark() · breakdownLine()
        → view/scene/scene-state.ts                 SceneStrike.detail (ADDED)
        → view/hud/hud.ts                           StrikeMark.detail (ADDED) + 렌더 한 줄
        → index.html                                .hud-strike-detail 스타일
        피해 숫자 아래에 경위 한 줄 —
        `32+40=72 ×77%(방어 30) = 55`

    interactions.*.profile (CHANGED)
        소비하지 않는다. C007 때부터 View 는 profile 을 읽지 않았고 이번에도 읽지 않는다.
        계약이 바뀌었으나 소비처가 없으므로 View 변경이 없다 (아래 NOTES 참조)

    commandCatalog
        코드 변경 0. attack · defense 는 세계가 보내는 목록에 항목이 늘어난 것이므로
        C009 의 명령 표면이 그대로 그린다 — 이번 Cycle 이 그 설계의 첫 값이다

## ASSET MAPPING

    없음. 새 role 도 새 state 도 새 kind 도 생기지 않았다.
    기존 sprite · motion · kind 표현은 그대로다 (`npm run catalog:check` 정합).

## INPUT → ACTION REQUEST

    새 입력 없음.

    공격 능력·방어 능력을 바꾸는 조작은 C009 의 명령 표면이 그대로 처리한다.
        명령 목록에서 set-attribute 선택 → 대상 · 속성(attack | defense) · 값
        → ActionRequest { interactionId: 'set-attribute', targetEntityId, attribute }
    View 는 목록을 지어내지 않고 세계가 밝힌 Domain 을 그대로 보여 준다 (C009 규율).
    바꾸는 것은 언제나 세계다 — Client 는 요청만 한다.

## FIXTURE TESTS

    view/tests/damage.spec.ts      (신규 · 9 항목 · World 미기동)
        hud.self.combatStats       첫 줄의 내용 · 비율이 백분율로 읽힌다
        attributes.combatStats     켜면 남의 능력도 나온다 · 꺼져 있으면 몸 위를 채우지 않는다
        strikeEvents.breakdown     평소엔 숫자만 · 켜면 경위 한 줄 ·
                                   단단한 쪽은 같은 구조로 더 줄어든 것이 보인다 ·
                                   표시 숫자와 경위의 최종 피해가 어긋나지 않는다 ·
                                   경위가 있어도 크기·자리·나이는 그대로

    view/tests/combat.spec.ts      (갱신)
        self 패널 줄 순서가 하나 밀렸다 — 전투 능력치 줄이 맨 위에 붙었기 때문이다

    view/tests/fixtures/combat.fixture.json    (갱신)
    view/tests/fixtures/command.fixture.json   (갱신)
        entities[].attributes.combatStats · strikes[].breakdown ·
        hud self.combat.* · interactions[].profile 새 3필드.
        Fixture 의 피해 값은 세계가 실제로 내는 값으로 맞췄다 —
        고급 55 (32+40=72 ×100/130), 자율 존재의 기본 17 (6+20=26 ×100/150)

    전체   28 파일 404 항목 중 403 통과
    실패 1 view/tests/motion-atlas.spec.ts — move 시트의 절단선 검사.
           C010 이전에도 실패한다 (변경 전 트리에서 재현 확인). 이 Cycle 과 무관하며
           그림 자산 문제다. 08-verification.md 에 그대로 남긴다

    npx tsc --noEmit    오류 없음
    npx vite build      성공

## NOTES

    ── 왜 경위를 토글 뒤에 두었나 ────────────────────────────────────
    04 는 "그 숫자가 왜 그만큼인지 읽을 수 있어야 한다" 만 요구하고 언제 보일지는
    View 의 선택으로 남겼다. 여섯 개 숫자를 타격마다 늘 띄우면 정작 피해 숫자가
    읽히지 않는다. 그래서 이미 있는 속성 관찰 토글에 얹었다 —
    "왜 이만큼인가" 를 확인하려는 순간과 값을 들여다보는 순간이 같기 때문이다.
    감춘 것이 아니라 표시 선택이며, 게임 안에서 켜면 그 자리에서 펼쳐진다.

    ── profile 이 CHANGED 인데 View 변경이 없는 것 ───────────────────
    04 는 profile 을 세 필드로 나눴고 World 는 그대로 보내고 있다.
    다만 View 는 C007 때부터 이 값을 그리지 않았다 — 계약에는 있으나 소비처가 없다.
    이번 Cycle 에서 새로 그리지 않은 이유는 Cycle Goal 이 요구하는 것이
    "쓰기 전 예고" 가 아니라 "맞은 뒤의 경위" 이기 때문이다 (04 PLAYABILITY NOTE 6단계).
    스킬 선택을 돕는 표시는 그것이 실제로 필요해지는 Cycle 이 가져간다.

    ── 두 Layer 분리 ─────────────────────────────────────────────────
    백분율 변환·문구·줄 구성은 전부 presentation 이 했다.
    hud.ts 가 더한 것은 detail 이 있으면 한 줄 더 그린다는 것뿐이고,
    그 줄의 내용도 형식도 알지 못한다.

    ── GAP ───────────────────────────────────────────────────────────
    없음. 04 의 ADDED / CHANGED 항목이 모두 소비되었거나 소비하지 않는 이유가 적혀 있다.
