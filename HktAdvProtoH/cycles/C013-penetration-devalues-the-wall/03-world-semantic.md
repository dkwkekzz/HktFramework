# C013 — World Semantic

> 이 Cycle 은 `RULE-DAMAGE-CALCULATE-001` 의 **계산식을 바꾸지 않는다.**
> C012 의 Step 0 (타입 대응) 도 그대로다. 고른 방어 값이 감쇄식에 들어가기 직전에
> 한 걸음이 놓인다 — 치는 자의 그 방식 관통이 그 방어에서 자기 몫을 걷어낸다.
> 걷어내는 데 쓰는 곡선은 **세계에 이미 있는 그 곡선**이다 (`100 / (100 + x)`).
> 새 곡선도 새 배율도 만들지 않는다.

## SEMANTIC DELTA

    REUSED
        Actor.Hp · Actor.Cp                     C007 — 자원 구조 그대로. 관통은 자원을 쓰지 않는다
        Actor.CurrentAction                     C002 — 행동 구조 그대로. 새 행동이 없다
        Actor.Guard · Actor.GuardBrokenUntil    C011 — 막기 상태 그대로
        Actor.PhysicalAttack · AuraAttack       C012 — 공격 쪽은 한 값도 건드리지 않는다
        Actor.Armor · Actor.Resistance          C012 — 방어 값 자체는 그대로 남는다
        Actor.DefenseShape (파생)               C012 — 상대의 성질이다. 관통이 이 판정을 흔들지 않는다
        DamageType · SkillDefinition.damageType C012 — 대응은 여전히 스킬의 방식이 정한다
        SkillDefinition.baseDamage · attackRatio · cpCharge · cpCost    C010 · C007
        World.DefenseConstant = 100             C010 — 감쇄의 세계 상수. 바뀌지 않는다
        World.StrikeEvents                      C010 — 타격 기록 구조

    ADDED
        Actor.ArmorPenetration                  상대의 Armor 를 통하지 않게 만드는 능력
        Actor.ResistancePenetration             상대의 Resistance 를 통하지 않게 만드는 능력
        World.PenetrationConstant = 100         걷히는 몫을 정하는 세계 상수
        PenetrationStatName                     'armorPenetration' | 'resistancePenetration'
        EffectiveDefense (파생)                 걷히고 남은 방어. 감쇄식에 실제로 들어가는 값
        DamageBreakdown.penetrationStat         { name, value } — 이 타격에서 작용한 관통
        DamageBreakdown.effectiveDefense        걷힌 뒤의 방어 값
        ActorView.combatStats.armorPenetration · resistancePenetration
        ActorView.versusObserver (파생)         이 존재의 두 방어가 **보는 이의 관통에게**
                                                얼마로 읽히는가 — 치기 전에 보이는 값

    CHANGED
        RULE-DAMAGE-CALCULATE-001
            NEW STEP    Step 0 (타입 대응) 과 Step 2 (감쇄) 사이에 Step 1 이 놓인다 —
                        고른 방어에서 대응하는 관통이 자기 몫을 걷어낸다
            CHANGED     DefenseMultiplier 가 읽는 값이 DefenseStat.value 에서
                        EffectiveDefense 로 바뀐다
            UNCHANGED   Step 0 대응표 · RawDamage 식 · DefenseMultiplier 식 · 상수 100 ·
                        반올림 · 하한 1 · 난수 없음
        DamageBreakdown.defenseStat
            의미 고정   `{ name, value }` 의 value 는 **걷히기 전** 방어다.
                        감쇄에 실제로 들어간 값은 새 항목 effectiveDefense 가 가진다.
                        두 값이 한 기록에 함께 있어야 "얼마나 통하지 않았는가" 가 읽힌다
        RULE-ATTRIBUTE-SET-001
            CHANGED LIST  변경 가능 속성에 armorPenetration · resistancePenetration 이
                          들어간다 (12개 → 14개). 하한 0 · 상한 100000 은 그대로 이어받는다
        CharacterDefinition.combat
            CHANGED       네 값 → 여섯 값

    AFFECTED
        RULE-SWING-STRIKE-001       누가 맞는지 정하는 판정 무변경.
                                    타격이 낳는 Breakdown 의 내용만 넓어진다
        RULE-GUARD-BLOCK-001        막기는 여전히 FinalDamage 에 걸린다.
                                    **막기는 관통을 읽지 않고, 관통은 막기를 뚫지 않는다** —
                                    두 의미는 계산의 서로 다른 지점에 있다 (01 EXCLUDED)
        RULE-DAMAGE-APPLY-001       덜어내는 값의 출처가 같은 자리(FinalDamage → AppliedDamage)다
        RULE-SKILL-BEGIN-001        관문 무변경. 관통은 스킬 시작에 관여하지 않는다
        RULE-SKILL-BUDGET-001       기력 수지 무변경
        RULE-NPC-DECIDE-001         결정 방식 무변경. 자율 존재도 같은 여섯 능력을 쓴다
        Observer Projection         관찰에 실리는 능력치가 넷에서 여섯으로,
                                    Breakdown 항목이 넓어지고, versusObserver 가 더해진다
        CHARACTER_CATALOG           두 종류의 관통 분포 (아래 BALANCE)

