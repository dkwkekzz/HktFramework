# C020 — World Semantic

> 이 Cycle 이 세계에 더하는 것은 **정의소 하나 · 통로 하나 · 행동 하나**다.
> 정의소는 물건이 무엇인지를 답하고, 통로는 소지품이 변하는 유일한 문이 되며,
> 행동은 그 정의가 밝힌 일을 실행한다. 새 공식은 없다 — 있는 공식의 **입력이 넓어질** 뿐이다.

## SEMANTIC DELTA

    REUSED
        Actor.Inventory · Inventory.Items          종류→수량. 구조 그대로 쓴다
        Actor.CurrentAction · ActionDefinition     행동 얼개 · Duration · replaceable
        World.TargetSelections                     고른 것 (C017)
        World.InteractionRange                     손이 닿는 거리 (2.0)
        World.StrikeEvents · World.UnharmedContacts 타격과 성립하지 않은 접촉 (C007 · C018)
        RULE-ACTION-BEGIN-001                      행동 시작 관문 (`action-busy`)
        RULE-ACTION-PROGRESS-001                   Duration 을 채우면 완료 효과
        RULE-HIT-001                               맞으면 하던 행동이 끊긴다
        RULE-HARM-GATE-001                         해가 성립하는가 (C018)
        RULE-CRITICAL-STRIKE-001 · RULE-GUARD-BLOCK-001 · RULE-DOWNED-001
        Deposit.ResourceAmount                     광맥의 남은 양

    ADDED
        World.ItemCatalog                          아이템 정의의 단일 출처
        ItemDefinition.Category                    분류 (의미 코드)
        ItemDefinition.Origin                      상위 정의 식별자 (`IT-*`)
        ItemDefinition.Stackable                   겹칠 수 있는가
        ItemDefinition.Uses                        이 물건이 몸에 주는 **용도** 목록
        ItemDefinition.Use                         쓰면 무슨 일이 일어나는가 (없으면 못 쓴다)
        ItemUse.Effect                             효과 갈래 — deliver-force | begin-declared-act
        ItemUse.Targeting                          대상 요구 (none | selected + 요구 종류)
        ItemUse.Consumes                           쓰면 몇 개 줄어드는가 (0 이면 줄지 않는다)
        ItemUse.Duration                           쓰는 데 드는 시간 (deliver-force 갈래만)
        Force.BaseDamage · Force.AttackRatio · Force.DamageType   물건이 지닌 위력
        Actor.CurrentAction.kind = `use-item`      쓰는 행동
        Actor.CurrentAction.usedItemKind           그 행동이 쓰고 있는 종류
        Actor.CurrentAction.usedItemTargetId       그 행동이 처음 고른 대상 (있으면)
        Actor.Uses (파생)                          이 몸에 지금 있는 용도들
        RULE-INVENTORY-ADD-001 · RULE-INVENTORY-REMOVE-001
        RULE-BODY-USES-001
        RULE-ITEM-USE-001 · RULE-ITEM-USE-COMPLETE-001
        RULE-ITEM-EFFECT-DELIVER-FORCE-001

    CHANGED
        RULE-MINE-001
            OLD PRECONDITION  Mining Capability Item 보유 (`no-mining-tool`)
            NEW PRECONDITION  Actor.Uses 에 `mine` 이 있다 (`no-mining-tool` — **사유 코드 유지**)
            NEW ENTRY         곡괭이를 쓰는 요청도 이 규칙에 도착한다 (RULE-ITEM-USE-001)
        RULE-MINE-COMPLETE-001
            OLD TRANSITION    Inventory.Items[stone] += 1 (직접 변경)
            NEW TRANSITION    RULE-INVENTORY-ADD-001(stone, 1)
        RULE-DAMAGE-CALCULATE-001
            OLD INPUT         SkillKind → SKILL_DEFINITIONS 조회
            NEW INPUT         **위력 정의**(BaseDamage · AttackRatio · DamageType)를 직접 받는다.
                              스킬은 자기 정의를 넘겨 준다 — **식은 한 글자도 바뀌지 않는다**
        RULE-STRIKE-DAMAGE-001
            같은 이유로 위력 정의와 그 이름표를 받는다. 판정 순서(계산 → 치명 → 막기 → 적용 →
            사건 기록 → 쓰러짐)는 그대로다
        RULE-OBSERVER-JOIN-001
            OLD  몸의 초기 소지품이 종류 이름 고정형으로 주어진다
            NEW  정의된 종류와 수량의 목록으로 주어지고 RULE-INVENTORY-ADD-001 을 지난다
        Item.Kind · Tool.Capability (`world/semantic/item.ts`)
            `MINING_CAPABLE` 집합이 **사라진다.** 채굴 용도는 정의의 Uses 가 소유한다

    AFFECTED
        RULE-SWING-STRIKE-001        같은 피해 길을 쓰므로 입력 형태 변화의 영향을 받는다.
                                     **결과 값은 변하지 않아야 한다** (회귀 항목)
        RULE-NPC-DECIDE-001          자율 존재는 아이템을 쓰지 않는다 — 판단을 주지 않는다
        관찰 투영 (observer-view)     `inventory.stone` · `tool.hasMiningTool` 두 칸이 사라지고
                                     소지품 목록 하나가 그 자리를 대신한다
        View HUD                     위 두 칸을 읽던 자리가 목록을 읽는 자리로 바뀐다

