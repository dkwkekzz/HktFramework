# C019 — Intent

> 지금 이 세계에서 끊김은 사정을 묻지 않는다. 맞으면 하던 일이 사라진다 — 칼을 막 치켜든
> 참이든, 이미 칼날이 상대의 몸을 지나는 중이든 똑같다. 그래서 "끊었다" 는 판단이 아니라
> 부산물이고, 아무 때나 때리면 되는 일에는 노릴 것이 없다. 이번에 더해지는 것은 새 행동도
> 새 계산도 아니라 **시간의 의미** 하나다 — 기술에는 아직 나가지 않은 구간이 있고, 그
> 구간에만 끊을 수 있다. 그 하나가 서면 끊김이 넓어지는 게 아니라 **좁아지고**, 좁아진
> 만큼 "언제 넣을까" 가 처음으로 판단이 된다.

## GOAL / POSSIBILITY

    GOAL-A-SKILL-HAS-A-BEFORE            기술에는 아직 나가지 않은 구간이 있다
        └── POSSIBILITY-STARTUP-IS-PART-OF-THE-SKILL
                                         선딜은 기술이 지닌 성질이다 — 모든 기술이 같은
                                         길이를 가지지 않는다
        └── POSSIBILITY-BIGGER-MEANS-LONGER
                                         크게 거는 기술일수록 나가기까지 오래 걸린다

    GOAL-THE-BEFORE-CAN-BE-SEEN          그 구간에 있다는 것을 보는 쪽이 알 수 있다
        └── POSSIBILITY-THE-WORLD-JUDGES-THE-PHASE
                                         지금 어느 구간인지는 세계가 판정해 실어 보낸다 —
                                         보는 쪽이 진행도와 경계로 계산하지 않는다

    GOAL-ONLY-THE-BEFORE-CAN-BE-CUT      끊을 수 있는 때가 정해져 있다
        └── POSSIBILITY-HARM-IN-STARTUP-CANCELS
                                         선딜 중에 해를 입으면 그 기술은 나가지 못한다
        └── POSSIBILITY-WHAT-LEFT-THE-HAND-CANNOT-BE-RECALLED
                                         이미 나간 칼은 멈추지 않는다 — 늦게 넣은 개입은
                                         그 기술을 무르지 못한다

    GOAL-CANCELLING-IS-A-LOSS-FOR-BOTH   캔슬은 공짜가 아니다
        └── POSSIBILITY-THE-CANCELLED-EARNS-NOTHING
                                         맞아야 도는 기력이 돌지 않는다 — 잃는 것은
                                         치른 값이 아니라 벌지 못한 값과 쓴 시간이다
        └── POSSIBILITY-BIGGER-LOSS-FOR-BIGGER-BET
                                         선딜이 긴 기술일수록 잃는 시간이 크다

    GOAL-THE-CUT-IS-VISIBLE              무엇이 왜 끊겼는지 알 수 있다
        └── POSSIBILITY-CANCEL-IS-ITS-OWN-EVENT
                                         캔슬은 빗나감과도, 닿았으나 성립하지 않음과도
                                         다른 사건이다 — 피해 산정 자체가 없다

    GOAL-THE-RULE-HAS-NO-EXCEPTION       몸의 종류가 이 규칙을 바꾸지 않는다
        └── POSSIBILITY-THE-AUTONOMOUS-ALSO-COMMITS
                                         자율 존재도 큰 기술을 걸고, 걸면 같은 선딜을
                                         지며 같은 조건으로 캔슬당한다
        └── POSSIBILITY-THE-PLAYER-IS-ALSO-CUT
                                         플레이어의 큰 기술도 같은 시점 조건으로 끊긴다

