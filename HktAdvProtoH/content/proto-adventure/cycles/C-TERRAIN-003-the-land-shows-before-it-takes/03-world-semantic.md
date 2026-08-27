# C-TERRAIN-003 — World Semantic

> 이 Cycle 이 세우는 것은 둘이고 한 몸이다 — **한순간에 크게 거두는 일**과
> **그것이 오기 전에 드러나는 자국**. 새 State 는 자리 안의 값 하나(조짐)와 법칙 정의의
> 항 셋(문턱 · 앞선 시간 · 거두는 양)뿐이며, 규칙은 하나가 는다. 몸에는 아무것도 늘지 않는다.

## SEMANTIC DELTA

    REUSED — 한 줄도 바꾸지 않는다

        GroundZone.id · law · center · radius · kept · phase   world/semantic/terrain.ts
        GroundLawDefinition.takes · rate · lifeRate · saturation · ventRate · escapeRate
        bindingZonesAt · isSheltered · ventingZonesAt · groundZoneFill · isInsideGroundZone
        RULE-GROUND-LAW-APPLY-001    **한 줄도 바뀌지 않는다** — 고른 거둠은 그대로다.
                                     급습은 그 위에 서는 다른 규칙이다
        RULE-GROUND-VENT-001         **한 줄도 바뀌지 않는다** — 급습이 kept 를 올리면
                                     이 규칙이 이미 아는 방식으로 넘침을 본다
        ActorState.warmth · warmthMax   몸에는 한 항목도 늘지 않는다
        RULE-DOWNED-001

    ADDED

        GroundZone.omen                  급습까지 남은 시간(초). **0 이면 조짐이 없다**
        GroundLawDefinition.surgeAt      이 비율(kept/saturation)을 넘으면 조짐이 드러난다
        GroundLawDefinition.omenLead     조짐이 드러난 뒤 급습까지의 시간(초)
        GroundLawDefinition.surgeTake    급습이 한 몸에서 한 번에 거두는 양
        RULE-GROUND-OMEN-001             조짐의 진행과 급습

    CHANGED

        STATE_VERSION   `proto-adventure/3` → `proto-adventure/4`
            GroundZone 에 `omen` 이 는다. 올리지 않으면 옛 스냅샷이 복구되어 조짐 없는
            자리 위에서 새 규칙이 돌고, `omen` 이 undefined 라 산술이 NaN 으로 번진다

        GROUND_ZONES 초기 배치
            네 맥에 `omen: 0` 이 는다 — 세계는 조짐 없이 시작하고, 차오르면 드러난다

    AFFECTED

        RULE-GROUND-VENT-001        넘침이 더 빨리 온다 (급습이 한 번에 크게 넣는다).
                                    분출 주기가 짧아지고 예외 자리가 더 자주 옮겨 다닌다
        RULE-DOWNED-001             급습으로 열이 다한 뒤 고른 거둠이 생명에 닿는 몸이 는다.
                                    규칙은 한 줄도 안 바뀐다
        projectGround*              자리와 내 몸에 조짐이 실린다 (아래 OBSERVABLE)
        world/tests/terrain.spec.ts · view/tests/terrain.spec.ts   회귀 기반

