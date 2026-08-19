# CYCLE C013 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable          기계 왕복 확인 · Human 완료 지시 2026-08-19
[PASS] Regression
[PASS] Catalog

STATUS  COMPLETE (2026-08-19)

## NEW BEHAVIOR

    관통을 지니고 쳤다          → 마주한 방어가 그만큼 통하지 않은 채로 계산된다
    관통 없이 같은 상대를 쳤다   → 같은 공격력·같은 스킬인데 피해가 작다 (14 대 17)
    상대의 방어가 두껍다        → 걷어내는 양이 커진다 (방어 300 에서 112.5 가 걷힌다)
    상대가 무르다               → 관통이 **아무 일도 하지 않는다** (방어 0 → 결과 동일)
    상대를 본다                 → 그 방어가 "나에게는 얼마로 읽히는지" 가 치기 전에 보인다
    맞은 자리를 본다            → 걷히기 전 · 관통 · 걷힌 뒤 세 값이 함께 남는다
    관통이 없는 쪽으로 쳤다      → 두 값이 같게 남는다 = 통하지 않았다는 관찰
    다시 쳤다                   → 상대의 방어는 줄어 있지 않다 (걷힘은 그 한 방 안에서만)
    막았다                      → 관통과 무관하게 C011 그대로다

## WORLD SCENARIO — 실측 (world/tests/penetration.spec.ts · 23 tests 통과)

    기준 배치
        관찰자 rabbit-swordsman  PhysAtk 40 · AuraAtk 40 · Armor 50 · Resist 20 · 관통 0 / 60
        자율 존재 wanderer       PhysAtk 40 · AuraAtk 15 · Armor 30 · Resist 90 · 관통 0 / 0
        관통은 **관찰자(플레이어)의 오라 쪽**에 있다 — 이 세계의 벽이 Resistance 90 이고,
        관찰자는 AuraAttack 40 을 지니고도 그 벽 때문에 오라를 쓸 수 없었다.
        오라 스킬 aura-strike — BaseDamage 6 · AttackRatio 0.5 → raw 26

    관통이 작용하는 자리
        Rule    RULE-DAMAGE-CALCULATE-001
                Step 0  aura → (auraAttack 40, resistance 90)          ← C012 무변경
                Step 1  resistancePenetration 60 → 90 × 100/160 = 56.25 ← C013 ADDED
                Step 2  raw = 6 + 40×0.5 = 26                          ← C010 무변경
                Step 3  26 × 100/156.25 = 16.64 → 17                   ← C010 식 무변경
        결과    breakdown.defenseStat      { resistance, 90 }     (걷히기 전)
                breakdown.penetrationStat  { resistancePenetration, 60 }
                breakdown.effectiveDefense 56.25                 (감쇄식의 입력)

    같은 raw · 같은 상대 · 관통만 다르다
        관통 0 으로     Resistance 90 → 90       26 × 100/190 = 14
        관통 60 으로    Resistance 90 → 56.25    26 × 100/156.25 = 17
        **14 대 17.** 공격 능력도 스킬도 상대도 같다.

    같은 관통이 상대에 따라 다르게 값한다 (관통 60 · raw 26)
        Resistance    0  → 0        걷힘 0        26      관통 0 일 때와 **완전히 같다**
        Resistance   20  → 12.5     걷힘 7.5      23      (관통 0 이면 22)
        Resistance   90  → 56.25    걷힘 33.75    17      (관통 0 이면 14)
        Resistance  300  → 187.5    걷힘 112.5     9      (관통 0 이면 7)
        걷어낸 방어량이 방어에 비례한다 — 0 / 7.5 / 33.75 / 112.5 (단조).
        피해 증가폭(0/+1/+3/+2)은 단조가 아니다 — 감쇄식이 완만해지는 구간에서 다시
        작아진다. 이 층이 약속한 단조는 **걷어내는 방어량**이며, 완만해지는 성질은
        C010 의 체감식이 이미 지닌 것이다.

    격리 (고르지 않은 관통은 읽히지 않는다)
        오라 타격에서 armorPenetration 을 100000 으로 올려도  결과 불변
        물리 타격은 관찰자의 물리 관통이 0 이라 C010 의 20 이 그대로다 —
        이것이 아래 세 층(C007 체감 · C010 공식 · C011 막기)의 기준값이 흔들리지 않은 이유다
        관통이 damageType · offenseStat · defenseStat 의 **이름**을 바꾸지 않는다

    경계
        방어가 통째로 사라지지 않는다   관통 100000 에서도 effectiveDefense > 0
        음수가 되지 않는다              양수 × (0,1] 은 언제나 양수
        최소 1                          resistance 100000 에서 finalDamage 1 (C010 REUSED)
        공격 피해 불변                  관통이 있어도 rawDamage · attackContribution 동일
        영구적이지 않다                 계산 뒤 target.resistance 는 90 그대로 ·
                                        두 번째 타격의 breakdown 이 첫 번째와 완전히 같다
        결정론                          같은 상태로 5회 반복 — 모든 값이 동일

