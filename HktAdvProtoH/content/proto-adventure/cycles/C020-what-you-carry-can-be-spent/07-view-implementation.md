# C020 — View Implementation

> 화면 코드에서도 **종류 이름이 규칙이 되는 자리가 사라졌다.**
> `view/inventory-presentation.ts` 어디에도 `stone` 이 없고 `pickaxe` 도 없다 —
> 종류 이름은 문구를 찾는 열쇠로만 쓰이고, 표에 없으면 코드 그대로 보인다.
> 세계가 정의만 더한 아이템도 화면에 나타난다 (테스트가 그것을 재현한다).

## SPEC CONSUMED

    inventory[]                        view/inventory-presentation.ts
        kind · count · category · stackable → 소지품 줄 (칸 번호 · 아이콘 · 수량)
        origin                             → 싣되 이번 화면은 쓰지 않는다 (아래 NOTES)
    inventory[].actions[]              view/inventory-presentation.ts
        available / unavailableReason      → "쓰기" 줄 — 가능 또는 세계가 준 사유의 문구
        id                                 → 요청에 실어 보낼 식별자
    entities.character.state = use-item  view/code-text.ts ('쓰는 중')
    interactions.mine                  view/interaction-presentation.ts (무변경 — 값도 사유도 그대로)
    strikeEvents[].skill               view/combat-presentation.ts (무변경 — 이름표를 그대로 옮긴다)
    unharmedContacts[].skill           view/relation-presentation.ts (무변경 — 같은 이유)

## ASSET MAPPING

    없음 — 이 Cycle 은 새 그림을 하나도 요구하지 않는다.
    소지품은 HUD 자리이고, 던지는 몸짓은 이미 있는 행동 표현을 쓴다
    (`use-item` 상태에 모션이 없으면 절차 생성 Asset 이 받는다 — spec 의 fallback 그대로).

## INPUT → ACTION REQUEST

    숫자 키 1‥9  →  Use(그 칸의 종류)          view/bindings.ts (useSlot)

    **몇 번 칸이 무엇인가는 화면의 결정이다.** 세계는 순서 있는 목록을 보낼 뿐이고,
    그 순서에 손가락 자리를 붙이는 일이 View 의 몫이다. 판정은 하나도 하지 않는다 —
    없는 칸이면 보내지 않고, 있는 칸이면 그대로 요청하며, 안 되면 세계가 사유와 함께
    거절한다. 그 사유는 이미 소지품 자리에 떠 있다.

    칸 순서는 `inventorySlots(scene)` 이 장면에서 되읽는다. 화면이 순서를 만들지 않고
    세계가 준 순서를 그대로 센다 — "쓰기" 줄은 칸으로 세지 않으므로 한 물건이 두 칸을
    차지하지 않는다.

## 결정 Layer 에 더한 것

    view/inventory-presentation.ts (신규)
        `inventoryHudItems` — 소지품 줄 만들기
        `inventorySlots` · `inventoryKindOf` — 칸 번호 되읽기
        `itemName` — `item.<kind>` 로 문구를 찾고, 없으면 코드 그대로

        앞머리(`item.`)를 붙인 이유 — 같은 문자열이 다른 것을 뜻하는 자리가 이미 있다.
        `stone` 은 대상 자리에서 **광맥의 종류**로 읽힌다 (C001). 둘을 한 표에 두면
        소지품의 돌이 "돌 광맥" 으로 보인다

    view/code-text.ts
        ADDED  `item.stone` · `item.pickaxe` · `use-item`(쓰는 중) ·
               `unknown-item` · `not-usable` · `not-enough` · `target-gone` · `target-downed`
        기존 `no-mining-tool`('곡괭이가 없다')은 **그대로 두었다** — 사유 코드가 그대로이므로
        문구도 그대로다

    view/hud-presentation.ts
        REMOVED  `inventory.stone` · `tool.hasMiningTool`
        소지품 줄은 라벨까지 `inventory-presentation` 이 직접 지닌다 (대상 자리와 같은 자리)

    view/resolve.ts
        hud 조립에 `inventoryHudItems` 한 줄이 늘었다. 자리는 대상 자리 **뒤**다 —
        "지금 누구를 상대하는가" 가 먼저 읽히고, "무엇을 지녔는가" 가 그 다음이다

    view/bindings.ts
        `useSlot(0‥8)` 아홉 개. `guardToggle` · `moveModeToggle` 과 같은 자리 —
        장면을 읽어 요청을 고르는 팩 고유 규칙이다

