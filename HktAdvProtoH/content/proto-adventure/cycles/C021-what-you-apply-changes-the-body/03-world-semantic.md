# C021 — World Semantic

> 이 세계에는 이미 **정의**가 있고(C020), **행동 얼개**가 있고(C002 · C019), **하나의 피해
> 공식**이 있다(C010~C015). 이번에 더해지는 것은 그 사이에 놓이는 **자리 하나**와,
> 능력치를 읽는 모든 판정이 지나갈 **문 하나**다. 새 공식도 새 능력치도 만들지 않는다 —
> 기존의 값이 어디서 오는가를 한 곳으로 모으고, 그 한 곳이 자리를 본다.

## SEMANTIC DELTA

    REUSED
        Actor.Inventory · Inventory.Items                        (C001 · C020)
        World.ItemCatalog · ItemDefinition                       (C020)
        Actor.CurrentAction · ActionDefinition                   (C002 · C019)
        RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001         (C002)
        RULE-INVENTORY-ADD-001 · RULE-INVENTORY-REMOVE-001       (C020)
        RULE-DAMAGE-CALCULATE-001                                (C010 · C012 · C013)
        RULE-CRITICAL-STRIKE-001 · RULE-GUARD-BLOCK-001          (C015 · C011)
        RULE-HIT-REACTION-001                                    (C007)
        Actor 의 능력치 State 전부                                (C007 · C010 ~ C016)

    ADDED
        World.EquipPlaces                        자리 목록 — 세계가 아는 자리들
        ItemDefinition.Equip                     정의의 장착 선언 (자리 · 기여)
        Actor.Equipment                          자리별로 지금 적용된 종류
        Actor.EffectiveAttribute(name)           파생 — 기본값 + 적용된 것들의 기여
        RULE-EQUIP-001 · RULE-EQUIP-COMPLETE-001
        RULE-EFFECTIVE-ATTRIBUTE-001
        Equip.Availability + FailureReason       자리와 소지품 항목의 가능/사유

    CHANGED
        RULE-BODY-USES-001
            OLD  Uses = ⋃ { 정의(kind).Uses | Items[kind] > 0 }
            NEW  Uses = ⋃ { 정의(kind).Uses | kind ∈ Equipment 의 값들 }
            묻는 말은 그대로다 — 답을 모으는 곳만 바뀐다
            (INTENT-CAPABILITY-FROM-APPLIED-USE-001)

        능력치를 읽는 모든 자리
            OLD  Actor 의 State 를 직접 읽는다
            NEW  RULE-EFFECTIVE-ATTRIBUTE-001 을 지나 읽는다
            값을 새로 만들지 않는다. 아무것도 적용되지 않은 몸에서는 유효값이 기본값과
            **같은 값**이므로 기존의 모든 판정 결과가 그대로여야 한다
            (INTENT-EFFECTIVE-ATTRIBUTE-001)

    AFFECTED
        RULE-MINE-001               3번 Precondition(채집 용도)의 답이 달라진다.
                                    사유 코드 `no-mining-tool` 은 그대로 둔다 —
                                    사람이 겪는 일("캘 수 없다")이 달라지지 않았고,
                                    C020 이 같은 자리에서 같은 판단을 했다
        RULE-ITEM-USE-001           곡괭이의 사용 가능 판정이 위임한 채집 판정을 통해
                                    용도 관문을 만난다. 이 규칙 자체는 열리지 않는다
        RULE-DAMAGE-CALCULATE-001   읽는 값이 유효값이 된다. **식은 열지 않는다**
        RULE-CRITICAL-STRIKE-001    같음 — 치명 두 값도 유효값으로 읽힌다
        RULE-ATTRIBUTE-SET-001      기본값을 세우는 길로 남는다. 유효값을 세우지 않는다
        Observer 투영               자리와 항목별 장착 가능/사유가 더해지고,
                                    능력치 값들이 유효값으로 실린다

