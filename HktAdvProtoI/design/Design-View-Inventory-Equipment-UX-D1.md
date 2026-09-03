# `[VUX-IE]` Inventory & Equipment 관찰 UI/UX 설계
## `[VIEW]` `[OBSERVATION]` `[DIRECT-CYCLE]` `[CYCLE-READY]`

| 항목 | 내용 |
|---|---|
| 문서 ID | `VUX-IE-D1` |
| 문서 버전 | D1 |
| 상태 | **CYCLE READY — 별도 Master 선택 없이 즉시 Cycle 착수** |
| 접두사 | 산출물·Fixture·검증 ID는 `VUX-IE-*`를 사용한다 |
| 설계 근거 | [`Design-Inventory-Equipment-D1.md`](Design-Inventory-Equipment-D1.md) |
| 소유 영역 | 관찰 계약의 View 표현, 입력, 피드백, 접근성, Cycle handoff |
| 비소유 영역 | Inventory/Equipment World 의미·판정·수치의 변경 |

> **실행 지시**
>
> 이 문서는 새로운 상위 게임 의미를 제안하는 기획이 아니라, 이미 구현된 Inventory /
> Equipment 의미를 플레이어가 보고 조작하게 만드는 **관찰 표면 설계**다. 따라서
> 별도의 후보 등록·Human Select를 기다리지 않는다. 다음 Cycle Agent는
> §11의 `VUX-IE-01`부터 즉시 8 Stage Cycle을 시작한다. 다만 Cycle의 기존 8 Stage와
> World → GameView → View 경계는 그대로 지킨다.

## 태그 규약

| 태그 | 의미 |
|---|---|
| `[VIEW]` | 배치·문구·입력·피드백을 View가 소유한다 |
| `[OBSERVATION]` | 이미 존재하는 World 의미를 보이고 조작 가능하게 한다 |
| `[DIRECT-CYCLE]` | Master 후보화 없이 다음 Cycle로 직접 착수한다 |
| `[CYCLE-READY]` | Goal·Scope·계약 요구·검증 기준이 Agent handoff 가능한 상태다 |
| `[GAMEVIEW-GAP]` | View가 필요한 authoritative 관찰이 없으면 `spec.md` 의 Observable 절(plan)로 반환한다 |

---

# 1. Inventory / Equipment UI·UX 설계의 목적 `[VIEW]`

현재 World 기능이 있어도 플레이어가 다음 세 질문에 즉시 답할 수 없다면 기능은 플레이 가능한
표면을 얻지 못한 것이다.

```text
1. 무엇을 가지고 있는가?
2. 무엇을 지금 적용하고 있는가?
3. 이 물건으로 무엇을 할 수 있고, 하면 무엇이 달라지는가?
```

이 절 이후는 이 세 질문에 답하는 **View 설계와 Cycle 전달 규격**이다. World 규칙을 새로
정하지 않는다. 화면은 World가 보낸 상태·행동·가능 여부·사유·미리보기만 표현하고, 모든
변경 요청은 Action Request로 돌려보낸다. 필요한 관찰값이 없다면 View가 추론하지 않고
GameView Specification으로 GAP을 반환한다.

## 1.1 MMORPG 비교에서 취할 패턴

| 참고 패턴 | 대표 MMORPG | 취할 점 | 그대로 가져오지 않을 점 |
|---|---|---|---|
| 가방 격자 + 검색/분류 + 일괄 정리 | Guild Wars 2 | 많은 물건을 훑는 속도, 수량/희귀도 시각 계층, 정리 행동의 발견성 | 여러 가방을 한 화면에 이어 붙이는 구조와 재료창고는 현재 범위 밖 |
| 캐릭터 주위의 장비 자리 + 장비 세트 | World of Warcraft | 몸의 어느 부위에 무엇이 적용되는지 즉시 이해, 장착품과 후보 비교 | 장비 세트 저장/전문화 자동 교체는 후속 기능 |
| Inventory와 Armoury Chest의 명확한 분리 | Final Fantasy XIV | 보유와 장착 후보 저장소의 역할 분리, 컨트롤러 포커스 이동 | 별도 Armoury 저장소를 World에 새로 만들지 않음 |
| 장비 창과 가방을 동시에 열어 직접 비교 | The Elder Scrolls Online | 장착 결과를 확인하며 후보를 연속 탐색, 입력 장치별 동일 행동 | 게임패드 전용으로 정보 구조가 달라지는 이중 UI는 만들지 않음 |

