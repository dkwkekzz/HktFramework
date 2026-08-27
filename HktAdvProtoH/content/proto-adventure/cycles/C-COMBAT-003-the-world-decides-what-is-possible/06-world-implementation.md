# C-COMBAT-003 — World Implementation

## IMPLEMENTED

    World.AbilityCircumstances        world/semantic/circumstance.ts
                                      사정 셋 · 각자 자기 사유 코드 · Holds(Self, Other, Now)
    AbilityCircumstance               같은 파일 — `HOSTILITY_REASONS` (C018) 와 같은 꼴
    CircumstanceNow                   같은 파일 — 사정이 읽는 "지금". World.StrikeEvents 에
                                      이름과 모양을 맞춰 두어 세계 자체가 그대로 들어맞는다
    ABILITY_ALLOCATION_REQUIREMENT    같은 파일 — 능력 몫 문턱 3 (UL §18)

    SkillDefinition.requires          world/semantic/combat.ts — 갖춰져야 시작된다
    SkillDefinition.amplifiedBy       같은 파일 — 참인 동안 계수가 커진다
    ConditionShare · MetCondition     같은 파일
    SkillKind `hatsu-burst`           같은 파일 + world/semantic/action.ts
    forceOfSkill(kind, bonus)         같은 파일 — 보탬이 계수에 더해진다 (CHANGED)
    DamageBreakdown.conditions        같은 파일 — 언제나 실린다 (CHANGED)

    RULE-ABILITY-REQUIREMENT-001      world/rules/ability-circumstance.ts
    RULE-ABILITY-CONDITION-001        같은 파일
    metConditions                     같은 파일 — 지금 참인 조건들 (파생)

## REUSED

    allocationShares                  world/semantic/allocation.ts (C-COMBAT-001) — 읽기만 한다
    World.StrikeEvents · TTL          world/semantic/combat.ts (C007) — 이미 스스로 사라진다
    hp / hpMax                        world/semantic/actor.ts (C007)
    RULE-DAMAGE-CALCULATE-001         world/rules/damage-calculate.ts — **한 글자도 바뀌지 않았다**
    Force                             world/semantic/item.ts (C020)
    unavailableReason 자리             view/skill-presentation.ts 의 사유 칸 (C007 이래)

