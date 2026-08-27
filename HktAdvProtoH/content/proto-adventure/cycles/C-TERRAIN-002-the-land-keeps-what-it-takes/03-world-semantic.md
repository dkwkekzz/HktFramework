# C-TERRAIN-002 — World Semantic

> Intent 의 중심은 한 줄이다 — **거두어 간 만큼이 거두어 간 자리에 쌓인다.**
> 그래서 이 문서에서 새로 서는 State 는 자리 안의 값 둘(지닌 것 · 지금 어느 단계인가)과
> 법칙 정의의 항 셋(넘침 지점 · 뿜는 속도 · 흩어지는 속도)뿐이며, 규칙은 하나가 바뀌고
> 하나가 는다. 몸에는 아무것도 늘지 않는다.

## SEMANTIC DELTA

    REUSED — 한 줄도 바꾸지 않고 그대로 쓴다

        GroundZone.id · law · center · radius        world/semantic/terrain.ts (C-TERRAIN-001)
        isInsideGroundZone                           그 안인가 — 몸의 반경을 더하지 않는다
        GroundLawDefinition.takes · rate · lifeRate   거두는 것과 그 속도
        WorldState.groundZones                       자리가 State 라는 것. C-TERRAIN-001 이
                                                     "예외가 사라질 수 있다는 것이 이 세계의
                                                     원칙" 이라며 미리 두었다
        ActorState.warmth · warmthMax                 몸이 지닌 열과 그 최대. **늘지 않는다**
        WORLD_BOUNDS · SPAWN_POINTS · TICK_INTERVAL   무대와 시간
        RULE-MOVE-001 · RULE-DOWNED-001               걸어 들어가는 일과 끝의 형태
        RULE-CP-RUN-DRAIN-001                         머무는 동안 값이 흘러나가는 선례

    ADDED

        GroundZone.kept                  그 자리가 지금 지닌 것 (거두어 쌓인 양)
        GroundZone.phase                 binding | venting — 지금 거두는 중인가 뿜는 중인가
        GroundLawDefinition.saturation   넘침 지점. 이 값에 이르면 뿜기 시작한다
        GroundLawDefinition.ventRate     뿜을 때 그 자리 안의 몸이 초당 받는 양
        GroundLawDefinition.escapeRate   받는 몸이 없을 때 초당 흩어지는 양
        RULE-GROUND-VENT-001             넘침 · 뿜음 · 되돌려줌 · 닫힘

    CHANGED

        GroundZone.role (GroundZoneRole)   **삭제된다.**
            'law' 와 'respite' 가 사라진다. 모든 자리는 자기 법칙의 맥이며, 법칙이 멎는
            자리는 놓이는 것이 아니라 `phase = 'venting'` 인 자리다
            (INTENT-THE-EXCEPTION-IS-NOT-PLACED-001).
            **이 세계에서 영구히 안전한 자리를 적을 방법이 없어진다.**

        RULE-GROUND-LAW-APPLY-001
            NEW TRANSITION   거두어 간 만큼을 **받는 자리**의 kept 에 더한다
            NEW PRECONDITION 거두는 자리는 `phase = 'binding'` 인 자리뿐이다
            CHANGED          멎음의 판정이 `role='respite'` 에서
                             `phase='venting'` 으로 옮겨 간다 (같은 법칙에 한한다 — 그대로)

        isSheltered(zones, position, law)
            같은 법칙의 **뿜는 중인** 자리 안인가를 묻는다 (was: role='respite' 인 자리)

        activeGroundLaws → bindingZonesAt(zones, position)
            돌려주는 것이 법칙의 이름이 아니라 **자리**가 된다 — 보존은 받는 자리를
            지목해야 성립하기 때문이다. 법칙 이름만 필요한 곳은 이 결과에서 뽑아 쓴다.
            한 법칙당 하나를 돌려주는 규율은 그대로다

        coveringGroundLaws(zones, position)
            `role === 'law'` 걸러내기가 사라진다 — 모든 자리가 법칙의 자리다

        GROUND_ZONES 초기 배치
            법칙 자리 하나 + 예외 자리 하나 → **맥 넷.** 오늘의 해숨구멍은 지워지지 않고
            "세계가 시작할 때 이미 넘쳐 뿜는 중인 맥" 이 된다 (아래 BALANCE)

        STATE_VERSION   `proto-adventure/2` → `proto-adventure/3`
            GroundZone 의 형태가 바뀐다(role 삭제 · kept · phase 추가). 형태를 바꾼
            Cycle 이 버전을 올릴 책임을 진다 — 올리지 않으면 옛 스냅샷이 복구되어
            role 만 있는 자리 위에서 새 규칙이 돈다

    AFFECTED

        RULE-DOWNED-001            빙원에서 끝에 이르는 몸이 줄어든다 — 뿜는 자리에서
                                   되받을 수 있게 되었기 때문이다. 규칙은 한 줄도 안 바뀐다
        projectGroundSelf          멎음의 뜻이 갈라진다 (아래 OBSERVABLE — `warming` 추가)
        관찰의 zones 투영           role 대신 phase · fill 을 싣는다 (04 가 확정한다)
        world/tests/terrain.spec.ts · view/tests/terrain.spec.ts
                                   C-TERRAIN-001 의 검사 전부가 회귀 기반이다. `role` 을
                                   쓰는 검사와 "한 점도 돌아오지 않는다" 검사는 이 Cycle 의
                                   변경을 반영해 고쳐 쓴다 (08 REGRESSION 이 목록을 갖는다)
        RULE-MINE-001 · 전투 계통 · 소지품 · 장비
                                   한 줄도 닿지 않는다. 빙원은 광맥·순회 경로·시작 자리
                                   어디와도 닿지 않는다 (BALANCE 4)