## WORLD STATE

    GroundZone                                                   World Authority
        … (C-TERRAIN-002 의 여섯 항목 그대로)
        omen         number   급습까지 남은 시간(초). **0 이면 조짐이 없다**   (ADDED)

        **조짐은 땅이 지닌다.** 몸이 "언제 얼어붙는가" 를 지니면 그것을 지우는 규칙이
        필요해지고 그 규칙이 빠지는 자리가 생긴다 (DC-CONDITION-OPENS-WITHOUT-RECORDING).
        땅이 지니면 그 자리를 떠난 몸은 그냥 겪지 않는다 — 지우는 규칙이 없다.

        **0 을 "없음" 으로 쓰는 것이 요점이다.** 별도의 flag 를 두면 "조짐이 있다고
        적혀 있는데 시간이 0" 인 상태를 적을 수 있게 되고, 그것은 규칙이 두 자리에서
        같은 것을 말하는 형태다.

    GroundLawDefinition                                          World 성질 (State 아님)
        … (C-TERRAIN-002 의 일곱 항목 그대로)
        surgeAt      number   조짐이 드러나는 비율                              (ADDED)
        omenLead     number   조짐 → 급습 사이의 시간(초)                       (ADDED)
        surgeTake    number   급습이 한 몸에서 한 번에 거두는 양                 (ADDED)

        셋 다 **법칙이 지닌다.** 자리마다 손으로 정하면 "이 자리는 조짐이 길다" 를 적을
        수 있게 되고, 그것은 놓인 예외가 또 다른 이름으로 돌아온 것이다.

## WORLD RULE

    RULE-GROUND-OMEN-001 (ADDED)

        Implements     INTENT-THE-LAW-TAKES-IN-BURSTS-001 ·
                       INTENT-THE-BURST-IS-STILL-THE-SAME-LAW-001 ·
                       INTENT-WHAT-IS-COMING-LEAVES-A-MARK-001 ·
                       INTENT-THERE-IS-TIME-TO-READ-AND-MOVE-001 ·
                       INTENT-THE-MARK-DEEPENS-AS-IT-NEARS-001 ·
                       INTENT-READING-IT-CHANGES-WHAT-HAPPENS-001 ·
                       INTENT-THE-SAME-MARK-ALLOWS-DIFFERENT-ANSWERS-001
        Input          모든 GroundZone, 모든 Actor, dt
        Preconditions  없음 — 모든 자리를 훑는다
        Transition     자리마다 (groundZones 순서로):

                       ① omen > 0 이면 (조짐이 드러나 있다)
                              omen −= dt
                              omen ≤ 0 이면 → **급습**
                                  omen = 0
                                  그 자리 안의 **쓰러지지 않은** 몸마다 (actors 순서로)
                                      taken = min(Actor.warmth, Law.surgeTake)
                                      Actor.warmth −= taken
                                      kept = min(Law.saturation, kept + taken)
                              (다음 Tick 에 ②가 다시 조짐을 세운다)

                       ② omen = 0 이고
                          phase = 'binding' 이고
                          kept / Law.saturation ≥ Law.surgeAt 이면
                              omen = Law.omenLead            (조짐이 드러난다)

                       ③ 그 밖 (phase = 'venting' 이거나 비율이 문턱 아래)
                              omen = 0                        (조짐이 걷힌다)
        Result         Omened(zone) | Nearing(zone, left) | Surged(zone, taken) | Quiet(zone)

        Tick 순서      RULE-GROUND-LAW-APPLY-001 **뒤**, RULE-GROUND-VENT-001 **앞**.
                       앞에 두는 이유 — 이 Tick 의 고른 거둠이 kept 를 올린 뒤라야 문턱을
                       정확히 본다. 뒤에 두는 이유 — 급습이 넘침을 만들면 **같은 Tick 에**
                       분출이 시작되어야 한다. "얼어붙는다 → 그 자리가 열린다" 사이에
                       한 Tick 의 틈이 없다.

