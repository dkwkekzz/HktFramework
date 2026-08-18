# C009 — Intent

> 01-cycle.md R1 을 받는다 — 명령은 "거는 길" 이 아니라 "밝혀지고 늘어나는 목록" 이다.
> 세계가 걸 수 있는 것을 스스로 밝히고, 관찰자는 그것을 보고 고르며,
> 세계는 자기가 받은 요청 하나하나에 대답한다.

## GOAL / POSSIBILITY
    GOAL-WORLD-COMMANDABLE          세계는 자신에게 무엇을 걸 수 있는지 스스로 밝히고 그것을 받는다
        └── POSSIBILITY-COMMAND-DECLARED   걸 수 있는 것이 뜻·받는 것·허용 범위와 함께 관찰된다
        └── POSSIBILITY-COMMAND-INVOKED    밝혀진 것 중 하나를 골라 대상과 값을 실어 건다

    GOAL-REQUEST-ANSWERED           요청한 이는 자기 요청이 어떻게 되었는지 안다
        └── POSSIBILITY-REPLY-ACCEPTED     받아들여진 요청은 받아들여졌음이 돌아온다
        └── POSSIBILITY-REPLY-REFUSED      거절된 요청은 그 이유와 함께 돌아온다

    GOAL-COMMAND-LEGIBLE            세계를 다루는 법은 외우는 것이 아니라 보이는 것이다
        └── POSSIBILITY-CATALOG-BROWSED    걸 수 있는 것 전부를 펼쳐 훑는다
        └── POSSIBILITY-INVOKE-GUIDED      거는 도중 후보와 허용 범위가 좁혀져 보인다
        └── POSSIBILITY-EXCHANGE-KEPT      주고받은 것이 순서대로 남는다

    GOAL-DEBUG-ONE-SURFACE          디버깅에 쓰는 것은 한 자리에 모인다
        └── POSSIBILITY-OBSERVER-COMMAND   관찰자 쪽에서 끝나는 것도 같은 목록에서 걸린다
        └── POSSIBILITY-ENTITY-NAMED       지목할 대상을 서로 구별해 부를 수 있다

