# C019 — World Semantic

> 이 Cycle 은 세계에 **저장되는 상태를 거의 더하지 않는다.** 구간은 이미 있는 진행도에서
> 파생되고, 캔슬은 이미 있는 피격 규칙이 시점을 묻게 되는 것이며, 새로 저장되는 것은
> 관찰을 위한 사건 목록 하나뿐이다. 더해지는 것의 대부분은 **기술이 지닌 값 둘**이다.

## SEMANTIC DELTA

    REUSED
        Actor.CurrentAction (Kind · Elapsed · Duration)      C002
        Actor.ActionProgress (파생 0..1)                      C002
        Actor.Cp · CpMax · Modifiers                          C007 · C011
        Actor.Control (autonomous)                            C002
        SkillDefinition (BaseDuration · BaseDamage · …)        C007 · C010 · C012
        ActionCollider (파생 — 칼끝의 자리와 활성 여부)          C006
        World.StrikeEvents · World.UnharmedContacts            C007 · C018
        STRIKE_EVENT_TTL                                      C007
        RULE-STANCE-001 · RULE-HARM-GATE-001                  C018
        RULE-STRIKE-DAMAGE-001 · RULE-DAMAGE-CALCULATE-001    C007 · C010 (한 글자도 닿지 않는다)

    ADDED
        SkillDefinition.SwingBegin · SkillDefinition.SwingEnd   기술마다 다른 구간 경계
        Actor.ActionPhase (파생 — startup | active | recovery)  저장하지 않는다
        World.CancelEvents                                     캔슬 사건 목록 (관찰용)
        RULE-SKILL-PHASE-001                                   구간 판정 (파생)
        RULE-SKILL-CANCEL-001                                  선딜 중 피격이 기술을 무산시킨다

    CHANGED
        RULE-HIT-001                    피격이 처음으로 **시점을 묻는다**
        RULE-NPC-DECIDE-001             자율 존재가 큰 기술도 고른다
        RULE-STRIKE-EVENT-EXPIRE-001    캔슬 사건도 같은 수명을 가진다
        SWING_BEGIN · SWING_END         전역 상수 → 기술 성질의 **기본값**으로 물러난다

    AFFECTED
        RULE-SWING-STRIKE-001           호출하는 RULE-HIT-001 의 결과가 갈린다.
                                        이 Rule 자체의 문장은 바뀌지 않는다
        ActionCollider                  구간 경계를 기술에서 읽는다. 기하(호·반경)는 그대로
        Actor.Modifiers (HIT_CHARGE_FACTOR)
                                        판정 구간에서 맞으면 hit 이 오지 않으므로 충전 억제도
                                        오지 않는다 — 아래 BALANCE ③
        RULE-SKILL-BUDGET-001           무변경. 캔슬된 기술이 정산되지 않는 것은 이 규칙이
                                        이미 "첫 타격에서만 정산한다" 이기 때문이다

## WORLD STATE

    SkillDefinition.SwingBegin        Authority: World (정적 정의)
        그 기술의 **선딜이 끝나는 지점**. 행동 진행도(0..1)의 비율이다.
        이 지점부터 그 기술의 효과가 성립하기 시작한다.

    SkillDefinition.SwingEnd          Authority: World (정적 정의)
        그 기술의 **판정이 끝나는 지점**. 이 지점부터 끝까지가 후딜이다.

        지금까지 두 값은 모든 기술이 공유하는 전역 상수였다 (0.25 · 0.75).
        이제 기술마다 지닌다 — 값은 아래 BALANCE ① 이 정한다.
        결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.

    Actor.ActionPhase                 Authority: World (파생 — 저장하지 않는다)
        진행 중인 기술이 지금 어느 구간에 있는가. startup | active | recovery.
        기술이 아닌 행동에는 존재하지 않는다 (진행도만 가진다).
        CurrentAction 과 SkillDefinition 에서 매번 계산되므로 어긋날 수 없다.

    World.CancelEvents                Authority: World
        방금 일어난 캔슬들. 항목 하나는 { 끊은 자 · 끊긴 자 · 끊긴 기술 · 자리 · 시각 }.
        StrikeEvents · UnharmedContacts 와 **나란한 자리**이며 같은 수명을 가진다.
        셋은 섞이지 않는다 — 셋이 답하는 질문이 다르다 (OBSERVABLE 절).

