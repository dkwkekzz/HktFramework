# C-TERRAIN-001 — World Semantic

## SEMANTIC DELTA

    REUSED
        Actor.Position                      어디에 서 있는가 — 판정의 유일한 입력 (C001)
        Actor.Hp · Actor.HpMax              법칙이 마지막에 닿는 것 (C007)
        Actor.CurrentAction (downed)        생명이 다한 몸의 끝 (C007 · INTENT-DOWNED-001)
        World.Time · Tick dt                거두어 가는 일이 흐름 위에 선다 (C001)
        WorldPosition · distance            자리 안인가를 재는 것 (position.ts)
        RULE-DOWNED-001                     한 글자도 바꾸지 않고 부른다

    ADDED
        World.GroundZones                   무대의 자리들 — 범위와 그것이 무엇의 자리인가
        GroundZone.Law · GroundZone.Role    어느 법칙의 자리인가 · 작용하는가 멎는가
        GroundLawDefinition                 법칙의 정의 — 무엇을 어떤 속도로 거두어 가는가
        Actor.Warmth · Actor.WarmthMax      몸이 지닌 열 — 땅이 거두어 가는 것
        RULE-GROUND-LAW-APPLY-001           머무는 동안 거두어 간다

    CHANGED
        없음.

        기존 Rule 도 기존 State 도 한 줄 고치지 않는다. 판정이 오직 Actor.Position 과
        World.GroundZones 만 읽으므로 기존 규칙 어느 것도 이 규칙을 알 필요가 없다.
        자리 밖의 모든 플레이는 그대로다 (02-intent.md CHANGED: 없음).

    AFFECTED
        Tick 진행 순서 (SYSTEMS)            항목이 하나 는다. 기존 순서는 바뀌지 않는다
        Observer Projection                 관찰에 값이 는다 — 새 관찰 경로를 만들지 않는다
        RULE-OBSERVER-JOIN-001              새 몸이 Warmth 를 가득 지니고 놓인다.
                                            무엇이 주어지는지는 바뀌지 않는다
        RULE-NPC-DECIDE-001                 자율 존재도 겪는다. 다만 **땅을 피할 판단을
                                            주지 않는다** — 규칙에 예외를 두는 것이 아니라
                                            아직 그 판단이 없는 것이다 (02-intent.md AFFECTED)
        RULE-ATTRIBUTE-SET-001              디버그 조작의 대상 속성이 는다 (warmth).
                                            그 규칙 자체는 목록을 알지 않으므로 열리지 않는다

