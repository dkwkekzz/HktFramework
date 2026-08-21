# C020 — World Semantic

> 이 Cycle 은 세계에 **하나의 구조를 갈아 끼운다.** 지금 몸이 지닌 것은 종류→개수 Map
> 하나이고 그것을 읽는 곳은 두 군데뿐이다. 그 Map 이 **자리 목록**이 되고, 종류 이름의
> 합집합이 **카탈로그 열쇠**가 되며, 늘리기만 하던 통로가 받기·덜어내기 둘로 갈린다.
> 새 계산도 새 난수도 없다 — 세는 방식과 묻는 문장이 바뀔 뿐이다.

## SEMANTIC DELTA

    REUSED
        Actor.Inventory                                     C001 (형이 바뀐다 — CHANGED 참조)
        Actor.CurrentAction (Kind · Elapsed · Duration)     C002 — 채굴이 그 위에 선다
        DepositState.ResourceKind · ResourceAmount          C001
        INTERACTION_RANGE                                   C001
        World.TargetSelections                              C017 — 채굴 대상을 읽는 관계
        RULE-MINE-001                                       C001 · C017 (Precondition 하나가 는다)
        RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001    C002
        InteractionView.available / reason                  C009 · C010 — 사유 계약 그대로 쓴다
        RequestOutcomeView                                  C009 — 요청의 대답

    ADDED
        ItemCatalog · ItemDefinition                        세계가 물건을 아는 단일 정의소
        ItemUse                                             물건이 선언하는 용도 (지금은 mining 하나)
        Inventory.Capacity                                  담을 자리의 수
        Inventory.Slots                                     자리 목록 — 각 자리는 비었거나 { 종류 · 수량 }
        Actor.CarriedUses (파생 — 저장하지 않는다)            이 몸이 지금 지닌 용도의 모음
        Inventory.LastWayUses (파생 — 저장하지 않는다)        지금 이 몸에서 단 하나의 물건만이
                                                            열고 있는 용도들
        RULE-CARRY-ADD-001                                  받기 — 전량 성공 또는 전량 실패
        RULE-CARRY-LET-GO-001                               덜어내기 — 자리 하나를 비운다
        CARRY_CAPACITY_DEFAULT                              기본 자리 수 (세계를 띄울 때 바꿀 수 있다)

    CHANGED
        Inventory                       `items: Map<종류, 개수>` → `capacity` + `slots[]`.
                                        "몇 개인가" 만 알던 것이 "어디에 얼마나" 를 안다
        ItemKind                        `'stone' | 'pickaxe'` 문자열 합집합 → **카탈로그의 열쇠**.
                                        새 종류가 형을 넓히지 않는다
        Tool.Capability                 `MINING_CAPABLE` 하드코딩 집합 → 각 정의의 `uses` 선언.
                                        `hasMiningCapability(kind)` 가 사라진다
        RULE-MINE-001                   Precondition 에 "받을 자리가 있는가" 가 는다
        RULE-MINE-COMPLETE-001          받기가 RULE-CARRY-ADD-001 을 지난다. 받지 못하면
                                        **광맥도 줄지 않는다**
        RULE-MINE-001 의 도구 판정       "지닌 것 중에 곡괭이가 있는가" →
                                        "이 몸의 CarriedUses 에 mining 이 있는가"

    AFFECTED
        Observer 관찰의 소지품 자리        `inventory.stone` counter · `tool.hasMiningTool` flag 가
                                        사라지고 Carried 목록이 그 자리를 대신한다 (OBSERVABLE 절)
        몸의 초기 소지품                  곡괭이 하나가 자리 하나를 차지하게 된다
        RULE-TARGET-SELECT-001          무변경. 덜어내기는 세계의 존재를 지목하지 않는다
        RULE-ACTION-EXCLUSIVE-001       무변경. 덜어내기는 행동이 아니라 즉시 판정이다
                                        (WORLD RULE 의 주① 참조)

