# C025 — Intent

> 지금 이 세계에서 모든 기술은 **같은 궤적**을 그린다. 크게 거는 기술도 가볍게 치는
> 기술도 오라를 실은 기술도, 몸 앞 150° 를 같은 굵기로 같은 거리까지 훑는다. 그래서
> "무엇을 걸까" 는 얼마나 아픈가와 얼마를 치르는가의 문제일 뿐, **어디에 서 있는가와는
> 아무 상관이 없다.** 상대가 정면 멀리 있든 옆에 붙어 있든 답이 같기 때문이다.
> 이번에 더해지는 것은 새 기술도 새 계산도 새 전달 방식도 아니라 **공간의 의미** 하나다 —
> 기술에는 닿는 모양이 있고, 그 모양은 규칙이 아는 것이 아니라 **그 기술이 지닌 값**이다.
> 그 하나가 서면 같은 자리에 선 상대가 기술에 따라 갈리고, 갈리는 만큼 "여기서는 무엇을
> 걸까" 가 처음으로 판단이 된다.

## GOAL / POSSIBILITY

    GOAL-A-SKILL-HAS-A-SHAPE             기술에는 닿는 모양이 있다
        └── POSSIBILITY-THE-SHAPE-BELONGS-TO-THE-SKILL
                                         모양은 기술이 지닌 성질이다 — 세계가 모든 기술에
                                         똑같이 물려주는 것이 아니다
        └── POSSIBILITY-REACH-IS-NOT-THE-BODY
                                         얼마나 멀리 닿는가는 그 기술의 것이지 그 몸이
                                         상대에게 얼마나 다가가는가와 같은 값이 아니다

    GOAL-THE-SHAPE-DECIDES-WHO-IS-TOUCHED   모양이 누가 닿는지를 정한다
        └── POSSIBILITY-NARROW-REACHES-FAR
                                         좁은 모양은 정면의 먼 것에 닿고 옆의 것을 놓친다
        └── POSSIBILITY-WIDE-SWEEPS-THE-SIDES
                                         넓은 모양은 옆까지 훑고, 그 결과로 여럿이 한
                                         휘두름에 닿는다
        └── POSSIBILITY-THE-SAME-SPOT-DIFFERS-BY-SKILL
                                         같은 자리에 선 상대가 어느 기술을 거느냐에 따라
                                         맞기도 하고 안 맞기도 한다

    GOAL-THE-RULE-DOES-NOT-KNOW-THE-NAME    판정이 기술의 이름을 묻지 않는다
        └── POSSIBILITY-THE-JUDGE-READS-THE-DEFINITION
                                         닿는 것을 고르는 판정은 그 기술의 정의가 답한
                                         모양을 읽는다 — 어느 기술인지를 묻지 않는다
        └── POSSIBILITY-A-DIFFERENT-SHAPE-IS-A-DIFFERENT-VALUE
                                         다르게 닿는 기술을 더하는 일은 값 한 벌을
                                         더하는 일이다. 판정은 그때 열리지 않는다

    GOAL-THE-SHAPE-CAN-BE-KNOWN-BEFORE      걸기 전에 모양을 안다
        └── POSSIBILITY-THE-WORLD-CARRIES-THE-SHAPE
                                         기술의 모양은 세계가 실어 보낸다 — 보는 쪽이
                                         기술 이름으로 자기 표를 만들지 않는다
        └── POSSIBILITY-THE-MISS-IS-AS-READABLE-AS-THE-HIT
                                         안 닿은 것도 사건이다. 왜 저 몸에는 닿고 이 몸에는
                                         닿지 않았는지를 되짚어 읽을 수 있다

    GOAL-THE-SHAPE-CHANGES-NOTHING-ELSE     모양은 다른 어떤 것도 바꾸지 않는다
        └── POSSIBILITY-EVERY-TOUCH-GOES-THROUGH-THE-SAME-ONE
                                         닿은 뒤에 일어나는 일은 지금과 완전히 같다.
                                         접촉 하나하나가 같은 한 공식을 지난다
        └── POSSIBILITY-MANY-IS-A-RESULT-NOT-A-RULE
                                         여럿에 닿는 것은 모양의 결과다. 여럿을 세는
                                         규칙도, 나눠 주는 감쇄도 생기지 않는다

