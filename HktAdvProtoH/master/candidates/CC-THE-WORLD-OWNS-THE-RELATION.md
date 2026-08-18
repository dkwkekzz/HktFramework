# CC-THE-WORLD-OWNS-THE-RELATION

## CANDIDATE STATEMENT
    두 존재 사이에서만 정해지는 값도 세계가 계산해 관찰에 싣는다.
    View 는 관찰값끼리 계산해 새 의미를 만들지 않는다.

## OBSERVED REPEATING PATTERN
    C013 (제출) — 이번 Cycle 의 새 관찰값은 한 존재의 속성이 아니라 **두 존재 사이의 값**
                  이었다. `versusObserver {armor, resistance, resistanceMultiplier}` 는
                  대상의 방어와 관찰자의 관통이 만나야 정해진다. View 가 두 관찰값을
                  곱하면 만들 수 있는 값이므로 계약에 넣지 않고 지나치기 쉽다.
    C012 (전조) — 같은 형태가 한 단계 앞서 나타났다. DefenseShape(상대의 어느 방어가 무른가)
                  역시 관찰자의 공격 형태를 알아야 의미가 생기는 관계값이며,
                  세계가 판정해 실었다.

    반복 2회. 두 번 모두 "View 가 곱하면 되는데 왜 세계가 보내는가" 라는 질문이 나왔고,
    두 번 모두 세계가 보내는 쪽을 골랐다.

## AFFECTED NODES
    MC-PENETRATION · MC-ATTACK-ARMOR-MATCHUP · MC-COMBAT-CAUSE-READING ·
    MK-OPPONENT-DEFENSE-SHAPE · 앞으로 두 존재 사이에서 정해지는 모든 관찰값

## EXPECTED SCOPE
    GLOBAL (관찰 계약 전반 — 전투에 한정되지 않는다)

## REQUIRES
    relation_value_computed_by_world     두 존재 사이의 값도 세계가 계산해 관찰에 싣는다
    relation_value_named_in_contract     그 값이 무엇들 사이의 무엇인지 계약에 이름으로 남는다

## PROHIBITS
    view_derives_relation_by_arithmetic  View 가 관찰값끼리 곱·나눗셈으로 관계 의미를 만든다

## PREFERS
    없음

## POTENTIAL CONFLICTS
    없음. 다만 DC-WORLD-OWNS-THE-SURFACE-LIST 의 **확장**이며 별개 문안이 아닐 수도 있다 —
    그 Constraint 는 "무엇을 관찰에 실을지는 세계가 정한다" 이고 이 후보는
    "관계값도 그 목록에 포함된다" 이다. 흡수(기존 DC 의 REVISED)와 신설 중
    어느 쪽인지는 Human 이 결정한다.

## WHY THIS SHOULD BECOME A CONSTRAINT
    관계값을 View 가 곱해 만들면, 세계가 그 몫을 정하는 규칙을 바꿔도 화면이 따라오지 않는다.
    C013 은 그 반례를 실측으로 남겼다 — fixture 의 `versusObserver` 를 원래 값으로 되돌리면
    "→ 나에게" 표시가 사라진다. View 가 곱해 만들고 있었다면 그대로 남았을 것이다.
    관계값은 앞으로 늘어나기만 한다 (능동 방어의 효율 · 조건의 성립 여부 · 관계/평판).
    지금 경계를 못 박지 않으면 각 Cycle 이 매번 같은 판단을 다시 한다.

## HUMAN DECISION
    PENDING
    Reason
