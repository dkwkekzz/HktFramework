# C-TERRAIN-003 — World Semantic

> Intent 의 중심은 한 줄이다 — **자리보다 먼저 에너지의 분포가 선다.**
> 그래서 이 문서에서 새로 서는 것은 태어남의 뿌리 하나(씨앗), 법칙 정의의 항 셋
> (맥의 수 · 범위 · 이웃 거리), 결속이 닿지 않는 자리들(QuietGround), 그리고 세계가
> 만들어질 때 한 번 도는 규칙 하나뿐이다. **돌기 시작한 뒤의 규칙은 한 줄도 바뀌지
> 않는다** — 손배치 상수 GROUND_ZONES 가 사라지는 것이 이 Cycle 의 전부다.

## SEMANTIC DELTA

    REUSED — 한 줄도 바꾸지 않고 그대로 쓴다

        GroundZone (id · law · center · radius · kept · phase)   자리의 형태 전부
        GroundLawDefinition 의 기존 항 여섯                      takes · rate · lifeRate ·
                                                                saturation · ventRate · escapeRate
        isInsideGroundZone · bindingZonesAt · isSheltered ·
        ventingZonesAt · coveringGroundLaws · groundZoneFill     판정 전부
        RULE-GROUND-LAW-APPLY-001 · RULE-GROUND-VENT-001         돌기 시작한 뒤의 시간 전부
                                                                (INTENT-BIRTH-DOES-NOT-CHANGE-
                                                                THE-TURNING-001)
        WorldState.chanceSeed                                    흔들림의 뿌리 — **그대로 둔다.**
                                                                태어남의 뿌리와 가른다 (RATIONALE 5)
        WORLD_BOUNDS · SPAWN_POINTS · TICK_INTERVAL              무대의 경계 · 몸이 놓이는 자리 · 시간
        RULE-MOVE-001 · 전투 · 소지품 · 장비 계통                 한 줄도 닿지 않는다

    ADDED

        WorldState.genesisSeed           태어남의 뿌리 — 세계가 만들어질 때 정해지고
                                         어떤 규칙도 바꾸지 않는다 (chanceSeed 와 같은 지위)
        DEFAULT_GENESIS_SEED             띄우는 쪽이 밝히지 않으면 이 값이다
        GroundLawDefinition.veins        이 법칙이 무대에 세우는 맥의 수
        GroundLawDefinition.veinRadius   맥 하나의 범위
        GroundLawDefinition.veinStride   이웃 맥 중심 사이의 거리 — 맥은 흩어지지 않고
                                         이웃하여 뻗는다 (대륙 규모의 결속 — BT §1)
        QUIET_GROUND                     결속이 닿지 않는 자리들 (세계 성질 — 아래 WORLD STATE)
        RULE-WORLD-GENESIS-001           세계가 만들어질 때 한 번 — 분포를 세우고 자리를 낳는다

    CHANGED

        GROUND_ZONES 상수                **삭제된다.**
            자리를 목록으로 적는 형이 사라진다 (INTENT-PLACES-ARE-DERIVED-001).
            C-TERRAIN-002 가 role 을 지워 "여기는 안전한 곳" 을 적을 수 없게 했듯,
            이 Cycle 은 "여기에 자리가 있다" 를 적을 수 없게 한다 — 적을 수 있는 것은
            씨앗 하나뿐이다.

        STATE_VERSION   `proto-adventure/3` → `proto-adventure/4`
            WorldState 의 형태가 바뀐다 (genesisSeed 추가). 형태를 바꾼 Cycle 이 버전을
            올릴 책임을 진다 (C-TERRAIN-002 선례). 옛 스냅샷은 복구를 포기하고
            새 세계로 시작한다 — genesisSeed 없는 세계는 태어난 세계가 아니다.

    AFFECTED

        world/tests/terrain.spec.ts · view/tests/terrain.spec.ts
                                   zone-vein-1~4 의 고정 배치를 전제한 검사 전부.
                                   기본 씨앗의 태어난 배치로 고쳐 쓰거나, 배치를 읽어
                                   기대값을 유도한다 (08 REGRESSION 이 목록을 갖는다)
        C-TERRAIN-002 의 BALANCE 서사   "첫 판에 무엇이 일어나는가" 가 씨앗의 함수가 된다.
                                   기본 씨앗의 세계가 같은 종류의 첫 판(닿는 맥 · 열리는
                                   자리의 이동)을 주는지 06 이 확인한다 (아래 BALANCE 2)
        SceneGroundZone 소비        변경 없음 — 자리가 어디서 왔든 그리는 계약은 같다
        스냅샷 영속                 STATE_VERSION 불일치 처리 그대로 (마이그레이션 없음)

