# C020 — Intent

> 지금 이 세계에서 소지품은 **늘기만 하는 숫자**다. 캐면 돌이 하나 늘고, 그 숫자를 읽는 곳은
> "곡괭이가 있는가" 하나뿐이며, 줄어드는 길은 어디에도 없다. 물건이 무엇인지도 세계가 알지
> 못한다 — 종류 이름이 곧 규칙이고, 이름마다 코드가 하나씩 붙어 있다. 이번에 더해지는 것은
> 새 계산도 새 자원도 아니라 **세 문장**이다. 세계가 물건을 안다. 가진 것을 쓴다.
> 쓴 만큼 사라진다. 그 셋이 서면 소지품은 처음으로 **치를 수 있는 것**이 된다.

## GOAL / POSSIBILITY

    GOAL-THE-WORLD-KNOWS-WHAT-A-THING-IS    물건이 무엇인지를 세계가 안다 —
                                            이름이 아니라 정의가 답한다
        └── POSSIBILITY-THE-DEFINITION-ANSWERS-NOT-THE-NAME
                                            규칙은 종류 이름을 묻지 않는다. 이름은 정의를
                                            찾는 열쇠일 뿐이며, 판정은 정의가 답한 것으로 한다
        └── POSSIBILITY-A-KIND-DECLARES-WHAT-IT-IS-FOR
                                            무엇에 쓰는가(용도)와 쓰면 무엇이 일어나는가(효과)를
                                            그 종류가 스스로 밝힌다
        └── POSSIBILITY-A-THING-COMES-FROM-THE-WORLD
                                            세계의 물건은 자기가 어느 상위 정의에서 왔는지를
                                            밝힌다 — 유래 없는 물건은 세계에 없다

    GOAL-WHAT-I-CARRY-IS-ONE-CONTRACT       가진 것 전부가 한자리에서 보인다
        └── POSSIBILITY-ALL-OF-IT-IN-ONE-LIST
                                            종류마다의 전용 칸이 아니라 하나의 목록이다.
                                            종류가 늘어도 목록의 형태는 바뀌지 않는다
        └── POSSIBILITY-EACH-CARRIES-WHAT-IT-CAN-DO-NOW
                                            항목마다 지금 무엇이 되고 무엇이 왜 안 되는지가
                                            함께 온다 — 화면이 판단하지 않는다
        └── POSSIBILITY-ONE-DOOR-FOR-EVERY-CHANGE
                                            늘고 주는 모든 변화가 한 통로를 지난다.
                                            규칙마다 제 손으로 고치지 않는다

    GOAL-A-THING-CAN-BE-SPENT               가진 것을 써서 세계를 바꾸고, 쓴 만큼 잃는다
        └── POSSIBILITY-USING-IS-AN-ACT     쓰는 것은 다른 행동과 같은 얼개를 진다 —
                                            시간을 쓰고, 끊기면 아무 일도 일어나지 않는다
        └── POSSIBILITY-THE-DEFINITION-DECIDES-THE-EFFECT
                                            무슨 일이 일어나는가는 정의가 정하고
                                            규칙은 그것을 실행할 뿐이다
        └── POSSIBILITY-EFFECTS-ARE-A-LIST  효과는 갈래의 목록이며, 갈래가 늘어도
                                            쓰는 행동 · 소모 · 관찰은 그대로다
        └── POSSIBILITY-SPENDING-LEAVES-LESS
                                            쓰면 줄어든다. 없으면 쓸 수 없다
        └── POSSIBILITY-NOT-EVERY-USE-SPENDS
                                            소모 여부도 정의가 정한다 — 도구는 닳지 않고
                                            쓰이며, 그래서 도구와 소비재가 같은 문 아래 선다
        └── POSSIBILITY-FAILURE-LEAVES-NOTHING
                                            되지 않은 시도는 세계에 아무 흔적도 남기지 않는다

    GOAL-WHAT-A-BODY-CAN-DO-COMES-FROM-WHAT-IT-CARRIES
                                            할 수 있는 일이 지닌 것에서 나온다 —
                                            무엇을 지녔는지의 **이름**에서가 아니라
        └── POSSIBILITY-THE-BODY-ASKS-FOR-A-USE
                                            세계는 "곡괭이가 있는가" 가 아니라
                                            "이 몸에 채굴 용도가 지금 있는가" 를 묻는다

