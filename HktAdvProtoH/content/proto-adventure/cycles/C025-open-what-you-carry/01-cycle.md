# CYCLE C025 — Open What You Carry

[PASS] Cycle Definition           (관찰 표면 하나 · 세계 무변경이 기본 · 자리는 세계가 준 두 수)
[    ] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            없음 — **DIRECT OBSERVATION — VUX-IE-D1**
                        (`design/Design-View-Inventory-Equipment-UX-D1.md` §11 · §11.1)

                        이 Cycle 은 `master/frontier.md` 의 후보에서 오지 않았다.
                        기획서가 스스로 `[DIRECT-CYCLE]` 로 표시했고, Human 이
                        "관찰 관련된 내용으로 세계에 존재나 규칙에는 영향을 주지 않음.
                        이에 바로 cycle 진행" 이라고 착수를 지시했다.

                        **후보 등록을 건너뛴 것은 절차의 예외가 아니라 층의 구분이다.**
                        Master Layer 가 고르는 것은 "세계가 무엇을 더 할 수 있게 되는가"
                        이고, 이 Cycle 은 세계가 할 수 있는 일을 하나도 늘리지 않는다.
                        고를 것이 없는 자리에 후보를 세우면 Frontier 가 표면 작업으로
                        채워지고, 그것이 Master Layer 가 답하는 질문을 흐린다.

    Source Goal         없음 — 위 사유. 가짜 MG-* 를 만들지 않는다 (기획서 §11.1 지시)
    Source Possibility  없음 — 같은 사유. 가짜 MP-* 를 만들지 않는다
    Target Capability   없음 — **Capability 노드를 목표로 삼지 않는다.**
                        관찰은 할 수 있는 일을 늘리는 것이 아니라 이미 할 수 있는 일에
                        사람이 닿게 한다. `frontier.md` 의 후보 1·2 가 같은 사유로
                        노드를 목표로 삼지 않는다고 적어 둔 것과 같은 예외다

    Active Constraints  DC-WORLD-OWNS-THE-SURFACE-LIST
                        DC-ITEM-KIND-IS-DATA-NOT-BRANCH
                        DC-ITEM-CAPACITY-IS-FINITE
                        DC-ITEM-HOLDING-IS-NOT-APPLYING

    Constraint Note     **네 Constraint 가 전부 이 Cycle 을 좁히는 쪽으로 작동한다.**
                        화면을 크게 만드는 Cycle 에서 가장 하기 쉬운 일이 화면에 판정을
                        두는 것이기 때문이다.

                        SURFACE-LIST — 무엇이 되고 무엇이 왜 안 되는지의 목록은 세계가
                          싣는다. 넓은 표면이 생겼다고 화면이 "이건 지금 안 되겠지" 를
                          스스로 계산하지 않는다. 되는 것도 안 되는 사유도 받은 것을 옮긴다
                        KIND-IS-DATA — 새 표면에 종류 이름이 박히지 않는다. 아이템이
                          늘어도 이 Cycle 의 코드는 늘지 않아야 한다
                        CAPACITY-IS-FINITE — 남은 자리가 **공간으로** 읽혀야 한다.
                          숫자 한 줄로만 있으면 유한하다는 사실이 눈에 닿지 않는다
                        HOLDING-IS-NOT-APPLYING — 지닌 것과 걸어 둔 것은 한 화면에
                          있어도 같은 것으로 보이면 안 된다. 다만 걸어 둔 것을 **그리는
                          일 자체**는 이 Cycle 이 아니다 (아래 EXCLUDED · VUX-IE-02)

    Master Feedback     닫힐 때 `08-verification.md` 의 MASTER FEEDBACK 은
                        Capability Overlay 에 **아무 판정도 올리지 않는다** — 이 Cycle 이
                        Capability 를 건드리지 않기 때문이다. 올릴 것이 있다면 그것은
                        Constraint Evaluation 과, 표면이 드러낸 세계 쪽 결손뿐이다

