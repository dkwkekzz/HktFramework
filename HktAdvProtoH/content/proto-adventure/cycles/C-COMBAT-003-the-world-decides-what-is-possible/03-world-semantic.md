# C-COMBAT-003 — World Semantic

> Intent 열셋을 State 와 Rule 로 닫는다. 새 상태는 **0 이다** — 사정은 저장되지 않고
> 지금의 세계에서 매번 다시 세어진다. 세계에 느는 것은 값 둘(사정 목록 · 기술 하나)과
> 그 목록을 읽는 자리 둘(관문 · 위력 선택)이다.

## SEMANTIC DELTA

    REUSED
        ActorState.allocation                 C-COMBAT-001 — 지금의 배분. **읽기만 한다**
        allocationShares                      C-COMBAT-001 — 그 배분의 세 몫
        ActorState.hp / hpMax                 C007 — "생명이 절반 아래" 가 읽을 값
        World.StrikeEvents                    C007 — "그 상대가 나를 먼저 쳤다" 가 읽을 사실.
                                              **이미 스스로 수명을 다한다** (STRIKE_EVENT_TTL)
        World.Time                            C001 — 사정이 시각을 묻는 자리
        SkillDefinition                       C007·C012·C019·C025 — 기술이 자기 값을 지니는 표
        Force / forceOfSkill                  C020 — 피해 공식이 받는 위력 정의
        RULE-DAMAGE-CALCULATE-001             C010·C012·C013 — **한 글자도 바뀌지 않는다**
        DamageBreakdown                       C010~C-GROWTH-001 — 경위를 싣는 자리
        SkillFailureReason                    C007·C011·C019 — 거절 사유 코드의 자리

    ADDED
        World.AbilityCircumstances            사정 목록 — 세계가 아는 사정 전부 (셋)
        AbilityCircumstance                   사정 하나 = { Id · UnmetReason · Holds }
        SkillDefinition.Requires              그 기술이 갖춰야 하는 사정 (Id 들)
        SkillDefinition.AmplifiedBy           그 기술을 키우는 사정과 그 몫
        SkillKind `hatsu-burst`               사정을 실제로 지는 기술 하나
        RULE-ABILITY-REQUIREMENT-001          갖춰졌는가를 재고 사유를 하나 고른다
        RULE-ABILITY-CONDITION-001            참인 사정만큼 위력 정의를 키운다
        DamageBreakdown.Conditions            어느 사정이 얼마를 보탰는가 (언제나 실린다)

    CHANGED
        RULE-SKILL-BEGIN-001
            NEW PRECONDITION   그 기술의 요구 사정이 전부 참이다
            NEW INPUT          세계 (사정이 시각과 최근 타격 결과를 묻는다)
            NEW FAILURE        사정의 UnmetReason
        RULE-SWING-STRIKE-001
            CHANGED            넘기는 위력이 `forceOfSkill(기술)` 에서
                               RULE-ABILITY-CONDITION-001 이 낸 위력으로 바뀐다
        SkillProfileView (관찰)  요구와 조건이 실린다 — 쓰기 전에 안다

    AFFECTED
        RULE-ENGAGEMENT-REACHES-001           기술이 하나 늘면 그 기술의 닿는 길이도 검사된다
        RULE-SKILL-PHASE-001                  새 기술의 구간 경계
        RULE-SKILL-BUDGET-001                 새 기술의 기력 수지
        RULE-SKILL-SHAPE-001                  새 기술의 모양
        RULE-CRITICAL-STRIKE-001              커진 값을 터뜨림이 마주한다 — **규칙 무변경**
        RULE-GUARD-BLOCK-001                  커진 값을 막기가 마주한다 — **규칙 무변경**
        RULE-NPC-DECIDE-001                   자율 존재도 같은 관문을 지난다
        Observer Projection (기술 자리)         기술 interaction 이 셋에서 넷이 된다
        Command Catalog                       기술을 거는 자리가 하나 는다