## WORLD STATE

    World.EquipPlaces                                     World Authority (세계 상수)
        자리의 목록. 자리마다 식별자와 **그 자리가 받는 것**을 지닌다.
        이 Cycle 이 세우는 자리는 하나 — `hand`.
        자리가 늘어나는 일은 이 목록에 항목이 하나 늘어나는 일이며, 어떤 규칙도 열리지 않는다
        (INTENT-BODY-HAS-PLACES-001).

    ItemDefinition.Equip                                  World Authority (정의)
        정의가 밝히는 장착 선언. **없으면 그 물건은 어느 자리에도 들어가지 않는다.**
            Place           어느 자리에 들어가는가
            Contributions   어떤 능력치에 얼마를 더하는가 — 이름과 값의 목록.
                            빈 목록일 수 있다 (자리를 차지하되 값을 주지 않는 물건)
        용도(`Uses`)는 이미 정의가 지니고 있다 (C020). 이 Cycle 은 그것을 옮기지 않는다 —
        용도는 정의의 것이고, 그것이 **몸에 닿는 조건**만 바뀐다
        (INTENT-PLACE-FIT-001 · INTENT-CAPABILITY-FROM-APPLIED-USE-001).

    Actor.Equipment                                       World Authority
        자리 → 지금 그 자리에 적용된 종류. 자리가 비어 있으면 항목이 없다.
        **수량을 지니지 않는다** — 자리에는 하나만 놓인다. 그 하나는 여전히 소지품에
        수량으로 세어져 있다 (INTENT-APPLIED-IS-STILL-CARRIED-001).
        RULE-EQUIP-COMPLETE-001 만이 이 값을 바꾼다.

    Actor.EffectiveAttribute(name)                        파생 — 저장하지 않는다
        기본값 + 지금 적용된 것들의 기여 합. 저장하지 않는 이유가 이 Cycle 의 핵심이다 —
        저장하면 그 값이 언젠가 기본값과 어긋나고, 어긋나는 순간 "정확히 원복" 이 무너진다
        (INTENT-RELEASE-RESTORES-EXACTLY-001).

    Actor.Uses                                            파생 — 저장하지 않는다 (C020 REUSED)
        출처가 소지품에서 Equipment 로 바뀐다.