결론은 **GW2식 훑기 쉬운 가방**과 **WoW/ESO식 몸 중심 장비 패널**을 한 작업 공간에 두되,
FFXIV처럼 보유와 적용의 경계를 시각적으로 확실히 나누는 것이다. 특정 게임의 외형을 복제하지
않고, 반복 검증된 정보 구조만 사용한다.

# 2. 데스크톱 기본 화면 — 하나의 관리 작업 공간 `[VIEW]`

## 2.1 열기와 닫기

* `I`는 Inventory 작업 공간을 열고 닫는다.
* `Esc`는 순서대로 Context Menu → 확인 Modal → 작업 공간을 닫는다.
* 열 때 마지막 탭, 정렬, 필터는 View 세션 동안 유지한다. 단, 선택된 아이템이 더는 관찰에
  없으면 선택을 지우고 임의의 다른 아이템을 선택하지 않는다.
* 전투 중 열기 가능 여부는 View가 정하지 않는다. World가 행동을 허용하되 장착 요청만
  거절할 수도 있으며, 이때 패널은 열린 채 정확한 사유를 보여 준다.

## 2.2 와이어프레임 (1440×900 기준)

```text
┌ Inventory & Equipment ────────────────────────────────────────────────────┐
│ [Inventory] [Equipment]       [검색 /]  [전체⌄] [정렬⌄]      24 / 30 [×] │
├──────────────────────────────┬────────────────────────────────────────────┤
│ CHARACTER / EQUIPMENT        │ BAG                                        │
│                              │ [01][02][03][04][05][06]                   │
│       [Head]                 │ [07][08][09][10][11][12]                   │
│ [Main] (Character) [Off]     │ [13][14][15][16][17][18]                   │
│       [Body]                 │ [19][20][21][22][23][24]                   │
│ [Accessory 1] [Accessory 2]  │ [25][26][27][28][29][30]                   │
│                              │                                            │
│ Effective                    ├────────────────────────────────────────────┤
│ 공격 20  방어 8  이동 5      │ SELECTED ITEM                              │
│                              │ 철 곡괭이 · Tool · 1                       │
│                              │ 채굴 가능 / 공격 +3                        │
│                              │ 장착 시: 공격 20 → 23 (+3)                 │
│                              │ [장착 E] [사용 U] [더보기 …]               │
└──────────────────────────────┴────────────────────────────────────────────┘
```

레이아웃 우선순위는 `장비 34% : 가방 66%`다. 이는 규칙 수치가 아닌 시작용 View 토큰이며
실측으로 조정한다. 가방과 장비는 동시에 보여야 장착 전후의 **이동**이 이해된다. 탭은 좁은
화면을 위한 탐색 수단이지 데스크톱에서 한쪽을 숨기는 장치가 아니다.

## 2.3 반응형 단계

| 폭 | 구성 |
|---|---|
| `≥ 1100px` | 장비와 가방 2열, 상세는 가방 하단 |
| `720~1099px` | 가방/장비 탭 1열, 상세는 우측 Drawer |
| `< 720px` | 이 Cycle의 지원 대상 아님. 기능은 깨지지 않되 모바일 전용 UX는 후속 |

# 3. 아이템 슬롯의 시각 언어 `[VIEW]`

각 칸은 최소한 다음 정보를 같은 위치에 고정한다.

```text
┌─────────────┐
│ rarity edge │  테두리: 희귀도(정보가 계약에 있을 때만)
│    ICON     │  중앙: 종류/분류 표현
│ NEW       12│  좌상: 새 획득, 우하: 수량
│         [E] │  우상: 장착 중 표식 또는 입력 힌트
└─────────────┘
```

* **수량은 숫자와 배경 명암을 함께** 사용한다. 색만으로 구분하지 않는다.
* 빈칸도 그려서 전체 용량과 남은 자리를 공간으로 읽게 한다.
* 장착 중인 아이템은 가방에 중복 표시하지 않는다(P4). 검색 결과에 `장착 중` 가상 행을
  만들고 싶다면 Equipment 관찰을 함께 조회한 결과임을 명확히 하며, 드래그 가능한 가방
  개체처럼 가장하지 않는다.
* 선택은 밝은 2px 테두리, 키보드 포커스는 별도의 바깥 2px 링으로 구분한다.
* 가능 후보는 장비 슬롯 Hover/Focus 중 은은한 강조, 불가능 후보는 감추지 않고 낮은 명도와
  사유 아이콘을 쓴다.
* `NEW`는 플레이어가 상세를 보거나 세션에서 명시적으로 확인하면 사라지는 View 상태다.

