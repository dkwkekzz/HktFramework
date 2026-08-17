# C012 — World Semantic

> 이 Cycle 은 `RULE-DAMAGE-CALCULATE-001` 의 **계산식을 바꾸지 않는다.**
> 그 함수가 읽는 두 값이 어디서 오는지만 바뀐다 — 지금은 `attacker.attack` 과
> `target.defense` 고정이고, 이후로는 스킬의 피해 방식이 넷 중 둘을 고른다.

## SEMANTIC DELTA

    REUSED
        Actor.Hp · Actor.Cp                     C007 — 자원 구조 그대로
        Actor.CurrentAction                     C002 — 행동 구조 그대로
        Actor.Guard · Actor.GuardBrokenUntil    C011 — 막기 상태 그대로
        SkillDefinition.baseDamage              C010 — 스킬 자체의 강함
        SkillDefinition.attackRatio             C010 — 능력을 피해로 바꾸는 계수
        SkillDefinition.cpCharge · cpCost       C007 — 기력 수지
        World.DefenseConstant = 100             C010 — 감쇄의 세계 상수. 바뀌지 않는다
        World.StrikeEvents                      C010 — 타격 기록 구조

    ADDED
        DamageType                              'physical' | 'aura' (값 둘뿐)
        SkillDefinition.damageType              모든 스킬이 정확히 하나를 가진다
        Actor.PhysicalAttack · Actor.AuraAttack 타입별 공격 능력
        Actor.Armor · Actor.Resistance          타입별 방어 능력
        ActionKind 'aura-strike'                오라 방식 스킬 1종
        DamageBreakdown.damageType              그 타격의 방식
        DamageBreakdown.offenseStat             { name, value } — 방식이 고른 공격 능력
        DamageBreakdown.defenseStat             { name, value } — 방식이 고른 방어 능력
        Actor.DefenseShape (파생)               두 방어 중 어느 쪽이 더 단단한가 —
                                                세계가 계산해 내놓는 판정

    CHANGED
        Actor.Attack → Actor.PhysicalAttack     이름과 함께 의미가 좁아진다 (물리 스킬에만 기여)
        Actor.Defense → Actor.Armor             위와 같음 (물리 피해만 줄인다)
                                                일반 Attack / Defense 는 남기지 않는다 —
                                                두 이름이 공존하면 어느 값이 계산의 권위인지
                                                모호해진다 (설계 §9)
        RULE-DAMAGE-CALCULATE-001
            NEW STEP    계산 앞에 타입 대응 단계가 선다 (아래 WORLD RULE)
            UNCHANGED   RawDamage 식 · DefenseMultiplier 식 · 반올림 · 하한 1 · 난수 없음
        RULE-ATTRIBUTE-SET-001
            CHANGED LIST  변경 가능 속성에서 attack · defense 가 빠지고
                          physicalAttack · auraAttack · armor · resistance 넷이 들어간다
                          (10개 → 12개). 하한 0 · 상한 100000 은 그대로 이어받는다
        CharacterDefinition.combat
            CHANGED       두 값 { attack, defense } → 네 값

    AFFECTED
        RULE-SKILL-BEGIN-001        오라 스킬도 같은 관문을 통과한다 —
                                    쓰러짐 · 행동 중 · 기력 부족 · 막는 중. 새 관문을 만들지 않는다
        RULE-SKILL-BUDGET-001       오라 스킬의 기력 수지도 같은 규칙이 정산한다
        RULE-SWING-STRIKE-001       누가 맞는지 정하는 판정 무변경.
                                    타격이 낳는 Breakdown 의 내용만 넓어진다
        RULE-GUARD-BLOCK-001        막기는 여전히 FinalDamage 에 걸린다.
                                    **막기는 damageType 을 읽지 않는다** — 오라 타격도
                                    물리 타격과 똑같이 절반이 되고 같은 기력을 치른다
                                    (01 EXCLUDED · 설계 §15)
        RULE-NPC-DECIDE-001         결정 방식 무변경. 자율 존재도 같은 네 능력을 쓴다
        RULE-DAMAGE-APPLY-001       덜어내는 값의 출처가 같은 자리(FinalDamage → AppliedDamage)다
        Observer Projection         관찰에 실리는 능력치가 둘에서 넷으로,
                                    Breakdown 항목이 넓어진다
        CHARACTER_CATALOG           두 종류의 능력치 분포 (아래 BALANCE)