## INTENT SET

    ── 세계가 밝히는 것 ──────────────────────────────────────────────

    INTENT-COMMAND-CATALOG-001 (R1 — 이 Cycle 의 중심)

        세계는 자신에게 걸 수 있는 명령이 무엇인지 밝힌다.

        각 명령마다 그것이 무엇을 하는지, 무엇을 받는지 — 대상을 받는가,
        값을 받는가 — 그리고 그 값이 어디까지 허용되는지가 함께 밝혀진다.

        이 목록은 세계가 정한다. 관찰하는 쪽이 지어내지 않으며,
        세계가 밝히지 않은 것을 알고 있다고 가정하지 않는다.

        세계에 명령이 하나 더해지면 이 목록에 항목이 하나 더 나타날 뿐이다 —
        관찰하는 쪽이 그것을 미리 알고 있을 필요가 없고,
        새 명령마다 새로운 다루는 법이 생기지도 않는다.

        걸 수 있는 것은 언제나 먼저 밝혀져 있다.
        무엇을 걸 수 있는지 모르는 채 걸어 보며 알아내는 일은 없어야 한다.

        (C007 R2 는 "바꿀 수 있는 속성과 그 허용 범위" 하나만을 밝혔다.
         이 Intent 는 그것을 "걸 수 있는 명령" 으로 넓힌 것이며,
         속성 바꾸기는 그 목록의 첫 항목이 된다.)

    INTENT-COMMAND-INVOKE-001

        관찰자는 밝혀진 목록에 있는 명령 하나를 골라,
        그 명령이 받기로 한 대상과 값을 실어 세계에 건다.

        목록에 없는 것은 걸 수 없다 — 밝혀지지 않은 명령이 몰래 통하지 않는다.

        거는 것은 요청이다. 그것이 세계를 실제로 바꾸는지는 세계가 판정한다.
        이번 Cycle 에서 세계로 가는 명령은 이미 세계에 있는 하나,
        존재의 속성을 바꾸는 것이다 (INTENT-ATTRIBUTE-MUTATE-001 그대로 쓴다).

    ── 세계의 대답 ───────────────────────────────────────────────────

    INTENT-REQUEST-REPLY-001 (New — 세계가 처음으로 요청에 대답한다)

        세계는 자신에게 도착한 요청 하나하나에 대해
        그것을 받아들였는지 거절했는지를 요청한 이에게 되돌려 준다.
        거절이라면 어느 판정에서 걸렸는지가 함께 돌아온다.

        대답은 그 요청을 보낸 이에게만 간다.
        다른 이가 무엇을 걸었고 어떻게 되었는지는 오지 않는다.

        대답은 세계의 상태를 알려 주는 것이 아니다.
        세계가 어떻게 되었는지는 지금까지대로 관찰 결과로만 드러나며,
        받아들여진 요청의 결과 또한 그 뒤에 오는 관찰 결과에서 보인다.
        대답이 말하는 것은 "그 요청이 어떻게 되었는가" 하나뿐이다.

        이 대답이 없으면 값이 바뀌지 않은 것과 요청이 거절된 것을 구분할 수 없다 —
        세계 밖에서 손을 대는 자리에서 그 구분이 없으면 아무것도 알아낼 수 없다.

    INTENT-REPLY-CORRESPONDENCE-001

        돌아온 대답이 내가 보낸 어느 요청에 대한 것인지 짚을 수 있다.
        연달아 여러 요청을 건 이도 어느 것이 받아들여지고 어느 것이 거절되었는지
        섞이지 않게 안다.

    ── 인지 ──────────────────────────────────────────────────────────

    INTENT-COMMAND-DISCOVER-001 (R1)

        걸 수 있는 명령은 관찰자에게 보인다 —
        미리 알고 있어야만 쓸 수 있는 것이 아니다.

        관찰자는 밝혀진 목록 전부를 펼쳐 훑을 수 있고,
        각 명령의 뜻과 받는 것과 허용 범위를 그 자리에서 읽는다.

        이 세계를 처음 보는 이도 이 목록만으로 무엇을 할 수 있는지 알고 시작할 수 있다.
        어딘가에 적힌 설명을 따로 찾아야 한다면 그것은 밝혀진 것이 아니다.

    INTENT-COMMAND-GUIDED-001 (R1)

        명령을 거는 도중 관찰자는 자신이 어디쯤 왔는지 안다 —
        지금까지 적은 것에 해당하는 후보가 무엇이고,
        무엇을 더 적어야 하며, 그 값이 어디까지 허용되는지가 보인다.

        잘못 걸린 명령은 아무 일도 없이 사라지지 않고 무엇이 잘못되었는지로 돌아온다.
        목록에 없는 이름인 것과 값이 허용 범위 밖인 것은 서로 다른 잘못이며
        서로 다르게 알려진다.

    INTENT-COMMAND-HISTORY-001

        관찰자가 건 명령과 그에 대한 세계의 대답은 순서대로 남아,
        무엇을 걸었고 무엇이 어떻게 되었는지 되짚을 수 있다.

        이것은 관찰자가 쥐는 기록이지 세계의 상태가 아니다 —
        세계는 누가 무엇을 걸었는지 기억하지 않는다.

    ── 관찰자 쪽에서 끝나는 명령 ─────────────────────────────────────

    INTENT-OBSERVER-COMMAND-001 (R1)

        관찰자가 자기 관찰을 바꾸는 것 — 충돌체를 보일지, 속성을 펼칠지 — 도
        같은 목록에 있고 같은 자리에서 걸린다.

        다만 이것은 세계로 나가지 않는다.
        세계는 그런 것이 걸렸다는 사실조차 알지 못하며,
        걸어도 세계에서 일어나는 일은 달라지지 않는다.

        목록의 각 항목은 세계로 가는 것인지 여기서 끝나는 것인지가 구분되어 보인다.
        한 자리에 모이는 것은 사람이 다루는 표면이지 권한의 경계가 아니다 —
        경계는 지금까지대로다.

    ── 대상 지목 ─────────────────────────────────────────────────────

    INTENT-ENTITY-ADDRESSABLE-001

        명령이 대상을 받는다면 그 대상을 지목할 수단이 관찰자에게 있어야 한다.

        관찰자는 자기가 보는 세계의 존재들을 서로 구별해 부를 수 있고,
        자신이 무엇을 지목했는지가 스스로에게 분명하다.

        아무도 지목하지 않으면 그것은 자기 몸을 뜻한다 —
        가장 흔한 쓰임에 지목이 필요하지 않다.

