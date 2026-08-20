# Frontier

**지금 고를 수 있는 후보**와 **지금 도는 것**만 담는다. Human 이 여기서 하나를 골라
다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle). Cycle 로 넘어가는 것은
선택된 후보 블록의 MASTER TRACE 칸들이다 — 그 외 절은 Human 선택 자료다.

    기준 Overlay   master/overlay.md — C017(지목) · C018(관계) 완료 + 아이템(IS) 주입 반영
    진행 현황      사다리가 어디까지 섰는지는 graph/GRAPH.md 의 "척추" 절이 그린다.
                   후보를 읽는 법과 이 파일의 규칙은 guides/master-frontier.md 소유다

## 한눈에 보기

| # | 기능 | 이것이 무엇인가 | 세계에 없는 것 | 크기 |
|---|---|---|---|---|
| 1 | **행동 구간** | 행동의 시간이 준비·발동·회수로 나뉘고, 그 구간이 관찰되고 **취소 판정에 쓰인다** | 구간의 **의미** (구간 자체는 있다) | 중간 |
| 2 | **아이템의 바닥** | 세계가 아이템을 정의하고, 가진 것 전부가 한 계약으로 보이며, 써서 몸이나 세계를 바꾸고 그만큼 줄어든다 | 정의 · 소지 관찰 · 쓴다 · 없어진다 넷 다 | 중간 |

## 후보

### 1. FR-ACTION-PHASE — 행동 구간

    이것이 무엇인가    행동의 시간이 **준비 · 발동 · 회수** 세 구간으로 나뉘고, 그 비율이
                       행동마다 다르며, 준비 구간이 의미로 관찰되고 **판정에 쓰인다** —
                       그 구간에 조건이 닿으면 행동이 취소된다.
                       구간 자체는 이미 있다. 없는 것은 그 구간의 **의미**다.
    세계에 생기는 것    ① 행동마다 다른 구간 비율 — 큰 것일수록 준비가 길다
                       ② 준비 구간이 의미로 관찰된다 — "준비 중인가 이미 나갔는가"
                       ③ 준비 구간에 조건이 닿으면 그 행동이 **취소된다** — 발동하지 않는다
                       ④ 취소된 행동의 대가 — 치른 것은 돌아오지 않는다
                       ⑤ 자율 존재도 같은 규칙을 진다 — 예외를 갖지 않는다
    이 기능이 아닌 것   경직·기절 같은 상태가 아니다 (끊는 것과 묶는 것은 다르다).
                       되받아치기가 아니다 (취소한 뒤의 이득은 오지 않는다).
                       확률·회피가 아니다. **무엇이 올지를 읽는 것도 아니다** —
                       그것은 보류된 예측 갈래이고, 이것은 눈에 보이는 준비 동작을
                       판정에 쓰는 쪽이다 (시계가 다르다 — 이것은 행동 안, 예측은 행동 앞).
                       막기를 행동으로 편입하는 것도 아니다
    이미 있는 것        **행동은 이미 세계의 개념이다** — 모든 존재는 언제나 정확히 하나의
                       행동 안에 있고, 종류·소요 시간·대상·진행도를 지니며 진행도가
                       관찰에 실린다. 휘두름의 구간도 이미 있다 (`world/semantic/collision.ts`
                       SWING_BEGIN · SWING_END). 맞으면 하던 행동이 끊기는 규칙도 이미 있다
                       (RULE-HIT-001). 더할 것은 비율 · 의미 노출 · 취소 판정 셋이다
    Playable Result    상대의 행동이 완성되기 전에 그 구간을 노려 끊는다 —
                       늦으면 이미 칼이 나가 끊기지 않는다
    Observable Result  상대가 준비 중인지 이미 나갔는지가 화면에서 구분되고, 큰 행동일수록
                       준비가 길다. 준비 중에 넣은 개입은 그 행동을 무산시키고, 같은 개입을
                       늦게 넣으면 무산되지 않는다. 아무것도 안 하면 그대로 맞는다
    Source Goal        MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility MP-INTERRUPT
    Missing / Partial  MC-INTERRUPT (PARTIAL) — 끊김 규칙은 있고 **노리는 수단**이 없다.
                       그 수단이 곧 구간의 의미다
    원본 근거          BW §28 (범용 전투 그래프의 여덟 갈래 중 하나) ·
                       BW §23 (DANGER 층이 요구하는 넷 중 하나)
    Active Constraints DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-ONE-FORMULA ·
                       DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval    SATISFIED — 취소는 확률이 아니라 시점 관계로 판정된다
                       (PLAYER-CAUSALITY). 피해 공식을 건드리지 않는다 (ONE-FORMULA).
                       능동 방어 · Critical · Aura 를 손대지 않는다 (ONE-LAYER).
                       무엇이 왜 취소되었는지를 세계가 싣는다 (SURFACE-LIST)
    Why one Cycle      새 공식도 새 자원도 없다 — 이미 있는 구간에 의미를 주고, 이미 있는
                       끊김 규칙에 조건 하나와 그것을 읽을 표면 하나가 붙는다.
                       셋(비율·노출·취소 판정)이 한 몸인 이유: 노출만 하면 이름표 붙이기,
                       취소만 넣으면 "아무 때나 때리면 끊긴다", 비율이 하나로 고정된 채로는
                       사람이 반응할 시간 자체가 없다 — 하나만으로는 닫히지 않는다
    7 조건             1 PARTIAL · 2 다섯 번째 전투 경로를 연다 · 3 Client 실측 가능 ·
                       4 한 Cycle (위 문단) · 5 새 World 규칙(행동에는 끊길 수 있는
                       구간이 있다) · 6 Active 와 양립 · 7 되받아치기 · 완벽한 막기 ·
                       DANGER 층 요구가 이 위에 얹힌다
    Status             PROPOSED

