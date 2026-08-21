# CYCLE C024 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression
[PASS] Catalog

## NEW BEHAVIOR

    찬 자리에 걸면                    → 밀려남과 걸림이 **한 번에** 일어난다
    가방 4/4 에서 해제                → 실패 (no-room)          ← C023 그대로
    가방 4/4 에서 교체                → **성공** · 자리 4/4 그대로
    걸린 것이 없을 때 바꿔 걸기        → 불가 (no-occupied-slot) · 그냥 걸기는 가능
    자리를 밝히지 않은 걸기            → **뜻이 그대로다** (빈 자리 · 없으면 no-empty-slot)
    빈 자리를 밝힌 걸기                → 그냥 걸린다 (요청을 둘로 가르지 않는다)
    세계가 모르는 자리 / 걸 수 없는 물건 → 거절 · 자리도 수량도 값도 용도도 그대로

## WORLD SCENARIO — View 없이 실측 (`world/tests/exchange.spec.ts` 20)

    ① 한 단위
        Before  E1 pickaxe · 가방 { buckler 1 }
        Input   equip-item(buckler, E1)
        Rule    RULE-ITEM-EQUIP-001
        After   E1 buckler · 가방 { pickaxe 1 } · **걸린 자리는 여전히 하나**
                밀려난 것이 다른 빈 자리로 가지 않았다

    ② 헌것의 기여가 정확히 사라진다
        Before  물리 공격 40 + 12 = 52 · armor 50
        After   물리 공격 **40** · armor 50 + 15 = **65**
                가산이었다면 52 가 남는다. 이 한 줄이 치환임을 증명한다

    ③ 백 번 바꿔 껴도 표류하지 않는다
        50 회 왕복 후 물리 공격 52 · armor 50 · buckler 1 · pickaxe 0 — 초기와 동일

    ④ **비대칭 — 같은 세계 상태에서 두 요청이 다른 답을 낸다**
        Before  E1 pickaxe · 가방 { buckler 1, stone 9 } = **4 / 4**
        관찰    unequip-item(E1).available = false · reason no-room
                exchange-item(buckler).available = **true**
        Input   unequip-item(E1)        → failure(no-room)      아무것도 안 바뀜
        Input   equip-item(buckler, E1) → **success**
        After   E1 buckler · 가방 { stone 9, pickaxe 1 } · **자리 4 / 4 그대로**

    ⑤ 실패한 교체는 넷을 그대로 둔다
        not-enough · not-equippable · unknown-slot 셋 모두에서
        자리 · 소지품 · 자리 수 · 유효 값 · 채집 가능 여부가 한 톨도 안 바뀌었다

    ⑥ 밝히지 않은 요청은 아무것도 밀어내지 않는다
        여섯 자리를 전부 채운 뒤 밝히지 않은 걸기 → **no-empty-slot** (C023 그대로)
        같은 상태에서 E3 을 밝히면 → **success** · 나머지 다섯 자리는 그대로

    ⑦ 같은 종류 교체 (JUDGEMENT ①)
        pickaxe 2 를 지닌 몸에서 equip-item(pickaxe, E1) → success ·
        equipment · inventory · inventoryRoom · combatStats 전부 이전과 동일

## PROJECTION — 04 계약대로 산출되는가

    실제 세계 프로세스가 낳은 관찰을 그대로 fixture 로 떴다 (손으로 짓지 않았다).

    exchange-nothing-worn   buckler.actions[exchange-item] = { available: false,
                            unavailableReason: 'no-occupied-slot' }
                            buckler.actions[equip-item]    = { available: true }
                            category = **gear** · origin 없음
    exchange-full-bag       inventoryRoom { used 4, capacity 4 }
                            E1.actions[unequip-item] = { false, 'no-room' }
                            buckler.actions[exchange-item] = { **true** }
                            ← **한 관찰 안에 비대칭이 함께 실려 있다**
    exchange-done           E1.item.kind = buckler · contributions [{ armor, 15 }]
                            combatStats.physicalAttack = **40** (기본값)

    equipment[] 도 combatStats 도 inventoryRoom 도 **계약의 형태가 열리지 않았다.**