## WORLD RULE

    RULE-SKILL-PHASE-001 (ADDED)
        Implements     INTENT-SKILL-PHASE-001
        Input          Actor
        Preconditions  없음 — 어떤 Actor 에게도 답이 있다
        Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
        Result         none        CurrentAction 이 기술이 아니다
                       startup     ActionProgress < Skill.SwingBegin
                       active      Skill.SwingBegin <= ActionProgress < Skill.SwingEnd
                       recovery    Skill.SwingEnd <= ActionProgress

        경계는 **기술에서 읽는다.** 전역 상수를 쓰지 않는다 — 그래야 기술마다 다른
        선딜이 성립한다.

        ActionCollider 의 활성 구간(C006)과 **같은 경계를 쓴다.** 두 곳이 각자
        경계를 갖는 순간 "칼날이 지나는 중인데 아직 선딜" 같은 어긋남이 생긴다.
        칼끝이 활성인 구간이 곧 active 다.

    RULE-SKILL-CANCEL-001 (ADDED)
        Implements     INTENT-CANCEL-IN-STARTUP-001 · INTENT-CANCEL-COSTS-THE-CHANCE-001 ·
                       INTENT-CANCEL-IS-OBSERVABLE-001
        Input          해를 입은 Actor (끊긴 자), 해를 입힌 Actor (끊은 자)
        Preconditions  RULE-SKILL-PHASE-001(끊긴 자) = startup
        Transition     CurrentAction = hit (그 기술은 사라진다),
                       World.CancelEvents += { 끊은 자 · 끊긴 자 · 끊긴 기술 · 자리 · 시각 }
        Result         Cancelled(기술) | NotApplicable

        캔슬된 기술은 판정 구간에 이르지 못하므로 **그 기술의 피해 산정이 한 번도
        일어나지 않는다.** 피해 0 을 만드는 것이 아니라 사건 자체가 없다
        (DC-COMBAT-ONE-FORMULA — 공식에 닿지 않는다).

        기력 수지도 정산되지 않는다. 별도 처리가 필요 없다 —
        RULE-SKILL-BUDGET-001 이 **첫 타격에서만** 정산하므로, 타격이 없었던 기술은
        애초에 정산된 적이 없다. 끊긴 쪽이 잃는 것은 치른 값이 아니라
        **벌지 못한 몫과 쓴 시간**이다 (INTENT-CANCEL-COSTS-THE-CHANCE-001).

        이 Rule 은 **해가 성립한 뒤에만** 불린다 — RULE-HARM-GATE-001 이 거절한 접촉은
        여기까지 오지 않는다 (C018). 닿았으나 아무 일도 없었던 접촉은 아무것도 끊지 못한다.

        판정에 들어가는 것은 **시점 하나**다. 확률도, 몸의 종류도, 기술의 종류도,
        피해의 크기도 들어가지 않는다 (DC-COMBAT-PLAYER-CAUSALITY).

    RULE-HIT-001 (CHANGED)
        Implements     INTENT-HIT-REACTION-001 (CHANGED)
        Input          타격받은 Actor, 타격한 Actor
        Preconditions  없음 — 피격은 여전히 상대의 사정을 묻지 않는다
        Transition     RULE-SKILL-PHASE-001(대상) 에 따라 갈린다
                           startup            RULE-SKILL-CANCEL-001 (기술이 사라지고 hit)
                           active | recovery  **아무것도 하지 않는다** — 그 기술은 끝까지 간다
                           none               CurrentAction = hit (지금과 같다)
        Result         Cancelled | Uninterrupted | Struck

        바뀌는 것은 **맞은 것이 하던 기술을 지우는가**뿐이다. 맞은 사실 · 피해 산정 ·
        밀려남은 이 Rule 밖에서 일어나며 셋 다 그대로다 (RULE-SWING-STRIKE-001).

        `Uninterrupted` 는 세계의 새 사건이 아니라 **아무 일도 하지 않았다는 결과**다.
        이미 나간 칼은 멈추지 않는다.

    RULE-NPC-DECIDE-001 (CHANGED)
        Implements     INTENT-NPC-AUTONOMY-001 (CHANGED)
        Input          Control = autonomous 인 Actor, 세계의 다른 Actor 들
        Preconditions  지금과 같다 (대체 가능한 행동 중 · 쓰러지지 않음 · 사냥감 인지)
        Transition     사냥감이 사거리 안이면 **기술을 고른다**
                           Cp >= 큰 기술의 CpCost      heavy-attack
                           그 밖                        attack
                       그 밖의 갈래(쫓기 · 순회)는 지금과 같다
        Result         Decided(ActionKind) | Unchanged

        고르는 기준은 **지금 치를 수 있는가** 하나다. 패턴도, 국면도, 남은 생명도,
        상대가 무엇을 하는지도 보지 않는다 — 이 Cycle 이 여는 것은 "큰 기술을 건다"
        이지 판단 구조가 아니다 (01 EXCLUDED).

        기본 기술은 소모 없이 충전하고 큰 기술은 크게 소모하므로(C007 의 수지),
        자율 존재는 **모았다가 크게 걸고 다시 모으는** 흐름을 스스로 만든다.
        그 흐름이 곧 플레이어가 노릴 구간을 만든다 — 지어낸 주기가 아니라
        이미 있는 자원 규칙의 결과다.

    RULE-STRIKE-EVENT-EXPIRE-001 (CHANGED)
        Implements     INTENT-CANCEL-IS-OBSERVABLE-001
        Input          World.StrikeEvents · World.UnharmedContacts · World.CancelEvents
        Preconditions  World.Time - 항목.Time > STRIKE_EVENT_TTL
        Transition     해당 항목을 제거한다
        Result         Expired(count)

        수명 규칙을 셋으로 나누지 않는다 (C018 이 둘로 나누지 않은 것과 같은 이유).