## WORLD STATE

    Actor
        ArmorPenetration        World Authority     종류가 정한다. 0 이 기본값이며
                                                    "관통이 없다" 는 별도 상태가 아니라 값 0 이다
        ResistancePenetration   World Authority     위와 같음
        Armor · Resistance      World Authority     REUSED — 이 값은 타격으로 줄어들지 않는다.
                                                    걷힘은 계산 안에서만 일어난다
        DefenseShape            World Derived       REUSED — Armor 와 Resistance 를 견준 결과.
                                                    걷힌 값이 아니라 원래 값으로 판정한다

    World
        PenetrationConstant = 100   World Authority  ADDED — 걷히는 몫을 정하는 상수.
                                    DefenseConstant 와 같은 값이지만 **다른 이름으로 둔다**.
                                    한쪽을 조정할 때 다른 쪽이 따라 움직이면 안 되기 때문이다.
                                    결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 아님)

    EffectiveDefense (파생 — 저장하지 않는다)
        DefenseStat.value × PenetrationConstant / (PenetrationConstant + PenetrationStat.value)

        곧 남는 비율이 `100 / (100 + 관통)` 이다 — 세계가 이미 쓰는 그 곡선이며,
        여기서는 피해가 아니라 **방어 값**에 적용된다.
        관통 0 이면 남는 비율이 1 이므로 EffectiveDefense = DefenseStat.value 다.
        비율은 결코 0 에 이르지 않는다 — 방어가 통째로 사라지는 관통값은 없다.
        정수로 반올림하지 않는다. C010 의 DefenseMultiplier 가 이미 정수가 아닌 값으로
        관찰에 실리고 있으며, 보이는 값과 계산에 쓰인 값이 어긋나지 않아야 한다.

    DamageBreakdown (파생 — 저장하지 않는다)
        damageType · offenseStat · baseDamage · attackContribution · rawDamage   REUSED
        defenseStat         { name, value }  CHANGED — value 는 걷히기 전 방어
        penetrationStat     { name, value }  ADDED — 이 타격에서 작용한 관통.
                                             관통이 0 이어도 실린다. 이름이 없으면
                                             "왜 안 걷혔는가" 를 알 수 없다
        effectiveDefense    number           ADDED — 걷힌 뒤. DefenseMultiplier 의 입력
        defenseMultiplier · finalDamage · appliedDamage · guard   REUSED (입력만 바뀐다)

    관통은 Actor 의 능력이지 타격의 성질이 아니다. 어떤 스킬도 자기 관통을 지니지 않는다 —
    스킬은 어느 관통이 쓰일지를 자기 방식으로 고를 뿐이다 (INTENT-PENETRATION-MATCH-001).

