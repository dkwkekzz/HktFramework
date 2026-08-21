# C023 — World Semantic

> 이 Cycle 이 세계에 더하는 상태는 기술 정의의 값 **셋**뿐이고, 규칙 하나가 그것을
> 답하며, 이미 있는 충돌체 규칙이 전역 상수 대신 그 답을 읽는다. 새 규칙 경로도,
> 새 사건도, 새 저장 상태도 만들지 않는다.

## SEMANTIC DELTA

    REUSED
        ActionCollider (파생)                    C006 — 끝점 자리·반경·활성 구조 그대로
        RULE-SWING-STRIKE-001                    C006 · C007 — 누가 대상이고 닿으면 무슨 일이
                                                 일어나는가. 한 글자도 닿지 않는다
        RULE-SKILL-PHASE-001                     C019 — 구간 경계와 그것을 기술에서 읽는 방식
        RULE-BODY-FACING-001                     C006 — 모양이 서는 기준 방향
        RULE-HARM-GATE-001                       C018 — 닿은 뒤의 성립 판정
        RULE-STRIKE-DAMAGE-001 ·
        RULE-DAMAGE-CALCULATE-001                C007 · C010 (한 글자도 닿지 않는다)
        RULE-SKILL-BUDGET-001                    C007 — 첫 타격에서만 정산
        arcSweepCollider (기반 솔버)              P6 — `arc` · `tipRadius` · `reach` 를 호출마다
                                                 받는다. **기반은 편집하지 않는다**
        Collision.Swing 관찰                      C006 — 끝점 자리·반경·활성·닿은 목록

    ADDED
        SkillDefinition.SwingArc                 훑는 각
        SkillDefinition.SwingReach               몸 중심에서 끝점까지
        SkillDefinition.SwingTipRadius           끝점의 굵기
        RULE-SKILL-SHAPE-001                     그 기술의 모양을 답한다 (파생)
        RULE-ENGAGEMENT-REACHES-001              교전 거리가 모든 기술의 도달 안에 있다 (정합)
        SkillProfile.Shape                       걸기 전에 실리는 모양 셋

    CHANGED
        RULE-ACTION-COLLIDER-001
            지금        끝점의 각·굵기는 세계 상수(SWING_ARC · SWING_BLADE_RADIUS)이고
                        닿는 길이는 그 몸의 교전 거리에서 뺀 값이다
            앞으로      셋 다 RULE-SKILL-SHAPE-001 이 답한 값이다.
                        전역 상수 셋은 사라진다 — 대체가 아니라 폐지다

        Actor.AttackRange → Actor.EngagementRange
            지금        두 가지를 겸한다 — 자율 존재가 다가가는 거리이자
                        칼끝이 닿는 길이의 출처
            앞으로      **다가가는 거리 하나뿐**이다. 값(2.0)도 종류별 출처(카탈로그)도
                        그대로이며, 닿는 길이와의 연결만 끊긴다.
                        대신 RULE-ENGAGEMENT-REACHES-001 이 둘의 정합을 지킨다

        SKILL_DEFINITIONS
            세 정의에 모양 셋이 는다. **기본 기술과 오라 기술의 값은 지금 세계가 쓰던
            것과 한 톨도 다르지 않다** (150° · 1.3 · 0.7). 큰 기술만 움직인다

        SkillProfileView
            모양 셋이 는다 (C019 가 구간 경계를 실은 것과 같은 자리)

    AFFECTED
        RULE-NPC-DECIDE-001         무변경. 교전 거리로 다가가는 것도, 고르는 기준이
                                    "지금 치를 수 있는가" 하나인 것도 그대로다.
                                    다가간 자리에서 어느 기술이든 닿는다는 보장이
                                    RULE-ENGAGEMENT-REACHES-001 로 옮겨간다
        RULE-SKILL-CANCEL-001       무변경. 넓은 모양이 한 휘두름으로 둘 이상의 선딜을
                                    끊을 수 있게 되지만 판정은 접촉마다 지금과 같다
        RULE-HARM-GATE-001          무변경. 닿는 몸이 갈리면 성립하지 않는 접촉의 수도
                                    갈린다 — 사유는 이미 실린다
        RULE-GUARD-DIRECTION-001    무변경. 막기는 맞는 쪽의 방향으로 판정한다.
                                    좁아진 큰 기술은 정면에서만 오므로 오히려 더 자주 막힌다
        RULE-CRITICAL-* · RULE-PENETRATION-* · RULE-DEFENSE-*
                                    무변경. 접촉 건수가 갈리면 계산 횟수가 갈릴 뿐,
                                    한 접촉의 계산은 완전히 같다