## WORLD STATE

    ItemCatalog                         Authority: World (정적 정의)
        세계에 있을 수 있는 물건 종류의 목록. 항목 하나가 ItemDefinition 이다.
        규칙은 종류 이름으로 갈라지지 않고 이 목록에 묻는다.

    ItemDefinition                      Authority: World (정적 정의)
        id            그 종류를 가리키는 열쇠. 규칙의 분기 조건이 아니다
        category      갈래 — 도구 · 재료. 표시와 정렬을 위한 의미 코드다
        stackable     같은 종류끼리 한 자리에 쌓을 수 있는가
        stackLimit    쌓을 수 있다면 한 자리에 얼마까지인가 (stackable = false 면 1)
        uses          이 종류가 선언하는 용도의 목록. 없을 수 있다 (재료는 비어 있다)
        itemType      Master 의 어느 `IT-*` 에서 왔는가

        **없는 `IT-*` 를 가리키는 정의는 성립하지 않는다** (IS §5.1). 물건은 세계가 낳은
        것이지 편의로 만들어 낸 것이 아니다.

        이 Cycle 이 세우는 목록 (값은 이 Cycle 이 소유한다):

            stone     category 재료 · stackable true  · stackLimit 2 · uses []
                      itemType IT-COMMON-STONE
            pickaxe   category 도구 · stackable false · stackLimit 1 · uses [mining]
                      itemType IT-COMMON-STONE

        곡괭이가 `IT-COMMON-STONE` 을 가리키는 것은 임시가 아니다 — 지금 이 세계의
        곡괭이는 평범한 돌로 만든 도구이고, 성질(`IP-*`)을 지닌 물건은 아직 세계에 없다.
        경계결정 · 불연정 계통이 세계에 서면 그때 그 정의들이 자기 `IT-*` 를 가리킨다.

    ItemUse                             Authority: World (정적 의미 코드)
        물건이 선언할 수 있는 용도. 지금은 `mining` 하나다.
        용도가 하나뿐이라고 해서 열거를 만들지 않는 것이 아니다 — 열거가 있어야
        채굴 규칙이 종류 이름을 묻지 않게 된다.

    Inventory.Capacity                  Authority: World
        그 몸이 지닌 자리의 수. 기본값 `CARRY_CAPACITY_DEFAULT = 3` 이며 세계를 띄울 때
        바꿀 수 있다 (`setup.carryCapacity` — `depositAmount` · `debugAuthority` 와 같은 자리).

        3 인 이유는 **이 세계의 모든 판정이 플레이로 도달하게 하기 위해서**다.
        지금 세계에는 광맥이 하나이고 자원이 다섯이다. 자리가 이보다 넉넉하면
        "자리가 없어 받지 못한다" 가 화면에서 한 번도 일어나지 않는다.
        값이지 규칙이 아니다 — 규칙은 어디서도 3 을 묻지 않는다.

    Inventory.Slots                     Authority: World
        길이가 Capacity 인 자리 목록. 각 자리는 다음 둘 중 하나다.

            빈 자리
            { 종류 · 수량 }        수량은 1 이상이고 그 종류의 stackLimit 이하다

        수량이 0 이 된 자리는 **빈 자리가 된다.** 수량 0 짜리 항목이 남아 있는 상태를
        만들지 않는다 — 그러면 쓴 자리 수를 세는 곳마다 그 예외를 알아야 한다.

        한 물건은 언제나 자리 하나에 있다. 자리가 물건을 담으며, 다른 어디를 가리키지
        않는다 (DC-ITEM-LIVES-IN-ONE-PLACE).

    Actor.CarriedUses                   Authority: World (파생 — 저장하지 않는다)
        지금 이 몸이 지닌 것들의 정의가 선언한 용도를 모두 합친 것.
        Slots 와 ItemCatalog 에서 매번 계산되므로 어긋날 수 없다.

        **이 Cycle 에서 이 값의 출처는 소지다.** 적용(몸에 걸어 두는 것)이라는 개념이
        아직 세계에 없기 때문이다. 장착이 오면 이 파생의 입력이 Slots 에서
        적용된 것들로 바뀌며, **그때 고칠 곳은 이 한 자리다** (02 INTENT-USE-COMES-
        FROM-DECLARATION-001 의 주).

    Inventory.LastWayUses               Authority: World (파생 — 저장하지 않는다)
        `CarriedUses` 중, 그 용도를 여는 물건이 이 몸에 **자리 하나뿐인** 것들.
        덜어내기가 이 값을 보고 막힘을 막는다.

        같은 용도를 여는 물건을 둘 지니면 그 용도는 여기에 없다 — 하나를 덜어내도
        길이 닫히지 않기 때문이다. 판정은 종류가 아니라 **마지막인가**를 본다.

