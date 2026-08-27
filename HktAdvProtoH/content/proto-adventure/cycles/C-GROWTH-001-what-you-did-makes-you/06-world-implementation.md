# C-GROWTH-001 — World Implementation

> 03 이 세운 것을 코드로 닫는다. **새 계산 축을 세우지 않았다** — `effectiveStat` 의 합에
> 항이 하나 늘고(넷째), 그 항의 크기를 정하는 표 하나가 생겼다. 그리고 세계 안의 네
> 자리가 "일이 끝났다" 를 규칙 하나에게 알린다.

## IMPLEMENTED

    Actor.Deeds                          world/semantic/actor.ts
        지금까지 한 일. 수 하나이며 갈래로 나뉘지 않는다. 종류가 정하는 값이 아니므로
        카탈로그에 두지 않았다 (C-COMBAT-001 의 allocation · C-TERRAIN-001 의 warmth 와
        같은 자리). 어떤 몸이든 지닌다

    World.GrowthEvents                   world/semantic/world-state.ts
        StrikeEvents · UnharmedContacts · CancelEvents 와 나란한 네 번째 목록.
        초기값은 world/index.ts 의 조립에서 빈 배열

    World.DeedCatalog                    world/semantic/growth.ts (NEW)
    World.GrowthThresholds               같은 파일 (20 · 50 · 90 · 140 · 200 · 최대 5단계)
    World.GrowthLevelSteps               같은 파일 (PhysAtk 4 · AuraAtk 4 · Armor 3 · Resist 3)
    DeedSource · GrowableStat · GrowthEvent · GROWABLE_STATS · MAX_GROWTH_LEVEL

    RULE-GROWTH-LEVEL-001                world/semantic/growth.ts `growthLevel`
        **넘어선 문턱의 개수**를 센다 — 한 번에 둘을 넘으면 둘 오른다.
        저장하지 않는다 (파생). 함께 서는 파생 셋:
        `nextGrowthThreshold` · `deedsToNextThreshold` · `growthContribution`

        combat.ts 가 아니라 이 파일에 있는 이유는 allocation.ts 와 같다 —
        combat.ts 는 이 파일을 읽고 이 파일은 아무것도 읽지 않는다

    RULE-DEEDS-ADD-001                   world/rules/deeds-add.ts (NEW)
        선행 조건이 없다 — **부르는 자리가 관문이다.** 조종 주체를 가리지 않으며
        쌓임과 함께 GrowthEvent 를 하나 남긴다 (오르지 않은 쌓임도)

    RULE_DEEDS_ADD · RULE_GROWTH_LEVEL · INTENT-* 12종
                                         protocol/semantic-id-growth.ts (NEW)
    GrowthView · GrowthEventView · GrowthContributionView
                                         protocol/gameview-growth.ts (NEW)

        **GROWTH 트랙이 자기 도메인 파일을 세웠다** (works.md 병렬 규칙).
        인덱스 둘(`semantic-id.ts` · `gameview.ts`)에는 재수출·조립 한 줄씩만 더했다

## CHANGED

    RULE-EFFECTIVE-STATS-001             world/semantic/combat.ts
        NEW TERM     합에 `growthContribution(actor.deeds, stat)` 이 더해진다 —
                     기본값 + 걸린 것 + 배분 옆의 **넷째 항**
        NO NEW FLOOR 0 바닥은 C-COMBAT-001 이 이미 세웠고 그대로다.
                     성장의 항은 **음수가 되지 않는다** — 자라는 것은 얻는 일이다
        SAME DOMAIN  `EffectiveStatName` 에 `GrowableStat` 이 합쳐지지만 **넓어지지
                     않는다** — 넷은 이미 ContributableStat 안에 있다.
                     ContributableStat 은 한 글자도 바뀌지 않았다 (C023 그대로)

    TypedStat                            world/semantic/combat.ts
        `fromGrowth` 한 칸. `fromAllocation` 옆에 서며 0 이어도 실린다

    MUTABLE_ATTRIBUTES                   world/semantic/combat.ts
        `deeds` (min 0 · max 100000). **단계는 들지 않는다** — 파생이다.
        `MutableAttributeId` 에도 한 이름이 늘었다

    RULE-STRIKE-DAMAGE-001               world/rules/strike-damage.ts
        타격이 성립하면 `ruleDeedsAdd(state, attacker, 'strike')`.
        그 타격이 쓰러뜨렸으면 같은 자리에서 `'down'` 도.
        **RULE-DOWNED-001 은 한 글자도 바뀌지 않았다** — 그 규칙은 쓰러진 몸만 알고
        쓰러뜨린 몸을 모르며, 밖의 손이 생명을 0 으로 만들 때도 불린다

    RULE-MINE-COMPLETE-001               world/rules/mine.ts
        획득이 끝난 뒤 `'mine'`. 자리가 없어 거절되면 위에서 이미 돌아간다

    RULE-OBSERVE-COMPLETE-001            world/rules/observe.ts
        앎이 든 뒤 `'observe'`. 다 아는 상대는 살펴봄 자체가 거절되므로
        되풀이해 무한히 쌓는 길이 없다

    RULE-DAMAGE-CALCULATE-001            world/rules/damage-calculate.ts
        **식은 한 글자도 바뀌지 않았다.** Step 0~3 어디에도 성장이 등장하지 않는다.
        결과에 실리는 경위에만 `fromGrowth` 셋이 늘었다

    RULE-STRIKE-EVENT-EXPIRE-001         world/simulation/strike-event-expire.ts
        GrowthEvents 도 같은 수명으로 사라진다. **수명 규칙을 넷으로 나누지 않았다**

    RULE-ATTRIBUTE-SET-001               world/rules/attribute-set.ts
        `deeds` 한 갈래. 내리는 쪽으로도 열려 있다 — 밖의 손은 되돌릴 수 있어야 한다

    spawnActor                           world/semantic/spawn.ts
        태어나는 몸이 `deeds: 0` 을 지닌다.
        **08 의 "같은 종류의 다른 개체" 비교가 이 한 줄에 기댄다**

