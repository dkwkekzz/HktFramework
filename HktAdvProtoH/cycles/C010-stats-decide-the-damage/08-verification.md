# CYCLE C010 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable          (자동 조작으로 달성 — Human Play 확인 대기)
[PASS] Regression
[PASS] Catalog

## NEW BEHAVIOR

    공격 능력이 높다        → 같은 스킬이 더 크게 깎는다
    상대 방어 능력이 높다    → 같은 공격이 덜 깎는다
    방어 능력이 아무리 높다  → 그래도 0 이 되지 않는다 (최소 1)
    타격이 일어난다         → 그 값이 나온 경위가 함께 남는다
    두 능력을 바꾼다        → 다음 타격부터 결과가 달라지고, 경위가 그 원인을 가리킨다

## WORLD SCENARIO

    실측이다 — `npx vitest run world/` 로 돌린 결과이며, 값은 모두 테스트가 확인한 것이다.

    1  공격 능력이 결과를 정한다                      world/tests/damage.spec.ts
        Before  관찰자 Attack 40 · 자율 존재 hp 120 Defense 30
        Input   attack (기본 스킬) 명중
        Rule    RULE-DAMAGE-CALCULATE-001 → RULE-STRIKE-DAMAGE-001
        After   6 + 40×0.5 = 26 → ×100/130 = 20.0 → hp 100

        Before  같은 상황에서 Attack 을 80 으로 바꾼 뒤
        After   6 + 80×0.5 = 46 → ×100/130 = 35.4 → 35 → hp 85

    2  방어 능력이 결과를 정한다
        Before  대상 Defense 30 → 200 으로 바꾼 뒤
        After   26 × 100/300 = 8.67 → 9

        Before  대상 Defense 0
        After   26 × 100/100 = 26        (방어가 없으면 공격 피해 그대로)

        Before  대상 Defense 100000
        After   26 × 100/100100 = 0.026 → **1**   (0 이 되지 않는다 — 하한이 막는다)

    3  체감식이 성립한다
        Defense  0 → 100 → 200 → 300 에서 피해 26 → 13 → 9 → 7
        줄어드는 폭   13 > 4 > 2   — 같은 만큼 올려도 효과가 점점 작아진다
        그러면서도 어느 구간에서도 피해가 늘지 않는다

    4  계수가 큰 스킬이 더 크게 자란다
        Attack 40 → 80 일 때 기본(ratio 0.5) 증가분 < 고급(ratio 1.0) 증가분

    5  계산은 하나이고 우연이 없다
        같은 조건으로 세 번 반복 → 20 · 20 · 20
        한 휘두름이 둘에게 닿았을 때 → 각자의 방어로 20 (Defense 30) · 26 (Defense 0)

    6  경위가 남는다
        strikes[0].breakdown = { baseDamage 6, attackContribution 20, rawDamage 26,
                                 targetDefense 30, defenseMultiplier 0.769…, finalDamage 20 }
        amount === breakdown.finalDamage

## VIEW FIXTURE

    `npx vitest run view/` — World 미기동, Fixture 만으로 돌린 결과다.

    view/tests/damage.spec.ts (9 항목)
        hud.self 첫 줄        `공격력 40 · 방어력 50 (받는 피해 67%)`
        속성 관찰 켰을 때      `공격 40 · 방어 30 (받는 피해 77%)`
        속성 관찰 껐을 때      inspect 없음 — 몸 위를 채우지 않는다
        타격 (평소)           `-55` 만 뜬다, detail 없음
        타격 (관찰 켬)         `32+40=72 ×77%(방어 30) = 55`
        단단한 쪽을 때렸을 때   `6+20=26 ×67%(방어 50) = 17`
        표시 숫자 = 경위 최종  모든 타격에서 일치
        경위가 있어도 크기·자리·나이는 그대로

