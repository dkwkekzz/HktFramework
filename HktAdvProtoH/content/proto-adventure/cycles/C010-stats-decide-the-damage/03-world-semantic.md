# C010 — World Semantic

> 이 Cycle 은 세계에 새 행동도 새 자원도 새 관찰 경로도 만들지 않는다.
> 값 2종(Actor)과 값 2종(Skill)이 더해지고, 이미 있던 계산 한 줄이 공식 하나로 바뀐다.
> 그 공식이 세계의 **유일한** 피해 계산이 된다 (DC-COMBAT-ONE-FORMULA).

## SEMANTIC DELTA

    REUSED
        Actor.Hp / Actor.HpMax               생명은 그대로다 — 깎이는 값만 달라진다
        Actor.Cp / Actor.CpMax               기력 수지는 이 Cycle 이 건드리지 않는다
        Actor.CharacterKind                  종류가 능력치를 정한다는 방식 그대로다
        CharacterDefinition                  종류별 정적 데이터의 단일 출처 — 항목만 늘어난다
        Actor.Downed                         파생 상태 그대로 (hp <= 0)
        Actor.Modifiers                      배율 네 값 그대로 — 공격·방어에는 걸리지 않는다
        SkillDefinition.BaseDuration         행동 길이 그대로
        SkillDefinition.CpCharge / CpCost    기력 수지 그대로
        World.StrikeEvents                   타격 결과 기록 구조 그대로 (실리는 내용이 늘어난다)
        World.StrikeEventTtl                 관찰되는 시간 그대로
        RULE-SWING-STRIKE-001                누가 맞았는지 정하는 판정 그대로
        RULE-DOWNED-001                      쓰러짐 그대로
        RULE-BODY-PUSH-001                   밀어냄은 피해 계산과 무관하다
        RULE-ATTRIBUTE-SET-001               값을 바꾸는 판정 경로 그대로 — 목록만 늘어난다
        World.DebugAuthority                 조작 허용 여부 그대로

    ADDED
        Actor.Attack                         공격 능력 (INTENT-ATTACK-POWER-001)
        Actor.Defense                        방어 능력 (INTENT-DEFENSE-001)
        CharacterDefinition.Combat           종류가 정하는 두 능력의 값
        SkillDefinition.BaseDamage           스킬 자체의 강함 (INTENT-SKILL-SCALING-001)
        SkillDefinition.AttackRatio          그 스킬이 공격 능력을 피해로 바꾸는 정도
        World.DefenseConstant                방어 감쇄의 세계 상수 (결정론 상수)
        DamageBreakdown                      한 번의 계산이 남기는 경위 (파생 — 저장하지 않는다)
        StrikeEvent.Breakdown                타격 기록에 실리는 그 경위
        RULE-DAMAGE-CALCULATE-001            세계의 유일한 피해 계산
        MutableAttribute.attack              바꿀 수 있는 속성 목록에 추가
        MutableAttribute.defense             바꿀 수 있는 속성 목록에 추가

    CHANGED
        SkillDefinition.Damage
            기존  damage: number — 한 번의 타격이 덜어내는 생명 (고정)
            변경  제거된다. 그 자리를 BaseDamage + AttackRatio 가 대신한다.
                  스킬이 혼자 피해를 정하던 유일한 출처가 없어진다
        RULE-STRIKE-DAMAGE-001
            기존  Amount = SkillDefinition.Damage
            변경  Amount = RULE-DAMAGE-CALCULATE-001(공격자, 대상, 스킬).FinalDamage
                  Preconditions · 생명 하한 · StrikeEvent 기록 · 쓰러짐 연쇄는 그대로다
        StrikeEvent
            기존  { attackerId, targetId, skill, amount, position, time }
            변경  위에 breakdown 이 더해진다 — amount 는 breakdown.finalDamage 와 같다

    AFFECTED
        RULE-SWING-STRIKE-001        호출하는 값이 달라질 뿐 판정 자체는 바뀌지 않는다.
                                     맞은 몸마다 각자의 방어 능력으로 따로 계산된다
        RULE-NPC-DECIDE-001          자율 존재도 자기 공격 능력으로 때리고
                                     자기 방어 능력으로 받는다. 결정 방식은 그대로다
        RULE-ATTRIBUTE-SET-001       변경 가능 목록이 8개에서 10개가 된다.
                                     범위 검사·거절 사유 4종은 그대로다
        Observer Projection          entities[].attributes 에 두 능력과 방어 배율이,
                                     interactions[].profile 에 스킬의 두 값이,
                                     strikes[] 에 계산 경위가 더해진다
        Character Catalog            두 종류(rabbit-swordsman · wanderer)와 기본 정의에
                                     combat 항목이 더해진다 — kind 정적 데이터 3원소 중 1
        C007 자원 균형 주석          "몇 대에 쓰러지는가" 의 근거가 고정값에서 공식이 된다

