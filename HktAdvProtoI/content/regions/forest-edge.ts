// 숲 가장자리 — depth outer. C001 에서는 출구 하나뿐인 빈 방이다.
//
// anchor FOREST_PATH 는 남쪽 변 근처 — 백왕령이 이 숲의 South 에 있다 (WE §32).
// 두 Region 의 좌표는 서로 무관하다 — 같은 (x, z) 가 다른 자리다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const FOREST_EDGE = 'FOREST_EDGE';

export const FOREST_EDGE_SPEC: RegionSpec = {
  id: FOREST_EDGE,
  depth: 'outer',
  space: {
    id: FOREST_EDGE,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 2,
    ops: [
      {
        id: 'anchor-forest-path',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FOREST_PATH',
        position: { x: 0, z: -18 },
      },
    ],
  },
};