## PLAYABLE

    세계 프로세스(`server/main.ts`, PORT 5199)를 띄우고 **두 가지 방식**으로 붙여 확인했다.

    ── ① 관찰자 프로세스를 붙여 절차대로 (WebSocket + 실제 계약) ──────

    1. 세계가 두 능력을 실어 보낸다
        나의 combatStats        {"attack":40,"defense":50,"defenseMultiplier":0.6666…}
        자율 존재 combatStats    {"attack":40,"defense":30,"defenseMultiplier":0.7692…}
        hud self.combat.*       attack 40 · defense 50 · defenseMultiplier 0.6666…
        변경 가능 목록           hp · hpMax · cp · cpMax · **attack** · **defense** ·
                                moveSpeed · runSpeedMultiplier · actionSpeed · moveMode

    2. 기본 상태로 한 대 친다
        amount 20
        breakdown  base 6 · 공격 기여 20 · raw 26 · 상대 방어 30 · ×0.769 · 최종 20
        화면에 뜰 경위   `6+20=26 ×77%(방어 30) = 20`
        자기 정보 첫 줄  `공격력 40 · 방어력 50 (받는 피해 67%)`

    3. 내 공격력을 40 → 80 으로 올리고 다시 친다
        hud self.combat.attack 가 즉시 80 으로 바뀐다
        amount 35 (20 → 35)
        화면에 뜰 경위   `6+40=46 ×77%(방어 30) = 35`
        달라진 것은 공격 기여 하나뿐 — 스킬도 상대 방어도 그대로다

    4. 상대의 방어력을 30 → 200 으로 올리고 다시 친다
        상대 combatStats 가 즉시 defense 200 · multiplier 0.333 으로 바뀐다
        amount 15 (35 → 15)
        화면에 뜰 경위   `6+40=46 ×33%(방어 200) = 15`

    5. 판정
        공격력을 올리니 더 아프다        PASS   20 → 35
        상대 방어를 올리니 덜 아프다      PASS   35 → 15
        표시 값과 경위가 일치한다        PASS

    ── ② 실제 Client 를 브라우저로 (빌드 → 자동 조작 → 화면 확인) ────

    `npx vite build` 후 세계가 서빙하는 페이지를 Chromium 으로 열고,
    V(속성 관찰)를 켠 뒤 W 로 걸어 붙어 F(기본 스킬)로 싸웠다.

        자기 정보 패널   `공격력 40 · 방어력 50 (받는 피해 67%)`            [확인]
        몸 위 속성 관찰  Wanderer 1 `공격 40 · 방어 30 (받는 피해 77%)`      [확인]
                        Player 1   `공격 40 · 방어 50 (받는 피해 67%)`      [확인]
        맞은 자리        `-17` 아래에 `6+20=26 ×67%(방어 50) = 17`          [확인]
                        (자율 존재가 나를 친 것 — 내 방어 50 이 26 을 17 로 줄였다.
                         이 값은 03 BALANCE 가 예고한 숫자와 정확히 같다)
        속성 관찰을 끄면 숫자만 남고 경위는 사라진다                          [확인]

    두 방식 모두에서 Cycle Goal 이 달성된다 —
    "능력치를 바꿔 가며 때려 보고, 피해가 왜 그만큼인지 그 자리에서 확인한다".

## REGRESSION

    03 의 AFFECTED 전체와 과거 Cycle Scenario 를 재실행했다.

    RULE-SWING-STRIKE-001 (C006)      한 휘두름은 같은 몸을 한 번만 때린다      still passes
                                      여럿에게 닿으면 각자 판정된다             still passes
    RULE-BODY-PUSH-001 (C006)         밀어냄은 피해와 무관하게 그대로            still passes
    RULE-SKILL-BUDGET-001 (C007)      맞혀야 기력이 돈다 · 여럿 때려도 1회 정산   still passes
    RULE-SKILL-COST-GATE-001 (C007)   기력 부족이면 시작되지 않는다 + 사유        still passes
    RULE-DOWNED-001 (C007)            생명 0 이면 쓰러지고 대상이 되지 않는다     still passes
    RULE-ATTRIBUTE-SET-001 (C007 R2)  범위 검사·거절 사유 4종 그대로             still passes
                                      두 능력 추가 · 음수 거절                  new, passes
    RULE-NPC-DECIDE-001 (C002)        자율 존재의 결정 방식 불변                still passes
    CommandCatalog (C009)             허용 목록 단일 출처 — 코드 변경 0으로 확장  still passes
    Observer Projection (C004)        관찰자별 투영 · 이어짐 · 표식             still passes

    C007 체감 보존 (이 Cycle 의 회귀 기준)
        관찰자 → 자율 존재  기본 20 · 고급 55        C007 고정값과 **같다**   [PASS]
        자율 존재 → 관찰자  기본 17                  C007 은 20 이었다        [의도된 변화]
            근거 rabbit-swordsman 의 방어 50 > wanderer 의 30.
                 05-review.md 에서 Human 이 승인한 선택이다

    전체   `npx vitest run`   28 파일 404 항목 중 **403 통과**
    `npx tsc --noEmit`        오류 없음
    `npx vite build`          성공

