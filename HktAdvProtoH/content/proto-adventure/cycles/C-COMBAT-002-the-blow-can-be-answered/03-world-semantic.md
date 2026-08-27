# CYCLE C-COMBAT-002 — World Semantic

## SEMANTIC DELTA

    REUSED

        Actor.Cp · Actor.CpMax                       대가를 낼 주머니 (C007)
        Actor.CurrentAction                          휘두름이 사는 자리 (C002)
        CurrentAction.StruckActorIds                 **한 휘두름에 매다는 자국의 선례** (C006)
        SkillPhase (startup · active · recovery)     "아직 닿지 않았다" (C019)
        SkillDefinition.SwingBegin · SwingEnd        구간의 경계 — 기술이 지닌다 (C019 · C025)
        SkillShape (Arc · Reach · TipRadius)         "닿을 수 있는 거리인가" (C025)
        ActionCollider                               active 의 경계 (C006)
        RULE-DAMAGE-CALCULATE-001                    한 공식 (C010~C015) — **읽지도 않는다**
        RULE-GUARD-BLOCK-001                         자세로서의 막기 (C011) — **한 줄도 안 바뀐다**
        RULE-HARM-GATE-001                           적대가 성립하는가 (C018)
        Actor.IsDowned                               (C007)
        AllocationId 의 형태                          "몸마다 언제나 정확히 하나" 의 선례 (C-COMBAT-001)

    ADDED

        Actor.Response                               대답 자리 — 지금 무엇이 들어 있는가
        ResponseId                                   그 자리에 들어갈 수 있는 것들의 이름
        CurrentAction.AnsweredActorIds               이 휘두름에 대답한 몸들
        IncomingSwing (파생)                          지금 나에게 다가오는 타격 하나
        ResponseOutcome (파생)                        대답이 이 한 방에 한 일
        RULE-RESPOND-001                             대답을 실행한다
        RULE-RESPONSE-DEFLECT-001                    대답받은 타격의 결과를 바꾼다
        RULE-INCOMING-SWINGS-001                     지금 나에게 열린 구간들 (파생 판정)
        DamageBreakdown.Response                     경위의 새 항

    CHANGED

        RULE-STRIKE-DAMAGE-001
            NEW STEP   막기 판정 뒤에 대답 판정이 하나 더 붙는다.
                       Breakdown.AppliedDamage = RULE-RESPONSE-DEFLECT-001(…).AppliedDamage
            **막기 앞이 아니라 뒤다.** 앞에 두면 막기의 기력 대가가 대답 때문에 싸지고
            (대가는 덜어내기 전 값으로 매겨진다 — C011), 그러면 C011 이 이 Cycle 때문에
            달라진다. 뒤에 두면 막기는 자기가 보던 값을 그대로 보고, 대답은 막기가
            남긴 것에 건다. 대답하지 않은 타격은 C-COMBAT-001 까지와 완전히 같다

        DamageBreakdown
            ADDED  response?: ResponseOutcome   (대답받지 않은 타격에는 실리지 않는다 —
                                                guard 와 같은 태도)

    AFFECTED

        RULE-SWING-STRIKE-001        무변경 — 부르는 자리가 그대로다. 다만 대답 구간의
                                     끝(닿는 순간)이 이 규칙의 접촉 시점과 같아야 한다
        RULE-GUARD-BLOCK-001         무변경 — 순서상 먼저이므로 대가 계산이 흔들리지 않는다
        RULE-DAMAGE-CALCULATE-001    무변경 — 대답은 이 식 밖에서 그 결과값에 작용한다
                                     (DC-COMBAT-ONE-FORMULA · C011 · C015 와 같은 자리)
        RULE-CRITICAL-STRIKE-001     무변경 — 흔들림을 소비하는 자리는 여전히 여기 하나다
        RULE-HIT-001                 무변경 — 대답한 타격도 여전히 타격이다
        RULE-NPC-DECIDE-001          무변경 — 자율 존재는 이 Cycle 에서 대답하지 않는다.
                                     자리는 지니되 쓰지 않는다 (아래 BALANCE ④)
        RULE-EFFECTIVE-STATS-001     무변경 — 이 Cycle 은 effectiveStat 을 건드리지 않는다
                                     (C-COMBAT-001 과 겹치지 않는 근거)
        RULE-ACTION-BEGIN-001        무변경 — **대답은 행동 자리를 쓰지 않는다** (아래)