## AFFECTED UPDATED

    projection/observer-view.ts
        growth              projectGrowth — 언제나 실린다. 최대 단계면 다음 문턱과
                            남은 양이 **오지 않는다** (없음이 곧 "더 오를 곳이 없다")
        growthEvents        projectGrowthEvents — 관찰자 자신의 것만 거른다
        hud self.growth.*   단계 · 최대 단계 · 쌓인 양 (+ 최대 단계가 아니면 문턱 둘)
        strikes[].breakdown 세 typed stat 이 `fromGrowth` 를 함께 싣는다 (투영 무변경 —
                            breakdown 을 통째로 넘기던 자리가 그대로 넓어졌다)

    protocol/gameview-combat.ts
        `TypedStatView.fromGrowth` **한 줄**. GROWTH 트랙이 COMBAT 트랙의 파일에 더한
        유일한 자리이며, 기존 줄을 옮기지 않고 인터페이스 끝에만 붙였다
        (works.md 공유 지점 규칙 · LANES 충돌 칸). 한 방의 경위는 전투의 것이고
        그 안에 성장의 몫이 실린다

    npc-decide / npc-allocation
        **무변경.** 자율 존재도 쌓지만 그 값이 판단에 들지 않는다 — 들면 이 Cycle 이
        세우지 않은 의미(단계가 행동을 바꾼다)가 생긴다

    ground-law-apply
        **무변경.** 땅이 거두는 것은 단계가 높아도 그대로다
        (DC-WORLD-PROGRESSION-IS-REACH)

## PROJECTION

    growth.deeds / level / maxLevel      세계가 세어서 싣는다
    growth.nextThreshold / deedsToNext   세계가 빼서 싣는다 (최대 단계면 없음)
    growth.contributions                 넷. 단계 0 에서도 0 으로 실린다
    growthEvents[]                       source · amount · deedsAfter ·
                                         levelBefore · levelAfter · since
    strikes[].breakdown.*.fromGrowth     0 이어도 실린다
    hud self.growth.{level,maxLevel,deeds,nextThreshold,deedsToNext}

    투영하지 않은 것 — 04 의 `not_projected` 그대로
        World.DeedCatalog · GrowthThresholds · GrowthLevelSteps 의 **표 전체**
        남의 Deeds · 남의 GrowthEvents