## WORLD RULE

    RULE-DAMAGE-CALCULATE-001 (CHANGED)
        Implements     INTENT-DAMAGE-CALCULATE-001 · INTENT-PENETRATION-001 ·
                       INTENT-PENETRATION-MATCH-001 · INTENT-EFFECTIVE-DEFENSE-001 ·
                       INTENT-TYPED-DEFENSE-001 · INTENT-DAMAGE-BREAKDOWN-001
        Input          공격자 Actor · 대상 Actor · SkillKind
        Preconditions  없음 — 값을 정하는 계산이며 세계를 바꾸지 않는다
        Transition     없음 — 대상의 Armor · Resistance 는 이 규칙으로 줄어들지 않는다

        Step 0 (UNCHANGED — C012 그대로) — 타입 대응
            DamageType = SkillDefinition(skill).damageType
            physical 이면  OffenseStat = attacker.PhysicalAttack  DefenseStat = target.Armor
            aura     이면  OffenseStat = attacker.AuraAttack      DefenseStat = target.Resistance

        Step 1 (ADDED) — 관통 대응과 걷어내기
            physical 이면  PenetrationStat = attacker.ArmorPenetration
            aura     이면  PenetrationStat = attacker.ResistancePenetration
            대응표는 이 둘뿐이고 예외가 없다.
            고르지 않은 관통은 이 계산에서 **한 번도 읽히지 않는다.**

            EffectiveDefense = DefenseStat.value × 100 / (100 + PenetrationStat.value)

            PenetrationStat.value = 0 이면 EffectiveDefense = DefenseStat.value 다.
            DefenseStat.value = 0 이면 걷어낼 것이 없어 결과도 0 이다 —
            관통이 아무리 커도 아무 일도 일어나지 않는다.
            결과는 결코 음수가 아니고 결코 0 이 되지 않는다 (원래 방어가 0 보다 크면).

        Step 2~3 (UNCHANGED — C010 식 그대로, 입력만 바뀐다)
            AttackContribution = OffenseStat × Skill.AttackRatio
            RawDamage          = Skill.BaseDamage + AttackContribution
            DefenseMultiplier  = 100 / (100 + EffectiveDefense)      ← C010 과 같은 식
            FinalDamage        = round(RawDamage × DefenseMultiplier)
                                 RawDamage > 0 이면 최소 1, RawDamage = 0 이면 0

        Result         DamageBreakdown — 세 Step 이 읽고 만든 값 전부.
                       걷히기 전 방어 · 작용한 관통 · 걷힌 뒤 방어가 함께 실린다.

        관통이 피해에 배율을 더하거나 빼지 않는다. 관통 보너스표도 타입별 관통 효율도 없다 —
        결과의 차이는 오직 감쇄식에 들어간 방어 값에서만 나온다 (DC-COMBAT-MATCHUP-SOFT).
        관통은 RawDamage 를 한 톨도 키우지 않는다 (INTENT-DAMAGE-CALCULATE-001).
        입력에 세계 시각도 난수원도 없다 (DC-COMBAT-PLAYER-CAUSALITY) —
        관통은 방어를 무시할 확률이 아니라 언제나 같은 몫을 걷어내는 값이다.

    RULE-ATTRIBUTE-SET-001 (CHANGED — 목록만)
        Implements     INTENT-ATTRIBUTE-MUTATE-001
        CHANGED        변경 가능 속성에 armorPenetration · resistancePenetration 이 들어간다
                       (12개 → 14개). 판정 방식 · 요청 경로 · 거절 사유 4종 무변경.
        Result         Success | Failure(debug-closed | unknown-target |
                       unknown-attribute | out-of-range)

    새 Rule 은 없다.
        관통은 새 행동도 새 판정도 만들지 않는다. 기존 타격이 지나가는 자리에
        값 하나가 더 읽힐 뿐이다 (01 EXCLUDED — 새 행동·새 모션·새 스킬 없음).

