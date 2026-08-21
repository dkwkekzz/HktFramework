# C020 — Intent

> 지금 이 세계에서 지니는 데는 아무 대가가 없다. 캐면 숫자가 하나 늘고, 그 숫자에는
> 천장이 없으며, 한 번 는 것은 영원히 남는다. 그래서 "무엇을 들고 다닐까" 라는 문장이
> 성립하지 않는다 — 전부 들고 다니면 되기 때문이다. 이번에 더해지는 것은 새 행동도
> 새 자원도 아니라 **자리** 하나다. 지니는 데 자리가 들고, 자리는 유한하며, 덜어내면
> 자리가 빈다. 그 하나가 서면 캐는 일이 처음으로 **선택을 요구한다** — 그리고 세계에
> 처음으로 가진 것이 사라지는 길이 생긴다.

## GOAL / POSSIBILITY

    GOAL-THE-WORLD-KNOWS-WHAT-A-THING-IS   세계가 물건이 무엇인지 안다
        └── POSSIBILITY-A-KIND-IS-A-KEY-NOT-A-BRANCH
                                           종류 이름은 정의를 찾는 열쇠일 뿐, 규칙이
                                           갈라지는 지점이 아니다
        └── POSSIBILITY-A-THING-DECLARES-ITS-USE
                                           무엇에 쓰는 물건인지는 그 종류의 선언이다 —
                                           규칙 안에 적힌 목록이 아니다

    GOAL-CARRYING-TAKES-ROOM               지니는 데는 자리가 든다
        └── POSSIBILITY-ROOM-IS-FINITE     담을 자리의 수가 유한하다
        └── POSSIBILITY-ALIKE-THINGS-SHARE-A-ROOM
                                           같은 것끼리는 한 자리에 겹쳐 쌓인다. 겹침에도
                                           한도가 있고, 겹칠 수 없는 것은 자리를 혼자 쓴다

    GOAL-A-FULL-HOLD-REFUSES               자리가 없으면 받지 못한다
        └── POSSIBILITY-ALL-OR-NOTHING     다 담기거나 하나도 담기지 않는다 —
                                           반쯤 받아 두는 일이 없다
        └── POSSIBILITY-THE-WORLD-KEEPS-WHAT-IT-COULD-NOT-GIVE
                                           건네지 못한 것은 세계에 그대로 남는다

    GOAL-WHAT-YOU-CARRY-CAN-BE-SEEN        지닌 것 전부가 한자리에 보인다
        └── POSSIBILITY-ONE-CONTRACT-FOR-EVERY-KIND
                                           종류마다 따로 자리를 만들지 않는다 — 하나의
                                           계약이 전부를 실어 보낸다
        └── POSSIBILITY-THE-WORLD-SAYS-WHY-NOT
                                           지금 무엇이 되고 무엇이 왜 안 되는지를 세계가
                                           판정해 함께 싣는다

    GOAL-WHAT-YOU-CARRY-CAN-BE-LET-GO      지닌 것을 덜어낼 수 있다
        └── POSSIBILITY-LETTING-GO-MAKES-ROOM
                                           덜어낸 만큼 자리가 빈다 — 그것이 가득 참의
                                           출구다
        └── POSSIBILITY-WHAT-IS-LET-GO-IS-GONE
                                           덜어낸 것은 없어진다. 세계 어딘가에 놓이지
                                           않는다 — 놓이는 것은 아직 이 세계에 없는 일이다

    GOAL-NO-ONE-CAN-LOCK-THEMSELVES-OUT    스스로 되돌릴 수 없는 막힘을 만들 수 없다
        └── POSSIBILITY-THE-LAST-WAY-CANNOT-BE-DISCARDED
                                           지금 열려 있는 유일한 길을 여는 물건은 덜어낼
                                           수 없다 — 거절되고 그 사유가 온다