## WORLD STATE

    DamageType                                  값 둘 — physical | aura. 다른 값은 없다

    SkillDefinition
        baseDamage          World Authority     REUSED
        attackRatio         World Authority     REUSED
        damageType          World Authority     ADDED — 스킬 정의가 소유한다.
                                                타격 순간에 정해지지 않는다
        baseDuration · cpCharge · cpCost        REUSED

    Actor
        PhysicalAttack      World Authority     종류가 정한다
        AuraAttack          World Authority     종류가 정한다
        Armor               World Authority     종류가 정한다
        Resistance          World Authority     종류가 정한다
        DefenseShape        World Derived       Armor 와 Resistance 를 견준 결과.
                                                저장하지 않는다 — 두 값에서 매번 계산된다

    DamageBreakdown (파생 — 저장하지 않는다)
        damageType          그 타격의 방식
        offenseStat         { name, value } — 방식이 고른 공격 능력과 그 값
        baseDamage · attackContribution · rawDamage        REUSED
        defenseStat         { name, value } — 방식이 고른 방어 능력과 그 값
                            (C010 의 targetDefense 를 대신한다)
        defenseMultiplier · finalDamage · appliedDamage · guard   REUSED

    DamageType 은 Actor 의 상태가 아니다. 어떤 Actor 도 "물리 존재" 이거나 "오라 존재" 이지 않다 —
    방식은 스킬이 지니고, 모든 Actor 는 네 능력을 모두 지닌다 (INTENT-DAMAGE-TYPE-001).

## WORLD RULE

    RULE-DAMAGE-CALCULATE-001 (CHANGED)
        Implements     INTENT-DAMAGE-CALCULATE-001 · INTENT-DAMAGE-TYPE-001 ·
                       INTENT-TYPED-OFFENSE-001 · INTENT-TYPED-DEFENSE-001 ·
                       INTENT-SKILL-SCALING-001 · INTENT-DAMAGE-BREAKDOWN-001
        Input          공격자 Actor · 대상 Actor · SkillKind
        Preconditions  없음 — 값을 정하는 계산이며 세계를 바꾸지 않는다
        Transition     없음

        Step 0 (ADDED) — 타입 대응
            DamageType = SkillDefinition(skill).damageType
            physical 이면   OffenseStat = attacker.PhysicalAttack   DefenseStat = target.Armor
            aura     이면   OffenseStat = attacker.AuraAttack       DefenseStat = target.Resistance
            대응표는 이 둘뿐이고 예외가 없다.
            고르지 않은 두 능력은 이 계산에서 **한 번도 읽히지 않는다.**

        Step 1~2 (UNCHANGED — C010 그대로)
            AttackContribution = OffenseStat × Skill.AttackRatio
            RawDamage          = Skill.BaseDamage + AttackContribution
            DefenseMultiplier  = 100 / (100 + DefenseStat)
            FinalDamage        = round(RawDamage × DefenseMultiplier)
                                 RawDamage > 0 이면 최소 1, RawDamage = 0 이면 0

        Result         DamageBreakdown — 위 두 Step 이 읽고 만든 값 전부.
                       고른 능력의 이름과 값이 함께 실린다.

        방식이 피해에 배율을 더하거나 빼지 않는다. 타입 보너스도 상성표도 없다 —
        결과의 차이는 오직 고른 두 값의 크기에서만 나온다 (DC-COMBAT-MATCHUP-SOFT).
        입력에 세계 시각도 난수원도 없다 (DC-COMBAT-PLAYER-CAUSALITY).
        Resistance 는 막아낼 확률이 아니라 Armor 와 같은 감쇄식에 들어가는 값이다.

    RULE-ATTRIBUTE-SET-001 (CHANGED — 목록만)
        Implements     INTENT-ATTRIBUTE-MUTATE-001
        CHANGED        변경 가능 속성 목록에서 attack · defense 가 빠지고
                       physicalAttack · auraAttack · armor · resistance 가 들어간다.
                       판정 방식 · 요청 경로 · 거절 사유 4종 무변경.
        Result         Success | Failure(debug-closed | unknown-target |
                       unknown-attribute | out-of-range)

    새 Rule 은 없다.
        오라 스킬은 RULE-SKILL-BEGIN-001 · RULE-SWING-STRIKE-001 · RULE-SKILL-BUDGET-001 ·
        RULE-DAMAGE-APPLY-001 을 기존 스킬과 똑같이 통과한다 (INTENT-AURA-SKILL-001 —
        "다른 것은 그것이 만드는 피해의 방식뿐이다"). 스킬이 하나 늘어난 것이
        새 규칙을 부르지 않는 것은 C007 이 heavy-attack 을 더했을 때와 같다.