## OBSERVABLE SEMANTIC

    Entity.ActionPhase                          (ADDED)
        진행 중인 기술의 구간. startup | active | recovery. 기술이 아니면 실리지 않는다.
        **세계가 판정한 값이다** — 보는 쪽이 progress 와 경계로 계산하지 않는다
        (DC-WORLD-OWNS-THE-SURFACE-LIST). 경계가 기술마다 다르므로, 보는 쪽이 그것을
        복제하면 두 개의 진실이 생긴다 (C012 defenseShape · C013 versusObserver 와 같은 자리).

        가려지지 않는다. 살펴봄이나 통찰의 관문 뒤에 있지 않다 —
        가리면 끊는 판단 자체가 성립하지 않는다.

        모든 존재에 같은 규칙으로 실린다. 자기 것도 남의 것도 같다.

    World.CancelEvents                          (ADDED)
        { 끊은 자 · 끊긴 자 · 끊긴 기술 · 자리 · 시각 }.
        세 사건이 각자 답하는 질문이 다르므로 한 자리에 섞지 않는다.

            StrikeEvent        닿았고 해가 성립했다 — 피해 산정 경위를 지닌다
            UnharmedContact    닿았으나 관계가 허락하지 않았다 — 산정이 없다 · 사유가 있다
            CancelEvent        맞은 쪽이 하려던 것이 없던 일이 되었다 — 산정이 없다

        캔슬은 StrikeEvent 와 **함께** 온다. 끊은 타격 자체는 해가 성립한 사건이므로
        피해도 들어가고 경위도 실린다. 둘은 같은 순간의 다른 두 사실이다.

    Skill.Profile.SwingBegin · SwingEnd         (ADDED — 기존 profile 에 두 값)
        쓰기 전에 알 수 있어야 하는 값에 구간 경계가 더해진다 (C007 → C012 의 자리).
        "이 기술은 얼마나 오래 준비하는가" 를 고르기 전에 안다.

    Entity.State · Entity.Progress              (REUSED)
        지금과 같다. ActionPhase 가 그 옆에 선다 — 대체하지 않는다.

    Entity.Vitality (Cp)                        (REUSED)
        자율 존재가 큰 기술을 걸 수 있는지가 이 값에서 읽힌다. 이미 실린다.

## BALANCE