## BALANCE — 이 Cycle 이 소유하는 수치

    근거 문서는 관통의 초기값을 지정하지 않는다. 세 가지 제약 아래에서 정했다.

        (1) 관통이 0 인 조합에서 C012 의 결과가 한 값도 달라지지 않는다
        (2) "관통을 지닌 쪽과 지니지 않은 쪽" 이 세계 안에 **둘 다** 있어야 한다 —
            그래야 같은 상대·같은 스킬로 견주는 일이 디버그 명령 없이도 성립한다
        (3) 새 자원도 새 수지도 만들지 않는다

    ── 세계 상수 ─────────────────────────────────────────────────────
        PenetrationConstant = 100

        남는 비율 = 100 / (100 + 관통)
            관통    0 →  100%  남는다 (아무 일도 없다)
            관통   25 →   80%
            관통   60 →   62.5%
            관통  100 →   50%
            관통  300 →   25%
        결코 0 에 이르지 않는다 — 방어를 통째로 걷어내는 값이 존재하지 않는다.
        그리고 관통을 올릴수록 추가 이득이 완만해진다.
        이것은 방어에 이미 걸려 있는 세계의 법이며, 관통도 그 법 밖에 있지 않다.

    ── 종류별 관통 ───────────────────────────────────────────────────
        wanderer           ArmorPenetration 60 · ResistancePenetration 0
            오라로 치는 힘이 약해(AuraAttack 15) 상대의 무른 오라 방어로 피해 갈 수 없다.
            남은 길은 마주한 갑주의 값어치를 떨어뜨리는 것뿐이다 —
            MP-PIERCE-THE-HARD-DEFENSE 가 말하는 바로 그 처지다.
        rabbit-swordsman   ArmorPenetration 0 · ResistancePenetration 0
            관통을 지니지 않는다. 이 종류가 내는 모든 피해는 C012 와 완전히 같다.
        DEFAULT            wanderer 와 같다 (플레이어가 관통을 지닌 쪽이다)

    ── 실제로 갈리는 값 ──────────────────────────────────────────────

        같은 상대 · 같은 스킬 · 같은 공격 능력(둘 다 PhysicalAttack 40, raw 26).
        다른 것은 치는 자의 관통뿐이다 — 대상은 rabbit-swordsman (Armor 50).

            rabbit-swordsman 이 친다 (관통 0)
                걷힘 없음        Armor 50 → 50      26 × 100/150 = 17.33 → 17
            wanderer 가 친다 (관통 60)
                62.5% 남는다     Armor 50 → 31.25   26 × 100/131.25 = 19.81 → 20

            **17 대 20.** 공격력도 스킬도 상대도 같다. 관통만 다르다.
            그리고 걷힌 방어가 50 → 31.25 로 관찰에 그대로 실린다.

        같은 관통이 상대에 따라 다르게 값한다 (wanderer 가 attack 으로 친다, raw 26).

            Armor    0  → 0        걷힘 0        26 × 100/100 = 26      관통 없을 때와 **같다**
            Armor   30  → 18.75    걷힘 11.25    26 × 100/118.75 = 22   (관통 0 이면 20 · +2)
            Armor   50  → 31.25    걷힘 18.75    26 × 100/131.25 = 20   (관통 0 이면 17 · +3)
            Armor  300  → 187.5    걷힘 112.5    26 × 100/287.5 = 9     (관통 0 이면 7 · +2, +29%)
            Armor    0 인 상대에게 관통은 문자 그대로 아무 일도 하지 않는다.
            두꺼울수록 걷어내는 양이 커진다 — 이것이 "상대에 따라 값이 달라지는 투자" 다.
            Armor 0 · 300 은 디버그 명령으로 만든다 (01 SCOPE NOTE).

        heavy-attack (raw 72) · wanderer → rabbit-swordsman
            관통 0 이면  72 × 100/150 = 48
            관통 60 이면 72 × 100/131.25 = 54.86 → 55

        오라 쪽은 한 값도 움직이지 않는다 — wanderer 의 ResistancePenetration 이 0 이다.
            wanderer 의 aura-strike → rabbit-swordsman (Resistance 20)
                raw 6 + 15×0.5 = 13.5 → ×100/120 = 11.25 → 11        C012 와 같다

    ── C012 대비 달라지는 값의 전부 ──────────────────────────────────
        wanderer 가 내는 **물리** 피해뿐이다. 그 외 모든 조합은 관통이 0 이므로
        C012 의 숫자가 그대로다 (rabbit-swordsman 의 모든 타격 · 모든 오라 타격).

