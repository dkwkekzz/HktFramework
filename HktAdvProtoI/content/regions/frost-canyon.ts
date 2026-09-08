// 빙결 협곡 — depth wild. 얼음 협곡 **안쪽** (C019 ADDED · 확정 1).
//
// 고개 너머의 둘째 방이고 깊이가 한 단계 더 차다 (outer → wild · Concept §3.2).
// 위험 갈래 셋이 여기서 다 선다 — 눈보라(hazard/climate) · 결정면(hazard/matter) ·
// 절벽(hazard/terrain). 셋 다 숲이 쓰는 hazard/creature 와 하나도 겹치지 않는다
// (spec SPEC-008). 셋 다 어휘 일곱 안의 값이고 새 갈래를 짓지 않았다.
//
// 셋 다 **늘 서 있다** (phases.standing) — 눈보라는 그치지 않고(Concept §6 "지속적")
// 결정면은 자라 있고 절벽은 무너지지 않는다. 철도 소란도 지나가는 것도 이것을 걸지 않는다.
//
// 빙정석 계통(Seed · 원천 · 흔적 · Trace · 회복)은 C020 이 여기 놓았다 — 아래 resourceEcology.
// 원천 셋이 서고, 그중 결정면은 마디 넷을 도는 MIGRATORY 이며, 다 캔 마디는 **깨진 채**
// 그 자락에 결정화의 코드를 건다 (spec SPEC-004 · SPEC-005).
//
// 땅의 모양은 얼음 협곡과 같은 배치 데이터이고, 컴파일해 실제로 격자를 훑어 고정했다 —
// 해상도 1 · 41×41 vertex 기준 실측:
//   표면   서리 697 · 비탈 72 · 급경사 902 · 평지 10
//   막힘   902 칸 (전부 too-steep — 이 방에도 물이 없다)
//   높이   0.00 ~ 24.00 · 골 바닥(|x| ≤ 4)은 vertex 하나까지 정확히 0
//   hash   35a3d0ac (두 번 컴파일해도 같은 값이다 · C020 에서 b42d80db 에서 바뀌었다 —
//          op 가 열넷 늘었기 때문이고, 높이 · 표면 · 통행 격자는 위의 넷이 그대로다)
// 얼음 협곡과 다른 것은 벽의 높이 하나(20 → 24)이고, 그 차이가 비탈 164 → 72 로 나타난다 —
// **골이 더 깊고 벽이 더 가파르다.** 급경사가 서는 자리는 두 방이 같다 (|x| = 9) — 서리가
// 깔리는 폭(8)이 두 방에서 똑같이 골 바닥과 비탈만 덮는 이유다.
//
// 방 안의 길 (1.6m 걸음 · 16방위 BFS — app/main.ts KEY_LOOKAHEAD): 들어온 자리
// ICE_CANYON_SIDE(0, −18) 에서 눈보라 자락 안까지 **3 걸음** · 결정면 한가운데(0, 10) 까지
// **18 걸음**이다. 골 바닥이 남북으로 뚫려 있어 자락 셋에 전부 걸어서 닿는다.
//
// C020 ADDED — 이 방이 **재료를 낳는 방**이 된다 (원천 셋 · 마디 넷 · 흔적 일곱 · 깨진
// 자락 넷 · 문 하나). 실측 (들어온 자리 ICE_CANYON_SIDE 에서 1.6m 걸음 · 16방위 BFS):
//   문       FROST_DEPTH_DOOR (0, 18) — 통행 가능 · **23 걸음** (방을 가로질러야 닿는다)
//   원천     CLIFF_FROST_VEIN (8, −15) 6 걸음 · SNOW_DRIFT_DUST (−6, 6) 16 걸음 ·
//            FROZEN_REMAINS (−3, −10) 6 걸음 — 셋 다 통행 가능하고 표면이 frost 다
//   마디 넷  (8, −15) 6 · (8, −5) 10 · (8, 5) 16 · (8, 15) 22 걸음 — 넷 다 통행 가능하고
//            **서로 다른 자리**다 (10 씩 벌어져 있다)
//   흔적     방 바닥 frost-breath:2 가 vertex 1681(격자 전부) · 둘레 여섯이 저마다
//            frost-breath:3 으로 69 (반지름 4.5) — **여섯이 서로 한 vertex 도 겹치지 않는다**
//   깨진 자락 넷마다 덮는 21 · 걸을 수 있는 13 · 14 · 14 · 13 (전부 걸어 닿는다) —
//            깨진 결정면 앞에 설 자리가 마디마다 있다는 뜻이다 (걸린 것은 서야 참이다)
// 표면 · 막힘 · 높이는 위의 값 그대로다 — 늘어난 op 열넷(흔적 일곱 · 원천 point 셋 ·
// 곡선 하나 · hazard area 넷 · anchor 하나) 가운데 feature layer 도 profile 도 가진 것이
// 하나도 없어 컴파일된 땅을 한 값도 건드리지 않는다 (spec R4 경계 ③).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { CARRIER_WIND, HAZARD_LAYER } from './phases';
import { FEATURE_LAYER, FROST_TAG } from './terrain-rules';
import {
  CRYSTAL_GROWTH,
  FORM_CORPSE_RIME,
  FORM_DRIFT_DUST,
  FORM_FROST_VEIN,
  FROST_CRYSTAL,
  FROST_VEIN_CURVE_TAG,
  FROST_VEIN_REGROWN,
  PRESENCE_LAYER,
  RECOVERY_CRYSTAL_GROWTH,
  RECOVERY_NEXT_BLIZZARD,
  RECOVERY_PREDATOR_PASSAGE,
  RESOURCE_LAYER,
  TRACE_LAYER,
  frostBreathTag,
} from './resource-ecology';