## INTENT SET

    ── 기술의 시간 ───────────────────────────────────────────────────

    INTENT-SKILL-PHASE-001 (ADDED)

        기술이 차지하는 시간은 세 구간으로 나뉜다.

            선딜   기술을 시작해서 아직 아무것도 나가지 않은 구간
            판정   그 기술의 효과가 성립하는 구간 (지금 세계에서는 칼끝이 지나는 구간)
            후딜   효과가 끝나고 행동이 마무리되는 구간

        구간은 이미 세계에 있다 — 이 Intent 가 더하는 것은 **그 경계가 기술마다
        다르다**는 것이다. 지금은 모든 기술이 같은 비율을 쓴다. 앞으로 선딜의 길이는
        그 기술이 지닌 성질이며, **크게 거는 기술일수록 길다.**

        선딜의 길이는 그 기술의 다른 성질(피해 · 기력 수지 · 피해 방식)과 무관하게
        정해지는 값이 아니라, "얼마나 크게 거는가" 와 함께 읽히는 값이다. 구체적인
        값은 세계 규칙이 정한다.

        이 구간 구분은 **기술에만** 선다. 채굴 · 살펴봄처럼 기술이 아닌 행동은 여전히
        진행도만 가지며 선딜의 의미를 갖지 않는다.

    ── 구간이 보인다 ──────────────────────────────────────────────────

    INTENT-STARTUP-IS-OBSERVABLE-001 (ADDED)

        어떤 존재가 기술을 쓰는 중일 때, 그것이 **지금 어느 구간에 있는지**가
        보는 쪽에게 실린다. 최소한 "아직 나가지 않았다" 와 "이미 나갔다" 가 구분된다.

        **그 판정은 세계가 한다.** 보는 쪽이 진행도와 구간 경계를 가지고 스스로
        계산하지 않는다 — 경계는 기술마다 다르고 세계 안에만 있는 값이므로, 보는 쪽이
        그것을 복제하는 순간 두 개의 진실이 생긴다.

        이 관찰은 가려지지 않는다. 살펴봄이나 앎의 관문 뒤에 있지 않다 — 상대가 무엇을
        준비하는지가 아니라 **지금 나가지 않았다는 사실**이며, 그것이 가려지면 끊는
        판단 자체가 성립하지 않는다.

    ── 선딜 중에는 끊긴다 ──────────────────────────────────────────────

    INTENT-CANCEL-IN-STARTUP-001 (ADDED)

        기술을 쓰는 중인 존재가 **선딜 구간에서** 해를 입으면, 그 기술은 캔슬된다.
        캔슬된 기술은 판정 구간에 이르지 못하고, 그 기술의 효과는 세계에 일어나지 않는다.

        일어나지 않는다는 것은 **피해가 0 이 되는 것이 아니라 피해 산정 자체가 없다**는
        뜻이다. 없던 일이 되는 것이지 작아지는 것이 아니다.

        캔슬을 만드는 것은 **해를 입는 사건**이다. 닿았으나 관계가 허락하지 않아 아무 일도
        성립하지 않은 접촉은 캔슬시키지 못한다 — 해가 성립하지 않았는데 그 결과만 오는 것은
        앞뒤가 맞지 않는다.

        판정은 **시점 관계**로만 이루어진다. 확률도, 저항 값도, 몸의 종류도 들어가지
        않는다. 같은 시점에 같은 개입을 넣으면 언제나 같은 결과가 나온다.

    ── 이미 나간 것은 무르지 못한다 ─────────────────────────────────────

    INTENT-HIT-REACTION-001 (CHANGED)

        지금까지 피격은 사정을 묻지 않고 하던 행동을 대체했다. 이제 **기술을 쓰는 중일
        때만** 시점을 묻는다.

            선딜 중에 맞았다        그 기술은 캔슬된다 (INTENT-CANCEL-IN-STARTUP-001)
            판정 · 후딜 중에 맞았다   그 기술은 **끝까지 나간다**
            기술이 아닌 행동 중이다   지금과 같다 — 하던 일이 끊긴다

        판정 구간에 들어선 기술은 맞아도 멈추지 않는다. 맞은 사실과 그 피해는 그대로
        성립하며, 다만 그 때문에 기술이 사라지지는 않는다. 이것이 "늦게 넣은 개입은
        무산되지 않는다" 의 세계 쪽 표현이다.

        이 변경은 피격 자체의 의미를 바꾸지 않는다 — 맞으면 아프고, 그 피해는 지금과
        같은 공식으로 산정된다. 바뀌는 것은 **맞은 것이 하던 기술을 지우는가**뿐이다.

    ── 캔슬의 대가 ────────────────────────────────────────────────────

    INTENT-CANCEL-COSTS-THE-CHANCE-001 (ADDED)

        캔슬된 기술은 기력 수지를 정산하지 않는다. 이 세계의 기력은 맞아야 도는 것이므로
        (INTENT-SKILL-BUDGET-001), 나가지 못한 기술은 **벌지 못한다.**

        그러므로 캔슬당한 쪽이 잃는 것은 치른 값이 아니라 **쓴 시간과 벌지 못한 몫**이다.
        선딜이 긴 기술일수록 잃는 시간이 크다 — 크게 걸수록 크게 잃는다.

        기력을 시작하는 순간 치르게 만들지 않는다. 그것은 이 세계의 수지 구조를 바꾸는
        일이며 이 Cycle 의 것이 아니다.

    ── 끊긴 것이 보인다 ────────────────────────────────────────────────

    INTENT-CANCEL-IS-OBSERVABLE-001 (ADDED)

        기술이 캔슬되면 **누구의 무엇이 왜 캔슬되었는지**가 보는 쪽에 실린다.

        캔슬은 이 세계의 다른 두 사건과 구분되어야 한다.

            빗나감              닿지 않았다 — 아무 사건도 없다
            성립하지 않은 접촉    닿았으나 관계가 허락하지 않았다 (C018)
            캔슬                 맞은 쪽이 하려던 것이 없던 일이 되었다

        구분의 근거는 **피해 산정 경위의 유무**다. 앞의 둘과 달리 캔슬은 그 기술의 산정이
        아예 없다. 세 사건이 한 자리에 섞이면 보는 쪽이 그것을 짐작으로 갈라야 한다.

    ── 자율 존재도 건다 ────────────────────────────────────────────────

    INTENT-NPC-AUTONOMY-001 (CHANGED)

        자율 존재는 지금 기본 기술 하나만 쓴다. 이제 **큰 기술도 쓴다.**

        무엇을 쓸지는 그 존재의 지금 사정으로 정해진다 — 가장 단순한 하나의 기준이며,
        패턴도 국면도 아니다. 큰 기술을 쓸 수 없는 사정이면 지금처럼 기본 기술을 쓴다.

        이것이 없으면 이 Cycle 의 다른 Intent 들이 세계에 서 있어도 **플레이에서 한 번도
        일어나지 않는다** — 기본 기술의 선딜은 사람이 보고 반응할 수 있는 길이가 아니다.
        큰 기술을 거는 상대가 있어야 노릴 구간이 생긴다.

        자율 존재가 건 큰 기술도 같은 규칙을 진다 — 선딜 중에 맞으면 캔슬되고,
        판정에 들어섰으면 끝까지 나간다. 예외를 갖지 않는다.