## WORLD STATE

    새 상태가 없다. 아래 둘은 **세계가 지닌 값**이며 몸이나 세계의 가변 상태가 아니다.

    World.AbilityCircumstances                World Authority (값 — 세계가 서는 조건)
        사정 셋. 각 항목은 Id · UnmetReason · Holds 를 지닌다.
        **판정은 이 목록을 읽을 뿐 어떤 사정도 자기 안에 적지 않는다**
        (INTENT-CIRCUMSTANCES-ARE-A-LIST-001). `World.HostilityReasons` (C018) 와
        같은 꼴이고 같은 이유다 — 항목이 늘어도 관문도 관찰도 시험도 열리지 않는다.

        Holds 가 받는 것은 셋이다 — **하나의 모양이며 두 자리가 같은 것을 부른다.**

            Self    묻는 몸
            Other   상대. **관문에서는 없다** (쓰기 전이라 대상이 정해지지 않았다)
            Now     지금의 시각과 최근 타격 결과 (수명이 정해진 사실들)

        `Other` 를 읽는 사정은 관문 자리에서 언제나 거짓이다. 그러므로 그런 사정을
        요구로 걸면 그 기술은 결코 나가지 않는다 — **세계는 지금 그런 조합을 만들지
        않는다.** 그것이 필요해지는 날은 관문이 고른 대상을 받는 날이며, 그 날은
        표식이 요구가 되는 Cycle 이다 (FR-WHAT-YOU-LEAVE-ON-THEM).

        지금의 셋

            power-in-ability     지금의 배분이 능력 축에 3 이상 몰려 있다
                                 UnmetReason  power-not-in-ability
                                 읽는 것      Self.Allocation 의 능력 몫
                                 UL §18 의 `Aura Ability ≥ 3`

            struck-by-them       그 상대가 최근에 나를 쳤다
                                 UnmetReason  not-struck-by-them
                                 읽는 것      Now 의 타격 결과들 중 (공격자=Other,
                                              대상=Self) 인 것이 하나라도 있는가
                                 UL §19 의 첫 예

            life-below-half      내 생명이 절반 이하다
                                 UnmetReason  life-not-below-half
                                 읽는 것      Self.Hp × 2 ≤ Self.HpMax
                                 UL §19 의 넷째 예

        셋 다 **지금의 사실에서 매번 다시 센다** (INTENT-CIRCUMSTANCE-IS-DERIVED-NOT-RECORDED-001).
        `struck-by-them` 이 지나간 일을 보지만 그 일은 세계가 **이미 지니고 있고 스스로
        사라지는** 것이다 — 이 사정 때문에 새로 적히는 것은 없고, 그 사실이 사라지면
        사정도 별도 규칙 없이 거짓이 된다 (DC-CONDITION-OPENS-WITHOUT-RECORDING · Q61(a)).

    SkillDefinition.Requires / AmplifiedBy    World Authority (값 — 기술이 지니는 것)
        Requires     갖춰져야 시작되는 사정의 Id 들. 빈 목록이 기본이다
        AmplifiedBy  { 사정 Id · 계수 몫 } 들. 빈 목록이 기본이다

        **빈 목록은 언제나 갖춰진 것이다** — 그래서 기존 세 기술은 한 톨도 달라지지
        않는다 (INTENT-NO-CIRCUMSTANCE-NO-CHANGE-001). 이것이 회귀의 근거이며
        검사가 아니라 산술로 성립한다 (빈 목록 위의 "전부 참" 은 참이다).

