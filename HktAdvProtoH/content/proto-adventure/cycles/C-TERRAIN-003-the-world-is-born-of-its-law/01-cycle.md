# CYCLE C-TERRAIN-003 — 세계가 법칙에서 태어난다

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[PASS] World Implementation
[PASS] View Implementation
[PASS] Verification

STATUS  IN PROGRESS

> ## 왜 이것인가 — Human 이 순서를 세웠다
>
> BT §1 은 대지형을 이렇게 정의한다.
>
>     World Principle
>     ↓
>     대륙 규모의 변화
>     ↓
>     산맥·수계·대기·생태 형성
>     ↓
>     살아남은 존재의 적응
>     ↓
>     희귀한 자연 자원
>     ↓
>     그 자원을 이용하는 생명과 사람
>     ↓
>     고유한 탐험 경험
>
> Human 지시 — **이 과정이 가장 먼저 설립되는 것이다.** 지금 세계는 이 사슬의
> 아래쪽 발현(열을 거둔다 · 뿜는다)은 지녔으나, 사슬의 **머리** — 원리가 세계를
> 낳는다는 것 — 가 코드에 없다. 자리 넷은 손으로 놓인 상수이고
> (`world-state.ts` GROUND_ZONES — "어떤 Rule 도 이 목록을 바꾸지 않는다"),
> "왜 여기에 이 자리가 있는가" 에 세계가 답하지 못한다. 이 Cycle 이 그 머리를 세운다 —
> 놓는 손을 법칙으로 바꾼다.

