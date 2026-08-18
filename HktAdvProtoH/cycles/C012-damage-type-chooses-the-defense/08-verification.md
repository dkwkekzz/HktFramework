# CYCLE C012 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable          기계 왕복 + Human Play 확인 (2026-08-18)
[PASS] Regression

## NEW BEHAVIOR

    물리 스킬로 쳤다            → 내 물리 공격력과 상대의 물리 방어로 계산된다
    오라 스킬로 쳤다            → 내 오라 공격력과 상대의 오라 방어로 계산된다
    상대가 오라에 단단하다      → 같은 세기로 쳐도 오라 쪽이 덜 들어간다
    상대가 물리에 단단하다      → 답이 뒤집힌다. 오라 쪽이 더 들어간다
    상대를 본다                 → 두 방어와 "어느 쪽에 약한지" 가 세계의 판정으로 보인다
    맞은 자리를 본다            → 방식과, 그 방식이 읽은 두 능력의 이름·값이 함께 남는다
    상대의 방어를 바꿔 본다     → 약점 판정이 따라 바뀌고 다음 타격의 값도 바뀐다
    막았다                      → 방식과 무관하게 C011 그대로다

## WORLD SCENARIO — 실측 (world/tests/damage-type.spec.ts · 26 tests 통과)

    기준 배치
        관찰자 rabbit-swordsman  PhysicalAttack 40 · AuraAttack 40 · Armor 50 · Resistance 20
        자율 존재 wanderer       PhysicalAttack 40 · AuraAttack 15 · Armor 30 · Resistance 90
        두 스킬 모두 BaseDamage 6 · AttackRatio 0.5 — 값이 같고 방식만 다르다

    물리 타격 (attack)
        Rule    RULE-DAMAGE-CALCULATE-001
                Step 0  physical → (physicalAttack 40, armor 30)
                Step 1  raw = 6 + 40×0.5 = 26
                Step 2  26 × 100/130 = 20.0 → 20
        결과    amount 20
                breakdown.damageType 'physical'
                breakdown.offenseStat { physicalAttack, 40 }
                breakdown.defenseStat { armor, 30 }

    오라 타격 (aura-strike)
        Step 0  aura → (auraAttack 40, resistance 90)
        Step 1  raw = 26  (기본 스킬과 **같다** — 값이 같기 때문이다)
        Step 2  26 × 100/190 = 13.68 → 14
        결과    amount 14 · defenseStat { resistance, 90 }

        같은 raw 에서 결과가 갈렸다. 갈린 원인은 오직 고른 방어 값 하나다.

    답이 뒤집히는 자리 (상대를 rabbit-swordsman 의 방어 분포로)
        Armor 50 · Resistance 20
        물리  26 × 100/150 = 17.33 → 17
        오라  26 × 100/120 = 21.67 → 22      ← 오라가 낫다

    격리 (고르지 않은 능력은 읽히지 않는다)
        물리 타격에서 auraAttack 을 100000 으로, 상대 resistance 를 0 으로 흔들어도  20 그대로
        오라 타격에서 physicalAttack 을 100000 으로, 상대 armor 를 0 으로 흔들어도  14 그대로

    숨은 타입 보너스가 없다는 증거
        상대의 두 방어를 같은 값(40)으로 맞추면
        amount · rawDamage · defenseMultiplier 가 **완전히 같다**.
        다른 것은 damageType 과 고른 능력의 이름뿐이다.

    경계
        하한 1 — resistance 100000 에서도 오라 타격이 1 은 들어간다
        체감식 — resistance 0/100/200 에서 26/13/9, 줄어드는 폭이 점점 작아진다
        결정론 — 같은 입력을 세 번 돌린 결과가 완전히 같다. 난수원 없음
        저항은 확률이 아니다 — 통과하거나 빗나가는 타격이 하나도 없다

    C010 보존 (설계 수용 기준 §14-8)
        물리 기본 20 · 물리 고급 55 — C010 과 한 값도 다르지 않다.
        `world/tests/damage.spec.ts` 의 기대값이 **한 줄도 바뀌지 않았다** —
        바뀐 것은 속성 이름과 경위 항목뿐이다.

