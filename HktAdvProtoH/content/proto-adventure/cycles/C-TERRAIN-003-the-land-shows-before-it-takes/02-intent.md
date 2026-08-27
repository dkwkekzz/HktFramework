# C-TERRAIN-003 — Intent

> **지금 이 세계는 불공정하다.** 안전한 자리가 옮겨 다니는데 그 움직임을 앞질러 읽을
> 방법이 없다. 관찰에 실리는 것은 전부 *지금*이고, 앞으로 무엇이 일어날지는 겪어야만 안다.
> C-TERRAIN-002 가 스스로 그 부채를 적어 두었고 이 Cycle 이 그것을 갚는다.
>
> BT §5.2 가 형태를 순서까지 준다 — "멀쩡히 걷던 생물이 한순간 얼어붙는다 ← 빙하 아래
> 검은 광맥이 밝아진다." 지금 세계에는 **둘 다 없다.** 거두는 속도가 상수라 "한순간" 이
> 없고, 그러므로 밝아질 것도 없다. 이 둘은 한 몸이다: 급습 없는 예고는 "곧 위험" 타이머고,
> 예고 없는 급습은 그냥 불운이다.
>
> 이번에 더해지는 것은 **앞**이다. 땅이 지금까지 보여 준 것은 지금뿐이었고, 이제
> 아직 일어나지 않은 것을 보여 준다. 그리고 그 순간 이 세계에 처음으로
> **"미리 알았는가" 가 결과를 가르는 자리**가 생긴다 — 같은 길을 같은 속도로 걸어도
> 무늬를 읽은 사람과 읽지 못한 사람의 몸이 달라진다.
>
> 세계가 무엇을 하라고 말하지는 않는다. 조짐은 사실이지 지시가 아니며, 같은 무늬를
> 보고 나가는 것도, 지나간 뒤 들어가는 것도, 열이 넉넉하면 버티고 분출을 받는 것도
> 성립한다 (BT §15.9 — "그 증거를 이해하면 어떤 서로 다른 행동이 가능해지는가").

## GOAL / POSSIBILITY

    GOAL-THE-LAND-HAS-A-BEFORE                   땅에 앞이 있다
        └── POSSIBILITY-THE-LAW-IS-NOT-EVEN      법칙이 고르게 작용하지 않는다 —
                                                 한순간에 크게 거두는 때가 있다
        └── POSSIBILITY-THE-COMING-LEAVES-A-MARK 오는 것이 오기 전에 자국을 남긴다
        └── POSSIBILITY-THE-MARK-IS-IN-THE-WORLD 자국은 세계에 있다 — 화면의 친절이 아니다

    GOAL-KNOWING-BEFOREHAND-CHANGES-THE-OUTCOME  미리 아는 것이 결과를 바꾼다
        └── POSSIBILITY-THERE-IS-TIME-TO-MOVE    자국과 작용 사이에 걸어 나갈 시간이 있다
        └── POSSIBILITY-THE-SAME-MARK-ALLOWS-MANY 같은 자국에서 여러 대응이 성립한다 —
                                                 세계는 어느 하나를 권하지 않는다
        └── POSSIBILITY-THE-UNREAD-STILL-PLAY    읽지 못해도 게임은 끝나지 않는다.
                                                 값을 치를 뿐이다

    GOAL-WHAT-IS-COMING-IS-READ                  다가오는 것이 읽힌다
        └── POSSIBILITY-THE-MARK-DEEPENS         가까워질수록 자국이 짙어진다 —
                                                 있다/없다가 아니라 얼마나 다가왔는가
        └── POSSIBILITY-THE-SURFACE-STILL-JUDGES-NOTHING
                                                 화면은 언제 오는지를 계산하지 않는다.
                                                 세계가 답한 것을 그린다