## WORLD RULE

    RULE-ABILITY-REQUIREMENT-001                                          (ADDED)
        Implements     INTENT-ABILITY-HAS-CIRCUMSTANCES-001 ·
                       INTENT-CIRCUMSTANCES-ARE-A-LIST-001 ·
                       INTENT-CIRCUMSTANCE-IS-DERIVED-NOT-RECORDED-001 ·
                       INTENT-REQUIREMENT-GATES-THE-ABILITY-001 ·
                       INTENT-REFUSAL-NAMES-THE-WORLD-001 ·
                       INTENT-ALLOCATION-OPENS-WHAT-IS-POSSIBLE-001 ·
                       INTENT-THE-GATE-DOES-NOT-ASK-WHO-DRIVES-001
        Input          Actor, SkillKind, Now
        Preconditions  없음 — 모든 기술에 답이 있다
        Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
        Result         Met | Unmet(UnmetReason)

        그 기술의 Requires 를 **선언된 차례대로** 묻고, 처음 거짓인 것의 UnmetReason 을
        돌려준다. 차례가 정해져 있으므로 둘이 함께 거짓이어도 사유는 언제나 같다
        (DC-COMBAT-PLAYER-CAUSALITY — 같은 상태면 같은 답).

        `Other` 는 없다 (관문 자리다).

    RULE-SKILL-BEGIN-001                                                (CHANGED)
        Implements     (기존) INTENT-ATTACK-001 · INTENT-SKILL-COST-GATE-001 ·
                       INTENT-DOWNED-001 · INTENT-TEMPO-ACTION-001
                       (더해짐) INTENT-REQUIREMENT-GATES-THE-ABILITY-001 ·
                       INTENT-REFUSAL-NAMES-THE-WORLD-001
        Input          Actor, SkillKind, **Now**
        Preconditions  1. 쓰러지지 않았다
                       2. 막고 있지 않다
                       3. 현재 행동이 대체 가능하다
                       4. **RULE-ABILITY-REQUIREMENT-001 이 Met 이다**   ← 넷째로 선다
                       5. Cp >= Cost × Modifiers.CpConsume
        Transition     (그대로)
        Result         Success | Failure(downed | guarding | action-busy |
                       **사정의 UnmetReason** | insufficient-cp)

        **사정을 대가보다 앞에 두는 사유.** 기력은 기다리면 차므로 "지금은 안 되지만
        곧 된다" 이고, 사정은 만들러 가야 하므로 "지금 이 세계에서 이 기술은 성립하지
        않는다" 이다. 뒤에 두면 힘을 잘못 몰아 둔 채 기력만 모으는 사람에게 세계가
        `insufficient-cp` 만 계속 말하게 되고, 그러면 관문이 있다는 사실 자체가
        보이지 않는다 (DC-COMBAT-UNAVAILABLE-HAS-A-REASON).

        C011 이 막기를 행동 관문 **앞**에 둔 것과 같은 종류의 판단이다 — 순서가 곧
        어떤 사유가 사람에게 닿는가를 정한다.

    RULE-ABILITY-CONDITION-001                                            (ADDED)
        Implements     INTENT-CONDITION-AMPLIFIES-WITHOUT-GATING-001 ·
                       INTENT-CONDITION-CHOOSES-THE-FORCE-001 ·
                       INTENT-EACH-CIRCUMSTANCE-STANDS-ALONE-001 ·
                       INTENT-CONDITION-IN-THE-CAUSE-READING-001
        Input          공격자 Actor, 대상 Actor, SkillKind, Now
        Preconditions  없음 — 모든 기술에 답이 있다
        Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
        Result         Force(그 한 방의 위력 정의), Met(참인 사정과 각자의 몫)

        그 기술의 AmplifiedBy 를 돌며 참인 것들의 몫을 **위력 정의의 계수에 더한다.**

            AttackRatio = 정의의 AttackRatio + Σ (참인 사정의 몫)
            BaseDamage · DamageType 은 그대로다

        참인 사정이 없으면 `forceOfSkill(기술)` 과 **완전히 같은 값**이다 — 조건이
        아무것도 하지 않은 한 방은 조건이 없던 때와 같다.

        사정마다 자기 몫이 있고 서로 곱해지지 않는다. 둘이 함께 참인 것이 각자의 합을
        넘지 않으므로, 겹침을 다루는 규칙이 이 세계에 서지 않는다
        (INTENT-EACH-CIRCUMSTANCE-STANDS-ALONE-001 — MC-CONDITION-STACKING 은 EXCLUDED).

    RULE-SWING-STRIKE-001                                               (CHANGED)
        CHANGED        RULE-STRIKE-DAMAGE-001 에 넘기는 위력이
                       `forceOfSkill(기술)` → RULE-ABILITY-CONDITION-001(공격자, 대상,
                       기술, Now) 이 낸 위력으로 바뀐다.
                       **대상마다 따로 돈다** — 한 휘두름이 둘에게 닿으면 "그 상대가
                       나를 먼저 쳤다" 는 몸마다 다른 답이며, 그래서 같은 휘두름이
                       한쪽에는 크게 다른 쪽에는 본래 크기로 들어간다.
                       C015 의 터짐이 몸마다 따로 도는 것과 같은 자리, 같은 이유다.
        무변경          닿음 판정 · 적대 관문 · 피격 · 밀쳐냄 · 기력 수지 · 판정 순서

    RULE-DAMAGE-CALCULATE-001                                          (무변경)
        식이 한 글자도 바뀌지 않는다. 받는 위력 정의의 계수가 달라질 뿐이다
        (DC-COMBAT-ONE-FORMULA — extensions_modify_inputs_or_outputs).

    RULE-STRIKE-DAMAGE-001                                              (CHANGED)
        CHANGED        Breakdown 에 Conditions 가 실린다 — 참인 사정과 각자의 몫.
                       **참인 것이 없어도 빈 목록으로 실린다**: 배분의 몫이 0 이어도
                       실리는 것과 같은 이유다 (C-COMBAT-001) — "이번 한 방에 사정이
                       아무것도 하지 않았다" 는 사실 역시 관찰이어야 사정을 만들러 갈
                       근거가 생긴다.
        무변경          판정 순서 (계산 → 터짐 → 막기 → 적용 → 기록 → 쓰러짐) · 쌓임