## WORLD STATE

    World.ItemCatalog                              World Definition
        종류마다 하나의 정의. 요청으로 바뀌지 않는다 — 세계가 만들어질 때 정해진다.
        규칙은 이 표에만 묻고, 종류 이름을 조건으로 삼지 않는다.

        ItemDefinition
            Category        material | tool | consumable          (의미 코드)
            Origin          상위 정의 식별자 — 없을 수 있다        (`IT-*`)
            Stackable       참이면 항목 하나에 수량으로 모인다
            Uses            이 물건이 몸에 주는 용도들 — 빈 목록일 수 있다
            Use             쓰면 무슨 일이 일어나는가 — **없으면 그 물건은 쓸 수 없다**

        ItemUse
            Effect          효과 갈래 (아래 둘 중 하나)
            Targeting       Requires = none | selected
                            EntityKind = character | deposit   (Requires = selected 일 때만)
            Consumes        성공한 사용이 줄이는 수량. **0 이면 줄지 않는다**
            Duration        쓰는 데 드는 시간 — Effect 가 deliver-force 일 때만 의미를 가진다
            Range           닿을 수 있는 거리 — 밝히지 않으면 손이 닿는 거리(2.0)다
                            〔Stage 8 반환 → Human 결정으로 ADDED〕
                            **물건마다 닿는 거리가 다른 것은 데이터다.** 규칙은 이 값을 읽을
                            뿐 종류를 묻지 않으며, 새 아이템이 자기 거리를 지녀도 판정은
                            바뀌지 않는다

        Effect — deliver-force
            Force.BaseDamage      물건 자체의 위력
            Force.AttackRatio     쓰는 이의 공격 능력을 얼마나 타는가
            Force.DamageType      위력이 작용하는 방식 (physical | aura)

        Effect — begin-declared-act
            Act                   시작될 행동의 종류

    이 Cycle 의 정의 두 벌 (수치는 Cycle 소유 — Master 로 올리지 않는다)

        stone
            Category   material
            Origin     IT-COMMON-STONE
            Stackable  true
            Uses       (없음)
            Use        Effect     deliver-force { BaseDamage 4 · AttackRatio 0 · physical }
                       Targeting  selected · character
                       Consumes   1
                       Duration   0.5   〔Stage 8 반환으로 0.8 에서 정정 — BALANCE 참조〕
                       Range      5.0   〔Stage 8 반환 → Human 결정 — BALANCE 참조〕

            AttackRatio 가 0 인 이유 — 전해지는 것은 **물건의 위력**이지 쓰는 이의 힘이 아니다
            (INTENT-EFFECT-DELIVER-FORCE-001). 이 값이 0 이면 아이템이 능력치를 타지도
            바꾸지도 않으므로 DC-GROWTH 계열과 "능력치를 바꾸는 물건을 정의하지 않는다" 가
            동시에 지켜진다. BaseDamage 4 는 기본 스킬(6)보다 작다 — 하나는 하찮고
            **양이 곧 크기**다 (`IT-COMMON-STONE`: "기적은 없고 양이 있다").
            Duration 0.5 는 기본 스킬(0.6)보다 짧다 — 던지는 것은 휘두르는 것보다
            빠르고 대신 위력이 하찮다. 이 값은 Stage 8 실측으로 0.8 에서 정정되었다
            (BALANCE 절).

        pickaxe
            Category   tool
            Origin     (없음 — 상위 정의를 이 Cycle 이 만들지 않는다)
            Stackable  true
            Uses       [mine]
            Use        Effect     begin-declared-act { Act = mine }
                       Targeting  none            (대상은 그 행동 자신이 읽는다)
                       Consumes   0               (도구는 닳지 않는다)
                       Duration   (없음 — 채집의 시간이 쓰인다)

    Actor.Inventory.Items                          World Authority
        종류→수량. **RULE-INVENTORY-ADD-001 / REMOVE-001 밖에서는 바뀌지 않는다.**

    Actor.Uses                                     파생 (저장하지 않는다)
        이 몸이 지닌 것들의 정의가 선언한 용도의 합집합. 지닌 것이 바뀌면 함께 바뀐다.

    Actor.CurrentAction                            World Authority
        kind 에 `use-item` 이 더해진다.
        UsedItemKind      그 사용이 쓰고 있는 종류
        UsedItemTargetId  시작할 때 고른 대상 — 행동이 끝날 때까지 지닌다

    ACTION_DEFINITIONS[use-item]                   World Definition
        Duration     정의가 지닌 값 (시작하는 순간에 정해진다)
                     ACTION_DEFINITIONS 의 값은 정의가 밝히지 않았을 때의 기준값이다
        Replaceable  false — 쓰는 중에는 다른 행동으로 갈아타지 않는다

