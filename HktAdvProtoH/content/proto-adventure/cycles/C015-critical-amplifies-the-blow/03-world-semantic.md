# C015 — World Semantic

> 이 Cycle 은 `RULE-DAMAGE-CALCULATE-001` 을 **한 줄도 건드리지 않는다.**
> Step 0(타입 대응) · Step 1(걷어내기) · Step 2~3(감쇄식) 전부 그대로이며,
> 그 규칙은 이 Cycle 이 끝난 뒤에도 여전히 흔들림을 모른다 —
> 같은 두 존재·같은 스킬이면 언제나 같은 값을 내놓는다.
>
> 더해지는 것은 그 규칙 **밖에** 서는 판정 하나다. C011 의 막기가 그랬듯이,
> 계산이 내놓은 값에 작용한다. 다른 점은 하나뿐이다 — 막기는 맞는 자의 상태를 읽지만
> 이 판정은 **세계가 지닌 흔들림**을 읽는다. 그래서 이 Cycle 은 세계 상태를 하나 늘린다.

## SEMANTIC DELTA

    REUSED
        Actor.Hp · Actor.Cp                     C007 — 자원 구조 그대로. Critical 은 자원을 쓰지 않는다
        Actor.CurrentAction                     C002 — 행동 구조 그대로. 새 행동이 없다
        Actor.Guard · Actor.GuardBrokenUntil    C011 — 막기 상태 그대로
        Actor.PhysicalAttack · AuraAttack       C012 — 공격 능력은 한 값도 건드리지 않는다
        Actor.Armor · Actor.Resistance          C012 — 방어도 그대로
        Actor.ArmorPenetration · ResistancePenetration   C013 — 관통도 그대로
        Actor.DefenseShape (파생)               C012 — Critical 은 방어를 읽지 않는다
        EffectiveDefense (파생)                 C013 — 증폭은 이 값에 닿지 않는다
        SkillDefinition 전 항목                 C010 · C012 — 스킬은 자기 Critical 을 지니지 않는다
        World.DefenseConstant = 100             C010
        World.PenetrationConstant = 100         C013
        World.StrikeEvents                      C007 · C010 — 타격 기록 구조
        World.Acquaintances                     C014 — 앎의 장부. 새 관문을 만들지 않는다
        CONCEALABLE_ATTRIBUTE_KEYS              C014 — 가려지는 항목 이름 셋. 늘지 않는다

    ADDED
        Actor.CriticalChance                    이 몸의 타격이 크게 터질 가능성 (0~1)
        Actor.CriticalDamage                    터졌을 때 최종 피해에 걸리는 배율 (1 이상)
        World.ChanceSeed                        세계가 지닌 흔들림의 뿌리. 세계가 만들어질 때
                                                정해지고 그 뒤 바뀌지 않는다
        World.ChanceCursor                      그 흔들림이 지금까지 몇 번 쓰였는가.
                                                RULE-CRITICAL-STRIKE-001 만이 나아가게 한다
        World.ChanceStep = 0x9E3779B9           흔들림이 한 걸음에 건너뛰는 폭 (세계 상수)
        ChanceAt(Seed, Cursor) (파생)           그 자리의 흔들림 값 ∈ [0, 1)
        CriticalOutcome (파생)                  한 타격의 Critical 판정 결과
        DamageBreakdown.critical                { occurred, chance, multiplier,
                                                  damageBeforeCritical }
        RULE-CRITICAL-STRIKE-001                새 Rule — 이 Cycle 이 세우는 유일한 규칙
        ActorView.combatStats.criticalChance · criticalDamage
                                                C014 관문 안쪽에 두 성질이 더해진다

    CHANGED
        RULE-STRIKE-DAMAGE-001
            NEW STEP    계산과 막기 사이에 RULE-CRITICAL-STRIKE-001 이 놓인다
            CHANGED     막기가 마주하는 값이 계산의 FinalDamage 에서
                        **증폭된 FinalDamage** 로 바뀐다
            UNCHANGED   대상 선정 · 쓰러짐 · StrikeEvent 기록 구조 · 여럿에게 닿을 때
                        몸마다 따로 도는 것
        DamageBreakdown.finalDamage
            의미 확장   여전히 "막지 않았다면 들어왔을 값" 이다. 이제 그 값이 증폭을
                        포함한다. 증폭 **전** 값은 새 항목 critical.damageBeforeCritical
                        이 가진다 — C013 이 defenseStat.value 와 effectiveDefense 를
                        나란히 둔 것과 같은 자리다
        RULE-ATTRIBUTE-SET-001
            CHANGED LIST  변경 가능 속성에 criticalChance · criticalDamage 가 들어간다
                          (14개 → 16개). 판정 방식 · 요청 경로 · 거절 사유 4종 무변경.
                          두 값은 기존 항목과 달리 범위가 좁다 — 0~1 과 1~100
        CharacterDefinition.combat
            CHANGED       여섯 값 → 여덟 값
        WorldSetup
            CHANGED       세계를 띄우는 쪽이 ChanceSeed 를 정할 수 있다. 밝히지 않으면
                          세계의 기본 뿌리다. 요청으로는 바꿀 수 없다 (DebugAuthority 와 같은 자리)

    AFFECTED
        RULE-SWING-STRIKE-001       누가 맞는지 정하는 판정 무변경. 한 휘두름이 여럿에게
                                    닿으면 몸마다 따로 판정이 돈다 — 대상 순서가 정해져
                                    있으므로 흔들림이 소비되는 순서도 정해져 있다
        RULE-GUARD-BLOCK-001        **규칙 무변경.** 남기는 비율도, 대가를 매기는 기준
                                    (덜어내기 전 값)도, 무너지는 조건도 한 줄도 바뀌지 않는다.
                                    마주하는 크기만 커질 수 있다
        RULE-DAMAGE-CALCULATE-001   **무변경.** 이 규칙은 흔들림을 모르고, 세계를 바꾸지 않고,
                                    ChanceCursor 를 읽지도 않는다
        RULE-NPC-DECIDE-001         무변경 — 자율 존재는 Critical 을 노리고 고르지 않는다
        RULE-OBSERVE-*              무변경 — 살펴봄이 여는 자리가 넓어질 뿐이다
        RULE-DOWNED-001             무변경 — 증폭된 한 방으로 더 자주 도달할 뿐이다
        투영(observer-view)          combatStats 에 두 값 · Breakdown 에 critical 이 실린다.
                                    세계의 흔들림 자체(Seed · Cursor)는 실리지 않는다