## WORLD STATE

    Actor.Response                  World Authority
        ResponseId — 지금 이 몸의 대답 자리에 무엇이 들어 있는가.

        **어떤 몸이든 언제나 정확히 하나를 지닌다** — 조종 주체를 가리지 않고 비어 있는
        값이 없다. C-COMBAT-001 의 Allocation 이 세운 형태 그대로다. "대답이 없는 몸"
        이라는 갈래를 세계에 만들지 않는다.

        이 Cycle 의 ResponseId 는 `deflect` **하나뿐**이다. 값이 하나인데 상태를 두는
        이유는 둘이다 — ① 자리가 있다는 것 자체가 이 Cycle 이 세우는 개념이고
        ② 둘째 종류가 생길 때 화면과 조작 코드가 열리지 않는다
        (DC-WORLD-OWNS-THE-SURFACE-LIST).

        **종류 카탈로그에 두지 않는다.** UL §4.2 는 캐릭터마다 다른 대답을 말하지만
        종류가 하나인 지금 카탈로그에 두면 3원소(world 카탈로그 · view kind 표현 ·
        motions)를 근거 없이 건드리게 된다. 어디서 오는가는 둘째 종류가 서는 Cycle 의 질문이다.

        RULE-RESPOND-001 은 이 값을 **바꾸지 않는다** — 읽기만 한다. 자리를 갈아 끼우는
        규칙은 이 Cycle 에 없다 (01 EXCLUDED — 대답의 종류).

    CurrentAction.AnsweredActorIds  World Authority
        string[] | undefined — **이 휘두름에 대답한 몸들.**

        받는 쪽의 몸이 아니라 **치는 쪽의 그 한 휘두름**에 매단다. 근거 셋:

            ① 구간은 몸의 상태가 아니라 그 한 방의 성질이다 (INTENT-RESPONSE-WINDOW-001).
               둘이 동시에 다가오면 구간이 둘이고, 자국도 둘이어야 한다
            ② 행동과 함께 사라지므로 **비우는 규칙이 필요 없다.** 만료 시각도 정리 Tick 도
               두지 않는다
            ③ `StruckActorIds` 가 이미 같은 자리에 같은 모양으로 있다 (C006) — 새 얼개가 아니다

    IncomingSwing                   파생 — 저장하지 않는다
        { attackerId, skill, timeToContact, alreadyAnswered }
        RULE-INCOMING-SWINGS-001 이 매번 센다. 재료가 전부 이미 있으므로
        (SkillPhase · SwingBegin · SkillShape · Position) 저장할 이유가 없다.

    ResponseOutcome                 파생 — 저장하지 않는다
        { answered: boolean, response: ResponseId, prevented: number }
        `GuardOutcome` 과 같은 자리·같은 태도다.

    상수 (결정론에 영향을 주므로 헤더 상수 — CVar 로 열지 않는다)

        RESPONSE_CP_COST        10     대답 한 번의 값 (선불 · 정액)
        DEFLECT_DAMAGE_FACTOR   0.5    쳐낸 타격에 남는 몫

## WORLD RULE

### RULE-INCOMING-SWINGS-001 — 지금 나에게 열린 구간들

    Implements     INTENT-RESPONSE-WINDOW-001
    Input          받는 Actor, World
    Preconditions  없음 — 언제나 돌고 스스로 몇이 열렸는지를 낸다 (파생 판정)
    Transition     없음 — 세계 상태를 바꾸지 않는다
    Result         IncomingSwing[]

    어떤 몸의 휘두름이 나에게 다가오는 구간에 있다고 보는 조건 다섯이다.

        1. 그 몸이 스킬 행동 중이고 SkillPhase 가 `startup` 이다
           — 곧 SwingBegin 앞이다. 이것이 "아직 닿지 않았다" 의 정의다
        2. 그 몸이 내가 아니고 쓰러지지 않았다
        3. 내가 쓰러지지 않았다
        4. 그 휘두름이 나에게 닿을 수 있는 거리 안이다
           — 두 몸의 거리 <= 그 기술의 Reach + TipRadius + 내 Body.Radius.
           **각(Arc)은 묻지 않는다** — 선딜 중에는 아직 어디로 휘두를지가 정해지지
           않았고, 미리 각을 재면 세계가 아직 정하지 않은 것을 대답의 조건으로 쓰게 된다
        5. 그 휘두름의 StruckActorIds 에 내가 아직 없다
           — 이미 맞은 몸은 그 휘두름에 대해 더 대답할 것이 없다
        6. RULE-HARM-GATE-001 이 그 둘 사이에서 성립한다 (C018)
           — 적대가 서지 않으면 닿아도 아무 일도 일어나지 않는다. 그런 접촉에
           대답을 치르게 하면 사람은 값을 내고 아무것도 얻지 못한다. 그 규칙은
           두 몸만 읽는 순수 판정이므로 여기서 미리 물어도 답이 같다

    TimeToContact  (SwingBegin - Progress) × Duration
                   — 남은 시간. 어느 타격에 대답하는가를 정할 때만 쓴다

    구간의 끝은 SwingBegin 이고 RULE-SWING-STRIKE-001 이 접촉을 보는 시점은 그 뒤(active)다.
    두 시점이 같은 값에서 나오므로 "닿았는데 아직 대답할 수 있다" 가 성립하지 않는다.

