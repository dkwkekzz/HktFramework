# CYCLE C011 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[    ] Playable          ← Human Play 확인 대기. 기계 왕복은 통과했다 (아래 PLAYABLE)
[PASS] Regression

## NEW BEHAVIOR

    막지 않았다                  → 그 타격이 온전히 들어간다 (C010 그대로)
    앞을 향해 막았다             → 절반만 들어가고 그만큼 기력을 치른다
    옆·뒤에서 맞았다             → 막고 있어도 막지 않은 것과 같다 (기력도 치르지 않는다)
    치를 기력이 모자랐다         → 방어가 무너지고 그 타격은 온전히 들어간다
    무너진 직후                  → 잠시 다시 막을 수 없다 (사유 guard-broken)
    막는 중                      → 스킬이 시작되지 않는다 (사유 guarding), 걷기는 된다
    막는 중 달리기를 걸었다      → 거절이 아니라 막기가 풀린다

## WORLD SCENARIO — 실측 (world/tests/guard.spec.ts · 34 tests 통과)

    기준 배치 (둘 다 rabbit-swordsman)  Attack 40 · Defense 50 · hp 200 · cp 30
    기본 스킬 한 방                     raw = 6 + 40×0.5 = 26 → ×100/150 → FinalDamage 17

    막힌 타격
        Before  hp 200 · cp 30 · guarding true · 정면
        Input   RULE-SWING-STRIKE-001 (기본 스킬)
        Rule    RULE-DAMAGE-CALCULATE-001 → 17
                RULE-GUARD-BLOCK-001      → cost = ceil(17×0.6) = 11, applied = round(17×0.5) = 9
        After   hp 191 · cp 19 · guarding true
                breakdown.guard = { blocked: true, broken: false, cpPaid: 11, prevented: 8 }
                breakdown.finalDamage 17 · appliedDamage 9 · amount 9

    뒤에서 온 타격
        Before  hp 200 · cp 30 · guarding true · 공격자가 등 뒤(dot = -1)
        After   applied 17 · cp 30 (한 방울도 치르지 않는다) · guarding true (무너진 것이 아니다)
                breakdown.guard 없음 — 막지 않은 타격의 경위는 C010 과 완전히 같다

    무너짐 (연속 3회)
        Before  cp 30 · guarding true
        1회     blocked · cp 30 → 19
        2회     blocked · cp 19 → 8
        3회     8 < 11 → broken · applied 17 (줄지 않았다) · cp 8 (내지 못했으므로 내지 않는다)
                guarding false · guardBrokenUntil = time + 1.0
        회복    time+0.5 에 재요청 → guard-broken 거절, time+1.1 → 성공

    경계
        딱 맞는 기력(11)이면 막는다 / 하나 모자라면(10) 무너진다 — 중간 값이 없다
        FinalDamage 1 → applied 1 (하한이 0 을 막는다) · FinalDamage 0 → applied 0
        정면 판정 dot ≥ 0.5 — (2,2) 방향(45°)은 막히고 (0,2)(90°)는 막히지 않는다
        같은 입력을 두 번 돌린 결과가 완전히 같다 (난수원 없음)

    막아도 그대로인 것 (실측)
        velocity.x > 0 — 밀려남은 일어난다
        state = 'hit' — 하던 행동은 끊긴다

## PROJECTION — 04-gameview.spec.yaml 계약 대조

    entities[].attributes.guard          모든 character 에 실린다.
                                         자율 존재도 { guarding: false, broken: false } 로 실린다
                                         (world/tests/combat.spec.ts 의 attributes 전체 형태 검사)
    interactions[guard-begin]            available + reason(downed | insufficient-cp | guard-broken)
    interactions[guard-release]          available 언제나 참
    interactions[attack|skill-heavy]     reason 에 guarding 이 실린다
    strikes[].breakdown.appliedDamage    amount 와 언제나 같다
    strikes[].breakdown.guard            막지 않은 타격에는 실리지 않는다
    hud[self.guard.guarding|broken]      실린다

    투영하지 않은 것 — 세계 상수 4종과 Actor.GuardBrokenUntil.
    04 의 OBSERVABLE PROJECTION NOTE 에 사유가 적혀 있고 그대로 지켰다.