## BALANCE — 이 Cycle 이 소유하는 수치

    설계 §9 는 이행 규칙을 정하고, 오라 쪽 초기값은 "새 오라 콘텐츠의 밸런스와 함께"
    이 단계가 정하라고 남겼다. 세 가지 제약 아래에서 정했다.

        (1) 이행은 C010 의 결과를 한 값도 바꾸지 않는다 (설계 수용 기준 §14-8)
        (2) 고를 이유가 실제로 생겨야 한다 — 두 종류의 방어가 반대로 치우친다
        (3) 새 자원도 새 수지도 만들지 않는다

    ── 이행 (결과 불변) ──────────────────────────────────────────────
        Actor.Attack  → PhysicalAttack     같은 값
        Actor.Defense → Armor              같은 값
        attack · heavy-attack → damageType = 'physical'
        따라서 물리 타격의 모든 피해값이 C010 과 완전히 같다.

    ── 오라 스킬 (ADDED) ─────────────────────────────────────────────
        aura-strike
            baseDuration 0.6 · baseDamage 6 · attackRatio 0.5 · cpCharge 12 · cpCost 0
            damageType 'aura'

        기본 스킬(attack)과 **모든 값이 같고 방식만 다르다.** 일부러 그렇게 두었다 —
        값이 다르면 결과 차이가 방식 때문인지 값 때문인지 갈리지 않는다.
        이 층이 만드는 것은 세기의 차이가 아니라 선택 하나이므로,
        비교가 순수해야 그 선택이 관찰된다 (설계 §6 의 예시도 같은 구성이다).

    ── 종류별 능력치 ─────────────────────────────────────────────────
        rabbit-swordsman   PhysicalAttack 40 · AuraAttack 40 · Armor 50 · Resistance 20
            검을 쓰는 단단한 몸이지만 오라를 받아내는 데는 약하다.
        wanderer           PhysicalAttack 40 · AuraAttack 15 · Armor 30 · Resistance 90
            몸은 무르나 오라는 거의 통하지 않는다. 오라로 치는 힘도 약하다.
        DEFAULT            wanderer 와 같다

        두 종류의 방어가 **반대로 치우쳐** 있다. 그래서 같은 상대에게도 무엇으로
        치느냐가 갈리고, 상대가 누구냐에 따라 답이 뒤집힌다.
        네 값을 모두 높게 가진 종류는 없다 (설계 §2).

    ── 실제로 갈리는 값 (관찰자 = rabbit-swordsman 기준) ──────────────
        → wanderer (Armor 30 · Resistance 90)
            attack       raw 6 + 40×0.5 = 26 → ×100/130 = 20     ← C010 과 같다
            aura-strike  raw 6 + 40×0.5 = 26 → ×100/190 = 14
            heavy-attack raw 32 + 40×1.0 = 72 → ×100/130 = 55    ← C010 과 같다
            물리가 낫다. 차이 6.

        → 다른 rabbit-swordsman (Armor 50 · Resistance 20)
            attack       raw 26 → ×100/150 = 17                  ← C010 과 같다
            aura-strike  raw 26 → ×100/120 = 22
            오라가 낫다. 차이 5. **답이 뒤집힌다.**

        → wanderer 가 관찰자를 칠 때
            attack (물리) raw 26 → ×100/150 = 17                 ← C010 과 같다

        C010 의 값이 나타나는 자리마다 그대로다 — 물리 타격은 한 값도 움직이지 않는다.

## OBSERVABLE SEMANTIC

    Actor.PhysicalAttack · AuraAttack · Armor · Resistance
        네 값 모두 관찰된다. 자기 것도 남의 것도 숨기지 않는다.

    Actor.DefenseShape
        World Derived. 두 방어를 견준 결과를 **세계가 계산해** 내놓는다.
            Armor > Resistance    → 'physical-tougher'  (오라에 약하다)
            Resistance > Armor    → 'aura-tougher'      (물리에 약하다)
            같으면                → 'even'
        보는 이가 종류 이름이나 생김새로 약점을 짐작하지 않게 하기 위한 것이다
        (DC-WORLD-OWNS-THE-SURFACE-LIST · 설계 §16.3-6).
        임계값을 두지 않는다 — 두 값의 대소만 본다. 임의 상수가 판정에 끼어들지 않는다.

    SkillDefinition.damageType
        각 스킬이 어떤 방식인지 관찰된다. 고르는 일이 가능하려면 고를 것의 성질이 보여야 한다.

    DamageBreakdown (타격마다)
        damageType · offenseStat{name,value} · baseDamage · attackContribution · rawDamage ·
        defenseStat{name,value} · defenseMultiplier · finalDamage · appliedDamage · guard?
        한 방을 보고 "왜 저쪽이 아니라 이쪽 능력으로 계산되었는가" 까지 답할 수 있다.

    RULE-ATTRIBUTE-SET-001 의 거절 사유
        unknown-attribute · out-of-range 그대로. 네 능력이 목록에 들어간 것만 달라진다.

    Observable Closure
        Rule 판단에 들어간 값이 전부 관찰된다 —
        방식(damageType) · 고른 두 값(offenseStat · defenseStat) · 감쇄율 · 결과.
        고르지 않은 두 능력도 Actor 관찰로 볼 수 있으므로,
        "저쪽으로 쳤다면 어땠을까" 를 보는 이가 직접 견줄 수 있다.

