# C-TERRAIN-002 — World Implementation

## IMPLEMENTED

    GroundZone.kept · GroundZone.phase          world/semantic/terrain.ts
        자리가 지금 지닌 것과 어느 단계인가. `GroundZoneRole` 을 지운 자리에 들어선다.
    GroundZonePhase                             world/semantic/terrain.ts
        binding | venting. **State 이지 파생값이 아니다** — kept ≥ saturation 으로 매번
        계산하면 넘친 순간 곧바로 아래로 떨어져 뿜음이 한 Tick 만 일어난다.
    GroundLawDefinition.saturation · ventRate · escapeRate
                                                world/semantic/terrain.ts
        60 · 6.0 · 1.5. 셋 다 **법칙이 지닌다** — 자리마다 손으로 정하면
        "이 자리는 오래 열려 있다" 를 적을 수 있게 되고 놓인 예외가 돌아온다.
    bindingZonesAt(zones, position)             world/semantic/terrain.ts
        법칙당 하나 — 안에 있고 binding 이고 그 법칙에 대해 멎지 않은 자리 중
        **중심이 가장 가까운** 것. 같으면 목록에서 앞선 것(결정론).
    ventingZonesAt · groundZoneFill             world/semantic/terrain.ts
    RULE-GROUND-VENT-001                        world/simulation/ground-vent.ts
        넘침 → 뿜음 → 돌려줌 → 닫힘. 이 Cycle 이 세우는 유일한 새 규칙이다.
    맥 넷의 초기 배치 · STATE_VERSION /3         world/semantic/world-state.ts

## REUSED

    GroundZone.id · law · center · radius       world/semantic/terrain.ts (C-TERRAIN-001)
    isInsideGroundZone                          그 안인가 — 몸의 반경을 더하지 않는다
    GroundLawDefinition.takes · rate · lifeRate 거두는 것과 그 속도 — 한 값도 바뀌지 않았다
    WorldState.groundZones                      C-TERRAIN-001 이 상수가 아니라 State 로
                                                두었다. **그 예비가 여기서 쓰인다** —
                                                이사가 따라붙지 않았다
    ActorState.warmth · warmthMax               몸에는 한 항목도 늘지 않았다
    RULE-DOWNED-001                             끝의 형태를 한 줄도 바꾸지 않았다
    engine/physics · world-kernel               한 줄도 건드리지 않았다

## AFFECTED UPDATED

    RULE-GROUND-LAW-APPLY-001                   world/simulation/ground-law-apply.ts
        Precondition 2·3 이 `role` 에서 `phase` 로 옮겨 갔고, Transition 에
        **`zone.kept += taken`** 세 줄이 늘었다. 그 세 줄이 이 Cycle 이다.
    isSheltered                                 같은 법칙의 **뿜는 중인** 자리를 묻는다
    activeGroundLaws                            bindingZonesAt 위의 얇은 껍데기가 되었다
    coveringGroundLaws                          `role === 'law'` 거르기가 사라졌다
                                                (모든 자리가 법칙의 자리다)
    world/index.ts                              SYSTEMS 에 ruleGroundVent 가 apply **바로
                                                뒤**로 들어갔다. 지목 정리보다는 앞이다
    STATE_VERSION                               proto-adventure/2 → /3 — GroundZone 의
                                                형태가 바뀌었으므로 옛 스냅샷은 버려진다

## PROJECTION

    ground.zones[].phase · fill                 world/projection/observer-view.ts
        `role` 자리에 `phase` 가 들어가고 `fill` 이 늘었다.
        **fill 은 세계가 나눈 비율이다** — kept 도 saturation 도 나가지 않으므로
        화면은 넘침을 스스로 판정할 수 없다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
    ground.self.state = warming                 world/projection/observer-view.ts
        뿜는 자리 안이고 받을 자리가 있으면 `warming`, 가득하면 `sheltered`.
        판정 조건이 RULE-GROUND-VENT-001 의 `give > 0` 과 같다 — 화면이 계산하지 않는다.