## TESTS

    world/tests/growth.spec.ts (NEW · 45)
        한 일이 남는다             새 몸은 0 (미등록 종류 포함) · 갈래 없이 한 자리
        세계가 쌓는다              치기 1 · 쓰러뜨림 +14 · 캐기 4 · 살펴봄 3 ·
                                   같은 일은 같은 양 (네 번 캐서 4·4·4·4) ·
                                   **밖의 손이 만든 쓰러짐은 아무에게도 쌓이지 않는다** ·
                                   자율 존재도 쌓는다 (규칙 단독 호출로 확인)
        원천은 넷뿐                탐험·사건 해결을 지어내지 않았다
        줄지 않는다                쓰러져도 · TTL 이 지나 사건이 사라져도
        문턱과 단계                표 다섯 · 경계값(19/20/49/200/100000) ·
                                   **한 번에 둘 넘기**(49 → 64 → 단계 2) ·
                                   다음 문턱과 남은 양 (최대 단계면 null)
        넷째 항                    기본값 무변경(40) · 유효 값만 44 ·
                                   **밖의 손으로 덮은 100 위에 자란 4 가 그대로 얹힌다** ·
                                   벗어도 배분을 바꿔도 자란 몫은 그대로
        자라는 값                  넷뿐 · 관통·치명·통찰 0 · 그릇과 걸음 무변경(최대 단계에서)
        단계 0                     회귀 — 40 · 50 · 40 · 20 그대로
        폭 (BALANCE ①)             단계 0~5 여섯 줄을 **숫자로 박았다**
                                   유효 공격 40·44·48·52·56·60 →
                                   한 대가 남기는 값 20·22·23·25·26·28 ·
                                   대수는 세 단계를 모아야 바뀐다 (6 → 6 → 5)
        첫 문턱 (BALANCE ②)        기본 기술 여섯 대 + 쓰러뜨림 = 정확히 20
        아무것도 열지 않는다        최대 단계여도 곡괭이 없이는 못 캔다 ·
                                   땅은 단계가 높아도 열을 거둔다
        관찰                       세계가 세어서 싣는다 · 0 도 실린다 ·
                                   최대 단계면 문턱 둘이 오지 않는다 ·
                                   **남의 것은 오지 않는다**
        까닭                       무엇을 해서 얼마 · 오르지 않은 쌓임도 실린다 ·
                                   오른 순간 전후 단계가 갈린다 ·
                                   쓰러뜨린 한 순간이 두 사실을 남긴다 (strike · down) ·
                                   경위의 fromGrowth (0 과 4) · 같은 수명으로 사라진다 ·
                                   내 것만 실린다

    회귀 — 갱신한 기존 시험 (의미가 아니라 **새 칸**을 받아들인 것들)
        allocation · critical · damage · damage-type · observe · penetration
            TypedStat deep-equal 에 `fromGrowth: 0` 이 든다. **값은 하나도 바뀌지
            않았다** — 자라지 않은 몸의 경위이므로 0 이다
        combat · command
            MutableAttribute 목록에 `deeds` 가 든다
        critical
            손수 만든 WorldState 에 `growthEvents: []` 자리가 생긴다
        exchange
            **하나만 의미가 바뀌었다.** 아홉 번 캐는 각본이라 그 몸은 36 을 쌓아
            한 단계 자라 있다. 기대값을 상수에서 **세계가 스스로 밝힌 몫**으로 옮겼다 —
            바꿔 낀 일이 값을 옳게 옮기는가는 그대로 확인되고, 자란 몫이 걸린 것을
            벗어도 남는다는 사실이 덤으로 확인된다
        view fixtures 33개
            `growth`(단계 0) · `growthEvents: []` · 경위의 `fromGrowth: 0`.
            **화면 결정은 한 줄도 바뀌지 않았다** — 계약이 넓어졌을 뿐이다

    전체       1504 passed (83 files) · tsc 0 · boundary 0 · catalog 정합

## NOTES

    새 조작이 없다
        `actions/` 에 한 줄도 더하지 않았다. 자라게 하는 행위는 이미 세계에 있는
        것들이고, 사람이 하는 일은 지금까지 하던 일 그대로다 — 그것이 이 Cycle 의
        뜻이기도 하다: **한 일이 몸을 키운다**, 따로 무엇을 눌러서가 아니라.

    Tick 순서를 건드리지 않았다
        `world/index.ts` 의 SYSTEMS 배열은 그대로다. 쌓임은 Tick 마다 도는 법칙이
        아니라 **일이 끝나는 자리에서 한 번** 일어나므로 `simulation/` 에 새 시스템이
        서지 않는다. 사라지는 일만 기존 시스템 하나가 함께 맡는다.

    engine 무변경
        `npm run boundary:check` 0. 성장은 팩의 의미이며 기반이 부족한 자리가 없었다.

    한 방의 크기가 스스로를 키우지 않는다
        타격의 쌓임을 **피해에 비례시키지 않았다** (언제나 1). 비례시키면 센 몸이 더
        빨리 자라 되먹임이 생기고, "같은 일은 같은 양" (DC-COMBAT-PLAYER-CAUSALITY)도
        깨진다.

    이 Cycle 이 남긴 결손 — 08 이 위층에 보고한다
        원천 넷 중 둘이 없다        탐험 · 사건 해결 (땅과 사건이 아직 세계에 없다)
        GS §5 의 다섯 중 셋이 없다   생명력 · 기력 · 이동은 유효 값 자리를 지니지 않아
                                     이 Cycle 이 닿지 않았다. 그 자리를 여는 것은
                                     이 Cycle 이 아니다 (05 승인이 확정했다)

    화면 몫 — 07 로 넘어간다
        계약은 섰고 hud 항목도 섰다. 어디에 어떻게 그리는가는 View 의 몫이다.