## WORLD RULE

    RULE-INVENTORY-ADD-001 (ADDED)
        Implements     INTENT-INVENTORY-SINGLE-CHANNEL-001
        Input          Actor, ItemKind, Count(> 0)
        Preconditions  1. 그 종류의 정의가 있다                    (unknown-item)
        Transition     Items[kind] += Count
        Result         Success | Failure(unknown-item)

    RULE-INVENTORY-REMOVE-001 (ADDED)
        Implements     INTENT-INVENTORY-SINGLE-CHANNEL-001 · INTENT-ITEM-CONSUME-001
        Input          Actor, ItemKind, Count(> 0)
        Preconditions  1. 그 종류의 정의가 있다                    (unknown-item)
                       2. Items[kind] >= Count                    (not-enough)
        Transition     Items[kind] -= Count. 0 이 되면 항목이 사라진다
        Result         Success | Failure(reason)

        **검증이 변경보다 먼저다.** 모자란 채로 줄이기 시작하는 경로가 없으므로
        수량이 음수가 되는 상태는 이 세계에 존재하지 않는다.

    RULE-BODY-USES-001 (ADDED)
        Implements     INTENT-CAPABILITY-FROM-DECLARED-USE-001
        Input          Actor
        Preconditions  없음 — 언제나 답할 수 있다
        Transition     없음 (읽기 판정)
        Result         Uses = ⋃ { 정의(kind).Uses | Items[kind] > 0 }

        이 규칙이 "이 몸에 그 용도가 지금 있는가" 의 유일한 답이다.
        용도를 묻는 규칙은 종류 이름을 한 번도 읽지 않는다.

    RULE-ITEM-USE-001 (ADDED)
        Implements     INTENT-USE-ITEM-001 · INTENT-USE-TARGET-POLICY-001 ·
                       INTENT-ITEM-EFFECT-IS-DECLARED-001 · INTENT-ACTION-STATE-001
        Input          World, Actor, 요청한 ObserverId, ItemKind
        Preconditions  1. 그 종류의 정의가 있다                    (unknown-item)
                       2. 그 정의가 Use 를 지닌다                  (not-usable)
                       3. Items[kind] >= Use.Consumes             (not-enough)
                       그 다음은 **효과 갈래가 정한다**
        Transition     Effect 가 begin-declared-act 이면
                           그 Act 를 시작하는 규칙에 **그대로 위임한다.**
                           판정도 사유도 그 규칙의 것이다. use-item 행동은 생기지 않는다
                       Effect 가 deliver-force 이면
                           4. 고른 것이 있고 요구 종류와 맞다   (no-target-selected /
                                                                target-kind-mismatch)
                           5. 그 대상이 InteractionRange 이내     (out-of-range)
                           6. 현재 행동이 대체 가능하다           (action-busy)
                           CurrentAction = use-item(kind, 고른 대상)
        Result         Success | Failure(reason)

        **여기서는 아무것도 줄지 않는다.** 수량은 3 에서 확인만 되고, 줄어드는 것은
        완료 시점이다 (INTENT-ITEM-ATOMIC-CHANGE-001). 시작만 하고 끊긴 사용이
        수량을 축내지 않는다.

    RULE-ITEM-USE-COMPLETE-001 (ADDED)
        Implements     INTENT-USE-ITEM-001 · INTENT-ITEM-CONSUME-001 ·
                       INTENT-ITEM-ATOMIC-CHANGE-001 · INTENT-ACTION-PROGRESS-001
        Input          World, use-item 행동이 Duration 을 채운 Actor
        Preconditions  **다시 검증한다** — 시작과 완료 사이에 세계가 움직였을 수 있다
                       1. 정의가 있고 Use 를 지닌다                (unknown-item / not-usable)
                       2. Items[kind] >= Use.Consumes             (not-enough)
                       3. 대상을 요구하면 그 대상이 여전히 세계에 있다   (target-gone)
                       4. 대상을 요구하면 여전히 InteractionRange 이내  (out-of-range)
        Transition     ① 효과를 적용한다 (갈래의 규칙)
                       ② RULE-INVENTORY-REMOVE-001(kind, Use.Consumes)
                       **①과 ②는 하나의 성공 단위다.** ①이 성립하지 않으면 ②도 일어나지 않는다
        Result         Success | Failure(reason)

        실패해도 행동은 끝난다 — 효과도 소모도 일어나지 않을 뿐이다 (채집의 완료와 같다).
        Consumes 가 0 인 갈래는 ② 가 아무 일도 하지 않는다. 그것도 성공이다.

        **"효과가 성립한다" 의 뜻** — 위력이 전해졌다는 것이지 상대가 상했다는 것이 아니다.
        관계가 해를 허락하지 않아 아무 일도 일어나지 않은 접촉도 **효과는 성립한 것**이며
        돌은 줄어든다. 던진 돌은 던진 것이다 (아래 규칙의 마지막 문단).

    RULE-ITEM-EFFECT-DELIVER-FORCE-001 (ADDED)
        Implements     INTENT-EFFECT-DELIVER-FORCE-001
        Input          World, 쓰는 Actor, 대상 Actor, Force
        Preconditions  1. 대상이 쓰러지지 않았다                   (target-downed)
        Transition     Gate = RULE-HARM-GATE-001(쓰는 이, 대상)
                       Gate 가 거절이면
                           World.UnharmedContacts += { 쓰는 이, 대상, 이름표, 자리, 시각, 사유 }
                       Gate 가 허락이면
                           RULE-STRIKE-DAMAGE-001(쓰는 이, 대상, Force, 이름표)
        Result         Delivered

        **새 판정이 하나도 없다.** 관문도, 계산도, 치명도, 막기도, 사건 기록도 전부
        이미 있는 것이다. 이 규칙이 하는 일은 정의가 지닌 위력을 그 길에 넣는 것뿐이다.

        이름표는 쓰인 종류다 — 타격 사건과 접촉 사건의 "무엇으로" 자리에 실린다.
        관찰하는 쪽은 스킬로 맞았는지 물건으로 맞았는지를 그 자리에서 안다.

        거절된 접촉에서도 **돌은 줄어든다.** 이것이 반쪽 성공이 아닌 이유 — 효과는
        "위력을 전한다" 이고 그것은 일어났다. 무슨 일이 벌어졌는지는 관계가 정하며,
        그 사유가 관찰된다 (C018 의 자리 그대로).

    RULE-ITEM-EFFECT-BEGIN-DECLARED-ACT (ADDED — 규칙이 아니라 위임이다)
        Implements     INTENT-EFFECT-BEGIN-DECLARED-ACT-001
        Input          World, Actor, ObserverId, Act
        Transition     Act 를 시작하는 규칙을 그대로 부른다
        Result         그 규칙의 Result 를 그대로 돌려준다

        번호를 붙였으나 새 판정은 없다. 이 갈래가 세계에 더하는 것은
        **"물건을 쓰는 것으로도 그 행동을 시작할 수 있다"** 는 사실 하나다.
        곡괭이 → 채집이 지금 유일한 경우이며, 판정과 사유는 RULE-MINE-001 의 것이다.

    RULE-MINE-001 (CHANGED)
        Implements     INTENT-MINING-001 · INTENT-CAPABILITY-FROM-DECLARED-USE-001 (ADDED)
        Preconditions  1. 고른 것이 있다                          (no-target-selected)
                       2. 고른 것이 광맥이다                       (target-kind-mismatch)
                       3. **Actor.Uses 에 mine 이 있다**           (no-mining-tool)   ← CHANGED
                       4. InteractionRange 이내                   (out-of-range)
                       5. ResourceAmount > 0                      (deposit-depleted)
                       6. 현재 행동이 대체 가능하다                 (action-busy)
        Transition     CurrentAction = mine(고른 광맥)
        Result         Success | Failure(reason)

        사유 코드 `no-mining-tool` 을 **그대로 둔다** — 사람이 겪는 일이 달라지지 않았고,
        문구를 바꾸면 회귀 판정이 흐려진다. 달라진 것은 그 답이 나오는 자리뿐이다.

    RULE-MINE-COMPLETE-001 (CHANGED)
        Transition     ResourceAmount -= 1
                       **RULE-INVENTORY-ADD-001(stone, 1)**                 ← CHANGED
        Result         Success | Failure(deposit-depleted)

    RULE-DAMAGE-CALCULATE-001 (CHANGED — 입력만)
        Implements     INTENT-DAMAGE-CALCULATE-001 (의미 무변경)
        Input          공격자, 대상, **Force**(BaseDamage · AttackRatio · DamageType)
        Transition     없음 (계산)
        Result         Breakdown

        스킬은 자기 정의가 지닌 Force 를 넘겨 주고, 물건은 자기 정의가 지닌 Force 를
        넘겨 준다. 방식 대응 · 관통 · 감쇄 · 하한 1 은 한 글자도 바뀌지 않는다
        (DC-COMBAT-ONE-FORMULA). **같은 입력이면 이 Cycle 전후로 같은 값이 나온다.**

    RULE-STRIKE-DAMAGE-001 (CHANGED — 입력만)
        Input          World, 공격자, 대상, **Force**, 이름표
        나머지         무변경 — 계산 → 치명 → 막기 → 적용 → 사건 기록 → 쓰러짐

    RULE-OBSERVER-JOIN-001 (CHANGED — 몸의 내용만)
        Transition     초기 소지품이 { 종류 → 수량 } 목록으로 주어지고
                       RULE-INVENTORY-ADD-001 을 지나 몸에 실린다
        변하지 않는 것  참여의 인과 · 몸의 종류 · 자리 · 이름 짓는 방식