## TYPE

    Existing Capability Enhancement — **관찰 표면**

    세계에 새 Capability 를 더하지 않는다. C020(쓰기·바닥) · C022(자리) · C023(적용) ·
    C024(교체) 가 이미 세운 의미를, 지금 가로 띠 한 줄과 self 패널 몇 줄로만 닿을 수
    있는 것을, 사람이 열어서 훑고 골라서 실행하는 하나의 자리로 만든다.

    **World Delta 는 NONE 이 기본이다.** Stage 3 이 새 World 의미를 하나도 더하지 않고
    닫히는 것이 이 Cycle 의 정상 결과다. 그렇게 닫히지 않는다면 그것은 표면이 세계에
    없는 사실을 요구했다는 뜻이고, 그때는 표면을 줄이거나 Stage 4 GAP 으로 돌린다 —
    화면 편의를 위해 세계에 규칙을 더하지 않는다.

## TARGET CAPABILITY

    Inventory 관찰 (View 표면)

    세계 쪽 대상은 없다. 이 Cycle 이 발전시키는 것은 `content/proto-adventure/view/` 의
    소지품 표현이며, 그것이 읽는 계약(`inventory` · `inventoryRoom`)은 그대로 둔다.

## GOAL

    플레이어가 한 손짓으로 소지품 자리를 열어, **무엇을 얼마나 지녔는지와 자리가
    얼마나 남았는지를 한눈에 보고**, 그중 하나를 골라 그 물건으로 지금 무엇이 되고
    무엇이 왜 안 되는지를 읽은 뒤, 되는 것 하나를 그 자리에서 실행할 수 있다.

    지금은 그럴 수 없다. 지닌 것은 가로 띠에 있고 그것으로 무엇이 되는지는 self 패널
    아래쪽 세로 목록에 있어서, **한 물건에 대한 답이 화면 두 곳에 흩어져 있다.**
    실행은 `B`·`N`·`M`·`,` 중 무엇을 먼저 눌렀는지를 사람이 기억해야 닿는다 —
    무엇을 고르고 있는지가 화면에 남지 않기 때문이다 (`view/bindings.ts` 의 `armed`).

    이 Cycle 이 끝나면 그 셋(무엇을 지녔나 · 그것으로 뭐가 되나 · 지금 뭘 고르고 있나)이
    **같은 자리에** 있다.

## INCLUDED

    소지품 작업 공간 자체     한 손짓으로 열고 닫는다. 열린 동안 다른 조작을 막지 않는다
    지닌 것의 격자            항목마다 한 칸 — 종류 · 수량 · 분류 표시
    남은 자리의 공간 표현     세계가 준 `used` / `capacity` 로 **빈 칸을 그린다**.
                              유한하다는 것이 숫자가 아니라 자리로 읽혀야 한다
    고르기와 그 자리의 상세   고른 칸 하나에 대해 세계가 실어 온 행동 전부 —
                              되는 것 · 안 되는 것 · 안 되는 사유
    자판만으로 닿는 길        열기 → 칸 사이 이동 → 고르기 → 되는 행동 하나 실행 → 닫기.
                              **지금의 두 걸음·세 걸음 조작을 대체하지 않고 나란히 둔다**
    실행 결과의 연결          보낸 뒤 응답 전까지 그 칸이 무엇을 기다리는지 보인다.
                              성공은 다음 관찰로, 거절은 세계가 준 사유로 읽힌다
    관찰만으로 도는 검증      세계 프로세스 없이 Fixture 로 화면 결정을 검증한다
                              (`VUX-IE-FX-EMPTY` · `-PARTIAL` · `-FULL` · `-STALE` · `-UNKNOWN`)

