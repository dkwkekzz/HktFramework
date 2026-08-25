# Inventory & Equipment System 기획서
## 30-Slot Bag / 6-Slot Equipment

| 항목 | 내용 |
|---|---|
| 문서 버전 | D1 (개정 1 — 수치 소유권 · World/View 경계 · 저장소 모델 · 획득 원자성 · Cycle 매핑) |
| 상태 | System Design Draft |
| 상위 문서 | `Design-Item-System-R0.md` (IS) — §5.4 가 이 문서에 넘긴 영역 |
| 범위 | 플레이어 가방, 인벤토리 표면, 아이템 이동/정렬/스택, 캐릭터 장착 자리, 장착/해제/교체, 장착 효과 관찰 |
| 기본 가방 용량 | 30 Slot — **첫 Cycle 의 제안값이며 값은 Cycle 이 소유한다** (§0 · §3.1) |
| 기본 장착 용량 | 6 Equipment Slots — **첫 Cycle 의 제안값이며 값은 Cycle 이 소유한다** (§0 · §10) |
| 작성 목적 | 플레이어가 획득한 아이템을 명확하게 관리하고, 그중 소수만을 현재 컨트롤하는 캐릭터에게 적용할 수 있는 일관된 Inventory / Equipment System을 구축한다. |

> **핵심 명제**
>
> 플레이어가 **가지고 있는 아이템**과 캐릭터에게 **현재 적용되고 있는 아이템**은 서로 다른 상태다.
>
> 가방은 소유한 자원을 관리하는 공간이며, 장착 슬롯은 그 자원 중 지금 캐릭터에게 효과를 발생시키는 아이템을 선택하는 공간이다.

상위 Item System에서도 보유와 장착은 분리되어야 하며, 장착된 아이템만 능력치와 가능한 행동을 변화시키도록 정의되어 있다. 또한 슬롯 수·슬롯 구성·소지 한도 등은 별도 후속 문서가 소유하도록 명시되어 있으므로, 본 문서가 해당 영역의 구체 사양을 정의한다.

---

# 0. 이 문서의 소유 경계

상위 IS §2 가 **Master 는 의미 · Runtime 은 상태 · Cycle 은 수치**로 소유를 갈랐다. 이 문서는
그 위에 하나를 더한다 — **World 가 판정하는 것과 View 가 표현하는 것**의 경계다.

| 태그 | 누가 소유하는가 | 이 문서가 하는 일 |
|---|---|---|
| `[WORLD]` | Authoritative World — 규칙과 판정 | 규칙 자체를 확정한다 |
| `[VIEW]` | Client View — 배치 · 문구 · 조작 | **예시일 뿐 규칙이 아니다.** View 는 다르게 만들어도 된다 |
| `[CYCLE]` | 해당 Cycle 의 `03-world-semantic.md` | 값을 제안할 뿐 확정하지 않는다 |

```text
[WORLD]   §4 · §5 · §6 · §10~§17 · §21~§30 · §33~§35 · §38~§41 · §44
[VIEW]    §7 · §8 · §9 · §18 · §19 · §20 · §31 의 버튼 · §32 · §36 · §37 의 표현
[CYCLE]   가방 칸 수 · 장착 자리 수 · stackLimit · statContributions 의 모든 수치
```

`[VIEW]` 절을 이 문서가 담는 이유는 규칙을 정하기 위해서가 아니라, `[WORLD]` 가 무엇을
관찰에 실어야 하는지를 **역으로 확인하기 위해서**다. 예를 들어 §37 의 능력치 비교 화면이
성립하려면 World 가 Preview 계산을 관찰에 실어야 한다는 것이 드러난다. 그것이 `[WORLD]`
쪽 요구가 되고, 그 값을 화면에 어떻게 배치할지는 View 의 자유로 남는다.

> **`[VIEW]` 절의 어떤 문장도 World 의 규칙이 되지 않는다.**
> 무엇이 선택지인가의 단일 출처는 언제나 World 다.

---

# 1. 시스템 목표

Inventory & Equipment System의 목표는 다음과 같다.

### 1.1 Inventory

플레이어는 자신이 소유한 아이템을 보관하는 **유한한 칸수의 가방**을 가진다 (첫 Cycle 제안값 30칸).

플레이어는 인벤토리 UI를 통해 다음 행동을 수행할 수 있다.

* 가방 열기 / 닫기
* 현재 보유 아이템 확인
* 아이템 수량 확인
* 아이템 상세 정보 확인
* 아이템 위치 변경
* 같은 아이템의 Stack 합치기
* Stack 분리
* 아이템 정렬
* 아이템 필터링
* 아이템 사용
* 아이템 장착
* 아이템 버리기
* 사용/장착할 수 없는 이유 확인

아이템 목록은 특정 종류를 위한 UI를 개별적으로 만드는 방식이 아니라, 모든 아이템을 하나의 관찰 계약으로 표시한다. 이는 상위 Item System의 소지/관찰 원칙을 그대로 따른다.

### 1.2 Equipment

현재 플레이어가 컨트롤하고 있는 캐릭터는 **소수의 장착 자리**를 가진다 (첫 Cycle 제안값 6개).

장착된 아이템은 단순히 소유한 아이템과 달리 캐릭터에게 실제 효과를 적용한다.

장착 효과의 예시는 다음과 같다.

* 공격력 증가
* 방어력 증가
* 이동 관련 능력 변화
* 특정 행동 해금
* 채굴 가능
* 특수 상호작용 가능
* 특정 능력 부여
* 캐릭터 상태 변화

단,

> **가방에 아이템을 가지고 있다는 사실만으로는 캐릭터에게 효과가 발생하지 않는다.**

아이템이 장착 슬롯에 들어간 순간부터 효과가 적용되고, 슬롯에서 제거된 순간 효과가 사라진다.

---

# 2. 전체 구조

```text
Player / Character Ownership
        │
        ├── Inventory
        │     └── N Slots        (첫 Cycle 제안값 30)
        │
        └── Equipment
              └── M Slots        (첫 Cycle 제안값 6 — M ≪ N)
```

아이템의 소유자는 캐릭터이지만, 아이템이 현재 위치한 장소는 구분한다.

```text
INVENTORY
EQUIPPED
WORLD
CONTAINER
```

예:

```text
곡괭이 획득
    ↓
Inventory Slot 12
    ↓ 장착
Equipment Slot 2
    ↓ 해제
Inventory Slot 4
    ↓ 버리기
World
```

따라서 **소유 상태와 위치 상태를 분리**해서 관리한다.

---

# 3. Inventory 기본 사양

## 3.1 가방 용량 `[WORLD]` + `[CYCLE]`

가방은 **유한하다.** 그 유한함이 "무엇을 들고 다닐 것인가" 를 선택으로 만든다 — 이것이
World 가 소유하는 규칙이다.

몇 칸인가는 **Cycle 이 소유하는 수치**다. 첫 Cycle 의 제안값을 30 으로 둔다.

```text
Inventory.capacity      World 가 소유한다 — 유한하고, 관찰에 실린다
capacity = 30           Cycle 이 소유한다 — 03-world-semantic.md 가 확정한다
```

UI의 기본 표현은 다음과 같이 구성할 수 있다 `[VIEW]`.

