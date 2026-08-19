# C016 — World Semantic

> 세계에 더해지는 것은 성질 하나와 문턱 셋뿐이다. 새 행동도, 새 장부도, 새 사유 코드도,
> 새 난수도 만들지 않는다. C014 가 세운 가려짐의 관문 안에서 판정 하나가 넓어질 뿐이다 —
> "살펴봤는가" 하나를 보던 자리가 "살펴봤는가 · 내 통찰이 이 자리에 미치는가" 둘을 본다.
> 그 한 줄이 앎을 전부/전무에서 자리 단위로 바꾸고, 능력이 오를 때 커지는 것을
> 숫자에서 이해의 범위로 바꾼다.

## SEMANTIC DELTA

    REUSED
        World.Acquaintances                     살펴봄으로 얻은 앎의 장부 (C014) — 모양 그대로
        Actor.CurrentAction.Kind = observe      살펴보는 행동 (C014) — 시간·거리·중단 그대로
        CONCEALABLE_ATTRIBUTE_KEYS              가려질 수 있는 자리의 목록 셋 (C014) —
                                                늘리지도 줄이지도 않는다
        Actor.PhysicalAttack · AuraAttack · Armor · Resistance · ArmorPenetration ·
        ResistancePenetration · CriticalChance · CriticalDamage
                                                가려지는 대상 (C010·C012·C013·C015) — 값도 뜻도 그대로
        World.DebugAuthority                    값 조작·되돌림의 관문 (C007 R2 · C009)

    ADDED
        Actor.Insight                           통찰 — 살펴보지 않고도 아는 범위를 정하는 성질
        INSIGHT_REVEAL_THRESHOLDS               자리마다 요구하는 통찰 (헤더 상수 · 결정론)
        RULE-INSIGHT-REVEAL-001                 지금 이 존재의 어느 자리가 가려져 있는가의 판정

    CHANGED
        RULE-OBSERVE-BEGIN-001
            CHANGED PRECONDITION 5   "아직 그 존재를 알지 못한다"
                                   → "그 존재에 대해 아직 열 자리가 남아 있다"
                                     (사유 코드 already-known 은 그대로)
        RULE-ATTRIBUTE-SET-001
            CHANGED INPUT DOMAIN     MutableAttribute 목록에 insight 가 더해진다
        Observable `acquainted`
            CHANGED MEANING          "이 존재를 살펴봤다" → "이 존재에 대해 가려진 자리가 없다"
        Observable `concealed`
            CHANGED VALUE            셋 전부 또는 빈 배열 → 지금 가려진 자리들의 **부분 목록**

    AFFECTED
        RULE-OBSERVE-COMPLETE-001   무변경. 살펴봄은 여전히 장부에 Id 하나를 더하고,
                                    장부에 담긴 존재는 모든 자리가 열린다
        RULE-OBSERVE-FORGET-001     무변경. 지우는 것은 장부뿐이므로 통찰이 연 자리는
                                    되돌린 뒤에도 열려 있다 — 규칙을 고치지 않고
                                    두 길이 갈린다 (NOTE ③)
        Observer Projection         가려짐 관문이 통찰을 함께 읽는다. 관문의 자리는 그대로다
        CharacterKind 카탈로그       모든 종류에 통찰 기본값이 더해진다 (전부 0)
        RULE-NPC-DECIDE-001         무변경. 자율 존재는 관찰 계약이 아니라 세계 상태를
                                    직접 읽으므로 통찰이 그 판단에 닿지 않는다
        RULE-DAMAGE-CALCULATE-001 · RULE-STRIKE-DAMAGE-001 · RULE-CRITICAL-STRIKE-001 ·
        RULE-GUARD-BLOCK-001        무변경 — 통찰은 계산에 한 글자도 더하지 않는다.
                                    C015 의 실측값이 그대로 나와야 한다 (Regression 기준)

