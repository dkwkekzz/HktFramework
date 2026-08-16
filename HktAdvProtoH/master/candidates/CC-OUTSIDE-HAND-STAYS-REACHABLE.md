# CC-OUTSIDE-HAND-STAYS-REACHABLE

> 제출: MF (C011). 보고 원문 — C011 `08-verification.md` MASTER FEEDBACK Constraint Candidate ②

## CANDIDATE STATEMENT
    세계 밖의 손(디버그 조작)이 만들 수 있는 상태는 **세계의 규칙으로도 도달 가능한 상태**여야 한다.
    밖에서 손을 댄 뒤의 몸이, 규칙만으로는 결코 만들어지지 않는 모양이 되어서는 안 된다.

## OBSERVED REPEATING PATTERN
    C007 R2  RULE-ATTRIBUTE-SET-001 을 세우며 "바뀐 뒤의 세계는 자기 규칙대로 간다" 고 정했다.
             그때는 값 하나를 바꾸는 것뿐이어서 이 물음이 드러나지 않았다
    C011     처음으로 드러났다 — `stance` 를 밖에서 `guard` 로 넣을 때
             `GuardStartedAt` 을 함께 찍지 않으면, **창이 이미 닫힌 채 자세만 서 있는 몸**이
             만들어진다. RULE-GUARD-SET-001 은 언제나 둘을 함께 세우므로
             그 몸은 세계의 규칙으로는 도달할 수 없는 모양이다.
             C011 은 밖의 손도 시각을 함께 찍도록 정했다

    관찰 1회 + C007 R2 의 선행 원칙 1회. 반복이라 부르기에는 아직 이르다.

## AFFECTED NODES
    직접 대응하는 Master 노드가 없다 — 이것은 Capability 가 아니라
    `RULE-ATTRIBUTE-SET-001` 이라는 **관찰·조작 경로의 성질**에 관한 규율이다.
    영향을 받는 것은 앞으로 MutableAttribute 목록에 오르는 모든 상태다.

    지금 목록: hp · hpMax · cp · cpMax · moveSpeed · runSpeedMultiplier · actionSpeed ·
              moveMode · defense · stance · exposedFor
    이 중 짝을 가진 것 — stance ↔ guardStartedAt (C011 이 묶었다)

## EXPECTED SCOPE
    WORLD

## REQUIRES
    outside_write_leaves_consistent_state
        밖에서 세운 상태가 규칙이 만드는 상태와 같은 모양이어야 한다
        (짝을 이루는 값이 있으면 함께 세운다)

## PROHIBITS
    unreachable_state_from_debug_path
        규칙으로는 도달할 수 없는 상태를 밖의 손이 만드는 것

## PREFERS
    relative_input_for_world_time
        세계 시각을 밖에서 직접 넣게 하지 않는다 — 밖에서는 의미 있는 값을 고를 수 없다.
        대신 "지금부터 얼마 동안" 을 받는다
        (C010 이 guardBrokenUntil 을 목록에서 뺀 판단 · C011 의 `exposedFor`)

## POTENTIAL CONFLICTS
    C007 R2 가 세운 문장과 **긴장 관계**에 있다.

        C007 R2   "세계 밖의 손이다. 다만 바뀐 뒤의 세계는 자기 규칙대로 간다"
        이 후보   "밖의 손도 규칙이 만들 수 있는 모양만 만들 수 있다"

    앞은 "무엇을 만들든 그 뒤는 규칙이 책임진다" 이고, 뒤는 "무엇을 만들지에도 제한이 있다" 다.
    후자가 전자를 좁힌다. 좁히는 것이 옳은지 — 즉 디버그 경로가 **규칙이 못 만드는 상태**를
    일부러 만들어 볼 수 있어야 하는지(그것이 디버그의 값어치이기도 하다)가
    Human 이 판단할 지점이다.

## WHY THIS SHOULD BECOME A CONSTRAINT
    승격 조건 4항 검사 (candidates/README.md)

        여러 곳에서 반복된다          ✘  C011 에서 1회 관찰. C007 R2 의 선행 문장이 있으나
                                        그때는 이 물음이 드러나지 않았다
        설계 선택을 실제로 제한한다    ✔  C011 은 이 판단 때문에 attribute-set 에
                                        시각 기록을 더했다
        게임의 정체성과 관련 있다      ✘  플레이 의미가 아니라 관찰·조작 경로의 규율이다
        앞으로도 반복 적용할 가치      △  앞으로 짝을 가진 상태가 늘어나면 다시 만난다
                                        (MC-BREAK 의 누적값 ↔ 마지막 압박 시각 등)

    1.5/4 — **지금 승격하기에는 이르다.**
    두 번째 사례가 나오면(짝을 가진 상태를 밖에서 세우는 일이 다시 생기면) 다시 볼 값어치가 있다.
    그때까지는 이 파일이 "이미 한 번 판단된 것" 이라는 기록으로 남는다.

## HUMAN DECISION
    PENDING
    Reason