## VIEW FIXTURE — 실측 (view/tests/guard.spec.ts · 15 tests 통과, World 미기동)

    guard.fixture.json
        막힌 타격      text "-9" · detail "막음 17→9 · 기력 -11" · guard 'blocked'
        무너진 타격    text "-17" · detail "방어 무너짐" · guard 'broken'
        막지 않은 타격 text "-55" · detail 없음 · guard 없음  (C010 표시 그대로)
        관찰 켬        "막음 17→9 · 기력 -11 · 6+20=26 ×67%(방어 50) = 17"
        자기 표시      { guarding: true, broken: false, text: '막는 중' }
        속성 펼침      "막기 막는 중" / 자율 존재는 "막기 없음"
        스킬 사유      "막는 중에는 휘두를 수 없다"

    guard-broken.fixture.json
        자기 표시      { guarding: false, broken: true, text: '무너짐' }
        guard-begin    available false · "방어가 무너져 아직 다시 들 수 없다"

## PLAYABLE

    기계 왕복 — 실제 프로세스 경계를 넘어 확인했다 (`tsx server/main.ts` + ws 클라이언트)

        막기 표면이 실려 오는가 : {"id":"guard-begin","role":"guard-begin","available":true}
        막기 전 guarding      : false / cp 30
        막기 후 guarding      : true
        막는 중 스킬 사유     : guarding
        막는 중 휘두름 대답   : {"accepted":false,"rule":"RULE-SKILL-BEGIN-001","reason":"guarding"}
        놓은 뒤 guarding      : false / attack 가용 true

        요청이 세계에 닿고, 세계의 판정이 관찰 결과와 대답 양쪽으로 되돌아온다.
        View 가 스스로 판정하지 않는다는 것도 여기서 확인된다 —
        막는 중의 휘두름 요청이 그대로 나가고 세계가 사유와 함께 거절했다.

    사람의 확인 — 아직이다. 확인해야 할 것은 다음 일곱이다 (04 PLAYABILITY NOTE).
        1. Q 로 막기를 건다 — 자기 표시에 "막는 중" 이 뜬다
        2. 자율 존재 앞에 서서 맞는다 — "-9" 와 "막음 17→9 · 기력 -11" 이 함께 뜨고
           생명은 9, 기력은 11 줄어든다
        3. 등을 돌린 채 맞는다 — "-17" 만 뜨고 막기 줄이 없다
        4. 계속 막는다 — 세 번째에 "방어 무너짐" 이 붉게 뜨고 "-17" 이 그대로 들어간다
        5. 곧바로 다시 건다 — "방어가 무너져 아직 다시 들 수 없다"
        6. 막는 중 F 를 누른다 — "막는 중에는 휘두를 수 없다"
        7. 놓고 다시 휘두른다 — 평소대로 나간다

