# C022 — World Semantic

> 자리는 **새 자료가 아니라 새 계산**이다. 지닌 것은 이미 세계에 있고, 정의도 이미
> 있다. 더해지는 것은 "그것들이 얼마를 차지하는가" 라는 하나의 물음과, 그 답이
> 넘칠 때 거절하는 한 자리, 그리고 스스로 줄이는 문 하나다.

## SEMANTIC DELTA

    REUSED

        Actor.Inventory · Inventory.Items          지닌 것 (C001 · C020)
        ItemDefinition · ITEM_CATALOG              정의의 단일 출처 (C020)
        ItemDefinition.Uses                        그 종류가 몸에 주는 용도 (C020)
        Deposit.ResourceKind                       그 광맥이 내는 종류 (C001 — **이미 있었다**)
        RULE-INVENTORY-REMOVE-001                  줄이는 단일 통로 (C020)
        RULE-BODY-USES-001                         이 몸에 그 용도가 지금 있는가 (C020)
        Action 얼개 (Action.Kind · Replaceable)     C002 · C019
        InteractionView.available / unavailableReason · ItemActionView
                                                   가능/사유 계약 (C009 · C010 · C020)

    ADDED

        ItemDefinition.StackLimit                  한 자리에 몇까지 겹치는가 (≥ 1)
        World.InventoryCapacity                    몸이 지닌 자리의 수 (세계의 성질)
        Inventory.UsedSlots                        **파생** — 저장하지 않는다 (RATIONALE 1)
        World.AcquirableKinds                      **파생** — 세계가 지금 다시 내어줄 수 있는 종류
        RULE-INVENTORY-ROOM-001                    자리를 세는 유일한 자리
        RULE-WORLD-ACQUIRABLE-KINDS-001            돌아올 길이 있는가의 유일한 자리
        RULE-ITEM-DISCARD-001                      덜어내기
        InteractionId `discard-item`               요청 가능한 항목 하나

    CHANGED

        ItemDefinition.Stackable
            OLD  정의가 직접 지니는 값
            NEW  **StackLimit > 1 에서 나온다** — 정의가 두 번 답하지 않는다.
                 두 곳에 적히면 반드시 어긋난다 (command-catalog.ts 가 이미 내린 판단)
            관찰  `InventoryItemView.stackable` 계약은 그대로다. 값의 출처만 바뀐다

        RULE-INVENTORY-ADD-001
            NEW PRECONDITION  담은 뒤의 UsedSlots ≤ InventoryCapacity   (`no-room`)
            NEW RESULT        Failure(no-room)
            원자성            **넘치면 하나도 담기지 않는다.** 부분 담기가 없다
            변하지 않는 것     통로가 하나라는 것. 종류 이름을 묻지 않는다는 것

        RULE-MINE-001
            NEW PRECONDITION  그 광맥이 내는 것을 담을 자리가 있다     (`no-room`)
            변하지 않는 것     대상 · 거리 · 용도 · 남은 양 · 행동 대체 · 소요 시간
            사유 코드         `no-room` — 소지품 통로가 쓰는 것과 **같은 코드**다.
                            겪는 일이 같으므로 사유도 하나여야 한다

        RULE-MINE-COMPLETE-001
            OLD  ResourceAmount -= 1  →  RULE-INVENTORY-ADD-001(stone, 1)
            NEW  ① 자리를 먼저 검증한다      실패면 **아무것도 일어나지 않는다**
                 ② ResourceAmount -= 1
                 ③ RULE-INVENTORY-ADD-001(Deposit.ResourceKind, 1)
            **얻는 종류를 규칙이 이름으로 알지 않는다** — 광맥이 답한다.
            거절된 획득이 세계의 것을 축내지 않는 것은 ① 이 ② 앞에 있기 때문이다

        BALANCE — Deposit 기본 ResourceAmount  5 → 12  (RATIONALE 4)

    AFFECTED

        RULE-ITEM-USE-COMPLETE-001    소모는 자리를 **열 뿐** 막지 않는다. 판정 없음 — 회귀 확인 대상
        RULE-BODY-USES-001            덜어내면 그 답이 줄어든다. 규칙 자체는 그대로다
        RULE-OBSERVER-BODY-001        처음 주어지는 곡괭이가 자리 하나를 쓴다 (StackLimit 1)
        projectInventory              항목마다 `discard-item` 이 늘고, 스냅샷에 자리 둘이 는다
        RULE-ITEM-USE-001             `stone` 을 다 쓰면 자리가 빈다 — 결과일 뿐 판정 아님

    NOTE — 02-intent.md 의 AFFECTED 한 줄을 바로잡는다

        `INTENT-COMMAND-CATALOG-001` 을 AFFECTED 로 적었으나 **해당하지 않는다.**
        Command 는 세계 **밖에서** 세계에 손대는 것이고(command-catalog.ts), 덜어내기는
        몸이 세계 **안에서** 하는 일이므로 Interaction 이다 — 쓰는 것(use-item)이 그랬듯이.
        의미가 바뀐 것이 아니라 분류가 틀렸다. `COMMAND_CATALOG` 는 열리지 않는다.