## WORLD STATE

    World.GroundZones                       World Authority
        무대 안의 자리들. 각 항목은 범위 하나와 그 범위가 **무엇의 자리인가**를 지닌다.

        id          이 자리의 이름
        law         어느 법칙의 자리인가 (GroundLawId)
        role        law     그 법칙이 작용하는 범위
                    respite 그 법칙이 **멎는** 범위
        center      범위의 중심
        radius      범위의 반경

        **어떤 Rule 도 이 목록을 바꾸지 않는다.** 세계가 만들어질 때 놓이고 그대로다.
        그럼에도 상수가 아니라 State 인 이유는 둘이다 — 관찰이 State 를 투영하는 하나의
        길을 지나야 하고(광맥이 그러하듯), 예외가 사라질 수 있다는 것이 이 세계의
        원칙이기 때문이다 (BT §9.2 · DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION 의 prefers).
        그 변화를 여는 것은 이 Cycle 이 아니지만, 열릴 때 State 로 옮기는 이사가
        따라붙지 않게 한다.

        자리는 **겹칠 수 있다.** 예외 자리가 법칙의 자리 안에 있다는 것이 곧 겹침이다.

        무대 전체가 자리로 덮이지 않는다. 어느 자리에도 속하지 않은 땅은 아무 법칙도
        지니지 않으며, 그것이 지금까지의 세계 전부였다.

    GroundLawDefinition                     World Authority (정의 — 세계의 성질)
        법칙 하나의 정의. **이름이 아니라 조건과 결과다**
        (DC-WORLD-TERRAIN-IS-A-PRINCIPLE).

        id              GroundLawId
        takes           몸의 어느 값을 거두어 가는가            지금은 `warmth` 하나
        rate            그 값을 초당 얼마나 거두어 가는가
        lifeRate        그 값이 다한 뒤 생명을 초당 얼마나 거두어 가는가

        규칙은 이 정의를 **읽을 뿐 자리의 이름을 묻지 않는다.** 그러므로 법칙이 하나
        늘어나는 일은 정의가 하나 늘어나는 일이며, RULE-GROUND-LAW-APPLY-001 도
        관찰도 열리지 않는다 (INTENT-GROUND-LAW-IS-CONDITION-AND-RESULT-001).

    Actor.Warmth                            World Authority
        몸이 지닌 열. **줄어드는 동안 몸은 상하지 않는다** — 이것이 피해와 다른 점이며
        BT §5.2("잃었다는 사실을 즉시 느끼지 못한다")가 세계에 서는 자리다.

        RULE-GROUND-LAW-APPLY-001 과 RULE-ATTRIBUTE-SET-001 만이 바꾼다.
        **이 Cycle 에 되채우는 규칙은 없다** — 채우는 것은 다음 후보의 몫이다
        (01-cycle.md EXCLUDED · FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED ②).

    Actor.WarmthMax                         World Authority
        몸이 지닐 수 있는 열의 최대. 지금은 모든 몸이 같은 값을 지닌다 —
        종류마다 다른 값은 종류의 정의(character-catalog)로 옮기는 한 줄 이사이며,
        그럴 이유가 생겼을 때 한다 (C022 의 InventoryCapacity 와 같은 판단).

## WORLD RULE

    RULE-GROUND-LAW-APPLY-001 (ADDED)
        Implements     INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 ·
                       INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001 ·
                       INTENT-BODY-HOLDS-WHAT-THE-LAND-TAKES-001 ·
                       INTENT-THE-LAND-REACHES-LIFE-WHEN-NOTHING-IS-LEFT-001 ·
                       INTENT-GROUND-EXCEPTION-STOPS-THE-LAW-001 ·
                       INTENT-STANDING-IS-THE-WHOLE-INPUT-001
        Input          모든 Actor, dt
        Preconditions  1. Actor 가 쓰러지지 않았다
                       2. role = law 인 자리 안에 있다
                       3. **같은 법칙의** role = respite 인 자리 안에 있지 않다
        Transition     Warmth > 0 이면   Warmth = max(0, Warmth − Law.rate × dt)
                       Warmth = 0 이면   Hp = max(0, Hp − Law.lifeRate × dt)
                                         Hp 가 0 이 되면 RULE-DOWNED-001
        Result         Taken(law) | Sheltered(law) | Untouched

        Note 1  판정이 읽는 것은 **Actor.Position 과 World.GroundZones 뿐이다.**
                누구인지도, 무엇을 지녔는지도, 무엇을 하는 중인지도 묻지 않는다
                (INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001). 쓰러진 몸을 거르는 것은
                유일한 예외이며, 그것은 신원이 아니라 **이미 끝에 이른 몸**을 두 번
                끝내지 않기 위한 것이다 (RULE-DOWNED-001 이 멱등한 것과 같은 이유).

        Note 2  **어디에도 적히지 않는다.** 들어갔다는 사실도 겪는 중이라는 사실도 몸에
                기록되지 않고 매 Tick 위치에서 다시 계산된다. 그래서 나가면 저절로 멎고
                멎게 하는 규칙이 따로 없다 (DC-CONDITION-OPENS-WITHOUT-RECORDING).

        Note 3  예외 판정이 **같은 법칙**을 묻는 것이 요점이다. 다른 법칙의 예외 자리는
                이 법칙을 멎게 하지 못한다 — 예외는 법칙 옆에 놓인 다른 규칙이 아니라
                그 법칙이 만든 것이기 때문이다 (DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION).
                그러므로 "모든 것을 막는 안전지대" 는 이 형태로 적을 수 없다.

        Note 4  겹친 law 자리가 여럿이면 각각이 자기 몫을 거둔다 — 하나를 고르지 않는다.
                고르는 순간 어느 것을 고를지의 판단이 규칙에 들어오고, 그것은 법칙이
                아니라 조정이 된다.

    Tick 자리   RULE-CP-RUN-DRAIN-001 **바로 뒤**.
                이유는 그 규칙이 물리 뒤에 놓인 이유와 같다 — 이 Tick 에 **실제로 서
                있게 된 자리**에 대해 값을 치른다. 의도한 이동과 물리 보정이 모두 끝난
                뒤라야 "어디에 서 있는가" 가 확정된다.
                RULE-TARGET-CLEAR-STALE-001 **앞**이어야 한다 — 이 규칙이 몸을 쓰러뜨릴
                수 있고, 그 Tick 에 성립하지 않게 된 지목을 훑는 것은 그 뒤여야 한다.

