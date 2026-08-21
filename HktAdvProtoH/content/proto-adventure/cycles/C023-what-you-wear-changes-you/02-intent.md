# C023 — Intent

> C020 이 물건을 **쓸 수 있는 것**으로, C022 가 지님을 **유한한 것**으로 만들었다.
> 그러나 물건은 아직 몸에 닿지 못한다 — 가방 안에 있기만 해도 곡괭이는 캐고,
> 몸의 값은 무엇을 지녔든 한 톨도 달라지지 않는다. 지님과 씀 사이에 **적용**이라는
> 자리가 없기 때문이다. 이번에 더해지는 것이 그 자리다. 몸에 걸 수 있는 자리가
> 생기고, 그 자리에 든 것만이 몸을 바꾼다. 걸면 달라지고 풀면 정확히 돌아온다 —
> 그 되돌아옴이 있어야 "물건을 잃으면 도로 못 하게 된다" 가 세계에서 참이 된다.

## GOAL / POSSIBILITY

    GOAL-THE-BODY-HAS-PLACES-TO-APPLY       몸에 무엇을 걸어 둘 자리가 있다
        └── POSSIBILITY-THE-PLACES-ARE-FEW
                                            적용의 자리는 담을 칸보다 **훨씬 적다**.
                                            그 좁음이 "무엇을 걸어 둘까" 를 선택으로
                                            만든다. 다 걸 수 있으면 선택이 사라진다
        └── POSSIBILITY-THE-PLACES-ARE-A-VALUE-NOT-A-RULE
                                            자리의 수와 이름은 세계가 지닌 값이다.
                                            판정은 "이 자리가 이것을 받는가" 를 물을 뿐
                                            자리의 이름을 조건으로 삼지 않는다
        └── POSSIBILITY-FITNESS-IS-ANSWERED-BY-THE-DEFINITION
                                            무엇이 어느 자리에 들어가는가는 그 종류의
                                            정의와 그 자리의 정의가 마주 보아 답한다.
                                            규칙은 종류 이름을 묻지 않는다

    GOAL-ONLY-WHAT-IS-APPLIED-CHANGES-THE-BODY
                                            걸어 둔 것만이 몸을 바꾼다
        └── POSSIBILITY-HOLDING-DOES-NOTHING
                                            가방에 든 것은 몸에 아무 일도 하지 않는다.
                                            값도 바꾸지 않고 할 수 있는 일도 늘리지 않는다
        └── POSSIBILITY-WHAT-A-THING-GIVES-IS-DECLARED
                                            그 물건이 무엇을 주는가는 정의가 밝힌다 —
                                            값의 기여든 할 수 있는 일이든 같은 자리에서
        └── POSSIBILITY-THE-CAPABILITY-QUESTION-DOES-NOT-CHANGE
                                            "이 몸에 그 용도가 지금 있는가" 라는 물음은
                                            그대로다. **답을 어디서 길어 오는지만** 바뀐다

    GOAL-THE-BODY-HAS-A-BASE-AND-AN-EFFECTIVE-VALUE
                                            몸에 기본값과 유효 값이 갈린다
        └── POSSIBILITY-EFFECTIVE-IS-RECOMPUTED
                                            유효 값은 기본값과 지금 걸린 것들로 **다시
                                            계산한다.** 걸 때 더하고 풀 때 빼지 않는다
        └── POSSIBILITY-THE-BASE-IS-NEVER-TOUCHED-BY-APPLYING
                                            거는 일은 기본값을 건드리지 않는다.
                                            기본값을 바꾸는 것은 다른 사정이다
        └── POSSIBILITY-EVERY-READER-READS-THE-EFFECTIVE-ONE
                                            겨룸이 읽는 값은 유효 값 하나다.
                                            어떤 판정도 기본값과 유효 값 사이에서 고르지 않는다

    GOAL-APPLYING-AND-RELEASING-ARE-EACH-ONE-UNIT
                                            걸기도 풀기도 하나의 성공 단위다
        └── POSSIBILITY-A-FAILED-APPLY-LEAVES-NOTHING
                                            실패한 요청은 자리도 수량도 값도 건드리지 않는다
        └── POSSIBILITY-A-THING-IS-IN-EXACTLY-ONE-PLACE
                                            걸린 것은 가방에 없다. 자리가 물건을 직접 담는다.
                                            그래서 "한 곳에만" 이 검사가 아니라 구조로 성립한다
        └── POSSIBILITY-RELEASING-ASKS-FOR-ROOM
                                            풀려면 받을 자리가 있어야 한다. 없으면 사유와 함께
                                            거절되고, 세계는 그 물건을 바닥에 떨어뜨리지 않는다

    GOAL-RELEASING-RETURNS-EXACTLY          풀면 정확히 이전의 몸으로 돌아온다
        └── POSSIBILITY-NO-DRIFT-ACROSS-REPETITION
                                            백 번 걸고 백 번 풀어도 값이 표류하지 않는다
        └── POSSIBILITY-WHAT-IS-LOST-IS-LOST-AT-ONCE
                                            푸는 순간 그 물건이 주던 값도 할 수 있던 일도
                                            함께 사라진다. 값과 용도가 따로 놀지 않는다

    GOAL-WHAT-IS-APPLIED-IS-SEEN            무엇이 걸려 있는지가 보인다
        └── POSSIBILITY-THE-PLACES-COME-WITH-WHAT-IS-IN-THEM
                                            자리들과 그 안의 것이 함께 온다
        └── POSSIBILITY-A-REFUSAL-CARRIES-ITS-REASON
                                            걸 수 없는 것은 왜 안 되는지가 함께 온다
        └── POSSIBILITY-THE-SURFACE-JUDGES-NOTHING
                                            화면이 "이건 여기 들어가나" 를 세어 알아내지 않는다

