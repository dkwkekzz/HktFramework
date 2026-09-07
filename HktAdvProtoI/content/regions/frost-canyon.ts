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
// 빙정석 계통(Seed · 원천 · 흔적 · Trace · 회복)은 **여기 없다** — resourceEcology 를 밝히지
// 않는다. C020 이 그것을 가져간다 (spec Out of Scope). 결손이 아니라 아직 안 놓은 것이다.
//
// 땅의 모양은 얼음 협곡과 같은 배치 데이터이고, 컴파일해 실제로 격자를 훑어 고정했다 —
// 해상도 1 · 41×41 vertex 기준 실측:
//   표면   서리 697 · 비탈 72 · 급경사 902 · 평지 10
//   막힘   902 칸 (전부 too-steep — 이 방에도 물이 없다)
//   높이   0.00 ~ 24.00 · 골 바닥(|x| ≤ 4)은 vertex 하나까지 정확히 0
//   hash   b42d80db (두 번 컴파일해도 같은 값이다)
// 얼음 협곡과 다른 것은 벽의 높이 하나(20 → 24)이고, 그 차이가 비탈 164 → 72 로 나타난다 —
// **골이 더 깊고 벽이 더 가파르다.** 급경사가 서는 자리는 두 방이 같다 (|x| = 9) — 서리가
// 깔리는 폭(8)이 두 방에서 똑같이 골 바닥과 비탈만 덮는 이유다.
//
// 방 안의 길 (1.6m 걸음 · 16방위 BFS — app/main.ts KEY_LOOKAHEAD): 들어온 자리
// ICE_CANYON_SIDE(0, −18) 에서 눈보라 자락 안까지 **3 걸음** · 결정면 한가운데(0, 10) 까지
// **18 걸음**이다. 골 바닥이 남북으로 뚫려 있어 자락 셋에 전부 걸어서 닿는다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { HAZARD_LAYER } from './phases';
import { FEATURE_LAYER, FROST_TAG } from './terrain-rules';

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
    ],
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