```text
[01][02][03][04][05][06]
[07][08][09][10][11][12]
[13][14][15][16][17][18]
[19][20][21][22][23][24]
[25][26][27][28][29][30]
```

즉, 기본 UI 기준 `6 Columns × 5 Rows` 로 30칸을 사용한다.

단, **30칸은 UI 배열의 의미가 아니라 시스템상 Capacity 값**이고, 그 값조차 이 문서가
아니라 Cycle 이 확정한다.

가방 확장 시스템이 추가되면 다음과 같이 변한다.

```text
30 → 36 → 42 → 48
```

이 변화가 **이 문서의 어떤 원칙도 위반해서는 안 된다.** 그러므로 코드가 `30` 을 조건으로
쓰지 않는 것은 물론, 이 문서도 30 을 규칙으로 세우지 않는다 (§49 P2).

---

# 4. Inventory Slot 규칙

각 슬롯은 다음 중 하나의 상태다.

```text
EMPTY
또는
ITEM
 ├ itemDefinition
 └ quantity
```

예:

```text
Slot 01 : 돌 × 15
Slot 02 : 나무 × 4
Slot 03 : 곡괭이 × 1
Slot 04 : Empty
```

---

# 5. Stack 규칙 `[WORLD]` — 한도 값은 `[CYCLE]`

아이템마다 Stack 가능 여부와 최대 Stack 수를 Item Definition에서 정의한다.

상위 Item System에서도 Stack 가능 여부와 한도는 아이템 정의가 소유하며, 내구도·강화·귀속 등 동일 종류끼리 상태가 달라져야 하는 경우에만 개체 모델로 전환하도록 정의되어 있다.

예:

아래 `stackLimit` 값은 예시다 — 실제 값은 Cycle 이 소유한다.

```text
돌
stackable = true
stackLimit = 99

회복약
stackable = true
stackLimit = 20

장비
stackable = false
```

### 획득 예시

현재:

```text
Slot 01
Stone × 80
```

Stone 30개 획득:

```text
Slot 01
Stone × 99

Slot 02
Stone × 11
```

---

# 6. 아이템 획득 우선순위

아이템을 획득할 경우 다음 순서로 처리한다.

```text
1. 기존 동일 Stack에 합칠 수 있는가?
        ↓ Yes
   기존 Stack 채우기

2. 남은 수량이 있는가?
        ↓ Yes
   빈 슬롯 탐색

3. 빈 슬롯이 있는가?
        ↓ Yes
   새로운 Stack 생성

4. 빈 슬롯이 없는가?
        ↓
   획득 실패
```

실패 사유:

```text
INVENTORY_FULL
"가방에 빈 공간이 없습니다."
```

단, 가방 30칸이 모두 사용 중이어도 기존 Stack에 합칠 공간이 있다면 획득할 수 있다.

예:

```text
30 / 30 Slot 사용 중
Stone × 20 / 99
```

Stone × 5 획득:

```text
성공
Stone × 25 / 99
```

## 6.1 획득은 전량 성공 또는 전량 실패다 `[WORLD]`

부분 수용은 허용하지 않는다. 요청한 수량이 전부 들어갈 수 없으면 **아무것도 들어가지
않는다.** 상위 IS §7 P4 의 "효과와 수량은 함께 변하거나 함께 변하지 않는다" 가 획득에도
그대로 적용된다 — 실패한 시도는 수량에 부분 반영되지 않는다.

경계 사례:

```text
Stone × 80 보유 (한도 99)
빈 슬롯 0

Stone × 30 획득 요청
    ↓
합칠 수 있는 양 19
남는 양 11
빈 슬롯 없음
    ↓
INVENTORY_FULL
Stone × 80 그대로 — 19 도 들어가지 않는다
```

그러면 세계에서 30개를 캐낸 플레이어는 아무것도 얻지 못하는가? 아니다. **획득 요청의
단위를 세계가 소유한다.**

```text
세계가 30을 한 번에 건네면      전량 성공 또는 전량 실패
세계가 1씩 30번 건네면          19번 성공하고 11번 실패한다
```

채집·채굴처럼 하나씩 쌓이는 경로는 후자를 쓴다. 전리품 상자처럼 묶음이 그 자체로 의미를
갖는 경로는 전자를 쓴다. 어느 쪽이든 **한 번의 요청 안에서는 반쪽이 없다.**

들어가지 못한 수량은 사라지지 않는다 — §43 의 "월드에 있던 아이템은 그대로 남아야
한다" 가 부분 수량에도 적용된다.

---

# 7. Inventory UI `[VIEW]`

## 7.1 기본 레이아웃

```text
┌──────────────────────────────────────────────┐
│ INVENTORY                            24 / 30 │
├──────────────────────────┬───────────────────┤
│                          │ EQUIPMENT         │
│ [01][02][03][04][05][06] │                   │
│ [07][08][09][10][11][12] │ [E1] [E2]        │
│ [13][14][15][16][17][18] │ [E3] [E4]        │
│ [19][20][21][22][23][24] │ [E5] [E6]        │
│ [25][26][27][28][29][30] │                   │
│                          │                   │
├──────────────────────────┴───────────────────┤
│ ITEM DETAIL                                  │
│                                             │
│ 경계를 가르는 곡괭이                         │
│ 공격력 +4                                   │
│ 채굴 가능                                   │
│                                             │
│ [장착] [버리기]                              │
└──────────────────────────────────────────────┘
```

---

# 8. Inventory 열기 / 닫기 `[VIEW]`

Inventory는 Input Mapping에 등록된 `Inventory` 액션을 통해 열고 닫는다.

본 문서는 특정 키를 시스템 규칙으로 고정하지 않는다.

예:

```text
Keyboard → I
Gamepad → Menu Button
```

등은 Input Binding에서 결정한다.

상태:

```text
CLOSED
   ↓ Inventory Input
OPEN
   ↓ Inventory Input / Close
CLOSED
```

UI를 열었다는 사실 자체가 월드 시뮬레이션을 정지시키지는 않는다.

게임이 인벤토리 화면에서 Pause되는지 여부는 별도의 Game Flow 정책이 결정한다.

---

# 9. Item Detail `[VIEW]` — 실리는 정보는 `[WORLD]`

아이템을 선택하면 최소한 다음 정보를 표시한다.

```text
아이콘
아이템 이름
아이템 분류
현재 수량
설명
장착 가능 여부
사용 가능 여부
장착 효과
능력치 변화
부여 능력
가능 행동
불가능 행동 + 불가능 사유
```

예:

```text
철제 곡괭이
장비 / 도구

공격력 +3
채굴 행동 사용 가능

장착 가능한 자리
보조 장비 / 도구

[장착]
```

화면은 자리 id(`E2`)가 아니라 Slot Definition 의 `displayName` 을 쓴다 (§10). id 는 세계와
View 가 서로를 가리키는 열쇠이지 사용자에게 보여줄 이름이 아니다.

장착할 수 없는 경우:

```text
[장착 불가]
현재 캐릭터에게 사용할 수 있는 장착 슬롯이 없습니다.
```

---

# 10. 6 Equipment Slot

캐릭터는 **소수의 장착 자리**를 가진다. 첫 Cycle 의 제안값은 6개다.

```text
E1
E2
E3
E4
E5
E6
```

시스템에서는 슬롯을 `E1` 같은 문자열에 하드코딩하지 않고 별도 Slot Definition으로 관리한다.