## WORLD STATE

    Actor.Insight                                World Authority
        통찰. 0 이상 100 이하의 수이며 모든 존재가 지닌다.
        높을수록 살펴보지 않고도 아는 자리가 많다.
        기본값은 모든 종류에서 **0** 이다 — 그래야 이 Cycle 전의 세계와 한 톨도 다르지 않다.

        이 값은 **몸의 성질**이다 (INTENT-INSIGHT-001). 앎은 여전히 보는 이의 것이며
        (World.Acquaintances), 어느 자리가 열리는지는 **보는 이가 지금 조종하는 몸**의
        통찰이 정한다. 몸이 없는 보는 이는 통찰이 없는 것과 같으나 — 관찰 자체가
        만들어지지 않으므로 (Observer Projection) 실제로 그 자리에 도달하지 않는다.

        자율 존재도 값을 지니지만 쓰지 않는다. 그들은 가려짐 관문 밖이다.

        이 값은 겨루는 계산의 어느 입력도 아니다. 어떤 Rule 의 Precondition 도,
        어떤 피해·기력·속도 식의 항도 아니다 (INTENT-INSIGHT-NOT-A-GATE-001).

    INSIGHT_REVEAL_THRESHOLDS                    헤더 상수 (결정론)
        자리마다 요구하는 통찰. 단일 출처는 CONCEALABLE_ATTRIBUTE_KEYS 와 **같은 자리**다 —
        목록과 문턱이 떨어져 있으면 자리를 늘릴 때 한쪽만 고쳐질 수 있다.

            defenseShape       30      얕다 — 어느 버팀이 무른가, 형태를 읽는 일
            versusObserver     60      중간 — 내 통함이 저 버팀에 얼마로 닿는가
            combatStats        90      깊다 — 저 존재가 지닌 값들 그 자체

        문턱은 대상과 무관하다. 어떤 존재는 더 읽기 어렵다는 의미를 이 Cycle 은 세우지 않는다.