## INTENT SET

    ── 법칙이 고르지 않다 ──────────────────────────────────────────────

    INTENT-THE-LAW-TAKES-IN-BURSTS-001 (ADDED)

        법칙은 늘 같은 속도로 거두지 않는다. 자리가 **넘침에 가까워지면** 한순간에 큰
        양을 거둔다. 그 뒤 자리는 다시 고른 속도로 돌아간다.

        BT §5.2 가 그 조건을 적는다 — "광맥은 일정한 속도로 흡수하지 않는다. 굵기와
        **포화 상태**와 지하 흐름에 따라 어느 순간 주변의 열을 한꺼번에 빼앗는다."
        셋 중 포화 상태는 이 세계에 이미 있다 (C-TERRAIN-002 의 `kept`). 나머지 둘은
        아직 없으므로 **있는 것 하나로 조건을 세운다** — 지어내지 않는다.

        이것이 예고의 재료다. 거두는 속도가 상수인 동안에는 예고할 것이 없어
        어떤 예고도 "곧 위험" 타이머가 된다.

    INTENT-THE-BURST-IS-STILL-THE-SAME-LAW-001 (ADDED)

        급습은 새로운 법칙이 아니라 **같은 법칙이 한 번에 많이 하는 것**이다. 거두어 간
        것은 그대로 그 자리에 쌓이고(보존), 그래서 급습은 넘침을 앞당긴다 — 분출이
        더 빨리 온다. 뿜는 자리는 급습하지 않는다: 그 자리에서 법칙이 멎어 있기 때문이다.

        그러므로 급습은 이 세계에 **새 값을 하나도 더하지 않는다.** 거두는 것도 열이고,
        가는 곳도 그 자리이고, 결과도 이미 있는 넘침이다.

    ── 오는 것이 자국을 남긴다 ─────────────────────────────────────────

    INTENT-WHAT-IS-COMING-LEAVES-A-MARK-001 (ADDED)

        급습이 오기 전에 그 자리에 **자국**이 드러난다. 자국은 세계의 상태이지 화면이
        만든 안내가 아니다 — 아무도 보고 있지 않아도 거기 있고, 관찰에 실린다.

        BT §5.4 가 그 자국들을 적어 두었다 — 얼음 아래에서 타오르는 검은 빛(광맥이 열을
        결속하고 있다) · 원형으로 퍼지는 서리 무늬(주변 열이 광맥 중심으로 이동한 흔적).
        **둘 다 "지금 이 자리가 열을 세게 끌어당기는 중" 의 흔적**이며, 그것이 곧
        급습의 조건이다. 무엇으로 그릴지는 화면이 정한다.

    INTENT-THERE-IS-TIME-TO-READ-AND-MOVE-001 (ADDED)

        자국과 급습 사이에 **읽고 움직일 수 있는 만큼**의 시간이 있다. 기준은 하나다 —
        걷는 속도로 그 자리를 벗어날 수 있어야 한다. 벗어날 수 없는 예고는 예고가 아니라
        통보이며, 그것은 지금(예고가 없는 세계)보다 나을 것이 없다.

        시간이 **얼마인지는 관찰에 실리지 않는다.** 실리는 것은 얼마나 다가왔는가이며,
        그것을 초로 환산하는 것은 이 세계가 답할 이유가 없는 물음이다 —
        사람은 무늬가 짙어지는 것을 보고 판단한다.

    INTENT-THE-MARK-DEEPENS-AS-IT-NEARS-001 (ADDED)

        자국은 있다/없다가 아니라 **얼마나 다가왔는가**다. 드러난 직후와 곧 올 때가
        구분되지 않으면 "읽고 움직일 시간이 있다" 가 플레이에서 성립하지 않는다 —
        보자마자 뛰거나 보고도 모르거나 둘뿐이 된다.

    ── 읽은 사람과 읽지 못한 사람 ──────────────────────────────────────

    INTENT-READING-IT-CHANGES-WHAT-HAPPENS-001 (ADDED)

        자국을 읽고 그 자리를 벗어난 몸은 급습을 겪지 않는다. 읽지 못한 몸은 겪는다.
        **같은 길을 같은 속도로 걸어도 결과가 달라지는 첫 자리다.**

        읽지 못한 것이 게임을 끝내지는 않는다 — 값을 치를 뿐이고, 그 값은 몸이 지닌
        열에서 나간다 (다하면 이미 있는 길로 간다 · INTENT-DOWNED-001).
        벌이 아니라 **대가**이며, 그래서 읽는 것이 실력이 된다
        (DC-COMBAT-PLAYER-CAUSALITY 의 규율이 땅에도 선다).

    INTENT-THE-SAME-MARK-ALLOWS-DIFFERENT-ANSWERS-001 (ADDED)

        같은 자국에서 여러 대응이 성립하고 세계는 어느 하나를 권하지 않는다.

            나간다              값을 치르지 않는다. 대신 그 자리가 차오르는 것을 놓친다
            지나간 뒤 들어간다   급습 뒤의 자리는 곧 넘쳐 분출한다 — 기다린 사람이 그것을 받는다
            버틴다              열이 넉넉하면 급습을 맞고 그 자리가 여는 분출을 그 자리에서 받는다

        셋째가 성립하는 것이 이 Cycle 의 값어치다 — 예고가 "피하라" 는 지시가 아니라
        **판단의 재료**가 된다 (BT §15.9 · DC-WORLD-PLAYER-UNFIXED-PATH 의 결).

    ── 자국이 읽힌다 ───────────────────────────────────────────────────

    INTENT-THE-MARK-IS-OBSERVED-001 (ADDED)

        자리마다 지금 자국이 있는지와 얼마나 다가왔는지가 관찰된다.

        화면은 **언제 오는지를 계산하지 않는다.** 문턱도, 앞선 시간도, 급습이 거두는
        양도 관찰에 실리지 않는다 — 실리면 화면이 "3초 뒤" 를 그릴 수 있게 되고,
        그 순간 판정이 세계와 화면 두 곳에 산다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
        세계가 이미 나눈 값 하나를 준다.

