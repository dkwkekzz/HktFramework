// 숲 안쪽 — depth wild. C002 에서 문이 가장 많은 방이다 (출구 다섯 · 01-spec SPEC-003).
//
// anchor 다섯 — 돌아가는 길 DEEP_TRAIL 은 남쪽 변, 둥지와 광석 지대는 서·동 변,
// 붉은눈 거목으로 다가서는 TREE_APPROACH 는 북쪽 변이다.
// ANCIENT_GATE 만 변이 아닌 안쪽 모서리 자리다 — 길이 아니라 문이기 때문이다 (01-spec UNRESOLVED 판정).
// 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 다른 방에서 다른 자리다 (C001 SPEC-001).
//
// C003 CHANGED — anchor 가 여섯이 된다. 물길이 나오는 RIVER_MOUTH 는 네 변이 이미 찼으므로 안쪽 자리이고,
// 거목으로 나가는 TREE_APPROACH(0, 18) 와 가장 먼 쪽이다 — "들어갔던 자리가 아니다" 가 걸음으로 읽힌다.
// 이 방에서 나가는 끝은 그래도 다섯 그대로다 — RIVER_MOUTH 로 나가는 Connector 가 없기 때문이다
// (물길은 들어오기만 하는 one-way 다 · 01-spec SPEC-002 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { TRACE_LAYER, soilStainTag } from './resource-ecology';

export const FOREST_DEEP = 'FOREST_DEEP';

export const FOREST_DEEP_SPEC: RegionSpec = {
  id: FOREST_DEEP,
  depth: 'wild',
  space: {
    id: FOREST_DEEP,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 3,
    ops: [
      {
        id: 'anchor-deep-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'DEEP_TRAIL',
        position: { x: 0, z: -18 },
      },
      {
        id: 'anchor-nest-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'NEST_TRAIL',
        position: { x: -18, z: 0 },
      },
      {
        id: 'anchor-ore-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ORE_TRAIL',
        position: { x: 18, z: 0 },
      },
      {
        id: 'anchor-tree-approach',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'TREE_APPROACH',
        position: { x: 0, z: 18 },
      },
      {
        id: 'anchor-ancient-gate',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ANCIENT_GATE',
        position: { x: -13, z: 13 },
      },
      {
        id: 'anchor-river-mouth',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RIVER_MOUTH',
        position: { x: 14, z: -8 },
      },
      // ── C011 ADDED — 흔적만 있고 원천은 없다 ───────────────────────────────
      //
      // A.3 의 **중간부**다: "원천은 없고 방향이 있다". 방 전체가 경계부보다 한 단계 짙고,
      // 안쪽으로 가는 출구 둘 둘레가 다시 한 단계 짙다 —
      //   동쪽 ORE_TRAIL (18, 0)     → 생체 광석 지대
      //   북쪽 TREE_APPROACH (0, 18) → 붉은 눈의 거목
      // 서쪽 NEST_TRAIL (-18, 0) 둘레는 짙어지지 않는다. 둥지의 균류는 이 계통의 **끝**이고
      // 그 원천은 C014 의 것이다 — 없는 방향을 미리 가리키지 않는다.
      {
        id: 'trace-deep-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
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
      {
        id: 'trace-deep-toward-ore',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 18, z: 0 }, radius: 8 },
      },
      {
        id: 'trace-deep-toward-tree',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 0, z: 18 }, radius: 8 },
      },
    ],
  },
};