### RULE-RESPOND-001 — 대답을 실행한다

    Implements     INTENT-RESPONSE-SLOT-001 · INTENT-RESPONSE-WINDOW-001 ·
                   INTENT-RESPONSE-COST-001
    Input          대답하는 Actor, World
    Preconditions  1. 쓰러지지 않았다
                   2. RULE-INCOMING-SWINGS-001 이 하나 이상을 낸다
                   3. 그중 아직 대답하지 않은 것이 하나 이상이다
                   4. Cp >= RESPONSE_CP_COST
    Transition     대상 = 아직 대답하지 않은 것 중 TimeToContact 가 가장 작은 하나
                          (같으면 World.Actors 의 차례가 앞선 몸)
                   대상의 CurrentAction.AnsweredActorIds += 나
                   Cp -= RESPONSE_CP_COST
    Result         Success(answeredAttackerId) |
                   Failure(downed | no-incoming-blow | already-answered | insufficient-cp)

    **행동 자리를 쓰지 않는다.** 막기와 같은 판단이다 (C011) — 대답은 행동과 나란한
    한 번이며, 행동 자리를 쓰면 휘두르는 중에는 대답할 수 없게 되어
    INTENT-ACTION-STATE-001 을 깨거나 대답을 반쪽으로 만든다.

    **여럿이 동시에 다가와도 한 번의 대답은 하나에만 간다.** 자리가 하나이므로
    입력도 하나이고, 하나가 여럿을 덮으면 그것은 자리가 하나라는 뜻을 잃는다
    (DC-COMBAT-ONE-RESPONSE-INPUT). 둘에 대답하려면 두 번 눌러야 하고 두 번 치른다.

    입력에 난수원이 없다. 같은 세계·같은 시점의 같은 요청은 언제나 같은 결과다
    (DC-COMBAT-PLAYER-CAUSALITY).

### RULE-RESPONSE-DEFLECT-001 — 쳐낸다

    Implements     INTENT-RESPONSE-DEFLECT-001
    Input          대상 Actor, 공격자 Actor, AppliedDamage (막기를 지난 값)
    Preconditions  없음 — 언제나 돌고 스스로 대답받았는지 아닌지를 정한다
                   (RULE-GUARD-BLOCK-001 과 같은 태도)
    Transition     없음 — 세계 상태를 바꾸지 않는다 (대가는 실행하는 순간 이미 치렀다)
    Result         ResponseOutcome + AppliedDamage

    공격자의 CurrentAction.AnsweredActorIds 에 대상이 있으면
        AppliedDamage' = AppliedDamage × DEFLECT_DAMAGE_FACTOR
        Prevented      = AppliedDamage - AppliedDamage'
    없으면
        AppliedDamage' = AppliedDamage · Prevented = 0 · **ResponseOutcome 을 싣지 않는다**

    **덜어낼 뿐 없애지 않는다** — 몫이 1 보다 작고 0 보다 크므로 무적 구간이 아니다.
    확률이 개입하지 않고, 구간 안이면 언제 눌렀든 같은 몫이다 (01 EXCLUDED — 정밀 구간).

### RULE-STRIKE-DAMAGE-001 (CHANGED)

    Implements     INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001 (기존) ·
                   INTENT-RESPONSE-DEFLECT-001 (ADDED)
    Transition     Breakdown  = RULE-DAMAGE-CALCULATE-001(…)          변경 없음
                   Critical   = RULE-CRITICAL-STRIKE-001(…)           변경 없음
                   Guard      = RULE-GUARD-BLOCK-001(…)               변경 없음
                   **Response = RULE-RESPONSE-DEFLECT-001(대상, 공격자, Guard.AppliedDamage)**
                   Breakdown.AppliedDamage = Response.AppliedDamage
                   Breakdown.Response      = Response.Outcome (대답받은 타격에만)
                   이하 변경 없음

    판정 차례 넷 — 계산 → 터짐 → 막기 → 대답. 각 층은 앞 층이 없어도 성립한다
    (DC-COMBAT-ONE-LAYER-AT-A-TIME): 대답받지 않은 타격에서 넷째는 항등이다.

