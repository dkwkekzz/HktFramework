# C-COMBAT-001 — World Implementation

> 03 이 세운 것을 코드로 닫는다. **새 계산 축을 세우지 않았다** — `effectiveStat` 의 합에
> 항이 하나 늘고, 그 항의 크기를 정하는 표 하나가 생겼다.

## IMPLEMENTED

    Actor.Allocation                     world/semantic/actor.ts
        지금의 배분 이름 하나. 어떤 몸이든 언제나 정확히 하나를 지닌다.
        종류가 정하는 값이 아니므로 카탈로그에 두지 않았다 (C018 의 guardedGround 와 같은 자리)

    World.AllocationCatalog              world/semantic/allocation.ts (NEW)
    World.AllocationAxes                 같은 파일
    World.AllocationShareTotal / EvenShare / SwitchCpCost
    AllocatableStat · allocationContribution · isAllocationId · allocationShares

    RULE-ALLOCATION-SET-001              world/rules/allocation-set.ts (NEW)
        + evaluateAllocationSet — Rule 과 투영이 **같은 판정을 공유한다**
          (RULE-MOVE-MODE-001 의 evaluate 와 같은 자리)

    RULE-NPC-ALLOCATION-001              world/simulation/npc-allocation.ts (NEW)
        + world/index.ts SYSTEMS 배열의 **맨 앞**. 몰아 두는 일은 자세이고 기술 고르기는
          그 자세로 하는 행동이므로, 같은 Tick 안에서 자세가 먼저 정해져야 그 Tick 의
          판정이 방금 고른 배분을 읽는다

    interaction `set-allocation`         world/actions/interactions.ts
        요청이 싣는 것은 배분 이름 하나뿐이다 (몫을 싣지 않는다).
        수용층은 검증하고 rules 를 부를 뿐이다 — 상태를 직접 바꾸지 않는다

    ActionRequest.allocationId           protocol/actions.ts
    RULE_ALLOCATION_SET · RULE_NPC_ALLOCATION · INTENT-* 9종
                                         protocol/semantic-id-combat.ts

## CHANGED

    RULE-EFFECTIVE-STATS-001             world/semantic/combat.ts
        NEW TERM     합에 `allocationContribution(actor.allocation, stat)` 이 더해진다
        NEW FLOOR    `Math.max(0, …)` — 배분이 처음으로 음의 항을 낳기 때문이다.
                     **지금까지의 어떤 결과도 바꾸지 않는다**: 기본값이 0 이상이고 걸린
                     것의 기여가 음이 아니므로 배분 전에는 언제나 0 이상이었다
        WIDER DOMAIN `EffectiveStatName = ContributableStat | AllocatableStat` (아홉).
                     **ContributableStat 은 한 글자도 바뀌지 않았다** — 걸린 것이 보태는
                     목록과 배분이 보태는 목록은 서로 다른 목록이며 그것이 정상이다

    DamageBreakdown                      world/semantic/combat.ts
        `attackerAllocation` · `targetAllocation` 두 이름 +
        세 typed stat 이 공통 `TypedStat`(name · value · fromAllocation)으로 모였다.
        세 자리에 흩어져 있던 인라인 형을 하나로 세운 것이며 뜻은 그대로다

    RULE-DAMAGE-CALCULATE-001            world/rules/damage-calculate.ts
        **식은 한 글자도 바뀌지 않았다.** 결과에 실리는 경위만 넓어진다 —
        Step 0~3 어디에도 배분이 등장하지 않는다 (DC-COMBAT-ONE-FORMULA)

    RULE-INSIGHT-REVEAL-001 (투영 쪽 입력)  world/projection/observer-view.ts
        견주는 통찰이 `self.insight` → `effectiveStat(self, 'insight')`.
        문턱(30·60·90)도 자리의 차례도 한 톨도 바뀌지 않았다

    spawnActor                           world/semantic/spawn.ts
        태어나는 몸이 `balanced` 를 지닌다

## AFFECTED UPDATED

    projection/observer-view.ts
        attributes.allocation        모든 존재에 실린다 (가려지지 않는다)
        attributes.insight           기본값 → 유효 값
        attributes.concealed         같은 판정이되 유효 통찰을 견준다
        hud self.allocation + 세 몫    네 줄
        hud self.insight             유효 값
        allocations[]                projectAllocations — 네 항목이 언제나 전부

    protocol/gameview-combat.ts      AllocationView · AllocationChoiceView ·
                                     AttributesView.allocation · TypedStatView.fromAllocation ·
                                     DamageBreakdownView 의 두 이름
    protocol/gameview.ts             스냅샷에 allocations

