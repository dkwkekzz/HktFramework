# CYCLE C015 — Critical Amplifies the Blow

[PASS] Cycle Definition
[PASS] Intent                    (흔들림은 계산 밖에 선다 · 대가는 세계가 지닌 원천)
[PASS] World Semantic            (계산 무변경 · 판정은 계산과 막기 사이 · 두 끝은 결정론)
[PASS] GameView Specification    (커지기 전과 뒤를 나란히 · 흔들림의 뿌리는 싣지 않는다)
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-CRITICAL-AMPLIFIES-THE-BLOW   (2026-08-19 Human Select)
    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT
                        "정면으로 자원을 맞바꾸는 것만으로는 넘을 수 없는 상대가
                         더 이상 앞을 막지 못한다"
    Source Possibility  MP-BET-ON-THE-CRITICAL-BLOW
                        "다른 모든 경로가 확실한 결과를 쌓는 데 비해, 이것은 확률적으로
                         터지는 큰 증폭에 기대를 건다. 준비(Critical 확률·증폭을 키우는
                         성장·장비)로 기대값을 올리되 개별 결과는 확률이 정한다 —
                         전투 전체에서 유일하게 분산(variance)이 축인 경로다"
    Target Capability   MC-CRITICAL-STRIKE        (overlay: MISSING — 이번 Cycle 의 유일한 결손)
                        "공격이 확률적으로 더 크게 증폭되어 터진다. 발생 확률과 증폭 크기는
                         Actor 의 성질이며 성장·장비로 자란다. Critical 발생 여부와 그 증폭은
                         계산 경위에 그대로 드러난다"
    Reused Capability   MC-COMBAT-STRIKE          (overlay: IMPLEMENTED — C007 · C010)
                        MC-ATTACK-POWER           (overlay: IMPLEMENTED — C010)
                        MC-DEFENSE-MITIGATION     (overlay: IMPLEMENTED — C010)
                        MC-ATTACK-ARMOR-MATCHUP   (overlay: IMPLEMENTED — C012)
                        MC-PENETRATION            (overlay: IMPLEMENTED — C013)

    층 위치 — 저장소 Cycle 번호는 설계의 층 번호와 다르다. 층은 번호가 아니라 이름으로
    가리킨다 (R1 §14 주석). 이 Cycle 은 R1 §14 의 **Critical 층**이다 (그 문서에서는
    "C011 — Critical" 로 적혀 있다). 이 층은 순서상 Penetration 층보다 아래였으나
    Q11 미결로 건너뛰어져 있었고, 2026-08-19 Q11(b) 로 유보가 닫히며 열렸다.
    아래 층 넷은 닫혀 있다 — C010 기본 공식 · C011 막기 · C012 Damage Type ·
    C013 관통. 마지막으로 닫힌 전투 층(C013)은 Human Play 확인까지 COMPLETE 다.
    C014(살펴봄)는 전투 사다리가 아니라 탐험 사다리의 첫 칸이므로 이 층의 전제가 아니다 —
    다만 그 살펴봄 관문이 이 층의 관찰 표면에 걸린다 (아래 SCOPE NOTE 3).

    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY        (status: REVISED — 2026-08-19 Q11(b))
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-ONE-LAYER-AT-A-TIME
                        DC-WORLD-OWNS-THE-SURFACE-LIST    (GLOBAL)
                        DC-COMBAT-MATCHUP-SOFT 는 무관하다 — 이 층은 타입 대응을 건드리지 않는다
                        DC-COMBAT-SHARED-BUDGET 은 무관하다 — 이 층은 자원을 쓰지 않는다

    Constraint Note
        DC-COMBAT-PLAYER-CAUSALITY (REVISED)
            이 Cycle 은 그 REVISED 가 명시한 **단일 예외**를 세계에 세운다. 예외는
            Critical 하나뿐이며 명중·회피·피해량의 난수 금지(random_hit · random_evade ·
            random_damage)는 그대로 진다. 예외를 받는 대가로 두 가지가 강제된다 —
            발생 확률이 관찰에 실려야 하고(observable_cause), 발생 여부와 증폭이
            계산 경위에 그대로 남아야 한다(explainable_result). 확률이 0 이거나 1 인
            구간에서는 세계가 다시 완전히 결정론적이어야 한다 — 그것이 이 예외가
            정확히 한 자리에만 뚫려 있다는 증거다.
        DC-COMBAT-ONE-FORMULA
            새 피해 공식을 만들지 않는다. R1 핵심 원칙이 이 층에 배정한 의미는 한 줄이다 —
            `Critical → Final Damage 를 증폭한다`. C010 의 감쇄식 `100 / (100 + 방어)` 도
            C012 의 타입 대응도 C013 의 걷어내기도 형태·상수 그대로이며,
            그 계산이 **내놓은 값**에 증폭 하나가 얹힌다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME
            Critical 층 하나만 올린다. 능동 방어(완벽한 막기·되받아치기·가드 브레이크)와
            Aura / Nen 은 위층이고 두 근거 문서가 이름만 예고한다 — 지어내지 않는다.
            아래 층인 관통(C013)이 Human Play 확인까지 닫힌 뒤이므로
            verify_current_layer_before_next 를 만족한다.
        DC-WORLD-OWNS-THE-SURFACE-LIST
            Critical 성질(확률·증폭)과 한 타격의 Critical 여부·배율을 **세계가 이름과
            함께** 관찰에 싣는다. 보는 이가 피해 숫자가 튄 것을 보고 Critical 을
            역산하거나, 몇 %인지를 자기 코드에 적어 두지 않는다. 바꿀 수 있는 속성
            목록(C009)에도 세계가 두 성질을 더한다.

