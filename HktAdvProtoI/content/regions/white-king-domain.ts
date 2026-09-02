// 백왕령 — depth civil. 관찰자의 몸이 처음 놓이는 방 (C001).
//
// anchor FOREST_PATH 는 북쪽 변 근처 — WE §32 "숲의 South 가 백왕령" 이므로 숲으로 가는 길은 북쪽이다.
// 좌표는 배치 데이터다 (SPAWN_POINTS 선례).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const WHITE_KING_DOMAIN = 'WHITE_KING_DOMAIN';

export const WHITE_KING_DOMAIN_SPEC: RegionSpec = {
  id: WHITE_KING_DOMAIN,
  depth: 'civil',
  space: {
    id: WHITE_KING_DOMAIN,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 1,
    ops: [
      {
        id: 'anchor-forest-path',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FOREST_PATH',
        position: { x: 0, z: 18 },
      },
    ],
  },
};