## WORLD RULE

    RULE-EFFECTIVE-ATTRIBUTE-001
        Implements     INTENT-EFFECTIVE-ATTRIBUTE-001 · INTENT-RELEASE-RESTORES-EXACTLY-001
        Input          Actor, 능력치 이름
        Preconditions  없음 — 언제나 답할 수 있다
        Transition     없음 (읽기 판정)
        Result         기본값 + Σ { 정의(kind).Equip.Contributions[이름] | kind ∈ Equipment }

        **세계에서 능력치를 읽는 유일한 문이다.** 판정이 이 문을 지나지 않고 몸의 값을
        직접 읽으면 그 판정만 장착을 모르게 되고, 그런 자리가 하나라도 있으면
        "적용된 것이 몸을 정한다" 가 세계의 사실이 아니라 일부의 사실이 된다.

        기여가 없는 능력치는 기본값이 그대로 나온다 — 더할 것이 없는 합은 원래 값이다.
        그래서 아무것도 적용하지 않은 몸에서는 이 규칙이 있으나 마나 하고, 그것이
        회귀가 성립하는 이유다.

    RULE-EQUIP-001
        Implements     INTENT-APPLY-ACT-001 · INTENT-PLACE-FIT-001 ·
                       INTENT-APPLY-EXCHANGE-001 · INTENT-ACTION-STATE-001
        Input          World, Actor, 자리, 놓을 종류 (**없을 수 있다 — 해제다**)
        Preconditions  1. 그 자리가 세계에 있다                    (unknown-place)
                       ── 놓을 종류가 있으면 ────────────────────
                       2. 그 종류의 정의가 있다                    (unknown-item)
                       3. 그 정의가 Equip 을 지닌다                (not-equippable)
                       4. 정의가 밝힌 자리가 요청한 자리와 같다     (place-mismatch)
                       5. Items[kind] > 0 — 지니고 있다            (not-carried)
                       6. 그 자리에 이미 그것이 놓여 있지 않다      (already-equipped)
                       ── 놓을 종류가 없으면 (해제) ──────────────
                       2'. 그 자리가 비어 있지 않다                (place-empty)
                       ── 공통 ─────────────────────────────────
                       7. 현재 행동이 대체 가능하다                (action-busy)
        Transition     CurrentAction = equip(자리, 놓을 종류 또는 없음)
        Result         Success | Failure(reason)

        **여기서는 자리가 바뀌지 않는다.** 확인만 하고, 바뀌는 것은 완료 시점이다 —
        시작만 하고 끊긴 적용은 아무것도 바꾸지 않는다 (DC-ITEM-CHANGE-IS-ONE-UNIT).

        적용 · 해제 · 교체가 **하나의 규칙**인 이유: 셋은 "그 자리를 이 상태로 만든다" 는
        같은 일이다. 교체를 따로 두면 해제와 적용 사이에 자리가 비는 순간이 생기고,
        그 순간이 관찰되거나 그 순간에 실패할 수 있게 된다 (INTENT-APPLY-EXCHANGE-001).

    RULE-EQUIP-COMPLETE-001
        Implements     INTENT-APPLY-ACT-001 · INTENT-APPLY-CHANGE-IS-ONE-UNIT-001 ·
                       INTENT-APPLIED-IS-STILL-CARRIED-001 · INTENT-ACTION-PROGRESS-001
        Input          World, equip 행동이 Duration 을 채운 Actor
        Preconditions  **다시 검증한다** — 시작과 완료 사이에 세계가 움직였을 수 있다
                       (그 사이에 그 물건을 다 써 버렸을 수 있다)
        Transition     자리를 요청된 상태로 만든다 — 놓을 것이 있으면 그것 하나가,
                       없으면 아무것도 놓이지 않는다.
                       **소지품은 한 톨도 바뀌지 않는다.**
        Result         Success | Failure(reason)

        옛것은 자리에서 나올 뿐 사라지지 않는다 — 처음부터 소지품에 있었고 계속 있다.
        그래서 교체에는 "옛것을 어디에 넣을까" 라는 물음이 없다 (소지 한도가 없는
        지금은 물론이고, 한도가 생겨도 자리에 놓인 것이 소지품 밖으로 나간 적이 없으므로
        그 물음은 생기지 않는다).

    RULE-BODY-USES-001 (CHANGED)
        Implements     INTENT-CAPABILITY-FROM-APPLIED-USE-001 · INTENT-HOLDING-CHANGES-NOTHING-001
        Input          Actor
        Preconditions  없음
        Transition     없음 (읽기 판정)
        Result         Uses = ⋃ { 정의(kind).Uses | kind ∈ Equipment 의 값들 }

        한 줄이 바뀐다 — 훑는 것이 `Inventory.Items` 에서 `Equipment` 로.
        이 한 줄이 DC-ITEM-HOLDING-IS-NOT-APPLYING 이다.