## OBSERVABLE SEMANTIC

    Inventory (ADDED — 목록 하나)
        항목마다
            Kind        종류 식별자 (의미 코드 — 문구 변환은 View 책임)
            Count       수량
            Category    분류 (의미 코드)
            Origin      상위 정의 식별자 — 없을 수 있다
            Stackable   겹치는가
            Actions     이 항목으로 지금 할 수 있는 것들
                Id          요청에 실어 보낼 식별자
                Role        의미 역할 (use-item)
                Available   지금 되는가
                Reason      안 되면 왜인가 — 사유 코드

        지니지 않은 종류는 항목이 없다. Use 를 지니지 않은 종류는 Actions 가 비어 있다.
        **어떤 종류도 자기만의 칸을 갖지 않는다.**

    Inventory.Actions.Available / Reason (ADDED)
        RULE-ITEM-USE-001 의 판정을 그대로 쓴다 — 관찰과 실행이 **같은 판정**이다.
        begin-declared-act 갈래는 위임 대상 규칙의 판정과 사유가 그대로 실린다.
        그러므로 화면에 불가로 보이는 것을 억지로 요청해도 같은 사유로 거절된다.

        사유 코드   unknown-item · not-usable · not-enough · no-target-selected ·
                   target-kind-mismatch · out-of-range · action-busy
                   (위임 갈래는 그 행동의 사유 — 채집이면 deposit-depleted 등)

    Actor.CurrentAction = use-item (ADDED)
        진행도와 함께 이미 실리는 자리를 그대로 쓴다 (`player.action`, entity state).
        쓰는 중인지 아닌지가 남에게도 보인다 — 다른 행동과 같다.

    Strike / UnharmedContact 의 이름표 (CHANGED)
        "무엇으로" 자리에 스킬 이름 대신 **쓰인 것의 이름**이 실릴 수 있다.
        형태는 그대로다 (문자열 의미 코드) — 항목이 늘어난 것이다.

    사라지는 것
        `inventory.stone`        돌 전용 칸
        `tool.hasMiningTool`     도구 보유 여부 칸
        둘 다 소지품 목록이 더 정확하게 답한다 — 어떤 종류든 수량이 보이고,
        캘 수 있는지는 채집의 가용/사유가 이미 답하고 있었다.