## CATALOG

    `npm run catalog:check` → 카탈로그 3원소가 정합한다.
    존재 종류는 늘지 않았고 기존 2종 + 기본 정의에 combat 항목만 더해졌다.
    view kind 표현과 motions/ 는 변화 없다.

## MASTER FEEDBACK

    Capability Overlay
        MC-ATTACK-POWER        MISSING → IMPLEMENTED
            근거  Actor.Attack 이 존재하고 RULE-DAMAGE-CALCULATE-001 이 그것을 피해로
                  바꾼다. WORLD SCENARIO 1 · PLAYABLE ①-3 에서 40 → 80 변경이
                  20 → 35 의 실제 피해 차이로 관찰되었다
        MC-SKILL-SCALING       MISSING → IMPLEMENTED
            근거  SkillDefinition 이 BaseDamage 와 AttackRatio 로 나뉘었고,
                  WORLD SCENARIO 4 에서 계수가 큰 스킬이 같은 공격 증가에 더 크게
                  자라는 것이 실측되었다
        MC-DEFENSE-MITIGATION  MISSING → IMPLEMENTED
            근거  Actor.Defense 와 체감식이 존재한다. WORLD SCENARIO 2·3 에서
                  방어 증가에 따른 감소와 그 체감 곡선, 0 이 되지 않는 하한이 실측되었다
            주의  이것은 R1 §4 의 **수동 감쇄**다. 능동 방어(Guard 등)는 여전히 MISSING 이며
                  MP-TRADE-BODY-FOR-RESOURCE 는 이 Cycle 로 닫히지 않았다

    Constraint Evaluation
        DC-COMBAT-ONE-FORMULA        SATISFIED
            Actor.Hp 를 타격으로 줄이는 규칙은 RULE-STRIKE-DAMAGE-001 하나이고,
            그것이 RULE-DAMAGE-CALCULATE-001 만을 호출한다. 다른 피해 경로가 없다.
            damage-calculate.ts 머리 주석에 위층의 확장 지점(Critical·Guard·Penetration·
            Aura 가 각각 무엇을 건드리는지)을 명시해 두었다
        DC-COMBAT-PLAYER-CAUSALITY   SATISFIED
            계산 입력에 세계 시각도 난수원도 없다. 같은 조건 3회 반복이 같은 값을 냈고,
            결과의 원인이 breakdown 으로 관찰된다 (구판 §15.1 의 원인 추적 요구 충족)
        DC-COMBAT-ONE-LAYER-AT-A-TIME SATISFIED
            R1 §13 의 16개 항목을 하나도 구현하지 않았다. 새 행동도 새 상태도 없다
        DC-COMBAT-SHARED-BUDGET      SATISFIED
            자원은 hp · cp 둘 그대로다. 기력 수지 4값(12/0/8/30)이 불변임을 테스트가 고정한다

    Constraint Candidate
        관찰된 패턴 — **"세계가 목록의 단일 출처면 표면은 저절로 자란다"**.
        C009 가 MutableAttributes 를 명령 카탈로그의 Domain 으로 실어 보내도록 만든 덕에,
        이번 Cycle 은 두 속성을 세계에 더하는 것만으로 View 코드 변경 0 으로 조작 표면이
        늘었다. 같은 구조가 스킬 목록·존재 종류에도 적용될 수 있다.
        승격 판단은 Human 이 한다 — Agent 는 관찰만 보고한다.

    Master Gap
        없음. 다만 Master 에 남길 사실 하나가 있다 —
        FR-STATS-DECIDE-THE-DAMAGE 의 Playable Result 는 능력치 차이를 "장비·성장으로"
        만든다고 적었으나, 이번 Cycle 이 제공한 수단은 C009 디버그 명령이다.
        R1 §13 이 장비·성장 층을 제외하므로 의도된 축소이며 Human 이 05-review.md 에서
        승인했다. Frontier 문구를 다음 Frontier 갱신 때 이 구분에 맞춰 다듬는 것이 좋다.

