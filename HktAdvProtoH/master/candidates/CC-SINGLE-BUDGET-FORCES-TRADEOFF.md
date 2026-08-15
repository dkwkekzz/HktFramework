# CC-SINGLE-BUDGET-FORCES-TRADEOFF

## CANDIDATE STATEMENT

    플레이어가 쓸 수 있는 힘은 하나의 예산이다. 공격·방어·기동·폭발은 별도 계기를
    갖지 않고 같은 자원을 놓고 경쟁한다.

## OBSERVED REPEATING PATTERN

    9개 Possibility 중 6개가 MC-CP-ECONOMY 를 요구한다.
    그리고 Graph 의 `opposes` 관계가 거의 전부 여기서 나온다 —

        MP-TRADE-BODY-FOR-RESOURCE  opposes  MP-STAKE-EVERYTHING-ON-ONE-BLOW
        MP-TRADE-BODY-FOR-RESOURCE  opposes  MP-BREAK-THE-GUARD
        MP-BREAK-THE-GUARD          opposes  MG-SURVIVE-ENEMY-OFFENSIVE
        MP-HOLD-FORTIFIED           opposes  MG-OVERCOME-SUPERIOR-OPPONENT

    즉 이 설계에서 "선택이 무겁다" 는 감각은 개별 규칙이 아니라
    **하나의 예산을 나눠 쓴다는 사실 하나**에서 나온다.

    원본 §11 이 이것을 명시적 설계 결정으로 적고 있다 —
    "별도의 Guard Gauge / Ultimate Gauge를 만들지 않고 기존 CP를 확장한다."

## AFFECTED NODES

    MC-CP-ECONOMY
    MP-READ-AND-COUNTER · MP-BREAK-THE-GUARD · MP-STAKE-EVERYTHING-ON-ONE-BLOW
    MP-TRADE-BODY-FOR-RESOURCE · MP-EVADE-BY-MOVING-THE-BODY · MP-HOLD-FORTIFIED
    MC-GUARD · MC-EVADE · MC-FORTIFY · MC-VOW

## EXPECTED SCOPE

    COMBAT
    (전투 밖 자원까지 넓힐지는 판단이 필요하다 — 이동·채집·제작이 같은 예산을
     나눠 쓰는 세계인지가 정해져야 한다)

## REQUIRES

    shared_budget_across_roles      공격·방어·기동이 같은 자원을 소비한다
    spending_here_costs_there       한 곳에 쓰면 다른 곳에서 실제로 줄어든다

## PROHIBITS

    parallel_dedicated_gauge        역할마다 별도 계기를 두는 것
                                    (Guard Gauge · Ultimate Gauge · Stamina 분리)

## PREFERS

    extend_existing_resource        새 자원을 만들기 전에 기존 자원을 확장한다

## POTENTIAL CONFLICTS

    없음 — 기존 DC 3종과 충돌하지 않는다.
    다만 DC-COMBAT-DEFENSE-EARNS-INITIATIVE 의 `sustained_defense_has_cost` 는
    이 후보가 승격되면 그 비용의 **출처**까지 고정된다 (반드시 같은 예산이어야 한다).

## WHY THIS SHOULD BECOME A CONSTRAINT

    지금은 "CP 를 쓴다" 가 각 Capability 의 개별 설계로 흩어져 있다.
    Constraint 가 되면 다음 Cycle 이 새 행동을 더할 때 "이것도 CP 를 쓰는가" 가
    자동으로 물어진다. 반대로 승격하지 않으면 어느 Cycle 에선가 편의상 별도 게이지가
    생기고, 그 순간 이 전투 설계의 무게중심이 사라진다.

    이것은 취향이 아니라 실제로 설계를 제한한다 — 새 방어 수단을 만들 때
    "무료로 쓸 수 있게 할까" 라는 선택지를 없앤다.

## HUMAN DECISION

    PENDING
    Reason