## INTENT SET

    ── 기술의 공간 ────────────────────────────────────────────────────

    INTENT-SKILL-SHAPE-001 (ADDED)

        기술이 차지하는 공간에는 모양이 있다.

            훑는 넓이   그 휘두름이 몸이 향한 방향을 기준으로 얼마나 넓게 지나가는가
            끝의 굵기   지나가는 끝점이 얼마나 두꺼운 자리를 차지하는가
            닿는 길이   몸 중심에서 그 끝점까지가 얼마나 먼가

        모양은 이미 세계에 있다 — 이 Intent 가 더하는 것은 **그 모양이 기술마다 다르다**는
        것이다. 지금은 모든 기술이 같은 하나를 쓴다. 앞으로 모양은 그 기술이 지닌 성질이며,
        피해 · 기력 수지 · 구간 경계와 나란히 놓이는 값이다.

        축을 몇으로 나누고 각 축이 어떤 값을 갖는지는 세계 규칙이 정한다. 이 Intent 가
        요구하는 것은 **모양이 기술에 속한다**는 사실 하나다.

        방식만 다르고 나머지가 같은 기술은 모양도 같다. 오라를 실은 기술이 기본 기술과
        모든 값이 같은 것은 우연이 아니라 그 층이 만든 차이를 방식 하나로 좁히기 위한
        선택이며 (INTENT-AURA-SKILL-001), 모양은 새로 생기는 값이므로 그 선택이 그대로
        적용된다.

        이 모양은 **기술에만** 선다. 채굴 · 살펴봄처럼 끝점을 만들지 않는 행동은
        모양을 갖지 않는다.

    ── 모양이 닿음을 정한다 ────────────────────────────────────────────

    INTENT-SHAPE-DECIDES-CONTACT-001 (CHANGED — INTENT-ACTION-COLLIDER-001)

        휘두름이 만드는 끝점은 **그 기술의 모양**대로 선다. 세계가 모든 기술에 물려주는
        하나의 궤적이 아니다.

        그러므로 좁은 모양은 정면의 먼 것에 닿고 옆의 것을 놓치며, 넓은 모양은 옆까지
        훑는다. 같은 자리에 선 상대가 **어느 기술을 거느냐에 따라 갈린다** — 이것이
        이 Cycle 이 세계에 더하는 결과다.

        누가 대상인가(자신 · 이미 닿은 몸 · 쓰러진 몸을 뺀다)와 닿으면 무슨 일이
        일어나는가는 **한 글자도 달라지지 않는다.** 달라지는 것은 무엇이 닿는가뿐이다.

        모양이 훑는 구간은 그 기술의 판정 구간과 같다. 칼끝이 지나는 동안이 곧 효과가
        성립하는 구간이며 (INTENT-SKILL-PHASE-001), 이 Intent 는 그 정합을 바꾸지 않는다.

    ── 닿는 길이가 몸에서 갈린다 ────────────────────────────────────────

    INTENT-REACH-BELONGS-TO-THE-SKILL-001 (ADDED)

        얼마나 멀리 닿는가는 **그 기술의 것**이다. 지금은 그 몸의 교전 거리가 그대로
        기술의 닿는 길이가 된다 — 그래서 어떤 기술도 다른 기술보다 멀리 닿지 못한다.

        몸에게도 여전히 교전 거리가 있다. 그것은 **스스로 판단하는 존재가 얼마나
        다가가는가**의 값이며 (INTENT-NPC-AUTONOMY-001), 기술이 실제로 어디까지 닿는가와
        같은 값이어야 할 이유가 없다.

        둘이 갈리면 다가간 자리가 기술에 따라 충분하기도 하고 모자라기도 하다.
        **그 어긋남이 세계를 망가뜨려서는 안 된다** — 스스로 판단하는 존재가 영원히
        닿지 못하는 자리에서 헛되이 휘두르는 상태를 만들지 않는다. 무엇으로 그것을
        막는지는 세계 규칙이 정한다.

    ── 모양이 값이라는 것 ──────────────────────────────────────────────

    INTENT-SHAPE-IS-A-VALUE-NOT-A-BRANCH-001 (ADDED)

        닿는 것을 고르는 판정은 **어느 기술인지를 묻지 않는다.** 그 기술의 정의가
        답한 모양만 읽는다.

        그러므로 다르게 닿는 기술을 더하는 일은 정의 한 벌을 더하는 일로 끝난다.
        모양의 값을 바꾸는 일도 그 값을 바꾸는 일로 끝난다. 판정도, 그 판정을 아는
        규칙도, 보는 쪽도 열리지 않는다.

        이것은 편의가 아니라 이 Cycle 이 닫는 결손 자체다. 지금 모양이 규칙 안에 있어서
        "기술마다 다른 모양" 이라는 말이 세계에서 성립하지 않는다.

    ── 모양이 보인다 ──────────────────────────────────────────────────

    INTENT-SHAPE-IS-OBSERVABLE-001 (ADDED)

        기술의 모양은 **걸기 전에** 보는 쪽에게 실린다. 무엇이 넓고 무엇이 멀리 닿는지를
        걸어 보고 아는 것이 아니라 고르기 전에 안다.

        **그 값은 세계가 싣는다.** 보는 쪽이 기술 이름으로 자기 표를 만들어 부채꼴을
        그리지 않는다. 기술이 하나 늘거나 모양이 바뀌면 세계가 싣는 값이 바뀌고,
        보는 쪽은 그것을 그대로 읽는다.

        이 Intent 는 이미 서 있는 형태 위에 선다 — 위력 · 기력 수지 · 피해 방식 ·
        구간 경계가 이미 걸기 전에 실린다. 모양이 그 옆에 하나 는다.

    ── 안 닿은 것도 읽힌다 ─────────────────────────────────────────────

    INTENT-SHAPE-EXPLAINS-THE-CONTACT-001 (ADDED)

        같은 자리에 선 둘 중 하나만 맞았다면, **왜 갈렸는지**를 되짚어 읽을 수 있어야
        한다. 모양이 결과를 가르는 값이 된 이상, 그 값이 관찰에 없으면 결과가 설명되지
        않는다.

        모양은 결정적이다 — 같은 자리 · 같은 방향 · 같은 기술이면 언제나 같은 것들이
        닿는다. 난수가 들어가는 자리가 없다.

        이것은 이미 서 있는 관찰 위에 선다. 닿았으나 성립하지 않은 접촉이 사유와 함께
        남는 것 (INTENT-UNHARMED-IS-OBSERVABLE-001) 과 타격의 계산 경위가 실리는 것
        (INTENT-DAMAGE-BREAKDOWN-001) 이 그 형태다. **새 기계를 만들지 않는다.**

    ── 모양이 건드리지 않는 것 ──────────────────────────────────────────

    INTENT-SHAPE-DOES-NOT-TOUCH-THE-FORMULA-001 (ADDED)

        모양은 **누가 닿는가**만 정한다. 닿은 뒤에 얼마가 들어가는가는 정하지 않는다.

        넓은 기술이 여럿에게 닿아 한 휘두름의 총량이 커지는 것은 공식의 변화가 아니라
        접촉 건수의 변화다. 각 접촉은 지금과 완전히 같은 하나의 공식을 지난다 —
        기본 피해 · 공격 기여 · 방어 · 관통 · 치명 · 막기 어느 하나도 달라지지 않는다.

        그러므로 **여럿에 닿는 것을 세는 규칙을 만들지 않는다.** 대상 수 제한도,
        둘째부터 줄여 주는 감쇄도, 주 대상과 부수 대상의 구분도 없다. 그런 것을
        만드는 순간 그것은 모양이 아니라 새로운 전달 방식이 된다.