## WORLD STATE

    Actor
        CriticalChance          World Authority     종류가 정한다. 0~1 사이의 값이며
                                                    0 이 기본이자 "터질 수 없는 몸" 이다.
                                                    별도의 상태가 아니라 값 0 이다
        CriticalDamage          World Authority     종류가 정한다. 1 이상이며 1 이
                                                    "커지지 않는다" 다. 1 미만은 없다 —
                                                    터진 한 방이 작아지는 일은 세계에 없다
        위 둘은 **치는 자의 능력**이다. 맞는 자에게서는 이 판정에 아무 값도 읽히지 않는다.

    World
        ChanceSeed              World Authority     ADDED — 흔들림의 뿌리. 세계가 만들어질 때
                                정해지고 그 뒤 어떤 규칙도 바꾸지 않는다. 밝히지 않으면
                                세계의 기본 뿌리 `0x5EEDC015` 다. 요청으로 바꿀 수 없다
        ChanceCursor            World Authority     ADDED — 흔들림이 지금까지 몇 번 쓰였는가.
                                초기 0. **RULE-CRITICAL-STRIKE-001 만이** 1 씩 나아가게 한다.
                                되돌리는 규칙은 없다
        ChanceStep = 0x9E3779B9 World Authority     ADDED — 한 걸음의 폭. 결정론에 영향을
                                주므로 헤더 상수로 고정한다 (CVar 아님)

    ChanceAt(Seed, Cursor) (파생 — 저장하지 않는다)

        x = (Seed + Cursor × ChanceStep)              mod 2^32
        x = ((x XOR (x >>> 16)) × 0x21F0AAAD)         mod 2^32
        x = ((x XOR (x >>> 15)) × 0x735A2D97)         mod 2^32
        x = x XOR (x >>> 15)
        ChanceAt = x / 2^32                            ∈ [0, 1)

        이 식은 세계의 법이다 — DefenseConstant 나 감쇄식과 같은 자리에 있고,
        결정론에 영향을 주므로 상수도 형태도 헤더에 고정한다.
        Seed 와 Cursor 가 같으면 언제나 같은 값이 나온다. 그래서 세계는 되짚을 수 있다.
        Cursor 가 하나만 달라도 값이 전혀 다른 자리로 흩어진다. 그래서 미리 알 수 없다.
        값의 범위가 `[0, 1)` 로 닫혀 있다는 것이 뒤의 두 경계 규칙을 지탱한다 —
        1 은 나올 수 없고 0 은 나올 수 있다.

    CriticalOutcome (파생 — 저장하지 않는다)
        occurred              boolean    이 타격이 크게 터졌는가
        chance                number     판정에 실제로 쓰인 가능성 (0~1 로 묶인 뒤의 값)
        multiplier            number     치는 자의 증폭 성질 (1 이상). 터지지 않아도 실린다
        damageBeforeCritical  number     커지기 전의 최종 피해

    DamageBreakdown (파생 — 저장하지 않는다)
        damageType · offenseStat · baseDamage · attackContribution · rawDamage ·
        defenseStat · penetrationStat · effectiveDefense · defenseMultiplier   REUSED
        finalDamage       CHANGED — 증폭이 **포함된** 값. 여전히 "막지 않았다면 들어왔을 값"
        critical          ADDED — CriticalOutcome. 터지지 않은 타격에서도 실린다
        appliedDamage · guard?   REUSED — 막기가 정하는 자리. 규칙 무변경

    Critical 은 Actor 의 능력이지 타격의 성질도, 스킬의 성질도 아니다.
    어떤 스킬도 자기 Critical 을 지니지 않는다 (01 EXCLUDED).

