# CYCLE C012 — Damage Type Chooses the Defense

[PASS] Cycle Definition
[PASS] Intent                    (방식은 스킬이 지닌다 · 오라 스킬 1종 신설)
[PASS] World Semantic            (계산식 무변경 · 앞에 고르는 단계 하나)
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            없음 — `master/frontier.md` 는 2026-08-17 Human 지시로 HOLD 다.
                        Master Layer 가 아직 세워지지 않아 그 파일의 후보·상태 표기가
                        현재 세계와 어긋나 있고, 층 높이를 보지 않아 선택 근거로 쓸 수 없다
                        (CLAUDE.md "현재 상태" 절).
    Source Goal         없음 — 위와 같음
    Source Possibility  없음 — 위와 같음
    Target Capability   없음 (Master 기준) — 아래 TARGET CAPABILITY 는 세계 기준이다

    이번 Cycle Goal 의 출처
        design/Design-Combat-DamageType-R0.md  (Damage Type 층 설계 원본)
        design/Design-Combat-OffenseDefense-R0.md (R1) §14 확장 사다리

        R1 §14 는 Basic Damage → (Critical) → Defense Action → **Damage Type** →
        Penetration → Active Defense → Aura/Nen 순서를 정한다. 아래 두 층이 닫혔고
        (C010 기본 공식 · C011 막기), Critical 층은 DC-COMBAT-PLAYER-CAUSALITY 와
        충돌하여 보류 중이다 (`master/open-questions.md` Q11 — 미결). 따라서 지금
        열 수 있는 가장 낮은 층이 Damage Type 이며, 그 세부 설계가
        `Design-Combat-DamageType-R0.md` 로 도착하여 막힘이 풀렸다.

    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-ONE-LAYER-AT-A-TIME
                        DC-WORLD-OWNS-THE-SURFACE-LIST    (GLOBAL)
                        DC-COMBAT-MATCHUP-SOFT            (DRAFT — 아래 참조)

    Constraint Note
        DC-COMBAT-ONE-FORMULA
            새 피해 공식을 만들지 않는다. 타입은 **같은 공식에 넣을 입력을 고를 뿐**이다.
            물리와 오라가 서로 다른 감쇄식을 갖지 않는다 — 둘 다 C010 의
            `100 / (100 + 대응 방어)` 하나를 쓴다 (설계 §5 · §17).
        DC-COMBAT-PLAYER-CAUSALITY
            난수를 넣지 않는다. Resistance 를 저항 **확률**로 해석하지 않는다
            (설계 §16.3-5). 같은 능력치·같은 스킬·같은 접촉이면 언제나 같은 피해다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME
            Damage Type 층 하나만 올린다. 관통은 다음 층이고(설계 §13 · §15),
            막기의 타입별 효율은 이 문서가 정하지 않는다(설계 §15 Active Defense).
        DC-WORLD-OWNS-THE-SURFACE-LIST
            어떤 스킬이 어떤 타입인지, 상대가 어느 쪽에 약한지를 **세계가 밝힌다.**
            View 가 종류 이름이나 색으로 약점을 추측하지 않는다 (설계 §10 · §16.3-6).
        DC-COMBAT-MATCHUP-SOFT (현재 DRAFT)
            이 Cycle 이 그 Constraint 의 근거 층이다. 설계 §7 이 문안을 이렇게 읽는다 —
            "상성은 별도 피해 배율이 아니라 대응 공격·방어 능력치의 차이로 표현한다."
            면역 없음 · 타입 보너스 배율 없음 · 틀린 타입도 작동함을 지킨다.
            재승인 여부는 Human 의 몫이며 이 Cycle 은 그 판단을 대신하지 않는다.

## SCOPE NOTE — 설계를 그대로 따르면 플레이가 성립하지 않는 지점 하나

    설계 §9 의 이행 규칙은 이렇다.

        기존 Attack  → Physical Attack
        기존 Defense → Armor
        기존 모든 피해 스킬 → Physical

    현재 세계의 피해 스킬은 둘뿐이고(`attack` · `heavy-attack`) 둘 다 이 규칙에 따라
    Physical 이 된다. 그러면 **플레이어가 고를 오라 쪽이 존재하지 않는다.** 이행만 하면
    관찰 결과의 이름만 바뀌고 플레이는 C010 과 완전히 같다 — 이 층이 만드는 것은
    "공식 두 개가 아니라 **선택 하나**" (설계 §17) 인데 그 선택이 생기지 않는다.

    포함한다 — 오라 스킬 1종 신설
        설계 §9 자신이 "Aura Attack 과 Resistance 의 초기값은 **새 Aura 콘텐츠의 밸런스와
        함께** 명시한다" 고 적어 이 층에 오라 콘텐츠가 따라온다는 것을 전제한다.
        수용 기준 §14-2 ("Aura 스킬은 Aura Attack 과 Resistance 만 읽는다") 도
        오라 스킬이 없으면 플레이로 확인할 수 없다.
        새 모션 자산은 필요 없다 — `heavy-attack` 이 이미 `attack` 모션을 함께 쓰고 있다.

    포함하지 않는다 — 오라 스킬을 여러 개 만드는 것
        선택이 성립하는 최소치는 물리 쪽 하나 · 오라 쪽 하나다. 스킬 목록을 늘리는 것은
        이 층의 의미가 아니다.