## OBSERVABLE SEMANTIC

    Actor.Response                       그 몸의 대답 자리에 무엇이 있는가
        **가려지지 않는다** — 살펴보지 않은 상대에게도 뜬다. 상대가 무엇으로 대답하는
        몸인지를 알아야 그 앞에서 무엇을 칠지 고를 수 있고, 그것이 이 층이 여는 수다
        (C-COMBAT-001 의 배분이 가려지지 않는 것과 같은 근거)

    Response.Choices                     고를 수 있는 대답들 + 각각의 몫과 값
        목록·가능 여부·사유·비용을 **전부 세계가 싣는다** (DC-WORLD-OWNS-THE-SURFACE-LIST).
        지금은 항목이 하나이고, 둘째가 생겨도 화면 코드가 열리지 않는다

    Response.Available                   지금 대답할 수 있는가
    Response.UnavailableReason           안 되면 왜 — 하나만 나간다
        downed | no-incoming-blow | already-answered | insufficient-cp
        **판정은 한 곳에만 있다** — RULE-RESPOND-001 의 Precondition 평가를 그대로
        공유한다. 그래야 "왜 안 되는가" 와 실제 거절 사유가 어긋나지 않는다
        (C007 이래의 규율 · DC-COMBAT-UNAVAILABLE-HAS-A-REASON)

    Response.CpCost                      한 번의 값
        화면이 기력과 비용을 스스로 견주지 않는다 — 세계가 가부를 정해 보낸다

    Response.Incoming                    지금 나에게 열린 구간의 수
        0 이면 대답할 것이 없다는 뜻이다. **닿기 전이라는 시간이 눈에 보여야**
        사람이 언제 누르는지를 배울 수 있다

    DamageBreakdown.Response             그 타격이 대답을 받았는가와 덜어낸 몫
        { answered · response · prevented }
        대답한 타격과 대답하지 않은 타격의 셈이 경위에서 갈린다
        (INTENT-RESPONSE-OBSERVABLE-001 — C011 의 guard 항과 같은 자리)

    Before → Input → Rule → After (실패 포함)

        Before  Cp = 30 · 상대가 startup · Incoming = 1 · Answered = 아니오
        Input   Respond(나)
        Rule    RULE-RESPOND-001
        After   Cp = 20 · 그 휘두름의 AnsweredActorIds = [나] · Incoming 은 여전히 1이나
                Available = false · Reason = already-answered

        Before  Cp = 5 · Incoming = 1
        Input   Respond(나)
        Rule    RULE-RESPOND-001
        After   변화 없음 · Failure(insufficient-cp)

        Before  Incoming = 0 (아무도 선딜 중이 아니다)
        Input   Respond(나)
        Rule    RULE-RESPOND-001
        After   변화 없음 · Failure(no-incoming-blow)

## SEMANTIC CLOSURE

    INTENT-RESPONSE-SLOT-001

        "모든 몸은 대답 자리를 하나 가진다"          → Actor.Response (모든 Actor · 값 하나)
        "무엇이 들어 있는가가 그 몸의 상태다"         → Actor.Response 의 값
        "부르는 길도 하나다"                        → RULE-RESPOND-001 이 자리를 인자로
                                                    받지 않는다 — 어느 대답인지는 상태가 답한다
        "종류가 늘어도 그 길은 늘지 않는다"           → ResponseId 가 늘어도 규칙이 하나다

    INTENT-RESPONSE-WINDOW-001

        "닿을 수 있는 타격이 다가오는 동안"          → RULE-INCOMING-SWINGS-001 조건 1·4
        "닿는 순간 구간이 닫힌다"                    → 조건 1 (startup 이 아니게 된다) · 조건 5
        "구간은 타격마다 열린다"                     → IncomingSwing 이 배열이다
        "둘이 동시에 오면 구간도 둘"                  → 같은 배열
        "경계는 치는 쪽이 지닌 값에서 나온다"          → SkillDefinition.SwingBegin (REUSED)
        "받는 쪽과 치는 쪽의 시간이 같다"             → 둘 다 skillPhase 를 읽는다
        "구간 안이면 언제 실행했든 같다"              → RULE-RESPONSE-DEFLECT-001 이
                                                    시각을 읽지 않는다

    INTENT-RESPONSE-DEFLECT-001

        "그 한 타격의 최종 피해를 덜어낸다"           → RULE-RESPONSE-DEFLECT-001
        "그 한 타격뿐이다"                          → AnsweredActorIds 가 행동과 함께 사라진다
        "덜어낸 뒤에도 남는 것이 있다"                → 0 < DEFLECT_DAMAGE_FACTOR < 1
        "방향을 묻지 않는다"                        → 조건에 Arc·Facing 이 없다

    INTENT-RESPONSE-COST-001

        "기력이 정해진 만큼 줄어든다"                 → RULE-RESPOND-001 Transition
        "모자라면 실행되지 않는다"                    → Precondition 4
        "실행하는 순간에 정해져 있다"                 → RESPONSE_CP_COST (정액 · 선불)
        "새로 만드는 주머니가 없다"                   → Actor.Cp (REUSED)

    INTENT-RESPONSE-NONE-IS-NORMAL-001

        "한 톨도 다르지 않게 지난다"                 → RULE-RESPONSE-DEFLECT-001 이
                                                    대답받지 않은 타격에 항등이다
        "기본 경로다"                               → Precondition 없이 언제나 돌고
                                                    스스로 판정한다 (예외 분기가 아니다)
        "수치를 올리지도 내리지도 않는다"             → CHANGED 에 수치 변경이 없다

    INTENT-RESPONSE-OBSERVABLE-001

        "지금 대답할 수 있는가"                      → Response.Available · Response.Incoming
        "자리에 무엇이 있는가"                       → Actor.Response (가려지지 않는다)
        "안 되면 왜"                                → Response.UnavailableReason (하나)
        "그 타격이 대답을 받았는가"                   → DamageBreakdown.Response

    남는 문장 없음 — Closure 통과.

