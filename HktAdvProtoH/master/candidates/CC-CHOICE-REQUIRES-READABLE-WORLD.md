# CC-CHOICE-REQUIRES-READABLE-WORLD

## CANDIDATE STATEMENT

    선택이 성립하려면 세계가 그 선택의 근거를 **선택 이전에** 보여주어야 한다.
    외워야만 알 수 있는 것은 선택지가 아니다.

## OBSERVED REPEATING PATTERN

    Possibility 들이 요구하는 것을 보면 능력보다 먼저 **지식**이 온다.

        MP-READ-AND-COUNTER        requires MK-OPPONENT-FLOW-PATTERN
        MP-EXPLOIT-OPEN-BODY       requires MK-OPPONENT-FLOW-PATTERN
        MP-MATCH-WEAPON-TO-ARMOR   requires MK-OPPONENT-DEFENSE-SHAPE

    그리고 이 지식들은 전부 `revealed_by` 로 다시 그 Possibility 를 가리킨다 —
    플레이해서 얻는 지식이지 문서로 주는 지식이 아니다.

    같은 원리가 이 저장소의 다른 영역에서도 이미 반복됐다.

        C007 R2   세계는 어떤 속성도 숨기지 않는다 (INTENT-ATTRIBUTE-OBSERVE-001 신설)
        C009 R1   걸 수 있는 명령을 세계가 목록으로 밝힌다 —
                  "외우는 것이 아니라 보이는 것이다"
        원본 §7   플레이어는 스킬 이름을 외우는 것이 아니라
                  언제 몸이 열리는지를 읽는다

    전투 밖에서 두 번, 전투 안에서 세 번 반복된 원칙이다.

## AFFECTED NODES

    MK-OPPONENT-FLOW-PATTERN · MK-OPPONENT-DEFENSE-SHAPE
    MC-COMBAT-CAUSE-READING · MC-COMBAT-FLOW · MC-ATTACK-ARMOR-MATCHUP
    MP-READ-AND-COUNTER · MP-EXPLOIT-OPEN-BODY · MP-MATCH-WEAPON-TO-ARMOR

## EXPECTED SCOPE

    GLOBAL
    (전투에서 발견됐지만 C007 · C009 가 이미 전투 밖에서 같은 결정을 내렸다)

## REQUIRES

    world_reveals_its_options       무엇을 할 수 있는지 세계가 밝힌다
    cause_visible_before_choice     선택의 근거가 선택 이전에 관찰된다
    learnable_by_playing            그 지식을 플레이로 얻을 수 있다

## PROHIBITS

    memorization_only_knowledge     문서·위키로만 알 수 있는 판정 조건
    hidden_decisive_state           결과를 가르는데 관찰되지 않는 상태

## PREFERS

    show_the_list_over_teach_the_key    목록으로 보이기를 키 외우기보다 우선한다

## POTENTIAL CONFLICTS

    DC-COMBAT-PLAYER-CAUSALITY 와 겹치는 것처럼 보이지만 시점이 다르다.

        DC-COMBAT-PLAYER-CAUSALITY   결과가 난 뒤 그 원인을 설명할 수 있는가 (사후)
        이 후보                       선택하기 전에 근거가 보이는가 (사전)

    실제 충돌은 아니지만 **Mystery / 오독 / 반전**과는 정면으로 부딪힌다.
    Belief 가 WorldState 와 다를 수 있어야 조사·반전이 성립하는데, 이 원칙을
    GLOBAL 로 승격하면 그 여지가 좁아진다. Scope 를 COMBAT 으로 좁히면 피할 수 있다.
    → open-questions.md Q3 과 같은 결정이다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    이 원칙이 없으면 각 Cycle 은 판정 규칙만 구현하고 그것을 보이게 만드는 일을
    "나중 UI 작업" 으로 미룬다. 그러면 규칙은 늘어나는데 플레이어의 선택지는 늘지 않는다.
    Constraint 가 되면 새 판정을 더할 때 "이것이 선택 이전에 보이는가" 가 완료 조건이 된다.

## HUMAN DECISION

    PENDING
    Reason
