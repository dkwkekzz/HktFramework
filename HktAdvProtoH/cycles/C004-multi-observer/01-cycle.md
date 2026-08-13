# CYCLE C004 — Multi Observer

[PASS] Cycle Definition
[PASS] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## TYPE
    Existing Capability Enhancement    하나뿐이던 관찰자를 여럿으로 연다

## TARGET CAPABILITY
    Observer Projection

## GOAL
    둘 이상의 사람이 같은 세계에 각자 접속해
    각자 자기 캐릭터를 조종하고 서로가 그 세계 안에서 움직이는 것을 본다 —
    내 조작은 내 캐릭터에만 닿고, 접속을 끊었다 다시 이어도 나는 여전히 나다.

## INCLUDED
    다중 클라이언트          둘 이상의 관찰자가 같은 세계에 동시에 접속해 진행을 함께 본다
    Observer 개념            세계 안에 "누가 보고 있는가"가 상태로 존재한다
    관찰자별 Actor 부여      접속마다 세계가 그 관찰자의 Actor 를 정한다
    관찰자별 투영            같은 세계라도 관찰 결과는 관찰자마다 다르다 (내 캐릭터 / 남의 캐릭터)
    Action Request 귀속      요청은 보낸 관찰자의 Actor 에만 적용된다 — 남의 캐릭터를 움직일 수 없다
    세션 식별                접속한 관찰자가 누구인지 세계가 가린다
    재접속 동일성            끊겼다 다시 이어져도 같은 관찰자로 돌아온다 (같은 Actor 를 되찾는다)
    다른 관찰자의 이탈       관찰자가 떠난 것이 남은 관찰자에게 보인다

## EXCLUDED
    Client Prediction        요청을 화면에서 미리 반영하고 나중에 보정하는 것        → 다음 Cycle
    지연 보상 / 롤백         Lag compensation · rewind                              → 다음 Cycle
    영속(Persistence)        세계 상태를 저장하고 재시작 뒤 복원하는 것             → 다음 Cycle
    비밀번호 · 계정 등록     자격 증명을 검증하는 인증 —
                             이번 Cycle 의 "인증"은 **누구인지 가리는 것(식별)** 까지다.
                             누구인지 주장할 수 있으면 그 관찰자로 인정한다.
    관찰자 간 상호작용       거래 · 파티 · 공격 대상으로서의 다른 Player Actor
    시야 범위 컬링           관찰자마다 보이는 범위를 잘라내는 것 (전원이 세계 전체를 본다)
    새로운 게임 행동         이번 Cycle 은 행동을 늘리지 않는다

## RELATED EXISTING CAPABILITY
    World Authority (C001·C002·C003)   재사용 — 판정은 그대로 World Rule 이 한다
    WorldHost 관찰자 목록 (C003)       재사용 — 이미 여럿을 받는다 (C003 검증 완료).
                                       남은 것은 "누가" 와 "무엇을 보는가" 다.
    Observer Projection (C001~C003)    변경 — 하나뿐인 관찰 결과에서 관찰자별 관찰 결과로.
                                       "player" 로 고정되어 있던 시점이 관찰자에 따라 달라진다.
    Action Request 수용 (C001·C003)    변경 — 요청에 "누가 보냈는가"가 붙고,
                                       그 관찰자의 Actor 로만 판정된다.
    Actor / Position / Inventory       재사용 — Player Actor 를 새로 만들지 않고 여럿으로 늘린다.
        (C001·C002)
    Observer Link State (C003)         확장 — 이어짐 상태에 "나는 누구인가"가 더해진다
    GameView Specification (C003)      확장 — 내 Actor 와 다른 Actor 의 구분,
                                       접속 중인 관찰자가 관찰 항목에 추가된다

    → C001 Stone Mining · C002 Character Action · C003 World Server Separation 의 플레이는
      관찰자가 한 명일 때 이번 Cycle 이후에도 그대로 성립해야 한다 (Regression).

## 로드맵 상의 자리 (Human 지정)
    C003 EXCLUDED 6항목 중 이번 Cycle 이 닫는 것은
        다중 클라이언트 · 관찰자별 투영 · 인증(세션 식별)
    남는 것은 별도 Cycle 이다
        Client Prediction · 지연 보상/롤백   → 화면이 세계보다 앞서 가는 문제 (View 쪽 Cycle)
        영속(Persistence)                    → 세계가 프로세스보다 오래 사는 문제 (World 쪽 Cycle)
    셋을 한 Cycle 에 묶지 않는 이유는 각각이 독립된 플레이 경험이기 때문이다.