## PROJECTION — 04-gameview.spec.yaml 계약 대조

    combatStats 여섯 값        관찰자 {physicalAttack 40, auraAttack 40, armor 50,
                               resistance 20, armorPenetration 0, resistancePenetration 60}
                               wanderer {… armorPenetration 0, resistancePenetration 0}
    versusObserver             기본        → {armor 30, resistance 56.25,
                                             resistanceMultiplier .64} — 오라 쪽만 걷힌다
                               내 관통 0   → {armor 30, resistance 90} (원래 값과 같다)
                               resistance 0 인 상대 → {resistance 0, multiplier 1}
                               벽 300      → {resistance 187.5, multiplier .3478}
    hud.self 관통 둘            self.combat.armorPenetration 0 ·
                               self.combat.resistancePenetration 60
    breakdown 두 항목           penetrationStat · effectiveDefense — 관통 0 에서도 실린다
    commandCatalog             14개 (관통 둘이 코드 수정 없이 나타났다)
    defenseShape               관통과 무관하게 걷히기 전 값으로 판정 — 확인 (aura-tougher)

    계약에 없는 것을 싣지 않았다 — 걷힌 몫(차이)도 PenetrationConstant 도 나가지 않는다.

## VIEW FIXTURE — World 미기동 (view/tests/penetration.spec.ts · 11 tests 통과)

    타격 경위        `오라 · 6+20=26 (오라 공격 40) ×64%(오라 방어 90 · 관통 60 → 56.25) = 17`
    관통 0 타격      `… ×53%(오라 방어 90 · 관통 0 → 90) = 14`  ← 두 값이 같은 것이 관찰이다
    속성 관찰        `물리 공격 40 · 물리 방어 30 (받는 피해 77%)`   ← 내 물리 관통이 0 이라 안 붙는다
                     `오라 공격 15 · 오라 방어 90 (받는 피해 53%) → 나에게 56.25 (64%)`
                     `관통 물리 0 · 오라 0`
                     `약점 물리에 약하다`                            ← 관통이 흔들지 않는다
    자기 패널        `관통 물리 0 · 오라 60`
    View 가 계산하지 않는다는 증거
                     fixture 의 versusObserver 를 원래 값으로 되돌리면 `→ 나에게` 표시가
                     사라진다. View 가 곱해 만들고 있었다면 그대로 남았을 것이다.

