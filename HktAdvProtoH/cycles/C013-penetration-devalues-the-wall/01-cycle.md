# CYCLE C013 — Penetration Devalues the Wall

[PASS] Cycle Definition
[PASS] Intent                    (관통은 계산 앞이 아니라 대응 뒤에 붙는다)
[PASS] World Semantic            (감쇄식 무변경 · 들어가는 방어 값만 걷힌다)
[PASS] GameView Specification    (한 방어가 세 값으로 읽힌다 · 새 표면 없음)
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-PENETRATION-DEVALUES-THE-WALL   (2026-08-18 Human Select)
    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility  MP-PIERCE-THE-HARD-DEFENSE
                        "고를 무른 쪽이 없을 때 남는 유일한 길이다. 상성 선택이 상대의
                         무른 쪽으로 피해 가는 것이라면 이것은 마주한 단단한 쪽을 깎아
                         통과한다. 내 세기를 키우는 것이 아니라 상대 방어의 값어치를
                         떨어뜨리므로, 두껍게 굳힌 상대일수록 이득이 커지고 무른
                         상대에게는 거의 의미가 없다 — 상대에 따라 값이 달라지는 투자다"
    Target Capability   MC-PENETRATION            (overlay: MISSING — 이번 Cycle 의 유일한 결손)
                        "상대의 방어 중 내 공격이 마주한 쪽을 얼마간 통하지 않게 만든다.
                         방어를 없애지는 못하고, 마주하지 않은 다른 방어에는 닿지 않으며,
                         두껍게 굳힌 상대일수록 무력화의 몫이 커진다"
    Reused Capability   MC-ATTACK-ARMOR-MATCHUP   (overlay: IMPLEMENTED — C012)
                        MC-DEFENSE-MITIGATION     (overlay: IMPLEMENTED — C010)
                        MC-COMBAT-STRIKE          (overlay: IMPLEMENTED — C007 · C010)
    Reused Knowledge    MK-OPPONENT-DEFENSE-SHAPE (C012 의 Actor.DefenseShape 로 이미 세계에 있다)

    층 위치 — 저장소 Cycle 번호는 설계의 층 번호와 다르다. Critical 층을 건너뛰었기
    때문이며(Q11 미결), 층은 번호가 아니라 이름으로 가리킨다. 이 Cycle 은
    R1 §14 의 **Penetration 층**이다 (그 문서에서는 "C014 — Penetration" 으로 적혀 있다).
    아래 층 셋은 닫혀 있다 — C010 기본 공식 · C011 막기 · C012 Damage Type.

    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-ONE-LAYER-AT-A-TIME
                        DC-COMBAT-MATCHUP-SOFT            (2026-08-18 Q12 APPROVED)
                        DC-WORLD-OWNS-THE-SURFACE-LIST    (GLOBAL)
                        DC-COMBAT-SHARED-BUDGET 은 무관하다 — 이 층은 자원을 쓰지 않는다

    Constraint Note
        DC-COMBAT-PLAYER-CAUSALITY
            관통은 방어를 **확률로 무시**하는 것이 아니다. 마주한 방어 값을 결정적으로
            깎는다. 같은 능력치·같은 스킬·같은 접촉이면 언제나 같은 피해다.
        DC-COMBAT-ONE-FORMULA
            새 피해 공식을 만들지 않는다. R1 핵심 원칙이 이 층에 배정한 의미는 한 줄이다 —
            `Penetration → Defense 를 감소시킨다`. C010 의 감쇄식
            `100 / (100 + 방어)` 은 형태도 상수도 그대로이며, 그 식이 읽는 **방어 값
            하나**가 바뀔 뿐이다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME
            Penetration 층 하나만 올린다. 능동 방어(완벽한 막기·되받아치기·가드 브레이크)는
            위층이고 R1 §14 · DT §15 가 그 효율을 정하지 않았다. 이 Cycle 은 그것을
            지어내지 않는다.
        DC-COMBAT-MATCHUP-SOFT
            관통은 타입별 배율표가 될 수 없다 (type_bonus_multiplier_table 금지).
            아무리 깎여도 양의 Raw Damage 는 최소 1 이 남는다
            (positive_damage_always_lands_at_least_one). 상성은 여전히 대응 능력치의
            차이에서만 나온다 — 관통은 그 대응을 바꾸지 않고 고른 값만 깎는다.
        DC-WORLD-OWNS-THE-SURFACE-LIST
            깎이기 전 방어와 깎인 뒤 방어를 **세계가 이름과 함께** 관찰에 싣는다.
            보는 이가 피해 숫자의 차이로 관통을 역산하거나 종류 이름으로 짐작하지 않는다.