export const FROST_CANYON = 'FROST_CANYON';

export const FROST_CANYON_SPEC: RegionSpec = {
  id: FROST_CANYON,
  depth: 'wild',
  space: {
    id: FROST_CANYON,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 13,
    ops: [
      // 드나드는 곳 **하나** — 얼음 협곡 쪽 오솔길이다. 이 방에서 나가는 끝은 그 하나뿐이고
      // (spec SPEC-002 경계 ①) 들어온 자리로 나온다. 골 바닥 한가운데 남쪽 변 근처에 둔다:
      // **눈보라 자락 밖**이어야 하기 때문이다 (아래 hazard-blizzard).
      {
        id: 'anchor-ice-canyon-side',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ICE_CANYON_SIDE',
        position: { x: 0, z: -18 },
      },
      // ── 얼음 절벽 — ridge stamp 여섯 (얼음 협곡과 같은 자리 · 더 높다) ─────
      //
      // 자리도 반경도 falloff 도 얼음 협곡과 **같다** — 같은 협곡의 안쪽이므로 땅의 결이
      // 이어져야 한다. 다른 것은 height 하나(20 → 24)이고, 그래서 골이 더 깊다.
      //
      // 높이를 올려도 골 바닥은 그대로다 — 반경 14 · 중심 x = ±18 이므로 |x| ≤ 4 는 여전히
      // stamp 반경 밖이고 높이가 정확히 0 이다. 달라지는 것은 벽의 기울기뿐이다:
      // 45° 가 서는 자리가 중심에서 14·(1 − 14/48) = 9.9 로 골 쪽에 더 가까워져, 비탈의
      // 띠가 좁아진다 (실측 164 → 72 칸). 격자 위에서 급경사가 시작하는 자리는 두 방이 같은
      // |x| = 9 다 — 그래서 서리의 폭도 두 방에서 같은 값 하나로 선다.
      { id: 'cliff-west-south', kind: 'stamp', stamp: 'ridge', center: { x: -18, z: -14 }, radius: 14, height: 24, falloff: 2 },
      { id: 'cliff-west-mid', kind: 'stamp', stamp: 'ridge', center: { x: -18, z: 0 }, radius: 14, height: 24, falloff: 2 },
      { id: 'cliff-west-north', kind: 'stamp', stamp: 'ridge', center: { x: -18, z: 14 }, radius: 14, height: 24, falloff: 2 },
      { id: 'cliff-east-south', kind: 'stamp', stamp: 'ridge', center: { x: 18, z: -14 }, radius: 14, height: 24, falloff: 2 },
      { id: 'cliff-east-mid', kind: 'stamp', stamp: 'ridge', center: { x: 18, z: 0 }, radius: 14, height: 24, falloff: 2 },
      { id: 'cliff-east-north', kind: 'stamp', stamp: 'ridge', center: { x: 18, z: 14 }, radius: 14, height: 24, falloff: 2 },
      // 서리 선 — 얼음 협곡과 **같다** (높이를 건드리지 않는 표시선 · profile 없음).
      // 같은 협곡이므로 바닥도 같은 것이 깔린다. 실측: 서리가 붙는 가장 바깥이 |x| = 8 이고
      // 급경사 vertex 는 한 칸도 서리가 아니다.
      {
        id: 'frost-canyon-floor',
        kind: 'curve',
        layer: FEATURE_LAYER,
        tag: FROST_TAG,
        points: [
          { x: 0, z: -20 },
          { x: 0, z: -7 },
          { x: 0, z: 7 },
          { x: 0, z: 20 },
        ],
        width: 2,
      },
      // ── 눈보라 자락 — 방의 대부분을 덮되 들어온 자리는 덮지 않는다 ──────────
      //
      // 자리와 크기는 Design 에 없다 (spec 기본형 ②). 눈보라만은 "지속적" 이므로 방의
      // 대부분을 덮되 **들어온 자리는 덮지 않아야** 한다 — 그래야 "들어서면 좁아진다" 가
      // 걸음 몇으로 관찰된다 (Observable ④).
      //
      // 중심 (0, 4) · 반지름 18.55 — 들어온 자리 (0, −18) 까지의 거리가 **22 로 반지름 밖**이고
      // (여유 3.45), 그 자리에서 자락 안까지 3 걸음이다. 북쪽으로는 z = 22.55 까지 덮으므로 방의
      // 북쪽 골이 전부 자락 안이다: 안쪽으로 갈수록 눈보라를 벗어날 길이 없다.
      // 실측: 이 자락이 덮는 vertex 중 걸을 수 있는 것 611 — 골 바닥이 거의 다 자락 안이다.
      //
      // 반지름이 18 이 아니라 18.55 인 이유 — **자락의 변이 설 수 있는 자리를 스치면 안 된다.**
      // 몸은 격자가 아니라 이어진 자리에 서고(걸음은 남은 거리가 한 걸음 안일 때만 목표에
      // 스냅한다 · engine/physics/seek.ts), 자락은 격자가 아니라 원이다. 18 로 두면 벽 꼭대기의
      // 걸을 수 있는 vertex (±18, 5) 가 변에서 겨우 0.028 밖에 서는데, 그 자리로 걸어가다 한
      // 뼘 못 미쳐 멈추면 자락 밖으로 나온 몸이 여전히 자락 안이다 — 들고 나는 것이 손가락
      // 굵기로 갈린다.
      // 그래서 걸을 수 있는 vertex 779 개를 전부 재어, 변까지의 거리가 **가장 가까운 것이 가장
      // 멀어지는** 반지름을 골랐다 (여유 0.111). 16 ~ 21 을 0.05 씩 훑어 얻은 값이고 중심 z 를
      // 3 ~ 5 로 옮겨 봐도 이보다 나은 자리가 없다 (최대 0.12) — 격자가 촘촘해서 그렇다.
      //
      // 관찰 범위 { day 20 · night 10 } 은 spec 의 State 표가 준 확정 값이다 (확정 6) —
      // 배치 데이터가 아니므로 여기서 고르지 않았다. 아래 phases 가 그것을 밝힌다.
      {
        id: 'hazard-blizzard',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'BLIZZARD',
        shape: { kind: 'circle', center: { x: 0, z: 4 }, radius: 18.55 },
      },
      // ── 결정면 자락 — 걸어 들어갈 수 있는 작은 자리 ────────────────────────
      //
      // 중심 (0, 10) · 반지름 3.5 — **골 바닥 안**이다 (|x| ≤ 3.5 < 4 이므로 stamp 반경 밖 ·
      // 실측: 덮는 vertex 37 이 전부 통행 가능하고 한 칸도 막히지 않는다). 걸어 들어갈 수
      // 없으면 "발밑이 무엇인가" 를 물을 수가 없다.
      //
      // 눈보라 자락 **안**에 든다 (중심 사이 6 · 반지름 18) — 그래서 결정면에 서면 발밑을
      // 말하는 판에 hazard/climate · hazard/matter · crystallizing 이 함께 뜬다
      // (겹치면 걸린 것이 전부 실린다 · C016 이 세운 어법 그대로).
      //
      // 작게 두는 이유: 자락 밖으로 나오면 그 줄이 사라지는 것이 관찰되어야 한다
      // (Observable ⑥). 반지름 3.5 는 걸음 두 개 남짓이라 들고 나는 것이 몸으로 읽힌다.
      {
        id: 'hazard-crystal-face',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'CRYSTAL_FACE',
        shape: { kind: 'circle', center: { x: 0, z: 10 }, radius: 3.5 },
      },
      // ── 절벽 자락 둘 (얼음 협곡과 같은 어법) ───────────────────────────────
      //
      // 급경사가 |x| = 9 에서 서므로 안쪽 변을 |x| = 8 에 둔다 — 벽 앞의 마지막 걸을 수 있는
      // 줄까지 덮어야 그 코드가 읽힌다 (얼음 협곡의 같은 자락 주석 참조).
      // 실측 (한 자락당): 덮는 vertex 중 막힌 것 451 · 걸을 수 있는 것 82.
      {
        id: 'hazard-ice-cliff-west',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ICE_CLIFF',
        shape: {
          kind: 'polygon',
          points: [
            { x: -20, z: -20 },
            { x: -8, z: -20 },
            { x: -8, z: 20 },
            { x: -20, z: 20 },
          ],
        },
      },
      {
        id: 'hazard-ice-cliff-east',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ICE_CLIFF',
        shape: {
          kind: 'polygon',
          points: [
            { x: 8, z: -20 },
            { x: 20, z: -20 },
            { x: 20, z: 20 },
            { x: 8, z: 20 },
          ],
        },
      },
      // ── C020 ADDED — 빙결 심층으로 드는 문의 자리 ──────────────────────────
      //
      // 골의 **북쪽 끝**이다 — 들어온 자리 (0, −18) 의 맞은편이라 방을 가로질러야 닿는다.
      // 얼음 협곡이 북쪽 끝에 오솔길 anchor 를 둔 그 자리와 같은 값이고(0, 18), 이 방에서는
      // 그것이 나가는 길이 아니라 **더 깊이 드는 문**이다. 골 바닥 한가운데(|x| ≤ 4)라
      // 높이가 정확히 0 인 평지다.
      //
      // 그 너머(FROST_DEPTH)는 아직 짓지 않은 곳이다 — 건너기 요청은 region-not-built 로
      // 거절된다 (spec SPEC-009 경계 ①). 표식에 실리는 것은 **요구의 코드**뿐이고, 그것이
      // 문을 잠그지도 열지도 않는다 (경계 ② · graph.ts 의 CONNECTOR_REQUIREMENTS).
      {
        id: 'anchor-frost-depth-door',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FROST_DEPTH_DOOR',
        position: { x: 0, z: 18 },
      },
      // ── C020 ADDED — 흔적과 원천 셋 (spec SPEC-001 ~ SPEC-008 · 기본형 ① ② ③) ──
      //
      // 흔적은 협곡의 어휘다 (frostBreathTag) — 이 방에도 흙 사다리 area 가 **하나도 없다**
      // (spec SPEC-002 경계 ②). 고개 너머 첫 방(얼음 협곡)의 바닥이 1 이므로 그 **안쪽**인
      // 이 방은 2 이고, 원천 둘레는 방 바닥보다 한 단계 짙어 3 이다 — 어휘의 가장 짙은
      // 단계다 (FROST_BREATH_MAX).
      //
      // 새 hazard area 넷을 **ops 끝**에 붙인 이유 — hazardOverlayTagsAt 이 걸린 것을
      // Description 의 ops 차례로 낸다. 앞의 넷(눈보라 · 결정면 · 절벽 둘) 사이에 끼우면
      // C019 가 세운 걸린 것의 **차례**가 밀린다 (spec SPEC-010 회귀).
      {
        id: 'trace-canyon-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(2),
        shape: {
          kind: 'polygon',
          points: [
            { x: -20, z: -20 },
            { x: 20, z: -20 },
            { x: 20, z: 20 },
            { x: -20, z: 20 },
          ],
        },
      },
      // 결정면의 선 — 동쪽 벽을 따라 곧게 난다. **높이를 건드리지 않는 표시선**이다
      // (profile 없음 · 뿌리 곡선 · 서리 선이 세운 그 형) — 땅도 통행 격자도 한 값 바뀌지
      // 않고, 이 선이 하는 일은 **마디 넷을 주는 것** 하나뿐이다 (siteCurve · C013 의 형).
      //
      // 점 넷이 x = 8 에 선 이유 둘.
      //   ① 걸을 수 있는 마지막 줄이다 — 급경사는 |x| = 9 에서 서므로(C019 실측) 벽에 더
      //      붙일 수가 없다. 캐러 설 수 없는 자리에 원천을 세우지 않는다.
      //   ② 절벽 자락(|x| ≥ 8 의 사각형) **안**이다 — 변 위는 안으로 치므로(engine 의
      //      areaCoversPoint) 결정면을 캐는 동안 내내 절벽의 코드가 함께 실린다.
      //      "위험을 만든 그것이 곧 보상이다" 가 발밑의 판에서 한 줄로 읽힌다.
      // z = −15 · −5 · 5 · 15 는 10 씩 벌린 값이다 — 둘레 흔적(반지름 4.5)이 서로 겹치지
      // 않으면서 방의 남북을 고루 쓰는 가장 성긴 배치다 (겹치면 "원천 둘레가 한 단계 짙다"
      // 가 두 마디에서 한꺼번에 참이 되어 흔적이 방향이 되지 못한다).
      {
        id: 'frost-vein-curve',
        kind: 'curve',
        layer: PRESENCE_LAYER,
        tag: FROST_VEIN_CURVE_TAG,
        points: [
          { x: 8, z: -15 },
          { x: 8, z: -5 },
          { x: 8, z: 5 },
          { x: 8, z: 15 },
        ],
        width: 1.5,
      },
      // 마디마다 둘레 흔적 하나 — 마디 순서 그대로다 (C013 의 어법).
      // 반지름 4.5 는 배치 데이터다: 마디 간격 10 의 절반보다 작아 서로 닿지 않고,
      // 가장 바깥 마디(z = ±15)의 원도 extent(−20..20) 안에 온전히 든다.
      {
        id: 'trace-frost-vein-0',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(3),
        shape: { kind: 'circle', center: { x: 8, z: -15 }, radius: 4.5 },
      },
      {
        id: 'trace-frost-vein-1',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(3),
        shape: { kind: 'circle', center: { x: 8, z: -5 }, radius: 4.5 },
      },
      {
        id: 'trace-frost-vein-2',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(3),
        shape: { kind: 'circle', center: { x: 8, z: 5 }, radius: 4.5 },
      },
      {
        id: 'trace-frost-vein-3',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(3),
        shape: { kind: 'circle', center: { x: 8, z: 15 }, radius: 4.5 },
      },
      // **깨진 마디의 자락** 넷 — 마디 순서 그대로다 (depletedHazards 와 같은 차례).
      //
      // 붕괴 area(C012 의 collapse-*)와 **갈리는 자리가 여기다**: 저것은 resource layer 에
      // 살며 그 안을 지날 수 없게 만들고, 이것은 hazard layer 에 살며 **말만 한다**.
      // 그래서 이 방의 통행 격자는 캐기 전과 뒤가 한 값도 다르지 않다 (spec R4 경계 ③).
      //
      // **캐기 전에는 아무것도 걸지 않는다** (SPEC-005 경계 ①) — 이 area 들은 어느 위상도
      // 가리키지 않고(phases.standing 에 없다) 오직 그 마디가 깨진 마디 목록에 든 동안에만
      // 원천이 밝힌 덧씌움으로 걸린다 (RULE-DEPLETED-HAZARD-001).
      //
      // 반지름 2.5 는 배치 데이터다 — 깨진 결정면 앞에 **서야** 그 줄이 읽히므로(걸린 것은
      // 서야 참이다 · C019 R3 비고) 걸을 수 있는 x = 8 줄을 품되, 둘레 흔적(4.5)보다
      // 작아 "깨진 자리" 와 "그 둘레" 가 한 자리가 되지 않는다.
      // tag 는 둘러싼 것의 이름이다 (붕괴 area 가 원천 이름을 다는 어법 그대로 · C012).
      {
        id: 'hazard-frost-vein-0',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'CLIFF_FROST_VEIN',
        shape: { kind: 'circle', center: { x: 8, z: -15 }, radius: 2.5 },
      },
      {
        id: 'hazard-frost-vein-1',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'CLIFF_FROST_VEIN',
        shape: { kind: 'circle', center: { x: 8, z: -5 }, radius: 2.5 },
      },
      {
        id: 'hazard-frost-vein-2',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'CLIFF_FROST_VEIN',
        shape: { kind: 'circle', center: { x: 8, z: 5 }, radius: 2.5 },
      },
      {
        id: 'hazard-frost-vein-3',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'CLIFF_FROST_VEIN',
        shape: { kind: 'circle', center: { x: 8, z: 15 }, radius: 2.5 },
      },
      {
        id: 'source-cliff-frost-vein',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'CLIFF_FROST_VEIN',
        position: { x: 8, z: -15 },
      },
      // 눈보라의 결정 가루 — **눈보라 자락 안**이다 (Design 은 거기까지만 말한다 · 기본형 ①).
      // (−6, 6) 은 자락의 중심 (0, 4) 에서 6.32 이므로 반지름 18.55 안에 넉넉히 들고,
      // 골 바닥의 서쪽 비탈이라 걸어 닿는다. 결정면의 줄(x = 8) 과는 방을 사이에 두고
      // 마주 서므로 둘레 흔적이 서로 닿지 않는다.
      {
        id: 'trace-snow-drift-dust',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(3),
        shape: { kind: 'circle', center: { x: -6, z: 6 }, radius: 4.5 },
      },
      {
        id: 'source-snow-drift-dust',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'SNOW_DRIFT_DUST',
        position: { x: -6, z: 6 },
      },
      // 언 사체 곁의 결정 — **골 바닥**이다. (−3, −10) 은 |x| ≤ 4 의 골 안이고 들어온
      // 자리에서 가장 먼저 지나는 자리 곁이다. 둘레 흔적이 결정면의 두 마디(z = −15 · −5)
      // 어느 것과도 닿지 않는 가장 가까운 자리로 골랐다 (둘 다 12.08 · 필요한 것은 9).
      {
        id: 'trace-frozen-remains',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(3),
        shape: { kind: 'circle', center: { x: -3, z: -10 }, radius: 4.5 },
      },
      {
        id: 'source-frozen-remains',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'FROZEN_REMAINS',
        position: { x: -3, z: -10 },
      },
    ],
  },
  /**
   * 이 방이 낳는 것 — 원천 셋 (C020 ADDED · spec SPEC-001 · SPEC-004 ~ SPEC-009).
   *
   * 붙잡는 것이 셋 다 다르고(땅 · 대기 · 잔류) 맡은 자리도 셋 다 다르다(Risk ·
   * Conditional · By-product). 얼음 협곡의 서리(현상 · Baseline)까지 넷이 **Carrier 넷 ·
   * 자리 넷**을 하나씩 채운다 — 한 방에 몰지 않은 이유는 그것이다 (Play §5.2 의 원천 표).
   *
   * 넷 다 같은 Seed(FROST_CRYSTAL)를 낸다. 종류가 넷인 것이 아니라 **같은 것의 네 순도**다
   * (A.1) — 그것이 "이 협곡에 계통이 하나 있다" 의 데이터 쪽 얼굴이다.
   */
  resourceEcology: {
    sources: [
      // ── 절벽의 결정면 — 이 방의 Risk (spec SPEC-004 · SPEC-005 · SPEC-006) ──
      //
      // 깊은 자리일수록 위험이 함께 온다 (Concept §6). 여기서는 그것이 한 자리다: 캐러 서는
      // 자리가 절벽 자락 안이고, 다 캐면 **그 자리 자체가** 결정화 위험이 된다.
      // 자리를 옮기는 것(migratory)은 C013 의 노두가 세운 그 형 그대로다 — 캔 자리에
      // 다시 나지 않고 **옆 면**에 선다 (확정 8).
      {
        id: 'CLIFF_FROST_VEIN',
        materialId: FROST_CRYSTAL,
        worldCause: CRYSTAL_GROWTH,
        form: FORM_FROST_VEIN,
        // 벽이 지고 있다 — 노두와 같은 갈래다 (A.2 Carrier)
        carrier: 'terrain',
        opportunity: 'risk',
        // 캔 자리에는 다시 나지 않고 다음 마디에 선다 (§5.6 의 셋째)
        supply: 'migratory',
        // 열을 먹어 다시 자란다 (A.2 회복 원인 · 확정 2 의 세계 원인이 그대로 되돌린다)
        recoveryCause: RECOVERY_CRYSTAL_GROWTH,
        // Risk — 한 번 닿으면 값어치가 있어야 한다. 노두(3)보다 적은 것은 이 방이 협곡의
        // 가장 깊은 자리이면서도 마디를 넷 가져 한 바퀴가 길기 때문이다 (spec 데이터 값 표)
        harvests: 2,
        // 노두와 같은 값 — 계통에서 가장 깊은 자리의 되돌아옴이다 (D3)
        recoverySeconds: 180,
        // **긴 밤에 두 배** (확정 7) — 열이 가장 귀한 때에 결정이 가장 빨리 자란다.
        // 길이(180)는 바뀌지 않는다: 그 철에 흐르는 1 초가 2 초로 실릴 뿐이다 (spec R3 경계)
        recoverySpeed: { LONG_NIGHT: 2 },
        // 마디는 결정면의 선이 준다 — 그 선의 점 넷이 곧 마디 넷이다
        siteCurve: FROST_VEIN_CURVE_TAG,
        // C021 ADDED — **처음 마디가 아닌 자리에 선 동안** 이 코드가 실린다 (spec SPEC-005).
        // 이 방에서 마디를 여럿 가진 원천은 이것 하나이고, 그래서 밝히는 것도 이것 하나다 —
        // 눈보라의 가루도 언 사체도 자리를 옮기지 않으므로 밝혀도 아무 일이 없다.
        regrownCode: FROST_VEIN_REGROWN,
        // 마디 순서 그대로의 둘레 흔적
        traceOps: [
          'trace-frost-vein-0',
          'trace-frost-vein-1',
          'trace-frost-vein-2',
          'trace-frost-vein-3',
        ],
        // **`collapses` 를 밝히지 않는다** — 깨진 면은 길을 막지 않는다 (spec R4 경계 ③).
        // 그래서 붕괴 area(collapseOps)도 없다. 깨진 마디가 남기는 것은 아래 자락뿐이고,
        // 그것은 통행이 아니라 **말**이다.
        depletedHazards: [
          { areaId: 'hazard-frost-vein-0', hazard: 'hazard/matter', contact: 'crystallizing' },
          { areaId: 'hazard-frost-vein-1', hazard: 'hazard/matter', contact: 'crystallizing' },
          { areaId: 'hazard-frost-vein-2', hazard: 'hazard/matter', contact: 'crystallizing' },
          { areaId: 'hazard-frost-vein-3', hazard: 'hazard/matter', contact: 'crystallizing' },
        ],
      },
      // ── 눈보라의 결정 가루 — 그 철에만 선다 (spec SPEC-007) ──
      //
      // C016 의 출현 조건을 그대로 쓴다 — 다른 철에는 그 자리에 **아무것도 없다**.
      // 바닥난 것도 되돌아오는 중인 것도 아니라 아직 그때가 아닌 것이고, 사유 코드가
      // 그 셋과 갈린다 (not-this-season).
      {
        id: 'SNOW_DRIFT_DUST',
        materialId: FROST_CRYSTAL,
        worldCause: CRYSTAL_GROWTH,
        form: FORM_DRIFT_DUST,
        // **대기가 지고 있다** — 이 세계에서 처음 서는 칸이다 (Material §6.2 · SPEC-001 경계 ②)
        carrier: 'atmosphere',
        opportunity: 'conditional',
        // 사건이 되풀이될 때만 온다 (§5.6 의 넷째) — 눈보라가 잦은 철이 그 사건이다
        supply: 'event-scarce',
        // 다음 눈보라 (A.2 회복 원인)
        recoveryCause: RECOVERY_NEXT_BLIZZARD,
        harvests: 2,
        // 그 철(스밈 2일 = 720 초 · 긴 밤 1일 = 360 초) 안에 여러 번 쌓일 수 있는 값
        // (기본형 ⑤ — Design 은 "다음 눈보라" 라고만 한다)
        recoverySeconds: 120,
        traceOps: ['trace-snow-drift-dust'],
        // 눈보라가 잦은 두 철에만 선다 (Play §5.2 · Time §2.4 ③)
        occurrence: { seasons: ['SEEP', 'LONG_NIGHT'] },
      },
      // ── 언 사체 곁의 결정 — 한 번뿐이다 (spec SPEC-008) ──
      //
      // **처음부터 서 있다** — 지나간 자리에 매달린 C018 의 원천 둘(비늘 · 먹이 잔해)과
      // 갈리는 자리가 여기다. 저것들은 무엇이 지나가야 서지만 이것은 이미 언 채로 거기
      // 있고, 되돌리는 것만이 그 지나감이다 (spec SPEC-008 경계).
      //
      // 그 경로(체온을 감지하는 포식자)는 아직 세계에 없다 (Out of Scope) — 그래서
      // 되돌아옴이 세계에서 가장 느리고, 원인은 **밝혀만 두었다** (기본형 ④).
      // 그 경로가 서면 이 값이 아니라 지나감이 되돌린다.
      {
        id: 'FROZEN_REMAINS',
        materialId: FROST_CRYSTAL,
        worldCause: CRYSTAL_GROWTH,
        form: FORM_CORPSE_RIME,
        // 남은 것이 지고 있다 — 허물 · 먹이 잔해와 같은 갈래다 (A.2 Carrier)
        carrier: 'residue',
        // 그것이 지나가며 떨어뜨린 부산물 (A.3)
        opportunity: 'by-product',
        supply: 'event-scarce',
        // 그것이 다시 지난다 (A.2 회복 원인)
        recoveryCause: RECOVERY_PREDATOR_PASSAGE,
        // 한 번 캐면 바닥난다 (확정 8)
        harvests: 1,
        // **세계에서 가장 느리다** (spec SPEC-008 · 기본형 ④). 하루(360)의 두 배이고
        // 이 세계의 어느 원천보다도 길다 — 지금까지 가장 느리던 것은 지나간 자리의
        // 원천 둘(240)이고 이 협곡의 서리가 360 이다.
        //
        // 되돌리는 것은 **시간이 아니라 그것이 다시 지나는 것**이다 (Play §5.2). 그 경로가
        // 아직 세계에 없으므로 시간만 남았고, 그래서 값이 아니라 **원인**이 이 줄의 뜻이다:
        // 경로가 서면 이 값이 아니라 지나감이 되돌린다 (C018 이 지나간 자리의 원천에
        // 한 그대로). 그때까지는 "거의 돌아오지 않는다" 가 세계의 답이어야 한다.
        recoverySeconds: 720,
        traceOps: ['trace-frozen-remains'],
      },
    ],
    // C020 ADDED (spec SPEC-009) — **밖에서 아무것도 받지 않는다.** 얼음 협곡과 같은
    // 조건이고, 그것이 "협곡이 요구하는 것은 협곡에 없다" 의 데이터 쪽 얼굴이다:
    // 열을 저장하는 결정은 여기서 자라지도 않고 실려 오지도 않는다.
    isolationReason:
      '얼음 절벽이 양옆을 막고 오솔길 하나로만 이어진다 — 이 방이 내는 것은 여기서 자란 것뿐이고 실려 오는 것이 없다',
  },
  /**
   * 이 방이 **늘** 서 있는 위상 (C019 ADDED · spec R1 · SPEC-005).
   *
   * 넷을 밝힌다 — 눈보라 · 결정면 · 절벽 둘. 차례는 Description 의 ops 차례와 같게 둔다:
   * 위험의 코드도 접촉의 코드도 **걸린 것이 전부** 실리므로 차례가 답을 바꾸지는 않지만,
   * 두 자리가 같은 차례여야 데이터를 읽는 사람이 짝을 짓기 쉽다.
   *
   * 눈보라만이 관찰 범위를 밝힌다 — 낮 20 · 밤 10 (spec State 표 · 확정 6). 밝히지 않은
   * 셋은 아무것도 좁히지 않는다. 결정면만이 접촉 코드를 밝힌다 — 그 자락에 선 동안
   * 'crystallizing' 이 걸린 것에 함께 실리고, **몸의 값은 한 톨도 달라지지 않는다**
   * (2층이 하는 것은 말하는 것까지다 · Play §5.1 · spec R3 경계).
   *
   * 갈래 셋은 어휘 일곱 안의 값이다 (content/authoring/contracts.ts 의 HAZARD_KINDS).
   * 이 폴더는 그 파일을 읽지 않으므로(경계 규칙 4) 글자로 적는다.
   */
  phases: {
    /**
     * C021 ADDED — 그 철에 이 방이 **다른 방**에 거는 것 (spec R1 · R2 · SPEC-001 · SPEC-002).
     *
     * 스밈과 긴 밤에 이 협곡의 추위가 고개를 넘어 **백왕령 산기슭의 안전 조건**을 옅게 한다.
     * 지금까지 위상은 언제나 자기 방 안의 일이었다 — 이 두 줄이 방을 넘는 첫 자리다.
     *
     * 열쇠가 둘뿐이므로 다른 철(고요 · 뒤척임)에는 이 방이 남의 방에 아무것도 걸지 않는다 —
     * 열쇠 없는 철에 달라지는 것이 없다는 규율 그대로다 (spec SPEC-001 경계 ①).
     * 두 줄의 값이 **같은 것**은 Play §5.4 가 두 철에 같은 일이 일어난다고 적었기 때문이다:
     * 철이 다르다고 추위가 다른 자락을 덮지 않는다.
     *
     * 방 이름과 이음 이름을 **글자로** 적는다 — 이 파일이 white-king-domain.ts 나 graph.ts 를
     * 부르면 방 파일끼리 순환이 난다 (흐름의 from/to · connectorId 가 세운 그 어법 ·
     * RESOURCE_FLOWS). 끊긴 참조는 오류가 아니라 **아무 일도 하지 않는 것**이므로
     * (spec SPEC-002 경계 ①) 세 글자가 다 실제 세계를 가리키는지는 시나리오가 지킨다.
     *
     * **타는 이음이 얼음 협곡의 고개인데 나가는 방이 이 방이다** — 두 방은 오솔길로 이어져
     * 있고 그 너머의 고개가 백왕령으로 난다. 추위는 두 이음을 잇달아 넘지만, 여기가 밝히는
     * 것은 **백왕령에 닿는 마지막 이음** 하나다 (spec 기본형 ③ — 이음을 잇는 길 전체를
     * 세우는 것은 이 Cycle 의 일이 아니고 그 길찾기는 세계에 없다).
     *
     * 이 방 자신의 조건은 한 값도 달라지지 않는다 — 나가는 쪽이지 받는 쪽이 아니다
     * (spec Observable ④). 걸리는 자리를 정하는 것은 언제나 **가리켜진 쪽**의 Description 이다.
     */
    seasons: {
      SEEP: {
        outflow: [
          {
            region: 'WHITE_KING_DOMAIN',
            areaId: 'condition-ridge-foot',
            throughConnector: 'ICE_CANYON_PASS',
            carrier: CARRIER_WIND,
          },
        ],
      },
      LONG_NIGHT: {
        outflow: [
          {
            region: 'WHITE_KING_DOMAIN',
            areaId: 'condition-ridge-foot',
            throughConnector: 'ICE_CANYON_PASS',
            carrier: CARRIER_WIND,
          },
        ],
      },
    },
    standing: {
      hazardExtend: [
        {
          areaId: 'hazard-blizzard',
          hazard: 'hazard/climate',
          observeRange: { day: 20, night: 10 },
        },
        {
          areaId: 'hazard-crystal-face',
          hazard: 'hazard/matter',
          contact: 'crystallizing',
        },
        { areaId: 'hazard-ice-cliff-west', hazard: 'hazard/terrain' },
        { areaId: 'hazard-ice-cliff-east', hazard: 'hazard/terrain' },
      ],
    },
  },
};