예:

```text
EquipmentSlotDefinition
id
displayName
icon
acceptedTags
uiOrder
```

이를 통해 이후 프로젝트에서 슬롯 의미를 다음과 같이 바꿀 수 있다.

```text
E1 → 주 장비
E2 → 보조 장비
E3 → 방어 장비
E4 → 도구
E5 → 액세서리
E6 → 액세서리
```

또는

```text
Weapon
Armor
Tool
Artifact
Accessory-A
Accessory-B
```

본 문서가 소유하는 규칙은 **자리 수가 소지 칸 수보다 훨씬 적다**는 것 하나다. 그 비(比)가
"무엇을 들고 나갈 것인가" 를 비용 있는 선택으로 만든다 — 다 넣고 다닐 수 있으면 선택이
사라진다.

자리가 정확히 몇 개인가는 `[CYCLE]` 수치이며, 첫 Cycle 의 제안값으로 **6** 을 둔다.
슬롯의 세계관상 명칭과 허용 아이템은 Slot Definition 데이터가 결정한다.

---

# 11. 장착 가능 슬롯

아이템 정의는 자신이 장착될 수 있는 슬롯 유형을 선언한다.

예:

```text
Pickaxe
equipTargets:
- TOOL
```

Slot:

```text
E4
acceptedTags:
- TOOL
```

그러면:

```text
Pickaxe → E4
```

장착 가능.

반대로:

```text
Helmet → E4
```

는 실패한다.

실패 이유:

```text
INVALID_EQUIPMENT_SLOT
"이 아이템은 해당 슬롯에 장착할 수 없습니다."
```

종류 이름을 직접 비교하지 않는다.

잘못된 예:

```text
if item == "pickaxe":
    equipSlot4()
```

올바른 방향:

```text
item.equipTargets
       ↓
slot.acceptedTags
       ↓
compatibility
```

이는 상위 문서의 "종류 이름은 데이터의 열쇠이지 분기 조건이 아니다"라는 원칙을 그대로 따른다.

---

# 12. 장착

Inventory에 있는 아이템을 Equipment Slot으로 이동하면 장착된다.

```text
Inventory
Pickaxe
    ↓ EQUIP
Equipment E4
Pickaxe
```

성공하면 두 상태가 동시에 변경된다.

```text
Inventory Slot
Pickaxe
→ Empty

Equipment E4
Empty
→ Pickaxe
```

그리고 장착 효과가 적용된다.

```text
Character
Base Attack = 10

Pickaxe
Attack +3

Effective Attack = 13
```

중요:

```text
가방에 Pickaxe 보유
Attack = 10

Pickaxe 장착
Attack = 13
```

**보유 상태에서는 능력치가 변경되지 않는다.**

---

# 13. 장착 아이템은 가방 칸을 사용하지 않는다

본 기획에서는 장착된 아이템을 **Inventory 30칸과 분리된 Equipment 영역**에 위치시키는 것으로 정의한다.

따라서:

```text
Inventory 30 / 30
```

상태에서 가방 아이템 하나를 장착하면:

```text
Inventory 29 / 30
Equipment 1 / 6
```

이 된다.

다만 해당 아이템은 여전히 캐릭터의 소유다.

즉:

```text
Ownership = Character
Location
INVENTORY → EQUIPPED
```

만 변경된다.

## 13.1 Equipment 슬롯이 아이템을 직접 소유한다 `[WORLD]`

Inventory 와 Equipment 는 **분리된 두 저장소**이고, 아이템은 언제나 둘 중 정확히 한 곳에
있다. Equipment 슬롯은 Inventory 를 가리키는 참조를 들지 않는다 — 아이템 자체를 담는다.

```text
❌ Equipment.E4 = ItemRef(inventorySlot 12)    Inventory 를 가리킨다
✅ Equipment.E4 = Item                          아이템이 여기 있다
```

이 선택 하나가 셋을 한꺼번에 해결한다.

```text
1. 개체 식별자가 필요 없다
   같은 곡괭이 두 자루를 구분할 필요가 없다 — 하나는 E4 에 있고 하나는 가방에 있다.
   IS §2.1 이 요구한 "필요해질 때만 개체" 를 지킨다. 출처를 답하지 못하는 UUID 를
   모든 아이템에 붙이지 않는다.

2. 정렬이 장착을 깨뜨리지 않는다
   §31 정렬이 Inventory 슬롯 인덱스를 전부 재배치해도 Equipment 는 영향이 없다.
   가리키는 것이 없기 때문이다.

3. 불변식이 검사가 아니라 구조에서 나온다
   "한 아이템은 한 곳에만"(§44 Invariant 2)을 검사로 지키는 것이 아니라,
   담길 자리가 애초에 하나뿐이라 성립한다.
```

장착 대상은 `stackable = false` 다 (§5). 겹칠 수 있는 아이템은 장착 자리에 들어가지
않는다 — 자리 하나에 수량 여러 개라는 상태를 만들지 않는다.

내구도·강화·귀속이 들어와 아이템이 개체가 되더라도 이 구조는 그대로다. 개체는 "어디에
있는가" 때문이 아니라 **"같은 종류인데 무엇이 서로 다른가"** 때문에 도입된다 (IS §2.1 · §41).

---

# 14. 해제

장착된 아이템을 가방으로 되돌리는 행동이다.

```text
Equipment
   ↓ UNEQUIP
Inventory
```

해제 성공 조건:

```text
Inventory에 아이템을 받을 공간이 존재한다.
```

성공:

```text
Equipment E4
Pickaxe → Empty

Inventory
Empty → Pickaxe
```

동시에:

```text
Pickaxe가 제공했던 모든 장착 효과 제거
```

가 수행된다.

---

# 15. 가방이 가득 찬 상태의 해제

가방이 다음과 같다고 가정한다.

```text
Inventory
30 / 30
```

그리고 Equipment에 장비가 존재한다.

```text
E4
Pickaxe
```

이 상태에서 단순 해제를 요청하면 실패한다.

```text
INVENTORY_FULL
"장비를 해제할 공간이 없습니다."
```

장비를 월드 바닥에 자동으로 떨어뜨리지 않는다.

사용자가 의도하지 않은 아이템 유실을 방지하기 위해서다.

단, **교체는 다르다.** 새 장비가 가방에서 빠져나간 자리로 헌 장비가 들어가므로 가방이
가득 차 있어도 성립한다 (§16 · §43).

---

# 16. 장비 교체

실제 플레이에서는 장착보다 **교체**가 빈번하게 발생한다.

현재:

```text
E4
Old Pickaxe
```

Inventory:

```text
New Pickaxe
```

New Pickaxe를 E4에 장착하면 시스템은 다음을 하나의 Transaction으로 처리한다.

```text
New Pickaxe
Inventory → E4

Old Pickaxe
E4 → Inventory
```

결과:

```text
E4
New Pickaxe

Inventory
Old Pickaxe
```

장비 교체는 상위 Item System에서 정의한 것처럼 **해제 + 새 장착이 아니라 플레이어에게는 하나의 성공 단위**로 처리한다.

## 16.1 교체는 가방이 가득 차 있어도 성공한다