## WORLD RULE

    RULE-CARRY-ADD-001 (ADDED)
        Implements     INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 · INTENT-CARRY-ROOM-001
        Input          Actor, 종류, 수량
        Preconditions  1. 그 종류가 ItemCatalog 에 있다            (unknown-item)
                       2. 수량 >= 1                                (invalid-quantity)
                       3. 요청 수량 전부를 받을 수 있다             (carry-full)
        Transition     쌓을 수 있는 자리부터 채우고, 남으면 빈 자리를 순서대로 쓴다
        Result         Success | Failure(reason)

        **받을 수 있는가는 실제로 담기 전에 판정한다.** 담으면서 모자라는 것을
        발견하는 형태를 만들지 않는다 — 그 순간 이미 반쪽이 되기 때문이다
        (DC-ITEM-CHANGE-IS-ONE-UNIT).

        판정은 이렇게 센다.

            같은 종류의 자리들에 남은 여유의 합
            + 빈 자리 수 × 그 종류의 stackLimit
            >= 요청 수량

        채우는 순서는 **쌓을 수 있는 자리가 먼저**다 (IE §6). 그래야 빈 자리가
        불필요하게 소모되지 않는다.

        모자라면 **아무것도 담지 않는다.** 19 개가 들어가고 11 개가 사라지는 일은
        없다 (IE §6.1). 한 번에 얼마를 건네는가는 부르는 쪽이 정한다 — 채굴은
        하나씩 부르고, 묶음을 건네는 경로가 생기면 그쪽은 통째로 부른다.

    RULE-CARRY-LET-GO-001 (ADDED)
        Implements     INTENT-LET-GO-001 · INTENT-NO-DEAD-END-001
        Input          Actor, 자리 번호
        Preconditions  1. 그 자리가 존재하고 비어 있지 않다          (carried-not-found)
                       2. 그 자리의 종류가 여는 용도 중 어느 것도
                          LastWayUses 에 없다                       (last-way-locked)
        Transition     그 자리를 비운다 — 담겨 있던 수량 전부가 사라진다
        Result         Success | Failure(reason)

        **자리 하나가 요청의 단위다.** 수량을 나눠 덜어내지 않는다 — 나누기는 이
        Cycle 의 것이 아니고(01 EXCLUDED), 자리를 비우는 것이 곧 이 Cycle 이 여는
        의미(자리를 되찾는다)이기 때문이다. 그래서 요청에 수량 파라미터가 없고,
        "전부이거나 전무" 가 구조에서 성립한다.

        덜어낸 것은 **세계 어디에도 놓이지 않는다.** 위치를 가진 물건이라는 개념이
        아직 없기 때문이다 (01 SCOPE NOTE ③). 그 개념이 오면 이 Rule 의 Transition 에
        "세계에 놓는다" 가 더해지고 나머지는 그대로다.

        Precondition 2 가 막힘을 막는다. 지금 이 세계에서 걸리는 것은 곡괭이 하나뿐이며,
        그것은 곡괭이라서가 아니라 **채굴 용도를 여는 마지막 물건이라서**다. 곡괭이를
        둘 지니면 하나는 덜어낼 수 있다.

    RULE-MINE-001 (CHANGED)
        Implements     INTENT-MINING-001 (CHANGED) · INTENT-USE-COMES-FROM-DECLARATION-001
        Input          Actor, 요청한 ObserverId
        Preconditions  1. 고른 것이 있다                            (no-target-selected)
                       2. 고른 것이 광맥이다                        (target-kind-mismatch)
                       3. **CarriedUses 에 mining 이 있다**          (no-mining-tool)
                       4. InteractionRange 이내                     (out-of-range)
                       5. ResourceAmount > 0                        (deposit-depleted)
                       6. **그 자원 하나를 받을 자리가 있다**         (carry-full)
                       7. 현재 행동이 대체 가능하다                  (action-busy)
        Transition     CurrentAction = mine(Deposit)
        Result         Success | Failure(reason)

        3 이 이 Cycle 의 CHANGED 다. 묻는 대상이 물건의 종류에서 **용도**로 바뀐다.
        캘 수 있는 새 도구가 생겨도 이 줄은 바뀌지 않는다
        (DC-ITEM-CAPABILITY-COMES-FROM-GRANTS).

        6 이 ADDED 다. 자리가 없으면 **캐기 시작하지도 않는다** — 1.2 초를 쓰고 나서
        받지 못하는 것보다, 시작 전에 사유와 함께 거절되는 편이 관찰로도 플레이로도
        낫다. 6 은 5 뒤에 온다: 고갈된 광맥에서는 자리가 없다는 사유가 나오지 않는다.

    RULE-MINE-COMPLETE-001 (CHANGED)
        Implements     INTENT-MINING-001 (CHANGED)
        Input          채굴 행동을 마친 Actor
        Preconditions  1. 대상 Deposit 의 ResourceAmount > 0        (deposit-depleted)
                       2. RULE-CARRY-ADD-001(그 자원 하나) 이 성립한다 (carry-full)
        Transition     ResourceAmount -= 1 · RULE-CARRY-ADD-001 실행
        Result         Success | Failure(reason)

        둘은 **함께 일어나거나 함께 일어나지 않는다.** 받지 못하면 광맥도 줄지 않는다 —
        받지 못한 자원이 세계에서 사라지면 "건네지 못한 것은 남는다" 가 깨진다
        (INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 · IE §43).

        RULE-MINE-001 의 6 이 이미 막았는데 여기서 또 검사하는 이유는, 캐는 1.2 초
        사이에 자리가 찰 수 있기 때문이다 (다른 경로로 물건을 받는 일이 생기면).
        시작 판정과 완료 판정은 **같은 함수를 쓴다** — 두 곳이 각자 세면 갈린다.

    주① 덜어내기는 행동이 아니다

        덜어내기는 `CurrentAction` 을 차지하지 않는다. 시간을 요구하지 않고,
        진행 중인 행동을 대체하지도 않는다 — 몸이 세계에 하는 일이 아니라 지닌 것을
        정리하는 일이기 때문이다. 그러므로 `RULE-ACTION-BEGIN-001` 의 관문을 지나지
        않으며, 채굴 중에도 덜어낼 수 있다.

        이것이 필요한 이유가 있다: 자리가 차서 캐지 못하는 상황에서 덜어내기가 행동
        관문에 걸리면 출구가 다시 막힌다.