### 2. FR-WHAT-YOU-CARRY-CAN-BE-SPENT — 아이템의 바닥

    이것이 무엇인가    물건이 **세계가 정의한 것**이 되고, 가진 것을 **써서** 몸이나 세계를
                       바꾸며, 쓴 만큼 **줄어든다**. 지금 인벤토리는 종류별 개수만 있고,
                       그 개수를 읽는 곳은 "곡괭이가 있는가" 하나뿐이다.
                       쓴다 · 준다 · 없어진다 는 개념이 0건이다.
    세계에 생기는 것    ① 아이템의 정의소 — 무엇인가 · 무엇에 쓰는가 · 겹칠 수 있는가를
                          세계가 소유하고, 규칙은 종류 이름을 묻지 않는다
                       ② 가진 것 전부가 하나의 관찰 계약으로 나온다 — 종류 · 수량 ·
                          지금 가능한 행동 · 불가 사유 (돌 전용 칸이 사라진다)
                       ③ 물건을 쓰는 행동 — 다른 행동과 같은 시간 · 대상 · 중단 규칙을 진다
                       ④ 쓰면 줄어든다 — 세계 최초로 가진 것이 사라진다
                       ⑤ 효과와 수량은 한 단위다 — 실패한 사용은 흔적을 남기지 않는다
    이 기능이 아닌 것   제작이 아니다 (재료를 다른 것으로 바꾸는 것은 다음 칸).
                       장착이 아니다 (몸에 적용해 유지하는 것도 다음 칸 — 그래서 이번에
                       능력치를 바꾸는 물건은 정의하지 않는다).
                       몸 밖의 아이템이 아니다 (줍기 · 버리기 · 전리품은 넷째 칸).
                       거래가 아니다. 무게 · 칸수 같은 소지 제한도 아니다.
                       내구도 · 강화 · 귀속도 아니다 — 그것들이 필요해질 때 개체 모델을
                       연다 (IS §2.1). **쓴다는 개념과 그 바닥이 이 후보의 전부다**
    이미 있는 것        종류별 개수를 지닌 인벤토리와 캐서 늘어나는 경로가 있다
                       (`world/rules/mine.ts`). 행동으로서의 얼개(시간 · 대상 · 중단 ·
                       실패 사유)도 있다. 지금 무엇이 왜 안 되는지를 싣는 가능/사유
                       계약도 있다 (`protocol/gameview.ts`). 고른 대상을 읽는 관계도
                       C017 로 서 있어 대상형 아이템이 그대로 쓴다.
                       조건을 곱해 합성하는 얼개도 있다 (MC-CONDITION-STACKING) —
                       지속 효과는 그 위에 얹는다
    Playable Result    가진 것을 써서 세계나 자기 몸을 바꾸고, 쓴 만큼 줄어드는 것을 본다
    Observable Result  소지품 전체가 한자리에서 보이고, 그중 지금 쓸 수 있는 것과 왜 못 쓰는지가
                       함께 온다. 쓰면 상태가 달라지고 수량이 준다. 실패하면 상태도 수량도
                       그대로다. 신규 아이템을 정의에 더해도 규칙 코드는 열리지 않는다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE 의 첫 칸
    Missing / Partial  MC-USE-ITEM (MISSING) — IS 주입으로 선 노드다.
                       MC-RESTORE-BIOLOGICAL-STATE · MC-CUT-ABNORMAL-STRUCTURE (둘 다
                       MISSING) 와 MC-EQUIP-ITEM · MC-CRAFT-FROM-MATERIALS ·
                       MC-TRANSFER-ITEM 의 **공통 앞칸**이다. MC-ATTACK-POWER (PARTIAL) 의
                       결손("세계 안의 행위로 값을 바꿀 경로가 없다")도 같은 뿌리다
    원본 근거          IS §4 · §5.1~§5.3 · §5.5(소모) · §6 (Cycle 경계 1) ·
                       BW §17 (탐험에서 얻은 자원이 다음 탐험의 가능성을 연다) ·
                       BW §18 (능력이 먼저 필요해지고 그 다음 획득 경로) ·
                       Q22 로 선 광물 계통 (IP 5 · IT 6 · IM 3)
    Active Constraints DC-WORLD-PROGRESSION-IS-REACH · DC-WORLD-RESOURCE-ADAPTATION-TRACE ·
                       DC-GROWTH-NEED-FROM-POSSIBILITY · DC-GROWTH-GOAL-FIRST ·
                       DC-WORLD-OWNS-THE-SURFACE-LIST ·
                       **DC-ITEM-KIND-IS-DATA-NOT-BRANCH (DRAFT)** ·
                       **DC-ITEM-CHANGE-IS-ONE-UNIT (DRAFT)** ·
                       **DC-ITEM-CAPABILITY-COMES-FROM-GRANTS (DRAFT)**
    Constraint Eval    SATISFIED — 물건이 능력을 정당화하지 않는다. 이 후보는 새 능력을
                       만들지 않고 **이미 필요하다고 판정된 것들의 공통 전제**를 세운다
                       (NEED-FROM-POSSIBILITY). 성장 자체를 Goal 로 세우지 않는다
                       (GOAL-FIRST). 지금 캐는 돌은 세계 유래를 가진다 (Q22).
                       쓸 수 있는 것의 목록과 불가 사유를 세계가 싣는다 (SURFACE-LIST).
                       **단 DRAFT 셋은 Human 승인 전이다 — open-questions Q30 을
                       이 후보 선택과 함께 답해야 한다**
    Why one Cycle      새 전투 규칙도 새 자원도 없다 — 행동 하나와 "줄어든다" 는 상태 변화
                       하나다. 넷(정의 · 관찰 · 사용 · 소모)이 한 몸인 이유: 정의만 세우면
                       플레이어가 할 수 있는 일이 하나도 늘지 않고, 관찰만 바꾸면 보이는
                       것만 달라지며, 사용만 넣으면 종류별 분기가 다시 늘어나고, 소모가
                       빠지면 "쓴다" 가 아무 대가 없는 버튼이 된다 (IS §6)
    7 조건             1 MISSING · 2 자원 갈래 전체의 첫 칸을 연다 · 3 Client 실측 가능 ·
                       4 한 Cycle (위 문단) · 5 새 World 규칙(가진 것이 사라진다) ·
                       6 Active 와 양립 (DRAFT 셋은 Q30) ·
                       7 장착 · 제작 · 세계의 아이템이 이 위에 얹힌다
    Status             PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