## FAILURES

    [FAIL] view/tests/motion-atlas.spec.ts
           "move 는 1·2행이 맞닿아 있어 완전히 나눌 수 없다 — 경고로 고정한다"
           C010 이전 트리에서도 동일하게 실패한다 (git stash 로 재현 확인).
           그림 시트의 절단선 검사이며 이 Cycle 의 변경과 무관하다.
           Return To  없음 — C010 의 결함이 아니다. 그림 자산을 다루는 Cycle 이 가져간다

    그 외 실패 없음.

## CYCLE COMPLETION GATE

    [x] 작은 플레이 가능한 Goal 이 정의되어 있다        01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                 02-intent.md (2 Goal · 5 Possibility)
    [x] Intent 가 존재한다                             신규 5 · CHANGED 4
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다  03 SEMANTIC CLOSURE — 잔여 문장 없음
    [x] World State 변화가 World Rule 을 통해서만 발생   Hp 감소는 RULE-STRIKE-DAMAGE-001 만이,
                                                       두 능력 변경은 RULE-ATTRIBUTE-SET-001 만이
    [x] World 는 Authoritative 하다                    Client 는 요청만 한다 (PLAYABLE ①)
    [x] GameView Specification 이 존재한다             04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다     view 는 protocol 만 import 한다
    [x] World 는 View 구현 정보를 사용하지 않는다        world 에 view import 없음
    [x] World 를 View 없이 검증할 수 있다               world/tests 180 항목
    [x] View 를 Fixture 만으로 검증할 수 있다           view/tests/damage.spec.ts 9 항목
    [x] Server + Client 연결 시 실제 플레이가 가능하다   PLAYABLE ① · ②
    [x] Runtime 결과를 Goal / Intent 까지 추적할 수 있다 아래 TRACE
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다  **대기**
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다   RULE-DAMAGE-CALCULATE-001 이
                                                       위층들의 공통 기반으로 남는다

## TRACE

    화면에 `-35` 와 `6+40=46 ×77%(방어 30) = 35` 가 뜬다
        ← SceneStrike.text · detail            view/presentation/combat-presentation.ts
        ← 04 strikeEvents.amount · breakdown
        ← StrikeEvent.breakdown                world/rules/strike-damage.ts
        ← RULE-DAMAGE-CALCULATE-001            world/rules/damage-calculate.ts
        ← Actor.Attack(80) · Skill.AttackRatio(0.5) · Target.Defense(30)
        ← INTENT-DAMAGE-CALCULATE-001 · INTENT-ATTACK-POWER-001 ·
          INTENT-SKILL-SCALING-001 · INTENT-DEFENSE-001 · INTENT-DAMAGE-BREAKDOWN-001
        ← POSSIBILITY-ATTACK-AMPLIFY · POSSIBILITY-BREAKDOWN-OBSERVE
        ← GOAL-COMBAT-POWER-DIFFERS · GOAL-DAMAGE-EXPLAINABLE
        ← 01 GOAL "같은 스킬을 휘둘러도 공격 능력치가 높은 존재가 더 아프게 때리고 …
           피해 숫자가 왜 그만큼인지를 계산 내역으로 그 자리에서 확인한다"
        ← FR-STATS-DECIDE-THE-DAMAGE ← MP-OUTGROW-THE-OPPONENT
          ← MG-OVERCOME-SUPERIOR-OPPONENT

## STATUS

    IN PROGRESS  — Human Play 확인 대기.