## DESIGN TRACE

    INTENT-THE-LAW-TAKES-IN-BURSTS-001
        Source Goal         GOAL-THE-LAND-HAS-A-BEFORE
        Source Possibility  POSSIBILITY-THE-LAW-IS-NOT-EVEN
        Master              MP-LEARN-TO-HANDLE-THE-LAYER (BT §5.2)
        제약                DC-WORLD-TERRAIN-IS-A-PRINCIPLE — 조건과 결과가 여전히 정의다
        선례                C-TERRAIN-001 04 excluded 가 이 미룸을 명시했다

    INTENT-THE-BURST-IS-STILL-THE-SAME-LAW-001
        Source Goal         GOAL-THE-LAND-HAS-A-BEFORE
        Source Possibility  POSSIBILITY-THE-LAW-IS-NOT-EVEN
        선례                INTENT-THE-LAND-KEEPS-WHAT-IT-TAKES-001 (C-TERRAIN-002) —
                            거둔 것은 사라지지 않는다. 급습도 예외가 아니다

    INTENT-WHAT-IS-COMING-LEAVES-A-MARK-001
        Source Goal         GOAL-THE-LAND-HAS-A-BEFORE
        Source Possibility  POSSIBILITY-THE-COMING-LEAVES-A-MARK ·
                            POSSIBILITY-THE-MARK-IS-IN-THE-WORLD
        Master              **MW-CIRCULATION-EVIDENCE 를 연다** (BT §15.8 · §5.4)
        제약                DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE — **`증거가 먼저` 절이
                            여기서 닫힌다** (두 Cycle 을 UNRESOLVED 로 지나왔다)

    INTENT-THERE-IS-TIME-TO-READ-AND-MOVE-001
        Source Goal         GOAL-KNOWING-BEFOREHAND-CHANGES-THE-OUTCOME
        Source Possibility  POSSIBILITY-THERE-IS-TIME-TO-MOVE

    INTENT-THE-MARK-DEEPENS-AS-IT-NEARS-001
        Source Goal         GOAL-WHAT-IS-COMING-IS-READ
        Source Possibility  POSSIBILITY-THE-MARK-DEEPENS
        선례                C019 SWING_BEGIN 의 `progress` — 아직 일어나지 않은 것의
                            진행도가 관찰에 실리는 형태가 이미 세계에 있다

    INTENT-READING-IT-CHANGES-WHAT-HAPPENS-001
        Source Goal         GOAL-KNOWING-BEFOREHAND-CHANGES-THE-OUTCOME
        Source Possibility  POSSIBILITY-THE-UNREAD-STILL-PLAY
        Master              **MW-SURVIVAL-PRESSURE 의 world_shape 를 닫는다** —
                            "법칙을 읽은 사람과 읽지 못한 사람이 같은 자리에서 다른
                            결과를 낸다"
        제약                DC-COMBAT-PLAYER-CAUSALITY

    INTENT-THE-SAME-MARK-ALLOWS-DIFFERENT-ANSWERS-001
        Source Goal         GOAL-KNOWING-BEFOREHAND-CHANGES-THE-OUTCOME
        Source Possibility  POSSIBILITY-THE-SAME-MARK-ALLOWS-MANY
        Master              BT §15.9 (행동 열하나 중 피한다 · 기다린다 · 감당한다)

    INTENT-THE-MARK-IS-OBSERVED-001
        Source Goal         GOAL-WHAT-IS-COMING-IS-READ
        Source Possibility  POSSIBILITY-THE-SURFACE-STILL-JUDGES-NOTHING
        제약                DC-WORLD-OWNS-THE-SURFACE-LIST

