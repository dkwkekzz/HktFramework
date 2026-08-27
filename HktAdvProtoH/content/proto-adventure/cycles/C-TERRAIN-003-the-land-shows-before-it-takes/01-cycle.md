# CYCLE C-TERRAIN-003 — 땅이 거두기 전에 보인다

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

> ## 왜 이것인가 — 지금 세계는 **불공정하다**
>
> C-TERRAIN-002 가 땅을 돌게 만들었다. 예외 자리가 생겨나고 사라지며, 어디가 안전한지는
> 누가 어디서 열을 빼앗겼는가의 결과다. 그런데 **그 움직임을 앞질러 읽을 방법이 하나도
> 없다.** 관찰에 실리는 것은 전부 *지금*이고, 앞으로 무엇이 일어날지는 겪어야만 안다.
>
> 그 Cycle 이 스스로 그 부채를 적어 두었다 (frontier 의 순서 경고):
>
>     이 후보만 넣고 예고가 없으면 게임이 지금보다 나빠진다. 안전한 자리가
>     움직이는데 읽을 방법이 없으면 그것은 깊이가 아니라 **불공정**이다.
>
> 그리고 BT §5.2 가 이 Cycle 의 형태를 한 줄로 준다 — **순서까지 적혀 있다.**
>
>     멀쩡히 걷던 생물이 한순간 얼어붙는다.
>     ↓
>     빙하 아래 검은 광맥이 밝아진다.
>
> 지금 세계에는 저 둘이 **둘 다 없다.** 거두는 속도가 상수라 "한순간" 이 없고,
> 그러므로 밝아질 것도 없다. C-TERRAIN-001 이 그 상수를 두면서 사유를 적어 두었다 —
> "속도가 상수인 것은 모델링 주장이 아니라 **범위 결정**이다. 갑작스러운 흡수는
> 예고(원형 서리 무늬 · BT §5.4)와 한 몸이라 다음 후보가 함께 받는다." 그 다음이 여기다.
>
> Master 쪽에서도 자리가 서 있다. `MW-CIRCULATION-EVIDENCE`(ABSENT) 가 BT §15.8
> ("플레이어가 설명 없이 볼 수 있는 증거는 무엇인가")로 주입되어 있고, 이 Cycle 이
> 그것을 연다. §15.9("그 증거를 이해하면 어떤 서로 다른 행동이 가능해지는가")가
> 그 위에 얹힌다 — 이 Cycle 은 그 바닥까지다.

## MASTER TRACE
    Frontier             FR-THE-LAND-SHOWS-BEFORE-IT-TAKES
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Target Capability    없음 — MC-READ-ENVIRONMENT 가 같은 자리를 보지만
                         `part_of.grounded: false` 라 Target 이 되지 않는다
    Target WorldState    **MW-CIRCULATION-EVIDENCE (ABSENT)** — 이 Cycle 이 여는 노드다.
                         함께 움직이는 것: MW-SURVIVAL-PRESSURE (PARTIAL — world_shape 의
                         "법칙을 읽은 사람과 읽지 못한 사람이 같은 자리에서 다른 결과를
                         낸다" 가 여기서 닫힌다) · MW-TERRAIN-SUNEATER-ICEFIELD (PARTIAL —
                         그 노드가 요구하는 **풍경** 넷 중 둘이 선다)
    Active Constraints   DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE · DC-COMBAT-PLAYER-CAUSALITY ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST · DC-WORLD-TERRAIN-IS-A-PRINCIPLE ·
                         DC-CONDITION-OPENS-WITHOUT-RECORDING
    Constraint Note      LAW-IS-OBSERVABLE 가 두 Cycle 을 UNRESOLVED 로 지나왔다 —
                         "증거가 **먼저**" 절이 남아 있었기 때문이다. **이 Cycle 이 그것을
                         닫는다.** PLAYER-CAUSALITY: 겪은 결과의 원인이 관찰 가능한 증거와
                         그것을 보고 한 선택이 된다. CONDITION-OPENS-WITHOUT-RECORDING 은
                         몸에 대해 그대로 참을 유지한다 — 조짐도 땅이 지닌다

## TYPE
    Existing Capability Enhancement

    Terrain 을 확장한다. C-TERRAIN-002 까지 땅은 **지금만 보여 주는** 것이었다.
    이 Cycle 이 땅에 **앞**을 준다.

## TARGET CAPABILITY
    Terrain — 법칙이 작용하기 전에 그 자리에 증거가 드러난다

## GOAL
    Player 가 발밑에 퍼지는 무늬를 보고 자리를 옮겨,
    땅이 열을 **한꺼번에 빼앗는 순간**을 겪지 않는다.

    **처음으로 "미리 알았는가" 가 결과를 가른다.**