## INTENT SET

    ── 세계가 물건을 안다 ──────────────────────────────────────────────

    INTENT-ITEM-CATALOG-001 (ADDED)

        세계에 있을 수 있는 물건의 종류는 **세계가 정의한 목록**에 있다. 그 정의는
        최소한 다음을 말한다.

            무엇인가          부르는 이름과 어떤 갈래의 물건인가
            겹칠 수 있는가     같은 것끼리 한 자리에 쌓을 수 있는가, 얼마까지인가
            무엇에 쓰는가      이 물건이 지니는 용도 (없을 수 있다 — 재료는 용도가 없다)
            어디서 왔는가      Master 의 어느 종류(`IT-*`)에서 온 것인가

        규칙은 종류 이름을 묻지 않는다. 물건에 대해 알아야 할 것이 있으면 **그 정의에
        묻는다.** 새 종류가 생기는 것은 목록에 정의가 하나 더해지는 일이며, 그 때문에
        규칙이 갈라지지 않는다.

        어디서 왔는가는 장식이 아니다 — 가리키는 `IT-*` 가 없으면 그 정의는 성립하지
        않는다. 물건은 세계가 낳은 것이지 편의로 만들어 낸 것이 아니기 때문이다.

    INTENT-USE-COMES-FROM-DECLARATION-001 (CHANGED)

        지금 채굴은 "지닌 것 중에 곡괭이가 있는가" 를 묻는다. 이제 **"이 몸에 캐는
        용도가 지금 있는가"** 를 묻는다.

        그 답은 지닌 것들의 정의가 선언한 용도를 합쳐 세계가 낸다. 그러므로 캘 수 있는
        새 도구가 생겨도 채굴 규칙은 한 글자도 바뀌지 않는다 — 그 도구의 정의가 캐는
        용도를 선언하면 그만이다.

        **답이 어디서 오는가는 아직 소지다.** 지니고만 있어도 용도가 성립한다 —
        적용(몸에 걸어 두는 것)이라는 개념이 이 세계에 아직 없기 때문이다. 이 Intent 가
        바꾸는 것은 **묻는 문장**이고, 답의 출처를 소지에서 적용으로 옮기는 것은 그
        개념이 오는 때의 일이다. 묻는 자리를 하나로 모아 두어 그때 한 곳만 고치면 되게 한다.

    ── 지니는 데 자리가 든다 ────────────────────────────────────────────

    INTENT-CARRY-ROOM-001 (ADDED)

        지닌 것은 **자리**에 담긴다. 몸이 가진 자리의 수는 유한하다.

            겹칠 수 있는 물건    같은 종류끼리 한 자리에 쌓인다. 그 자리가 겹침 한도에
                               이르면 다음 것은 새 자리를 쓴다
            겹칠 수 없는 물건    하나가 자리 하나를 혼자 쓴다

        자리의 수와 겹침의 한도는 값이며, 세계 규칙이 정한다. 이 Intent 가 말하는 것은
        **유한하다**는 것 하나다 — 몇인지가 아니라 끝이 있다는 것이다.

        자리는 몸의 것이다. 지닌 물건은 언제나 자기 자리 하나에 있고, 두 곳에 동시에
        있지 않는다.

    INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 (ADDED)

        몸이 물건을 받을 때, 요청된 수량이 **전부 들어갈 수 있을 때만** 들어간다.
        일부만 들어가고 나머지가 버려지는 일은 없다.

            전부 들어갈 수 있다    전부 들어간다
            그렇지 않다           하나도 들어가지 않고, 왜 받지 못했는지가 함께 온다

        건네지 못한 것은 **사라지지 않는다.** 세계가 그것을 내주려 했다면 내주지 않은
        채로 남는다 — 받는 쪽이 못 받았다고 해서 세계에서 없어지지 않는다.

        한 번에 얼마를 건네는가는 건네는 쪽이 정한다. 하나씩 여러 번 건네는 길과 묶음
        하나를 통째로 건네는 길은 둘 다 정상이며, **한 번의 건넴 안에서 반쪽이 없다**는
        것만이 이 Intent 다.

    INTENT-MINING-001 (CHANGED)

        지금 채굴은 완료되면 언제나 돌이 하나 는다. 이제 **받을 자리가 없으면 그
        채굴은 성과를 남기지 못한다.**

            받을 자리가 있다      지금과 같다 — 광맥이 줄고 지닌 것이 는다
            받을 자리가 없다      광맥도 줄지 않고 지닌 것도 늘지 않는다.
                                왜 받지 못했는지가 온다

        광맥이 줄지 않는 것이 핵심이다 — 받지 못한 자원이 세계에서 사라지면
        INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 의 "건네지 못한 것은 남는다" 가 깨진다.

        자리가 없다는 것을 **캐기 전에도 알 수 있다.** 캘 수 없는 사정은 이미 사유와
        함께 관찰되고 있으며(도구 없음 · 거리 · 고갈), 자리 없음이 그 목록에 나란히 선다.

    ── 지닌 것이 보인다 ────────────────────────────────────────────────

    INTENT-CARRIED-IS-OBSERVABLE-001 (ADDED)

        몸이 지닌 것 **전부**가 하나의 계약으로 보는 쪽에 실린다. 종류마다 따로 만든
        자리가 아니라 하나의 목록이다.

        각 항목에는 최소한 다음이 실린다.

            무엇인가          그 물건의 정의가 말하는 이름과 갈래
            얼마나            그 자리에 쌓인 수량
            지금 무엇이 되는가  이 물건으로 지금 할 수 있는 것
            왜 안 되는가       할 수 없다면 그 사유

        쓴 자리와 전체 자리도 함께 실린다 — 얼마나 찼는지는 보는 쪽이 세어서 아는 것이
        아니라 세계가 답하는 것이다.

        **판정은 세계가 한다.** 보는 쪽이 정의를 복제해 "이건 버릴 수 있나" 를 스스로
        계산하지 않는다. 그렇게 하는 순간 화면이 허락하는 것과 세계가 허락하는 것이
        갈린다 — 표시용 판정과 실행 판정은 같은 것이어야 한다.

    ── 덜어낸다 ───────────────────────────────────────────────────────

    INTENT-LET-GO-001 (ADDED)

        몸은 지닌 것을 **덜어낼 수 있다.** 덜어낸 만큼 수량이 줄고, 자리에 아무것도
        남지 않으면 그 자리가 빈다.

        이것이 이 세계에서 **가진 것이 사라지는 첫 경로**다. 지금까지는 늘어나는 길만
        있었다.

        덜어낸 것은 **없어진다.** 세계 어딘가에 놓이지 않는다 — 위치를 가진 물건이라는
        개념이 아직 이 세계에 없기 때문이다. 그 개념이 오면 같은 행동의 **도착지**가
        바뀔 뿐, 덜어낸다는 행동 자체는 그대로 선다.

        덜어내기도 전부이거나 전무다. 요청한 수량만큼 줄거나, 하나도 줄지 않고 사유가
        온다. 실패한 요청은 지닌 것에도 자리에도 흔적을 남기지 않는다.

    INTENT-NO-DEAD-END-001 (ADDED)

        몸은 **스스로 되돌릴 수 없는 막힘**을 만들 수 없다.

        지금 이 세계에서 그런 물건은 하나다 — 캐는 용도를 지닌 도구. 그것을 잃으면
        캘 수 없고, 캘 수 없으면 다시 얻을 길이 없다.

        그러므로 어떤 물건을 덜어내는 것이 **지금 열려 있는 길을 영영 닫는다면** 그
        요청은 거절되고, 왜 거절되었는지가 온다. 조용히 막히는 것이 아니라 막힐 것이기
        때문에 거절되는 것이다.

        이 Intent 는 "도구는 버릴 수 없다" 가 아니다. 같은 용도를 여는 다른 물건이
        생기거나 다시 얻을 길이 생기면 그때는 덜어낼 수 있다 — 판정은 물건의 종류가
        아니라 **그것이 마지막인가**를 본다.