## WORLD STATE

    Actor
        Attack          World Authority    >= 0. 종류가 초기값을 정한다.
                                           RULE-ATTRIBUTE-SET-001 만이 그 뒤에 바꾼다
        Defense         World Authority    >= 0. 위와 같다
        (Hp · Cp · TempoStats · MoveMode 등 기존 State 는 변화 없음)

    World
        DefenseConstant World Authority    세계 상수 100 — 결정론에 영향을 주므로 고정한다.
                                           방어 능력이 이 값과 같을 때 피해가 정확히 절반이 된다

    SkillDefinition (정적 — 세계가 쓰는 스킬 정의)
        BaseDamage      World Authority    스킬 자체의 강함
        AttackRatio     World Authority    공격 능력을 피해로 바꾸는 비율
        (BaseDuration · CpCharge · CpCost 는 변화 없음)

    CharacterDefinition.Combat (정적 — 종류가 정하는 값)
        Attack          World Authority
        Defense         World Authority

    DamageBreakdown (파생 — 저장하지 않는다. 계산이 낳고 StrikeEvent 가 싣는다)
        BaseDamage           그 스킬의 기본 피해량
        AttackContribution   공격 능력이 더한 몫 = Attacker.Attack × Skill.AttackRatio
        RawDamage            BaseDamage + AttackContribution
        TargetDefense        맞는 자의 방어 능력
        DefenseMultiplier    방어가 남긴 비율
        FinalDamage          실제로 생명에서 빠진 값

## WORLD RULE

    RULE-DAMAGE-CALCULATE-001
        Implements     INTENT-DAMAGE-CALCULATE-001 · INTENT-ATTACK-POWER-001 ·
                       INTENT-DEFENSE-001 · INTENT-SKILL-SCALING-001
        Input          공격자 Actor, 대상 Actor, SkillKind, World
        Preconditions  없음 — 이것은 값을 정하는 계산이며 세계를 바꾸지 않는다
        Transition     없음 (World State 를 변경하지 않는다)
        Result         DamageBreakdown

            AttackContribution = Attacker.Attack × Skill.AttackRatio
            RawDamage          = Skill.BaseDamage + AttackContribution
            DefenseMultiplier  = World.DefenseConstant
                                 / (World.DefenseConstant + Target.Defense)
            FinalDamage        = round(RawDamage × DefenseMultiplier)
                                 단, RawDamage > 0 이면 최소 1 이다

        방어 능력이 0 이상이므로 DefenseMultiplier 는 0 초과 1 이하다 —
        방어는 피해를 줄이지만 없애지 못한다 (INTENT-DEFENSE-001).
        하한 1 은 그 문장을 반올림이 깨뜨리지 못하게 하는 것이다.
        RawDamage 가 0 이면 FinalDamage 도 0 이다 — 없는 피해를 만들어 내지 않는다.
        이 계산에는 세계 시각도 우연도 들어가지 않는다 (DC-COMBAT-PLAYER-CAUSALITY).

    RULE-STRIKE-DAMAGE-001 (CHANGED)
        Implements     INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001
        Input          공격자 Actor, 대상 Actor, SkillKind, World
        Preconditions  대상이 쓰러지지 않았다                    (변화 없음)
        Transition     Breakdown = RULE-DAMAGE-CALCULATE-001(공격자, 대상, 스킬)
                       대상.Hp = max(0, Hp - Breakdown.FinalDamage)
                       World.StrikeEvents += { 공격자, 대상, 스킬,
                                               amount = Breakdown.FinalDamage,
                                               breakdown = Breakdown,
                                               위치, 시각 }
                       Hp 가 0 이면 RULE-DOWNED-001
        Result         Damaged(FinalDamage)

        한 번의 휘두름이 여럿에게 닿으면 맞은 몸마다 이 규칙이 따로 돌아간다 —
        각자의 방어 능력으로 각자의 값이 나온다 (RULE-SWING-STRIKE-001 은 변화 없음).

    RULE-ATTRIBUTE-SET-001 (AFFECTED — 목록만 늘어난다)
        Implements     INTENT-ATTRIBUTE-MUTATE-001    (변화 없음)
        변경점         MutableAttributes 에 두 항목이 더해진다
                           attack   min 0  max 100000
                           defense  min 0  max 100000
                       판정·범위 검사·거절 사유 4종은 그대로다.
                       방어의 하한이 0 인 것은 음수 방어(피해 증폭)를 이 층에서
                       만들지 않기 위해서다 — 증폭은 위층(Critical·Aura)의 일이다