## DESIGN TRACE

    INTENT-SKILL-SHAPE-001
        Source Goal         GOAL-A-SKILL-HAS-A-SHAPE
        Source Possibility  POSSIBILITY-THE-SHAPE-BELONGS-TO-THE-SKILL

    INTENT-SHAPE-DECIDES-CONTACT-001
        Source Goal         GOAL-THE-SHAPE-DECIDES-WHO-IS-TOUCHED
        Source Possibility  POSSIBILITY-NARROW-REACHES-FAR ·
                            POSSIBILITY-WIDE-SWEEPS-THE-SIDES ·
                            POSSIBILITY-THE-SAME-SPOT-DIFFERS-BY-SKILL

    INTENT-REACH-BELONGS-TO-THE-SKILL-001
        Source Goal         GOAL-A-SKILL-HAS-A-SHAPE
        Source Possibility  POSSIBILITY-REACH-IS-NOT-THE-BODY

    INTENT-SHAPE-IS-A-VALUE-NOT-A-BRANCH-001
        Source Goal         GOAL-THE-RULE-DOES-NOT-KNOW-THE-NAME
        Source Possibility  POSSIBILITY-THE-JUDGE-READS-THE-DEFINITION ·
                            POSSIBILITY-A-DIFFERENT-SHAPE-IS-A-DIFFERENT-VALUE

    INTENT-SHAPE-IS-OBSERVABLE-001
        Source Goal         GOAL-THE-SHAPE-CAN-BE-KNOWN-BEFORE
        Source Possibility  POSSIBILITY-THE-WORLD-CARRIES-THE-SHAPE

    INTENT-SHAPE-EXPLAINS-THE-CONTACT-001
        Source Goal         GOAL-THE-SHAPE-CAN-BE-KNOWN-BEFORE
        Source Possibility  POSSIBILITY-THE-MISS-IS-AS-READABLE-AS-THE-HIT

    INTENT-SHAPE-DOES-NOT-TOUCH-THE-FORMULA-001
        Source Goal         GOAL-THE-SHAPE-CHANGES-NOTHING-ELSE
        Source Possibility  POSSIBILITY-EVERY-TOUCH-GOES-THROUGH-THE-SAME-ONE ·
                            POSSIBILITY-MANY-IS-A-RESULT-NOT-A-RULE

    ── 위층으로 (01-cycle.md MASTER TRACE) ────────────────────────────

    이 Cycle 의 Goal 다섯은 모두 MG-EXPLORE-BEIRA 아래 MC-COMBAT-STRIKE 의 내부를
    넓히며, 새 Capability 노드를 세우지 않는다. GOAL-THE-RULE-DOES-NOT-KNOW-THE-NAME
    이 그 노드에 걸린 `DC-SKILL-IS-COMBINATION-NOT-NAME: UNRESOLVED` 를 직접 겨눈다.

