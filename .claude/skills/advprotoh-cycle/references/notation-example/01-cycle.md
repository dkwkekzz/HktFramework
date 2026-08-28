# CYCLE C026 — Open What You Carry

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[PASS] World Implementation
[PASS] View Implementation
[PASS] Verification

STATUS  COMPLETE

> 번호 이동 C025 → C026 — 레인 B 의 `C025-the-shape-is-data` 가 먼저 병합됨.
> 번호만 바뀌었고 의미·범위·판정은 그대로다 (경위: git).

## MASTER TRACE

    Frontier            없음 — DIRECT OBSERVATION (VUX-IE-D1 §11·§11.1:
                        content/proto-adventure/design/Design-View-Inventory-Equipment-UX-D1.md).
                        기획서가 [DIRECT-CYCLE] 로 표시, Human 이 착수 지시.
                        세계의 Capability 를 하나도 늘리지 않으므로 Master 가 고를 것이
                        없다 — 가짜 MG-*/MP-*/MC-* 를 만들지 않는다 (§11.1).
                        첫 칸 근거: 고르기·초점·상세·실행 피드백을 이후 네 Cycle 이
                        전부 재사용한다 (§11 중복 사유)
    Source Goal         없음 — 같은 사유
    Source Possibility  없음 — 같은 사유
    Target Capability   없음 — 관찰은 할 수 있는 일을 늘리지 않고 닿게 한다
    Active Constraints  DC-WORLD-OWNS-THE-SURFACE-LIST     되는 것·안 되는 사유는 받은 것만 옮긴다 — 화면이 계산하지 않는다
                        DC-ITEM-KIND-IS-DATA-NOT-BRANCH    새 표면에 종류 이름이 박히지 않는다 — 아이템이 늘어도 코드 불변
                        DC-ITEM-CAPACITY-IS-FINITE         남은 자리를 숫자가 아니라 공간으로 그린다
                        DC-ITEM-HOLDING-IS-NOT-APPLYING    지닌 것 ≠ 걸어 둔 것 — 걸어 둔 것을 그리는 일은 이 Cycle 이 아니다 (VUX-IE-02)
    Master Feedback     Capability Overlay 에 올릴 판정 없음 — Constraint Evaluation 과
                        표면이 드러낸 세계 쪽 결손만 보고한다

## TYPE

    Existing Capability Enhancement — 관찰 표면.
    World Delta NONE 이 기본 — Stage 3 이 새 의미 없이 닫히는 것이 정상 결과다.
    무언가 더 필요해지면 표면을 줄이거나 Stage 4 GAP 으로 돌린다 — 화면 편의로
    세계에 규칙을 더하지 않는다.

## TARGET CAPABILITY

    Inventory 관찰 (View 표면) — 발전 대상은 view/ 의 소지품 표현.
    읽는 계약(inventory · inventoryRoom)은 불변을 기대한다.

## GOAL

    플레이어가 한 손짓으로 소지품 자리를 열어, 무엇을 얼마나 지녔고 자리가 얼마나
    남았는지 한눈에 보고, 하나를 골라 그것으로 지금 무엇이 되고 무엇이 왜 안 되는지
    읽은 뒤, 되는 것 하나를 그 자리에서 실행한다.

    현재 결손   한 물건의 답이 두 곳에 흩어져 있다 (가로 띠 + self 패널 세로 목록) ·
                실행은 B·N·M·, 의 순서를 기억해야 닿는다 — 무엇을 고르고 있는지가
                화면에 없다 (view/bindings.ts 의 armed)

## INCLUDED

    작업 공간          한 손짓으로 여닫는다 · 열린 동안 다른 조작을 막지 않는다
    지닌 것의 격자     항목마다 한 칸 — 종류 · 수량 · 분류
    남은 자리          세계가 준 used/capacity 로 빈 칸을 그린다 — 자리로 읽히게
    고르기 · 상세      고른 칸의 행동 전부 — 되는 것 · 안 되는 것 · 안 되는 사유
    자판 경로          열기 → 이동 → 고르기 → 실행 → 닫기. 기존 두·세 걸음 조작은
                       대체하지 않고 병행한다
    실행 피드백        응답 전까지 대기 표시 · 성공 = 다음 관찰 · 거절 = 세계의 사유
    Fixture 검증       세계 프로세스 없이 화면 결정 검증
                       (VUX-IE-FX-EMPTY · -PARTIAL · -FULL · -STALE · -UNKNOWN)

## EXCLUDED

    걸어 둔 것 패널      VUX-IE-02 소유 — 여기서 하면 고르기·상세·피드백을 두 번 만든다
    미리 보기 · 비교     세계에 그 관찰 없음 — FR-SEE-BEFORE-YOU-WEAR 소유.
                         화면이 contributions 를 더해 만들지 않는다
    끌어다 놓기          옮길 자리가 세계에 없다
    이동 · 정렬          FR-ARRANGE-WHAT-YOU-CARRY 소유
    검색 · 필터          VUX-IE-04 — 종류 넷에서 거르개를 먼저 만들지 않는다
    묶음 나누기          세계에 그 행동 없음 (후보 2)
    버리기 확인 절차     VUX-IE-05 — 기존 discard-item 그대로
    좁은 화면(<720px)    기획서 §2.3 지원 밖
    새 World 규칙·State  World Delta NONE (TYPE)
    가로 띠 제거         작업 공간은 더해지는 것 — 대체가 아니다

## RELATED EXISTING CAPABILITY

    재사용 — 계약 (불변 기대)
        inventory[] · inventory[].actions[]   C020 · C022 · C023 · C024
        inventoryRoom                         C022 — 화면이 다시 세지 않는다
        ActionRequest                         C020 — interactionId + itemKind
    재사용 — 화면 (발전 자리)
        view/inventory-presentation.ts · code-text.ts · kind-presentation.ts ·
        bindings.ts (두·세 걸음 조작 — 남는다)
    영향 가능
        view/equipment-presentation.ts   손가락 자리 문구 — 출처를 하나로 유지
        engine/view-kernel               편집 금지. 기존 Capability 로 못 닫으면
                                         VIEW CAPABILITY GAP 으로 기반 트랙 반환 (기획서 §10)
