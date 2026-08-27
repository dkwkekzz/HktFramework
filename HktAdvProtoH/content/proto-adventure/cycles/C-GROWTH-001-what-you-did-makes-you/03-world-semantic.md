# C-GROWTH-001 — World Semantic

> 02 가 세운 것을 세계의 말로 옮긴다. 새로 서는 것은 **몸이 지니는 값 하나**(지금까지
> 한 일)와 **세계가 지니는 목록 하나**(방금 쌓인 일들)이며, 나머지는 전부 파생이거나
> 이미 있는 자리의 확장이다.
>
> 단계는 상태가 아니다. 쌓인 것에서 읽는다 — 그래야 세계에 두 개의 진실이 생기지 않는다.
> 자란 몫도 상태가 아니다. 단계에서 매번 다시 센다 — C023 이 걸린 것에 대해,
> C-COMBAT-001 이 배분에 대해 내린 것과 같은 판정이다.

## SEMANTIC DELTA

    REUSED
        ActorState 의 여덟 능력치            C010 · C012 · C013 · C015 — 기본값. 그대로다
        equipmentContributions              C023 — 걸린 것의 기여. 그대로다
        allocationContribution              C-COMBAT-001 — 배분의 기여. 그대로다
        defenseMultiplier · effectiveDefense C010 · C012 · C013 — 공식. 그대로다
        rawDamage · offenseStatValue         C010 · C012 — 읽는 방법. 그대로다
        STRIKE_EVENT_TTL                     C007 — 사건의 수명. **그대로 쓴다**
        WorldState.time                      C001~ — 사건이 언제 일어났는가
        RULE-DOWNED-001                      C007 — 쓰러짐 자체. 그대로다
        RULE-MINE-COMPLETE-001 의 획득         C001 · C022 — 캔 것이 소지품에 드는 일. 그대로다
        RULE-OBSERVE-COMPLETE-001 의 앎        C014 — 알게 되는 일. 그대로다

    ADDED
        Actor.Deeds                          몸이 지금까지 한 일 (수 하나)
        World.GrowthEvents                   방금 쌓인 일들 — 수명이 있다
        World.DeedCatalog                    어떤 일이 얼마를 쌓는가 (세계가 지닌 값)
        World.GrowthThresholds               문턱의 표 (세계가 지닌 값)
        World.GrowthLevelSteps               한 단계가 어느 값에 얼마를 보태는가 (세계가 지닌 값)
        RULE-DEEDS-ADD-001                   일이 끝나면 쌓는다
        RULE-GROWTH-LEVEL-001                쌓인 것에서 단계를 읽는다 (읽기 판정)

    CHANGED
        RULE-EFFECTIVE-STATS-001
            합에 **넷째 항**이 는다 — 기본값 + 걸린 것 + 배분 + 단계.
            물을 수 있는 값의 목록(EffectiveStatName)은 넓어지지 않는다.
            0 바닥은 그대로다 (C-COMBAT-001 이 세웠다)
        RULE-STRIKE-DAMAGE-001
            타격이 성립하면 친 쪽이 쌓는다. 그 타격이 상대를 쓰러뜨렸으면 **쓰러뜨림도
            같은 자리에서 쌓는다** — 쓰러뜨림은 친 자의 일이므로 친 자가 있는 자리에서만
            쌓인다. RULE-DOWNED-001 자체는 한 글자도 바뀌지 않는다
        RULE-MINE-COMPLETE-001
            캐는 일이 끝나면 캔 쪽이 쌓는다
        RULE-OBSERVE-COMPLETE-001
            살펴봄이 끝나면 살펴본 쪽이 쌓는다
        RULE-STRIKE-EVENT-EXPIRE-001
            World.GrowthEvents 도 같은 수명으로 사라진다. **수명 규칙을 나누지 않는다** —
            셋에서 넷이 될 뿐이다 (C018 · C019 가 각각 내린 판단 그대로)
        RULE-DAMAGE-CALCULATE-001
            TypedStat 에 `fromGrowth` 한 칸이 는다. `fromAllocation` 옆에 서며 같은
            성질이다 — 0 이어도 실린다
        RULE-ATTRIBUTE-SET-001
            MutableAttribute 목록에 `deeds` 가 든다. **단계는 들지 않는다** —
            단계는 파생이므로 따로 밀어 올리면 두 개의 진실이 생긴다

    AFFECTED
        RULE-GUARD-BLOCK-001                 C011 — 막아 남기는 몫이 자란 방어를 지난다
        RULE-CRITICAL-STRIKE-001             C015 — 터짐은 자라지 않는다. 터진 한 방이 커진다
        RULE-INSIGHT-REVEAL-001              C016 — 통찰은 자라지 않는다. 가려짐은 그대로다
        RULE-NPC-DECIDE-001                  C002 — **무변경.** 자율 존재도 쌓지만 그 값을
                                             판단에 넣지 않는다. 넣으면 이 Cycle 이 세우지
                                             않은 의미(단계가 행동을 바꾼다)가 생긴다
        RULE-NPC-ALLOCATION-001              C-COMBAT-001 — 무변경
        RULE-OBSERVER-JOIN-001               C004 — 새 몸은 Deeds 0 으로 선다 (spawnActor)
        RULE-GROUND-LAW-APPLY-001            C-TERRAIN-001 — **무변경.** 땅이 거두는 것은
                                             단계가 높아도 그대로다
                                             (DC-WORLD-PROGRESSION-IS-REACH)
        Observer 관찰 표면                    자기 몸의 능력치 줄들이 이력으로 움직인다.
                                             C010 · C012 · C013 · C015 · C023 ·
                                             C-COMBAT-001 의 관찰이 전부 이 값을 지난다