## 고친 것 하나 — 03 이 예고하지 않은 정합 결손

    projection/observer-view.ts 의 `versusObserver.resistanceMultiplier`

    C023 이 이 블록의 네 줄 중 **셋만** 유효 값으로 옮기고 마지막 한 줄을 기본값
    (`actor.resistance` · `self.resistancePenetration`)으로 남겨 두었다. 걸린 것의
    기여가 오라 방어에 붙는 물건이 없어 지금까지 값이 같았으므로 드러나지 않았다.

    배분은 오라 방어를 실제로 움직이므로, 그대로 두면 **같은 칸의 `resistance` 와
    `resistanceMultiplier` 가 서로 어긋난 값을 싣게 된다.** 유효 값으로 맞췄다 —
    INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 이 요구하는 정합이며,
    이 Cycle 이 만든 문제를 이 Cycle 이 닫는 것이지 무관한 리팩터링이 아니다.

## PROJECTION

    entities[].attributes.allocation     projectObserverView (모든 Actor)
    allocations[]                        projectAllocations(self)
    hud self.allocation.*                projectObserverView
    strikes[].breakdown.*                RULE-DAMAGE-CALCULATE-001 의 산출물이 그대로 흐른다
                                         (투영은 `{ ...event.breakdown }` 하나다 — 새 조립이 없다)

## TESTS

    world/tests/allocation.spec.ts (NEW) — 37 항목

        몸에 배분이 있다          태어날 때 하나 · 미등록 종류도 · 목록은 세계가 지닌다
        몫의 합                   넷 다 6 · 한쪽에 몰면 나머지가 내려간다 · 기여 합 0
        축은 겹치지 않는다         세 축의 값과 크기 · 관통 둘 치명 둘은 0
        고른 배분은 0             모든 값에 0 · 유효 값 = 기본값
        유효 값에 들어간다         맞바뀜 · 기본값 무변경 · **백 번 바꿔도 표류 없음** · 0 바닥
        바꾸는 일                 대가 · 명시값(두 번 와도 같다) · 세 몫이 hud 에
        거절                      기력 부족 · 모르는 이름 · 쓰러짐 — 셋 다 아무것도 남기지 않는다
        읽힌다                    남의 것도 실리되 값은 관문 안 · 넷이 언제나 전부 실린다
        경위                      고른 배분은 몫 0 · 몸/능력에 몰면 그 몫이 실린다 · 관통 0
        인지 축                   **사냥꾼이 문턱 하나만 연다** · 덜면 다시 닫힌다 ·
                                  통찰은 여전히 겨룸에 닿지 않는다
        자율 존재                 성한 채는 고른 배분 · 절반 아래에서 몸으로 · 실제로 단단해진다 ·
                                  기력 없으면 못 바꾼다 · **양방향**
        회귀                      C007 기준값 둘 · 관찰자의 몸은 스스로 바꾸지 않는다

    전체 1366 통과 (78 파일) · `tsc --noEmit` 통과 · `boundary:check` 위반 0