## OBSERVABLE SEMANTIC

    Actor.ArmorPenetration · Actor.ResistancePenetration
        두 값 모두 관찰된다. 자기 것도 남의 것도 숨기지 않는다.
        `combatStats` 에 네 능력과 나란히 실린다.

    ActorView.versusObserver (World Derived — ADDED)
        이 존재의 두 방어가 **보는 이의 관통에게** 얼마로 읽히는가.
            armor              보는 이의 ArmorPenetration 으로 걷어낸 뒤의 값
            resistance         보는 이의 ResistancePenetration 으로 걷어낸 뒤의 값
            armorMultiplier    그 값으로 계산한 감쇄율
            resistanceMultiplier
        세계가 계산해 내놓는다 — 보는 이가 두 수를 곱해 짐작하지 않는다
        (DC-WORLD-OWNS-THE-SURFACE-LIST). 치기 전에 무엇이 통할지 알 수 있어야
        고르는 일이 판단이 된다 (INTENT-PENETRATION-OBSERVE-001).
        모든 존재에 실린다. 자기 몸에 실린 값은 자기 관통으로 자기 방어를 본 것이라
        쓸 데가 없지만 그래도 싣는다 — "지금은 볼 대상이 아니다" 와 "세계가 안 알려준다" 는
        다른 일이다 (C011 의 guard 관찰과 같은 원칙).
        DefenseShape 는 여기에 들어가지 않는다 — 어느 쪽이 단단한가는 상대의 성질이고,
        걷힌 값은 나와 상대 사이의 관계다 (INTENT-DAMAGE-TYPE-OBSERVE-001 AFFECTED).

    DamageBreakdown (타격마다)
        damageType · offenseStat{name,value} · baseDamage · attackContribution · rawDamage ·
        defenseStat{name,value} · penetrationStat{name,value} · effectiveDefense ·
        defenseMultiplier · finalDamage · appliedDamage · guard?

        한 방을 보고 "상대 방어가 얼마나 통하지 않았는가" 까지 답할 수 있다.
        관통이 0 인 타격에서도 penetrationStat 과 effectiveDefense 는 실린다 —
        defenseStat.value 와 effectiveDefense 가 같다는 것을 보는 것이
        "이 상대에게는 아무것도 통하지 않았다" 의 관찰이다.

    RULE-ATTRIBUTE-SET-001 의 거절 사유
        unknown-attribute · out-of-range 그대로. 관통 둘이 목록에 들어간 것만 달라진다.

    Observable Closure
        Rule 판단에 들어간 값이 전부 관찰된다 —
        방식 · 고른 공격 능력 · 고른 방어 능력(걷히기 전) · 작용한 관통 ·
        걷힌 뒤 방어 · 감쇄율 · 결과.
        고르지 않은 관통도 Actor 관찰로 볼 수 있으므로,
        "저 방식으로 쳤다면 어땠을까" 를 보는 이가 직접 견줄 수 있다.