## INTENT SET

    ── 몸에 자리가 있다 ──────────────────────────────────────────────

    INTENT-BODY-HAS-APPLY-PLACES-001 (ADDED)

        몸은 이름 있는 **유한한 적용 자리들**을 지닌다. 각 자리는 비어 있거나 물건
        하나를 담고 있다. 자리의 수는 담을 칸의 수보다 훨씬 적다.

        자리의 수와 이름은 **세계가 지닌 값**이다. 판정은 "이 자리가 지금 비어 있는가",
        "이 자리가 이것을 받는가" 를 물을 뿐 그 자리가 무엇이라 불리는지를 조건으로
        삼지 않는다. 그러므로 자리를 하나 늘리거나 이름을 바꾸는 일에 규칙의 문장이
        한 줄도 열리지 않는다.

        **자리는 개체가 아니다.** 자리에 담기는 것은 종류이지 그 물건만의 상태가 아니다.
        같은 종류 둘 중 어느 것이 걸렸는지를 세계가 구분할 필요가 없다 — 하나는 자리에
        있고 하나는 가방에 있으며, 그 둘의 차이는 위치뿐이다.

    INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001 (ADDED)

        무엇이 어느 자리에 들어가는가는 **정의가 답한다.** 물건의 정의가 자신이 어떤
        성격의 자리에 걸릴 수 있는지를 밝히고, 자리의 정의가 자신이 어떤 성격을 받는지를
        밝힌다. 그 둘이 마주 보아 가부가 나온다.

        규칙은 종류 이름을 묻지 않는다. 그러므로 새 장비가 생기는 일은 **정의가 하나
        늘어나는 일**이며, 거는 규칙도 그것을 싣는 관찰도 그것을 검증하는 시험도 열리지
        않는다.

        걸릴 수 없는 물건이 있는 것도 정상이다 — 돌은 어느 자리에도 들어가지 않는다.
        그것은 결손이 아니라 그 물건의 내용이다.

    ── 걸어 둔 것만이 몸을 바꾼다 ────────────────────────────────────

    INTENT-ONLY-THE-APPLIED-GIVES-001 (ADDED)

        물건이 주는 것은 **걸려 있는 동안에만** 몸에 나타난다. 가방에 든 것은 몸에
        아무 일도 하지 않는다 — 값도 바꾸지 않고, 할 수 있는 일도 늘리지 않는다.

        무엇을 주는가는 정의가 밝힌다. 값의 기여든 할 수 있는 일이든 **같은 자리에서**
        밝혀지며, 세계는 그 둘을 서로 다른 기계로 다루지 않는다.

        이것이 이 Cycle 이 여는 것의 전부다. 지금 세계는 이 문장을 어기고 있다 —
        가지고만 있어도 캐진다.

    INTENT-CAPABILITY-FROM-DECLARED-USE-001 (CHANGED)

        **물음은 그대로다** — "이 몸에 그 용도가 지금 있는가". 그 답을 어디서 길어
        오는가만 바뀐다.

            이전    지닌 것들이 선언한 용도의 합
            이후    **걸린 것들**이 선언한 용도의 합

        묻는 쪽은 달라지지 않는다. 채굴은 여전히 "곡괭이를 걸었는가" 가 아니라
        "이 몸에 채굴 용도가 있는가" 를 묻는다.

    ── 기본값과 유효 값 ─────────────────────────────────────────────

    INTENT-EFFECTIVE-IS-RECOMPUTED-NOT-ACCUMULATED-001 (ADDED)

        몸의 능력치에 **기본값**과 **유효 값**이 갈린다.

            기본값    그 몸이 아무것도 걸지 않았을 때의 값
            유효 값    기본값과 **지금 걸린 것들의 기여**로 다시 계산한 값

        **가감이 아니라 재계산이다.** 걸 때 더하고 풀 때 빼는 것이 아니라, 걸린 것이
        달라질 때마다 기본값에서 다시 세운다. 그래야 백 번 걸고 백 번 풀어도 값이
        표류하지 않고, 무엇이 어떤 순서로 걸렸는지가 결과를 바꾸지 않는다.

        거는 일은 기본값을 건드리지 않는다. 기본값을 바꾸는 것은 이 Cycle 이 다루는
        사정이 아니다.

    INTENT-CONTRIBUTION-COMES-FROM-THE-DEFINITION-001 (ADDED)

        걸린 것이 몸의 값에 얼마를 보태는가는 **정의가 답한다.** 규칙은 종류 이름을
        묻지 않는다.

        기여의 출처는 하나가 아닐 수 있다 — 걸린 것도, 사건이 남긴 것도 몸의 값을
        바꾼다. 세계는 그 둘을 위해 서로 다른 기계를 만들지 않는다. 다른 것은
        **사라지는 조건**뿐이다: 걸린 것은 풀면 사라지고, 사건이 남긴 것은 만료되면
        사라진다. 이 Cycle 이 세우는 것은 그 얼개의 **첫 출처 하나**다.

    INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 (ADDED)

        능력치를 읽는 모든 판정은 **유효 값**을 읽는다. 어떤 판정도 기본값과 유효 값
        사이에서 고르지 않는다 — 고를 수 있게 두면 어느 값이 세계의 권위인지가
        판정마다 달라진다.

        아무것도 걸지 않은 몸에서는 두 값이 같다. 그러므로 이 문장은 지금까지의
        어떤 결과도 바꾸지 않는다.

    ── 걸기와 풀기 ──────────────────────────────────────────────────

    INTENT-APPLY-ITEM-001 (ADDED)

        가진 것 중 하나를 **자리에 건다.** 그 물건은 가방에서 빠져 자리에 있게 되고,
        그 순간부터 그것이 주는 것이 몸에 나타난다.

        하나의 성공 단위다. 성립하지 않으면 **아무것도 바뀌지 않는다** — 자리도,
        수량도, 값도. 성립하지 않는 사정은 사유로 온다.

        **걸린 것은 자리를 쓰지 않는다.** 가방이 세는 자리에서 그 물건이 빠지므로
        가방은 한 자리 가벼워진다. 여전히 그 몸의 것이며, 달라진 것은 있는 곳뿐이다.

    INTENT-APPLY-NEEDS-AN-EMPTY-PLACE-001 (ADDED · 이 Cycle 한정)

        이 Cycle 에서 거는 일은 **빈 자리**를 요구한다. 이미 찬 자리에 걸려 하면
        사유와 함께 거절되고 아무것도 바뀌지 않는다.

        **이것은 세계의 최종 형태가 아니다.** 이미 찬 자리에 거는 것은 본래 실패가
        아니라 교체라는 정상 성공 경로다 (IE §29.1). 그 경로를 여는 것은 다음 Cycle 이며
        (`FR-ONE-SLOT-ONE-ITEM`), 그때 이 Intent 는 CHANGED 로 대체된다.
        여기서 못박는 것은 하나다 — **되지 않는 일이 조용히 반쯤 되지는 않는다.**

    INTENT-RELEASE-ITEM-001 (ADDED)

        걸린 것을 **풀어 가방으로 되돌린다.** 그 순간 그것이 주던 값도 할 수 있던 일도
        함께 사라진다. 값과 용도가 따로 사라지지 않는다.

        하나의 성공 단위다. 성립하지 않으면 아무것도 바뀌지 않는다.

    INTENT-RELEASE-ASKS-FOR-ROOM-001 (ADDED)

        푸는 데에는 **받을 자리**가 있어야 한다. 가방에 담을 곳이 없으면 풀 수 없고,
        사유와 함께 거절된다.

        세계는 풀린 물건을 바닥에 떨어뜨리지 않는다 — 겪는 사람이 의도하지 않은 잃음을
        만들지 않기 위해서다. 그리고 세계에 놓인 아이템이라는 것이 아직 없다.

        이것이 C022 의 자리와 이 Cycle 의 자리가 처음 만나는 지점이다.

    INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001 (ADDED)

        물건은 언제나 **가방이나 자리 중 정확히 한 곳**에 있다. 자리는 가방을 가리키는
        표를 들지 않고 물건 자체를 담는다.

        그러므로 "한 곳에만" 은 검사로 지켜지는 것이 아니라 **담길 곳이 애초에 하나뿐이라**
        성립한다. 가방을 어떻게 다시 늘어놓아도 걸린 것은 흔들리지 않는다.

    ── 막힘 ────────────────────────────────────────────────────────

    INTENT-NO-SELF-INFLICTED-DEAD-END-001 (CHANGED)

        되돌릴 수 없는 막힘을 스스로 만들 수 없다 — **판정의 범위가 넓어진다.**

        C022 는 "덜어내면 이 몸에서 사라지는 용도" 를 가진 것들로만 물었다. 이제 용도는
        걸린 것에서 오므로, 그 물음은 **가방과 자리 양쪽**을 함께 보아야 한다.
        걸어 둔 곡괭이가 있는 채로 가방의 곡괭이를 덜어내는 것은 아무 용도도 잃지
        않는 일이며, 세계는 그것을 막지 않는다.

        **푸는 것은 잃는 것이 아니다.** 풀린 물건은 가방으로 돌아오므로 이 판정을
        지나지 않는다.

    ── 관찰 ────────────────────────────────────────────────────────

    INTENT-APPLIED-IS-OBSERVED-001 (ADDED)

        지금 무엇이 어느 자리에 걸려 있는지가 관찰로 온다. 자리들은 비어 있는 것까지
        전부 오며, 비었다는 것도 관찰의 내용이다.

        무엇을 걸 수 있고 무엇을 풀 수 있는지, 안 되는 것은 **왜 안 되는지**가 함께
        온다. 겪는 사람이 이유를 추측하지 않는다.

        화면은 이 판정을 자기 쪽에서 다시 하지 않는다 — "이건 여기 들어가나" 도
        "지금 풀 자리가 있나" 도 세계가 답한다. 그리고 그 답은 요청했을 때의 답과
        같다: 화면에서 불가로 보이는 것을 억지로 요청해도 같은 사유로 거절된다.

    INTENT-EFFECTIVE-IS-OBSERVED-001 (ADDED)

        몸의 값은 **유효 값**으로 관찰된다. 걸기 전후로 그 값이 달라지는 것이 이 Cycle 의
        플레이가 확인되는 자리다.

        화면이 기본값과 기여를 받아 스스로 합치지 않는다 — 합친 것을 받는다.

