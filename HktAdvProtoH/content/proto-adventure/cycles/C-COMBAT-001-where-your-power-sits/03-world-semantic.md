# C-COMBAT-001 — World Semantic

> Intent 이 세운 것은 셋이다 — 몸에 이름 붙은 배분 하나가 있고, 그것이 판정이 읽는 값에
> 항으로 들어가며, 그 형태는 서로에게 보인다. 이 단계가 그것을 State · Rule · Observable
> 로 닫는다. **새 계산 축을 세우지 않는다** — 유효 값을 세는 자리는 C023 이 이미 세웠고
> 여기서는 그 합에 항이 하나 늘 뿐이다.

## SEMANTIC DELTA

    REUSED
        ActorState.physicalAttack · armor · resistance · auraAttack       C010 · C012
        ActorState.insight                                                C016
        ActorState.cp / cpMax                                             C007
        equipmentContributions                                            C023
        defenseMultiplier · effectiveDefense · penetrationRemainingRatio   C010 · C012 · C013
        rawDamage · offenseStatValue · defenseStatValue                   C010 · C012
        DAMAGE_TYPE_STATS                                                 C012 · C013
        CONCEALABLE_ATTRIBUTE_KEYS · INSIGHT_REVEAL_THRESHOLDS            C016
        isDowned                                                          C007

    ADDED
        Actor.Allocation                        지금의 배분 — 이름 하나
        World.AllocationCatalog                 배분의 목록과 각 배분의 세 몫
        World.AllocationAxes                    어느 값이 어느 축에 드는가 + 몫 한 점의 크기
        World.AllocationShareTotal / EvenShare  몫의 합과 고른 몫 (합이 같음의 근거)
        World.AllocationSwitchCpCost            바꾸는 대가
        AllocatableStat                         배분이 보탤 수 있는 값의 목록 (다섯)
        EffectiveStatName                       유효 값을 물을 수 있는 값의 목록 (아홉)
        allocationContribution                  파생 — 이 배분이 이 값에 보태는 양
        RULE-ALLOCATION-SET-001                 배분을 바꾼다
        RULE-NPC-ALLOCATION-001                 자율 존재가 국면에 따라 바꾼다

    CHANGED
        RULE-EFFECTIVE-STATS-001
            NEW TERM        합에 `allocationContribution` 이 더해진다
            NEW FLOOR       결과는 0 아래로 내려가지 않는다 (배분이 음의 항을 낳는다)
            WIDER DOMAIN    물을 수 있는 값이 여덟에서 아홉으로 — `insight` 가 든다
        RULE-INSIGHT-REVEAL-001
            CHANGED INPUT   보는 이의 통찰을 **유효 값**으로 읽는다 (기본값이 아니라)
        RULE-OBSERVE-BEGIN-001
            CHANGED INPUT   `already-known` 판정이 같은 유효 값을 읽는다
        DamageBreakdown (관찰)
            NEW FIELDS      치는 쪽·맞는 쪽의 배분 이름과, 배분이 고른 값에 보탠 몫

    AFFECTED — 규칙 문장은 그대로이나 읽는 값이 달라진다
        RULE-DAMAGE-CALCULATE-001     공격·방어·관통을 유효 값으로 읽는다 (C023 이래)
        RULE-CRITICAL-STRIKE-001      치명 둘은 어느 축에도 들지 않아 배분과 무관하다
        RULE-GUARD-BLOCK-001          막기가 읽는 값은 그대로다 — 배분은 막기 비율에 닿지 않는다
        RULE-SWING-STRIKE-001         무변경
        RULE-NPC-DECIDE-001           기술 고르기는 그대로다. 배분은 나란한 판정이 정한다
        projection/observer-view      능력치 줄과 통찰 줄이 유효 값으로 실린다

