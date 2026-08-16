# CC-STANCE-IS-NOT-AN-ACTION

> 제출: MF (C010). 보고 원문 — C010 `08-verification.md` MASTER FEEDBACK Constraint Candidate ①

## CANDIDATE STATEMENT
    몸이 취하는 **태세**는 행동이 아니다. 행동 칸을 차지하지 않고 행동과 나란히 유지되며,
    무엇을 시작할 수 있는지를 좁힐 뿐이다.

## OBSERVED REPEATING PATTERN
    C010   막기를 "행동" 으로 쓰면 01-cycle.md 의 "막기를 유지한 채 걸을 수는 있다" 와
           C002 의 "한 번에 하나의 행동" 이 충돌한다. 자세(Stance)로 고쳐 썼다 (C010 R1)
    C011   같은 자세 위에 시점을 얹었다 — 새 자세도 새 행동도 만들지 않았다.
           판단을 **재사용**했을 뿐 같은 판단을 새로 내리지는 않았다

    관찰 1회 + 재사용 1회. C010 스스로 "지금 한 번 나온 판단이므로 Constraint 로 올리기에는
    이르다 (2회 관찰 권장)" 고 적었고, C011 은 그 두 번째 관찰이 되지 못했다 —
    이미 있는 자세를 쓴 것이지 새 태세를 세운 것이 아니기 때문이다.

## AFFECTED NODES
    MC-GUARD                자세로 세워졌다 (C010)
    MC-PERFECT-GUARD        그 자세를 그대로 딛는다 (C011)
    앞으로  MC-COMBAT-FLOW (공격/방어 배분) · MC-FORTIFY (지속 방어 자세)
            — 둘 다 "행동인가 태세인가" 를 반드시 만난다.
            원본 §7 이 Flow 를 "별도 자원이 아니라 현재 행동이 어디에 집중하는지를
            표현하는 상태값" 이라고 쓴 것이 이 후보와 같은 방향이다

## EXPECTED SCOPE
    WORLD
    (전투에 국한되지 않는다 — 어떤 태세든 같은 물음이다)

## REQUIRES
    stance_does_not_occupy_the_action_slot
        태세는 CurrentAction 을 대체하지 않는다
    stance_narrows_what_can_begin
        태세의 효력은 "무엇을 시작할 수 있는가" 를 좁히는 것으로 나타난다

## PROHIBITS
    stance_as_action
        태세를 행동 종류의 하나로 두는 것 — 그러면 "그 태세로 무엇을 하는가" 를
        표현할 수 없다

## PREFERS
    forced_states_bypass_the_gate
        세계가 강제하는 것(피격 · 쓰러짐)은 태세가 좁히는 대상이 아니다 (C010 이 정한 형태)

## POTENTIAL CONFLICTS
    C002 의 `INTENT-ACTION-EXCLUSIVE-001`("한 번에 하나의 행동")과 **충돌하지 않는다** —
    태세가 행동이 아니라는 것이 이 후보의 내용이므로 그 제약은 그대로 산다.
    C010 이 R1 에서 정확히 그 이유로 이 형태를 골랐다.

## WHY THIS SHOULD BECOME A CONSTRAINT
    승격 조건 4항 검사 (candidates/README.md)

        여러 곳에서 반복된다          ✘  C010 1회. C011 은 재사용이지 새 판단이 아니다
        설계 선택을 실제로 제한한다    ✔  C010 의 R1 개정을 실제로 일으켰다
        게임의 정체성과 관련 있다      ✔  "막으면서 걷는다" 가 가능한 세계인가가 전투 감각을 가른다
        앞으로도 반복 적용할 가치      ✔  MC-COMBAT-FLOW · MC-FORTIFY 가 같은 물음을 만난다

    3/4 — 첫 항이 비었다. C010 스스로 2회 관찰을 권했고 아직 두 번째가 오지 않았다.
    **FR-FLOW-OPENS-THE-BODY 또는 Fortify Cycle 이 두 번째 관찰이 될 가능성이 높다.**
    그 Cycle 에서 같은 판단이 다시 나오면 그때 승격을 다시 보는 것이 자연스럽다.

## HUMAN DECISION
    PENDING
    Reason
