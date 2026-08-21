# C022 — View Implementation

> 화면이 이 Cycle 에서 **새로 배운 계산은 하나도 없다.** 자리가 몇인지도, 무엇을
> 덜어낼 수 있는지도 세계가 답한 것을 옮긴다. 화면이 정한 것은 셋뿐이다 —
> 자리를 어느 줄에 어떤 글자로 보일지, 덜어내기를 어떤 손가락으로 부를지,
> 사유 코드를 어떤 문구로 읽을지.

## SPEC CONSUMED

    inventoryRoom.used / capacity        view/inventory-presentation.ts
                                         `inventory.room` 줄 — `2 / 4` · 가득이면 `(가득)`
                                         **소지품 항목보다 먼저** 온다. 비었을 때야말로
                                         보여야 하는 값이기 때문이다 (04 inventoryRoom)

    inventory[].actions[discard-item]    view/inventory-presentation.ts
                                         `inventory.<kind>.discard` 줄.
                                         `available` 이면 손가락 자리를 함께 알려 주고,
                                         아니면 사유를 문구로 옮긴다.
                                         **지닌 모든 항목에 붙는다** — 세계가 그렇게 보낸다

    inventory[].stackable                이미 소비 중 (C020). 값의 출처가 바뀐 것은
                                         계약 뒤쪽의 일이라 화면이 알지 못한다

    interactions.mine.unavailableReason  view/code-text.ts — `no-room` 문구 추가.
                                         resolve 가 이미 `unavailableText` 로 옮기고
                                         있었으므로 **표에 한 줄이 늘었을 뿐**이다

    (신규 사유 문구)                      `no-room`      자리가 없다 — 무엇을 덜어내야 한다
                                         `no-way-back`  이걸 놓으면 되돌릴 수 없다

## ASSET MAPPING

    없음 — 새 sprite · 모션 · 이펙트가 하나도 없다.

    덜어내기는 세계에서 **시간을 쓰지 않고** 아무 존재도 만들지 않으므로
    (03 RULE-ITEM-DISCARD-001), 켤 사건이 없다. `effect-presentation.ts` 를 열지 않았다 —
    표에 줄을 늘리는 것조차 하지 않았다. 세계가 사건을 낳지 않았기 때문이다.

## INPUT → ACTION REQUEST

    Digit1..9                  → `use-item` (kind = 그 칸)          C020 그대로
    KeyB                       → **아무것도 보내지 않는다.** 다음 숫자 키의 뜻을 바꾼다
    KeyB → Digit1..9           → `discard-item` (kind = 그 칸)      C022 ADDED

    두 걸음인 이유
        숫자 키는 이미 "쓰기" 가 쓰고 있고, 입력 계층이 조합 키(Shift·Ctrl)를 팩에
        전달하지 않는다 — `engine/view-kernel/input/bindings.ts` 의 `KeyBinding` 은
        `code` 하나만 나른다. 기반을 고치는 것은 이 Cycle 의 일이 아니므로
        (View Guide MUST NOT — `engine/` 편집 금지) 팩 안에서 풀었다.

        **이것은 조작의 결정이지 게임의 판정이 아니다.** 열려 있든 아니든 화면은
        무엇이 되는지 묻지 않고 그대로 보낸다 — 잘못 눌러 보낸 요청도 세계가 사유와
        함께 거절하며, 그 사유는 이미 소지품 자리에 떠 있다.

        열림은 **숫자 키 한 번으로 닫힌다.** 덜어내기가 켜진 채 남아 다음 "쓰기" 를
        삼키지 않는다. `KeyB` 를 다시 눌러도 닫힌다.

    안내
        덜어내기 줄이 `가능 (B → 1)` 로 손가락 자리를 함께 보인다.
        두 걸음짜리 조작은 안내가 없으면 닿지 않으므로 화면이 그것을 말해 준다.
        키 이름은 문구이고 실제 바인딩은 `view/bindings.ts` 가 소유한다.