## WORLD STATE

    GroundZone                                                   World Authority
        id           string          같은 자리를 프레임 사이에 잇는 이름         (REUSED)
        law          GroundLawId     어느 법칙의 맥인가                        (REUSED)
        center       WorldPosition   범위의 중심                              (REUSED)
        radius       number          범위의 반지름                            (REUSED)
        kept         number          지금 지닌 것. 0 이상, saturation 을 넘지 않는다 (ADDED)
        phase        GroundZonePhase binding | venting                        (ADDED)

        **자리는 이제 어떤 Rule 도 바꾸지 않는 목록이 아니다.** C-TERRAIN-001 이 그것을
        상수가 아니라 State 로 둔 이유가 여기서 쓰인다 — 이사가 따라붙지 않는다.
        자리의 **배치**(id · law · center · radius)는 여전히 어떤 Rule 도 바꾸지 않는다.
        바뀌는 것은 자리가 지닌 것과 그 단계뿐이다.

    GroundZonePhase                                              World Authority (파생 아님)
        'binding'    거두는 중 — 그 자리 안의 몸에서 법칙이 거두어 간다
        'venting'    뿜는 중 — 그 자리에서 법칙이 멎고, 지닌 것을 내보낸다

        **phase 를 kept 에서 매번 계산하지 않고 State 로 둔다.** 계산하면 `kept ≥ saturation`
        인 동안만 뿜는 것이 되어 넘친 순간 곧바로 아래로 떨어지고, 뿜음은 **한 Tick** 만
        일어난다. 뿜는 일이 시간을 지니려면 "넘쳤다" 와 "뿜는 중" 이 갈라져야 한다.
        이것은 몸에 판정을 적는 것과 다르다 — 적히는 곳이 몸이 아니라 세계이며,
        DC-CONDITION-OPENS-WITHOUT-RECORDING 은 몸에 대해 그대로 참이다
        (INTENT-THE-RECORD-IS-IN-THE-LAND-NOT-THE-BODY-001).

    GroundLawDefinition                                          World 성질 (State 아님)
        takes        'warmth'   무엇을 거두어 가는가                          (REUSED)
        rate         number     초당 거두는 양                               (REUSED)
        lifeRate     number     다한 뒤 초당 생명에서 거두는 양                (REUSED)
        saturation   number     넘침 지점 — kept 가 이에 이르면 뿜기 시작한다   (ADDED)
        ventRate     number     뿜을 때 그 자리 안의 몸 하나가 초당 받는 양     (ADDED)
        escapeRate   number     받는 몸이 없을 때 초당 흩어지는 양             (ADDED)

        셋 다 **자리가 아니라 법칙이 지닌다.** 자리마다 손으로 정하는 값이면 "이 자리는
        오래 열려 있다" 를 적을 수 있게 되고, 그것은 놓인 예외가 이름을 바꿔 돌아온 것이다
        (INTENT-GROUND-LAW-IS-CONDITION-AND-RESULT-001).

    ActorState                                                   변경 없음
        warmth · warmthMax    한 항목도 늘지 않는다. 몸은 이 Cycle 에서 아무것도
                              새로 지니지 않는다 — **쌓이는 것은 땅이다**