## BALANCE

    이번 Cycle 은 재밸런싱이 아니다. 값은 **C007 의 체감을 보존하는 방향**으로 역산했다.

    World.DefenseConstant = 100                                        (R1 §4)

    CharacterDefinition.Combat
        rabbit-swordsman    Attack 40    Defense 50
        wanderer            Attack 40    Defense 30
        DEFAULT_CHARACTER   Attack 40    Defense 30

    SkillDefinition
        attack          BaseDamage  6    AttackRatio 0.5     (기존 damage 20 을 대체)
        heavy-attack    BaseDamage 32    AttackRatio 1.0     (기존 damage 55 를 대체)

    유도되는 값 — 세계가 실제로 내는 숫자

        관찰자(A40) → 자율 존재(D30)
            기본   (6 + 40×0.5) = 26  × 100/130 = 20.0  → 20     C007 과 같다
            고급   (32 + 40×1.0) = 72 × 100/130 = 55.4  → 55     C007 과 같다
            자율 존재 hp 120 → 기본 6대 · 고급 2대 + 기본 1대     C007 주석 그대로

        자율 존재(A40) → 관찰자(D50)
            기본   26 × 100/150 = 17.3 → 17                      C007 은 20 이었다
            관찰자 hp 200 → 기본 12대 (C007 은 10대)

    관찰자가 더 오래 버티게 된 것은 이 Cycle 이 만든 의미다 —
    rabbit-swordsman 의 방어 능력(50)이 wanderer(30)보다 높기 때문이다.
    공격 쪽 체감은 그대로 두고 방어 쪽만 달라지게 한 선택이며,
    두 종류의 Attack 을 같은 값으로 둔 것도 같은 이유다 (공격 체감 보존).
    종류마다 공격 능력이 갈리는 것은 값을 바꿔 보는 것으로 즉시 확인된다.

## OBSERVABLE SEMANTIC

    모든 새 의미는 기존 관찰 경로에 실린다. 새 경로를 만들지 않는다.

    Actor.Attack · Actor.Defense
        entities[].attributes.combatStats     모든 존재에 대해 (INTENT-ATTRIBUTE-OBSERVE-001)
        hud self.combat.attack / .defense     자기 것은 늘 눈앞에 (INTENT-SELF-OBSERVE-001)

    Defense 가 실제로 얼마나 줄이는가 (파생)
        entities[].attributes.defenseMultiplier
            방어 능력이라는 값과 "그래서 몇 %로 받는가" 는 다른 정보다.
            둘 다 실린다 — 체감식이므로 값만 보고는 효과를 알 수 없기 때문이다

    스킬이 무엇을 얼마나 만드는가 (INTENT-SKILL-SCALING-001 · INTENT-SELF-OBSERVE-001)
        interactions[].profile
            baseDamage      그 스킬의 기본 피해량
            attackRatio     공격 능력을 피해로 바꾸는 비율
            rawDamage       지금 내 공격 능력으로 이 스킬을 쓰면 나오는 공격 피해
            charge · cost   기존 그대로
        최종 피해는 여기 실리지 않는다 — 대상이 정해지기 전에는 알 수 없는 값이다.
        무엇이 맞을지는 요청할 때가 아니라 휘두름 구간의 접촉이 정한다 (C007 그대로)

    한 번의 타격이 그 크기가 된 경위 (INTENT-DAMAGE-BREAKDOWN-001)
        strikes[].amount        기존 그대로 — 실제로 빠진 값
        strikes[].breakdown     baseDamage · attackContribution · rawDamage ·
                                targetDefense · defenseMultiplier · finalDamage

    무엇을 바꿀 수 있는가 (INTENT-ATTRIBUTE-MUTATE-001)
        commands[set-attribute] 의 attribute Domain 에 attack · defense 가 나타난다.
        각자의 허용 범위도 함께 실린다 — View 가 목록을 지어내지 않는다는 규율 그대로

    실패 사유
        이 Cycle 은 새 거절 사유를 만들지 않는다.
        피해 계산은 실패하지 않는 계산이고 (Preconditions 없음),
        값 변경의 거절 사유는 기존 4종 그대로다

