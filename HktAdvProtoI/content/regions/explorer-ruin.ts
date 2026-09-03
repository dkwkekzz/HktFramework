// 탐험대 폐허 — depth wild. C002 에서는 출구 하나뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor RUIN_TRAIL 은 동쪽 변 근처 — 숲 가장자리로 돌아가는 길 하나가 전부다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const EXPLORER_RUIN = 'EXPLORER_RUIN';

export const EXPLORER_RUIN_SPEC: RegionSpec = {
  id: EXPLORER_RUIN,
  depth: 'wild',
  space: {
    id: EXPLORER_RUIN,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 4,
    ops: [
      {
        id: 'anchor-ruin-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RUIN_TRAIL',
        position: { x: 18, z: 0 },
      },
    ],
  },
};