## WORLD RULE

    RULE-CRITICAL-STRIKE-001 (ADDED)
        Implements     INTENT-CRITICAL-001 · INTENT-WORLD-CHANCE-001 ·
                       INTENT-CRITICAL-ROLL-001 · INTENT-CRITICAL-AMPLIFY-001 ·
                       INTENT-DAMAGE-BREAKDOWN-001
        Input          World · 공격자 Actor · FinalDamage (계산이 내놓은 값)
        Preconditions  없음 — 타격이 실제로 대상에게 들어갈 때 반드시 한 번 돈다.
                       맞는 자의 어떤 값도 이 판정에 들어가지 않는다

        Step 1 — 가능성을 읽는다
            Chance = clamp(attacker.CriticalChance, 0, 1)

        Step 2 — 정한다 (세계가 바뀌는 유일한 지점)
            Chance <= 0   → Occurred = false        ChanceCursor 무변경
            Chance >= 1   → Occurred = true         ChanceCursor 무변경
            그 밖         → Roll     = ChanceAt(ChanceSeed, ChanceCursor)
                            ChanceCursor += 1
                            Occurred = Roll < Chance

            두 끝에서 흔들림을 쓰지 않는 것은 편의가 아니라 규칙이다 —
            **이미 정해진 일에 우연을 쓰지 않는다.** 그래서 가능성이 0 인 존재들만 있는
            세계에서는 ChanceCursor 가 영원히 0 이고, 그 세계는 이 층이 생기기 전과
            완전히 같은 세계다 (INTENT-CRITICAL-ROLL-001 · Regression 기준).

            `Roll < Chance` 이고 Roll 이 `[0, 1)` 이므로 두 끝의 값을 특별히 다루지
            않아도 결과는 같다. 그럼에도 명시적으로 가른 것은 **커서를 쓰지 않기**
            위해서다 — 결과가 아니라 소비가 달라진다.

            판정은 지난 타격을 기억하지 않는다. 연속 실패 보정도, 확정 Critical 도 없다.

        Step 3 — 키운다
            Multiplier = max(1, attacker.CriticalDamage)
            Amplified  = Occurred ? round(FinalDamage × Multiplier) : FinalDamage

            Multiplier 가 1 이상이므로 Amplified 는 FinalDamage 보다 작아지지 않는다.
            FinalDamage 가 1 이상이면 Amplified 도 1 이상이다 —
            C010 의 하한이 이 층 뒤에도 깨지지 않는다.
            FinalDamage 가 0 이면(낼 피해가 없으면) 터져도 0 이다 —
            없는 피해를 증폭이 만들어내지 않는다.

        Transition     ChanceCursor += 1 (Step 2 의 세 번째 갈래에서만)
        Result         CriticalOutcome { occurred, chance, multiplier, damageBeforeCritical }

        이 규칙은 공격 능력도, 방어도, 걷힌 방어도, 감쇄율도 읽지 않는다.
        방식(DamageType)도 읽지 않는다 — 물리든 오라든 같은 판정이 같은 방식으로 돈다.
        세계 시각도 읽지 않는다 — 언제 쳤는가가 결과를 바꾸면 되짚을 수 없게 된다.

    RULE-STRIKE-DAMAGE-001 (CHANGED — 계산과 막기 사이에 판정 하나가 놓인다)
        Implements     INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001 ·
                       INTENT-CRITICAL-AMPLIFY-001
        Input          World · 공격자 Actor · 대상 Actor · SkillKind
        Preconditions  대상이 쓰러지지 않았다 (UNCHANGED)
        Transition     Breakdown = RULE-DAMAGE-CALCULATE-001(공격자, 대상, 스킬)
                       Critical  = RULE-CRITICAL-STRIKE-001(World, 공격자,
                                                            Breakdown.FinalDamage)   ← ADDED
                       Breakdown.Critical    = Critical                              ← ADDED
                       Breakdown.FinalDamage = Critical.Amplified                    ← ADDED
                       Guard     = RULE-GUARD-BLOCK-001(대상, 공격자,
                                                        Breakdown.FinalDamage, 시각)
                       Breakdown.AppliedDamage = Guard.AppliedDamage
                       대상.Hp = max(0, Hp - Breakdown.AppliedDamage)
                       World.StrikeEvents += { …, Amount, Breakdown, 위치, 시각 }
                       Hp 가 0 이면 RULE-DOWNED-001
        Result         Damaged(AppliedDamage)

        막기가 마주하는 값이 증폭된 값이라는 것이 이 순서의 전부다.
        그래서 크게 터진 한 방은 막아도 더 아프고(같은 비율의 더 큰 몫이 남는다),
        막는 데 더 든다(대가는 덜어내기 전 값으로 매겨지며 그 값이 커졌다).
        막기의 규칙은 한 줄도 바뀌지 않았다 (INTENT-GUARD-MITIGATE-001 ·
        INTENT-GUARD-COST-001 REUSED).

        한 휘두름이 여럿에게 닿으면 이 규칙이 몸마다 따로 도는 것도 그대로다 —
        따라서 판정도 몸마다 따로다. 한 사람에게 터졌다고 옆 사람에게도 터지지 않는다.
        대상의 순서가 정해져 있으므로 흔들림이 소비되는 순서도 정해져 있다.

    RULE-ATTRIBUTE-SET-001 (CHANGED — 목록만)
        Implements     INTENT-ATTRIBUTE-MUTATE-001
        CHANGED        변경 가능 속성에 criticalChance (0~1) · criticalDamage (1~100) 가
                       들어간다 (14개 → 16개). 판정 방식 · 요청 경로 · 거절 사유 4종 무변경.
        Result         Success | Failure(debug-closed | unknown-target |
                       unknown-attribute | value-out-of-range)

    새 행동은 없다.
        Critical 은 새 행동도 새 모션도 새 스킬도 만들지 않는다. 기존 타격이 지나가는
        자리에 판정 하나가 더 설 뿐이다 (01 EXCLUDED).