## DESIGN TRACE

    INTENT-BODY-HAS-APPLY-PLACES-001
        Source Goal         GOAL-THE-BODY-HAS-PLACES-TO-APPLY
        Source Possibility  POSSIBILITY-THE-PLACES-ARE-FEW ·
                            POSSIBILITY-THE-PLACES-ARE-A-VALUE-NOT-A-RULE

    INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001
        Source Goal         GOAL-THE-BODY-HAS-PLACES-TO-APPLY
        Source Possibility  POSSIBILITY-FITNESS-IS-ANSWERED-BY-THE-DEFINITION

    INTENT-ONLY-THE-APPLIED-GIVES-001
        Source Goal         GOAL-ONLY-WHAT-IS-APPLIED-CHANGES-THE-BODY
        Source Possibility  POSSIBILITY-HOLDING-DOES-NOTHING ·
                            POSSIBILITY-WHAT-A-THING-GIVES-IS-DECLARED

    INTENT-CAPABILITY-FROM-DECLARED-USE-001 (CHANGED)
        Source Goal         GOAL-ONLY-WHAT-IS-APPLIED-CHANGES-THE-BODY
        Source Possibility  POSSIBILITY-THE-CAPABILITY-QUESTION-DOES-NOT-CHANGE

    INTENT-EFFECTIVE-IS-RECOMPUTED-NOT-ACCUMULATED-001
        Source Goal         GOAL-THE-BODY-HAS-A-BASE-AND-AN-EFFECTIVE-VALUE
        Source Possibility  POSSIBILITY-EFFECTIVE-IS-RECOMPUTED ·
                            POSSIBILITY-THE-BASE-IS-NEVER-TOUCHED-BY-APPLYING

    INTENT-CONTRIBUTION-COMES-FROM-THE-DEFINITION-001
        Source Goal         GOAL-THE-BODY-HAS-A-BASE-AND-AN-EFFECTIVE-VALUE
        Source Possibility  POSSIBILITY-WHAT-A-THING-GIVES-IS-DECLARED

    INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001
        Source Goal         GOAL-THE-BODY-HAS-A-BASE-AND-AN-EFFECTIVE-VALUE
        Source Possibility  POSSIBILITY-EVERY-READER-READS-THE-EFFECTIVE-ONE

    INTENT-APPLY-ITEM-001
        Source Goal         GOAL-APPLYING-AND-RELEASING-ARE-EACH-ONE-UNIT
        Source Possibility  POSSIBILITY-A-FAILED-APPLY-LEAVES-NOTHING

    INTENT-APPLY-NEEDS-AN-EMPTY-PLACE-001
        Source Goal         GOAL-APPLYING-AND-RELEASING-ARE-EACH-ONE-UNIT
        Source Possibility  POSSIBILITY-A-FAILED-APPLY-LEAVES-NOTHING
        Note                이 Cycle 한정 — 01-cycle.md EXCLUDED(교체)의 이면이다

    INTENT-RELEASE-ITEM-001
        Source Goal         GOAL-RELEASING-RETURNS-EXACTLY
        Source Possibility  POSSIBILITY-WHAT-IS-LOST-IS-LOST-AT-ONCE ·
                            POSSIBILITY-NO-DRIFT-ACROSS-REPETITION

    INTENT-RELEASE-ASKS-FOR-ROOM-001
        Source Goal         GOAL-APPLYING-AND-RELEASING-ARE-EACH-ONE-UNIT
        Source Possibility  POSSIBILITY-RELEASING-ASKS-FOR-ROOM

    INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001
        Source Goal         GOAL-APPLYING-AND-RELEASING-ARE-EACH-ONE-UNIT
        Source Possibility  POSSIBILITY-A-THING-IS-IN-EXACTLY-ONE-PLACE

    INTENT-NO-SELF-INFLICTED-DEAD-END-001 (CHANGED)
        Source Goal         GOAL-NO-DOOR-CLOSES-FOREVER              (C022)
        Source Possibility  POSSIBILITY-THE-WORLD-GUARDS-THE-LAST-WAY-BACK (C022)
        Note                이 Cycle 은 그 판정이 보는 **범위**를 넓힐 뿐
                            의미를 바꾸지 않는다

    INTENT-APPLIED-IS-OBSERVED-001
        Source Goal         GOAL-WHAT-IS-APPLIED-IS-SEEN
        Source Possibility  POSSIBILITY-THE-PLACES-COME-WITH-WHAT-IS-IN-THEM ·
                            POSSIBILITY-A-REFUSAL-CARRIES-ITS-REASON ·
                            POSSIBILITY-THE-SURFACE-JUDGES-NOTHING

    INTENT-EFFECTIVE-IS-OBSERVED-001
        Source Goal         GOAL-WHAT-IS-APPLIED-IS-SEEN
        Source Possibility  POSSIBILITY-THE-SURFACE-JUDGES-NOTHING

    ── 위층으로의 역추적 ────────────────────────────────────────────

        MG-EXPLORE-BEIRA
            └── MP-ADAPT-BY-RESOURCE   "물건이 대신해 주고, 물건을 잃으면 도로
                                        못 하게 된다"
                    └── MC-EQUIP-ITEM  이 Cycle 의 여섯 GOAL 전부가 이 노드 하나를
                                        절반까지 세운다. "물건이 대신해 준다" 는
                                        INTENT-ONLY-THE-APPLIED-GIVES-001 이,
                                        "잃으면 도로 못 하게 된다" 는
                                        INTENT-RELEASE-ITEM-001 이 소유한다