## EXISTING INTENT DELTA

    REUSED
        INTENT-BODY-FACING-001          모양은 몸이 향한 방향을 기준으로 선다.
                                        방향을 정하는 방식은 그대로다
        INTENT-SKILL-PHASE-001          모양이 훑는 구간은 그 기술의 판정 구간이다.
                                        경계 값도 그것을 읽는 방식도 그대로다
        INTENT-HARM-GATE-001            닿은 뒤 적대가 성립하는지는 그대로다
        INTENT-UNHARMED-IS-OBSERVABLE-001   닿았으나 성립하지 않은 접촉의 관찰 형태
        INTENT-SWING-IMPACT-001         닿은 몸이 밀려나는 것은 그대로다
        INTENT-STRIKE-DAMAGE-001        접촉마다 도는 피해 산정은 그대로다
        INTENT-SKILL-BUDGET-001         한 휘두름의 첫 타격에서 기력을 정산하는 것도 그대로다
        INTENT-DAMAGE-BREAKDOWN-001     계산 경위 관찰의 형태
        INTENT-TARGET-DIRECTS-THE-ACT-001   지목은 행동을 향하게 할 뿐 무엇이 맞을지를
                                        정하지 않는다 — 이 Cycle 이 그 원칙을 강화한다

    CHANGED
        INTENT-ACTION-COLLIDER-001
            지금        행동이 만드는 끝점의 모양은 세계가 정한 하나다.
                        모든 기술이 같은 넓이 · 같은 굵기로 지나가고, 닿는 길이는
                        그 몸의 교전 거리에서 온다
            앞으로      끝점의 모양은 그 기술의 정의에서 온다.
                        판정은 어느 기술인지를 묻지 않고 그 정의가 답한 값을 읽는다
            대체        INTENT-SHAPE-DECIDES-CONTACT-001 이 이 의미를 이어받는다

    AFFECTED
        INTENT-NPC-AUTONOMY-001
            스스로 판단하는 존재가 상대에게 얼마나 다가갈지를 교전 거리로 정한다.
            기술의 닿는 길이가 그 값에서 갈리면 다가간 자리가 기술에 따라 충분하기도
            모자라기도 하다. 그 어긋남이 헛휘두름으로 굳지 않아야 한다
            (INTENT-REACH-BELONGS-TO-THE-SKILL-001)

        INTENT-CANCEL-IN-STARTUP-001
            넓은 모양이 한 휘두름으로 둘 이상의 선딜을 함께 끊을 수 있게 된다.
            규칙은 그대로다 — 접촉마다 지금과 똑같이 판정한다

        INTENT-AURA-SKILL-001
            방식만 다르고 나머지가 같다는 그 층의 뜻이 새로 생기는 값에도 적용된다.
            오라를 실은 기술은 기본 기술과 **모양도 같다**

        INTENT-GUARD-DIRECTION-001
            막기는 맞는 쪽이 어디를 향하고 있는가로 판정한다. 휘두르는 쪽의 모양과
            겹치지 않으므로 판정은 그대로이나, 옆에서 닿는 접촉이 늘면 정면이 아닌
            타격이 실제로 늘어난다