```text
Inventory 30 / 30   (그중 하나가 New Pickaxe)
E4                  Old Pickaxe

교체 요청
    ↓
New Pickaxe 가 나간 자리에 Old Pickaxe 가 들어간다
    ↓
성공
Inventory 30 / 30   (그중 하나가 Old Pickaxe)
E4                  New Pickaxe
```

같은 상태에서 **단순 해제는 실패한다**(§15). 두 행동이 요구하는 것이 다르기 때문이다.

```text
해제    가방에 칸 하나를 새로 요구한다      → 30/30 에서 실패
교체    가방 칸 수를 바꾸지 않는다          → 30/30 에서 성공
```

"가방이 가득 찼다 = 장착 관련 행동이 전부 실패한다" 가 아니다.

---

# 17. 교체의 원자성

다음 상황이 발생해서는 안 된다.

```text
Old Equipment 제거 성공
↓
New Equipment 장착 실패
```

또는

```text
New Equipment 장착 성공
↓
Old Equipment 반환 실패
```

교체 전 전체 조건을 검증한다.

```text
Validate
   ↓
Old 장비를 이동할 수 있는가?
   ↓
New 장비가 해당 Slot과 호환되는가?
   ↓
New 장비가 실제 Inventory에 존재하는가?
   ↓
Success
   ↓
한 번에 상태 변경
```

검증에 실패하면:

```text
Inventory 변화 없음
Equipment 변화 없음
능력치 변화 없음
```

상위 Item System의 "아이템 변화는 함께 성공하거나 함께 실패해야 한다"는 원칙을 장착에도 동일하게 적용한다.

---

# 18. Drag & Drop `[VIEW]`

PC UI 기준 주요 조작은 Drag & Drop을 지원한다.

### Inventory → Inventory

```text
Slot A → Empty Slot B
```

아이템 위치 이동.

```text
Slot A → 같은 Stack Item
```

Stack Merge.

```text
Slot A → 다른 Item
```

두 Slot Swap.

### Inventory → Equipment

```text
유효한 Slot
→ Equip

유효하지 않은 Slot
→ Drop 거절
```

UI에서는 유효한 Slot을 Highlight한다.

### Equipment → Inventory

```text
Empty Inventory Slot
→ Unequip
```

### Equipment → Equipment

해당 아이템이 대상 슬롯에도 적합하다면 이동한다.

아니면 거절한다.

---

# 19. 클릭 기반 조작 `[VIEW]`

Drag & Drop을 사용할 수 없는 환경도 지원한다.

아이템 선택:

```text
Item Select
    ↓
Action Menu
사용
장착
분할
버리기
상세보기
```

장착 선택 시:

장착 가능한 슬롯이 하나뿐이라면:

```text
즉시 장착
```

장착 가능한 슬롯이 여러 개라면:

```text
장착 슬롯 선택 UI
```

를 표시한다.

---

# 20. Double Click / Quick Equip `[VIEW]` — 우선순위는 `[WORLD]`

선택적으로 다음 UX를 제공할 수 있다.

```text
Inventory Item Double Click
         ↓
Quick Equip
```

Quick Equip 규칙:

```text
1. World 가 이 아이템의 장착 가능 자리를 우선순위 순으로 관찰에 싣는다
2. View 는 그중 비어 있는 첫 자리에 장착을 요청한다
3. 빈 자리가 없으면 교체 후보를 표시하고 사용자의 선택을 기다린다
```

우선순위는 **World 가 소유한다.** Slot Definition 의 `equipPriority` 가 그 값이고,
`uiOrder`(§10)와 별개다 — 화면 배치 순서가 곧 게임 판정이 되면 §49 P8 을 위반한다.

교체가 필요한 상황에서 사용자의 확인 없이 기존 장비를 임의로 교체하지 않는다.

---

# 21. 장착 효과 계산

캐릭터 최종 능력치는 기본값과 현재 장착된 아이템 기여를 합성해 계산한다.

개념적으로:

```text
Effective Character State
=
Base Character State
+
Equipment Contributions
+
Other Runtime Effects
```

장착 아이템만 Equipment Contributions에 포함된다.

셋은 **같은 합성 얼개의 서로 다른 출처**다. 장비 효과와 소비 아이템 지속 효과를 위해
서로 다른 기계를 만들지 않는다 — 상위 IS §5.3 이 "이미 있는 조건 합성 얼개 위에 얹는다"
로 요구한 형태다.

```text
하나의 합성 얼개
 ├ Base            몸이 원래 가진 값
 ├ Equipment       지금 적용된 것   — 해제하면 사라진다
 └ Runtime Effect  사건의 결과      — 만료되면 사라진다
```

둘의 차이는 **사라지는 조건**뿐이다. 계산하는 자리는 하나다.

상위 Item System도 유효 능력치를 기본값과 장착 기여로 계산하고, 해제하면 정확히 원복되는 구조를 요구한다.

---

# 22. 능력 부여

아이템은 단순 수치 외에 캐릭터가 할 수 있는 행동을 추가할 수 있다.

예:

```text
Pickaxe 장착
    ↓
Mining Usage 제공
    ↓
Character Available Actions
    ↓
Mine 가능
```

해제:

```text
Pickaxe 해제
    ↓
Mining Usage 제거
    ↓
Mine 불가능
```

중요한 것은 채굴 코드가 다음과 같이 묻지 않는다는 것이다.

```text
"곡괭이를 장착했는가?"
```

대신:

```text
"현재 이 캐릭터가 채굴 용도를 가지고 있는가?"
```

를 판단한다.

상위 Item System 역시 장착된 것들이 주는 능력과 선언된 용도를 합쳐 가능한 행동을 계산하도록 정의한다.

---

# 23. Item Definition

Inventory / Equipment가 요구하는 Item Definition의 최소 정보는 다음과 같다.

```text
ItemDefinition
id
displayName
description
icon
category
stackable
stackLimit
actions
equipable
equipTargets
grants
statContributions
```

예:

```text
{
  id: "pickaxe_iron",
  category: "equipment",
  stackable: false,
  equipable: true,
  equipTargets: ["TOOL"],
  grants: [
    "MINING"
  ]
}
```

새 아이템 추가 시 Inventory System 코드를 수정해서는 안 된다.

---

# 24. Inventory State

개념 데이터:

```text
InventoryState
{
    capacity: N,          // Cycle 이 소유하는 값 — 첫 Cycle 제안값 30
    slots: [
        ItemStack | null,
        ...
    ]
}
```

`capacity` 만큼의 슬롯이 존재한다. 슬롯은 아이템을 **담는다** — 다른 곳을 가리키지
않는다 (§13.1).

---

# 25. Equipment State

```text
EquipmentState
{
    slots: [
        { definition: SlotDefinition, item: Item | null },
        ...
    ]
}
```

`item` 은 **참조가 아니라 아이템 그 자체**다 (§13.1). 슬롯이 아이템을 담으므로 Inventory
쪽 인덱스가 어떻게 바뀌어도 장착 상태는 영향받지 않는다.

슬롯 수를 코드 필드 6개로 고정하지 않는다. 정의 목록을 순회해 구성한다 — 그래야 자리
수가 데이터가 된다.

이를 통해 향후 캐릭터 유형에 따라:

```text
6 Slot
8 Slot
4 Slot
```

구조로 확장할 수 있다.

첫 Cycle 의 제안값은 **6 자리**이며, 그 값은 Cycle 이 소유한다 (§0 · §10).

---