## BALANCE — 수치의 근거 (Stage 5 가 확인할 자리)

    ① RESPONSE_CP_COST = 10

       배분 전환 15 (C-COMBAT-001) 보다 싸고 기본 스킬이 채우는 12 보다 조금 싸다.
       그래서 **대답만 하며 버티면 기력이 서서히 준다** — 치고 채워야 계속 대답할 수 있다.
       고급 스킬 30 과 같은 주머니를 다투므로, 대답 셋이 고급 한 번이다
       (DC-COMBAT-SHARED-BUDGET 이 뜻하는 다툼이 이 자리에서 성립한다).

    ② DEFLECT_DAMAGE_FACTOR = 0.5

       막기와 같은 몫이다. **같은 몫을 서로 다른 대가로 산다** —
       막기는 방향을 묻고 켜 둔 채로 계속 가며 맞은 만큼 뒤에 치른다.
       쳐내기는 방향을 묻지 않고 한 방에만 가며 정액을 미리 치른다.
       둘 다 걸면 0.25 이고 그 한 방에 22 안팎을 치른다 (막기 12 + 대답 10) —
       기력 100 의 다섯 방 남짓이라 남발할 수 없다.

    ③ 한 방의 실제 크기 (기본 스킬 · 균형 배분 기준, C007 이래의 값)

           대답도 막기도 안 함     20    ← **이 값이 바뀌지 않는 것이 이 Cycle 의 약속이다**
           막기만                 10
           대답만                 10
           둘 다                   5

    ④ 자율 존재는 대답하지 않는다

       RULE-NPC-DECIDE-001 을 건드리지 않는다. 자리는 지니되 쓰지 않으므로 회귀에서
       자율 존재의 행동이 한 톨도 달라지지 않는다. **이 Cycle 이 세우는 것은 받는 쪽의
       선택이고**, 그것을 사람이 먼저 겪는 것이 맞다. 자율 존재가 대답을 쓰기 시작하면
       사람이 치는 한 방의 크기가 흔들리는데, 그것은 이 층이 아니라 그 판단의 몫이다.

    ⑤ 대답이 필수가 되지 않는가 — DC-COMBAT-RESPONSE-IS-OPTIONAL-MASTERY 자가 점검

       무대응 쪽 수치를 한 톨도 건드리지 않았다 (③ 첫 줄). 대답을 한 번도 하지 않는
       몸의 전투는 C-COMBAT-001 까지와 완전히 같다. 이 Constraint 가 지키는 하한이
       그것이며, 이 Cycle 은 그 위에 얹기만 한다.

       **다만 이 Constraint 의 `prefers` 는 만족하지 않는다** — "숙련의 보상을 피해
       감소가 아니라 새로 열리는 선택지로 주는 것" 을 이 Cycle 은 하지 않는다.
       기회(FR-A-GOOD-ANSWER-OPENS-A-DOOR)가 01 의 EXCLUDED 이기 때문이다.
       `requires` 와 `prohibits` 는 어기지 않으므로 SATISFIED 로 두되,
       **이것은 착수 전에 감수하기로 한 손해다** — 08 의 MASTER FEEDBACK 이 이 자리를
       다시 짚는다.