## WORLD STATE

    Actor
        Allocation          World Authority   지금의 배분 이름. 초기값 `balanced`.
                            **모든 몸이 언제나 정확히 하나를 지닌다** — 비어 있는 값이 없다.
                            조종 주체를 가리지 않는다 (관찰자의 몸도 자율 존재도 같다)

    World (세계가 지닌 값 — 헤더 상수. 결정론에 영향을 주므로 CVar 로 열지 않는다)

        AllocationShareTotal = 6
        AllocationEvenShare  = 2
                            세 몫의 합은 언제나 6 이고, 고르게 나누면 각 2 다.
                            **이것이 "합이 같다" 의 근거다** — 목록의 어느 항목도 합 6 을
                            어길 수 없고, 어기면 그것은 배분이 아니다

        AllocationCatalog   이름 → 세 몫 (body · ability · awareness)

                                balanced    2 · 2 · 2      균형
                                reinforce   4 · 1 · 1      몸에 몬다
                                hatsu       1 · 4 · 1      능력에 몬다
                                hunter      1 · 1 · 4      인지에 몬다

                            **판정은 이 이름을 조건으로 삼지 않는다.** 규칙이 묻는 것은
                            "지금 배분의 몫이 얼마인가" 뿐이므로, 항목을 늘리거나 몫을
                            고치는 일에 규칙도 관찰도 열리지 않는다

        AllocationAxes      축 → { 그 축이 지닌 값 : 몫 한 점이 그 값에 보태는 양 }

                                body       physicalAttack  8
                                           armor          10
                                           resistance      6
                                ability    auraAttack     12
                                awareness  insight        20

                            **세 축이 지닌 값은 서로 겹치지 않는다** (INTENT-EACH-AXIS-
                            OWNS-ITS-OWN-VALUES-001). 이 표가 그 사실의 단일 출처다.
                            관통 둘과 치명 둘은 **어느 축에도 들지 않는다** — 배분을
                            바꿔도 움직이지 않으며 그것이 그 값들의 성질이다

        AllocationSwitchCpCost = 15
                            배분을 바꾸는 데 드는 기력. 기존 기력에서 나온다
                            (DC-COMBAT-SHARED-BUDGET) — 배분 전용 자원은 없다

        NpcAllocationHurtRatio = 0.5
                            자율 존재가 몸에 몰기 시작하는 생명 문턱

    파생 (저장하지 않는다)

        allocationContribution(allocation, stat)
                            = (그 값이 든 축의 몫 − AllocationEvenShare) × 그 값의 몫 한 점
                            어느 축에도 들지 않는 값이면 0.
                            **고른 배분(2·2·2)에서는 모든 값이 0 이다** —
                            INTENT-THE-EVEN-ALLOCATION-ADDS-NOTHING-001 이 구조로 성립한다

        AllocatableStat     physicalAttack · armor · resistance · auraAttack · insight (다섯)
        ContributableStat   C023 의 여덟 — **한 글자도 바뀌지 않는다**
        EffectiveStatName   위 둘의 합집합 (아홉). 유효 값을 물을 수 있는 값의 목록이며,
                            걸린 것이 보태는 목록과 배분이 보태는 목록은 서로 다르다