## DESIGN TRACE
    INTENT-COMMAND-CATALOG-001
        Source Goal         GOAL-WORLD-COMMANDABLE
        Source Possibility  POSSIBILITY-COMMAND-DECLARED
    INTENT-COMMAND-INVOKE-001
        Source Goal         GOAL-WORLD-COMMANDABLE
        Source Possibility  POSSIBILITY-COMMAND-INVOKED
    INTENT-REQUEST-REPLY-001
        Source Goal         GOAL-REQUEST-ANSWERED
        Source Possibility  POSSIBILITY-REPLY-ACCEPTED · POSSIBILITY-REPLY-REFUSED
    INTENT-REPLY-CORRESPONDENCE-001
        Source Goal         GOAL-REQUEST-ANSWERED
        Source Possibility  POSSIBILITY-REPLY-ACCEPTED · POSSIBILITY-REPLY-REFUSED
    INTENT-COMMAND-DISCOVER-001
        Source Goal         GOAL-COMMAND-LEGIBLE
        Source Possibility  POSSIBILITY-CATALOG-BROWSED
    INTENT-COMMAND-GUIDED-001
        Source Goal         GOAL-COMMAND-LEGIBLE
        Source Possibility  POSSIBILITY-INVOKE-GUIDED
    INTENT-COMMAND-HISTORY-001
        Source Goal         GOAL-COMMAND-LEGIBLE
        Source Possibility  POSSIBILITY-EXCHANGE-KEPT
    INTENT-OBSERVER-COMMAND-001
        Source Goal         GOAL-DEBUG-ONE-SURFACE
        Source Possibility  POSSIBILITY-OBSERVER-COMMAND
    INTENT-ENTITY-ADDRESSABLE-001
        Source Goal         GOAL-DEBUG-ONE-SURFACE
        Source Possibility  POSSIBILITY-ENTITY-NAMED