# 4. 핵심 상호작용 모델 `[VIEW]`

## 4.1 하나의 의미, 여러 입력

| 의미 행동 | Mouse | Keyboard | Gamepad | 요청 |
|---|---|---|---|---|
| 선택/상세 | 좌클릭 | 방향키 후 `Enter` | D-pad/Stick 후 `A` | 없음 |
| 빠른 장착 | 더블클릭 | `E` | `X` | World가 준 equip action id |
| 빠른 해제 | 장비 더블클릭 | `E` | `X` | World가 준 unequip action id |
| 이동/교체 | Drag & Drop | 선택 → `M` → 목적지 | `Y` → 목적지 → `A` | World가 준 move/equip/replace action id |
| 사용 | Context `사용` | `U` | Context에서 선택 | World가 준 use action id |
| 더보기 | 우클릭 | `Shift+F10` | Menu | 관찰된 actions 목록 |
| 닫기/취소 | `×` | `Esc` | `B` | 없음 |

키는 View 바인딩의 기본안이다. 화면에 표시한 힌트와 실제 바인딩은 반드시 같은 Registry를
읽는다. 입력마다 별도 규칙을 만들지 않고 같은 Semantic Action으로 수렴시킨다.

## 4.2 Drag & Drop 상태

```text
idle → picked-up → hovering-valid   → request-pending → success
                 → hovering-invalid → local-cancel (사유 표시는 가능)
                 → outside          → cancel; 버리기로 해석하지 않음
```

드래그 시작 시 가능한 목적지만 강조한다. 그러나 최종 가능 판정은 요청 시 World가 다시 한다.
화면 밖 Drop은 절대 버리기가 아니다. 버리기/덜어내기는 Context Menu와 확인 절차를 거친다.

## 4.3 낙관적 갱신 금지

요청 후 해당 아이템과 목적지에 Spinner를 표시하고 재요청만 막는다. World 응답 전에는 수량,
위치, 능력치를 바꾸지 않는다. 성공 Snapshot이 오면 180~240ms 이동/강조로 결과를 연결하고,
거절되면 원위치 애니메이션과 사유 Toast를 함께 보여 준다.

# 5. 상세·비교 패널 `[VIEW]`

선택 항목의 정보는 다음 순서로 고정한다.

1. 이름, 아이콘, 분류, 수량
2. 한 줄 역할 설명
3. 현재 제공 효과 또는 사용 결과
4. 장착 후보라면 대상 Equipment Slot
5. 현재 장비 대비 변화값
6. 가능한 Primary Action 한 개
7. Secondary Actions
8. 불가능한 행동과 각각의 사유

비교값은 `현재 유효 값 → 장착 후 유효 값 (차이)`로 보인다. 상승은 `+`와 위 화살표,
하락은 `-`와 아래 화살표, 변화 없음은 `—`를 함께 사용한다. 색은 보조 수단이다.

```text
공격력  20 → 23   ▲ +3
방어력   8 →  6   ▼ -2
채굴          가능  NEW
```

World가 Preview를 제공하지 않으면 View가 `statContributions`를 더해 결과를 만들지 않는다.
이 경우 비교 영역은 `비교 정보 없음`으로 안정적으로 축소되고 다음 GAP을 낸다.

```text
GAMEVIEW GAP
Required   장착 전에 현재 유효 값과 장착 후 유효 값의 차이를 표현해야 함
Missing    equip action에 연결된 authoritative preview
Reason     View가 기여값을 합치면 World 판정과 다른 약속을 만들 수 있음
Return To  GameView Specification
```

# 6. 정렬·필터·검색 `[VIEW]`

* 기본 순서는 World가 보낸 슬롯 순서다. `정렬` Action이 World 상태를 바꾸는 기능이라면
  반드시 요청을 보낸다. 단순 표시 정렬은 `보기 정렬`로 이름을 달리하고 View 상태로 둔다.
* 필터: `전체 / 장비 / 소비 / 재료 / 기타`. 카테고리 값이 추가되면 `기타`로 안전하게
  나타나며 목록에서 사라지지 않는다.
* 검색은 표시 이름과 계약이 제공하는 검색용 태그만 대상으로 한다. 로컬라이즈된 설명
  전문을 검색하는 것은 후속이다.
* 검색/필터 결과가 0개면 `아이템 없음`이 아니라 `조건에 맞는 아이템 없음 · 필터 초기화`를
  표시한다.