## OBSERVABLE SEMANTIC

    지금 나에게 무엇이 일어나는가          INTENT-GROUND-LAW-IS-OBSERVED-001

        Self.GroundLaw          지금 이 몸에 걸린 법칙 — 없으면 없음
        Self.GroundState        taking     지금 거두어 가는 중이다
                                sheltered  법칙의 자리 안이지만 멎어 있다
                                none       어떤 법칙도 걸려 있지 않다
        Self.GroundTakes        그 법칙이 거두어 가는 것이 무엇인가

        `sheltered` 가 `none` 과 **구분되는 것이 요점이다.** 아무 일도 일어나지 않는
        것과 법칙이 멎어서 아무 일도 일어나지 않는 것은 다르며, 뒤엣것이 읽히지 않으면
        예외 자리는 그냥 아무것도 없는 땅이 된다 (02-intent.md 둘째 문단).

        이 셋은 **상태가 아니라 판정 결과다** — 규칙이 매 Tick 계산하는 것과 같은
        조건에서 계산해 싣는다. 그래서 관찰에 실리는 것과 실제로 일어나는 것이
        어긋날 자리가 없다.

    몸이 지닌 것                          INTENT-BODY-HOLDS-WHAT-THE-LAND-TAKES-001

        Self.Warmth · Self.WarmthMax    지닌 열과 그 최대. 둘이 함께 온다 —
                                        하나만으로는 얼마나 남았는지 읽히지 않는다

    자리의 범위                           INTENT-GROUND-PLACES-ARE-OBSERVED-001

        World.GroundZones 의 각 항목      id · law · role · center · radius

        보이는 것은 **범위와 그것이 무엇의 범위인지**까지다. 앞으로 무슨 일이 일어날지의
        예고는 싣지 않는다 (FR-THE-LAND-SHOWS-BEFORE-IT-TAKES).

        감추지 않는다. DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE 이 감추라는 것은 **법칙**이지
        지금 보이는 풍경이 아니며, "관찰할수록 드러난다" 는 반복 관찰의 층은 이 Cycle 이
        열지 않는다. 자리는 처음부터 땅 위에 보인다.

        어느 자리 안인가를 **화면이 계산하지 않는다.** 안인지 밖인지는 세계가 판정해
        Self.GroundState 로 실어 보내며, 화면이 받는 범위는 그것을 **그리기 위한 것**이지
        판정하기 위한 것이 아니다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    Observable Closure — 판정에 영향을 준 모든 것이 관찰된다

        Precondition 1 (쓰러지지 않았다)    self.downed 로 이미 실린다 (C007)
        Precondition 2 (law 자리 안)        Self.GroundState ≠ none · 범위가 실린다
        Precondition 3 (respite 자리 밖)    Self.GroundState = sheltered 가 그 안임을 말한다
        Transition (무엇이 줄었는가)         Self.Warmth · self.hp 가 함께 실린다
        Law 의 정의 (무엇을 거두는가)        Self.GroundTakes