## PLAYABLE

    기계 왕복 — 실제 프로세스 경계를 넘어 확인했다 (`tsx server/main.ts` + ws 클라이언트)

        변경 가능 속성이 그대로 왔다
            [hp, hpMax, cp, cpMax, physicalAttack, auraAttack, armor, resistance,
             armorPenetration, resistancePenetration, moveSpeed, runSpeedMultiplier,
             actionSpeed, moveMode]                          — 12개 → 14개, View 수정 없음
        관찰자의 관통이 hud 로 실려 온다
            self.combat.armorPenetration 0 · resistancePenetration 60
        상대의 combatStats 에 관통 둘이 실려 온다
            {… armorPenetration: 0, resistancePenetration: 0}
        상대의 방어가 나에게 얼마로 읽히는지가 치기 전에 온다
            versusObserver {armor 30, resistance 56.25, resistanceMultiplier 0.64}
            내 관통을 0 으로 되돌리면 {resistance 90} 으로 돌아온다

        실제로 때린 결과 (요청 → 세계 판정 → 관찰 결과 · 모두 오라 스킬)
            관통 60 · resistance  90   → 17   90 · 관통 60 → 56.25    ×0.6400
            관통  0 · resistance  90   → 14   90 · 관통  0 → 90       ×0.5263
            관통 60 · resistance   0   → 26    0 · 관통 60 → 0        ×1.0000
            관통 60 · resistance 300   →  9   300 · 관통 60 → 187.5   ×0.3478
            관통  0 · resistance 300   →  7   300 · 관통  0 → 300     ×0.2500

        다섯 조합 모두 WORLD SCENARIO 의 예측값과 같다.
        요청이 세계에 닿고, 세계의 판정이 관찰 결과로 되돌아온다.
        걷힌 값도 관계도 세계가 보낸 값이며 화면은 그것을 문구로만 옮긴다.

        (측정 중 상대의 moveSpeed·physicalAttack 을 0 으로 둔 것은 자율 존재가
         실측을 흔들지 않게 하기 위한 것이다. 관통과 무관한 값이며 결과에 영향이 없다.)

    사람의 확인 — **아직이다.** 확인할 것은 다음 아홉이다 (04 PLAYABILITY NOTE).
        1. 자기 패널에 `관통 물리 0 · 오라 60` 이 늘 보인다
        2. 자율 존재를 보고 속성을 펼친다 —
           `오라 방어 90 (받는 피해 53%) → 나에게 56.25 (64%)` 가 뜬다
        3. 물리 줄에는 `→ 나에게` 가 없다 — 그쪽으로는 내 관통이 통하지 않는다
        4. R(오라)로 친다 — `-17` 과 `… (오라 방어 90 · 관통 60 → 56.25) = 17`
        5. F(물리)로 친다 — `-20` 과 `관통 0 → 30` 으로 두 값이 같게 뜬다 (C010 그대로)
        6. set-attribute 로 상대의 resistance 를 0 으로 만든다 — `→ 나에게` 가 사라지고
           피해가 관통 없을 때와 같아진다 (26)
        7. 상대의 resistance 를 300 으로 올린다 — `나에게 187.5` 로 읽히고
           피해가 7 이 아니라 9 다
        8. 내 resistancePenetration 을 0 으로 되돌린다 — 모든 표시가 C012 와 같아진다 (14)
        9. Q 로 막는다 — 관통이 큰 타격을 막아도 C011 과 똑같이 절반이 되고 같은 기력을 치른다

## REGRESSION

    03 의 AFFECTED 를 모두 돌았다.

    RULE-GUARD-BLOCK-001 (C011)      막기는 FinalDamage 에 그대로 걸린다.
                                     guard 4항목 표시 무변경 — view/tests/guard.spec.ts 통과
    RULE-DAMAGE-APPLY-001            appliedDamage 의 출처 무변경
    RULE-SWING-STRIKE-001 (C006)     명중 판정 무변경
    RULE-SKILL-BEGIN/BUDGET-001      관문·기력 수지 무변경
    RULE-NPC-DECIDE-001 (C007)       결정 방식 무변경. 자율 존재도 같은 계약을 쓴다
    RULE-ATTRIBUTE-SET-001 (C009)    거절 사유 4종 무변경. 목록만 14개가 되었다

    관통이 0 인 조합에서 C010·C012 의 값이 한 값도 달라지지 않았다 (실측)
        모든 물리 타격          → wanderer  attack 20 · heavy 55 ·
                                → rabbit    attack 17 · wanderer → rabbit 17
        wanderer 의 오라 타격    → rabbit    11
        달라진 것은 관찰자가 내는 **오라** 피해뿐이다 — 14→17 · 22→23
        (01 SCOPE NOTE 가 예고한 대가이며, 오라 쪽에 둔 이유가 이것이다:
         아래 세 층의 기준값이 전부 물리 타격이라 그대로 남았다).

    C010 의 성질도 그대로다 — 최소 1 · 체감식 · 난수 없음.

    전체 34 files · 534 tests 통과 · `npm run build` (tsc --noEmit + vite build) 통과

## CATALOG

    `npm run catalog:check` — 카탈로그 3원소(world·view·motions) 정합.
    존재 종류를 추가하지 않았다. rabbit-swordsman · wanderer 의 CombatSpec 에
    관통 두 값이 더해졌을 뿐이며 새 모션도 새 kind 표현도 없다.