## WORLD STATE

    SkillDefinition                                  (기술 정의 — 값의 단일 출처)
        BaseDuration · BaseDamage · AttackRatio ·
        CpCharge · CpCost · DamageType ·
        SwingBegin · SwingEnd                        World Authority (기존)
        SwingArc         훑는 각 (rad, > 0)           World Authority (ADDED)
        SwingReach       끝점까지의 거리 (unit, > 0)   World Authority (ADDED)
        SwingTipRadius   끝점의 굵기 (unit, > 0)       World Authority (ADDED)

    Actor.EngagementRange                            World Authority (종류가 정한다 — 무변경)
        스스로 판단하는 존재가 상대에게 다가가는 거리.
        더 이상 닿는 길이의 출처가 아니다

    ActionCollider (파생 — 저장하지 않는다)            World Authority
        Center · Radius · Active
        지금까지와 같은 구조이며 만드는 값의 출처만 바뀐다

    ── 값 ────────────────────────────────────────────────────────────

    | 기술 | 훑는 각 | 닿는 길이 | 끝의 굵기 | 도달(길이+굵기) |
    |---|---|---|---|---|
    | attack        | 150° | 1.3 | 0.7  | 2.0  |
    | aura-strike   | 150° | 1.3 | 0.7  | 2.0  |
    | heavy-attack  |  40° | 2.2 | 0.55 | 2.75 |

    앞의 둘은 **지금 세계의 값 그대로**다 (SWING_ARC 150° · swingReach(2.0) = 1.3 ·
    SWING_BLADE_RADIUS 0.7). 오라 기술이 기본 기술과 같은 것은 그 층이 만든 차이를
    방식 하나로 좁혀 둔 뜻을 지키는 것이다 (INTENT-AURA-SKILL-001).

    값의 근거는 아래 BALANCE 가 소유한다.

## WORLD RULE

    RULE-SKILL-SHAPE-001 (ADDED)
        Implements     INTENT-SKILL-SHAPE-001 · INTENT-SHAPE-IS-A-VALUE-NOT-A-BRANCH-001
        Input          SkillKind
        Preconditions  없음 — 모든 기술에 답이 있다
        Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
        Result         Shape(SwingArc, SwingReach, SwingTipRadius)

        그 기술의 정의가 지닌 값을 그대로 돌려준다. **어느 기술인지를 묻는 분기가
        이 규칙 안에도 밖에도 없다** — 정의를 찾는 열쇠로 이름을 쓰는 것과 이름 자체를
        판정 조건으로 쓰는 것은 다르다 (DC-SKILL-IS-COMBINATION-NOT-NAME).

        RULE-SKILL-PHASE-001 이 같은 정의에서 구간 경계를 읽는 것과 나란한 규칙이다.

    RULE-ACTION-COLLIDER-001 (CHANGED)
        Implements     INTENT-SHAPE-DECIDES-CONTACT-001
                       (구판: INTENT-ACTION-COLLIDER-001 — C006)
        Input          Actor
        Preconditions  CurrentAction 이 기술이고 진행도가 있다
        Transition     없음 — 파생 상태다
        Result         ActionCollider | 없음

        NEW SOURCE     끝점의 각 · 굵기 · 길이를 RULE-SKILL-SHAPE-001 에서 읽는다.
                       세계 상수 SWING_ARC · SWING_BLADE_RADIUS 와 파생 함수
                       swingReach(EngagementRange) 는 **폐지된다**

        끝점은 지금까지와 똑같이 몸이 향한 방향 기준 `+Arc/2` 에서 `−Arc/2` 로
        쓸고 지나가며, 구간 밖에서는 경계 각에 고정된다. 활성 구간은
        RULE-SKILL-PHASE-001 과 **같은 경계**를 쓴다 — 칼끝이 지나는 동안이 곧 판정
        구간이라는 정합은 C019 가 세운 그대로다.

    RULE-ENGAGEMENT-REACHES-001 (ADDED)
        Implements     INTENT-REACH-BELONGS-TO-THE-SKILL-001
        Input          Actor.EngagementRange, 모든 SkillDefinition
        Preconditions  없음 — 세계가 서는 조건이다
        Transition     없음 — 세계 상태를 바꾸지 않는다 (정합 조건)
        Result         Holds | Violated(기술, 이유)

        모든 기술 s 에 대하여

            SwingReach(s) − SwingTipRadius(s)  ≤  EngagementRange
                                               ≤  SwingReach(s) + SwingTipRadius(s)

        다가간 자리가 어떤 기술의 **안쪽 사각**에 들지 않고, 어떤 기술의 **바깥 도달**
        밖에 놓이지도 않는다는 뜻이다. 그러므로 스스로 판단하는 존재가 다가간 자리에서는
        무엇을 걸어도 닿는다 — 영원히 닿지 못하는 자리에서 헛되이 휘두르는 상태가
        세계에 생기지 않는다.

        상대의 몸 반경은 언제나 바깥쪽을 넓히고 안쪽을 줄이므로, 몸을 빼고 세운 이
        조건은 **보수적**이다. 조건이 서면 실제 접촉은 그보다 넉넉하다.

        이 규칙은 값이 바뀔 때 깨지는 것이 목적이다 — 새 기술이나 새 값이 이 조건을
        어기면 그것이 곧 "다가가는 거리를 함께 정하지 않았다" 는 신호다.