## SEMANTIC CLOSURE

    "무대 안에 자리가 있다"                → World.GroundZones
    "자리는 범위다"                        → GroundZone.center · radius
    "자리는 무대의 것이다"                  → World.GroundZones (Actor 가 지니지 않는다)
    "자리는 겹칠 수 있다"                   → 목록이며 배타를 요구하지 않는다 · Rule Note 4
    "자리 밖은 그대로다"                    → Rule Precondition 2 · CHANGED 없음
    "걸린 것은 조건과 결과다"               → GroundLawDefinition(takes · rate · lifeRate)
    "규칙은 이름을 묻지 않는다"             → Rule 이 정의를 읽는다 · Rule Note 1
    "머무는 시간에 비례해 거둔다"           → Transition 의 × dt
    "누구인지 묻지 않는다"                  → Input 이 모든 Actor · Rule Note 1
    "몸이 지닌 것이 줄어든다"               → Actor.Warmth
    "줄어드는 동안 몸은 상하지 않는다"       → Warmth > 0 인 동안 Hp 를 건드리지 않는다
    "다하면 생명에 닿는다"                  → Warmth = 0 일 때의 Transition
    "새로운 끝을 만들지 않는다"             → RULE-DOWNED-001 을 그대로 부른다 (REUSED)
    "예외 자리에서 멎는다"                  → Rule Precondition 3
    "예외는 법칙이 만든 것이다"             → respite 가 **같은 법칙**을 이름으로 지닌다
    "예외는 되돌리지 않는다"                → 멎을 뿐 Warmth 를 올리는 Transition 이 없다
    "행동을 요구하지 않는다"                → Input 에 요청이 없다. 새 Action 이 없다
    "어디에도 적히지 않는다"                → 판정용 State 가 없다 · Rule Note 2
    "지금 걸린 법칙이 읽힌다"               → Self.GroundLaw · GroundState · GroundTakes
    "멎어 있는 것도 사실이다"               → GroundState = sheltered (≠ none)
    "범위가 읽힌다"                        → World.GroundZones 투영
    "화면이 판정하지 않는다"                → 세 값 전부 세계가 계산해 싣는다

    남은 문장 없음.

## RATIONALE — 왜 이 형태인가

    1. 왜 자리에 `role` 을 두고 예외를 따로 두지 않았는가

       예외를 별도의 목록(SafeZones)으로 두면 그것은 **법칙 옆에 놓인 다른 규칙**이 되고,
       "안전은 위험이 낮게 설정된 것이 아니다" 가 형태에서 무너진다. respite 가 자기가
       멎게 하는 법칙의 이름을 지니게 하면 예외는 그 법칙 없이는 적을 수조차 없다 —
       DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION 이 코드의 모양으로 강제된다.

       부수 효과가 하나 더 있다. "모든 것을 막는 안전지대" 를 적을 방법이 없다.

    2. 왜 Warmth 를 두고 Hp 를 바로 깎지 않았는가

       바로 깎으면 땅의 법칙이 "지형이 때린다" 가 되고 BT §5.2 가 통째로 사라진다.
       거두어 가는 것은 맞는 것이 아니라 **빠져나가는 것**이며, 그 둘이 다르다는 것이
       이 대지형의 정체성이다. 그리고 Warmth 가 있어야 다음 후보(지니고 나른다)가
       **무엇을** 나르는지가 이미 세계에 있게 된다.

    3. 왜 Warmth 가 다한 뒤 Hp 로 넘어가는가 — 그리고 왜 한 Tick 에 둘을 섞지 않는가

       넘어가지 않으면 값 하나가 0 이 되고 아무 일도 없다. 그러면 "어디에 서 있는가가
       결과를 바꾼다" 는 Goal 이 그 지점에서 무너진다 (02-intent.md REVIEW QUESTION 1).

       한 Tick 안에서 "남은 몫을 생명으로 넘긴다" 로 적지 않은 이유는 두 값의 단위가
       다르기 때문이다. 넘기려면 환산이 필요하고, 환산은 이 Cycle 이 답할 이유가 없는
       물음이다. 경계 Tick 하나에서 거두는 양이 조금 어긋나지만 결정론은 온전하고
       읽기는 훨씬 단순하다.

    4. 왜 자리가 상수가 아니라 State 인가

       WORLD STATE 절에 적었다 — 관찰이 지나는 길과, 예외가 사라질 수 있다는 원칙 때문이다.
       값 자체는 헤더 상수(`GROUND_ZONES`)로 고정하고 세계를 띄울 때 State 로 놓는다.
       결정론에 영향을 주는 값이므로 CVar 로 열지 않는다.

