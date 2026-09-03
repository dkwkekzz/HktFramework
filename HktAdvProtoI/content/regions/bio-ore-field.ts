// 생체 광석 지대 — depth wild. C002 에서는 출구 둘뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor ORE_TRAIL 은 서쪽 변 근처(숲 안쪽으로 돌아가는 길) ·
// TREE_TRAIL 은 북쪽 변 근처(붉은눈 거목으로 가는 길)다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const BIO_ORE_FIELD = 'BIO_ORE_FIELD';

export const BIO_ORE_FIELD_SPEC: RegionSpec = {
  id: BIO_ORE_FIELD,
  depth: 'wild',
  space: {
    id: BIO_ORE_FIELD,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 6,
    ops: [
      {
        id: 'anchor-ore-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ORE_TRAIL',
        position: { x: -18, z: 0 },
      },
      {
        id: 'anchor-tree-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'TREE_TRAIL',
        position: { x: 0, z: 18 },
      },
    ],
  },
};