## FIXTURE TESTS

    view/tests/inventory-room.spec.ts    13 tests — **전부 통과** (World 미기동)

        VIEW CLOSURE 1  자리가 한 줄로 뜬다 (`2 / 4`) · 가득이면 `4 / 4 (가득)`
                        **자리 줄이 항목보다 앞에 온다** (순서를 검사한다)
                        지닌 것이 없어도 자리가 뜬다
                        자리 줄은 소지품 칸이 아니다 — 숫자 키가 가리키지 않는다
        VIEW CLOSURE 3·4  가득 찬 화면에서 채집이 불가로 뜨고 사유 문구가 나온다
        VIEW CLOSURE 5·6·7  덜어내기 줄이 손가락 자리와 함께 뜬다 ·
                        `no-way-back` 이 문구로 뜬다 · **지닌 모든 항목**에 붙는다
        DC-WORLD-OWNS-THE-SURFACE-LIST
                        세계가 곡괭이의 덜어내기를 허락하도록 계약값만 뒤집으면
                        **View 코드 한 줄 열지 않고** 덜어낼 수 있게 된다
                        모르는 사유 코드(`bound-by-oath`)도 화면을 멈추지 않는다
                        `stackLimit` 이 계약에 없다 — 돌 9 개를 보고도 화면은
                        자리가 4 인 것을 스스로 알 수 없다 (세계가 답한다)

    새 Fixture           view/tests/fixtures/inventory-full.fixture.json
                        자리 4/4 · 돌 9 · 채집 불가(`no-room`) · 덜어내기 두 갈래

    갱신 Fixture         mining-available · deposit-depleted 에 `discard-item` 이 는다
                        (세계가 지금 실제로 보내는 모양과 맞춘다)
                        19개 fixture 전부에 `inventoryRoom` 이 는다

    회귀                 `npm test` → **55 files · 942 tests 전부 통과**
    빌드                 `npm run build` (tsc + vite) 성공

## AFFECTED UPDATED

    view/tests/combat.spec.ts            HUD 줄 순서에 `inventory.room` 이 는다
    view/tests/resolve.spec.ts           같은 이유 (미등록 항목 소화 검증의 순서)
    view/inventory-presentation.ts       `inventoryKindOf` 가 `room` 을 종류로 읽지 않는다 —
                                         읽었다면 숫자 키가 "자리" 라는 물건을 쓰려 했을 것이다

## NOTES

    1. `GAMEVIEW CHANGE: NONE` 이 아니다
       계약에 `inventoryRoom` 이 늘고 `actions` 의 값이 하나 늘었으므로 View 가 바뀐다.
       그러나 **바뀐 것은 표와 문구뿐**이다 — resolve 의 구조도, HUD 위젯도,
       그리는 능력도 열리지 않았다.

    2. 화면이 자리를 셀 수 없다는 것을 시험이 지킨다
       돌 9 개와 `stackable: true` 를 주고도 자리가 4 임을 화면은 알 수 없다.
       한 자리에 몇까지인지가 계약에 없기 때문이다. 이 시험이 깨지는 날은
       누군가 `stackLimit` 을 계약에 실은 날이다.

    3. `engine/` 을 한 줄도 건드리지 않았다
       조합 키가 없어 두 걸음 조작이 되었지만, 그것을 기반 변경의 이유로 삼지 않았다.
       기반 트랙에서 조합 키가 열리면 이 두 걸음은 한 걸음이 될 수 있다 —
       `view/bindings.ts` 한 곳만 바뀐다.

    4. 남은 거친 자리 하나 — 열림에 눈에 보이는 표시가 없다
       `KeyB` 를 누른 뒤 "지금 덜어내기가 열려 있다" 를 화면이 보여 주지 않는다.
       열림은 화면의 조작 상태이고, HUD 는 세계가 보낸 관찰에서만 만들어지기 때문이다
       (조립 루트가 View-local 상태를 HUD 에 얹는 경로가 없다).
       지금은 안내 문구(`가능 (B → 1)`)가 그 자리를 대신한다.
       위험은 낮다 — 잘못 눌러 잃는 것은 돌뿐이고 돌은 다시 캘 수 있으며,
       되돌릴 수 없는 것은 세계가 이미 막는다.