## WORLD STATE

    World
        InventoryCapacity     World Authority   세계의 성질 — 굴러가며 달라지지 않는다.
                              값 4 (BALANCE). **판정은 이 수를 조건으로 삼지 않는다**
        AcquirableKinds       파생             ⋃ { d.ResourceKind | d ∈ Deposits, d.ResourceAmount > 0 }
                              저장하지 않는다 — 저장하면 광맥이 마를 때 어긋난다

    ItemDefinition (정의 — State 가 아니다)
        StackLimit            정의 소유         한 자리에 몇까지. 1 이면 하나가 한 자리를 쓴다
        Stackable             파생             StackLimit > 1

    Inventory
        Items                 World Authority   (REUSED — 변경은 단일 통로에서만)
        UsedSlots             파생             Σ over Items: ⌈Count / StackLimit(Kind)⌉

## WORLD RULE

    RULE-INVENTORY-ROOM-001 (ADDED)
        Implements     INTENT-CARRY-ROOM-IS-FINITE-001 ·
                       INTENT-ROOM-COST-COMES-FROM-THE-DEFINITION-001
        Input          Inventory
        Preconditions  없음 — 언제나 답할 수 있다
        Transition     없음 (읽기 판정)
        Result         UsedSlots = Σ_kind ⌈Count(kind) / StackLimit(kind)⌉

        **분기가 하나도 없다.** 겹치는 것과 겹치지 않는 것이 같은 식을 지난다 —
        StackLimit 1 이면 ⌈n/1⌉ = n 이고, 그것이 곧 "하나가 자리 하나를 쓴다" 다.
        규칙에 "겹치는가" 를 묻는 자리가 없으므로 정의가 답을 바꿔도 규칙은 열리지 않는다.

    RULE-WORLD-ACQUIRABLE-KINDS-001 (ADDED)
        Implements     INTENT-NO-SELF-INFLICTED-DEAD-END-001
        Input          World
        Preconditions  없음
        Transition     없음 (읽기 판정)
        Result         { d.ResourceKind | d ∈ Deposits, d.ResourceAmount > 0 }

        세계가 **지금** 다시 내어줄 수 있는 종류다. 마른 광맥은 세지 않는다.
        새 획득 경로(제작 · 전리품 · 주고받기)가 생기면 이 규칙에 항목이 더해지고,
        그것을 읽는 쪽은 열리지 않는다.

    RULE-INVENTORY-ADD-001 (CHANGED)
        Implements     INTENT-INVENTORY-SINGLE-CHANNEL-001 ·
                       INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001
        Input          Actor, ItemKind, Count(> 0)
        Preconditions  1. 그 종류의 정의가 있다                        (unknown-item)
                       2. RoomAfter(Items, kind, +Count) ≤ Capacity   (no-room)   ← ADDED
        Transition     Items[kind] += Count
        Result         Success | Failure(unknown-item | no-room)

        RoomAfter 는 **더해진 뒤의 UsedSlots** 이며 RULE-INVENTORY-ROOM-001 이 센다.
        전부가 들어가지 못하면 **하나도 넣지 않는다** — 검증이 변경보다 먼저이므로
        부분 담기가 일어날 수 있는 순간 자체가 없다 (DC-ITEM-CHANGE-IS-ONE-UNIT).

    RULE-ITEM-DISCARD-001 (ADDED)
        Implements     INTENT-DISCARD-ITEM-001 · INTENT-DISCARD-LEAVES-NOTHING-BEHIND-001 ·
                       INTENT-NO-SELF-INFLICTED-DEAD-END-001
        Input          Actor, ItemKind
        Preconditions  1. 그 종류의 정의가 있다                        (unknown-item)
                       2. Items[kind] > 0                             (not-enough)
                       3. LostUses(Actor, kind) 안의 어떤 용도도
                          AcquirableKinds 로 되돌아오지 않는 것이 없다 (no-way-back)
        Transition     RULE-INVENTORY-REMOVE-001(kind, Items[kind])
        Result         Success | Failure(reason)

        **그 종류를 전부 덜어낸다.** 자리 하나 아래로 내려가면 자리가 비지 않으며,
        수량을 나누어 다루는 것은 배치 조작(01-cycle.md EXCLUDED)이다. 고르는 것은
        수가 아니라 **무엇을** 이며, 그것이 Cycle Goal 의 문장 그대로다.

        **시간을 쓰지 않는다.** 즉시 이뤄진다 — 자리를 비우는 일에 시간을 주면
        "가방이 차서 못 움직이는데 비우려다 끊긴다" 라는 새 막힘이 생긴다.
        덜어내기는 막힘의 출구이므로 그 자신이 막힐 수 있어서는 안 된다.
        그래서 Action 얼개를 지나지 않고, 하던 행동을 끊지도 않는다.

        LostUses(Actor, kind)
            = ruleBodyUses(Items)  \  ruleBodyUses(Items - kind 전부)
          되돌아온다 = ∃ k ∈ AcquirableKinds 이고 use ∈ Definition(k).Uses

        **종류 이름이 이 규칙에 한 번도 나오지 않는다.** 곡괭이를 막는 것이 아니라
        "돌아올 길이 없어지는 것" 을 막는다. 곡괭이를 주는 광맥이 생기면 그날부터
        곡괭이는 저절로 덜어낼 수 있게 되고, 규칙은 한 줄도 열리지 않는다.

    RULE-MINE-001 (CHANGED)
        Implements     INTENT-MINING-001 · INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001
        Preconditions  … (C001 · C017 · C020 그대로)
                       + 그 광맥이 내는 것 1 을 담을 자리가 있다        (no-room)   ← ADDED
        Transition     CurrentAction = mine(Deposit)
        Result         Success | Failure(reason)

        자리 검증은 **RULE-INVENTORY-ADD-001 의 판정을 그대로 쓴다** — 관찰에 실리는
        판정과 실제로 담을 때의 판정이 같은 것이어야 하기 때문이다.

    RULE-MINE-COMPLETE-001 (CHANGED)
        Implements     INTENT-MINING-001 · INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 ·
                       INTENT-ACTION-PROGRESS-001
        Preconditions  1. 대상 Deposit 이 있다                          (unknown-deposit)
                       2. ResourceAmount > 0                           (deposit-depleted)
                       3. 그 광맥이 내는 것 1 을 담을 자리가 있다        (no-room)   ← ADDED
        Transition     ResourceAmount -= 1
                       RULE-INVENTORY-ADD-001(Deposit.ResourceKind, 1)
        Result         Success | Failure(reason)

        **3 이 Transition 앞에 있다.** 그래서 자리가 없어 받지 못한 채집은 광맥을
        축내지 않는다. 행동은 끝나고 아무 일도 일어나지 않는다 — 시작과 완료 사이에
        세계가 움직였을 수 있으므로 완료 시점에도 다시 묻는다 (C020 이 사용에 세운 형태).