## OBSERVABLE SEMANTIC

    Actor.Equipment (자기 몸)
        자리마다 — 자리 식별자 · 지금 놓인 종류(없으면 비어 있음) · 그 물건이 지금 주는
        기여 목록 · 해제 가능 여부와 사유.
        **빈 자리도 관찰된다** — 자리가 있다는 사실 자체가 세계의 상태다
        (INTENT-PLACE-OBSERVE-001).
        기여 목록을 세계가 싣는 이유: 화면이 "이 값이 어디서 왔는가" 를 계산하지 않게
        하기 위해서다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    Inventory 항목의 장착 행동 (C020 의 항목 자리에 더한다)
        항목마다 — 지금 찰 수 있는가 · 못 차면 왜인가 · **지금 차고 있는가**.
        C020 이 세운 사용 행동은 그대로 남는다. 한 항목이 두 물음에 답한다
        (INTENT-EQUIP-AVAILABILITY-001).

    Equip.Availability / Equip.FailureReason
        Observable 과 Rule 이 **같은 판정을 공유한다.** 화면에서 불가로 보이는 것을
        억지로 요청해도 같은 사유로 거절된다 (INTENT-APPLY-CHANGE-IS-ONE-UNIT-001).
        사유 코드 — unknown-place · unknown-item · not-equippable · place-mismatch ·
        not-carried · already-equipped · place-empty · action-busy

    능력치 관찰 (기존 자리 그대로 · 값의 출처만 바뀐다)
        자기 몸과 남의 몸에 실리던 능력치 값들이 **유효값**으로 실린다. 자리도 이름도
        그대로다 — C016 의 가려짐 관문도 그대로 걸린다.
        원복은 이 값으로 관찰된다 — 차기 전 값과 푼 뒤 값이 **같은 수**여야 한다
        (INTENT-RELEASE-RESTORES-EXACTLY-001).

    Actor.CurrentAction
        `equip` 이 행동 종류로 관찰된다. 진행도도 다른 행동과 같은 자리에 실린다.

## SEMANTIC CLOSURE

    "지니고만 있어서는 아무것도 달라지지 않는다"
        → RULE-BODY-USES-001 (CHANGED) 이 Equipment 만 훑는다
        → RULE-EFFECTIVE-ATTRIBUTE-001 이 Equipment 의 기여만 더한다
          (소지품을 훑는 판정이 세계에 하나도 남지 않는다)

    "몸에는 자리가 있다"                     → World.EquipPlaces · Actor.Equipment
    "자리는 목록이다"                        → World.EquipPlaces 가 목록이다
    "무엇이 어느 자리에 들어가는지는 정의가 밝힌다"
                                            → ItemDefinition.Equip.Place
                                            → RULE-EQUIP-001 Precondition 3·4
    "밝히지 않은 것은 어느 자리에도 안 들어간다"
                                            → Precondition 3 실패 + `not-equippable` (돌)
    "적용과 해제는 행동이다"                  → RULE-EQUIP-001 Transition (CurrentAction)
                                            → ACTION_DEFINITIONS 의 `equip` (시간 · 대체 불가)
    "끊기면 아무 일도 없다"                   → RULE-EQUIP-COMPLETE-001 만이 자리를 바꾼다
                                            → RULE-HIT-REACTION-001 (REUSED) 이 끊는다
    "교체는 한 단위다"                       → RULE-EQUIP-001 이 셋을 하나로 지닌다
                                            → 완료 시점에 자리가 한 번에 최종 상태가 된다
    "실패는 흔적을 남기지 않는다"             → Precondition 실패는 Transition 에 닿지 않는다
    "자리에 놓아도 여전히 가진 것이다"         → RULE-EQUIP-COMPLETE-001 이 소지품을 건드리지 않는다
    "모든 판정은 유효값을 읽는다"             → RULE-EFFECTIVE-ATTRIBUTE-001 (단일 문)
    "기본값은 손대지 않는다"                  → 유효값은 파생이며 저장하지 않는다
    "풀면 정확히 같은 값이 된다"              → 기여가 사라지면 합이 기본값이다 (계산이 아니라 사실)
    "용도는 적용된 것에서 온다"               → RULE-BODY-USES-001 (CHANGED)
    "쓰는 것은 적용을 요구하지 않는다"         → RULE-ITEM-USE-001 을 열지 않는다
                                            → 다만 곡괭이의 위임 대상(채집)이 용도를 요구하므로
                                              `no-mining-tool` 이 그대로 사유가 된다
    "자리마다 무엇이 놓였는지 보인다"          → Observable — Actor.Equipment
    "항목마다 찰 수 있는가가 온다"            → Observable — Inventory 항목의 장착 행동

    닫히지 않은 문장 없음.