## SCOPE NOTE

### 1. 세계에 처음으로 우연이 들어온다 — 그 원천을 세계가 소유한다

    지금까지 이 세계에는 난수원이 한 곳도 없다. 같은 입력이면 언제나 같은 결과였고
    (R1 §6 · §9), 그래서 시뮬레이션 전체가 재현 가능했다. 이 Cycle 은 그 성질에
    **정확히 한 구멍**을 뚫는다.

    구멍을 뚫되 세계 밖의 우연을 끌어오지 않는다. 판정에 쓰이는 우연의 원천은
    **세계가 지니는 상태**여야 한다 — World Authority 이자, 서버·테스트·재생이
    같은 세계를 같은 순서로 굴리면 같은 결과에 도달할 수 있게 하는 조건이다.
    Client 는 이 원천을 읽지도 소비하지도 못한다.

    구체적인 형태(원천의 상태, 소비 시점, 관찰에 무엇이 실리는가)는 Stage 3 이 소유한다.
    Stage 1 이 고정하는 것은 경계 하나다 — **우연은 세계의 것이고, 한 자리에서만 소비된다.**

### 2. 증폭이 붙는 자리와 막기와의 순서

    작용 지점은 근거 문서가 이미 지정했다 (R1 핵심 원칙).

        Critical → Final Damage 를 증폭한다
        Guard    → Final Damage 를 감소시킨다

    둘 다 Final Damage 에 걸리므로 **순서가 결과를 가른다**. 게다가 C011 의 막기 대가는
    감쇄 **전** 값으로 매겨진다 (`GUARD_CP_PER_DAMAGE`) — 증폭이 그 앞에 서면 크게 터진
    한 방을 막는 데 드는 기력도 함께 커지고, 뒤에 서면 그렇지 않다. 어느 쪽이든 이 층이
    막기의 의미를 바꾸게 되므로 순서는 이 Cycle 이 명시적으로 정해야 할 결정이다.

    포함한다 — 그 순서와 그것이 막기에 무엇을 하는가. 값과 판정 형태는 Stage 3 이 소유한다.
    포함하지 않는다 — 막기 자체의 Critical 저항·Critical 전용 효율. 그것은 능동 방어 층이다.

