# C012 — World Implementation

## IMPLEMENTED

    DamageType                        world/semantic/combat.ts
                                      'physical' | 'aura'. 값 둘뿐이고 다른 값은 없다
    DAMAGE_TYPE_STATS                 world/semantic/combat.ts
                                      타입 대응표 (설계 §4). 대응의 **단일 출처**다 —
                                      규칙 코드에 방식별 분기를 따로 두지 않는다
    SkillDefinition.damageType        world/semantic/combat.ts
    SKILL_DEFINITIONS['aura-strike']  world/semantic/combat.ts
                                      기본 스킬과 모든 값이 같고 방식만 다르다
    ActionKind 'aura-strike'          world/semantic/action.ts (+ ACTION_DEFINITIONS)
    Actor.PhysicalAttack/AuraAttack   world/semantic/actor.ts
    Actor.Armor/Resistance            world/semantic/actor.ts
    Actor.DefenseShape (파생)          world/semantic/combat.ts `defenseShape()`
    offenseStatValue/defenseStatValue world/semantic/combat.ts — 방식이 고르는 값
    DamageBreakdown.damageType        world/semantic/combat.ts
    DamageBreakdown.offenseStat       world/semantic/combat.ts
    RULE-DAMAGE-CALCULATE-001 Step 0  world/rules/damage-calculate.ts
    skill-aura 요청 경로               world/actions/dispatch.ts

## REUSED

    RULE-DAMAGE-CALCULATE-001 Step 1~2   world/rules/damage-calculate.ts — 한 줄도 바뀌지 않았다
    DEFENSE_CONSTANT = 100               world/semantic/combat.ts
    RULE-SKILL-BEGIN-001                 world/rules/skill.ts — 오라 스킬도 같은 관문을 지난다
    RULE-SKILL-BUDGET-001                world/rules/skill.ts
    RULE-SWING-STRIKE-001                world/rules/attack.ts — 새 명중 판정 없음
    RULE-GUARD-BLOCK-001                 world/rules/guard.ts — 손대지 않았다
    RULE-NPC-DECIDE-001                  world/rules/npc — 손대지 않았다

## AFFECTED UPDATED

    Actor.Attack → PhysicalAttack        world/semantic/actor.ts · spawn.ts
    Actor.Defense → Armor                일반 attack/defense 는 남기지 않았다 (설계 §9)
    CombatSpec 두 값 → 네 값              world/semantic/character-catalog.ts
    defenseMultiplier(actor) → (value)   world/semantic/combat.ts
                                         인자가 Actor 가 아니라 **방어 값**이다.
                                         어느 쪽을 쓸지는 타격의 방식이 정하고
                                         이 함수는 고른 값을 받기만 한다
    DamageBreakdown.targetDefense
      → defenseStat { name, value }      world/semantic/combat.ts · projection · protocol
    MUTABLE_ATTRIBUTES                   world/semantic/combat.ts — 10개 → 12개
    RULE-ATTRIBUTE-SET-001               world/rules/attribute-set.ts — case 4개
    protocol/gameview.ts                 AttributesView.combatStats(네 값 + 두 배율) ·
                                         defenseShape · DamageBreakdownView ·
                                         TypedStatView(신설) · profile.damageType

## PROJECTION

    entities[].attributes.combatStats    world/projection/observer-view.ts
                                         physicalAttack · auraAttack · armor · resistance ·
                                         armorMultiplier · resistanceMultiplier
    entities[].attributes.defenseShape   world/projection/observer-view.ts
    interactions[skill-aura]             world/projection/observer-view.ts
                                         available + reason(기존 4종과 같은 목록) + profile
    interactions[*].profile.damageType   attack · skill-heavy · skill-aura
    strikes[].breakdown.damageType       world/projection/observer-view.ts (StrikeEvent 그대로 통과)
    strikes[].breakdown.offenseStat
    strikes[].breakdown.defenseStat
    hud self.combat.*                    physicalAttack · auraAttack · armor · resistance ·
                                         armorMultiplier · resistanceMultiplier · defenseShape

    commandCatalog 는 손대지 않았다 — 변경 가능 속성 목록을 세계에서 받아 싣는 구조라
    MUTABLE_ATTRIBUTES 가 바뀌자 자동으로 따라왔다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