## PROJECTION — 04-gameview.spec.yaml 계약 대조

    entities[].attributes.combatStats     네 값 + 두 배율이 모든 character 에 실린다
    entities[].attributes.defenseShape    physical-tougher | aura-tougher | even
                                          세계가 계산한다 (임계 상수 없음 — 두 값의 대소만 본다)
    interactions[skill-aura]              available + reason(기존 4종과 같은 목록) + profile
    interactions[*].profile.damageType    attack · skill-heavy = physical · skill-aura = aura
    strikes[].breakdown.damageType        실린다
    strikes[].breakdown.offenseStat       { name, value }
    strikes[].breakdown.defenseStat       { name, value } — targetDefense 는 남지 않는다 (실측)
    hud self.combat.*                     네 값 · 두 배율 · defenseShape
    commandCatalog                        변경 가능 속성이 네 이름으로 바뀐 것이 그대로 실린다

    투영하지 않은 것 — World.DefenseConstant 와 DamageType 의 표시 이름.
    04 의 OBSERVABLE PROJECTION NOTE 에 사유가 적혀 있고 그대로 지켰다.

## VIEW FIXTURE — 실측 (view/tests/damage-type.spec.ts · 12 tests 통과, World 미기동)

    damage-type.fixture.json  (오라 스킬로 wanderer 를 친 순간 — 세계에서 뽑아 굳혔다)
        맞은 자리      text "-14"
        경위 켬        "오라 · 6+20=26 (오라 공격 40) ×53%(오라 방어 90) = 14"
        막기 줄        없음 — 막지 않은 타격의 표시가 C010·C011 과 같다
        상대 펼침      "물리 공격 40 · 물리 방어 30 (받는 피해 77%)"
                       "오라 공격 15 · 오라 방어 90 (받는 피해 53%)"
                       "약점 물리에 약하다"      ← 세계의 aura-tougher 를 옮긴 것
        자기 패널      "물리 공격 40 · 물리 방어 50 (받는 피해 67%)"
                       "오라 공격 40 · 오라 방어 20 (받는 피해 83%)"
                       "내 약점 오라에 약하다"
        오라 스킬      키 R · 프롬프트 "오라 스킬" · 사유가 기존 스킬과 같다
        명령 목록      physicalAttack · auraAttack · armor · resistance
                       attack · defense 는 없다

## PLAYABLE

    기계 왕복 — 실제 프로세스 경계를 넘어 확인했다 (`tsx server/main.ts` + ws 클라이언트)

        오라 스킬 표면이 실려 오는가
            {"id":"skill-aura","role":"skill-aura","available":true,
             "profile":{...,"damageType":"aura","rawDamage":26}}
        네 능력이 실려 오는가
            나   {physicalAttack:40, auraAttack:40, armor:50, resistance:20,
                  armorMultiplier:0.667, resistanceMultiplier:0.833}
            상대 {physicalAttack:40, auraAttack:15, armor:30, resistance:90, …}
        약점 판정
            나 physical-tougher · 상대 aura-tougher
        스킬 방식
            attack=physical · skill-heavy=physical · skill-aura=aura
        변경 가능 속성
            [hp, hpMax, cp, cpMax, physicalAttack, auraAttack, armor, resistance,
             moveSpeed, runSpeedMultiplier, actionSpeed, moveMode]
            — 옛 두 이름이 사라지고 네 이름이 들어온 것이 그대로 왔다

        실제로 때린 결과 (같은 상대, 번갈아)
            attack       → 20   defenseStat { armor, 30 }
            aura-strike  → 14   defenseStat { resistance, 90 }

        상대의 방어를 뒤집은 뒤 (armor 50 · resistance 20 으로 set-attribute)
            attack       → 17
            aura-strike  → 22   ← **답이 뒤집혔다**

        요청이 세계에 닿고, 세계의 판정이 관찰 결과로 되돌아온다.
        View 가 스스로 판정하지 않는다는 것도 여기서 확인된다 —
        약점도 방식도 세계가 보낸 값이고 화면은 그것을 문구로만 옮긴다.

    사람의 확인 — **아직이다.** 확인할 것은 다음 일곱이다 (04 PLAYABILITY NOTE).
        1. 자율 존재를 보고 속성을 펼친다 — "오라 방어 90 · 약점 물리에 약하다" 가 뜬다
        2. F 로 친다 — "-20" 과 "물리 · … (물리 방어 30) = 20"
        3. R 로 친다 — "-14" 와 "오라 · … (오라 방어 90) = 14". 같은 값으로 쳤는데 덜 아프다
        4. 다른 관찰자(또는 set-attribute 로 방어를 뒤집은 상대)를 친다 — 17 / 22 로 뒤집힌다
        5. set-attribute 로 상대의 resistance 를 바꾼다 — 약점 표시가 따라 바뀐다
        6. Q 로 막고 오라 타격을 받는다 — C011 과 똑같이 절반이 되고 같은 기력을 치른다
        7. 자기 패널에 내 네 능력과 내 약점이 늘 보인다