## 기존 검증을 고친 것 — 무엇을 고쳤고 무엇은 고치지 않았나

    ① 경위 단언 21곳 (`damage` · `damage-type` · `penetration` · `critical` · `observe`)
       `fromAllocation: 0` 과 두 배분 이름을 더했다. **값은 한 톨도 바꾸지 않았다** —
       0 을 단언하는 것 자체가 "이 층이 들어온 뒤에도 그대로다" 의 증거다

    ② `combat.spec.ts` 의 attributes 단언 2곳
       `allocation: balanced` 한 자리를 더했다. 나머지는 그대로다

    ③ `combat.spec.ts` 의 `downNpc` 헬퍼 — **실제 동작이 바뀌어서 고쳤다**
       생명을 "한 대 분량(20)" 남기던 것을 1 로 바꿨다. 자율 존재가 절반 아래에서
       몸에 몰아 단단해지므로 그 한 대가 17 로 줄어 3 이 남았다. 그것은 이 Cycle 이
       **의도한 결과**이고(03 BALANCE ⑤), 그 describe 가 검증하는 것은 한 대의 크기가
       아니라 쓰러짐이다. 크기를 검증하는 자리는 따로 있고 거기서는 값을 바꾸지 않았다

    ④ `critical.spec.ts` 의 `arena` 헬퍼 — **밖에서 값에 손대는 순서가 만든 한 순간**
       `hpMax` 를 100000 으로 올리는 순간 그 몸은 생명 120 / 최대 100000 이 되어
       다 죽어가는 것처럼 보이고, 자율 존재는 그때 몸으로 몰아붙인다. 기력 20 중 15 를
       치르고 나면 돌아올 5 가 없어 그 시험대의 상대가 내내 단단한 몸으로 남았다.
       **세계의 결함이 아니다** — 실제 플레이에는 회복이 없어 되돌아올 일 자체가 없고,
       "치를 수 없으면 못 바꾼다" 는 의도된 규칙이다 (BALANCE ④). 헬퍼가 기력을 미리
       쥐여 주고 한 Tick 을 지나 보내도록 고쳤다

    ⑤ 화면 Fixture 30개 — `allocations: []` · `attributes.allocation` ·
       경위의 세 자리. C016 이 `insight` 를, C023 이 `equipment` 를 더할 때와 같은 손질이다

## NOTES

### ① 03 의 BALANCE ① 을 정확히 다시 적는다 — 6대가 7대가 된다

`balanced` 가 모든 값에 0 을 보태므로 **관찰자 쪽 기준값은 그대로다.** 그러나
자율 존재는 스스로 `balanced` 에 머물지 않는다 — 생명 절반 아래에서 `reinforce` 로
간다. 그래서 wanderer(120)를 기본 기술로 눕히는 데 드는 대수가 달라진다.

    이전   20 × 6대                                    = 6대
    지금   20 × 3대 (60 까지) → 절반 아래 → 17 × 4대      = 7대

**의도된 결과다** — BALANCE ⑤ 가 그 수치를 세우고 05 가 승인했다. 다만 03 의
BALANCE ① 이 "두 체감 기준이 그대로다" 라고 적은 것은 **관찰자가 배분을 바꾸지 않을 때
관찰자 쪽 값이 그대로다** 는 뜻으로 읽어야 정확하다. 자율 존재 쪽은 이 Cycle 이 의도적으로
바꾼다. Stage 8 이 회귀를 판정할 때 이 구분을 기준으로 삼는다.

`DC-COMBAT-ONE-LAYER-AT-A-TIME` 은 깨지지 않는다 — 그 제약이 요구하는 것은 아래 층이
이 층 없이도 동작하는 것이고, 배분을 지우면 세계는 정확히 C023 으로 돌아간다.

### ② 자율 존재에게 능력·인지 축은 지금 아무것도 주지 않는다

wanderer 는 물리 기술만 걸고(RULE-NPC-DECIDE-001) 아는 범위는 자율 존재의 판단에
닿지 않는다(C016). 그래서 그 둘에 모는 배분은 그 개체에게 순손해이며, 그것이
RULE-NPC-ALLOCATION-001 이 `reinforce` 와 `balanced` 둘만 오가는 이유다.
**결손이 아니라 읽을 수 있는 사실이다** — 능력이나 인지에 몰아 둔 자율 존재를 보면
그것은 지금 무르다 (03 BALANCE ⑤).

### ③ 0 바닥이 만드는 비대칭 하나

어떤 값이 이미 0 인 몸은 그 축에서 덜어 갈 것이 없으므로 몰아 두는 일에 잃을 것이 없다.
지금 세계에서 그런 값은 `insight`(0)이며, 그래서 통찰을 기르지 않은 몸에게
`hunter` 밖의 배분은 인지 쪽 손해가 없다. **아직 기르지 않았다는 사실**이지 결손이
아니다 — 통찰이 오르면 그때부터 덜어 갈 것이 생긴다. 03 이 예고한 그대로다.

### ④ 남은 화면 몫

세계는 배분을 전부 싣지만 지금 화면에는 그것을 그리는 자리가 없다. Stage 7 의 몫이다.

### ⑤ engine/ 무변경

`npm run boundary:check` 위반 0. 기반이 부족해 막힌 곳은 없었다 —
interaction · hud · 스냅샷 확장이 전부 팩의 자리에서 닫혔다.