## SEMANTIC CLOSURE

    ── INTENT-DAMAGE-TYPE-001 ────────────────────────────────────────
    "스킬은 자기 피해 방식을 지닌다"        → SkillDefinition.damageType
    "방식은 둘뿐이다"                       → DamageType = physical | aura
    "한 타격은 정확히 하나만 가진다"        → damageType 은 단일 값. 혼합 표현이 없다
    "방식은 스킬이 지닌 성질이다"           → World Authority = SkillDefinition
    "타격 순간에 바뀌지 못한다"             → RULE-DAMAGE-CALCULATE-001 Step 0 은
                                              스킬 정의만 읽는다. Actor 상태를 읽지 않는다

    ── INTENT-AURA-SKILL-001 ─────────────────────────────────────────
    "오라 스킬이 적어도 하나 존재한다"      → ActionKind 'aura-strike' + SkillDefinition
    "기존 스킬과 같은 구조"                 → 새 Rule 없음 (WORLD RULE 마지막 항)
    "시작 조건·기력 수지·닿는 방식이 같다"  → RULE-SKILL-BEGIN-001 · RULE-SKILL-BUDGET-001 ·
                                              RULE-SWING-STRIKE-001 을 그대로 통과 (AFFECTED)
    "다른 것은 피해의 방식뿐"               → damageType 만 다르고 나머지 값이 attack 과 같다

    ── INTENT-TYPED-OFFENSE-001 ──────────────────────────────────────
    "두 공격 능력을 지닌다"                 → Actor.PhysicalAttack · Actor.AuraAttack
    "종류가 정한다"                         → CharacterDefinition.combat
    "둘이 같을 이유는 없다"                 → BALANCE — wanderer 는 40 / 15
    "자기 방식의 스킬에만 기여한다"         → Step 0 대응표. 고르지 않은 값은 읽히지 않는다
    "스킬을 통해서만 피해가 된다"           → 능력은 Step 1 의 AttackRatio 를 거쳐야 피해가 된다

    ── INTENT-TYPED-DEFENSE-001 ──────────────────────────────────────
    "두 방어 능력을 지닌다"                 → Actor.Armor · Actor.Resistance
    "각 방어는 자기 방식의 피해만 줄인다"   → Step 0 대응표
    "줄일 뿐 없애지 못한다"                 → FinalDamage 하한 1 (RawDamage > 0 일 때)
    "높아질수록 효율이 완만해진다"          → DefenseMultiplier = 100/(100+DefenseStat)
                                              두 방어가 같은 식을 쓴다
    "둘이 같을 이유는 없다"                 → BALANCE — 두 종류가 반대로 치우친다

    ── INTENT-DAMAGE-CALCULATE-001 (CHANGED) ─────────────────────────
    "먼저 방식을 읽고 두 능력을 고른다"     → Step 0
    "고른 값을 그 계산에 넣는다"            → Step 1~2 (C010 무변경)
    "계산은 여전히 하나뿐"                  → RULE-DAMAGE-CALCULATE-001 하나.
                                              방식별 분기가 값 선택 밖으로 나가지 않는다
    "방식이 배율을 더하거나 빼지 않는다"    → Step 1~2 에 damageType 이 등장하지 않는다
    "우연이 개입하지 않는다"                → 입력에 시각·난수원 없음
    "오라 방어는 확률이 아니다"             → Resistance 는 DefenseMultiplier 의 분모 항이다

    ── INTENT-DAMAGE-BREAKDOWN-001 (CHANGED) ─────────────────────────
    "방식이 경위에 실린다"                  → DamageBreakdown.damageType
    "고른 것이 무엇이었는지 실린다"         → offenseStat{name,value} · defenseStat{name,value}
    "왜 이쪽 능력으로 계산되었는지 읽힌다"  → 위 둘 + damageType 이 한 기록에 함께 있다

    ── INTENT-DAMAGE-TYPE-OBSERVE-001 ────────────────────────────────
    "네 능력을 숨기지 않는다"               → OBSERVABLE SEMANTIC 첫 항
    "상대의 두 방어를 견줄 수 있다"         → Actor 관찰의 Armor · Resistance
    "어느 쪽이 단단한지 세계가 밝힌다"      → Actor.DefenseShape (World Derived)
    "이름이나 생김새로 짐작하지 않는다"     → 판정이 World 에서 나온다. View 가 계산하지 않는다
    "각 스킬의 방식도 세계가 밝힌다"        → SkillDefinition.damageType 관찰

    닫히지 않은 문장 없음. GAP 없음.