## WORLD RULE

    RULE-EFFECTIVE-STATS-001 (CHANGED)
        Implements     INTENT-ALLOCATION-ENTERS-THE-EFFECTIVE-VALUE-001 ·
                       INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 (CHANGED) ·
                       INTENT-THE-EVEN-ALLOCATION-ADDS-NOTHING-001
        Input          Actor, EffectiveStatName
        Preconditions  없음 — 언제나 답할 수 있다
        Transition     없음 (읽기 판정)
        Result         Effective = max(0,
                           Base
                         + Σ 걸린 것들의 기여        (C023 — 그대로)
                         + 이 배분이 이 값에 보태는 양 (ADDED))

        **저장하지 않는다** — C023 의 판단 그대로다. 배분을 바꿀 때 값을 더하고 되돌릴 때
        빼는 형태가 아니라 기본값에서 매번 다시 센다. 그래서 백 번 바꾸어도 값이 표류하지
        않는 것이 검사가 아니라 구조다.

        **바닥이 생긴다.** 배분이 처음으로 **음의 항**을 낳으므로 합이 0 아래로 내려갈 수
        있다. 음의 방어는 감쇄식을 1 초과로 만들어 "맞으면 더 아프다" 를 낳고, 음의 통찰은
        문턱 비교의 뜻을 흐린다. 그래서 결과에 0 바닥을 둔다.
        **이 바닥은 지금까지의 어떤 결과도 바꾸지 않는다** — 기본값이 0 이상이고 걸린
        것의 기여가 음이 아니므로 배분 전에는 언제나 0 이상이었다 (회귀 무변경).

        바닥의 대가 하나를 적어 둔다: 어떤 값이 이미 0 인 몸은 그 축에서 덜어 갈 것이
        없으므로 몰아 두는 일에 잃을 것이 없다. 지금 세계에서 그런 값은 `insight`(0) 이며,
        그래서 통찰을 기르지 않은 몸에게 `hunter` 밖의 배분은 인지 쪽 손해가 없다.
        이것은 결손이 아니라 **아직 기르지 않았다는 사실**이다 — 통찰이 오르면 그때부터
        덜어 갈 것이 생긴다.

    RULE-ALLOCATION-SET-001 (ADDED)
        Implements     INTENT-CHANGE-ALLOCATION-001 · INTENT-CHANGE-ALLOCATION-REFUSAL-001 ·
                       INTENT-BODY-HAS-AN-ALLOCATION-001
        Input          Actor, 요청한 배분 이름
        Preconditions  ① 요청한 이름이 AllocationCatalog 에 있다   아니면 unknown-allocation
                       ② 쓰러지지 않았다                          아니면 downed
                       ③ 요청이 지금과 **다르면** Cp >= 15         아니면 insufficient-cp
        Transition     요청이 지금과 같으면 아무것도 하지 않는다
                       다르면  Cp −= 15
                               Allocation = 요청값
        Result         Success | Failure(unknown-allocation | downed | insufficient-cp)

        **요청은 토글이 아니라 명시값이다** — 같은 요청이 두 번 와도 결과가 같다
        (RULE-MOVE-MODE-001 의 형태 그대로).

        지금과 같은 배분을 고르는 일은 성공이며 아무것도 바뀌지 않는다. 대가도 들지 않는다 —
        이미 그 자리에 있는 것에 값을 물릴 이유가 없다. 실패로 두지 않는 이유는
        INTENT-CHANGE-ALLOCATION-REFUSAL-001 이 적었다: 그것은 거절이 아니다.

        **바뀌는 것은 그 순간부터다.** 이미 나간 판정(진행 중인 휘두름의 피해 산정)은
        타격이 성립하는 시점에 유효 값을 다시 세므로, 휘두르는 도중에 바꾸면 그 타격은
        새 배분으로 셈해진다. 이것은 예외가 아니라 "저장하지 않는다" 의 당연한 귀결이며,
        선딜 중에 몸으로 몰아 큰 것을 넣는 수가 성립한다 (C019 의 구간 위에 선다).

        **대가만 있고 잠금은 없다.** 다시 바꾸기까지 기다리는 시간을 두지 않는다 —
        그것은 새 상태(언제까지 못 바꾸는가)를 하나 더 낳고, 이 Cycle 이 더하기로 한
        상태는 하나뿐이다. 자주 바꾸는 일은 기력이 막는다: 세 번 바꾸면 큰 기술 한 번과
        절반을 잃는다.

    RULE-NPC-ALLOCATION-001 (ADDED)
        Implements     INTENT-AUTONOMOUS-BODIES-ALLOCATE-001
        Input          Control = autonomous 인 Actor
        Preconditions  쓰러지지 않았다
        Transition     국면이 정한 배분 = (Hp / HpMax <= 0.5) ? reinforce : balanced
                       그것이 지금과 다르면 RULE-ALLOCATION-SET-001 을 그대로 지난다
        Result         Decided | Unchanged

        **국면은 하나이고 문턱도 하나다.** RULE-NPC-DECIDE-001 이 기술 고르기에 대해
        내린 판단(패턴도 국면도 만들지 않는다)과 나란히 둔다 — 이 Cycle 이 여는 것은
        "자율 존재도 배분을 지닌다" 이지 판단 구조가 아니다. 습성의 설계는 아직 승인되지
        않은 문서의 몫이다 (Design-Creature-Behavior-R0 — Master 의 HUMAN 대기).

        **양방향이다.** 생명이 문턱 위로 돌아오면 균형으로 내려온다. 지금 세계에 회복이
        없으므로 실제로 그 길을 지나는 것은 밖에서 값에 손댈 때뿐이지만, 한쪽 길만 여는
        것은 "국면에 따라" 가 아니라 "한 번 넘으면 끝" 이다.

        **거절도 그대로 받는다.** 기력이 모자라면 바꾸지 못하고 그대로 싸운다 —
        자율 존재에게만 무는 예외를 두지 않는다. 그래서 큰 기술을 자주 건 개체는
        다쳐도 몸으로 몰지 못한다. 그것이 이 규칙이 만드는 실제 선택이다

    RULE-INSIGHT-REVEAL-001 (CHANGED)
        Implements     INTENT-INSIGHT-001 (CHANGED) · INTENT-INSIGHT-OPENS-001 (REUSED)
        Input          살펴봤는가, **보는 이의 유효 통찰**
        Preconditions  없음
        Transition     없음 (읽기 판정)
        Result         가려진 자리들 — 문턱(30 · 60 · 90)에 미치지 못한 자리

        문턱도 자리의 차례도 한 톨도 바뀌지 않는다. 바뀌는 것은 **어떤 통찰을 견주는가**
        하나다. 기본값을 견주면 인지 축이 아무 일도 하지 않으므로 축 하나가 죽는다.

        연 것을 적어 두지 않는 성질도 그대로다 — 인지에서 몫을 빼면 같은 판정이 다시
        가려진 목록을 내놓는다. 그래서 **배분을 바꾸면 아는 범위가 곧바로 좁아진다**

    RULE-OBSERVE-BEGIN-001 (CHANGED — 입력 하나)
        `already-known` 판정이 같은 유효 통찰을 읽는다. 두 자리가 서로 다른 통찰을
        읽으면 "이미 다 안다" 와 "가려진 것이 있다" 가 어긋난다