## CORRECTION — 2026-08-18, Human 지적으로 되돌린 것

    처음 구현에서 관통 60 을 **wanderer(자율 존재)** 에게 주었다. 관찰자의 몸은
    rabbit-swordsman 이므로 (RULE-OBSERVER-JOIN-001), 그 상태의 세계에서는
    플레이어의 관통이 0 이고 자율 존재만 관통을 지녔다 — Cycle Goal 의 주어가
    뒤집혀 있었다. 기계 검증과 306 tests 는 전부 통과했다. 계산이 아니라
    **어느 종류에 주는가**를 틀린 것이라 어떤 검사도 잡지 못했다.

    Human 이 "플레이어에 영향을 주는 속성이 명료한가" 를 물어 드러났고,
    03 World Semantic 의 BALANCE 로 반환해 고쳤다.
        관통을 관찰자의 몸(rabbit-swordsman)으로 옮긴다
        물리 쪽이 아니라 **오라 쪽**에 둔다 — 아래 세 층의 기준값이 전부 물리 타격이며,
        그 값들이 흔들리면 각 층이 위층 없이도 선다는 증거가 사라진다
        (DC-COMBAT-ONE-LAYER-AT-A-TIME). 동시에 이 세계에서 실제로 두꺼운 방어
        (wanderer 의 Resistance 90)를 겨냥하게 되어 MP-PIERCE 의 문장과도 맞는다.

    이 문서의 모든 실측은 고친 뒤 다시 돌린 값이다.