## SEMANTIC CLOSURE

    "물건이 무엇인지 세계가 안다"           → World.ItemCatalog
    "규칙은 이름을 묻지 않는다"              → 모든 판정이 ItemDefinition 조회를 지난다
    "무엇에 쓰는가"                        → ItemDefinition.Uses · RULE-BODY-USES-001
    "쓰면 무엇이 일어나는가"                 → ItemDefinition.Use.Effect
    "겹칠 수 있는가"                       → ItemDefinition.Stackable
    "어디서 왔는가"                        → ItemDefinition.Origin
    "가진 것 전부가 한 목록"                 → Observable Inventory
    "항목마다 지금 무엇이 되는가"             → Inventory.Actions.Available
    "왜 안 되는가"                         → Inventory.Actions.Reason (사유 코드 목록)
    "모든 변화가 한 통로"                   → RULE-INVENTORY-ADD-001 / REMOVE-001
    "쓰는 것은 행동이다"                    → CurrentAction.kind = use-item ·
                                            ACTION_DEFINITIONS[use-item]
    "시간을 쓰고 끊기면 아무 일도 없다"        → Duration + RULE-ACTION-PROGRESS-001 ·
                                            효과가 완료 시점에만 일어난다
    "기력을 쓰지 않는다"                    → RULE-ITEM-USE-001 에 기력 관문이 없다
    "대상 요구는 정의가 밝힌다"              → ItemUse.Targeting
    "고른 것을 대상으로 삼는다"              → World.TargetSelections 조회 (C017)
    "시작한 사용은 처음 고른 것을 지닌다"      → CurrentAction.UsedItemTargetId
    "효과는 정의가 정하고 규칙은 실행한다"      → RULE-ITEM-USE-001 의 갈래 위임
    "효과는 갈래의 목록이다"                 → Effect = deliver-force | begin-declared-act
    "대상에게 위력을 전한다"                 → RULE-ITEM-EFFECT-DELIVER-FORCE-001
    "위력은 물건의 것이다"                   → Force.AttackRatio = 0
    "피해의 길은 바뀌지 않는다"              → RULE-DAMAGE-CALCULATE-001 식 무변경
    "관계가 해를 허락해야 한다"              → RULE-HARM-GATE-001 재사용
    "닿는 거리를 넘지 않는다"                → InteractionRange 재사용
    "선언된 행동을 시작한다"                 → RULE-ITEM-EFFECT-BEGIN-DECLARED-ACT 위임
    "시작될 수 있는지는 그 행동이 답한다"      → 위임 대상 규칙의 Preconditions 그대로
    "쓰면 줄어든다"                        → RULE-ITEM-USE-COMPLETE-001 ②
    "줄어드는가도 정의가 정한다"             → ItemUse.Consumes (돌 1 · 곡괭이 0)
    "없으면 쓸 수 없다"                     → RULE-ITEM-USE-001 P3 · COMPLETE P2
    "음수가 되지 않는다"                    → RULE-INVENTORY-REMOVE-001 검증 선행
    "하나의 성공 단위"                      → RULE-ITEM-USE-COMPLETE-001 ①②
    "실패는 흔적을 남기지 않는다"             → 시작에서 줄지 않고, 완료의 재검증이 먼저다
    "할 수 있는 일이 지닌 것에서 나온다"       → RULE-BODY-USES-001 · RULE-MINE-001 P3
    "캐는 일은 그대로다"                    → RULE-MINE-001 의 나머지 조건·사유 코드 무변경

    닫히지 않은 문장 없음.