## WORLD RULE

    RULE-GROUND-LAW-APPLY-001 (CHANGED)

        Implements     INTENT-THE-LAND-KEEPS-WHAT-IT-TAKES-001 ·
                       INTENT-ONE-PLACE-RECEIVES-WHAT-IS-TAKEN-001 ·
                       INTENT-VENTING-STOPS-THE-LAW-THERE-001 ·
                       (C-TERRAIN-001 의 Implements 전부 그대로)
        Input          모든 Actor, dt
        Preconditions  1. Actor 가 쓰러지지 않았다                            (REUSED)
                       2. `phase = 'binding'` 인 자리 안에 있다                (CHANGED)
                       3. **같은 법칙의** `phase = 'venting'` 인 자리 안에 있지 않다 (CHANGED)
        Transition     법칙마다 **받는 자리 하나**를 정한다 (아래 ReceivingZone).
                       Warmth > 0 이면   taken = min(Warmth, Law.rate × dt)
                                         Warmth −= taken
                                         **ReceivingZone.kept += taken**
                                         (kept 는 saturation 을 넘지 않는다 — 넘는 몫은
                                          그 자리에 들어가지 못하고 흩어진다)
                       Warmth = 0 이면   Hp = max(0, Hp − Law.lifeRate × dt)
                                         Hp 가 0 이 되면 RULE-DOWNED-001
                                         **kept 는 늘지 않는다** — 아래 RATIONALE 1
        Result         Taken(law, zone, amount) | Sheltered(law) | Untouched

        ReceivingZone(law, position)
            그 법칙의 자리 중 ① position 을 품고 ② `phase = 'binding'` 인 것들 가운데
            **중심이 가장 가까운** 자리. 같으면 groundZones 의 앞선 것.
            거두는 일이 법칙당 한 번이므로 받는 자리도 하나여야 한다 — 둘에 나누어 넣거나
            양쪽에 같은 만큼 넣는 것은 없던 열을 만들거나 지우는 일이다
            (INTENT-ONE-PLACE-RECEIVES-WHAT-IS-TAKEN-001).
            **판정은 위치와 자리의 배치만 읽는다** — 누구인지도 무엇을 하는 중인지도 묻지 않는다.

    RULE-GROUND-VENT-001 (ADDED)

        Implements     INTENT-A-FULL-PLACE-VENTS-001 ·
                       INTENT-VENTING-SPENDS-WHAT-WAS-KEPT-001 ·
                       INTENT-WHAT-THE-LAND-RETURNS-THE-BODY-RECEIVES-001 ·
                       INTENT-THE-EXCEPTION-IS-NOT-PLACED-001 ·
                       INTENT-WHERE-YOU-STOOD-DECIDES-WHERE-OPENS-001
        Input          모든 GroundZone, 모든 Actor, dt
        Preconditions  없음 — 모든 자리를 훑는다. 자리마다 자기 단계가 무엇을 할지 정한다
        Transition     자리마다 (groundZones 순서로):

                       ① phase = 'binding' 이고 kept ≥ Law.saturation
                              → phase = 'venting'                    (넘쳤다)

                       ② phase = 'venting'
                              그 자리 안의 **쓰러지지 않은** 몸마다 (actors 순서로)
                                  give = min(Law.ventRate × dt,
                                             Actor.warmthMax − Actor.warmth,
                                             남은 kept)
                                  Actor.warmth += give
                                  kept        −= give
                              아무 몸도 받지 못했으면 (준 것의 합 = 0)
                                  kept −= min(kept, Law.escapeRate × dt)   (흩어진다)
                              kept ≤ 0 이면
                                  kept = 0
                                  phase = 'binding'                  (닫혔다)
        Result         Brimmed(zone) | Vented(zone, given) | Escaped(zone) | Closed(zone) |
                       Filling(zone)

        Tick 순서      RULE-GROUND-LAW-APPLY-001 **바로 뒤**.
                       거두는 일이 이 Tick 의 kept 를 먼저 확정하고, 그 결과가 넘침인지를
                       같은 Tick 에서 묻는다 — 그래서 "찼다" 와 "열린다" 사이에 한 Tick 의
                       틈이 없다. 지목 정리(RULE-TARGET-CLEAR-STALE-001)보다는 앞이다 —
                       앞선 규칙이 몸을 쓰러뜨릴 수 있다는 이유가 그대로 선다.