## TESTS

    world/tests/damage-type.spec.ts (신규 26 tests)
        방식은 둘뿐 · 기존 2종은 물리 · 방식은 Actor 의 상태가 아니다
        오라 스킬이 기본 스킬과 값이 같고 방식만 다르다 · 같은 관문·같은 수지
        물리 스킬이 오라 쪽 값을 읽지 않는다 (오라 능력을 100000 으로 흔들어도 20 그대로)
        오라 스킬이 물리 쪽 값을 읽지 않는다
        하한 1 · 두 방어가 같은 감쇄식
        C010 물리 피해값 불변 (기본 20 · 고급 55)
        상대에 따라 답이 뒤집힌다 (wanderer 20/14 · 검사 분포 17/22)
        방식이 배율을 더하지 않는다 (두 방어를 같게 맞추면 결과가 완전히 같다)
        결정론 · 오라 방어는 확률이 아니다 · 체감식
        경위 2종 전체 대조 · targetDefense 별칭 없음
        네 능력·두 배율·defenseShape 관찰 · 약점은 값의 관계다
        스킬 profile 의 damageType 과 rawDamage
        REGRESSION 막기는 방식을 읽지 않는다

    마이그레이션한 기존 테스트
        world/tests/damage.spec.ts    기대값이 **한 값도 바뀌지 않았다** — 속성 이름과
                                      경위 항목만 바뀌었다. 옛 이름이 unknown-attribute 로
                                      거절되는 것도 함께 박았다
        world/tests/combat.spec.ts    combatStats · 변경 가능 목록 · profile
        world/tests/command.spec.ts   변경 가능 목록

    world 241 tests 통과 (기존 215 + 신규 26)
    npm run catalog:check 정합

## NOTES

    ── 왜 Step 0 을 계산 함수 **안**에 두었는가 ──────────────────────
    타입 대응을 별도 Rule 로 뽑으면 "세계에 계산이 둘" 로 읽힌다.
    03 이 정한 것은 하나의 Rule 안의 앞선 단계이고, 그렇게 두어야
    DC-COMBAT-ONE-FORMULA 가 코드에서도 그대로 보인다.
    Step 1~2 에 damageType 이 등장하지 않는 것이 이 층의 경계이며,
    그 사실 자체를 테스트가 지킨다 (두 방어를 같게 맞추면 결과가 완전히 같다).

    ── defenseMultiplier 의 인자를 바꾼 것 ───────────────────────────
    Actor 를 받으면 함수가 "어느 방어를 쓸지" 를 스스로 정해야 하고, 그러면 대응 지식이
    두 곳(대응표 · 이 함수)에 생긴다. 값을 받게 하여 고르는 책임을 Step 0 하나로 모았다.

    ── 막기를 한 줄도 고치지 않았다 ──────────────────────────────────
    `ruleGuardBlock` 의 시그니처는 `(target, attacker, finalDamage, worldTime)` 이다 —
    방식을 알 방법이 아예 없다. 이것이 "막기는 damageType 을 읽지 않는다" 의 구조적 증거이며
    테스트도 그 시그니처를 근거로 삼는다.

    ── 밸런스는 03 이 정한 값 그대로다 ───────────────────────────────
    rabbit-swordsman 40/40/50/20 · wanderer 40/15/30/90 · DEFAULT 는 wanderer 와 같다.
    물리 이행값(공격 40 · 방어 50·30)을 건드리지 않았으므로 C010 의 피해가 전부 보존된다.

    ── GAP ───────────────────────────────────────────────────────────
    없음. 03-world-semantic.md 의 ADDED / CHANGED 가 모두 코드에 존재한다.
