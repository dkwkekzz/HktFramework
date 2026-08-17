# C010 — World Implementation

## IMPLEMENTED

    Actor.Attack · Actor.Defense              world/semantic/actor.ts
        모든 Actor 가 지니는 두 능력. 종류가 초기값을 정한다

    Actor.DefenseMultiplier (파생)             world/semantic/combat.ts  defenseMultiplier()
        저장하지 않는다 — isDowned · actorModifiers 와 같은 자리다

    Skill.RawDamageForObserver (파생)          world/semantic/combat.ts  rawDamage()
        지금 이 Actor 가 이 스킬을 쓰면 나오는 공격 피해 (방어 적용 전)

    SkillDefinition.BaseDamage · AttackRatio   world/semantic/combat.ts
        구 damage 필드를 대체한다 (CHANGED — 아래 참조)

    World.DefenseConstant = 100                world/semantic/combat.ts  DEFENSE_CONSTANT
        결정론 상수이므로 헤더 상수로 고정 (CLAUDE.md 의 CVar 예외 규정)

    CharacterDefinition.Combat                 world/semantic/character-catalog.ts
        CombatSpec { attack, defense } — kind 정적 데이터 3원소 중 시뮬레이션 항목

    DamageBreakdown                            world/semantic/combat.ts
        계산이 낳고 StrikeEvent 가 싣는 파생 구조 (6항목)

    RULE-DAMAGE-CALCULATE-001                  world/rules/damage-calculate.ts   (신규 파일)
        세계의 유일한 피해 계산. World State 를 바꾸지 않는 순수 계산이다.
        입력에 세계 시각도 난수원도 없다

    MutableAttribute attack · defense          world/semantic/combat.ts
        MUTABLE_ATTRIBUTES 에 두 항목 (min 0 · max 100000)

## REUSED

    Actor.Hp / HpMax / Cp / CpMax              world/semantic/actor.ts        변경 없음
    Actor.Modifiers · Downed                   world/semantic/combat.ts       변경 없음
    SkillDefinition.BaseDuration/CpCharge/CpCost                              변경 없음
    RULE-SWING-STRIKE-001                      world/simulation/swing-strike.ts  변경 없음
    RULE-BODY-PUSH-001                         world/rules/                   변경 없음
    RULE-DOWNED-001                            world/rules/strike-damage.ts   변경 없음
    World.StrikeEvents 수명·만료                world/semantic/combat.ts       변경 없음
    RULE-ATTRIBUTE-SET-001 의 판정 골격          world/rules/attribute-set.ts   목록만 늘었다
    C009 CommandCatalog                        world/projection/              코드 변경 0

## CHANGED

    SkillDefinition.Damage → BaseDamage + AttackRatio      world/semantic/combat.ts
        attack        damage 20 → baseDamage  6 · attackRatio 0.5
        heavy-attack  damage 55 → baseDamage 32 · attackRatio 1.0

    RULE-STRIKE-DAMAGE-001                                 world/rules/strike-damage.ts
        const amount = skillDefinition(kind).damage
            → const breakdown = ruleDamageCalculate(attacker, target, kind)
              const amount = breakdown.finalDamage
        Preconditions · 생명 하한 · 쓰러짐 연쇄는 손대지 않았다

    StrikeEvent                                            world/semantic/combat.ts
        breakdown 필드 추가 (amount 는 그대로 — 두 값은 언제나 같다)

## AFFECTED UPDATED

    RULE-ATTRIBUTE-SET-001         world/rules/attribute-set.ts
        applyNumeric 에 attack · defense 두 갈래 추가.
        두 능력은 다른 값을 끌고 오지 않는다 (hp/hpMax 처럼 상호 보정할 것이 없다)

    spawnActor                     world/semantic/spawn.ts
        카탈로그의 combat 을 그대로 싣는다 — Rule 코드에 kind 분기를 두지 않는다

    CHARACTER_CATALOG              world/semantic/character-catalog.ts
        rabbit-swordsman  attack 40 · defense 50
        wanderer          attack 40 · defense 30
        DEFAULT_CHARACTER attack 40 · defense 30
        자원 균형 주석을 공식 기준으로 재서술했다 (근거가 고정값에서 공식이 되었다)

    RULE-NPC-DECIDE-001            변경 없음 — 자율 존재는 같은 ActorState 를 가지므로
                                   추가 코드 없이 같은 계산 아래에 들어왔다