## WORLD STATE

    Actor.Deeds                              World Authority
        지금까지 한 일. 0 이상의 수 하나이며 갈래로 나뉘지 않는다.
        새로 난 몸은 언제나 0 이다 — 종류가 정하는 값이 아니므로 카탈로그에 두지 않는다
        (C-COMBAT-001 의 allocation · C-TERRAIN-001 의 warmth 와 같은 자리).
        **어떤 몸이든 지닌다** — 조종 주체를 가리지 않는다.
        RULE-DEEDS-ADD-001 과 RULE-ATTRIBUTE-SET-001 만이 바꾼다.
        세계 안의 사정으로는 줄지 않는다 (INTENT-WHAT-IS-KEPT-ONLY-GROWS-001).

    World.GrowthEvents                       World Authority
        방금 무엇을 해서 얼마가 쌓였고, 그것이 단계를 올렸는가.
        World.StrikeEvents · UnharmedContacts · CancelEvents 와 **나란한 자리**이며
        같은 수명을 가진다 (STRIKE_EVENT_TTL).

            actorId       누구의 일인가
            source        무엇을 해서 — strike | down | mine | observe
            amount        얼마가 쌓였는가
            deedsAfter    쌓은 뒤의 총량
            levelBefore   그 전의 단계
            levelAfter    그 뒤의 단계 (같으면 오르지 않은 것이다)
            time          언제

        **오르지 않은 쌓임도 실린다.** 터지지 않은 치명이 실리는 이유와 같다 (C015) —
        "이번 일로는 오르지 않았다" 는 사실 역시 관찰이어야 다음 문턱까지의 거리가
        읽힌다.

    World.DeedCatalog                        세계가 지닌 값 (어떤 Rule 도 바꾸지 않는다)
        strike   1     한 대가 들어갔다
        down    14     쓰러뜨렸다
        mine     4     캤다
        observe  3     살펴봐 알게 되었다

    World.GrowthThresholds                   세계가 지닌 값
        [20, 50, 90, 140, 200]
        표가 끝나면 더 오르지 않는다 — 최대 5단계다.
        **판정은 이 표를 조건으로 삼지 않는다.** 표를 고치거나 늘리는 일에 규칙도
        관찰도 열리지 않는다 (C023 이 적용 자리에, C-COMBAT-001 이 배분 목록에
        대해 세운 형태 그대로).

    World.GrowthLevelSteps                   세계가 지닌 값
        physicalAttack  +4   / 단계
        auraAttack      +4   / 단계
        armor           +3   / 단계
        resistance      +3   / 단계
        여기 없는 값은 자라지 않는다 — 관통 둘 · 치명 둘 · 통찰 ·
        생명력 · 기력 · 이동 (INTENT-WHAT-GROWS-IS-WHAT-THE-CONTEST-READS-001).

    파생 — 저장하지 않는다
        Actor.GrowthLevel        RULE-GROWTH-LEVEL-001 이 쌓인 것에서 읽는다
        Actor.NextThreshold      다음 문턱의 값 (최대 단계면 없다)
        GrowthContribution       단계가 어느 값에 보태는 몫

