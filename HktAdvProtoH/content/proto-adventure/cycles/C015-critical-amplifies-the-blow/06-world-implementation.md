# C015 — World Implementation

> `RULE-DAMAGE-CALCULATE-001` 은 **한 줄도 바뀌지 않았다.** 바뀐 것은 반환 형의 이름뿐이고
> (`DamageBreakdown` → `DamageCalculation`), 그 계산이 읽고 쓰는 값은 그대로다.
> 이 Cycle 이 더한 것은 그 계산 **밖에** 서는 규칙 하나와 세계 상태 둘이다.

## IMPLEMENTED

    Actor.CriticalChance · CriticalDamage    world/semantic/actor.ts
        0~1 과 1 이상. 치는 자의 능력이며 맞는 자에게서는 읽히지 않는다

    World.ChanceSeed · ChanceCursor          world/semantic/world-state.ts
        DEFAULT_CHANCE_SEED = 0x5EEDC015. 커서는 0 에서 시작한다

    ChanceAt(Seed, Cursor)                   world/semantic/combat.ts `chanceAt`
        03 이 적은 식 그대로. 32비트 정수 연산이며 `>>> 0` 이 매 단계 폭을 강제한다.
        결과는 `[0, 1)` — 1 은 나올 수 없고 0 은 나올 수 있다

    CHANCE_STEP = 0x9E3779B9                 world/semantic/combat.ts
        헤더 상수. 결정론에 영향을 주므로 CVar 로 열지 않는다

    CriticalOutcome                          world/semantic/combat.ts
        occurred · chance · multiplier · damageBeforeCritical

    DamageCalculation                        world/semantic/combat.ts
        `Omit<DamageBreakdown, 'critical' | 'guard'>` — 계산이 내놓는 것.
        **중립값을 미리 채우지 않기 위해 형을 갈랐다** — `chance: 0` 을 미리 채워 두면
        "터질 리 없는 몸" 과 "아직 판정하지 않았다" 가 같은 모양이 되어
        경위를 읽을 수 없다 (INTENT-DAMAGE-BREAKDOWN-001)

    RULE-CRITICAL-STRIKE-001                 world/rules/critical-strike.ts   ← 새 파일
        Step 1 가능성을 0~1 로 묶는다
        Step 2 0 이면 안 터지고 1 이면 터진다 — **둘 다 커서를 쓰지 않는다.**
               그 사이면 ChanceAt 을 읽고 커서를 한 칸 밀고 `Roll < Chance` 로 정한다
        Step 3 `max(1, CriticalDamage)` 를 곱하고 반올림한다

        Input 에 대상 Actor 가 없다 — 맞는 자의 값이 판정에 하나도 들어가지 않는다는
        것을 **형이 말하게** 했다. 방식도 세계 시각도 읽지 않는다

    CharacterDefinition.combat 여덟 값        world/semantic/character-catalog.ts
        rabbit-swordsman 0.25 / 2.0 · wanderer 0 / 1.0 · DEFAULT wanderer 와 같다
        (03 BALANCE). 종류가 정하는 값이므로 카탈로그 한 곳에만 둔다

## REUSED

    RULE-DAMAGE-CALCULATE-001    world/rules/damage-calculate.ts
        계산식 · 상수 · 대응표 · 걷어내기 무변경. 반환 형 이름만 DamageCalculation 이다
    RULE-GUARD-BLOCK-001         world/rules/guard.ts — **한 줄도 고치지 않았다**
    RULE-SWING-STRIKE-001        world/simulation/swing-strike.ts — 대상 선정 무변경
    RULE-OBSERVE-*               world/rules/observe.ts — 살펴봄 관문 무변경
    World.Acquaintances          world/semantic/acquaintance.ts —
                                 CONCEALABLE_ATTRIBUTE_KEYS 그대로 셋이다
    spawnActor                   world/semantic/spawn.ts — 카탈로그에서 두 값을 더 읽는다