## WORLD STATE

    WorldState.genesisSeed                                       World Authority
        number    세계가 만들어질 때 정해진다. **어떤 규칙도 바꾸지 않는다.**
                  같은 씨앗 → 같은 세계 (INTENT-SAME-SEED-SAME-WORLD-001).
                  State 로 두는 이유는 관찰과 재현이다 — 이 세계가 어느 씨앗에서
                  태어났는지가 세계 안에 남아야 "같은 세계를 다시 띄운다" 가 성립한다.

    GroundLawDefinition                                          World 성질 (State 아님)
        veins        number   이 법칙이 세우는 맥의 수                       (ADDED)
        veinRadius   number   맥 하나의 범위                                (ADDED)
        veinStride   number   이웃 맥 중심 사이 거리                         (ADDED)

        셋 다 **자리가 아니라 법칙이 지닌다** (C-TERRAIN-002 와 같은 규율) — 자리마다
        손으로 정하면 "이 자리는 크다" 를 적을 수 있게 되고, 그것은 목록이 이름을
        바꿔 돌아온 것이다.

    QUIET_GROUND                                                 World 성질 (State 아님)
        결속이 닿지 않는 자리들 — 몸이 처음 놓이는 자리(SPAWN_POINTS)와 무대의 붙박이
        (지키는 자리의 범위 · 순회 경로의 끝점들 · 광맥의 자리).

        의미의 방향에 주의한다 — 맥이 이들을 "피해 주는" 것이 아니라, **이들이 선 자리가
        법칙이 조용한 자리다** (BT §3 — 정착과 자원은 법칙이 안정되는 지점에 있다).
        지금은 붙박이가 손배치라 이 목록도 손이다. 사슬 ⑥(정착)이 서면 방향이 뒤집힌다 —
        사람이 조용한 자리를 찾아온다 (RATIONALE 4).

    GroundZone · GroundZonePhase                                 변경 없음
        태어난 자리는 놓인 자리와 형태가 같다 — 다른 것은 **어디서 왔는가**뿐이다.

## WORLD RULE

    RULE-WORLD-GENESIS-001 (ADDED — 세계가 만들어질 때 한 번, 첫 Tick 이전)

        Implements     INTENT-ENERGY-COMES-FIRST-001 · INTENT-PLACES-ARE-DERIVED-001 ·
                       INTENT-THE-PAST-IS-COMPUTED-001 · INTENT-SAME-SEED-SAME-WORLD-001 ·
                       INTENT-THE-STAGE-IS-NOT-ALL-VEIN-001
        Input          genesisSeed · GROUND_LAWS · WORLD_BOUNDS · QUIET_GROUND
                       **이 넷뿐이다** — 다른 입력이 없으므로 같은 씨앗은 같은 세계다
        Preconditions  세계에 자리가 하나도 없다 — 이 규칙은 만들어질 때 한 번만 돈다
        Transition     법칙마다 (GROUND_LAWS 순서로):

                       ① **분포가 먼저 선다** — 씨앗에서 결정론적으로 이어지는 표본열
                          하나를 연다. 이후의 모든 선택이 이 열에서만 나온다

                       ② **맥이 뻗는다** — 첫 중심을 무대 경계 안(범위만큼 안쪽)에서
                          표본하고, 다음 중심들은 이미 선 맥에서 veinStride 만큼
                          떨어진 이웃 자리로 표본한다 — 맥은 흩어진 점이 아니라
                          이어진 밭이다 (대륙 규모의 결속).
                          QUIET_GROUND 의 어느 자리라도 범위에 품게 되는 후보는
                          버리고 다음 표본으로 넘어간다 (유한 시도 — 남으면 그 법칙의
                          맥은 그만큼만 선다).
                          veins 만큼 서면 멈춘다

                       ③ **과거가 계산된다** — 맥마다 지닌 것(kept)을 표본한다:
                          0 이상 saturation 이하. 가장 많이 지닌 맥 하나는
                          saturation 까지 차서 **뿜는 중**으로 태어난다
                          (오늘의 해숨구멍 — BT §5.3: 포화가 해숨구멍의 원인이다).
                          나머지는 거두는 중으로 태어난다

        Result         BornWorld(zones) — 이후 이 목록을 바꾸는 규칙은 없다
                       (C-TERRAIN-001 의 "놓이고 그대로다" 에서 **그대로다**가 유지된다)

        표본의 형태(어떤 결정론 난수 함수를 쓰는가)는 06 이 기존 흔들림 함수의 선례를
        따른다 — 의미는 "씨앗에서만 유도된다" 하나이며 함수의 이름이 아니다.

    RULE-GROUND-LAW-APPLY-001 · RULE-GROUND-VENT-001 (REUSED — 변경 없음)

        태어난 자리 위에서 그대로 돈다 (INTENT-BIRTH-DOES-NOT-CHANGE-THE-TURNING-001).
        두 규칙 다 자리가 어디서 왔는지 묻지 않는다 — 이미 위치와 목록만 읽는다.