## EXISTING INTENT DELTA

    CHANGED — 뜻이 바뀐다

        INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 (C-TERRAIN-001)
            **"머무는 시간에 비례해" 가 좁아진다.** 고른 구간에서는 그대로 참이고,
            자리가 넘침에 가까울 때는 한순간에 크게 거둔다. 스쳐 지나는 것과 버티는 것이
            다르다는 요점은 그대로다 — 오히려 세진다: 잘못된 때에 스쳐도 값을 치른다.

    REUSED — 한 글자도 바꾸지 않는다

        INTENT-GROUND-IS-DIVIDED-INTO-PLACES-001        자리는 범위다
        INTENT-GROUND-LAW-IS-CONDITION-AND-RESULT-001   법칙은 정의다 — 급습의 값도 그리로
        INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001      급습도 누구인지 묻지 않는다
        INTENT-THE-LAND-KEEPS-WHAT-IT-TAKES-001         급습이 거둔 것도 그 자리에 쌓인다
        INTENT-ONE-PLACE-RECEIVES-WHAT-IS-TAKEN-001     받는 자리는 여전히 하나다
        INTENT-A-FULL-PLACE-VENTS-001 외 순환 전부       급습은 넘침을 앞당길 뿐이다
        INTENT-THE-RECORD-IS-IN-THE-LAND-NOT-THE-BODY-001
                                                        조짐도 땅이 지닌다. 몸에는 여전히
                                                        아무것도 적히지 않는다
        INTENT-STANDING-IS-THE-WHOLE-INPUT-001          새 행동을 만들지 않는다 —
                                                        읽고 걸어 나가는 것이 전부다
        INTENT-DOWNED-001 · INTENT-MOVE-001 · INTENT-WORLD-CLOCK-001
        전투 · 소지품 · 장비 · 성장 계통 전부             한 글자도 닿지 않는다

    AFFECTED — 뜻은 그대로이나 결과가 달라진다

        INTENT-DOWNED-001   급습으로 열이 다하면 끝에 이르는 몸이 는다. 끝의 형태는
                            한 글자도 바뀌지 않는다
        INTENT-A-FULL-PLACE-VENTS-001
                            넘침이 더 빨리 온다 — 급습이 한 번에 크게 넣기 때문이다.
                            분출의 주기가 짧아지고 예외 자리가 더 자주 옮겨 다닌다

## REVIEW QUESTION

    Stage 5 에서 Human 이 답할 것 셋이다.

    1. **급습을 이 Cycle 이 함께 세우는가.**

       Frontier 는 "증거가 먼저 드러난다" 까지만 적었지 거두는 속도를 바꾼다고는
       적지 않았다. 급습 없이 예고만 세울 수도 있다 — 그때 예고할 대상은 **분출의
       열림과 닫힘**이 된다 ("이 자리가 곧 열린다 / 곧 닫힌다").

       Agent 의 판단은 **함께 세운다** 다. 근거 둘. ① C-TERRAIN-001 이 이 미룸을 명시했다
       ("갑작스러운 흡수는 예고와 한 몸이라 다음 후보가 함께 받는다"). ② 급습이 없으면
       Frontier 의 Playable Result("거두어 가는 순간을 겪지 않는다")에서 **겪지 않을
       순간이 없다** — 상수 유출은 걸어 나가면 그만이라 읽을 이유가 서지 않는다.

       **비용**: 이 Cycle 이 예고 하나가 아니라 둘(급습 + 예고)이 된다.
       Human 이 "예고만" 으로 판단하면 **02 로 돌아온다.**

    2. **급습을 맞고 버티는 것이 이득일 수 있어도 되는가.**

       급습이 넘침을 앞당기므로, 열이 넉넉한 몸은 **일부러 맞고** 그 자리가 여는 분출을
       그 자리에서 받을 수 있다. 낸 만큼 도로 받으므로 큰 이득은 아니지만, 분출구를
       **자기가 원할 때 열 수 있다**는 뜻이 된다.

       Agent 의 판단은 **된다** 다 — 그것이 "같은 증거에서 서로 다른 대응이 성립한다"
       (Frontier 의 세계에 생기는 것 ③)의 실물이고, 예고를 지시가 아니라 재료로 만든다.
       달리 판단하면 급습이 kept 에 넣지 않게 해야 하고, 그러면 보존이 깨진다.

    3. **자국이 자리 전체에 드러나는가, 자리 안의 한 점에 드러나는가.**

       BT §5.4 의 "원형으로 퍼지는 서리 무늬" 는 중심이 있는 무늬다. 자리 전체가 물드는
       것과 중심에서 퍼지는 것은 다른 그림이고, 뒤엣것이면 **자리 안에서도 어디에
       서 있는가가 다시 갈린다.**

       Agent 의 판단은 **자리 전체** 다. 자리 안의 위치가 다시 갈리면 그것은 자리를
       더 잘게 나눈 것이고 (지금 맥이 넷인 것과 같은 층의 이야기), 이 Cycle 이 세우는
       "앞" 과 섞인다. 중심에서 퍼지는 그림은 **화면이 그렇게 그릴 수 있다** —
       세계가 자리 하나에 하나의 진행도를 주면 화면이 그것을 원으로 퍼뜨리면 된다.