## AFFECTED UPDATED

    RULE-STRIKE-DAMAGE-001       world/rules/strike-damage.ts
        계산과 막기 **사이에** 판정 하나가 놓인다. 그 결과 막기가 마주하는 값이
        증폭된 값이 된다. 막기 호출의 인자도 순서도 그대로다
    RULE-ATTRIBUTE-SET-001       world/rules/attribute-set.ts
        MUTABLE_ATTRIBUTES 16종 (criticalChance 0~1 · criticalDamage 1~100).
        판정 방식 · 요청 경로 · 거절 사유 4종 무변경.
        **범위가 좁은 첫 항목들이지만 계약은 그대로다** — 범위는 원래부터
        세계가 목록과 함께 싣는 것이다 (DC-WORLD-OWNS-THE-SURFACE-LIST)
    WorldSetup.chanceSeed        world/index.ts
        세계를 띄우는 쪽이 뿌리를 정한다. 요청으로는 바꿀 수 없다 —
        DebugAuthority 와 같은 자리다. 되짚기는 여기서 하는 일이지 관찰로 하는 일이 아니다
    protocol/gameview.ts         CriticalOutcomeView ADDED ·
                                 combatStats 에 두 값 · breakdown.critical

## PROJECTION

    world/projection/observer-view.ts

    combatStats.criticalChance · criticalDamage
        **C014 의 `acquainted ?` 블록 안에 그대로 놓았다.** 새 관문도, 새 조건문도,
        새 사유 코드도 만들지 않았다 — 한 번의 살펴봄이 여는 자리가 넓어질 뿐이다
    hud self.combat.criticalChance · criticalDamage
        counter 두 개. 0 인 쪽도 싣는다
    strikes[].breakdown.critical
        `{ ...event.breakdown }` 이 그대로 실어 보낸다 — 투영 코드를 고치지 않았다.
        타격 경위는 살펴봄 관문 밖이므로 모르는 상대에게 터진 것도 보인다
    versusObserver
        **Critical 을 넣지 않았다.** 판정에 맞는 자의 값이 하나도 들어가지 않으므로
        "나와 저 상대 사이의 값" 이 존재하지 않는다
    World.ChanceSeed · ChanceCursor · Roll
        **싣지 않는다.** 실으면 다음 한 방이 터질지가 계산 가능해진다

## TESTS

    world/tests/critical.spec.ts   38 tests — 새 파일

        INTENT-CRITICAL-001            종류가 정한 두 성질 · 성질만으로는 아무 일도 없다 ·
                                       맞는 자의 값이 판정에 들어가지 않는다
        INTENT-WORLD-CHANCE-001        같은 뿌리 → 같은 이야기 · 다른 뿌리 → 다른 이야기 ·
                                       뿌리·커서·Roll 이 관찰에 없다 ·
                                       치지 않으면 커서가 흐르지 않는다
        INTENT-CRITICAL-ROLL-001       0 이면 결코 · 1 이면 언제나 (둘 다 커서 무변경) ·
                                       판정마다 한 칸 · 두 끝을 오가도 쓴 만큼만 흐른다 ·
                                       기본 뿌리의 앞 다섯 판정 · 연속 실패 보정 없음 ·
                                       방식·시각 무관 · 한 휘두름이 둘에게 닿으면 따로 정해진다
        INTENT-CRITICAL-AMPLIFY-001    계산 안의 값 전부 무변경 · 1 미만 거절 ·
                                       배율이 자라면 터진 값도 자란다 · 0 피해는 그대로 0 ·
                                       하한 1 이 증폭 뒤에도 유지된다
        (막기)                         비율 0.5 와 대가 기준 무변경 · 마주한 크기만 두 배 ·
                                       같은 기력으로 55 는 막고 110 은 무너진다
        INTENT-DAMAGE-BREAKDOWN-001    터진 경위 · 안 터진 경위 ·
                                       "터질 리 없는 몸" 과 "운이 없었다" 를 가른다 ·
                                       모르는 상대에게 터진 것도 보인다
        INTENT-CRITICAL-OBSERVE-001    살펴보기 전 가려짐 · 한 번의 살펴봄이 함께 연다 ·
                                       그 순간의 값 · versusObserver 에 없다 ·
                                       자기 것은 즉시 · 0 도 싣는다
        INTENT-ATTRIBUTE-MUTATE-001    0~1 · 1~100 경계 · 범위를 세계가 목록과 함께 싣는다
        REGRESSION                     확률 0 이면 20 · 55 · 17 (C010 · C012 · C013 그대로) ·
                                       자율 존재의 가능성은 0 이다

    갱신한 기존 검증 (계약이 자란 만큼만 — 약화 없음)
        combat.spec.ts        combatStats 여덟 값 · MUTABLE_ATTRIBUTES 16종
        command.spec.ts       set-attribute Domain 16종
        damage.spec.ts        combatStats · breakdown.critical
        damage-type.spec.ts   combatStats · 물리/오라 경위의 critical
        observe.spec.ts       combatStats 여덟 값
        penetration.spec.ts   관통이 작용한 경위의 critical

    실측 — `npx vitest run content/proto-adventure/world` → **17 파일 338 tests 통과**
           (C014 시점 300 → 새 38). `npm run boundary:check` 경계 위반 0.
           `npm run catalog:check` 3원소 정합.