## WORLD RULE

    RULE-INSIGHT-REVEAL-001 (ADDED)
        Implements     INTENT-INSIGHT-OPENS-001 · INTENT-OBSERVE-KNOWLEDGE-001 ·
                       INTENT-UNSEEN-CAPABILITY-001
        Input          보는 이, 대상 존재
        Preconditions  없음 — 언제나 답이 있는 판정이다
        Transition     **없다.** 이 판정은 세계 상태를 바꾸지 않는다
        Result         지금 이 존재에 대해 가려진 자리들의 목록

            대상이 자기 몸이면            → 빈 목록 (자기 것은 언제나 전부 열린다)
            보는 이의 장부에 담겨 있으면   → 빈 목록 (살펴본 존재는 전부 열린다)
            그 외                        → CONCEALABLE_ATTRIBUTE_KEYS 중
                                          보는 이의 몸의 Insight < 그 자리의 문턱인 것들

        상태를 바꾸지 않는 판정이므로 이것은 투영의 관문 자리에 선다 —
        C014 가 가려짐을 투영에서 처리한 그 자리이며 (C014 06 NOTES ④),
        세계의 사실(Actor 가 지닌 값)은 그대로 있고 관찰에 실릴 때 이 관문을 지난다.
        그래서 자율 존재의 판단에 비대칭이 생기지 않는다.

        통찰이 내려가면 같은 판정이 다시 가려진 목록을 내놓는다 —
        연 것을 어디에도 적어 두지 않기 때문이다 (INTENT-INSIGHT-OPENS-001).

    RULE-OBSERVE-BEGIN-001 (CHANGED — 거절의 뜻이 자리 단위로 읽힌다)
        Implements     INTENT-OBSERVE-001
        Input          요청한 ObserverId, 대상 ActorId
        Preconditions  1 그 관찰자의 몸이 세계에 있다                        (no-body)
                       2 대상 Id 의 존재가 세계에 있다                       (no-such-target)
                       3 대상이 자기 몸이 아니다                             (target-is-self)
                       4 두 몸 중심 거리 ≤ OBSERVE_RANGE                     (out-of-range)
                       5 **RULE-INSIGHT-REVEAL-001 의 결과가 비어 있지 않다** (already-known)
                       6 RULE-ACTION-BEGIN-001 관문 통과                     (action-busy)
        Transition     CurrentAction = { kind: observe, targetActorId, duration: 1.0 }
        Result         Success | Failure(reason)

        5 만 바뀐다. 통찰로 일부가 열린 상대는 아직 가려진 자리가 있으므로 살펴볼 수 있고,
        통찰이 100 인 몸에게는 처음부터 거절된다 — 더 열 자리가 없기 때문이다.
        사유 코드는 already-known 그대로다: 새 사유를 만들지 않는다 (NOTE ④).
        시간·거리·중단·무해함은 한 글자도 바뀌지 않는다.

    RULE-OBSERVE-COMPLETE-001 (REUSED — 무변경)
        살펴봄을 마치면 장부에 대상 Id 를 더한다. 장부에 담긴 존재는 통찰과 무관하게
        모든 자리가 열린다 — 통찰이 0 인 몸도 살펴보면 전부 안다
        (INTENT-INSIGHT-NOT-A-GATE-001).

    RULE-OBSERVE-FORGET-001 (REUSED — 무변경, 뜻만 넓어진다)
        지우는 것은 장부뿐이다. 되돌린 직후 그 존재에 대해 다시 가려지는 것은
        **통찰이 미치지 못하는 자리들**이며, 통찰이 연 자리는 그대로 열려 있다.
        규칙을 고치지 않고 두 길이 갈린다 (INTENT-OBSERVE-FORGET-001 · NOTE ③).

    RULE-ATTRIBUTE-SET-001 (CHANGED — 바꿀 수 있는 성질에 통찰이 더해진다)
        MutableAttribute 목록에 `insight` (min 0 · max 100) 이 더해진다.
        Precondition·Transition·사유 코드는 그대로다.
        이것이 이 Cycle 의 확인 경로다 — 통찰을 올렸다 내리며 가려진 목록이
        줄고 느는 것을 본다 (INTENT-ATTRIBUTE-MUTATE-001 재사용).