## OBSERVABLE SEMANTIC

    모든 존재에 언제나 실린다 (가려지지 않는다)

        Attributes.Allocation
            id        지금의 배분 이름
            shares    body · ability · awareness 세 몫

        **가리지 않는 이유** — 몰아 두는 일은 몸이 드러내는 것이다
        (INTENT-ALLOCATION-IS-OBSERVED-001). 가리면 "얇아진 쪽을 노린다" 가 세계에서
        성립하지 않는다. 태도(C018)와 통찰(C016)이 가려지지 않는 것과 같은 자리다.

        **몫을 함께 싣는 이유** — View 가 이름을 보고 자기 표에서 몫을 찾아내지 않게
        한다 (DC-WORLD-OWNS-THE-SURFACE-LIST). 배분을 하나 더 지어도 화면 코드가 열리지
        않는다.

        **그러나 값은 여전히 관문 안이다** — 배분이 그 몸의 방어를 얼마로 만들었는지는
        `combatStats` 이고, 그것은 C016 의 문턱(90) 뒤에 있다. 보이는 것은 형태이고
        값이 아니다 (INTENT-ALLOCATION-IS-OBSERVED-001)

    자기 몸에만 실린다

        Self.AllocationChoices[]
            id                  배분 이름
            shares              세 몫
            current             지금 이것인가
            available           지금 이것으로 바꿀 수 있는가
            unavailableReason   안 되면 왜 (downed | insufficient-cp)
            cpCost              치를 기력 (current 면 0)

        **되는 것도 안 되는 사유도 세계가 싣는다.** 화면이 기력과 비용을 견주어
        스스로 판단하지 않는다 (DC-COMBAT-UNAVAILABLE-HAS-A-REASON ·
        DC-WORLD-OWNS-THE-SURFACE-LIST). `current` 는 available 과 별개다 —
        지금 있는 자리는 거절이 아니다

    한 방의 경위에 실린다 (DamageBreakdown)

        attackerAllocation   치는 쪽의 배분 이름
        targetAllocation     맞는 쪽의 배분 이름
        offenseStat.fromAllocation    배분이 이 공격 값에 보탠 몫 (음수일 수 있다. 0 이어도 실린다)
        defenseStat.fromAllocation    배분이 이 방어 값에 보탠 몫 (같음)
        penetrationStat.fromAllocation  언제나 0 — 관통은 어느 축에도 들지 않는다

        **0 이어도 싣는다** — 치명이 그렇게 서 있는 이유와 같다 (C015). "배분이 이번
        한 방에 아무것도 하지 않았다" 는 사실 역시 관찰이어야, 배분을 바꿀 근거가 생긴다

    Rule 판정의 관찰 (Before → Input → Rule → After)

        Before   Allocation = balanced · Cp = 30 · armor(유효) = 50
        Input    set-allocation(reinforce)
        Rule     RULE-ALLOCATION-SET-001
        After    Allocation = reinforce · Cp = 15 · armor(유효) = 70
        실패     Cp = 10 → Failure(insufficient-cp) · 배분도 기력도 그대로