## AFFECTED UPDATED

    RULE-SKILL-BEGIN-001              world/rules/skill.ts — 관문이 **넷째**로 선다
                                      (대가보다 앞). SkillFailureReason 에 사정의 사유가 든다
    RULE-SWING-STRIKE-001             world/simulation/swing-strike.ts — 넘기는 위력을
                                      조건이 고른다. **대상마다 따로 돈다**
    RULE-STRIKE-DAMAGE-001            world/rules/strike-damage.ts — 참인 조건을 받아
                                      경위에 싣는다. 판정 순서는 그대로다
    isSkillKind                       world/semantic/combat.ts — **세 이름을 적어 두던 것을
                                      목록에 묻는 것으로 고쳤다.** 아래 NOTES ① 참조
    interactions 목록                  world/actions/interactions.ts — `skill-hatsu` 하나.
                                      네 기술 모두 세계를 함께 넘긴다
    Observer Projection               world/projection/observer-view.ts — 기술 자리가 넷이
                                      되고 profile 이 사정 둘을 싣는다. 네 자리가 같은
                                      `skillProfile` 을 쓴다 (아래 NOTES ②)
    protocol                          protocol/gameview-combat.ts — SkillProfileView 에
                                      requires·conditions, DamageBreakdownView 에 conditions.
                                      SkillRequirementView · SkillConditionView ·
                                      MetConditionView 셋이 새로 선다
    view 시험 fixture                  view/tests/fixtures/*.json 15개 — breakdown 에
                                      `conditions: []` 한 줄. 계약이 늘 싣는 값이므로
                                      기존 fixture 도 그 자리를 지닌다

## 건드리지 않았다

    engine/                           `npm test` 의 첫 걸음이 boundary:check 다 — 통과
    damage-calculate.ts               피해를 세는 식. 받는 계수가 달라질 뿐이다
    allocation.ts                     배분의 몫과 항목 — 읽기만 한다
    npc-decide.ts · npc-allocation.ts  자율 존재의 판단 구조. 아래 NOTES ③

## PROJECTION

    interactions[].profile.requires   world/projection/observer-view.ts (skillProfile)
    interactions[].profile.conditions 같은 자리 — 고른 대상에 대한 답이다
    interactions.skill-hatsu          같은 파일 — 갖춰지지 않아도 목록에 남는다
    strikes[].breakdown.conditions    같은 파일 — 세계의 이름(attackRatioShare)을
                                      관찰의 이름(bonus)으로 옮긴다

## TESTS

    world/tests/circumstance.spec.ts  33 검사 — 이 Cycle 의 Intent 열셋 전부
        사정 목록 · 사유 코드 · 기술은 이름만 가리킨다 · 모르는 이름은 없다
        빈 목록은 언제나 갖춰진 것이다 (기존 셋)
        관문 거절과 사유 · 아무것도 소모되지 않는다
        **사정이 대가보다 앞이다** (기력 0 + balanced → power-not-in-ability)
        **사정을 갖추면 그때 대가가 물어진다** (hatsu + 기력 0 → insufficient-cp)
        문턱을 넘는 배분이 하나뿐이다 · 옮기면 열린다 · 되돌리면 닫힌다
        생명 절반은 매번 다시 센다 · 그 상대가 나를 쳤는가는 **방향이 있다**
        관문 자리에는 상대가 없다
        조건은 막지 않는다 · 조건 없이도 큰 기술(49)보다 크다(60)
        조건 하나가 참이면 76 · 둘이면 계수 2.1 (곱하지 않는다)
        경위에 참인 조건과 몫 · 없으면 빈 목록
        요구와 조건이 **다른 칸**에 실린다 · 갖춰졌어도 실린다
        고른 대상을 바꾸면 상대를 읽는 조건의 답이 바뀐다 (자율 존재가 실제로 친 뒤)
        자율 존재도 같은 관문을 같은 사유로 지난다
        회귀 — 기본 기술 20 · 기존 셋 전부 열림 · 닿는 길이 정합

    전체                              1554 검사 통과 (이 Cycle 이전 1521 + 33)
                                      boundary:check 통과 · tsc 통과

## NOTES

### ① 이 Cycle 이 드러낸 것 — 이름을 적어 둔 판정 하나

`isSkillKind` 가 세 이름을 코드에 적어 두고 있었다. 그래서 새 기술은 **시작은 되는데
칼끝을 만들지 않았다** — 요청이 성공을 돌려주고 아무 일도 일어나지 않는다. 시험이
그것을 잡았다.

목록에 묻는 것으로 고쳤다 (`kind in SKILL_DEFINITIONS`). 이것은 이번 Cycle 과 무관한
리팩터링이 아니라 **이번 Cycle 이 만든 결함의 원인**이며, 같은 파일이 이미 그 규율을
적어 두고 있었다 — "정의를 찾는 열쇠로 이름을 쓰는 것과, 찾은 정의 대신 이름 자체를
판정 조건으로 쓰는 것은 다르다" (RULE-SKILL-SHAPE-001 의 주석 · DC-SKILL-IS-COMBINATION-NOT-NAME).

Stage 8 의 Constraint Candidate 후보다 — 세계가 목록을 소유한다는 규율이 **투영뿐 아니라
판정에도** 걸린다는 관찰이 이것으로 둘째다 (C018 의 `HOSTILITY_REASONS` 가 첫째).

### ② 기술 자리 넷이 같은 profile 을 쓴다

기술 interaction 세 개가 같은 profile 리터럴을 세 번 적고 있었다. 넷째를 더하면 넷이
된다. `skillProfile(kind)` 하나로 모았고 **기존 셋이 내는 값은 한 톨도 바뀌지 않았다**
(회귀 시험이 그것을 지킨다). 사정 둘을 싣는 자리가 한 곳이어야 새 사정이 관찰을 열지
않는다.

### ③ 자율 존재는 아직 이 기술을 고르지 않는다

`RULE-NPC-DECIDE-001` 은 기력만 보고 기본/고급을 고르고, `RULE-NPC-ALLOCATION-001` 은
생명만 보고 균형/강화를 고른다. 그래서 자율 존재의 배분은 능력 축에 몰리는 일이 없고,
이 기술은 그들에게 언제나 닫혀 있다.

**의도한 것이다.** 이 Cycle 이 여는 것은 "능력이 세계의 사실을 읽는다" 이지 판단
구조가 아니다 — C-COMBAT-001 이 배분에 대해 내린 판단(`npc-allocation.ts` 의 머리
주석)과 나란하다. 습성의 설계는 아직 승인되지 않은 문서의 몫이다
(`Design-Creature-Behavior-R0` — Master 의 HUMAN 대기).

관문이 조종 주체를 묻지 않는다는 것은 시험이 지킨다 — 능력에 몰아 둔 자율 존재의 몸은
같은 관문을 그대로 통과한다. Stage 8 의 MASTER FEEDBACK 에 이 자리를 보고한다.

### ④ 상대를 읽는 사정을 요구로 걸 수 없다는 것

관문에는 상대가 없다(쓰기 전이다). 그래서 상대를 읽는 사정을 `requires` 에 걸면 그
기술은 결코 나가지 않는다. 지금 세계는 그런 조합을 만들지 않으며, 코드가 아니라
**세계의 규율**로 막는다 — 형이 막으려면 사정을 둘로 갈라야 하고, 그러면
"사정은 하나의 목록이다" 가 두 목록이 된다 (03 의 WORLD STATE).

풀리는 자리는 정해져 있다: 관문이 고른 대상을 받는 날이며, 그것은 표식이 요구가 되는
Cycle 이다 (FR-WHAT-YOU-LEAVE-ON-THEM).

### ⑤ GAP 없음

03-world-semantic.md 의 ADDED · CHANGED 가 모두 코드에 있고, AFFECTED 가 새 의미와
정합한다. Semantic 이 부족해 지어낸 자리는 없다.
