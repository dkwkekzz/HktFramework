# Frontier

**지금 고를 수 있는 후보**와 **지금 도는 것**만 담는다. Human 이 여기서 하나를 골라
다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle). Cycle 로 넘어가는 것은
선택된 후보 블록의 MASTER TRACE 칸들이다 — 그 외 절은 Human 선택 자료다.

    기준 Overlay   master/overlay.md — C019(선딜) 완료 + 아이템(IS) 주입 반영
    진행 현황      사다리가 어디까지 섰는지는 graph/GRAPH.md 의 "척추" 절이 그린다.
                   후보를 읽는 법과 이 파일의 규칙은 guides/master-frontier.md 소유다

## 한눈에 보기

| # | 기능 | 이것이 무엇인가 | 세계에 없는 것 | 크기 |
|---|---|---|---|---|
| 1 | **아이템의 바닥** | 세계가 아이템을 정의하고, 가진 것 전부가 한 계약으로 보이며, 써서 몸이나 세계를 바꾸고 그만큼 줄어든다 | 정의 · 소지 관찰 · 쓴다 · 없어진다 넷 다 | 중간 |

## 후보

### 1. FR-WHAT-YOU-CARRY-CAN-BE-SPENT — 아이템의 바닥

    이것이 무엇인가    물건이 **세계가 정의한 것**이 되고, **담을 자리가 유한한 곳**에
                       들어가며, 가진 것을 **써서** 몸이나 세계를 바꾸고, 쓴 만큼
                       **줄어든다**. 지금 인벤토리는 종류별 개수만 있고, 그 개수를 읽는
                       곳은 "곡괭이가 있는가" 하나뿐이다. 담을 자리라는 개념도 없어
                       얼마를 지니든 아무 일도 일어나지 않는다.
                       쓴다 · 준다 · 없어진다 는 개념이 0건이다.
    세계에 생기는 것    ① 아이템의 정의소 — 무엇인가 · 무엇에 쓰는가 · 겹칠 수 있는가를
                          세계가 소유하고, 규칙은 종류 이름을 묻지 않는다
                       ② 담을 자리가 유한해진다 — 칸 · 겹칠 수 있는 한도 · 가득 참 판정.
                          받을 수 없으면 왜 못 받는지가 함께 오고, 들어가지 못한 것은
                          세계에 그대로 남는다 (IE §3.1 · §5 · §6)
                       ③ 가진 것 전부가 하나의 관찰 계약으로 나온다 — 종류 · 수량 ·
                          지금 가능한 행동 · 불가 사유 (돌 전용 칸이 사라진다)
                       ④ 물건을 쓰는 행동 — 다른 행동과 같은 시간 · 대상 · 중단 규칙을 진다
                       ⑤ 쓰면 줄어든다 — 세계 최초로 가진 것이 사라진다
                       ⑥ 효과와 수량은 한 단위다 — 실패한 사용도, 다 담기지 못한 획득도
                          흔적을 남기지 않는다 (IE §6.1)
    이 기능이 아닌 것   제작이 아니다 (재료를 다른 것으로 바꾸는 것은 다음 칸).
                       장착이 아니다 (몸에 적용해 유지하는 것도 다음 칸 — 그래서 이번에
                       능력치를 바꾸는 물건은 정의하지 않는다).
                       몸 밖의 아이템이 아니다 (줍기 · 버리기 · 전리품은 넷째 칸).
                       거래가 아니다. **무게 · 부피가 아니다** — 유한해지는 것은 칸이지
                       무게가 아니다 (IE 는 무게 시스템을 요구하지 않는다).
                       내구도 · 강화 · 귀속도 아니다 — 그것들이 필요해질 때 개체 모델을
                       연다 (IS §2.1).
                       가방을 늘리는 확장 시스템도 아니다 — 칸 수는 이 Cycle 이 정하는
                       하나의 값이고, 그 값을 바꾸는 규칙은 다음 이야기다 (IE §3.1).
                       **회복 아이템도 아니다** — 그 원천(식물 계통)이 세계에 없으므로
                       이 Cycle 은 MC-RESTORE-BIOLOGICAL-STATE 를 닫지 않는다.
                       다음 Cycle 이 원천과 함께 가져온다 (HISTORY Q31).
                       **쓴다는 개념과 그 바닥이 이 후보의 전부다**
    이미 있는 것        종류별 개수를 지닌 인벤토리와 캐서 늘어나는 경로가 있다
                       (`world/rules/mine.ts`). 행동으로서의 얼개(시간 · 대상 · 중단 ·
                       실패 사유)도 있다. 지금 무엇이 왜 안 되는지를 싣는 가능/사유
                       계약도 있다 (`protocol/gameview.ts`). 고른 대상을 읽는 관계도
                       C017 로 서 있어 대상형 아이템이 그대로 쓴다.
                       조건을 곱해 합성하는 얼개도 있다 (MC-CONDITION-STACKING) —
                       지속 효과는 그 위에 얹는다
    Playable Result    가진 것을 써서 세계나 자기 몸을 바꾸고, 쓴 만큼 줄어드는 것을 본다.
                       담을 자리가 차면 더 캐도 받지 못하고, 무엇을 버릴지가 판단이 된다
    Observable Result  소지품 전체가 칸 단위로 한자리에 보이고(쓴 칸 / 전체), 그중 지금 쓸 수
                       있는 것과 왜 못 쓰는지가 함께 온다. 쓰면 상태가 달라지고 수량이 준다.
                       가득 찬 상태로 캐면 사유와 함께 거절되고 세계의 것은 그대로 남는다.
                       실패하면 상태도 수량도 그대로다. 신규 아이템을 정의에 더해도 규칙
                       코드는 열리지 않는다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE 의 첫 칸
    Missing / Partial  MC-USE-ITEM (MISSING) — IS 주입으로 선 노드다.
                       MC-RESTORE-BIOLOGICAL-STATE · MC-CUT-ABNORMAL-STRUCTURE (둘 다
                       MISSING) 와 MC-EQUIP-ITEM · MC-CRAFT-FROM-MATERIALS ·
                       MC-TRANSFER-ITEM 의 **공통 앞칸**이다. MC-ATTACK-POWER (PARTIAL) 의
                       결손("세계 안의 행위로 값을 바꿀 경로가 없다")도 같은 뿌리다
    원본 근거          IS §4 · §5.1~§5.3 · §5.5(소모) · §6 (Cycle 경계 1) ·
                       IE §3.1 · §4 · §5 · §6 · §6.1 · §27 · §29~§33 · §48 (Cycle 1 행) ·
                       BW §17 (탐험에서 얻은 자원이 다음 탐험의 가능성을 연다) ·
                       BW §18 (능력이 먼저 필요해지고 그 다음 획득 경로) ·
                       Q22 로 선 광물 계통 (IP 5 · IT 6 · IM 3)
    Active Constraints DC-WORLD-PROGRESSION-IS-REACH · DC-WORLD-RESOURCE-ADAPTATION-TRACE ·
                       DC-GROWTH-NEED-FROM-POSSIBILITY · DC-GROWTH-GOAL-FIRST ·
                       DC-WORLD-OWNS-THE-SURFACE-LIST ·
                       **DC-ITEM-KIND-IS-DATA-NOT-BRANCH** ·
                       **DC-ITEM-CHANGE-IS-ONE-UNIT** ·
                       **DC-ITEM-CAPABILITY-COMES-FROM-GRANTS** ·
                       **DC-ITEM-CAPACITY-IS-FINITE**
    Constraint Eval    SATISFIED — 물건이 능력을 정당화하지 않는다. 이 후보는 새 능력을
                       만들지 않고 **이미 필요하다고 판정된 것들의 공통 전제**를 세운다
                       (NEED-FROM-POSSIBILITY). 성장 자체를 Goal 로 세우지 않는다
                       (GOAL-FIRST). 지금 캐는 돌은 세계 유래를 가진다 (Q22).
                       쓸 수 있는 것의 목록과 불가 사유를 세계가 싣는다 (SURFACE-LIST).
                       아이템 셋은 이 후보가 지고 갈 원칙이다 — 특히
                       CAPABILITY-COMES-FROM-GRANTS 가 채굴 판정을 "든 것이 곡괭이인가"
                       에서 "이 몸에 채굴 용도가 지금 있는가" 로 바꾼다.
                       CAPACITY-IS-FINITE 는 이 Cycle 이 칸이라는 개념을 세우되 그 수를
                       규칙에 박지 않게 한다 — 값은 03-world-semantic.md 가 소유한다.
                       DC-ITEM-LIVES-IN-ONE-PLACE 는 이 Cycle 의 대상이 아니다 —
                       저장소가 아직 하나뿐이라 위반할 자리가 없다 (장착 Cycle 이 진다)
    Why one Cycle      새 전투 규칙도 새 자원도 없다 — 행동 하나와 "줄어든다" 는 상태 변화
                       하나다. 다섯(정의 · 자리 · 관찰 · 사용 · 소모)이 한 몸인 이유:
                       정의만 세우면 플레이어가 할 수 있는 일이 하나도 늘지 않고,
                       자리만 세우면 담을 것이 늘 뿐 쓸 수 없으며, 관찰만 바꾸면 보이는
                       것만 달라지고, 사용만 넣으면 종류별 분기가 다시 늘어나며, 소모가
                       빠지면 "쓴다" 가 아무 대가 없는 버튼이 된다 (IS §6 · IE §48).
                       자리가 이 Cycle 에 함께 오는 이유는 따로 있다 — 칸이 없으면
                       "가득 찼다" 도 없고, 그러면 소모가 만드는 압박이 반쪽이 된다.
                       캐서 줄어들 뿐 무엇을 들고 다닐지는 여전히 선택이 아니다
                       (Q34 · IE §48 Cycle 1)
    7 조건             1 MISSING · 2 자원 갈래 전체의 첫 칸을 연다 · 3 Client 실측 가능 ·
                       4 한 Cycle (위 문단) · 5 새 World 규칙(가진 것이 사라진다 ·
                       담을 자리가 유한하다) · 6 Active 와 양립 — 아이템 DC 는 이제
                       5종 전부 Active 다 (Q30 · Q32) ·
                       7 장착 · 제작 · 세계의 아이템이 이 위에 얹힌다
    Status             SELECTED