## OBSERVABLE SEMANTIC

    걸기 전 — SkillProfile.Shape                        (INTENT-SHAPE-IS-OBSERVABLE-001)
        SwingArc · SwingReach · SwingTipRadius
        세계가 싣는다. 보는 쪽이 기술 이름으로 자기 표를 만들지 않는다
        (DC-WORLD-OWNS-THE-SURFACE-LIST). 위력 · 기력 수지 · 방식 · 구간 경계가
        실리는 그 자리에 셋이 는다

    거는 동안 — Collision.Swing                         (C006 — 이미 있다)
        Center · Radius · Active · Struck
        구조는 그대로다. 달라지는 것은 **그 값이 기술마다 다르게 나온다**는 사실뿐이다.
        Radius 는 이제 그 기술의 끝의 굵기이고, Center 의 궤적은 그 기술의 각과 길이다

    닿은 뒤 — 기존 관찰 그대로
        Struck                  이 휘두름이 닿은 몸들 (C006)
        UnharmedContact         닿았으나 성립하지 않은 접촉과 그 사유 (C018)
        DamageBreakdown         한 접촉의 계산 경위 전부 (C010 ~ C015)

    ── Observable Closure — 왜 갈렸는가를 읽을 수 있는가 ────────────────

    같은 자리에 선 둘 중 하나만 맞았을 때, 관찰만으로 그 원인을 되짚을 수 있어야 한다
    (INTENT-SHAPE-EXPLAINS-THE-CONTACT-001 · DC-COMBAT-PLAYER-CAUSALITY).

        무엇을 걸었나          CurrentAction (C002)
        그 기술의 모양은        SkillProfile.Shape (ADDED)
        칼끝이 어디를 지났나    Collision.Swing.Center · Radius — Tick 마다 (C006)
        누가 닿았나            Collision.Swing.Struck (C006)
        닿았는데 왜 안 아팠나   UnharmedContact.Reason (C018)
        몸이 어디에 얼마나 크게  Character.Body.Radius · Position (C006)

    끝점의 자리와 굵기, 그리고 각 몸의 자리와 반경이 모두 실리므로 **닿음과 안 닿음이
    관찰만으로 계산된다.** 안 닿은 것을 위한 새 사건을 만들지 않는 이유가 이것이다 —
    없는 사건이 아니라 이미 실린 값들의 결과다.

    모양은 결정적이다. 같은 자리 · 같은 방향 · 같은 기술이면 언제나 같은 것들이 닿는다.

## BALANCE

