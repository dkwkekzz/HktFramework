# C-COMBAT-001 — View Implementation

> 04 가 세운 계약 셋을 화면 결정으로 옮긴다. **세계를 읽지 않았다** — 입력은
> `04-gameview.spec.yaml` 하나이고, `world/` 는 이 단계의 입력이 아니다.
>
> 이 화면은 **배분을 한 번도 계산하지 않는다.** 어느 배분이 어느 값을 얼마나 올리는지도,
> 지금 바꿀 기력이 되는지도, 왜 안 되는지도 묻지 않는다 — 받은 값을 옮긴다.

## SPEC CONSUMED

    entities[].attributes.allocation        view/allocation-presentation.ts  allocationMark · allocationLine
                                            view/combat-presentation.ts      nameplate · inspectLines
    allocations[]                           view/allocation-presentation.ts  allocationHudItems
                                            view/resolve.ts                  hud 조립
    allocations[].actions[].available/reason  같은 파일 — choiceText 가 사유를 옮긴다
    allocations[].current / cpCost / shares  같은 파일
    hud.self.allocation(+ share 셋)          view/combat-presentation.ts      selfPanel 첫 줄
    hud.self.insight (CHANGED — 유효 값)      selfPanel · 기존 줄 그대로
    entities[].attributes.concealed (CHANGED) 기존 자리 그대로 — 형태가 바뀌지 않았다
    interactions.setAllocation               view/bindings.ts                 요청 조립

## ASSET MAPPING

    없음 — 새 존재도 새 그림도 생기지 않는다. 배분은 글자와 표시로만 읽힌다.
    `motions/` 에 폴더가 늘지 않는다 (`npm run catalog:check` 통과).

## INPUT → ACTION REQUEST

    U → 숫자(1~4)   set-allocation(allocationId = allocations[번호−1].id)

    **두 걸음이다.** B(덜어내기) · N(걸기) · M(풀기) · ,(바꿔 걸기)가 세운 그 형태이며,
    손가락 자리가 모자란 것은 조작 계층의 사정이지 게임의 판정이 아니다 —
    세계로 나가는 요청은 여전히 **배분 하나를 고른다** 하나뿐이다
    (DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL).

    **순서로 짚는다. 이름을 적어 두지 않는다.** `allocationSlots(scene)` 이 화면에 뜬
    차례를 그대로 읽으므로, 세계가 배분을 하나 더 지어도 조작 코드가 열리지 않는다.
    그리고 화면에 뜬 차례와 손가락이 짚는 차례가 **같은 배열에서 나오므로** 둘이
    갈라질 자리가 없다 (V-003 이 키 표에 대해 세운 원칙과 같다).

    **되는지 안 되는지는 판정하지 않는다** — 못 가는 자리도 그대로 보내고 세계가 사유와
    함께 거절한다. 그 사유는 이미 배분 자리에 떠 있다
    (DC-WORLD-OWNS-THE-SURFACE-LIST).

### 키를 두 번 옮겼다 — 검사가 잡았다

처음 고른 것은 `KeyR` 이었다. `view/tests/key-hints.spec.ts` 의 ③ 이 그것을 잡았다 —
`KeyR` 은 **시점이 먼저 가져간 자리**다 (`engine/view-kernel/input/keyboard.ts` 의
`TURN_KEY_CODES`). 그 검사 자신이 "C025 가 여기서 걸렸다" 고 적어 둔 자리이며,
같은 함정에 두 번째로 걸린 것이다. 남은 글자 자리는 **O · P · U 셋뿐**이었고
그중 `KeyU` 를 썼다.

## FIXTURE TESTS

    view/tests/fixtures/allocation.fixture.json (NEW)
        관찰자     hunter (몸 1 · 능력 1 · 인지 4) · 통찰 40 · 기력 45
        자율 존재  reinforce (몸 4 · 능력 1 · 인지 1) — 다쳐서 몸에 몰았다
        고를 목록  넷 전부. 하나(hatsu)는 `insufficient-cp` 로 못 간다
        가려짐     사냥꾼의 통찰 40 이 얕은 자리 하나(문턱 30)를 열어 약점만 보인다

    view/tests/allocation.spec.ts (NEW) — 17 항목

        ① 몸마다 보인다     이름 앞 표시 · 살펴보지 않은 상대에게도 · 고른 배분엔 안 붙음 ·
                            두 축이 나란하면 안 붙음 · 속성 관찰 한 줄 · self 패널 맨 앞
        ② 넷이 전부 선다     세계가 준 차례 · 지금 여기 · 기력과 손가락 자리 ·
                            못 가는 것도 사유와 함께 · 모르는 이름은 코드 그대로 ·
                            몫은 옮기기만 한다
        ③ 순서로 짚는다      U→2 가 reinforce · 못 가는 것도 그대로 보낸다 ·
                            열지 않으면 안 나간다 · 없는 차례는 아무 일 없음 ·
                            뜬 차례와 짚는 차례가 같다
        ④ 한 화면에서 읽힌다  통찰 40 과 열린 약점 · 닫힌 자리는 "모른다" 로 남는다

    전체 1383 통과 (79 파일) · `tsc --noEmit` · `boundary:check` · `catalog:check` 통과

