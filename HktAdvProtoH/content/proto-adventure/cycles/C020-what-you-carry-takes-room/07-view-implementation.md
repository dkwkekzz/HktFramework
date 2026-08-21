# C020 — View Implementation

> 이 Cycle 의 View 작업은 **표 하나와 결정 파일 하나**다. 새 그리기 능력도, 새 이펙트도,
> 새 스프라이트도 없다 — 세계가 보낸 목록을 줄로 옮기고 키 하나를 잇는다.
>
> 입력은 `04-gameview.spec.yaml` 하나였다. `03-world-semantic.md` 와 `world/` 는 열지
> 않았다 — 자리 수도, 겹침 한도도, 무엇이 왜 잠기는지도 전부 계약이 실어 온다.

## SPEC CONSUMED

    carried[]                    소지품 줄 (자리마다 하나)
      slot                       → 요청의 carriedSlot · HUD id 의 꼬리
      kind                       → 문구 (`item.<kind>`)
      category                   → 줄의 라벨 (도구 · 재료)
      quantity · stackLimit      → `돌 ×2 (2/2)` — 겹치지 않는 것은 이름만
      uses                       → 소비하지 않았다 (아래 NOTES ②)
      actions[].available/reason → 잠긴 자리의 사유 문구 · 겨눌 자리 고르기
      actions[].interactionId    → 요청 봉투
      actions[].slot             → 요청의 carriedSlot

    carriedRoom { used, total }  → `2/3` · 가득 차면 `3/3 — 가득 찼다`

    interactions.mine.reason     → `carry-full` 문구 (사유 표에 한 줄 추가로 끝)

    hud.removed                  → `inventory.stone` · `tool.hasMiningTool` 결정 항목 삭제

## ASSET MAPPING

    없음 — 이 Cycle 은 새 스프라이트도 새 role 도 만들지 않는다.

    소지품은 세계에 놓인 존재가 아니라 **관찰자 자신의 상태**이므로 entity 가 아니고,
    따라서 sprite 결정이 필요 없다. 아이콘은 가방 줄 하나(🎒)뿐이며 그것도 문구의
    일부다.

## 결정 항목

    view/carried-presentation.ts (ADDED)
        carriedHudItems()   목록 → 줄. 가방 요약 한 줄 · 자리마다 한 줄 · 덜어내기 한 줄
        letGoTargetSlot()   덜어내기 키가 겨눌 자리 — 세계가 된다고 말한 것 중 첫 자리
        LET_GO_HUD_PREFIX   그 자리를 bindings 로 나르는 HUD id 앞머리

        `target-presentation.ts`(C017)와 같은 형태다 — 세계가 보낸 계약의 자리들을
        결정 Layer 가 줄로 모은다. **판정은 하나도 하지 않는다.**

    view/code-text.ts (CHANGED)
        `item.stone` · `item.pickaxe` · `item.category.*` · `item.use.mining`
        `carry-full` · `carried-not-found` · `last-way-locked` ·
        `unknown-item` · `invalid-quantity` · `action-not-available`

        **물건의 종류에 `item.` 을 붙였다.** 세계는 광맥의 종류에도 `stone` 을 쓴다
        (기존 `stone: '돌 광맥'`). 세계에서는 문제가 아니다 — 하나는 존재의 종류이고
        하나는 물건의 종류다. 이 표가 평평하므로 **View 쪽에서 가른다.**

    view/hud-presentation.ts (CHANGED)
        `inventory.stone` · `tool.hasMiningTool` 항목 삭제 — 세계가 더 이상 보내지 않는다

    view/resolve.ts (CHANGED)
        hud 조립에 `carriedHudItems` 한 줄. 고른 대상 다음, 세계가 보낸 hud 앞이다 —
        "지금 무엇을 지녔는가" 는 세계 시간이나 사람 수보다 먼저 읽혀야 한다

    view/bindings.ts (CHANGED)
        `KeyB` — 덜어내기(버리기). 겨눌 자리는 carried-presentation 이 이미 골라
        HUD id 에 실어 두었고, 이 바인딩은 그것을 읽어 보낼 뿐이다

    view/tests/bindings.spec.ts (ADDED)
        팩이 등록한 키가 이미 쓰이는 키와 겹치지 않는가 — 아래 NOTES ⑤ 가 이유다

## INPUT → ACTION REQUEST

    B 키
        → scene.hud 에서 `carried.letGo:` 로 시작하는 줄을 찾는다
        → 꼬리가 숫자면 그 자리를 요청한다
             { interactionId: 'let-go', carriedSlot: <slot> }
        → 꼬리가 `none` 이면 **아무것도 보내지 않는다**

    이 경로에 판정이 없다. 세계가 막아 둔 자리는 `letGoTargetSlot` 이 애초에 고르지
    않으므로 id 에 오지 않는다. 화면이 허락한 것을 세계가 거절하는 일이 구조적으로
    생기지 않는다.

    키 바인딩이 필요했던 이유는 요청에 **자리 번호**가 실려야 하기 때문이다.
    `SceneState.interactions[].key` 로 나르는 보통의 경로는 파라미터 없는 요청만
    표현할 수 있다 (막기 토글 · 이동 모드가 같은 이유로 여기 있다).