## NOTES

    ── 왜 계산 안이 아니라 밖인가

    `RULE-DAMAGE-CALCULATE-001` 은 세계를 바꾸지 않는 순수한 계산이다. Critical 판정은
    세계 상태(ChanceCursor)를 소비하므로 그 안에 둘 수 없다. C011 의 막기가 같은 이유로
    밖에 있었고, 이 층도 같은 자리에 선다 — 그래서 계산은 이 Cycle 뒤에도 여전히
    "같은 입력이면 같은 값" 이다.

    ── 왜 두 끝에서 커서를 아끼는가

    결과만 보면 `Roll < chance` 로 이미 옳다 (Roll ∈ [0,1) 이므로 chance 0 은 결코,
    chance 1 은 언제나다). 갈린 것은 결과가 아니라 **소비**다.
    덕분에 가능성 0 인 존재들만 있는 세계는 커서가 영원히 0 이고,
    그 세계는 C013 과 완전히 같은 세계다 — 이것이 Regression 의 바닥이며
    `critical.spec.ts` 가 커서 값으로 직접 검증한다.

    ── 세계 수준과 규칙 수준을 나눈 이유 (테스트 구조)

    세계 수준에서 같은 상대를 잇달아 치면 휘두름의 충격이 상대를 사거리 밖으로 밀어낸다
    (C006 INTENT-SWING-IMPACT-001). 이 Cycle 이 보는 것은 밀려남이 아니라 **같은 조건에서
    결과가 어떻게 갈리는가**이므로, 연속 판정 검증은 `Before → Input → Rule → After` 를
    규칙에 직접 걸었다 (`bench`). 투영·관찰·명령 검증은 그대로 세계 수준(`driveWorld`)이다.
    세계를 약하게 만든 것이 아니라 각 검증이 보는 것을 그 층에 맞춘 것이다.

    ── 기존 검증 갱신의 성격

    갱신한 6개 파일은 전부 `toEqual` 로 계약의 **전체 모양**을 박아 둔 자리다.
    계약이 자랐으므로 기대값도 자란다 — 어느 것도 약화하지 않았고, 오히려
    breakdown 검증에는 `critical: { occurred: false, … }` 를 더해
    **"이 숫자는 흔들리지 않았다"** 를 명시적으로 주장하게 만들었다.

    ── 남은 것

    View 는 이 Cycle 때문에 고칠 것이 없다 (04 계약). 다만 `view/tests/` 의
    fixture JSON 이 combatStats 여덟 값을 담지 않아 형이 맞지 않는다 —
    계약이 자란 만큼 fixture 를 채우는 일이며 Stage 7 이 한다.

    GAP 없음. `engine/` 을 편집하지 않았다.