## INTENT SET

    ── 세계가 물건을 안다 ─────────────────────────────────────────────

    INTENT-ITEM-DEFINITION-001 (ADDED)

        세계에 존재할 수 있는 **아이템 종류**마다 하나의 정의가 있다. 정의가 답하는 것은
        넷이다 — 무엇인가(분류) · 무엇에 쓰는가(용도) · 쓰면 무엇이 일어나는가(효과) ·
        겹칠 수 있는가(수량).

        종류 이름은 **정의를 찾는 열쇠일 뿐**이다. 어떤 규칙도 종류 이름 자체를 판정의
        조건으로 삼지 않는다. 규칙은 언제나 정의에게 묻고, 정의가 답한 것으로 판정한다.

        그러므로 새 아이템이 세계에 생기는 일은 **정의가 하나 늘어나는 일**이다.
        그 아이템을 쓰는 규칙도, 그것을 싣는 관찰도, 그것을 검증하는 시험도 열리지 않는다.

        지금 이 세계에 정의되는 종류는 둘이다 — 돌과 곡괭이.

    INTENT-ITEM-ORIGIN-TRACE-001 (ADDED)

        세계의 아이템 정의는 자신이 **어느 상위 정의에서 왔는지**를 밝힌다. 밝힌 것이
        상위에 없으면 그 정의는 성립하지 않는다.

        돌은 `IT-COMMON-STONE` 에서 온다 — 문명권의 굳은 땅이 아무 압력도 겪지 않아 그냥
        남긴 것이며, 그래서 아무 특별한 성질도 지니지 않는다. 그것이 결손이 아니라 그 돌의
        내용이다.

        곡괭이는 **상위 정의가 없다.** 이 Cycle 은 그것을 만들지 않는다 — 곡괭이가 지닌
        것은 세계가 남긴 성질이 아니라 사람이 붙인 **용도**이고, 유래를 요구하는 것은
        성질 쪽이기 때문이다. 상위에 세울지는 위층의 판단이다.

    INTENT-ITEM-STACKING-001 (ADDED)

        같은 종류를 여럿 지니는 방식은 정의가 정한다. 겹치는 종류는 **항목 하나에 수량**으로
        모이고, 겹치지 않는 종류는 그러지 않는다.

        지금 두 종류 모두 겹친다. 개체마다 상태가 달라져야 할 이유가 아직 세계에 없기
        때문이다 — 그 이유가 생기기 전에 물건마다 이름표를 붙이지 않는다.

    ── 가진 것 전부가 한 계약이다 ──────────────────────────────────────

    INTENT-INVENTORY-IS-ONE-CONTRACT-001 (ADDED)

        몸이 지닌 것 전부가 **하나의 목록**으로 관찰된다. 항목마다 종류와 수량이 실리고,
        지니지 않은 종류는 항목이 없다.

        어떤 종류도 자기만의 자리를 갖지 않는다. 종류가 둘에서 열로 늘어도 관찰의 형태는
        같다 — 항목이 늘 뿐이다.

    INTENT-INVENTORY-SINGLE-CHANNEL-001 (ADDED)

        소지품이 늘거나 주는 모든 변화는 **하나의 통로**를 지난다. 어떤 규칙도 소지품을
        제 손으로 직접 고치지 않는다.

        캐서 얻는 것도 그 통로를 지난다. 지금은 통로를 쓰는 규칙이 둘뿐이지만, 이후 제작 ·
        전리품 · 주고받기가 서로 다른 규칙을 갖지 않게 하는 자리가 여기서 생긴다.

    INTENT-USE-AVAILABILITY-001 (ADDED)

        소지품의 항목마다 **지금 그것으로 무엇이 되는가**와, 되지 않는다면 **왜 안 되는가**가
        함께 관찰된다.

        가능 여부를 판정하는 곳은 하나뿐이다 — 관찰에 실리는 판정과 실제로 실행될 때의
        판정이 같은 것이다. 그러므로 화면에서 불가로 보이는 것을 억지로 요청해도
        **같은 사유로** 거절된다. 그 사유의 목록을 세계가 소유하며, 화면은 사유를 만들지
        않고 받은 것을 옮긴다.

    ── 물건을 쓴다 ────────────────────────────────────────────────────

    INTENT-USE-ITEM-001 (ADDED)

        지닌 것을 **쓰는 행동**이 있다. 그것은 이 세계의 다른 행동과 완전히 같은 얼개를
        진다 — 시작하려면 지금 하던 행동이 대체 가능해야 하고, 시간을 쓰며, 그 시간 동안은
        다른 행동을 하지 않는다.

        효과는 **행동이 끝나는 시점에** 일어난다. 그러므로 끝나기 전에 끊긴 사용은
        아무 일도 일어나지 않은 것과 같다 — 효과도 없고 수량도 그대로다.

        쓰는 데 드는 것은 **물건 자신**이다. 기력을 쓰지 않는다. 몸의 자원으로 값을 치르는
        것은 스킬의 방식이고, 이 행동이 치르는 것은 지닌 것이다.

    INTENT-USE-TARGET-POLICY-001 (ADDED)

        어떤 아이템은 대상을 요구하고 어떤 아이템은 요구하지 않는다. **무엇을 요구하는가는
        정의가 밝힌다.**

        대상을 요구하는 아이템은 **그 관찰자가 지금 고르고 있는 것**을 대상으로 삼는다.
        요청이 대상을 싣지 않는다 — 살펴봄과 채집이 이미 그렇게 하고 있으며 이유도 같다.
        아무것도 고르지 않았거나 고른 것이 그 아이템이 요구하는 것이 아니면, 쓸 수 없고
        그 사유가 함께 온다.

        시작한 뒤에 다른 것을 고르면 진행 중인 사용은 **처음 고른 것을 끝까지 지닌다.**
        살펴봄 · 채집과 같은 판단이다.

    INTENT-ITEM-EFFECT-IS-DECLARED-001 (ADDED)

        **쓰면 무엇이 일어나는가는 정의가 밝히고, 규칙은 그것을 실행할 뿐이다.**
        사용 규칙은 "이것이 무엇을 하는 아이템인가" 를 묻지 않는다.

        효과는 **갈래의 목록**이다. 세계는 정의가 고른 갈래를 보고 그 갈래의 규칙을 돌린다.
        갈래가 늘어도 쓰는 행동 · 대상 정책 · 소모 · 원자성 · 관찰은 열리지 않는다 —
        목록에 항목이 하나 더해질 뿐이다.

        지금 그 목록에 있는 갈래는 둘이다.

            대상에게 위력을 전한다   INTENT-EFFECT-DELIVER-FORCE-001
            선언된 행동을 시작한다   INTENT-EFFECT-BEGIN-DECLARED-ACT-001

        둘인 것에는 이유가 있다. 갈래가 하나뿐이면 그것이 **자리인지 분기인지 구분되지
        않는다** — 하나짜리 목록은 조건문과 겉모습이 같다. 둘이 서로 다른 일을 하고,
        서로 다른 소모 성질을 지니며, 같은 문을 지나야 이 자리가 실재한다.

    INTENT-EFFECT-DELIVER-FORCE-001 (ADDED)

        **첫째 갈래** — 이 갈래를 고른 아이템을 쓰면, 고른 대상에게 위력이 전해진다.

        위력의 크기는 그 아이템의 정의가 지닌다. 그 값이 세계에 이미 있는 피해의 길로
        들어가며, **그 길은 한 곳도 바뀌지 않는다** — 방어가 걸리고, 관통이 걷고, 치명이
        터질 수 있고, 막고 있었으면 막힌다. 새 계산도 새 능력도 이 갈래가 만들지 않는다.

        전해지는 것은 **물건의 위력**이지 던진 이의 힘이 아니다. 이 아이템은 지닌 이의
        능력치를 타지 않으며, 능력치를 바꾸지도 않는다. 그래서 하나의 위력은 하찮고,
        **가진 양이 곧 할 수 있는 일의 크기**가 된다.

        해가 성립하는지는 **이미 세계에 있는 관문**이 정한다 — 나를 사냥감으로 대하지
        않는 것에게는 전해져도 아무 일이 일어나지 않고, 그 이유가 관찰된다. 아이템이라고
        관문 밖에 있지 않다.

        닿을 수 있는 거리는 **지금 세계가 손을 뻗을 수 있는 거리**를 넘지 않는다.
        멀리서 안전하게 해를 입히는 길을 이 갈래가 열지 않는다.

    INTENT-EFFECT-BEGIN-DECLARED-ACT-001 (ADDED)

        **둘째 갈래** — 이 갈래를 고른 아이템을 쓰면, 그 정의가 선언한 행동이 시작된다.

        시작될 수 있는가는 **그 행동 자신의 판정**이 정한다. 사용이 그 판정을 대신하거나
        건너뛰지 않으며, 되지 않으면 그 행동이 내놓는 사유가 그대로 온다.
        그러므로 이 갈래는 새 판정을 하나도 만들지 않는다.

        곡괭이가 이 갈래를 고르고, 선언한 행동은 채집이다. 곡괭이를 쓰는 것과 캐는 것은
        **같은 하나의 일**이며, 어느 쪽으로 요청하든 같은 판정과 같은 사유를 만난다.

    INTENT-ITEM-CONSUME-001 (ADDED)

        **쓰면 줄어든다.** 세계에서 처음으로 가진 것이 사라진다.

        얼마나 줄어드는가와 **줄어드는가 자체**를 정의가 정한다. 모든 사용이 소모는 아니다 —
        도구는 닳지 않은 채 쓰이고, 소비재는 쓰인 만큼 사라진다. 그 둘이 같은 문을 지나는
        것이 이 세계의 규율이며, 그래서 규칙은 "이것이 소비재인가" 를 묻지 않는다.

        필요한 만큼 지니지 않았으면 **쓸 수 없다.** 모자란 채로 시작해 도중에 실패하는
        일은 없다. 수량이 음수가 되는 상태는 이 세계에 존재하지 않는다.

        돌은 쓰면 하나 줄고, 곡괭이는 줄지 않는다.

    INTENT-ITEM-ATOMIC-CHANGE-001 (ADDED)

        아이템이 관련된 변화는 **하나의 성공 단위**다. 효과와 수량은 함께 일어나거나
        함께 일어나지 않는다.

        되지 않은 시도는 세계에 **아무 흔적도 남기지 않는다.** 수량도, 상태도, 이후의
        제약도 그대로다. 효과만 일어나고 수량이 그대로인 것도, 수량만 줄고 효과가 없는
        것도 이 세계에서 일어나지 않는다.

        "쓴다" 보다 이것이 먼저다. 한 번이라도 새는 세계는 그 뒤로 모든 수량을 의심하게
        만들기 때문이다.

    ── 할 수 있는 일이 지닌 것에서 나온다 ───────────────────────────────

    INTENT-CAPABILITY-FROM-DECLARED-USE-001 (CHANGED — 기존 INTENT-MINING-001 의 한 조건)

        무엇을 할 수 있는가를 세계가 물을 때, 묻는 것은 **"이 몸에 그 용도가 지금
        있는가"** 이지 "이 몸이 무엇을 지녔는가" 가 아니다.

        용도는 아이템 **정의의 선언**에서 나온다. 세계는 그 몸이 지닌 것들의 정의를 모아
        지금 어떤 용도가 있는지를 계산하고, 판정은 그 결과만 읽는다. 채집 규칙은 곡괭이를
        모른다 — 채집 용도가 있는지만 안다.

        그러므로 두 번째 채집 도구가 생기는 일은 **정의가 하나 늘어나는 일**이다.
        채집 규칙도, 화면 계약도, 채집의 시험도 열리지 않는다.

        캐는 일 자체는 **한 글자도 달라지지 않는다** — 대상도, 거리도, 남은 양도, 시간도,
        얻는 것도 그대로다. 달라지는 것은 "왜 캘 수 있는가" 의 답이 나오는 자리뿐이다.