### 3. Critical 성질은 C014 의 살펴봄 관문 뒤에 놓인다

    C014 가 세운 규칙은 "남의 겨루는 힘은 살펴본 뒤에만 관찰에 실린다" 이고,
    가려지는 항목의 단일 출처는 세계에 있다 (`CONCEALABLE_ATTRIBUTE_KEYS`).
    Critical 두 성질은 겨루는 힘이므로 그 관문 **안쪽**에 들어간다 — 남의 것은
    살펴본 뒤에 보이고, 내 것은 언제나 보인다.

    이것은 새 관문을 만드는 것이 아니라 이미 있는 관문이 덮는 값이 늘어나는 것이다.
    가려지는 항목 이름 목록(`combatStats` 등 셋)은 변하지 않는다.

    다만 **이미 벌어진 타격의 결과**는 관문 뒤가 아니다. StrikeEvent 는 세계가 판정을
    마치고 내놓은 사실이며 C007 이래 모두에게 보인다 — 모르는 상대에게 크게 터졌다는
    것은 보이고, 그 상대가 얼마나 자주 터뜨리는 몸인지는 살펴봐야 안다.

### 4. 성질을 어떻게 올리는가 — 이번 Cycle 이 닫는 것과 남기는 것

    Frontier 의 Playable Result 는 "성장·장비로 그 확률과 증폭을 키워" 라고 적지만,
    Possibility 의 `requires.resource` 인 **"Critical 성질을 올릴 성장·장비의 원천"** 은
    지금 세계에 없다. 이 Cycle 의 결손은 MC-CRITICAL-STRIKE 하나뿐이므로 (Frontier —
    Missing / Partial) 그 원천을 여기서 지어내지 않는다.

    따라서 이번 Cycle 이 닫는 것은 **"터질 수 있는 몸이 존재하고, 그 성질을 올리면
    빈도와 크기가 실제로 달라진다"** 까지다 — Frontier 의 Observable Result 가 정확히
    거기까지다. 성질을 바꾸는 경로는 종류별 초기값과 C009 디버그 명령이며,
    이는 C013 이 관통에서 취한 것과 같은 형태다.

    그 결과 C013 과 같은 부채가 남는다 — 플레이어가 "터지는 몸을 만들기 위해 무언가를
    한다" 는 선택이 아직 없다. 이것은 이 Cycle 의 실패가 아니라 다음 후보이며,
    Stage 8 의 MASTER FEEDBACK 으로 위층에 보고한다 (C013 이 FR-EARN-THE-PIERCING 을
    남긴 것과 같은 자리다).

### 5. 초기값을 어떻게 둘 것인가

    Critical 이 존재하는데 세계의 누구도 지니지 않으면 이 층은 디버그 명령을 쳐야만
    보이는 규칙이 된다. Cycle 의 완료 조건은 코드가 아니라 플레이다.
    따라서 두 성질의 초기값을 종류별로 정한다 — 일괄 0 도 기계적 복제도 아니다.
    Critical 을 지니는 쪽은 **플레이어**여야 한다 — Cycle Goal 의 주어가 플레이어이고,
    관찰자의 몸은 rabbit-swordsman 이다 (RULE-OBSERVER-JOIN-001). 구체적인 값은
    Stage 3 이 밸런스로 소유한다.

    이 결정은 C013 과 같은 대가를 낳는다 — Critical 확률이 0 이 아닌 종류가 내는
    피해는 더 이상 매번 같지 않다. 그것이 이 층이 실제로 작용한다는 증거이며,
    Verification 은 "옛 숫자가 그대로다" 가 아니라 **"Critical 이 나지 않은 타격에서
    옛 숫자가 그대로다"** 와 **"확률 0 으로 두면 이전 Cycle 의 실측이 한 톨도 다르지
    않다"** 를 Regression 기준으로 삼는다.

## TYPE

    Existing Capability Enhancement
        Combat → Critical. C010 의 공식도 C012 의 타입 대응도 C013 의 걷어내기도
        폐기하지 않는다. 그 계산이 내놓은 결과값에 증폭 하나가 얹힌다.