## BALANCE — 이 Cycle 이 정한 수치와 그 이유

    돌의 위력 4          기본 스킬 6 보다 작다. 한 번은 하찮고 양이 크기를 만든다.
                        방어가 걸리면 대부분 하한 1 로 내려간다 — 그것이 맞다.
                        `IT-COMMON-STONE` 은 기적을 부리지 않는 물건이다
    AttackRatio 0        전해지는 것은 물건의 위력이지 쓰는 이의 힘이 아니다.
                        아이템이 능력치를 타지도 바꾸지도 않는다
    쓰는 시간 0.5        기본 스킬(0.6)보다 짧다 — 던지는 것은 휘두르는 것보다 빠르고
                        대신 위력이 하찮다. 던지는 동안은 무방비이며, 그래서 가까이서
                        던지는 것이 값을 치른다

                        〔Stage 8 반환으로 정정 — 처음 값은 0.8 이었다〕
                        실측: 사냥터를 지키는 존재 옆에서 방해 없이 서 있을 수 있는 창이
                        **0.90초**다 (그 존재의 타격 주기 — 08-verification.md WINDOW 참조).
                        0.8 은 여유가 0.1초라 사람이 맞힐 수 없었고, 던지려 할 때마다
                        맞아 끊겨 Cycle Goal 이 세계에서 성립하지 않았다. 0.5 는 같은
                        창 안에 0.4초의 여유를 남긴다 — 값을 치르되 불가능하지는 않다.
                        **규칙은 한 줄도 바뀌지 않았다. 바뀐 것은 정의가 지닌 수 하나다** —
                        그것이 이 Cycle 이 세운 형태의 값어치다
    소모 1 / 0           돌은 하나 줄고 곡괭이는 줄지 않는다. 이 둘의 차이가
                        "소모 여부도 정의가 정한다" 의 관찰 증거다
    사거리 5.0           〔Stage 8 반환 → Human 결정으로 정정. 처음 값은 "손이 닿는
                        거리(2.0)를 그대로 쓴다" 였다〕

                        2.0 이 틀렸던 이유 — 그 거리는 상대의 휘두름 **안쪽**이라 던질 수
                        있는 자리가 곧 맞는 자리였다. 실측(30초 900프레임): 밀려난 최대
                        거리 **3.22**, 사거리 안 프레임 35(3.9%), 그중 상대가 안 휘두르던
                        것 **4(0.4%)** — 던지기에 필요한 것은 **연속 15프레임**이다.
                        조건이 흩어져 있어 어떤 길이도 들어가지 않았고, 60초 11회 시도
                        성립 0회였다 (08-verification.md PLAYABLE).

                        5.0 재측정: 사거리 안 프레임 194(21.6%), 그중 안 휘두르던 것
                        **89(9.9%)**. 60초 16회 시도 **9회 성립**, 상대 생명 120 → 93.

                        5.0 이 여는 것은 "멀리서 안전하게" 가 아니다 — 자율 존재의 인지
                        범위(12) 안쪽이므로 던지면 온다. 값을 치르는 방식이 "맞으면서
                        던진다" 에서 **"다가오는 시간을 쓴다"** 로 바뀐 것이다.

                        **사거리는 정의가 지닌다** — 물건마다 다른 값이며 규칙은 읽기만 한다.

## REGRESSION 이 지켜야 하는 것

    캐기            대상 · 거리 · 남은 양 · 시간 · 얻는 양 · 실패 사유가 모두 그대로다
    휘두름의 피해     같은 상황에서 이 Cycle 전과 **정확히 같은 값**이 나온다
                    (RULE-DAMAGE-CALCULATE-001 의 입력 형태만 바뀌었다)
    막기 · 관통 · 치명  한 글자도 바뀌지 않았다
    태도 관문        스킬로 닿았을 때의 판정과 사유가 그대로다
    참여            새 몸이 곡괭이 하나를 지니고 시작하는 것이 그대로다