## BALANCE — 수치와 그 근거

    ① 새 기술 `hatsu-burst` (발현 일격)

        방식        aura
                    **능력 축이 닿는 값이 `auraAttack` 이기 때문이다**
                    (`ALLOCATION_AXIS_STEPS.ability = { auraAttack: 12 }` · C-COMBAT-001).
                    물리로 두면 능력에 몰아 둔 힘이 그 기술에 한 톨도 실리지 않아
                    관문의 뜻이 사라진다

        모양·구간    heavy-attack 과 **같은 값**을 쓴다
                    (선딜 0.5 · 판정 끝 0.85 · 훑는 각 40° · 닿는 길이 2.2 · 끝 굵기 0.55)
                    큰 기술의 무게는 C019·C025 가 이미 정했다. 새 값을 지어내면 결과
                    차이가 사정 때문인지 모양 때문인지 갈리지 않는다 — C012 가
                    `aura-strike` 를 기본 기술과 같은 값으로 둔 그 판단 그대로다.
                    닿는 길이 검사도 그대로 선다: 2.2 − 0.55 = 1.65 ≤ 2.0 ≤ 2.75
                    (RULE-ENGAGEMENT-REACHES-001)

        길이        0.9  — heavy-attack 과 같다 (같은 무게의 기술이다)
        기본 피해    10   — heavy-attack(32)보다 훨씬 낮다. **이 기술의 크기는 몰아 둔
                    힘에서 와야 하기 때문이다** — 기본값이 크면 관문을 지난 보람이
                    기본값에 가려진다
        계수        1.3  — heavy-attack(1.0)보다 높다. 근거는 아래 ②
        기력 소모    25   — heavy-attack(30)보다 싸다. 관문이 이미 대가를 하나 물었고
                    (배분을 능력에 몰아 두면 몸과 인지가 얇아진다), 거기에 더 비싼
                    소모까지 얹으면 이 기술은 존재하되 쓰이지 않는다
        기력 충전    6    — heavy-attack(8)보다 낮다. 순수지 −19

    ② 이 기술이 실제로 내는 값 · 그리고 계수가 1.3 인 사유
       (관찰자 rabbit-swordsman → 자율 존재 wanderer)

        기준 몸      AuraAttack 40 · 오라 관통 60 · Hp 200 · Cp 100 (시작 30)
        상대 몸      Resistance 90 · Armor 30 · 배분 balanced

        걷힌 방어    오라  90 × 100/(100+60) = 56.25 → 감쇄 100/156.25 = 0.64
                    물리  30 (관통 0)          → 감쇄 100/130      = 0.769

        배분이 hatsu 면 AuraAttack = 40 + (4−2)×12 = **64**
        그때 PhysicalAttack 은 40 − 8 = **32** 로 얇아진다

            hatsu-burst  사정 없음   10 + 64×1.3 = 93.2  → ×0.64  = **60**
                        하나 참     10 + 64×1.7 = 118.8 → ×0.64  = **76**
                        둘 다 참    10 + 64×2.1 = 144.4 → ×0.64  = **92**
            heavy-attack (같은 배분)  32 + 32×1.0 = 64    → ×0.769 = **49**

        **계수가 1.0 이면 이 기술은 49 보다 못한 47 이 된다.** 관문을 지나느라 몸과
        인지를 얇게 만들고도 포기한 고급 기술보다 덜 들어가면, 그 기술은 세계에
        존재하되 쓰이지 않는다 — 관문이 값이 아니라 벌이 된다. 1.3 은 그 자리를
        11 만큼 넘긴 값이고, 사정을 하나 만들면 27 을 넘긴다.

        능력 축은 "몸이 아니라 기술이 내는 쪽" 이다 (UL §13 ABILITY) — 몰아 둔 힘이
        크게 실리는 것이 그 축의 성질이므로, 계수가 큰 것이 이 기술의 정체다.

    ③ 조건의 몫 — 0.4 씩

        계수를 올린다. 기본 피해를 올리면 몰아 두지 않은 몸에게도 같은 크기로 실려
        "세계를 만들어 놓고 쓴다" 가 "더 큰 기술이 하나 생겼다" 가 된다. 계수를
        올리면 **몰아 둔 만큼 보답이 커지므로** 관문과 조건이 같은 방향을 가리킨다.

        0.4 는 한 대에 16 (60 → 76) 이다. 상대 생명(120)의 13% 이므로 눈에 보이고,
        한 대를 덜 때려도 되게 만들지는 않으므로 조건 없이 싸우는 길이 죽지 않는다.

    ④ 관문의 문턱 — 능력 몫 3

        지금 세계의 배분 넷 중 능력 몫이 3 이상인 것은 `hatsu`(4) 하나다
        (`balanced` 2 · `reinforce` 1 · `hunter` 1). 그러므로 이 기술은 **하나의 배분에서만**
        열린다. 2 로 두면 `balanced` 에서도 열려 "몰아 두었는가" 가 사라지고, 4 로 두면
        지금은 같지만 몫 3 짜리 배분이 생기는 날 뜻이 흔들린다 — 3 은 UL §18 이 예로 든
        값이며, 고른 배분(2)보다 크다는 것이 곧 "몰아 두었다" 의 뜻이다

    ⑤ 도달 가능성 — 이 기술은 실제로 나가는가

        시작 기력 30. 배분을 바꾸는 데 15 (C-COMBAT-001), 이 기술에 25.
        기본 기술이 맞을 때마다 12 를 채우므로 (C007), **기본 기술 두 대를 맞히고
        배분을 옮기면 나간다** (30 + 24 − 15 = 39 ≥ 25). 그 뒤에도 기본 기술로
        다시 모을 수 있다. 관문이 있다는 것과 닿을 수 없다는 것은 다르다