## TARGET CAPABILITY

    Critical — 공격이 확률적으로 더 크게 증폭되어 터진다

## GOAL

    플레이어가 같은 상대를 같은 스킬로 거듭 칠 때
    대부분은 늘 같은 피해가 나오다 이따금 크게 증폭된 한 방이 터지는 것을 보고,
    자기 몸의 Critical 성질을 올려 그 빈도와 크기를 실제로 키운다.

## INCLUDED

    Critical 성질 두 종     Critical Chance (터질 확률) · Critical Damage (터졌을 때의 증폭).
                          존재가 지니는 공격 쪽 능력이다 (C010 의 공격력, C013 의 관통과
                          같은 자리). 모든 Actor 가 지니며 값 0 이 "없음" 이다
    우연의 원천            판정에 쓰이는 우연을 세계가 소유한다. Client 는 읽지도 소비하지도
                          못한다. 형태는 Stage 3 (SCOPE NOTE 1)
    Critical 판정          한 타격에 정확히 한 번 일어난다. 판정의 입력은 공격자의
                          Critical Chance 뿐이다 — 대상의 어떤 값도 이 판정을 바꾸지 않는다
    Final Damage 증폭      터진 타격은 공식이 내놓은 Final Damage 가 Critical Damage 만큼
                          커진다. 공식 자체(감쇄식 · 타입 대응 · 걷어내기)는 무변경
    막기와의 순서          증폭과 막기 감쇄 중 무엇이 먼저인가, 그리고 그것이 막기의 기력
                          대가에 무엇을 하는가 (SCOPE NOTE 2). 값은 Stage 3
    경계에서의 결정론 복귀   확률 0 이면 언제나 터지지 않고 확률 1 이면 언제나 터진다 —
                          두 끝에서 세계는 다시 완전히 결정론적이다 (Constraint Note)
    Critical 초기값 분포    종류별로 정한다. 지니는 쪽은 플레이어다 (SCOPE NOTE 5)
    피해 경위 관찰          타격 기록에 **터졌는가 · 그때 쓰인 확률 · 적용된 배율 ·
                          증폭 전 값과 증폭 후 값**이 이름과 함께 실린다. 터지지 않은
                          타격에서도 무엇이 읽혔는지가 모호해지지 않아야 한다
                          (explainable_result)
    내 Critical 관찰       자기 두 성질이 늘 화면에 있다 — 바꾼 직후 그 변화가 즉시 읽힌다
    상대 Critical 관찰      C014 의 살펴봄 관문 뒤에서 상대의 두 성질이 실린다 (SCOPE NOTE 3).
                          저 존재가 얼마나 자주 크게 터뜨리는지는 내가 얼마나 위험한지를
                          아는 일이다
    디버그 명령 갱신        변경 가능 속성 목록에 Critical 두 성질을 더한다 (C009) —
                          Frontier 7조건 3 의 확인 경로이자 SCOPE NOTE 4 의 성질 변경 경로다