## MASTER FEEDBACK

    Capability Overlay
        MC-PENETRATION             MISSING → IMPLEMENTED
            근거  이 문서의 WORLD SCENARIO · PLAYABLE — 마주한 방어가 결정적으로 깎이고
                  (90 → 56.25), 마주하지 않은 방어에는 닿지 않으며(격리 실측 —
                  물리 타격의 C010 값 20 이 그대로다),
                  두껍게 굳힌 상대일수록 걷어내는 양이 커진다(0/7.5/33.75/112.5).
                  방어를 없애지는 못한다(관통 100000 에서도 남는다).
                  MC-PENETRATION 의 세 문장이 그대로 실측되었다.
        MC-ATTACK-ARMOR-MATCHUP    IMPLEMENTED → IMPLEMENTED (유지)
            근거  타입 대응(Step 0)은 한 줄도 바뀌지 않았다. 관통은 그 뒤에 온다.
        MC-DEFENSE-MITIGATION      IMPLEMENTED → IMPLEMENTED (유지)
            근거  감쇄식과 상수 100 이 그대로다. 바뀐 것은 그 식이 읽는 값 하나다.
        MC-COMBAT-STRIKE           IMPLEMENTED → IMPLEMENTED (유지)

    Possibility
        MP-PIERCE-THE-HARD-DEFENSE  요구 Capability 4종이 모두 채워졌다.
            근거  MC-PENETRATION 이 마지막 결손이었다 (overlay.md 59행).
                  그 노드의 changes 두 문장이 세계에서 성립한다 —
                  "두껍게 굳힌 방어가 그만큼 값어치를 잃는다" (resistance 300 → 187.5) ·
                  "방어를 올리는 것만으로는 안전이 보장되지 않는다" (7 → 9).
            주의  이 Cycle 은 그 Possibility 를 **열었을 뿐** 아직 좁다 —
                  관통을 지닌 존재가 wanderer 하나이고, 플레이어가 관통을 **얻는** 경로가
                  세계에 없다 (디버그 명령뿐이다). 아래 Frontier Candidate 참조.

    Knowledge
        MK-OPPONENT-DEFENSE-SHAPE  넓어졌다 (새로 세운 것이 아니다)
            근거  C012 의 DefenseShape 위에 versusObserver 가 얹혔다. "상대가 어떤 방어를
                  지녔는가" 에 "그 방어가 나에게 얼마인가" 가 더해졌다 — 같은 지식의
                  관계 형태다. DefenseShape 판정은 관통에 흔들리지 않게 두었다.

    Constraint Evaluation
        DC-COMBAT-ONE-FORMULA          SATISFIED
            감쇄식·DefenseConstant 100·하한 1 이 한 글자도 바뀌지 않았다.
            걷는 데 쓴 곡선도 새로 만들지 않았다 — 세계가 이미 쓰는 100/(100+x) 를
            방어 값에 적용했다. Step 2~3 에 penetrationStat 이 등장하지 않는다.
        DC-COMBAT-PLAYER-CAUSALITY     SATISFIED
            난수원 없음. 관통은 방어를 무시할 **확률**이 아니라 언제나 같은 몫을
            걷어내는 값이다 (5회 반복 동일). 걷히기 전·관통·걷힌 뒤가 모두 관찰된다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME  SATISFIED
            Penetration 층 하나만 올렸다. 능동 방어(완벽한 막기·되받아치기·가드 브레이크)와
            Critical·회피·Aura 는 손대지 않았다. 막기는 관통을 읽지 않고 관통은 막기를
            뚫지 않는다 — 두 의미가 계산의 서로 다른 지점에 남아 있다.
        DC-COMBAT-MATCHUP-SOFT         SATISFIED
            타입별 관통 배율표 없음 · 면역 없음(하한 1 유지) ·
            깎인 방어값이 관찰 가능(defenseStat + effectiveDefense + versusObserver).
            상성은 여전히 대응 능력치의 차이에서만 나온다 — 관통은 대응을 바꾸지 않는다.
        DC-WORLD-OWNS-THE-SURFACE-LIST SATISFIED — 네 번째 증거가 나왔다
            ① 속성 **추가**(C010) ② interaction **추가**(C011) ③ **삭제와 분할**(C012)
            에 이어 이번은 **관계의 추가**다. versusObserver 는 두 존재 사이의 값인데도
            세계가 계산해 실었고, View 는 곱셈을 하지 않는다.
            fixture 에서 versusObserver 를 되돌리면 표시가 사라지는 것이 그 증거다
            (view/tests/penetration.spec.ts). 계약 목록(14개)도 View 수정 없이 따라왔다.

    Constraint Candidate
        CC-THE-WORLD-OWNS-THE-RELATION (제안)
            관찰  이 Cycle 의 새 관찰값은 한 존재의 속성이 아니라 **두 존재 사이의 값**
                  이었다. 그런 값은 View 가 "그냥 곱하면" 만들 수 있기 때문에, 계약에
                  넣지 않고 지나치기 쉽다. 그러나 곱하는 순간 세계가 몫을 정하는 규칙을
                  바꿔도 화면이 따라오지 않는다.
            문안 후보  "두 존재 사이에서만 정해지는 값도 세계가 계산해 관찰에 싣는다.
                       View 는 관찰값끼리 계산해 새 의미를 만들지 않는다."
            근거  DC-WORLD-OWNS-THE-SURFACE-LIST 의 확장이며 별개 문안이 아닐 수도 있다.
                  Human 이 판단할 일이며 이 Cycle 은 승격하지 않는다.

    Frontier Candidate (다음 후보로 제안 — 확정하지 않는다)
        FR-EARN-THE-PIERCING (제안)
            지금  관통은 종류가 정한 값이거나 디버그 명령으로만 바뀐다. 플레이어가
                  "그 벽을 뚫기 위해 무언가를 한다" 는 선택이 세계에 아직 없다.
                  MP-PIERCE-THE-HARD-DEFENSE 는 열렸지만 그 경로를 **고를** 수는 없다.
            주의  이것이 장비인지 성장인지 준비 행동인지는 근거 문서가 정하지 않았다.
                  R1 §14 는 다음 층으로 Active Defense 를 지정한다 — 순서 판단은 Human 의 몫.

    Master Gap
        없음. 상위 의미와 어긋난 지점을 발견하지 못했다.
        R1 §14 가 배정한 한 줄(`Penetration → Defense 를 감소시킨다`)과
        DT §15 의 작용 지점(대응 뒤 · 선택된 방어에만 · Damage Type 불변)을 그대로 따랐다.

## FAILURES

    없음. 반환(GAP)도 없었다.

## STATUS

    COMPLETE   (2026-08-19)
        기계 검증 7항 통과 + Human 완료 지시 ("C013도 완료처리해줘").
        아홉 항목의 화면 확인을 Agent 가 대신 수행한 것은 아니다 — 그 판단은 Human 이
        내렸고 이 기록은 그 지시를 옮긴 것이다. 위 목록은 이후 회귀 확인의 기준으로 남긴다.

        Master Feedback 은 같은 날 반영되었다 —
        MC-PENETRATION MISSING → IMPLEMENTED · MP-PIERCE-THE-HARD-DEFENSE 닫힘 ·
        CC-THE-WORLD-OWNS-THE-RELATION 접수(PENDING) ·
        FR-EARN-THE-PIERCING 후보 등록(Constraint Eval UNRESOLVED — 형태 미정) ·
        획득 경로 부재를 overlay 와 growth/growth-graph.md 에 남겼다.
        경위는 master/HISTORY.md 의 C013 절이 소유한다.