## OBSERVABLE SEMANTIC

    자리마다 (모든 관찰자에게 같다)

        … (C-TERRAIN-002 의 law · phase · fill · center · radius 그대로)
        조짐의 진행도    0..1 — 0 은 막 드러난 것, 1 은 곧 온다. 조짐이 없으면 **없음**  (ADDED)

        **남은 초를 싣지 않고 진행도를 싣는다.** 초를 실으면 화면이 "3.2초 뒤" 를 그릴 수
        있고, 그것은 세계가 답할 이유가 없는 물음이다 — 사람은 무늬가 짙어지는 것을 보고
        판단한다 (INTENT-THERE-IS-TIME-TO-READ-AND-MOVE-001).
        그리고 `omenLead` 가 계약에 없으므로 화면은 초로 환산할 수도 없다.

    이 몸에게

        … (C-TERRAIN-002 의 law · state · takes 그대로 — **state 에 새 값이 없다**)
        내가 선 자리의 조짐 진행도  0..1. 조짐이 없으면 없음                        (ADDED)

        **`state` 를 늘리지 않은 것이 판단이다.** 조짐은 자리의 성질이지 내 몸에
        걸린 것이 아니다 — 나는 여전히 `taking` 이고, 다만 내가 선 자리에 무언가 오는
        중이다. `state` 에 `warned` 를 더하면 "거두어지는 중이면서 경고받은 중" 을
        한 값으로 눌러야 하고 둘 중 하나가 지워진다.

    실패 사유가 필요한 자리는 없다
        이 Cycle 도 Action 을 하나도 더하지 않는다 — 입력은 걸어 들어가고 나오는 것뿐이다.

## BALANCE

    1. heat-binding 의 새 값

        surgeAt     0.70   60 중 42 가 차면 조짐이 드러난다. 시작 배치의 zone-vein-4 는
                           30(0.50)이므로 **3초를 머물면** 문턱에 닿는다 — 가로지르는
                           1.7초로는 닿지 않는다. 머무는 것과 지나는 것의 갈림이
                           C-TERRAIN-002 와 같은 자리에 선다
        omenLead    3.5    걷는 속도 6.0 으로 21 을 간다. 맥의 반경이 5.0 이므로 어디에
                           서 있든 벗어나기에 넉넉하다 (가장 먼 자리에서 1.7초).
                           **벗어날 수 없는 예고는 예고가 아니라 통보다** —
                           넉넉한 쪽으로 잡는 것이 이 값의 규율이다
        surgeTake    25    가득한 몸의 4분의 1. 한 번은 아프고 두 번은 위험하다.
                           고른 거둠 4.0/초로는 6.25초에 해당하는 양을 한순간에 가져간다 —
                           "한순간에 얼어붙는다" 가 값으로도 참이어야 한다 (BT §5.2)

    2. 첫 판에 무엇이 일어나는가

        zone-vein-4(kept 30)에 서서 아무것도 하지 않으면:

            0.0초   빙원 · 찬 50%          거두어 가는 중 (온기 100)
            3.0초   찬 70% · **조짐**       문턱에 닿아 자국이 드러난다 (온기 88)
            6.5초   **급습 −25**            온기 88 → 14 를 더 잃고 25 를 한 번에 (온기 49)
                                            kept 42 + 14 + 25 → 60 에서 잘린다 → **분출**
            6.5초~  해숨구멍 · 돌려받는 중   그 자리가 열리고 열이 돌아온다

        조짐을 보고 3.5초 안에 걸어 나가면 급습 25 를 겪지 않는다. 대신 그 자리는
        넘치지 않아 **분출도 열리지 않는다** — 이것이 REVIEW QUESTION 2 가 묻는 대가다.

    3. 아무도 없는 자리의 조짐

        급습은 그 자리 안의 몸에서만 거두므로, 아무도 없으면 아무 일도 일어나지 않고
        kept 도 오르지 않는다. 그래서 비율이 문턱 위에 머무는 자리는 조짐을 세우고
        헛되이 터뜨리기를 되풀이한다. **버그가 아니라 그 자리가 굶주려 있다는 뜻**이며,
        BT §5.4 의 "얼음 아래에서 타오르는 검은 빛(광맥이 열을 결속하고 있다)" 이
        그 상태의 풍경이다. 사람이 들어오면 그때 거둔다.

    4. 기존 플레이는 한 걸음도 달라지지 않는다

        빙원 밖에는 자리가 없으므로 조짐도 급습도 없다. 시작 자리 · 광맥 · 순회 경로는
        C-TERRAIN-002 와 같은 이유로 닿지 않는다.