## PROJECTION

    world/projection/observer-view.ts

    entities[].attributes.combatStats          attack · defense · defenseMultiplier
                                               모든 Actor 에 예외 없이 실린다
    interactions[].profile                     damage → baseDamage · attackRatio · rawDamage
                                               (charge · cost 는 그대로)
    hud self.combat.attack / .defense / .defenseMultiplier
    strikes[].breakdown                        세계가 계산한 경위 그대로

    protocol/gameview.ts
        AttributesView.combatStats             ADDED
        InteractionView.profile                CHANGED (3필드로)
        DamageBreakdownView                    ADDED
        StrikeEventView.breakdown              ADDED

    C009 CommandCatalog 은 코드를 한 줄도 고치지 않았다 —
    MUTABLE_ATTRIBUTES 가 단일 출처이므로 목록이 저절로 늘어났다.
    "View 가 목록을 지어내지 않는다" 는 C009 의 규율이 실제로 값을 한 첫 사례다.

## TESTS

    world/tests/damage.spec.ts     (신규 · 18 항목)
        INTENT-ATTACK-POWER-001    초기값 관찰 · 공격 능력이 오르면 더 깎인다 ·
                                   공격 0 이어도 기본 피해량은 들어간다
        INTENT-DEFENSE-001         방어가 오르면 덜 아프다 · 방어 0 이면 그대로 받는다 ·
                                   방어 100000 이어도 0 이 되지 않는다 (하한 1) ·
                                   체감 곡선(줄어드는 폭이 단조 감소) · 방어 배율 관찰
        INTENT-SKILL-SCALING-001   계수가 큰 스킬이 같은 공격 증가에 더 크게 자란다
        INTENT-DAMAGE-CALCULATE-001 세 번 반복해도 같은 값 · 한 휘두름이 둘에게 닿으면
                                   각자의 방어로 각자의 값
        INTENT-DAMAGE-BREAKDOWN-001 경위 6항목 · amount === finalDamage ·
                                   변경 전후 비교로 원인 특정
        RULE-ATTRIBUTE-SET-001     두 능력 변경 성공 · 음수 거절 · 세계가 밝히는 목록에 등장
        C007 회귀                  기본 20 → 자율 존재 6대 · 기력 수지 4값 불변

    world/tests/combat.spec.ts     (갱신)
        BASIC.damage / HEAVY.damage → 숫자 상수 20 / 55 로 고정.
        공식으로 기대값을 다시 계산하면 구현을 구현으로 검사하게 되므로 숫자로 박았다.
        이 두 값이 C007 의 고정 피해와 같다는 것이 공격 쪽 체감 보존의 회귀 기준이다.
        속성 관찰 기대값에 combatStats 추가, 변경 가능 목록에 두 항목 추가,
        스킬 profile 기대값을 새 3필드로 갱신.

    world/tests/command.spec.ts    (갱신)
        허용 목록 단일 출처 검사에 attack · defense 추가

    결과   world 12 파일 180 항목 통과 (기존 165 + 신규 18 — 3 항목은 목록/속성 확장 갱신)
    npm run catalog:check   카탈로그 3원소 정합

## NOTES

    ── 공식을 어디에 두었는가 ────────────────────────────────────────
    RULE-DAMAGE-CALCULATE-001 을 별도 파일로 뺐다. 이것이 이 Cycle 의 핵심이고,
    앞으로 올라올 모든 층(Critical · Guard · Penetration · Aura)이 새 공식을 만들지 않고
    이 파일의 입력값·결과값에 한 가지 의미만 더하게 하기 위해서다 (DC-COMBAT-ONE-FORMULA).
    파일 머리 주석에 그 확장 지점을 명시해 두었다.

    ── 하한 1 ────────────────────────────────────────────────────────
    03 의 "방어는 줄일 뿐 없애지 못한다" 는 곱셈만으로는 보장되지 않는다 —
    반올림이 0 을 만들 수 있기 때문이다. RawDamage > 0 인 한 최소 1 로 막았다.
    RawDamage 자체가 0 이면 없는 피해를 만들지 않는다 (0 그대로).

    ── 밸런스를 역산한 이유 ──────────────────────────────────────────
    R1 §11 의 예시 수치(HP 500 · Attack 100 · Base 25/75)를 그대로 쓰면 전면 재밸런싱이 된다.
    01-cycle.md 의 EXCLUDED 가 그것을 금지하므로, 대신 현재 hp 규모(200/120)에 맞춰
    같은 구조의 값을 역산했다 — Attack 40 은 R1 의 100 을 hp 비율(2.5배)로 축소한 값이다.
    Human 이 05-review.md 에서 이 선택을 승인했다.

    ── 두 종류의 Attack 이 같은 값인 것 ──────────────────────────────
    공격 쪽 체감을 보존하려면 관찰자와 자율 존재의 Attack 을 같게 둘 수밖에 없었다.
    종류마다 공격 능력이 갈리는 모습은 이번 Cycle 에서 디버그 명령으로 만들어 확인한다.
    종류별 차등은 장비·성장 층이 올라올 때 자연스럽게 생긴다 (R1 §12).

    ── GAP ───────────────────────────────────────────────────────────
    없음. 03-world-semantic.md 의 ADDED / CHANGED 가 모두 코드에 존재한다.