## TYPE

    Existing Capability Enhancement
        Combat → Damage Type. C010 의 피해 공식을 폐기하지 않고 일반화한다 (설계 §9).
        오라 스킬 1종은 그 선택을 성립시키기 위한 최소 콘텐츠이며 새 Capability 층이
        아니다 — 기존 스킬 구조를 그대로 쓴다.

## TARGET CAPABILITY

    Damage Type — 스킬의 피해 방식이 어떤 공격 능력과 어떤 방어 능력을 읽을지 정한다

## GOAL

    플레이어가 상대의 방어가 어느 쪽으로 치우쳤는지 보고
    물리와 오라 중 유리한 쪽 스킬을 골라 같은 상대에게 더 큰 피해를 낸다.

## INCLUDED

    Damage Type              Physical | Aura — 두 개뿐. 한 타격은 정확히 하나를 가진다
    타입별 공격 능력          Physical Attack · Aura Attack
    타입별 방어 능력          Armor · Resistance
    타입 대응                 Physical → (Physical Attack, Armor)
                             Aura     → (Aura Attack, Resistance)
    공식 일반화               C010 의 하나의 감쇄식이 타입에 따라 입력만 바꿔 받는다
    기존 값 이행              Attack → Physical Attack · Defense → Armor ·
                             기존 스킬 2종 → Physical. 이행 뒤 일반 Attack/Defense 는
                             남기지 않는다 (설계 §9 — 어느 값이 공식의 권위인지 모호해진다)
    오라 스킬 1종             선택이 성립하는 최소 콘텐츠 (SCOPE NOTE)
    Aura Attack · Resistance 초기값
                             종류별 분포를 밸런스로 소유한다 — 기계적 복제도 일괄 0 도 아니다
                             (설계 §9)
    약점 관찰                 상대의 Armor · Resistance 를 **세계가 계산해** 비교 가능하게 낸다
    피해 경위 관찰            타격 기록에 타입 · 선택된 공격 능력 이름과 값 ·
                             선택된 방어 능력 이름과 값이 실린다 (설계 §10)
    디버그 명령 갱신          변경 가능 속성 목록의 attack/defense 자리를 네 값으로 바꾼다 (C009)

## EXCLUDED

    설계 §13 이 제외한 것 전부를 그대로 제외한다.

    Element (Fire / Ice / Lightning …) · 속성 상성표
    물리 세부 타입 (Slash / Pierce / Blunt)
    한 타격의 혼합·분할 피해
    면역 (양의 Raw Damage 는 방어가 아무리 높아도 최소 1)
    지속 피해 · 회복 타입
    Critical · 명중 / 빗나감 / 회피
    Armor Penetration · Resistance Penetration      ← 다음 층
    타격 도중의 타입 전환
    Aura 배분 · 넨 타입 · 조건 · 제약 · 서약        ← 가장 위 층

    이 Cycle 이 특별히 손대지 않는 것 두 가지도 못박는다.

    막기의 타입별 효율      C011 의 막기는 지금처럼 Final Damage 에 타입과 무관하게 걸린다.
                           설계 §15 가 "능동 방어가 Damage Type 을 읽을 수 있지만 이 문서는
                           그 효율을 정하지 않는다" 고 명시했다. 읽게 만들지 않는다.
    Scaling Stat 분리       "오라 공격력으로 강해지는 물리 충격" 같은 예외를 만들지 않는다.
                           타입이 공격 능력과 방어 능력을 함께 고른다 (설계 §16.2 — 의도적 제약).

## RELATED EXISTING CAPABILITY

    재사용
        RULE-DAMAGE-CALCULATE-001   C010 — 공식 형태와 DefenseConstant 100 을 유지한다
        RULE-SWING-STRIKE-001       C006 — 누가 맞는지 정하는 판정. 새 명중 판정을 만들지 않는다
        RULE-SKILL-BEGIN-001        C007 — 스킬 시작 조건과 기력 관문
        RULE-SKILL-BUDGET-001       C007 — 기력 수지
        RULE-ATTRIBUTE-SET-001      C009 — 디버그 명령으로 능력치를 바꿔 차이를 만든다
        Observer Projection         C004~C011 — 관찰 계약

    변경 예상
        Actor 의 전투 능력치        attack · defense 두 값 → 네 값
        SkillDefinition             damageType 을 가진다
        RULE-DAMAGE-CALCULATE-001   타입으로 입력 두 개를 고르는 단계가 앞에 붙는다
                                    (공식 자체는 그대로다)
        DamageBreakdown             선택된 능력치의 이름과 값이 실린다
        RULE-ATTRIBUTE-SET-001      변경 가능 속성 목록

    영향 예상
        RULE-GUARD-BLOCK-001        C011 — 막기가 거는 대상(Final Damage)은 그대로다.
                                    타입이 생겨도 막기 결과가 달라지지 않아야 한다 (Regression)
        RULE-NPC-DECIDE-001         C007 — 자율 존재도 같은 계약을 쓴다 (설계 §16.3-7)
        캐릭터 카탈로그             rabbit-swordsman · wanderer 의 능력치 분포