# 26. 현재 컨트롤 캐릭터

Inventory UI는 현재 플레이어가 **컨트롤 중인 캐릭터**를 기준으로 표시한다.

```text
Controlled Character A
    ↓
Inventory A
Equipment A
```

캐릭터 제어가 B로 변경된다면:

```text
Controlled Character B
    ↓
Inventory B
Equipment B
```

로 UI Binding 대상이 바뀐다.

본 문서에서는 **파티 공용 가방**을 정의하지 않는다.

즉 기본 정책은:

```text
Character owns Inventory
Character owns Equipment
```

이다.

공용 창고나 파티 Inventory가 필요해질 경우 별도의 Container System으로 확장한다.

## 26.1 이 세계의 용어와의 대응

본 문서는 일반적인 게임 기획 용어로 쓰였다. AdvProtoH 세계의 개념과 다음과 같이
대응한다.

| 이 문서 | AdvProtoH | 비고 |
|---|---|---|
| Player | Observer | 세계를 관찰하고 요청하는 주체 |
| Character / 캐릭터 | Body | 세계 안에 있고 능력치를 갖는 것 |
| Inventory · Equipment 의 소유자 | Body | 관찰은 Observer 별로 나가지만 소유는 Body 다 |
| 현재 컨트롤 캐릭터 | — | **아직 이 세계에 없는 개념이다** |

마지막 행이 결손이다. 지금 세계에는 Observer 하나에 Body 하나가 매여 있고 컨트롤 대상을
바꾸는 개념이 없다. 따라서 위의 A → B 전환은 **이 문서가 여는 것이 아니라 그 개념이
생길 때를 위한 대비**다. 첫 Cycle 은 Body 하나만 다룬다.

---

# 27. Inventory Observer

UI가 Runtime 내부 데이터를 직접 읽지 않는다.

World / Character가 Inventory View를 제공한다.

예:

```text
InventoryView
capacity
usedSlots
slots[]
 ├ item
 ├ quantity
 ├ display
 ├ availableActions
 └ unavailableReasons
```

상위 문서도 UI에 종류·수량·표시 정보와 현재 가능한 행동을 함께 관찰시키도록 요구한다.

---

# 28. Equipment Observer

Equipment 역시 동일한 방식으로 관찰한다.

```text
EquipmentView
slots[]
 ├ slotDefinition
 ├ item
 ├ canUnequip
 └ unavailableReason
effectiveStats
activeGrants
activeUsages
```

UI는 여기서 받은 정보를 표현할 뿐 직접 능력치를 계산하지 않는다.

---

# 29. 가능 / 불가능 사유

모든 Inventory / Equipment 행동은 Boolean만 반환하지 않는다.

```text
canEquip = false
```

만 전달하는 것이 아니라:

```text
canEquip = false
reason =
INVALID_EQUIPMENT_SLOT
```

같은 사유를 함께 제공한다.

**아래 표가 사유 코드의 단일 출처다.** 본문의 어떤 절도 이 표에 없는 코드를 쓰지 않는다.

| Code | 의미 |
|---|---|
| `ITEM_NOT_FOUND` | 해당 아이템이 존재하지 않음 |
| `INVENTORY_FULL` | 가방 공간 부족 |
| `INVALID_EQUIPMENT_SLOT` | 이 자리에 장착할 수 없는 아이템 |
| `ITEM_NOT_EQUIPPABLE` | 장착 가능한 아이템이 아님 |
| `ITEM_ALREADY_EQUIPPED` | 이미 장착된 아이템 |
| `ACTION_NOT_AVAILABLE` | 현재 행동할 수 없음 |
| `STACK_FULL` | Stack 한도 초과 |
| `STACK_SPLIT_NO_SPACE` | 분할해 담을 빈 칸이 없음 (§33) |
| `INVALID_QUANTITY` | 잘못된 수량 |
| `LOCKED_ITEM` | 현재 이동할 수 없는 아이템 |

UI는 해당 사유를 사용자용 문자열로 변환한다.

## 29.1 `SLOT_OCCUPIED` 는 실패 사유가 아니다

이미 찬 자리에 아이템을 넣는 것은 **정상 성공 경로(교체 · §16)** 다. 따라서 실패 코드로
두지 않는다.

다만 자동으로 교체할지 사용자에게 물을지는 판단이 필요하다. 그 신호는 실패가 아니라
**관찰**로 나간다.

```text
REQUIRES_SLOT_CHOICE
장착 가능한 빈 자리가 없다 — 교체 후보 목록이 함께 실린다
```

이것을 받은 View 는 후보를 보여주고 사용자의 선택을 기다린다 (§20). 사용자가 자리를
지정해 다시 요청하면 그것은 교체이고, 성공한다.

---

# 30. Inventory Action API

모든 변경은 지정된 행동 경로를 통한다.

예:

```text
TryAddItem()
TryRemoveItem()
MoveItem()
SwapItem()
MergeStack()
SplitStack()
EquipItem()
UnequipItem()
SwapEquipment()
UseItem()
DropItem()
```

게임의 다른 Rule이 직접 Inventory 배열을 수정해서는 안 된다.

이는 상위 Item System에서 요구한 **획득과 제거의 변경 단일 통로** 원칙을 따른다.

Preview(§37)는 이 목록에 없다. **아무것도 바꾸지 않기 때문이다.**

```text
Action     세계를 바꾼다           → 이 목록을 통한다
Observer   세계를 읽는다           → §27 · §28 의 관찰 계약을 통한다
Preview    바꾸지 않고 계산한다     → 관찰 쪽이다 (§28)
```

---

# 31. Inventory 정렬

정렬 버튼을 제공한다.

예:

```text
[정렬]
```

기본 정렬 우선순위:

```text
Category
   ↓
Definition Order
   ↓
Item Name
```

정렬 실행 시:

* 아이템 소유 상태는 변경되지 않는다.
* Stack 가능한 아이템은 가능한 범위에서 합친다.
* Equipment는 정렬 대상에서 제외한다.
* 장착 효과는 변경되지 않는다.

정렬은 **되돌릴 수 없다.** §33 으로 일부러 나눠 둔 Stack 도 다시 합쳐진다. 소유한 것의
총량은 변하지 않지만 배치는 사라지므로, 실행 전 확인을 두는 것이 좋다 `[VIEW]`.

Equipment 가 정렬에 영향받지 않는 이유는 규칙으로 막아서가 아니라 **애초에 가리키지
않기 때문**이다 (§13.1).

---

# 32. 필터 `[VIEW]`

인벤토리 UI는 다음 필터를 지원할 수 있다.

```text
전체
장비
소비
재료
기타
```

필터는 **표시만 변경한다.**

Inventory 내부 순서나 실제 소유 상태를 변경하지 않는다.

상위 Item System도 분류·정렬·필터를 카탈로그의 표시 정보를 사용하는 UI 기능으로 정의한다.

---

# 33. Stack Split

Stack 아이템에서 수량 분리를 지원한다.

예:

```text
Stone × 30
↓
[15] [15]
```

조건:

```text
빈 Slot 필요
```

빈 슬롯이 없으면:

```text
STACK_SPLIT_NO_SPACE
```

로 실패한다.

수량은:

```text
1 ≤ splitAmount < currentAmount
```

여야 한다.

---

# 34. 아이템 버리기