## DESIGN TRACE

    INTENT-SKILL-PHASE-001
        Source Goal         GOAL-A-SKILL-HAS-A-BEFORE
        Source Possibility  POSSIBILITY-STARTUP-IS-PART-OF-THE-SKILL ·
                            POSSIBILITY-BIGGER-MEANS-LONGER
        Master              MC-INTERRUPT (PARTIAL) — "상대의 행동에 시작과 완성 사이의
                            구간이 있고" 의 앞칸

    INTENT-STARTUP-IS-OBSERVABLE-001
        Source Goal         GOAL-THE-BEFORE-CAN-BE-SEEN
        Source Possibility  POSSIBILITY-THE-WORLD-JUDGES-THE-PHASE
        Master              MP-INTERRUPT world_shape — "무엇이 끊겼는지가 관찰 가능해야"
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST

    INTENT-CANCEL-IN-STARTUP-001
        Source Goal         GOAL-ONLY-THE-BEFORE-CAN-BE-CUT
        Source Possibility  POSSIBILITY-HARM-IN-STARTUP-CANCELS
        Master              MC-INTERRUPT 결손 — "끊는 것을 노리는 수단"
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (시점 관계 · 난수 없음) ·
                            DC-COMBAT-ONE-FORMULA (산정 자체가 없다 — 공식 무변경)

    INTENT-HIT-REACTION-001 (CHANGED)
        Source Goal         GOAL-ONLY-THE-BEFORE-CAN-BE-CUT
        Source Possibility  POSSIBILITY-WHAT-LEFT-THE-HAND-CANNOT-BE-RECALLED
        Master              MP-INTERRUPT — "상대 행동의 시작을 읽는 시점 판단"

    INTENT-CANCEL-COSTS-THE-CHANCE-001
        Source Goal         GOAL-CANCELLING-IS-A-LOSS-FOR-BOTH
        Source Possibility  POSSIBILITY-THE-CANCELLED-EARNS-NOTHING ·
                            POSSIBILITY-BIGGER-LOSS-FOR-BIGGER-BET
        Master              Frontier "세계에 생기는 것 ④" 의 이 세계 판 (01 SCOPE NOTE ①)
        Constraint          DC-COMBAT-SHARED-BUDGET (수지의 시점을 바꾸지 않는다)

    INTENT-CANCEL-IS-OBSERVABLE-001
        Source Goal         GOAL-THE-CUT-IS-VISIBLE
        Source Possibility  POSSIBILITY-CANCEL-IS-ITS-OWN-EVENT
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST

    INTENT-NPC-AUTONOMY-001 (CHANGED)
        Source Goal         GOAL-THE-RULE-HAS-NO-EXCEPTION
        Source Possibility  POSSIBILITY-THE-AUTONOMOUS-ALSO-COMMITS
        Master              MP-INTERRUPT detail — "상대가 크고 느린 행동을 준비할수록
                            값어치가 커진다". 준비하는 상대가 없으면 갈래가 서지 않는다