## EXCLUDED

    R1 §6 · §13 과 DT §13 · §15 가 이 층 밖으로 밀어낸 것을 그대로 제외한다.

    명중 / 빗나감 / 회피의 확률            R1 §6 금지 · REVISED 가 유지한 세 금지 중 둘.
                                        닿았으면 맞는다는 규칙은 그대로다
    피해량 자체의 난수 (Random Damage)     REVISED 가 유지한 세 번째 금지. 흔들리는 것은
                                        피해값이 아니라 "터졌는가" 라는 판정 하나다
    Critical 저항 · 무효 · 확률 감소        이 층이 세우는 것은 터뜨리는 쪽 하나다.
                                        대상의 값이 판정에 끼어들면 그 순간 이 층은
                                        상성표가 된다 (DC-COMBAT-MATCHUP-SOFT 의 정신)
    스킬별 · 장비별 · 조건부 Critical       성질 한 쌍으로 끝낸다 (C013 이 관통에서 한 것과 같다)
    성장 · 장비 시스템 자체                SCOPE NOTE 4 — 결손이 아니다. 다음 후보다
    Critical 이 여는 새 행동 · 새 스킬      Frontier — 새 행동도 새 모션 자산도 필요 없다
    Critical 전용 모션 자산                기존 타격 모션 위에서 읽힌다. 새 모션 시트를
                                        만들지 않는다 (View 표현의 형태는 Stage 4·7)
    연속 Critical · 확정 Critical 보정      "몇 번 안 터지면 다음이 터진다" 류의 보정은
                                        판정을 둘로 만든다. 판정은 하나다
    자율 존재의 Critical 운용 판단          RULE-NPC-DECIDE-001 은 그대로다 — 자율 존재도
                                        같은 규칙으로 터뜨리되, 그것을 노리고 고르지 않는다
    완벽한 막기 · 되받아치기 · 가드 브레이크   위층 (Active Defense) — 두 문서가 이름만 댄다
    Aura 배분 · 넨 타입 · 조건 · 제약 · 서약  가장 위층
    Element · 혼합 피해 · 면역              DT §13 이 이미 제외했다

## RELATED EXISTING CAPABILITY

    재사용
        RULE-DAMAGE-CALCULATE-001   C010 · C012 · C013 — 감쇄식 · 타입 대응 · 걷어내기 전부
                                    무변경. 증폭은 이 계산이 내놓은 값에 걸린다
        RULE-STRIKE-DAMAGE-001      C007 · C010 · C011 — 계산과 막기를 이어 붙이고 결과를
                                    세계에 남기는 자리. 증폭이 끼어드는 곳이 여기다
        RULE-SWING-STRIKE-001       C006 — 누가 맞는지 정하는 판정. 새 명중 판정을 만들지 않는다
        RULE-ATTRIBUTE-SET-001      C009 — 디버그 명령으로 Critical 성질을 바꿔 차이를 만든다
        World.Acquaintances         C014 — 상대 성질을 가리는 관문. 새 관문을 만들지 않는다
        Observer Projection         C004~C014 — 관찰 계약

    변경 예상
        Actor 의 전투 능력치         여섯 값 → 여덟 값 (Critical 두 성질이 더해진다)
        WorldState                  우연의 원천이 세계 상태에 더해진다 (SCOPE NOTE 1)
        RULE-STRIKE-DAMAGE-001      공식의 결과값에 증폭 판정이 한 번 걸린다
        DamageBreakdown             터졌는가 · 쓰인 확률 · 배율 · 증폭 전후 값이 실린다
        RULE-ATTRIBUTE-SET-001      변경 가능 속성 목록
        캐릭터 카탈로그              rabbit-swordsman · wanderer 의 Critical 초기값 (SCOPE NOTE 5)
        상대 관찰 combatStats        C014 관문 안쪽에 두 성질이 더해진다

    영향 예상
        RULE-GUARD-BLOCK-001        C011 — 막기가 거는 대상(Final Damage)이 증폭될 수 있게
                                    된다. 막기가 남기는 비율과 기력 대가의 의미가 흔들리지
                                    않아야 한다 (SCOPE NOTE 2 · Regression)
        C010 · C012 · C013 실측값     Critical 이 나지 않은 타격에서, 그리고 확률 0 에서
                                    옛 숫자가 그대로여야 한다 (Regression)
        C010 최소 1 피해             증폭이 붙어도 하한의 의미가 깨지지 않는다 (Regression)
        RULE-NPC-DECIDE-001         C007 — 자율 존재도 같은 계약을 쓴다. 판단은 그대로다
        시뮬레이션 재현성            세계를 같은 순서로 굴리면 같은 결과에 이르는 성질이
                                    유지되어야 한다 (SCOPE NOTE 1)
        상대 관찰 화면               C014 가 낸 표면에 Critical 항목이 더해진다