## FIXTURE TESTS

    view/tests/bindings.spec.ts (신규 · 4건) — 키 충돌 가드. 전부 통과
    view/tests/carry.spec.ts (신규 · 15건) — World 미기동, Fixture 만으로. 전부 통과

        ① 소지품은 목록이다            4건  전용 칸 제거 · 자리마다 한 줄(빈 자리 없음) ·
                                          겹침 표시 · 갈래 라벨
        ② 가능/사유가 함께 온다        5건  잠긴 자리에 사유 · 허락된 자리엔 없음 ·
                                          겨눌 자리 고르기 · 전부 잠긴 몸 · carry-full 문구
        ③ 얼마나 찼는가                3건  2/3 · 가득 참 강조 · 세어서 알 수 없는 값
        입력 → Action Request          3건  X 가 자리를 실어 보냄 · 겨눌 것 없으면 무전송 ·
                                          Client 가 상태를 바꾸지 않음

    신규 Fixture

        carry-full.fixture.json     가방이 가득 차 캘 수 없는 장면 (3/3 · mine 이 carry-full)

    갱신 Fixture (AFFECTED)

        19개 전부                    `carried` · `carriedRoom` 자리가 늘었다
        16개                         hud 에서 `inventory.stone` · `tool.hasMiningTool` 제거 —
                                     세계가 보내지 않는 것을 Fixture 가 담고 있으면 거짓 증거다
        mining-available             소지품 둘을 채웠다 (곡괭이 잠김 · 돌 2/2)
        deposit-depleted             가방이 가득 찬 상태로 (3/3)
        two-observers                곡괭이 하나 (1/3)

    갱신 테스트 (AFFECTED)

        resolve.spec.ts   `inventory.stone` 을 읽던 세 자리 → carried 줄
        combat.spec.ts    hud id 목록에 소지품 줄 둘 추가
        target.spec.ts    "대상이 소지품보다 먼저" 의 비교 대상이 `carried.room` 으로

    전체 회귀

        npm test           55 files · 915 tests 통과 (Stage 6 의 889 → 26 증가)
        npx tsc --noEmit   오류 0
        npm run boundary:check   경계 위반 0

## NOTES

    ① `world/` 를 한 번도 열지 않았다

        자리 수(3)도, 겹침 한도(2)도, 곡괭이가 왜 잠기는지도 View 코드에 없다.
        전부 계약이 실어 온다. `carried[].stackLimit` 이 오지 않았다면 `돌 ×2 (2/2)`
        의 뒷자리를 그릴 수 없었을 것이고, 그때가 GAMEVIEW GAP 을 낼 자리였다.

    ② `uses` 를 소비하지 않았다

        계약이 싣지만 화면에 그리지 않았다. "무엇이 채굴을 여는가" 는 지금 세계에서
        곡괭이 하나뿐이라 줄을 늘릴 값어치가 없다. 도구가 여럿이 되면 그때 이 표에
        한 줄이 는다 — 계약을 고칠 일이 아니다.

    ③ 이펙트를 만들지 않았다 (F1)

        덜어내기는 세계의 사건이지만 지금은 이펙트를 붙이지 않았다.
        `EFFECT_SET` 의 일곱 자리는 전투가 쓰고 있고, 소지품 조작을 위해 무엇을 뺄
        만한 근거가 없다. 그 판단이 바뀌면 `effect-presentation.ts` 의 표에 한 줄이
        늘 뿐이다 — 코드가 아니라 표다.

    ⑤ 키를 잘못 골랐다 — 게임을 띄워 보고서야 드러났다

        처음 고른 키는 `KeyX` 였다. 그 키는 **엔진이 이미 시점 회전에 쓰고 있다**
        (`engine/view-kernel/input/keyboard.ts` 의 `TURN_KEYS` — Z·X 가 좌우로 돈다).
        엔진의 keydown 처리는 이동·시점 키를 `consumeKeyPresses` 에서 **제외**하므로
        그 키는 팩 바인딩까지 아예 오지 않는다.

        단위 테스트는 이것을 잡지 못했다. `binding.invoke` 를 직접 부르고 있었기
        때문이다 — 바인딩 안의 로직은 옳았고, 틀린 것은 **그 바인딩이 불릴 수 있는가**
        였다. 통합 실측도 같은 이유로 통과했다 (그쪽도 `invoke` 를 직접 부른다).

        실제로 브라우저를 띄워 눌러 보고서야 드러났다. `[X] 돌 ×2` 가 화면에 떠
        있는데 눌러도 아무 일이 없었다.

        고친 것은 둘이다.
            · `KeyB` 로 옮겼다 (버리기 — 엔진·팩이 쓰지 않는 키)
            · `view/tests/bindings.spec.ts` 를 세웠다. 엔진 예약 키 · 조립 루트가
              먼저 가로채는 키 · 팩 상호작용 키와의 충돌을 막는다

        그 테스트는 **엔진에 있는 사실의 사본**을 지닌다 (예약 키 목록). 사본을 두지
        않는 길은 엔진이 그 목록을 내보내는 것이고, 그것은 기반 트랙의 일이다.
        지금은 사본을 두되 어디가 원본인지 주석으로 밝혀 두었다.

    ④ 문구의 이름 공간이 처음으로 갈렸다

        `stone` 이 존재의 종류이면서 물건의 종류인 것이 이 Cycle 에서 처음 부딪혔다.
        세계 쪽은 옳다 — 두 `stone` 은 서로 다른 것을 가리키고 각자의 계약 자리에 있다.
        평평한 것은 View 의 문구 표이므로 View 가 앞머리를 붙였다.
        다음 Cycle 이 물건을 늘리면 `item.` 앞머리를 그대로 따르면 된다.