## OBSERVABLE SEMANTIC

    Carried (ADDED)                     그 몸이 지닌 것 전부
        자리마다 하나씩, 빈 자리는 싣지 않는다. 각 항목은:

            slot            자리 번호 — 덜어내기 요청이 이것을 가리킨다
            kind            그 종류의 열쇠 (문구 변환은 View 책임)
            category        갈래 의미 코드 — 도구 · 재료
            quantity        그 자리에 쌓인 수량
            stackLimit      그 자리가 더 받을 수 있는 한도
            uses            그 물건이 여는 용도들 (의미 코드)
            actions         이 물건에 지금 무엇이 되는가 — 항목마다
                                interactionId   요청에 그대로 실어 보낸다
                                effect          무엇을 하는가 (의미 코드 — `let-go`)
                                available       지금 되는가
                                reason          안 되면 왜인가 (사유 코드)

        `actions` 가 목록인 것은 이 Cycle 에 항목이 하나뿐이어서가 아니다 — 쓰기 ·
        장착이 오면 여기에 항목이 늘 뿐 구조가 바뀌지 않게 하기 위해서다
        (DC-WORLD-OWNS-THE-SURFACE-LIST — "새 항목이 생기면 세계 쪽에 더하는 것으로 끝난다").

        **판정은 여기서 세계가 한다.** 보는 쪽이 정의를 복제해 "이건 덜어낼 수 있나" 를
        스스로 계산하지 않는다. 그리고 이 `available` 은 RULE-CARRY-LET-GO-001 의
        Precondition 과 **같은 함수**를 쓴다 — 표시용 판정과 실행 판정이 갈리면
        화면이 허락한 것이 세계에서 거절된다.

    CarriedRoom (ADDED)                 used / total
        쓴 자리와 전체 자리. 보는 쪽이 세어서 아는 것이 아니라 세계가 답한다.

    Mine.FailureReason (CHANGED)        사유 목록에 `carry-full` 이 는다
        기존 다섯(no-target-selected · target-kind-mismatch · no-mining-tool ·
        out-of-range · deposit-depleted · action-busy)과 나란히 선다. 계약의 형태는
        바뀌지 않는다 — 코드가 하나 느는 것뿐이다.

    제거 (AFFECTED)
        `inventory.stone` counter        돌 전용 칸. Carried 가 대신한다
        `tool.hasMiningTool` flag        도구 유무. Carried 의 `uses` 가 대신한다 —
                                         "곡괭이가 있는가" 가 아니라 "무엇이 어떤 용도를
                                         여는가" 로 실린다

    사유 코드                            이 세계의 표기는 kebab-case 다 (기존 규칙과 같다).
        IE §29 의 표와 대응은 다음과 같다. 표기 변환은 Cycle 소유다 (정책 §7.2).

            carry-full           INVENTORY_FULL
            carried-not-found    ITEM_NOT_FOUND
            last-way-locked      LOCKED_ITEM
            unknown-item         (IE 표에 없다 — 카탈로그에 없는 종류. 세계 내부 오류다)
            invalid-quantity     INVALID_QUANTITY