## DESIGN TRACE

    INTENT-ITEM-CATALOG-001
        Source Goal         GOAL-THE-WORLD-KNOWS-WHAT-A-THING-IS
        Source Possibility  POSSIBILITY-A-KIND-IS-A-KEY-NOT-A-BRANCH
        Master              IS §5.1 (정의 층) — Capability 가 아니라 넷의 바닥
        Constraint          DC-ITEM-KIND-IS-DATA-NOT-BRANCH ·
                            DC-GROWTH-DEFINITION-INSTANCE-SPLIT (정의만 · 개체 없음) ·
                            DC-WORLD-RESOURCE-ADAPTATION-TRACE (IT-* 로 유래를 답한다)

    INTENT-USE-COMES-FROM-DECLARATION-001 (CHANGED)
        Source Goal         GOAL-THE-WORLD-KNOWS-WHAT-A-THING-IS
        Source Possibility  POSSIBILITY-A-THING-DECLARES-ITS-USE
        Master              IS §3.3 — "mine 규칙이 이 몸에 채굴 용도가 지금 있는가를 묻는다"
        Constraint          DC-ITEM-CAPABILITY-COMES-FROM-GRANTS
        주의                답의 출처는 아직 소지다 — 적용은 장착 Cycle
                            (01 Constraint Note · DC-ITEM-HOLDING-IS-NOT-APPLYING)

    INTENT-CARRY-ROOM-001
        Source Goal         GOAL-CARRYING-TAKES-ROOM
        Source Possibility  POSSIBILITY-ROOM-IS-FINITE ·
                            POSSIBILITY-ALIKE-THINGS-SHARE-A-ROOM
        Master              IE §3.1 · §4 · §5 · §49 P2 — 유한함은 원칙, 수는 Cycle
        Constraint          DC-ITEM-CAPACITY-IS-FINITE

    INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001
        Source Goal         GOAL-A-FULL-HOLD-REFUSES
        Source Possibility  POSSIBILITY-ALL-OR-NOTHING ·
                            POSSIBILITY-THE-WORLD-KEEPS-WHAT-IT-COULD-NOT-GIVE
        Master              IE §6 · §6.1 · §43
        Constraint          DC-ITEM-CHANGE-IS-ONE-UNIT

    INTENT-MINING-001 (CHANGED)
        Source Goal         GOAL-A-FULL-HOLD-REFUSES
        Source Possibility  POSSIBILITY-THE-WORLD-KEEPS-WHAT-IT-COULD-NOT-GIVE
        Master              IE §43 "월드에 있던 아이템은 그대로 남아야 한다"
        Constraint          DC-ITEM-CHANGE-IS-ONE-UNIT · DC-WORLD-OWNS-THE-SURFACE-LIST

    INTENT-CARRIED-IS-OBSERVABLE-001
        Source Goal         GOAL-WHAT-YOU-CARRY-CAN-BE-SEEN
        Source Possibility  POSSIBILITY-ONE-CONTRACT-FOR-EVERY-KIND ·
                            POSSIBILITY-THE-WORLD-SAYS-WHY-NOT
        Master              IS §5.2 (소지 관찰) · IE §27 · §29
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST

    INTENT-LET-GO-001
        Source Goal         GOAL-WHAT-YOU-CARRY-CAN-BE-LET-GO
        Source Possibility  POSSIBILITY-LETTING-GO-MAKES-ROOM ·
                            POSSIBILITY-WHAT-IS-LET-GO-IS-GONE
        Master              IS §5.5 (소모 — "보유 수량을 감소시키는 기본 연산").
                            IS §5.6 · IE §34 의 버리기가 아니다 (01 SCOPE NOTE ③)
        Constraint          DC-ITEM-CHANGE-IS-ONE-UNIT

    INTENT-NO-DEAD-END-001
        Source Goal         GOAL-NO-ONE-CAN-LOCK-THEMSELVES-OUT
        Source Possibility  POSSIBILITY-THE-LAST-WAY-CANNOT-BE-DISCARDED
        Master              없음 — 상위 문서가 공급하지 않는다. 01 SCOPE NOTE ⑤ 가
                            코드 대조로 드러낸 것이며(곡괭이를 얻는 경로가 0건),
                            Frontier 의 Playable Result 가 성립하기 위한 조건이다
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST (거절에 사유가 붙는다)