## BALANCE — 세계를 띄우는 값

    이 값들은 규칙의 조건이 아니라 **세계를 띄우는 값**이다. 바꿔도 규칙 코드는
    한 줄도 열리지 않는다.

    법칙 하나 — `heat-binding` (열결속, BT §5.1)

        takes       warmth
        rate        4.0 /초       가득한 몸(100)이 25초를 버틴다
        lifeRate    2.0 /초       그 뒤 관찰자의 몸(Hp 200)이 100초, 방랑자(120)가 60초

        가로지르기와 버티기가 갈린다 — 관찰자의 몸은 걷는 속도가 6.0 이므로 지름
        14 를 가로지르는 데 2.3초, 열 9 를 치른다. 스쳐 지나가는 것은 거의 공짜이고
        머무는 것은 값을 치른다. 그것이 이 Cycle 이 묻는 판단의 전부다.

    자리 둘

        zone-ice-field     law      center (-11, 11)  radius 7.0
        zone-sunbreath     respite  center (-13, 13)  radius 2.5

        해숨구멍(sunbreath)은 빙원 **안에** 온전히 들어 있다 — 중심 사이 거리 2.83 에
        반경 2.5 를 더해도 7.0 안이다. 예외가 법칙 안에 있다는 것이 배치로도 참이어야
        한다.

        **자리를 기존 무대의 빈 곳에 놓았다.** 지금 세계가 쓰는 자리는 셋이다 —
        관찰자가 놓이는 원점 부근, 지키는 자리를 가진 방랑자 부근(-10, -8 반경 7),
        광맥(8, -6). 빙원은 이 셋 어디와도 닿지 않는다 (가장 가까운 방랑자의 자리와
        z 로 5 이상 떨어져 있다).

        그래서 **기존 플레이가 한 걸음도 달라지지 않는다.** 캐는 일도 겨루는 일도
        그대로이며, 빙원은 걸어서 찾아가는 것이다. 원점에서 빙원 가장자리까지 8.6 —
        걸어서 한숨 거리다.

    WARMTH_MAX  100    모든 몸이 같다

    자율 존재는 빙원에 들어가지 않는다 — 순회 경로가 닿지 않는다. 이것은 규칙의 예외가
    아니라 **배치의 결과**다. 법칙이 몸을 가리지 않는다는 것은 규칙이 신원을 읽지 않는
    것으로 이미 참이며, 플레이가 아니라 World Scenario 로 검증한다 (Stage 8).
    자율 존재를 빙원 안에 두면 매 세션 구석에서 방랑자 하나가 천천히 얼어 죽는
    세계가 된다 — 그것은 이 Cycle 이 보여주려는 것이 아니다.

## 반환 없음

    GAP 없음. Intent 의 모든 문장이 State 또는 Rule 로 닫혔다.

    다만 02-intent.md 의 REVIEW QUESTION 둘은 그대로 Stage 5 로 간다 — 이 Stage 는
    **지금의 읽기**로 닫았고(다한 뒤 생명에 닿는다 · 되채움은 다음 Cycle), Human 이
    다르게 정하면 되돌아올 자리는 명확하다.

        대안 1 을 고르면    Transition 의 둘째 줄과 SEMANTIC CLOSURE 두 줄이 빠진다.
                           나머지는 그대로다
        대안 2 를 고르면    respite 자리가 Warmth 를 올리는 Transition 을 하나 얻는다.
                           그 값은 BALANCE 에 한 줄 는다