## REGRESSION — 03 의 AFFECTED 전부

    RULE-SKILL-BEGIN-001         오라 스킬도 같은 관문 4종(downed · guarding · action-busy ·
                                 insufficient-cp)을 지난다. 기존 스킬의 사유가 그대로다
                                 (combat.spec.ts · damage-type.spec.ts)
    RULE-SKILL-BUDGET-001        오라 스킬의 기력 수지가 기본 스킬과 같다 (실측 +12)
    RULE-SWING-STRIKE-001        누가 맞는지 정하는 판정 무변경 (collision.spec.ts 8 tests)
    RULE-GUARD-BLOCK-001         **한 줄도 고치지 않았다.** 시그니처가
                                 (target, attacker, finalDamage, worldTime) 이라
                                 방식을 알 방법이 아예 없다 — 구조적 증거다.
                                 guard.spec.ts 34 tests 전부 그대로 통과
    RULE-NPC-DECIDE-001          결정 방식 무변경 (npc.spec.ts 5 tests)
    RULE-DAMAGE-APPLY-001        덜어내는 값의 출처가 같은 자리다
    Observer Projection          C004~C011 의 관찰 계약이 그대로다
                                 (observer.spec.ts 26 · observer-mark.spec.ts 14)
    RULE-ATTRIBUTE-SET-001       판정 방식·요청 경로·거절 사유 4종 무변경. 목록만 바뀌었다.
                                 옛 이름은 unknown-attribute 로 거절된다 (실측)

    world 241 tests 통과 (기존 215 + 신규 26)
    전체 498 / 498 통과 — **실패 0**
    npx tsc --noEmit 오류 없음 · npx vite build 성공 · npm run catalog:check 정합

    경계 감사 — view/ app/ 어느 곳도 world/ 를 import 하지 않고, world/ 는 view/ 를
    import 하지 않는다 (grep 확인). 공유는 protocol/ 뿐이다.

    이전 Cycle 에서 넘어온 결함 해소 — C011 이 남긴
    `view/tests/motion-atlas.spec.ts` sprite bleed 실패가 이번 실행에서는 나타나지 않는다
    (17 tests 통과). 이 Cycle 이 고친 것이 아니라 그 사이 main 에 들어온 모션 정비
    (bfda851 motion-bugs-fix)가 해소한 것으로 보인다. 사실만 기록한다.