## OBSERVABLE SEMANTIC

    자리마다 (모든 관찰자에게 같다 — 무대는 몸에 딸리지 않는다)

        GroundZone.law                      어느 법칙의 맥인가                (REUSED)
        GroundZone.center · radius          범위                             (REUSED)
        GroundZone.phase                    거두는 중인가 뿜는 중인가          (ADDED)
        GroundZone.kept / Law.saturation    지금 얼마나 찼는가 — 0..1        (ADDED)

        **`kept` 를 날값으로 싣지 않고 비율로 싣는다.** 화면이 "60 중 45" 를 읽으려면
        saturation 을 알아야 하고, 그 순간 화면이 넘침을 스스로 판정할 수 있게 된다
        (DC-WORLD-OWNS-THE-SURFACE-LIST). 세계가 이미 나눈 값을 준다.
        비율의 이름은 04 가 정한다.

    이 몸에게 (INTENT-PER-OBSERVER-PROJECTION-001 — 내 몸의 것만)

        지금 걸린 법칙과 그 상태
            taking      거두어 가는 중이다                              (REUSED)
            warming     뿜는 자리 안이고 **받는 중**이다                 (ADDED)
            sheltered   뿜는 자리 안이지만 받지 않는다 (몸이 이미 가득하다) (CHANGED — 뜻)
            none        어떤 법칙도 걸려 있지 않다                       (REUSED)
        무엇을 거두어 가는가 / 무엇을 받는가 (Law.takes)                   (REUSED)
        지닌 열과 그 최대 (self.warmth · self.warmthMax)                  (REUSED)

        **`warming` 이 `sheltered` 와 갈라지는 것이 이 Cycle 의 관찰의 요점이다.**
        멎기만 하는 자리와 되돌려주는 자리가 한 코드로 묶이면
        INTENT-WHAT-THE-LAND-RETURNS-THE-BODY-RECEIVES-001 은 세계에는 있으나 관찰에는
        없는 것이 되고, 플레이어는 자기 열이 왜 늘었는지 알 수 없다.

    실패 사유가 필요한 자리는 없다
        이 Cycle 은 Action 을 하나도 더하지 않는다 — 입력은 여전히 걸어 들어가고
        나오는 것뿐이다 (INTENT-STANDING-IS-THE-WHOLE-INPUT-001). 거절되는 요청이
        없으므로 거절 사유도 없다.