## OBSERVABLE SEMANTIC

    자리마다 (모든 관찰자에게 같다)                              전부 REUSED
        law · center · radius · phase · fill(kept/saturation)
        **생김새의 관찰은 새 표면이 아니다** — 자리의 배치 그 자체가 분포의 결이다.
        태어난 배치가 기존 표면(자리 목록)에 실리는 것으로
        INTENT-THE-SHAPE-IS-OBSERVED-001 의 "구분되어 보인다" 가 성립한다.
        더 실을 것이 있는지는 04 가 확정한다 (DC-WORLD-OWNS-THE-SURFACE-LIST)

    세계에 대해 (designer 관찰 — 플레이 표면이 아니다)
        genesisSeed                                              (ADDED)
        "같은 씨앗 → 같은 세계" 를 플레이로 검증하려면 이 세계가 어느 씨앗에서
        태어났는지 읽을 수 있어야 한다. 싣는 자리와 형태는 04 가 정한다

    실패 사유가 필요한 자리는 없다
        이 Cycle 은 Action 을 하나도 더하지 않는다 — 태어남은 요청이 아니다

## BALANCE

    이 절은 값의 근거다. 값 자체는 결정론에 영향을 주므로 헤더 상수로 고정하고
    CVar 로 열지 않는다 (C-TERRAIN-001·002 와 같은 판단).

    1. heat-binding 의 태어남 항

        veins        4     지금 세계의 맥 수를 유지한다 — 이 Cycle 은 밀도를 바꾸는
                           Cycle 이 아니라 **출처를 바꾸는** Cycle 이다
        veinRadius   5.0   지금 값 그대로
        veinStride   5.0   지금의 겹침(중심 사이 5.0 · 반경 5.0)을 유지한다 — 겹친 채로
                           서로 다른 단계에 있는 것(하나는 차고 하나는 뿜는)이
                           C-TERRAIN-002 플레이의 핵심이었다

        kept 의 표본이 0..saturation 전체인 것: 지금 손배치(15 · 30 · 45 · 60)가 그 범위의
        네 점이었다 — 범위를 좁힐 근거가 없다. 가장 찬 맥이 뿜으며 태어나는 것은
        지금의 zone-vein-1 (kept 60 · venting) 과 같은 상태를 계산이 낳는 것이다.

    2. 기본 씨앗의 세계

        DEFAULT_GENESIS_SEED 는 하나의 상수다. 06 은 그 씨앗의 세계가 다음을 만족하는지
        확인하고, 만족하지 않으면 **상수 값만 바꾼다** (다른 세계를 고르는 것이지
        자리를 고치는 것이 아니다 — RATIONALE 1):

            ① 맥 넷이 이웃하여 서고 하나가 뿜는 중이다
            ② QUIET_GROUND 의 어느 자리도 맥 안에 없다 (규칙이 보장 — 재확인만)
            ③ 시작 자리에서 걸어서 닿는 거리에 맥의 밭이 있다 (지금의 12.0 과
               같은 자릿수 — 한 판 안에 겪을 수 있다)

    3. 무엇이 세계 전체에 대해 참인가

        태어남은 열을 만들지 않는다 — kept 의 표본은 "수천 년 거둔 것" 의 요약이며,
        태어난 뒤의 열 총량 규칙(C-TERRAIN-002 BALANCE 5)은 그대로다.
        무대 전체가 맥으로 덮이지 않는다 — 맥 넷(반경 5)의 합집합은 무대(±20)의
        일부이고, QUIET_GROUND 가 언제나 밖에 있다 (INTENT-THE-STAGE-IS-NOT-ALL-VEIN-001).