## OBSERVABLE SEMANTIC

    자리 — 지닌 것 **전체**에 붙는다 (항목마다가 아니다)

        Inventory.UsedSlots        Before → Rule → After 로 달라지는 것이 보인다
        World.InventoryCapacity    함께 온다. 화면은 둘을 받아 옮길 뿐 세지 않는다

    항목마다 (기존 ItemActionView 형태 그대로 — 새 기계를 만들지 않는다)

        discard-item.available            RULE-ITEM-DISCARD-001 의 Precondition 판정
        discard-item.unavailableReason    unknown-item | not-enough | no-way-back

    채집

        mine.available / unavailableReason 에 `no-room` 이 는다.
        **가방이 차면 캘 수 없다는 것이 부딪히기 전에 보인다** — 관찰이 쓰는 판정과
        실행이 쓰는 판정이 같은 함수이므로, 억지로 요청해도 같은 사유로 거절된다.

    Observable Closure

        판정에 쓰인 모든 값이 관찰된다
            UsedSlots · Capacity            → 스냅샷의 자리 둘
            StackLimit                      → `stackable` 로 관찰된다.
                                              한 자리에 몇까지인지 자체는 싣지 않는다 —
                                              **UsedSlots 가 이미 그 결과이기 때문**이다.
                                              (RATIONALE 3)
            AcquirableKinds                 → 목록으로 싣지 않는다. 그 판정의 결과인
                                              `no-way-back` 사유가 실린다 (RATIONALE 3)
            LostUses                        → 같음
        실패 사유는 전부 코드로 실린다     no-room · no-way-back · not-enough · unknown-item