## BALANCE — 이 Cycle 이 정한 수치와 그 이유

    ① 적용/해제에 드는 시간 = 0.4초

        기본 스킬(0.6)보다 짧고, 던지기(0.5)보다도 짧다. 근거는 C020 이 실측으로 얻은
        교훈이다 — **시간이 드는 행동의 대가는 상대의 개입 주기보다 짧아야 대가이지,
        길면 불가능이 된다** (C020 08 의 Constraint Candidate CC-A-COST-MUST-LEAVE-A-WINDOW).

        0.4초는 붙어 있는 상대 앞에서는 위험하고(맞으면 끊긴다), 떨어져 있으면 충분한
        길이다. 이 값이 만드는 물음은 "언제 바꿀 것인가" 이며, 그것이 자리가 생겨서
        얻는 첫 선택이다.

        스킬이 아니므로 ActionSpeed 를 걸지 않는다 — 살펴봄(C014) · 아이템 사용(C020)과
        같은 판단이다. 빠른 종류가 장비까지 빠르게 바꾸면 이 층의 의미에 세기가 섞인다.

    ② 곡괭이의 기여 = PhysicalAttack +12

        기여가 관찰되려면 **한 방의 크기가 눈에 띄게 달라져야** 한다. 지금 세계의 값으로
        재 본 것이 근거다 (기본 능력 40 · 기본 스킬 BaseDamage 6 · AttackRatio 0.5 ·
        상대 Armor 30).

            차기 전   raw = 6 + 40×0.5 = 26   →  26 × (100/130) = 20
            찬 뒤     raw = 6 + 52×0.5 = 32   →  32 × (100/130) = 25

        20 → 25 는 사람이 세어 알아볼 수 있는 차이다. 그리고 이 차이는 **한 층 위로
        올라가지 않는다** — 큰 기술 한 방(55 → 65)의 몫을 넘지 않고, 상대를 쓰러뜨리는
        데 필요한 횟수를 한 자릿수 안에서 줄일 뿐이다.

        왜 곡괭이가 세기를 더하는가 — 성질이 아니라 질량과 형태다. 무거운 쇠도구를 들면
        맨손보다 세게 친다. 세계 유래 성질을 주장하지 않으므로
        DC-WORLD-RESOURCE-ADAPTATION-TRACE 를 건드리지 않는다 (01-cycle.md SCOPE NOTE ②·④).

    ③ 자리의 수 = 1 (`hand`)

        수치라기보다 경계다. 뒤에 올 장착·인벤토리 기획 문서가 자리 구성을 소유하므로
        (01-cycle.md SCOPE NOTE ①), 이 Cycle 은 **하나면 성립하는 것**만 세운다.
        하나로도 자리 · 적합성 · 적용 · 해제 · 교체 · 유효값 · 원복이 전부 관찰된다.

## REGRESSION 이 지켜야 하는 것

    아무것도 적용하지 않은 몸의 모든 판정이 지금과 **같은 값**을 낸다
        피해 · 치명 · 관통 · 막기 · 이동 속도 · 행동 길이 · 통찰 — 하나도 달라지지 않는다.
        달라진다면 그것은 유효값의 문이 기본값을 잘못 통과시키고 있다는 뜻이다.

    채집 (C001)
        **바뀐다** — 곡괭이를 지니기만 해서는 캘 수 없다. 차면 지금까지와 똑같이 캔다.
        시작 시작 조건 · 시간 · 광맥 감소 · 소지품 증가는 하나도 바뀌지 않는다.

    돌 던지기 (C020)
        바뀌지 않는다. 아무 자리도 요구하지 않고, 아이템의 위력은 몸의 능력치를 타지
        않으므로(AttackRatio 0) 유효값 변경의 영향도 받지 않는다.

    소지품 관찰 (C020)
        항목마다의 사용 가능/사유는 그대로다. 곡괭이의 사용 가능만 답이 달라진다
        (차지 않았으면 `no-mining-tool`).

    디버그 능력치 설정 (C009)
        기본값을 세운다. 세운 뒤 차면 그 위에 얹히고, 풀면 세운 값으로 돌아온다.