### ① 왜 큰 기술만 움직이는가

    C019 가 구간 경계를 정의로 내릴 때 큰 기술 하나만 움직이고 기본 기술을 한 톨도
    건드리지 않았다. 같은 이유로 여기서도 기본 기술과 오라 기술의 모양은 지금 값
    그대로다 — **C007 · C010 · C012 · C013 · C015 의 실측이 전부 기본 기술 위에서
    잡혔고**, 그 값들이 흔들리지 않아야 아래 층들이 위층 없이도 서 있다는 것이
    확인된다 (DC-COMBAT-ONE-LAYER-AT-A-TIME).

    움직이는 것은 큰 기술 하나이며, 그것이 이미 다른 축(구간 경계)에서도 유일하게
    움직인 기술이라는 점이 이 선택을 한 번 더 뒷받침한다.

### ② 큰 기술을 왜 좁고 멀게 두는가

    선딜 0.45초를 치르고 나가는 기술이다 (C019). 그 값을 치르고 얻는 것이 지금은
    피해뿐이며 — 같은 궤적으로 같은 것들에 닿는다. 좁고 멀어지면 **치른 값에 대응하는
    성질**이 생긴다.

        얻는 것   정면 먼 곳까지 닿는다. 기본 기술로는 닿지 않는 거리에서 건다
        잃는 것   옆을 훑지 못한다. 붙어 도는 상대나 여럿을 상대할 때는 기본 기술이 낫다
        대가      선딜이 긴 데다 좁기까지 하므로, 걸어 둔 동안 상대가 옆으로 돌면 빗나간다.
                  C019 가 세운 "큰 기술은 읽힌다" 가 공간으로도 성립한다

    이것이 이 Cycle 이 만드는 판단이다 — **여기서는 무엇을 걸까**.

### ③ 값이 실제로 결과를 가르는가 — 판별 자리 둘

    관찰자(rabbit-swordsman · 몸 반경 0.85)가 자율 존재(wanderer · 몸 반경 0.7)를
    치는 기준으로 계산했다. 접촉 조건은 `|끝점 − 상대 중심| ≤ 끝의 굵기 + 상대 몸 반경`.

    옆 (몸이 향한 방향에서 90°, 중심 거리 1.8)

        기본 기술   끝점이 +75° 를 지날 때 상대까지 0.64 ≤ 1.4    → 닿는다
        큰 기술     끝점이 가장 가까울 때도 2.32 > 1.25          → 닿지 않는다

    정면 멀리 (0°, 중심 거리 3.1)

        기본 기술   끝점이 가장 가까울 때 1.82 > 1.4             → 닿지 않는다
        큰 기술     끝점이 0° 를 지날 때 0.90 ≤ 1.25             → 닿는다

    네 판정 모두 여유가 0.35 이상이다 (옆 0.76 · 1.07, 정면 멀리 0.42 · 0.35).
    기본 기술이 정면으로 닿는 최대 거리는 2.70, 큰 기술은 3.45 이므로 그 사이
    어디를 잡아도 갈린다 — 3.1 은 양쪽 여유가 가장 고른 자리다.
    **같은 자리에 선 상대가 기술에 따라 양방향으로 갈린다** — 이것이 Stage 8 의
    판별 각본이다.

### ④ 지금까지 맞던 것이 계속 맞는가

    정면 가까이 (0°, 중심 거리 1.8 — 몸이 서로 밀어내 유지되는 거리 1.55 보다 넉넉하다)

        기본 기술   0.55 ≤ 1.4    → 닿는다 (지금과 같다)
        큰 기술     0.40 ≤ 1.25   → 닿는다 (지금과 같다)

    몸이 서로 밀어내며 유지하는 최소 거리 1.55 에서도 둘 다 닿는다
    (기본 0.32 ≤ 1.4 · 큰 기술 0.65 ≤ 1.25).

    큰 기술의 **안쪽 사각**은 `2.2 − 0.55 − 0.7 = 0.95` 이며, 두 몸이 밀어내며
    유지하는 최소 거리 `0.85 + 0.7 = 1.55` 보다 작다. 그러므로 아무리 붙어도
    큰 기술이 상대를 지나쳐 빗나가는 자리는 생기지 않는다.

    관찰자를 치는 쪽(상대 몸 반경 0.85)에서는 안쪽 사각이 `0.8` 로 더 작다 — 같은 결론이다.