## REGRESSION — 03 의 AFFECTED 전부

    RULE-DAMAGE-CALCULATE-001    아무도 막지 않는 세계의 타격값이 C010 과 같다 —
                                 관찰자(Attack 40) → npc-1(Defense 30) = 20, breakdown 6항목 동일
                                 (world/tests/guard.spec.ts REGRESSION · damage.spec.ts 전체)
    RULE-SKILL-BEGIN-001         막고 있지 않을 때의 거절 사유 3종(downed · action-busy ·
                                 insufficient-cp)이 그대로다 (combat.spec.ts 18 tests)
    RULE-MOVE-MODE-001           막고 있지 않을 때의 walk/run 전환과 거절 사유가 그대로다
    RULE-SWING-STRIKE-001        누가 맞는지 정하는 판정 무변경 (collision.spec.ts 8 tests)
    RULE-SKILL-BUDGET-001        때린 쪽의 기력 수지가 막혔든 아니든 같다
    RULE-NPC-DECIDE-001          자율 존재의 결정 방식 무변경 (npc.spec.ts 5 tests)
    RULE-ATTRIBUTE-SET-001       변경 가능 목록이 10개 그대로다 — 막기는 값으로 세울 상태가 아니다
                                 (command.spec.ts 24 tests)
    Observer Projection          C004~C010 의 관찰 계약이 그대로다 (observer.spec.ts 26 ·
                                 observer-mark.spec.ts 14)

    world 254 tests 전부 통과 (기존 220 + 신규 34)
    전체 452 / 453 통과
    npx tsc --noEmit 오류 없음 · npx vite build 성공 · npm run catalog:check 정합

    경계 감사 — view/ app/ 어느 곳도 world/ 를 import 하지 않고, world/ 는 view/ 를
    import 하지 않는다 (grep 확인). 공유는 protocol/ 뿐이다.

## MASTER FEEDBACK

    Capability Overlay
        MC-GUARD        MISSING → IMPLEMENTED
            근거  이 문서의 WORLD SCENARIO — 막기가 행동으로 존재하고(RULE-GUARD-BEGIN-001),
                  정면 판정이 방향을 가르며, 막힌 타격이 절반으로 줄고 기력을 치른다.
                  MP-TRADE-BODY-FOR-RESOURCE 가 요구하던 마지막 결손이다.
        MC-CP-ECONOMY   PARTIAL → PARTIAL (유지, 그러나 근거가 넓어졌다)
            근거  기력을 쓰는 자리가 둘(고급 스킬 · 달리기)에서 셋(+막기)이 되었다.
                  같은 예산을 두고 공격과 방어가 경쟁하기 시작했다.
                  승격하지 않는 이유 — 기력이 스스로 돌아오지 않는다는 결손은 그대로다
                  (C007 EXCLUDED 이며 이번 Cycle 도 건드리지 않았다).
                  판정은 Master M3 의 몫이다.

    Constraint Evaluation
        DC-COMBAT-ONE-FORMULA        SATISFIED
            RULE-DAMAGE-CALCULATE-001 의 계산식이 한 줄도 바뀌지 않았다.
            막기는 그 함수 밖에서 결과값에 작용한다.
        DC-COMBAT-PLAYER-CAUSALITY   SATISFIED
            난수원 없음. 같은 입력을 두 번 돌린 결과가 완전히 같다(실측).
            줄어든 양(prevented)과 그 대가(cpPaid)와 무너짐이 모두 관찰 결과에 실린다.
        DC-COMBAT-SHARED-BUDGET      SATISFIED
            새 자원도 새 게이지도 만들지 않았다. Actor.Cp 하나를 그대로 쓴다.
            화면에서도 새 막대를 만들지 않았다 — 기력 막대가 줄어드는 것으로 보인다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME SATISFIED
            Defense Action 층 하나만 올렸다. 완벽한 막기·되받아치기·Guard Break·
            균형 누적값·Damage Type 은 손대지 않았다.
        DC-WORLD-OWNS-THE-SURFACE-LIST SATISFIED — 그리고 두 번째 증거가 나왔다
            touch-pad.ts 를 한 줄도 고치지 않았는데 손가락 버튼에 막기가 생겼다.
            세계가 interaction 목록에 실었고 결정 Layer 가 키·문구를 붙였기 때문이다.
            C010 이 명령 목록(commandCatalog)에서 보여준 것과 같은 일이
            이번에는 interaction 쪽에서 일어났다 — 이 Constraint 가 두 경로 모두에서
            성립한다는 뜻이다.

    Constraint Candidate
        CC-RESOURCE-GATE-IS-ALL-OR-NOTHING (제안)
            관찰  자원을 치르고 얻는 이득은 "낼 수 있으면 온전히, 없으면 전혀" 로 갈렸다.
                  부분 감쇄를 허용하면 기력 0 에 붙은 채 영원히 조금씩 막게 되어
                  "자원이 마르면 무너진다" 는 의미가 사라진다.
                  같은 판단이 C007 의 스킬 기력 관문(모자라면 아예 시작되지 않는다)에도
                  이미 있었다 — 이번이 두 번째다.
            의미  자원이 대가인 곳에서는 중간 값을 만들지 않는다. 그래야 고갈이 사건이 된다.
            주의  Cycle 두 개의 관찰이다. 승격 판단은 Human 의 몫이며,
                  세 번째 사례가 나오기를 기다리는 것도 정당하다.

    Master Gap
        없음.

        다만 Human 이 판단할 자리가 하나 열렸다 — DC-COMBAT-DEFENSE-IS-ACTIVE 는
        현재 DRAFT 이고, 그 Constraint 의 근거 층이 바로 이 Cycle 이었다.
        이제 "막기는 수치가 아니라 플레이어가 고르는 행동" (requires:
        defense_as_player_action) 이 세계에 실재한다. 재승인 여부는 M1 의 몫이다.
        같은 Constraint 의 두 번째 requires(defense_success_creates_offense_opportunity)는
        이 Cycle 이 닫지 않았다 — FR-PERFECT-GUARD-TURNS-THE-TABLE 이 이어받는다.

    참고 — 설계 원본과 코드가 어긋난 지점 하나를 고쳤다 (Master Gap 아님)
        C010 이 `damage-calculate.ts` 주석에 "Guard 는 DefenseMultiplier 를 건드린다" 고
        앞을 내다보며 적었으나, R1 핵심 원칙은 `Guard → Final Damage 를 감소시킨다` 이고
        §14 도 `Guard → Damage Taken × 0.5` 다. 원본을 따르고 주석을 고쳤다.
        차이는 실재한다 — DefenseMultiplier 에 걸면 방어가 높은 존재일수록
        막기의 절대 효과가 작아진다. 상위 의미와 어긋난 것은 코드 주석 쪽이었다.