## TESTS

    world/tests/terrain.spec.ts                 45 통과

        회귀 (C-TERRAIN-001)   자리 밖 · 머무는 동안 거둠 · 시간 비례 · 몸이 상하지 않음 ·
                              누구인지 묻지 않음 · 다한 뒤 생명 · 쓰러진 몸 제외
        보존                   뺀 만큼 자리에 든다 (총량 보존) · 몸에는 아무것도 적히지
                              않는다 · saturation 을 넘겨 쌓이지 않는다 · 생명에서 거둔
                              몫은 쌓이지 않는다
        받는 자리 하나          겹쳐도 한 번만 거두고 한 자리만 받는다 ·
                              중심에 가까울수록 그 맥이 빨리 찬다
        넘침·뿜음              넘치면 venting · 안 넘치면 그대로 · **거둠과 넘침 사이에
                              한 Tick 의 틈이 없다**
        멎음                   뿜는 자리 안에서는 거두지 않는다 · 멎는 것은 그 자리
                              안에서뿐 · 다른 법칙의 뿜음은 멎게 못 한다 ·
                              **영구히 안전한 자리를 적을 형이 없다**
        돌려줌                 받은 만큼 자리가 빈다 (보존) · 지닐 수 있는 만큼까지만 ·
                              가득한 몸은 소모하지 않는다 · 아무도 없으면 흩어진다 ·
                              쓰러진 몸은 받지 않는다
        반복                   다 쓰면 닫힌다 · 닫힌 자리는 도로 거둔다 ·
                              한 자리에 머무는 평형 (05-review REVIEW QUESTION 3)
        초기 배치              맥 넷 · 하나가 뿜는 중 · role 없음 · 이미 차 있음 ·
                              기존 플레이 자리와 닿지 않음 (회귀)
        관찰                   phase · fill 이 실린다 · 날값은 실리지 않는다 ·
                              차오르는 것이 보인다 · taking/warming/sheltered/none 이 갈린다
        플레이                 **머물면 발밑이 열리고, 그 사이 열려 있던 자리는 닫힌다** ·
                              가로지르는 것으로는 열리지 않는다 · 원점 플레이 불변 (회귀)

    전체 회귀                   npm test — 82 파일 · 1489 통과 (이 Cycle 전 1461)

## NOTES

    1. **세 줄이 전부다.** `ground-law-apply.ts` 에서 실제로 는 것은
       `const taken = …` · `actor.warmth -= taken` · `zone.kept = Math.min(…)` 셋이며,
       넘침도 뿜음도 예외가 옮겨 다니는 일도 그 셋의 결과다. Frontier 의
       "Why one Cycle" 이 그렇게 적었고 실제로 그러했다.

    2. **`role` 삭제가 가장 큰 변경이다.** 형이 사라졌으므로 세계 어디에도
       "여기는 안전한 곳" 을 적을 수 없다. 검사 하나가 그것을 형태로 지킨다
       ('영구히 안전한 자리를 적을 방법이 없다').

    3. **초기 배치가 상수가 아니게 되었다.** GROUND_ZONES 를 그대로 넘기면 세계가
       헤더 상수를 갈아 다음 세계가 오염된다 — `index.ts` 의 복사가 이제 필수다.
       그 사실을 주석으로 박아 두었다.

    4. `engine/` 은 한 줄도 편집하지 않았다. `SceneGroundZone.intensity` 는 이미 있던
       자리이며 이 Cycle 이 처음 쓴다 — 기반 부채 없음.

    5. **못 한 것**: 자리 사이의 흐름(구배·확산)은 세우지 않았다 (01 EXCLUDED ·
       05-review REVIEW QUESTION 4). `kept` 가 자리마다의 스칼라이므로 이웃으로 옮기는
       규칙을 나중에 더해도 이 형은 바뀌지 않는다.