* 용량 `used / capacity`는 필터와 무관한 실제 값이다. 가득 차면 경고색과 `가득` 문구를
  함께 표시한다.

# 7. 위험 행동과 오류 회복 `[VIEW]`

| 상황 | UX |
|---|---|
| 장착 슬롯 부적합 | 목적지에 금지 표시, 상세/Tooltip에 World 사유, 요청해 거절돼도 동일 사유 |
| 가방 Full에서 해제 | 해제 버튼 유지 + Disabled 사유 `가방에 빈자리가 없습니다` |
| 가방 Full에서 교체 | World가 허용한 replace action을 Primary로 표시; 해제 후 장착 두 요청으로 분해 금지 |
| Stack 분리 | 수량 Stepper (`1..quantity-1`), 확인 전 예상 두 Stack 표시 |
| 버리기/덜어내기 | 수량 선택 후 확인. 장비/희귀 아이템은 이름 재확인 또는 Hold 입력 |
| 응답 지연 | 1초 뒤 `처리 중`, 5초 뒤 재시도가 아닌 연결 상태 안내; 중복 요청 금지 |
| 상태 경합 | 최신 Snapshot으로 다시 그리고 `상태가 바뀌어 실행하지 못했습니다` + World 사유 |

Toast는 결과를 알리지만 유일한 정보가 아니다. 성공 결과는 실제 슬롯 이동과 능력치 변화로,
실패는 해당 버튼/슬롯의 지속 가능한 사유로도 확인할 수 있어야 한다.

# 8. 접근성·가독성 완료 조건 `[VIEW]`

* 모든 조작은 Pointer 없이 수행 가능하며 포커스 순서는 `닫기 → 도구 → 장비 → 가방 → 상세
  행동`으로 예측 가능해야 한다.
* Slot의 접근성 이름은 `철 곡괭이, 1개, 도구, 장착 가능`처럼 이름·수량·분류·현재 상태를
  포함한다. 빈칸은 `가방 7번, 비어 있음`이다.
* Tooltip은 Hover뿐 아니라 Focus에도 열리고 `Esc`로 닫힌다.
* 상태를 색 하나로 전달하지 않는다. 아이콘, 문구, 형태 중 하나를 반드시 함께 쓴다.
* 본문/배경과 주요 텍스트는 WCAG AA 수준의 대비를 목표로 한다. 200% 확대에서 행동 버튼과
  상세 정보가 겹치거나 잘리지 않아야 한다.
* 애니메이션 감소 설정에서는 이동 애니메이션 대신 즉시 배치 + 1회 Outline 강조를 쓴다.

# 9. GameView 계약 요구사항 — 다음 Cycle의 입력

구현 Agent는 아래를 World 코드에서 읽어 조립하지 않는다. `04-gameview.spec.yaml`이 최소한
다음 의미를 제공하거나, 없는 항목을 GAP으로 반환해야 한다.

```yaml
inventoryRoom: { used, capacity }
inventory[]:
  - id                 # 개별 상태가 필요할 때 안정 식별자; 종류 Stack이면 kind로 충분한지 Spec이 명시
    kind
    displayOrder
    count
    category
    stackable
    actions[]: { id, role, available, unavailableReason, targetSlots? }
equipmentSlots[]:
  - id
    role
    labelCode
    locked
    item: null | { id, kind, count }
    actions[]: { id, role, available, unavailableReason }
effectiveStats[]: { id, value, labelCode }
selectionPreview: null | {
  actionId
  targetSlotId
  statChanges[]: { id, before, after, delta }
  grantsAdded[]
  grantsRemoved[]
}
```

`displayOrder`, `labelCode`, `targetSlots`는 의미 계약의 선택 항목이다. 없는 경우 View는 받은
순서, 코드 fallback, World가 준 action 단위 선택 UI를 사용한다. 반면 가능한 행동과 사유,
실제 장착 상태, authoritative Preview는 View가 만들어서는 안 된다.

# 10. 구현 경계와 권장 파일 분해

이 설계의 화면을 한 Cycle에서 구현할 때 기존 단일 결정 항목을 다음 책임으로 발전시킨다.
실제 이름은 코드 구조에 맞춰 조정할 수 있으나 경계는 유지한다.