## MASTER FEEDBACK

    Capability Overlay
        MC-ATTACK-ARMOR-MATCHUP    MISSING → IMPLEMENTED
            근거  이 문서의 WORLD SCENARIO — 공격 형태 둘과 방어 형태 둘이 존재하고,
                  타입 대응이 계산의 입력을 고르며, 같은 스킬 값이 상대에 따라
                  다른 결과를 낸다(20/14 ↔ 17/22). MP-MATCH-WEAPON-TO-ARMOR 가
                  요구하던 마지막 결손이다.
        MC-COMBAT-STRIKE           IMPLEMENTED → IMPLEMENTED (유지)
            근거  타격 구조는 손대지 않았다. 새 명중 판정도 새 Hit Reaction 도 없다.

    Knowledge
        MK-OPPONENT-DEFENSE-SHAPE  세계에 세워졌다
            근거  Actor.DefenseShape 가 World Derived 로 존재하고 모든 관찰에 실린다.
                  그 노드의 문장 "이 지식이 없으면 무기 선택은 취향이고, 있으면 선택이
                  된다" 가 그대로 구현 근거다 — 그래서 View 가 계산하지 않게 두었다.

    Constraint Evaluation
        DC-COMBAT-ONE-FORMULA         SATISFIED
            RULE-DAMAGE-CALCULATE-001 의 Step 1~2 가 한 줄도 바뀌지 않았다.
            그 두 단계에 damageType 이 등장하지 않는다. 두 방어를 같게 맞추면 두 방식의
            결과가 완전히 같아지는 것이 그 증거다.
        DC-COMBAT-PLAYER-CAUSALITY    SATISFIED
            난수원 없음. Resistance 는 확률이 아니라 감쇄식의 분모 항이다.
            고른 능력의 이름과 값이 모두 관찰 결과에 실린다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME SATISFIED
            Damage Type 층 하나만 올렸다. 관통·완벽한 막기·되받아치기·속성 세분화·
            혼합 피해·면역은 손대지 않았다.
        DC-WORLD-OWNS-THE-SURFACE-LIST SATISFIED — 그리고 세 번째 증거가 나왔다
            변경 가능 속성이 attack/defense 에서 네 이름으로 **교체**되었는데
            View 소비 코드를 한 줄도 고치지 않았고 화면 목록이 그대로 따라 바뀌었다.
            C010 은 항목 **추가**에서, C011 은 interaction **추가**에서 같은 것을 보였다.
            이번은 **삭제와 분할**이다 — 이 Constraint 가 세 종류의 변경 모두에서
            성립한다는 뜻이다.
        DC-COMBAT-MATCHUP-SOFT (DRAFT)  SATISFIED — 이 Cycle 이 그 근거 층이다
            면역 없음(하한 1) · 타입 보너스 배율 없음(두 방어를 같게 맞추면 결과 동일) ·
            틀린 타입도 작동함(오라로 쳐도 14 는 들어간다).
            상성이 별도 배율표가 아니라 대응 능력치의 차이로만 표현된다.
            재승인 여부는 Human 의 몫이며 이 Cycle 은 그 판단을 대신하지 않는다.

    Constraint Candidate
        CC-THE-WORLD-NAMES-WHAT-IT-READ (제안)
            관찰  값이 여러 갈래가 되는 순간, 값만 보내면 그 값이 무엇이었는지 알 수 없다.
                  C010 의 `targetDefense: 30` 은 방어가 하나일 때만 성립하는 계약이었고,
                  방어가 둘이 되자 같은 30 이 물리인지 오라인지가 결과를 완전히 갈랐다.
                  같은 판단이 offenseStat 에도 필요했다.
            의미  세계가 무엇을 읽었는지 보낼 때는 값과 **그 값의 이름**을 함께 보낸다.
                  이름 없는 값은 갈래가 하나일 때만 유효한 계약이며, 갈래가 늘면 조용히
                  틀린다 — View 가 어느 쪽인지 짐작하기 시작하기 때문이다.
            주의  Cycle 하나의 관찰이다. 승격 판단은 Human 의 몫이며, 다음 층
                  (Penetration — Effective Armor 를 보내야 한다)에서 같은 일이
                  반복되는지 보고 결정하는 것도 정당하다.

    Master Gap
        없음.

    참고 — 밸런스 판단 하나를 이 Cycle 이 소유했다
        설계 §9 가 오라 쪽 초기값을 구현 Cycle 에 남겼다. 두 종류의 방어를 **반대로**
        치우치게 두어(rabbit-swordsman 50/20 · wanderer 30/90) 상대가 누구냐에 따라
        답이 뒤집히게 했다. 물리 이행값은 건드리지 않아 C010 이 전부 보존된다.
        오라 스킬을 기본 스킬과 같은 값으로 둔 것도 같은 판단이다 — 값이 다르면
        결과 차이가 방식 때문인지 값 때문인지 갈리지 않는다.

## FAILURES

    없음. 498 / 498 통과.

## COMPLETION GATE

    [x] 작은 플레이 가능한 Goal 이 정의되어 있다            01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                      02-intent.md 3 Goal · 7 Possibility
    [x] Intent 가 존재한다                                  02-intent.md 7종 (ADDED 4 · CHANGED 3)
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다      03 SEMANTIC CLOSURE 전 항목
    [x] World State 변화가 World Rule 을 통해서만 발생한다   네 능력을 바꾸는 곳은
                                                            RULE-ATTRIBUTE-SET-001 뿐이다
    [x] World 는 Authoritative 하다                         View 는 약점도 방식도 판정하지 않는다
    [x] GameView Specification 이 존재한다                  04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다        grep 확인 — world/ import 없음
    [x] World 는 View 구현 정보를 사용하지 않는다           grep 확인 — view/ import 없음
    [x] World 를 View 없이 검증할 수 있다                   world 241 tests
    [x] View 를 Fixture 만으로 검증할 수 있다               view/tests/damage-type.spec.ts 12 tests
    [x] Server + Client 연결 시 실제 플레이가 가능하다      ws 왕복 실측 (PLAYABLE)
    [x] Runtime 결과를 Goal / Possibility / Intent 까지 추적할 수 있다
                                                            RULE_* · INTENT_DAMAGE_TYPE_* 식별자
    [x] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다     2026-08-18 Human 확인
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다      Penetration 층이 고른
                                                            defenseStat 에 얹힌다

## STATUS

    COMPLETE — 2026-08-18. Completion Gate 15항 전부 참이다.
    기계 검증 14항이 통과했고 마지막 한 항(Human Play)을 Human 이 확인했다.

    Damage Type 층이 닫혔다. 다음 층은 Penetration —
    이 Cycle 이 고른 defenseStat 에 관통이 작용한다 (설계 §15 경계).