## EXCLUDED

    걸어 둔 것 패널           C023 의 여섯 자리를 이 작업 공간 안에 그리는 것.
                              **VUX-IE-02 의 몫이다.** 여기서 함께 하면 고르기 · 상세 ·
                              실행 피드백을 장비 화면 안에서 한 번 더 만들게 된다
                              (기획서 §11 의 "권장 첫 Cycle" 사유)
    미리 보기 · 비교          "걸면 값이 어떻게 달라지나" — 세계에 그 관찰이 아직 없다
                              (`frontier.md` 후보 1 FR-SEE-BEFORE-YOU-WEAR).
                              **화면이 `contributions` 를 더해 만들지 않는다**
    끌어다 놓기               조작 방식이며, 그 전에 옮길 자리가 세계에 없다
    자리 사이의 이동 · 정렬   `frontier.md` 후보 2 FR-ARRANGE-WHAT-YOU-CARRY 의 몫
    검색 · 필터               VUX-IE-04. 지금 세계가 아는 종류는 넷이다 — 훑기가 문제가
                              되지 않는 크기에서 거르개를 먼저 만들지 않는다
    겹친 묶음 나누기          세계에 그 행동이 없다 (후보 2)
    버리기 확인 절차          VUX-IE-05. 지금의 `discard-item` 은 그대로 잇는다 —
                              확인 Modal 을 이 Cycle 에서 새로 세우지 않는다
    좁은 화면(< 720px)        기획서 §2.3 이 지원 대상 밖으로 둔다
    새 World 규칙 · 새 State  World Delta 는 NONE 이 기본이다 (위 TYPE)
    기존 가로 띠의 제거       열지 않은 동안에도 지닌 것이 보이는 자리는 남는다.
                              작업 공간은 **더해지는 것**이지 대체하는 것이 아니다

## RELATED EXISTING CAPABILITY

    재사용 — 계약 쪽 (한 글자도 바뀌지 않기를 기대한다)
        inventory[]              C020 — 종류 · 수량 · 분류 · 유래 · 겹침 · 행동과 사유
        inventory[].actions[]    C020 쓰기 · C022 덜어내기 · C023 걸기 · C024 바꿔 걸기
        inventoryRoom            C022 — 쓴 자리와 전체. **화면이 세지 않는다**
        ActionRequest            C020 — `interactionId` + `itemKind`

    재사용 — 화면 쪽 (이 Cycle 이 발전시키는 자리)
        view/inventory-presentation.ts   지금의 띠와 self 줄. 표시 결정의 단일 출처
        view/code-text.ts                사유 코드 → 한국어. 모르는 코드는 코드 그대로
        view/kind-presentation.ts        종류 표시
        view/bindings.ts                 `B`·`N`·`M`·`,` 두·세 걸음 조작 — 남는다

    영향 가능
        view/equipment-presentation.ts   `EQUIP_ARM_KEY_LABEL` 등 손가락 자리 문구를
                                         소지품 쪽이 읽고 있다. 새 표면이 같은 문구를
                                         다시 적지 않도록 출처를 하나로 둔다
        engine/view-kernel/              **이 Cycle 에서 편집하지 않는다.**
                                         지금의 HUD Capability 에 격자도 고른 칸도 없다.
                                         Stage 7 이 기존 Capability 로 이 Goal 을 닫지
                                         못한다고 판정하면 `VIEW CAPABILITY GAP` 으로
                                         기반 트랙에 반환하고, 닿는 만큼의 Vertical
                                         Slice 부터 닫는다 (기획서 §10)

## 이 Cycle 이 먼저인 이유

    기획서가 VUX-IE-01 을 첫 칸으로 둔 근거는 순서가 아니라 **중복**이다.
    고르기 · 자판 초점 · 상세 · 실행 피드백은 이후 네 Cycle 이 전부 쓰는 것이고,
    장비 화면부터 시작하면 그 넷을 장비 안에서 만든 뒤 가방에서 한 번 더 만들게 된다.

    그리고 지금 세계에는 이 표면이 답할 것이 이미 다 있다 — 지닌 것, 남은 자리, 되는 것,
    안 되는 사유까지 네 Cycle 에 걸쳐 계약에 실렸다. **없는 것은 그것을 보는 자리뿐이다.**
