// 붉은 눈의 거목 — depth wild. C003 에서 지어진 방이다 (C002 까지는 이름만 있던 경계).
//
// anchor 셋 — 숲 안쪽에서 다가서는 FOREST_DEEP_SIDE 는 남쪽 변, 광석 지대에서 오는 ORE_SIDE 는 동쪽 변,
// 안으로 드는 INNER_DOOR 만 변이 아니라 방 안쪽 자리다 — 길이 아니라 나무 밑동의 작은 문이기 때문이다
// (01-spec UNRESOLVED 판정 · Play §5.8).
// 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 다른 방에서 다른 자리다 (C001 SPEC-001).
// 이 방에는 anchor 말고 아무 것도 없다 — 몸도 광맥도 놓이지 않는다 (01-spec SPEC-001 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const RED_EYE_TREE = 'RED_EYE_TREE';

export const RED_EYE_TREE_SPEC: RegionSpec = {
  id: RED_EYE_TREE,
  depth: 'wild',
  space: {
    id: RED_EYE_TREE,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 7,
    ops: [
      {
        id: 'anchor-forest-deep-side',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FOREST_DEEP_SIDE',
        position: { x: 0, z: -18 },
      },
      {
        id: 'anchor-ore-side',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ORE_SIDE',
        position: { x: 18, z: 0 },
      },
      {
        id: 'anchor-inner-door',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'INNER_DOOR',
        position: { x: 0, z: 6 },
      },
    ],
  },
};