## FAILURES

    [FAIL] view/tests/motion-atlas.spec.ts — sprite 여백(bleed) 검출 1건
        이 Cycle 의 변경과 무관하다. 작업 전 상태(origin/main)에서 같은 항목이
        같은 형태로 실패하는 것을 확인했다 (git stash 후 재실행).
        스프라이트 격자 판정 문제이며 이 Cycle 의 범위가 아니라 손대지 않았다.
        Master 가 아니라 별도 정비 Cycle 의 몫으로 남긴다.

## COMPLETION GATE

    [x] 작은 플레이 가능한 Goal 이 정의되어 있다            01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                      02-intent.md 3 Goal · 5 Possibility
    [x] Intent 가 존재한다                                  02-intent.md 11 ADDED · 4 CHANGED
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다      03 SEMANTIC CLOSURE 30줄
    [x] World State 변화가 World Rule 을 통해서만 발생한다   Guarding 을 바꾸는 곳 4개 모두 rules/
    [x] World 는 Authoritative 하다                         View 는 막기 가능 여부를 판정하지 않는다
                                                            (PLAYABLE 왕복에서 실측)
    [x] GameView Specification 이 존재한다                  04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다        grep 확인 — world/ import 없음
    [x] World 는 View 구현 정보를 사용하지 않는다           grep 확인 — view/ import 없음
    [x] World 를 View 없이 검증할 수 있다                   world 254 tests
    [x] View 를 Fixture 만으로 검증할 수 있다               view/tests/guard.spec.ts 15 tests
    [x] Server + Client 연결 시 실제 플레이가 가능하다      ws 왕복 실측 (PLAYABLE)
    [x] Runtime 결과를 Goal / Possibility / Intent 까지 추적할 수 있다
                                                            RULE_GUARD_* · INTENT_GUARD_* 식별자
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다     ← 대기
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다      FR-PERFECT-GUARD 가 이 막기 위에 얹힌다

## STATUS

    IN PROGRESS — Human Play 확인만 남았다.