## 기존 검증을 고친 것

    ① self 패널 · 속성 관찰의 **줄 번호**가 하나씩 밀렸다
       배분 줄이 각각 맨 앞과 통찰 위에 서기 때문이다. `combat` · `critical` ·
       `damage-type` · `damage` · `penetration` 의 인덱스 단언을 +1 했다.
       **줄의 내용도 순서도 바뀌지 않았다** — C016 이 통찰 한 줄을 넣으며 남긴
       기록("inspect 줄 번호가 하나씩 밀렸다")과 같은 손질이다

    ② `key-hints.spec.ts` 의 안내 패널 목록에 `배분: U` 한 줄
       팩의 다섯이 여섯이 되었다

## NOTES

### ① 배분 이름이 화면의 조건이 되지 않는다

`view/allocation-presentation.ts` 어디에도 `balanced` · `hunter` 같은 이름이 **조건으로
서지 않는다.** 이름은 문구 표(`code-text`)를 찾는 열쇠일 뿐이고 표에 없으면 코드 그대로
보인다 — 검증이 그것을 직접 확인한다 (`allocationLabel('zetsu') === 'allocation.zetsu'`).

어디에 몰았는지의 **표시**도 이름으로 고르지 않는다. 세계가 보낸 세 몫 중 가장 큰 것이
하나뿐이면 그쪽으로 몬 것이고, 둘이 나란하면 몰지 않은 것이다. 임계값도 이름 목록도 없다.

### ② 붙지 않음이 관찰이다

몸 위 배분 표시는 **고른 배분에서 붙지 않는다.** C018 의 관계 표시와 C019 의 선딜
표시가 세운 태도 그대로이며, 표시가 없다는 것이 곧 "이 몸은 지금 어디에도 몰지
않았다" 는 뜻이다. 늘 붙이면 네 글자가 모든 이름 앞에 상시로 서서 아무것도 말하지 않게 된다.

### ③ 배분 줄을 self 패널 맨 앞에 둔 이유

아래 모든 줄의 값이 그 한 줄에 따라 움직인다. 물리 공격 32 를 먼저 읽고 배분을 나중에
읽으면 "왜 40 이 아니지" 를 두 번 묻게 된다. 위에 두면 한 번에 읽힌다.
고를 수 있는 목록은 반대로 **패널 밖**(hud 줄)에 둔다 — 지금의 상태와 고를 것은 다른
질문이고, C023 이 걸린 것을 self 패널이 아닌 자기 줄에 둔 판단과 같다.

### ④ GAMEVIEW GAP — 없음

04 가 실은 것으로 화면이 전부 닫혔다. 세계 내부를 읽어야 했던 자리가 하나도 없다.

### ⑤ engine/ 무변경 · 새 capability 없음

`boundary:check` 위반 0. 배분 목록은 기존 `SceneHudItem` 줄로 서고 조작은 기존
`KeyBinding` 으로 붙는다 — 소지품(C020)과 걸어 둔 자리(C023)가 쓴 그 자리를 그대로
쓴다. 새 그리기 능력이 필요하지 않았다.

### ⑥ 남은 화면 몫 — VIEW 레인으로 넘긴다

`hud` 줄 넷이 세로로 늘어서므로 배분이 많아지면 화면이 길어진다. 지금 넷에서는 문제가
아니지만, 소지품이 그랬듯 **격자로 묶는 자리**가 언젠가 필요하다. 이 Cycle 이 만드는
것이 아니라 `works/BACKLOG.md` 가 받을 항목이다 — 세계도 관찰 계약도 바꾸지 않는
배치의 문제이기 때문이다 (CLAUDE.md 원칙 23).