## EXISTING INTENT DELTA
    REUSED
        INTENT-ATTRIBUTE-MUTATE-001   (C007 R2) 값을 바꾸는 의미 그대로다. 판정도 허용
                                      범위도 세계의 권한도 그대로 쓴다. 이번에 더해지는
                                      것은 그것을 거는 길과 그 대답이다
        INTENT-ATTRIBUTE-OBSERVE-001  (C007 R2) 바뀐 값이 보이는 경로 그대로다
        INTENT-COLLISION-OBSERVE-001  (C006) 충돌체 관찰의 의미 그대로다.
                                      이번 Cycle 은 그것을 다시 만들지 않는다
        INTENT-REMOTE-REQUEST-001     (C003) 요청이 선을 타고 간다는 것 그대로다
        INTENT-REQUEST-ATTRIBUTION-001 (C004) 요청이 보낸 관찰자에게 귀속된다는 것 그대로다.
                                      대답이 누구에게 갈지도 이 귀속이 정한다
        INTENT-WORLD-CLOCK-001        (C003) 세계는 명령을 받는 동안에도 자기 시계로 돈다.
                                      명령은 세계를 멈추지 않는다
        INTENT-PER-OBSERVER-PROJECTION-001 (C004) 명령 목록도 관찰 결과에 실려
                                      관찰자에게 간다

    CHANGED
        INTENT-ATTRIBUTE-MUTATE-001
            기존  받아들여지지 않은 요청은 그 이유를 남긴다
            변경  그 이유가 요청한 이에게 되돌아간다 (INTENT-REQUEST-REPLY-001).
                  "남긴다" 와 "닿는다" 사이에 길이 없었다 — 그 길을 낸다.
                  판정 자체는 하나도 바뀌지 않는다

        INTENT-WORLD-OBSERVATION-001
            기존  세계는 자기 상태를 관찰 가능하게 밝힌다
            변경  세계는 자기 상태에 더해 "자신에게 걸 수 있는 것" 도 밝힌다 (R1).
                  전자는 세계가 지금 어떠한가이고, 후자는 세계에 무엇을 할 수 있는가다.
                  둘이 같은 것인지 다른 것인지는 World Semantic 이 판정한다

    AFFECTED
        INTENT-MOVE-BY-VIEW-001       (C008) 명령을 쓰는 동안 방향키는 몸을 움직이지 않는다.
                                      이동의 의미가 바뀌는 것이 아니라 입력이 어디로 가는지가
                                      갈릴 뿐이다 — 관찰자 쪽의 일이다
        INTENT-VIEWPOINT-ORIENT-001   (C008) 같은 이유로 시점 조작 키도 명령을 쓰는 동안
                                      시점을 돌리지 않는다
        INTENT-ACTION-STATE-001       (C002) 명령을 쓰는 동안 행동이 시작되지 않는다.
                                      이미 진행 중인 행동은 지금까지대로 끝까지 간다 —
                                      세계는 관찰자가 무엇을 쓰고 있는지 모른다
        INTENT-TEMPO-MOVE-001         (C007) 이동 속도가 명령으로 바뀌면 세계는 그 값으로
                                      지금까지대로 판정한다. 규칙이 달라지지 않는다
        INTENT-RUN-001                (C007) 달리기 배율이 바뀌어도 기력이 흐르는 규칙은 그대로다
        INTENT-TEMPO-ACTION-001       (C007) 행동 속도가 바뀌면 행동 길이와 충돌체 활성 구간이
                                      지금까지대로 그에 따라 줄고 는다
        INTENT-DOWNED-001             (C007) 생명을 명령으로 되돌리면 쓰러진 몸이 일어난다.
                                      C007 R2 가 이미 정한 것이며 이번에 처음으로 실제로
                                      걸 수 있게 된다
        INTENT-ENTITY-IDENTITY-001    (C007) 존재의 이름은 사람이 읽는 것이었다.
                                      이제 지목의 실마리로도 쓰인다 —
                                      이름과 지목 수단이 같은 것인지는 World Semantic 이 판정한다

## BOUNDARY FOR NEXT STAGE
    다음 단계가 판정해야 할 것 셋. Intent 는 여기서 답을 정하지 않는다.

    1  명령 목록은 세계의 상태인가 세계의 성질인가
       World State 로 두면 세계마다 다를 수 있고, 성질로 두면 어느 세계나 같다.
       INTENT-COMMAND-CATALOG-001 이 요구하는 것은 "세계가 밝힌다" 까지다.

    2  세계의 대답은 새 World State 를 필요로 하는가
       세계가 대답을 쌓아 두었다가 관찰 결과에 실어 보내는 것인지,
       판정 직후 그 자리에서 돌려보내는 것인지에 따라 다르다.
       INTENT-REQUEST-REPLY-001 이 요구하는 것은 "요청한 이에게 닿는다" 까지다.

    3  지목 수단은 이름인가 다른 것인가
       INTENT-ENTITY-IDENTITY-001 의 이름은 변하지 않는 것이지만 서로 겹칠 수 있다.
       겹치는 이름으로 지목이 성립하는지는 World Semantic 이 정한다.