## SCOPE NOTE — 이 층이 어디에 붙는가, 그리고 초기값을 어떻게 둘 것인가

    작용 지점은 이미 지정되어 있다 (DT R0 §15).

        Physical → Armor Penetration      → Effective Armor
        Aura     → Resistance Penetration → Effective Resistance

        "관통 층은 타입 대응이 끝난 뒤 선택된 방어 능력에만 작용한다.
         관통이 Damage Type 을 바꾸거나 대응하지 않는 방어 능력을 읽어서는 안 된다."

    즉 C012 가 세운 대응 단계는 그대로 두고, 그 단계가 **고른 방어 값 하나**에
    깎는 의미가 붙는다. 계산 앞에 고르는 단계를 하나 더 세우는 것이 아니다.

    포함한다 — 종류별 관통 초기값 분포
        관통이 존재하는데 세계의 누구도 지니지 않으면, 이 층은 디버그 명령을 쳐야만
        보이는 규칙이 된다. Cycle 의 완료 조건은 코드가 아니라 플레이다.
        따라서 관통 두 종의 초기값을 종류별로 정한다 — 기계적 복제도 일괄 0 도 아니다.
        구체적인 값은 Stage 3 이 밸런스로 소유한다.

        이 결정은 대가를 하나 낳는다. 관통을 0 이 아니게 받은 종류는 이전 Cycle 의
        피해 실측값이 달라진다. 그것은 이 층이 세계에 실제로 작용한다는 증거이며,
        Verification 은 "옛 숫자가 그대로다" 가 아니라 **"관통이 0 인 조합에서 옛 숫자가
        그대로다"** 를 Regression 기준으로 삼는다.

    포함하지 않는다 — 양쪽 방어가 모두 두꺼운 새 존재
        MP-PIERCE-THE-HARD-DEFENSE 가 가장 선명해지는 상황("피할 무른 쪽이 없다")은
        새 캐릭터 종류를 만들지 않고 C009 디버그 명령으로 상대의 두 방어를 올려
        만든다. Frontier 의 7조건 3 이 지정한 확인 경로가 그것이다 —
        "두 존재의 관통·방어를 바꿔 보며 Client 에서 확인된다".
        새 종류·새 스킬·새 모션 자산은 이 층의 의미가 아니다.

## TYPE

    Existing Capability Enhancement
        Combat → Penetration. C012 의 타입 대응도 C010 의 감쇄식도 폐기하지 않는다.
        대응이 고른 방어 값에 깎는 의미 하나가 얹힌다.

## TARGET CAPABILITY

    Penetration — 마주한 방어를 얼마간 통하지 않게 만들어 그 방어의 값어치를 떨어뜨린다

## GOAL

    플레이어가 방어를 두껍게 굳혀 버티는 상대 앞에서
    그 방어를 얼마간 통하지 않게 만들어 더 큰 피해를 넣고,
    같은 관통이 무른 상대에게는 거의 의미가 없다는 것을 본다.

## INCLUDED

    관통 능력 두 종        Armor Penetration · Resistance Penetration.
                          존재가 지니는 공격 쪽 능력이다 (C012 의 네 능력치와 같은 자리)
    관통의 대응            타격의 Damage Type 이 고른 방어 쪽의 관통만 작용한다
                          Physical → Armor Penetration · Aura → Resistance Penetration
    Effective Defense     감쇄식이 읽는 방어 값이 "원래 방어" 에서 "관통이 깎은 뒤의
                          방어" 로 바뀐다. 감쇄식 자체와 DefenseConstant 100 은 그대로다
    두께에 비례하는 몫      두껍게 굳힌 상대일수록 깎이는 방어의 몫이 커지고 무른 상대에게는
                          거의 달라지지 않는다 (MP-PIERCE-THE-HARD-DEFENSE · Frontier
                          Observable Result). 이 성질을 만족하는 구체적 형태와 상한은
                          Stage 3 이 정한다
    방어는 사라지지 않는다   관통이 아무리 커도 Effective Defense 는 음수가 되지 않고,
                          양의 Raw Damage 는 최소 1 을 남긴다 (DC-COMBAT-MATCHUP-SOFT)
    관통 초기값 분포        종류별로 정한다 (SCOPE NOTE)
    피해 경위 관찰          타격 기록에 **깎기 전 방어 · 적용된 관통 · 깎은 뒤 방어**가
                          이름과 함께 실린다. 관통이 0 인 타격에서도 무엇이 읽혔는지가
                          모호해지지 않아야 한다
    상대 방어 관찰 확장      C012 가 낸 상대의 Armor · Resistance 관찰에, 내 관통이 그
                          상대에게 무엇을 할 수 있는지가 고르기 전에 읽힌다
                          (DC-COMBAT-MATCHUP-SOFT weakness_is_observable)
    디버그 명령 갱신        변경 가능 속성 목록에 관통 두 종을 더한다 (C009) —
                          Frontier 7조건 3 의 확인 경로다