## BALANCE — 이 Cycle 이 소유하는 수치

    근거 문서는 Critical 의 값을 지정하지 않는다 (R1 §14 C011 은 이름 둘만 댄다).
    네 가지 제약 아래에서 정했다.

        (1) Critical 이 나지 않은 타격에서 이전 Cycle 의 결과가 한 값도 달라지지 않는다
        (2) **터뜨리는 쪽은 플레이어여야 한다** — Cycle Goal 의 주어가 플레이어이고
            관찰자의 몸은 rabbit-swordsman 이다 (RULE-OBSERVER-JOIN-001)
        (2') 터뜨리지 못하는 쪽도 세계 안에 있어야 한다 — 그래야 견줄 수 있고,
            **내가 맞는 값이 흔들리지 않아야** 아래 층들의 체감 기준이 남는다 (wanderer)
        (3) 새 자원도 새 수지도 만들지 않는다
        (4) 한 번의 전투 안에서 실제로 몇 번은 터져야 한다 — 열 번 쳐서 한 번도
            안 터지면 플레이로 확인할 수 없다

    ── 세계 상수 ─────────────────────────────────────────────────────
        ChanceSeed 기본값 = 0x5EEDC015      세계를 띄우는 쪽이 바꿀 수 있다
        ChanceStep        = 0x9E3779B9      한 걸음의 폭
        판정 식           Roll < Chance     Roll ∈ [0, 1)

        Chance 0    → 결코 터지지 않는다 · 커서를 쓰지 않는다
        Chance 0.25 → 넷에 하나꼴
        Chance 1    → 언제나 터진다 · 커서를 쓰지 않는다
        두 끝에서 세계는 다시 완전한 결정론이다 (INTENT-CRITICAL-ROLL-001).

    ── 종류별 Critical ───────────────────────────────────────────────
        rabbit-swordsman   CriticalChance 0.25 · CriticalDamage 2.0
            **관찰자(플레이어)의 몸이 이 종류다.** 넷에 하나꼴로 두 배가 터진다.
            0.25 와 2.0 을 고른 이유는 셋이다 —
            넷에 하나면 한 번의 교전(6대 안팎) 안에서 대개 한두 번 보이고(제약 4),
            두 배는 "이따금 상한을 넘는 결과가 터진다"(MP-BET-ON-THE-CRITICAL-BLOW)가
            눈으로 읽히는 가장 작은 크기이며,
            기대 배수가 1.25 라 아래 층들의 체감을 무너뜨리지 않는다.
        wanderer           CriticalChance 0 · CriticalDamage 1.0
            터뜨리지 못한다. 이 종류가 내는 모든 피해는 C013 과 완전히 같다.
            그래서 **관찰자가 맞는 값은 흔들리지 않는다** — C007 이래의 "관찰자의 몸은
            자율 존재의 기본 스킬 12대를 견딘다" 가 그대로 성립한다.
        DEFAULT            wanderer 와 같다 (미등록 종류의 폴백이며 관찰자의 몸이 아니다)

        왜 자율 존재에게 주지 않는가
            아래 세 층(C007 체감 · C010 공식 · C011 막기)의 "얼마나 버티는가" 기준값이
            전부 자율 존재가 관찰자를 치는 값이다. 그쪽에 흔들림을 주면 그 기준값이
            흔들려 각 층이 위층 없이도 서 있다는 증거가 사라진다
            (DC-COMBAT-ONE-LAYER-AT-A-TIME — "각 층은 상위 층 없이 완전히 동작한다").
            C013 이 관통을 오라 쪽에만 둔 것과 같은 판단이다.
            자율 존재가 터뜨리는 모습은 디버그 명령으로 만들어 확인한다.

    ── 실제로 갈리는 값 ──────────────────────────────────────────────

        관찰자(rabbit-swordsman)가 wanderer 를 친다. 대상도 스킬도 능력치도 그대로다.
        다른 것은 그 한 방이 터졌는가뿐이다.

            attack        raw 26 · Armor 30 · 관통 0    → 20      터지면  40
            heavy-attack  raw 72 · Armor 30 · 관통 0    → 55      터지면 110
            aura-strike   raw 26 · Resistance 90 · 관통 60
                                     → 걷혀 56.25       → 17      터지면  34

            **20 대 40.** 공격력도 스킬도 상대도 방어도 같다. 흔들림만 다르다.
            그리고 커지기 전 값(20)이 경위에 그대로 남는다 —
            C013 의 숫자가 사라지는 것이 아니라 그 옆에 커진 값이 서는 것이다.

        wanderer 의 생명은 120 이다.
            터지지 않으면            20 씩 → 6대
            넷에 하나 두 배로 터지면  기대 25 씩 → 4.8대
            "이따금 상한을 넘는다" 가 전투 길이로 읽힌다.

        막기와 겹칠 때 (관찰자가 heavy-attack, 대상이 정면으로 막는다)
            터지지 않으면   들어온 55  → 막아서 28 · 대가 33 기력
            터지면          들어온 110 → 막아서 55 · 대가 66 기력
            막기가 남기는 비율(0.5)도 대가를 매기는 기준(덜어내기 전 값 × 0.6)도
            그대로다. 마주한 크기만 두 배다.
            기력 66 은 rabbit-swordsman 의 cpMax 100 안이지만, 기력이 모자라면
            그 자리에서 방어가 무너진다 — 크게 터진 한 방이 방어를 무너뜨리는 것은
            새 규칙이 아니라 C011 의 규칙이 더 큰 값을 마주한 결과다.
            대상의 막기는 디버그 명령과 플레이로 만든다 (자율 존재는 막지 않는다).

    ── C013 대비 달라지는 값의 전부 ──────────────────────────────────
        관찰자(rabbit-swordsman)가 내는 타격 중 **터진 것**뿐이다.
        터지지 않은 타격과 wanderer 의 모든 타격은 C013 의 숫자가 그대로다.
        CriticalChance 를 0 으로 두면 세계 전체가 C013 과 한 톨도 다르지 않으며,
        ChanceCursor 는 0 에서 움직이지 않는다.

## OBSERVABLE SEMANTIC

    Actor.CriticalChance · Actor.CriticalDamage
        자기 것은 언제나 관찰된다 — 바꾼 직후 그 변화가 즉시 읽혀야 빈도와 크기가
        달라지는 것을 자기 눈으로 확인할 수 있다 (INTENT-SELF-OBSERVE-001).
        남의 것은 `combatStats` 안에 실리므로 **C014 의 살펴봄 관문을 그대로 따른다** —
        살펴보기 전에는 다른 여섯 능력과 함께 통째로 비어 있고, 살펴본 뒤 함께 열린다.
        가려지는 항목의 이름 목록(`combatStats` 등 셋)은 늘지 않는다.
        새 관문도, 새 사유 코드도 만들지 않는다 (INTENT-CRITICAL-OBSERVE-001).

    ActorView.versusObserver
        Critical 항목은 들어가지 않는다. 이 판정에는 맞는 자의 값이 하나도 들어가지
        않으므로 "나와 저 상대 사이의 값" 이라는 것이 존재하지 않는다.
        저 존재가 얼마나 터뜨리는지는 저 존재의 성질이고, 그것은 combatStats 의 자리다.

    DamageBreakdown.critical (타격마다)
        occurred · chance · multiplier · damageBeforeCritical

        한 방을 보고 "이 숫자가 흔들린 것인가" 에 답할 수 있다.
        터지지 않은 타격에서도 네 항목 모두 실린다 —
        damageBeforeCritical 과 finalDamage 가 같다는 것을 보는 것이
        "이번엔 안 터졌다" 의 관찰이다 (C013 이 defenseStat.value 와 effectiveDefense 를
        견주게 한 것과 같은 읽기다).
        chance 가 0 인 타격에서도 그 0 이 실린다 —
        **"터질 리 없는 몸" 과 "이번엔 운이 없었다" 를 경위만으로 가를 수 있어야 한다.**
        이 기록은 살펴봄 관문 뒤가 아니다. 이미 벌어진 사실이며 C007 이래 모두에게 보인다.

    World.ChanceSeed · ChanceCursor — **관찰되지 않는다**
        이 둘을 실으면 다음 타격이 터질지가 계산 가능해진다.
        그러면 흔들림은 사라지고 이 층은 "복잡한 결정론" 이 된다.
        Roll 값 자체도 경위에 싣지 않는다 — 연이은 Roll 은 뿌리를 되짚게 하고,
        뿌리를 되짚으면 앞날이 읽힌다.
        DC-COMBAT-PLAYER-CAUSALITY 가 요구하는 것은 **결과를 설명할 수 있음**이지
        판정의 재료를 공개하는 것이 아니다. chance · occurred · multiplier ·
        커지기 전 값이면 "25% 였고 이번엔 터졌고 두 배가 되어 20 이 40 이 되었다" 가
        완전히 읽힌다 (explainable_result).
        되짚기(같은 세계를 같은 순서로 다시 굴리기)는 세계 밖에서 뿌리를 지정해 하는
        일이지 관찰로 하는 일이 아니다.

    RULE-ATTRIBUTE-SET-001 의 거절 사유
        debug-closed · unknown-target · unknown-attribute · value-out-of-range 그대로.
        Critical 둘이 목록에 들어간 것과, 그 둘의 허용 범위가 좁다는 것만 달라진다.
        범위는 세계가 목록과 함께 싣는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    Observable Closure
        Rule 판정에 들어간 값이 전부 관찰된다 —
        가능성(chance) · 결과(occurred) · 증폭(multiplier) · 커지기 전 값 · 커진 뒤 값.
        판정에 들어가지 않은 것은 관찰되지 않아도 닫힌다 — 맞는 자의 값은 이 판정에
        하나도 들어가지 않았고, 흔들림의 뿌리는 결과를 설명하는 데 필요하지 않다.

## SEMANTIC CLOSURE

    ── INTENT-CRITICAL-001 ───────────────────────────────────────────
    "두 Critical 성질을 지닌다"              → Actor.CriticalChance · Actor.CriticalDamage
    "종류가 정한다"                          → CharacterDefinition.combat (BALANCE)
    "둘이 같이 자랄 이유는 없다"             → 별개의 두 값이고 범위도 다르다 (0~1 · 1~100)
    "그 자체로 아무것도 일으키지 않는다"     → 두 값은 어떤 Rule 의 Transition 에도 없다.
                                               RULE-CRITICAL-STRIKE-001 에서만 읽힌다
    "평소의 피해를 키우지 않는다"            → 터지지 않으면 Amplified = FinalDamage
    "기력을 쓰지도 벌지도 않는다"            → Cp 를 읽거나 쓰는 자리가 없다
    "터뜨릴 수 없다는 것은 값이 0"           → 별도 상태 없음. 기본값 0
    "맞는 자에게 관여할 값이 없다"           → 규칙의 Input 에 대상 Actor 가 없다

    ── INTENT-WORLD-CHANCE-001 ───────────────────────────────────────
    "세계가 자기 몫의 흔들림을 지닌다"       → World.ChanceSeed · World.ChanceCursor
    "밖에서 새로 들어오지 않는다"            → 두 값 모두 World Authority. 규칙 밖의
                                               난수원을 읽는 자리가 없다
    "쓰일 때마다 나아간다"                   → ChanceCursor += 1 (RULE-CRITICAL-STRIKE-001)
    "같은 순서면 같은 이야기"                → ChanceAt 은 (Seed, Cursor) 의 순수 함수다
    "미리 알 수는 없다"                      → Seed · Cursor · Roll 이 관찰에 실리지 않는다
    "읽지도 소비하지도 되돌리지도 못한다"    → 관찰 계약에 없고, 바꿀 수 있는 속성 목록에도
                                               없고, 되돌리는 규칙도 없다
    "쓰이는 자리는 정확히 하나"              → ChanceCursor 를 읽는 규칙이 하나뿐이다

    ── INTENT-CRITICAL-ROLL-001 ──────────────────────────────────────
    "타격이 들어갈 때 한 번 정한다"          → RULE-STRIKE-DAMAGE-001 안의 한 호출
    "한 타격에 정확히 한 번"                 → 호출이 하나다. 재판정 경로가 없다
    "맞은 몸마다 따로"                       → RULE-STRIKE-DAMAGE-001 이 몸마다 도는 구조 REUSED
    "치는 자의 가능성 하나뿐"                → Step 1 의 입력이 attacker.CriticalChance 뿐
    "방어·방식·거리·시각이 바꾸지 않는다"    → 규칙이 그 값들을 읽지 않는다
    "0 이면 결코, 1 이면 언제나"             → Step 2 의 두 갈래
    "두 끝에서 흔들림을 쓰지 않는다"         → 그 두 갈래에서 ChanceCursor 무변경
    "지난 타격을 기억하지 않는다"            → 판정의 입력에 과거 결과가 없다.
                                               연속 실패 보정 상태를 세우지 않는다

    ── INTENT-CRITICAL-AMPLIFY-001 ───────────────────────────────────
    "계산이 내놓은 최종 피해가 커진다"       → Step 3 의 입력이 Breakdown.FinalDamage
    "계산이 끝난 뒤의 값이다"                → RULE-DAMAGE-CALCULATE-001 무변경 ·
                                               규칙 밖에서 작용
    "공격·방어·걷힌 방어·감쇄율이 흔들리지 않는다"
                                             → 그 값들은 Breakdown 에 그대로 남는다
    "터지지 않은 타격은 이전과 값이 같다"    → Amplified = FinalDamage
    "언제나 키우는 쪽"                       → Multiplier = max(1, …)
    "양의 피해는 최소한만큼 들어간다"        → FinalDamage ≥ 1 이고 배율 ≥ 1 이면 ≥ 1
    "막기가 그 커진 값을 마주한다"           → RULE-STRIKE-DAMAGE-001 의 호출 순서
    "막기가 남기는 비율은 흔들리지 않는다"   → RULE-GUARD-BLOCK-001 무변경
    "대가는 여전히 덜어내기 전 크기로"       → 같음. 그 크기가 커졌을 뿐이다
    "그래서 더 쉽게 무너진다"                → 무너짐 조건 무변경 · 대가만 커진다

    ── INTENT-DAMAGE-BREAKDOWN-001 (CHANGED) ─────────────────────────
    "터졌는가"                               → critical.occurred
    "쓰인 가능성"                            → critical.chance
    "적용된 증폭"                            → critical.multiplier
    "커지기 전의 값"                         → critical.damageBeforeCritical
    "커진 뒤의 값은 이미 실려 있다"          → finalDamage (의미 확장)
    "터지지 않아도 사라지지 않는다"          → 네 항목 모두 조건 없이 실린다
    "같은 것을 보고 안 터졌음을 읽는다"      → damageBeforeCritical == finalDamage
    "0 인 몸과 운이 없었던 몸을 가른다"      → chance 가 0 인가 0 보다 큰가

    ── INTENT-CRITICAL-OBSERVE-001 ───────────────────────────────────
    "자기 것은 언제나 보인다"                → hud self.combat 에 두 값
    "남의 것은 살펴본 뒤에"                  → combatStats 안 — C014 관문 REUSED
    "새 관문이 생기지 않는다"                → CONCEALABLE_ATTRIBUTE_KEYS 무변경
    "한 번의 살펴봄이 함께 연다"             → 같은 조건 블록 안에 놓인다
    "이미 벌어진 타격은 관문 뒤가 아니다"    → StrikeEvent.breakdown 은 관문 밖 REUSED
    "역산하지 않아도 된다"                   → occurred 가 실린다
    "얼마의 가능성이었는지는 살펴봐야"       → 상대의 chance 는 combatStats 안이다.
                                               (타격 경위의 chance 는 그 타격의 사실이다 —
                                                이미 일어난 한 방을 설명하는 값이며,
                                                그 상대의 앞날을 알려주지 않는다)

    ── INTENT-ATTRIBUTE-MUTATE-001 (CHANGED) ─────────────────────────
    "목록에 두 성질이 더해진다"              → MutableAttribute 16종
    "가능성은 없음과 가득함 사이"            → criticalChance min 0 · max 1
    "증폭은 키우는 쪽으로만"                 → criticalDamage min 1 · max 100
    "허용 범위를 세계가 함께 밝힌다"         → MutableAttribute 가 범위를 지닌 채 관찰된다
    "두 끝을 직접 만들어 볼 수 있다"         → 0 과 1 이 모두 범위 안이다

    닫히지 않은 문장 없음. GAP 없음.
