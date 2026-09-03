// 포식수 둥지 — depth wild. C002 에서는 출구 하나뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor NEST_TRAIL 은 동쪽 변 근처 — 숲 안쪽으로 돌아가는 길 하나가 전부다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const PREDATOR_NEST = 'PREDATOR_NEST';

export const PREDATOR_NEST_SPEC: RegionSpec = {
  id: PREDATOR_NEST,
  depth: 'wild',
  space: {
    id: PREDATOR_NEST,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 5,
    ops: [
      {
        id: 'anchor-nest-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'NEST_TRAIL',
        position: { x: 18, z: 0 },
      },
    ],
  },
};