## EXISTING INTENT DELTA

    REUSED
        INTENT-ACTION-STATE-001            모든 존재는 언제나 하나의 행동 안에 있다
        INTENT-ACTION-PROGRESS-001         진행도가 관찰에 실린다 — 채굴이 그 위에 선다
        INTENT-ACTION-EXCLUSIVE-001        진행 중 다른 행동을 못 내는 관문
        INTENT-TARGET-DIRECTS-THE-ACT-001  고른 것이 채굴의 대상을 정한다 (C017).
                                           덜어내기는 세계의 존재를 대상으로 하지 않으므로
                                           이 관계를 쓰지 않는다

    CHANGED
        INTENT-MINING-001
            기존   채굴이 완료되면 광맥이 줄고 지닌 것이 는다 — 언제나
            변경   받을 자리가 없으면 둘 다 일어나지 않고 사유가 온다
        INTENT-USE-COMES-FROM-DECLARATION-001
            기존   채굴 가부를 "지닌 것 중에 곡괭이가 있는가" 로 묻는다 (C001)
            변경   "이 몸에 캐는 용도가 지금 있는가" 로 묻는다. 용도는 정의가 선언한다

    AFFECTED
        INTENT-MINING-001 의 관찰            무변경. 캘 수 없는 사유 목록에 "자리 없음" 이
                                           나란히 선다 — 사유 계약 자체는 그대로다
        INTENT-ACTION-EXCLUSIVE-001        무변경. 덜어내기가 시간을 요구하는 행동인지
                                           즉시 요청인지는 세계 규칙이 정한다