Inventory에서 아이템을 월드로 버릴 수 있다.

```text
Inventory
   ↓ DROP
World Item
```

단, 실제 World Item System이 구현되지 않은 단계에서는 버튼을 숨기거나 `ACTION_NOT_AVAILABLE`로 관찰한다.

상위 Item System은 버리기를 캐릭터의 아이템을 세계에 놓는 원자적 이동으로 정의하고 있다.

---

# 35. 장착 중인 아이템 버리기

장착된 아이템을 즉시 버리는 직접 행동은 기본적으로 허용하지 않는다.

흐름:

```text
Equipment
    ↓
Unequip
    ↓
Inventory
    ↓
Drop
    ↓
World
```

필요하다면 UI에서:

```text
[버리기]
```

하나의 버튼으로 보여주되 내부적으로는 하나의 검증된 Transaction으로 처리할 수 있다.

이때 **가방 공간을 요구하지 않는다.** 위 흐름도는 플레이어가 이해하는 순서일 뿐이고,
실제 이동은 한 걸음이다.

```text
EQUIPPED → WORLD
```

가방을 경유하지 않으므로 §15 의 `INVENTORY_FULL` 이 여기에 적용되지 않는다. 가방이 가득
차 있어도 장착한 것을 버릴 수 있다. 다만 §13.1 에 따라 그 아이템은 Equipment 슬롯이
직접 담고 있었으므로, 자리를 비우는 것과 세계에 놓는 것이 하나의 단위로 일어난다.

---

# 36. UI Feedback `[VIEW]`

Inventory / Equipment 행동에는 즉각적인 시각 피드백이 필요하다.

### 장착 가능

```text
Equipment Slot Highlight
```

### 장착 불가능

```text
Invalid Highlight
+ Tooltip
"이 슬롯에는 장착할 수 없습니다."
```

### Inventory Full

```text
가방에 빈 공간이 없습니다.
```

### Equip Success

```text
아이템 → Equipment Slot 이동
능력치 Preview → 확정
```

### Unequip Success

```text
아이템 → Inventory 이동
효과 제거
```

---

# 37. 능력치 Preview

장비를 선택하거나 장착 슬롯 위에 올렸을 때 현재 장비와 비교할 수 있다.

예:

```text
현재
공격력 15
방어력 8

새 장비 장착 후
공격력 18 (+3)
방어력 6 (-2)
```

단 Preview는 UI가 임의 계산하지 않는다.

Runtime 계산기를 사용해:

```text
PreviewEquipmentChange()
```

결과를 받아 표시한다. 이 계산은 §28 `EquipmentView` 가 소유하는 **읽기 전용 관찰**이며,
§30 의 Action 통로가 아니다 — 세계를 바꾸지 않기 때문이다.

따라서 실제 장착 결과와 Preview가 다르게 나오는 문제를 방지한다.

---

# 38. Equipment Effect Lifecycle

장비 효과는 반드시 다음 생명주기를 가진다.

```text
EQUIP
 ↓
Contribution 생성
 ↓
Character Effective State 재계산

UNEQUIP
 ↓
Contribution 제거
 ↓
Character Effective State 재계산
```

절대로:

```text
장착 → Attack += 5
해제 → Attack -= 5
```

처럼 누적 수정만으로 처리하지 않는 것을 권장한다.

대신:

```text
Base
+
현재 장착 Contribution
```

을 기준으로 다시 계산한다.

그래야 교체·로드·상태 복원 과정에서 값이 중복 적용되는 문제를 줄일 수 있다.

---

# 39. Save / Load

저장해야 하는 최소 상태:

```text
Character
Inventory
 ├ Capacity
 └ Slots

Equipment
 └ Slot → Item
```

로드 시:

```text
1. Inventory 복원
2. Equipment 복원
3. Equipment 정의 유효성 검증
4. Effective Stats 재계산
5. Grants / Available Actions 재계산
```

저장된 최종 능력치를 그대로 다시 장비 효과 위에 더하지 않는다. 언제나 §38 의 재계산을
거친다 — 그러지 않으면 로드할 때마다 값이 누적된다.

3번의 유효성 검증에서 **카탈로그에 없는 정의**를 만나면 다음을 따른다.

```text
그 아이템을 없는 것으로 다루고 자리를 비운다
무엇이 사라졌는지 관찰에 남긴다 — 조용히 버리지 않는다
로드 자체는 실패시키지 않는다
```

아이템 하나의 정의가 사라졌다고 캐릭터 전체를 열 수 없게 만들지 않는다.

---

# 40. 장착 슬롯 잠금 확장

향후 진행도 시스템이 필요하다면 6개의 슬롯 중 일부를 잠글 수 있도록 확장 가능하다.

예:

```text
E1 OPEN
E2 OPEN
E3 OPEN
E4 LOCKED
E5 LOCKED
E6 LOCKED
```

다만 **현재 기본 사양에서는 6개 슬롯 모두 사용 가능**한 것을 기준으로 한다.

잠금 시스템은 별도 성장 요구가 생길 때 추가한다.

---

# 41. 아이템 개체화

현재 Item System의 기본 방향은 Stack 기반이다.

다만 다음 요소가 추가되는 장비는 개별 Instance가 필요해진다.

```text
내구도
강화 수치
랜덤 옵션
귀속
개별 제작자
개별 획득 출처
```

상위 문서도 같은 종류의 아이템 간 상태 차이가 필요할 때에만 Item Instance를 도입하도록 정의한다.

예:

```text
Iron Sword
Instance A
Durability 80

Instance B
Durability 25
```

이 경우 둘을 하나의 Stack으로 합칠 수 없다.

개체 도입은 **위치를 구분하기 위한 것이 아니다.** 어디에 있는가는 §13.1 의 저장소 분리가
이미 해결했다. 개체는 오직 **같은 종류 사이에 상태 차이가 필요할 때** 도입되며, 그때
그 개체는 어디서 왔는지 답할 수 있어야 한다 (IS §2.1).

---

# 42. 대표 플레이 흐름

## 흐름 A — 아이템 획득

```text
Stone 획득
↓
기존 Stack 확인
↓
합칠 수 있음
↓
Stone × 12
→
Stone × 13
```

---

## 흐름 B — 새로운 장비 획득

```text
Pickaxe 획득
↓
Inventory 빈 Slot 탐색
↓
Slot 08
Pickaxe
```

---

## 흐름 C — 장비 장착

```text
Inventory Open
↓
Pickaxe 선택
↓
[장착]
↓
호환 Slot 탐색
↓
E4
↓
Inventory Pickaxe 제거
↓
E4 Pickaxe 등록
↓
Mining Grant 활성화
↓
채굴 가능
```

---

## 흐름 D — 장비 해제

```text
E4 Pickaxe
↓
[해제]
↓
Inventory 공간 검증
↓
Inventory로 이동
↓
Mining Grant 제거
↓
채굴 불가능
```

---

## 흐름 E — 장비 교체

```text
E4
Old Pickaxe

Inventory
New Pickaxe
↓
New Pickaxe → E4
↓
교체 Transaction 검증
↓
Old Pickaxe → Inventory
New Pickaxe → E4
↓
Old Effect 제거
New Effect 적용
```

---

# 43. Inventory Full 대표 시나리오

현재:

```text
Inventory
30 / 30
```

### 새로운 비Stack 아이템 획득