## MASTER TRACE
    Frontier             FR-THE-WORLD-IS-BORN-OF-ITS-LAW
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Target Capability    없음 — 세우는 것은 능력이 아니라 세계 노드다 (C-TERRAIN-001·002 선례).
                         MW-SHAPED-LANDFORM (ABSENT — "자리의 경계는 원으로 그려진
                         범위이지 순환이 빚은 생김새가 아니다") 이 이 Cycle 이 여는 노드이고,
                         MW-WORLD-PRESSURE (ABSENT — "표현될 자리가 없다") 가 그 표현
                         자리를 처음 얻는다
    Active Constraints   DC-WORLD-TERRAIN-IS-A-PRINCIPLE ·
                         DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST ·
                         DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE
    Constraint Note      OWNS-THE-SURFACE-LIST 는 UNRESOLVED 로 넘어간다 — 관찰에 무엇을
                         싣는가는 04 가 정한다. LAW-IS-OBSERVABLE 도 UNRESOLVED — 생김새
                         관찰의 범위는 03·04 가 정한다. 예고(증거가 먼저 온다)는 이
                         Cycle 의 몫이 아니다 (FR-THE-LAND-SHOWS-BEFORE-IT-TAKES)

## TYPE
    New Capability

    세계에 **생성**이라는 것이 아직 없다. 세계가 만들어질 때 일어나는 일은 상수 목록을
    베끼는 것뿐이다 — 자리도, 광맥도, 시작 자리도 전부 손으로 놓인다. 이 Cycle 이
    처음으로 "세계가 만들어진다" 를 법칙의 실행으로 만든다.

## TARGET CAPABILITY
    World Genesis — 원리(에너지의 분포)로부터 무대의 자리들이 유도되는 것

    Master 의 Capability 하나를 IMPLEMENTED 로 바꾸는 Cycle 이 아니다 (위 MASTER TRACE).
    BT §1 사슬의 머리 고리 — 원리 → 대륙 규모의 변화 → 생김새 — 를 세계의 실제 생성
    원리로 만든다.

## GOAL
    Player 가 들어가는 세계의 땅이 만들어진 것이 아니라 태어난 것이 된다 —
    씨앗이 다르면 다른 땅을 만나고, 어느 땅에서든 자리의 배치가
    법칙의 결과로 읽힌다.

    **"왜 여기에 이 자리가 있는가" 에 처음으로 세계가 답한다.**

## INCLUDED
    에너지의 분포      세계가 만들어질 때 세계압(에너지)이 매질에 결속된 분포가 먼저
                       선다. 그 분포가 어디에 맥이 서고 어디가 비는지를 정한다.
                       분포를 낳는 것이 무엇인지(씨앗 · 법칙의 정의)는 03 이 정한다
    자리의 유도        GroundZones 의 위치 · 범위 · 처음 지닌 것(kept · phase)이 전부
                       그 분포에서 계산된다 — 손배치 상수 GROUND_ZONES 가 사라진다.
                       "시작할 때 이미 도는 중" (수천 년의 결속)을 손 대신 법칙이 계산한다
    결정론             같은 씨앗이면 같은 세계다. 씨앗은 세계를 띄우는 쪽이 밝힌다
                       (World.ChanceSeed 선례 — C015). 생성은 세계가 만들어질 때
                       한 번이다
    생김새의 관찰      그 분포가 화면에서 구분되어 보인다 — 자리의 경계선이 아니라
                       땅의 성질로. 무엇을 싣는지는 04 가 확정한다
                       (DC-WORLD-OWNS-THE-SURFACE-LIST)

## EXCLUDED
    작용 전의 예고     FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 의 몫. 이 Cycle 은 "이미 있는
                       것이 어디서 왔는가" 까지다 — "다음에 무엇이 오는가" 가 아니다
    여덟 대지형        법칙은 여전히 하나(heat-binding)다. 생성 원리가 법칙 하나로
                       서는지만 본다 — 둘째 법칙을 더하는 것은 이 Cycle 이 아니다
    지오메트리         산맥·수계·대기의 높낮이와 형태가 아니다 — 무대는 여전히 평면이고,
                       생김새는 자리의 분포와 성질까지다
    적응 · 자원 · 사람  BT §1 사슬의 ④⑤⑥ 고리 — 각자의 근거 문서 승인이 먼저다
                       (Design-Creature-Behavior-R0 · Design-Resource-Catalog-R0,
                       frontier/terrain.md "지금 열 수 없는 것")
    런타임 자리 생성    돌기 시작한 뒤 자리가 새로 생기고 사라지는 것이 아니다 —
                       도는 시간은 순환(C-TERRAIN-002)이 이미 소유한다. 이 Cycle 은
                       시작점 자체를 법칙의 결과로 만든다
    지역 · 깊이        MW-ZONE-* (깊이 층)는 대지형과 직교하는 축이다 (HISTORY Q47(a)) —
                       이 Cycle 이 세우지 않는다

## RELATED EXISTING CAPABILITY

    재사용 대상 — 이 Cycle 이 다시 만들지 않는 것

        씨앗 하나에서 결정론적으로 갈라지는 형태
            world/semantic/world-state.ts#ChanceSeed (C015) — "세계가 만들어질 때
            정해지고 어떤 규칙도 바꾸지 않는다"
        자리 · 법칙 · 순환
            world/semantic/terrain.ts#GroundZone · GROUND_LAWS · kept/saturation/venting
            (C-TERRAIN-001 · 002) — 태어난 자리가 도는 방법은 전부 이미 있다
        자리가 상수가 아니라 State 인 자리
            world/semantic/world-state.ts#WorldState.groundZones — 주석이 "예외가
            사라질 수 있다는 것이 원칙" 으로 이 미래를 예약해 두었다
        그리는 자리
            SceneGroundZone (ENGINE) — C-TERRAIN-002 가 fill 의 맥동으로 쓰는 중이다

    영향 가능 대상 — 변경 여부를 03 이 판정한다

        world/semantic/world-state.ts#GROUND_ZONES — 손배치 상수. 이 Cycle 의 주 대상 —
                        생성이 서면 이 상수의 지위가 바뀐다 (CHANGED 후보)
        SPAWN_POINTS 와 자리의 관계 — 시작 자리가 빙원과 닿지 않는 것을 지금은 손배치가
                        보장한다. 배치가 태어나면 그 보장을 누가 하는가 — 03 이 정한다
        STATE_VERSION — 생성이 State 의 형태를 바꾸면 버전을 올린다 (C-TERRAIN-002 선례)
        기존 테스트 — 고정 배치(zone-vein-1~4)를 전제한 검증이 있으면 영향을 받는다
