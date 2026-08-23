# C025 — View Implementation

## SPEC CONSUMED

    inventory[]                     view/inventory-workspace.ts   지닌 것의 칸
    inventory[].kind / count /
    category / actions[]            view/inventory-workspace.ts   칸의 글자 · 상세 줄
    inventoryRoom                   view/inventory-workspace.ts   자리 글자 + 남은 칸
    requestOutcome (mark · reason)  view/inventory-workspace.ts   기다림 · app/main.ts 가 나눈다

    읽지 않은 것 — `equipment` · `attributes.combatStats` (04 out_of_scope · VUX-IE-02)

## 구현

    view/inventory-workspace.ts   NEW   표면을 짓는다 · 고르기/초점/기다림을 쥔다
    view/surface-state.ts         기존   열림 (기반 트랙에서 세운 것)
    view/bindings.ts              CHANGED  I · ← → · ↑ ↓ · Enter
    view/resolve.ts               CHANGED  surfaces 에 작업 공간 하나
    content/active-view.ts        CHANGED  settleOutcome · forgetPending 재수출
    app/main.ts                   CHANGED  대답 나누기 · 이동 멈춤 · 표면이 열린 동안의 키 흐름

    기반 쪽은 이 Cycle 전에 별도 트랙 커밋으로 세웠다 (겹침 표면 · 초점 이동 · 기다리는 요청).

## INPUT → ACTION REQUEST

    I                여닫는다                      — 세계로 나가지 않는다
    ← →              지닌 것 사이에서 고른다        — 세계로 나가지 않는다
    ↑ ↓              행동 줄 사이에서 초점을 옮긴다  — 세계로 나가지 않는다
    Enter            초점의 행동을 요청한다         → { interactionId: action.id, itemKind: entry.kind }
    Esc · ✕          닫는다                        — 기반 표면이 받아 조립을 거쳐 closeSurface

    **나가는 것은 Enter 하나뿐이다.** 그리고 그 요청이 싣는 둘은 전부 관찰이 실어 온
    것이다 — 화면이 새로 조립하는 것이 없다 (INTENT-THE-REQUEST-IS-WHAT-WAS-OBSERVED-001).

    기존 두·세 걸음 조작(B·N·M·,)은 **그대로 남는다.** 대체가 아니라 더하기다 —
    아는 사람은 열지 않고 바로 치고, 모르는 사람은 열어서 읽고 고른다.

## GAP 1 — Stage 4 로 반환하고 고쳤다

    GAMEVIEW GAP
    Required   지닌 것과 남은 자리를 자리로 보여야 한다
    Missing    한 항목이 자리를 몇 개 쓰는가
    Reason     04 의 `surface_rule` 이 "capacity 만큼의 칸을 놓고 그중 항목이 앉지 않은
               것을 빈 자리로" 라고 적었는데, 그 규칙은 화면이 겹침 한도를 안다고
               전제한다. 계약은 그것을 싣지 않으며(C022 가 일부러 뺐다) 실으면 화면이
               자리를 셀 수 있게 된다. 돌 아홉은 항목 하나에 자리 셋이므로 항목들을
               capacity 크기의 격자에 앉히는 일이 **불가능하다**
    Return To  GameView Specification

    **고친 규칙** — 두 축을 한 격자에 섞지 않는다.

        지닌 것      항목마다 칸 하나
        남은 자리    `capacity − used` 만큼의 빈 칸

    04-gameview.spec.yaml 의 `inventoryRoom.surface_rule` 에 `CORRECTED` 로 반영했다.
    세계 쪽 문제가 아니므로 Stage 3·6 은 건드리지 않았다.

## 화면의 결정 (계약에서 오지 않은 것들)

    격자 4열                    표현이다. 계약이 정하지 않는다
    분류 아이콘 표              모르는 분류는 아이콘 없이 나온다
    역할 이름 표                모르는 역할은 코드 그대로 나온다
    고르기와 초점을 **가른다**   ← → 는 물건을, ↑ ↓ 는 그 물건의 행동 줄을 가리킨다.
                                기반 능력이 둘을 다르게 그린다 (파란 테두리 · 노란 링)
    `exchange-item` 은 보이되    자리를 지목해야 성립하는데 그 길이 아직 없다.
    이 자리에서 실행하지 않는다   **안 되는 것으로 그리지 않는다** — 세계는 된다고 말했다

## FIXTURE TESTS

    view/tests/inventory-workspace.spec.ts        32 tests · World 미기동 (VUX-IE-V-10)
    view/tests/fixtures/inventory-empty.fixture.json     NEW  (VUX-IE-FX-EMPTY)
    view/tests/fixtures/inventory-unknown.fixture.json   NEW  (VUX-IE-FX-UNKNOWN)

    기존 `inventory-full.fixture.json` 이 **GAP 1 의 증거**다 — 돌 아홉 + 곡괭이 =
    항목 둘에 자리 넷이다. 그 장면에서 항목 칸 둘 · 빈 칸 0 · `자리 4 / 4 · 가득` 이
    나오는 것을 검사한다.

## NOTES

    이 Cycle 은 세계를 한 줄도 고치지 않았다 (06). 기존 가로 띠와 self 패널도 그대로 남는다.