## DESIGN TRACE

    INTENT-ITEM-DEFINITION-001
        Source Goal         GOAL-THE-WORLD-KNOWS-WHAT-A-THING-IS
        Source Possibility  POSSIBILITY-THE-DEFINITION-ANSWERS-NOT-THE-NAME ·
                            POSSIBILITY-A-KIND-DECLARES-WHAT-IT-IS-FOR
        Master              MC-USE-ITEM · DC-ITEM-KIND-IS-DATA-NOT-BRANCH (IS §5.1)

    INTENT-ITEM-ORIGIN-TRACE-001
        Source Goal         GOAL-THE-WORLD-KNOWS-WHAT-A-THING-IS
        Source Possibility  POSSIBILITY-A-THING-COMES-FROM-THE-WORLD
        Master              DC-WORLD-RESOURCE-ADAPTATION-TRACE · IT-COMMON-STONE (Q22)

    INTENT-ITEM-STACKING-001
        Source Goal         GOAL-THE-WORLD-KNOWS-WHAT-A-THING-IS
        Source Possibility  POSSIBILITY-A-KIND-DECLARES-WHAT-IT-IS-FOR
        Master              IS §5.1 (Stack 규칙 · 개체 전환 기준 §2.1)

    INTENT-INVENTORY-IS-ONE-CONTRACT-001
        Source Goal         GOAL-WHAT-I-CARRY-IS-ONE-CONTRACT
        Source Possibility  POSSIBILITY-ALL-OF-IT-IN-ONE-LIST
        Master              DC-ITEM-KIND-IS-DATA-NOT-BRANCH (IS §5.2)

    INTENT-INVENTORY-SINGLE-CHANNEL-001
        Source Goal         GOAL-WHAT-I-CARRY-IS-ONE-CONTRACT
        Source Possibility  POSSIBILITY-ONE-DOOR-FOR-EVERY-CHANGE
        Master              IS §5.2 (변경 단일 통로) · DC-ITEM-CHANGE-IS-ONE-UNIT

    INTENT-USE-AVAILABILITY-001
        Source Goal         GOAL-WHAT-I-CARRY-IS-ONE-CONTRACT
        Source Possibility  POSSIBILITY-EACH-CARRIES-WHAT-IT-CAN-DO-NOW
        Master              DC-WORLD-OWNS-THE-SURFACE-LIST (IS §5.2 · §5.3)

    INTENT-USE-ITEM-001
        Source Goal         GOAL-A-THING-CAN-BE-SPENT
        Source Possibility  POSSIBILITY-USING-IS-AN-ACT
        Master              MC-USE-ITEM (IS §5.3 — 사용 행동 · 사용 시간·중단)

    INTENT-USE-TARGET-POLICY-001
        Source Goal         GOAL-A-THING-CAN-BE-SPENT
        Source Possibility  POSSIBILITY-THE-DEFINITION-DECIDES-THE-EFFECT
        Master              IS §5.3 (대상 정책) · C017 INTENT-TARGET-DIRECTS-THE-ACT-001

    INTENT-ITEM-EFFECT-IS-DECLARED-001
        Source Goal         GOAL-A-THING-CAN-BE-SPENT
        Source Possibility  POSSIBILITY-THE-DEFINITION-DECIDES-THE-EFFECT ·
                            POSSIBILITY-EFFECTS-ARE-A-LIST
        Master              DC-ITEM-KIND-IS-DATA-NOT-BRANCH (IS §7 P1)

    INTENT-EFFECT-DELIVER-FORCE-001
        Source Goal         GOAL-A-THING-CAN-BE-SPENT
        Source Possibility  POSSIBILITY-THE-DEFINITION-DECIDES-THE-EFFECT
        Master              MC-USE-ITEM (IS §5.3 즉시 효과) · 01-cycle.md SCOPE NOTE ②·③
        제약                DC-COMBAT-ONE-FORMULA · DC-COMBAT-ONE-LAYER-AT-A-TIME

    INTENT-EFFECT-BEGIN-DECLARED-ACT-001
        Source Goal         GOAL-A-THING-CAN-BE-SPENT · GOAL-WHAT-A-BODY-CAN-DO-COMES-FROM-WHAT-IT-CARRIES
        Source Possibility  POSSIBILITY-EFFECTS-ARE-A-LIST · POSSIBILITY-NOT-EVERY-USE-SPENDS
        Master              DC-ITEM-CAPABILITY-COMES-FROM-GRANTS (IS §3.3 — 용도는 종류가 가진다)

    INTENT-ITEM-CONSUME-001
        Source Goal         GOAL-A-THING-CAN-BE-SPENT
        Source Possibility  POSSIBILITY-SPENDING-LEAVES-LESS · POSSIBILITY-NOT-EVERY-USE-SPENDS
        Master              MC-USE-ITEM (IS §5.5 소모 · 부족 수량 검증)

    INTENT-ITEM-ATOMIC-CHANGE-001
        Source Goal         GOAL-A-THING-CAN-BE-SPENT
        Source Possibility  POSSIBILITY-FAILURE-LEAVES-NOTHING
        Master              DC-ITEM-CHANGE-IS-ONE-UNIT (IS §5.5 · §7 P4)

    INTENT-CAPABILITY-FROM-DECLARED-USE-001
        Source Goal         GOAL-WHAT-A-BODY-CAN-DO-COMES-FROM-WHAT-IT-CARRIES
        Source Possibility  POSSIBILITY-THE-BODY-ASKS-FOR-A-USE
        Master              DC-ITEM-CAPABILITY-COMES-FROM-GRANTS (HISTORY Q30 · IS §3.2 · §3.3)