## BALANCE

    수치의 근거를 남긴다. 관찰자의 몸은 `rabbit-swordsman`, 상대는 `wanderer` 다.

    ① 아래 층의 기준값이 흔들리지 않는다 — `balanced` 가 기본이다

        C007 이래의 두 체감 기준이 그대로다.
            관찰자 → 자율 존재   기본 20 · 고급 55       (자율 존재 120 은 기본 6대)
            자율 존재 → 관찰자   기본 17 (12대를 견딘다)

        고른 배분은 모든 값에 0 을 보태므로 배분을 한 번도 바꾸지 않은 전투는
        C015 · C023 까지의 세계와 **한 톨도 다르지 않다.** 이것이
        DC-COMBAT-ONE-LAYER-AT-A-TIME 을 만족한다는 증거이며 회귀의 기준이다.

    ② 몫 한 점의 크기는 "한 배분이 한 축을 30~50% 움직인다" 로 잡았다

        관찰자의 기본 공격(base 6 · ratio 0.5)이 wanderer(armor 30)에게 내는 값:

            balanced             raw 26 → 20.0        ← C007 이래의 기준값
            reinforce  (pA 56)   raw 34 → 26.2   +31%
            hatsu·hunter (pA 32) raw 22 → 16.9   −15%

        관찰자의 오라 타격(base 6 · ratio 0.5, 관통 60 으로 resistance 90 을 깎는다):

            balanced             raw 26 → 16.6
            hatsu      (aA 64)   raw 38 → 24.3   +46%
            reinforce·hunter(28) raw 20 → 12.8   −23%

        관찰자가 wanderer 의 기본 공격에 맞는 값:

            balanced   armor 50 → 17.3   (200 을 12대에 잃는다)  ← 기준값
            reinforce  armor 70 → 15.3   (14대)
            hatsu·hunter armor 40 → 18.6 (11대)

        **한 방으로는 뒤집히지 않고 한 교전으로는 눈에 띈다** 가 이 크기의 목표다.
        배분 하나가 전투를 결정하면 그것은 고르는 것이 아니라 정답이 된다.

    ③ 인지 몫 20 — `hunter` 가 문턱 **하나만** 연다

        관찰자의 통찰은 0 이다 (C016 — 기른 적이 없는 눈). `hunter` 는 +40 을 주어
        유효 통찰 40 이 되고, 이것은 세 문턱 중 얕은 하나만 넘는다.

            30  defenseShape     열린다   ← 살펴보지 않고도 무른 쪽이 보인다
            60  versusObserver   닫힘
            90  combatStats      닫힘

        **이것이 이 Cycle 이 노리는 자리다.** MP-EXPLOIT-OPEN-BODY 가 필요로 하는 앎은
        "어느 쪽이 무른가" 이고 정확히 그것만 열린다. 몫을 30 으로 키우면 둘째 문턱까지
        열려 살펴봄이 할 일이 절반 줄고, C016 이 세운 "한꺼번에 전부 열리지 않는다"
        (INTENT-INSIGHT-OPENS-001) 가 흐려진다.

        대가는 실재한다 — `hunter` 는 몸과 능력을 한 점씩 잃으므로 공격 −15% ·
        방어 −20% 를 치르고 그 앎을 산다.

    ④ 바꾸는 대가 15 — 큰 기술의 절반

        고급 기술이 30 이고 기본 기술이 12 를 채운다 (C007 의 수지). 15 는
        **기본 기술 한 대 반**이며, 세 번 바꾸면 고급 기술 한 번 반을 잃는다.
        잠금 없이 이 값 하나로 "자주 바꾸면 못 친다" 가 성립한다.

        wanderer 는 cpMax 60 · 시작 20 이므로 한 번은 언제나 바꿀 수 있고,
        큰 기술을 막 걸었다면 못 바꾼다. 그것이 ⑤ 의 읽을 거리를 만든다.

    ⑤ 자율 존재의 문턱 0.5 — 다치면 몸으로 몬다

        wanderer(120) 가 60 아래로 내려가면 `reinforce` 로 간다.

            armor 30 → 50      관찰자의 기본 공격 20.0 → 17.3   (−13%)
            physicalAttack 40 → 56   관찰자가 맞는 값 17.3 → 22.7  (+31%)
            그리고 기력 15 를 잃는다 — 고급 기술 한 번이 늦어진다

        **읽을 것이 셋 다 화면에 있다**: 남은 생명(언제나 실린다) · 지금 배분(이제
        실린다) · 남은 기력(언제나 실린다). 그래서 "반쯤 깎이면 단단해지고 세진다,
        다만 큰 것을 덜 건다" 가 사람이 배울 수 있는 규칙이 된다 (UL §39).

        **`ability` 와 `awareness` 는 wanderer 에게 아무것도 주지 않는다** —
        그 종류는 물리 기술만 걸고(RULE-NPC-DECIDE-001), 아는 범위는 자율 존재의 판단에
        닿지 않는다(C016). 그러므로 그 둘에 모는 배분은 그 개체에게 순손해이며,
        이 규칙이 그것을 고르지 않는 이유다. 이것은 숨겨야 할 결손이 아니라
        **읽을 수 있는 사실**이다: 능력이나 인지에 몰아 둔 자율 존재를 보면 그것은 지금 무르다