## INCLUDED
    급습               거두는 속도가 상수가 아니게 된다. 자리가 넘침에 가까워지면
                       한순간에 큰 양을 거둔다 (BT §5.2 — "멀쩡히 걷던 생물이 한순간
                       얼어붙는다"). **이것이 없으면 예고할 것이 없다** — 상수를 예고하면
                       "곧 위험" 타이머가 된다 (C-TERRAIN-002 순서 경고의 역방향)
    조짐               급습 전에 그 자리에 증거가 드러난다. 세계의 사실이지 화면의
                       친절이 아니다 — 관찰 계약에 실리는 것은 자리의 상태이고,
                       그것을 무늬로 그릴지 글자로 쓸지는 화면이 정한다
    읽을 시간          조짐과 급습 사이에 **읽고 움직일 수 있는 만큼**의 시간이 있다.
                       얼마인지는 03 이 정한다 — 걷는 속도로 그 자리를 벗어날 수
                       있어야 한다는 것이 기준이다
    서로 다른 대응      같은 조짐에서 여러 대응이 성립한다 — 나간다 · 지나간 뒤 들어간다 ·
                       (열이 넉넉하면) 버티고 분출을 받는다. 세계는 어느 하나를 권하지 않는다
    조짐의 관찰        자리마다 지금 조짐이 있는지와 얼마나 다가왔는지가 실린다.
                       무엇을 어떤 형태로 싣는지는 04 가 확정한다

## EXCLUDED
    주기를 세는 능력    MC-TIME-THE-CYCLE 은 여전히 `grounded: false` 다. 이 Cycle 은
                       **증거**를 세우지 그것을 읽는 **능력**을 세우지 않는다 —
                       읽는 것은 사람이 하고, 세계는 보여 주기만 한다
    안전한 길 잇기      MC-FIND-SAFE-ROUTE 도 같다. 어느 자리가 곧 닫히는지는 각각
                       읽히지만 그것들을 이어 길로 만드는 것은 이 Cycle 이 아니다
    지도 · 미니맵      증거는 땅 위에 있다. 화면 구석의 요약표가 아니다
    남의 몸에 대한 예고 다음 수를 읽는 것(MC-PREDICT)은 존재의 행동이고 이쪽은 땅의
                       작용이다. 이 Cycle 은 땅만 본다
    감각의 결속        BT §5.2 의 "차갑다는 감각까지 함께 결속된다"(= 조짐이 **없는** 구역)는
                       세우지 않는다. 조짐이 있는 세계를 먼저 세워야 그 예외가 뜻을 지닌다
    두 번째 법칙       법칙은 여전히 `heat-binding` 하나다
    자리 사이의 흐름    C-TERRAIN-002 의 EXCLUDED 를 그대로 잇는다 (05-review Q4)
    새로운 죽음의 형태  급습으로 열이 다하면 이미 있는 길로 간다 (INTENT-DOWNED-001)

## RELATED EXISTING CAPABILITY

    재사용 대상 — 다시 만들지 않는다

        자리와 그것이 지닌 것 · 단계
            world/semantic/terrain.ts#GroundZone (kept · phase) · GROUND_LAWS
            **급습의 조건은 이미 세계에 있다** — `kept / saturation` 이 그것이다
        거두는 규칙과 뿜는 규칙
            world/simulation/ground-law-apply.ts · ground-vent.ts
            급습은 거두는 일의 한 형태다 — 새 값이 아니라 **한 번에 많이**다
        아직 일어나지 않은 것이 관찰에 실리는 형태
            C019 `world/semantic/collision.ts` SWING_BEGIN — 행동의 앞 구간과 진행도.
            계약의 `state` · `progress` 가 그 형태이며 이 Cycle 이 땅에 같은 것을 붙인다
        자리를 그리는 결정과 기반 장치
            view/terrain-presentation.ts#groundZonePlan ·
            engine/view-kernel 의 SceneGroundZone (`intensity` 를 C-TERRAIN-002 가 쓴다 —
            이 Cycle 이 그것과 겹치지 않게 쓸 자리를 07 이 정한다)

    영향 가능 대상 — 03 이 판정한다

        GroundLawDefinition            급습의 정의(문턱 · 앞선 시간 · 거두는 양)가 여기 는다
        GroundZone                     조짐의 상태가 여기 는다 — **몸이 아니라 땅이다**
        RULE-GROUND-LAW-APPLY-001      상수 rate 옆에 급습이 선다
        RULE-GROUND-VENT-001           급습이 넘침을 앞당긴다 — 규칙은 그대로일 수 있다
        protocol/gameview-terrain.ts   자리에 조짐이 실린다
        world/semantic/world-state.ts  GroundZone 형태가 바뀌면 STATE_VERSION 을 올린다
        world/tests/terrain.spec.ts · view/tests/terrain.spec.ts   회귀 기반