### ⑤ 다가가는 거리는 왜 그대로인가

    교전 거리 2.0 이 RULE-ENGAGEMENT-REACHES-001 을 만족한다.

        기본 · 오라   [1.3 − 0.7, 1.3 + 0.7] = [0.6, 2.0]   ∋ 2.0
        큰 기술       [2.2 − 0.55, 2.2 + 0.55] = [1.65, 2.75] ∋ 2.0

    그러므로 자율 존재의 행동은 **한 Tick도 달라지지 않는다.** 다가가는 거리도,
    고르는 기준도, 그 자리에서 닿는다는 사실도 그대로다.
    이 Cycle 이 자율 존재에게 더하는 것은 조건 하나뿐이며 그 조건은 지금 이미 참이다.

### ⑥ 각이 좁아 Tick 사이로 빠져나가지 않는가

    큰 기술의 판정 구간은 진행도 0.5 ~ 0.85 이고 행동 길이는 0.9 초다 (관찰자 기준) —
    0.315 초, Tick 간격 1/30 로 10 Tick. 40° 를 그 동안 지나므로 Tick 당 4°,
    끝점이 움직이는 거리는 `2.2 × 0.070 ≈ 0.154` 이다. 잡는 반경 1.25 에 견주면
    한참 작다 — 사이로 빠져나갈 자리가 없다.

    좁아진 각은 오히려 지금보다 촘촘하다. 기본 기술은 9 Tick 동안 150° 를 지나며
    Tick 당 `1.3 × 0.291 ≈ 0.378` 을 움직인다 (지금 값 그대로).

## SEMANTIC CLOSURE

    "기술에는 닿는 모양이 있다"
        → SkillDefinition.SwingArc · SwingReach · SwingTipRadius (ADDED)

    "모양은 기술이 지닌 성질이다"
        → RULE-SKILL-SHAPE-001 — 정의가 답한다

    "방식만 다른 기술은 모양도 같다"
        → 값 표 — attack 과 aura-strike 가 같은 셋을 지닌다

    "얼마나 멀리 닿는가는 그 기술의 것이다"
        → SwingReach 가 정의에 있고 EngagementRange 와 연결이 끊긴다 (CHANGED)

    "몸의 교전 거리와 같은 값이어야 할 이유가 없다"
        → Actor.EngagementRange 는 다가가는 거리만 뜻한다 (CHANGED)

    "그 어긋남이 세계를 망가뜨려서는 안 된다"
        → RULE-ENGAGEMENT-REACHES-001 (ADDED)

    "끝점은 그 기술의 모양대로 선다"
        → RULE-ACTION-COLLIDER-001 NEW SOURCE (CHANGED)

    "좁은 모양은 정면 먼 것에 닿고 옆을 놓친다"
    "넓은 모양은 옆까지 훑는다"
    "같은 자리가 기술에 따라 갈린다"
        → 값 표 + BALANCE ③ 의 판별 자리 둘

    "판정은 어느 기술인지를 묻지 않는다"
        → RULE-SKILL-SHAPE-001 — 이름 분기 없음.
          RULE-ACTION-COLLIDER-001 이 그 결과만 읽는다

    "다르게 닿는 기술을 더하는 일은 값 한 벌을 더하는 일이다"
        → 모양이 SkillDefinition 안에 있고 규칙이 그것만 읽으므로 성립한다.
          Stage 8 의 판별 검사: **모양 값을 바꿔도 규칙 코드가 한 줄도 열리지 않는다**

    "걸기 전에 모양을 안다"
        → SkillProfile.Shape (ADDED)

    "그 값은 세계가 싣는다"
        → World Authority — SkillDefinition 이 단일 출처다

    "왜 갈렸는지 되짚어 읽을 수 있다"
        → OBSERVABLE SEMANTIC 의 Observable Closure 여섯 항

    "모양은 결정적이다"
        → 파생 판정 셋 모두 난수를 입력으로 받지 않는다

    "닿은 뒤에 일어나는 일은 완전히 같다"
        → RULE-SWING-STRIKE-001 · RULE-HARM-GATE-001 · RULE-STRIKE-DAMAGE-001 ·
          RULE-DAMAGE-CALCULATE-001 · RULE-SKILL-BUDGET-001 전부 REUSED (무변경)

    "여럿을 세는 규칙도 나눠 주는 감쇄도 없다"
        → ADDED 목록에 그런 State 도 Rule 도 없다. 접촉은 지금처럼 몸마다 한 번씩이다