## 추천 순서 (Agent 제안 — 확정은 Human)

```text
1. 아이템의 바닥    가장 크게 막힌 축(자원 → 능력)의 첫 칸. IS 주입으로 그 축이 네 조각
                    (쓴다 · 적용한다 · 만든다 · 주고받는다)으로 나뉘었고, 뒤의 셋과
                    회복 · 절단 · 능력치 획득 · 전리품이 모두 이 하나를 기다린다.
                    지고 갈 Constraint 넷은 이미 Active 다 (constraints/README.md)
```

지금 후보는 하나다 — 전투 쪽 후보(선딜)가 C019 로 닫혔고, 다음 전투 층(능동 방어)은
설계 문서를 기다린다 ("지금 열 수 없는 것"). 하나뿐이라고 그 하나가 자동으로 다음
Cycle 이 되지는 않는다: 고르는 것은 Human 이고, 아래 `SELECTED` 가 그 선택이다.

## SELECTED

```text
FR-WHAT-YOU-CARRY-CAN-BE-SPENT — 아이템의 바닥
Human 선택 (Q32 · Q33 · Q34 승인과 함께)
```

Cycle Stage 1 이 이것을 `01-cycle.md` 의 `MASTER TRACE` 로 받는다.

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **장착** (MC-EQUIP-ITEM) | 선택된 후보(아이템의 바닥)가 먼저다 — 이것이 서야 `IM-*` 의 grants 가 몸에 닿고, MC-ATTACK-POWER · MC-PENETRATION · 치명을 세계 안에서 얻는 경로가 처음 생긴다 (IS §6 Cycle 2). 장착·인벤토리 기획 문서는 **도착해 주입까지 끝났고 그 DC 2종도 Active 다** (`design/Design-Inventory-Equipment-D1.md` · Q32). 이 칸을 막는 것은 이제 순서 하나뿐이다 — 바닥이 먼저 서야 한다 (IE §48 Cycle 2) |
| **제작** (MC-CRAFT-FROM-MATERIALS) | 바닥과 장착이 차례로 먼저다 — 소모가 서야 재료가 줄고, 장착이 서야 만든 것이 쓸모를 갖는다 (IS §6 Cycle 3) |
| **세계의 아이템** (MC-TRANSFER-ITEM) | 몸 안의 규칙이 다 선 뒤다. 이것이 서면 쓰러진 몸에서 무언가가 나오고, 존재가 세계에서 사라지는 첫 경로가 생겨 C017 의 미도달 규칙 하나도 함께 닫힌다 (IS §6 Cycle 4 · §5.6) |
| 감정 도구 | 위 셋 뒤. 지금은 감정할 대상(개체 상태)도 없다 |
| 능동 방어 · Aura/Nen · 베이라 사다리의 잠정 조각 전부 | 그 전체의 설계 문서가 없다 (`part_of.grounded: false` — 척추 시각화의 점선). 능동 방어가 요구하는 **행동 안의 시점 판정**은 C019 로 바닥이 섰다 — 남은 것은 문서뿐이다 |
| 다음 수를 읽는다 (MC-PREDICT · MC-OBSERVE 습성) | 위와 같음 — 반쪽을 소유한 시스템(MS-CREATURE-BEHAVIOR)이 DRAFT 다. 초안 [design/Design-Creature-Behavior-R0.md](../../../design/Design-Creature-Behavior-R0.md) 승인 → Inject → 재판정 |
| 지형 · 문명권 준비 갈래 · 희귀 기관 갈래 | 세계 기반(지역 · 문명권 · 거래 주체)이 없다 (overlay.md World 표 ABSENT). 희귀 기관 쪽은 그 위에 **세계의 아이템**(위 칸)까지 필요하다 — IS 주입으로 공통 앞칸이 드러났다 |
| 위협도 · 진영 · 도발 | 막는 것은 없다 (HOSTILITY_REASONS 에 항목 추가로 시작) — 아직 어느 Possibility 도 요구하지 않는다 (7 조건 2) |
| Tab 후보 추리기 · 대상 프레임 관계 표시 | 세계의 결손이 아니라 화면의 편의 — Cycle 이 아니라 View 작업 |
| 회피 (MC-EVADE) | R1 §13 이 이후 확장으로만 지정 |

**후보로 올리지 않은 결손 하나**: 기력이 스스로 돌아오지 않는다 (MC-CP-ECONOMY PARTIAL).
어느 상위 갈래를 전진시키는지 근거 문서가 말하지 않아 7 조건 2 를 세울 수 없다 —
밸런스로 다룰지 규칙으로 세울지는 Human 판단이다.
