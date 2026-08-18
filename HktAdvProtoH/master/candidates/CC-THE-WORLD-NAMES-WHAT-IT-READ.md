# CC-THE-WORLD-NAMES-WHAT-IT-READ

접수: 2026-08-18 (MF) — C012-damage-type-chooses-the-defense 의 MASTER FEEDBACK 이 보고한
패턴이다. Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    세계가 어떤 값을 읽어 결과를 냈는지 관찰자에게 보낼 때는, 그 값과 함께 **그 값의
    이름**을 보낸다. 이름 없는 값은 관찰자가 어느 것인지 짐작하게 만든다.

## OBSERVED REPEATING PATTERN

    C010      계산 내역에 방어 값을 실었다 — 이름 없이 값 하나로. 방어가 세계에
              하나뿐이었으므로 그때는 성립하는 계약이었다.

    C012      방어가 둘이 되었다. 같은 값이 어느 방어였는지에 따라 결과가 완전히 갈리는데,
              값만으로는 구분할 수 없다. 이름을 함께 싣자 관찰자가 짐작을 그만두었다.
              같은 판단이 공격 쪽에도 그대로 필요했다.

    관찰 1회다 — C010 은 아직 갈래가 하나였으므로 반례가 아니라 **전조**다.
    다음 층(Penetration)이 깎인 뒤의 방어를 보내야 하므로 같은 문제가 다시 온다.

## AFFECTED NODES

    직접   MC-COMBAT-CAUSE-READING — "왜 이 결과가 나왔는가" 를 읽는 능력 그 자체다
    간접   값이 여러 갈래가 될 수 있는 모든 Capability —
           MC-PENETRATION · MC-ATTACK-ARMOR-MATCHUP · MC-CONDITION-STACKING

## EXPECTED SCOPE

    GLOBAL — 전투에 한정되지 않는다. World → View 경계에서 결과의 경위를 보내는
    모든 자리의 성질이다.

## REQUIRES

    - 결과의 경위에 실리는 값은 그 값이 무엇이었는지의 이름을 동반한다
    - 갈래가 늘어나도 관찰자 쪽 코드가 어느 갈래인지 추론하지 않는다

## PROHIBITS

    - 갈래가 둘 이상인 값을 이름 없이 보내는 것
    - 관찰자가 다른 필드로부터 그 값의 정체를 역추론하게 두는 것

## CONFLICTS

    없음. DC-WORLD-OWNS-THE-SURFACE-LIST 와 같은 방향이다 —
    그쪽이 "무엇을 할 수 있는가" 의 목록이라면 이쪽은 "무엇을 읽었는가" 의 이름이다.

    승격 시 검토할 것 — 둘을 하나의 DC 로 합칠 것인가. 합치면 문안이 넓어져
    구체적인 위반을 잡아내기 어려워질 수 있다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    이름 없는 값은 갈래가 하나일 때만 유효한 계약이며, 갈래가 늘면 **조용히** 틀린다.
    깨지는 것이 아니라 관찰자가 짐작을 시작하기 때문에, 화면에 잘못된 설명이 나올 때까지
    아무도 모른다. 관통 층이 곧 두 번째 사례를 만든다.

## HUMAN DECISION

    PENDING

    관찰이 한 건이다. C012 자신이 "다음 층에서 같은 일이 반복되는지 보고 결정하는 것도
    정당하다" 고 적었다 — Penetration Cycle 이 끝난 뒤 판단하는 선택지가 있다.