```text
content/view/
  inventory-presentation.ts     가방 Item → 표시 모델, 필터 문구, 빈 상태
  equipment-presentation.ts     Equipment Slot → 표시 모델, 비교 행
  item-action-presentation.ts   semantic role → 문구/키 힌트 (판정 없음)
  bindings.ts                   I/E/U/Menu 및 기존 바인딩과 충돌 해결
  code-text.ts                  사유·슬롯·능력치 labelCode의 한국어 표현
  tests/
    inventory-workspace.spec.ts Fixture만으로 화면 결정 검증

engine/view-kernel/             이 Cycle에서 편집하지 않음
world/                          View Stage에서 편집하지 않음
```

현재 Renderer에 Modal, Drawer, Grid, Focus 이동 능력이 없다면 content 코드로 우회 구현하지
않는다. `VIEW CAPABILITY GAP`으로 기반 트랙에 반환하고, 기존 label/button capability로
완성 가능한 Vertical Slice부터 닫는다.

# 11. Cycle 분할 — 다른 Agent가 순서대로 닫는 단위

UI 전체를 한 번에 만들지 않는다. 아래 각 행은 독립적인 **플레이 가능한 Delta**다. 이 문서는
관찰/View 표면의 직접 실행 요청이므로 별도 등록이나 Human Select를 기다리지
않고 바로 Cycle을 시작한다. 번호는 권장 실행 순서이며 실제 Cycle ID는 시작 Agent가 현재
마지막 ID 다음으로 배정한다.

| 접두사 | Cycle Goal | 최소 Scope | 플레이 가능한 결과 | 선행 |
|---|---|---|---|---|
| VUX-IE-01 | 가방을 열어 가진 것과 남은 자리를 찾는다 | 작업 공간 Shell, Grid, 용량, 선택/상세, 키보드 Focus | `I`로 열고 아이템/수량/빈칸/행동 사유를 읽는다 | Inventory 관찰 |
| VUX-IE-02 | 가진 것과 적용 중인 것을 한눈에 가른다 | Equipment 패널, 장착/해제, Pending/거절 피드백 | 가방에서 골라 장착하고 몸의 변화, 해제 후 복귀를 본다 | 장착 Cycle + VUX-IE-01 |
| VUX-IE-03 | 교체 결과를 실행 전에 판단한다 | 양방향 비교, Drop target, replace 단일 요청 | 가방 Full에서도 기존 장비와 후보를 비교해 원자 교체한다 | 교체/Preview Cycle + VUX-IE-02 |
| VUX-IE-04 | 많은 소지품을 빠르게 정리한다 | 검색, 필터, 보기 정렬, Stack 분리/이동 | 원하는 물건을 찾고 자리 정리를 완료한다 | 정렬/분리 World Cycle + VUX-IE-01 |
| VUX-IE-05 | 실수로 가치 있는 물건을 잃지 않는다 | 수량 Modal, 위험도별 확인, Focus 복귀 | 덜어내기/버리기를 확인하고 실패에서 회복한다 | Drop/Discard 의미 + VUX-IE-01 |

**권장 첫 Cycle은 VUX-IE-01이다.** 장착 UI부터 시작하면 기본 선택·Focus·상세·행동 피드백을
장비 화면 안에서 중복 구현하게 된다. VUX-IE-01의 Inventory Workspace가 이후 Cycle이 확장할
공통 표면이다.

## 11.1 VUX-IE-01 Cycle Definition 초안

다음 Agent는 이 블록을 `01-cycle.md` 작성의 입력으로 사용한다. 이 직접 실행 요청에는 Master
Graph 출처가 없으므로 `MASTER TRACE`에는 `DIRECT OBSERVATION — VUX-IE-D1`과 이 문서 경로를
기록하고 가짜 Goal/Possibility/Capability ID를 만들지 않는다.

```text
Goal              플레이어가 가방을 열고, 가진 것과 남은 자리와 각 물건으로 지금 할 수
                  있는 일을 Pointer/Keyboard로 찾아 실제 요청할 수 있다.
Playable Result   I로 작업 공간을 연다 → 칸을 선택한다 → 상세와 가능/불가 사유를 읽는다
                  → World가 제공한 행동 하나를 실행한다 → 최신 Snapshot 결과를 본다.
Observable Result 용량, 빈칸, 종류, 수량, 선택, 행동, 불가 사유, pending, 성공/거절이 구분된다.
In Scope          Shell, 6열 Grid, 선택/Focus, 상세, 기존 use/discard action 연결, Fixture 테스트.
Out of Scope      장착 패널, Preview, Drag & Drop, 정렬/검색/필터, Stack 분리, 모바일, 새 World 규칙.
World Delta       NONE이 기본. Spec에 빈 Slot/display identity/action 결과가 없다면 spec.md Observable 절의 GAP.
View Delta        기존 가로 HUD 요약은 유지하고, I로 여는 관리 작업 공간을 추가한다.
```