## WORLD RULE

    RULE-DEEDS-ADD-001
        Implements     INTENT-THE-WORLD-ADDS-WHAT-WAS-DONE-001 ·
                       INTENT-THE-BODY-KEEPS-WHAT-IT-DID-001 ·
                       INTENT-ENOUGH-IS-A-STEP-001 ·
                       INTENT-GROWING-CARRIES-ITS-REASON-001 ·
                       INTENT-ONLY-REAL-ACTS-COUNT-001
        Input          Actor, DeedSource, World.Time
        Preconditions  없음.
                       **일이 실제로 끝났다는 사실이 곧 이 규칙이 불리는 조건이다** —
                       부르는 자리(아래 넷)가 이미 그 관문을 지났으므로 여기서 다시
                       묻지 않는다. 이 규칙은 스스로 어떤 일이 일어났는지 판단하지 않는다
        Transition     amount   = World.DeedCatalog[source]
                       before   = RULE-GROWTH-LEVEL-001(Actor.Deeds)
                       Actor.Deeds += amount
                       after    = RULE-GROWTH-LEVEL-001(Actor.Deeds)
                       World.GrowthEvents += GrowthEvent(...)
        Result         Added(amount, before, after)

        조종 주체를 가리지 않는다 — 일을 한 몸이면 누구든 쌓는다.
        같은 일은 언제나 같은 양을 쌓는다 — 피해의 크기도, 캔 것의 종류도, 흔들림도
        이 양에 들어가지 않는다 (DC-COMBAT-PLAYER-CAUSALITY).
        문턱 둘을 한 번에 넘으면 단계도 둘 오른다 — 붙잡아 두지 않는다.

    RULE-GROWTH-LEVEL-001
        Implements     INTENT-ENOUGH-IS-A-STEP-001
        Input          Deeds
        Preconditions  없음 — 어떤 값에도 답이 있다
        Transition     없음 (읽기 판정)
        Result         World.GrowthThresholds 중 Deeds 가 넘어선 것의 개수

        저장하지 않는다. 저장하면 Deeds 와 Level 이라는 두 개의 진실이 생기고,
        그것을 맞추는 책임이 Deeds 를 바꾸는 모든 자리로 흩어진다 —
        C022 가 UsedSlots 에, C023 이 유효 값에 대해 내린 것과 같은 판정이다.

    RULE-EFFECTIVE-STATS-001                                              (CHANGED)
        Implements     INTENT-EFFECTIVE-IS-RECOMPUTED-NOT-ACCUMULATED-001 ·
                       INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 ·
                       INTENT-THE-STEP-ENTERS-THE-EFFECTIVE-VALUE-001 (ADDED) ·
                       INTENT-THE-ZEROTH-STEP-ADDS-NOTHING-001 (ADDED)
        Input          Actor, 능력 이름
        Preconditions  없음
        Transition     없음 (읽기 판정)
        Result         max(0, 기본값
                              + Σ 걸린 것들의 기여
                              + 지금 배분의 기여
                              + 지금 단계의 기여)      ← 넷째 항이 는다

        단계 0 의 기여는 어느 값에서도 0 이다. 그러므로 이 항이 들어오는 것만으로는
        지금까지의 어떤 결과도 달라지지 않는다 (회귀의 근거).
        새 공식이 아니다 — 피해도 방어도 감쇄도 지금의 한 공식을 그대로 지난다.

    RULE-STRIKE-DAMAGE-001                                                (CHANGED)
        Implements     ... (기존 그대로) · INTENT-THE-WORLD-ADDS-WHAT-WAS-DONE-001
        Transition 에 더해지는 것
                       피해가 성립하면        RULE-DEEDS-ADD-001(공격자, strike)
                       그 타격이 쓰러뜨렸으면  RULE-DEEDS-ADD-001(공격자, down)
        Result         변화 없음

        **쓰러뜨림을 RULE-DOWNED-001 에 두지 않는 이유** — 그 규칙은 쓰러진 몸만 알고
        쓰러뜨린 몸을 모른다. 그리고 세계 밖의 손이 생명을 0 으로 만들 때도 그 규칙이
        불린다 (RULE-ATTRIBUTE-SET-001). 밖의 손이 만든 쓰러짐은 **아무의 일도 아니다** —
        일을 한 몸이 있어야 쌓임이 성립하므로, 친 자가 있는 자리에서만 쌓는다.

    RULE-MINE-COMPLETE-001                                                (CHANGED)
        Transition 에 더해지는 것    RULE-DEEDS-ADD-001(캔 몸, mine)
        획득이 자리 부족으로 거절되면 쌓지 않는다 — 그때는 캐는 일이 끝나지 않은 것이다

    RULE-OBSERVE-COMPLETE-001                                             (CHANGED)
        Transition 에 더해지는 것    RULE-DEEDS-ADD-001(살펴본 몸, observe)
        이미 다 아는 상대는 살펴봄 자체가 거절되므로 (C016 · RULE-OBSERVE-BEGIN-001)
        같은 상대를 되풀이해 살펴 무한히 쌓는 길은 세계에 없다

    RULE-STRIKE-EVENT-EXPIRE-001                                          (CHANGED)
        Input 에 World.GrowthEvents 가 더해진다. 수명과 지우는 방법은 그대로다

    RULE-DAMAGE-CALCULATE-001                                             (CHANGED)
        산출물 TypedStat 에 `fromGrowth` 가 는다 — 그 값 중 단계가 보탠 몫.
        0 이어도 실린다. 관통에서는 언제나 0 이다 (자라지 않는 값이므로)

    RULE-ATTRIBUTE-SET-001                                                (CHANGED)
        MutableAttribute 에 `deeds` (min 0 · max 100000) 가 든다.
        올리면 단계가 따라 오르고 내리면 따라 내린다 — **밖의 손은 되돌릴 수 있어야
        디버그의 자리다.** 세계 안의 사정으로 줄지 않는다는 말은 규칙에 대한 것이지
        밖의 손에 대한 것이 아니다.
        `growthLevel` 은 목록에 들지 않는다 — 파생이다