## VIEW FIXTURE — World 미기동 (`view/tests/exchange.spec.ts` 14)

    같은 fixture 한 장에서
        `1. 곡괭이 · … · 풀기 ✗ 자리 없음`
        `손방패 ×1 · … · 바꿔 걸기 ✓ , → …`
    화면이 두 판정을 하나로 뭉치지 않는다 — `바꿔 걸기 ✗ 자리 없음` 은 어디에도 없다.

    세 걸음 조작 — 첫 걸음에서 **세계로 나간 것이 0 건**이다.
        , → 2 → 1  ⇒  { interactionId: 'equip-item', itemKind: 'buckler', equipSlotId: 'E1' }
        도중에 M 을 누르면 골라 둔 것이 버려진다 · 없는 칸을 짚으면 닫힌다 ·
        걸린 자리가 없으면 아무것도 보내지 않는다

    화면이 값을 계산하지 않는다 — `물리 방어 65` 는 세계가 보낸 수이고,
    `+15` 는 경위일 뿐 더한 흔적이 없다 (65 + 15 인 줄이 없다).

## PLAYABLE — 실제 세계 프로세스 + 실제 이어짐

    구성      `npx tsx server/main.ts` (별도 프로세스, 자기 시계) ← WebSocket ← 클라이언트
              클라이언트는 브라우저와 **똑같은 봉투**(join · action)만 보내고
              관찰 결과만 읽는다. 세계 내부를 들여다보지 않는다.

    ① 붙었다 — player-1 · 가방 2 / 4 · 지닌 것 [["pickaxe",1],["buckler",1]] ·
       걸린 것 [] · 물리 공격 40 · 물리 방어 50
    ② 광맥 앞 — 남은 것 15 · 거리 1.20
    ③ **아무것도 걸지 않았을 때** — 바꿔 걸기 가능? false · 사유 `no-occupied-slot`
       그냥 걸기 가능? true   ← 가방 탓이 아니라는 것이 사유로 갈린다
    ④ 곡괭이를 건다 — 대답 [성공] · 걸린 것 ["E1:pickaxe physicalAttack+12"]
       물리 공격 **40 → 52** · 물리 방어 50 · 채집 가능? true
    ⑤ 가방을 채웠다 — 지닌 것 [["stone",7],["buckler",1]] · 가방 **4 / 4**
    ⑥ **같은 상태에서 두 손이 갈린다** —
       풀기 가능? **false** (no-room) · 바꿔 걸기 가능? **true**
       ← 부딪히기 전에 이미 갈려 있다
    ⑦ 가득 찬 채로 풀어 본다 — 세계의 대답 ["no-room"] ·
       걸린 것 그대로 · 가방 4 / 4   ← **아무것도 바뀌지 않았다** (IE §15)
    ⑧ **같은 상태에서 바꿔 낀다** — 세계의 대답 [성공]
       걸린 것 ["E1:buckler armor+15"] · 지닌 것 [["stone",7],["pickaxe",1]] ·
       가방 **4 / 4 그대로**   ← **자리를 새로 요구하지 않았다** (IE §16.1)
       물리 공격 **52 → 40** · 물리 방어 **50 → 65** · 채집 가능? **false**
       ← 세 가지가 한 번에 움직였고 공격은 **정확히 기본값**으로 돌아왔다
    ⑨ 되돌린다 — 대답 [성공] · 물리 공격 52 · 물리 방어 50 · 채집 가능? true
    ⑩ 없는 자리 — 대답 ["unknown-slot"] · 걸린 것 그대로
    ⑪ 걸 수 없는 물건 — 대답 ["not-equippable"] · 걸린 것 그대로
    ⑫ 빈 자리(E5)를 지목 — 대답 [성공] · 걸린 것 둘 · 물리 공격 52 · 물리 방어 65
       ← 요청을 둘로 가르지 않아도 빈 자리는 그냥 걸린다
    ⑬ 다시 캔다 — 돌 8 · 광맥 7

    → **Cycle Goal 의 문장이 그대로 일어났다** —
      "가방이 가득 차 있어도 걸어 둔 것을 골라서 바꿔 낄 수 있고, 같은 상태에서
       그냥 풀려고 하면 자리가 없다는 사유가 온다. 바꿔 낀 뒤 몸에는 새것이 주는 것만 있다."

    브라우저 클라이언트 (vite dev + 같은 세계 호스트 · 헤드리스 Chromium · **오류 0**)

        붙은 직후    `물리 공격 40 · 물리 방어 50 (받는 피해 67%)`
                    `걸어 둔 것 (M → 번호 · 바꿔 걸기는 , → 소지품 → 번호)`
                    `·  빈 자리` ×6
                    `1. 곡괭이 ×1 · 쓰기 ✗ 대상 없음 · 걸기 ✓ N → 1 ·
                     바꿔 걸기 ✗ 걸린 것 없음 · 덜어내기 ✗ 되돌릴 수 없음`
                    `2. 손방패 ×1 · 걸기 ✓ N → 2 · 바꿔 걸기 ✗ 걸린 것 없음 · 덜어내기 ✓ B → 2`

        N → 1       `물리 공격 52 · 물리 방어 50`
                    `1. 곡괭이 · 물리 공격 +12 · 채집 · … · 풀기 ✓ M → 1`
                    `1. 손방패 ×1 · 걸기 ✓ N → 1 · 바꿔 걸기 ✓ , → 1 → 걸린 번호 · …`

        , → 1 → 1   `물리 공격 40 · 물리 방어 65 (받는 피해 61%)`
                    `1. 손방패 · 물리 방어 +15 · 풀기 ✓ M → 1`
                    `1. 곡괭이 ×1 · … · 덜어내기 ✗ 되돌릴 수 없음`
                    ← **화면에서 두 값이 반대로 움직였고 채집이 사라졌다**

        , → 1 → 1   `물리 공격 52 · 물리 방어 50` · `1. 곡괭이 · 물리 공격 +12 · 채집`
                    ← **정확히 이전으로 돌아왔다**