## BALANCE

    이 절은 값의 근거다. 값 자체는 결정론에 영향을 주므로 헤더 상수로 고정하고
    CVar 로 열지 않는다 (C-TERRAIN-001 과 같은 판단).

    1. heat-binding 의 값

        rate        4.0   (REUSED)  가득한 몸(100)이 25초를 버틴다
        lifeRate    2.0   (REUSED)
        saturation   60             **한 몸이 지닌 것의 60% 로 자리 하나를 넘치게 한다.**
                                    빈 자리를 혼자 힘으로 넘치게 하려면 15초를 머물러야
                                    하고 열 60 을 치른다 — 스쳐 지나는 것(반경 5 를
                                    가로질러도 1.7초 · 열 7)으로는 결코 넘치지 않는다.
                                    **머무는 것과 지나는 것이 갈리는 자리가 이 값이다**
        ventRate     6.0            뿜는 자리에서 초당 6 을 받는다 — 거두는 속도보다 빠르다.
                                    가득 찬 자리(60)를 혼자 다 받아 가는 데 10초.
                                    거두는 쪽보다 느리면 "돌려받는다" 가 플레이에서
                                    "덜 잃는다" 로 읽히고, 그것은 다른 뜻이다
        escapeRate   1.5            아무도 받지 않는 분출구는 40초 만에 닫힌다.
                                    **이 값이 "어제 쉬어 간 자리가 오늘은 닫혀 있다" 를
                                    한 판 안에서 겪히게 하는 값이다.** 0 이면 아무도
                                    쓰지 않은 자리는 영영 열려 있고 예외는 다시 상수가 된다

    2. 맥 넷의 배치

        빙원 하나(중심 (-11, 11) · 반경 7)를 **맥 넷**(반경 5)으로 바꾼다. 넷의 합집합이
        옛 빙원과 대략 같은 자리를 덮으므로 밖에서 보는 무대는 달라지지 않는다.

            zone-vein-1   (-13.5, 13.5)   kept 60   venting    **오늘의 해숨구멍**
            zone-vein-2   ( -8.5, 13.5)   kept 45   binding
            zone-vein-3   (-13.5,  8.5)   kept 15   binding
            zone-vein-4   ( -8.5,  8.5)   kept 30   binding    시작 자리에서 가장 가까운 맥

        넷이 서로 겹친다 (중심 사이 5.0 · 반경 5.0). 겹친 자리에서도 거두는 일은 한 번만
        일어나고(C-TERRAIN-001 이 법칙당 하나로 정했다) 받는 자리는 중심이 가까운 쪽이다 —
        그래서 **맥의 중심 가까이 머무를수록 그 맥이 빨리 찬다.**

        오늘의 해숨구멍이 (-13.5, 13.5) 인 것은 C-TERRAIN-001 이 (-13, 13) 에 손으로
        놓았던 자리와 거의 같다. **자리가 옮겨 간 것이 아니라 그 자리의 이유가 바뀌었다** —
        "여기는 안전한 곳이다" 에서 "여기는 지금 넘쳐 뿜는 중인 맥이다" 로.

    3. 첫 판에 무엇이 일어나는가

        시작 자리(0, 0)에서 빙원까지 걸어가면 가장 먼저 닿는 것이 zone-vein-4 다
        (중심까지 12.0). 그 맥은 60 중 30 이 차 있다 — **가로질러 지나가면 열리지 않고,
        7.5초를 머물면 열린다.** 그 사이 몸은 30 을 치른다 (100 → 70).

        열려 있던 zone-vein-1 은 그동안 흩어진다. 아무도 받지 않으면 40초, 그 안에 서서
        받으면 10초에 닫힌다. **그래서 한 판 안에서 열린 자리가 옮겨 간다** — 내가 머문
        곳이 열리고, 내가 쉬어 간 곳이 닫힌다. 그것이 이 Cycle 의 Goal 이다.

        가장 값싼 길은 zone-vein-1 로 곧장 걸어가 받는 것이다(원점에서 19, 자리 안을
        지나는 동안 약 8 을 치른다). 그러면 몸은 곧 가득 차고 더 받지 않으므로
        `warming` 이 `sheltered` 로 바뀐다 — **가득한 몸은 분출구를 소모하지 않는다.**

    4. 기존 플레이는 한 걸음도 달라지지 않는다

        맥 넷의 합집합(대략 x −18.5..−3.5 · z 3.5..18.5)은 시작 자리 다섯, npc-1 의
        지키는 자리((-10, -8) 반경 7), npc-1 의 순회 경로, npc-2 의 순회 경로
        ((12,8)–(4,12)), 광맥((8, -6)) 어디와도 닿지 않는다. 무대 경계(±20) 안에 든다.
        자율 존재는 여전히 빙원에 들어가지 않는다 — 배치의 결과이지 규칙의 예외가 아니다.

    5. 무엇이 세계 전체에 대해 참인가

        열의 총량은 **거둠으로 줄지 않는다.** 줄어드는 자리는 둘뿐이다 —
        몸이 다 잃은 뒤 생명에 닿을 때(그 몫은 kept 로 가지 않는다 · RATIONALE 1)와,
        뿜는 자리에서 받는 몸이 없어 흩어질 때. 두 자리 다 **까닭이 적혀 있고**
        관찰된다. 늘어나는 자리는 없다.

