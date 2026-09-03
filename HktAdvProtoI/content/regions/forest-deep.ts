// 숲 안쪽 — depth wild. C002 에서 문이 가장 많은 방이다 (출구 다섯 · 01-spec SPEC-003).
//
// anchor 다섯 — 돌아가는 길 DEEP_TRAIL 은 남쪽 변, 둥지와 광석 지대는 서·동 변,
// 붉은눈 거목으로 다가서는 TREE_APPROACH 는 북쪽 변이다.
// ANCIENT_GATE 만 변이 아닌 안쪽 모서리 자리다 — 길이 아니라 문이기 때문이다 (01-spec UNRESOLVED 판정).
// 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 다른 방에서 다른 자리다 (C001 SPEC-001).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

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
    ],
  },
};