## OBSERVABLE SEMANTIC

    자기 몸에 대해 (관찰자 자신)
        Deeds                지금까지 쌓인 양
        GrowthLevel          지금 몇 단계인가 — **세계가 세어서 싣는다**
        NextThreshold        다음 문턱의 값 (최대 단계면 없음)
        DeedsToNext          다음 문턱까지 남은 양 (최대 단계면 없음)
        GrowthContributions  단계가 지금 어느 값에 얼마를 보태고 있는가 (넷)

    방금 일어난 일 (자기 것만)
        GrowthEvents         source · amount · deedsAfter · levelBefore · levelAfter
                             levelBefore ≠ levelAfter 이면 그것이 "올랐다" 는 사실이다

    한 방의 경위 안에서
        TypedStat.fromGrowth 그 값 중 단계가 보탠 몫 — `fromAllocation` 과 나란하다

    남의 몸에 대해
        **없다.** 상대의 Deeds 도 GrowthLevel 도 실리지 않는다.
        남의 겨루는 힘이 어디까지 보이는가는 C016 의 가려짐 관문이 소유하는 물음이며,
        이 Cycle 의 Goal 이 그것을 요구하지 않는다 (01 EXCLUDED).
        다만 **상대의 유효 값은 지금도 그 관문을 지나 보인다** — 자란 상대의 값이
        커 보이는 것은 그 관문이 이미 하던 일이고, 이 Cycle 이 넓히지 않는다.

    실패 사유
        이 Cycle 이 더하는 규칙에는 거절이 없다. RULE-DEEDS-ADD-001 은 선행 조건이
        없고(부르는 자리가 관문이다), RULE-GROWTH-LEVEL-001 은 읽기 판정이다.
        세계 밖에서 `deeds` 를 밖의 범위로 밀면 기존 사유가 그대로 답한다
        (`value-out-of-range`).