## REGRESSION

    전체 **1016 tests 통과** (59 files). 03 의 AFFECTED 를 항목별로 확인했다.

    RULE-ITEM-UNEQUIP-001      **코드 0줄.** equip.spec 25/25 —
                               4/4 에서 여전히 no-room 이며, 그것이 비대칭의 반쪽이다
    RULE-BODY-USES-001         **코드 0줄.** 걸린 것이 바뀌어 답만 달라진다.
                               mine.spec 7/7 — C001 이래의 각본이 그대로 돈다
    RULE-BODY-GRANTABLE-USES   답이 달라지지 않았다 — 손방패는 용도를 주지 않는다.
                               inventory-room.spec 15/15 (no-way-back 판정 그대로)
    RULE-INVENTORY-ADD/REMOVE  교체의 두 방향이 그 통로를 지난다. 수량 음수 없음
    RULE-INVENTORY-ROOM-001    **식 0줄.** 순 증가 판정이 이것에 묻는다
    RULE-DAMAGE-CALCULATE-001  **공식 0줄.** damage · damage-type · penetration ·
                               critical · combat · guard 6개 spec 전부 통과 —
                               아무것도 걸지 않은 몸의 피해가 C010~C015 실측치 그대로
    RULE-ITEM-DISCARD-001      밀려나 돌아온 것이 덜어내기의 대상이 된다 (판정 무변경)

    시작 소지품이 바뀌어 **기준값만** 옮긴 시험 (의미는 그대로)
        inventory-room.spec   `atDepositReady` 가 둘 다 걸게 하자 C022·C023 의 자리
                              실측이 **값 그대로** 통과했다 (돌 12 · used 0 · []) —
                              식을 건드리지 않았다는 증거다.
                              시작 소지품 시험만 1 → 2
        equip.spec            4/4 를 채우는 돌이 12 → 9. 막히는 사정도 사유도 그대로

    도구 검사
        `npx tsc --noEmit`         통과
        `npm run boundary:check`   경계 위반 0 (engine→content · 팩 간 격리)
        `npm run catalog:check`    kind 3원소 정합
        `npm run master:graph:check` 정합성 통과 — 노드 94 · 관계 162 · Constraint 32

