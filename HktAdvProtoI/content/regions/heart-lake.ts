// 심장 호수 — depth deep. 떨어져 닿는 방이다 (01-spec SPEC-007).
//
// anchor 둘 — FALL_LANDING 은 방 한가운데다. 떨어진 자리는 변이 아니라 어디의 한복판이고,
// 그래서 "올라갈 길이 없다" 가 사방으로 읽힌다 (01-spec UNRESOLVED 판정).
// 그 자리로 되돌아오는 Connector 는 하나도 없다 — 나가는 끝은 물길 RIVER 하나뿐이고 남쪽 변이다.
// 이 방에는 anchor 말고 아무 것도 없다 (01-spec SPEC-001 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const HEART_LAKE = 'HEART_LAKE';

export const HEART_LAKE_SPEC: RegionSpec = {
  id: HEART_LAKE,
  depth: 'deep',
  space: {
    id: HEART_LAKE,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 9,
    ops: [
      {
        id: 'anchor-fall-landing',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FALL_LANDING',
        position: { x: 0, z: 0 },
      },
      {
        id: 'anchor-river',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RIVER',
        position: { x: 0, z: -18 },
      },
    ],
  },
};