## OBSERVABLE SEMANTIC

    기술마다 — 쓰기 전에 안다 (INTENT-CIRCUMSTANCES-ARE-OBSERVED-001)

        Skill.Availability            (기존) 지금 나가는가
        Skill.FailureReason           (기존 · 넓어짐) 안 나가면 왜 — 이제 **세계의 사실**을
                                      가리키는 코드가 실릴 수 있다
        Skill.Requires                (ADDED) 요구 사정마다 { Id · 지금 참인가 · UnmetReason }
        Skill.Conditions              (ADDED) 조건 사정마다 { Id · 지금 참인가 · 계수 몫 }

        **둘은 다른 칸이다.** 못 쓰는 사유와 더 잘 드는 사유는 다른 물음의 답이며,
        같은 칸에 실으면 닫힌 기술과 강해진 기술이 구별되지 않는다
        (INTENT-CIRCUMSTANCES-ARE-OBSERVED-001 의 마지막 문단 · 01 의 물음 ④).

        요구가 갖춰지지 않은 기술도 **목록에서 사라지지 않는다** — 사라지면 사유를 실을
        자리가 없다 (POSSIBILITY-THE-CLOSED-ABILITY-IS-STILL-THERE). 배분 목록이 지금
        고를 수 없는 것까지 싣는 것과 같은 판단이다 (C-COMBAT-001).

        **문턱 값(3)은 싣지 않는다.** 세계가 이미 "참인가" 를 답하고 있으므로 관찰자가
        규칙을 자기 안에 복제할 자리가 없다 — C016 이 통찰 문턱(30·60·90)을 싣지 않기로
        한 판단 그대로다.

    한 방마다 — 왜 이만큼이었는가 (INTENT-CONDITION-IN-THE-CAUSE-READING-001)

        Damage.Breakdown.Conditions   (ADDED) 참인 사정과 각자의 몫. 언제나 실린다
        Damage.Breakdown.OffenseStat  (기존) 방식이 고른 능력과 배분의 몫

        이 둘로 §35 의 되짚기가 성립한다 — "이 한 방이 96 이다 → 계수가 1.8 이었다 →
        두 사정이 참이었다 → 그 상대가 나를 쳤고 내 생명이 절반 아래였다."

    사정 자체 — 세계가 목록을 싣는다 (DC-WORLD-OWNS-THE-SURFACE-LIST)

        기술이 무엇을 요구하고 무엇으로 커지는지의 단일 출처는 세계다. 관찰자는
        기술의 이름을 열쇠로 자기 표를 만들지 않는다.