## EXISTING INTENT DELTA

    REUSED
        INTENT-ACTION-STATE-001        모든 존재는 언제나 하나의 행동 안에 있다
        INTENT-ACTION-PROGRESS-001     진행도가 관찰에 실린다 — 선딜 판정이 그 위에 선다
        INTENT-ACTION-EXCLUSIVE-001    진행 중 다른 행동을 못 내는 관문
        INTENT-SWING-IMPACT-001        휘두름 구간의 접촉이 무엇이 맞는지 정한다
        INTENT-SKILL-COST-GATE-001     기력이 모자라면 기술이 시작되지 않는다
        INTENT-TEMPO-ACTION-001        행동 길이는 시작하는 순간의 공격 속도가 정한다
        INTENT-HARM-GATE-001           관계가 허락해야 해가 성립한다 (C018) —
                                       캔슬이 그 뒤에 선다
        INTENT-DAMAGE-CALCULATE-001    피해 공식 — 한 글자도 닿지 않는다

    CHANGED
        INTENT-HIT-REACTION-001
            기존   맞으면 하던 행동이 언제나 대체된다 (사정을 묻지 않는다)
            변경   기술을 쓰는 중이면 시점을 묻는다 — 선딜이면 캔슬, 판정 이후면 유지.
                   기술이 아닌 행동은 지금과 같다
        INTENT-NPC-AUTONOMY-001
            기존   자율 존재는 기본 기술만 쓴다 (C007 EXCLUDED)
            변경   큰 기술도 쓴다. 고르는 기준은 가장 단순한 하나이며 판단 구조가 아니다

    AFFECTED
        INTENT-SKILL-BUDGET-001        무변경. 다만 "맞아야 정산한다" 가 캔슬의 대가를
                                       만드는 자리가 된다 (INTENT-CANCEL-COSTS-THE-CHANCE-001)
        INTENT-UNHARMED-IS-OBSERVABLE-001 (C018)
                                       무변경. 캔슬 관찰이 그 옆에 서며 섞이지 않는다
        INTENT-GUARD-STANCE-001        무변경. 막기는 행동이 아니므로 선딜을 갖지 않는다
        INTENT-DOWNED-001              무변경. 쓰러짐은 기술이 아니다