## SEMANTIC CLOSURE

    Intent 의 문장 → State 또는 Rule

    INTENT-BODY-HAS-AN-ALLOCATION-001
        "몸은 지금의 배분을 지닌다"          → Actor.Allocation
        "언제나 정확히 하나"                 → 초기값 balanced · 비울 수 있는 값이 없다
        "목록과 몫은 세계가 지닌 값"          → World.AllocationCatalog
        "판정은 이름을 조건으로 삼지 않는다"   → 규칙은 allocationContribution 만 읽는다

    INTENT-THE-SHARES-SUM-THE-SAME-001
        "세 몫의 합은 같다"                  → World.AllocationShareTotal = 6 (목록의 불변식)
        "한쪽이 크면 다른 쪽이 작다"          → 합이 고정이므로 생김새로 성립

    INTENT-EACH-AXIS-OWNS-ITS-OWN-VALUES-001
        "세 축은 겹치지 않는다"               → World.AllocationAxes (값마다 축이 하나)
        "몸 / 능력 / 인지"                   → physicalAttack·armor·resistance / auraAttack / insight
        "어느 축도 지니지 않은 값"            → 관통 둘 · 치명 둘 (표에 없다 → 기여 0)

    INTENT-ALLOCATION-ENTERS-THE-EFFECTIVE-VALUE-001
        "합에 더해지는 또 하나의 항"          → RULE-EFFECTIVE-STATS-001 의 셋째 항
        "새 공식이 아니다"                   → defenseMultiplier · rawDamage 무변경
        "저장하지 않는다"                    → 파생 allocationContribution (State 아님)
        "기본값은 건드려지지 않는다"          → Transition 이 Allocation 만 바꾼다

    INTENT-THE-EVEN-ALLOCATION-ADDS-NOTHING-001
        "고른 배분은 0 을 보탠다"             → (2 − 2) × step = 0 (구조)

    INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 (CHANGED)
        "아는 범위도 유효 값이다"             → EffectiveStatName 에 insight ·
                                              RULE-INSIGHT-REVEAL-001 · RULE-OBSERVE-BEGIN-001

    INTENT-INSIGHT-001 (CHANGED)
        "통찰에 배분이 함께 닿는다"           → AllocationAxes.awareness → insight
        "겨루는 일에 닿지 않는다"             → insight 는 어떤 피해·기력 계산에도 없다 (무변경)
        "관문이 아니다"                      → 살펴봄 경로 무변경 (RULE-OBSERVE-COMPLETE-001)

    INTENT-CHANGE-ALLOCATION-001
        "다른 배분 하나를 골라 바꾼다"        → RULE-ALLOCATION-SET-001
        "치를 대가가 있다"                   → Precondition ③ + Transition (Cp −= 15)
        "고르는 것 하나"                     → Input 이 배분 이름 하나 (몫을 받지 않는다)
        "같은 주머니를 다툰다"               → Cp — 기술과 같은 자원
        "바뀌는 것은 그 순간부터"             → 유효 값이 매번 다시 세어진다

    INTENT-CHANGE-ALLOCATION-REFUSAL-001
        "사유를 하나 골라 싣는다"             → Result Failure(reason) · AllocationChoices.unavailableReason
        "아무것도 남기지 않는다"              → Precondition 이 Transition 앞에 전부 선다
        "같은 배분은 아무 일도 아니다"        → Transition 없음 · Success

    INTENT-ALLOCATION-IS-OBSERVED-001
        "자기 것도 남의 것도 보인다"          → Attributes.Allocation (모든 존재)
        "가려지지 않는다"                    → CONCEALABLE_ATTRIBUTE_KEYS 에 넣지 않는다
        "값은 여전히 관문 안"                 → combatStats 는 C016 그대로 (문턱 90)

    INTENT-DAMAGE-BREAKDOWN-001 (CHANGED)
        "배분이 얼마를 보탰는가"              → offenseStat/defenseStat.fromAllocation ·
                                              attackerAllocation · targetAllocation

    INTENT-AUTONOMOUS-BODIES-ALLOCATE-001
        "자율 존재도 지니고 바꾼다"           → Actor.Allocation (모든 몸) · RULE-NPC-ALLOCATION-001
        "대가도 거절도 같다"                 → 같은 RULE-ALLOCATION-SET-001 을 지난다
        "인지 축은 그들에게 아무것도 주지 않는다" → C016 무변경 (BALANCE ⑤ 에 사유)

    닫히지 않은 문장 — 없음. GAP 없음.

## OBSERVABLE CLOSURE

    Rule 판정에 들어간 모든 조건이 관찰된다.

        요청한 배분이 목록에 있는가     AllocationChoices[] 가 목록 자체다
        쓰러졌는가                     Vitality.downed (C007)
        기력이 충분한가                Attributes.energy + AllocationChoices.cpCost
        지금 어느 배분인가             Attributes.Allocation · AllocationChoices.current
        배분이 값에 얼마를 보탰나       DamageBreakdown 의 fromAllocation
        자율 존재의 문턱을 넘었나       Vitality.health / healthMaximum (언제나 실린다)

    실패 사유 셋(unknown-allocation · downed · insufficient-cp)이 모두 관찰에 실린다.
    `unknown-allocation` 은 화면이 목록 밖의 이름을 보내지 않는 한 나오지 않지만,
    사유 코드를 자리로 둔다 — 값 하나로 굳혀 두면 다음 사유가 생길 때 계약이 깨진다
    (C014 UnacquaintedReason 의 판단 그대로)