## FIXTURE TESTS

    view/tests/inventory.spec.ts     17개 — 신규 (World 미기동, Fixture 만)
        지녔는가 (3)      종류마다 한 줄 · 칸 번호는 화면의 결정 · 비어도 한 줄은 남는다
        되는가·왜 (4)     가능 · 세계가 준 사유의 문구 · 안 되는 항목도 남는다 ·
                         **모르는 사유 코드는 코드 그대로** (View 가 사유를 만들지 않는다)
        종류를 몰라도 (4)  정의만 더한 아이템이 뜬다 · 이름은 코드 그대로 ·
                         쓰기 줄도 만들어진다 · 모르는 분류는 아이콘 없이
        칸 되읽기 (3)     세계가 준 순서 그대로 · 쓰기 줄은 칸이 아니다 · 없으면 칸도 없다
        회귀 (3)          사라진 두 칸 · 반짝임을 소지품 줄이 이어받았다 ·
                         채집 판정은 여전히 대상 자리와 interaction 이 답한다

    view/tests/fixtures/*.json       18개 전부에 `inventory` 자리가 생겼다
        `mining-available` · `deposit-depleted` 둘에는 **실제 소지품**을 넣었다 —
        이 Cycle 의 화면을 그 둘이 대표한다
        모든 픽스처에서 `hud.inventory.stone` · `hud.tool.hasMiningTool` 를 지웠다

    view/tests/resolve.spec.ts · combat.spec.ts
        사라진 두 칸을 읽던 기대를 소지품 목록으로 옮겼다.
        **뜻은 하나도 바뀌지 않았다** — "남의 소지품은 오지 않는다" 는 이제
        "지니지 않은 종류는 항목 자체가 없다" 로 읽힌다 (0 이라는 줄도 없다)

    전체                             877 passed (50 files) · 경계 위반 0
    Stage 6 직후                     860 passed (49 files)

## NOTES

    GAMEVIEW CHANGE 는 NONE 이 아니다 — 계약에 `inventory` 가 늘고 hud 두 칸이 사라졌다.
    다만 **새 그림도 새 화면 장치도 없다.** 늘어난 것은 HUD 줄이고, 그 줄들은
    대상 자리(C017)가 이미 세운 형태를 그대로 따른다.

    `origin` 은 계약에서 받되 이번 화면이 쓰지 않는다. 싣는 이유는 유래를 답할 수 있어야
    한다는 세계 쪽 요구이고(DC-WORLD-RESOURCE-ADAPTATION-TRACE), 그것을 화면에 어떻게
    보일지는 감정·도감이 설 때 정해진다. 지금 억지로 띄우면 뜻 없는 문자열이 늘어난다.

    남이 무엇을 쓰는지는 여전히 오지 않는다 — 쓰고 있다는 것(`use-item` 상태)까지만
    보인다. 화면이 그 이상을 짐작하지 않는다.

    아홉 칸을 넘는 소지품은 번호 없이 보인다. 세지 못하는 것이 아니라 **손가락 자리가
    없는 것**이고, 그때 무엇을 할지(스크롤·묶음·필터)는 아이템이 늘어난 뒤 정한다 —
    지금 둘뿐인 목록에 정렬과 필터를 만들면 쓸모 없는 장치가 먼저 선다 (04 excluded).
