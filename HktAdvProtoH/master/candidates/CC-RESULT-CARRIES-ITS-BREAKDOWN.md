# CC-RESULT-CARRIES-ITS-BREAKDOWN

> 제출: MF (C010 · C011). 보고 원문 — C010 `08-verification.md` MASTER FEEDBACK ②

## CANDIDATE STATEMENT
    세계가 내놓는 중요한 결과에는 그 값을 만든 내역이 결과와 **같은 자리에** 함께 실린다.
    보는 이는 최종 숫자 하나가 아니라 그 숫자가 나온 경로를 읽는다.

## OBSERVED REPEATING PATTERN
    C007   World.StrikeEvents 를 만들었다 — 누가 · 누구를 · 어느 스킬로 · 얼마나
    C010   같은 자리를 내역 6종으로 넓혔다 — base → mitigated → guarded/cpPaid → amount
    C011   같은 자리를 11종으로 넓혔다 — counter/counterBonus/perfectGuard/guardElapsed/cpGained

    세 Cycle 이 같은 판단을 반복했다. 특히 C011 은 판정 상수(PERFECT_GUARD_WINDOW)를
    계약에 싣지 않는 대신 **그 상수가 만든 값**(guardElapsed)을 실어, 플레이어가
    여러 관찰을 비교해 경계를 스스로 알아내게 했다 — 같은 원칙의 한 단계 깊은 적용이다.

## AFFECTED NODES
    MC-COMBAT-CAUSE-READING     이 원칙을 직접 실현하는 Capability (현재 PARTIAL)
    MC-COMBAT-STRIKE · MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER
                                네 Capability 모두 결과를 내며, 넷 다 내역을 함께 실었다
    앞으로  MC-BREAK · MC-COMBAT-FLOW · MC-ATTACK-ARMOR-MATCHUP · MC-VOW
            — 넷 다 결과를 키우는 배율이므로 같은 물음을 만난다

## EXPECTED SCOPE
    COMBAT
    (관찰 계약 일반으로 넓힐지는 Human 판단 — 지금 관찰된 것은 전투 결과뿐이다)

## REQUIRES
    breakdown_travels_with_result   결과를 싣는 관찰 계약이 그 값을 만든 항목들도 함께 싣는다
    reconstructable_from_one_record 한 기록만으로 계산 순서를 되짚을 수 있다

## PROHIBITS
    final_number_only               최종 수치 하나만 내보내는 결과 계약

## PREFERS
    observable_derived_value_over_exposed_constant
        판정 상수를 계약에 싣기보다, 그 상수가 만든 값을 실어 관찰로 배우게 한다
        (C011 이 PERFECT_GUARD_WINDOW 대신 guardElapsed 를 실은 판단)

## POTENTIAL CONFLICTS
    없음. DC-COMBAT-PLAYER-CAUSALITY 의 `requires[explainable_result]` 를
    **구체화**하는 관계다 — 대체하지 않는다.
    다만 그렇기에 "별도 Constraint 인가, 기존 DC 의 requires 를 다듬는 것인가" 가
    Human 이 판단할 지점이다.

## WHY THIS SHOULD BECOME A CONSTRAINT
    승격 조건 4항 검사 (candidates/README.md)

        여러 곳에서 반복된다          ✔  C007 · C010 · C011 — 세 Cycle
        설계 선택을 실제로 제한한다    ✔  결과 계약의 모양을 정한다. C010 은 이 때문에
                                        StrikeEvent 를 값 하나에서 구조로 바꿨고,
                                        C011 은 상수 대신 파생값을 싣기로 정했다
        게임의 정체성과 관련 있다      ✔  원본 §23 "강한 결과에는 반드시 설명 가능한 이유가
                                        존재해야 한다" 가 이 프로젝트 전투의 정체성이다
        앞으로도 반복 적용할 가치      ✔  남은 Capability 넷이 전부 배율이다 —
                                        내역 없이 들어오면 "왜 커졌는가" 가 무너진다

    네 항 모두 충족한다. 다만 위 POTENTIAL CONFLICTS 대로 **새 DC 로 세울지
    기존 DC-COMBAT-PLAYER-CAUSALITY 의 requires 를 구체화할지**가 남은 선택이다.

## HUMAN DECISION
    PENDING
    Reason