### ① 구간 값 — 무엇을 얼마로 두는가

        기술            길이     SwingBegin        SwingEnd        선딜 실시간
        attack          0.6     0.25 (그대로)      0.75 (그대로)    0.15초
        aura-strike     0.6     0.25 (그대로)      0.75 (그대로)    0.15초
        heavy-attack    0.9     **0.50**          **0.85**        **0.45초**

    기본 기술 둘은 **한 톨도 바뀌지 않는다.** C012 가 "기본과 오라는 모든 값이 같고
    방식만 다르다" 를 일부러 지켰으므로 여기서도 갈라놓지 않는다. 그래서 지금까지의
    전투 감각은 그대로 남고, 새로 생기는 것은 **큰 기술 하나의 무게**다.

    큰 기술의 선딜 0.45초는 사람이 보고 반응할 수 있는 길이다 (기본 기술의 0.15초는
    아니다 — 01 SCOPE NOTE ②). SwingEnd 를 0.85 로 늦춰 판정 구간을 0.315초로 두었다 —
    0.75 를 그대로 두면 판정이 0.225초로 좁아져, 선딜을 길게 한 대가가 "칼이 잘 안 맞는다"
    로 나타난다. 후딜 0.135초는 남긴다: 나간 뒤에도 잠깐은 묶여야 큰 기술이 무겁다.

    **크게 걸수록 오래 준비하고 크게 잃는다** 가 값으로 성립한다 —
    큰 기술은 순수지 -22 를 벌지 못하고 0.45초를 버린다.

### ② 자율 존재의 흐름

    큰 기술의 CpCost 는 30, 기본 기술은 한 번 맞힐 때마다 12 를 충전한다.
    그래서 자율 존재는 기본 기술 서너 번마다 한 번 큰 기술을 건다 — 지어낸 주기가
    아니라 C007 수지의 결과다. 플레이어에게는 "가끔 크게 온다" 로 보인다.

### ③ 판정 구간 피격에는 충전 억제가 오지 않는다 — 받아들인다

    지금 충전 억제(HIT_CHARGE_FACTOR)는 "현재 행동이 hit 인가" 로 판정한다.
    판정 구간에서 맞으면 hit 이 오지 않으므로 그 억제도 오지 않는다.

    새 타이머를 만들어 억제를 따로 유지하지 않는다. 이 세계는 "기존 상태를 그대로 쓰고
    새 타이머를 만들지 않는다" 를 지켜 왔고(C007), 여기서 어기면 조건의 출처가 하나 늘면서
    MC-CONDITION-STACKING 의 결손을 이 Cycle 이 임의로 건드리게 된다.

    의미로도 일관된다 — 칼을 휘두르는 중인 몸은 움찔하지 않았고, 움찔하지 않았으니
    기력이 덜 모이지도 않는다. 대신 그 몸은 **끊을 기회를 상대에게 주지 않은 것**이므로
    이득이 한쪽으로 쏠리지 않는다.

### ④ 캔슬은 연쇄를 만들지 않는다

    캔슬된 쪽은 hit(0.35초)에 들어가고, hit 은 기술이 아니므로 다시 맞으면 지금처럼
    hit 으로 대체된다. 새로운 무한 연쇄가 생기지 않는다 — 지금 세계에서 이미 성립하던
    관계 그대로다.

## SEMANTIC CLOSURE

    INTENT-SKILL-PHASE-001
        → SkillDefinition.SwingBegin · SwingEnd (State) + RULE-SKILL-PHASE-001 (Rule)
        → 기술마다 다른 값은 BALANCE ① 이 고정한다                              ✔

    INTENT-STARTUP-IS-OBSERVABLE-001
        → Entity.ActionPhase (Observable) — 세계 판정값                        ✔
        → Skill.Profile 의 구간 경계로 "고르기 전에" 도 읽힌다                    ✔

    INTENT-CANCEL-IN-STARTUP-001
        → RULE-SKILL-CANCEL-001 (Rule) · RULE-HIT-001 (CHANGED)                ✔
        → 해가 성립한 뒤에만 불린다 (RULE-HARM-GATE-001 뒤)                      ✔

    INTENT-HIT-REACTION-001 (CHANGED)
        → RULE-HIT-001 의 세 갈래 (startup · active|recovery · none)            ✔

    INTENT-CANCEL-COSTS-THE-CHANCE-001
        → 새 State 없음. RULE-SKILL-BUDGET-001 의 기존 성질(첫 타격에서만 정산)이
          그대로 대가를 만든다                                                  ✔

    INTENT-CANCEL-IS-OBSERVABLE-001
        → World.CancelEvents (State + Observable) · 수명은 기존 규칙에 얹는다      ✔
        → 세 사건의 구분 근거를 OBSERVABLE 절이 명시한다                          ✔

    INTENT-NPC-AUTONOMY-001 (CHANGED)
        → RULE-NPC-DECIDE-001 의 기술 고르기 한 줄                              ✔

    닫히지 않은 문장 없음. WORLD DESIGN GAP 없음.