## OBSERVABLE SEMANTIC

    존재마다 (entities[].attributes)
        insight               ADDED — 그 존재의 통찰. **모든 존재에 언제나 실린다.**
                              가려질 수 있는 목록에 넣지 않는다 (01 EXCLUDED — 목록 무변경).
                              자기 통찰이 보이지 않으면 아는 범위가 왜 그만큼인지 알 수 없다
        acquainted            CHANGED — "이 존재에 대해 가려진 자리가 하나도 없다".
                              살펴봤거나, 통찰이 세 문턱을 모두 넘었거나, 자기 몸일 때 참이다.
                              언제나 실린다 (모른다는 것 자체가 관찰이어야 한다)
        concealed             CHANGED — 지금 가려진 자리들. 이제 **부분 목록**일 수 있다
                              (예: 통찰 60 이면 `["combatStats"]` 하나만 남는다).
                              단일 출처는 여전히 세계다 — 보는 이가 문턱을 자기 코드에 적지 않는다
        unacquaintedReason    무변경 — 가려진 것이 있을 때 `not-observed`.
                              통찰이 미치지 못한 자리도 **살펴보면 열리므로** 그 사유가 참이다
        combatStats           그 자리가 열렸을 때만 실린다 (통찰 ≥ 90 또는 살펴봄)
        versusObserver        그 자리가 열렸을 때만 실린다 (통찰 ≥ 60 또는 살펴봄)
        defenseShape          그 자리가 열렸을 때만 실린다 (통찰 ≥ 30 또는 살펴봄)
        그 밖의 모든 속성      무변경 — 언제나 실린다

        열린 자리의 값은 살펴봐서 열렸든 통찰로 열렸든 **완전히 같다.**
        흐린 값도, 대략의 범위도, 출처 표시도 없다 (INTENT-INSIGHT-OPENS-001).

    할 수 있는 일 (interactions)
        observe               무변경 — 존재마다 하나. available 과 reason 은
                              RULE-OBSERVE-BEGIN-001 의 판정을 그대로 싣는다.
                              통찰이 100 인 몸에게는 처음부터 available=false reason=already-known
        forget-acquaintance   무변경

    바꿀 수 있는 성질 (commands / attribute-set)
        insight 가 목록에 실린다 — 무엇을 바꿀 수 있는지도 세계가 싣는다
        (INTENT-COMMAND-CATALOG-001 그대로)

    Before → Input → Rule → After  ① 통찰이 자리를 연다
        Before  관찰자 player-1 의 몸 insight = 0 · wanderer 를 살펴본 적 없음
                wanderer 에 대해 concealed = [defenseShape · versusObserver · combatStats] ·
                acquainted = false
        Input   AttributeSet(player-1 의 몸, insight, 60)
        Rule    RULE-ATTRIBUTE-SET-001 → RULE-INSIGHT-REVEAL-001
        After   concealed = [combatStats] · acquainted = false ·
                defenseShape 과 versusObserver 가 실린다 (값은 C012·C013 그대로) ·
                interactions.observe(wanderer) available = true (아직 열 자리가 남았다)

    Before → Input → Rule → After  ② 되돌림이 두 길을 가른다
        Before  insight = 60 · wanderer 를 살펴봐서 장부에 담겨 있다 → concealed = []
        Input   ForgetAcquaintance(player-1, wanderer)
        Rule    RULE-OBSERVE-FORGET-001 → RULE-INSIGHT-REVEAL-001
        After   concealed = [combatStats] — **셋이 아니다.**
                살펴봄으로 얻은 것만 사라지고 통찰이 연 둘은 남는다

    Before → Input → Rule → After  ③ 통찰이 관문이 아니다
        Before  insight = 0 · wanderer 를 살펴본 적 없음 → concealed = 셋
        Input   Observe(player-1 → wanderer) → 1.0 초
        Rule    RULE-OBSERVE-BEGIN-001 → RULE-OBSERVE-COMPLETE-001 → RULE-INSIGHT-REVEAL-001
        After   concealed = [] · 통찰 90 인 몸과 **똑같은 것을 안다**

## BALANCE

    이 Cycle 이 정하는 수는 넷뿐이다. 능력치도 피해도 사거리도 시간도 건드리지 않는다.

    Actor.Insight 기본값 = 0 (모든 CharacterKind)
        기본값이 0 이므로 통찰을 올리기 전의 세계는 C015 와 **한 톨도 다르지 않다.**
        C015 가 criticalChance 0 으로 그것을 보인 것과 같은 자리다 —
        새 축이 기본으로 켜져 있으면 이전 Cycle 의 실측값이 전부 흔들린다.

    Actor.Insight 범위 = 0 … 100
        상한 100 이 곧 "전부 읽는 눈" 이다. 세 문턱을 모두 넘는 값이 범위 안에 있어야
        "통찰만으로 전부 아는 몸" 을 만들어 볼 수 있고, 그때 살펴봄이 거절되는 것까지
        확인된다.

    INSIGHT_REVEAL_THRESHOLDS = 30 · 60 · 90
        간격이 같아 다음 자리가 어디인지 세지 않아도 읽힌다.
        0 에서 시작하므로 아무것도 열리지 않은 상태가 기본이고,
        30·60·90 에서 한 자리씩 열려 **한 축을 올리며 세 국면을 다 볼 수 있다.**

    차례 — 왜 형태 → 관계 → 값인가
        얕은 것은 겉으로 드러나는 인상이고 깊은 것은 정확한 수다.
        `defenseShape` 는 "저쪽은 오라가 무르다" 하나이며 겨루지 않아도 짐작할 수 있는
        종류의 앎이다. `versusObserver` 는 나와 저것 사이의 값이라 내 것을 알아야 성립하고,
        `combatStats` 는 저 존재가 지닌 여덟 개의 수 그 자체다.
        BW §32 의 사슬(관찰 → 이해 → 대응 발견)에서 형태는 관찰에, 관계는 이해에,
        값은 대응에 가깝다.

    이 Cycle 이 바꾸지 않는 수
        OBSERVE_RANGE 5.0 · observe.duration 1.0 (C014) ·
        능력치 초기값 · 피해 상수 · 관통 상수 · 흔들림의 뿌리 (C010·C012·C013·C015)
        — 통찰 0 에서 이전 Cycle 의 모든 실측값이 그대로 나오는 것이 Regression 기준이다.