## BALANCE

    ① 왜 이 크기인가 — 한 단계의 폭

       이 축은 적용 · 발동 · 지속이 전부 최대치다 (GBC-GAIN-LEVEL 의 reward_profile).
       그러므로 한 단계로 국면이 뒤집히면 안 되고, 그럼에도 **한 단계가 눈에 보여야**
       한다 (Goal). 지금 세계의 수로 재면 이렇다.

           관찰자(rabbit-swordsman)의 기본 타격이 wanderer 에게 남기는 값
           단계 0    physicalAttack 40 → 20
           단계 1                   44 → 22      한 대가 눈에 띈다
           단계 2                   48 → 23
           단계 3                   52 → 25      **여기서 6대가 5대가 된다**
           단계 4                   56 → 26
           단계 5                   60 → 28      (5대 그대로 — 더 세지지만 대수는 같다)

       한 단계는 숫자를 바꾸고, **세 단계를 모아야 대수가 바뀐다.** 이것이
       "작지만 보인다" 의 실제 모습이며 DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT 가
       요구한 폭이다.

           wanderer 의 기본 타격이 관찰자에게 남기는 값
           단계 0    armor 50 → 17     (200 을 12대에 잃는다)
           단계 5          65 → 16     (13대)

       버티는 쪽은 더 얕다 (+3). 방어는 감쇄식을 지나므로 같은 폭이라도 체감이 크고,
       두 축이 같이 두꺼워지면 "몰던 상대를 압도한다" 가 너무 이르게 온다.

    ② 왜 이 문턱인가 — 첫 단계를 언제 보는가

       Frontier 의 Playable Result 가 문장 하나를 못박아 두었다 —
       *"자율 존재를 쓰러뜨리고 광맥을 캐면"*. 첫 문턱은 그 문장에 맞춘 값이다.

           기본 기술로 wanderer 하나를 쓰러뜨린다   6대 × 1 + 쓰러뜨림 14 = 20
           고급 기술을 섞어 쓰러뜨린다              3대 × 1 + 쓰러뜨림 14 = 17
           광맥을 한 번 캔다                                            +4

       어느 길로 가도 **쓰러뜨리고 한 번 캐면 20 을 넘는다.** 기본 기술만으로도
       쓰러뜨림 하나로 정확히 닿는다.

           문턱   20 · 50 · 90 · 140 · 200
           사이    30 · 40 · 50 · 60         점점 멀어진다

       최대 5단계에서 멈춘다. 상한 없는 축은 잴 수 없고, 지금 비교 집합이 이 성장
       하나뿐이다 (GBC-GAIN-LEVEL 의 `validation.static: PENDING`).
       표를 늘리는 일은 값 하나를 고치는 일이지 규칙을 여는 일이 아니다.

    ③ 왜 쓰러뜨림이 이렇게 큰가

       한 대가 1 이고 쓰러뜨림이 14 다 — 열네 배다. 이 세계에서 **가장 큰 일이
       쓰러뜨리는 일**이기 때문이며, 동시에 "때리기만 반복하는 것" 이 가장 느린
       길이 되게 한다. 자율 존재를 때리기만 하고 놓아 주기를 되풀이해도 문턱은
       천천히 온다.

    ④ 자율 존재도 쌓는다 — 그런데 왜 문제가 되지 않는가

       규칙은 조종 주체를 가리지 않으므로 wanderer 도 관찰자를 때리며 쌓는다.
       그러나 자율 존재의 벌이는 실제로 얇다 — 관찰자를 12대 때려도 12 이고,
       관찰자를 쓰러뜨려야 26 이 된다. 첫 문턱(20)을 넘으려면 사람을 한 번
       쓰러뜨리거나 스무 대를 때려야 한다.

       그리고 08 이 재는 상대는 **같은 종류의 다른 개체**다 (01 GOAL). 쓰러뜨린 몸은
       다시 싸우지 않고, 새 몸의 Deeds 는 언제나 0 이다 (spawnActor). 그러므로
       "같은 상대에게 더 큰 피해" 비교는 자율 존재의 성장과 무관하게 성립한다.

    ⑤ 무엇이 흔들리지 않는가

       Deeds 0 인 세계는 이 Cycle 이전과 **한 톨도 다르지 않다.** 넷째 항이 0 이고,
       0 바닥은 이미 있었고, 공식은 그대로다. 새로 도는 규칙은 있지만 그 규칙이
       바꾸는 값(Deeds)을 읽는 것은 자기 자신과 관찰뿐이다.