## BALANCE

    World.InventoryCapacity        4       자리의 수
    stone.StackLimit               3       → Stackable = true
    pickaxe.StackLimit             1       → Stackable = false. **겹치지 않는 종류가
                                           세계에 처음 하나 생긴다** — 두 갈래가 다 살아
                                           있어야 자리 계산이 분기 없는 식임이 관찰된다
    Deposit.ResourceAmount 기본     12      5 → 12 (RATIONALE 4)

    이 값들이 만드는 플레이
        시작        곡괭이 1 → 1 / 4 자리
        캘 수 있음   돌 9 개까지 (3 자리 × 3)  → 4 / 4 자리
        10 번째     `no-room` 으로 캘 수 없다. 화면에 이미 불가로 보인다
        덜어낸다     돌 전부 → 1 / 4 자리. 다시 캘 수 있다
        막힌다      곡괭이는 `no-way-back` — 세계에 곡괭이를 내는 광맥이 없다

    **네 값 어느 것을 바꿔도 규칙 코드는 한 줄도 열리지 않는다.**
    이것이 DC-ITEM-CAPACITY-IS-FINITE 의 세 번째 requires 이며 Stage 8 의 검증 항목이다.

## RATIONALE

    1. UsedSlots 를 저장하지 않는 이유
       저장하면 Items 와 UsedSlots 라는 **두 개의 진실**이 생기고, 둘을 맞추는 책임이
       모든 변경 지점에 흩어진다. 그것이 정확히 변경 단일 통로가 없애려던 것이다.
       세는 비용은 지닌 종류 수에 비례하며, 그 수는 자리 수를 넘지 못한다 — 즉 상수다.

    2. 자리를 몸이 아니라 세계가 지니는 이유
       지금 모든 몸의 자리가 같다. 몸마다 다른 자리를 지니는 것은 가방 확장의 의미이며
       01-cycle.md 가 그것을 EXCLUDED 로 두었다. 몸에 값을 두면 "왜 이 몸은 다른가" 를
       지금 답해야 하고, 답할 근거가 세계에 없다. 몸으로 옮기는 것은 나중에 값이
       달라져야 할 이유가 생겼을 때 한 줄의 이동이다.

    3. AcquirableKinds 와 StackLimit 을 관찰에 싣지 않는 이유
       DC-WORLD-OWNS-THE-SURFACE-LIST 가 요구하는 것은 **화면이 판정하지 않는 것**이지
       세계의 모든 중간값을 보내는 것이 아니다. 화면에 필요한 것은 "덜어낼 수 있는가와
       왜 안 되는가" 이고 그것은 이미 실린다. 목록을 보내면 화면이 그것으로 판정할 수
       있게 되어 오히려 그 제약이 무너진다.

    4. 광맥의 기본 양을 12 로 올리는 이유
       자리의 유한함은 **세계에 캘 것이 자리보다 많을 때만** 겪힌다. 5 로는 가방이 차기
       전에 광맥이 마르므로 이 Cycle 의 Goal 이 실제 플레이에서 성립하지 않는다.
       규칙이 아니라 세계를 띄우는 값이며, 세계를 다르게 띄우면 다른 값이 온다.

    5. 덜어내기가 Action 이 아닌 이유 — RULE-ITEM-DISCARD-001 안에 적었다.