## EXISTING INTENT DELTA

    REUSED — 한 글자도 바꾸지 않고 그대로 쓴다

        INTENT-ACTION-STATE-001         모든 존재는 언제나 정확히 하나의 행동 안에 있다
        INTENT-ACTION-EXCLUSIVE-001     시작하려면 지금 행동이 대체 가능해야 한다 (`action-busy`)
        INTENT-ACTION-PROGRESS-001      행동이 소요 시간을 채우면 완료 효과가 일어난다
        INTENT-HIT-REACTION-001         맞으면 하던 행동이 끊긴다 — 사용도 예외가 아니다
        INTENT-TARGET-DIRECTS-THE-ACT-001   요청이 대상을 싣지 않고 고른 것을 읽는다 (C017)
        INTENT-TARGET-PERSISTS-001      시작한 행동은 처음 고른 것을 끝까지 지닌다 (C017)
        INTENT-HARM-GATE-001            해가 성립하는지는 둘 사이의 태도가 가른다 (C018)
        INTENT-UNHARMED-IS-OBSERVABLE-001   닿았는데 아무 일도 없었으면 사유가 온다 (C018)
        INTENT-DAMAGE-CALCULATE-001     하나의 피해 공식 (C010)
        INTENT-TYPED-OFFENSE-001 · INTENT-TYPED-DEFENSE-001    방식이 능력을 고른다 (C012)
        INTENT-PENETRATION-MATCH-001    관통은 마주한 방어만 걷는다 (C013)
        INTENT-CRITICAL-AMPLIFY-001     터진 타격은 커진 채로 막기를 마주한다 (C015)
        INTENT-GUARD-MITIGATE-001       막으면 생명 대신 기력을 치른다 (C011)
        INTENT-STRIKE-OBSERVE-001       타격의 내역이 관찰된다 (C010~C015)
        INTENT-PER-OBSERVER-PROJECTION-001  내 몸의 것만 나에게 실린다 (C004)

    CHANGED — 이번 Cycle Goal 이 그 의미를 바꾼다

        INTENT-MINING-001
            OLD PRECONDITION  Mining Capability 를 지닌 Item 을 보유한다
            NEW PRECONDITION  이 몸에 채집 용도가 지금 있다
                              (INTENT-CAPABILITY-FROM-DECLARED-USE-001)
            변하지 않는 것     대상 · 거리 · 남은 양 · 행동 대체 가능 여부 · 소요 시간 ·
                              얻는 것 · 실패 사유의 이름. 캐는 일 자체는 그대로다

            NEW PATH          곡괭이를 쓰는 것으로도 같은 채집이 시작된다
                              (INTENT-EFFECT-BEGIN-DECLARED-ACT-001).
                              입구가 둘이 되어도 **판정은 하나다** — 같은 조건, 같은 사유

        INTENT-MINING-001 의 획득
            OLD  규칙이 소지품을 직접 고친다
            NEW  변경 단일 통로를 지난다 (INTENT-INVENTORY-SINGLE-CHANNEL-001)
            변하지 않는 것  얻는 양과 시점

        INTENT-OBSERVER-JOIN-001
            OLD  몸의 초기 소지품이 종류 이름 고정형으로 주어진다
            NEW  정의된 종류와 수량의 목록으로 주어진다
            변하지 않는 것  참여의 인과 · 몸의 종류 · 자리 · 이름 짓는 방식

    AFFECTED — 의미는 그대로이나 이 변경의 영향을 받는다

        INTENT-WORLD-OBSERVATION-001    소지품이 실리는 형태가 바뀐다 —
                                        돌 전용 칸과 도구 보유 여부 칸이 목록 하나가 된다
        INTENT-SELF-OBSERVE-001         같은 이유. 늘 눈앞에 있는 것의 목록이 달라진다
        INTENT-COMMAND-CATALOG-001      요청할 수 있는 것에 사용이 더해진다
        INTENT-NPC-AUTONOMY-001         자율 존재도 소지품을 지닐 수 있으나, 이 Cycle 은
                                        자율 존재에게 아이템을 쓰게 하지 않는다 —
                                        규칙에 예외를 두는 것이 아니라 아직 그 판단을
                                        주지 않는 것이다 (01-cycle.md EXCLUDED 밖의 여백)