```text
실패
"가방에 빈 공간이 없습니다."
```

월드에 있던 아이템은 그대로 남아야 한다.

### 기존 Stack 아이템 획득 (전량이 들어갈 때)

현재:

```text
Stone × 30 / 99
```

Stone 5개 획득:

```text
성공
Stone × 35 / 99
```

### 기존 Stack 아이템 획득 (일부만 들어갈 때)

현재:

```text
Stone × 80 / 99
빈 슬롯 0
```

Stone 30개 획득:

```text
실패 INVENTORY_FULL
Stone × 80 그대로 — 19 도 들어가지 않는다
```

부분 수용은 없다 (§6.1). 들어가지 못한 30개는 세계에 그대로 남는다.

### Equipment 해제

```text
실패
"장비를 해제할 공간이 없습니다."
```

### Equipment 교체

```text
성공
Inventory 30 / 30 유지
E4 만 New 로 바뀐다
```

해제는 실패하는데 교체는 성공한다. 교체는 새 칸을 요구하지 않기 때문이다 (§15 · §16.1).

### Inventory 장비를 Equipment에 장착

```text
성공
Inventory 30 / 30
→
29 / 30
```

### 장착한 것을 버리기

```text
성공
Inventory 30 / 30 유지
E4 → Empty
World 에 아이템 생성
```

가방을 경유하지 않으므로 가방이 가득 차 있어도 성립한다 (§35).

---

# 44. 시스템 불변 조건

Inventory / Equipment 시스템은 항상 다음 조건을 만족해야 한다.

```text
Invariant 1
Inventory Slot 수는
0 ≤ Used Slot ≤ Capacity
```

```text
Invariant 2
하나의 아이템은 정확히 한 곳에 있다.
INVENTORY · EQUIPPED · WORLD · CONTAINER 중 하나다.
개체 모델이 없어도 성립한다 — 저장소가 아이템을 직접 담기 때문이다 (§13.1).
```

```text
Invariant 3
Equipment에 존재하는 아이템은
Inventory에도 동시에 존재하지 않는다.
Invariant 2 의 따름 결과이며, 별도 검사를 요구하지 않는다.
```

```text
Invariant 4
장착 효과는
Equipment에 실제 존재하는 아이템에서만 발생한다.
```

```text
Invariant 5
실패한 행동은
Inventory / Equipment / Character State를 바꾸지 않는다.
```

```text
Invariant 6
장비를 해제하면
그 장비가 제공하던 효과가 정확하게 사라진다.
```

---

# 45. 자동 테스트 기준

## Inventory

### Test 01

```text
빈 Inventory에 Stone 획득
```

기대:

```text
1 Slot 사용
Stone × 1
```

### Test 02

```text
Stone × 1 보유
Stone × 1 획득
```

기대:

```text
Stone × 2
Used Slot 변화 없음
```

### Test 03

30개의 비Stack 아이템 보유 상태에서 신규 아이템 획득.

기대:

```text
획득 실패
Inventory 변화 없음
```

---

# 46. Equipment 자동 테스트

### Test 04 — 장착

```text
Pickaxe Inventory 보유
↓
Equip
```

기대:

```text
Inventory에서 제거
Equipment에 존재
Grant 활성화
```

### Test 05 — 해제

기대:

```text
Equipment에서 제거
Inventory로 이동
Grant 제거
```

### Test 06 — 잘못된 Slot

```text
Helmet
→ TOOL Slot
```

기대:

```text
실패
상태 변화 없음
INVALID_EQUIPMENT_SLOT
```

### Test 07 — 교체

```text
Old Equipment
→
New Equipment
```

기대:

```text
Old → Inventory
New → Equipment
Old Effect 없음
New Effect만 존재
```

### Test 08 — 보유와 적용 분리

```text
Attack +5 Sword 획득
```

장착 전:

```text
Attack 변화 없음
```

장착 후:

```text
Attack +5
```

해제:

```text
Attack 원복
```

이는 상위 Item System의 장착 완료 조건인 "장착/해제만으로 유효 능력치와 가능한 행동이 바뀌고 정확히 원복된다"를 직접 검증한다.

### Test 09 — 가방이 가득 찬 상태의 교체

```text
Inventory 30 / 30 (그중 하나가 New Pickaxe)
E4 Old Pickaxe
↓
E4 에 New Pickaxe 장착
```

기대:

```text
성공
Inventory 30 / 30 (그중 하나가 Old Pickaxe)
E4 New Pickaxe
New Effect 만 적용
```

같은 상태에서 단순 해제는 `INVENTORY_FULL` 로 실패한다. **두 결과가 함께 나와야 한다** —
하나만 통과하면 §15 와 §16.1 중 하나를 잘못 구현한 것이다.

### Test 10 — 실패한 교체는 아무것도 바꾸지 않는다

```text
E4 Old Pickaxe
Inventory 에 없는 아이템을 E4 에 장착 요청
```

기대:

```text
실패 ITEM_NOT_FOUND
E4 여전히 Old Pickaxe
Inventory 변화 없음
유효 능력치 변화 없음
Grant 변화 없음
```

Invariant 5 를 직접 검증한다.

### Test 11 — 부분 획득 거부

```text
Stone × 80 보유 (한도 99)
빈 슬롯 0
Stone × 30 획득 요청
```

기대:

```text
실패 INVENTORY_FULL
Stone × 80 그대로 — 19 도 들어가지 않는다
```

§6.1 을 직접 검증한다.

### Test 12 — 정렬이 장착을 깨뜨리지 않는다

```text
Pickaxe 장착
↓
Inventory 정렬 실행
```

기대:

```text
E4 여전히 Pickaxe
Grant 유지
유효 능력치 변화 없음
```

§13.1 의 "Equipment 는 Inventory 를 가리키지 않는다" 를 검증한다.

### Test 13 — 로드가 값을 누적시키지 않는다

```text
Attack +5 Sword 장착 상태로 저장
↓
로드
↓
다시 로드
```

기대:

```text
두 번 모두 Effective Attack 동일
누적되지 않는다
```

§38 · §39 를 직접 검증한다.

---

# 47. 통합 검증 시나리오

최종적으로 다음 플레이 흐름이 끊김 없이 동작해야 한다.

```text
캐릭터가 세계에서 아이템을 획득한다
↓
아이템이 Inventory 에 들어온다
↓
Inventory UI를 연다
↓
획득한 아이템의
이름 / 수량 / 설명 / 가능 행동을 확인한다
↓
장비 아이템을 선택한다
↓
장착 가능한 Equipment Slot이 표시된다
↓
장착 가능한 자리 중 하나에 장착한다
↓
Inventory에서 해당 아이템이 빠진다
↓
Equipment에 아이템이 표시된다
↓
캐릭터의 능력치 또는 가능한 행동이 변경된다
↓
다른 장비를 같은 Slot에 넣는다
↓
기존 장비와 새 장비가 원자적으로 교체된다
↓
새 효과만 캐릭터에게 적용된다
↓
장비를 해제한다
↓
Inventory에 다시 들어온다
↓
장비가 제공했던 효과가 정확하게 사라진다
```

---

# 48. 완료 기준

**이 목록 전체는 한 Cycle 의 완료 기준이 아니다.** 상위 IS §6 이 Cycle 경계를 이미
그었고, 이 문서의 요구는 그 셋에 나뉘어 들어간다.