## RATIONALE

    1. 왜 급습은 생명에 닿지 않는가

       열이 0 인 몸에게 급습은 아무것도 하지 못한다 (`min(warmth, surgeTake)` 가 0 이다).
       생명에 닿는 일은 고른 거둠(RULE-GROUND-LAW-APPLY-001)이 이미 맡고 있으며,
       급습이 같은 일을 또 하면 "한순간에 죽는다" 가 되어 **읽을 시간이 있다는 규율이
       무너진다** — 조짐을 놓친 대가가 즉사면 그것은 대가가 아니라 벌이다.

    2. 왜 `omen` 이 남은 **시간**이고 진행도가 아닌가

       세계는 초로 세고, 관찰에는 비율로 나간다. 반대로 두면(세계가 0..1 을 지니면)
       `omenLead` 를 곱해 되돌리는 자리가 규칙 안에 생기고, 법칙마다 다른 앞선 시간을
       가질 때 그 곱셈이 규칙 코드에 박힌다. 지금 형태에서는 법칙이 늘어도 규칙이
       열리지 않는다 (GROUND_LAWS 에 줄이 하나 늘 뿐).

    3. 왜 급습 뒤 곧바로 조짐이 다시 서는가

       급습이 kept 를 올렸으므로 비율은 대개 더 높아졌고, 문턱 위라면 그 자리는 여전히
       굶주려 있다. 쉬는 구간을 두려면 상수가 하나 더 필요하고, 그 상수는 지금 답할
       근거가 없다 (BT 가 적지 않았다). **급습이 넘침을 만들면 phase 가 venting 이 되어
       ③이 조짐을 걷으므로, 실제 플레이에서 연속 급습은 아무도 없는 자리에서만 일어난다.**

    4. 왜 `state` 에 새 값을 두지 않는가

       위 OBSERVABLE 에 적었다 — 조짐은 자리의 성질이고 내 몸의 상태가 아니다.
       두 축을 한 값으로 누르면 하나가 지워진다.

## SEMANTIC CLOSURE

    "늘 같은 속도로 거두지 않는다"          → RULE-GROUND-OMEN-001 ① (급습)
    "넘침에 가까워지면"                     → ② 의 `kept / saturation ≥ surgeAt`
    "한순간에 큰 양을"                      → `surgeTake` 를 한 Tick 에
    "거둔 것은 그대로 그 자리에 쌓인다"      → ① 의 `kept = min(saturation, kept + taken)`
    "급습은 넘침을 앞당긴다"                → Tick 순서 (omen → vent) · RULE-GROUND-VENT-001 불변
    "뿜는 자리는 급습하지 않는다"            → ③ (phase ≠ binding → omen = 0)
    "오기 전에 자국이 드러난다"              → ② (omen = omenLead)
    "자국은 세계의 상태다"                  → GroundZone.omen (World Authority)
    "읽고 움직일 시간이 있다"                → `omenLead` 3.5 vs 벗어나는 데 최대 1.7초
    "가까워질수록 짙어진다"                  → ① 의 `omen −= dt` + 관찰의 진행도
    "읽은 몸은 겪지 않는다"                  → 급습이 **그 자리 안의** 몸만 본다.
                                            나간 몸에 대해서는 아무 규칙도 돌지 않는다
    "읽지 못해도 끝나지 않는다"              → RATIONALE 1 (급습은 생명에 닿지 않는다)
    "여러 대응이 성립한다"                   → BALANCE 2 (나간다 / 맞고 분출을 받는다)
    "조짐이 관찰된다"                       → OBSERVABLE (진행도 0..1)
    "화면은 언제 오는지 계산하지 않는다"      → surgeAt · omenLead · surgeTake 를 싣지 않는다

    닫히지 않은 문장 없음.