## NOTE — Stage 1 이 남긴 것을 이 Stage 가 정한 것

    01-cycle.md ⑤ 는 "효과 종류가 둘 이상인 상태로 닫는다. 둘째 항목이 무엇인가는
    Stage 2·3 이 정한다" 로 자리만 열어 두었다. 이 Stage 가 그것을
    **INTENT-EFFECT-BEGIN-DECLARED-ACT-001 (선언된 행동을 시작한다)** 로 정했다.

    이 갈래가 가장 값싼 이유
        새 판정을 하나도 만들지 않는다 — 시작될 수 있는지는 그 행동 자신이 이미 답한다
        세계에 아이템을 늘리지 않는다 — 이미 있는 곡괭이가 그 갈래를 고른다
        제외 목록의 어느 칸도 열지 않는다 — 회복 · 능력치 · 장착 · 제작 · 몸 밖의 아이템 ·
            감정 어디에도 닿지 않는다
        **소모되지 않는 사용**을 세계에 세운다. 두 갈래가 서로 다른 소모 성질을 지녀야
            "소모 여부도 정의가 정한다" 가 말이 아니라 관찰이 된다

    그리고 이 갈래가 있어야 DC-ITEM-CAPABILITY-COMES-FROM-GRANTS 가 반쪽으로 끝나지
    않는다 — 용도가 정의로 옮겨 가는 것(판정 쪽)과 그 용도가 실제로 행동을 여는 것(사용 쪽)이
    한 Cycle 안에서 만난다.