## SEMANTIC CLOSURE

    INTENT-INSIGHT-001
        "존재는 통찰이라는 성질을 지닌다"        → Actor.Insight (World Authority)
        "높을수록 살펴보지 않고도 아는 것이 많다"  → RULE-INSIGHT-REVEAL-001 의 비교
        "몸에 붙은 성질이다"                     → Actor 의 성질로 둔다 (관찰자가 아니다)
        "보는 이가 지금 지닌 몸의 통찰이 정한다"   → 판정이 actorOfObserver 의 Insight 를 읽는다
        "겨루는 일에 닿지 않는다"                 → 어떤 Rule 의 Precondition 도 계산 항도 아니다
                                                (AFFECTED 에 계산 Rule 무변경으로 명시)
        "자율 존재는 이 성질을 쓰지 않는다"        → 판정이 투영 관문에만 있다 (RULE-NPC-DECIDE-001 무변경)

    INTENT-INSIGHT-OPENS-001
        "통찰이 미치면 그 자리는 이미 열려 있다"   → RULE-INSIGHT-REVEAL-001 의 세 번째 갈래
        "열린 자리는 세계의 지금 값을 보인다"      → 판정은 목록만 내놓고 값은 그때의 Actor 에서 읽는다
        "자리마다 요구하는 통찰이 다르다"          → INSIGHT_REVEAL_THRESHOLDS
        "얕은 자리가 먼저 열린다"                 → 30 · 60 · 90 의 차례
        "문턱은 상대와 무관하다"                  → 문턱이 대상 Actor 를 읽지 않는다
        "통찰이 내려가면 다시 가려진다"            → Transition 없음 — 연 것을 적어 두지 않는다

    INTENT-INSIGHT-NOT-A-GATE-001
        "통찰이 없어도 살펴보면 전부 안다"         → RULE-OBSERVE-COMPLETE-001 무변경 +
                                                판정의 두 번째 갈래(장부에 담기면 빈 목록)
        "통찰이 열어 주는 것은 정보이지 결과가 아니다" → 계산 Rule 무변경 (AFFECTED)

    INTENT-OBSERVE-KNOWLEDGE-001 (CHANGED)
        "아는 일은 자리마다 정해진다"              → 판정의 결과가 목록이다 (참/거짓이 아니다)
        "값을 베끼지 않는다"                      → 장부는 Id 만 담는다 (C014 그대로)
        "여는 길이 둘이다"                        → 판정의 두 번째·세 번째 갈래
        "두 길이 겹쳐도 다툼이 없다"               → 목록에서 빠지면 열린 것이다 (합집합이 아니라 차집합)

    INTENT-UNSEEN-CAPABILITY-001 (CHANGED)
        "살펴보지 않았고 통찰도 미치지 못한 자리"   → 판정의 세 번째 갈래
        "목록은 그대로다"                         → CONCEALABLE_ATTRIBUTE_KEYS 무변경
        "자기 몸은 전부 보인다"                    → 판정의 첫 번째 갈래

    INTENT-OBSERVE-001 (CHANGED)
        "더 열 자리가 없을 때만 거절된다"          → RULE-OBSERVE-BEGIN-001 Precondition 5
        "시간·거리·중단·무해함 그대로"             → 나머지 Precondition 과 Transition 무변경

    INTENT-OBSERVE-FORGET-001 (CHANGED)
        "되돌리는 것은 살펴봄의 결과뿐이다"        → RULE-OBSERVE-FORGET-001 무변경 (장부만 지운다)
        "통찰이 연 자리는 그대로 열려 있다"        → 판정이 장부와 통찰을 따로 본다
        "되돌린 뒤 남는 자리가 통찰의 몫이다"      → OBSERVABLE 의 국면 ②

    INTENT-INSIGHT-OBSERVE-001
        "통찰은 관찰에 실린다"                    → attributes.insight
        "가려지는 목록에 들어가지 않는다"          → CONCEALABLE_ATTRIBUTE_KEYS 무변경
        "가려진 목록이 짧아지고 길어진다"          → concealed 가 부분 목록이 된다

    닫히지 않은 문장 없음. GAP 없음.