## EXCLUDED

    DT R0 §13 · §15 가 이 층 밖으로 밀어낸 것을 그대로 제외한다.

    관통이 Damage Type 을 바꾸는 것              DT §15 금지
    대응하지 않는 방어를 관통이 읽는 것            DT §15 금지 (물리 관통이 Resistance 에 닿지 않는다)
    관통 저항 · 관통 무효 · 관통 상한을 지닌 방어   이 층이 세우는 것은 깎는 쪽 하나다
    스킬별 관통 · 장비별 관통 · 조건부 관통       능력치 한 쌍으로 끝낸다
    관통에 따른 새 행동 · 새 모션 · 새 스킬       Frontier — 새 행동도 새 모션 자산도 필요 없다
    막기의 타입별·관통별 효율                    C011 의 막기는 지금처럼 Final Damage 에
                                              타입·관통과 무관하게 걸린다 (DT §15 Active Defense)
    Critical · 명중 / 빗나감 / 회피              층이 다르다 (Critical 은 Q11 미결)
    완벽한 막기 · 되받아치기 · 가드 브레이크       위층 (Active Defense) — 두 문서가 이름만 댄다
    Element · 물리 세부 타입 · 혼합 피해 · 면역    DT §13 이 이미 제외했다
    Aura 배분 · 넨 타입 · 조건 · 제약 · 서약       가장 위층
    양쪽 방어가 모두 두꺼운 새 캐릭터 종류         SCOPE NOTE — 디버그 명령으로 만든다

## RELATED EXISTING CAPABILITY

    재사용
        RULE-DAMAGE-CALCULATE-001   C010 · C012 — 감쇄식 형태와 DefenseConstant 100 유지
        타입 대응                    C012 — 어느 공격·방어 능력을 읽을지 정하는 단계.
                                    관통은 이 단계 **뒤에** 붙는다
        Actor.DefenseShape          C012 — 상대의 어느 쪽이 두꺼운가. MK-OPPONENT-DEFENSE-SHAPE
        RULE-SWING-STRIKE-001       C006 — 누가 맞는지 정하는 판정. 새 명중 판정을 만들지 않는다
        RULE-SKILL-BEGIN-001        C007 — 스킬 시작 조건과 기력 관문
        RULE-ATTRIBUTE-SET-001      C009 — 디버그 명령으로 관통·방어를 바꿔 차이를 만든다
        Observer Projection         C004~C012 — 관찰 계약

    변경 예상
        Actor 의 전투 능력치         네 값 → 여섯 값 (관통 두 종이 더해진다)
        RULE-DAMAGE-CALCULATE-001   대응이 고른 방어 값이 감쇄식에 들어가기 전에 깎인다
                                    (공식 자체는 그대로다)
        DamageBreakdown             깎기 전 방어 · 적용된 관통 · 깎은 뒤 방어가 실린다
        RULE-ATTRIBUTE-SET-001      변경 가능 속성 목록
        캐릭터 카탈로그              rabbit-swordsman · wanderer 의 관통 초기값 (SCOPE NOTE)

    영향 예상
        RULE-GUARD-BLOCK-001        C011 — 막기가 거는 대상(Final Damage)은 그대로다.
                                    관통이 생겨도 막기가 남기는 비율은 달라지지 않아야 한다 (Regression)
        C012 피해 실측값             관통이 0 인 조합에서 C012 의 숫자가 그대로여야 한다 (Regression)
        C010 최소 1 피해             관통이 방어를 크게 깎아도, 방어가 극단으로 높아도 유지된다 (Regression)
        RULE-NPC-DECIDE-001         C007 — 자율 존재도 같은 계약을 쓴다
        상대 방어 관찰 화면           C012 가 낸 표면에 관통 관련 항목이 더해진다