## 11.2 VUX-IE-01 Stage별 Agent 전달 체크리스트

| Stage | Agent가 남겨야 할 것 | 금지 |
|---|---|---|
| 1 Cycle | 위 Goal을 하나의 실제 플레이 흐름으로 닫고 `DIRECT OBSERVATION — VUX-IE-D1` 출처 기록 | 가짜 Master ID 생성, 장착/정렬까지 Scope 확대 |
| 2 Intent | 플레이어 질문 3개, 입력별 같은 의미 행동, 오류 회복 명시 | 픽셀/컴포넌트 기술 결정 |
| 3 Semantic | 기존 의미 REUSED 확인; 새 World 의미가 없다면 명시 | 화면 편의를 위한 World 규칙 추가 |
| 4 Spec | §9 중 VUX-IE-01에 필요한 관찰/행동/사유와 결과 계약 | World 내부 타입을 계약처럼 참조 |
| 5 Review | 빈 가방·가득 참·불가 행동·응답 지연을 Human이 확인 | Happy path만 승인 |
| 6 World | 원칙상 변화 없음; Spec GAP이 있을 때만 최소 투영 추가 | UI layout 구현 |
| 7 View | `view/` 결정과 Fixture 테스트; capability가 없으면 GAP | World import, 클라이언트 판정 |
| 8 Verify | Mouse + Keyboard 두 경로, World 통합, View 단독 Fixture 실측 | 단위 테스트 통과만으로 완료 선언 |

# 12. UI/UX 검증 매트릭스

## 12.1 필수 Fixture

| Fixture | 반드시 관찰할 것 |
|---|---|
| `VUX-IE-FX-EMPTY` | 0/capacity, 모든 빈칸, `소지품 없음`, Focus 가능한 닫기 버튼 |
| `VUX-IE-FX-PARTIAL` | Stack/비Stack, 수량, 가능한/불가능 행동과 사유 |
| `VUX-IE-FX-FULL` | used=capacity, `가득`, 해제 불가와 교체 가능의 비대칭(해당 Cycle부터) |
| `VUX-IE-FX-EQUIPPED` | 가방에 중복 없음, Equipment 위치, 유효 값 |
| `VUX-IE-FX-PREVIEW` | 상승/하락/변화 없음, 색 없이도 구분 |
| `VUX-IE-FX-STALE` | pending 뒤 최신 Snapshot 복구, World 사유, 중복 요청 없음 |
| `VUX-IE-FX-UNKNOWN` | 미등록 kind/category/stat/reason이 fallback으로 보이고 화면이 멈추지 않음 |

## 12.2 자동 검증

```text
VUX-IE-V-01  I/Esc가 열기/닫기를 왕복하고 World 상태를 바꾸지 않는다.
VUX-IE-V-02  관찰의 N개 Item과 capacity개의 Slot이 유실/중복 없이 표현된다.
VUX-IE-V-03  Filter가 실제 used/capacity를 바꾸지 않는다.
VUX-IE-V-04  모든 available action은 정확히 그 id로 요청되고, unavailable action은 사유가 보인다.
VUX-IE-V-05  요청 전후에 View가 위치·수량·능력치를 낙관적으로 바꾸지 않는다.
VUX-IE-V-06  Keyboard만으로 첫 Item 선택, 상세 읽기, Primary Action, 닫기가 가능하다.
VUX-IE-V-07  장착 Item은 가방에 실제 Slot으로 중복되지 않는다.
VUX-IE-V-08  교체는 replace 요청 하나이며 unequip+equip 두 요청으로 분해되지 않는다.
VUX-IE-V-09  알 수 없는 의미 코드는 원문 fallback으로 보이고 예외가 나지 않는다.
VUX-IE-V-10  Fixture 테스트는 World 프로세스 없이 통과한다.
```

## 12.3 Human Play 완료 기준

처음 보는 플레이어가 별도 설명 없이 30초 안에 가방을 열고, 특정 물건의 수량과 사용 가능
여부를 찾고, 60초 안에 장착 후보와 현재 장비의 차이를 판단해 요청할 수 있어야 한다.
실패했을 때는 무엇이 실패했는지뿐 아니라 **다음에 무엇을 바꿔야 하는지**를 화면에 남은
사유로 설명할 수 있어야 한다. 이 기준을 충족하지 못하면 기능 테스트가 통과해도 UI/UX
Cycle은 완료가 아니다.
