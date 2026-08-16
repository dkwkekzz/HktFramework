# CC-TIMED-STATE-EXPIRES-BY-CLOCK

> 제출: MF (C011). 보고 원문 — C011 `08-verification.md` MASTER FEEDBACK Constraint Candidate ①

## CANDIDATE STATEMENT
    시간이 지나면 끝나는 상태는 **끝내는 Rule 을 두지 않는다.**
    세우는 Rule 이 "언제까지인가" 를 세계 시각으로 남기고,
    지금 그 안인지는 세계 시각과의 비교로 유도한다.

## OBSERVED REPEATING PATTERN
    C010   Actor.GuardBrokenUntil — RULE-GUARD-BREAK-001 만이 세우고 거두는 Rule 이 없다.
           `isGuardBroken(actor, time) ⇔ time < guardBrokenUntil` 로 관찰된다
    C011   Actor.ExposedUntil — RULE-EXPOSE-001 만이 세우고, 거두는 것은
           RULE-DOWNED-001(쓰러짐) 하나뿐이다. 나머지는 시각이 지나가면 끝난다

    두 번 다 같은 이유로 같은 형태를 골랐고, 두 번 다 같은 이득을 얻었다 —
    Tick 에 새 만료 단계가 늘지 않았고, 관찰자가 남은 시간을 스스로 잴 수 있게 됐다
    (`brokenUntil` · `exposure.until` 이 world.time 과 나란히 관찰된다).

    겹침 처리도 같은 자리에서 정해졌다 — C011 은 `max(현재값, 지금 + 지속)` 으로
    "겹쳐도 깊어지지 않고 끝나는 시각만 밀린다" 를 상태 하나로 표현했다.

## AFFECTED NODES
    MC-GUARD            GuardBrokenUntil
    MC-COUNTER          ExposedUntil
    앞으로  MC-BREAK (BROKEN 지속) · MC-FORTIFY (자세 유지) · MC-VOW (실패 대가의 봉인 시간)
            — 셋 다 "얼마 동안" 을 가진 상태이므로 같은 물음을 만난다

## EXPECTED SCOPE
    WORLD
    (전투에 국한되지 않는다 — 시간으로 끝나는 상태라면 어디서든 같은 물음이다)

## REQUIRES
    deadline_as_world_time      끝나는 시점을 세계 시각으로 저장한다
    derived_activeness          "지금 그 안인가" 는 저장하지 않고 유도한다
    overlap_moves_the_deadline  겹치면 쌓지 않고 끝나는 시각만 뒤로 민다

## PROHIBITS
    per_state_expiry_rule       그 상태만을 위한 만료 Rule / Tick 단계
    stored_remaining_time       매 Tick 깎아 나가는 잔여 시간 필드

## PREFERS
    observable_deadline         남은 시간을 관찰자가 세계 시각과의 차로 스스로 재게 한다

## POTENTIAL CONFLICTS
    없음.
    DC-COMBAT-PLAYER-CAUSALITY 와는 오히려 같은 방향이다 — 잔여 시간을 깎아 나가면
    Tick 간격에 따라 값이 흔들릴 여지가 생기지만, 시각 비교는 그렇지 않다.

    다만 한 가지를 Human 이 볼 값어치가 있다 — 이 형태는 **되감기·일시정지가 없는 세계**를
    전제한다. 세계 시각이 멈추거나 뒤로 가는 일이 생기면 저장된 시각의 뜻이 달라진다.
    지금 세계에는 그런 것이 없다 (C003 World.Time 은 단조 증가).

## WHY THIS SHOULD BECOME A CONSTRAINT
    승격 조건 4항 검사 (candidates/README.md)

        여러 곳에서 반복된다          ✔  C010 · C011 — 두 Cycle. (권장 2회 관찰 충족)
        설계 선택을 실제로 제한한다    ✔  "만료 Rule 을 만들지 않는다" 는 실제 구현 형태를
                                        정한다. 두 Cycle 모두 이 판단으로 Tick 단계를 아꼈다
        게임의 정체성과 관련 있다      △  전투의 정체성이라기보다 **세계 구현의 규율**이다.
                                        Constraint 의 정의(Goal/Possibility 의 형태를 제한)에
                                        정확히 들어맞는지가 Human 이 볼 지점이다
        앞으로도 반복 적용할 가치      ✔  남은 Capability 중 셋이 지속 시간을 가진다

    3.5/4 — 세 번째 항이 애매하다. 이것은 **플레이 의미의 제약이 아니라 구현 규율**에 가깝다.
    정책상 Constraint 는 Goal/Possibility/Capability 의 형태를 제한하는 것이므로,
    DC 로 올릴지 아니면 가이드(`guides/world-implementation.md`)의 규약으로 둘지가 선택이다.

## HUMAN DECISION
    PENDING
    Reason