## EXISTING INTENT DELTA

    REUSED

        INTENT-ITEM-DEFINITION-001          정의가 단일 출처다 — 적용 자리와 기여가
                                            그 정의에 는다. 새 출처를 만들지 않는다
        INTENT-INVENTORY-SINGLE-CHANNEL-001 걸기와 풀기의 수량 변경이 그 통로를 지난다.
                                            자리를 위한 두 번째 통로를 파지 않는다
        INTENT-CARRY-ROOM-IS-FINITE-001     푸는 쪽이 이것에 묻는다 — 받을 자리가 있는가
        INTENT-ROOM-COST-COMES-FROM-THE-DEFINITION-001
                                            걸린 것이 가방에서 빠지는 것은 그 계산에
                                            수량이 하나 줄어드는 일일 뿐이다
        INTENT-ITEM-ATOMIC-CHANGE-001       걸기·풀기의 원자성이 같은 형태를 따른다
        INTENT-INVENTORY-IS-ONE-CONTRACT-001
                                            적용의 관찰이 소지품 관찰과 **하나의 계약**
                                            안에 선다. 두 개의 관찰 계약을 만들지 않는다

    CHANGED

        INTENT-CAPABILITY-FROM-DECLARED-USE-001
            물음은 그대로, 답의 출처가 소지에서 적용으로 옮긴다.
            **이 Cycle 의 중심 변경이며 나머지 CHANGED 는 전부 이것의 파급이다**

        INTENT-NO-SELF-INFLICTED-DEAD-END-001
            판정이 보는 범위가 가방에서 가방과 자리 양쪽으로 넓어진다

    AFFECTED

        INTENT-MINING-001               곡괭이를 걸어야 캘 수 있다. **묻는 문장은
                                        열리지 않는다** — 같은 물음에 답이 달라진다
        INTENT-DISCARD-ITEM-001         걸린 것은 덜어내기의 대상이 아니다.
                                        덜어내려면 먼저 풀어야 한다
        INTENT-USE-ITEM-001             쓰는 것과 거는 것은 다른 일이다. 이 Cycle 은
                                        **쓰기의 대상을 좁히지 않는다** — 가방의 돌은
                                        걸지 않아도 그대로 던져진다. 좁히면 C020 의
                                        플레이가 이유 없이 사라진다
        INTENT-ATTACK-POWER-001         한 방의 크기가 유효 값에서 나온다.
                                        **세계 안에서 그 값을 올리는 첫 경로**가 열린다
        INTENT-TYPED-OFFENSE-001        방식이 고르는 값이 유효 값이다
        INTENT-TYPED-DEFENSE-001        같음 — 맞는 쪽의 값도 유효 값이다
        INTENT-DAMAGE-CALCULATE-001     공식은 열리지 않는다. 읽는 값의 출처만 바뀐다.
                                        아무것도 걸지 않은 몸의 결과는 그대로여야 한다 (회귀)
        INTENT-CRITICAL-001 ·
        INTENT-PENETRATION-001          같음 — 능력치를 읽는 모든 판정이 유효 값을 읽는다
        INTENT-ATTRIBUTE-MUTATE-001     밖에서 손대는 값은 **기본값**이다. 관찰에 나가는
                                        것은 유효 값이므로, 디버그로 넣은 수와 화면의 수가
                                        걸린 것이 있을 때 다르다. 그것이 옳은 결과다
        INTENT-SELF-OBSERVE-001         자기 몸의 관찰에 자리와 유효 값이 실린다
