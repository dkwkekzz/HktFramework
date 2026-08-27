# C-TERRAIN-002 — View Implementation

## SPEC CONSUMED

    ground.zones[].phase        view/terrain-presentation.ts#groundZonePlan
        `role` 이 고르던 색을 `phase` 가 고른다 — 화면의 결정은 그대로 서 있고
        그것을 고르는 근거만 바뀌었다.
    ground.zones[].fill         view/terrain-presentation.ts#groundZonePlan
        셋을 정한다 — 채움의 진하기 · 뿜는 동안의 맥동 세기 · 이름의 퍼센트.
    ground.self.state[warming]  view/terrain-presentation.ts#groundLawLines
        `sheltered` 와 갈라 한 줄로 낸다.
    hud[self.warmth]            변경 없음 — 값이 올라갈 수도 있게 되었을 뿐이다

## ASSET MAPPING

    없음 — 새 sprite 도 새 role 도 없다. 자리는 엔진의 지면 구역 장치가 그리고
    (`SceneGroundZone`), 이 Cycle 은 그 장치가 이미 지닌 자리만 쓴다.

## 화면에서 무엇이 달라지는가

    이전 (C-TERRAIN-001)                지금 (C-TERRAIN-002)
    ────────────────────────────────    ────────────────────────────────────────
    빙원                                빙원 · 찬 50%
    빙원 — 멎는 자리                     해숨구멍 · 남은 100%
    (진하기가 늘 같다)                   **찬 만큼 진해진다** — 차오르는 것이 보인다
    (맥동 없음)                          **뿜는 동안 맥동한다** (intensity = 남은 비율)
    빙원 — 열을 거두어 가는 중            빙원 — 열을 거두어 가는 중       (그대로)
    빙원 — 여기서는 멎는다               해숨구멍 — **열을 돌려받는 중**  (새 줄)
                                        해숨구멍 — 여기서는 멎는다       (가득할 때)

    **`돌려받는 중` 과 `여기서는 멎는다` 가 갈리는 것이 이 화면의 요점이다.** 한 줄로
    묶이면 플레이어는 자기 열이 왜 늘었는지 알 수 없고, 둘이 갈리는 순간이 곧
    "이제 이 분출구를 더 소모하지 않는다" 가 읽히는 자리다.

## INPUT → ACTION REQUEST

    없음 — 새 입력이 하나도 없다. 플레이어가 하는 일은 걸어 들어가고 걸어 나오고
    **머무는** 것뿐이며, 머무름은 행동이 아니라 아무것도 하지 않는 것이다.
    그것을 요청으로 만들면 세계에 "머문다" 는 상태가 생기고 몸에 아무것도 적지 않는다는
    규율이 깨진다 (04-gameview.spec.yaml interactions: NONE).

## FIXTURE TESTS

    view/tests/terrain.spec.ts                          25 통과 (World 미기동)

    ground-taking.fixture.json      맥 넷 (하나 venting · fill 1.0 / 0.75 / 0.25 / 0.5)
    ground-sheltered.fixture.json   같은 자리들 · self = sheltered
    ground-warming.fixture.json     **새 fixture** · self = warming

    검사                자리마다 지시 하나 · 범위 그대로 · 거두는 맥과 뿜는 맥이 갈린다 ·
                       **찬 만큼 진해진다** · 이름에 지금이 실린다(`빙원 · 찬 75%` ·
                       `해숨구멍 · 남은 100%`) · **뿜는 동안만 맥동한다** ·
                       화면이 넘침을 판정할 수 없다(계약에 saturation·kept 가 없다) ·
                       `돌려받는 중` ≠ `여기서는 멎는다` · 미등록 상태 코드도 그려진다 ·
                       resolve 가 zones 를 그대로 실어 보낸다

## NOTES

    1. **판정이 한 줄도 늘지 않았다.** 이 파일에는 여전히 거리를 재는 코드가 없다 —
       안인지 밖인지도, 곧 넘칠지도 세계가 답한 값을 그린다. `fill` 이 이미 나눈 비율로
       오는 것이 그 규율을 형태로 지킨다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    2. **`intensity` 를 이 Cycle 이 처음 쓴다.** C-TERRAIN-001 이 "다음 Cycle 의 예고가
       쓴다" 며 엔진에 비워 둔 자리인데, 예고보다 먼저 **지금 뿜는 중**이 그 자리를
       썼다. 엔진은 열리지 않았다 — 기반 부채 없음.

    3. 퍼센트를 이름에 실은 것은 화면의 결정이다. 세계는 0..1 만 보내며 그것을
       몇 퍼센트로 부를지도, 소수 몇 자리로 반올림할지도 여기서 정한다.

    4. **못 한 것**: 엔진의 지면 구역 라벨은 캔버스 안에 스프라이트로 그려져 DOM 에서
       읽히지 않는다. 그래서 브라우저 촬영 도구는 ⑤⑥(퍼센트가 오른다)을 판정하지 않고
       fixture 검사가 그 자리를 맡는다 — 엔진이 Render Plan 을 밖으로 내주게 하는 것은
       기반 변경이라 이 Cycle 이 하지 않았다.