## SEMANTIC CLOSURE

    INTENT-ATTACK-POWER-001
        "공격 능력을 지닌다"              → Actor.Attack
        "존재의 종류가 값을 정한다"        → CharacterDefinition.Combat.Attack
        "높으면 같은 스킬로 더 큰 피해"    → RULE-DAMAGE-CALCULATE-001 의 AttackContribution
        "그 자체로는 아무것도 일으키지 않는다"
                                          → Attack 을 읽는 규칙은 RULE-DAMAGE-CALCULATE-001
                                             하나뿐이고, 그 입력에 반드시 Skill 이 있다

    INTENT-DEFENSE-001
        "방어 능력을 지닌다"              → Actor.Defense
        "종류가 값을 정한다"              → CharacterDefinition.Combat.Defense
        "줄일 뿐 없애지 못한다"           → DefenseMultiplier > 0 · FinalDamage 하한 1
        "높아질수록 추가 효율이 작아진다"  → DefenseConstant / (DefenseConstant + Defense)
                                             (증가분에 대한 감소폭이 단조 감소한다)

    INTENT-SKILL-SCALING-001
        "기본 피해량"                     → SkillDefinition.BaseDamage
        "공격 계수"                       → SkillDefinition.AttackRatio
        "스킬마다 다르다"                 → attack(6·0.5) vs heavy-attack(32·1.0)
        "계수가 큰 스킬이 더 크게 자란다"  → AttackContribution 이 Ratio 에 비례한다

    INTENT-DAMAGE-CALCULATE-001
        "두 단계로 정한다"                → RULE-DAMAGE-CALCULATE-001 의 Raw → Final
        "계산 하나만 있다"                → Actor.Hp 를 타격으로 줄이는 규칙은
                                             RULE-STRIKE-DAMAGE-001 하나이고,
                                             그것이 이 계산만을 호출한다
        "우연이 개입하지 않는다"           → 입력에 세계 시각도 난수원도 없다
        "같으면 언제나 같다"              → 같은 입력 → 같은 Breakdown (순수 계산)

    INTENT-STRIKE-DAMAGE-001 (CHANGED)
        "스킬 혼자 정하지 않는다"          → SkillDefinition.Damage 제거
        "셋이 함께 정한 최종 피해"        → RULE-STRIKE-DAMAGE-001 Transition
        "흔들림이 없다"                   → 위와 같음 (계산이 순수하다)
        "고급이 기본보다 크게 깎는다"      → BALANCE 유도값 55 > 20

    INTENT-DAMAGE-APPLY-001 (CHANGED)
        "최종 피해만큼 덜어낸다"          → Hp = max(0, Hp - FinalDamage)
        "0 아래로 내려가지 않는다"        → max(0, ...)  (변화 없음)
        "피격 반응과 함께 일어난다"        → RULE-SWING-STRIKE-001 순서 그대로

    INTENT-SWING-IMPACT-001 (CHANGED)
        "받는 것은 최종 피해다"           → 위와 같음
        "밀어냄은 영향을 받지 않는다"      → RULE-BODY-PUSH-001 은 REUSED, 입력에
                                             Breakdown 이 들어가지 않는다

    INTENT-DAMAGE-BREAKDOWN-001
        "경위를 함께 남긴다"              → StrikeEvent.Breakdown
        "네 가지를 읽는다"                → DamageBreakdown 의 여섯 항목
        "왜 달라졌는지 알 수 있다"        → 값 변경 전후의 breakdown 을 비교할 수 있다

    INTENT-STRIKE-OBSERVE-001 (CHANGED)
        "경위까지 드러난다"               → strikes[].breakdown

    AFFECTED Intent 의 닫힘
        INTENT-ATTRIBUTE-OBSERVE-001   두 능력이 entities[].attributes 에 실린다
        INTENT-ATTRIBUTE-MUTATE-001    두 항목이 MutableAttributes 에 더해진다
        INTENT-SELF-OBSERVE-001        self.combat.* HUD · interactions[].profile 확장
        INTENT-NPC-AUTONOMY-001        자율 존재도 같은 Actor State 를 가지므로
                                       추가 규칙 없이 같은 계산 아래에 있다

    닫히지 않은 문장 없음. GAP 없음.