## SEMANTIC CLOSURE

    ── INTENT-PENETRATION-001 ────────────────────────────────────────
    "두 관통 능력을 지닌다"                 → Actor.ArmorPenetration · ResistancePenetration
    "종류가 정한다"                         → CharacterDefinition.combat (BALANCE)
    "둘이 같을 이유는 없다"                 → wanderer 는 60 / 0
    "그 자체로 아무것도 일으키지 않는다"    → 관통은 어떤 Rule 의 Transition 에도 나타나지 않는다.
                                              RULE-DAMAGE-CALCULATE-001 Step 1 에서만 읽힌다
    "자기 피해를 키우지 않는다"             → Step 2 의 RawDamage 식에 관통이 등장하지 않는다
    "없다는 것은 값이 0 이라는 것"          → 별도 상태 없음. 기본값 0

    ── INTENT-PENETRATION-MATCH-001 ──────────────────────────────────
    "작용하는 관통은 하나뿐"                → Step 1 대응표. PenetrationStat 은 단일 값
    "마주하지 않은 방어에 닿지 않는다"      → Step 1 은 Step 0 이 고른 DefenseStat 에만 작용한다
    "다른 쪽 관통은 한 톨도 쓰이지 않는다"  → 고르지 않은 관통은 계산에서 읽히지 않는다
    "관통이 방식을 바꾸지 못한다"           → Step 1 은 DamageType 을 읽기만 하고 쓰지 않는다.
                                              Step 0 이 이미 끝난 뒤에 온다

    ── INTENT-EFFECTIVE-DEFENSE-001 ──────────────────────────────────
    "관통이 통하지 않게 만든 몫이 걷힌다"   → EffectiveDefense (파생)
    "줄이는 것은 걷히고 남은 방어다"        → DefenseMultiplier 의 입력이 EffectiveDefense 다
    "정해진 양이 아니라 몫이다"             → 곱셈이다. 뺄셈이 아니다
    "두꺼울수록 많이 걷힌다"                → 걷히는 양 = 방어 × 관통/(100+관통) — 방어에 비례
    "방어가 없으면 아무 일도 없다"          → DefenseStat 0 × 어떤 비율 = 0
    "걷어낼 몫에는 끝이 있다"               → 남는 비율 100/(100+관통) 은 0 에 이르지 않는다
    "음수가 되지 않는다"                    → 양수 × (0,1] 은 언제나 양수
    "양의 피해는 최소한만큼 들어간다"       → FinalDamage 하한 1 (C010 REUSED · 무변경)
    "그 한 번의 타격 안에서만"              → Transition 없음. Armor · Resistance 는
                                              World Authority 로 남고 계산이 그것을 바꾸지 않는다
    "다음 타격은 온전한 방어를 마주한다"    → 위와 같음. 걷힘은 저장되지 않는 파생값이다

    ── INTENT-DAMAGE-CALCULATE-001 (CHANGED) ─────────────────────────
    "지금까지처럼 방식을 읽고 고른다"       → Step 0 무변경
    "고른 뒤 관통이 자기 몫을 걷어낸다"     → Step 1
    "남은 방어가 그 계산에 들어간다"        → Step 3 의 DefenseMultiplier 입력
    "계산은 여전히 하나뿐"                  → RULE-DAMAGE-CALCULATE-001 하나.
                                              관통 유무로 분기하는 다른 식이 없다
    "관통이 배율을 더하거나 빼지 않는다"    → Step 2~3 에 PenetrationStat 이 등장하지 않는다
    "공격 피해는 관통과 무관하다"           → RawDamage 식 무변경
    "우연이 개입하지 않는다"                → 입력에 시각·난수원 없음
    "확률이 아니라 값이다"                  → EffectiveDefense 는 결정적 곱셈의 결과다

    ── INTENT-DAMAGE-BREAKDOWN-001 (CHANGED) ─────────────────────────
    "걷히기 전과 걷힌 뒤가 둘 다 실린다"    → defenseStat.value · effectiveDefense
    "무엇이 둘을 갈랐는지 실린다"           → penetrationStat{name,value}
    "관통 0 에서도 사라지지 않는다"         → 두 항목 모두 조건 없이 실린다
    "두 값이 같은 것을 읽을 수 있다"        → 관통 0 이면 effectiveDefense = defenseStat.value

    ── INTENT-PENETRATION-OBSERVE-001 ────────────────────────────────
    "두 관통 능력을 숨기지 않는다"          → combatStats.armorPenetration · resistancePenetration
    "내 관통이 이 상대에게 무엇을 할지"     → ActorView.versusObserver (World Derived)
    "C012 가 견주게 한 그 자리에서"         → 같은 ActorView 에 실린다
    "역산하지 않는다"                       → 세계가 계산해 내놓는다. View 는 곱하지 않는다
    "치기 전에 알 수 있다"                  → 타격 이전의 관찰이다. Breakdown 을 기다리지 않는다

    닫히지 않은 문장 없음. GAP 없음.