| Cycle (IS §6) | 이 문서에서 그 Cycle 이 요구하는 것 |
|---|---|
| **1. 아이템의 바닥** | 슬롯 모델(§4) · Stack(§5) · 획득 우선순위와 원자성(§6 · §6.1) · Inventory Observer(§27) · 사유 코드(§29) · Action 단일 통로(§30) · 이동·정렬·필터·분할(§31~§33) |
| **2. 장착** | 장착 자리(§10) · 적합성(§11) · 장착·해제·교체(§12~§17) · 저장소 분리(§13.1) · 효과 계산과 생명주기(§21 · §38) · 능력 부여(§22) · Equipment Observer(§28) · Preview(§37) |
| **4. 세계의 아이템** | 버리기(§34) · 장착 중 버리기(§35) |

§39 Save/Load 와 §40 자리 잠금은 어느 Cycle 에도 매이지 않는다 — 영속과 성장이 세계에
설 때 함께 온다.

아래는 그 셋을 모두 지난 뒤의 **최종 도달 상태**다. 한 Cycle 의 DONE 으로 쓰지 않는다.

### Inventory

* 유한한 수의 가방 Slot이 존재하고, 그 수를 Cycle 이 정한다.
* UI를 통해 Inventory를 열고 닫을 수 있다.
* 모든 보유 아이템을 동일한 구조로 표시할 수 있다.
* Stack 가능한 아이템을 합칠 수 있다.
* Stack 불가능 아이템을 개별 슬롯에 보관할 수 있다.
* 빈 공간 부족을 판정할 수 있다.
* Drag & Drop 또는 선택형 UI로 아이템을 이동할 수 있다.
* Item Detail에서 가능한 행동과 불가능 이유를 확인할 수 있다.

### Equipment

* 현재 컨트롤 캐릭터가 소지 칸 수보다 훨씬 적은 수의 Equipment Slot을 가진다.
* 각 Slot은 Item Definition에 따라 장착 가능 여부를 판단한다.
* Inventory → Equipment 장착이 가능하다.
* Equipment → Inventory 해제가 가능하다.
* 기존 장비와 신규 장비를 교체할 수 있다.
* 장착 상태에서만 능력치 및 행동 효과가 적용된다.
* 해제하면 장착 효과가 정확하게 사라진다.
* 잘못된 Slot 장착은 명시적인 사유와 함께 실패한다.
* 실패한 장착/해제/교체는 일부 상태만 변경시키지 않는다.
* 가방이 가득 찬 상태에서 해제는 실패하고 교체는 성공한다.

### Architecture

* 아이템 종류 이름으로 Inventory Rule을 분기하지 않는다.
* UI가 Character 내부 구조를 직접 수정하지 않는다.
* 모든 변경은 Inventory / Equipment Action을 통해 수행된다.
* UI 표시용 가능 여부와 실제 실행 가능 여부가 같은 판정을 사용한다.
* 신규 아이템 추가만으로 기존 Inventory / Equipment 코드를 수정하지 않고 장착 관계를 정의할 수 있다.
* 가방 칸 수와 장착 자리 수를 바꿔도 규칙 코드가 수정되지 않는다.
* View 가 선택지 목록이나 가능 여부를 자기 코드에 적어 두지 않는다.

---

# 49. 본 문서의 설계 원칙

```text
P1. 가방과 장착은 다르다.
가방은 "가지고 있는 것"이고
장착은 "지금 적용되는 것"이다.
```

```text
P2. 가방은 유한하다.
그 유한함이 "무엇을 들고 다닐 것인가" 를 선택으로 만든다.
몇 칸인가는 Cycle 이 소유하는 수치이며,
이 문서의 어떤 원칙도 특정 칸 수에 매이지 않는다.
```

```text
P3. 장착 자리는 소지 칸 수보다 훨씬 적다.
그 비(比)가 자리를 비용으로 만든다 — 다 넣고 다닐 수 없기 때문이다.
자리의 수와 이름과 허용 아이템은 모두 데이터가 정의한다.
```

```text
P4. 장착 아이템은 가방 Slot을 차지하지 않는다.
아이템의 소유권은 유지되지만
현재 위치가 INVENTORY에서 EQUIPPED로 변경된다.
```

```text
P5. 장착 가능한지는 종류 이름이 아니라
Item Definition과 Slot Definition의 적합성으로 판단한다.
```

```text
P6. 보유만으로 효과가 발생하지 않는다.
Equipment에 들어간 아이템만
캐릭터의 능력치와 행동을 바꾼다.
```

```text
P7. 장착 / 해제 / 교체는 원자적이다.
성공하면 관련 상태가 전부 바뀌고,
실패하면 아무것도 바뀌지 않는다.
```

```text
P8. UI는 규칙을 만들지 않는다.
세계가 계산한 Inventory / Equipment 상태와
가능 행동 / 불가능 사유를 UI가 표현한다.
```

```text
P9. 아이템은 정확히 한 곳에 있다.
저장소가 아이템을 담고, 다른 곳을 가리키지 않는다.
그래서 개체 식별자 없이도 두 곳에 동시에 존재할 수 없다.
```

---

# 50. 상위 Item System과의 관계

기존 Item System은 슬롯 수나 가방 칸 수를 직접 정의하지 않고, 해당 내용을 후속 Inventory / Equipment 기획이 소유하도록 남겨 두었다.

또 기존 문서에서 소지 한도는 당시 문서의 범위 밖으로 명시되어 있었다. 본 문서는 그 후속
기획으로서 이 영역을 구체화한다.

다만 **확정하는 것은 수치가 아니라 관계다.** 상위 IS §2 가 "수치는 위로 올라가지 않는다"
로 못박았고, 프로젝트 규칙도 수치를 Cycle 에 둔다. 따라서 이 문서가 세우는 것은 다음
둘이고, `30` 과 `6` 은 첫 Cycle 을 위한 **제안값**이다.

```text
가방은 유한하다
장착 자리는 소지 칸 수보다 훨씬 적다
```

이렇게 두어야 향후의 가방 확장(§3.1)과 자리 잠금·해금(§40)이 이 문서의 원칙을 어기지
않고 들어올 수 있다.

따라서 두 문서의 관계는 다음과 같다.

```text
Item System
    │
    ├─ 아이템이 무엇인가
    ├─ 어떻게 소유되는가
    ├─ 사용 / 장착이 어떤 의미인가
    └─ 장착된 것이 어떻게 능력을 제공하는가
                 ↓
Inventory & Equipment System
    │
    ├─ 어디에 몇 개를 보관하는가
    ├─ UI에서 어떻게 관리하는가
    ├─ 가방 Slot 을 어떻게 운용하는가
    ├─ Equipment Slot 을 어떻게 운용하는가
    ├─ 장착 / 해제 / 교체를 어떻게 처리하는가
    └─ 가방 Full / Slot 적합성 등의 실제 플레이 규칙
```

이 구조가 완성되면 아이템은 단순히 캐릭터가 가지고 있는 수량값이 아니라,
**유한한 가방 안에서 관리되고, 그중 소수만을 골라 현재 컨트롤 캐릭터에게 적용하며, 장착 여부에 따라 실제 캐릭터의 능력과 행동이 변화하는 자원**
으로 플레이 안에서 완전히 성립한다.