## MASTER FEEDBACK

    Capability Overlay

        MC-EQUIP-ITEM   **PARTIAL → IMPLEMENTED**
            근거는 이 문서의 PLAYABLE ⑥⑦⑧ 과 WORLD SCENARIO ④ 다.
            world_shape 의 남은 두 문장이 실측으로 닫혔다 —
            ① 이미 찬 자리에 넣으면 넣기와 빼내기가 한 번에 일어난다 (PLAYABLE ⑧)
            ② 가방이 가득할 때 해제는 막히고 교체는 된다 (⑥⑦⑧ 이 같은 상태에서)
            overlay 가 곁가지로 적어 둔 "걸 수 있는 물건이 곡괭이 하나뿐" 도 풀렸다.
            남은 곁가지 하나 — **전용 자리를 선언한 물건이 여전히 없다.**
            `slot-not-fit` 은 코드에 서 있으나 플레이에서 겪히지 않는다

        MP-ADAPT-BY-RESOURCE
            갈래가 처음으로 **둘**이 되었다. 지금까지 "무엇을 걸까" 는 선택이 아니었다
            (걸 수 있는 것이 하나였다). 공격을 얹을지 방어를 얹을지가 생겼고,
            자리가 여섯이므로 아직 **둘 다** 걸 수 있다 — 진짜 선택이 되려면
            자리가 걸 것보다 좁아져야 한다 (IE §49 P3 · 아래 Master Gap ②)

    Constraint Evaluation

        DC-ITEM-CHANGE-IS-ONE-UNIT      **SATISFIED** — 교체가 전부 아니면 전무다.
                                        실패 셋 모두 넷을 그대로 두었다 (SCENARIO ⑤)
        DC-ITEM-CAPACITY-IS-FINITE      **SATISFIED** — 4 를 움직이지 않고 비대칭이
                                        실측되었다. 교체가 자리를 늘리지 않는다
        DC-ITEM-LIVES-IN-ONE-PLACE      **SATISFIED** — 걸린 자리가 언제나 하나였다.
                                        구조가 그것을 낳았고 검사를 더하지 않았다
        DC-WORLD-OWNS-THE-SURFACE-LIST  **SATISFIED** — 화면의 available·사유가 전부
                                        세계 판정에서 온다. 화면이 가방의 형편에서
                                        교체 가능 여부를 유추하지 않는 것을 시험이 확인
        DC-ITEM-KIND-IS-DATA-NOT-BRANCH **SATISFIED** — 규칙에 종류 이름이 0건이다.
                                        buckler 가 정의소에 한 줄 늘었고 규칙도 관찰
                                        계약도 열리지 않았다
        DC-ITEM-HOLDING-IS-NOT-APPLYING **SATISFIED** — 밀려나 가방으로 간 것이 그 순간
                                        아무것도 주지 않았다 (채집이 사라진다)
        DC-COMBAT-ONE-FORMULA           **대상 아님 · 유지** — 공식도 읽는 값의 출처도
                                        열리지 않았다

    Constraint Candidate

        **"세계가 낼 수 없는 것을 처음부터 주면 그것을 잃는 길도 막아야 한다"** — 후보.
        손방패는 세계가 다시 내어줄 수 없는데 덜어내기가 사유 없이 가능하다.
        C022 의 막힘 판정은 **용도**만 보므로 걸리지 않는다 (03 JUDGEMENT ②).
        지금은 아무 해도 없다 — 잃어도 세계가 좁아질 뿐 막히지 않는다. 그러나
        제작·전리품이 서기 전에 초기 지급이 늘면 같은 형태가 반복된다.
        승격 판단은 Human 몫이다.

    Master Gap

        ① **유래를 답하지 못하는 아이템이 둘이 되었다** (Q36 이 열려 있다)
           곡괭이에 이어 손방패도 `IT-*` 가 없다. Cycle 이 지어 붙이지 않았다 —
           `Design-Resource-Catalog-R0.md` 가 승인 대기이고 그것이 Q36 과 함께 닫힌다.
           **이 Cycle 이 그 질문의 무게를 하나 더 올렸다는 것이 보고의 내용이다.**

        ② **자리 여섯이 걸 것 둘보다 여전히 넓다** (IE §49 P3)
           "무엇을 걸까" 가 선택이 되려면 자리가 좁아야 하는데, 지금은 둘 다 걸 수
           있으므로 교체는 **불편을 푸는 일**이지 **고르는 일**이 아니다.
           이 Cycle 이 여는 것은 그 선택의 **수단**이고, 선택 자체는 걸 것이 늘거나
           자리가 좁아질 때 온다. 어느 쪽을 움직일지는 위층의 판단이다.

        ③ **교체가 시간을 쓰지 않는다**
           걸기·풀기와 같이 즉시 일어난다 (C023 이 그렇게 세웠다). 전투 중에 값을
           갈아 끼우는 것이 공짜라는 뜻이며, 지금은 걸 것이 둘뿐이라 겪히지 않는다.
           대가의 축이 서면 다시 볼 자리다.

## FAILURES

    없음.

## STATUS

    IN PROGRESS — **Human Play 확인 대기**

    자동 검증은 전항 통과했고, 실제 세계 프로세스와 브라우저 클라이언트로도 Cycle Goal
    이 그대로 일어났다 (위 PLAYABLE). 남은 것은 사람이 직접 켜서 확인하는 일이다.

        `npm run dev` → N → 1 (곡괭이를 건다) → 광맥에서 가방을 채운다
        → M → 1 (풀리지 않는다) → , → 1 → 1 (바꿔 낀다)

    Gate 15항 중 14항 충족. 남은 하나가 "인간이 실제 게임에서 Cycle Goal 달성을
    확인했다" 이며, 그 확인이 오면 STATUS 를 COMPLETE 로 바꾼다.