```text
1. 아이템의 바닥    가장 크게 막힌 축(자원 → 능력)의 첫 칸. IS 주입으로 그 축이 네 조각
                    (쓴다 · 적용한다 · 만든다 · 주고받는다)으로 나뉘었고, 뒤의 셋과
                    회복 · 절단 · 능력치 획득 · 전리품이 모두 이 하나를 기다린다.
                    고르기 전에 open-questions Q30(Constraint 넷 승인)을 함께 답한다

2. 행동 구간        전투 후보 중 가장 값싸다 — 구간도 끊김 규칙도 이미 있어, 더할 것은
                    비율 · 노출 · 취소 판정 셋이다. DANGER 층 요구도 미리 채우고,
                    능동 방어층이 설 때 필요한 시점 판정의 바닥이 여기서 생긴다
```

두 후보는 서로를 요구하지 않는다 — 어느 쪽을 먼저 해도 다른 쪽이 좁아지지 않는다.

## SELECTED

```text
없음 — Human 선택 대기
```

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **장착** (MC-EQUIP-ITEM) | 후보 2(아이템의 바닥)가 먼저다. 그 뒤 바로 후보가 된다 — 이것이 서야 `IM-*` 의 grants 가 몸에 닿고, MC-ATTACK-POWER · MC-PENETRATION · 치명을 세계 안에서 얻는 경로가 처음 생긴다 (IS §6 Cycle 2) |
| **제작** (MC-CRAFT-FROM-MATERIALS) | 후보 2 와 장착이 차례로 먼저다 — 소모가 서야 재료가 줄고, 장착이 서야 만든 것이 쓸모를 갖는다 (IS §6 Cycle 3) |
| **세계의 아이템** (MC-TRANSFER-ITEM) | 몸 안의 규칙이 다 선 뒤다. 이것이 서면 쓰러진 몸에서 무언가가 나오고, 존재가 세계에서 사라지는 첫 경로가 생겨 C017 의 미도달 규칙 하나도 함께 닫힌다 (IS §6 Cycle 4 · §5.6) |
| 감정 도구 | 위 셋 뒤. 지금은 감정할 대상(개체 상태)도 없다 |
| 능동 방어 · Aura/Nen · 베이라 사다리의 잠정 조각 전부 | 그 전체의 설계 문서가 없다 (`part_of.grounded: false` — 척추 시각화의 점선) |
| 다음 수를 읽는다 (MC-PREDICT · MC-OBSERVE 습성) | 위와 같음 — 반쪽을 소유한 시스템(MS-CREATURE-BEHAVIOR)이 DRAFT 다. 초안 [design/Design-Creature-Behavior-R0.md](../../../design/Design-Creature-Behavior-R0.md) 승인 → Inject → 재판정 |
| 지형 · 문명권 준비 갈래 · 희귀 기관 갈래 | 세계 기반(지역 · 문명권 · 거래 주체)이 없다 (overlay.md World 표 ABSENT). 희귀 기관 쪽은 그 위에 **세계의 아이템**(위 칸)까지 필요하다 — IS 주입으로 공통 앞칸이 드러났다 |
| 위협도 · 진영 · 도발 | 막는 것은 없다 (HOSTILITY_REASONS 에 항목 추가로 시작) — 아직 어느 Possibility 도 요구하지 않는다 (7 조건 2) |
| Tab 후보 추리기 · 대상 프레임 관계 표시 | 세계의 결손이 아니라 화면의 편의 — Cycle 이 아니라 View 작업 |
| 회피 (MC-EVADE) | R1 §13 이 이후 확장으로만 지정 |

**후보로 올리지 않은 결손 하나**: 기력이 스스로 돌아오지 않는다 (MC-CP-ECONOMY PARTIAL).
어느 상위 갈래를 전진시키는지 근거 문서가 말하지 않아 7 조건 2 를 세울 수 없다 —
밸런스로 다룰지 규칙으로 세울지는 Human 판단이다.