## RATIONALE

    1. 씨앗을 고르는 것은 손배치가 아닌가

       아니다. 손배치는 **자리 하나하나를 적는 형**이 있는 것이고, 이 Cycle 뒤에는
       그 형이 없다 — 적을 수 있는 것은 씨앗 하나뿐이며, 씨앗은 자리를 지목할 수 없다.
       기본 씨앗을 고르는 일은 "태어난 세계들 가운데 어느 것을 기본으로 보여 주는가" 의
       선택이고, 그 선택으로도 QUIET_GROUND 침범 같은 법칙 위반은 만들 수 없다 —
       규칙이 먼저다.

    2. 왜 수천 년을 Tick 으로 재생하지 않는가

       과거의 의미는 "지금의 상태가 법칙의 반복에서 왔다" 이지 "재생 가능한 역사" 가
       아니다 (BT §5.1 은 결과를 적지 과정을 적지 않는다). Tick 재생은 결정론 비용과
       시작 시간만 늘리고 관찰 가능한 차이를 만들지 않는다. 표본이 씨앗과 법칙에서만
       나오므로 "계산된 과거" 의 요건 — 다른 입력이 없다 — 은 그대로 성립한다.

    3. 왜 가장 찬 맥이 해숨구멍인가

       BT §5.3 — 포화가 해숨구멍의 원인이다. 수천 년 돈 세계에 뿜는 맥이 하나도 없는
       것은 순환이 멎어 있었다는 뜻이 되어 INTENT-THE-PAST-IS-COMPUTED-001 과 어긋난다.
       "하나" 인 것은 지금 세계(zone-vein-1 하나가 venting)와 같은 상태를 계산이 낳게
       한 것이다 — 여럿이 뿜으며 태어나는 세계는 이 Cycle 이 열 필요가 없는 자유도다.

    4. QUIET_GROUND 의 방향 — 왜 생성이 붙박이를 피하는가

       의미는 "맥이 사람을 배려한다" 가 아니라 "사람과 광맥이 선 자리가 법칙이 조용한
       자리다" (BT §3 · §13 — 정착은 자연적 예외에 얹힌다) 이다. 지금 세계의 붙박이가
       손배치로 남아 있으므로 그 사실을 목록으로 지니는 것이고, 사슬 ⑥(정착)이 서면
       이 목록은 사라진다 — 그때는 태어난 땅을 보고 사람이 자리를 잡는다.
       02 REVIEW QUESTION 1·2 가 이 읽기의 승인을 Stage 5 에 묻는다.

    5. 왜 태어남의 뿌리와 흔들림의 뿌리를 가르는가

       chanceSeed 는 판정의 흔들림(치명)의 뿌리이고 cursor 로 소비된다 (C015).
       한 뿌리를 같이 쓰면 "같은 땅에서 다른 흔들림" 을 적을 수 없다 — 땅을 유지한 채
       우연만 다시 굴리는 재현(디버그 · 검증)이 불가능해진다. 두 씨앗은 소비 시점도
       다르다 — genesisSeed 는 만들어질 때 한 번, chanceSeed 는 도는 동안 계속.
       02 REVIEW QUESTION 3 의 "지금의 읽기" 를 따랐다.

    6. 왜 분포를 State 로 남기지 않는가

       분포의 흔적이 곧 자리들이다. 분포를 따로 남기면 그것을 바꾸는 규칙이 없는
       죽은 기록이 되고 (DC-CONDITION-OPENS-WITHOUT-RECORDING 의 정신), 자리와 분포가
       어긋날 수 있는 두 번째 진실이 된다. "왜 여기인가" 의 답은 씨앗과 규칙이 지닌다 —
       같은 씨앗으로 다시 낳으면 같은 답이 나온다.

## SEMANTIC CLOSURE

    "자리보다 먼저 분포가 선다"              → RULE-WORLD-GENESIS-001 Transition ①
    "씨앗과 법칙에서만 유도된다"             → RULE-WORLD-GENESIS-001 Input (넷뿐)
    "자리는 목록으로 적히지 않는다"           → GROUND_ZONES 삭제 (CHANGED) — 적을 형이 없다
    "위치·범위·처음 지닌 것·단계가 계산된다"   → Transition ② (중심·범위) · ③ (kept·phase)
    "수천 년의 결속이 계산된다"              → Transition ③ (kept 표본 · 가장 찬 맥)
    "오늘의 해숨구멍이 계산의 결과다"          → Transition ③ (뿜으며 태어나는 맥 하나)
    "같은 씨앗이면 같은 세계다"              → genesisSeed + 결정론 표본열
    "씨앗은 띄우는 쪽이 밝힌다"              → DEFAULT_GENESIS_SEED (chanceSeed 선례)
    "태어남은 한 번이다"                    → Precondition (자리가 없을 때만) ·
                                            Result (이후 바꾸는 규칙 없음)
    "어느 법칙에도 속하지 않은 땅이 있다"      → BALANCE 3 (맥의 합집합 < 무대)
    "처음 놓이는 자리는 거두는 자리 밖이다"    → QUIET_GROUND + Transition ② (버리는 표본)
    "생김새가 구분되어 보인다"               → OBSERVABLE (배치 자체가 분포의 결 —
                                            기존 자리 표면으로 실린다 · 04 확정)
    "관찰은 세계가 판정한 것만 싣는다"        → 새 판정 표면 없음 · genesisSeed 는 designer
    "태어난 뒤의 시간은 변경 없다"            → RULE-GROUND-LAW-APPLY-001 ·
                                            RULE-GROUND-VENT-001 (REUSED — 한 줄도 안 바뀐다)

    닫히지 않은 문장 없음.