## SEMANTIC CLOSURE

    "세계가 물건이 무엇인지 안다"            → ItemCatalog · ItemDefinition
    "종류 이름은 열쇠일 뿐이다"              → ItemDefinition.id (규칙이 묻지 않는다)
    "무엇에 쓰는지는 종류의 선언이다"         → ItemDefinition.uses · ItemUse
    "이 몸에 그 용도가 지금 있는가"           → Actor.CarriedUses · RULE-MINE-001 P3
    "어디서 왔는가"                          → ItemDefinition.itemType (`IT-*`)

    "지니는 데 자리가 든다"                  → Inventory.Slots
    "자리의 수가 유한하다"                   → Inventory.Capacity
    "같은 것끼리 한 자리에 쌓인다"            → ItemDefinition.stackable · stackLimit
    "겹칠 수 없는 것은 자리를 혼자 쓴다"      → stackable = false → stackLimit 1
    "한 물건은 자리 하나에 있다"              → Inventory.Slots 의 형 (담는다 · 가리키지 않는다)

    "전부 들어갈 때만 들어간다"               → RULE-CARRY-ADD-001 P3
    "반쯤 받아 두지 않는다"                   → RULE-CARRY-ADD-001 의 사전 판정
    "건네지 못한 것은 세계에 남는다"          → RULE-MINE-COMPLETE-001 P2 (광맥이 줄지 않는다)
    "자리가 없다는 것을 캐기 전에 안다"        → RULE-MINE-001 P6 · Mine.FailureReason

    "지닌 것 전부가 한자리에 보인다"          → Carried
    "종류마다 따로 자리를 만들지 않는다"      → Carried (하나의 목록) · `inventory.stone` 제거
    "지금 무엇이 되고 왜 안 되는가"           → Carried[].actions (available · reason)
    "얼마나 찼는가"                          → CarriedRoom
    "표시용 판정과 실행 판정이 같다"          → 같은 함수를 쓴다 (OBSERVABLE 절)

    "지닌 것을 덜어낼 수 있다"                → RULE-CARRY-LET-GO-001
    "덜어낸 만큼 자리가 빈다"                 → 그 Transition (자리를 비운다)
    "덜어낸 것은 없어진다"                    → 그 Transition (세계에 놓지 않는다)
    "실패한 요청은 흔적을 남기지 않는다"      → Precondition 이 Transition 앞에 있다

    "되돌릴 수 없는 막힘을 만들 수 없다"      → Inventory.LastWayUses ·
                                              RULE-CARRY-LET-GO-001 P2
    "판정은 마지막인가를 본다"                → LastWayUses 의 정의 (자리 하나뿐인 용도)

    남는 문장 없음 — Closure 통과.

## BALANCE — 이 Cycle 이 소유하는 값

    ① CARRY_CAPACITY_DEFAULT = 3

        지금 세계에는 광맥이 하나이고 자원이 다섯이다 (`world/index.ts` ·
        `setup.depositAmount ?? 5`). 자리가 이보다 넉넉하면 "자리가 없다" 가 플레이에서
        한 번도 일어나지 않는다.

    ② stone.stackLimit = 2

        ①과 함께 이 세계의 **모든 판정이 도달하도록** 잡은 값이다. 기본 세계에서
        일어나는 순서:

            시작            곡괭이 1 자리          1/3
            돌 1개          새 자리                2/3
            돌 2개          같은 자리에 쌓인다      2/3
            돌 3개          새 자리 (마지막)        3/3 — 자리가 다 찼다
            돌 4개          쌓을 여유가 있어 받는다  3/3 — **가득해도 받는 경우** (IE §6)
            돌 5개          쌓을 여유도 빈 자리도 없다 → `carry-full` 로 거절
                           광맥은 1 이 남는다 — 세계의 것이 사라지지 않는다
            돌 자리 덜어내기  2/3 로 돌아가고 다시 캘 수 있다
            곡괭이 덜어내기   `last-way-locked` 로 거절된다

        여섯 판정이 전부 기본 세계에서 도달한다. 균형을 위한 값이 아니라
        **관찰 가능성을 위한 값**이며, 세계를 띄울 때 바꿀 수 있다.

    ③ pickaxe.stackable = false

        도구는 겹치지 않는다. 지금 곡괭이가 하나뿐이라 실제로 갈리는 경우는 없지만,
        `stackable` 이 정의의 값이라는 것을 보이는 자리다 — 그리고 둘째 곡괭이가
        생기면 `last-way-locked` 가 저절로 풀린다.

    이 셋 말고 이 Cycle 이 정하는 수치는 없다. 채굴 시간 · 광맥 자원 · 사거리는
    한 글자도 닿지 않는다.