## RATIONALE

    1. 생명에서 거둔 몫은 왜 자리에 쌓이지 않는가

       법칙이 거두어 가는 것은 `takes = 'warmth'` 다. 열이 다한 뒤 생명에 닿는 것은
       거두는 일이 아니라 **거둘 것이 없어진 뒤의 결과**이며, 두 값의 단위가 다르다.
       쌓으려면 환산이 필요하고, 환산은 이 Cycle 이 답할 이유가 없는 물음이다
       (C-TERRAIN-001 03 RATIONALE 3 이 이미 같은 이유로 한 Tick 안의 넘김을 거절했다).

       그래서 **세계의 열은 몸이 얼어 죽는 자리에서만 준다.** 그것이 이 세계에서
       열이 사라지는 유일한 길이며, 까닭이 적혀 있다.

    2. kept 가 saturation 을 넘지 못하게 잘라 내는 것은 열을 지우는 일 아닌가

       그렇다. 그리고 그 몫은 뿜기 시작한 자리에서 흩어지는 것과 같은 종류다 —
       **그릇이 넘치면 넘친 것은 그릇 밖으로 간다.** 자르지 않으면 kept 가 무한히 자라
       한 번 크게 찬 자리가 영영 닫히지 않는 분출구가 되고, 그것은 상수로 놓인 예외가
       다른 이름으로 돌아온 것이다.

       한 Tick 에 잘리는 양은 많아야 `rate × dt`(0.13)이며, 실제로 잘리는 것은 넘치는
       그 한 Tick 뿐이다 (다음 Tick 부터 그 자리는 venting 이라 아무것도 받지 않는다).

    3. 왜 뿜는 자리는 거두지 않는가 — 뿜으면서 거두면 안 되는가

       뿜는 자리가 동시에 거두면 그 자리는 **자기가 준 것을 도로 받아** 영영 닫히지
       않는다 (ventRate 6 · rate 4 이므로 순환이 멎지 않는다). 반복이 서지 않는다.

       의미로도 그렇다. C-TERRAIN-001 이 세운 규율은 "예외는 법칙 옆이 아니라 법칙
       안에 있다" 였고, 그 예외의 내용은 **그 법칙이 멎는 것**이다. 뿜음이 곧 멎음이다.

    4. 왜 몸에는 아무것도 늘지 않는가

       몸이 "얼마나 오래 있었는지" 나 "어느 자리에 있는지" 를 지니면 그것을 지우는
       규칙이 필요해지고 그 규칙이 빠지는 자리가 생긴다
       (DC-CONDITION-OPENS-WITHOUT-RECORDING). 이 Cycle 이 State 를 더하는 곳은
       **땅뿐**이며, 땅의 State 는 판정을 위한 기록이 아니라 세계가 겪은 일의 결과다 —
       광맥의 남은 자원(C001)과 같은 종류다.

    5. 왜 phase 를 자리마다의 값으로 두고 법칙에 두지 않는가

       법칙은 여러 자리에 걸린다. 한 맥이 뿜는 동안 다른 맥은 거둔다 — 그것이
       "예외가 어디에 생기는가는 어디서 거두었는가의 결과다" 의 전부다. 법칙에 두면
       빙원 전체가 한꺼번에 열리고 한꺼번에 닫히며, 옮겨 다니는 것이 없어진다.

## SEMANTIC CLOSURE

    "거두어 간 것이 사라지지 않는다"        → RULE-GROUND-LAW-APPLY-001 Transition
                                             (Warmth −= taken · ReceivingZone.kept += taken)
    "그 자리에 쌓인다"                      → GroundZone.kept
    "한 자리로만 간다"                      → ReceivingZone (법칙당 하나 · 중심이 가장 가까운)
    "쌓이는 것은 땅이지 몸이 아니다"          → ActorState 변경 없음 · GroundZone.kept
    "넘침 지점에 이르면 뿜기 시작한다"        → RULE-GROUND-VENT-001 ① · Law.saturation
    "뿜는 동안 그 자리에서 법칙이 멎는다"     → RULE-GROUND-LAW-APPLY-001 Precondition 2·3
                                             (binding 인 자리만 거둔다 · venting 이 멎게 한다)
    "뿜는 일은 쌓인 것을 쓴다"               → RULE-GROUND-VENT-001 ② (kept −= give / escape)
    "다 쓰면 멈추고 도로 거둔다"             → RULE-GROUND-VENT-001 ② (kept ≤ 0 → binding)
    "그 자리 안의 몸이 받는다"               → RULE-GROUND-VENT-001 ② (Actor.warmth += give)
    "지닐 수 있는 만큼까지만"                → give 의 min 에 warmthMax − warmth
    "받는 몸이 없으면 흩어진다"              → RULE-GROUND-VENT-001 ② (escapeRate)
    "법칙이 멎는 자리를 손으로 놓지 않는다"   → GroundZone.role 삭제 (CHANGED)
    "영구히 안전한 자리를 적을 수 없다"       → 같은 자리 — 적을 형이 없다
    "어디가 열리는가는 어디서 거두었는가의 결과" → ReceivingZone + RULE-GROUND-VENT-001 ①
    "얼마나 찼는지가 읽힌다"                 → OBSERVABLE (kept / saturation)
    "뿜는 중인지가 읽힌다"                   → OBSERVABLE (phase)
    "받는 중인 것이 읽힌다"                  → OBSERVABLE (self state = warming)
    "화면은 아무것도 판정하지 않는다"         → 비율로 실어 보낸다 (saturation 을 싣지 않는다)

    닫히지 않은 문장 없음.