## SEMANTIC CLOSURE

    INTENT-CARRY-ROOM-IS-FINITE-001
        "유한한 수의 자리에 담긴다"     → World.InventoryCapacity · Inventory.UsedSlots
        "남아 있지 않으면 더 받지 못한다" → RULE-INVENTORY-ADD-001 P2
        "세는 것이지 배치하는 것이 아니다" → UsedSlots 는 수 하나다. 자리에 이름이 없다
        "값을 조건으로 삼지 않는다"      → 판정은 `≤ Capacity` 하나. 4 라는 수가 규칙에 없다

    INTENT-ROOM-COST-COMES-FROM-THE-DEFINITION-001
        "정의가 답한다"                → ItemDefinition.StackLimit
        "한도까지 한 자리에"            → ⌈Count / StackLimit⌉
        "겹칠 수 없는 것은 하나가 한 자리" → 같은 식 (StackLimit = 1)
        "정의가 하나 늘어나는 일"        → RULE-INVENTORY-ROOM-001 에 종류 이름이 없다

    INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001
        "전부 담을 자리가 없으면 하나도" → RULE-INVENTORY-ADD-001 검증이 변경보다 먼저
        "세계의 것도 축내지 않는다"      → RULE-MINE-COMPLETE-001 P3 이 Transition 앞
        "부딪히기 전에 알 수 있다"       → mine.unavailableReason = `no-room`
        "같은 사유로 거절된다"           → 관찰과 실행이 같은 판정 함수를 쓴다

    INTENT-DISCARD-ITEM-001
        "골라 덜어낼 수 있다"           → RULE-ITEM-DISCARD-001 (Input: ItemKind)
        "그만큼 사라지고 자리가 빈다"    → Transition = RULE-INVENTORY-REMOVE-001
        "몸 밖의 무엇도 요구하지 않는다" → Precondition 에 대상 · 거리 · 행동 조건이 없다
        "흔적을 남기지 않는다"          → 검증이 변경보다 먼저 (통로가 이미 그 형태다)

    INTENT-DISCARD-LEAVES-NOTHING-BEHIND-001
        "세계에 놓이지 않는다"          → Transition 에 Deposit · Entity 생성이 없다.
                                        줄이는 통로 하나만 지난다
        "도착지가 바뀔 뿐"             → 세계 개체화가 오면 Transition 에 한 줄이 더해진다

    INTENT-NO-SELF-INFLICTED-DEAD-END-001
        "돌아올 길이 없어지면 거절"      → RULE-ITEM-DISCARD-001 P3
        "왜 안 되는지가 함께 온다"       → discard-item.unavailableReason = `no-way-back`
        "판단하는 것은 세계다"          → 화면은 available 을 받을 뿐 종류를 알아보지 않는다
        "길이 생기면 저절로 풀린다"      → RULE-WORLD-ACQUIRABLE-KINDS-001 이 매번 답한다

    INTENT-ROOM-IS-OBSERVED-001
        "쓴 자리와 전체가 함께"         → 스냅샷의 자리 둘 (항목 밖)
        "화면이 세어 알아내지 않는다"    → 세는 규칙이 세계에만 있다

    닫히지 않은 문장 없음. GAP 없음.