## NOTE — 네 가지 설계 판단의 근거

    ① 통찰은 몸에, 앎은 보는 이에게
       C014 는 앎을 관찰자의 것으로 두었다 (한 몸을 둘이 번갈아 조종해도 앎이 갈린다).
       통찰을 관찰자에 두면 그 대칭이 유지되지만, 통찰은 **기르는 능력**이고 이 세계에서
       기르는 것은 전부 몸에 있다 (능력치·기력·속도). 통찰만 사람에게 두면 다음 Cycle 이
       "무엇이 통찰을 기르는가" 를 열 때 성장의 대상이 둘로 갈린다.
       그래서 몸에 둔다 — 겪은 것은 몸에 쌓이고, 알아낸 것은 사람에게 남는다.
       판정은 `보는 이 → 그의 몸 → 그 몸의 Insight` 로 한 칸을 더 거친다.
       이 판단은 Stage 5 가 확인한다 (01 SCOPE NOTE ①).

    ② 관계값이 열리면 상대의 버팀을 되짚을 수 있다
       `versusObserver` 는 상대의 방어에서 내 관통을 걷어낸 값이다. 내 관통을 아는 자는
       거기서 상대의 방어를 되짚을 수 있으므로, 60 에서 `combatStats` 의 두 값이 사실상
       새어 나간다. 이것을 막지 않는다 — C014 가 "반복해 때려 보는 것으로 짐작하는 길"
       을 막지 않은 것과 같은 이유다. 세계가 막는 것은 **알려주는 일**이지 추론이 아니며,
       추론으로 이르는 앎은 플레이어의 것이다. 차례의 타당성은 Stage 5 가 확인한다.

    ③ 되돌림이 코드 한 줄 없이 두 길을 가른다
       살펴봄은 장부에 남고 통찰은 남지 않는다. 그래서 장부만 지우는 기존 규칙이
       "살펴봄의 결과만 되돌린다" 를 저절로 만족한다. C014 가 중단을 위해 새 규칙을
       쓰지 않았던 것과 같은 자리다 — 구조가 맞으면 규칙이 늘지 않는다.

    ④ 새 사유 코드를 만들지 않는 이유
       통찰이 미치지 못한 자리의 사유도 `not-observed` 다. `insight-too-low` 를 만들면
       두 사유가 같은 자리를 두고 다투고, 무엇보다 그것이 **틀린 말이 아니다** —
       그 자리는 살펴보면 열린다. 사유는 "무엇을 하면 열리는가" 를 말해야 하며,
       살펴봄은 어느 자리에나 통한다. `already-known` 도 같은 이유로 그대로 둔다:
       뜻이 "더 열 자리가 없다" 로 읽힐 뿐 화면 문구가 어긋나지 않는다.