## SEMANTIC CLOSURE

    "한 일이 몸에 남는다"                     → Actor.Deeds
    "쌓이는 자리는 하나다"                    → Deeds 가 수 하나다 (갈래 없음)
    "세계의 규칙이 쌓는다"                    → RULE-DEEDS-ADD-001
    "세계에 없는 일은 원천이 아니다"           → World.DeedCatalog 의 넷.
                                              탐험·사건 해결은 없다 (08 이 보고)
    "어떤 몸이든 지닌다"                      → Actor.Deeds (조종 주체를 묻지 않는다)
    "누구에게나 돈다"                         → RULE-DEEDS-ADD-001 Preconditions 없음
    "쌓인 것은 줄지 않는다"                   → 세계 안에서 Deeds 를 줄이는 Rule 이 없다
    "충분해지면 단계가 정해진다"               → RULE-GROWTH-LEVEL-001
    "단계는 쌓인 것에서 읽힌다"                → 저장하지 않는다 (파생)
    "문턱은 값이지 규칙이 아니다"              → World.GrowthThresholds
    "한 번에 둘을 넘을 수 있다"                → 넘어선 문턱의 **개수**를 센다
    "단계는 내려가지 않는다"                  → Deeds 가 줄지 않으므로 결과다
    "단계가 유효 값의 합에 들어간다"            → RULE-EFFECTIVE-STATS-001 넷째 항
    "기본값은 건드리지 않는다"                 → 자란 몫이 상태가 아니다
    "자라는 것은 겨룸에서 읽히는 값이다"        → World.GrowthLevelSteps 의 넷
    "관통·치명·통찰은 자라지 않는다"           → 그 목록에 없다 → 기여 0
    "그릇과 걸음은 자라지 않는다"              → 그 목록에 없다. 유효 값 자리가 없다
    "단계 0 은 아무것도 보태지 않는다"          → 0 × step = 0
    "한 단계는 작다"                          → BALANCE ① (세 단계에 대수 하나)
    "단계는 아무것도 열지 않는다"              → 어떤 Precondition 도 GrowthLevel 을 읽지
                                              않는다. 땅의 법칙도 무변경 (AFFECTED)
    "쌓임과 문턱이 관찰된다"                   → Deeds · GrowthLevel · NextThreshold ·
                                              DeedsToNext (세계가 세어서 싣는다)
    "쌓은 일이 그 사실을 남긴다"               → World.GrowthEvents (source · amount)
    "오름이 사유를 지닌다"                    → GrowthEvent 의 levelBefore ≠ levelAfter
                                              + TypedStat.fromGrowth
    "같은 일은 같은 양"                       → World.DeedCatalog 가 고정값. 흔들림 없음

    GAP  없음.