## SEMANTIC CLOSURE

    "능력이 사정을 지닌다"                → SkillDefinition.Requires / AmplifiedBy
    "사정은 목록이다"                     → World.AbilityCircumstances
    "판정은 목록을 읽을 뿐이다"            → RULE-ABILITY-REQUIREMENT-001 ·
                                          RULE-ABILITY-CONDITION-001 (둘 다 Id 로 찾는다)
    "사정 없는 능력이 정상이다"            → 빈 Requires 위의 "전부 참" 은 참
    "매번 다시 센다"                      → Holds(Self, Other, Now) — 저장 자리가 없다
    "사정이 거짓이 되면 저절로 닫힌다"      → 열린 것을 적지 않으므로 닫는 규칙이 없다
    "갖춰져야 시작할 수 있다"              → RULE-SKILL-BEGIN-001 Precondition 4
    "시작한 뒤 실패하는 것이 아니다"        → 관문이 Transition 앞에 선다 — 아무것도
                                          소모되지 않는다
    "거절이 세계의 사실을 댄다"            → Result 의 UnmetReason
    "배분이 목록을 여닫는다"               → 사정 `power-in-ability`
    "조건은 막지 않는다"                   → RULE-ABILITY-CONDITION-001 이 관문과
                                          다른 규칙이다. Requires 에 없으면 시작을
                                          막지 않는다
    "조건이 고르는 것은 위력 정의다"        → Force.AttackRatio 만 달라진다.
                                          RULE-DAMAGE-CALCULATE-001 무변경
    "사정마다 독립이다"                    → 몫의 합. 겹침을 묻는 항이 없다
    "강화가 경위에 실린다"                 → DamageBreakdown.Conditions
    "사정이 쓰기 전에 보인다"              → Skill.Requires · Skill.Conditions
    "못 쓰는 사유와 더 잘 드는 사유는 다르다" → 서로 다른 두 칸
    "사정 없는 기술은 그대로다"            → 기존 셋의 Requires·AmplifiedBy 가 비었다
    "관문은 조종 주체를 묻지 않는다"        → RULE-ABILITY-REQUIREMENT-001 의 Input 에
                                          누가 조종하는가가 없다. 자율 존재도 같은
                                          RULE-SKILL-BEGIN-001 을 지난다

    닫히지 않은 문장 없음 — GAP 없음.

## 01 이 남긴 물음 넷에 대한 답

    ① 사정은 무엇을 입력으로 받는가
       Self · Other · Now 셋이며 **한 모양이다.** 관문에서는 Other 가 없고, Other 를
       읽는 사정은 그 자리에서 거짓이다. 그래서 목록이 둘로 갈리지 않는다.
       그 대가와 그것이 풀릴 자리는 WORLD STATE 절이 적었다.

    ② 강화는 위력 정의의 무엇을 바꾸는가
       **계수(AttackRatio)** 다. 사유는 BALANCE ③.

    ③ 관문 사정이 거짓일 때 그 기술이 관찰에서 어떻게 보이는가
       **있는데 못 쓴다.** 목록에 남고 사유가 실린다. 사유는 OBSERVABLE SEMANTIC 절.

    ④ 강화 사정이 참인 것이 쓰기 전에 보이는가
       **보인다.** 그리고 요구와 **다른 칸**에 실린다. 사유는 OBSERVABLE SEMANTIC 절.

## REGRESSION — 무엇이 그대로여야 하는가

    기존 세 기술(attack · heavy-attack · aura-strike)의 모든 결과가 값 하나까지 같다
        나가는 조건 · 거절 사유 · 피해 · 기력 수지 · 구간 · 모양 · 관찰
        근거는 검사가 아니라 산술이다 — Requires 가 비었으므로 관문이 언제나 Met 이고,
        AmplifiedBy 가 비었으므로 위력 정의가 `forceOfSkill` 과 같은 값이다

    배분을 한 번도 바꾸지 않은 몸의 전투가 C-COMBAT-001 과 같다
        `balanced` 는 능력 몫 2 이므로 새 기술만 닫힌다. 기존 셋은 그대로다

    C007 · C010 · C011 · C012 · C013 · C015 · C019 · C020 · C023 · C025 ·
    C-COMBAT-001 · C-GROWTH-001 의 시나리오
        피해 공식 · 터짐 · 막기 · 관통 · 유효 값 · 모양 · 쌓임 어느 것도 이 Cycle 이
        건드리지 않는다
