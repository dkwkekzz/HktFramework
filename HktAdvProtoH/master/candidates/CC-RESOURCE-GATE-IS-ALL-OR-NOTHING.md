# CC-RESOURCE-GATE-IS-ALL-OR-NOTHING

접수: 2026-08-18 (Feedback) — C011-guard-trades-body-for-resource 의 MASTER FEEDBACK 이 보고한
반복 패턴이다. Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    자원을 치르고 얻는 이득은 전부이거나 전무다. 낼 수 있으면 온전히 얻고, 낼 수 없으면
    전혀 얻지 못한다. 모자란 자원만큼 이득을 깎아 주는 중간 값을 만들지 않는다.

## OBSERVED REPEATING PATTERN

    C007      스킬의 기력 관문. 기력이 모자라면 스킬이 약하게 나가는 것이 아니라
              아예 시작되지 않는다. 쓸 수 있는가 없는가로만 갈린다.

    C011      막기의 기력 관문. 기력이 남아 있으면 온전히 절반으로 막고, 바닥나면
              절반도 못 막는 것이 아니라 방어 자체가 무너져 그대로 얻어맞는다.
              08-verification.md 의 WORLD SCENARIO 가 그 순간을 실측으로 남겼다.

    두 사례가 같은 것을 지킨다 — 고갈이 **사건**이 된다. 부분 감쇄를 허용했다면
    기력 0 에 붙은 채 영원히 조금씩 막는 상태가 생기고, "자원이 마르면 무너진다" 는
    의미가 사라진다. 무너짐이 보이지 않으면 자원을 관리할 이유도 사라진다.

## AFFECTED NODES

    직접   MC-CP-ECONOMY · MC-GUARD · MC-VOW
    간접   앞으로 자원을 대가로 이득을 사는 모든 Capability —
           집중(MC-COMBAT-FLOW) · 서약(MC-VOW) · 회피(MC-EVADE)

    Possibility 로는 MP-TRADE-BODY-FOR-RESOURCE 와 MP-STAKE-EVERYTHING-ON-ONE-BLOW 가
    이 성질에 직접 기댄다 — 둘 다 "자원이 마르는 순간" 이 경로의 대가다.

## EXPECTED SCOPE

    COMBAT — 다만 자원 경제 전반으로 넓힐 여지가 있다. 전투 밖 경로가 아직 없어
    (open-questions.md Q8) 지금 확인할 수 있는 사례가 전투뿐이다.

## REQUIRES

    - 자원이 대가인 곳에서는 지불 가능/불가능 두 상태만 둔다
    - 지불 불가로 넘어가는 순간이 관찰 가능한 사건으로 드러난다

## PROHIBITS

    - 모자란 자원에 비례해 이득을 깎아 주는 부분 지불
    - 자원이 0 인 채로 계속 이득의 일부를 받는 상태

## CONFLICTS

    없음. 기존 Active DC 5종과 겹치지 않는다.

    다만 승격 시 검토할 것 — DC-COMBAT-SHARED-BUDGET 과 붙어 있다. 같은 예산을 여럿이
    나눠 쓰는데(SHARED-BUDGET) 지불이 전부-아니면-전무라면, 예산이 얕은 구간에서
    행동 선택이 급격히 좁아진다. 그것이 의도된 긴장인지 과한 절벽인지는 플레이 판단이다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    Cycle 두 개가 같은 판단을 독립적으로 내렸다. 세우지 않으면 다음 Cycle 이 "조금이라도
    막게 해 주는 게 친절하지 않은가" 라는 이유로 부분 지불을 넣을 수 있고, 그 순간
    고갈이 사건이기를 그친다 — 되돌리려면 이미 쌓인 밸런스를 다시 잡아야 한다.

## HUMAN DECISION

    PENDING

    관찰이 두 건이다. 세 번째 사례를 기다렸다가 판단하는 것도 정당하다 —
    C011 자신이 그렇게 적었다.
